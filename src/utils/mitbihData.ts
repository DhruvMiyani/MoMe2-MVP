/**
 * MIT-BIH Data Integration
 * Generates episodes from real MIT-BIH Arrhythmia Database records
 */

import { Episode, ECGData, QualityFlags } from '../types';
import { loadMITBIHRecord, detectBradycardiaSegments, convertToECGData } from './mitbih';
import { generateLLMExplanation, formatExplanation } from './explainabilityAgent';
import { orchestrateDetection, DetectionResult } from './orchestrationNode';

// TOP 10 patients with most bradycardia (sorted by bradycardia beat count)
const MITBIH_PATIENTS = ['117', '124', '123', '108', '113', '202', '121', '201', '106', '114'];

// All available patient records - PRIORITIZED by arrhythmia diversity
// First 15 records have the best examples of each arrhythmia type
const ALL_MITBIH_PATIENTS = [
  // VTac-rich records (high V beat count)
  '200', // VTac: 826 V beats (most VTac episodes)
  '208', // VTac: 992 V beats + 373 fusion beats (sustained VTac)
  '207', // VTac: 105 V beats with bundle branch blocks

  // PAC-rich records (high A beat count)
  '209', // PAC: 383 A beats (most PAC episodes)
  '100', // PAC: 33 A beats (clean PAC examples)

  // AFib candidates (mixed rhythm, a-beats, irregularity)
  '201', // AFib: 97 'a' beats, mixed rhythm
  '203', // AFib: irregular rhythm
  '210', // AFib: 22 'a' beats

  // Bradycardia records
  '117', // Bradycardia
  '124', // Bradycardia
  '123', // Bradycardia

  // Mixed arrhythmias
  '221', // VTac + PACs: 396 V beats
  '217', // VTac + AFib: 162 V beats, paced rhythm
  '219', // VTac + AFib
  '222', // PACs

  // Additional records
  '106', // Bradycardia
  '108', // Bradycardia
  '113', // Bradycardia
  '114', // Bradycardia
  '119', // PACs, sinus arrhythmia
  '121', // Bradycardia
  '202', // Bradycardia
  '213', // VTac, fusion beats
  '214', // VTac
  '215', // VTac
  '223', // VTac
  '228', // VTac
  '231', // AV block
  '233', // VTac
];

/**
 * Get quality flags from signal analysis
 * NOTE: MIT-BIH database does not include quality annotations
 * In production, these would come from a real-time signal quality analyzer
 * For now, we assume good quality since MIT-BIH is a curated research database
 */
function getQualityFlags(): QualityFlags {
  // MIT-BIH is a high-quality curated database with no quality issues
  return {
    baseline_wander: false,
    lead_off: false,
    clipping: false,
    high_noise: false,
    motion_artifact: false,
    low_amplitude: false,
  };
}

/**
 * Create explanation based on real detected bradycardia metrics
 */
function createExplanation(avgHR: number, minHR: number, quality: QualityFlags): string {
  const reasons: string[] = [];

  // Classification based on actual measured heart rate
  if (minHR < 40) {
    reasons.push(`Severe bradycardia detected (min HR: ${minHR} bpm)`);
  } else if (minHR < 50) {
    reasons.push(`Moderate bradycardia detected (min HR: ${minHR} bpm)`);
  } else {
    reasons.push(`Mild bradycardia detected (min HR: ${minHR} bpm)`);
  }

  if (avgHR < 50) {
    reasons.push(`sustained low average heart rate (${avgHR} bpm)`);
  }

  // Only add quality issues if actually present in the data
  if (quality.baseline_wander) {
    reasons.push('with baseline wander present');
  }
  if (quality.high_noise) {
    reasons.push('elevated noise levels observed');
  }

  return reasons.join(', ') + '.';
}

/**
 * Determine episode status based on severity
 * NOTE: MIT-BIH does not include confidence scores
 * Status is determined by bradycardia severity and data quality
 */
function determineStatus(
  minHR: number,
  quality: QualityFlags
): 'auto_approved' | 'needs_review' {
  const hasQualityIssues = Object.values(quality).some((v) => v);

  // All bradycardia episodes need review in clinical setting
  // MIT-BIH is research data, so we flag all for review
  return 'needs_review';
}

/**
 * Load MIT-BIH episodes from real data
 * @param maxEpisodes Maximum number of episodes to load
 * @param loadAll If true, loads all 6 patients; if false, loads only 3 high-bradycardia patients
 * @param useLLMExplanations If true, uses GPT-4 to generate clinical explanations (requires API key)
 */
export async function loadMITBIHEpisodes(
  maxEpisodes: number = 25,
  loadAll: boolean = false,
  useLLMExplanations: boolean = false
): Promise<Episode[]> {
  const episodes: Episode[] = [];
  const recordsToUse = loadAll ? ALL_MITBIH_PATIENTS : MITBIH_PATIENTS;

  console.log(`Loading MIT-BIH records for ${recordsToUse.length} patients${loadAll ? ' (ALL)' : ' (high bradycardia)'}...`);

  for (const recordName of recordsToUse) {
    if (episodes.length >= maxEpisodes && !loadAll) break;

    try {
      console.log(`Loading record ${recordName}...`);
      const record = await loadMITBIHRecord(recordName);

      // Run orchestration to detect ALL arrhythmia types
      const detectionResult = await orchestrateDetection(record);

      console.log(`  Orchestration complete for ${recordName}:`);
      console.log(`    - Bradycardia: ${detectionResult.detections.bradycardia.length} segments`);
      console.log(`    - Tachycardia: ${detectionResult.detections.tachycardia.length} segments`);
      console.log(`    - PAC: ${detectionResult.detections.pac?.total_pacs || 0} events`);
      console.log(`    - VTac: ${detectionResult.detections.vtac.length} segments`);
      console.log(`    - AFib: ${detectionResult.detections.afib.length} segments`);

      // Create episodes from all detected segments

      // 1. Bradycardia episodes
      for (const segment of detectionResult.detections.bradycardia) {
        if (episodes.length >= maxEpisodes && !loadAll) break;

        const quality = getQualityFlags();
        const status = determineStatus(segment.minHR, quality);
        const explanation = createExplanation(segment.avgHR, segment.minHR, quality);

        const baseDate = new Date('2024-01-15T08:00:00Z');
        const startTs = new Date(baseDate.getTime() + segment.startTime * 1000);
        const endTs = new Date(baseDate.getTime() + segment.endTime * 1000);

        const episode: Episode = {
          episode_id: `mitbih-${recordName}-brady-${segment.startSample}`,
          recording_id: `mitbih-${recordName}`,
          patient_id: `Patient ${recordName}`,
          type: 'brady',
          start_ts: startTs,
          end_ts: endTs,
          start_sample: segment.startSample,
          end_sample: segment.endSample,
          min_hr: segment.minHR,
          avg_hr: segment.avgHR,
          quality,
          model_conf: 1.0,
          explanation,
          status,
        };

        episodes.push(episode);
      }

      // 2. Tachycardia episodes
      for (const segment of detectionResult.detections.tachycardia) {
        if (episodes.length >= maxEpisodes && !loadAll) break;

        const quality = getQualityFlags();
        const explanation = `${segment.type === 'svt' ? 'Supraventricular tachycardia' : 'Sinus tachycardia'} detected (avg HR: ${segment.avgHR} bpm, max: ${segment.maxHR} bpm)`;

        const baseDate = new Date('2024-01-15T08:00:00Z');
        const startTs = new Date(baseDate.getTime() + segment.startTime * 1000);
        const endTs = new Date(baseDate.getTime() + segment.endTime * 1000);

        const episode: Episode = {
          episode_id: `mitbih-${recordName}-tachy-${segment.startSample}`,
          recording_id: `mitbih-${recordName}`,
          patient_id: `Patient ${recordName}`,
          type: 'tachy',
          start_ts: startTs,
          end_ts: endTs,
          start_sample: segment.startSample,
          end_sample: segment.endSample,
          min_hr: segment.minHR,
          avg_hr: segment.avgHR,
          quality,
          model_conf: segment.confidence,
          explanation,
          status: 'needs_review',
        };

        episodes.push(episode);
      }

      // 3. VTac episodes (critical priority)
      for (const segment of detectionResult.detections.vtac) {
        if (episodes.length >= maxEpisodes && !loadAll) break;

        const quality = getQualityFlags();
        const explanation = `${segment.sustained ? 'SUSTAINED' : 'Non-sustained'} ventricular tachycardia detected (HR: ${segment.heart_rate} bpm, QRS: ${segment.qrs_width_ms.toFixed(0)}ms)${segment.critical_priority ? ' - CRITICAL' : ''}`;

        const baseDate = new Date('2024-01-15T08:00:00Z');
        const startTs = new Date(baseDate.getTime() + segment.startTime * 1000);
        const endTs = new Date(baseDate.getTime() + segment.endTime * 1000);

        const episode: Episode = {
          episode_id: `mitbih-${recordName}-vtac-${segment.startSample}`,
          recording_id: `mitbih-${recordName}`,
          patient_id: `Patient ${recordName}`,
          type: 'vtac',
          start_ts: startTs,
          end_ts: endTs,
          start_sample: segment.startSample,
          end_sample: segment.endSample,
          min_hr: segment.heart_rate,
          avg_hr: segment.heart_rate,
          quality,
          model_conf: segment.confidence,
          explanation,
          status: 'needs_review',
        };

        episodes.push(episode);
      }

      // 4. AFib episodes
      for (const segment of detectionResult.detections.afib) {
        if (episodes.length >= maxEpisodes && !loadAll) break;

        const quality = getQualityFlags();
        const explanation = `Atrial fibrillation${segment.ventricular_response === 'rapid' ? ' with rapid ventricular response (RVR)' : ''} detected (mean HR: ${segment.mean_hr} bpm)`;

        const baseDate = new Date('2024-01-15T08:00:00Z');
        const startTs = new Date(baseDate.getTime() + segment.startTime * 1000);
        const endTs = new Date(baseDate.getTime() + segment.endTime * 1000);

        const episode: Episode = {
          episode_id: `mitbih-${recordName}-afib-${segment.startSample}`,
          recording_id: `mitbih-${recordName}`,
          patient_id: `Patient ${recordName}`,
          type: 'afib',
          start_ts: startTs,
          end_ts: endTs,
          start_sample: segment.startSample,
          end_sample: segment.endSample,
          min_hr: segment.mean_hr,
          avg_hr: segment.mean_hr,
          quality,
          model_conf: segment.confidence,
          explanation,
          status: 'needs_review',
        };

        episodes.push(episode);
      }

      // 5. PAC episodes (aggregate into single episode if present)
      if (detectionResult.detections.pac && detectionResult.detections.pac.total_pacs > 0) {
        const pacSummary = detectionResult.detections.pac;
        const quality = getQualityFlags();
        const explanation = `${pacSummary.total_pacs} premature atrial contractions detected (${pacSummary.pacs_per_hour.toFixed(1)} per hour)${pacSummary.frequent ? ' - FREQUENT PACs' : ''}`;

        // Use first PAC event for timing
        const firstPac = pacSummary.events[0];
        const lastPac = pacSummary.events[pacSummary.events.length - 1];

        const baseDate = new Date('2024-01-15T08:00:00Z');
        const startTs = new Date(baseDate.getTime() + firstPac.time * 1000);
        const endTs = new Date(baseDate.getTime() + lastPac.time * 1000);

        const episode: Episode = {
          episode_id: `mitbih-${recordName}-pac-summary`,
          recording_id: `mitbih-${recordName}`,
          patient_id: `Patient ${recordName}`,
          type: 'pac',
          start_ts: startTs,
          end_ts: endTs,
          start_sample: firstPac.sample,
          end_sample: lastPac.sample,
          min_hr: 60, // PACs don't have sustained HR changes
          avg_hr: 70,
          quality,
          model_conf: 0.85,
          explanation,
          status: pacSummary.frequent ? 'needs_review' : 'auto_approved',
        };

        episodes.push(episode);
      }
    } catch (error) {
      console.error(`Failed to load record ${recordName}:`, error);
      // Continue with next record
    }
  }

  console.log(`Loaded ${episodes.length} episodes from MIT-BIH database`);

  // Sort by timestamp
  episodes.sort((a, b) => a.start_ts.getTime() - b.start_ts.getTime());

  return episodes;
}

/**
 * Load ECG data for a specific MIT-BIH episode
 */
export async function loadECGDataForEpisode(episode: Episode): Promise<ECGData> {
  // Extract record name from episode ID
  const match = episode.episode_id.match(/mitbih-(\d+)-/);
  if (!match) {
    throw new Error(`Invalid MIT-BIH episode ID: ${episode.episode_id}`);
  }

  const recordName = match[1];

  console.log(`Loading ECG data for episode ${episode.episode_id} from record ${recordName}`);

  // Load the full record
  const record = await loadMITBIHRecord(recordName);

  // Add some padding before and after the episode (5 seconds on each side)
  const paddingSamples = Math.floor(5 * record.fs);
  const startSample = Math.max(0, episode.start_sample - paddingSamples);
  const endSample = Math.min(record.signals.MLII!.length, episode.end_sample + paddingSamples);

  // Convert to ECGData format
  const ecgData = convertToECGData(record, startSample, endSample);

  // Add multi-channel support
  const channels: { [key: string]: Float32Array } = {
    MLII: ecgData.samples,
  };

  // Add V1 or V5 if available
  if (record.signals.V1) {
    const v1Segment = record.signals.V1.slice(startSample, endSample);
    channels.V1 = v1Segment;
  }

  return {
    ...ecgData,
    channels,
    recordName,
  };
}

/**
 * Load full heart rate trend for a patient's entire recording
 * Returns downsampled heart rate data and duration
 */
export async function loadHeartRateTrend(patientId: string): Promise<{ heartRates: number[]; durationMinutes: number }> {
  // Extract record number from patient ID (e.g., "Patient 106" -> "106")
  const recordName = patientId.replace('Patient ', '');

  console.log(`Loading heart rate trend for ${patientId} (record ${recordName})...`);

  try {
    const record = await loadMITBIHRecord(recordName);

    // Calculate actual duration in minutes from the record
    const durationSeconds = record.length / record.fs;
    const durationMinutes = Math.round(durationSeconds / 60);

    // Get R-peaks and calculate heart rates
    const rpeaks = record.annotations
      .filter(ann => ['N', 'L', 'R', 'B', 'A', 'a', 'J', 'S', 'V', 'r', 'F', 'e', 'j', 'n', 'E', '/'].includes(ann.type))
      .map(ann => ann.sample);

    // Calculate heart rate for each beat
    const heartRates: number[] = [];
    for (let i = 0; i < rpeaks.length - 1; i++) {
      const rrInterval = (rpeaks[i + 1] - rpeaks[i]) / record.fs; // seconds
      const hr = 60 / rrInterval; // bpm
      heartRates.push(hr);
    }

    // Downsample to ~200 points for visualization (MIT-BIH recordings have ~2000 beats)
    const downsampleFactor = Math.max(1, Math.floor(heartRates.length / 200));
    const downsampledHR: number[] = [];

    for (let i = 0; i < heartRates.length; i += downsampleFactor) {
      // Average the heart rates in this window
      const window = heartRates.slice(i, Math.min(i + downsampleFactor, heartRates.length));
      const avgHR = window.reduce((sum, hr) => sum + hr, 0) / window.length;
      downsampledHR.push(avgHR);
    }

    console.log(`Loaded ${downsampledHR.length} heart rate points from ${heartRates.length} beats over ${durationMinutes} minutes`);
    return { heartRates: downsampledHR, durationMinutes };
  } catch (error) {
    console.error(`Failed to load heart rate trend for ${patientId}:`, error);
    return { heartRates: [], durationMinutes: 0 };
  }
}

/**
 * Check if episodes are from MIT-BIH database
 */
export function isMITBIHEpisode(episode: Episode): boolean {
  return episode.episode_id.startsWith('mitbih-');
}
