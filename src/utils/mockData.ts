import { Episode, ECGData } from '../types';

// Generate demo ECG data with specific pattern: Normal → Brady → Recovery
// Based on exact physiologic schedule:
// - Normal sinus: 0-10s, ~78 bpm, R-R 0.77±0.03s, 13 beats
// - Bradycardia: 10-22s, ~45 bpm, R-R 1.33±0.04s, 9 beats
// - Recovery: 22-27s, ~70 bpm, R-R 0.86±0.03s, 6 beats
export function generateDemoECGData(durationSeconds: number = 27, fs: number = 360): ECGData {
  const numSamples = durationSeconds * fs;
  const samples = new Float32Array(numSamples);
  const r_peaks: number[] = [];
  const hr_series: number[] = [];

  // Box-Muller transform for normal distribution
  function randomNormal(mean: number, stdDev: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stdDev;
  }

  // Generate R-R intervals with realistic jitter
  const rrIntervals: number[] = [];

  // Normal sinus: 13 beats, R-R = 0.77 ± 0.03s
  for (let i = 0; i < 13; i++) {
    rrIntervals.push(randomNormal(0.77, 0.03));
  }

  // Bradycardia: 9 beats, R-R = 1.33 ± 0.04s
  for (let i = 0; i < 9; i++) {
    rrIntervals.push(randomNormal(1.33, 0.04));
  }

  // Recovery: 6 beats, R-R = 0.86 ± 0.03s
  for (let i = 0; i < 6; i++) {
    rrIntervals.push(randomNormal(0.86, 0.03));
  }

  // Convert R-R intervals to cumulative beat times
  let currentTime = 0;
  const beatTimes: number[] = [currentTime];
  for (const rr of rrIntervals) {
    currentTime += Math.max(0.4, rr); // Clamp minimum RR to 0.4s (150 bpm max)
    beatTimes.push(currentTime);
  }

  // Generate ECG waveform for each beat
  let sampleIdx = 0;

  for (let beatIdx = 0; beatIdx < beatTimes.length && sampleIdx < numSamples; beatIdx++) {
    const beatStartTime = beatTimes[beatIdx];
    const beatStartSample = Math.floor(beatStartTime * fs);

    // Skip to beat start time
    while (sampleIdx < beatStartSample && sampleIdx < numSamples) {
      samples[sampleIdx] = (Math.random() - 0.5) * 0.02; // Baseline noise
      sampleIdx++;
    }

    if (sampleIdx >= numSamples) break;

    // Determine beat characteristics based on phase
    let pAmp, qrsAmp, tAmp, noiseSigma;
    if (beatStartTime < 10) {
      // Normal sinus
      pAmp = 0.10 + Math.random() * 0.05;
      qrsAmp = 0.9 + Math.random() * 0.4;
      tAmp = 0.25 + Math.random() * 0.15;
      noiseSigma = 0.015 + Math.random() * 0.005;
    } else if (beatStartTime < 22) {
      // Bradycardia
      pAmp = 0.08 + Math.random() * 0.04;
      qrsAmp = 0.8 + Math.random() * 0.3;
      tAmp = 0.20 + Math.random() * 0.15;
      noiseSigma = 0.015 + Math.random() * 0.01;
    } else {
      // Recovery
      pAmp = 0.10 + Math.random() * 0.04;
      qrsAmp = 0.9 + Math.random() * 0.3;
      tAmp = 0.25 + Math.random() * 0.15;
      noiseSigma = 0.015 + Math.random() * 0.005;
    }

    // Get RR interval for this beat
    const rrSamples = beatIdx < rrIntervals.length
      ? Math.floor(rrIntervals[beatIdx] * fs)
      : Math.floor(0.86 * fs);

    // Record R-peak position
    const rPeakOffset = Math.floor(rrSamples * 0.05);
    r_peaks.push(beatStartSample + rPeakOffset);

    // Calculate HR for this beat
    if (r_peaks.length > 1) {
      const lastRR = (r_peaks[r_peaks.length - 1] - r_peaks[r_peaks.length - 2]) / fs;
      const hr = 60 / lastRR;
      hr_series.push(hr);
    }

    // Generate one heartbeat waveform
    for (let i = 0; i < rrSamples && sampleIdx < numSamples; i++) {
      const phase = i / rrSamples;

      // P wave (at ~80% through previous RR)
      const pPhase = (phase - 0.8) * 30;
      const pWave = pAmp * Math.sin(pPhase * 10) * Math.exp(-(pPhase ** 2));

      // QRS complex (at ~5% into beat)
      const qrsPhase = (phase - 0.05) * 40;
      const qrs = qrsAmp * Math.sin(qrsPhase * 20) * Math.exp(-(qrsPhase ** 2));

      // T wave (at ~35% into beat)
      const tPhase = (phase - 0.35) * 15;
      const tWave = tAmp * Math.sin(tPhase * 8) * Math.exp(-(tPhase ** 2));

      // Baseline wander
      const baseline = Math.sin(sampleIdx / fs * 0.5) * 0.03;

      // Noise
      const noise = (Math.random() - 0.5) * noiseSigma * 2;

      samples[sampleIdx] = pWave + qrs + tWave + baseline + noise;
      sampleIdx++;
    }
  }

  // Fill remaining samples with baseline noise
  while (sampleIdx < numSamples) {
    samples[sampleIdx] = (Math.random() - 0.5) * 0.02;
    sampleIdx++;
  }

  // Add final HR value
  if (hr_series.length > 0 && r_peaks.length > hr_series.length) {
    hr_series.push(hr_series[hr_series.length - 1]);
  }

  return { samples, fs, r_peaks, hr_series };
}

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
