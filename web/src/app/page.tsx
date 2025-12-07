"use client";

import { useState } from "react";
import Link from "next/link";

interface UserInfo {
  user_id: string;
  username: string;
  name: string | null;
  description: string | null;
  followers_count: number;
  following_count: number;
  tweet_count: number;
  created_at: string | null;
}

interface FeatureBreakdown {
  interest_embedding_dim: number;
  scalar_features: {
    avg_sentiment: number;
    sentiment_volatility: number;
    tweets_per_day: number;
    reply_ratio: number;
    retweet_ratio: number;
    original_ratio: number;
    avg_tweet_length: number;
  };
  emotion_profile: {
    joy: number;
    sadness: number;
    anger: number;
  };
  category_sentiments: Record<string, number>;
  category_volumes: Record<string, number>;
}

interface EmbeddingResponse {
  user_info: UserInfo;
  embedding: number[];
  embedding_dim: number;
  num_tweets_processed: number;
  feature_breakdown: FeatureBreakdown;
}

export default function Home() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EmbeddingResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/embedding`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.replace("@", ""),
          max_tweets: 100,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to generate embedding");
      }

      const data: EmbeddingResponse = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
              <span className="text-black font-bold text-sm">x</span>
            </div>
            <span className="text-xl font-semibold">xAI Ads</span>
          </div>
          <Link
            href="/graph"
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-all border border-white/20 hover:border-white/30"
          >
            Explore Graph
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-6xl md:text-7xl font-light mb-6 tracking-tight">
              User Graph
              <span className="block text-cyan-400 font-normal">Intelligence</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Transform X profiles into 408-dimensional embeddings. Understand interests, sentiment, and behavior for precision targeting.
            </p>
          </div>

          {/* Input Card */}
          <div className="max-w-2xl mx-auto mb-12">
            <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 text-lg">
                    @
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter X username"
                    className="w-full pl-10 pr-5 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 text-white placeholder-gray-500 text-lg transition-all"
                    disabled={loading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !username.trim()}
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed rounded-2xl font-semibold text-lg transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="animate-spin h-5 w-5"
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
                      Processing...
                    </span>
                  ) : (
                    "Generate Embedding"
                  )}
                </button>
              </form>

              {error && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Quick Access to Graph */}
          <div className="text-center mb-16">
            <Link
              href="/graph"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-sm font-medium transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Explore User Graph
            </Link>
          </div>
        </div>
      </div>

      {/* Results Section */}
      {result && (
        <div className="max-w-6xl mx-auto px-6 pb-20 space-y-6">
          {/* User Info Card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
            <div className="flex items-start gap-6">
              <div className="w-20 h-20 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl flex items-center justify-center text-3xl font-bold text-black">
                {result.user_info.name?.[0] || result.user_info.username[0]}
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-semibold mb-1">{result.user_info.name}</h2>
                <p className="text-gray-400 text-lg mb-3">@{result.user_info.username}</p>
                {result.user_info.description && (
                  <p className="text-gray-300 mb-4 leading-relaxed">{result.user_info.description}</p>
                )}
                <div className="flex gap-8 text-sm">
                  <div>
                    <span className="text-gray-400">Followers</span>
                    <p className="text-xl font-semibold">{result.user_info.followers_count.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Following</span>
                    <p className="text-xl font-semibold">{result.user_info.following_count.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Tweets</span>
                    <p className="text-xl font-semibold">{result.user_info.tweet_count.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-center">
            <Link
              href={`/graph?username=${encodeURIComponent(result.user_info.username)}`}
              className="p-6 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl transition-all text-left group max-w-md w-full"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                  <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <span className="font-semibold">Explore Graph</span>
              </div>
              <p className="text-sm text-gray-400">View this user in the interactive graph visualization</p>
            </Link>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <div className="text-4xl font-light text-cyan-400 mb-1">{result.embedding_dim}</div>
              <div className="text-sm text-gray-400">Dimensions</div>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <div className="text-4xl font-light text-cyan-400 mb-1">{result.num_tweets_processed}</div>
              <div className="text-sm text-gray-400">Tweets Analyzed</div>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <div className="text-4xl font-light text-cyan-400 mb-1">
                {(result.feature_breakdown.scalar_features.avg_sentiment * 100).toFixed(0)}%
              </div>
              <div className="text-sm text-gray-400">Avg Sentiment</div>
            </div>
          </div>

          {/* Emotion Profile */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
            <h3 className="text-lg font-semibold mb-6">Emotion Profile</h3>
            <div className="space-y-4">
              {Object.entries(result.feature_breakdown.emotion_profile).map(([emotion, value]) => (
                <div key={emotion}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="capitalize text-gray-300">{emotion}</span>
                    <span className="text-gray-400">{(value * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        emotion === "joy"
                          ? "bg-yellow-400"
                          : emotion === "sadness"
                          ? "bg-blue-400"
                          : "bg-red-400"
                      }`}
                      style={{ width: `${value * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Category Volumes */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
            <h3 className="text-lg font-semibold mb-6">Content Categories</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(result.feature_breakdown.category_volumes)
                .sort(([, a], [, b]) => b - a)
                .map(([category, count]) => (
                  <div
                    key={category}
                    className="bg-white/5 rounded-xl p-4 text-center border border-white/10"
                  >
                    <div className="text-2xl font-semibold mb-1">{count}</div>
                    <div className="text-gray-400 text-xs capitalize">{category}</div>
                  </div>
                ))}
            </div>
          </div>

          {/* Activity Metrics */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
            <h3 className="text-lg font-semibold mb-6">Activity Metrics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="text-3xl font-light text-cyan-400 mb-1">
                  {result.feature_breakdown.scalar_features.tweets_per_day.toFixed(1)}
                </div>
                <div className="text-sm text-gray-400">Tweets/Day</div>
              </div>
              <div>
                <div className="text-3xl font-light text-cyan-400 mb-1">
                  {(result.feature_breakdown.scalar_features.original_ratio * 100).toFixed(0)}%
                </div>
                <div className="text-sm text-gray-400">Original</div>
              </div>
              <div>
                <div className="text-3xl font-light text-cyan-400 mb-1">
                  {(result.feature_breakdown.scalar_features.reply_ratio * 100).toFixed(0)}%
                </div>
                <div className="text-sm text-gray-400">Replies</div>
              </div>
              <div>
                <div className="text-3xl font-light text-cyan-400 mb-1">
                  {(result.feature_breakdown.scalar_features.retweet_ratio * 100).toFixed(0)}%
                </div>
                <div className="text-sm text-gray-400">Retweets</div>
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
