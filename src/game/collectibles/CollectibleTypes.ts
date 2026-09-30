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
  pickupAnnouncement: string;
  icon: string;
  colorHex: number;
  colorCss: string;
  accentHex: number;
}

export interface ActivePowerUpStatus {
  type: PowerUpType;
  label: string;
  icon: string;
  remaining: number;
  total: number;
  colorCss: string;
  isShield?: boolean;
}

export const POWER_UP_CONFIGS: Record<PowerUpType, PowerUpConfig> = {
  [PowerUpType.SHIELD]: {
    type: PowerUpType.SHIELD,
    duration: 6.0,
    label: 'SHIELD',
    pickupAnnouncement: 'SHIELD!',
    icon: '🛡️',
    colorHex: 0x00f0ff,
    colorCss: '#00f0ff',
    accentHex: 0x00a8ff,
  },
  [PowerUpType.MAGNET]: {
    type: PowerUpType.MAGNET,
    duration: 8.0,
    label: 'MAGNET',
    pickupAnnouncement: 'MAGNET!',
    icon: '🧲',
    colorHex: 0xff007f,
    colorCss: '#ff007f',
    accentHex: 0xff33aa,
  },
  [PowerUpType.BOOST]: {
    type: PowerUpType.BOOST,
    duration: 5.0,
    label: 'HYPER',
    pickupAnnouncement: 'HYPER BOOST!',
    icon: '⚡',
    colorHex: 0xffaa00,
    colorCss: '#ffaa00',
    accentHex: 0xffe600,
  },
  [PowerUpType.MULTIPLIER]: {
    type: PowerUpType.MULTIPLIER,
    duration: 8.0,
    label: '2× SCORE',
    pickupAnnouncement: '2× SCORE!',
    icon: '2×',
    colorHex: 0xb53cff,
    colorCss: '#b53cff',
    accentHex: 0xffd700,
  },
};

