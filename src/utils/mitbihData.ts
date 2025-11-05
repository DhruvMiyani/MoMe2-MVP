/**
 * MIT-BIH Data Integration
 * Generates episodes from real MIT-BIH Arrhythmia Database records
 */

import { Episode, ECGData, QualityFlags } from '../types';
import { loadMITBIHRecord, detectBradycardiaSegments, convertToECGData } from './mitbih';
import { generateLLMExplanation, formatExplanation } from './explainabilityAgent';

// TOP 10 patients with most bradycardia (sorted by bradycardia beat count)
const MITBIH_PATIENTS = ['117', '124', '123', '108', '113', '202', '121', '201', '106', '114'];

// All available patient records (same as MITBIH_PATIENTS)
const ALL_MITBIH_PATIENTS = ['117', '124', '123', '108', '113', '202', '121', '201', '106', '114'];

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

      // Detect bradycardia segments
      const segments = detectBradycardiaSegments(record);

      console.log(`  Found ${segments.length} bradycardia segments in record ${recordName}`);

      // If loading all and no segments found, create a placeholder episode to show patient
      if (loadAll && segments.length === 0) {
        console.log(`  Patient ${recordName}: No bradycardia episodes (other arrhythmia or normal rhythm)`);
        // Skip for now - we'll only show patients with actual bradycardia episodes
      }

      // Convert each segment to an Episode
      for (const segment of segments) {
        if (episodes.length >= maxEpisodes && !loadAll) break;

        // Get quality flags (all false for MIT-BIH curated data)
        const quality = getQualityFlags();
        const status = determineStatus(segment.minHR, quality);

        // Generate explanation (LLM or fallback)
        let explanation: string;
        if (useLLMExplanations) {
          console.log(`  Generating LLM explanation for episode ${recordName}-${segment.startSample}...`);
          try {
            const llmResponse = await generateLLMExplanation({
              segment,
              quality,
              detectionCriteria: {
                hrThreshold: 60,
                minBeats: 4,
                minDuration: 3,
              },
            });
            explanation = formatExplanation(llmResponse);
            console.log(`  ✓ LLM explanation: "${explanation}"`);
          } catch (error) {
            console.error(`  ✗ LLM failed, using fallback:`, error);
            explanation = createExplanation(segment.avgHR, segment.minHR, quality);
          }
        } else {
          explanation = createExplanation(segment.avgHR, segment.minHR, quality);
        }

        // Use actual MIT-BIH recording date (1975-1979 era)
        // For demo purposes, using 2024-01-15 as a reference date
        const baseDate = new Date('2024-01-15T08:00:00Z');
        const startTs = new Date(baseDate.getTime() + segment.startTime * 1000);
        const endTs = new Date(baseDate.getTime() + segment.endTime * 1000);

        const episode: Episode = {
          episode_id: `mitbih-${recordName}-${segment.startSample}`,
          recording_id: `mitbih-${recordName}`,
          patient_id: `Patient ${recordName}`,  // e.g., "Patient 106"
          type: 'brady',
          start_ts: startTs,
          end_ts: endTs,
          start_sample: segment.startSample,
          end_sample: segment.endSample,
          min_hr: segment.minHR,
          avg_hr: segment.avgHR,
          quality,
          model_conf: 1.0,  // MIT-BIH annotations are ground truth (100% confidence)
          explanation,
          status,
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
