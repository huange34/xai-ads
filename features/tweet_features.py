"""
Per-tweet feature extraction.
"""
import re
import numpy as np
from typing import Dict, List
from sentence_transformers import SentenceTransformer
from transformers import pipeline
from tqdm import tqdm

from data_models import TweetFeatures


class TweetFeatureExtractor:
    """Extracts features from individual tweets."""
    
    def __init__(self):
        # Initialize models
        print("Loading SentenceTransformer model...")
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        
        print("Loading sentiment analysis model...")
        self.sentiment_model = pipeline(
            "sentiment-analysis",
            model="cardiffnlp/twitter-roberta-base-sentiment-latest",
            return_all_scores=True
        )
        
        # Simple emotion categories (3-dim placeholder)
        self.emotion_keywords = {
            'joy': ['happy', 'excited', 'great', 'amazing', 'love', 'wonderful', 'fantastic'],
            'sadness': ['sad', 'disappointed', 'sorry', 'unfortunate', 'terrible', 'awful'],
            'anger': ['angry', 'furious', 'hate', 'annoyed', 'frustrated', 'mad']
        }
        
        # Category keywords for rule-based classification
        self.category_keywords = {
            'tech': ['ai', 'machine learning', 'python', 'code', 'software', 'app', 'tech', 'developer', 'programming', 'algorithm'],
            'travel': ['travel', 'trip', 'vacation', 'flight', 'hotel', 'beach', 'destination', 'explore', 'journey'],
            'finance': ['stock', 'investment', 'trading', 'crypto', 'bitcoin', 'ethereum', 'market', 'portfolio', 'finance', 'money'],
            'fitness': ['workout', 'gym', 'exercise', 'fitness', 'health', 'training', 'muscle', 'cardio', 'diet'],
            'crypto': ['bitcoin', 'ethereum', 'blockchain', 'crypto', 'nft', 'defi', 'web3', 'altcoin', 'hodl'],
            'shopping': ['buy', 'purchase', 'deal', 'sale', 'discount', 'shopping', 'store', 'product', 'amazon']
        }
    
    def clean_text(self, text: str) -> str:
        """Clean tweet text: lowercase, remove URLs, remove @handles."""
        if not text:
            return ""
        
        # Lowercase
        text = text.lower()
        
        # Remove URLs
        text = re.sub(r'http\S+|www\.\S+', '', text)
        
        # Remove @handles
        text = re.sub(r'@\w+', '', text)
        
        # Remove extra whitespace
        text = ' '.join(text.split())
        
        return text
    
    def extract_emotion(self, text: str) -> np.ndarray:
        """Extract emotion vector (3-dim: joy, sadness, anger)."""
        text_lower = text.lower()
        emotion_scores = np.zeros(3)
        
        # Count keyword matches
        for idx, (emotion, keywords) in enumerate(self.emotion_keywords.items()):
            count = sum(1 for keyword in keywords if keyword in text_lower)
            emotion_scores[idx] = count
        
        # Normalize to [0, 1]
        if emotion_scores.sum() > 0:
            emotion_scores = emotion_scores / emotion_scores.sum()
        
        return emotion_scores
    
    def classify_category(self, text: str) -> str:
        """Classify tweet into category using rule-based approach."""
        text_lower = text.lower()
        
        category_scores = {}
        for category, keywords in self.category_keywords.items():
            score = sum(1 for keyword in keywords if keyword in text_lower)
            category_scores[category] = score
        
        # Get category with highest score
        if max(category_scores.values()) > 0:
            return max(category_scores, key=category_scores.get)
        else:
            return 'other'
    
    def extract_sentiment(self, text: str) -> float:
        """Extract sentiment score in [-1, 1]."""
        if not text.strip():
            return 0.0
        
        try:
            results = self.sentiment_model(text, truncation=True, max_length=512)
            # Results format: [{'label': 'POSITIVE', 'score': 0.9}, ...]
            # Map to [-1, 1]: NEGATIVE -> -1, NEUTRAL -> 0, POSITIVE -> 1
            score_map = {'NEGATIVE': -1.0, 'NEUTRAL': 0.0, 'POSITIVE': 1.0}
            
            # Weighted average
            weighted_sum = 0.0
            for result in results:
                label = result['label']
                score = result['score']
                weighted_sum += score_map.get(label, 0.0) * score
            
            return weighted_sum
        except Exception as e:
            print(f"Error in sentiment extraction: {e}")
            return 0.0
    
    def extract_features(self, tweet: dict) -> TweetFeatures:
        """Extract all features from a single tweet."""
        text = tweet.get('text', '')
        cleaned_text = self.clean_text(text)
        
        # Get embedding
        embedding = self.embedding_model.encode(cleaned_text, convert_to_numpy=True)
        
        # Get sentiment
        sentiment = self.extract_sentiment(cleaned_text)
        
        # Get emotion
        emotion = self.extract_emotion(cleaned_text)
        
        # Get category
        category = self.classify_category(cleaned_text)
        
        # Get created_at
        created_at = tweet.get('created_at', '')
        
        return TweetFeatures(
            embedding=embedding,
            sentiment=sentiment,
            emotion=emotion,
            category=category,
            created_at=created_at
        )
    
    def extract_all_tweet_features(
        self,
        tweets_by_user: Dict[int, List[dict]]
    ) -> Dict[int, Dict[int, TweetFeatures]]:
        """
        Extract features for all tweets.
        
        Returns:
            tweet_features_by_user[user_id][tweet_id] = TweetFeatures
        """
        tweet_features_by_user = {}
        
        total_tweets = sum(len(tweets) for tweets in tweets_by_user.values())
        print(f"Extracting features for {total_tweets} tweets across {len(tweets_by_user)} users...")
        
        with tqdm(total=total_tweets, desc="Processing tweets") as pbar:
            for user_id, tweets in tweets_by_user.items():
                tweet_features_by_user[user_id] = {}
                
                for tweet in tweets:
                    tweet_id = tweet.get('tweet_id', tweet.get('id', 0))
                    features = self.extract_features(tweet)
                    tweet_features_by_user[user_id][tweet_id] = features
                    pbar.update(1)
        
        return tweet_features_by_user

