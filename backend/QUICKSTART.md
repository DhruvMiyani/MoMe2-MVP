# Quick Start Guide - MoMe 2.0 Backend

## Setup (5 minutes)

### 1. Dependencies Already Installed ✅
The required packages are already installed:
- fastapi, uvicorn (API server)
- openai (OpenAI integration)
- wfdb (MIT-BIH database access)
- pydantic, numpy, etc.

### 2. Configure OpenAI API Key

```bash
cd backend
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:
```
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4-turbo-preview
PORT=8000
```

### 3. Test the Agents

```bash
python3 test_agents.py
```

You should see:
- ✅ Context Agent: Extracts ECG data from MIT-BIH
- ✅ Model Agent: AI analysis (requires API key)
- ✅ Explainability Agent: Decision explanations (requires API key)

### 4. Start the API Server

```bash
python3 api/main.py
```

The API will run at `http://localhost:8000`

## Quick Test

### Test Context Agent (No API Key Needed)
```bash
curl http://localhost:8000/api/context/107 | python3 -m json.tool
```

### Test Full Analysis (Requires API Key)
```bash
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"record_id": "107", "explanation_type": "clinical"}' \
  | python3 -m json.tool
```

### Get Available Records
```bash
curl http://localhost:8000/api/records
```

### Get ECG Segment for Visualization
```bash
curl -X POST http://localhost:8000/api/ecg-segment \
  -H "Content-Type: application/json" \
  -d '{"record_id": "107", "start_time": 60.0, "duration": 10.0}' \
  | python3 -m json.tool
```

### Get Overlay Data for UI
```bash
curl -X POST http://localhost:8000/api/overlay \
  -H "Content-Type: application/json" \
  -d '{"record_id": "107"}' \
  | python3 -m json.tool
```

## API Documentation

Once the server is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Frontend Integration

Update your frontend to call the backend API:

```typescript
// Example: Fetch analysis with 3-agent overlay
const response = await fetch('http://localhost:8000/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    record_id: '107',
    explanation_type: 'clinical'
  })
});

const data = await response.json();

// Access the 3 agent overlays
const contextOverlay = data.overlay_data.context_overlay;
const modelOverlay = data.overlay_data.model_overlay;
const explainOverlay = data.overlay_data.explainability_overlay;
```

## 3-Agent Architecture

### 1. Context Overlay (Top-Left UI)
```json
{
  "type": "context",
  "title": "Patient Context",
  "data": {
    "record_id": "107",
    "duration_min": 30.09,
    "total_beats": 2140,
    "quality_score": "high",
    "key_metrics": [...]
  },
  "position": "top-left"
}
```

### 2. Model Overlay (Top-Right UI)
```json
{
  "type": "analysis",
  "title": "AI Analysis",
  "data": {
    "classification": "MODERATE",
    "confidence": 0.85,
    "recommendation": "REVIEW",
    "summary": "..."
  },
  "position": "top-right"
}
```

### 3. Explainability Overlay (Bottom-Center UI)
```json
{
  "type": "explanation",
  "title": "Why This Decision?",
  "data": {
    "key_reasons": [...],
    "confidence_explanation": "...",
    "next_steps": "REVIEW"
  },
  "position": "bottom-center"
}
```

## MIT-BIH Database

The system uses ECG data from the MIT-BIH Arrhythmia Database:
- Auto-downloads from PhysioNet on first use
- 48 half-hour recordings (360 Hz sampling)
- ~110,000 beat annotations
- Records 107, 117, 118, 207, 217 contain various arrhythmias

Note: "Bradycardia" detection is based on RR intervals (HR < 60 bpm). Some records may have other arrhythmias as well.

## Troubleshooting

### "OpenAI API key not provided"
- Make sure `.env` file exists in `backend/` directory
- Verify `OPENAI_API_KEY=sk-...` is set correctly

### "Module not found"
```bash
cd backend
pip3 install -r requirements.txt
```

### Port already in use
Edit `.env` and change `PORT=8000` to another port

## Next Steps

1. Add your OpenAI API key to `.env`
2. Test the API with `curl` commands above
3. Update frontend to integrate with backend API
4. Customize the UI to display the 3 agent overlays

The backend is fully functional and ready for integration!
