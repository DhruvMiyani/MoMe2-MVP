import { useEffect, useState, useCallback } from 'react';
import { useStore } from '../store';
import { generateMockECGData } from '../utils/mockData';
import ECGCanvas from './ECGCanvas';
import ConfidenceChip from './ConfidenceChip';
import QualityBadge from './QualityBadge';
import { CheckCircle, XCircle, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { format } from 'date-fns';
import { ReasonCode } from '../types';

const REASON_CODES: { code: ReasonCode; label: string; key: string }[] = [
  { code: 'artifact_noise', label: 'Artifact/Noise', key: '1' },
  { code: 'sensor_lead_off', label: 'Lead Off', key: '2' },
  { code: 'ectopy_confounder', label: 'Ectopy/PVC', key: '3' },
  { code: 'motion', label: 'Motion', key: '4' },
  { code: 'low_amp', label: 'Low Amplitude', key: '5' },
  { code: 'other', label: 'Other', key: '6' },
];

export default function EventReview() {
  const {
    episodes,
    selectedEpisodeId,
    ecgData,
    setEcgData,
    approveEpisode,
    denyEpisode,
    setCurrentView,
    setSelectedEpisodeId,
  } = useStore();

  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [selectedReason, setSelectedReason] = useState<ReasonCode | null>(null);
  const [notes, setNotes] = useState('');
  const [reviewStartTime, setReviewStartTime] = useState<number>(Date.now());

  const episode = episodes.find((ep) => ep.episode_id === selectedEpisodeId);

  // Load ECG data when episode changes
  useEffect(() => {
    if (episode) {
      const mockData = generateMockECGData(60, 250);
      setEcgData(mockData);
      setReviewStartTime(Date.now());
    }
  }, [episode, setEcgData]);

  const handleApprove = useCallback(() => {
    if (!episode) return;
    const timeSpent = Date.now() - reviewStartTime;
    approveEpisode(episode.episode_id, 'user_1', timeSpent);
    // Don't auto-advance - let user navigate manually
  }, [episode, reviewStartTime, approveEpisode]);

  const handleDeny = useCallback(() => {
    if (!episode) return;
    setShowReasonDialog(true);
  }, [episode]);

  const confirmDeny = useCallback(() => {
    if (!episode) return;
    const timeSpent = Date.now() - reviewStartTime;
    denyEpisode(
      episode.episode_id,
      'user_1',
      timeSpent,
      selectedReason || undefined,
      notes || undefined
    );
    setShowReasonDialog(false);
    setSelectedReason(null);
    setNotes('');
    // Don't auto-advance - let user navigate manually
  }, [episode, selectedReason, notes, reviewStartTime, denyEpisode]);

  const moveToNext = useCallback(() => {
    const currentIndex = episodes.findIndex((ep) => ep.episode_id === selectedEpisodeId);
    if (currentIndex < episodes.length - 1) {
      setSelectedEpisodeId(episodes[currentIndex + 1].episode_id);
    }
  }, [episodes, selectedEpisodeId, setSelectedEpisodeId]);

  const moveToPrevious = useCallback(() => {
    const currentIndex = episodes.findIndex((ep) => ep.episode_id === selectedEpisodeId);
    if (currentIndex > 0) {
      setSelectedEpisodeId(episodes[currentIndex - 1].episode_id);
    }
  }, [episodes, selectedEpisodeId, setSelectedEpisodeId]);

  const handleBack = useCallback(() => {
    setCurrentView('worklist');
    setSelectedEpisodeId(null);
  }, [setCurrentView, setSelectedEpisodeId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'a' || e.key === 'A') {
        handleApprove();
      } else if (e.key === 'd' || e.key === 'D') {
        handleDeny();
      } else if (e.key === 'Escape') {
        handleBack();
      } else if (e.key === 'ArrowLeft' || e.key === 'j' || e.key === 'J') {
        moveToPrevious();
      } else if (e.key === 'ArrowRight' || e.key === 'k' || e.key === 'K') {
        moveToNext();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleApprove, handleDeny, handleBack, moveToPrevious, moveToNext]);

  const currentIndex = episodes.findIndex((ep) => ep.episode_id === selectedEpisodeId);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < episodes.length - 1;

  if (!episode) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <Info className="w-16 h-16 text-gray-500" />
        <p className="text-xl text-gray-400">No episode selected</p>
        <button
          onClick={handleBack}
          className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
        >
          Back to Worklist
        </button>
      </div>
    );
  }

  if (!ecgData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-xl text-gray-400">Loading ECG data...</div>
      </div>
    );
  }

  const qualityIssues = Object.entries(episode.quality)
    .filter(([_, value]) => value)
    .map(([key]) => key.replace(/_/g, ' '));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBack}
          className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>Back to Worklist</span>
        </button>

        <div className="flex items-center space-x-4">
          {/* Navigation */}
          <div className="flex items-center space-x-2">
            <button
              onClick={moveToPrevious}
              disabled={!hasPrevious}
              className="flex items-center space-x-1 px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Previous (← or J)"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="text-sm">Previous</span>
            </button>

            <div className="text-sm text-gray-400 px-3">
              Episode {currentIndex + 1} of {episodes.length}
            </div>

            <button
              onClick={moveToNext}
              disabled={!hasNext}
              className="flex items-center space-x-1 px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next (→ or K)"
            >
              <span className="text-sm">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="text-sm font-mono text-gray-300 border-l border-gray-700 pl-4">
            {episode.episode_id}
          </div>
        </div>
      </div>

      {/* Main content - 2 column layout */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left: ECG Canvas (2/3 width) */}
        <div className="col-span-2 space-y-4">
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">ECG Trace</h3>
            <div className="w-full overflow-hidden">
              <ECGCanvas
                data={ecgData}
                episode={episode}
                width={750}
                height={350}
                onSegmentAction={(action) => {
                  if (action === 'approve') handleApprove();
                  else handleDeny();
                }}
              />
            </div>

            {/* Helper text */}
            <div className="mt-4 text-sm text-gray-400 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span>🖱️ Scroll to zoom • Drag to pan</span>
              <span>⌨️ A = Approve • D = Deny</span>
              <span>← / J = Previous • → / K = Next • ESC = Back</span>
            </div>
          </div>

          {/* Action Bar */}
          <div className="bg-gray-800 rounded-lg p-6 flex items-center justify-between">
            <div className="text-lg font-semibold">Review Actions</div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleApprove}
                className="flex items-center space-x-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-semibold"
              >
                <CheckCircle className="w-5 h-5" />
                <span>Approve</span>
                <span className="text-xs opacity-70 ml-1">(A)</span>
              </button>
              <button
                onClick={handleDeny}
                className="flex items-center space-x-2 px-6 py-3 bg-danger text-white rounded-lg hover:bg-danger/90 transition-colors font-semibold"
              >
                <XCircle className="w-5 h-5" />
                <span>Deny</span>
                <span className="text-xs opacity-70 ml-1">(D)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Explainability Panel (1/3 width) */}
        <div className="space-y-4">
          {/* Episode Info */}
          <div className="bg-gray-800 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-sm text-gray-400 uppercase">Episode Info</h3>
            <div className="space-y-2">
              <div>
                <div className="text-xs text-gray-500">Start Time</div>
                <div className="text-sm">{format(episode.start_ts, 'MMM dd, HH:mm:ss')}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Duration</div>
                <div className="text-sm">
                  {((episode.end_ts.getTime() - episode.start_ts.getTime()) / 1000).toFixed(1)}s
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Heart Rate</div>
                <div className="text-sm">
                  Min: <span className="font-semibold">{episode.min_hr}</span> bpm • Avg:{' '}
                  <span className="font-semibold">{episode.avg_hr}</span> bpm
                </div>
              </div>
            </div>
          </div>

          {/* Confidence */}
          <div className="bg-gray-800 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-sm text-gray-400 uppercase">Confidence</h3>
            <div className="flex items-center justify-between">
              <ConfidenceChip confidence={episode.model_conf} size="lg" />
            </div>
            <div className="text-xs text-gray-400">
              {episode.model_conf >= 0.8
                ? 'High confidence - well calibrated model prediction'
                : episode.model_conf >= 0.5
                ? 'Borderline confidence - human review recommended'
                : 'Low confidence - careful review required'}
            </div>
          </div>

          {/* Explanation */}
          <div className="bg-gray-800 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-sm text-gray-400 uppercase">Why Flagged</h3>
            <p className="text-sm leading-relaxed">{episode.explanation}</p>
          </div>

          {/* Quality */}
          <div className="bg-gray-800 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-sm text-gray-400 uppercase">Signal Quality</h3>
            <div className="flex items-center justify-between">
              <QualityBadge quality={episode.quality} size="md" />
            </div>
            {qualityIssues.length > 0 && (
              <div className="text-xs text-yellow-400 space-y-1">
                <div className="font-semibold">Issues detected:</div>
                <ul className="list-disc list-inside space-y-0.5">
                  {qualityIssues.map((issue) => (
                    <li key={issue} className="capitalize">
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reason Dialog */}
      {showReasonDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full space-y-4">
            <h3 className="text-xl font-semibold">Deny Episode - Select Reason</h3>

            <div className="space-y-2">
              {REASON_CODES.map((reason) => (
                <button
                  key={reason.code}
                  onClick={() => setSelectedReason(reason.code)}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                    selectedReason === reason.code
                      ? 'border-danger bg-danger/20 text-white'
                      : 'border-gray-600 hover:border-gray-500 text-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{reason.label}</span>
                    <span className="text-xs text-gray-500">Press {reason.key}</span>
                  </div>
                </button>
              ))}
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                rows={3}
                placeholder="Add any additional notes..."
              />
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={confirmDeny}
                disabled={!selectedReason}
                className="flex-1 px-4 py-2 bg-danger text-white rounded-lg hover:bg-danger/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Deny
              </button>
              <button
                onClick={() => {
                  setShowReasonDialog(false);
                  setSelectedReason(null);
                  setNotes('');
                }}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
