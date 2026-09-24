import * as THREE from 'three';
import gsap from 'gsap';
import type { ICharacterVisual } from './ICharacterVisual';
import { DiliMascotVisual } from './DiliMascotVisual';
import { TrackManager } from '../track/TrackManager';

export type LaneIndex = -1 | 0 | 1;

export const CharacterState = {
  RUNNING: 'RUNNING',
  JUMPING: 'JUMPING',
  SLIDING: 'SLIDING',
  DASHING: 'DASHING',
  STUMBLING: 'STUMBLING',
  CRASHED: 'CRASHED',
} as const;

export type CharacterState = (typeof CharacterState)[keyof typeof CharacterState];

export interface DiliCharacterCallbacks {
  onDashStart?: (duration: number) => void;
  onDashEnd?: () => void;
  onStateChange?: (newState: CharacterState) => void;
}

export class DiliCharacter {
  public readonly group: THREE.Group;
  public visual: ICharacterVisual;

  // Lane Management
  public currentLane: LaneIndex = 0;
  private isSwitchingLane: boolean = false;
  private readonly laneSwitchDuration: number = 0.18; // seconds

  // State Management
  private state: CharacterState = CharacterState.RUNNING;
  private previousState: CharacterState = CharacterState.RUNNING;
  public isInvulnerable: boolean = false;

  // Vertical Jump Physics
  private velocityY: number = 0;
  private readonly gravity: number = -40; // units/s^2
  private readonly jumpForce: number = 13.8; // initial upward impulse
  private readonly groundY: number = 0;

  // Slide Mechanics
  private slideTimer: number = 0;
  private readonly slideDuration: number = 0.72; // seconds

  // Dash Mechanics & Cooldown
  private dashTimer: number = 0;
  private readonly dashDuration: number = 0.85; // seconds
  public dashCooldownTimer: number = 0;
  public readonly dashCooldown: number = 2.4; // seconds

  // Stumble Mechanics
  private stumbleTimer: number = 0;
  private readonly stumbleDuration: number = 0.6; // seconds

  // Hitbox (dynamically scaled for standing vs sliding)
  public readonly boundingBox: THREE.Box3 = new THREE.Box3();

  // Callbacks
  private callbacks: DiliCharacterCallbacks;
  private shieldMesh: THREE.Group;

  constructor(scene: THREE.Scene, callbacks: DiliCharacterCallbacks = {}, visualOverride?: ICharacterVisual) {
    this.callbacks = callbacks;
    this.group = new THREE.Group();
    scene.add(this.group);

    // Visual decoupled through interface (Production approved Dili mascot visual)
    this.visual = visualOverride ?? new DiliMascotVisual();
    this.group.add(this.visual.group);

    // Shield Bubble visual mesh
    this.shieldMesh = this.createShieldMesh();
    this.group.add(this.shieldMesh);

    this.group.position.set(0, this.groundY, 0);
    this.updateBoundingBox();
  }

  private createShieldMesh(): THREE.Group {
    const root = new THREE.Group();
    root.visible = false;
    root.position.set(0, 0.9, 0);

    const geo = new THREE.IcosahedronGeometry(1.15, 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.35,
      wireframe: true,
    });
    const sphere = new THREE.Mesh(geo, mat);
    root.add(sphere);

    const innerGeo = new THREE.IcosahedronGeometry(1.05, 1);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x9d00ff,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    root.add(inner);

    return root;
  }

  public setShieldVisible(visible: boolean): void {
    this.shieldMesh.visible = visible;
  }

  public update(delta: number, currentTrackSpeed: number): void {
    // 1. Vertical jump physics (frame-rate independent integration)
    if (this.state === CharacterState.JUMPING) {
      this.velocityY += this.gravity * delta;
      this.group.position.y += this.velocityY * delta;

      // Landing detection
      if (this.group.position.y <= this.groundY) {
        this.group.position.y = this.groundY;
        this.velocityY = 0;
        this.transitionTo(CharacterState.RUNNING);
        this.visual.onLand();
      }
    }

    // 2. Slide countdown
    if (this.state === CharacterState.SLIDING) {
      this.slideTimer -= delta;
      if (this.slideTimer <= 0) {
        this.slideTimer = 0;
        this.transitionTo(CharacterState.RUNNING);
        this.visual.onSlideEnd();
      }
    }

    // 3. Dash countdown
    if (this.state === CharacterState.DASHING) {
      this.dashTimer -= delta;
      if (this.dashTimer <= 0) {
        this.dashTimer = 0;
        this.isInvulnerable = false;
        this.visual.onDashEnd();
        this.callbacks.onDashEnd?.();
        this.transitionTo(this.group.position.y > this.groundY ? CharacterState.JUMPING : CharacterState.RUNNING);
      }
    }

    // 4. Dash cooldown recovery
    if (this.dashCooldownTimer > 0) {
      this.dashCooldownTimer = Math.max(0, this.dashCooldownTimer - delta);
    }

    // 5. Stumble countdown
    if (this.state === CharacterState.STUMBLING) {
      this.stumbleTimer -= delta;
      if (this.stumbleTimer <= 0) {
        this.stumbleTimer = 0;
        this.transitionTo(CharacterState.RUNNING);
      }
    }

    // 6. Update visual avatar animation
    this.visual.update(delta, currentTrackSpeed);

    // 7. Update shield bubble rotation
    if (this.shieldMesh.visible) {
      this.shieldMesh.rotation.y += delta * 1.6;
      this.shieldMesh.rotation.x += delta * 0.9;
    }

    // 8. Update collision hitbox
    this.updateBoundingBox();
  }

  public switchLane(direction: -1 | 1): boolean {
    if (this.state === CharacterState.CRASHED) return false;

    const nextLane = (this.currentLane + direction) as LaneIndex;
    // Strict lane bounds check: only -1, 0, or +1 are valid
    if (nextLane < -1 || nextLane > 1) {
      return false;
    }

    this.currentLane = nextLane;
    const targetX = TrackManager.getLaneX(this.currentLane);

    // GSAP tween ensures snappy, buttery smooth, frame-rate independent lane movement
    gsap.killTweensOf(this.group.position, 'x');
    this.isSwitchingLane = true;

    gsap.to(this.group.position, {
      x: targetX,
      duration: this.laneSwitchDuration,
      ease: 'power2.out',
      onComplete: () => {
        this.isSwitchingLane = false;
        this.group.position.x = targetX;
      },
    });

    // Notify visual avatar to bank into the lane switch
    this.visual.onLaneSwitch(direction);
    return true;
  }

  public jump(): boolean {
    if (this.state === CharacterState.CRASHED) return false;

    // Prevent repeated/invalid jumps while already airborne
    if (this.state === CharacterState.JUMPING) {
      return false;
    }

    // Cancel slide if currently sliding
    if (this.state === CharacterState.SLIDING) {
      this.slideTimer = 0;
      this.visual.onSlideEnd();
    }

    this.velocityY = this.jumpForce;
    this.transitionTo(CharacterState.JUMPING);
    this.visual.onJump();
    return true;
  }

  public slide(): boolean {
    if (this.state === CharacterState.CRASHED) return false;

    // If airborne, execute fast-fall dive down to ground immediately
    if (this.state === CharacterState.JUMPING) {
      this.velocityY = -this.jumpForce * 1.6;
      return true;
    }

    if (this.state === CharacterState.RUNNING || this.state === CharacterState.DASHING) {
      this.slideTimer = this.slideDuration;
      this.transitionTo(CharacterState.SLIDING);
      this.visual.onSlide();
      return true;
    }

    // If already sliding, refresh slide timer
    if (this.state === CharacterState.SLIDING) {
      this.slideTimer = this.slideDuration;
      return true;
    }

    return false;
  }

  public dash(): boolean {
    if (this.state === CharacterState.CRASHED || this.state === CharacterState.DASHING) {
      return false;
    }

    // Check cooldown to prevent spamming every frame
    if (this.dashCooldownTimer > 0) {
      return false;
    }

    this.dashTimer = this.dashDuration;
    this.dashCooldownTimer = this.dashCooldown;
    this.isInvulnerable = true;
    this.transitionTo(CharacterState.DASHING);
    this.visual.onDash(this.dashDuration);
    this.callbacks.onDashStart?.(this.dashDuration);
    return true;
  }

  public stumble(): void {
    if (this.state === CharacterState.CRASHED || this.isInvulnerable) return;

    this.stumbleTimer = this.stumbleDuration;
    this.transitionTo(CharacterState.STUMBLING);
    this.visual.onStumble();
  }

  public crash(): void {
    this.transitionTo(CharacterState.CRASHED);
    this.isInvulnerable = false;
    gsap.killTweensOf(this.group.position);
    this.visual.onCrash();
  }

  public reset(): void {
    gsap.killTweensOf(this.group.position);
    this.currentLane = 0;
    this.group.position.set(0, this.groundY, 0);
    this.velocityY = 0;
    this.slideTimer = 0;
    this.dashTimer = 0;
    this.dashCooldownTimer = 0;
    this.stumbleTimer = 0;
    this.isInvulnerable = false;
    this.isSwitchingLane = false;
    this.setShieldVisible(false);
    this.transitionTo(CharacterState.RUNNING);
    this.visual.reset();
    this.updateBoundingBox();
  }

  public getState(): CharacterState {
    return this.state;
  }

  public getPreviousState(): CharacterState {
    return this.previousState;
  }

  public getIsSwitchingLane(): boolean {
    return this.isSwitchingLane;
  }

  public canDash(): boolean {
    return this.dashCooldownTimer <= 0 && this.state !== CharacterState.CRASHED && this.state !== CharacterState.DASHING;
  }

  public getDashCooldownNormalized(): number {
    if (this.dashCooldownTimer <= 0) return 0;
    return this.dashCooldownTimer / this.dashCooldown;
  }

  private transitionTo(newState: CharacterState): void {
    if (this.state !== newState) {
      this.previousState = this.state;
      this.state = newState;
      this.callbacks.onStateChange?.(newState);
    }
  }

  private updateBoundingBox(): void {
    const halfWidth = 0.45;
    // Lower hitbox height when sliding (0.7m vs 1.75m standing)
    const height = this.state === CharacterState.SLIDING ? 0.7 : 1.75;
    const pos = this.group.position;

    this.boundingBox.min.set(pos.x - halfWidth, pos.y, pos.z - 0.4);
    this.boundingBox.max.set(pos.x + halfWidth, pos.y + height, pos.z + 0.4);
  }

  public setVisual(newVisual: ICharacterVisual): void {
    this.group.remove(this.visual.group);
    this.visual.dispose();
    this.visual = newVisual;
    this.group.add(this.visual.group);
  }
}
