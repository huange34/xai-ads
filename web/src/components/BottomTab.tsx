"use client";

import { useState, FormEvent } from "react";

export type SearchState = "idle" | "loading" | "success" | "error";

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

interface BottomTabProps {
  onSearch: (handle: string) => Promise<SearchResult>;
  searchState: SearchState;
  searchResult: SearchResult | null;
  error: string | null;
  onReset?: () => void;
}

export default function BottomTab({
  onSearch,
  searchState,
  searchResult,
  error,
  onReset,
}: BottomTabProps) {
  const [handle, setHandle] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!handle.trim() || searchState === "loading") return;
    
    const cleanHandle = handle.trim().replace(/^@/, "");
    await onSearch(cleanHandle);
  };

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-50 pointer-events-none">
      <div className="bg-white/10 backdrop-blur-xl rounded-t-3xl border-t border-l border-r border-white/20 shadow-2xl p-6 pb-8 pointer-events-auto animate-slide-up">
        {/* Idle / Loading State */}
        {(searchState === "idle" || searchState === "loading") && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">
                Explore the graph
              </h3>
              <p className="text-sm text-gray-300/80">
                Enter an X handle to locate this user and see nearby communities.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex gap-3">
              <div className="flex-1 relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  @
                </span>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="username"
                  disabled={searchState === "loading"}
                  className="w-full pl-8 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <button
                type="submit"
                disabled={!handle.trim() || searchState === "loading"}
                className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-xl font-medium text-white transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400/50 min-w-[100px] flex items-center justify-center"
              >
                {searchState === "loading" ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Locating...
                  </span>
                ) : (
                  "Locate"
                )}
              </button>
            </form>
          </div>
        )}

        {/* Success State */}
        {searchState === "success" && searchResult?.found && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <h3 className="text-lg font-semibold text-white">
                  @{searchResult.username}
                </h3>
              </div>
              <p className="text-sm text-gray-300/80">
                Closest neighbors in your interest graph
              </p>
            </div>

            {searchResult.similar_users && searchResult.similar_users.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {searchResult.similar_users.map((user) => (
                  <div
                    key={user.node_index}
                    className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-sm text-white/90 backdrop-blur-sm"
                  >
                    @{user.username}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => {
                setHandle("");
                onReset?.();
              }}
              className="w-full py-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              Search another user
            </button>
          </div>
        )}

        {/* Error State */}
        {searchState === "error" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">
                User not found
              </h3>
              <p className="text-sm text-red-300/80">
                {error || "We couldn't find that handle in the current graph."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex gap-3">
              <div className="flex-1 relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  @
                </span>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="username"
                  className="w-full pl-8 pr-4 py-3 bg-white/10 border border-red-500/30 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400/50 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={!handle.trim()}
                className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-xl font-medium text-white transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400/50 min-w-[100px]"
              >
                Try Again
              </button>
            </form>
          </div>
        )}
      </div>

    </div>
  );
}

