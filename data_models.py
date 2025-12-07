"""
Data models for tweet and user features.
"""
from dataclasses import dataclass
from typing import Optional
import numpy as np

@dataclass
class TweetFeatures:
    """Features extracted from a single tweet."""
    embedding: np.ndarray  # SentenceTransformer embedding
    sentiment: float  # Sentiment score in [-1, 1]
    emotion: np.ndarray  # Emotion vector (3-dim)
    category: str  # Category: tech, travel, finance, fitness, crypto, shopping, other
    created_at: str  # Timestamp string


@dataclass
class UserStaticFeatures:
    """Static features aggregated for a user."""
    interest_emb: np.ndarray  # Mean of tweet embeddings
    avg_sentiment: float
    sentiment_volatility: float
    emotion_profile: np.ndarray  # Mean of tweet emotion vectors
    tweets_per_day: float
    reply_ratio: float
    retweet_ratio: float
    original_ratio: float
    avg_tweet_length: float
    category_sentiments: dict[str, float]  # Per-category avg sentiment
    category_volumes: dict[str, int]  # Per-category tweet counts

