/**
 * LLM-Based Explainability Agent
 *
 * Generates natural language explanations for bradycardia detection decisions
 * using OpenAI GPT-4 or similar LLM.
 */

import { BradycardiaSegment } from './mitbih';
import { QualityFlags } from '../types';

interface ExplanationRequest {
  segment: BradycardiaSegment;
  quality: QualityFlags;
  detectionCriteria: {
    hrThreshold: number;
    minBeats: number;
    minDuration: number;
  };
}

interface ExplanationResponse {
  explanation: string;
  severity: 'mild' | 'moderate' | 'severe';
  clinicalRelevance: string;
  recommendedAction: string;
}

/**
 * Generate explanation using OpenAI API
 * Note: This requires OPENAI_API_KEY environment variable
 */
export async function generateLLMExplanation(
  request: ExplanationRequest
): Promise<ExplanationResponse> {
  const { segment, quality, detectionCriteria } = request;

  // Construct the prompt for the LLM
  const prompt = `You are a clinical AI assistant specializing in cardiac arrhythmia interpretation. Analyze the following bradycardia detection and provide a concise clinical explanation.

DETECTION DATA:
- Patient: ${segment.recordName}
- Episode Duration: ${segment.duration.toFixed(1)} seconds
- Minimum Heart Rate: ${segment.minHR} bpm
- Average Heart Rate: ${segment.avgHR} bpm
- Time Window: ${segment.startTime.toFixed(1)}s to ${segment.endTime.toFixed(1)}s

DETECTION ALGORITHM CRITERIA:
- HR Threshold: < ${detectionCriteria.hrThreshold} bpm
- Minimum Consecutive Beats: ${detectionCriteria.minBeats}
- Minimum Duration: ${detectionCriteria.minDuration} seconds

SIGNAL QUALITY:
${Object.entries(quality).map(([key, value]) => `- ${key.replace(/_/g, ' ')}: ${value ? 'YES' : 'NO'}`).join('\n')}

TASK:
Generate a brief clinical explanation (2-3 sentences) that:
1. Describes the bradycardia severity (mild/moderate/severe)
2. Explains why this episode was detected based on the criteria
3. Notes any signal quality issues if present

Format your response as JSON:
{
  "explanation": "Brief clinical explanation here",
  "severity": "mild|moderate|severe",
  "clinicalRelevance": "One sentence on clinical significance",
  "recommendedAction": "Brief recommendation (e.g., 'Review for clinical correlation', 'Consider immediate evaluation')"
}`;

  try {
    // Check if API key is available
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

    if (!apiKey) {
      console.warn('OPENAI_API_KEY not found, using fallback explanation');
      return generateFallbackExplanation(segment, quality);
    }

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5', // GPT-5
        messages: [
          {
            role: 'system',
            content: 'You are a clinical AI assistant specializing in cardiac arrhythmia interpretation. Provide concise, accurate clinical explanations.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent medical explanations
        max_tokens: 300,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const result = JSON.parse(content);

    return result as ExplanationResponse;
  } catch (error) {
    console.error('Error generating LLM explanation:', error);
    return generateFallbackExplanation(segment, quality);
  }
}

/**
 * Fallback explanation when LLM is not available
 */
function generateFallbackExplanation(
  segment: BradycardiaSegment,
  quality: QualityFlags
): ExplanationResponse {
  const { minHR, avgHR, duration } = segment;

  // Determine severity
  let severity: 'mild' | 'moderate' | 'severe';
  if (minHR < 40) {
    severity = 'severe';
  } else if (minHR < 50) {
    severity = 'moderate';
  } else {
    severity = 'mild';
  }

  // Build explanation
  const parts: string[] = [];

  if (severity === 'severe') {
    parts.push(`Severe bradycardia detected with minimum heart rate of ${minHR} bpm`);
  } else if (severity === 'moderate') {
    parts.push(`Moderate bradycardia detected with minimum heart rate of ${minHR} bpm`);
  } else {
    parts.push(`Mild bradycardia detected with minimum heart rate of ${minHR} bpm`);
  }

  if (avgHR < 50) {
    parts.push(`sustained over ${duration.toFixed(1)} seconds with average rate of ${avgHR} bpm`);
  } else {
    parts.push(`lasting ${duration.toFixed(1)} seconds`);
  }

  // Add quality notes
  const qualityIssues = Object.entries(quality)
    .filter(([_, value]) => value)
    .map(([key]) => key.replace(/_/g, ' '));

  if (qualityIssues.length > 0) {
    parts.push(`Signal quality issues noted: ${qualityIssues.join(', ')}`);
  }

  const explanation = parts.join('. ') + '.';

  // Clinical relevance
  let clinicalRelevance = '';
  if (severity === 'severe') {
    clinicalRelevance = 'Clinically significant bradycardia requiring immediate attention.';
  } else if (severity === 'moderate') {
    clinicalRelevance = 'Moderate bradycardia that may require clinical correlation.';
  } else {
    clinicalRelevance = 'Mild bradycardia that should be reviewed in clinical context.';
  }

  // Recommended action
  let recommendedAction = '';
  if (severity === 'severe' || minHR < 40) {
    recommendedAction = 'Consider immediate clinical evaluation and potential intervention.';
  } else if (severity === 'moderate') {
    recommendedAction = 'Review for clinical correlation and patient symptoms.';
  } else {
    recommendedAction = 'Monitor and document. Consider clinical context.';
  }

  return {
    explanation,
    severity,
    clinicalRelevance,
    recommendedAction,
  };
}

/**
 * Batch generate explanations for multiple episodes
 */
export async function generateBatchExplanations(
  segments: BradycardiaSegment[],
  qualityFlags: QualityFlags[],
  useLLM: boolean = false
): Promise<ExplanationResponse[]> {
  const detectionCriteria = {
    hrThreshold: 60,
    minBeats: 4,
    minDuration: 3,
  };

  if (!useLLM) {
    // Use fallback for all
    return segments.map((segment, i) =>
      generateFallbackExplanation(segment, qualityFlags[i])
    );
  }

  // Generate explanations with LLM (with rate limiting)
  const explanations: ExplanationResponse[] = [];

  for (let i = 0; i < segments.length; i++) {
    const explanation = await generateLLMExplanation({
      segment: segments[i],
      quality: qualityFlags[i],
      detectionCriteria,
    });

    explanations.push(explanation);

    // Rate limiting: wait 1 second between requests to avoid API limits
    if (i < segments.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return explanations;
}

/**
 * Create a simple text explanation from the structured response
 */
export function formatExplanation(response: ExplanationResponse): string {
  return `${response.explanation} ${response.clinicalRelevance}`;
}
