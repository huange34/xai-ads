"""
Main end-to-end pipeline demo.
Runs tweet feature extraction, user feature aggregation, graph construction, and export.
"""
import numpy as np
from features.tweet_features import TweetFeatureExtractor
from features.user_features import UserFeatureAggregator
from graph.build_graph import GraphBuilder
from graph.export_graph_for_colab import export_graph


def main():
    """
    Main pipeline that:
    1. Runs tweet feature extraction
    2. Runs user static feature aggregation
    3. Builds the graph
    4. Exports graph files
    5. Prints shapes of exported arrays
    """
    
    # ============================================================
    # ASSUME INPUT DATA IS ALREADY LOADED
    # ============================================================
    # You should have:
    # - tweets_by_user: dict[int, list[dict]]
    # - users: dict[int, dict]
    # - follow_edges: list[tuple[int, int]]
    # ============================================================
    
    # For demo purposes, create sample data if not provided
    # In real usage, load your actual data here
    print("="*60)
    print("xAI Ads Pipeline - Stages 1-4")
    print("="*60)
    print("\nNOTE: This script assumes you have already loaded:")
    print("  - tweets_by_user: dict[int, list[dict]]")
    print("  - users: dict[int, dict]")
    print("  - follow_edges: list[tuple[int, int]]")
    print("\nIf you don't have this data, uncomment the sample data section below.")
    print("="*60 + "\n")
    
    # Uncomment below to use sample data for testing
    # from create_sample_data import create_sample_data
    # tweets_by_user, users, follow_edges = create_sample_data()
    
    # For now, we'll assume the data is provided
    # Replace this with your actual data loading
    try:
        # Try to import from a data loader module
        from load_data import tweets_by_user, users, follow_edges
        print("Loaded data from load_data.py")
    except ImportError:
        print("ERROR: Please provide your data.")
        print("Create a load_data.py file with:")
        print("  - tweets_by_user: dict[int, list[dict]]")
        print("  - users: dict[int, dict]")
        print("  - follow_edges: list[tuple[int, int]]")
        return
    
    # ============================================================
    # STAGE 1: Per-tweet feature extraction
    # ============================================================
    print("\n" + "="*60)
    print("STAGE 1: Per-tweet feature extraction")
    print("="*60)
    
    tweet_extractor = TweetFeatureExtractor()
    tweet_features_by_user = tweet_extractor.extract_all_tweet_features(tweets_by_user)
    
    print(f"\nExtracted features for tweets from {len(tweet_features_by_user)} users")
    
    # ============================================================
    # STAGE 2: Per-user static feature aggregation
    # ============================================================
    print("\n" + "="*60)
    print("STAGE 2: Per-user static feature aggregation")
    print("="*60)
    
    user_aggregator = UserFeatureAggregator()
    user_static_features, user_base_vectors = user_aggregator.aggregate_all_user_features(
        tweets_by_user,
        tweet_features_by_user,
        users
    )
    
    print(f"\nAggregated features for {len(user_static_features)} users")
    if user_base_vectors:
        sample_user_id = list(user_base_vectors.keys())[0]
        print(f"Sample user base vector shape: {user_base_vectors[sample_user_id].shape}")
    
    # ============================================================
    # STAGE 3: User graph construction
    # ============================================================
    print("\n" + "="*60)
    print("STAGE 3: User graph construction")
    print("="*60)
    
    graph_builder = GraphBuilder(top_k_similar=10)
    node_features, edge_index, edge_weights, node_id_map = graph_builder.build_graph(
        tweets_by_user,
        user_static_features,
        follow_edges,
        user_base_vectors
    )
    
    print(f"\nGraph constructed:")
    print(f"  Nodes: {node_features.shape[0]}")
    print(f"  Node features: {node_features.shape[1]}")
    print(f"  Edges: {edge_weights.shape[0]}")
    
    # ============================================================
    # STAGE 4: Export graph for GNN training
    # ============================================================
    print("\n" + "="*60)
    print("STAGE 4: Export graph for GNN training")
    print("="*60)
    
    export_graph(
        node_features,
        edge_index,
        edge_weights,
        node_id_map,
        output_dir="graph"
    )
    
    # ============================================================
    # Print final shapes
    # ============================================================
    print("\n" + "="*60)
    print("FINAL EXPORTED ARRAY SHAPES")
    print("="*60)
    print(f"node_features.shape: {node_features.shape}")
    print(f"edge_index.shape: {edge_index.shape}")
    print(f"edge_weight.shape: {edge_weights.shape}")
    print(f"Number of nodes: {len(node_id_map)}")
    print(f"Number of edges: {len(edge_weights)}")
    print("="*60)
    
    print("\n✓ Pipeline completed successfully!")
    print("\nGraph files are ready in the 'graph/' directory for Colab GNN training.")


if __name__ == "__main__":
    main()

