/**
 * GameStateManager — centralized state machine for Dili: Neon Run.
 *
 * Drives which screen is visible and whether the game loop ticks.
 * States: START → PLAYING → PAUSED → GAME_OVER → PLAYING (restart)
 */
export const GameState = {
  START: 'START',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER',
} as const;

export type GameState = typeof GameState[keyof typeof GameState];

export interface GameStateCallbacks {
  onStartGame: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onReturnToTitle: () => void;
  onCrash: () => void;
}

export class GameStateManager {
  private state: GameState = GameState.START;
  private callbacks: GameStateCallbacks;

  constructor(callbacks: GameStateCallbacks) {
    this.callbacks = callbacks;
  }

  public getState(): GameState {
    return this.state;
  }

  public isPlaying(): boolean {
    return this.state === GameState.PLAYING;
  }

  public isPaused(): boolean {
    return this.state === GameState.PAUSED;
  }

  /** Called when the player presses PLAY on the start screen. */
  public startGame(): void {
    if (this.state !== GameState.START) return;
    this.state = GameState.PLAYING;
    this.callbacks.onStartGame();
  }

  /** Called when Escape / P is pressed during gameplay. */
  public togglePause(): void {
    if (this.state === GameState.PLAYING) {
      this.state = GameState.PAUSED;
      this.callbacks.onPause();
    } else if (this.state === GameState.PAUSED) {
      this.state = GameState.PLAYING;
      this.callbacks.onResume();
    }
  }

  /** Called from the pause screen Resume button. */
  public resume(): void {
    if (this.state !== GameState.PAUSED) return;
    this.state = GameState.PLAYING;
    this.callbacks.onResume();
  }

  /** Called when the character crashes — transition to GAME_OVER. */
  public crash(): void {
    if (this.state !== GameState.PLAYING) return;
    this.state = GameState.GAME_OVER;
    this.callbacks.onCrash();
  }

  /** Called from Game Over or Pause — restart the run. */
  public restart(): void {
    if (this.state !== GameState.GAME_OVER && this.state !== GameState.PAUSED) return;
    this.state = GameState.PLAYING;
    this.callbacks.onRestart();
  }

  /** Called from Pause — go back to the title/start screen. */
  public returnToTitle(): void {
    if (this.state !== GameState.PAUSED && this.state !== GameState.GAME_OVER) return;
    this.state = GameState.START;
    this.callbacks.onReturnToTitle();
  }
}
