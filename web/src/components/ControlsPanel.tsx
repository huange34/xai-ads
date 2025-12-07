"use client";

import { useState } from "react";

export type DimReductionMethod = "pca" | "tsne" | "umap";

// Cluster colors - 20 distinct colors for visualization
export const CLUSTER_COLORS = [
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#45B7D1", // Sky Blue
  "#96CEB4", // Sage Green
  "#FFEAA7", // Yellow
  "#DDA0DD", // Plum
  "#98D8C8", // Mint
  "#F7DC6F", // Gold
  "#BB8FCE", // Purple
  "#85C1E9", // Light Blue
  "#F8B500", // Orange
  "#00CED1", // Dark Cyan
  "#FF69B4", // Hot Pink
  "#32CD32", // Lime Green
  "#FF7F50", // Coral
  "#9370DB", // Medium Purple
  "#20B2AA", // Light Sea Green
  "#FFD700", // Gold
  "#FF4500", // Orange Red
  "#00FA9A", // Medium Spring Green
];

interface ControlsPanelProps {
  method: DimReductionMethod;
  onMethodChange: (method: DimReductionMethod) => void;
  onCluster: (numClusters: number) => Promise<void>;
  onClearClusters: () => void;
  clusterLabels: number[] | null;
  isClustering: boolean;
}

export default function ControlsPanel({
  method,
  onMethodChange,
  onCluster,
  onClearClusters,
  clusterLabels,
  isClustering,
}: ControlsPanelProps) {
  const [numClusters, setNumClusters] = useState(5);

  const handleCluster = async () => {
    await onCluster(numClusters);
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-auto animate-fade-in">
      {/* Algorithm Selector */}
      <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/20 shadow-2xl">
        <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2 font-medium">
          Algorithm
        </label>
        <div className="relative">
          <select
            value={method}
            onChange={(e) => onMethodChange(e.target.value as DimReductionMethod)}
            className="w-full appearance-none bg-gray-900/80 text-white text-sm font-medium px-4 py-2.5 pr-10 rounded-xl border border-white/10 outline-none cursor-pointer hover:border-cyan-500/50 focus:border-cyan-500 transition-colors"
          >
            <option value="pca">PCA</option>
            <option value="tsne">t-SNE</option>
            <option value="umap">UMAP</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        <p className="text-[10px] text-gray-500 mt-2">
          {method === "pca" && "Fast linear projection"}
          {method === "tsne" && "Better clustering, slower"}
          {method === "umap" && "Best of both worlds"}
        </p>
      </div>

      {/* Clustering Panel */}
      <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/20 shadow-2xl">
        <label className="block text-xs text-gray-400 uppercase tracking-wider mb-3 font-medium">
          K-Means Clustering
        </label>
        
        <div className="flex items-center gap-2 mb-3">
          <label className="text-xs text-gray-500">Clusters:</label>
          <input
            type="number"
            min={2}
            max={20}
            value={numClusters}
            onChange={(e) => setNumClusters(Math.max(2, Math.min(20, parseInt(e.target.value) || 5)))}
            className="w-16 bg-gray-900/80 text-white text-sm font-medium px-3 py-1.5 rounded-lg border border-white/10 outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCluster}
            disabled={isClustering}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-gray-600 disabled:to-gray-600 text-white text-sm font-medium rounded-xl transition-all disabled:cursor-not-allowed shadow-lg"
          >
            {isClustering ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Running...
              </span>
            ) : (
              "Run Clustering"
            )}
          </button>
          {clusterLabels && (
            <button
              onClick={onClearClusters}
              className="px-3 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-xl transition-colors"
              title="Clear clusters"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {clusterLabels && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <p className="text-[10px] text-cyan-400 mb-2">
              ✓ {new Set(clusterLabels).size} clusters active
            </p>
            <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
              {Array.from({ length: Math.min(new Set(clusterLabels).size, 10) }).map((_, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div 
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }}
                  />
                  <span className="text-[10px] text-gray-400">Cluster {i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* View info */}
      <div className="bg-black/40 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10 text-center">
        <p className="text-xs text-gray-400 font-mono">3D View</p>
      </div>
    </div>
  );
}
