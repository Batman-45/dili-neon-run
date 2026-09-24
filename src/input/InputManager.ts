export interface InputCallbacks {
  onLaneLeft: () => void;
  onLaneRight: () => void;
  onJump: () => void;
  onSlide: () => void;
  onDash: () => void;
}

export class InputManager {
  private callbacks: InputCallbacks;
  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private touchStartTime: number = 0;
  private isSwiping: boolean = false;

  private lastTapTime: number = 0;
  private lastTapX: number = 0;
  private lastTapY: number = 0;

  private readonly minSwipeDistance: number = 30; // pixels
  private readonly maxTapDistance: number = 18;    // pixels
  private readonly doubleTapMaxDelay: number = 320; // ms

  private boundKeyDown!: (e: KeyboardEvent) => void;
  private boundTouchStart!: (e: TouchEvent) => void;
  private boundTouchMove!: (e: TouchEvent) => void;
  private boundTouchEnd!: (e: TouchEvent) => void;
  private boundPreventGesture!: (e: Event) => void;
  private boundContextMenu!: (e: MouseEvent) => void;

  constructor(callbacks: InputCallbacks) {
    this.callbacks = callbacks;
    this.initKeyboard();
    this.initTouch();
    this.initPreventDefaultBehaviors();
  }

  private initKeyboard(): void {
    this.boundKeyDown = (e: KeyboardEvent) => {
      // Prevent browser repeat events when keys are held down
      if (e.repeat) return;

      // Prevent default browser scrolling on arrow keys, space, or page down
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }

      switch (e.code) {
        case 'KeyA':
        case 'ArrowLeft':
          this.callbacks.onLaneLeft();
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.callbacks.onLaneRight();
          break;
        case 'KeyW':
        case 'ArrowUp':
        case 'Space':
          this.callbacks.onJump();
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.callbacks.onSlide();
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyE':
          this.callbacks.onDash();
          break;
      }
    };

    window.addEventListener('keydown', this.boundKeyDown);
  }

  private initTouch(): void {
    this.boundTouchStart = (e: TouchEvent) => {
      // Do not intercept taps directly targeting UI buttons, links, or inputs
      const target = e.target as HTMLElement | null;
      if (target && target.closest('button, .cyber-button, a, input, select')) {
        return;
      }

      if (e.touches.length === 1) {
        const touch = e.touches[0];
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
        this.touchStartTime = performance.now();
        this.isSwiping = false;
      }
    };

    this.boundTouchMove = (e: TouchEvent) => {
      // Prevent mobile screen rubber-banding / bounce-scroll during gameplay gestures
      if (e.cancelable) {
        e.preventDefault();
      }
    };

    this.boundTouchEnd = (e: TouchEvent) => {
      // Ignore if touch originated on an interactive button
      const target = e.target as HTMLElement | null;
      if (target && target.closest('button, .cyber-button, a, input, select')) {
        return;
      }

      if (e.changedTouches.length === 0) return;

      const touch = e.changedTouches[0];
      const diffX = touch.clientX - this.touchStartX;
      const diffY = touch.clientY - this.touchStartY;
      const absDiffX = Math.abs(diffX);
      const absDiffY = Math.abs(diffY);
      const touchDuration = performance.now() - this.touchStartTime;

      // 1. Detect Swipes
      if (Math.max(absDiffX, absDiffY) >= this.minSwipeDistance) {
        this.isSwiping = true;

        if (absDiffX > absDiffY) {
          // Horizontal lane swipe
          if (diffX > 0) {
            this.callbacks.onLaneRight();
          } else {
            this.callbacks.onLaneLeft();
          }
        } else {
          // Vertical swipe
          if (diffY < 0) {
            this.callbacks.onJump();
          } else {
            this.callbacks.onSlide();
          }
        }
        return;
      }

      // 2. Detect Double Tap (Dash) if movement was minimal
      if (!this.isSwiping && absDiffX < this.maxTapDistance && absDiffY < this.maxTapDistance && touchDuration < 280) {
        const now = performance.now();
        const distFromLastTap = Math.hypot(touch.clientX - this.lastTapX, touch.clientY - this.lastTapY);

        if (now - this.lastTapTime < this.doubleTapMaxDelay && distFromLastTap < this.maxTapDistance * 2) {
          // Valid double tap
          this.callbacks.onDash();
          this.lastTapTime = 0;
        } else {
          this.lastTapTime = now;
          this.lastTapX = touch.clientX;
          this.lastTapY = touch.clientY;
        }
      }
    };

    const container = document.getElementById('game-container') ?? window;
    container.addEventListener('touchstart', this.boundTouchStart as EventListener, { passive: true });
    window.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    window.addEventListener('touchend', this.boundTouchEnd as EventListener, { passive: true });
  }

  private initPreventDefaultBehaviors(): void {
    // Prevent iOS Safari pinch-to-zoom gestures during gameplay
    this.boundPreventGesture = (e: Event) => e.preventDefault();
    window.addEventListener('gesturestart', this.boundPreventGesture, { passive: false });
    window.addEventListener('gesturechange', this.boundPreventGesture, { passive: false });

    // Prevent context menu on game canvas
    this.boundContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === 'CANVAS') {
        e.preventDefault();
      }
    };
    window.addEventListener('contextmenu', this.boundContextMenu);
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    const container = document.getElementById('game-container') ?? window;
    container.removeEventListener('touchstart', this.boundTouchStart as EventListener);
    window.removeEventListener('touchmove', this.boundTouchMove);
    window.removeEventListener('touchend', this.boundTouchEnd as EventListener);
    window.removeEventListener('gesturestart', this.boundPreventGesture);
    window.removeEventListener('gesturechange', this.boundPreventGesture);
    window.removeEventListener('contextmenu', this.boundContextMenu);
  }
}
