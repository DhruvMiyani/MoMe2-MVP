/**
 * Agent Overlays Component
 *
 * Displays the 3 AI agent outputs as overlays on the UI:
 * 1. Context Overlay (top-left)
 * 2. Model Overlay (top-right)
 * 3. Explainability Overlay (bottom-center)
 */

import React from 'react';
import { Info, Brain, Lightbulb } from 'lucide-react';
import type { OverlayData } from '../services/backendService';

interface AgentOverlaysProps {
  overlayData: OverlayData | null;
  isLoading?: boolean;
}

export function AgentOverlays({ overlayData, isLoading }: AgentOverlaysProps) {
  if (isLoading) {
    return (
      <div className="fixed inset-0 pointer-events-none z-50">
        <div className="absolute top-4 left-4 bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
            <span className="text-sm text-gray-300">Loading agent data...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!overlayData) return null;

  const { context_overlay, model_overlay, explainability_overlay } = overlayData;

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {/* Context Overlay - Top Left */}
      <div className="absolute top-4 left-4 bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 border border-gray-700 max-w-xs pointer-events-auto">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-white">{context_overlay.title}</h3>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Record:</span>
            <span className="text-white font-mono">{context_overlay.data.record_id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Duration:</span>
            <span className="text-white">{context_overlay.data.duration_min.toFixed(1)} min</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Total Beats:</span>
            <span className="text-white">{context_overlay.data.total_beats.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Signal Quality:</span>
            <span className={`text-white px-2 py-1 rounded text-xs font-medium ${
              context_overlay.data.quality_score === 'high' ? 'bg-green-600' :
              context_overlay.data.quality_score === 'medium' ? 'bg-yellow-600' :
              'bg-red-600'
            }`}>
              {context_overlay.data.quality_score.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Model Overlay - Top Right */}
      <div className="absolute top-4 right-4 bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 border border-gray-700 max-w-xs pointer-events-auto">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-5 h-5 text-purple-400" />
          <h3 className="font-semibold text-white">{model_overlay.title}</h3>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-400">Classification:</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                model_overlay.data.badge_color === 'green' ? 'bg-green-600' :
                model_overlay.data.badge_color === 'yellow' ? 'bg-yellow-600' :
                model_overlay.data.badge_color === 'orange' ? 'bg-orange-600' :
                model_overlay.data.badge_color === 'red' ? 'bg-red-600' :
                'bg-gray-600'
              } text-white`}>
                {model_overlay.data.classification}
              </span>
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-400">Confidence:</span>
              <span className="text-white font-semibold">{model_overlay.data.confidence_percent}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  model_overlay.data.confidence >= 0.8 ? 'bg-green-500' :
                  model_overlay.data.confidence >= 0.6 ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${model_overlay.data.confidence * 100}%` }}
              />
            </div>
          </div>
          <div>
            <div className="text-gray-400 mb-1">Recommendation:</div>
            <div className="text-white font-medium">{model_overlay.data.recommendation}</div>
          </div>
          {model_overlay.data.flagged_count > 0 && (
            <div className="text-xs text-yellow-400 bg-yellow-900/30 px-2 py-1 rounded">
              {model_overlay.data.flagged_count} episodes flagged for review
            </div>
          )}
        </div>
      </div>

      {/* Explainability Overlay - Bottom Center */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 border border-gray-700 max-w-2xl pointer-events-auto">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-5 h-5 text-amber-400" />
          <h3 className="font-semibold text-white">{explainability_overlay.title}</h3>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <div className="text-gray-400 mb-2">Key Reasons:</div>
            <ul className="space-y-1">
              {explainability_overlay.data.key_reasons.map((reason, idx) => (
                <li key={idx} className="flex items-start gap-2 text-white">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="text-xs text-gray-400 border-t border-gray-700 pt-2">
            {explainability_overlay.data.confidence_explanation}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AgentOverlays;
