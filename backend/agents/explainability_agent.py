"""
Explainability Agent - Generates human-readable explanations for AI decisions
"""
import os
from typing import Dict, List, Optional
from openai import OpenAI
import json


class ExplainabilityAgent:
    """
    Agent responsible for generating clear, clinically-relevant explanations
    for bradycardia detection decisions. Helps clinicians understand WHY
    the AI made specific recommendations.
    """

    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4o-mini"):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OpenAI API key not provided")

        self.client = OpenAI(api_key=self.api_key)
        self.model = model

    def explain_decision(
        self,
        context: Dict,
        analysis: Dict,
        explanation_type: str = "clinical"
    ) -> Dict:
        """
        Generate explanation for a bradycardia detection decision.

        Args:
            context: Patient context from ContextAgent
            analysis: Analysis result from ModelAgent
            explanation_type: Type of explanation ("clinical", "technical", "patient")

        Returns:
            Dictionary containing explanations and visualizations
        """
        prompt = self._build_explanation_prompt(context, analysis, explanation_type)

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": self._get_system_prompt(explanation_type)
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.4,
                response_format={"type": "json_object"}
            )

            explanation = json.loads(response.choices[0].message.content)

            # Add metadata
            explanation["explanation_type"] = explanation_type
            explanation["model_used"] = self.model

            return explanation

        except Exception as e:
            return {
                "error": str(e),
                "summary": "Unable to generate explanation"
            }

    def _get_system_prompt(self, explanation_type: str) -> str:
        """
        Get system prompt based on explanation type.
        """
        if explanation_type == "clinical":
            return """You are a clinical educator AI that explains ECG analysis decisions to healthcare professionals.

Your explanations should:
- Use proper medical terminology
- Reference specific clinical criteria
- Explain the reasoning process step-by-step
- Highlight key factors that influenced the decision
- Note any limitations or uncertainties
- Be concise but comprehensive

Respond in JSON format:
{
    "summary": "Brief 1-2 sentence summary",
    "key_findings": ["finding1", "finding2", "finding3"],
    "reasoning_steps": [
        {
            "step": 1,
            "description": "What was analyzed",
            "conclusion": "What was found",
            "weight": 0.8
        }
    ],
    "contributing_factors": {
        "positive": ["factors supporting the decision"],
        "negative": ["factors against the decision"],
        "neutral": ["inconclusive factors"]
    },
    "clinical_context": "Why this matters clinically",
    "confidence_factors": "Why the confidence level is what it is",
    "alternative_interpretations": ["other possible interpretations"],
    "recommendations": "What should be done next"
}"""
        elif explanation_type == "technical":
            return """You are a technical AI system explaining algorithm decisions to engineers and data scientists.

Focus on:
- Technical metrics and thresholds
- Signal processing details
- Statistical measures
- Algorithm logic
- Data quality factors

Respond in JSON format with technical details."""
        else:  # patient-friendly
            return """You are a patient educator AI explaining medical findings in simple, non-technical language.

Your explanations should:
- Avoid medical jargon
- Use analogies when helpful
- Focus on what it means for the patient
- Be reassuring but honest
- Be very brief and clear

Respond in JSON format with patient-friendly language."""

    def _build_explanation_prompt(
        self,
        context: Dict,
        analysis: Dict,
        explanation_type: str
    ) -> str:
        """
        Build explanation prompt from context and analysis.
        """
        prompt = f"""Please explain the following bradycardia analysis decision:

ANALYSIS RESULT:
- Classification: {analysis.get('classification', 'UNKNOWN')}
- Confidence: {analysis.get('confidence', 0):.2%}
- Recommendation: {analysis.get('recommendation', 'REVIEW')}
- Clinical Significance: {analysis.get('clinical_significance', 'N/A')}

PATIENT CONTEXT:
- Record ID: {context.get('record_id')}
- Duration: {context.get('patient_info', {}).get('duration_minutes', 0)} minutes
- Total Bradycardia Episodes: {len(context.get('bradycardia_events', []))}
- Signal Quality: {context.get('quality_metrics', {}).get('quality_score', 'unknown')}

DETECTED EPISODES:
"""
        brady_events = context.get('bradycardia_events', [])
        if brady_events:
            avg_hr = sum(e['heart_rate_bpm'] for e in brady_events) / len(brady_events)
            min_hr = min(e['heart_rate_bpm'] for e in brady_events)
            prompt += f"""- Average HR during episodes: {avg_hr:.1f} bpm
- Minimum HR: {min_hr:.1f} bpm
- Episode count: {len(brady_events)}
"""

        flagged = analysis.get('episodes_flagged', [])
        if flagged:
            prompt += f"\nFLAGGED EPISODES ({len(flagged)} total):\n"
            for i, ep in enumerate(flagged[:3]):  # Show first 3
                prompt += f"""  {i+1}. Time: {ep.get('time_seconds', 0):.1f}s, HR: {ep.get('heart_rate_bpm', 0)} bpm, Severity: {ep.get('severity', 'unknown')}
"""

        patterns = analysis.get('concerning_patterns', [])
        if patterns:
            prompt += f"\nCONCERNING PATTERNS:\n"
            for pattern in patterns:
                prompt += f"- {pattern}\n"

        prompt += f"""
Please provide a detailed explanation of WHY this decision was made, following your JSON format instructions.
Explanation style: {explanation_type}"""

        return prompt

    def generate_overlay_data(self, context: Dict, analysis: Dict) -> Dict:
        """
        Generate data for frontend UI overlays (the 3 features to overlay on UI).

        Args:
            context: Patient context
            analysis: Analysis result

        Returns:
            Dictionary with overlay data for each of the 3 agents
        """
        brady_events = context.get('bradycardia_events', [])

        overlay_data = {
            "context_overlay": {
                "type": "context",
                "title": "Patient Context",
                "data": {
                    "record_id": context.get('record_id'),
                    "duration_min": context.get('patient_info', {}).get('duration_minutes', 0),
                    "total_beats": context.get('total_beats', 0),
                    "quality_score": context.get('quality_metrics', {}).get('quality_score', 'unknown'),
                    "signal_quality_indicator": self._get_quality_color(
                        context.get('quality_metrics', {}).get('quality_score', 'low')
                    ),
                    "key_metrics": [
                        f"Total Episodes: {len(brady_events)}",
                        f"Recording Duration: {context.get('patient_info', {}).get('duration_minutes', 0):.1f} min",
                        f"Signal Quality: {context.get('quality_metrics', {}).get('quality_score', 'unknown').upper()}"
                    ]
                },
                "position": "top-left"
            },
            "model_overlay": {
                "type": "analysis",
                "title": "AI Analysis",
                "data": {
                    "classification": analysis.get('classification', 'UNKNOWN'),
                    "confidence": analysis.get('confidence', 0),
                    "confidence_percent": f"{analysis.get('confidence', 0)*100:.0f}%",
                    "recommendation": analysis.get('recommendation', 'REVIEW'),
                    "badge_color": self._get_classification_color(
                        analysis.get('classification', 'UNKNOWN')
                    ),
                    "flagged_count": len(analysis.get('episodes_flagged', [])),
                    "summary": analysis.get('clinical_significance', 'No summary available')
                },
                "position": "top-right"
            },
            "explainability_overlay": {
                "type": "explanation",
                "title": "Why This Decision?",
                "data": {
                    "key_reasons": self._extract_key_reasons(analysis, brady_events),
                    "confidence_explanation": self._get_confidence_explanation(
                        analysis.get('confidence', 0),
                        len(brady_events)
                    ),
                    "next_steps": analysis.get('recommendation', 'REVIEW')
                },
                "position": "bottom-center"
            }
        }

        return overlay_data

    def _get_quality_color(self, quality: str) -> str:
        """Map quality score to color."""
        return {
            "high": "green",
            "medium": "yellow",
            "low": "red"
        }.get(quality.lower(), "gray")

    def _get_classification_color(self, classification: str) -> str:
        """Map classification to color."""
        return {
            "NONE": "green",
            "MILD": "yellow",
            "MODERATE": "orange",
            "SEVERE": "red"
        }.get(classification.upper(), "gray")

    def _extract_key_reasons(self, analysis: Dict, brady_events: List[Dict]) -> List[str]:
        """Extract key reasons for the decision."""
        reasons = []

        # Episode count
        event_count = len(brady_events)
        if event_count > 50:
            reasons.append(f"High episode frequency ({event_count} episodes)")
        elif event_count > 20:
            reasons.append(f"Moderate episode frequency ({event_count} episodes)")
        elif event_count > 0:
            reasons.append(f"Low episode frequency ({event_count} episodes)")

        # Heart rate severity
        if brady_events:
            min_hr = min(e['heart_rate_bpm'] for e in brady_events)
            if min_hr < 40:
                reasons.append(f"Severe bradycardia detected (HR: {min_hr:.0f} bpm)")
            elif min_hr < 50:
                reasons.append(f"Moderate bradycardia detected (HR: {min_hr:.0f} bpm)")

        # Concerning patterns
        patterns = analysis.get('concerning_patterns', [])
        if patterns:
            reasons.extend(patterns[:2])  # Add first 2 patterns

        # Default reason if none found
        if not reasons:
            reasons.append("No significant bradycardia detected")

        return reasons[:3]  # Limit to 3 key reasons

    def _get_confidence_explanation(self, confidence: float, event_count: int) -> str:
        """Generate confidence explanation."""
        if confidence >= 0.8:
            return f"High confidence due to clear patterns and {event_count} consistent episodes"
        elif confidence >= 0.6:
            return f"Moderate confidence with {event_count} episodes showing some variability"
        else:
            return f"Low confidence - recommend human review of {event_count} ambiguous episodes"

    def batch_explain(
        self,
        contexts: List[Dict],
        analyses: List[Dict],
        explanation_type: str = "clinical"
    ) -> List[Dict]:
        """
        Generate explanations for multiple records.

        Args:
            contexts: List of patient contexts
            analyses: List of analysis results
            explanation_type: Type of explanation

        Returns:
            List of explanation results
        """
        results = []
        for context, analysis in zip(contexts, analyses):
            explanation = self.explain_decision(context, analysis, explanation_type)
            explanation["record_id"] = context.get("record_id")
            results.append(explanation)

        return results
