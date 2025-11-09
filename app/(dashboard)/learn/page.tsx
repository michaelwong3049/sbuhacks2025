"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Play, Square, Volume2, VolumeX } from "lucide-react";
import { useVoiceAgent } from "@/app/hooks/use-voice-agent";
import type { ToolCallData, AttemptData } from "@/app/hooks/use-voice-agent";
import PianoPlayer from "@/components/practice/instruments/piano-player";

type LessonPhase = "intro" | "demonstration" | "practice" | "feedback" | "completed";

export default function LearnPage() {
  const [lessonActive, setLessonActive] = useState(false);
  const [lessonPhase, setLessonPhase] = useState<LessonPhase>("intro");
  const [currentExercise, setCurrentExercise] = useState<string | null>(null);
  const [targetNotes, setTargetNotes] = useState<string[]>([]);
  const [progress, setProgress] = useState({ completed: 0, total: 5 });
  const [isMuted, setIsMuted] = useState(false);
  const [agentSpeech, setAgentSpeech] = useState<string>("");
  const [performanceMetrics, setPerformanceMetrics] = useState({
    accuracy: 0,
    attempts: 0,
    successRate: "0/0",
  });

  const {
    state: agentState,
    isConnected,
    error: agentError,
    connect,
    disconnect,
    sendPerformanceUpdate,
    setOnToolCall,
    setOnAgentSpeaking,
    setOnAgentListening,
  } = useVoiceAgent();

  // Set up callbacks for voice agent
  useEffect(() => {
    setOnAgentSpeaking((text: string) => {
      console.log("🗣️ Agent speaking:", text);
      setAgentSpeech(text);
    });

    setOnAgentListening(() => {
      console.log("👂 Agent is listening...");
    });

    setOnToolCall((toolCall: ToolCallData) => {
      console.log("🔧 Tool call received:", toolCall);
      handleToolCall(toolCall);
    });
  }, [setOnAgentSpeaking, setOnAgentListening, setOnToolCall]);

  // Handle tool calls from the agent
  const handleToolCall = (toolCall: ToolCallData) => {
    switch (toolCall.tool_name) {
      case "start_lesson_exercise":
        if (toolCall.parameters?.exerciseName) {
          setCurrentExercise(toolCall.parameters.exerciseName);
        }
        if (toolCall.parameters?.targetNotes) {
          const notes = Array.isArray(toolCall.parameters.targetNotes)
            ? toolCall.parameters.targetNotes
            : toolCall.parameters.targetNotes.split(",").map((n: string) => n.trim());
          setTargetNotes(notes);
        }
        setLessonPhase("demonstration");
        break;

      case "play_demonstration":
        // Demonstration is handled by the agent speaking
        setLessonPhase("practice");
        break;

      case "update_lesson_phase":
        if (toolCall.parameters?.phase) {
          setLessonPhase(toolCall.parameters.phase as LessonPhase);
        }
        break;

      case "get_performance_metrics":
        // Metrics are sent to the agent automatically
        break;

      default:
        console.warn("Unknown tool call:", toolCall.tool_name);
    }
  };

  const handleStartLesson = () => {
    setLessonActive(true);
    setLessonPhase("intro");
    connect();
  };

  const handleStopLesson = async () => {
    setLessonActive(false);
    setLessonPhase("intro");
    setCurrentExercise(null);
    setTargetNotes([]);
    setAgentSpeech("");
    await disconnect();
  };

  // Send performance update when a note is played
  const handleNotePlayed = (noteName: string, keyIndex: number) => {
    if (!lessonActive || lessonPhase !== "practice" || targetNotes.length === 0) {
      return;
    }

    const targetNote = targetNotes[0]; // For now, use first target note
    const isCorrect = noteName === targetNote;
    const attempt: AttemptData = {
      timestamp: Date.now(),
      notePressed: noteName,
      targetNote: targetNote,
      correct: isCorrect,
      velocity: 0.8, // Default velocity
      timingDeviation: 0, // Could calculate based on tempo
    };

    sendPerformanceUpdate(attempt);

    // Update local metrics
    setPerformanceMetrics((prev) => {
      const newAttempts = prev.attempts + 1;
      const newCorrect = isCorrect
        ? parseInt(prev.successRate.split("/")[0]) + 1
        : parseInt(prev.successRate.split("/")[0]);
      const newTotal = parseInt(prev.successRate.split("/")[1]) + 1;
      return {
        accuracy: (newCorrect / newAttempts) * 100,
        attempts: newAttempts,
        successRate: `${newCorrect}/${newTotal}`,
      };
    });
  };

  const getStatusColor = () => {
    switch (agentState) {
      case "disconnected":
        return "bg-gray-400";
      case "connecting":
        return "bg-yellow-400 animate-pulse";
      case "listening":
        return "bg-green-400 animate-pulse";
      case "speaking":
        return "bg-blue-400 animate-pulse";
      case "connected":
        return "bg-green-400";
      case "error":
        return "bg-red-400";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusText = () => {
    switch (agentState) {
      case "disconnected":
        return "Not Connected";
      case "connecting":
        return "Connecting...";
      case "listening":
        return "Listening";
      case "speaking":
        return "Speaking";
      case "connected":
        return "Connected";
      case "error":
        return "Error";
      default:
        return "Unknown";
    }
  };

  const getPhaseText = (phase: LessonPhase) => {
    switch (phase) {
      case "intro":
        return "Introduction";
      case "demonstration":
        return "Demonstration";
      case "practice":
        return "Practice Time";
      case "feedback":
        return "Feedback";
      case "completed":
        return "Lesson Complete";
      default:
        return "Unknown";
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header Section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Learn Piano</h1>
            <p className="text-muted-foreground mt-1">Interactive piano lessons with AI voice coaching</p>
          </div>

          {/* Voice Agent Status Indicator */}
          <div className="flex items-center gap-3 px-4 py-2 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
              <span className="text-sm font-medium">{getStatusText()}</span>
            </div>
            {agentError && <span className="text-xs text-red-500">{agentError}</span>}
            {lessonActive && (
              <Button variant="ghost" size="sm" onClick={() => setIsMuted(!isMuted)} className="h-8 w-8 p-0">
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col lg:flex-row gap-6 flex-1">
        {/* Left Panel - Lesson Info & Controls */}
        <div className="flex flex-col gap-4 lg:w-80">
          {/* Lesson Controls */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <h2 className="text-lg font-semibold">Lesson Controls</h2>

            {!lessonActive ? (
              <Button onClick={handleStartLesson} className="w-full" size="lg">
                <Play className="mr-2 h-5 w-5" />
                Start Lesson
              </Button>
            ) : (
              <Button onClick={handleStopLesson} variant="destructive" className="w-full" size="lg">
                <Square className="mr-2 h-5 w-5" />
                Stop Lesson
              </Button>
            )}

            {lessonActive && (
              <div className="pt-2 border-t border-border space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Current Phase:</span>
                  <span className="font-medium">{getPhaseText(lessonPhase)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Exercise:</span>
                  <span className="font-medium">{currentExercise || "None"}</span>
                </div>
              </div>
            )}
          </div>

          {/* Lesson Progress Tracker */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h2 className="text-lg font-semibold">Progress</h2>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Completed</span>
                <span className="font-medium">
                  {progress.completed} / {progress.total}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300"
                  style={{
                    width: `${(progress.completed / progress.total) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Exercise List */}
            <div className="pt-3 border-t border-border">
              <h3 className="text-sm font-medium mb-2">Exercises</h3>
              <div className="space-y-2">
                {["Single Note C4", "Notes C4-E4", "Five Finger Pattern", "Simple Melody", "Rhythm Exercise"].map(
                  (exercise, index) => (
                    <div
                      key={exercise}
                      className={`flex items-center gap-2 text-sm p-2 rounded ${
                        index < progress.completed
                          ? "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                          : index === progress.completed && lessonActive
                          ? "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                          : "bg-secondary/50 text-muted-foreground"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                          index < progress.completed
                            ? "bg-green-500 text-white"
                            : index === progress.completed && lessonActive
                            ? "bg-blue-500 text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {index < progress.completed ? "✓" : index + 1}
                      </div>
                      <span className="font-medium">{exercise}</span>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Exercise Instructions Panel */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h2 className="text-lg font-semibold">Instructions</h2>

            {!lessonActive ? (
              <div className="text-sm text-muted-foreground space-y-2">
                <p>Click "Start Lesson" to begin your interactive piano lesson.</p>
                <p className="text-xs">Make sure you have:</p>
                <ul className="text-xs list-disc list-inside space-y-1 ml-2">
                  <li>Camera access enabled</li>
                  <li>A white paper on your table</li>
                  <li>Good lighting</li>
                  <li>Audio enabled</li>
                </ul>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-md bg-primary/10 p-3 border border-primary/20">
                  <p className="text-sm font-medium text-primary mb-1">
                    {lessonPhase === "intro" && "Welcome! Let's get started."}
                    {lessonPhase === "demonstration" && "Watch and listen carefully."}
                    {lessonPhase === "practice" && "Now it's your turn!"}
                    {lessonPhase === "feedback" && "Great work! Here's your feedback."}
                    {lessonPhase === "completed" && "Lesson complete! 🎉"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {lessonPhase === "intro" && "I'll guide you through learning piano step by step."}
                    {lessonPhase === "demonstration" && "I'll demonstrate the notes you need to play."}
                    {lessonPhase === "practice" &&
                      "Practice the exercise. I'll be listening and will provide feedback."}
                    {lessonPhase === "feedback" && "Based on your performance, here's what to work on next."}
                    {lessonPhase === "completed" && "You've completed this lesson. Keep practicing!"}
                  </p>
                </div>

                {currentExercise && (
                  <div className="text-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Current Exercise:</span>
                      <span className="text-muted-foreground">{currentExercise}</span>
                    </div>

                    {lessonPhase === "practice" && targetNotes.length > 0 && (
                      <div className="rounded-md bg-secondary p-3 space-y-1">
                        <p className="text-xs font-medium">Target Notes:</p>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {targetNotes.map((note) => (
                            <div
                              key={note}
                              className="px-3 py-1 rounded bg-primary text-primary-foreground text-xs font-bold"
                            >
                              {note}
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Tempo: 60 BPM</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Piano Player Area */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Piano Player with Lesson Mode */}
          <div className="rounded-lg border border-border bg-card p-6 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Piano Practice Area</h2>
              {lessonActive && lessonPhase === "practice" && (
                <div className="flex items-center gap-2 text-sm">
                  <Mic className="h-4 w-4 text-green-500 animate-pulse" />
                  <span className="text-muted-foreground">Coach is listening...</span>
                </div>
              )}
            </div>

            {/* Piano Player Component */}
            {lessonActive ? (
              <div className="flex-1 flex flex-col">
                <PianoPlayer onNotePlayed={handleNotePlayed} />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-secondary/30 rounded-lg border-2 border-dashed border-border">
                <div className="text-center space-y-3 p-8">
                  <div className="text-6xl">🎹</div>
                  <p className="text-lg font-medium text-muted-foreground">Start a lesson to begin</p>
                  <p className="text-sm text-muted-foreground max-w-md">
                    The piano player will appear here when you start your interactive lesson.
                  </p>
                </div>
              </div>
            )}

            {/* Performance Metrics (shown during practice) */}
            {lessonActive && lessonPhase === "practice" && (
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="rounded-md bg-secondary p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{Math.round(performanceMetrics.accuracy)}%</p>
                  <p className="text-xs text-muted-foreground mt-1">Accuracy</p>
                </div>
                <div className="rounded-md bg-secondary p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{performanceMetrics.attempts}</p>
                  <p className="text-xs text-muted-foreground mt-1">Attempts</p>
                </div>
                <div className="rounded-md bg-secondary p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{performanceMetrics.successRate}</p>
                  <p className="text-xs text-muted-foreground mt-1">Success Rate</p>
                </div>
              </div>
            )}
          </div>

          {/* Coach Message Area */}
          {lessonActive && (
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold shrink-0">
                  AI
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">Piano Coach</p>
                  <p className="text-sm text-muted-foreground">
                    {agentSpeech ||
                      (lessonPhase === "intro" &&
                        "Hi! I'm your piano coach. I'll guide you through learning piano with Airstrument. Are you ready to begin your first lesson?") ||
                      (lessonPhase === "demonstration" &&
                        "Let me demonstrate the notes you'll be playing. Watch where the notes light up on your paper piano.") ||
                      (lessonPhase === "practice" &&
                        "Great! Now try playing these notes yourself. Take your time and I'll provide feedback after a few attempts.") ||
                      (lessonPhase === "feedback" &&
                        "Excellent progress! You hit 8 out of 10 notes correctly. Let's work on keeping a steady rhythm. Ready to try the next exercise?") ||
                      (lessonPhase === "completed" &&
                        "Congratulations! You've completed this lesson. You're making great progress!") ||
                      "Waiting for coach to speak..."}
                  </p>
                </div>
                <div className="shrink-0">
                  {agentState === "speaking" && (
                    <div className="flex items-center gap-1">
                      <div className="w-1 h-4 bg-blue-500 rounded animate-pulse" style={{ animationDelay: "0ms" }} />
                      <div className="w-1 h-6 bg-blue-500 rounded animate-pulse" style={{ animationDelay: "150ms" }} />
                      <div className="w-1 h-4 bg-blue-500 rounded animate-pulse" style={{ animationDelay: "300ms" }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
