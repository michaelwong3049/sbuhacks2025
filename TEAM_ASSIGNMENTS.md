# 🎵 Airstrument - Team Assignments

## Project Structure Overview

```
sbuhacks2025/
├── app/
│   ├── components/          # React UI Components
│   │   ├── ui/              # Reusable UI elements
│   │   ├── instruments/     # Instrument-specific components
│   │   └── calibration/     # Calibration UI
│   ├── lib/                 # Core Logic
│   │   ├── vision/          # MediaPipe integration
│   │   ├── motion/          # Motion detection algorithms
│   │   ├── sound/           # Tone.js sound engine
│   │   └── utils/           # Shared utilities
│   ├── hooks/               # Custom React hooks
│   ├── types/               # TypeScript definitions
│   └── page.tsx             # Main app page
├── server/                   # Backend (optional)
│   ├── routes/              # API routes
│   ├── services/            # Business logic
│   └── types/               # Server types
└── public/                   # Static assets
    ├── sounds/              # Audio samples
    └── assets/              # Images, icons
```

---

## 👥 Team Member Assignments

### 🎨 **Team Member 1: Frontend Developer**
**Focus:** React UI, Components, User Experience

**Your Folders:**
- `app/components/ui/` - Build all reusable UI components
- `app/components/instruments/` - Build instrument visualization components
- `app/components/calibration/` - Build calibration UI
- `app/hooks/` - Create custom React hooks for state management
- `app/page.tsx` - Main app layout and routing

**Key Tasks:**
- Design and build the instrument selection UI
- Create calibration wizard flow
- Build visual feedback for hand tracking
- Design instrument zone visualizations
- Implement responsive layout with Tailwind CSS

**Dependencies:**
- Will use hooks from `app/hooks/` (created by others)
- Will use types from `app/types/`
- Will integrate with sound engine (Team Member 4)

---

### 👁️ **Team Member 2: Computer Vision Developer**
**Focus:** MediaPipe Integration, Camera Management

**Your Folders:**
- `app/lib/vision/` - All MediaPipe integration code
- `app/types/mediapipe.ts` - MediaPipe type definitions

**Key Tasks:**
- Initialize MediaPipe Hands/Pose
- Manage camera stream
- Extract hand/wrist landmarks from MediaPipe results
- Provide clean API for other developers to use
- Handle camera permissions and errors

**Files to Create:**
- `app/lib/vision/mediapipe-handler.ts`
- `app/lib/vision/camera-manager.ts`
- `app/lib/vision/tracking-utils.ts`
- `app/hooks/useMediaPipe.ts` - React hook wrapper

**Dependencies:**
- Will provide data to motion detection (Team Member 3)
- Will be used by frontend components (Team Member 1)

---

### 🧠 **Team Member 3: Motion Detection Developer**
**Focus:** Motion Analysis, Gesture Recognition

**Your Folders:**
- `app/lib/motion/` - All motion detection algorithms
- `app/types/motion.ts` - Motion-related types

**Key Tasks:**
- Calculate hand/wrist velocities from pose data
- Detect when hands enter instrument zones
- Recognize gestures (strum, hit, tap)
- Tune thresholds for natural feel
- Map motion events to musical actions

**Files to Create:**
- `app/lib/motion/motion-detector.ts` - Main detection engine
- `app/lib/motion/velocity-calculator.ts`
- `app/lib/motion/zone-detector.ts`
- `app/lib/motion/gesture-recognizer.ts`
- `app/lib/motion/thresholds.ts` - Configurable thresholds
- `app/hooks/useMotionDetection.ts` - React hook wrapper

**Dependencies:**
- Receives data from vision layer (Team Member 2)
- Sends events to sound engine (Team Member 4)
- Uses types from `app/types/`

---

### 🎵 **Team Member 4: Sound Engineer**
**Focus:** Tone.js Integration, Sound Generation

**Your Folders:**
- `app/lib/sound/` - All sound generation code
- `app/types/instruments.ts` - Instrument type definitions
- `public/sounds/` - Audio samples (if using samples)

**Key Tasks:**
- Initialize Tone.js sound engine
- Create instrument classes (DrumKit, Guitar)
- Generate sounds based on motion events
- Optimize for low latency (<100ms)
- Design instrument zone mappings

**Files to Create:**
- `app/lib/sound/sound-engine.ts` - Main sound engine
- `app/lib/sound/instruments/base-instrument.ts` - Base class
- `app/lib/sound/instruments/drum-kit.ts`
- `app/lib/sound/instruments/guitar.ts`
- `app/hooks/useSoundEngine.ts` - React hook wrapper

**Dependencies:**
- Receives events from motion detection (Team Member 3)
- Provides API for frontend components (Team Member 1)

---

### 🌐 **Optional: Backend Developer** (if doing multiplayer)
**Focus:** WebSocket Server, Multiplayer

**Your Folders:**
- `server/` - All backend code

**Key Tasks:**
- Set up Node.js WebSocket server
- Handle multiplayer sessions
- Broadcast motion events between clients
- Manage room/player state

---

## 🔄 Integration Points

### Data Flow:
```
Camera → MediaPipe (Team 2) → Landmarks
Landmarks → Motion Detection (Team 3) → Events
Events → Sound Engine (Team 4) → Audio
All → Frontend UI (Team 1) → User Experience
```

### Shared Resources:
- `app/types/` - Everyone uses these types
- `app/lib/utils/` - Shared utility functions
- `app/hooks/` - React hooks (each person creates their own)

---

## 📋 Getting Started Checklist

### For Everyone:
- [ ] Read the project vision statement
- [ ] Set up your assigned folders
- [ ] Create initial TypeScript files (even if empty)
- [ ] Define interfaces/types you'll need
- [ ] Set up communication channel (Slack/Discord)

### Team Member 1 (Frontend):
- [ ] Design UI mockups/wireframes
- [ ] Set up component structure
- [ ] Create placeholder components

### Team Member 2 (Vision):
- [ ] Test MediaPipe Hands in browser
- [ ] Create camera initialization
- [ ] Extract landmark data structure

### Team Member 3 (Motion):
- [ ] Define motion event types
- [ ] Create velocity calculation functions
- [ ] Design zone detection algorithm

### Team Member 4 (Sound):
- [ ] Set up Tone.js
- [ ] Create basic sound generation
- [ ] Test latency

---

## 🚀 Next Steps

1. **Team Sync Meeting** - Discuss interfaces between layers
2. **Define API Contracts** - How each layer communicates
3. **Start Coding** - Each person works in their assigned folders
4. **Daily Standups** - Quick sync on progress and blockers

---

## 📝 Notes

- **No conflicts:** Each person works in separate folders
- **Type safety:** Use TypeScript types to ensure compatibility
- **Modular:** Each layer can be developed independently
- **Testable:** Each module can be tested in isolation

Good luck! 🎵✨

