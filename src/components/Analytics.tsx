import { useMemo } from 'react';
import { useStore } from '../store';
import { format } from 'date-fns';
import { BarChart3, TrendingUp, Clock, Users, CheckCircle, XCircle } from 'lucide-react';

export default function Analytics() {
  const { episodes, reviews } = useStore();

  const stats = useMemo(() => {
    const total = episodes.length;
    const autoApproved = episodes.filter((ep) => ep.status === 'auto_approved').length;
    const humanReviewed = reviews.length;
    const approved = episodes.filter((ep) => ep.status === 'approved').length;
    const denied = episodes.filter((ep) => ep.status === 'denied').length;

    const coverage = total > 0 ? (autoApproved / total) * 100 : 0;
    const humanCoverage = total > 0 ? (humanReviewed / total) * 100 : 0;

    const avgReviewTime =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.time_ms, 0) / reviews.length / 1000
        : 0;

    // Confidence distribution
    const confidenceBuckets = {
      '0-50%': episodes.filter((ep) => ep.model_conf < 0.5).length,
      '50-70%': episodes.filter((ep) => ep.model_conf >= 0.5 && ep.model_conf < 0.7).length,
      '70-85%': episodes.filter((ep) => ep.model_conf >= 0.7 && ep.model_conf < 0.85).length,
      '85-95%': episodes.filter((ep) => ep.model_conf >= 0.85 && ep.model_conf < 0.95).length,
      '95-100%': episodes.filter((ep) => ep.model_conf >= 0.95).length,
    };

    return {
      total,
      autoApproved,
      humanReviewed,
      approved,
      denied,
      coverage,
      humanCoverage,
      avgReviewTime,
      confidenceBuckets,
    };
  }, [episodes, reviews]);

  const recentReviews = useMemo(() => {
    return [...reviews]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);
  }, [reviews]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Analytics & Audit</h2>
        <p className="text-gray-400 text-sm mt-1">
          Performance metrics and review history
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-3">
            <BarChart3 className="w-8 h-8 text-blue-400" />
            <div className="text-right">
              <div className="text-3xl font-bold">{stats.total}</div>
              <div className="text-xs text-gray-400">Total Episodes</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-3">
            <TrendingUp className="w-8 h-8 text-green-400" />
            <div className="text-right">
              <div className="text-3xl font-bold">{stats.coverage.toFixed(1)}%</div>
              <div className="text-xs text-gray-400">Auto-Approved</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-3">
            <Users className="w-8 h-8 text-yellow-400" />
            <div className="text-right">
              <div className="text-3xl font-bold">{stats.humanCoverage.toFixed(1)}%</div>
              <div className="text-xs text-gray-400">Human Reviewed</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-3">
            <Clock className="w-8 h-8 text-purple-400" />
            <div className="text-right">
              <div className="text-3xl font-bold">{stats.avgReviewTime.toFixed(1)}s</div>
              <div className="text-xs text-gray-400">Avg Review Time</div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        {/* Confidence Distribution */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Confidence Distribution</h3>
          <div className="space-y-3">
            {Object.entries(stats.confidenceBuckets).map(([range, count]) => {
              const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <div key={range}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-400">{range}</span>
                    <span className="font-semibold">{count} episodes</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Review Outcomes */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Review Outcomes</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-gray-300">Approved</span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{stats.approved}</div>
                <div className="text-xs text-gray-400">
                  {stats.total > 0 ? ((stats.approved / stats.total) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <XCircle className="w-5 h-5 text-red-400" />
                <span className="text-gray-300">Denied</span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{stats.denied}</div>
                <div className="text-xs text-gray-400">
                  {stats.total > 0 ? ((stats.denied / stats.total) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-blue-400" />
                <span className="text-gray-300">Auto-Approved</span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{stats.autoApproved}</div>
                <div className="text-xs text-gray-400">
                  {stats.total > 0 ? ((stats.autoApproved / stats.total) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Reviews */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Reviews</h3>
        {recentReviews.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No reviews yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="text-left border-b border-gray-700">
                <tr>
                  <th className="pb-3 text-xs font-semibold text-gray-400 uppercase">Timestamp</th>
                  <th className="pb-3 text-xs font-semibold text-gray-400 uppercase">Episode</th>
                  <th className="pb-3 text-xs font-semibold text-gray-400 uppercase">Action</th>
                  <th className="pb-3 text-xs font-semibold text-gray-400 uppercase">Reason</th>
                  <th className="pb-3 text-xs font-semibold text-gray-400 uppercase">Time Spent</th>
                  <th className="pb-3 text-xs font-semibold text-gray-400 uppercase">Reviewer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {recentReviews.map((review) => (
                  <tr key={review.review_id} className="hover:bg-gray-700/30">
                    <td className="py-3 text-sm">
                      {format(review.timestamp, 'MMM dd, HH:mm:ss')}
                    </td>
                    <td className="py-3 text-sm font-mono">{review.episode_id}</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium ${
                          review.action === 'approve'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {review.action === 'approve' ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        <span className="capitalize">{review.action}</span>
                      </span>
                    </td>
                    <td className="py-3 text-sm text-gray-400">
                      {review.reason_code ? (
                        <span className="capitalize">{review.reason_code.replace(/_/g, ' ')}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 text-sm">{(review.time_ms / 1000).toFixed(1)}s</td>
                    <td className="py-3 text-sm">{review.reviewer_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
