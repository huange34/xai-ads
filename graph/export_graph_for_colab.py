"""
Export graph in PyTorch Geometric-ready format for Colab training.
"""
import os
import json
import numpy as np
from typing import Dict, Tuple


def export_graph(
    node_features: np.ndarray,
    edge_index: np.ndarray,
    edge_weights: np.ndarray,
    node_id_map: Dict[int, int],
    output_dir: str = "graph"
):
    """
    Export graph to NumPy files and JSON mapping.
    
    Creates:
        graph/node_features.npy      # shape (N, F)
        graph/edge_index.npy         # shape (2, E)
        graph/edge_weight.npy        # shape (E,)
        graph/node_id_map.json       # idx <-> user_id mapping
    """
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Save node features
    node_features_path = os.path.join(output_dir, "node_features.npy")
    np.save(node_features_path, node_features)
    print(f"Saved node features to {node_features_path} (shape: {node_features.shape})")
    
    # Save edge index
    edge_index_path = os.path.join(output_dir, "edge_index.npy")
    np.save(edge_index_path, edge_index)
    print(f"Saved edge index to {edge_index_path} (shape: {edge_index.shape})")
    
    # Save edge weights
    edge_weight_path = os.path.join(output_dir, "edge_weight.npy")
    np.save(edge_weight_path, edge_weights)
    print(f"Saved edge weights to {edge_weight_path} (shape: {edge_weights.shape})")
    
    # Create reverse mapping (idx -> user_id)
    idx_to_user_id = {idx: user_id for user_id, idx in node_id_map.items()}
    
    # Save node ID mapping
    node_id_map_path = os.path.join(output_dir, "node_id_map.json")
    with open(node_id_map_path, 'w') as f:
        json.dump({
            'user_id_to_idx': node_id_map,
            'idx_to_user_id': idx_to_user_id
        }, f, indent=2)
    print(f"Saved node ID mapping to {node_id_map_path}")
    
    # Print summary
    print("\n" + "="*50)
    print("Graph Export Summary")
    print("="*50)
    print(f"Number of nodes: {node_features.shape[0]}")
    print(f"Node feature dimension: {node_features.shape[1]}")
    print(f"Number of edges: {edge_weights.shape[0]}")
    print(f"Edge index shape: {edge_index.shape}")
    print(f"Edge weights shape: {edge_weights.shape}")
    print("="*50)

