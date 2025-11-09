/**
 * Lesson Manager Service
 * Manages lesson state, exercises, and performance tracking
 */

import { LessonState, LessonPhase, PerformanceMetrics, LessonExercise, AttemptData } from "../types/voice-agent";

export class LessonManager {
  private state: LessonState;
  private sessionStartTime: number = 0;

  constructor() {
    this.state = {
      phase: "intro",
      metrics: this.getEmptyMetrics(),
    };
  }

  private getEmptyMetrics(): PerformanceMetrics {
    return {
      notesPlayed: 0,
      correctNotes: 0,
      missedNotes: 0,
      accuracy: 0,
      avgVelocity: 0,
      avgTiming: 0,
      recentAttempts: [],
    };
  }

  /**
   * Start a new lesson session
   */
  startSession(): void {
    this.sessionStartTime = Date.now();
    this.state = {
      phase: "intro",
      metrics: this.getEmptyMetrics(),
      startTime: this.sessionStartTime,
    };
    console.log("📚 Lesson session started");
  }

  /**
   * End the current lesson session
   */
  endSession(): void {
    const duration = Date.now() - this.sessionStartTime;
    console.log(`📚 Lesson session ended. Duration: ${Math.round(duration / 1000)}s`);
    this.state = {
      phase: "intro",
      metrics: this.getEmptyMetrics(),
    };
  }

  /**
   * Start a new exercise
   */
  startExercise(exercise: LessonExercise): void {
    console.log(`🎯 Starting exercise: ${exercise.name}`);
    this.state.currentExercise = exercise;
    this.state.metrics = this.getEmptyMetrics(); // Reset metrics for new exercise
  }

  /**
   * Update the lesson phase
   */
  updatePhase(phase: LessonPhase): void {
    console.log(`📝 Phase transition: ${this.state.phase} -> ${phase}`);
    this.state.phase = phase;
  }

  /**
   * Record a note attempt
   */
  recordAttempt(attempt: AttemptData): void {
    const metrics = this.state.metrics;

    metrics.notesPlayed++;
    if (attempt.correct) {
      metrics.correctNotes++;
    } else {
      metrics.missedNotes++;
    }

    // Add to recent attempts (keep last 20)
    metrics.recentAttempts.push(attempt);
    if (metrics.recentAttempts.length > 20) {
      metrics.recentAttempts.shift();
    }

    // Calculate averages
    metrics.accuracy = metrics.notesPlayed > 0 ? (metrics.correctNotes / metrics.notesPlayed) * 100 : 0;

    const recentAttempts = metrics.recentAttempts;
    if (recentAttempts.length > 0) {
      metrics.avgVelocity = recentAttempts.reduce((sum, a) => sum + a.velocity, 0) / recentAttempts.length;
      metrics.avgTiming =
        recentAttempts.reduce((sum, a) => sum + Math.abs(a.timingDeviation), 0) / recentAttempts.length;
    }

    console.log(
      `📊 Attempt recorded: ${attempt.notePressed} (${
        attempt.correct ? "✓" : "✗"
      }). Accuracy: ${metrics.accuracy.toFixed(1)}%`
    );
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.state.metrics };
  }

  /**
   * Get current lesson state
   */
  getState(): LessonState {
    return { ...this.state };
  }

  /**
   * Get formatted metrics summary for voice agent
   */
  getMetricsSummary(): string {
    const metrics = this.state.metrics;
    const recentCount = Math.min(10, metrics.recentAttempts.length);
    const recentCorrect = metrics.recentAttempts.slice(-recentCount).filter((a) => a.correct).length;

    return (
      `Student has played ${metrics.notesPlayed} notes total with ${metrics.accuracy.toFixed(1)}% accuracy. ` +
      `Recent performance: ${recentCorrect} out of ${recentCount} correct. ` +
      `Average velocity: ${metrics.avgVelocity.toFixed(2)}, ` +
      `Average timing deviation: ${metrics.avgTiming.toFixed(0)}ms.`
    );
  }
}
