import { DMXUniverse } from './dmx-universe';
import { log } from './logger';

const FADE_STEP_INTERVAL = 25; // Match DMX refresh rate (40 Hz)

/**
 * FadeEngine — Linear interpolation engine for smooth transitions.
 * Resolution: one step per DMX frame (25ms).
 */
export class FadeEngine {
  private universe: DMXUniverse;
  private activeFade: ReturnType<typeof setInterval> | null = null;
  private fadeResolve: (() => void) | null = null;

  constructor(universe: DMXUniverse) {
    this.universe = universe;
  }

  /**
   * Linearly interpolate from current state to target over durationMs.
   * Calling fadeTo() while a fade is active cancels the previous fade.
   *
   * LERP formula per channel per step:
   *   v_t = v_start + (v_end - v_start) * (t_elapsed / t_total)
   * Result is clamped to [0, 255] integer.
   */
  fadeTo(targetChannels: number[], durationMs: number): Promise<void> {
    // Cancel any active fade
    this.cancelFade();

    if (durationMs <= 0) {
      // Instant snap
      this.universe.applySnapshot(targetChannels);
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.fadeResolve = resolve;

      const startChannels = this.universe.getRawChannelsArray();
      const startTime = Date.now();
      const totalSteps = Math.max(1, Math.ceil(durationMs / FADE_STEP_INTERVAL));

      log.debug(`FadeEngine: Starting fade over ${durationMs}ms (${totalSteps} steps)`);

      this.activeFade = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / durationMs);

        const interpolated: number[] = new Array(512);
        for (let i = 0; i < 512; i++) {
          const start = startChannels[i] || 0;
          const end = targetChannels[i] || 0;
          const value = start + (end - start) * progress;
          interpolated[i] = Math.max(0, Math.min(255, Math.round(value)));
        }

        this.universe.applySnapshot(interpolated);

        if (progress >= 1) {
          this.completeFade();
        }
      }, FADE_STEP_INTERVAL);
    });
  }

  /**
   * Immediately cancel any active fade.
   */
  cancelFade(): void {
    if (this.activeFade) {
      clearInterval(this.activeFade);
      this.activeFade = null;
      log.debug('FadeEngine: Fade cancelled');
    }
    if (this.fadeResolve) {
      this.fadeResolve();
      this.fadeResolve = null;
    }
  }

  /**
   * Check if a fade is currently active.
   */
  isFading(): boolean {
    return this.activeFade !== null;
  }

  /**
   * Complete the current fade.
   */
  private completeFade(): void {
    if (this.activeFade) {
      clearInterval(this.activeFade);
      this.activeFade = null;
    }
    if (this.fadeResolve) {
      this.fadeResolve();
      this.fadeResolve = null;
    }
    log.debug('FadeEngine: Fade complete');
  }

  /**
   * Fade to blackout over the specified duration.
   */
  fadeToBlackout(durationMs: number): Promise<void> {
    const blackout = new Array(512).fill(0);
    return this.fadeTo(blackout, durationMs);
  }
}
