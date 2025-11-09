/**
 * Lesson Structure for Piano Learning
 * Defines the 5 progressive lessons that the AI coach will guide through
 */

export interface Lesson {
  id: number;
  name: string;
  description: string;
  targetNotes: string[];
  tempo: number; // BPM
  difficulty: "beginner" | "intermediate" | "advanced";
  instructions: string;
  successCriteria: {
    accuracy: number; // percentage needed to pass
    minAttempts: number; // minimum attempts before moving on
  };
}

export const LESSONS: Lesson[] = [
  {
    id: 1,
    name: "Single Note C4",
    description: "Learn to play a single note (C4) accurately using your index finger. This is your foundation!",
    targetNotes: ["C4"],
    tempo: 60,
    difficulty: "beginner",
    instructions: "Use your index finger to touch the first key (C4) on your paper piano. Try to hit it cleanly and consistently. You can use either your left or right index finger.",
    successCriteria: {
      accuracy: 80,
      minAttempts: 5,
    },
  },
  {
    id: 2,
    name: "Two Notes C4-E4",
    description: "Play two notes (C4 and E4) in sequence using your two index fingers.",
    targetNotes: ["C4", "E4"],
    tempo: 60,
    difficulty: "beginner",
    instructions: "Use your left index finger for C4, then your right index finger for E4. Play them one after another in sequence. Focus on playing them in order with steady timing.",
    successCriteria: {
      accuracy: 75,
      minAttempts: 8,
    },
  },
  {
    id: 3,
    name: "Five Note Sequence",
    description: "Play a sequence of five notes: C-D-E-F-G using your two index fingers.",
    targetNotes: ["C4", "D4", "E4", "F4", "G4"],
    tempo: 70,
    difficulty: "intermediate",
    instructions: "Use your two index fingers to play all five notes in sequence: C, D, E, F, G. You'll alternate between your left and right index fingers as you move across the keys. Play them smoothly one after another.",
    successCriteria: {
      accuracy: 70,
      minAttempts: 10,
    },
  },
  {
    id: 4,
    name: "Simple Melody",
    description: "Play a simple melody pattern: C-E-G-E-C using your two index fingers.",
    targetNotes: ["C4", "E4", "G4", "E4", "C4"],
    tempo: 80,
    difficulty: "intermediate",
    instructions: "Play this pattern: C, E, G, E, C. Use your two index fingers to move between the keys. This creates a pleasing melody. Focus on rhythm and accuracy as you play.",
    successCriteria: {
      accuracy: 65,
      minAttempts: 12,
    },
  },
  {
    id: 5,
    name: "Rhythm Exercise",
    description: "Practice playing with rhythm: C-C-E-E-G-G-C-C using your two index fingers.",
    targetNotes: ["C4", "C4", "E4", "E4", "G4", "G4", "C4", "C4"],
    tempo: 90,
    difficulty: "advanced",
    instructions: "Play each note twice before moving to the next. Use your two index fingers to play: C twice, then E twice, then G twice, then C twice. This exercise builds rhythm and coordination between your two index fingers.",
    successCriteria: {
      accuracy: 60,
      minAttempts: 15,
    },
  },
];

export function getLessonById(id: number): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.id === id);
}

export function getLessonByIndex(index: number): Lesson | undefined {
  return LESSONS[index];
}

export function getNextLesson(currentLessonId: number): Lesson | null {
  const currentIndex = LESSONS.findIndex((l) => l.id === currentLessonId);
  if (currentIndex === -1 || currentIndex === LESSONS.length - 1) {
    return null;
  }
  return LESSONS[currentIndex + 1];
}

export function getPreviousLesson(currentLessonId: number): Lesson | null {
  const currentIndex = LESSONS.findIndex((l) => l.id === currentLessonId);
  if (currentIndex <= 0) {
    return null;
  }
  return LESSONS[currentIndex - 1];
}

