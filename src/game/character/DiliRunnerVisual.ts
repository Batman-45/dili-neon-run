import * as THREE from 'three';
import gsap from 'gsap';
import type { ICharacterVisual } from './ICharacterVisual';

/**
 * DiliRunnerVisual — High-performance 2.5D Animated Runner Visual for Dili: Neon Run.
 * Renders the approved Dli mascot in an active 8-frame running cycle viewed from
 * behind / rear 3/4 perspective, running forward down the cyber highway.
 *
 * Spritesheet: /assets/dili_runner_sheet.png (8 columns × 1 row, transparent RGBA).
 *
 * Architecture:
 * group
 *   └── visualParent (camera-facing perspective & lane alignment)
 *         └── visualChild (bank tilt, jump stretch, slide squash, crash tumble)
 *               ├── runnerMesh (8-frame animated sprite sheet plane)
 *               └── rimLight (neon character rim light)
 *   └── shadowMesh (dynamic ground contact shadow)
 *   └── speedTrailMesh (dash speed trail ribbon)
 */
export class DiliRunnerVisual implements ICharacterVisual {
  public readonly group: THREE.Group;
  private readonly visualParent: THREE.Group;
  private readonly visualChild: THREE.Group;
  private readonly runnerMesh: THREE.Mesh;
  private readonly slideMesh: THREE.Mesh;
  private readonly shadowMesh: THREE.Mesh;
  private readonly speedTrailMesh: THREE.Mesh;
  private readonly rimLight: THREE.PointLight;
  private readonly texture: THREE.Texture;
  private readonly slideTexture: THREE.Texture;

  // 8-frame sprite sheet parameters
  private readonly totalFrames: number = 8;
  private currentFrameIndex: number = 0;
  private runCycleAccumulator: number = 0;

  // Animation states
  private bankAngle: number = 0;
  private isSliding: boolean = false;
  private isJumping: boolean = false;
  private isDashing: boolean = false;
  private isStumbling: boolean = false;

  // Slide crouch transition state
  public slideCrouch: number = 0;

  constructor() {
    this.group = new THREE.Group();

    // 1. Visual Parent handles lane alignment & camera-facing orientation
    this.visualParent = new THREE.Group();
    this.group.add(this.visualParent);

    // 2. Visual Child handles athletic banking, jump/slide squash & stretch
    this.visualChild = new THREE.Group();
    this.visualParent.add(this.visualChild);

    // ============================================================
    // 8-FRAME RUNNER SPRITE SHEET (NORMAL RUNNING)
    // ============================================================
    const loader = new THREE.TextureLoader();
    this.texture = loader.load('/assets/dili_runner_sheet.png');
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = true;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.anisotropy = 4;

    // Configure 8x1 horizontal sprite sheet mapping
    this.texture.repeat.set(1 / this.totalFrames, 1);
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture.offset.set(0, 0);

    const runnerMat = new THREE.MeshStandardMaterial({
      map: this.texture,
      transparent: true,
      alphaTest: 0.02,
      roughness: 0.82,
      metalness: 0.02,
      // Subtle emissive preserves official Dili purple color vibrancy in dark neon city
      emissive: new THREE.Color(0x2d1028),
      emissiveMap: this.texture,
      emissiveIntensity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const planeSize = 2.65;
    const planeGeo = new THREE.PlaneGeometry(planeSize, planeSize);
    const groundOffset = (16 / 384) * planeSize; // 0.11m
    planeGeo.translate(0, planeSize / 2 - groundOffset, 0);

    this.runnerMesh = new THREE.Mesh(planeGeo, runnerMat);
    this.runnerMesh.castShadow = true;
    this.runnerMesh.renderOrder = 2;
    this.visualChild.add(this.runnerMesh);

    // ============================================================
    // DEDICATED SLIDE POSE SPRITE (CROUCH / SLIDE VISUAL)
    // ============================================================
    this.slideTexture = loader.load('/assets/dili_slide.png');
    this.slideTexture.colorSpace = THREE.SRGBColorSpace;
    this.slideTexture.generateMipmaps = true;
    this.slideTexture.minFilter = THREE.LinearMipmapLinearFilter;
    this.slideTexture.magFilter = THREE.LinearFilter;
    this.slideTexture.anisotropy = 4;

    const slideMat = new THREE.MeshStandardMaterial({
      map: this.slideTexture,
      transparent: true,
      alphaTest: 0.02,
      opacity: 1,
      roughness: 0.82,
      metalness: 0.02,
      emissive: new THREE.Color(0x2d1028),
      emissiveMap: this.slideTexture,
      emissiveIntensity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const slidePlaneGeo = new THREE.PlaneGeometry(planeSize, planeSize);
    slidePlaneGeo.translate(0, planeSize / 2 - groundOffset, 0);

    this.slideMesh = new THREE.Mesh(slidePlaneGeo, slideMat);
    this.slideMesh.castShadow = true;
    this.slideMesh.renderOrder = 2;
    this.slideMesh.visible = false;
    this.visualChild.add(this.slideMesh);

    // ============================================================
    // CHARACTER NEON RIM LIGHT (Positioned at mid-torso for clean illumination)
    // ============================================================
    this.rimLight = new THREE.PointLight(0xff3dbb, 0.85, 4.2);
    this.rimLight.position.set(0, 1.1, 0.5);
    this.visualChild.add(this.rimLight);

    // ============================================================
    // DYNAMIC GROUND SHADOW (Attached to root group on road)
    // ============================================================
    const shadowGeo = new THREE.PlaneGeometry(1.15, 1.35);
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d')!;
    const grad = sCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
    grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.35)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 128, 128);

    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    });

    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.shadowMesh.position.y = 0.015;
    this.shadowMesh.renderOrder = 1;
    this.group.add(this.shadowMesh);

    // ============================================================
    // DASH SPEED TRAIL RIBBON
    // ============================================================
    const trailGeo = new THREE.PlaneGeometry(1.4, 3.6);
    const trailCanvas = document.createElement('canvas');
    trailCanvas.width = 128;
    trailCanvas.height = 256;
    const tCtx = trailCanvas.getContext('2d')!;
    const tGrad = tCtx.createLinearGradient(0, 256, 0, 0);
    tGrad.addColorStop(0, 'rgba(0, 240, 255, 0.85)');
    tGrad.addColorStop(0.3, 'rgba(0, 240, 255, 0.45)');
    tGrad.addColorStop(0.7, 'rgba(255, 0, 127, 0.25)');
    tGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    tCtx.fillStyle = tGrad;
    tCtx.fillRect(0, 0, 128, 256);

    const trailTex = new THREE.CanvasTexture(trailCanvas);
    const trailMat = new THREE.MeshBasicMaterial({
      map: trailTex,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.speedTrailMesh = new THREE.Mesh(trailGeo, trailMat);
    this.speedTrailMesh.rotation.x = Math.PI / 2;
    this.speedTrailMesh.position.set(0, 0.03, 1.8);
    this.speedTrailMesh.renderOrder = 0;
    this.group.add(this.speedTrailMesh);
  }

  /**
   * Sets the active frame in the 8-frame sprite sheet.
   */
  private setFrame(index: number): void {
    const clamped = ((index % this.totalFrames) + this.totalFrames) % this.totalFrames;
    if (clamped !== this.currentFrameIndex) {
      this.currentFrameIndex = clamped;
      this.texture.offset.x = clamped / this.totalFrames;
    }
  }

  public update(delta: number, runSpeed: number): void {
    // 1. Advance running stride animation
    if (!this.isSliding && !this.isJumping && !this.isStumbling && runSpeed > 0) {
      // Step frequency synced to run speed (faster cadence during hyper dash)
      const cadenceMult = this.isDashing ? 0.95 : 0.58;
      const strideCadence = Math.max(10, runSpeed * cadenceMult);
      this.runCycleAccumulator += delta * strideCadence;

      const frame = Math.floor(this.runCycleAccumulator) % this.totalFrames;
      this.setFrame(frame);

      // Subtle natural hip sway & forward running tilt
      const cycleRad = (frame / this.totalFrames) * Math.PI * 2;
      const subtleSway = Math.sin(cycleRad) * 0.035;
      this.visualChild.rotation.z = this.bankAngle + subtleSway;
      this.visualChild.rotation.x = -0.06;
      this.visualChild.position.y = 0;

      // Dynamic ground shadow contact
      const shadowPulse = 1.0 + Math.sin(cycleRad * 2) * 0.06;
      this.shadowMesh.scale.set(shadowPulse, shadowPulse, 1);
      (this.shadowMesh.material as THREE.MeshBasicMaterial).opacity = 0.65 + Math.sin(cycleRad * 2) * 0.1;
    }

    // 2. Rear-facing orientation: strictly independent from lane X movement
    // Ensures head and body remain rear-facing at all times, preventing any edge-on thinning or disappearance
    this.visualParent.rotation.set(0, 0, 0);
  }

  public onLaneSwitch(direction: -1 | 1): void {
    gsap.killTweensOf(this, 'bankAngle');

    // Subtle athletic banking roll into destination lane (strictly on Z axis, max 0.05 rad ≈ 2.8°)
    // Dili remains fully broad and 100% visible throughout all 4 lane transitions
    const targetTilt = -direction * 0.05;
    gsap.to(this, {
      bankAngle: targetTilt,
      duration: 0.09,
      ease: 'power2.out',
      onComplete: () => {
        gsap.to(this, {
          bankAngle: 0,
          duration: 0.15,
          ease: 'power2.inOut',
        });
      },
    });
  }

  public onJump(): void {
    this.isJumping = true;
    gsap.killTweensOf(this.visualChild.scale);
    gsap.killTweensOf(this.visualChild.position);

    // Airborne dynamic pose: frame 2 (passing/tucked stride)
    this.setFrame(2);

    // Aerodynamic vertical stretch
    gsap.to(this.visualChild.scale, {
      x: 0.95,
      y: 1.12,
      z: 1,
      duration: 0.18,
      ease: 'power2.out',
    });

    // Shadow shrinks and softens as character gains altitude
    gsap.to(this.shadowMesh.scale, { x: 0.5, y: 0.5, duration: 0.25 });
    gsap.to(this.shadowMesh.material as THREE.MeshBasicMaterial, { opacity: 0.25, duration: 0.25 });
  }

  public onLand(): void {
    this.isJumping = false;
    gsap.killTweensOf(this.visualChild.scale);

    // Ground impact compression squash and elastic rebound
    gsap.to(this.visualChild.scale, {
      x: 1.12,
      y: 0.86,
      z: 1,
      duration: 0.08,
      ease: 'power2.out',
      onComplete: () => {
        gsap.to(this.visualChild.scale, {
          x: 1,
          y: 1,
          z: 1,
          duration: 0.14,
          ease: 'back.out(1.5)',
        });
      },
    });

    // Shadow snaps back to full contact
    gsap.to(this.shadowMesh.scale, { x: 1, y: 1, duration: 0.12 });
    gsap.to(this.shadowMesh.material as THREE.MeshBasicMaterial, { opacity: 0.65, duration: 0.12 });
  }

  public onSlide(): void {
    this.isSliding = true;
    gsap.killTweensOf(this.visualChild.scale);
    gsap.killTweensOf(this.visualChild.position);
    gsap.killTweensOf(this.visualChild.rotation);
    gsap.killTweensOf(this, 'slideCrouch');

    const runnerMat = this.runnerMesh.material as THREE.MeshStandardMaterial;
    const slideMat = this.slideMesh.material as THREE.MeshStandardMaterial;
    gsap.killTweensOf(runnerMat);
    gsap.killTweensOf(slideMat);

    // UNAMBIGUOUS VISIBILITY: Instantly hide runnerMesh completely, show ONLY slideMesh
    this.runnerMesh.visible = false;
    this.slideMesh.visible = true;
    runnerMat.opacity = 1;
    slideMat.opacity = 1;

    console.log('[DILI SLIDE] slideMesh visible=true, runnerMesh visible=false');

    this.slideCrouch = 1;
    // Scale is strictly kept at 1, 1, 1 - NO squash or vertex deformation applied
    this.visualChild.scale.set(1, 1, 1);

    // Athletic slide forward tilt & slight grounded stance
    gsap.to(this.visualChild.rotation, { x: -0.15, duration: 0.1, ease: 'power2.out' });
    gsap.to(this.visualChild.position, { y: -0.04, duration: 0.1, ease: 'power2.out' });

    // Shadow extends into sliding contact
    gsap.to(this.shadowMesh.scale, { x: 1.25, y: 1.35, duration: 0.1 });
  }

  public onSlideEnd(): void {
    this.isSliding = false;
    gsap.killTweensOf(this.visualChild.scale);
    gsap.killTweensOf(this.visualChild.position);
    gsap.killTweensOf(this.visualChild.rotation);
    gsap.killTweensOf(this, 'slideCrouch');

    const runnerMat = this.runnerMesh.material as THREE.MeshStandardMaterial;
    const slideMat = this.slideMesh.material as THREE.MeshStandardMaterial;
    gsap.killTweensOf(runnerMat);
    gsap.killTweensOf(slideMat);

    // UNAMBIGUOUS VISIBILITY: Instantly hide slideMesh completely, show ONLY runnerMesh
    this.slideMesh.visible = false;
    this.runnerMesh.visible = true;
    runnerMat.opacity = 1;
    slideMat.opacity = 1;

    console.log('[DILI SLIDE] slideMesh visible=false, runnerMesh visible=true');

    this.slideCrouch = 0;
    this.visualChild.scale.set(1, 1, 1);

    // Return to upright running tilt & ground level
    gsap.to(this.visualChild.rotation, { x: -0.06, duration: 0.14, ease: 'power2.out' });
    gsap.to(this.visualChild.position, { y: 0, duration: 0.14 });

    // Shadow returns to running footprint
    gsap.to(this.shadowMesh.scale, { x: 1, y: 1, duration: 0.14 });
  }

  public onDash(duration: number): void {
    this.isDashing = true;
    this.rimLight.color.setHex(0x00f0ff);
    this.rimLight.intensity = 1.6;

    // Aerodynamic dash forward tilt
    gsap.to(this.visualChild.rotation, { x: -0.25, duration: 0.08 });
    gsap.to(this.visualChild.scale, { x: 0.94, y: 0.94, z: 1.15, duration: 0.1 });

    // Cyber speed trail flaring
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
    this.rimLight.intensity = 0.85;

    gsap.to(this.visualChild.rotation, { x: -0.06, duration: 0.18 });
    gsap.to(this.visualChild.scale, { x: 1, y: 1, z: 1, duration: 0.18 });
    (this.speedTrailMesh.material as THREE.MeshBasicMaterial).opacity = 0;
  }

  public onStumble(): void {
    this.isStumbling = true;
    gsap.killTweensOf(this.visualChild.rotation);

    // Recoil wobble
    gsap.to(this.visualChild.rotation, {
      x: 0.18,
      z: 0.1,
      duration: 0.09,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        this.isStumbling = false;
        gsap.to(this.visualChild.rotation, { x: -0.06, z: 0, duration: 0.18 });
      },
    });
  }

  public onCrash(): void {
    gsap.killTweensOf(this.visualChild.rotation);
    gsap.killTweensOf(this.visualChild.position);

    // Knockback tumble
    gsap.to(this.visualChild.rotation, {
      x: 0.5,
      y: 0,
      z: 0.35,
      duration: 0.35,
      ease: 'power3.out',
    });
    gsap.to(this.visualChild.position, {
      y: 0.4,
      z: 0.8,
      duration: 0.35,
      ease: 'power3.out',
    });

    gsap.to(this.shadowMesh.scale, { x: 0.4, y: 0.4, duration: 0.35 });
    gsap.to(this.shadowMesh.material as THREE.MeshBasicMaterial, { opacity: 0.2, duration: 0.35 });
  }

  public reset(): void {
    gsap.killTweensOf(this);
    gsap.killTweensOf(this, 'slideCrouch');
    gsap.killTweensOf(this.visualChild.scale);
    gsap.killTweensOf(this.visualChild.position);
    gsap.killTweensOf(this.visualChild.rotation);
    gsap.killTweensOf(this.shadowMesh.scale);
    gsap.killTweensOf(this.shadowMesh.material);
    gsap.killTweensOf(this.speedTrailMesh.material);

    this.isSliding = false;
    this.isJumping = false;
    this.isDashing = false;
    this.isStumbling = false;
    this.slideCrouch = 0;
    this.bankAngle = 0;
    this.runCycleAccumulator = 0;
    this.setFrame(0);

    const runnerMat = this.runnerMesh.material as THREE.MeshStandardMaterial;
    const slideMat = this.slideMesh.material as THREE.MeshStandardMaterial;
    gsap.killTweensOf(runnerMat);
    gsap.killTweensOf(slideMat);
    runnerMat.opacity = 1;
    slideMat.opacity = 1;
    this.runnerMesh.visible = true;
    this.slideMesh.visible = false;

    this.visualChild.scale.set(1, 1, 1);
    this.visualChild.position.set(0, 0, 0);
    this.visualChild.rotation.set(-0.06, 0, 0);

    this.shadowMesh.scale.set(1, 1, 1);
    (this.shadowMesh.material as THREE.MeshBasicMaterial).opacity = 0.65;
    (this.speedTrailMesh.material as THREE.MeshBasicMaterial).opacity = 0;

    this.rimLight.color.setHex(0xff3dbb);
    this.rimLight.intensity = 0.85;
  }

  public dispose(): void {
    this.texture.dispose();
    this.slideTexture.dispose();
    (this.runnerMesh.material as THREE.Material).dispose();
    this.runnerMesh.geometry.dispose();
    (this.slideMesh.material as THREE.Material).dispose();
    this.slideMesh.geometry.dispose();
    (this.shadowMesh.material as THREE.Material).dispose();
    this.shadowMesh.geometry.dispose();
    (this.speedTrailMesh.material as THREE.Material).dispose();
    this.speedTrailMesh.geometry.dispose();
  }
}
