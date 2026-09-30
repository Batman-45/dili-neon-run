import { PowerUpType, POWER_UP_CONFIGS, type ActivePowerUpStatus } from '../collectibles/CollectibleTypes';

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

  public getActivePowerUps(): ActivePowerUpStatus[] {
    const list: ActivePowerUpStatus[] = [];

    if (this.shieldActive) {
      list.push({
        type: PowerUpType.SHIELD,
        label: POWER_UP_CONFIGS[PowerUpType.SHIELD].label,
        icon: POWER_UP_CONFIGS[PowerUpType.SHIELD].icon,
        remaining: 1,
        total: 1,
        colorCss: POWER_UP_CONFIGS[PowerUpType.SHIELD].colorCss,
        isShield: true,
      });
    }

    if (this.boostTimer > 0) {
      list.push({
        type: PowerUpType.BOOST,
        label: POWER_UP_CONFIGS[PowerUpType.BOOST].label,
        icon: POWER_UP_CONFIGS[PowerUpType.BOOST].icon,
        remaining: this.boostTimer,
        total: POWER_UP_CONFIGS[PowerUpType.BOOST].duration,
        colorCss: POWER_UP_CONFIGS[PowerUpType.BOOST].colorCss,
      });
    }

    if (this.magnetTimer > 0) {
      list.push({
        type: PowerUpType.MAGNET,
        label: POWER_UP_CONFIGS[PowerUpType.MAGNET].label,
        icon: POWER_UP_CONFIGS[PowerUpType.MAGNET].icon,
        remaining: this.magnetTimer,
        total: POWER_UP_CONFIGS[PowerUpType.MAGNET].duration,
        colorCss: POWER_UP_CONFIGS[PowerUpType.MAGNET].colorCss,
      });
    }

    if (this.multiplierTimer > 0) {
      list.push({
        type: PowerUpType.MULTIPLIER,
        label: POWER_UP_CONFIGS[PowerUpType.MULTIPLIER].label,
        icon: POWER_UP_CONFIGS[PowerUpType.MULTIPLIER].icon,
        remaining: this.multiplierTimer,
        total: POWER_UP_CONFIGS[PowerUpType.MULTIPLIER].duration,
        colorCss: POWER_UP_CONFIGS[PowerUpType.MULTIPLIER].colorCss,
      });
    }

    return list;
  }

  public getActivePowerUp(): ActivePowerUpStatus | null {
    const active = this.getActivePowerUps();
    return active.length > 0 ? active[0] : null;
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
