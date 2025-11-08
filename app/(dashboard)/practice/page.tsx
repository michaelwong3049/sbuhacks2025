import PracticeClient from "@/components/practice/practice-client";

export default function PracticePage() {
  return (
    <div className="flex justify-center">
      <main className="flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-black dark:text-zinc-50">Practice Session</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">Select an instrument and start playing</p>
        </div>

        <PracticeClient />
      </main>
    </div>
  );
}

// Helper functions for drawing
const HAND_CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

function drawConnections(ctx: CanvasRenderingContext2D, landmarks: any[], connections: number[][]) {
  ctx.strokeStyle = "#00FF00";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const connection of connections) {
    const start = landmarks[connection[0]];
    const end = landmarks[connection[1]];
    // Mirror X when drawing so overlays align with the mirrored camera image
    const startX = ctx.canvas.width - (start.x * ctx.canvas.width);
    const startY = start.y * ctx.canvas.height;
    const endX = ctx.canvas.width - (end.x * ctx.canvas.width);
    const endY = end.y * ctx.canvas.height;
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
  }
  ctx.stroke();
}

function drawLandmarks(ctx: CanvasRenderingContext2D, landmarks: any[], style: { color: string; lineWidth: number }) {
  ctx.fillStyle = style.color;
  for (const landmark of landmarks) {
    // Mirror X so landmarks align with mirrored camera image
    const x = ctx.canvas.width - (landmark.x * ctx.canvas.width);
    const y = landmark.y * ctx.canvas.height;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, 2 * Math.PI);
    ctx.fill();
  }
}
