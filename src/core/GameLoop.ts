export type UpdateCallback = (delta: number, elapsed: number) => void;
export type RenderCallback = () => void;

export class GameLoop {
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private lastTime: number = 0;
  private elapsed: number = 0;
  private animationFrameId: number = 0;

  // FPS Tracking
  private frameCount: number = 0;
  private fpsTimer: number = 0;
  public currentFps: number = 60;

  private updateCallbacks: Set<UpdateCallback> = new Set();
  private renderCallback: RenderCallback | null = null;

  constructor() {}

  public onUpdate(callback: UpdateCallback): () => void {
    this.updateCallbacks.add(callback);
    return () => this.updateCallbacks.delete(callback);
  }

  public setRender(callback: RenderCallback): void {
    this.renderCallback = callback;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop = this.loop.bind(this);
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  public stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
  }

  /** Suspend update/render callbacks without cancelling the RAF chain. */
  public pause(): void {
    this.isPaused = true;
  }

  /** Resume from pause — resets lastTime so there is no delta spike. */
  public resume(): void {
    this.isPaused = false;
    this.lastTime = performance.now();
  }

  private loop(currentTime: number): void {
    if (!this.isRunning) return;

    this.animationFrameId = requestAnimationFrame(this.loop);

    // When paused, keep the RAF alive but skip all updates
    if (this.isPaused) {
      this.lastTime = currentTime;
      return;
    }

    // Delta time in seconds, clamped to max 0.1s to prevent physics spirals
    const deltaMs = currentTime - this.lastTime;
    this.lastTime = currentTime;
    const delta = Math.min(deltaMs / 1000, 0.1);
    this.elapsed += delta;

    // FPS calculation
    this.frameCount++;
    this.fpsTimer += delta;
    if (this.fpsTimer >= 0.5) {
      this.currentFps = Math.round(this.frameCount / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    // Execute update callbacks
    for (const callback of this.updateCallbacks) {
      callback(delta, this.elapsed);
    }

    // Execute render callback
    if (this.renderCallback) {
      this.renderCallback();
    }
  }
}
