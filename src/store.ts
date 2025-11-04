import { create } from 'zustand';
import { Episode, Review, ECGData } from './types';

interface AppState {
  // Current view
  currentView: 'worklist' | 'review' | 'analytics';
  setCurrentView: (view: 'worklist' | 'review' | 'analytics') => void;

  // Episodes
  episodes: Episode[];
  setEpisodes: (episodes: Episode[]) => void;
  selectedEpisodeId: string | null;
  setSelectedEpisodeId: (id: string | null) => void;

  // ECG Data
  ecgData: ECGData | null;
  setEcgData: (data: ECGData | null) => void;

  // Reviews
  reviews: Review[];
  addReview: (review: Review) => void;

  // Filters
  showOnlyNeedsReview: boolean;
  setShowOnlyNeedsReview: (show: boolean) => void;
  minConfidence: number;
  maxConfidence: number;
  setConfidenceRange: (min: number, max: number) => void;

  // Actions
  approveEpisode: (episodeId: string, reviewerId: string, timeMs: number) => void;
  denyEpisode: (
    episodeId: string,
    reviewerId: string,
    timeMs: number,
    reasonCode?: string,
    notes?: string
  ) => void;
}

export const useStore = create<AppState>((set, get) => ({
  // View state
  currentView: 'worklist',
  setCurrentView: (view) => set({ currentView: view }),

  // Episodes
  episodes: [],
  setEpisodes: (episodes) => set({ episodes }),
  selectedEpisodeId: null,
  setSelectedEpisodeId: (id) => set({ selectedEpisodeId: id }),

  // ECG Data
  ecgData: null,
  setEcgData: (data) => set({ ecgData: data }),

  // Reviews
  reviews: [],
  addReview: (review) => set({ reviews: [...get().reviews, review] }),

  // Filters
  showOnlyNeedsReview: false,
  setShowOnlyNeedsReview: (show) => set({ showOnlyNeedsReview: show }),
  minConfidence: 0,
  maxConfidence: 1,
  setConfidenceRange: (min, max) => set({ minConfidence: min, maxConfidence: max }),

  // Actions
  approveEpisode: (episodeId, reviewerId, timeMs) => {
    const review: Review = {
      review_id: `review_${Date.now()}`,
      episode_id: episodeId,
      reviewer_id: reviewerId,
      action: 'approve',
      timestamp: new Date(),
      time_ms: timeMs,
    };

    set({
      episodes: get().episodes.map((ep) =>
        ep.episode_id === episodeId ? { ...ep, status: 'approved' } : ep
      ),
      reviews: [...get().reviews, review],
    });
  },

  denyEpisode: (episodeId, reviewerId, timeMs, reasonCode, notes) => {
    const review: Review = {
      review_id: `review_${Date.now()}`,
      episode_id: episodeId,
      reviewer_id: reviewerId,
      action: 'deny',
      reason_code: reasonCode as any,
      notes,
      timestamp: new Date(),
      time_ms: timeMs,
    };

    set({
      episodes: get().episodes.map((ep) =>
        ep.episode_id === episodeId ? { ...ep, status: 'denied' } : ep
      ),
      reviews: [...get().reviews, review],
    });
  },
}));
