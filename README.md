# MoMe 2.0 - Bradycardia HITL

A **Human-in-the-Loop (HITL)** UI for triaging and reviewing bradycardia episodes detected from MoMe ECG traces.

## Features

✅ **Triage Worklist** - Inbox view for technicians with filters and sorting
✅ **Event Review** - Full-width ECG canvas with zoom/pan and red bradycardia overlays
✅ **Approve/Deny Actions** - One-click or keyboard shortcuts (A/D)
✅ **Confidence Scoring** - ML confidence chips with explainability
✅ **Quality Flags** - Signal quality indicators
✅ **Analytics Dashboard** - Coverage, review times, and audit log
✅ **Keyboard Shortcuts** - A = Approve, D = Deny, ESC = Back
✅ **Dark Mode** - Clinical dark theme for reduced eye strain

## Tech Stack

- **React 18** + **TypeScript**
- **Vite** - Fast development and build
- **Tailwind CSS** - Utility-first styling
- **Zustand** - Lightweight state management
- **Canvas API** - High-performance ECG rendering
- **Lucide React** - Icon library
- **HeadlessUI** - Accessible components

## Getting Started

### Install dependencies
\`\`\`bash
npm install
\`\`\`

### Run development server
\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for production
\`\`\`bash
npm run build
\`\`\`

## Project Structure

```
src/
├── components/
│   ├── Navigation.tsx          # Top navigation bar
│   ├── TriageWorklist.tsx      # Main worklist/inbox
│   ├── EventReview.tsx         # Review screen with ECG
│   ├── ECGCanvas.tsx           # ECG renderer with zoom/pan
│   ├── Analytics.tsx           # Metrics and audit log
│   ├── ConfidenceChip.tsx      # Confidence score badge
│   ├── QualityBadge.tsx        # Signal quality indicator
│   └── StatusBadge.tsx         # Episode status badge
├── utils/
│   └── mockData.ts             # Mock ECG data generator
├── types.ts                    # TypeScript interfaces
├── store.ts                    # Zustand state management
├── App.tsx                     # Main app component
└── main.tsx                    # Entry point
```

## Usage

### Triage Worklist
- View all episodes with confidence scores and quality flags
- Filter by "Needs Review" status
- Sort by confidence (lowest first) or time (newest first)
- Search by episode or recording ID
- Click "Review" to open an episode

### Event Review
- **Zoom**: Scroll wheel on canvas
- **Pan**: Click and drag on canvas
- **Approve**: Click button or press **A**
- **Deny**: Click button or press **D** (opens reason dialog)
- **Back**: Press **ESC** or click "Back to Worklist"

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| A | Approve episode |
| D | Deny episode |
| ESC | Back to worklist |
| 1-6 | Select deny reason (when dialog open) |

## Architecture

### Hybrid CDS Design
- **Bolt-on** to existing MoMe pipeline (no changes to cleared devices)
- **Selective prediction**: Auto-approve high confidence (≥80%), route ~20% for human review
- **Explainability**: Plain language explanations for every detection
- **Audit trail**: Immutable log of all decisions

### Data Flow
1. MoMe API → ECG segments + metadata
2. Brady Engine → `{episodes, confidence, explanation, quality}`
3. Triage Orchestrator → Apply selective-prediction policy
4. UI → Human review for borderline cases
5. Audit Log → Store outcomes for continuous learning

## Configuration

### Confidence Threshold
Default threshold for auto-approval: **0.80**
Target human review coverage: **~20%**

### Mock Data
The app uses synthetic ECG data for demonstration. To connect to real data:
1. Replace `generateMockECGData()` in `EventReview.tsx` with API call
2. Update `generateMockEpisodes()` in `App.tsx` to fetch from backend
3. Configure API endpoints in `.env`

## License

Proprietary - TriFtech Inc.
