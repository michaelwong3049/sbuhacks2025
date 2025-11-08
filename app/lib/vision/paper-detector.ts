/**
 * Paper Piano Detector
 * Detects a paper rectangle and key positions on it
 * Similar to the paper-piano project but using canvas image processing
 */

export interface PaperCorners {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
  bottomRight: { x: number; y: number };
}

export interface KeyRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  noteIndex: number;
}

export class PaperDetector {
  private paperCorners: PaperCorners | null = null;
  private keyRegions: KeyRegion[] = [];
  private readonly NUM_KEYS = 8; // C, D, E, F, G, A, B, C

  /**
   * Set paper corners (calibration)
   */
  setPaperCorners(corners: PaperCorners) {
    this.paperCorners = corners;
    this.calculateKeyRegions();
  }

  /**
   * Calculate key regions from paper corners
   */
  private calculateKeyRegions() {
    if (!this.paperCorners) return;

    const { topLeft, topRight, bottomLeft, bottomRight } = this.paperCorners;
    
    // Paper dimensions
    const paperWidth = Math.abs(topRight.x - topLeft.x);
    const paperHeight = Math.abs(bottomLeft.y - topLeft.y);
    const keyWidth = paperWidth / this.NUM_KEYS;
    const keyHeight = paperHeight;

    // Create key regions
    this.keyRegions = [];
    for (let i = 0; i < this.NUM_KEYS; i++) {
      const keyX = topLeft.x + i * keyWidth;
      const keyY = topLeft.y;
      
      this.keyRegions.push({
        x: keyX,
        y: keyY,
        width: keyWidth,
        height: keyHeight,
        noteIndex: i,
      });
    }
  }

  /**
   * Get which key a finger is pointing at
   */
  getKeyAtPosition(fingerX: number, fingerY: number): number | null {
    if (!this.paperCorners || this.keyRegions.length === 0) {
      return null;
    }

    // Check if finger is within any key region
    // Use inclusive boundaries (>= and <=)
    for (const keyRegion of this.keyRegions) {
      const inX = fingerX >= keyRegion.x && fingerX <= keyRegion.x + keyRegion.width;
      const inY = fingerY >= keyRegion.y && fingerY <= keyRegion.y + keyRegion.height;
      
      if (inX && inY) {
        return keyRegion.noteIndex;
      }
    }

    return null;
  }

  /**
   * Check if finger is touching the paper (close enough in Z-depth)
   */
  isTouchingPaper(fingerZ: number, threshold: number = -0.03): boolean {
    // Negative Z means closer to camera
    // When finger is touching paper, Z should be close to 0 or slightly negative
    return fingerZ < threshold;
  }
    

  /**
   * Get paper corners (for visualization)
   */
  getPaperCorners(): PaperCorners | null {
    return this.paperCorners;
  }

  /**
   * Get key regions (for visualization)
   */
  getKeyRegions(): KeyRegion[] {
    return this.keyRegions;
  }

  /**
   * Check if paper is calibrated
   */
  isCalibrated(): boolean {
    return this.paperCorners !== null;
  }

  /**
   * Reset calibration
   */
  reset() {
    this.paperCorners = null;
    this.keyRegions = [];
  }
}

