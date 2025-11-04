"""
Model Agent - OpenAI-powered bradycardia detection and analysis
"""
import os
from typing import Dict, List, Optional
from openai import OpenAI
import json


class ModelAgent:
    """
    Agent responsible for analyzing ECG data using OpenAI models.
    Takes context from ContextAgent and makes clinical assessments.
    """

    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4o-mini"):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OpenAI API key not provided")

        self.client = OpenAI(api_key=self.api_key)
        self.model = model

    def analyze_bradycardia(self, context: Dict) -> Dict:
        """
        Analyze bradycardia episodes using OpenAI with clinical context.

        Args:
            context: Patient context from ContextAgent

        Returns:
            Analysis results with confidence scores and classifications
        """
        # Prepare clinical prompt with context
        prompt = self._build_analysis_prompt(context)

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": self._get_system_prompt()
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.3,  # Lower temperature for more consistent clinical analysis
                response_format={"type": "json_object"}
            )

            # Parse response
            analysis = json.loads(response.choices[0].message.content)

            # Add metadata
            analysis["model_used"] = self.model
            analysis["tokens_used"] = response.usage.total_tokens

            return analysis

        except Exception as e:
            return {
                "error": str(e),
                "classification": "ERROR",
                "confidence": 0.0
            }

    def _get_system_prompt(self) -> str:
        """
        System prompt defining the AI's role as a clinical decision support system.
        """
        return """You are an expert clinical AI system specialized in ECG analysis and bradycardia detection.
Your role is to analyze ECG data and provide clinical assessments for human-in-the-loop review.

You will receive patient context including:
- ECG signal characteristics
- Detected bradycardia episodes
- Signal quality metrics
- Patient demographics (when available)

Your task is to:
1. Classify the overall bradycardia severity (NONE, MILD, MODERATE, SEVERE)
2. Provide a confidence score (0.0 to 1.0)
3. Identify specific episodes that need review
4. Flag any concerning patterns
5. Assess clinical significance

ALWAYS respond in valid JSON format with the following structure:
{
    "classification": "NONE|MILD|MODERATE|SEVERE",
    "confidence": 0.85,
    "episodes_flagged": [
        {
            "time_seconds": 125.5,
            "heart_rate_bpm": 45,
            "severity": "moderate",
            "requires_review": true
        }
    ],
    "clinical_significance": "Brief clinical assessment",
    "concerning_patterns": ["pattern1", "pattern2"],
    "recommendation": "APPROVE|REVIEW|ESCALATE"
}

Be conservative - when in doubt, recommend human review."""

    def _build_analysis_prompt(self, context: Dict) -> str:
        """
        Build detailed analysis prompt from patient context.

        Args:
            context: Patient context dictionary

        Returns:
            Formatted prompt string
        """
        patient_info = context.get("patient_info", {})
        signal_info = context.get("signal_info", {})
        brady_events = context.get("bradycardia_events", [])
        quality = context.get("quality_metrics", {})

        # Calculate statistics
        total_brady_events = len(brady_events)
        avg_hr = sum(e["heart_rate_bpm"] for e in brady_events) / len(brady_events) if brady_events else 60
        min_hr = min((e["heart_rate_bpm"] for e in brady_events), default=60)

        prompt = f"""Analyze the following ECG record for bradycardia:

PATIENT INFORMATION:
- Record ID: {context.get('record_id')}
- Duration: {patient_info.get('duration_minutes', 0)} minutes
- Sampling Rate: {patient_info.get('sampling_rate')} Hz
- Total Beats: {context.get('total_beats', 0)}

SIGNAL QUALITY:
- Quality Score: {quality.get('quality_score', 'unknown')}
- SNR: {quality.get('snr_estimate_db', 0)} dB
- Has Artifacts: {quality.get('has_artifacts', False)}

BRADYCARDIA EPISODES DETECTED:
- Total Episodes: {total_brady_events}
- Average Heart Rate during bradycardia: {avg_hr:.1f} bpm
- Minimum Heart Rate: {min_hr:.1f} bpm

DETAILED EPISODES (showing first 10):
"""

        # Add episode details (limit to first 10 for prompt size)
        for i, event in enumerate(brady_events[:10]):
            prompt += f"""
Episode {i+1}:
  - Time: {event['time_minutes']:.2f} min ({event['time_seconds']:.1f} sec)
  - Heart Rate: {event['heart_rate_bpm']} bpm
  - RR Interval: {event['rr_interval_ms']} ms
"""

        if total_brady_events > 10:
            prompt += f"\n... and {total_brady_events - 10} more episodes\n"

        prompt += """
Please provide your clinical analysis in JSON format as specified in your system instructions.
Focus on clinical significance and whether these episodes require human review."""

        return prompt

    def batch_analyze(self, contexts: List[Dict]) -> List[Dict]:
        """
        Analyze multiple records in batch.

        Args:
            contexts: List of patient contexts

        Returns:
            List of analysis results
        """
        results = []
        for context in contexts:
            result = self.analyze_bradycardia(context)
            result["record_id"] = context.get("record_id")
            results.append(result)

        return results

    def get_confidence_explanation(self, analysis: Dict) -> str:
        """
        Generate human-readable confidence explanation.

        Args:
            analysis: Analysis result from analyze_bradycardia

        Returns:
            Explanation string
        """
        confidence = analysis.get("confidence", 0)
        classification = analysis.get("classification", "UNKNOWN")

        if confidence >= 0.8:
            level = "high"
            reason = "Strong clinical indicators with clear ECG patterns"
        elif confidence >= 0.6:
            level = "moderate"
            reason = "Some clinical indicators present, but with ambiguity"
        else:
            level = "low"
            reason = "Weak or conflicting clinical indicators"

        return f"{level.capitalize()} confidence ({confidence:.0%}) - {reason}. Classification: {classification}"
