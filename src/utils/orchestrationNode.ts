/**
 * Orchestration Node - Multi-Arrhythmia Detection
 * Coordinates detection of multiple arrhythmia types from MIT-BIH records
 */

import { MITBIHRecord, BradycardiaSegment } from './mitbih';

export interface TachycardiaSegment {
  recordName: string;
  startSample: number;
  endSample: number;
  startTime: number;
  endTime: number;
  maxHR: number;
  avgHR: number;
  duration: number;
}

export interface VTacSegment {
  recordName: string;
  startSample: number;
  endSample: number;
  startTime: number;
  endTime: number;
  vBeats: number;
  duration: number;
}

export interface AFibSegment {
  recordName: string;
  startSample: number;
  endSample: number;
  startTime: number;
  endTime: number;
  irregularityScore: number;
  duration: number;
}

export interface PACDetection {
  total_pacs: number;
  pac_annotations: Array<{ sample: number; time: number; type: string }>;
}

export interface DetectionResult {
  recordName: string;
  detections: {
    bradycardia: BradycardiaSegment[];
    tachycardia: TachycardiaSegment[];
    pac: PACDetection;
    vtac: VTacSegment[];
    afib: AFibSegment[];
  };
}

/**
 * Detect tachycardia segments (HR > 100 bpm)
 */
function detectTachycardiaSegments(record: MITBIHRecord): TachycardiaSegment[] {
  const segments: TachycardiaSegment[] = [];
  const fs = record.fs;

  // Get R-peak annotations
  const rpeaks = record.annotations
    .filter(ann => ['N', 'L', 'R', 'B', 'A', 'a', 'J', 'S', 'V', 'r', 'F', 'e', 'j', 'n', 'E', '/'].includes(ann.type))
    .map(ann => ann.sample);

  if (rpeaks.length < 2) return segments;

  // Calculate instantaneous heart rate
  const heartRates: { sample: number; hr: number }[] = [];
  for (let i = 0; i < rpeaks.length - 1; i++) {
    const rrInterval = (rpeaks[i + 1] - rpeaks[i]) / fs;
    const hr = 60 / rrInterval;
    heartRates.push({ sample: rpeaks[i], hr });
  }

  // Find tachycardia segments (HR > 100 bpm)
  let segmentStart: number | null = null;
  let segmentHRs: number[] = [];

  for (let i = 0; i < heartRates.length; i++) {
    const { sample, hr } = heartRates[i];

    if (hr > 100) {
      if (segmentStart === null) {
        segmentStart = sample;
        segmentHRs = [hr];
      } else {
        segmentHRs.push(hr);
      }
    } else {
      if (segmentStart !== null && segmentHRs.length >= 4) {
        const endSample = sample;
        const maxHR = Math.max(...segmentHRs);
        const avgHR = segmentHRs.reduce((a, b) => a + b, 0) / segmentHRs.length;
        const duration = (endSample - segmentStart) / fs;

        if (duration >= 3.0) {
          segments.push({
            recordName: record.recordName,
            startSample: segmentStart,
            endSample: endSample,
            startTime: segmentStart / fs,
            endTime: endSample / fs,
            maxHR: Math.round(maxHR),
            avgHR: Math.round(avgHR),
            duration,
          });
        }
      }
      segmentStart = null;
      segmentHRs = [];
    }
  }

  // Handle end of record
  if (segmentStart !== null && segmentHRs.length >= 4) {
    const endSample = rpeaks[rpeaks.length - 1];
    const maxHR = Math.max(...segmentHRs);
    const avgHR = segmentHRs.reduce((a, b) => a + b, 0) / segmentHRs.length;
    const duration = (endSample - segmentStart) / fs;

    if (duration >= 3.0) {
      segments.push({
        recordName: record.recordName,
        startSample: segmentStart,
        endSample: endSample,
        startTime: segmentStart / fs,
        endTime: endSample / fs,
        maxHR: Math.round(maxHR),
        avgHR: Math.round(avgHR),
        duration,
      });
    }
  }

  return segments;
}

/**
 * Detect bradycardia segments (HR < 60 bpm)
 */
function detectBradycardiaSegments(record: MITBIHRecord): BradycardiaSegment[] {
  const segments: BradycardiaSegment[] = [];
  const fs = record.fs;

  const rpeaks = record.annotations
    .filter(ann => ['N', 'L', 'R', 'B', 'A', 'a', 'J', 'S', 'V', 'r', 'F', 'e', 'j', 'n', 'E', '/'].includes(ann.type))
    .map(ann => ann.sample);

  if (rpeaks.length < 2) return segments;

  const heartRates: { sample: number; hr: number }[] = [];
  for (let i = 0; i < rpeaks.length - 1; i++) {
    const rrInterval = (rpeaks[i + 1] - rpeaks[i]) / fs;
    const hr = 60 / rrInterval;
    heartRates.push({ sample: rpeaks[i], hr });
  }

  let segmentStart: number | null = null;
  let segmentHRs: number[] = [];

  for (let i = 0; i < heartRates.length; i++) {
    const { sample, hr } = heartRates[i];

    if (hr < 60) {
      if (segmentStart === null) {
        segmentStart = sample;
        segmentHRs = [hr];
      } else {
        segmentHRs.push(hr);
      }
    } else {
      if (segmentStart !== null && segmentHRs.length >= 4) {
        const endSample = sample;
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
            duration,
          });
        }
      }
      segmentStart = null;
      segmentHRs = [];
    }
  }

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
        duration,
      });
    }
  }

  return segments;
}

/**
 * Detect Premature Atrial Contractions (PACs)
 */
function detectPAC(record: MITBIHRecord): PACDetection {
  const fs = record.fs;

  // PACs are annotated as 'A' (atrial premature) or 'a' (aberrated atrial premature)
  const pacAnnotations = record.annotations
    .filter(ann => ann.type === 'A' || ann.type === 'a')
    .map(ann => ({
      sample: ann.sample,
      time: ann.sample / fs,
      type: ann.type,
    }));

  return {
    total_pacs: pacAnnotations.length,
    pac_annotations: pacAnnotations,
  };
}

/**
 * Detect Ventricular Tachycardia (VTac) segments
 */
function detectVTac(record: MITBIHRecord): VTacSegment[] {
  const segments: VTacSegment[] = [];
  const fs = record.fs;

  // VTac is identified by consecutive V (ventricular) beats
  const vBeats = record.annotations.filter(ann => ann.type === 'V');

  if (vBeats.length < 3) return segments; // Need at least 3 consecutive V beats

  // Group consecutive V beats
  let segmentStart: number | null = null;
  let vBeatCount = 0;
  let lastSample = -1;

  for (let i = 0; i < vBeats.length; i++) {
    const currentSample = vBeats[i].sample;

    // Check if this V beat is close to the previous one (within ~2 seconds)
    if (lastSample === -1 || (currentSample - lastSample) / fs < 2.0) {
      if (segmentStart === null) {
        segmentStart = currentSample;
      }
      vBeatCount++;
      lastSample = currentSample;
    } else {
      // Gap detected, save previous segment if valid
      if (segmentStart !== null && vBeatCount >= 3) {
        segments.push({
          recordName: record.recordName,
          startSample: segmentStart,
          endSample: lastSample,
          startTime: segmentStart / fs,
          endTime: lastSample / fs,
          vBeats: vBeatCount,
          duration: (lastSample - segmentStart) / fs,
        });
      }
      segmentStart = currentSample;
      vBeatCount = 1;
      lastSample = currentSample;
    }
  }

  // Handle final segment
  if (segmentStart !== null && vBeatCount >= 3) {
    segments.push({
      recordName: record.recordName,
      startSample: segmentStart,
      endSample: lastSample,
      startTime: segmentStart / fs,
      endTime: lastSample / fs,
      vBeats: vBeatCount,
      duration: (lastSample - segmentStart) / fs,
    });
  }

  return segments;
}

/**
 * Detect Atrial Fibrillation (AFib) segments
 */
function detectAFib(record: MITBIHRecord): AFibSegment[] {
  const segments: AFibSegment[] = [];
  const fs = record.fs;

  // AFib is characterized by irregular RR intervals
  const rpeaks = record.annotations
    .filter(ann => ['N', 'L', 'R', 'B', 'A', 'a', 'J', 'S', 'V', 'r', 'F', 'e', 'j', 'n', 'E', '/'].includes(ann.type))
    .map(ann => ann.sample);

  if (rpeaks.length < 10) return segments;

  // Calculate RR intervals
  const rrIntervals: number[] = [];
  for (let i = 0; i < rpeaks.length - 1; i++) {
    rrIntervals.push((rpeaks[i + 1] - rpeaks[i]) / fs);
  }

  // Detect irregular segments using coefficient of variation
  const windowSize = 10; // beats
  for (let i = 0; i < rrIntervals.length - windowSize; i++) {
    const window = rrIntervals.slice(i, i + windowSize);
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    const variance = window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / window.length;
    const stdDev = Math.sqrt(variance);
    const coeffVariation = stdDev / mean;

    // AFib typically has coefficient of variation > 0.15
    if (coeffVariation > 0.15) {
      const startSample = rpeaks[i];
      const endSample = rpeaks[i + windowSize];
      const duration = (endSample - startSample) / fs;

      // Only add if duration is significant (> 5 seconds)
      if (duration > 5.0) {
        segments.push({
          recordName: record.recordName,
          startSample,
          endSample,
          startTime: startSample / fs,
          endTime: endSample / fs,
          irregularityScore: Math.round(coeffVariation * 100) / 100,
          duration,
        });
      }
    }
  }

  // Merge overlapping segments
  const merged: AFibSegment[] = [];
  for (const segment of segments) {
    if (merged.length === 0) {
      merged.push(segment);
    } else {
      const last = merged[merged.length - 1];
      if (segment.startTime <= last.endTime) {
        // Merge
        last.endSample = Math.max(last.endSample, segment.endSample);
        last.endTime = last.endSample / fs;
        last.duration = last.endTime - last.startTime;
        last.irregularityScore = Math.max(last.irregularityScore, segment.irregularityScore);
      } else {
        merged.push(segment);
      }
    }
  }

  return merged;
}

/**
 * Orchestrate detection of all arrhythmia types
 */
export async function orchestrateDetection(record: MITBIHRecord): Promise<DetectionResult> {
  console.log(`Orchestrating detection for record ${record.recordName}...`);

  const bradycardia = detectBradycardiaSegments(record);
  const tachycardia = detectTachycardiaSegments(record);
  const pac = detectPAC(record);
  const vtac = detectVTac(record);
  const afib = detectAFib(record);

  return {
    recordName: record.recordName,
    detections: {
      bradycardia,
      tachycardia,
      pac,
      vtac,
      afib,
    },
  };
}
