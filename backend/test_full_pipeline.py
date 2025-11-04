"""
Full pipeline test - Test with synthetic data to verify AI agents work
"""
import os
from dotenv import load_dotenv

load_dotenv()

from agents.model_agent import ModelAgent
from agents.explainability_agent import ExplainabilityAgent

# Create synthetic context with bradycardia events for testing
synthetic_context = {
    "record_id": "TEST_001",
    "patient_info": {
        "record_name": "test_record",
        "duration_minutes": 30.0,
        "sampling_rate": 360
    },
    "signal_info": {
        "channels": ["MLII"],
        "units": ["mV"],
        "baseline": 0.0,
        "signal_range": [-1.0, 1.0]
    },
    "bradycardia_events": [
        {
            "time_seconds": 125.5,
            "time_minutes": 2.09,
            "heart_rate_bpm": 45,
            "rr_interval_ms": 1333,
            "annotation_type": "N"
        },
        {
            "time_seconds": 245.8,
            "time_minutes": 4.10,
            "heart_rate_bpm": 48,
            "rr_interval_ms": 1250,
            "annotation_type": "N"
        },
        {
            "time_seconds": 567.3,
            "time_minutes": 9.46,
            "heart_rate_bpm": 42,
            "rr_interval_ms": 1429,
            "annotation_type": "N"
        },
        {
            "time_seconds": 890.1,
            "time_minutes": 14.84,
            "heart_rate_bpm": 55,
            "rr_interval_ms": 1091,
            "annotation_type": "N"
        }
    ],
    "quality_metrics": {
        "snr_estimate_db": 25.3,
        "baseline_wander": 0.05,
        "quality_score": "high",
        "signal_length": 648000,
        "has_artifacts": False
    },
    "total_beats": 1800,
    "has_bradycardia": True
}

print("="*60)
print("Testing Full AI Pipeline with Synthetic Bradycardia Data")
print("="*60)

# Test Model Agent
print("\n🤖 Testing Model Agent (OpenAI)...")
try:
    model_agent = ModelAgent()
    analysis = model_agent.analyze_bradycardia(synthetic_context)

    print(f"\n✅ Model Agent Success!")
    print(f"   Classification: {analysis.get('classification')}")
    print(f"   Confidence: {analysis.get('confidence', 0):.0%}")
    print(f"   Recommendation: {analysis.get('recommendation')}")
    print(f"   Clinical Significance: {analysis.get('clinical_significance', 'N/A')[:100]}...")
    print(f"   Episodes Flagged: {len(analysis.get('episodes_flagged', []))}")
    print(f"   Tokens Used: {analysis.get('tokens_used', 0)}")

    if analysis.get('concerning_patterns'):
        print(f"\n   Concerning Patterns:")
        for pattern in analysis['concerning_patterns']:
            print(f"   - {pattern}")

    # Test Explainability Agent
    print(f"\n💡 Testing Explainability Agent...")
    explainability_agent = ExplainabilityAgent()
    explanation = explainability_agent.explain_decision(
        synthetic_context,
        analysis,
        "clinical"
    )

    print(f"\n✅ Explainability Agent Success!")
    print(f"\n   Summary:")
    print(f"   {explanation.get('summary', 'N/A')}")

    if explanation.get('key_findings'):
        print(f"\n   Key Findings:")
        for finding in explanation['key_findings'][:3]:
            print(f"   - {finding}")

    # Test overlay generation
    print(f"\n🎨 Testing Overlay Data Generation...")
    overlay = explainability_agent.generate_overlay_data(synthetic_context, analysis)

    print(f"\n✅ Overlay Data Generated!")
    print(f"   1. {overlay['context_overlay']['title']}: {overlay['context_overlay']['data']['quality_score']}")
    print(f"   2. {overlay['model_overlay']['title']}: {overlay['model_overlay']['data']['classification']} ({overlay['model_overlay']['data']['confidence_percent']})")
    print(f"   3. {overlay['explainability_overlay']['title']}: {len(overlay['explainability_overlay']['data']['key_reasons'])} reasons")

    print(f"\n" + "="*60)
    print("✅ ALL AGENTS WORKING CORRECTLY!")
    print("="*60)
    print("\n🎉 Your backend is fully operational!")
    print("\nNext steps:")
    print("1. Start the API server: python3 api/main.py")
    print("2. Test endpoints: curl http://localhost:8000/health")
    print("3. Integrate with frontend")

except Exception as e:
    print(f"\n❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
