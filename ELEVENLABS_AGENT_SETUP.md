# 🎹 ElevenLabs Agent Setup for Piano Coaching

This guide explains how to configure your ElevenLabs Conversational AI agent to work as a piano coach in the Learn tab.

## 📋 Overview

The Learn tab uses ElevenLabs Conversational AI to provide real-time voice coaching as students play the piano. The agent:
- **Hears** the student via microphone
- **Sees** what notes are being played (via contextual updates)
- **Guides** through 5 progressive lessons
- **Provides** real-time feedback and encouragement

## 🔧 Agent Configuration in ElevenLabs Dashboard

### 1. Client Tools Setup

You need to configure the following **Client Tools** in your ElevenLabs agent settings:

#### Tool 1: `start_lesson_exercise`
- **Description**: "Start a new lesson exercise. Use this to begin a lesson with specific target notes."
- **Parameters**:
  - `exerciseName` (string, required): Name of the exercise (e.g., "Single Note C4")
  - `targetNotes` (array of strings, required): Array of note names to play (e.g., ["C4", "E4"])
  - `tempo` (number, optional): Tempo in BPM (default: 60)
- **Blocking**: Yes (agent should wait for response)

#### Tool 2: `update_lesson_phase`
- **Description**: "Update the current lesson phase (intro, demonstration, practice, feedback, completed)."
- **Parameters**:
  - `phase` (string, required): One of "intro", "demonstration", "practice", "feedback", "completed"
- **Blocking**: Yes

#### Tool 3: `play_demonstration`
- **Description**: "Play a demonstration of the target notes. Use this to show the student what to play."
- **Parameters**:
  - `notes` (array of strings, required): Array of notes to demonstrate (e.g., ["C4", "E4", "G4"])
- **Blocking**: No (agent can continue talking)

#### Tool 4: `get_performance_metrics`
- **Description**: "Get the student's current performance metrics (accuracy, attempts, etc.)."
- **Parameters**: None
- **Blocking**: Yes

#### Tool 5: `move_to_next_lesson` (Optional)
- **Description**: "Move to the next lesson after the current one is completed."
- **Parameters**: None
- **Blocking**: Yes

### 2. Agent Prompt/System Message

Configure your agent with this system message or similar:

```
You are a friendly and encouraging piano teacher coaching a student through interactive piano lessons.

LESSON STRUCTURE:
There are 5 progressive lessons. IMPORTANT: The student can only use TWO INDEX FINGERS (one on each hand). They cannot use thumbs or other fingers. Design lessons accordingly:
1. Single Note C4 - Play a single note (C4) accurately with either index finger
2. Two Notes C4-E4 - Play two notes (C4 and E4) in sequence using left and right index fingers
3. Five Note Sequence - Play five notes (C-D-E-F-G) by alternating between two index fingers
4. Simple Melody - Play a melody pattern (C-E-G-E-C) using two index fingers
5. Rhythm Exercise - Practice rhythm (C-C-E-E-G-G-C-C) using two index fingers

YOUR ROLE:
- Welcome the student warmly when they start
- Guide them through each lesson step by step
- Demonstrate the target notes before asking them to play
- Provide real-time feedback when they play notes
- Encourage them and celebrate their progress
- Move to the next lesson when they meet the success criteria

COACHING STYLE:
- Be positive and encouraging
- Give specific, actionable feedback
- Use the student's name if provided
- Celebrate successes, even small ones
- Be patient and supportive when they make mistakes
- Provide helpful tips for improvement
- REMEMBER: Student only has TWO INDEX FINGERS available (one left, one right)
- Never ask them to use thumbs or other fingers - they can only use index fingers
- When teaching sequences, remind them to alternate between left and right index fingers

WORKFLOW:
1. When a lesson starts, use `start_lesson_exercise` with the lesson details
2. Explain what they'll be learning
3. Use `play_demonstration` to show the target notes
4. Move to practice phase using `update_lesson_phase`
5. Listen for their playing and provide feedback via contextual updates
6. When they meet success criteria, congratulate them and offer to move to the next lesson

REAL-TIME FEEDBACK:
- You'll receive contextual updates when the student plays notes
- Format: "Student just played note X. Target was Y. Correct/Incorrect."
- Respond immediately with encouragement or gentle correction
- Use `get_performance_metrics` to check their progress if needed

Remember: You're here to help them learn and have fun! Be enthusiastic and supportive.
```

### 3. First Message

Set a welcoming first message like:

```
Hi! I'm your piano coach. I'm excited to help you learn piano with Airstrument! 

Are you ready to start your first lesson? We'll begin with playing a single note - C4. It's the foundation of everything we'll learn together!

Let me know when you're ready, and I'll guide you through it step by step.
```

## 🎯 How It Works

### 1. Lesson Flow
1. **Student clicks "Start Lesson"** → Connects to ElevenLabs
2. **Agent greets student** → Introduces the lesson
3. **Agent calls `start_lesson_exercise`** → Sets up the lesson
4. **Agent demonstrates** → Calls `play_demonstration` (or explains verbally)
5. **Student practices** → Plays notes on paper piano
6. **Real-time feedback** → Agent receives contextual updates and responds
7. **Lesson completion** → Agent congratulates and offers next lesson

### 2. Real-Time Communication

When a student plays a note:
- Frontend sends contextual update: `"Student just played note C4. Target was C4. Correct!"`
- Agent receives this and can respond immediately
- Agent can provide encouragement or correction

### 3. Lesson Progression

The agent guides through 5 lessons:
- **Lesson 1**: Single note (C4) - 80% accuracy, 5 attempts
- **Lesson 2**: Two notes (C4-E4) - 75% accuracy, 8 attempts
- **Lesson 3**: Five-finger pattern - 70% accuracy, 10 attempts
- **Lesson 4**: Simple melody - 65% accuracy, 12 attempts
- **Lesson 5**: Rhythm exercise - 60% accuracy, 15 attempts

## 📝 Testing

1. **Start the servers**:
   ```bash
   # Terminal 1: WebSocket server
   npm run server:dev
   
   # Terminal 2: Next.js dev server
   npm run dev
   ```

2. **Go to Learn tab**: `http://localhost:3000/learn`

3. **Click "Start Lesson"**: Should connect to ElevenLabs

4. **Talk to the agent**: Say "I'm ready to start" or "Let's begin"

5. **Play notes**: Use the paper piano - agent should respond to your playing

## 🐛 Troubleshooting

### Agent doesn't respond to note playing
- Check browser console for contextual update logs
- Verify `sendContextualUpdate` is being called
- Check ElevenLabs dashboard for agent logs

### Agent doesn't call tools
- Verify client tools are configured in ElevenLabs dashboard
- Check that tool names match exactly (case-sensitive)
- Ensure tools are set to "blocking" if needed

### Agent doesn't hear the student
- Check microphone permissions in browser
- Verify microphone is working in other apps
- Check ElevenLabs connection status

## 🎨 Customization

You can customize:
- **Lesson structure**: Edit `app/lib/lessons/lesson-structure.ts`
- **Agent personality**: Update the system message in ElevenLabs dashboard
- **Success criteria**: Adjust in lesson structure file
- **Feedback style**: Modify agent prompt

## 📚 Next Steps

1. Configure the agent in ElevenLabs dashboard with the tools and prompt above
2. Test the connection and voice interaction
3. Try playing notes and see if the agent responds
4. Adjust the agent's personality and feedback style as needed

Enjoy your interactive piano coaching! 🎹🎵

