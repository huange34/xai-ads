"""
X (Twitter) API scraper to collect data for the pipeline.
Gets tweets, user info, and follow relationships.
"""
import os
import json
import time
import requests
from typing import Dict, List, Optional, Set
from collections import defaultdict
import math


class XAPIScraper:
    """Scraper for X (Twitter) API v2."""
    
    def __init__(self, bearer_token: str):
        """
        Initialize scraper with bearer token.
        
        Args:
            bearer_token: Your X API bearer token
        """
        self.bearer_token = bearer_token
        self.base_url = "https://api.twitter.com/2"
        self.headers = {
            "Authorization": f"Bearer {bearer_token}",
            "User-Agent": "xAI-ads-scraper"
        }
        
        # Rate limit tracking
        self.rate_limits = {}
    
    def _make_request(self, endpoint: str, params: dict = None) -> dict:
        """
        Make API request with rate limiting and error handling.
        
        Args:
            endpoint: API endpoint (e.g., "/tweets/search/recent")
            params: Query parameters
            
        Returns:
            API response as dict
        """
        url = f"{self.base_url}{endpoint}"
        
        # Check rate limits
        self._check_rate_limit(endpoint)
        
        try:
            response = requests.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            
            # Update rate limit info
            self._update_rate_limits(response.headers, endpoint)
            
            return response.json()
        except requests.exceptions.HTTPError as e:
            if response.status_code == 429:
                # Rate limited - wait and retry
                retry_after = int(response.headers.get('Retry-After', 900))
                print(f"Rate limited. Waiting {retry_after} seconds...")
                time.sleep(retry_after)
                return self._make_request(endpoint, params)
            else:
                print(f"API Error: {e}")
                print(f"Response: {response.text}")
                raise
        except Exception as e:
            print(f"Request error: {e}")
            raise
    
    def _check_rate_limit(self, endpoint: str):
        """Check if we're approaching rate limits."""
        # Small delay to avoid hitting rate limits
        time.sleep(0.1)
    
    def _update_rate_limits(self, headers: dict, endpoint: str):
        """Update rate limit tracking from response headers."""
        if 'x-rate-limit-remaining' in headers:
            remaining = int(headers['x-rate-limit-remaining'])
            if remaining < 10:
                print(f"Warning: Only {remaining} requests remaining for {endpoint}")
    
    def get_user_by_username(self, username: str) -> Optional[dict]:
        """
        Get user info by username.
        
        Args:
            username: Twitter username (without @)
            
        Returns:
            User info dict or None
        """
        endpoint = f"/users/by/username/{username}"
        params = {
            "user.fields": "created_at,description,public_metrics"
        }
        
        try:
            response = self._make_request(endpoint, params)
            if 'data' in response:
                return response['data']
            return None
        except Exception as e:
            print(f"Error getting user {username}: {e}")
            return None
    
    def get_user_by_id(self, user_id: str) -> Optional[dict]:
        """
        Get user info by user ID.
        
        Args:
            user_id: Twitter user ID
            
        Returns:
            User info dict or None
        """
        endpoint = f"/users/{user_id}"
        params = {
            "user.fields": "created_at,description,public_metrics,profile_image_url"
        }
        
        try:
            response = self._make_request(endpoint, params)
            if 'data' in response:
                return response['data']
            return None
        except Exception as e:
            print(f"Error getting user {user_id}: {e}")
            return None
    
    def get_user_tweets(
        self,
        user_id: str,
        max_results: int = 100,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None
    ) -> List[dict]:
        """
        Get tweets from a specific user.
        
        Args:
            user_id: Twitter user ID
            max_results: Maximum number of tweets to fetch (max 100 per request)
            start_time: Start time in ISO 8601 format (optional)
            end_time: End time in ISO 8601 format (optional)
            
        Returns:
            List of tweet dicts
        """
        endpoint = f"/users/{user_id}/tweets"
        all_tweets = []
        next_token = None
        
        # Calculate number of requests needed
        num_requests = math.ceil(max_results / 100)
        
        print(f"Fetching up to {max_results} tweets for user {user_id}...")
        
        for i in range(num_requests):
            params = {
                "max_results": min(100, max_results - len(all_tweets)),
                "tweet.fields": "created_at,author_id,in_reply_to_user_id,referenced_tweets,public_metrics,conversation_id",
                "expansions": "referenced_tweets.id.author_id"
            }
            
            if start_time:
                params["start_time"] = start_time
            if end_time:
                params["end_time"] = end_time
            if next_token:
                params["pagination_token"] = next_token
            
            try:
                response = self._make_request(endpoint, params)
                
                if 'data' in response:
                    tweets = response['data']
                    all_tweets.extend(tweets)
                    print(f"  Fetched {len(tweets)} tweets (total: {len(all_tweets)})")
                    
                    # Check for next page
                    if 'meta' in response and 'next_token' in response['meta']:
                        next_token = response['meta']['next_token']
                    else:
                        break
                else:
                    break
                    
            except Exception as e:
                print(f"Error fetching tweets for user {user_id}: {e}")
                break
            
            # Small delay between pagination requests
            if i < num_requests - 1:
                time.sleep(0.3)
        
        return all_tweets
    
    def get_following(self, user_id: str, max_results: int = 1000) -> List[str]:
        """
        Get users that a user is following.
        
        Args:
            user_id: Twitter user ID
            max_results: Maximum number of follows to fetch
            
        Returns:
            List of user IDs being followed
        """
        endpoint = f"/users/{user_id}/following"
        all_following = []
        next_token = None
        
        print(f"Fetching following list for user {user_id}...")
        
        while len(all_following) < max_results:
            params = {
                "max_results": min(1000, max_results - len(all_following))
            }
            
            if next_token:
                params["pagination_token"] = next_token
            
            try:
                response = self._make_request(endpoint, params)
                
                if 'data' in response:
                    following = [user['id'] for user in response['data']]
                    all_following.extend(following)
                    print(f"  Fetched {len(following)} follows (total: {len(all_following)})")
                    
                    if 'meta' in response and 'next_token' in response['meta']:
                        next_token = response['meta']['next_token']
                    else:
                        break
                else:
                    break
                    
            except Exception as e:
                print(f"Error fetching following for user {user_id}: {e}")
                break
            
            # Follow relationships have strict rate limits (15/15min), so keep delay
            if len(all_following) < max_results:
                time.sleep(1.0)  # Keep 1s for follow endpoint
        
        return all_following
    
    def search_recent_tweets(
        self,
        query: str,
        max_results: int = 100
    ) -> List[dict]:
        """
        Search for recent tweets.
        
        Args:
            query: Search query (e.g., "AI", "technology", etc.)
            max_results: Maximum number of tweets to fetch
            
        Returns:
            List of tweet dicts with author info
        """
        endpoint = "/tweets/search/recent"
        all_tweets = []
        next_token = None
        
        print(f"Searching for tweets with query: '{query}'...")
        
        while len(all_tweets) < max_results:
            params = {
                "query": query,
                "max_results": min(100, max_results - len(all_tweets)),
                "tweet.fields": "created_at,author_id",
                "expansions": "author_id",
                "user.fields": "id,username"
            }
            
            if next_token:
                params["next_token"] = next_token
            
            try:
                response = self._make_request(endpoint, params)
                
                if 'data' in response:
                    tweets = response['data']
                    all_tweets.extend(tweets)
                    print(f"  Found {len(tweets)} tweets (total: {len(all_tweets)})")
                    
                    if 'meta' in response and 'next_token' in response['meta']:
                        next_token = response['meta']['next_token']
                    else:
                        break
                else:
                    break
                    
            except Exception as e:
                print(f"Error searching tweets: {e}")
                break
            
            # No delay - user requested no delays
            pass
        
        return all_tweets
    
    def get_random_user_ids(
        self,
        num_users: int = 100,
        queries: List[str] = None
    ) -> List[str]:
        """
        Get random user IDs from recent tweets.
        
        Args:
            num_users: Number of unique user IDs to collect
            queries: List of search queries to use (default: trending topics)
            
        Returns:
            List of unique user IDs
        """
        if queries is None:
            # Default queries to get diverse users
            queries = [
                "AI", "technology", "startup", "crypto", "fitness",
                "travel", "food", "music", "sports", "business"
            ]
        
        user_ids = set()
        tweets_per_query = max(10, num_users // len(queries))
        
        print(f"Collecting {num_users} random user IDs from recent tweets...")
        print(f"Using {len(queries)} search queries")
        
        for query in queries:
            if len(user_ids) >= num_users:
                break
            
            print(f"\nSearching: '{query}'...")
            tweets = self.search_recent_tweets(query, max_results=tweets_per_query)
            
            for tweet in tweets:
                author_id = tweet.get('author_id')
                if author_id:
                    user_ids.add(author_id)
                    if len(user_ids) >= num_users:
                        break
            
            print(f"  Collected {len(user_ids)} unique users so far")
            # No delay - user requested no delays
            pass
        
        user_ids_list = list(user_ids)[:num_users]
        print(f"\n✓ Collected {len(user_ids_list)} unique user IDs")
        
        return user_ids_list
    
    def search_recent_tweets(
        self,
        query: str,
        max_results: int = 100
    ) -> List[dict]:
        """
        Search for recent tweets.
        
        Args:
            query: Search query (e.g., "AI", "technology", etc.)
            max_results: Maximum number of tweets to fetch
            
        Returns:
            List of tweet dicts with author info
        """
        endpoint = "/tweets/search/recent"
        all_tweets = []
        next_token = None
        
        print(f"Searching for tweets with query: '{query}'...")
        
        while len(all_tweets) < max_results:
            params = {
                "query": query,
                "max_results": min(100, max_results - len(all_tweets)),
                "tweet.fields": "created_at,author_id",
                "expansions": "author_id",
                "user.fields": "id,username"
            }
            
            if next_token:
                params["next_token"] = next_token
            
            try:
                response = self._make_request(endpoint, params)
                
                if 'data' in response:
                    tweets = response['data']
                    all_tweets.extend(tweets)
                    print(f"  Found {len(tweets)} tweets (total: {len(all_tweets)})")
                    
                    if 'meta' in response and 'next_token' in response['meta']:
                        next_token = response['meta']['next_token']
                    else:
                        break
                else:
                    break
                    
            except Exception as e:
                print(f"Error searching tweets: {e}")
                break
            
            # No delay - user requested no delays
            pass
        
        return all_tweets
    
    def get_random_user_ids(
        self,
        num_users: int = 100,
        queries: List[str] = None
    ) -> List[str]:
        """
        Get random user IDs from recent tweets.
        
        Args:
            num_users: Number of unique user IDs to collect
            queries: List of search queries to use (default: trending topics)
            
        Returns:
            List of unique user IDs
        """
        if queries is None:
            # Default queries to get diverse users
            queries = [
                "AI", "technology", "startup", "crypto", "fitness",
                "travel", "food", "music", "sports", "business"
            ]
        
        user_ids = set()
        tweets_per_query = max(10, num_users // len(queries))
        
        print(f"Collecting {num_users} random user IDs from recent tweets...")
        print(f"Using {len(queries)} search queries")
        
        for query in queries:
            if len(user_ids) >= num_users:
                break
            
            print(f"\nSearching: '{query}'...")
            tweets = self.search_recent_tweets(query, max_results=tweets_per_query)
            
            for tweet in tweets:
                author_id = tweet.get('author_id')
                if author_id:
                    user_ids.add(author_id)
                    if len(user_ids) >= num_users:
                        break
            
            print(f"  Collected {len(user_ids)} unique users so far")
            # No delay - user requested no delays
            pass
        
        user_ids_list = list(user_ids)[:num_users]
        print(f"\n✓ Collected {len(user_ids_list)} unique user IDs")
        
        return user_ids_list
    
    def get_followers(self, user_id: str, max_results: int = 1000) -> List[str]:
        """
        Get users that follow a user.
        
        Args:
            user_id: Twitter user ID
            max_results: Maximum number of followers to fetch
            
        Returns:
            List of user IDs that are followers
        """
        endpoint = f"/users/{user_id}/followers"
        all_followers = []
        next_token = None
        
        print(f"Fetching followers list for user {user_id}...")
        
        while len(all_followers) < max_results:
            params = {
                "max_results": min(1000, max_results - len(all_followers))
            }
            
            if next_token:
                params["pagination_token"] = next_token
            
            try:
                response = self._make_request(endpoint, params)
                
                if 'data' in response:
                    followers = [user['id'] for user in response['data']]
                    all_followers.extend(followers)
                    print(f"  Fetched {len(followers)} followers (total: {len(all_followers)})")
                    
                    if 'meta' in response and 'next_token' in response['meta']:
                        next_token = response['meta']['next_token']
                    else:
                        break
                else:
                    break
                    
            except Exception as e:
                print(f"Error fetching followers for user {user_id}: {e}")
                break
            
            # No delay - user requested no delays
            pass
        
        return all_followers
    
    def format_tweet(self, tweet: dict, user_id: str) -> dict:
        """
        Format tweet from API response to pipeline format.
        
        Args:
            tweet: Raw tweet from API
            user_id: User ID who posted the tweet
            
        Returns:
            Formatted tweet dict
        """
        # Parse referenced tweets
        referenced_tweets = []
        if 'referenced_tweets' in tweet:
            for ref in tweet['referenced_tweets']:
                ref_dict = {
                    'type': ref.get('type', '').lower(),  # 'quoted', 'retweeted', 'replied_to'
                    'tweet_id': ref.get('id', ''),
                    'user_id': None  # Will need to get from expansions if available
                }
                referenced_tweets.append(ref_dict)
        
        formatted = {
            'tweet_id': int(tweet['id']),
            'user_id': int(user_id),
            'text': tweet.get('text', ''),
            'created_at': tweet.get('created_at', ''),
            'in_reply_to_user_id': int(tweet['in_reply_to_user_id']) if tweet.get('in_reply_to_user_id') else None,
            'in_reply_to_tweet_id': int(tweet['conversation_id']) if tweet.get('conversation_id') and tweet.get('in_reply_to_user_id') and tweet['conversation_id'] != tweet['id'] else None,
            'referenced_tweets': referenced_tweets,
            'metrics': {
                'replies': tweet.get('public_metrics', {}).get('reply_count', 0),
                'retweets': tweet.get('public_metrics', {}).get('retweet_count', 0),
                'likes': tweet.get('public_metrics', {}).get('like_count', 0),
                'quotes': tweet.get('public_metrics', {}).get('quote_count', 0)
            }
        }
        
        return formatted
    
    def format_user(self, user: dict) -> dict:
        """
        Format user from API response to pipeline format.
        
        Args:
            user: Raw user from API
            
        Returns:
            Formatted user dict
        """
        metrics = user.get('public_metrics', {})
        
        formatted = {
            'username': user.get('username', ''),
            'followers_count': metrics.get('followers_count', 0),
            'following_count': metrics.get('following_count', 0),
            'created_at': user.get('created_at', ''),
            'profile_description': user.get('description', '')
        }
        
        return formatted


def scrape_user_data(
    scraper: XAPIScraper,
    user_ids: List[str],
    max_tweets_per_user: int = 100,
    max_follows_per_user: int = 20,
    get_follows: bool = True,
    save_incrementally: bool = True,
    incremental_save_file: str = None
) -> Dict:
    """
    Scrape data for multiple users.
    
    Args:
        scraper: XAPIScraper instance
        user_ids: List of user IDs to scrape
        max_tweets_per_user: Maximum tweets to fetch per user
        max_follows_per_user: Maximum follow edges to fetch per user
        get_follows: Whether to fetch follow relationships
        save_incrementally: Whether to save data after each user
        incremental_save_file: File path for incremental saves (auto-generated if None)
        
    Returns:
        Dict with 'tweets_by_user', 'users', 'follow_edges'
    """
    tweets_by_user = {}
    users = {}
    follow_edges = []
    
    # Set up incremental save file
    if save_incrementally and incremental_save_file is None:
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        incremental_save_file = f'scraped_data_incremental_{timestamp}.json'
    
    print(f"Scraping data for {len(user_ids)} users...")
    if save_incrementally:
        print(f"Incremental saves will be written to: {incremental_save_file}")
    print("="*60)
    
    for i, user_id in enumerate(user_ids, 1):
        print(f"\n{'='*60}")
        print(f"[{i}/{len(user_ids)}] Processing user {user_id}")
        print(f"{'='*60}")
        
        # Get user info
        print(f"  → Fetching user info...")
        user_info = scraper.get_user_by_id(user_id)
        if user_info:
            formatted_user = scraper.format_user(user_info)
            users[int(user_id)] = formatted_user
            username = user_info.get('username', 'unknown')
            followers = formatted_user.get('followers_count', 0)
            following = formatted_user.get('following_count', 0)
            print(f"  ✓ User info retrieved:")
            print(f"     Username: @{username}")
            print(f"     Followers: {followers:,}")
            print(f"     Following: {following:,}")
            print(f"     Description: {formatted_user.get('profile_description', 'N/A')[:50]}...")
        else:
            print(f"  ✗ Could not get user info")
            users[int(user_id)] = {}
        
        # Get tweets
        print(f"  → Fetching tweets (max {max_tweets_per_user} per user)...")
        tweets = scraper.get_user_tweets(user_id, max_results=max_tweets_per_user)
        if tweets:
            formatted_tweets = [scraper.format_tweet(tweet, user_id) for tweet in tweets]
            tweets_by_user[int(user_id)] = formatted_tweets
            print(f"  ✓ Tweets retrieved: {len(formatted_tweets)} tweets")
            # Show sample tweet info
            if formatted_tweets:
                sample = formatted_tweets[0]
                print(f"     Sample tweet:")
                print(f"       ID: {sample.get('tweet_id')}")
                print(f"       Text: {sample.get('text', '')[:60]}...")
                print(f"       Created: {sample.get('created_at', 'N/A')}")
                print(f"       Is reply: {sample.get('in_reply_to_user_id') is not None}")
                print(f"       Referenced tweets: {len(sample.get('referenced_tweets', []))}")
        else:
            print(f"  ✗ No tweets found")
            tweets_by_user[int(user_id)] = []
        
        # Get follow relationships
        if get_follows:
            print(f"  → Fetching follow relationships (max {max_follows_per_user} per user)...")
            following = scraper.get_following(user_id, max_results=max_follows_per_user)
            for followed_id in following:
                follow_edges.append((int(user_id), int(followed_id)))
            print(f"  ✓ Follow relationships retrieved: {len(following)} users")
            if following:
                print(f"     Sample follows: {following[:3]}")
        else:
            print(f"  → Skipping follow relationships (get_follows=False)")
        
        # Save incrementally after each user
        if save_incrementally:
            try:
                current_data = {
                    'tweets_by_user': tweets_by_user,
                    'users': users,
                    'follow_edges': follow_edges
                }
                save_data(current_data, incremental_save_file, silent=True)
                total_tweets = sum(len(tweets) for tweets in tweets_by_user.values())
                print(f"  💾 Saved: {len(users)} users, {total_tweets} tweets, {len(follow_edges)} follows")
            except Exception as e:
                print(f"  ⚠️  Warning: Could not save incrementally: {e}")
        
        # Moderate delay between users to avoid rate limits
        if i < len(user_ids) - 1:
            print(f"  → Waiting 0.5 seconds before next user...")
            time.sleep(0.5)
    
    print("\n" + "="*60)
    print("SCRAPING COMPLETE!")
    print("="*60)
    print(f"  ✓ Users processed: {len(users)}")
    total_tweets = sum(len(tweets) for tweets in tweets_by_user.values())
    print(f"  ✓ Total tweets collected: {total_tweets:,}")
    print(f"  ✓ Follow edges collected: {len(follow_edges):,}")
    print(f"  ✓ Average tweets per user: {total_tweets/len(users):.1f}" if users else "")
    print(f"  ✓ Average follow edges per user: {len(follow_edges)/len(users):.1f}" if users else "")
    if save_incrementally:
        print(f"  ✓ Final data saved to: {incremental_save_file}")
    print("="*60)
    
    return {
        'tweets_by_user': tweets_by_user,
        'users': users,
        'follow_edges': follow_edges
    }


def save_data(data: Dict, output_file: str = 'scraped_data.json', silent: bool = False):
    """
    Save scraped data to JSON file.
    
    Args:
        data: Data dict from scrape_user_data
        output_file: Output file path
        silent: If True, don't print save confirmation
    """
    # Convert to JSON-serializable format
    json_data = {
        'tweets_by_user': {
            str(k): v for k, v in data['tweets_by_user'].items()
        },
        'users': {
            str(k): v for k, v in data['users'].items()
        },
        'follow_edges': [
            [str(edge[0]), str(edge[1])] for edge in data['follow_edges']
        ]
    }
    
    with open(output_file, 'w') as f:
        json.dump(json_data, f, indent=2)
    
    if not silent:
        print(f"\n✓ Saved data to {output_file}")


if __name__ == "__main__":
    import sys
    
    # Get bearer token from environment or argument
    bearer_token = "AAAAAAAAAAAAAAAAAAAAAJJ25wEAAAAAtq8cZdqFj%2Fm21sv99s5Jg2GaeUo%3DBAD4Dy8b4z52mavy4UzVxjcnveVcEo34rpxwEQTKPuXLvnB7Ve"
    
    if len(sys.argv) > 1:
        bearer_token = sys.argv[1]
    
    if not bearer_token:
        print("Error: Bearer token required!")
        print("Usage: python scraper.py <bearer_token>")
        print("   or: export X_BEARER_TOKEN=your_token")
        sys.exit(1)
    
    # Initialize scraper
    scraper = XAPIScraper(bearer_token)
    
    # Get user IDs - either random or specified
    user_ids = []
    user_ids_file = 'saved_user_ids.json'
    
    if len(sys.argv) > 2:
        # User IDs from command line
        user_ids = sys.argv[2].split(',')
    elif os.path.exists(user_ids_file):
        # Load saved user IDs if they exist
        print(f"Loading saved user IDs from {user_ids_file}...")
        with open(user_ids_file, 'r') as f:
            saved_data = json.load(f)
            user_ids = saved_data.get('user_ids', [])
        print(f"✓ Loaded {len(user_ids)} saved user IDs")
    else:
        # Get random users (300 users)
        print("No user IDs provided. Getting random users...")
        num_random_users = 300  # 300 users
        user_ids = scraper.get_random_user_ids(num_users=num_random_users)
        
        print(f"\n✓ Got {len(user_ids)} random user IDs")
        
        # Save the user IDs for future use
        print(f"Saving user IDs to {user_ids_file}...")
        with open(user_ids_file, 'w') as f:
            json.dump({'user_ids': user_ids, 'count': len(user_ids)}, f, indent=2)
        print(f"✓ Saved {len(user_ids)} user IDs")
    
    print("X API Scraper")
    print("="*60)
    print(f"Bearer token: {bearer_token[:20]}...")
    print(f"Users to scrape: {len(user_ids)}")
    print("="*60)
    
    # Scrape data with incremental saving enabled
    data = scrape_user_data(
        scraper,
        user_ids,
        max_tweets_per_user=30,  # 30 tweets per user
        max_follows_per_user=30,  # 30 follow edges per user
        get_follows=True,  # Collect follow edges
        save_incrementally=True  # Save after each user
    )
    
    # Save to new file (with timestamp to avoid overwriting)
    from datetime import datetime
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f'scraped_data_{timestamp}.json'
    load_data_file = f'load_data_{timestamp}.py'
    
    save_data(data, output_file)
    
    # Also create load_data.py
    print(f"\nCreating {load_data_file}...")
    with open(load_data_file, 'w') as f:
        f.write("# Auto-generated from scraped data\n")
        f.write("import json\n\n")
        f.write("# Convert string keys to int keys\n")
        f.write(f"with open('{output_file}', 'r') as file:\n")
        f.write("    data = json.load(file)\n\n")
        f.write("tweets_by_user = {\n")
        f.write("    int(k): v for k, v in data['tweets_by_user'].items()\n")
        f.write("}\n\n")
        f.write("users = {\n")
        f.write("    int(k): v for k, v in data['users'].items()\n")
        f.write("}\n\n")
        f.write("follow_edges = [\n")
        f.write("    (int(edge[0]), int(edge[1])) for edge in data['follow_edges']\n")
        f.write("]\n")
    
    print(f"✓ Created {load_data_file}")
    print(f"\nData saved to: {output_file}")
    print(f"Load script: {load_data_file}")
    print("\nYou can now run: python ../run.py")

