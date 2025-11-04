"""
FastAPI server for MoMe 2.0 Bradycardia Detection Backend
Integrates the 3 AI agents and serves the frontend
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import agents
import sys
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from agents.context_agent import ContextAgent
from agents.model_agent import ModelAgent
from agents.explainability_agent import ExplainabilityAgent

# Initialize FastAPI app
app = FastAPI(
    title="MoMe 2.0 Bradycardia Detection API",
    description="AI-powered bradycardia detection with explainability",
    version="1.0.0"
)

# CORS middleware for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize agents
context_agent = ContextAgent()
model_agent = ModelAgent()
explainability_agent = ExplainabilityAgent()


# Pydantic models for request/response
class AnalysisRequest(BaseModel):
    record_id: str
    explanation_type: Optional[str] = "clinical"


class EpisodeAnalysisResponse(BaseModel):
    record_id: str
    context: dict
    analysis: dict
    explanation: dict
    overlay_data: dict


class ECGSegmentRequest(BaseModel):
    record_id: str
    start_time: float
    duration: Optional[float] = 10.0


# Health check endpoint
@app.get("/")
async def root():
    return {
        "service": "MoMe 2.0 Bradycardia Detection API",
        "status": "running",
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "agents": {
            "context_agent": "initialized",
            "model_agent": "initialized",
            "explainability_agent": "initialized"
        }
    }


# Get list of available bradycardia records
@app.get("/api/records")
async def get_bradycardia_records():
    """
    Get list of MIT-BIH records known to contain bradycardia.
    """
    try:
        records = context_agent.get_bradycardia_records()
        return {
            "records": records,
            "count": len(records),
            "database": "MIT-BIH Arrhythmia Database"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Analyze a specific episode
@app.post("/api/analyze")
async def analyze_episode(request: AnalysisRequest) -> EpisodeAnalysisResponse:
    """
    Full pipeline analysis of an ECG record:
    1. Extract context (Context Agent)
    2. Analyze bradycardia (Model Agent)
    3. Generate explanation (Explainability Agent)
    4. Create overlay data for UI
    """
    try:
        # Step 1: Extract patient context
        print(f"Extracting context for record {request.record_id}...")
        context = context_agent.extract_patient_context(request.record_id)

        # Step 2: Analyze with OpenAI Model
        print(f"Analyzing bradycardia with AI model...")
        analysis = model_agent.analyze_bradycardia(context)

        # Step 3: Generate explanation
        print(f"Generating {request.explanation_type} explanation...")
        explanation = explainability_agent.explain_decision(
            context,
            analysis,
            request.explanation_type
        )

        # Step 4: Create overlay data for frontend
        print(f"Creating overlay data for UI...")
        overlay_data = explainability_agent.generate_overlay_data(context, analysis)

        return EpisodeAnalysisResponse(
            record_id=request.record_id,
            context=context,
            analysis=analysis,
            explanation=explanation,
            overlay_data=overlay_data
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


# Get ECG signal data for visualization
@app.post("/api/ecg-segment")
async def get_ecg_segment(request: ECGSegmentRequest):
    """
    Extract ECG signal segment for frontend visualization.
    """
    try:
        segment = context_agent.extract_ecg_segment(
            request.record_id,
            request.start_time,
            request.duration
        )
        return segment
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Get patient context only (faster, no AI analysis)
@app.get("/api/context/{record_id}")
async def get_context(record_id: str):
    """
    Get patient context without running AI analysis.
    Useful for quick data exploration.
    """
    try:
        context = context_agent.extract_patient_context(record_id)
        return context
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Batch analysis endpoint
@app.post("/api/batch-analyze")
async def batch_analyze(record_ids: List[str], explanation_type: str = "clinical"):
    """
    Analyze multiple records in batch.
    """
    try:
        results = []

        for record_id in record_ids:
            # Extract context
            context = context_agent.extract_patient_context(record_id)

            # Analyze
            analysis = model_agent.analyze_bradycardia(context)

            # Explain
            explanation = explainability_agent.explain_decision(
                context,
                analysis,
                explanation_type
            )

            # Overlay
            overlay_data = explainability_agent.generate_overlay_data(context, analysis)

            results.append({
                "record_id": record_id,
                "context": context,
                "analysis": analysis,
                "explanation": explanation,
                "overlay_data": overlay_data
            })

        return {
            "total_analyzed": len(results),
            "results": results
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch analysis failed: {str(e)}")


# Get all bradycardia episodes for a record
@app.get("/api/episodes/{record_id}")
async def get_episodes(record_id: str):
    """
    Get all detected bradycardia episodes for a record.
    """
    try:
        context = context_agent.extract_patient_context(record_id)
        return {
            "record_id": record_id,
            "total_episodes": len(context.get("bradycardia_events", [])),
            "episodes": context.get("bradycardia_events", [])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Get overlay data for frontend integration
@app.post("/api/overlay")
async def get_overlay_data(request: AnalysisRequest):
    """
    Get the 3-agent overlay data for frontend UI without full explanation.
    Faster endpoint for real-time UI updates.
    """
    try:
        # Get context and analysis
        context = context_agent.extract_patient_context(request.record_id)
        analysis = model_agent.analyze_bradycardia(context)

        # Generate overlay data
        overlay_data = explainability_agent.generate_overlay_data(context, analysis)

        return overlay_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
