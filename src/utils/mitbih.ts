/**
 * MIT-BIH Arrhythmia Database Loader
 *
 * The MIT-BIH Arrhythmia Database contains 48 half-hour excerpts of two-channel
 * ambulatory ECG recordings, obtained from 47 subjects studied by the BIH
 * Arrhythmia Laboratory between 1975 and 1979. The recordings were digitized
 * at 360 samples per second per channel with 11-bit resolution.
 *
 * Original format: .dat (waveform), .hea (header), .atr (annotations)
 * For web use: pre-converted to JSON format
 */

export interface MITBIHAnnotation {
  sample: number;        // Sample number
  type: string;          // Annotation type (N=Normal, V=PVC, etc.)
  subtype?: string;      // Optional subtype
  chan?: number;         // Channel (0 or 1)
  num?: number;          // Annotation number
}

export interface MITBIHRecord {
  recordName: string;    // e.g., "100", "231"
  fs: number;            // Sampling frequency (360 Hz for MIT-BIH)
  length: number;        // Total samples
  channels: number;      // Number of channels (usually 2: MLII and V1)
  channelNames: string[];// Channel names
  adcGain: number[];     // ADC gain for each channel (usually 200 ADU/mV)
  baseline: number[];    // Baseline value for each channel
  units: string[];       // Units for each channel (usually "mV")
  comments: string[];    // Comments from header file

  // ECG data for each channel (in mV after conversion)
  signals: {
    MLII: Float32Array;  // Modified Limb Lead II (primary)
    V1?: Float32Array;   // Precordial Lead V1 (secondary)
  };

  // Annotations (R-peaks, arrhythmias, etc.)
  annotations: MITBIHAnnotation[];
}

export interface BradycardiaSegment {
  recordName: string;
  startSample: number;
  endSample: number;
  startTime: number;     // seconds
  endTime: number;       // seconds
  minHR: number;
  avgHR: number;
  duration: number;      // seconds
}

/**
 * Load a MIT-BIH record from pre-converted JSON data
 */
export async function loadMITBIHRecord(recordName: string): Promise<MITBIHRecord> {
  try {
    // In production, this would fetch from a server or load from local files
    // For now, we'll use dynamically imported sample data
    const response = await fetch(`/data/mitbih/${recordName}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load record ${recordName}`);
    }

    const data = await response.json();

    // Convert arrays to Float32Array for performance
    return {
      ...data,
      signals: {
        MLII: new Float32Array(data.signals.MLII),
        V1: data.signals.V1 ? new Float32Array(data.signals.V1) : undefined,
      },
    };
  } catch (error) {
    console.error(`Error loading MIT-BIH record ${recordName}:`, error);
    throw error;
  }
}

/**
 * Detect bradycardia segments in a MIT-BIH record
 * Bradycardia is defined as heart rate < 60 bpm
 */
export function detectBradycardiaSegments(record: MITBIHRecord): BradycardiaSegment[] {
  const segments: BradycardiaSegment[] = [];
  const fs = record.fs;

  // Get R-peak annotations (type 'N' for normal beats)
  const rpeaks = record.annotations
    .filter(ann => ['N', 'L', 'R', 'B', 'A', 'a', 'J', 'S', 'V', 'r', 'F', 'e', 'j', 'n', 'E', '/'].includes(ann.type))
    .map(ann => ann.sample);

  console.log(`Record ${record.recordName}: Found ${rpeaks.length} R-peaks in ${record.annotations.length} total annotations`);

  if (rpeaks.length < 2) {
    console.warn(`Record ${record.recordName}: Not enough R-peaks for analysis`);
    return segments;
  }

  // Calculate instantaneous heart rate between consecutive R-peaks
  const heartRates: { sample: number; hr: number }[] = [];
  for (let i = 0; i < rpeaks.length - 1; i++) {
    const rrInterval = (rpeaks[i + 1] - rpeaks[i]) / fs; // seconds
    const hr = 60 / rrInterval; // bpm
    heartRates.push({
      sample: rpeaks[i],
      hr: hr,
    });
  }

  // Find clinically significant bradycardia segments
  // Criteria:
  // - HR < 60 bpm (standard clinical definition)
  // - Sustained for at least 4 consecutive beats (~4 seconds minimum)
  // - Duration at least 3 seconds (meaningful episode, not transient)
  let segmentStart: number | null = null;
  let segmentHRs: number[] = [];

  for (let i = 0; i < heartRates.length; i++) {
    const { sample, hr } = heartRates[i];

    // Standard threshold: HR < 60 bpm
    if (hr < 60) {
      if (segmentStart === null) {
        segmentStart = sample;
        segmentHRs = [hr];
      } else {
        segmentHRs.push(hr);
      }
    } else {
      // End of potential bradycardia segment
      if (segmentStart !== null && segmentHRs.length >= 4) {
        // Require at least 4 consecutive beats (sustained episode)
        const endSample = sample;
        const minHR = Math.min(...segmentHRs);
        const avgHR = segmentHRs.reduce((a, b) => a + b, 0) / segmentHRs.length;
        const duration = (endSample - segmentStart) / fs;

        // Only add if duration is at least 3 seconds (clinically meaningful)
        if (duration >= 3.0) {
          segments.push({
            recordName: record.recordName,
            startSample: segmentStart,
            endSample: endSample,
            startTime: segmentStart / fs,
            endTime: endSample / fs,
            minHR: Math.round(minHR),
            avgHR: Math.round(avgHR),
            duration: duration,
          });
        }
      }
      segmentStart = null;
      segmentHRs = [];
    }
  }

  // Handle case where record ends in bradycardia
  if (segmentStart !== null && segmentHRs.length >= 4) {
    const endSample = rpeaks[rpeaks.length - 1];
    const minHR = Math.min(...segmentHRs);
    const avgHR = segmentHRs.reduce((a, b) => a + b, 0) / segmentHRs.length;
    const duration = (endSample - segmentStart) / fs;

    if (duration >= 3.0) {
      segments.push({
        recordName: record.recordName,
        startSample: segmentStart,
        endSample: endSample,
        startTime: segmentStart / fs,
        endTime: endSample / fs,
        minHR: Math.round(minHR),
        avgHR: Math.round(avgHR),
        duration: duration,
      });
    }
  }

  console.log(`Record ${record.recordName}: Detected ${segments.length} bradycardia segments`);

  return segments;
}

/**
 * Extract ECG segment from a MIT-BIH record
 */
export function extractSegment(
  record: MITBIHRecord,
  startSample: number,
  endSample: number,
  channel: 'MLII' | 'V1' = 'MLII'
): Float32Array {
  const signal = record.signals[channel];
  if (!signal) {
    throw new Error(`Channel ${channel} not found in record`);
  }

  const start = Math.max(0, startSample);
  const end = Math.min(signal.length, endSample);

  return signal.slice(start, end);
}

/**
 * Get R-peaks within a specific segment
 */
export function getSegmentRPeaks(
  record: MITBIHRecord,
  startSample: number,
  endSample: number
): number[] {
  return record.annotations
    .filter(ann =>
      ['N', 'L', 'R', 'B', 'A', 'a', 'J', 'S', 'V', 'r', 'F', 'e', 'j', 'n', 'E', '/'].includes(ann.type) &&
      ann.sample >= startSample &&
      ann.sample <= endSample
    )
    .map(ann => ann.sample - startSample); // Relative to segment start
}

/**
 * Convert MIT-BIH data to our ECGData format
 */
export function convertToECGData(
  record: MITBIHRecord,
  startSample: number,
  endSample: number
): {
  samples: Float32Array;
  fs: number;
  duration: number;
  r_peaks: number[];
  hr_series: number[];
} {
  const samples = extractSegment(record, startSample, endSample, 'MLII');
  const r_peaks = getSegmentRPeaks(record, startSample, endSample);
  const duration = samples.length / record.fs;

  // Calculate heart rate series from R-peaks
  const hr_series: number[] = [];
  for (let i = 0; i < r_peaks.length - 1; i++) {
    const rrInterval = (r_peaks[i + 1] - r_peaks[i]) / record.fs; // seconds
    const hr = 60 / rrInterval; // bpm
    hr_series.push(hr);
  }
  // Add the last HR value (duplicate the previous one for consistency)
  if (hr_series.length > 0) {
    hr_series.push(hr_series[hr_series.length - 1]);
  }

  return {
    samples,
    fs: record.fs,
    duration,
    r_peaks,
    hr_series,
  };
}
