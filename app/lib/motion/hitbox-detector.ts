/**
 * Hitbox Detection System
 * Detects when a hand enters a hitbox zone with sufficient velocity
 */

export interface Hitbox {
  x: number; // x position (0-1 normalized)
  y: number; // y position (0-1 normalized)
  width: number; // width (0-1 normalized)
  height: number; // height (0-1 normalized)
}

export interface HandPosition {
  x: number; // normalized x (0-1)
  y: number; // normalized y (0-1)
  z?: number; // normalized z (optional depth)
}

export interface Velocity {
  x: number;
  y: number;
  magnitude: number;
}

export class HitboxDetector {
  private hitboxes: Hitbox[] = [];
  private previousPositions: Map<number, HandPosition> = new Map(); // track by hand index
  private hitCooldown: Map<string, number> = new Map(); // prevent multiple hits in quick succession
  private cooldownTime: number = 200; // milliseconds

  /**
   * Add a hitbox to detect
   */
  addHitbox(hitbox: Hitbox) {
    this.hitboxes.push(hitbox);
  }

  /**
   * Check if a hand position is inside a hitbox
   */
  private isInHitbox(position: HandPosition, hitbox: Hitbox): boolean {
    return (
      position.x >= hitbox.x &&
      position.x <= hitbox.x + hitbox.width &&
      position.y >= hitbox.y &&
      position.y <= hitbox.y + hitbox.height
    );
  }

  /**
   * Calculate velocity between two positions
   */
  private calculateVelocity(
    current: HandPosition,
    previous: HandPosition,
    deltaTime: number
  ): Velocity {
    if (deltaTime === 0) {
      return { x: 0, y: 0, magnitude: 0 };
    }

    const dx = (current.x - previous.x) / deltaTime;
    const dy = (current.y - previous.y) / deltaTime;
    const magnitude = Math.sqrt(dx * dx + dy * dy);

    return { x: dx, y: dy, magnitude };
  }

  /**
   * Check if a hit should be triggered (considering cooldown)
   */
  private shouldTriggerHit(hitboxId: string): boolean {
    const lastHit = this.hitCooldown.get(hitboxId);
    if (!lastHit) return true;

    const now = Date.now();
    if (now - lastHit > this.cooldownTime) {
      return true;
    }
    return false;
  }

  /**
   * Process hand positions and detect hits
   * @param handIndex - Index of the hand (0, 1, etc.)
   * @param position - Current hand position
   * @param deltaTime - Time since last frame (in seconds)
   * @returns Array of hitbox indices that were hit
   */
  detectHits(
    handIndex: number,
    position: HandPosition,
    deltaTime: number
  ): number[] {
    const previousPosition = this.previousPositions.get(handIndex);
    const now = Date.now();

    // Update previous position
    this.previousPositions.set(handIndex, position);

    // If no previous position, can't calculate velocity
    if (!previousPosition) {
      return [];
    }

    // Calculate velocity
    const velocity = this.calculateVelocity(
      position,
      previousPosition,
      deltaTime
    );

    // Threshold for detecting a "hit" (hand moving fast enough)
    // Note: MediaPipe coordinates are normalized 0-1, so velocity is in units per second
    // A velocity of 2.0 means moving across the entire screen in 0.5 seconds
    // Lower values = easier to trigger, higher values = need faster movement
    const velocityThreshold = 0.8; // Adjust this value to make hits easier/harder to detect

    // Check if hand is moving fast enough
    if (velocity.magnitude < velocityThreshold) {
      return [];
    }

    // Check each hitbox
    const hitHitboxes: number[] = [];

    this.hitboxes.forEach((hitbox, index) => {
      const hitboxId = `${handIndex}-${index}`;

      // Check if hand is in hitbox
      if (this.isInHitbox(position, hitbox)) {
        // Check cooldown
        if (this.shouldTriggerHit(hitboxId)) {
          hitHitboxes.push(index);
          this.hitCooldown.set(hitboxId, now);
        }
      }
    });

    return hitHitboxes;
  }

  /**
   * Get all hitboxes (for visualization)
   */
  getHitboxes(): Hitbox[] {
    return this.hitboxes;
  }

  /**
   * Clear all hitboxes
   */
  clearHitboxes() {
    this.hitboxes = [];
    this.previousPositions.clear();
    this.hitCooldown.clear();
  }
}

