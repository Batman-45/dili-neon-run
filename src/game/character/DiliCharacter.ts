import * as THREE from 'three';
import gsap from 'gsap';
import type { ICharacterVisual } from './ICharacterVisual';
import { DiliRunnerVisual } from './DiliRunnerVisual';
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

    // Visual decoupled through interface (Production animated 8-frame Dili runner visual)
    this.visual = visualOverride ?? new DiliRunnerVisual();
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
    root.position.set(0, 1.0, 0);

    // 1. Crystal-clear outer holographic bubble (ultra-transparent so Dili is fully visible)
    const shellGeo = new THREE.SphereGeometry(1.35, 24, 18);
    const shellMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.name = 'shieldShell';
    root.add(shell);

    // 2. Soft violet secondary rim resonance
    const innerGeo = new THREE.SphereGeometry(1.3, 20, 16);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x9d00ff,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    root.add(inner);

    // 3. Orbital energy arc ring A (cyan plasma loop)
    const ringGeoA = new THREE.TorusGeometry(1.38, 0.016, 8, 48);
    const ringMatA = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ringA = new THREE.Mesh(ringGeoA, ringMatA);
    ringA.name = 'ringA';
    ringA.rotation.x = Math.PI / 4;
    ringA.rotation.y = Math.PI / 6;
    root.add(ringA);

    // 4. Orbital energy arc ring B (magenta plasma loop)
    const ringGeoB = new THREE.TorusGeometry(1.36, 0.014, 8, 48);
    const ringMatB = new THREE.MeshBasicMaterial({
      color: 0xff007f,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ringB = new THREE.Mesh(ringGeoB, ringMatB);
    ringB.name = 'ringB';
    ringB.rotation.x = -Math.PI / 3;
    ringB.rotation.z = Math.PI / 4;
    root.add(ringB);

    // 5. Soft ground energy contact projection on road surface
    const groundDiscGeo = new THREE.RingGeometry(0.8, 1.3, 24);
    const groundDiscMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const groundDisc = new THREE.Mesh(groundDiscGeo, groundDiscMat);
    groundDisc.rotation.x = -Math.PI / 2;
    groundDisc.position.y = -0.98; // contacts road at groundY = 0
    groundDisc.name = 'groundDisc';
    root.add(groundDisc);

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

    // 7. Update shield energy rings & subtle field rotation
    if (this.shieldMesh.visible) {
      const ringA = this.shieldMesh.getObjectByName('ringA');
      const ringB = this.shieldMesh.getObjectByName('ringB');
      if (ringA) ringA.rotation.y += delta * 2.8;
      if (ringB) ringB.rotation.z -= delta * 2.2;
      this.shieldMesh.rotation.y += delta * 0.6;
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
