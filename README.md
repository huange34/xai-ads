# xAI Ads - User Graph Construction Pipeline

ML pipeline for constructing user graphs from X (Twitter) data with semantic embeddings and weighted edges.

## Overview

This project implements a 4-stage ML pipeline:
1. **Per-tweet feature extraction** - Extracts embeddings, sentiment, emotion, and categories from tweets
2. **Per-user static feature aggregation** - Aggregates tweet features into user-level feature vectors
3. **User graph construction** - Builds graph with follow, interaction, and similarity edges
4. **Graph export** - Exports graph in PyTorch Geometric format for GNN training

## Features

- **Semantic Embeddings**: Uses SentenceTransformer (`all-MiniLM-L6-v2`) to generate 384-dim embeddings
- **Graph Construction**: Combines three edge types:
  - **Follow edges** (20%): Direct follow relationships
  - **Interaction edges** (30%): Replies, quotes, retweets
  - **Similarity edges** (50%): Cosine similarity of interest embeddings
- **X API Scraper**: Collects user data, tweets, and follow relationships
- **Incremental Saving**: Saves progress continuously during scraping

## Project Structure

```
xAI-ads/
├── run.py                    # Main pipeline runner
├── data_models.py            # Data structures
├── load_data.py              # Data loader
├── requirements.txt          # Dependencies
├── features/
│   ├── tweet_features.py     # Tweet feature extraction
│   └── user_features.py      # User feature aggregation
├── graph/
│   ├── build_graph.py        # Graph construction
│   ├── export_graph_for_colab.py  # Graph export
│   ├── node_features.npy     # Node features (generated)
│   ├── edge_index.npy        # Edge structure (generated)
│   ├── edge_weight.npy       # Edge weights (generated)
│   └── node_id_map.json      # User ID mapping (generated)
└── scrape/
    ├── scraper.py            # X API scraper
    └── scraped_data_*.json    # Scraped data
```

## Installation

```bash
pip install -r requirements.txt
```

## Usage

### 1. Scrape Data

```bash
cd scrape
python scraper.py YOUR_BEARER_TOKEN
```

### 2. Run Pipeline

```bash
python run.py
```

The pipeline will:
- Extract features from tweets
- Aggregate user features
- Build the graph
- Export to `graph/` directory

## Graph Weighting

Edge weights are combined as:
```
final_weight = 0.2 × follow_w + 0.3 × interaction_w + 0.5 × similarity_w
```

- **Follow**: Binary (1.0 if follows)
- **Interaction**: Weighted counts (Reply: 1.0, Quote: 1.5, Retweet: 1.0)
- **Similarity**: Cosine similarity of 384-dim interest embeddings (top-10 neighbors)

## Output Files

- `graph/node_features.npy`: (N, 408) - Node features (384-dim embeddings + 24 aggregated features)
- `graph/edge_index.npy`: (2, E) - Edge structure
- `graph/edge_weight.npy`: (E,) - Edge weights
- `graph/node_id_map.json`: User ID to node index mapping

