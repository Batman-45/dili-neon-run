import { PowerUpType, POWER_UP_CONFIGS } from '../collectibles/CollectibleTypes';

export interface PowerUpCallbacks {
  onShieldActivated?: () => void;
  onShieldBroken?: () => void;
  onBoostActivated?: (duration: number) => void;
  onBoostEnded?: () => void;
}

export class PowerUpSystem {
  public shieldActive: boolean = false;
  public magnetTimer: number = 0;
  public boostTimer: number = 0;
  public multiplierTimer: number = 0;

  private callbacks: PowerUpCallbacks;

  constructor(callbacks: PowerUpCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public activate(type: PowerUpType): void {
    const config = POWER_UP_CONFIGS[type];

    switch (type) {
      case PowerUpType.SHIELD:
        this.shieldActive = true;
        this.callbacks.onShieldActivated?.();
        break;

      case PowerUpType.MAGNET:
        this.magnetTimer = config.duration;
        break;

      case PowerUpType.BOOST:
        this.boostTimer = config.duration;
        this.callbacks.onBoostActivated?.(config.duration);
        break;

      case PowerUpType.MULTIPLIER:
        this.multiplierTimer = config.duration;
        break;
    }
  }

  public consumeShield(): boolean {
    if (this.shieldActive) {
      this.shieldActive = false;
      this.callbacks.onShieldBroken?.();
      return true; // Shield successfully absorbed the collision
    }
    return false;
  }

  public isMagnetActive(): boolean {
    return this.magnetTimer > 0;
  }

  public isBoostActive(): boolean {
    return this.boostTimer > 0;
  }

  public isMultiplierActive(): boolean {
    return this.multiplierTimer > 0;
  }

  public update(delta: number): void {
    if (this.magnetTimer > 0) {
      this.magnetTimer = Math.max(0, this.magnetTimer - delta);
    }

    if (this.boostTimer > 0) {
      this.boostTimer -= delta;
      if (this.boostTimer <= 0) {
        this.boostTimer = 0;
        this.callbacks.onBoostEnded?.();
      }
    }

    if (this.multiplierTimer > 0) {
      this.multiplierTimer = Math.max(0, this.multiplierTimer - delta);
    }
  }

  public getActivePowerUp(): {
    type: PowerUpType;
    label: string;
    remaining: number;
    total: number;
    colorCss: string;
  } | null {
    // Return the most urgent active timed power-up, or shield if active
    if (this.boostTimer > 0) {
      return {
        type: PowerUpType.BOOST,
        label: POWER_UP_CONFIGS[PowerUpType.BOOST].label,
        remaining: this.boostTimer,
        total: POWER_UP_CONFIGS[PowerUpType.BOOST].duration,
        colorCss: POWER_UP_CONFIGS[PowerUpType.BOOST].colorCss,
      };
    }

    if (this.shieldActive) {
      return {
        type: PowerUpType.SHIELD,
        label: POWER_UP_CONFIGS[PowerUpType.SHIELD].label,
        remaining: 6.0,
        total: 6.0,
        colorCss: POWER_UP_CONFIGS[PowerUpType.SHIELD].colorCss,
      };
    }

    if (this.magnetTimer > 0) {
      return {
        type: PowerUpType.MAGNET,
        label: POWER_UP_CONFIGS[PowerUpType.MAGNET].label,
        remaining: this.magnetTimer,
        total: POWER_UP_CONFIGS[PowerUpType.MAGNET].duration,
        colorCss: POWER_UP_CONFIGS[PowerUpType.MAGNET].colorCss,
      };
    }

    if (this.multiplierTimer > 0) {
      return {
        type: PowerUpType.MULTIPLIER,
        label: POWER_UP_CONFIGS[PowerUpType.MULTIPLIER].label,
        remaining: this.multiplierTimer,
        total: POWER_UP_CONFIGS[PowerUpType.MULTIPLIER].duration,
        colorCss: POWER_UP_CONFIGS[PowerUpType.MULTIPLIER].colorCss,
      };
    }

    return null;
  }

  public reset(): void {
    if (this.shieldActive) {
      this.shieldActive = false;
      this.callbacks.onShieldBroken?.();
    }
    if (this.boostTimer > 0) {
      this.boostTimer = 0;
      this.callbacks.onBoostEnded?.();
    }
    this.magnetTimer = 0;
    this.multiplierTimer = 0;
  }
}
