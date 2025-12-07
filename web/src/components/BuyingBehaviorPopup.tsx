"use client";

import { useEffect, useState } from "react";

interface BuyingBehaviorPopupProps {
  user_id: string;
  username: string;
  isOpen: boolean;
  onClose: () => void;
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

export default function BuyingBehaviorPopup({
  user_id,
  username,
  isOpen,
  onClose,
}: BuyingBehaviorPopupProps) {
  const [behavior, setBehavior] = useState<FeatureBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user_id) {
      setLoading(true);
      setError(null);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      
      fetch(`${apiUrl}/users/${user_id}/behavior`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch buying behavior");
          return res.json();
        })
        .then((data) => {
          setBehavior(data.feature_breakdown);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [isOpen, user_id]);

  if (!isOpen) return null;

  const formatPercent = (val: number) => `${(val * 100).toFixed(1)}%`;
  const formatNumber = (val: number, decimals = 2) => val.toFixed(decimals);
  const formatSentiment = (val: number) => {
    if (val > 0.3) return "Positive";
    if (val < -0.3) return "Negative";
    return "Neutral";
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      tech: "text-blue-400",
      travel: "text-cyan-400",
      finance: "text-green-400",
      fitness: "text-red-400",
      crypto: "text-yellow-400",
      shopping: "text-pink-400",
      other: "text-gray-400",
    };
    return colors[category] || "text-gray-400";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      />
      
      {/* Popup */}
      <div
        className="relative bg-black/90 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-black/80 backdrop-blur-sm border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Buying Behavior</h2>
            <p className="text-sm text-gray-400 mt-0.5">@{username}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-400"></div>
            </div>
          )}

          {error && (
            <div className="text-red-400 text-center py-8">{error}</div>
          )}

          {behavior && (
            <>
              {/* Sentiment Overview */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-white">Sentiment Profile</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="text-sm text-gray-400 mb-1">Average Sentiment</div>
                    <div className={`text-2xl font-bold ${
                      behavior.scalar_features.avg_sentiment > 0.3 ? "text-green-400" :
                      behavior.scalar_features.avg_sentiment < -0.3 ? "text-red-400" :
                      "text-gray-400"
                    }`}>
                      {formatSentiment(behavior.scalar_features.avg_sentiment)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatNumber(behavior.scalar_features.avg_sentiment)}
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="text-sm text-gray-400 mb-1">Sentiment Volatility</div>
                    <div className="text-2xl font-bold text-yellow-400">
                      {formatNumber(behavior.scalar_features.sentiment_volatility)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Higher = more variable</div>
                  </div>
                </div>
              </div>

              {/* Emotion Profile */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-white">Emotion Profile</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10 text-center">
                    <div className="text-sm text-gray-400 mb-1">Joy</div>
                    <div className="text-xl font-bold text-yellow-400">
                      {formatPercent(behavior.emotion_profile.joy)}
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10 text-center">
                    <div className="text-sm text-gray-400 mb-1">Sadness</div>
                    <div className="text-xl font-bold text-blue-400">
                      {formatPercent(behavior.emotion_profile.sadness)}
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10 text-center">
                    <div className="text-sm text-gray-400 mb-1">Anger</div>
                    <div className="text-xl font-bold text-red-400">
                      {formatPercent(behavior.emotion_profile.anger)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Activity Metrics */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-white">Activity Metrics</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="text-sm text-gray-400 mb-1">Tweets per Day</div>
                    <div className="text-xl font-bold text-cyan-400">
                      {formatNumber(behavior.scalar_features.tweets_per_day)}
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="text-sm text-gray-400 mb-1">Avg Tweet Length</div>
                    <div className="text-xl font-bold text-purple-400">
                      {formatNumber(behavior.scalar_features.avg_tweet_length)} chars
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="text-sm text-gray-400 mb-1">Reply Ratio</div>
                    <div className="text-xl font-bold text-green-400">
                      {formatPercent(behavior.scalar_features.reply_ratio)}
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="text-sm text-gray-400 mb-1">Retweet Ratio</div>
                    <div className="text-xl font-bold text-orange-400">
                      {formatPercent(behavior.scalar_features.retweet_ratio)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Category Interests */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-white">Category Interests</h3>
                <div className="space-y-2">
                  {Object.entries(behavior.category_volumes)
                    .filter(([_, volume]) => volume > 0)
                    .sort(([_, a], [__, b]) => b - a)
                    .map(([category, volume]) => {
                      const sentiment = behavior.category_sentiments[category] || 0;
                      return (
                        <div
                          key={category}
                          className="bg-white/5 rounded-lg p-4 border border-white/10 flex items-center justify-between"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`font-semibold capitalize ${getCategoryColor(category)}`}>
                                {category}
                              </span>
                              <span className="text-xs text-gray-500">
                                {volume} tweets
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${
                                    sentiment > 0.3 ? "bg-green-500" :
                                    sentiment < -0.3 ? "bg-red-500" :
                                    "bg-gray-500"
                                  }`}
                                  style={{ width: `${Math.abs(sentiment) * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-400 w-16 text-right">
                                {formatSentiment(sentiment)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

