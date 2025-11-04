import { useEffect, useState, useCallback } from 'react';
import { useStore } from '../store';
import { generateMockECGData } from '../utils/mockData';
import { loadECGDataForEpisode, isMITBIHEpisode } from '../utils/mitbihData';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ReasonCode } from '../types';

const REASON_CODES: { code: ReasonCode; label: string }[] = [
  { code: 'artifact_noise', label: 'Artifact/Noise' },
  { code: 'sensor_lead_off', label: 'Lead Off' },
  { code: 'ectopy_confounder', label: 'Ectopy/PVC' },
  { code: 'motion', label: 'Motion' },
  { code: 'low_amp', label: 'Low Amplitude' },
  { code: 'other', label: 'Other' },
];

export default function EventReviewClinical() {
  const {
    episodes,
    selectedEpisodeId,
    approveEpisode,
    denyEpisode,
    setCurrentView,
    setSelectedEpisodeId,
  } = useStore();

  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [selectedReason, setSelectedReason] = useState<ReasonCode | null>(null);
  const [notes, setNotes] = useState('');
  const [reviewStartTime, setReviewStartTime] = useState<number>(Date.now());
  const [ecgData, setEcgData] = useState<any>(null);

  const episode = episodes.find((ep) => ep.episode_id === selectedEpisodeId);

  // Load ECG data
  useEffect(() => {
    if (episode) {
      setReviewStartTime(Date.now());

      // Load real MIT-BIH data if available, otherwise use mock data
      if (isMITBIHEpisode(episode)) {
        console.log('Loading real MIT-BIH ECG data for episode:', episode.episode_id);
        loadECGDataForEpisode(episode)
          .then(data => {
            console.log('Loaded ECG data:', {
              samples: data.samples.length,
              fs: data.fs,
              duration: data.duration,
              r_peaks: data.r_peaks?.length || 0
            });
            setEcgData(data);
          })
          .catch(err => {
            console.error('Failed to load MIT-BIH data, falling back to mock:', err);
            const mockData = generateMockECGData(60, 250);
            setEcgData(mockData);
          });
      } else {
        // Use mock data for non-MIT-BIH episodes
        const mockData = generateMockECGData(60, 250);
        setEcgData(mockData);
      }
    }
  }, [episode]);

  const handleApprove = useCallback(() => {
    if (!episode) return;
    const timeSpent = Date.now() - reviewStartTime;
    approveEpisode(episode.episode_id, 'user_1', timeSpent);
  }, [episode, reviewStartTime, approveEpisode]);

  const handleDiscard = useCallback(() => {
    if (!episode) return;
    setShowReasonDialog(true);
  }, [episode]);

  const confirmDiscard = useCallback(() => {
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

  const currentIndex = episodes.findIndex((ep) => ep.episode_id === selectedEpisodeId);

  if (!episode || !ecgData) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  // Group episodes by type
  const episodesByType = episodes.reduce((acc, ep) => {
    const key = ep.status === 'needs_review' ? 'NEEDS_REVIEW' : ep.type.toUpperCase();
    if (!acc[key]) acc[key] = [];
    acc[key].push(ep);
    return acc;
  }, {} as Record<string, typeof episodes>);

  const needsReviewCount = episodes.filter((ep) => ep.status === 'needs_review').length;

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Top Tabs */}
      <div className="bg-white border-b border-gray-300 px-6 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <button className="text-blue-600 font-semibold border-b-2 border-blue-600 pb-2">
            Events
          </button>
          <button className="text-gray-600 hover:text-gray-900 pb-2">Reports</button>
          <button className="text-gray-600 hover:text-gray-900 pb-2">Services</button>
          <button className="text-gray-600 hover:text-gray-900 pb-2">Criteria</button>
        </div>
        <button
          onClick={handleBack}
          className="text-gray-600 hover:text-gray-900 flex items-center space-x-1"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Worklist</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-64 bg-gray-50 border-r border-gray-300 flex flex-col">
          {/* Date Selector */}
          <div className="p-4 border-b border-gray-300">
            <label className="text-xs text-gray-600 block mb-1">HR Trend:</label>
            <input
              type="date"
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              defaultValue={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>

          {/* Summary Stats */}
          <div className="p-4 border-b border-gray-300 bg-white">
            <div className="flex items-center space-x-3 mb-2">
              <button className="text-sm text-gray-700 font-semibold">Summary</button>
              <button className="text-sm text-gray-500">New</button>
              <button className="text-sm text-gray-500">All</button>
              <button className="text-sm text-gray-500">Discarded</button>
            </div>
            <div className="text-2xl font-bold">{episodes.length} events</div>
            <div className="text-sm text-red-600">{needsReviewCount} to review</div>
          </div>

          {/* Event Categories */}
          <div className="flex-1 overflow-y-auto">
            {Object.entries(episodesByType).map(([type, eps]) => (
              <div key={type} className="border-b border-gray-200">
                <div className="px-4 py-2 bg-gray-100 flex items-center justify-between text-sm">
                  <span className="font-semibold">{type}</span>
                  <div className="flex items-center space-x-2 text-xs text-gray-600">
                    <span>{eps.length}</span>
                    <span>{eps.filter((e) => e.status === 'needs_review').length}</span>
                    <span>0</span>
                  </div>
                </div>
                <div className="bg-white">
                  {eps.slice(0, 5).map((ep) => (
                    <button
                      key={ep.episode_id}
                      onClick={() => setSelectedEpisodeId(ep.episode_id)}
                      className={`w-full px-4 py-2 text-left text-xs flex items-center justify-between hover:bg-gray-50 ${
                        ep.episode_id === selectedEpisodeId ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                      }`}
                    >
                      <span>{format(ep.start_ts, 'dd MMM HH:mm:ss a')}</span>
                      <span className="text-gray-400">👤</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-gray-100">
          {/* HR Trend Graph */}
          <div className="bg-white p-4 border-b border-gray-300 h-32">
            <div className="text-xs text-gray-600 mb-2">Heart Rate Trend</div>
            <svg className="w-full h-20" viewBox="0 0 800 80">
              <path
                d="M 0 40 Q 200 30 400 45 T 800 40"
                stroke="#666"
                strokeWidth="1"
                fill="none"
              />
              <line x1="0" y1="0" x2="0" y2="80" stroke="#ddd" strokeWidth="1" />
              <line x1="200" y1="0" x2="200" y2="80" stroke="#ddd" strokeWidth="1" />
              <line x1="400" y1="0" x2="400" y2="80" stroke="#ddd" strokeWidth="1" />
              <line x1="600" y1="0" x2="600" y2="80" stroke="#ddd" strokeWidth="1" />
              <line x1="800" y1="0" x2="800" y2="80" stroke="#ddd" strokeWidth="1" />
            </svg>
          </div>

          {/* Event Header */}
          <div className="bg-pink-100 px-6 py-3 border-b border-pink-200 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="font-semibold text-gray-800">BRADY</span>
              <span className="text-sm text-gray-700">
                {format(episode.start_ts, 'MM/dd/yyyy HH:mm:ss a')} (EST)
              </span>
              <span className="text-sm text-gray-700 font-semibold">
                AVG HR {episode.avg_hr} BPM
              </span>
            </div>
            <button className="text-pink-600 hover:text-pink-800">
              <span className="text-xl">✎</span>
            </button>
          </div>

          {/* ECG Strips */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Lead I */}
            <ECGStrip data={ecgData} label="Lead I" />
            {/* Lead II */}
            <ECGStrip data={ecgData} label="Lead II" />
            {/* Lead III */}
            <ECGStrip data={ecgData} label="Lead III" />
          </div>

          {/* Bottom Controls */}
          <div className="bg-gray-200 border-t border-gray-400 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={moveToPrevious}
                disabled={currentIndex === 0}
                className="p-2 bg-gray-300 rounded hover:bg-gray-400 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">Gain:</span>
                <select className="border border-gray-400 rounded px-2 py-1 text-sm bg-white">
                  <option>10 mm/mV</option>
                  <option>5 mm/mV</option>
                  <option>20 mm/mV</option>
                </select>
              </div>

              <button
                onClick={handleApprove}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 font-semibold text-sm"
              >
                Mark unreviewed
              </button>

              <button
                onClick={handleDiscard}
                className="px-4 py-2 bg-white border border-gray-400 rounded hover:bg-gray-100 text-sm"
              >
                Discard
              </button>

              <button className="p-2 bg-white border border-gray-400 rounded hover:bg-gray-100">
                ▼
              </button>
              <button className="p-2 bg-white border border-gray-400 rounded hover:bg-gray-100">
                ▲
              </button>
            </div>

            <div className="flex items-center space-x-4">
              <button className="text-sm text-gray-600 hover:text-gray-900">Create event</button>
              <button className="text-sm text-gray-600 hover:text-gray-900">Caliper</button>

              <button
                onClick={moveToNext}
                disabled={currentIndex === episodes.length - 1}
                className="p-2 bg-gray-300 rounded hover:bg-gray-400 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Discard Dialog */}
      {showReasonDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-4">
            <h3 className="text-xl font-semibold text-gray-900">Discard Episode - Select Reason</h3>

            <div className="space-y-2">
              {REASON_CODES.map((reason) => (
                <button
                  key={reason.code}
                  onClick={() => setSelectedReason(reason.code)}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                    selectedReason === reason.code
                      ? 'border-red-500 bg-red-50 text-gray-900'
                      : 'border-gray-300 hover:border-gray-400 text-gray-700'
                  }`}
                >
                  {reason.label}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Add any additional notes..."
              />
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={confirmDiscard}
                disabled={!selectedReason}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Discard
              </button>
              <button
                onClick={() => {
                  setShowReasonDialog(false);
                  setSelectedReason(null);
                  setNotes('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
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

// ECG Strip Component
function ECGStrip({ data, label }: { data: any; label: string }) {
  return (
    <div className="bg-white border border-gray-300 rounded">
      <div className="px-3 py-1 bg-gray-50 border-b border-gray-300 text-xs text-gray-600 font-semibold">
        {label}
      </div>
      <div className="p-2" style={{
        backgroundImage: `
          linear-gradient(to right, #f9d5d5 1px, transparent 1px),
          linear-gradient(to bottom, #f9d5d5 1px, transparent 1px),
          linear-gradient(to right, #f5b5b5 1px, transparent 1px),
          linear-gradient(to bottom, #f5b5b5 1px, transparent 1px)
        `,
        backgroundSize: '5px 5px, 5px 5px, 25px 25px, 25px 25px',
        backgroundPosition: '0 0, 0 0, 0 0, 0 0'
      }}>
        <svg className="w-full h-24" viewBox="0 0 1000 100" preserveAspectRatio="none">
          <ECGWaveform samples={data.samples} />
        </svg>
      </div>
    </div>
  );
}

// ECG Waveform Path
function ECGWaveform({ samples }: { samples: Float32Array }) {
  const points: string[] = [];
  const step = Math.floor(samples.length / 1000);

  for (let i = 0; i < 1000; i++) {
    const sampleIdx = Math.min(i * step, samples.length - 1);
    const x = i;
    const y = 50 - samples[sampleIdx] * 15; // Scale and center
    points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
  }

  return <path d={points.join(' ')} stroke="#2d5016" strokeWidth="1.5" fill="none" />;
}
