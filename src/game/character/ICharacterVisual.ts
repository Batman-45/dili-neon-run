import * as THREE from 'three';

/**
 * Interface for Dili's visual representation.
 * Allows seamless drop-in replacement with the approved Dili mascot artwork/model
 * without altering any gameplay controller logic or physics.
 */
export interface ICharacterVisual {
  readonly group: THREE.Group;

  /** Called every frame during running to drive natural runner animations */
  update(delta: number, runSpeed: number): void;

  /** Triggered when switching lanes (-1 = left, +1 = right) */
  onLaneSwitch(direction: -1 | 1): void;

  /** Triggered when jump starts */
  onJump(): void;

  /** Triggered upon touching the ground after a jump */
  onLand(): void;

  /** Triggered when slide starts */
  onSlide(): void;

  /** Triggered when slide ends and character stands up */
  onSlideEnd(): void;

  /** Triggered when dash activates */
  onDash(duration: number): void;

  /** Triggered when dash ends */
  onDashEnd(): void;

  /** Triggered when character stumbles from a minor obstacle */
  onStumble(): void;

  /** Triggered on fatal collision / crash */
  onCrash(): void;

  /** Reset to default running state */
  reset(): void;

  /** Clean up Three.js resources */
  dispose(): void;
}
