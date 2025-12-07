"use client";

import { useState, lazy, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import BottomTab, { SearchState } from "@/components/BottomTab";
import ControlsPanel, { DimReductionMethod } from "@/components/ControlsPanel";
import BuyingBehaviorPopup from "@/components/BuyingBehaviorPopup";

// Lazy load the visualizer to avoid SSR issues with Three.js
const EmbeddingVisualizer = lazy(() => import("@/components/EmbeddingVisualizer"));

interface SimilarUser {
  node_index: number;
  user_id: string;
  username: string;
  similarity_score: number;
}

interface SearchResult {
  found: boolean;
  node_index?: number;
  user_id?: string;
  username?: string;
  similar_users?: SimilarUser[];
}

interface EmbeddingResponse {
  user_info: {
    user_id: string;
    username: string;
    name: string | null;
  };
  embedding: number[];
}

export default function GraphPage() {
  const searchParams = useSearchParams();
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [highlightedNodeIndex, setHighlightedNodeIndex] = useState<number | null>(null);
  const [similarNodeIndices, setSimilarNodeIndices] = useState<number[]>([]);
  const [newEmbedding, setNewEmbedding] = useState<number[] | undefined>(undefined);
  const [newUserInfo, setNewUserInfo] = useState<{ username: string; user_id: string; profile_image_url?: string } | undefined>(undefined);
  const [points, setPoints] = useState<any[]>([]);
  const [hasAutoSearched, setHasAutoSearched] = useState(false);
  const [method, setMethod] = useState<DimReductionMethod>("pca");
  const [grokState, setGrokState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [grokError, setGrokError] = useState<string | null>(null);
  const [grokTargetIndices, setGrokTargetIndices] = useState<number[]>([]);
  const [showBehaviorPopup, setShowBehaviorPopup] = useState(false);
  const [clusterLabels, setClusterLabels] = useState<number[] | null>(null);
  const [isClustering, setIsClustering] = useState(false);

  const handleCluster = async (numClusters: number) => {
    setIsClustering(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/cluster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n_clusters: numClusters }),
      });

      if (!response.ok) {
        throw new Error("Failed to run clustering");
      }

      const data = await response.json();
      setClusterLabels(data.labels);
    } catch (err) {
      console.error("Clustering error:", err);
    } finally {
      setIsClustering(false);
    }
  };

  const handleClearClusters = () => {
    setClusterLabels(null);
  };

  const handleSearch = async (handle: string): Promise<SearchResult> => {
    setSearchState("loading");
    setError(null);
    setHighlightedNodeIndex(null);
    setSimilarNodeIndices([]);
    setNewEmbedding(undefined);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      
      // Step 1: First try to find user in existing graph
      const searchResponse = await fetch(`${apiUrl}/graph/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      });

      if (searchResponse.ok) {
        const searchData: SearchResult = await searchResponse.json();
        
        if (searchData.found && searchData.node_index !== undefined) {
          // User found in graph
          setSearchState("success");
          setSearchResult(searchData);
          setHighlightedNodeIndex(searchData.node_index);
          // Don't set similar nodes here - will be calculated based on distance
          // Show buying behavior popup
          setShowBehaviorPopup(true);
          return searchData;
        }
      }

      // Step 2: User not in graph, generate embedding and add to visualization
      const embeddingResponse = await fetch(`${apiUrl}/embedding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: handle,
          max_tweets: 100,
        }),
      });

      if (!embeddingResponse.ok) {
        const err = await embeddingResponse.json();
        throw new Error(err.detail || "Failed to generate embedding");
      }

      const embeddingData: EmbeddingResponse = await embeddingResponse.json();
      
      // Fetch profile image URL for the new user
      let profileImageUrl: string | undefined;
      try {
        const avatarResponse = await fetch(`${apiUrl}/users/${embeddingData.user_info.user_id}/avatar`);
        if (avatarResponse.ok) {
          const avatarData = await avatarResponse.json();
          profileImageUrl = avatarData.profile_image_url;
        }
      } catch (err) {
        console.error("Failed to fetch avatar:", err);
      }
      
      // Add the new embedding to the visualization
      setNewEmbedding(embeddingData.embedding);
      setNewUserInfo({
        username: embeddingData.user_info.username,
        user_id: embeddingData.user_info.user_id,
        profile_image_url: profileImageUrl,
      });
      
      // Keep loading state - will change to success when node appears
      // Don't set searchState to success yet - wait for node to appear
      setSearchResult({
        found: true,
        username: embeddingData.user_info.username,
        user_id: embeddingData.user_info.user_id,
      });

      return { found: true, username: embeddingData.user_info.username };
    } catch (err) {
      setSearchState("error");
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      setSearchResult(null);
      return { found: false };
    }
  };

  // Auto-search if username is in URL params
  useEffect(() => {
    const username = searchParams.get("username");
    if (username && !hasAutoSearched) {
      setHasAutoSearched(true);
      // Small delay to ensure graph is loaded
      const timer = setTimeout(() => {
        handleSearch(username).catch(console.error);
      }, 1000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, hasAutoSearched]);

  const handleReset = () => {
    setSearchState("idle");
    setSearchResult(null);
    setError(null);
    setHighlightedNodeIndex(null);
    setSimilarNodeIndices([]);
    setNewEmbedding(undefined);
    setNewUserInfo(undefined);
    setGrokState("idle");
    setGrokError(null);
    setGrokTargetIndices([]);
    setShowBehaviorPopup(false);
  };

  const handleGrokTarget = async (adIdea: string): Promise<number[]> => {
    setGrokState("loading");
    setGrokError(null);
    setHighlightedNodeIndex(null);
    setSimilarNodeIndices([]);
    setGrokTargetIndices([]);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/grok/target`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad_idea: adIdea }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Failed to analyze ad idea");
      }

      const data = await response.json();
      const targetIndices = data.target_node_indices || [];
      
      setGrokTargetIndices(targetIndices);
      setSimilarNodeIndices(targetIndices); // Use similarNodeIndices to highlight the cluster
      setGrokState("success");
      
      return targetIndices;
    } catch (err) {
      setGrokState("error");
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setGrokError(errorMessage);
      return [];
    }
  };

  const handlePointsUpdate = (updatedPoints: any[]) => {
    setPoints(updatedPoints);
    // If we just added a new embedding, check if the node has appeared
    if (newEmbedding && newUserInfo) {
      const newPointIndex = updatedPoints.findIndex((p) => p.is_new && p.username === newUserInfo.username);
      if (newPointIndex !== -1) {
        // Node has appeared, change state to success and highlight it
        setSearchState("success");
        setHighlightedNodeIndex(newPointIndex);
        // Clear the new embedding flags since we've found the node
        setNewEmbedding(undefined);
        setNewUserInfo(undefined);
      }
    }
  };

  // Calculate similar nodes based on 3D distance when highlighted node or points change
  useEffect(() => {
    if (highlightedNodeIndex === null || highlightedNodeIndex === undefined || points.length === 0) {
      setSimilarNodeIndices([]);
      return;
    }

    const highlightedPoint = points[highlightedNodeIndex];
    if (!highlightedPoint) {
      setSimilarNodeIndices([]);
      return;
    }

    // Calculate 3D distance from highlighted point to all other points
    const distances: Array<{ index: number; distance: number }> = [];
    
    const hx = highlightedPoint.x;
    const hy = highlightedPoint.y;
    const hz = highlightedPoint.z !== null ? highlightedPoint.z : 0;

    points.forEach((point, index) => {
      if (index === highlightedNodeIndex) return; // Skip self
      
      const px = point.x;
      const py = point.y;
      const pz = point.z !== null ? point.z : 0;
      
      // Calculate Euclidean distance in 3D space
      const dx = px - hx;
      const dy = py - hy;
      const dz = pz - hz;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      distances.push({ index, distance });
    });

    // Sort by distance and take nodes within a threshold (e.g., 2 units)
    const distanceThreshold = 0.5; // Adjust this value to control cluster size
    const nearbyNodes = distances
      .filter(d => d.distance <= distanceThreshold)
      .sort((a, b) => a.distance - b.distance)
      .map(d => d.index);

    setSimilarNodeIndices(nearbyNodes);
  }, [highlightedNodeIndex, points]);

  return (
    <main className="fixed inset-0 bg-black overflow-hidden">
      <Suspense
        fallback={
          <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin h-12 w-12 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-gray-400">Loading graph visualization...</p>
            </div>
          </div>
        }
      >
        <EmbeddingVisualizer
          highlightedNodeIndex={highlightedNodeIndex}
          similarNodeIndices={similarNodeIndices}
          hideHeader={true}
          newEmbedding={newEmbedding}
          newUserInfo={newUserInfo}
          onPointsUpdate={handlePointsUpdate}
          method={method}
          onMethodChange={setMethod}
          clusterLabels={clusterLabels}
        />
      </Suspense>

      {/* Controls Panel - Algorithm selector and K-Means clustering */}
      <ControlsPanel
        method={method}
        onMethodChange={setMethod}
        onCluster={handleCluster}
        onClearClusters={handleClearClusters}
        clusterLabels={clusterLabels}
        isClustering={isClustering}
      />

      {/* Bottom Tab */}
      <BottomTab
        onSearch={handleSearch}
        searchState={searchState}
        searchResult={searchResult}
        error={error}
        onReset={handleReset}
        onGrokTarget={handleGrokTarget}
        grokState={grokState}
        grokError={grokError}
      />
      
      {/* Buying Behavior Popup */}
      {searchResult?.found && searchResult.user_id && searchResult.username && (
        <BuyingBehaviorPopup
          user_id={searchResult.user_id}
          username={searchResult.username}
          isOpen={showBehaviorPopup}
          onClose={() => setShowBehaviorPopup(false)}
        />
      )}
    </main>
  );
}

