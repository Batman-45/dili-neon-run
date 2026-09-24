import * as THREE from 'three';
import { NeonBit } from './NeonBit';
import { PowerUpItem } from './PowerUpItem';
import { PowerUpType } from './CollectibleTypes';
import { TrackManager } from '../track/TrackManager';
import type { LaneIndex } from '../character/DiliCharacter';

export interface CollectibleManagerCallbacks {
  onBitCollected?: (x: number, y: number, z: number) => void;
  onPowerUpCollected?: (type: PowerUpType) => void;
}

export class CollectibleManager {
  public readonly group: THREE.Group;
  private bitPool: NeonBit[] = [];
  private powerUpPool: PowerUpItem[] = [];

  private readonly bitPoolSize: number = 48;
  private readonly powerUpPoolSize: number = 6;

  private spawnDistanceCountdown: number = 15;
  private powerUpDistanceCountdown: number = 75; // First powerup around 75m
  private callbacks: CollectibleManagerCallbacks;

  constructor(scene: THREE.Scene, callbacks: CollectibleManagerCallbacks = {}) {
    this.callbacks = callbacks;
    this.group = new THREE.Group();
    scene.add(this.group);

    // Pre-allocate Neon Bits pool
    for (let i = 0; i < this.bitPoolSize; i++) {
      const bit = new NeonBit();
      this.bitPool.push(bit);
      this.group.add(bit.group);
    }

    // Pre-allocate PowerUp pool
    for (let i = 0; i < this.powerUpPoolSize; i++) {
      const item = new PowerUpItem();
      this.powerUpPool.push(item);
      this.group.add(item.group);
    }
  }

  public update(
    delta: number,
    forwardMove: number,
    diliPos: THREE.Vector3,
    isMagnetActive: boolean
  ): void {
    const magnetRadiusSq = 8.5 * 8.5;

    // 1. Update Neon Bits
    for (const bit of this.bitPool) {
      if (bit.active) {
        bit.update(delta, forwardMove);

        // Magnet attraction pull
        if (isMagnetActive && !bit.collected) {
          const bitPos = bit.group.position;
          const dx = diliPos.x - bitPos.x;
          const dy = diliPos.y - bitPos.y;
          const dz = diliPos.z - bitPos.z;
          const distSq = dx * dx + dy * dy + dz * dz;

          if (distSq < magnetRadiusSq) {
            bit.attractToward(diliPos, delta, 22);
          }
        }

        // Recycle if passed behind camera
        if (bit.group.position.z > 25) {
          bit.recycle();
        }
      }
    }

    // 2. Update Power-Up Items
    for (const item of this.powerUpPool) {
      if (item.active) {
        item.update(delta, forwardMove);
        if (item.group.position.z > 25) {
          item.recycle();
        }
      }
    }

    // 3. Procedural Spawning Countdown
    this.spawnDistanceCountdown -= forwardMove;
    this.powerUpDistanceCountdown -= forwardMove;

    if (this.spawnDistanceCountdown <= 0) {
      this.spawnBitPattern();
      this.spawnDistanceCountdown = 28 + Math.random() * 12; // Spacing between patterns
    }

    if (this.powerUpDistanceCountdown <= 0) {
      this.spawnPowerUp();
      this.powerUpDistanceCountdown = 65 + Math.random() * 35; // Spacing between powerups (~80m)
    }
  }

  public checkCollisions(diliBoundingBox: THREE.Box3, diliPos: THREE.Vector3): void {
    // 1. Check Neon Bits pickups
    for (const bit of this.bitPool) {
      if (bit.active && !bit.collected) {
        // Fast Z check
        if (Math.abs(bit.group.position.z - diliPos.z) < 1.1) {
          if (diliBoundingBox.intersectsBox(bit.boundingBox)) {
            bit.collect();
            this.callbacks.onBitCollected?.(
              bit.group.position.x,
              bit.group.position.y,
              bit.group.position.z
            );
          }
        }
      }
    }

    // 2. Check Power-Up pickups
    for (const item of this.powerUpPool) {
      if (item.active && !item.collected) {
        if (Math.abs(item.group.position.z - diliPos.z) < 1.3) {
          if (diliBoundingBox.intersectsBox(item.boundingBox)) {
            const powerUpType = item.type;
            item.collect();
            this.callbacks.onPowerUpCollected?.(powerUpType);
          }
        }
      }
    }
  }

  private spawnBitPattern(): void {
    const lane: LaneIndex = ([-1, 0, 1] as LaneIndex[])[Math.floor(Math.random() * 3)];
    const startZ = -140;
    const patternType = Math.floor(Math.random() * 3);

    switch (patternType) {
      case 0: {
        // Straight ground line (5 bits)
        const laneX = TrackManager.getLaneX(lane);
        for (let i = 0; i < 5; i++) {
          const bit = this.getAvailableBit();
          if (bit) {
            bit.spawn(laneX, 0.45, startZ - i * 3.2);
          }
        }
        break;
      }

      case 1: {
        // Jump Arch (5 bits forming an arc)
        const laneX = TrackManager.getLaneX(lane);
        const heights = [0.45, 1.1, 1.6, 1.1, 0.45];
        for (let i = 0; i < heights.length; i++) {
          const bit = this.getAvailableBit();
          if (bit) {
            bit.spawn(laneX, heights[i], startZ - i * 3.0);
          }
        }
        break;
      }

      case 2: {
        // Slide lane line (4 low bits)
        const laneX = TrackManager.getLaneX(lane);
        for (let i = 0; i < 4; i++) {
          const bit = this.getAvailableBit();
          if (bit) {
            bit.spawn(laneX, 0.25, startZ - i * 3.2);
          }
        }
        break;
      }
    }
  }

  private spawnPowerUp(): void {
    const item = this.getAvailablePowerUp();
    if (!item) return;

    const lane: LaneIndex = ([-1, 0, 1] as LaneIndex[])[Math.floor(Math.random() * 3)];
    const types: PowerUpType[] = [
      PowerUpType.SHIELD,
      PowerUpType.MAGNET,
      PowerUpType.BOOST,
      PowerUpType.MULTIPLIER,
    ];
    const chosenType = types[Math.floor(Math.random() * types.length)];

    item.spawn(chosenType, lane, -145);
  }

  private getAvailableBit(): NeonBit | null {
    for (const bit of this.bitPool) {
      if (!bit.active && !bit.collected) {
        return bit;
      }
    }
    return null;
  }

  private getAvailablePowerUp(): PowerUpItem | null {
    for (const item of this.powerUpPool) {
      if (!item.active && !item.collected) {
        return item;
      }
    }
    return null;
  }

  public reset(): void {
    for (const bit of this.bitPool) {
      bit.recycle();
    }
    for (const item of this.powerUpPool) {
      item.recycle();
    }
    this.spawnDistanceCountdown = 12;
    this.powerUpDistanceCountdown = 65;
  }

  public dispose(): void {
    for (const bit of this.bitPool) {
      bit.dispose();
    }
    for (const item of this.powerUpPool) {
      item.dispose();
    }
  }
}
