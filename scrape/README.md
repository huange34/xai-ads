# X API Scraper

Scraper to collect data from X (Twitter) API for the pipeline.

## Setup

1. Get your X API Bearer Token from [Twitter Developer Portal](https://developer.twitter.com/)

2. Install required packages:
```bash
pip install requests
```

## Usage

### Option 1: Environment Variable

```bash
export X_BEARER_TOKEN=your_bearer_token_here
python scraper.py
```

### Option 2: Command Line Argument

```bash
python scraper.py your_bearer_token_here
```

### Option 3: With User IDs

```bash
python scraper.py your_bearer_token_here user_id1,user_id2,user_id3
```

## Configuration

Edit `scraper.py` to customize:

- `max_tweets_per_user`: Maximum tweets to fetch per user (default: 100)
- `get_follows`: Whether to fetch follow relationships (default: True)
- User IDs list in the `__main__` section

## Output

The scraper creates:

1. **scraped_data.json** - Raw scraped data in JSON format
2. **load_data.py** - Formatted data file ready for the pipeline

## Rate Limits

The scraper includes:
- Automatic rate limit handling
- Delays between requests
- Retry logic for 429 errors

X API v2 rate limits:
- User tweets: 300 requests per 15 minutes
- User info: 300 requests per 15 minutes
- Follow relationships: 15 requests per 15 minutes

## Example

```python
from scraper import XAPIScraper, scrape_user_data, save_data

# Initialize
scraper = XAPIScraper("your_bearer_token")

# Scrape data for users
user_ids = ["1273505391553449985", "1234567890"]
data = scrape_user_data(
    scraper,
    user_ids,
    max_tweets_per_user=100,
    get_follows=True
)

# Save
save_data(data, 'scraped_data.json')
```

## Data Format

The scraper outputs data in the exact format needed by the pipeline:

- `tweets_by_user`: Dict mapping user_id to list of tweets
- `users`: Dict mapping user_id to user info
- `follow_edges`: List of (follower, followed) tuples

## Notes

- The scraper handles API rate limits automatically
- Follow relationships may take longer to fetch (15 requests per 15 min limit)
- Large user lists will take significant time due to rate limits
- Consider using batch processing for many users

