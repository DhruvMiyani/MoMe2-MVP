import { Episode, ECGData } from '../types';

// Generate mock ECG data
export function generateMockECGData(durationSeconds: number, fs: number = 250): ECGData {
  const numSamples = durationSeconds * fs;
  const samples = new Float32Array(numSamples);
  const r_peaks: number[] = [];
  const hr_series: number[] = [];

  // Generate synthetic ECG with bradycardia episodes
  let phase = 0;
  let rrInterval = fs * 1.2; // Start with ~50 bpm (1.2 sec intervals)

  for (let i = 0; i < numSamples; i++) {
    const t = i / fs;

    // QRS complex (simplified)
    const qrs =
      Math.sin(phase * 20) * Math.exp(-((phase * 10) ** 2)) * 2 +
      Math.sin(phase * 5) * 0.1;

    // P wave
    const pWave = Math.sin(phase * 3 - 2) * Math.exp(-(((phase - 0.6) * 15) ** 2)) * 0.3;

    // T wave
    const tWave = Math.sin(phase * 2 + 1) * Math.exp(-(((phase - 0.4) * 8) ** 2)) * 0.4;

    // Baseline wander
    const baseline = Math.sin(t * 0.5) * 0.1;

    // Small noise
    const noise = (Math.random() - 0.5) * 0.05;

    samples[i] = qrs + pWave + tWave + baseline + noise;

    // Detect R-peaks
    if (phase < 0.05 && i > 0 && samples[i] > samples[i - 1]) {
      r_peaks.push(i);
      if (r_peaks.length > 1) {
        const lastRR = i - r_peaks[r_peaks.length - 2];
        const hr = (60 * fs) / lastRR;
        hr_series.push(hr);
      }
    }

    // Update phase
    phase += 1 / rrInterval;
    if (phase >= 1) {
      phase = 0;
      // Vary RR interval to simulate bradycardia/normal
      if (Math.random() > 0.7) {
        rrInterval = fs * (0.9 + Math.random() * 0.6); // 40-67 bpm
      } else {
        rrInterval = fs * (0.8 + Math.random() * 0.3); // 55-75 bpm
      }
    }
  }

  return { samples, fs, r_peaks, hr_series };
}

// Generate mock episodes
export function generateMockEpisodes(count: number = 20): Episode[] {
  const episodes: Episode[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const startTime = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
    const duration = 10 + Math.random() * 30; // 10-40 seconds
    const endTime = new Date(startTime.getTime() + duration * 1000);
    const confidence = Math.random();

    const status =
      confidence >= 0.8 && Math.random() > 0.2
        ? 'auto_approved'
        : confidence < 0.8
        ? 'needs_review'
        : Math.random() > 0.5
        ? 'approved'
        : 'denied';

    const minHr = 35 + Math.random() * 25; // 35-60 bpm
    const avgHr = minHr + Math.random() * 5;

    episodes.push({
      episode_id: `ep_${i + 1}`,
      recording_id: `rec_${Math.floor(Math.random() * 100)}`,
      type: 'brady',
      start_ts: startTime,
      end_ts: endTime,
      start_sample: Math.floor(Math.random() * 10000),
      end_sample: Math.floor(Math.random() * 10000) + 2500,
      min_hr: Math.round(minHr),
      avg_hr: Math.round(avgHr),
      quality: {
        baseline_wander: Math.random() > 0.8,
        lead_off: Math.random() > 0.95,
        clipping: Math.random() > 0.9,
        high_noise: Math.random() > 0.7,
        motion_artifact: Math.random() > 0.75,
        low_amplitude: Math.random() > 0.85,
      },
      model_conf: confidence,
      explanation: `Mean HR ${Math.round(avgHr)} bpm for ${Math.round(
        duration
      )} s; stable R-R intervals; ${
        confidence > 0.8 ? 'low noise' : 'moderate noise'
      }.`,
      status,
    });
  }

  return episodes.sort((a, b) => a.model_conf - b.model_conf); // Sort by confidence ascending
}
