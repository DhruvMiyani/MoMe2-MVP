"""
Test script for the 3 AI agents
Tests Context Agent, Model Agent, and Explainability Agent
"""
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from agents.context_agent import ContextAgent
from agents.model_agent import ModelAgent
from agents.explainability_agent import ExplainabilityAgent


def test_context_agent():
    """Test Context Agent with MIT-BIH data"""
    print("\n" + "="*60)
    print("Testing Context Agent")
    print("="*60)

    agent = ContextAgent()

    # Test with record 107 (known bradycardia)
    print("\n📊 Extracting context from record 107...")
    try:
        context = agent.extract_patient_context('107')

        print(f"\n✅ Context extracted successfully!")
        print(f"   - Record ID: {context['record_id']}")
        print(f"   - Duration: {context['patient_info']['duration_minutes']:.2f} minutes")
        print(f"   - Total Beats: {context['total_beats']}")
        print(f"   - Bradycardia Episodes: {len(context['bradycardia_events'])}")
        print(f"   - Signal Quality: {context['quality_metrics']['quality_score']}")

        if context['bradycardia_events']:
            print(f"\n📉 First 3 bradycardia episodes:")
            for i, event in enumerate(context['bradycardia_events'][:3], 1):
                print(f"   {i}. Time: {event['time_minutes']:.2f} min, "
                      f"HR: {event['heart_rate_bpm']} bpm")

        return context

    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        return None


def test_model_agent(context):
    """Test Model Agent with OpenAI"""
    print("\n" + "="*60)
    print("Testing Model Agent (OpenAI)")
    print("="*60)

    if not context:
        print("⚠️  Skipping - no context available")
        return None

    # Check for API key
    if not os.getenv("OPENAI_API_KEY"):
        print("\n⚠️  OpenAI API key not found in .env file")
        print("   Please add OPENAI_API_KEY to backend/.env to test Model Agent")
        return None

    try:
        agent = ModelAgent()
        print("\n🤖 Analyzing bradycardia with AI model...")

        analysis = agent.analyze_bradycardia(context)

        print(f"\n✅ Analysis completed!")
        print(f"   - Classification: {analysis.get('classification', 'N/A')}")
        print(f"   - Confidence: {analysis.get('confidence', 0):.0%}")
        print(f"   - Recommendation: {analysis.get('recommendation', 'N/A')}")
        print(f"   - Clinical Significance: {analysis.get('clinical_significance', 'N/A')}")
        print(f"   - Episodes Flagged: {len(analysis.get('episodes_flagged', []))}")

        if analysis.get('concerning_patterns'):
            print(f"\n⚠️  Concerning Patterns:")
            for pattern in analysis['concerning_patterns']:
                print(f"   - {pattern}")

        return analysis

    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        return None


def test_explainability_agent(context, analysis):
    """Test Explainability Agent"""
    print("\n" + "="*60)
    print("Testing Explainability Agent")
    print("="*60)

    if not context or not analysis:
        print("⚠️  Skipping - no context or analysis available")
        return None

    if not os.getenv("OPENAI_API_KEY"):
        print("\n⚠️  OpenAI API key not found in .env file")
        return None

    try:
        agent = ExplainabilityAgent()
        print("\n💡 Generating clinical explanation...")

        explanation = agent.explain_decision(context, analysis, "clinical")

        print(f"\n✅ Explanation generated!")
        print(f"\n📝 Summary:")
        print(f"   {explanation.get('summary', 'N/A')}")

        if explanation.get('key_findings'):
            print(f"\n🔍 Key Findings:")
            for finding in explanation['key_findings'][:3]:
                print(f"   - {finding}")

        # Test overlay data generation
        print(f"\n🎨 Generating overlay data for UI...")
        overlay = agent.generate_overlay_data(context, analysis)

        print(f"\n✅ Overlay data generated with 3 components:")
        print(f"   1. Context Overlay: {overlay['context_overlay']['title']}")
        print(f"   2. Model Overlay: {overlay['model_overlay']['title']}")
        print(f"   3. Explainability Overlay: {overlay['explainability_overlay']['title']}")

        return explanation, overlay

    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        return None


def main():
    """Run all tests"""
    print("\n" + "🚀 "*30)
    print("MoMe 2.0 Backend - Agent Testing Suite")
    print("🚀 "*30)

    # Test 1: Context Agent (no API key needed)
    context = test_context_agent()

    # Test 2: Model Agent (requires OpenAI API key)
    analysis = test_model_agent(context)

    # Test 3: Explainability Agent (requires OpenAI API key)
    result = test_explainability_agent(context, analysis)

    print("\n" + "="*60)
    print("Testing Complete!")
    print("="*60)

    if context and not analysis:
        print("\n💡 Next step: Add OPENAI_API_KEY to backend/.env to test AI agents")
    elif context and analysis and result:
        print("\n✅ All agents working successfully!")
        print("\n🎉 Ready to start the API server:")
        print("   cd backend && python api/main.py")


if __name__ == "__main__":
    main()
