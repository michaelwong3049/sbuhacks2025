# 🎵 Airstrument – Turn Your Movement Into Music

## Inspiration

Music creation is deeply human — but playing an instrument requires physical access, space, and equipment.

We asked: **what if anyone could play music anywhere, using nothing but their hands and a webcam?**

Airstrument transforms your webcam into an intelligent motion-tracking stage, letting you play virtual instruments in midair — no hardware required.

## What It Does

Airstrument uses real-time pose tracking and motion analysis to detect hand movements, interpret them as musical actions, and generate authentic instrument sounds.

You can choose an instrument (like drums or guitar), position yourself as guided by the UI, and then start performing.

When you strum, hit, or move your hands, the app detects your motion zones and velocities — and plays the corresponding notes or beats instantly.

## How We Built It

- **Frontend:** React + Tailwind + Tone.js for the interface and sound engine
- **Vision Layer:** MediaPipe Pose for real-time hand, wrist, and body tracking directly in the browser (WebGL)
- **Logic Layer:** Custom motion detection algorithms analyze wrist velocity, direction, and position to detect hits and strums
- **Backend (optional):** Node.js WebSocket server for real-time event streaming and multiplayer visualization

## Challenges We Ran Into

- Translating noisy 3D pose data into consistent, playable actions
- Managing latency between camera input and sound playback
- Designing intuitive calibration so players naturally align their "air instruments" with the screen

## Accomplishments That We're Proud Of

- Built a fully playable air drum and air guitar prototype in less than 24 hours
- Achieved <100ms motion-to-sound latency using local pose processing
- Designed a modular system where new instruments can be added with custom zone maps and sounds
- Created a simple yet magical experience that lets anyone play music through movement

## What We Learned

Combining computer vision and sound synthesis demands real-time precision and user-friendly calibration.

MediaPipe's hand and body tracking opened new creative possibilities, and optimizing motion thresholds was key to making performance feel natural.

## What's Next for Airstrument

- Add multiplayer "jam sessions" via WebRTC
- Expand instrument library (piano, violin, DJ pads)
- Integrate gesture-based recording and looping
- Launch as an open-source toolkit for creative coders, educators, and accessibility-focused musicians

## Tagline

🎵 **Airstrument — turn your movement into music.**

---

## Project Structure

See `TEAM_ASSIGNMENTS.md` for detailed folder structure and team member responsibilities.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Tech Stack

- **Framework:** Next.js 16
- **UI:** React 19 + Tailwind CSS
- **Vision:** MediaPipe Hands/Pose
- **Audio:** Tone.js
- **Language:** TypeScript
- **Backend (optional):** Node.js + WebSocket
