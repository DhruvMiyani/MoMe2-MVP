export interface Recording {
  recording_id: string;
  patient_ref: string;
  leads: string[];
  fs: number; // Sampling frequency
  start_ts: Date;
  duration_s: number;
}

export interface Episode {
  episode_id: string;
  recording_id: string;
  type: 'brady';
  start_ts: Date;
  end_ts: Date;
  start_sample: number;
  end_sample: number;
  min_hr: number;
  avg_hr: number;
  quality: QualityFlags;
  model_conf: number; // 0-1
  explanation: string;
  status: 'auto_approved' | 'needs_review' | 'approved' | 'denied';
}

export interface QualityFlags {
  baseline_wander: boolean;
  lead_off: boolean;
  clipping: boolean;
  high_noise: boolean;
  motion_artifact: boolean;
  low_amplitude: boolean;
}

export type ReasonCode =
  | 'artifact_noise'
  | 'sensor_lead_off'
  | 'ectopy_confounder'
  | 'low_amp'
  | 'motion'
  | 'other';

export interface Review {
  review_id: string;
  episode_id: string;
  reviewer_id: string;
  action: 'approve' | 'deny';
  reason_code?: ReasonCode;
  notes?: string;
  timestamp: Date;
  time_ms: number; // Time spent reviewing
}

export interface ECGData {
  samples: Float32Array;
  fs: number;
  r_peaks: number[]; // Sample indices
  hr_series?: number[]; // Heart rate at each R-peak
}

export interface ConfidenceLevel {
  score: number; // 0-1
  label: 'uncertain' | 'borderline' | 'well_calibrated';
}
