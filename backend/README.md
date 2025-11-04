# MoMe 2.0 Backend - AI Agents for Bradycardia Detection

Backend module with 3 OpenAI-powered agents for ECG analysis and bradycardia detection.

## Architecture

### 3-Agent System

1. **Context Agent** (`agents/context_agent.py`)
   - Extracts EHR data from MIT-BIH Arrhythmia Database
   - Processes ECG signals and annotations
   - Detects bradycardia episodes (HR < 60 bpm)
   - Calculates signal quality metrics

2. **Model Agent** (`agents/model_agent.py`)
   - Uses OpenAI GPT-4 for clinical analysis
   - Classifies bradycardia severity (NONE/MILD/MODERATE/SEVERE)
   - Provides confidence scores
   - Flags episodes requiring review

3. **Explainability Agent** (`agents/explainability_agent.py`)
   - Generates human-readable explanations
   - Explains WHY decisions were made
   - Creates overlay data for frontend UI
   - Supports multiple explanation types (clinical/technical/patient)

## Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and add your OpenAI API key
```

### 3. Run the API Server

```bash
# Development
python api/main.py

# Production
uvicorn api.main:app --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

## API Endpoints

### Health & Info
- `GET /` - API info
- `GET /health` - Health check
- `GET /api/records` - List available bradycardia records

### Analysis
- `POST /api/analyze` - Full 3-agent analysis pipeline
  ```json
  {
    "record_id": "107",
    "explanation_type": "clinical"
  }
  ```

- `POST /api/batch-analyze` - Batch analyze multiple records
- `GET /api/context/{record_id}` - Get patient context only
- `GET /api/episodes/{record_id}` - Get all bradycardia episodes

### ECG Data
- `POST /api/ecg-segment` - Extract ECG signal segment for visualization
  ```json
  {
    "record_id": "107",
    "start_time": 60.0,
    "duration": 10.0
  }
  ```

### UI Integration
- `POST /api/overlay` - Get 3-agent overlay data for frontend

## MIT-BIH Arrhythmia Database

The system uses the MIT-BIH Arrhythmia Database via `wfdb` package:

- **Records with prominent bradycardia**: 107, 117, 118, 207, 217
- **Sampling rate**: 360 Hz
- **Duration**: ~30 minutes per record
- **Annotations**: ~110,000 beat annotations including bradycardia

Data is automatically downloaded from PhysioNet on first use.

## Frontend Integration

The 3 agents provide overlay data for the frontend UI:

### 1. Context Overlay (Top-Left)
```json
{
  "type": "context",
  "title": "Patient Context",
  "data": {
    "record_id": "107",
    "duration_min": 30.0,
    "total_beats": 2137,
    "quality_score": "high",
    "key_metrics": [...]
  }
}
```

### 2. Model Overlay (Top-Right)
```json
{
  "type": "analysis",
  "title": "AI Analysis",
  "data": {
    "classification": "MODERATE",
    "confidence": 0.85,
    "recommendation": "REVIEW",
    "summary": "..."
  }
}
```

### 3. Explainability Overlay (Bottom-Center)
```json
{
  "type": "explanation",
  "title": "Why This Decision?",
  "data": {
    "key_reasons": [...],
    "confidence_explanation": "...",
    "next_steps": "REVIEW"
  }
}
```

## Example Usage

### Python
```python
from agents import ContextAgent, ModelAgent, ExplainabilityAgent

# Initialize agents
context_agent = ContextAgent()
model_agent = ModelAgent()
explainability_agent = ExplainabilityAgent()

# Analyze a record
context = context_agent.extract_patient_context('107')
analysis = model_agent.analyze_bradycardia(context)
explanation = explainability_agent.explain_decision(context, analysis)

print(f"Classification: {analysis['classification']}")
print(f"Confidence: {analysis['confidence']:.0%}")
print(f"Summary: {explanation['summary']}")
```

### cURL
```bash
# Analyze record 107
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"record_id": "107", "explanation_type": "clinical"}'

# Get bradycardia episodes
curl http://localhost:8000/api/episodes/107

# Get ECG segment
curl -X POST http://localhost:8000/api/ecg-segment \
  -H "Content-Type: application/json" \
  -d '{"record_id": "107", "start_time": 60.0, "duration": 10.0}'
```

## Testing

Test with known bradycardia records:

```bash
# Test Context Agent
python -c "
from agents.context_agent import ContextAgent
agent = ContextAgent()
context = agent.extract_patient_context('107')
print(f'Found {len(context[\"bradycardia_events\"])} bradycardia episodes')
"

# Test full pipeline
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"record_id": "107"}'
```

## Environment Variables

- `OPENAI_API_KEY` - Your OpenAI API key (required)
- `OPENAI_MODEL` - Model to use (default: gpt-4-turbo-preview)
- `PORT` - API server port (default: 8000)

## Project Structure

```
backend/
├── agents/
│   ├── __init__.py
│   ├── context_agent.py          # EHR data extraction
│   ├── model_agent.py             # OpenAI analysis
│   └── explainability_agent.py    # Decision explanations
├── api/
│   └── main.py                    # FastAPI server
├── data/                          # MIT-BIH data (auto-downloaded)
├── requirements.txt
├── .env.example
└── README.md
```

## License

Proprietary - TriFtech Inc.
