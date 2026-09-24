export interface DifficultySettings {
  level: number;
  speed: number;
  spawnIntervalMeters: number;
  multiLaneProb: number;
  complexPatternProb: number;
}

export class DifficultyCurve {
  public static getSettings(distanceRun: number): DifficultySettings {
    // Phase 1 / Onboarding (0 to 300m: ~first 20-30 seconds)
    if (distanceRun < 300) {
      return {
        level: 1,
        speed: 22,
        spawnIntervalMeters: 46, // Generous reaction time
        multiLaneProb: 0.0,      // Only single-lane obstacles
        complexPatternProb: 0.0,
      };
    }

    // Phase 2 / City Outskirts (300 to 750m)
    if (distanceRun < 750) {
      const progress = (distanceRun - 300) / 450;
      return {
        level: 2,
        speed: 22 + progress * 2.5, // 22 -> 24.5 u/s
        spawnIntervalMeters: 46 - progress * 8, // 46 -> 38m
        multiLaneProb: 0.35,     // Occasional 2-lane blocks
        complexPatternProb: 0.2,
      };
    }

    // Phase 3 / Downtown Cyber Core (750 to 1600m)
    if (distanceRun < 1600) {
      const progress = (distanceRun - 750) / 850;
      return {
        level: 3,
        speed: 24.5 + progress * 3.5, // 24.5 -> 28 u/s
        spawnIntervalMeters: 38 - progress * 8, // 38 -> 30m
        multiLaneProb: 0.55,
        complexPatternProb: 0.45,
      };
    }

    // Phase 4 / Hyperdrive Overdrive (1600m+)
    const progress = Math.min((distanceRun - 1600) / 1500, 1.0);
    return {
      level: 4,
      speed: 28 + progress * 4.0, // 28 -> 32 u/s
      spawnIntervalMeters: 30 - progress * 4, // 30 -> 26m
      multiLaneProb: 0.7,
      complexPatternProb: 0.65,
    };
  }
}
