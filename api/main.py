"""
FastAPI endpoint for generating user embeddings from X (Twitter) data.
"""
import os
import sys
from typing import Optional, List
from contextlib import asynccontextmanager

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scrape.scraper import XAPIScraper
from features.tweet_features import TweetFeatureExtractor
from features.user_features import UserFeatureAggregator


# Global instances (loaded once at startup)
tweet_extractor: Optional[TweetFeatureExtractor] = None
user_aggregator: Optional[UserFeatureAggregator] = None
scraper: Optional[XAPIScraper] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load ML models on startup."""
    global tweet_extractor, user_aggregator, scraper
    
    print("Loading ML models...")
    tweet_extractor = TweetFeatureExtractor()
    user_aggregator = UserFeatureAggregator()
    
    # Initialize scraper with bearer token from environment
    # bearer_token = os.environ.get("X_BEARER_TOKEN")
    bearer_token = "AAAAAAAAAAAAAAAAAAAAABF85wEAAAAA%2FnMWPzmGsJzGlLiJu7hAo73m0Zg%3D6NwtTNdtNS3eSmbvANeIemAtiC29JtrhOjQhzNQ697qc6AMBAW"
    if bearer_token:
        scraper = XAPIScraper(bearer_token)
        print("X API scraper initialized.")
    else:
        print("WARNING: X_BEARER_TOKEN not set. Scraper not initialized.")
    
    print("Models loaded successfully!")
    yield
    
    # Cleanup (if needed)
    print("Shutting down...")


app = FastAPI(
    title="xAI Ads - User Embedding API",
    description="Generate user embeddings from X (Twitter) data for ad targeting",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Local Next.js dev
        "https://*.vercel.app",   # Vercel preview deployments
        os.environ.get("FRONTEND_URL", ""),  # Production frontend URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----- Request/Response Models -----

class EmbeddingRequest(BaseModel):
    """Request model for generating user embedding."""
    username: str = Field(..., description="X (Twitter) username without @")
    max_tweets: int = Field(default=100, ge=1, le=200, description="Maximum tweets to fetch (1-200)")


class UserInfo(BaseModel):
    """User information from X API."""
    user_id: str
    username: str
    name: Optional[str] = None
    description: Optional[str] = None
    followers_count: int = 0
    following_count: int = 0
    tweet_count: int = 0
    created_at: Optional[str] = None


class EmbeddingResponse(BaseModel):
    """Response model containing user embedding."""
    user_info: UserInfo
    embedding: List[float]
    embedding_dim: int
    num_tweets_processed: int
    feature_breakdown: dict


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    models_loaded: bool
    scraper_ready: bool


# ----- Endpoints -----

@app.get("/", response_model=dict)
async def root():
    """Root endpoint with API info."""
    return {
        "name": "xAI Ads - User Embedding API",
        "version": "1.0.0",
        "docs_url": "/docs"
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check API health and model status."""
    return HealthResponse(
        status="healthy",
        models_loaded=tweet_extractor is not None and user_aggregator is not None,
        scraper_ready=scraper is not None
    )


@app.post("/embedding", response_model=EmbeddingResponse)
async def generate_embedding(request: EmbeddingRequest):
    """
    Generate user embedding from X (Twitter) username.
    
    This endpoint:
    1. Fetches user info from X API
    2. Fetches user's recent tweets
    3. Extracts features from each tweet (embedding, sentiment, emotion, category)
    4. Aggregates into a single 408-dimensional user embedding vector
    
    The embedding contains:
    - Interest embedding (384-dim): Mean of tweet embeddings
    - Scalar features (7-dim): sentiment, volatility, activity metrics
    - Emotion profile (3-dim): joy, sadness, anger distribution
    - Category sentiments (7-dim): per-category avg sentiment
    - Category volumes (7-dim): per-category tweet counts
    """
    if scraper is None:
        raise HTTPException(
            status_code=503,
            detail="X API scraper not initialized. Set X_BEARER_TOKEN environment variable."
        )
    
    if tweet_extractor is None or user_aggregator is None:
        raise HTTPException(
            status_code=503,
            detail="ML models not loaded. Please wait for startup to complete."
        )
    
    username = request.username.lstrip("@")
    
    # Step 1: Get user info
    print(f"Fetching user info for @{username}...")
    user_data = scraper.get_user_by_username(username)
    
    if user_data is None:
        raise HTTPException(
            status_code=404,
            detail=f"User @{username} not found or API error occurred."
        )
    
    user_id = user_data.get("id")
    public_metrics = user_data.get("public_metrics", {})
    
    user_info = UserInfo(
        user_id=user_id,
        username=user_data.get("username", username),
        name=user_data.get("name"),
        description=user_data.get("description"),
        followers_count=public_metrics.get("followers_count", 0),
        following_count=public_metrics.get("following_count", 0),
        tweet_count=public_metrics.get("tweet_count", 0),
        created_at=user_data.get("created_at")
    )
    
    # Step 2: Fetch tweets
    print(f"Fetching up to {request.max_tweets} tweets for user {user_id}...")
    tweets = scraper.get_user_tweets(user_id, max_results=request.max_tweets)
    
    if not tweets:
        raise HTTPException(
            status_code=404,
            detail=f"No tweets found for user @{username}."
        )
    
    # Step 3: Extract tweet features
    print(f"Extracting features from {len(tweets)} tweets...")
    tweet_features = {}
    for tweet in tweets:
        tweet_id = tweet.get("id", 0)
        features = tweet_extractor.extract_features(tweet)
        tweet_features[tweet_id] = features
    
    # Step 4: Aggregate user features
    print("Aggregating user features...")
    user_static_features = user_aggregator.aggregate_user_features(
        user_id=int(user_id),
        tweets=tweets,
        tweet_features=tweet_features,
        user_info=user_data
    )
    
    # Step 5: Create user base vector (408-dim embedding)
    user_embedding = user_aggregator.create_user_base_vector(user_static_features)
    
    # Prepare feature breakdown for response
    feature_breakdown = {
        "interest_embedding_dim": 384,
        "scalar_features": {
            "avg_sentiment": float(user_static_features.avg_sentiment),
            "sentiment_volatility": float(user_static_features.sentiment_volatility),
            "tweets_per_day": float(user_static_features.tweets_per_day),
            "reply_ratio": float(user_static_features.reply_ratio),
            "retweet_ratio": float(user_static_features.retweet_ratio),
            "original_ratio": float(user_static_features.original_ratio),
            "avg_tweet_length": float(user_static_features.avg_tweet_length)
        },
        "emotion_profile": {
            "joy": float(user_static_features.emotion_profile[0]),
            "sadness": float(user_static_features.emotion_profile[1]),
            "anger": float(user_static_features.emotion_profile[2])
        },
        "category_sentiments": {k: float(v) for k, v in user_static_features.category_sentiments.items()},
        "category_volumes": user_static_features.category_volumes
    }
    
    print(f"Generated embedding with shape: {user_embedding.shape}")
    
    return EmbeddingResponse(
        user_info=user_info,
        embedding=user_embedding.tolist(),
        embedding_dim=len(user_embedding),
        num_tweets_processed=len(tweets),
        feature_breakdown=feature_breakdown
    )


@app.post("/embedding/batch", response_model=List[EmbeddingResponse])
async def generate_embeddings_batch(usernames: List[str]):
    """
    Generate embeddings for multiple users.
    
    Note: This endpoint processes users sequentially to respect rate limits.
    """
    if len(usernames) > 10:
        raise HTTPException(
            status_code=400,
            detail="Maximum 10 usernames per batch request."
        )
    
    results = []
    for username in usernames:
        try:
            request = EmbeddingRequest(username=username)
            result = await generate_embedding(request)
            results.append(result)
        except HTTPException as e:
            # Skip users that fail, but log the error
            print(f"Failed to process @{username}: {e.detail}")
            continue
    
    return results


# ----- Visualization Endpoints -----

class VisualizationRequest(BaseModel):
    """Request model for visualization data."""
    method: str = Field(default="pca", description="Dimensionality reduction method: 'pca' or 'tsne'")
    dimensions: int = Field(default=3, ge=2, le=3, description="Output dimensions: 2 or 3")
    include_new_embedding: Optional[List[float]] = Field(default=None, description="Optional new embedding to include")


class VisualizationPoint(BaseModel):
    """A single point in the visualization."""
    x: float
    y: float
    z: Optional[float] = None
    index: int
    is_new: bool = False
    user_id: Optional[str] = None
    username: Optional[str] = None
    profile_image_url: Optional[str] = None


class VisualizationResponse(BaseModel):
    """Response with projected points for visualization."""
    points: List[VisualizationPoint]
    method: str
    dimensions: int
    total_points: int


@app.post("/visualize", response_model=VisualizationResponse)
async def get_visualization_data(request: VisualizationRequest):
    """
    Get dimensionality-reduced data for visualization.
    
    Loads user_embeddingsv2.npy and projects to 2D or 3D using PCA or t-SNE.
    Optionally includes a new embedding (e.g., from a just-scraped user).
    """
    from sklearn.decomposition import PCA
    from sklearn.manifold import TSNE
    
    # Load existing embeddings
    node_features_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "user_embeddingsv2.npy"
    )
    
    if not os.path.exists(node_features_path):
        raise HTTPException(status_code=404, detail="user_embeddingsv2.npy not found")
    
    embeddings = np.load(node_features_path)
    num_existing = embeddings.shape[0]
    
    # Optionally add new embedding
    has_new = False
    if request.include_new_embedding:
        new_emb = np.array(request.include_new_embedding).reshape(1, -1)
        expected_dim = embeddings.shape[1]
        
        # If dimensions don't match, project the new embedding to match
        if new_emb.shape[1] != expected_dim:
            if new_emb.shape[1] > expected_dim:
                # New embedding is larger (e.g., 408-dim) - reduce to match existing (e.g., 128-dim)
                # Use simple truncation: take first N dimensions
                # This assumes the existing embeddings were created by taking first N dims of larger embeddings
                new_emb = new_emb[:, :expected_dim]
            else:
                # New embedding is smaller - pad with zeros
                padding = np.zeros((1, expected_dim - new_emb.shape[1]))
                new_emb = np.hstack([new_emb, padding])
        
        embeddings = np.vstack([embeddings, new_emb])
        has_new = True
    
    # Apply dimensionality reduction
    n_components = request.dimensions
    
    if request.method.lower() == "tsne":
        # t-SNE (slower but better for visualization)
        perplexity = min(30, embeddings.shape[0] - 1)
        reducer = TSNE(n_components=n_components, perplexity=perplexity, random_state=42)
        projected = reducer.fit_transform(embeddings)
    else:
        # PCA (fast, default)
        reducer = PCA(n_components=n_components, random_state=42)
        projected = reducer.fit_transform(embeddings)
    
    # Normalize to reasonable range for visualization
    projected = (projected - projected.min(axis=0)) / (projected.max(axis=0) - projected.min(axis=0) + 1e-8)
    projected = projected * 20 - 10  # Scale to [-10, 10]
    
    # Load node_id_map to get user IDs
    node_id_map_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "node_id_mapv2.json"
    )
    
    idx_to_user_id = {}
    if os.path.exists(node_id_map_path):
        import json
        with open(node_id_map_path, 'r') as f:
            node_map = json.load(f)
        idx_to_user_id = node_map.get("idx_to_user_id", {})
    
    # Build response points
    # Note: profile_image_url will be fetched client-side via /users/:id/avatar endpoint
    points = []
    for i in range(projected.shape[0]):
        user_id_raw = idx_to_user_id.get(str(i))
        # Convert to string if it exists (JSON may have integers)
        user_id = str(user_id_raw) if user_id_raw is not None else None
        
        point = VisualizationPoint(
            x=float(projected[i, 0]),
            y=float(projected[i, 1]),
            z=float(projected[i, 2]) if n_components == 3 else None,
            index=i,
            is_new=(i >= num_existing),
            user_id=user_id
        )
        points.append(point)
    
    return VisualizationResponse(
        points=points,
        method=request.method.lower(),
        dimensions=n_components,
        total_points=len(points)
    )


# ----- Graph Search Endpoints -----

class GraphSearchRequest(BaseModel):
    """Request model for searching users in the graph."""
    handle: str = Field(..., description="X (Twitter) handle (with or without @)")


class SimilarUser(BaseModel):
    """Information about a similar user."""
    node_index: int
    user_id: str
    username: str
    similarity_score: float


class GraphSearchResponse(BaseModel):
    """Response model for graph search."""
    found: bool
    node_index: Optional[int] = None
    user_id: Optional[str] = None
    username: Optional[str] = None
    similar_users: List[SimilarUser] = []


class BuyingBehaviorResponse(BaseModel):
    """Response model for user buying behavior."""
    user_id: str
    username: str
    feature_breakdown: dict


@app.post("/graph/search", response_model=GraphSearchResponse)
async def search_user_in_graph(request: GraphSearchRequest):
    """
    Search for a user in the graph by their X handle.
    
    Returns the node index if found, along with similar users (neighbors).
    """
    import json
    from sklearn.metrics.pairwise import cosine_similarity
    
    if scraper is None:
        raise HTTPException(
            status_code=503,
            detail="X API scraper not initialized."
        )
    
    # Clean handle
    handle = request.handle.lstrip("@").strip()
    
    # Step 1: Get user info from X API to get user_id
    user_data = scraper.get_user_by_username(handle)
    if user_data is None:
        return GraphSearchResponse(found=False, similar_users=[])
    
    user_id = str(user_data.get("id"))
    username = user_data.get("username", handle)
    
    # Step 2: Load node_id_map to check if user is in graph
    node_id_map_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "node_id_mapv2.json"
    )
    
    if not os.path.exists(node_id_map_path):
        raise HTTPException(status_code=404, detail="Graph data not found")
    
    with open(node_id_map_path, 'r') as f:
        node_map = json.load(f)
    
    user_id_to_idx = node_map.get("user_id_to_idx", {})
    idx_to_user_id = node_map.get("idx_to_user_id", {})
    
    # Check if user is in graph
    if user_id not in user_id_to_idx:
        return GraphSearchResponse(found=False, similar_users=[])
    
    node_index = user_id_to_idx[user_id]
    
    # Step 3: Load node features and find similar users
    node_features_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "user_embeddingsv2.npy"
    )
    
    if not os.path.exists(node_features_path):
        raise HTTPException(status_code=404, detail="user_embeddingsv2.npy not found")
    
    node_features = np.load(node_features_path)
    
    # Step 4: Load edge_index to find neighbors
    edge_index_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "graph",
        "edge_index.npy"
    )
    
    similar_users = []
    neighbor_indices = set()
    
    if os.path.exists(edge_index_path):
        edge_index = np.load(edge_index_path)
        # Find neighbors: edges where this node is the source
        neighbor_mask = edge_index[0] == node_index
        neighbor_indices = set(edge_index[1, neighbor_mask].tolist())
    
    # If no neighbors from edges, use cosine similarity
    if not neighbor_indices:
        # Compute similarity with all nodes
        user_embedding = node_features[node_index:node_index+1]
        similarities = cosine_similarity(user_embedding, node_features)[0]
        
        # Get top 5 similar (excluding self)
        top_indices = np.argsort(similarities)[::-1]
        top_indices = [idx for idx in top_indices if idx != node_index][:5]
        neighbor_indices = set(top_indices)
    
    # Build similar users list
    for neighbor_idx in list(neighbor_indices)[:5]:  # Limit to 5
        neighbor_user_id_raw = idx_to_user_id.get(str(neighbor_idx))
        neighbor_user_id = str(neighbor_user_id_raw) if neighbor_user_id_raw is not None else None
        if neighbor_user_id:
            # Try to get username from X API (or use user_id as fallback)
            neighbor_username = neighbor_user_id  # Fallback
            try:
                neighbor_data = scraper.get_user_by_id(neighbor_user_id)
                if neighbor_data:
                    neighbor_username = neighbor_data.get("username", neighbor_user_id)
            except:
                pass
            
            # Compute similarity score
            user_emb = node_features[node_index:node_index+1]
            neighbor_emb = node_features[neighbor_idx:neighbor_idx+1]
            similarity = float(cosine_similarity(user_emb, neighbor_emb)[0, 0])
            
            similar_users.append(SimilarUser(
                node_index=int(neighbor_idx),
                user_id=neighbor_user_id,
                username=neighbor_username,
                similarity_score=similarity
            ))
    
    # Sort by similarity
    similar_users.sort(key=lambda x: x.similarity_score, reverse=True)
    
    return GraphSearchResponse(
        found=True,
        node_index=int(node_index),
        user_id=user_id,
        username=username,
        similar_users=similar_users
    )


# ----- Avatar Endpoint -----

class AvatarResponse(BaseModel):
    """Response model for user avatar."""
    user_id: str
    profile_image_url: Optional[str] = None
    username: Optional[str] = None


@app.get("/users/{user_id}/avatar", response_model=AvatarResponse)
async def get_user_avatar(user_id: str):
    """
    Get user avatar/profile image from X API.
    
    Uses GET /2/users/:id with user.fields=profile_image_url
    """
    if scraper is None:
        raise HTTPException(
            status_code=503,
            detail="X API scraper not initialized."
        )
    
    try:
        # Use the scraper's get_user_by_id method
        user_data = scraper.get_user_by_id(user_id)
        
        if user_data is None:
            raise HTTPException(
                status_code=404,
                detail=f"User {user_id} not found"
            )
        
        profile_image_url = user_data.get("profile_image_url")
        username = user_data.get("username")
        
        return AvatarResponse(
            user_id=user_id,
            profile_image_url=profile_image_url,
            username=username
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch user avatar: {str(e)}"
        )


# ----- Grok Ad Targeting Endpoint -----

class GrokTargetRequest(BaseModel):
    """Request model for Grok ad targeting."""
    ad_idea: str = Field(..., description="Description of the ad idea")


class GrokTargetResponse(BaseModel):
    """Response model for Grok ad targeting."""
    target_node_indices: List[int] = Field(..., description="List of node indices to highlight")
    reasoning: Optional[str] = Field(None, description="Explanation of why these users were selected")


@app.post("/grok/target", response_model=GrokTargetResponse)
async def grok_target_users(request: GrokTargetRequest):
    """
    Use Grok to find the best targeted customers for an ad idea.
    
    For now, this returns a spatially close cluster of users as a placeholder.
    In the future, this will use Grok API to analyze the ad idea and find
    the most relevant user cluster based on their embeddings and interests.
    """
    import json
    import random
    from sklearn.decomposition import PCA
    from sklearn.metrics.pairwise import euclidean_distances
    
    # Load embeddings
    embeddings_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "user_embeddingsv2.npy"
    )
    
    if not os.path.exists(embeddings_path):
        raise HTTPException(status_code=404, detail="Embeddings not found")
    
    embeddings = np.load(embeddings_path)
    total_nodes = embeddings.shape[0]
    
    if total_nodes == 0:
        raise HTTPException(status_code=404, detail="No nodes found in graph")
    
    # Project to 3D using PCA (same as visualization)
    pca = PCA(n_components=3, random_state=42)
    projected = pca.fit_transform(embeddings)
    
    # Normalize to same range as visualization
    projected = (projected - projected.min(axis=0)) / (projected.max(axis=0) - projected.min(axis=0) + 1e-8)
    projected = projected * 20 - 10  # Scale to [-10, 10]
    
    # Pick a random point as cluster center
    center_idx = random.randint(0, total_nodes - 1)
    center_point = projected[center_idx:center_idx+1]
    
    # Calculate distances from center to all points
    distances = euclidean_distances(center_point, projected)[0]
    
    # Select 20-30 closest nodes (excluding the center itself)
    cluster_size = random.randint(20, 30)
    # Get indices sorted by distance
    sorted_indices = np.argsort(distances)
    # Skip the center point itself, take next cluster_size points
    target_indices = sorted_indices[1:cluster_size+1].tolist()
    
    reasoning = f"Selected {len(target_indices)} users from a spatially close cluster as a placeholder. Future implementation will use Grok to analyze: '{request.ad_idea}'"
    
    return GrokTargetResponse(
        target_node_indices=target_indices,
        reasoning=reasoning
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
