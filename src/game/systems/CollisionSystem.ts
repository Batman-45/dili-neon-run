import { ObstacleType } from '../obstacles/ObstacleTypes';
import { Obstacle } from '../obstacles/Obstacle';
import { DiliCharacter, CharacterState } from '../character/DiliCharacter';
import { ComboSystem } from './ComboSystem';
import { AudioManager } from '../../audio/AudioManager';
import { Engine } from '../../core/Engine';
import { PowerUpSystem } from './PowerUpSystem';

export interface CollisionCallbacks {
  onNearMiss?: (lane: number, type: string) => void;
  onCrash?: () => void;
  onStumble?: () => void;
  onDashSmash?: () => void;
}

export class CollisionSystem {
  private dili: DiliCharacter;
  private combo: ComboSystem;
  private audio: AudioManager;
  private engine: Engine;
  private powerUps: PowerUpSystem;
  private callbacks: CollisionCallbacks;

  constructor(
    dili: DiliCharacter,
    combo: ComboSystem,
    audio: AudioManager,
    engine: Engine,
    powerUps: PowerUpSystem,
    callbacks: CollisionCallbacks = {}
  ) {
    this.dili = dili;
    this.combo = combo;
    this.audio = audio;
    this.engine = engine;
    this.powerUps = powerUps;
    this.callbacks = callbacks;
  }

  public check(activeObstacles: Obstacle[]): void {
    if (this.dili.getState() === CharacterState.CRASHED) {
      return; // Already crashed
    }

    const diliPos = this.dili.group.position;

    for (const obs of activeObstacles) {
      if (!obs.active) continue;

      const obsPos = obs.group.position;
      const dz = obsPos.z - diliPos.z;

      // 1. Mark obstacle cleared when it has passed safely behind player
      if (dz > 1.2 && !obs.clearedByPlayer) {
        obs.clearedByPlayer = true;
        this.combo.onObstacleCleared();
        continue;
      }

      // Only check obstacles currently passing the player's collision window (z ∈ [-0.85, 0.85])
      if (Math.abs(dz) > 0.85) {
        continue;
      }

      const dx = Math.abs(diliPos.x - obsPos.x);

      // ==========================================
      // ADJACENT LANE: NEAR-MISS DETECTION
      // ==========================================
      if (dx > 1.25 && dx <= 2.85) {
        // Player is passing in the adjacent lane
        if (!obs.nearMissAwarded && !obs.clearedByPlayer && !this.dili.isInvulnerable) {
          obs.nearMissAwarded = true;
          this.combo.onNearMiss();
          this.audio.playNearMiss();
          this.callbacks.onNearMiss?.(obs.lane, obs.type);
        }
        continue;
      }

      // ==========================================
      // SAME LANE: COLLISION RESOLUTION
      // ==========================================
      if (dx <= 1.25) {
        // 1. Hyper Dash Invulnerability: Smash obstacle cleanly
        if (this.dili.isInvulnerable || this.dili.getState() === CharacterState.DASHING) {
          if (!obs.smashedByDash) {
            obs.smash();
            this.audio.playDashSmash();
            this.combo.onDashSmash();
            this.engine.shake(0.25, 0.15);
            this.callbacks.onDashSmash?.();
          }
          continue;
        }

        // 2. High Barrier (Hurdle - Must be Jumped Over)
        if (obs.type === ObstacleType.HIGH_BARRIER) {
          if (diliPos.y >= 0.82) {
            // Cleared hurdle airborne!
            if (!obs.clearedByPlayer) {
              obs.clearedByPlayer = true;
              this.combo.onObstacleCleared();

              // If jumped closely near hurdle top, award bonus near-miss
              if (diliPos.y < 1.15 && !obs.nearMissAwarded) {
                obs.nearMissAwarded = true;
                this.combo.onNearMiss();
                this.audio.playNearMiss();
                this.callbacks.onNearMiss?.(obs.lane, obs.type);
              }
            }
          } else {
            // Check Phase Shield protection first
            if (this.powerUps.consumeShield()) {
              obs.smash();
              this.audio.playShieldBreak();
              this.engine.shake(0.35, 0.22);
              continue;
            }

            if (diliPos.y > 0.55) {
              // Clipped the top edge of hurdle -> Stumble
              this.triggerStumble(obs);
            } else {
              // Direct collision into hurdle -> Crash
              this.triggerCrash();
            }
          }
          continue;
        }

        // 3. Low Barrier (Elevated Laser - Must be Slid Under)
        if (obs.type === ObstacleType.LOW_BARRIER) {
          if (this.dili.getState() === CharacterState.SLIDING && diliPos.y <= 0.15) {
            // Slid under safely!
            if (!obs.clearedByPlayer) {
              obs.clearedByPlayer = true;
              this.combo.onObstacleCleared();

              if (!obs.nearMissAwarded) {
                obs.nearMissAwarded = true;
                this.combo.onNearMiss();
                this.audio.playNearMiss();
                this.callbacks.onNearMiss?.(obs.lane, obs.type);
              }
            }
          } else {
            // Check Phase Shield protection
            if (this.powerUps.consumeShield()) {
              obs.smash();
              this.audio.playShieldBreak();
              this.engine.shake(0.35, 0.22);
              continue;
            }

            // Standing or jumping into overhead laser -> Crash
            this.triggerCrash();
          }
          continue;
        }

        // 4. Blockade (Full Wall - Must be Dodged)
        if (obs.type === ObstacleType.BLOCKADE) {
          // Check Phase Shield protection
          if (this.powerUps.consumeShield()) {
            obs.smash();
            this.audio.playShieldBreak();
            this.engine.shake(0.35, 0.22);
            continue;
          }

          if (dx > 0.92) {
            this.triggerStumble(obs);
          } else {
            this.triggerCrash();
          }
          continue;
        }
      }
    }
  }

  private triggerStumble(obs: Obstacle): void {
    if (this.dili.getState() === CharacterState.STUMBLING || this.dili.getState() === CharacterState.CRASHED) {
      return;
    }

    obs.clearedByPlayer = true;
    this.dili.stumble();
    this.audio.playStumble();
    this.combo.onStumble();
    this.engine.shake(0.28, 0.22);
    this.callbacks.onStumble?.();
  }

  private triggerCrash(): void {
    if (this.dili.getState() === CharacterState.CRASHED) return;

    this.dili.crash();
    this.audio.playCrash();
    this.combo.onCrash();
    this.engine.shake(0.65, 0.55);
    this.callbacks.onCrash?.();
  }
}
