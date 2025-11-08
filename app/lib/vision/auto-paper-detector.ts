/**
 * Automatic Paper Detector
 * Detects paper rectangle using edge detection and contour analysis
 * Automatically divides paper into key regions
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
  // Elliptical hitbox (better than circle for piano keys)
  hitboxCenterX: number;
  hitboxCenterY: number;
  hitboxRadiusX: number; // Horizontal radius (wider)
  hitboxRadiusY: number; // Vertical radius (taller)
}

export class AutoPaperDetector {
  private paperCorners: PaperCorners | null = null;
  private keyRegions: KeyRegion[] = [];
  private readonly NUM_KEYS = 10; // C, D, E, F, G, A, B, C, D, E

  /**
   * Detect paper from image using simplified approach:
   * 1. Find bright regions (paper) using adaptive threshold
   * 2. Find largest bright blob (bounding box)
   * 3. Use bounding box corners (works even with perspective)
   */
  detectPaper(imageData: ImageData, canvasWidth: number, canvasHeight: number): boolean {
    try {
      const data = imageData.data;
      const width = canvasWidth;
      const height = canvasHeight;
      
      // Step 1: Find bright region (paper) - simplified
      const paperRegion = this.findPaperRegionSimple(data, width, height);
      
      if (!paperRegion) {
        console.log("❌ No paper region found");
        return false;
      }
      
      console.log("✅ Found paper region:", paperRegion);
      
      // Step 2: Use bounding box corners directly (works with perspective)
      this.paperCorners = {
        topLeft: { x: paperRegion.minX, y: paperRegion.minY },
        topRight: { x: paperRegion.maxX, y: paperRegion.minY },
        bottomRight: { x: paperRegion.maxX, y: paperRegion.maxY },
        bottomLeft: { x: paperRegion.minX, y: paperRegion.maxY },
      };
      
      this.calculateKeyRegions();
      console.log("✅ Paper detected! Corners:", this.paperCorners, "Keys:", this.keyRegions.length);
      return true;
    } catch (error) {
      console.error("Error detecting paper:", error);
      return false;
    }
  }

  /**
   * Find paper region using Canny-like edge detection and contour analysis
   * Inspired by: https://github.com/BTifmmp/paper-piano
   * Optimized with downsampling for performance
   */
  private findPaperRegionSimple(data: Uint8ClampedArray, width: number, height: number): { minX: number; maxX: number; minY: number; maxY: number } | null {
    // Downsample for performance (process at lower resolution)
    const scale = 2; // Process at 1/2 resolution
    const smallWidth = Math.floor(width / scale);
    const smallHeight = Math.floor(height / scale);
    
    // Step 1: Convert to grayscale and downsample
    const grayscale = this.toGrayscaleDownsampled(data, width, height, scale);
    
    // Step 2: Apply Gaussian blur (smoothing)
    const blurred = this.gaussianBlur(grayscale, smallWidth, smallHeight);
    
    // Step 3: Edge detection using Sobel operator (Canny-like)
    const edges = this.sobelEdgeDetection(blurred, smallWidth, smallHeight);
    
    // Step 4: Find contours from edges
    const contours = this.findContours(edges, smallWidth, smallHeight);
    
      // Step 5: Find largest rectangular contour (paper)
      // Pass original image data for brightness checking
      const paperRect = this.findLargestRectangle(contours, smallWidth, smallHeight, data, width);
    
    if (!paperRect) {
      console.log("❌ No rectangular contour found");
      return null;
    }
    
    // Scale back up to original resolution
    const scaledRect = {
      minX: paperRect.minX * scale,
      maxX: paperRect.maxX * scale,
      minY: paperRect.minY * scale,
      maxY: paperRect.maxY * scale,
    };
    
    console.log("✅ Found paper rectangle:", scaledRect);
    return scaledRect;
  }

  /**
   * Convert to grayscale with downsampling for performance
   */
  private toGrayscaleDownsampled(data: Uint8ClampedArray, width: number, height: number, scale: number): Uint8ClampedArray {
    const smallWidth = Math.floor(width / scale);
    const smallHeight = Math.floor(height / scale);
    const grayscale = new Uint8ClampedArray(smallWidth * smallHeight);
    
    for (let sy = 0; sy < smallHeight; sy++) {
      for (let sx = 0; sx < smallWidth; sx++) {
        const x = sx * scale;
        const y = sy * scale;
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        // Luminance formula
        grayscale[sy * smallWidth + sx] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      }
    }
    
    return grayscale;
  }


  /**
   * Apply Gaussian blur (3x3 kernel, simplified)
   */
  private gaussianBlur(grayscale: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const blurred = new Uint8ClampedArray(grayscale.length);
    const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1]; // 3x3 Gaussian-like kernel
    const kernelSum = 16;
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let sum = 0;
        let ki = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = (y + ky) * width + (x + kx);
            sum += grayscale[idx] * kernel[ki];
            ki++;
          }
        }
        
        blurred[y * width + x] = Math.round(sum / kernelSum);
      }
    }
    
    // Copy borders
    for (let y = 0; y < height; y++) {
      blurred[y * width] = grayscale[y * width];
      blurred[y * width + width - 1] = grayscale[y * width + width - 1];
    }
    for (let x = 0; x < width; x++) {
      blurred[x] = grayscale[x];
      blurred[(height - 1) * width + x] = grayscale[(height - 1) * width + x];
    }
    
    return blurred;
  }

  /**
   * Sobel edge detection (Canny-like)
   */
  private sobelEdgeDetection(blurred: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const edges = new Uint8ClampedArray(blurred.length);
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    const threshold = 50; // Slightly higher threshold to reduce noise from clothing textures
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        let ki = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = (y + ky) * width + (x + kx);
            gx += blurred[idx] * sobelX[ki];
            gy += blurred[idx] * sobelY[ki];
            ki++;
          }
        }
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        edges[y * width + x] = magnitude > threshold ? 255 : 0;
      }
    }
    
    return edges;
  }

  /**
   * Find contours from edge image using connected components
   * Focuses on lower portion to avoid detecting people/clothing
   */
  private findContours(edges: Uint8ClampedArray, width: number, height: number): number[][][] {
    const contours: number[][][] = [];
    const visited = new Set<number>();
    const sampleStep = 1; // No additional sampling since we already downsampled
    
    // Focus on lower 60% of image (where paper on table would be)
    // Ignore top 40% where people's upper body/clothing would be
    const startY = Math.floor(height * 0.4);
    
    for (let y = startY; y < height; y += sampleStep) {
      for (let x = 0; x < width; x += sampleStep) {
        const idx = y * width + x;
        if (edges[idx] > 128 && !visited.has(idx)) {
          const contour = this.floodFillContour(edges, width, height, x, y, visited, sampleStep);
          if (contour.length > 40) { // Minimum contour size - filter out small edges from clothing
            contours.push(contour);
          }
        }
      }
    }
    
    console.log(`📊 Found ${contours.length} contours in lower portion`);
    return contours;
  }

  /**
   * Flood fill to get connected edge pixels (contour)
   */
  private floodFillContour(edges: Uint8ClampedArray, width: number, height: number, startX: number, startY: number, visited: Set<number>, sampleStep: number): number[][] {
    const contour: number[][] = [];
    const stack: [number, number][] = [[startX, startY]];
    
    while (stack.length > 0 && contour.length < 1000) { // Limit size
      const [x, y] = stack.pop()!;
      const idx = y * width + x;
      
      if (x < 0 || x >= width || y < 0 || y >= height || visited.has(idx) || edges[idx] < 128) {
        continue;
      }
      
      visited.add(idx);
      contour.push([x, y]);
      
      // Add neighbors
      stack.push(
        [x + sampleStep, y],
        [x - sampleStep, y],
        [x, y + sampleStep],
        [x, y - sampleStep]
      );
    }
    
    return contour;
  }

  /**
   * Find largest rectangular contour (paper)
   * Filters out people/clothing by checking brightness and aspect ratio
   */
  private findLargestRectangle(contours: number[][][], width: number, height: number, originalData?: Uint8ClampedArray, originalWidth?: number): { minX: number; maxX: number; minY: number; maxY: number } | null {
    let bestRect: { minX: number; maxX: number; minY: number; maxY: number; score: number } | null = null;
    
    for (const contour of contours) {
      if (contour.length < 4) continue;
      
      // Find bounding box (in downsampled coordinates)
      let minX = width, maxX = 0, minY = height, maxY = 0;
      for (const [x, y] of contour) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      
      const rectWidth = maxX - minX;
      const rectHeight = maxY - minY;
      const area = rectWidth * rectHeight;
      
      // Check size constraints
      const minSize = Math.min(width, height) * 0.1;
      const maxSize = Math.min(width, height) * 0.9;
      const sideLength = Math.sqrt(area);
      
      if (sideLength < minSize || sideLength > maxSize) {
        continue;
      }
      
      // Aspect ratio check - paper is typically wider than tall
      const aspectRatio = rectWidth / rectHeight;
      
      // FILTER OUT PEOPLE/CLOTHING:
      // 1. Paper should be more horizontal than vertical (aspect ratio > 0.7)
      if (aspectRatio < 0.7) {
        console.log(`❌ Rejected: too vertical (aspect ${aspectRatio.toFixed(2)}) - likely clothing/person`);
        continue;
      }
      
      // 2. Paper should not be too tall (reject if height > width * 1.3)
      if (rectHeight > rectWidth * 1.3) {
        console.log(`❌ Rejected: too tall (${rectHeight} > ${rectWidth * 1.3}) - likely clothing/person`);
        continue;
      }
      
      // 3. Paper should be in lower portion of screen (center Y should be > 40% from top)
      const centerY = (minY + maxY) / 2;
      if (centerY < height * 0.4) {
        console.log(`❌ Rejected: too high (center Y: ${centerY.toFixed(0)}) - likely clothing/person`);
        continue;
      }
      
      // 4. Check brightness - paper should be bright (white)
      let brightnessScore = 1.0;
      if (originalData && originalWidth) {
        // Sample brightness inside the rectangle (scale coordinates back up)
        const scale = originalWidth / width;
        const origMinX = Math.floor(minX * scale);
        const origMaxX = Math.floor(maxX * scale);
        const origMinY = Math.floor(minY * scale);
        const origMaxY = Math.floor(maxY * scale);
        
        let brightPixels = 0;
        let totalPixels = 0;
        const brightnessThreshold = 150;
        
        // Sample inside the rectangle
        for (let y = origMinY; y < origMaxY; y += 4) {
          for (let x = origMinX; x < origMaxX; x += 4) {
            const idx = (y * originalWidth + x) * 4;
            const r = originalData[idx];
            const g = originalData[idx + 1];
            const b = originalData[idx + 2];
            const brightness = (r + g + b) / 3;
            
            totalPixels++;
            if (brightness > brightnessThreshold) {
              brightPixels++;
            }
          }
        }
        
        // Paper should be at least 40% bright pixels
        brightnessScore = brightPixels / totalPixels;
        if (brightnessScore < 0.4) {
          console.log(`❌ Rejected: not bright enough (${(brightnessScore * 100).toFixed(0)}% bright) - likely clothing/person`);
          continue;
        }
      }
      
      // Calculate score: area * brightness * aspect ratio bonus
      // Prefer larger, brighter, more horizontal rectangles
      const aspectBonus = Math.min(aspectRatio, 2.0) / 2.0; // Bonus for wider rectangles (up to 2:1)
      const score = area * brightnessScore * (1 + aspectBonus * 0.5);
      
      if (!bestRect || score > bestRect.score) {
        bestRect = { minX, maxX, minY, maxY, score };
        console.log(`✅ Candidate: ${rectWidth}x${rectHeight}, aspect: ${aspectRatio.toFixed(2)}, brightness: ${(brightnessScore * 100).toFixed(0)}%, score: ${score.toFixed(0)}`);
      }
    }
    
    if (!bestRect) {
      return null;
    }
    
    return { minX: bestRect.minX, maxX: bestRect.maxX, minY: bestRect.minY, maxY: bestRect.maxY };
  }


  /**
   * Calculate key regions from paper corners (perspective-aware)
   * Divides trapezoid into equal sections
   */
  private calculateKeyRegions() {
    if (!this.paperCorners) return;

    const { topLeft, topRight, bottomLeft, bottomRight } = this.paperCorners;
    
    // Divide the trapezoid into NUM_KEYS equal sections
    // For each key, interpolate between top and bottom edges
    this.keyRegions = [];
    
    // Add more spacing between keys to prevent accidental double triggers
    // Negative value creates gaps between keys (spacing instead of overlap)
    const keySpacing = -0.06; // Increased to 6% gap between keys for better separation (was 3%)
    
    for (let i = 0; i < this.NUM_KEYS; i++) {
      const t1 = i / this.NUM_KEYS; // Start of this key (0 to 1)
      const t2 = (i + 1) / this.NUM_KEYS; // End of this key
      
      // Add spacing between keys (except at edges)
      // This creates larger gaps so keys are further apart and less crowded
      const spacing = Math.abs(keySpacing) / this.NUM_KEYS;
      const startOffset = i === 0 ? 0 : spacing;
      const endOffset = i === this.NUM_KEYS - 1 ? 0 : -spacing;
      
      const adjustedT1 = Math.max(0, t1 + startOffset);
      const adjustedT2 = Math.min(1, t2 + endOffset);
      
      // Interpolate top edge
      const topStart = {
        x: topLeft.x + (topRight.x - topLeft.x) * adjustedT1,
        y: topLeft.y + (topRight.y - topLeft.y) * adjustedT1,
      };
      const topEnd = {
        x: topLeft.x + (topRight.x - topLeft.x) * adjustedT2,
        y: topLeft.y + (topRight.y - topLeft.y) * adjustedT2,
      };
      
      // Interpolate bottom edge
      const bottomStart = {
        x: bottomLeft.x + (bottomRight.x - bottomLeft.x) * adjustedT1,
        y: bottomLeft.y + (bottomRight.y - bottomLeft.y) * adjustedT1,
      };
      const bottomEnd = {
        x: bottomLeft.x + (bottomRight.x - bottomLeft.x) * adjustedT2,
        y: bottomLeft.y + (bottomRight.y - bottomLeft.y) * adjustedT2,
      };
      
      // Key region is the bounding box of this trapezoid slice
      const minX = Math.min(topStart.x, topEnd.x, bottomStart.x, bottomEnd.x);
      const maxX = Math.max(topStart.x, topEnd.x, bottomStart.x, bottomEnd.x);
      const minY = Math.min(topStart.y, topEnd.y, bottomStart.y, bottomEnd.y);
      const maxY = Math.max(topStart.y, topEnd.y, bottomStart.y, bottomEnd.y);
      
      const width = maxX - minX;
      const height = maxY - minY;
      
      // Calculate elliptical hitbox center (centered in the key region)
      // Ellipse is better than circle for piano keys: wider horizontally, matches key shape
      const hitboxCenterX = minX + width / 2;
      const hitboxCenterY = minY + height / 2;
      
      // Elliptical hitbox: make it smaller to add more padding/space from rectangle border
      // Reduced from 35%/30% to 25%/22% to create more visual space between hitbox and rectangle
      const hitboxRadiusX = width * 0.25; // 25% of key width (smaller = more padding from rectangle)
      const hitboxRadiusY = height * 0.22; // 22% of key height (smaller = more padding from rectangle)
      
      // Clamp to reasonable bounds (adjusted for smaller hitboxes)
      const minRadiusX = 18;
      const maxRadiusX = 40;
      const minRadiusY = 12;
      const maxRadiusY = 28;
      
      this.keyRegions.push({
        x: minX,
        y: minY,
        width: width,
        height: height,
        noteIndex: i,
        hitboxCenterX: hitboxCenterX,
        hitboxCenterY: hitboxCenterY,
        hitboxRadiusX: Math.max(minRadiusX, Math.min(maxRadiusX, hitboxRadiusX)),
        hitboxRadiusY: Math.max(minRadiusY, Math.min(maxRadiusY, hitboxRadiusY)),
      });
    }
  }

  /**
   * Get which key a finger is pointing at (using elliptical hitbox)
   * Ellipse is better than circle for piano keys: wider horizontally, matches key shape
   * Formula: (x/a)² + (y/b)² <= 1, where a = radiusX, b = radiusY
   */
  getKeyAtPosition(fingerX: number, fingerY: number): number | null {
    if (!this.paperCorners || this.keyRegions.length === 0) {
      return null;
    }

    // Check if finger is within each elliptical hitbox
    for (const keyRegion of this.keyRegions) {
      const dx = fingerX - keyRegion.hitboxCenterX;
      const dy = fingerY - keyRegion.hitboxCenterY;
      
      // Ellipse equation: (x/a)² + (y/b)² <= 1
      // If true, finger is inside the ellipse
      const ellipseValue = (dx / keyRegion.hitboxRadiusX) ** 2 + (dy / keyRegion.hitboxRadiusY) ** 2;
      
      if (ellipseValue <= 1) {
        return keyRegion.noteIndex;
      }
    }

    return null;
  }

  /**
   * Check if finger is touching the paper
   */
  isTouchingPaper(fingerZ: number, threshold: number = -0.015): boolean {
    return fingerZ < threshold;
  }

  /**
   * Get paper corners
   */
  getPaperCorners(): PaperCorners | null {
    return this.paperCorners;
  }

  /**
   * Get key regions
   */
  getKeyRegions(): KeyRegion[] {
    return this.keyRegions;
  }

  /**
   * Check if paper is detected
   */
  isDetected(): boolean {
    return this.paperCorners !== null;
  }

  /**
   * Reset detection
   */
  reset() {
    this.paperCorners = null;
    this.keyRegions = [];
  }
}

