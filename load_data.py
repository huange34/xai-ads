# Auto-generated from scraped data
import json

# Load the final scraped data file
data_file = 'scrape/scraped_data_20251207_021252.json'

# Convert string keys to int keys
with open(data_file, 'r') as file:
    data = json.load(file)

tweets_by_user = {
    int(k): v for k, v in data['tweets_by_user'].items()
}

users = {
    int(k): v for k, v in data['users'].items()
}

follow_edges = [
    (int(edge[0]), int(edge[1])) for edge in data['follow_edges']
]

print(f"Loaded data from {data_file}:")
print(f"  Users: {len(users)}")
print(f"  Total tweets: {sum(len(tweets) for tweets in tweets_by_user.values())}")
print(f"  Follow edges: {len(follow_edges)}")
