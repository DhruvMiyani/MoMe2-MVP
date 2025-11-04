/**
 * Backend API Service - Integrates with the 3-agent backend
 *
 * This service connects the React frontend to the FastAPI backend
 * that provides Context Agent, Model Agent, and Explainability Agent functionality.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface OverlayData {
  context_overlay: {
    type: string;
    title: string;
    data: {
      record_id: string;
      duration_min: number;
      total_beats: number;
      quality_score: string;
      signal_quality_indicator: string;
      key_metrics: string[];
    };
    position: string;
  };
  model_overlay: {
    type: string;
    title: string;
    data: {
      classification: string;
      confidence: number;
      confidence_percent: string;
      recommendation: string;
      badge_color: string;
      flagged_count: number;
      summary: string;
    };
    position: string;
  };
  explainability_overlay: {
    type: string;
    title: string;
    data: {
      key_reasons: string[];
      confidence_explanation: string;
      next_steps: string;
    };
    position: string;
  };
}

export interface AnalysisResponse {
  record_id: string;
  context: any;
  analysis: any;
  explanation: any;
  overlay_data: OverlayData;
}

export interface ECGSegment {
  time: number[];
  signal: number[];
  sampling_rate: number;
  start_time: number;
  duration: number;
}

export interface BradycardiaEpisode {
  time_seconds: number;
  time_minutes: number;
  heart_rate_bpm: number;
  rr_interval_ms: number;
  annotation_type: string;
}

/**
 * Backend API Service
 */
class BackendService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get list of available ECG records
   */
  async getAvailableRecords(): Promise<{ records: string[]; count: number }> {
    const response = await fetch(`${this.baseUrl}/api/records`);
    if (!response.ok) {
      throw new Error('Failed to fetch records');
    }
    return response.json();
  }

  /**
   * Analyze an ECG record with all 3 agents
   */
  async analyzeRecord(
    recordId: string,
    explanationType: 'clinical' | 'technical' | 'patient' = 'clinical'
  ): Promise<AnalysisResponse> {
    const response = await fetch(`${this.baseUrl}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        record_id: recordId,
        explanation_type: explanationType,
      }),
    });

    if (!response.ok) {
      throw new Error(`Analysis failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get overlay data for UI (faster than full analysis)
   */
  async getOverlayData(recordId: string): Promise<OverlayData> {
    const response = await fetch(`${this.baseUrl}/api/overlay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        record_id: recordId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get overlay data: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get ECG signal segment for visualization
   */
  async getECGSegment(
    recordId: string,
    startTime: number,
    duration: number = 10.0
  ): Promise<ECGSegment> {
    const response = await fetch(`${this.baseUrl}/api/ecg-segment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        record_id: recordId,
        start_time: startTime,
        duration: duration,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get ECG segment: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get patient context only (no AI analysis)
   */
  async getContext(recordId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/context/${recordId}`);

    if (!response.ok) {
      throw new Error(`Failed to get context: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get all bradycardia episodes for a record
   */
  async getEpisodes(recordId: string): Promise<{
    record_id: string;
    total_episodes: number;
    episodes: BradycardiaEpisode[];
  }> {
    const response = await fetch(`${this.baseUrl}/api/episodes/${recordId}`);

    if (!response.ok) {
      throw new Error(`Failed to get episodes: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Batch analyze multiple records
   */
  async batchAnalyze(
    recordIds: string[],
    explanationType: 'clinical' | 'technical' | 'patient' = 'clinical'
  ): Promise<{ total_analyzed: number; results: AnalysisResponse[] }> {
    const response = await fetch(`${this.baseUrl}/api/batch-analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(recordIds),
    });

    if (!response.ok) {
      throw new Error(`Batch analysis failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Check backend health
   */
  async healthCheck(): Promise<{ status: string; agents: any }> {
    const response = await fetch(`${this.baseUrl}/health`);

    if (!response.ok) {
      throw new Error('Backend health check failed');
    }

    return response.json();
  }
}

// Export singleton instance
export const backendService = new BackendService();

// Export class for testing
export default BackendService;
