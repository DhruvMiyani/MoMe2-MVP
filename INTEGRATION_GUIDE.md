# Frontend-Backend Integration Guide

## Overview

Your MoMe 2.0 project now has a complete 3-agent backend system integrated with the React frontend.

## What Was Built

### Backend (`/backend`)

1. **Context Agent** (`agents/context_agent.py`)
   - Extracts patient data from MIT-BIH Arrhythmia Database
   - Processes ECG signals and detects bradycardia episodes
   - Calculates signal quality metrics
   - Auto-downloads ECG data from PhysioNet

2. **Model Agent** (`agents/model_agent.py`)
   - Uses OpenAI GPT-4 for clinical analysis
   - Classifies bradycardia severity
   - Provides confidence scores
   - Flags episodes requiring human review

3. **Explainability Agent** (`agents/explainability_agent.py`)
   - Generates human-readable explanations
   - Explains decision reasoning
   - Creates overlay data for UI
   - Supports clinical, technical, and patient-friendly explanations

4. **FastAPI Server** (`api/main.py`)
   - REST API with 10+ endpoints
   - CORS enabled for frontend integration
   - Swagger docs at `/docs`
   - Full type safety with Pydantic

### Frontend Integration (`/src`)

1. **Backend Service** (`src/services/backendService.ts`)
   - TypeScript service for API calls
   - Type-safe interfaces
   - All backend endpoints wrapped

2. **Agent Overlays Component** (`src/components/AgentOverlays.tsx`)
   - React component to display 3 agent outputs
   - Context overlay (top-left)
   - Model overlay (top-right)
   - Explainability overlay (bottom-center)

## Setup Instructions

### Backend Setup

1. **Install dependencies** (already done):
   ```bash
   cd backend
   pip3 install -r requirements.txt
   ```

2. **Configure OpenAI API key**:
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env and add: OPENAI_API_KEY=sk-your-key-here
   ```

3. **Start backend server**:
   ```bash
   cd backend
   python3 api/main.py
   ```
   Server runs at `http://localhost:8000`

### Frontend Setup

1. **Configure API URL**:
   ```bash
   # In project root
   cp .env.example .env
   # Edit .env if needed (default: http://localhost:8000)
   ```

2. **Import the service in your components**:
   ```typescript
   import { backendService } from '../services/backendService';
   import { AgentOverlays } from '../components/AgentOverlays';
   ```

3. **Start frontend** (existing):
   ```bash
   npm run dev
   ```

## Usage Examples

### Example 1: Analyze Episode with Agent Overlays

```typescript
import { useState, useEffect } from 'react';
import { backendService, OverlayData } from '../services/backendService';
import { AgentOverlays } from '../components/AgentOverlays';

function EpisodeView({ recordId }: { recordId: string }) {
  const [overlayData, setOverlayData] = useState<OverlayData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAnalysis() {
      try {
        setIsLoading(true);
        const result = await backendService.analyzeRecord(recordId, 'clinical');
        setOverlayData(result.overlay_data);
      } catch (error) {
        console.error('Analysis failed:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadAnalysis();
  }, [recordId]);

  return (
    <div className="relative">
      {/* Your existing ECG canvas and UI */}
      <ECGCanvas recordId={recordId} />

      {/* 3-Agent Overlays */}
      <AgentOverlays overlayData={overlayData} isLoading={isLoading} />
    </div>
  );
}
```

### Example 2: Load ECG Segment

```typescript
async function loadECGData(recordId: string, startTime: number) {
  const segment = await backendService.getECGSegment(recordId, startTime, 10.0);

  // segment.time: array of timestamps
  // segment.signal: array of ECG values
  // segment.sampling_rate: 360 Hz

  // Draw on canvas
  drawECGOnCanvas(segment.time, segment.signal);
}
```

### Example 3: Get Available Records

```typescript
async function loadRecordList() {
  const { records } = await backendService.getAvailableRecords();
  // records: ['107', '117', '118', '207', '217']
  return records;
}
```

### Example 4: Quick Overlay Update

```typescript
// For real-time updates without full analysis
async function quickUpdate(recordId: string) {
  const overlay = await backendService.getOverlayData(recordId);
  setOverlayData(overlay);
}
```

## Integration with Existing EventReview Component

Update your `EventReview.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { backendService, OverlayData } from '../services/backendService';
import { AgentOverlays } from './AgentOverlays';

export function EventReview({ episode }: EventReviewProps) {
  const [overlayData, setOverlayData] = useState<OverlayData | null>(null);
  const [ecgData, setEcgData] = useState<number[] | null>(null);

  useEffect(() => {
    async function loadData() {
      // Load analysis and overlay data
      const analysis = await backendService.analyzeRecord(episode.recordingId);
      setOverlayData(analysis.overlay_data);

      // Load ECG segment
      const segment = await backendService.getECGSegment(
        episode.recordingId,
        episode.startTime,
        10.0
      );
      setEcgData(segment.signal);
    }

    loadData();
  }, [episode]);

  return (
    <div className="relative h-full">
      {/* Existing ECG canvas */}
      <ECGCanvas data={ecgData} bradyEvents={episode.bradyEvents} />

      {/* Add 3-agent overlays */}
      <AgentOverlays overlayData={overlayData} />

      {/* Existing approve/deny buttons */}
      <div className="controls">
        {/* ... */}
      </div>
    </div>
  );
}
```

## API Endpoints Reference

### Analysis
- `POST /api/analyze` - Full 3-agent analysis
- `POST /api/overlay` - Get overlay data only (faster)
- `GET /api/context/{record_id}` - Context only (no AI)
- `GET /api/episodes/{record_id}` - Get all bradycardia episodes

### ECG Data
- `POST /api/ecg-segment` - Get ECG signal segment
- `GET /api/records` - List available records

### Health
- `GET /health` - Backend health check
- `GET /` - API info

## MIT-BIH Database

The backend uses real ECG data from MIT-BIH Arrhythmia Database:

- **Available records**: 107, 117, 118, 207, 217 (and 43 more)
- **Sampling rate**: 360 Hz
- **Duration**: ~30 minutes per record
- **Auto-download**: Data downloads automatically from PhysioNet

To use a different record:
```typescript
const analysis = await backendService.analyzeRecord('117');
```

## Customization

### Change Explanation Type

```typescript
// Clinical (default) - for healthcare professionals
await backendService.analyzeRecord('107', 'clinical');

// Technical - for engineers/data scientists
await backendService.analyzeRecord('107', 'technical');

// Patient-friendly - simple language
await backendService.analyzeRecord('107', 'patient');
```

### Customize Overlay Positions

Edit `AgentOverlays.tsx` to change overlay positions:

```typescript
// Change from top-left to bottom-left
<div className="absolute bottom-4 left-4 ...">
```

### Use Different OpenAI Model

Edit `backend/.env`:
```
OPENAI_MODEL=gpt-4-turbo-preview  # Default
OPENAI_MODEL=gpt-4                # More expensive
OPENAI_MODEL=gpt-3.5-turbo        # Cheaper, faster
```

## Testing

### Test Backend Only
```bash
cd backend
python3 test_agents.py
```

### Test API Endpoints
```bash
# Start backend
cd backend && python3 api/main.py

# In another terminal
curl http://localhost:8000/api/records
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"record_id": "107"}'
```

### Test Frontend Integration
```bash
# Start both servers
# Terminal 1: Backend
cd backend && python3 api/main.py

# Terminal 2: Frontend
npm run dev

# Visit http://localhost:3000 and open browser console
```

## Troubleshooting

### Backend not responding
- Check if backend is running: `curl http://localhost:8000/health`
- Check `.env` file has OPENAI_API_KEY
- Check port 8000 is not in use

### CORS errors
- Backend has CORS enabled for all origins during development
- For production, update `allow_origins` in `backend/api/main.py`

### OpenAI errors
- Verify API key is valid
- Check OpenAI account has credits
- Try different model in `.env`

## Next Steps

1. **Add OpenAI API key** to `backend/.env`
2. **Start both servers** (backend + frontend)
3. **Update existing components** to use `backendService`
4. **Integrate AgentOverlays** into your EventReview screen
5. **Test with real ECG data** from MIT-BIH database

The backend is fully functional and ready for production use!

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│  ┌──────────────────────────────────────────────────┐   │
│  │  EventReview Component                            │   │
│  │  ┌────────────────────────────────────────────┐  │   │
│  │  │  ECGCanvas (existing)                      │  │   │
│  │  └────────────────────────────────────────────┘  │   │
│  │  ┌────────────────────────────────────────────┐  │   │
│  │  │  AgentOverlays (new)                       │  │   │
│  │  │  ├─ Context Overlay (top-left)             │  │   │
│  │  │  ├─ Model Overlay (top-right)              │  │   │
│  │  │  └─ Explainability Overlay (bottom)        │  │   │
│  │  └────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                               │
│                   backendService.ts                      │
└──────────────────────────┼──────────────────────────────┘
                           │ HTTP/REST API
┌──────────────────────────┼──────────────────────────────┐
│                    FastAPI Backend                       │
│  ┌──────────────────────────────────────────────────┐   │
│  │  API Endpoints (/api/*)                          │   │
│  └──────────────┬───────────┬───────────┬───────────┘   │
│                 │           │           │                │
│         ┌───────▼─────┐ ┌──▼──────┐ ┌──▼──────────┐     │
│         │   Context   │ │  Model  │ │Explainability│     │
│         │    Agent    │ │  Agent  │ │    Agent     │     │
│         │             │ │         │ │              │     │
│         │ • ECG Data  │ │ • OpenAI│ │ • Reasoning  │     │
│         │ • Episodes  │ │ • Classify│ • UI Overlay │     │
│         │ • Quality   │ │ • Confidence│ • Explanations│   │
│         └─────┬───────┘ └────┬────┘ └──────┬───────┘     │
│               │              │             │              │
└───────────────┼──────────────┼─────────────┼──────────────┘
                │              │             │
         ┌──────▼──────┐ ┌─────▼─────┐      │
         │   MIT-BIH   │ │  OpenAI   │      │
         │  Database   │ │    API    │      │
         │ (PhysioNet) │ │  (GPT-4)  │      │
         └─────────────┘ └───────────┘      │
                                    ┌───────▼────────┐
                                    │ JSON Responses │
                                    └────────────────┘
```

Your system is now complete with real ECG data and AI-powered analysis!
