export class ComboSystem {
  public score: number = 0;
  public comboMultiplier: number = 1;
  public maxComboAchieved: number = 1;
  public nearMissCount: number = 0;
  public bitsCollected: number = 0;

  // Power-up multiplier modifier (e.g. 2 when 2X MULTIPLIER is active)
  public powerUpMultiplier: number = 1;

  private comboTimer: number = 0;
  private readonly comboDuration: number = 4.2; // seconds before combo decays
  public personalBest: number = 0;

  private readonly STORAGE_KEY = 'dili_neon_run_high_score';

  constructor() {
    this.loadPersonalBest();
  }

  private loadPersonalBest(): void {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        this.personalBest = parseInt(saved, 10) || 0;
      }
    } catch {
      this.personalBest = 0;
    }
  }

  public savePersonalBest(): void {
    if (this.score > this.personalBest) {
      this.personalBest = Math.floor(this.score);
      try {
        localStorage.setItem(this.STORAGE_KEY, this.personalBest.toString());
      } catch {
        // Safe fallback for restricted storage environments
      }
    }
  }

  public update(delta: number): void {
    if (this.comboMultiplier > 1) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) {
        // Decay combo multiplier by 1 step
        this.comboMultiplier = Math.max(1, this.comboMultiplier - 1);
        this.comboTimer = this.comboDuration * 0.75;
      }
    }
  }

  public addDistanceScore(metersIncrement: number): void {
    // Distance score with combo and power-up multipliers
    this.score += metersIncrement * 1.0 * this.comboMultiplier * this.powerUpMultiplier;
  }

  public onBitCollected(): void {
    this.bitsCollected++;
    // +25 points per bit, scaled by combo and power-up multiplier
    this.score += 25 * this.comboMultiplier * this.powerUpMultiplier;

    // Collecting bits refreshes combo timer to sustain streak
    if (this.comboMultiplier > 1) {
      this.comboTimer = Math.min(this.comboDuration, this.comboTimer + 0.45);
    }
  }

  public onObstacleCleared(): void {
    this.score += 40 * this.comboMultiplier * this.powerUpMultiplier;
  }

  public onNearMiss(): void {
    this.nearMissCount++;
    this.comboMultiplier = Math.min(5, this.comboMultiplier + 1);
    this.comboTimer = this.comboDuration;

    if (this.comboMultiplier > this.maxComboAchieved) {
      this.maxComboAchieved = this.comboMultiplier;
    }

    this.score += 150 * this.comboMultiplier * this.powerUpMultiplier;
  }

  public onDashSmash(): void {
    this.score += 120 * this.comboMultiplier * this.powerUpMultiplier;
  }

  public onStumble(): void {
    // Minor penalty
    this.comboMultiplier = Math.max(1, Math.floor(this.comboMultiplier / 2));
    this.comboTimer = 0;
  }

  public onCrash(): void {
    this.savePersonalBest();
    this.comboMultiplier = 1;
    this.comboTimer = 0;
  }

  public reset(): void {
    this.savePersonalBest();
    this.score = 0;
    this.comboMultiplier = 1;
    this.maxComboAchieved = 1;
    this.nearMissCount = 0;
    this.bitsCollected = 0;
    this.comboTimer = 0;
    this.powerUpMultiplier = 1;
  }

  public getEffectiveMultiplier(): number {
    return this.comboMultiplier * this.powerUpMultiplier;
  }

  public getComboProgressNormalized(): number {
    if (this.comboMultiplier <= 1 || this.comboTimer <= 0) return 0;
    return Math.min(1, this.comboTimer / this.comboDuration);
  }
}
