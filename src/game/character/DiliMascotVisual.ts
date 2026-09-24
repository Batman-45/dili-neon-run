import * as THREE from 'three';
import gsap from 'gsap';
import type { ICharacterVisual } from './ICharacterVisual';

/**
 * DiliMascotVisual — Production 2.5D Character Visual Architecture for Dili: Neon Run.
 * Renders the approved Dlicom Dili mascot asset (pink bubble-helmet hero with purple cape,
 * diamond eyes speech-bubble visor, pink hoodie with 'D' logo, and white runner boots).
 *
 * Architecture strictly follows recommended hierarchy:
 * DiliCharacter group (Physics & World position)
 *   └── visualParent (Camera-facing alignment & lane orientation)
 *         └── visualChild (Stride bounce, banking tilt, jump/slide squash/stretch)
 *               ├── mascotPlane (Camera-facing Dili sprite mesh with cape fluttering vertices)
 *               └── rimLight (Personal neon rim light)
 *   └── shadowMesh (Ground contact shadow pinned to road at Y=0.015)
 *   └── speedTrailMesh (Dash cyber speed trail)
 */
export class DiliMascotVisual implements ICharacterVisual {
  public readonly group: THREE.Group;
  private readonly visualParent: THREE.Group;
  private readonly visualChild: THREE.Group;
  private readonly mascotPlane: THREE.Mesh;
  private readonly shadowMesh: THREE.Mesh;
  private readonly speedTrailMesh: THREE.Mesh;
  private readonly rimLight: THREE.PointLight;
  private readonly texture: THREE.Texture;

  // Plane geometry vertex cache for subtle cape flutter
  private readonly initialPlanePositions: Float32Array;

  // Animation state
  private runCycleTime: number = 0;
  private bankAngle: number = 0;
  private isSliding: boolean = false;
  private isJumping: boolean = false;
  private isDashing: boolean = false;
  private isStumbling: boolean = false;

  constructor() {
    this.group = new THREE.Group();

    // 1. Visual Parent: handles camera-facing alignment independently from lane movement
    this.visualParent = new THREE.Group();
    this.group.add(this.visualParent);

    // 2. Visual Child: handles athletic stride bounce, bank roll, squash & stretch
    this.visualChild = new THREE.Group();
    this.visualParent.add(this.visualChild);

    // ============================================================
    // APPROVED DILI MASCOT TEXTURE & MATERIAL
    // ============================================================
    const loader = new THREE.TextureLoader();
    this.texture = loader.load('/assets/dili.png');
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = true;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    // Calibrated material with front-side culling and safe depth sorting
    const mascotMat = new THREE.MeshStandardMaterial({
      map: this.texture,
      transparent: true,
      alphaTest: 0.04,
      roughness: 0.3,
      metalness: 0.1,
      // Subtle emissive glow so Dili pops against dark neon track without washing out details
      emissive: new THREE.Color(0x4a123a),
      emissiveMap: this.texture,
      emissiveIntensity: 0.55,
      side: THREE.FrontSide, // FrontSide prevents back-face inverted rendering
      depthWrite: false,     // Eliminates transparent z-buffer occlusion glitches
    });

    // 2.5D Plane: 1.9m height subdivided to 10x10 grid for subtle cape wind flutter
    const planeGeo = new THREE.PlaneGeometry(1.9, 1.9, 10, 10);
    // Offset vertices so local Y=0 corresponds precisely to Dili's boots on the ground
    planeGeo.translate(0, 0.95, 0);

    // Cache initial vertex positions for dynamic cape wave animation
    const posAttr = planeGeo.attributes.position as THREE.BufferAttribute;
    this.initialPlanePositions = new Float32Array(posAttr.array);

    this.mascotPlane = new THREE.Mesh(planeGeo, mascotMat);
    this.mascotPlane.castShadow = true;
    this.mascotPlane.renderOrder = 2; // Renders above shadow and trail
    this.visualChild.add(this.mascotPlane);

    // ============================================================
    // CHARACTER NEON RIM LIGHT
    // ============================================================
    this.rimLight = new THREE.PointLight(0xff3dbb, 1.3, 4.2);
    this.rimLight.position.set(0, 1.2, 0.4);
    this.visualChild.add(this.rimLight);

    // ============================================================
    // DYNAMIC GROUND SHADOW (Attached to root group, stays flat on road)
    // ============================================================
    const shadowGeo = new THREE.PlaneGeometry(1.15, 1.35);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.shadowMesh.position.set(0, 0.015, 0); // Pinned to road surface
    this.shadowMesh.renderOrder = 0;
    this.group.add(this.shadowMesh);

    // ============================================================
    // DASH SPEED TRAIL RIBBON
    // ============================================================
    const trailGeo = new THREE.PlaneGeometry(1.2, 3.5);
    const trailMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.speedTrailMesh = new THREE.Mesh(trailGeo, trailMat);
    this.speedTrailMesh.rotation.x = Math.PI / 2;
    this.speedTrailMesh.position.set(0, 0.8, 1.6);
    this.speedTrailMesh.renderOrder = 1;
    this.group.add(this.speedTrailMesh);
  }

  // ============================================================
  // ANIMATION HOOKS (ICharacterVisual)
  // ============================================================

  public update(delta: number, runSpeed: number): void {
    // 1. Maintain Camera-facing Orientation:
    // Slightly orient towards camera center line so Dili is never edge-on or perspective-skewed at outer lanes
    const currentX = this.group.position.x;
    const targetYaw = Math.atan2(currentX * 0.28, 7.5);
    this.visualParent.rotation.y = THREE.MathUtils.damp(this.visualParent.rotation.y, targetYaw, 10, delta);

    if (!this.isSliding && !this.isJumping && !this.isStumbling) {
      // 2. Athletic Running Stride Rhythm (synced with track speed)
      this.runCycleTime += delta * (runSpeed * 0.72);

      // Bounce: Parabolic arc with crisp ground contact at Y=0
      const strideSin = Math.sin(this.runCycleTime * 2);
      const bobHeight = Math.max(0, strideSin) * 0.09;
      this.visualChild.position.y = bobHeight;

      // Subtle forward athletic pitch and alternating hip/shoulder sway
      const forwardLean = -0.07 + Math.sin(this.runCycleTime * 2) * 0.02;
      this.visualChild.rotation.x = forwardLean;

      // Roll: combine current bank angle from lane switch with subtle step sway (suppressed during dash)
      const stepSway = this.isDashing ? 0 : Math.sin(this.runCycleTime) * 0.022;
      this.visualChild.rotation.z = this.bankAngle + stepSway;

      // 3. Dynamic Ground Contact Shadow Rhythm
      // Shadow compresses horizontally on foot strike and slightly relaxes at peak
      const impactRatio = 1 - Math.max(0, strideSin);
      this.shadowMesh.scale.x = 1.0 + impactRatio * 0.14;
      this.shadowMesh.scale.y = 1.0 - impactRatio * 0.08;

      // 4. Subtle Cape Wind Flutter:
      // Cape is located on the left-rear side of Dili (local X < -0.15, Y > 0.4)
      this.animateCapeFlutter();
    }
  }

  /**
   * Subtle wave deformation on cape vertices to simulate dynamic airflow while running.
   */
  private animateCapeFlutter(): void {
    const geo = this.mascotPlane.geometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const array = posAttr.array as Float32Array;
    const orig = this.initialPlanePositions;

    const time = this.runCycleTime * 2.8;

    for (let i = 0; i < orig.length; i += 3) {
      const origX = orig[i];
      const origY = orig[i + 1];

      // Check if vertex lies within the purple cape region (left side of sprite, mid-to-lower body)
      if (origX < -0.15 && origY > 0.3 && origY < 1.4) {
        const factor = Math.abs(origX) / 0.95; // More flutter further out
        const wave = Math.sin(time + origY * 4.0) * 0.035 * factor;
        // Subtle Z displacement (flutter backwards in the breeze)
        array[i + 2] = orig[i + 2] + wave;
      } else {
        array[i + 2] = orig[i + 2];
      }
    }

    posAttr.needsUpdate = true;
  }

  public onLaneSwitch(direction: -1 | 1): void {
    // Bank smoothly into lane switch, strictly clamped to safe angle (max 0.12 rad ≈ 6.8°)
    // Never tilts so far that the 2.5D sprite becomes edge-on
    gsap.killTweensOf(this, 'bankAngle');
    const targetBank = -direction * 0.12;

    gsap.to(this, {
      bankAngle: targetBank,
      duration: 0.1,
      ease: 'power2.out',
      onComplete: () => {
        gsap.to(this, {
          bankAngle: 0,
          duration: 0.16,
          ease: 'power2.inOut',
        });
      },
    });
  }

  public onJump(): void {
    this.isJumping = true;
    gsap.killTweensOf(this.visualChild.scale);
    gsap.killTweensOf(this.shadowMesh.scale);

    // Airborne stretch: aerodynamic elongation
    gsap.to(this.visualChild.scale, {
      x: 0.92,
      y: 1.14,
      z: 0.92,
      duration: 0.15,
      ease: 'power1.out',
      onComplete: () => {
        gsap.to(this.visualChild.scale, { x: 1, y: 1, z: 1, duration: 0.18 });
      },
    });

    // Shadow scales down and fades with altitude
    gsap.to(this.shadowMesh.scale, { x: 0.45, y: 0.45, z: 0.45, duration: 0.22 });
    (this.shadowMesh.material as THREE.MeshBasicMaterial).opacity = 0.22;
  }

  public onLand(): void {
    this.isJumping = false;
    gsap.killTweensOf(this.visualChild.scale);
    gsap.killTweensOf(this.shadowMesh.scale);

    // Impact compression squash & elastic recovery
    gsap.to(this.visualChild.scale, {
      x: 1.16,
      y: 0.82,
      z: 1.16,
      duration: 0.08,
      ease: 'power2.out',
      onComplete: () => {
        gsap.to(this.visualChild.scale, {
          x: 1,
          y: 1,
          z: 1,
          duration: 0.16,
          ease: 'elastic.out(1, 0.4)',
        });
      },
    });

    gsap.to(this.shadowMesh.scale, { x: 1, y: 1, z: 1, duration: 0.12 });
    (this.shadowMesh.material as THREE.MeshBasicMaterial).opacity = 0.65;
  }

  public onSlide(): void {
    this.isSliding = true;
    gsap.killTweensOf(this.visualChild.scale);
    gsap.killTweensOf(this.visualChild.position);
    gsap.killTweensOf(this.visualChild.rotation);

    // Fast crouch & athletic forward slide angle - maintain face visibility to elevated camera
    gsap.to(this.visualChild.scale, {
      x: 1.25,
      y: 0.52,
      z: 1.2,
      duration: 0.1,
      ease: 'power2.out',
    });
    gsap.to(this.visualChild.position, { y: 0, duration: 0.1 });
    gsap.to(this.visualChild.rotation, { x: -0.12, duration: 0.1 });
  }

  public onSlideEnd(): void {
    this.isSliding = false;
    gsap.killTweensOf(this.visualChild.scale);
    gsap.killTweensOf(this.visualChild.position);
    gsap.killTweensOf(this.visualChild.rotation);

    // Spring back up cleanly to standing running pose
    gsap.to(this.visualChild.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: 0.14,
      ease: 'back.out(1.4)',
    });
    gsap.to(this.visualChild.position, { y: 0, duration: 0.14 });
    gsap.to(this.visualChild.rotation, { x: -0.07, duration: 0.14 });
  }

  public onDash(duration: number): void {
    this.isDashing = true;
    this.rimLight.color.setHex(0x00f0ff);
    this.rimLight.intensity = 1.6;

    // Aerodynamic dash forward tilt
    gsap.to(this.visualChild.rotation, { x: -0.32, duration: 0.08 });
    gsap.to(this.visualChild.scale, { x: 0.94, y: 0.94, z: 1.15, duration: 0.1 });

    // Cyber speed trail
    const trailMat = this.speedTrailMesh.material as THREE.MeshBasicMaterial;
    gsap.to(trailMat, { opacity: 0.8, duration: 0.06 });
    gsap.to(trailMat, {
      opacity: 0,
      duration: 0.28,
      delay: Math.max(duration - 0.28, 0),
    });
  }

  public onDashEnd(): void {
    this.isDashing = false;
    this.rimLight.color.setHex(0xff3dbb);
    this.rimLight.intensity = 1.1;

    gsap.to(this.visualChild.rotation, { x: -0.07, duration: 0.18 });
    gsap.to(this.visualChild.scale, { x: 1, y: 1, z: 1, duration: 0.18 });
    (this.speedTrailMesh.material as THREE.MeshBasicMaterial).opacity = 0;
  }

  public onStumble(): void {
    this.isStumbling = true;
    gsap.killTweensOf(this.visualChild.rotation);

    // Recoil wobble without flipping backwards or edge-on
    gsap.to(this.visualChild.rotation, {
      x: 0.2,
      z: 0.1,
      duration: 0.09,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        this.isStumbling = false;
        gsap.to(this.visualChild.rotation, { x: -0.07, z: 0, duration: 0.18 });
      },
    });
  }

  public onCrash(): void {
    gsap.killTweensOf(this.visualChild.rotation);
    gsap.killTweensOf(this.visualChild.position);

    // Crash knockback - tilted cleanly without turning away or clipping
    gsap.to(this.visualChild.rotation, {
      x: 0.45,
      y: 0,
      z: -0.22,
      duration: 0.45,
      ease: 'power3.out',
    });
    gsap.to(this.visualChild.position, {
      y: 0.25,
      z: 0.4,
      duration: 0.45,
      ease: 'power2.out',
    });
  }

  public reset(): void {
    gsap.killTweensOf(this.visualChild.position);
    gsap.killTweensOf(this.visualChild.rotation);
    gsap.killTweensOf(this.visualChild.scale);
    gsap.killTweensOf(this.shadowMesh.scale);
    gsap.killTweensOf(this, 'bankAngle');

    this.runCycleTime = 0;
    this.bankAngle = 0;
    this.isSliding = false;
    this.isJumping = false;
    this.isDashing = false;
    this.isStumbling = false;

    this.visualParent.rotation.set(0, 0, 0);
    this.visualChild.position.set(0, 0, 0);
    this.visualChild.rotation.set(-0.07, 0, 0);
    this.visualChild.scale.set(1, 1, 1);

    this.shadowMesh.scale.set(1, 1, 1);
    (this.shadowMesh.material as THREE.MeshBasicMaterial).opacity = 0.65;
    (this.speedTrailMesh.material as THREE.MeshBasicMaterial).opacity = 0;

    this.rimLight.color.setHex(0xff3dbb);
    this.rimLight.intensity = 1.1;

    // Reset plane geometry vertices
    const geo = this.mascotPlane.geometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    posAttr.copyArray(this.initialPlanePositions);
    posAttr.needsUpdate = true;
  }

  public dispose(): void {
    this.texture.dispose();
    (this.mascotPlane.material as THREE.Material).dispose();
    this.mascotPlane.geometry.dispose();
    (this.shadowMesh.material as THREE.Material).dispose();
    this.shadowMesh.geometry.dispose();
    (this.speedTrailMesh.material as THREE.Material).dispose();
    this.speedTrailMesh.geometry.dispose();
  }
}
