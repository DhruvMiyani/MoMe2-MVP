"""Debug Model Agent to see actual error"""
import os
from dotenv import load_dotenv
from openai import OpenAI
import json

load_dotenv()

# Simple test context
context = {
    "record_id": "TEST",
    "patient_info": {"duration_minutes": 30, "sampling_rate": 360},
    "bradycardia_events": [
        {"time_seconds": 100, "time_minutes": 1.67, "heart_rate_bpm": 45, "rr_interval_ms": 1333, "annotation_type": "N"}
    ],
    "quality_metrics": {"quality_score": "high", "snr_estimate_db": 25},
    "total_beats": 1800
}

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

system_prompt = """You are an expert clinical AI system specialized in ECG analysis and bradycardia detection.

ALWAYS respond in valid JSON format with the following structure:
{
    "classification": "NONE|MILD|MODERATE|SEVERE",
    "confidence": 0.85,
    "episodes_flagged": [],
    "clinical_significance": "Brief clinical assessment",
    "concerning_patterns": [],
    "recommendation": "APPROVE|REVIEW|ESCALATE"
}"""

user_prompt = f"""Analyze the following ECG record for bradycardia:

PATIENT INFORMATION:
- Record ID: {context['record_id']}
- Duration: 30 minutes
- Total Beats: 1800

BRADYCARDIA EPISODES DETECTED:
- Total Episodes: 1
- Heart Rate: 45 bpm

Please provide your clinical analysis in JSON format."""

print("Sending request to OpenAI...")
print(f"Model: gpt-4-turbo-preview")

try:
    response = client.chat.completions.create(
        model="gpt-4-turbo-preview",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.3,
        response_format={"type": "json_object"}
    )

    print("\n✅ Response received!")
    print(f"Model used: {response.model}")
    print(f"Tokens: {response.usage.total_tokens}")
    print(f"\nResponse content:")

    analysis = json.loads(response.choices[0].message.content)
    print(json.dumps(analysis, indent=2))

except Exception as e:
    print(f"\n❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
