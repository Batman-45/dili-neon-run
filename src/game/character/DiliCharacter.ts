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
  private magnetMesh: THREE.Group;
  private boostMesh: THREE.Group;
  private vfxAnimTime: number = 0;

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

    // Pulse Magnet visual mesh
    this.magnetMesh = this.createMagnetVfxMesh();
    this.group.add(this.magnetMesh);

    // Hyper Boost speed trails visual mesh
    this.boostMesh = this.createHyperBoostVfxMesh();
    this.group.add(this.boostMesh);

    this.group.position.set(0, this.groundY, 0);
    this.updateBoundingBox();
  }

  private createShieldMesh(): THREE.Group {
    const root = new THREE.Group();
    root.visible = false;
    root.position.set(0, 0.95, 0);

    // 1. Clearly visible holographic protective bubble (cyan)
    const shellGeo = new THREE.SphereGeometry(1.35, 24, 18);
    const shellMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.26,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.name = 'shieldShell';
    root.add(shell);

    // 2. Hexagonal energy shimmer / wireframe outer ring lattice
    const wireGeo = new THREE.IcosahedronGeometry(1.36, 1);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      wireframe: true,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    wireMesh.name = 'shieldWire';
    root.add(wireMesh);

    // 3. Orbital energy arc ring A (cyan plasma loop)
    const ringGeoA = new THREE.TorusGeometry(1.40, 0.022, 8, 48);
    const ringMatA = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ringA = new THREE.Mesh(ringGeoA, ringMatA);
    ringA.name = 'ringA';
    ringA.rotation.x = Math.PI / 4;
    ringA.rotation.y = Math.PI / 6;
    root.add(ringA);

    // 4. Orbital energy arc ring B (electric blue/cyan loop)
    const ringGeoB = new THREE.TorusGeometry(1.38, 0.020, 8, 48);
    const ringMatB = new THREE.MeshBasicMaterial({
      color: 0x00a8ff,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ringB = new THREE.Mesh(ringGeoB, ringMatB);
    ringB.name = 'ringB';
    ringB.rotation.x = -Math.PI / 3;
    ringB.rotation.z = Math.PI / 4;
    root.add(ringB);

    // 5. Soft ground energy contact projection on road surface
    const groundDiscGeo = new THREE.RingGeometry(0.7, 1.35, 24);
    const groundDiscMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const groundDisc = new THREE.Mesh(groundDiscGeo, groundDiscMat);
    groundDisc.rotation.x = -Math.PI / 2;
    groundDisc.position.y = -0.93; // contacts road at groundY = 0
    groundDisc.name = 'groundDisc';
    root.add(groundDisc);

    return root;
  }

  private createMagnetVfxMesh(): THREE.Group {
    const root = new THREE.Group();
    root.visible = false;
    root.position.set(0, 0.85, 0);

    // Expanding horizontal magnetic ripple rings (magenta)
    for (let i = 0; i < 2; i++) {
      const ringGeo = new THREE.RingGeometry(0.75, 0.95, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xff007f,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.name = `magRing${i}`;
      root.add(ringMesh);
    }

    // Orbiting magnetic flux orbs around Dili
    for (let i = 0; i < 2; i++) {
      const sparkGeo = new THREE.OctahedronGeometry(0.12, 0);
      const sparkMat = new THREE.MeshBasicMaterial({
        color: 0xff33aa,
        blending: THREE.AdditiveBlending,
      });
      const spark = new THREE.Mesh(sparkGeo, sparkMat);
      spark.name = `magSpark${i}`;
      root.add(spark);
    }

    // Ground magnetic flux circle
    const groundGeo = new THREE.RingGeometry(0.5, 1.2, 24);
    const groundMat = new THREE.MeshBasicMaterial({
      color: 0xff007f,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.83;
    root.add(groundMesh);

    return root;
  }

  private createHyperBoostVfxMesh(): THREE.Group {
    const root = new THREE.Group();
    root.visible = false;
    root.position.set(0, 0.5, 0);

    // Dual amber speed plumes trailing backwards along +Z
    const plumeGeo = new THREE.PlaneGeometry(0.38, 2.4);
    plumeGeo.translate(0, 1.2, 0);
    const plumeMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const leftPlume = new THREE.Mesh(plumeGeo, plumeMat);
    leftPlume.name = 'leftPlume';
    leftPlume.rotation.x = Math.PI / 2;
    leftPlume.position.set(-0.25, 0.2, 0.2);
    root.add(leftPlume);

    const rightPlume = new THREE.Mesh(plumeGeo, plumeMat.clone());
    rightPlume.name = 'rightPlume';
    rightPlume.rotation.x = Math.PI / 2;
    rightPlume.position.set(0.25, 0.2, 0.2);
    root.add(rightPlume);

    // Trailing speed chevrons pulsing backwards behind Dili
    const chevronShape = new THREE.Shape();
    chevronShape.moveTo(-0.35, 0.18);
    chevronShape.lineTo(0.0, -0.18);
    chevronShape.lineTo(0.35, 0.18);
    chevronShape.lineTo(0.35, 0.05);
    chevronShape.lineTo(0.0, -0.30);
    chevronShape.lineTo(-0.35, 0.05);
    chevronShape.closePath();
    const chevronGeo = new THREE.ShapeGeometry(chevronShape);
    const chevronMat = new THREE.MeshBasicMaterial({
      color: 0xffe600,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    for (let i = 0; i < 2; i++) {
      const ch = new THREE.Mesh(chevronGeo, chevronMat);
      ch.name = `boostChevron${i}`;
      ch.rotation.x = Math.PI / 2;
      ch.position.set(0, 0.35, 0.6 + i * 0.8);
      root.add(ch);
    }

    return root;
  }

  public setShieldVisible(visible: boolean): void {
    this.shieldMesh.visible = visible;
  }

  public setMagnetVisible(visible: boolean): void {
    this.magnetMesh.visible = visible;
  }

  public setHyperBoostVisible(visible: boolean): void {
    this.boostMesh.visible = visible;
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

    this.vfxAnimTime += delta;

    // 7. Update shield energy rings, shimmer & subtle field rotation
    if (this.shieldMesh.visible) {
      const ringA = this.shieldMesh.getObjectByName('ringA');
      const ringB = this.shieldMesh.getObjectByName('ringB');
      const wire = this.shieldMesh.getObjectByName('shieldWire');
      const shell = this.shieldMesh.getObjectByName('shieldShell');
      if (ringA) ringA.rotation.y += delta * 2.8;
      if (ringB) ringB.rotation.z -= delta * 2.2;
      if (wire) wire.rotation.y -= delta * 1.2;
      if (shell) {
        const pulse = 1.0 + Math.sin(this.vfxAnimTime * 6) * 0.035;
        shell.scale.set(pulse, pulse, pulse);
      }
      this.shieldMesh.rotation.y += delta * 0.6;
    }

    // Magnet pulse VFX
    if (this.magnetMesh.visible) {
      for (let i = 0; i < 2; i++) {
        const ring = this.magnetMesh.getObjectByName(`magRing${i}`);
        if (ring instanceof THREE.Mesh && ring.material instanceof THREE.MeshBasicMaterial) {
          const t = (this.vfxAnimTime * 2.5 + i * 0.5) % 1.0;
          const s = 0.6 + t * 0.9;
          ring.scale.set(s, s, s);
          ring.material.opacity = Math.max(0, (1 - t) * 0.65);
        }
        const spark = this.magnetMesh.getObjectByName(`magSpark${i}`);
        if (spark) {
          const angle = this.vfxAnimTime * 6 + (i * Math.PI);
          spark.position.set(Math.cos(angle) * 0.85, 0.1 + Math.sin(this.vfxAnimTime * 8) * 0.15, Math.sin(angle) * 0.85);
          spark.rotation.y += delta * 8;
        }
      }
    }

    // Hyper Boost speed trails VFX
    if (this.boostMesh.visible) {
      const leftPlume = this.boostMesh.getObjectByName('leftPlume');
      const rightPlume = this.boostMesh.getObjectByName('rightPlume');
      const flicker = 0.85 + Math.random() * 0.3;
      if (leftPlume) leftPlume.scale.set(flicker, 1.0 + Math.random() * 0.4, 1.0);
      if (rightPlume) rightPlume.scale.set(flicker, 1.0 + Math.random() * 0.4, 1.0);

      for (let i = 0; i < 2; i++) {
        const ch = this.boostMesh.getObjectByName(`boostChevron${i}`);
        if (ch instanceof THREE.Mesh && ch.material instanceof THREE.MeshBasicMaterial) {
          const zProgress = ((this.vfxAnimTime * 4.5 + i * 0.8) % 2.0);
          ch.position.z = 0.5 + zProgress;
          ch.material.opacity = Math.max(0, 1.0 - zProgress / 2.0);
        }
      }
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
    this.setMagnetVisible(false);
    this.setHyperBoostVisible(false);
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
