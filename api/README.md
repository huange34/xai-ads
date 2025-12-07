# xAI Ads - User Embedding API

FastAPI endpoint for generating user embeddings from X (Twitter) data.

## Overview

This API takes a username and returns a **408-dimensional embedding vector** that represents the user's interests, sentiment patterns, and activity metrics based on their tweets.

## Embedding Structure

The 408-dimensional vector is composed of:

| Component | Dimensions | Description |
|-----------|------------|-------------|
| Interest Embedding | 384 | Mean of SentenceTransformer embeddings from user's tweets |
| Scalar Features | 7 | avg_sentiment, sentiment_volatility, tweets_per_day, reply_ratio, retweet_ratio, original_ratio, avg_tweet_length |
| Emotion Profile | 3 | joy, sadness, anger distribution |
| Category Sentiments | 7 | Per-category average sentiment (tech, travel, finance, fitness, crypto, shopping, other) |
| Category Volumes | 7 | Per-category tweet counts |

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
pip install fastapi uvicorn
```

### 2. Set Environment Variable

```bash
# Windows PowerShell
$env:X_BEARER_TOKEN = "your_bearer_token_here"

# Linux/Mac
export X_BEARER_TOKEN="your_bearer_token_here"
```

### 3. Run the API

```bash
# From project root
cd api
python main.py

# Or with uvicorn directly
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

## API Endpoints

### Health Check
```
GET /health
```
Returns API status and whether models are loaded.

### Generate Embedding
```
POST /embedding
```

**Request Body:**
```json
{
    "username": "elonmusk",
    "max_tweets": 100
}
```

**Response:**
```json
{
    "user_info": {
        "user_id": "44196397",
        "username": "elonmusk",
        "name": "Elon Musk",
        "description": "...",
        "followers_count": 170000000,
        "following_count": 500,
        "tweet_count": 30000,
        "created_at": "2009-06-02T20:12:29.000Z"
    },
    "embedding": [0.123, -0.456, ...],  // 408 floats
    "embedding_dim": 408,
    "num_tweets_processed": 100,
    "feature_breakdown": {
        "interest_embedding_dim": 384,
        "scalar_features": {
            "avg_sentiment": 0.15,
            "sentiment_volatility": 0.32,
            "tweets_per_day": 5.2,
            "reply_ratio": 0.3,
            "retweet_ratio": 0.1,
            "original_ratio": 0.6,
            "avg_tweet_length": 142.5
        },
        "emotion_profile": {
            "joy": 0.6,
            "sadness": 0.2,
            "anger": 0.2
        },
        "category_sentiments": {...},
        "category_volumes": {...}
    }
}
```

### Batch Embeddings
```
POST /embedding/batch
```

**Request Body:**
```json
["user1", "user2", "user3"]
```

Returns an array of embedding responses (max 10 users per request).

## Interactive Docs

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Example Usage

### Python
```python
import requests

response = requests.post(
    "http://localhost:8000/embedding",
    json={"username": "elonmusk", "max_tweets": 50}
)
data = response.json()
embedding = data["embedding"]  # 408-dim vector
```

### cURL
```bash
curl -X POST "http://localhost:8000/embedding" \
     -H "Content-Type: application/json" \
     -d '{"username": "elonmusk", "max_tweets": 50}'
```

## Rate Limits

The X API has rate limits. The scraper handles rate limiting automatically by waiting when limits are reached. For batch requests, users are processed sequentially.

## Models Used

- **SentenceTransformer**: `all-MiniLM-L6-v2` (384-dim embeddings)
- **Sentiment**: `cardiffnlp/twitter-roberta-base-sentiment-latest`
