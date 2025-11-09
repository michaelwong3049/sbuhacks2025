## Inspiration
Playing music usually means owning instruments and having space to use them. We wanted to make music creation as accessible as possible — no gear, no setup, just motion. With Airstrument, anyone can play music anywhere using only their hands and a webcam.

## What it does
Airstrument turns your webcam into a motion-controlled instrument. It tracks your hands in real time and maps gestures to musical sounds — like air drums you can actually play.
- Air Drums: Strike down for snares and kicks, swipe sideways for cymbals
- Tracking: Uses MediaPipe Hands to detect 21 landmarks per hand at 30+ FPS
- Motion detection: Calculates direction and speed to distinguish hits from casual movement
- Visual feedback: Shows hit zones and animations for clear timing
- Multiplayer: WebRTC peer-to-peer lets multiple users jam together live

## How we built it
- Frontend: React + Next.js + Tailwind CSS
- Vision layer: MediaPipe Hands (CDN-based), with custom coordinate transforms for mirrored video
- Audio engine: Tone.js with FM synthesis for realistic drums
- Motion logic: Velocity- and direction-based hit detection, with dual cooldowns to prevent false triggers
- Multiplayer: WebRTC peer connections to sync sound events across browsers

## Challenges we ran into
- Aligning coordinate systems between MediaPipe (normalized) and the canvas (pixels)
- Filtering out noise from hand movement without breaking responsiveness
- Handling module imports and browser compatibility for MediaPipe
- Tuning velocity thresholds to feel natural for different users

## Accomplishments
- Built a working air drums prototype with <100 ms latency
- Designed a modular system for adding new instruments
- Created stable real-time motion tracking entirely in the browser
- Added synchronized multiplayer jamming via WebRTC
- What we learned
- Real-time gesture-to-sound requires tight optimization — every frame counts
- Edge detection and cooldown logic are key for reliable motion input
- Browser-based ML (MediaPipe + WebGL) is powerful enough for responsive music performance

## What’s next
- Add more instruments (piano, tambourine, triangle)
- Improve multiplayer with real-time hand visualization
- Add gesture-based recording and looping
- Open-source the framework for creative coders and accessibility projects
