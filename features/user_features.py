"""
Per-user static feature aggregation.
"""
import numpy as np
from typing import Dict, List, Tuple
from datetime import datetime
from collections import defaultdict
from tqdm import tqdm

from data_models import TweetFeatures, UserStaticFeatures


class UserFeatureAggregator:
    """Aggregates tweet features into per-user static features."""
    
    def __init__(self):
        self.categories = ['tech', 'travel', 'finance', 'fitness', 'crypto', 'shopping', 'other']
    
    def parse_date(self, date_str: str) -> datetime:
        """Parse date string to datetime object."""
        if not date_str:
            return None
        
        # Try common formats
        formats = [
            '%Y-%m-%dT%H:%M:%S.%fZ',
            '%Y-%m-%dT%H:%M:%SZ',
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%d'
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except:
                continue
        
        return None
    
    def calculate_tweets_per_day(
        self,
        tweets: List[TweetFeatures],
        user_created_at: str = None
    ) -> float:
        """Calculate average tweets per day."""
        if not tweets:
            return 0.0
        
        # Get tweet dates
        tweet_dates = []
        for tweet in tweets:
            date = self.parse_date(tweet.created_at)
            if date:
                tweet_dates.append(date)
        
        if not tweet_dates:
            return 0.0
        
        # Calculate time span
        min_date = min(tweet_dates)
        max_date = max(tweet_dates)
        
        # If user_created_at is provided, use it as start
        if user_created_at:
            user_date = self.parse_date(user_created_at)
            if user_date and user_date < min_date:
                min_date = user_date
        
        # Calculate days
        if min_date == max_date:
            days = 1.0
        else:
            delta = max_date - min_date
            days = max(delta.days, 1.0)
        
        return len(tweet_dates) / days
    
    def calculate_ratios(
        self,
        tweets: List[dict],
        tweet_features: Dict[int, TweetFeatures]
    ) -> Tuple[float, float, float]:
        """
        Calculate reply_ratio, retweet_ratio, original_ratio.
        
        Returns:
            (reply_ratio, retweet_ratio, original_ratio)
        """
        if not tweets:
            return 0.0, 0.0, 0.0
        
        reply_count = 0
        retweet_count = 0
        original_count = 0
        
        for tweet in tweets:
            tweet_id = tweet.get('tweet_id', tweet.get('id', 0))
            
            # Check if it's a reply
            if tweet.get('in_reply_to_user_id') or tweet.get('in_reply_to_tweet_id'):
                reply_count += 1
            
            # Check if it's a retweet
            referenced = tweet.get('referenced_tweets', [])
            is_retweet = any(
                ref.get('type') == 'retweeted' 
                for ref in referenced if isinstance(ref, dict)
            )
            if is_retweet:
                retweet_count += 1
            
            # Original if not reply and not retweet
            if not (tweet.get('in_reply_to_user_id') or tweet.get('in_reply_to_tweet_id')) and not is_retweet:
                original_count += 1
        
        total = len(tweets)
        if total == 0:
            return 0.0, 0.0, 0.0
        
        return reply_count / total, retweet_count / total, original_count / total
    
    def aggregate_user_features(
        self,
        user_id: int,
        tweets: List[dict],
        tweet_features: Dict[int, TweetFeatures],
        user_info: dict = None
    ) -> UserStaticFeatures:
        """Aggregate all static features for a user."""
        if not tweets or not tweet_features:
            # Return zero features
            embedding_dim = 384  # all-MiniLM-L6-v2 dimension
            return UserStaticFeatures(
                interest_emb=np.zeros(embedding_dim),
                avg_sentiment=0.0,
                sentiment_volatility=0.0,
                emotion_profile=np.zeros(3),
                tweets_per_day=0.0,
                reply_ratio=0.0,
                retweet_ratio=0.0,
                original_ratio=0.0,
                avg_tweet_length=0.0,
                category_sentiments={cat: 0.0 for cat in self.categories},
                category_volumes={cat: 0 for cat in self.categories}
            )
        
        # Get tweet features
        tweet_feat_list = []
        sentiments = []
        emotions = []
        tweet_lengths = []
        category_sentiments = defaultdict(list)
        category_volumes = defaultdict(int)
        
        for tweet in tweets:
            tweet_id = tweet.get('tweet_id', tweet.get('id', 0))
            if tweet_id in tweet_features:
                feat = tweet_features[tweet_id]
                tweet_feat_list.append(feat)
                sentiments.append(feat.sentiment)
                emotions.append(feat.emotion)
                tweet_lengths.append(len(tweet.get('text', '')))
                category_sentiments[feat.category].append(feat.sentiment)
                category_volumes[feat.category] += 1
        
        if not tweet_feat_list:
            embedding_dim = 384
            return UserStaticFeatures(
                interest_emb=np.zeros(embedding_dim),
                avg_sentiment=0.0,
                sentiment_volatility=0.0,
                emotion_profile=np.zeros(3),
                tweets_per_day=0.0,
                reply_ratio=0.0,
                retweet_ratio=0.0,
                original_ratio=0.0,
                avg_tweet_length=0.0,
                category_sentiments={cat: 0.0 for cat in self.categories},
                category_volumes={cat: 0 for cat in self.categories}
            )
        
        # Interest embedding = mean of tweet embeddings
        embeddings = np.array([feat.embedding for feat in tweet_feat_list])
        interest_emb = np.mean(embeddings, axis=0)
        
        # Average sentiment
        avg_sentiment = np.mean(sentiments)
        
        # Sentiment volatility (std)
        sentiment_volatility = np.std(sentiments) if len(sentiments) > 1 else 0.0
        
        # Emotion profile = mean of emotion vectors
        emotion_profile = np.mean(emotions, axis=0)
        
        # Tweets per day
        user_created_at = user_info.get('created_at') if user_info else None
        tweets_per_day = self.calculate_tweets_per_day(tweet_feat_list, user_created_at)
        
        # Ratios
        reply_ratio, retweet_ratio, original_ratio = self.calculate_ratios(tweets, tweet_features)
        
        # Average tweet length
        avg_tweet_length = np.mean(tweet_lengths) if tweet_lengths else 0.0
        
        # Per-category sentiments and volumes
        category_sentiment_dict = {}
        for cat in self.categories:
            if cat in category_sentiments and len(category_sentiments[cat]) > 0:
                category_sentiment_dict[cat] = np.mean(category_sentiments[cat])
            else:
                category_sentiment_dict[cat] = 0.0
        
        category_volume_dict = {cat: category_volumes.get(cat, 0) for cat in self.categories}
        
        return UserStaticFeatures(
            interest_emb=interest_emb,
            avg_sentiment=avg_sentiment,
            sentiment_volatility=sentiment_volatility,
            emotion_profile=emotion_profile,
            tweets_per_day=tweets_per_day,
            reply_ratio=reply_ratio,
            retweet_ratio=retweet_ratio,
            original_ratio=original_ratio,
            avg_tweet_length=avg_tweet_length,
            category_sentiments=category_sentiment_dict,
            category_volumes=category_volume_dict
        )
    
    def create_user_base_vector(self, user_features: UserStaticFeatures) -> np.ndarray:
        """
        Concatenate all user features into a single vector.
        
        Returns:
            u_base[user_id] = np.ndarray
        """
        parts = []
        
        # Interest embedding
        parts.append(user_features.interest_emb)
        
        # Scalar features
        parts.append(np.array([
            user_features.avg_sentiment,
            user_features.sentiment_volatility,
            user_features.tweets_per_day,
            user_features.reply_ratio,
            user_features.retweet_ratio,
            user_features.original_ratio,
            user_features.avg_tweet_length
        ]))
        
        # Emotion profile
        parts.append(user_features.emotion_profile)
        
        # Per-category sentiments (ordered)
        category_sentiment_vec = np.array([
            user_features.category_sentiments.get(cat, 0.0)
            for cat in self.categories
        ])
        parts.append(category_sentiment_vec)
        
        # Per-category volumes (ordered)
        category_volume_vec = np.array([
            user_features.category_volumes.get(cat, 0)
            for cat in self.categories
        ])
        parts.append(category_volume_vec)
        
        return np.concatenate(parts)
    
    def aggregate_all_user_features(
        self,
        tweets_by_user: Dict[int, List[dict]],
        tweet_features_by_user: Dict[int, Dict[int, TweetFeatures]],
        users: Dict[int, dict]
    ) -> tuple[Dict[int, UserStaticFeatures], Dict[int, np.ndarray]]:
        """
        Aggregate features for all users.
        
        Returns:
            (user_static_features, user_base_vectors)
        """
        user_static_features = {}
        user_base_vectors = {}
        
        print(f"Aggregating features for {len(tweets_by_user)} users...")
        
        for user_id in tqdm(tweets_by_user.keys(), desc="Processing users"):
            tweets = tweets_by_user[user_id]
            tweet_features = tweet_features_by_user.get(user_id, {})
            user_info = users.get(user_id, {})
            
            # Aggregate features
            user_features = self.aggregate_user_features(
                user_id, tweets, tweet_features, user_info
            )
            user_static_features[user_id] = user_features
            
            # Create base vector
            base_vector = self.create_user_base_vector(user_features)
            user_base_vectors[user_id] = base_vector
        
        return user_static_features, user_base_vectors

