"""
User graph construction from follow edges, interaction edges, and similarity edges.
"""
import numpy as np
from typing import Dict, List, Tuple
from collections import defaultdict
from sklearn.metrics.pairwise import cosine_similarity
from tqdm import tqdm

from data_models import UserStaticFeatures


class GraphBuilder:
    """Builds user graph from multiple edge sources."""
    
    def __init__(self, top_k_similar: int = 10):
        """
        Args:
            top_k_similar: Number of top similar neighbors to connect
        """
        self.top_k_similar = top_k_similar
    
    def normalize_weights(self, weights: Dict[Tuple[int, int], float]) -> Dict[Tuple[int, int], float]:
        """Normalize edge weights to [0, 1]."""
        if not weights:
            return {}
        
        values = list(weights.values())
        min_val = min(values)
        max_val = max(values)
        
        if max_val == min_val:
            return {edge: 1.0 for edge in weights}
        
        return {
            edge: (w - min_val) / (max_val - min_val)
            for edge, w in weights.items()
        }
    
    def build_follow_edges(
        self,
        follow_edges: List[Tuple[int, int]],
        user_ids: set
    ) -> Dict[Tuple[int, int], float]:
        """
        Build follow edges (binary, normalized to [0, 1]).
        
        Returns:
            follow_weights[(src, dst)] = weight
        """
        follow_weights = {}
        
        for src, dst in follow_edges:
            if src in user_ids and dst in user_ids:
                follow_weights[(src, dst)] = 1.0
        
        # Normalize (though they're all 1.0, this keeps consistency)
        return self.normalize_weights(follow_weights)
    
    def build_interaction_edges(
        self,
        tweets_by_user: Dict[int, List[dict]],
        user_ids: set
    ) -> Dict[Tuple[int, int], float]:
        """
        Build interaction edges from replies, quotes, retweets.
        
        Returns:
            interaction_weights[(src, dst)] = weighted_count
        """
        interaction_counts = defaultdict(float)
        
        print("Building interaction edges...")
        for user_id, tweets in tqdm(tweets_by_user.items(), desc="Processing interactions"):
            if user_id not in user_ids:
                continue
            
            for tweet in tweets:
                # Replies
                reply_to_user = tweet.get('in_reply_to_user_id')
                if reply_to_user and reply_to_user in user_ids:
                    interaction_counts[(user_id, reply_to_user)] += 1.0
                
                # Referenced tweets (quotes, retweets)
                referenced = tweet.get('referenced_tweets', [])
                for ref in referenced:
                    if isinstance(ref, dict):
                        ref_type = ref.get('type', '')
                        ref_user_id = ref.get('user_id')
                        
                        if ref_user_id and ref_user_id in user_ids:
                            if ref_type == 'quoted':
                                interaction_counts[(user_id, ref_user_id)] += 1.5
                            elif ref_type == 'retweeted':
                                interaction_counts[(user_id, ref_user_id)] += 1.0
        
        return self.normalize_weights(interaction_counts)
    
    def build_similarity_edges(
        self,
        user_static_features: Dict[int, UserStaticFeatures],
        user_ids: set
    ) -> Dict[Tuple[int, int], float]:
        """
        Build similarity edges using cosine similarity over interest embeddings.
        Connect each user to top-K neighbors.
        
        Returns:
            similarity_weights[(src, dst)] = cosine_similarity
        """
        # Get interest embeddings
        user_id_list = sorted(list(user_ids))
        embeddings = []
        id_to_idx = {uid: idx for idx, uid in enumerate(user_id_list)}
        
        for user_id in user_id_list:
            if user_id in user_static_features:
                embeddings.append(user_static_features[user_id].interest_emb)
            else:
                # Zero embedding if no features
                embedding_dim = 384
                embeddings.append(np.zeros(embedding_dim))
        
        embeddings = np.array(embeddings)
        
        # Compute cosine similarity matrix
        print("Computing cosine similarity matrix...")
        similarity_matrix = cosine_similarity(embeddings)
        
        # For each user, connect to top-K neighbors
        similarity_weights = {}
        
        print(f"Connecting each user to top-{self.top_k_similar} similar neighbors...")
        for i, src_user_id in enumerate(tqdm(user_id_list, desc="Building similarity edges")):
            # Get similarities for this user
            similarities = similarity_matrix[i]
            
            # Get top-K (excluding self)
            top_k_indices = np.argsort(similarities)[::-1]
            top_k_indices = [idx for idx in top_k_indices if idx != i][:self.top_k_similar]
            
            for idx in top_k_indices:
                dst_user_id = user_id_list[idx]
                sim_score = similarities[idx]
                
                # Only keep positive similarities
                if sim_score > 0:
                    similarity_weights[(src_user_id, dst_user_id)] = sim_score
        
        # Normalize to [0, 1]
        return self.normalize_weights(similarity_weights)
    
    def combine_edges(
        self,
        follow_weights: Dict[Tuple[int, int], float],
        interaction_weights: Dict[Tuple[int, int], float],
        similarity_weights: Dict[Tuple[int, int], float],
        follow_weight: float = 0.2,
        interaction_weight: float = 0.3,
        similarity_weight: float = 0.5
    ) -> Dict[Tuple[int, int], float]:
        """
        Combine edge weights from different sources.
        
        final_weight = 0.2 * follow_w + 0.3 * interaction_w + 0.5 * similarity_w
        """
        all_edges = set(follow_weights.keys()) | set(interaction_weights.keys()) | set(similarity_weights.keys())
        
        combined_weights = {}
        
        for edge in all_edges:
            w_follow = follow_weights.get(edge, 0.0)
            w_interaction = interaction_weights.get(edge, 0.0)
            w_similarity = similarity_weights.get(edge, 0.0)
            
            final_weight = (
                follow_weight * w_follow +
                interaction_weight * w_interaction +
                similarity_weight * w_similarity
            )
            
            if final_weight > 0:
                combined_weights[edge] = final_weight
        
        return combined_weights
    
    def build_graph(
        self,
        tweets_by_user: Dict[int, List[dict]],
        user_static_features: Dict[int, UserStaticFeatures],
        follow_edges: List[Tuple[int, int]],
        user_base_vectors: Dict[int, np.ndarray]
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, Dict[int, int]]:
        """
        Build the complete user graph.
        
        Returns:
            (node_features, edge_index, edge_weights, node_id_map)
            where node_id_map maps user_id -> node_index
        """
        # Get all user IDs
        user_ids = set(tweets_by_user.keys())
        user_ids = user_ids | set(user_static_features.keys())
        user_ids = user_ids | set(user_base_vectors.keys())
        
        # Build edge sets
        print("Building follow edges...")
        follow_weights = self.build_follow_edges(follow_edges, user_ids)
        
        print("Building interaction edges...")
        interaction_weights = self.build_interaction_edges(tweets_by_user, user_ids)
        
        print("Building similarity edges...")
        similarity_weights = self.build_similarity_edges(user_static_features, user_ids)
        
        # Combine edges
        print("Combining edges...")
        combined_weights = self.combine_edges(
            follow_weights, interaction_weights, similarity_weights
        )
        
        # Create node features matrix
        user_id_list = sorted(list(user_ids))
        node_id_map = {user_id: idx for idx, user_id in enumerate(user_id_list)}
        
        # Get feature dimension
        if user_id_list and user_id_list[0] in user_base_vectors:
            feature_dim = len(user_base_vectors[user_id_list[0]])
        else:
            feature_dim = 384 + 7 + 3 + 7 + 7  # Default dimension
        
        node_features = np.zeros((len(user_id_list), feature_dim))
        
        for user_id, node_idx in node_id_map.items():
            if user_id in user_base_vectors:
                node_features[node_idx] = user_base_vectors[user_id]
        
        # Create edge index and weights
        edge_list = []
        edge_weights_list = []
        
        for (src, dst), weight in combined_weights.items():
            if src in node_id_map and dst in node_id_map:
                src_idx = node_id_map[src]
                dst_idx = node_id_map[dst]
                edge_list.append([src_idx, dst_idx])
                edge_weights_list.append(weight)
        
        if not edge_list:
            # Empty graph
            edge_index = np.array([[], []], dtype=np.int64)
            edge_weights = np.array([], dtype=np.float32)
        else:
            edge_index = np.array(edge_list, dtype=np.int64).T  # Shape (2, E)
            edge_weights = np.array(edge_weights_list, dtype=np.float32)  # Shape (E,)
        
        print(f"Graph built: {len(user_id_list)} nodes, {len(edge_weights_list)} edges")
        
        return node_features, edge_index, edge_weights, node_id_map

