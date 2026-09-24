import * as THREE from 'three';
import type { LaneIndex } from '../character/DiliCharacter';

export const ObstacleType = {
  HIGH_BARRIER: 'HIGH_BARRIER', // Ground hurdle - Jump over
  LOW_BARRIER: 'LOW_BARRIER',   // Elevated overhead laser - Slide under
  BLOCKADE: 'BLOCKADE',         // Full lane cyber wall - Dodge / Switch lane
} as const;

export type ObstacleType = (typeof ObstacleType)[keyof typeof ObstacleType];

export interface IObstacle {
  readonly group: THREE.Group;
  type: ObstacleType;
  lane: LaneIndex;
  active: boolean;
  clearedByPlayer: boolean;
  nearMissAwarded: boolean;
  smashedByDash: boolean;
  readonly boundingBox: THREE.Box3;

  spawn(type: ObstacleType, lane: LaneIndex, z: number): void;
  update(delta: number, forwardDistance: number): void;
  smash(): void;
  recycle(): void;
  dispose(): void;
}
