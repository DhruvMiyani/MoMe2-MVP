import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { format } from 'date-fns';
import { Filter, Search, ArrowUpDown } from 'lucide-react';
import ConfidenceChip from './ConfidenceChip';
import QualityBadge from './QualityBadge';
import StatusBadge from './StatusBadge';
import clsx from 'clsx';

export default function TriageWorklist() {
  const {
    episodes,
    setSelectedEpisodeId,
    setCurrentView,
    showOnlyNeedsReview,
    setShowOnlyNeedsReview,
  } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'confidence' | 'time'>('confidence');

  // Filter and sort episodes
  const filteredEpisodes = useMemo(() => {
    let filtered = episodes;

    // Filter by status
    if (showOnlyNeedsReview) {
      filtered = filtered.filter((ep) => ep.status === 'needs_review');
    }

    // Filter by search
    if (searchTerm) {
      filtered = filtered.filter(
        (ep) =>
          ep.episode_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ep.recording_id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'confidence') {
        return a.model_conf - b.model_conf; // Ascending (lowest first)
      } else {
        return b.start_ts.getTime() - a.start_ts.getTime(); // Descending (newest first)
      }
    });

    return filtered;
  }, [episodes, showOnlyNeedsReview, searchTerm, sortBy]);

  const stats = useMemo(() => {
    const total = episodes.length;
    const needsReview = episodes.filter((ep) => ep.status === 'needs_review').length;
    const autoApproved = episodes.filter((ep) => ep.status === 'auto_approved').length;
    const reviewed = episodes.filter(
      (ep) => ep.status === 'approved' || ep.status === 'denied'
    ).length;

    return { total, needsReview, autoApproved, reviewed };
  }, [episodes]);

  const handleReview = (episodeId: string) => {
    setSelectedEpisodeId(episodeId);
    setCurrentView('review');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Triage Worklist</h2>
          <p className="text-gray-400 text-sm mt-1">
            Review and approve bradycardia episodes
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center space-x-6 bg-gray-800 px-6 py-3 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-gray-400">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">{stats.needsReview}</div>
            <div className="text-xs text-gray-400">Needs Review</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{stats.autoApproved}</div>
            <div className="text-xs text-gray-400">Auto-Approved</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{stats.reviewed}</div>
            <div className="text-xs text-gray-400">Reviewed</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4 bg-gray-800 p-4 rounded-lg">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by episode ID or recording ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-700 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Show only needs review */}
        <button
          onClick={() => setShowOnlyNeedsReview(!showOnlyNeedsReview)}
          className={clsx(
            'flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors',
            showOnlyNeedsReview
              ? 'bg-yellow-500 text-gray-900'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          )}
        >
          <Filter className="w-4 h-4" />
          <span className="font-medium">Needs Review Only</span>
        </button>

        {/* Sort */}
        <button
          onClick={() => setSortBy(sortBy === 'confidence' ? 'time' : 'confidence')}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
        >
          <ArrowUpDown className="w-4 h-4" />
          <span className="font-medium">
            Sort by {sortBy === 'confidence' ? 'Confidence ↑' : 'Time ↓'}
          </span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Episode ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Start Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                HR (min/avg)
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Confidence
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Quality
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filteredEpisodes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No episodes found
                </td>
              </tr>
            ) : (
              filteredEpisodes.map((episode) => (
                <tr
                  key={episode.episode_id}
                  className="hover:bg-gray-700/50 transition-colors cursor-pointer"
                  onClick={() => handleReview(episode.episode_id)}
                >
                  <td className="px-4 py-3 text-sm font-mono">{episode.episode_id}</td>
                  <td className="px-4 py-3 text-sm">
                    {format(episode.start_ts, 'MMM dd, yyyy HH:mm:ss')}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="font-medium">{episode.min_hr}</span> /{' '}
                    <span className="text-gray-400">{episode.avg_hr}</span> bpm
                  </td>
                  <td className="px-4 py-3">
                    <ConfidenceChip confidence={episode.model_conf} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <QualityBadge quality={episode.quality} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={episode.status} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReview(episode.episode_id);
                      }}
                      className="px-3 py-1.5 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="text-sm text-gray-400 text-center">
        Showing {filteredEpisodes.length} of {episodes.length} episodes
      </div>
    </div>
  );
}
