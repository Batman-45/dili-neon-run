import * as THREE from 'three';
import { Obstacle } from './Obstacle';
import { ObstacleType } from './ObstacleTypes';
import { DifficultyCurve } from '../systems/DifficultyCurve';
import type { LaneIndex } from '../character/DiliCharacter';

export class ObstacleManager {
  public readonly group: THREE.Group;
  private pool: Obstacle[] = [];
  private readonly poolSize: number = 24;

  private spawnZCursor: number = -120;
  private minSpawnDistanceAhead: number = 130; // Spawns safely far ahead
  private nextPatternDistance: number = 0;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    // Pre-allocate object pool to prevent runtime memory allocations and GC pauses
    for (let i = 0; i < this.poolSize; i++) {
      const obstacle = new Obstacle();
      this.pool.push(obstacle);
      this.group.add(obstacle.group);
    }
  }

  public update(delta: number, forwardDistance: number, distanceRun: number): void {
    // 1. Move all active obstacles forward with track scrolling
    for (const obs of this.pool) {
      if (obs.active) {
        obs.update(delta, forwardDistance);

        // Recycle if passed behind the camera
        if (obs.group.position.z > 25) {
          obs.recycle();
        }
      }
    }

    // 2. Check if we need to spawn new obstacles ahead
    this.spawnZCursor += forwardDistance;
    this.nextPatternDistance -= forwardDistance;

    const diffSettings = DifficultyCurve.getSettings(distanceRun);

    // If cursor has moved forward enough and we are behind the threshold horizon, spawn next pattern
    if (this.nextPatternDistance <= 0) {
      this.spawnPattern(diffSettings.level, diffSettings.multiLaneProb);
      this.nextPatternDistance = diffSettings.spawnIntervalMeters;
    }
  }

  private spawnPattern(level: number, multiLaneProb: number): void {
    const spawnZ = -this.minSpawnDistanceAhead;

    // Roll for pattern type
    const roll = Math.random();

    if (level === 1 || roll > multiLaneProb) {
      // Single lane obstacle pattern (safe, easily readable)
      const lane = this.getRandomLane();
      const types = [ObstacleType.HIGH_BARRIER, ObstacleType.LOW_BARRIER, ObstacleType.BLOCKADE];
      const type = types[Math.floor(Math.random() * types.length)];
      this.spawnSingleObstacle(type, lane, spawnZ);
    } else {
      // Multi-lane pattern: 2 lanes blocked, guaranteeing 1 completely clear safe lane
      const safeLane = this.getRandomLane();
      const blockedLanes = ([-1, 0, 1] as LaneIndex[]).filter((l) => l !== safeLane);

      // Block first lane
      const type1 = Math.random() < 0.5 ? ObstacleType.BLOCKADE : ObstacleType.HIGH_BARRIER;
      this.spawnSingleObstacle(type1, blockedLanes[0], spawnZ);

      // Block second lane (with either a blockade or jumpable/slideable obstacle)
      const type2 = Math.random() < 0.5 ? ObstacleType.LOW_BARRIER : ObstacleType.BLOCKADE;
      this.spawnSingleObstacle(type2, blockedLanes[1], spawnZ);
    }
  }

  private spawnSingleObstacle(type: ObstacleType, lane: LaneIndex, z: number): Obstacle | null {
    const obstacle = this.getAvailableObstacle();
    if (!obstacle) {
      return null;
    }

    obstacle.spawn(type, lane, z);
    return obstacle;
  }

  private getAvailableObstacle(): Obstacle | null {
    for (const obs of this.pool) {
      if (!obs.active) {
        return obs;
      }
    }
    return null;
  }

  private getRandomLane(): LaneIndex {
    const lanes: LaneIndex[] = [-1, 0, 1];
    return lanes[Math.floor(Math.random() * lanes.length)];
  }

  public getActiveObstacles(): Obstacle[] {
    return this.pool.filter((obs) => obs.active);
  }

  public reset(): void {
    for (const obs of this.pool) {
      obs.recycle();
    }
    this.spawnZCursor = -120;
    this.nextPatternDistance = 35; // Initial breathing room
  }

  public dispose(): void {
    for (const obs of this.pool) {
      obs.dispose();
    }
  }
}
