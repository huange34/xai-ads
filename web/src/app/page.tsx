"use client";

import { useState, lazy, Suspense } from "react";

// Lazy load the visualizer to avoid SSR issues with Three.js
const EmbeddingVisualizer = lazy(() => import("@/components/EmbeddingVisualizer"));

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
  const [showVisualizer, setShowVisualizer] = useState(false);

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
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            xAI Ads
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Generate 408-dimensional user embeddings from X (Twitter) profiles.
            Understand user interests, sentiment patterns, and behavior for
            precision ad targeting.
          </p>
        </div>

        {/* Input Form */}
        <div className="max-w-xl mx-auto mb-12">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="flex-1 relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                @
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full pl-8 pr-4 py-4 bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white placeholder-gray-500 text-lg"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl font-semibold text-lg transition-colors"
            >
              {loading ? (
                <span className="flex items-center gap-2">
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
            <div className="mt-4 p-4 bg-red-900/50 border border-red-700 rounded-xl text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Results Section */}
        {result && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* User Info Card */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-2xl font-bold">
                  {result.user_info.name?.[0] || result.user_info.username[0]}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold">{result.user_info.name}</h2>
                  <p className="text-gray-400">@{result.user_info.username}</p>
                  {result.user_info.description && (
                    <p className="mt-2 text-gray-300">{result.user_info.description}</p>
                  )}
                  <div className="flex gap-6 mt-4 text-sm">
                    <span>
                      <strong className="text-white">{result.user_info.followers_count.toLocaleString()}</strong>{" "}
                      <span className="text-gray-500">followers</span>
                    </span>
                    <span>
                      <strong className="text-white">{result.user_info.following_count.toLocaleString()}</strong>{" "}
                      <span className="text-gray-500">following</span>
                    </span>
                    <span>
                      <strong className="text-white">{result.user_info.tweet_count.toLocaleString()}</strong>{" "}
                      <span className="text-gray-500">tweets</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Visualize Button */}
            <button
              onClick={() => setShowVisualizer(true)}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-3"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
              </svg>
              Visualize in Embedding Space
            </button>

            {/* Embedding Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
                <div className="text-3xl font-bold text-blue-400">{result.embedding_dim}</div>
                <div className="text-gray-400 text-sm">Embedding Dimensions</div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
                <div className="text-3xl font-bold text-purple-400">{result.num_tweets_processed}</div>
                <div className="text-gray-400 text-sm">Tweets Analyzed</div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
                <div className="text-3xl font-bold text-green-400">
                  {(result.feature_breakdown.scalar_features.avg_sentiment * 100).toFixed(0)}%
                </div>
                <div className="text-gray-400 text-sm">Avg Sentiment</div>
              </div>
            </div>

            {/* Emotion Profile */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Emotion Profile</h3>
              <div className="space-y-3">
                {Object.entries(result.feature_breakdown.emotion_profile).map(([emotion, value]) => (
                  <div key={emotion}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize">{emotion}</span>
                      <span>{(value * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          emotion === "joy"
                            ? "bg-yellow-500"
                            : emotion === "sadness"
                            ? "bg-blue-500"
                            : "bg-red-500"
                        }`}
                        style={{ width: `${value * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Category Volumes */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Content Categories</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(result.feature_breakdown.category_volumes)
                  .sort(([, a], [, b]) => b - a)
                  .map(([category, count]) => (
                    <div
                      key={category}
                      className="bg-gray-700/50 rounded-lg p-3 text-center"
                    >
                      <div className="text-xl font-bold">{count}</div>
                      <div className="text-gray-400 text-sm capitalize">{category}</div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Activity Metrics */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Activity Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-2xl font-bold text-blue-400">
                    {result.feature_breakdown.scalar_features.tweets_per_day.toFixed(1)}
                  </div>
                  <div className="text-gray-400 text-sm">Tweets/Day</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">
                    {(result.feature_breakdown.scalar_features.original_ratio * 100).toFixed(0)}%
                  </div>
                  <div className="text-gray-400 text-sm">Original Content</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-400">
                    {(result.feature_breakdown.scalar_features.reply_ratio * 100).toFixed(0)}%
                  </div>
                  <div className="text-gray-400 text-sm">Replies</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-400">
                    {(result.feature_breakdown.scalar_features.retweet_ratio * 100).toFixed(0)}%
                  </div>
                  <div className="text-gray-400 text-sm">Retweets</div>
                </div>
              </div>
            </div>

            {/* Raw Embedding (Collapsible) */}
            <details className="bg-gray-800/50 border border-gray-700 rounded-xl">
              <summary className="p-6 cursor-pointer font-semibold hover:text-blue-400 transition-colors">
                View Raw Embedding Vector (408 dimensions)
              </summary>
              <div className="px-6 pb-6">
                <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-xs text-gray-400 max-h-48 overflow-y-auto">
                  [{result.embedding.map((v) => v.toFixed(6)).join(", ")}]
                </pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(result.embedding));
                  }}
                  className="mt-3 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                >
                  Copy to Clipboard
                </button>
              </div>
            </details>
          </div>
        )}

        {/* Features Section */}
        {!result && (
          <div className="max-w-4xl mx-auto mt-16">
            <h2 className="text-2xl font-bold text-center mb-8">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
                <div className="text-3xl mb-4">🐦</div>
                <h3 className="font-semibold mb-2">Fetch Tweets</h3>
                <p className="text-gray-400 text-sm">
                  We fetch up to 100 recent tweets from the user&apos;s profile using
                  the X API.
                </p>
              </div>
              <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
                <div className="text-3xl mb-4">🧠</div>
                <h3 className="font-semibold mb-2">Extract Features</h3>
                <p className="text-gray-400 text-sm">
                  Each tweet is analyzed for semantic content, sentiment, emotion,
                  and category using ML models.
                </p>
              </div>
              <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
                <div className="text-3xl mb-4">📊</div>
                <h3 className="font-semibold mb-2">Generate Embedding</h3>
                <p className="text-gray-400 text-sm">
                  Features are aggregated into a 408-dimensional vector representing
                  the user&apos;s interests and behavior.
                </p>
              </div>
            </div>

            <div className="mt-12 bg-gray-800/30 border border-gray-700 rounded-xl p-6">
              <h3 className="font-semibold mb-4">Embedding Structure (408 dimensions)</h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-700">
                  <span className="text-gray-400">Interest Embedding</span>
                  <span className="font-mono">384 dims</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-700">
                  <span className="text-gray-400">Scalar Features</span>
                  <span className="font-mono">7 dims</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-700">
                  <span className="text-gray-400">Emotion Profile</span>
                  <span className="font-mono">3 dims</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-700">
                  <span className="text-gray-400">Category Features</span>
                  <span className="font-mono">14 dims</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Embedding Visualizer Modal */}
      {showVisualizer && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-gray-400">Loading 3D visualizer...</p>
              </div>
            </div>
          }
        >
          <EmbeddingVisualizer
            newEmbedding={result?.embedding}
            onClose={() => setShowVisualizer(false)}
          />
        </Suspense>
      )}
    </main>
  );
}
