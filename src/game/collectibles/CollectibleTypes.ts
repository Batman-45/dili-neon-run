import * as THREE from 'three';

export const PowerUpType = {
  SHIELD: 'SHIELD',
  MAGNET: 'MAGNET',
  BOOST: 'BOOST',
  MULTIPLIER: 'MULTIPLIER',
} as const;

export type PowerUpType = (typeof PowerUpType)[keyof typeof PowerUpType];

export const CollectibleType = {
  NEON_BIT: 'NEON_BIT',
  POWERUP: 'POWERUP',
} as const;

export type CollectibleType = (typeof CollectibleType)[keyof typeof CollectibleType];

export interface ICollectible {
  readonly group: THREE.Group;
  active: boolean;
  collected: boolean;
  readonly boundingBox: THREE.Box3;
  update(delta: number, forwardDistance: number): void;
  collect(): void;
  recycle(): void;
  dispose(): void;
}

export interface PowerUpConfig {
  type: PowerUpType;
  duration: number;
  label: string;
  colorHex: number;
  colorCss: string;
}

export const POWER_UP_CONFIGS: Record<PowerUpType, PowerUpConfig> = {
  [PowerUpType.SHIELD]: {
    type: PowerUpType.SHIELD,
    duration: 6.0,
    label: 'PHASE SHIELD',
    colorHex: 0x00f0ff,
    colorCss: '#00f0ff',
  },
  [PowerUpType.MAGNET]: {
    type: PowerUpType.MAGNET,
    duration: 8.0,
    label: 'PULSE MAGNET',
    colorHex: 0xff007f,
    colorCss: '#ff007f',
  },
  [PowerUpType.BOOST]: {
    type: PowerUpType.BOOST,
    duration: 4.2,
    label: 'HYPER BOOST',
    colorHex: 0xffaa00,
    colorCss: '#ffaa00',
  },
  [PowerUpType.MULTIPLIER]: {
    type: PowerUpType.MULTIPLIER,
    duration: 7.0,
    label: '2X MULTIPLIER',
    colorHex: 0x9d00ff,
    colorCss: '#9d00ff',
  },
};
