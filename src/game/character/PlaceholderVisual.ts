import * as THREE from 'three';
import gsap from 'gsap';
import type { ICharacterVisual } from './ICharacterVisual';

/**
 * Temporary visual placeholder for Dili.
 * NOTE: The final character will be replaced with the approved Dili mascot artwork.
 * This placeholder preserves hitboxes and animation states to ensure identical physics.
 */
export class PlaceholderVisual implements ICharacterVisual {
  public readonly group: THREE.Group;
  private readonly bodyMesh: THREE.Group;
  private readonly visorLight: THREE.Mesh;
  private readonly coreLight: THREE.Mesh;
  private readonly shadowMesh: THREE.Mesh;
  private readonly speedTrailMesh: THREE.Mesh;

  private runCycleTime: number = 0;
  private isSliding: boolean = false;
  private isJumping: boolean = false;
  private isDashing: boolean = false;
  private isStumbling: boolean = false;

  constructor() {
    this.group = new THREE.Group();
    this.bodyMesh = new THREE.Group();
    this.group.add(this.bodyMesh);

    // 1. Torso
    const torsoGeo = new THREE.CapsuleGeometry(0.35, 0.7, 8, 16);
    const torsoMat = new THREE.MeshStandardMaterial({
      color: 0x141829,
      roughness: 0.3,
      metalness: 0.85,
    });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 1.0;
    this.bodyMesh.add(torso);

    // 2. Glowing Visor (Neon Cyan)
    const visorGeo = new THREE.BoxGeometry(0.45, 0.16, 0.28);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    this.visorLight = new THREE.Mesh(visorGeo, visorMat);
    this.visorLight.position.set(0, 1.45, -0.2);
    this.bodyMesh.add(this.visorLight);

    // 3. Neon Core / Chest Reactor (Magenta)
    const coreGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xff007f });
    this.coreLight = new THREE.Mesh(coreGeo, coreMat);
    this.coreLight.position.set(0, 1.05, -0.32);
    this.bodyMesh.add(this.coreLight);

    // 4. Cyber Runner Head Accent
    const headGeo = new THREE.SphereGeometry(0.26, 12, 12);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x1c2138,
      roughness: 0.3,
      metalness: 0.7,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.45;
    this.bodyMesh.add(head);

    // 5. Dynamic Ground Shadow
    const shadowGeo = new THREE.PlaneGeometry(0.9, 1.4);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.shadowMesh.position.y = 0.02;
    this.group.add(this.shadowMesh);

    // 6. Dash Speed Trail Ribbon
    const trailGeo = new THREE.PlaneGeometry(0.8, 3.2);
    const trailMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.speedTrailMesh = new THREE.Mesh(trailGeo, trailMat);
    this.speedTrailMesh.rotation.x = Math.PI / 2;
    this.speedTrailMesh.position.set(0, 0.8, 1.8);
    this.group.add(this.speedTrailMesh);
  }

  public update(delta: number, runSpeed: number): void {
    if (!this.isSliding && !this.isJumping && !this.isStumbling) {
      // Natural running bob and stride tilt
      this.runCycleTime += delta * (runSpeed * 0.7);
      const bobHeight = Math.abs(Math.sin(this.runCycleTime * 2)) * 0.12;
      this.bodyMesh.position.y = bobHeight;

      // Subtle forward lean and rhythmic shoulder sway
      this.bodyMesh.rotation.x = -0.15 + Math.sin(this.runCycleTime * 2) * 0.04;
      if (!this.isDashing) {
        this.bodyMesh.rotation.z = Math.sin(this.runCycleTime) * 0.04;
      }
    }
  }

  public onLaneSwitch(direction: -1 | 1): void {
    // Bank/lean into the lane switch, then smoothly snap back to neutral
    gsap.killTweensOf(this.bodyMesh.rotation);
    const bankAngle = -direction * 0.28;

    gsap.to(this.bodyMesh.rotation, {
      z: bankAngle,
      duration: 0.1,
      ease: 'power2.out',
      onComplete: () => {
        gsap.to(this.bodyMesh.rotation, {
          z: 0,
          duration: 0.16,
          ease: 'power2.inOut',
        });
      },
    });
  }

  public onJump(): void {
    this.isJumping = true;
    gsap.killTweensOf(this.bodyMesh.scale);
    gsap.killTweensOf(this.shadowMesh.scale);

    // Initial stretch into the air
    gsap.to(this.bodyMesh.scale, {
      x: 0.88,
      y: 1.18,
      z: 0.88,
      duration: 0.15,
      ease: 'power1.out',
      onComplete: () => {
        gsap.to(this.bodyMesh.scale, { x: 1, y: 1, z: 1, duration: 0.2 });
      },
    });

    // Shadow shrinks and fades as altitude increases
    gsap.to(this.shadowMesh.scale, { x: 0.45, y: 0.45, z: 0.45, duration: 0.25 });
    (this.shadowMesh.material as THREE.MeshBasicMaterial).opacity = 0.25;
  }

  public onLand(): void {
    this.isJumping = false;
    gsap.killTweensOf(this.bodyMesh.scale);
    gsap.killTweensOf(this.shadowMesh.scale);

    // Landing squash and elastic rebound
    gsap.to(this.bodyMesh.scale, {
      x: 1.18,
      y: 0.78,
      z: 1.18,
      duration: 0.08,
      ease: 'power2.out',
      onComplete: () => {
        gsap.to(this.bodyMesh.scale, {
          x: 1,
          y: 1,
          z: 1,
          duration: 0.15,
          ease: 'elastic.out(1, 0.4)',
        });
      },
    });

    gsap.to(this.shadowMesh.scale, { x: 1, y: 1, z: 1, duration: 0.12 });
    (this.shadowMesh.material as THREE.MeshBasicMaterial).opacity = 0.6;
  }

  public onSlide(): void {
    this.isSliding = true;
    gsap.killTweensOf(this.bodyMesh.scale);
    gsap.killTweensOf(this.bodyMesh.position);
    gsap.killTweensOf(this.bodyMesh.rotation);

    // Smooth duck down into slide posture
    gsap.to(this.bodyMesh.scale, {
      x: 1.25,
      y: 0.42,
      z: 1.35,
      duration: 0.12,
      ease: 'power2.out',
    });
    gsap.to(this.bodyMesh.position, { y: -0.15, duration: 0.12 });
    gsap.to(this.bodyMesh.rotation, { x: -0.6, duration: 0.12 });
  }

  public onSlideEnd(): void {
    this.isSliding = false;
    gsap.killTweensOf(this.bodyMesh.scale);
    gsap.killTweensOf(this.bodyMesh.position);
    gsap.killTweensOf(this.bodyMesh.rotation);

    // Stand back up smoothly
    gsap.to(this.bodyMesh.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: 0.14,
      ease: 'back.out(1.4)',
    });
    gsap.to(this.bodyMesh.position, { y: 0, duration: 0.14 });
    gsap.to(this.bodyMesh.rotation, { x: -0.15, duration: 0.14 });
  }

  public onDash(duration: number): void {
    this.isDashing = true;
    (this.visorLight.material as THREE.MeshBasicMaterial).color.setHex(0xffaa00);
    (this.coreLight.material as THREE.MeshBasicMaterial).color.setHex(0x00f0ff);

    // Forward lunge posture
    gsap.to(this.bodyMesh.rotation, { x: -0.45, duration: 0.1 });
    gsap.to(this.bodyMesh.scale, { x: 0.9, y: 0.9, z: 1.25, duration: 0.12 });

    // Show speed trail
    const trailMat = this.speedTrailMesh.material as THREE.MeshBasicMaterial;
    gsap.to(trailMat, { opacity: 0.75, duration: 0.08 });
    gsap.to(trailMat, {
      opacity: 0,
      duration: 0.3,
      delay: Math.max(duration - 0.3, 0),
    });
  }

  public onDashEnd(): void {
    this.isDashing = false;
    (this.visorLight.material as THREE.MeshBasicMaterial).color.setHex(0x00f0ff);
    (this.coreLight.material as THREE.MeshBasicMaterial).color.setHex(0xff007f);
    gsap.to(this.bodyMesh.rotation, { x: -0.15, duration: 0.2 });
    gsap.to(this.bodyMesh.scale, { x: 1, y: 1, z: 1, duration: 0.2 });
    (this.speedTrailMesh.material as THREE.MeshBasicMaterial).opacity = 0;
  }

  public onStumble(): void {
    this.isStumbling = true;
    gsap.killTweensOf(this.bodyMesh.rotation);

    // Wobble animation
    gsap.to(this.bodyMesh.rotation, {
      x: 0.35,
      z: 0.2,
      duration: 0.1,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        this.isStumbling = false;
        gsap.to(this.bodyMesh.rotation, { x: -0.15, z: 0, duration: 0.2 });
      },
    });
  }

  public onCrash(): void {
    gsap.killTweensOf(this.bodyMesh.rotation);
    gsap.killTweensOf(this.bodyMesh.position);
    gsap.to(this.bodyMesh.rotation, { x: 1.1, z: 0.4, duration: 0.25 });
    gsap.to(this.bodyMesh.position, { y: 0.2, duration: 0.25 });
  }

  public reset(): void {
    this.isSliding = false;
    this.isJumping = false;
    this.isDashing = false;
    this.isStumbling = false;
    gsap.killTweensOf(this.bodyMesh.scale);
    gsap.killTweensOf(this.bodyMesh.position);
    gsap.killTweensOf(this.bodyMesh.rotation);

    this.bodyMesh.scale.set(1, 1, 1);
    this.bodyMesh.position.set(0, 0, 0);
    this.bodyMesh.rotation.set(0, 0, 0);
    (this.visorLight.material as THREE.MeshBasicMaterial).color.setHex(0x00f0ff);
    (this.coreLight.material as THREE.MeshBasicMaterial).color.setHex(0xff007f);
    this.shadowMesh.scale.set(1, 1, 1);
    (this.shadowMesh.material as THREE.MeshBasicMaterial).opacity = 0.6;
    (this.speedTrailMesh.material as THREE.MeshBasicMaterial).opacity = 0;
  }

  public dispose(): void {
    gsap.killTweensOf(this.bodyMesh.scale);
    gsap.killTweensOf(this.bodyMesh.position);
    gsap.killTweensOf(this.bodyMesh.rotation);
    gsap.killTweensOf(this.shadowMesh.scale);

    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
