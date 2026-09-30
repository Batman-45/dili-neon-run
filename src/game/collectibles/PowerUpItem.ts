import * as THREE from 'three';
import gsap from 'gsap';
import { PowerUpType, POWER_UP_CONFIGS, type ICollectible } from './CollectibleTypes';
import { TrackManager } from '../track/TrackManager';
import type { LaneIndex } from '../character/DiliCharacter';

export class PowerUpItem implements ICollectible {
  public readonly group: THREE.Group;
  public type: PowerUpType = PowerUpType.SHIELD;
  public active: boolean = false;
  public collected: boolean = false;
  public readonly boundingBox: THREE.Box3 = new THREE.Box3();

  // Distinct sub-groups for each power-up type
  private shieldGroup: THREE.Group;
  private magnetGroup: THREE.Group;
  private boostGroup: THREE.Group;
  private multiplierGroup: THREE.Group;

  // Animation references
  private shieldRings: THREE.Mesh[] = [];
  private shieldBubble: THREE.Mesh | null = null;
  private magnetArc: THREE.Mesh | null = null;
  private boostChevrons: THREE.Group[] = [];
  private multiplierSparks: THREE.Mesh[] = [];
  private groundDisc: THREE.Mesh;
  private groundDiscMat: THREE.MeshBasicMaterial;

  private bobTime: number = 0;
  private animTimer: number = 0;

  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;

    // Ground projection disc
    const discGeo = new THREE.PlaneGeometry(1.4, 1.4);
    this.groundDiscMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.groundDisc = new THREE.Mesh(discGeo, this.groundDiscMat);
    this.groundDisc.rotation.x = -Math.PI / 2;
    this.groundDisc.position.y = -0.82;
    this.group.add(this.groundDisc);

    // Build the 4 distinct 3D visual models
    this.shieldGroup = this.createShieldModel();
    this.magnetGroup = this.createMagnetModel();
    this.boostGroup = this.createBoostModel();
    this.multiplierGroup = this.createMultiplierModel();

    this.group.add(this.shieldGroup);
    this.group.add(this.magnetGroup);
    this.group.add(this.boostGroup);
    this.group.add(this.multiplierGroup);
  }

  // =========================================================================
  // 1. SHIELD MODEL: 3D Crest + Protective Bubble + Dual Orbital Rings
  // =========================================================================
  private createShieldModel(): THREE.Group {
    const root = new THREE.Group();
    root.name = 'shieldGroup';

    // 1A. Extruded 3D Shield Crest Silhouette
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.46);
    shape.lineTo(0.36, 0.40);
    shape.quadraticCurveTo(0.38, 0.05, 0.28, -0.15);
    shape.lineTo(0, -0.48);
    shape.lineTo(-0.28, -0.15);
    shape.quadraticCurveTo(-0.38, 0.05, -0.36, 0.40);
    shape.closePath();

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: 0.1,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.03,
      bevelThickness: 0.03,
    };
    const shieldGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    shieldGeo.center();

    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x00d8f0,
      metalness: 0.8,
      roughness: 0.2,
      emissive: new THREE.Color(0x0077aa),
      emissiveIntensity: 0.65,
    });
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    root.add(shieldMesh);

    // 1B. Inner glowing shield cross emblem
    const crossShape = new THREE.Shape();
    crossShape.moveTo(-0.05, 0.22);
    crossShape.lineTo(0.05, 0.22);
    crossShape.lineTo(0.05, 0.07);
    crossShape.lineTo(0.20, 0.07);
    crossShape.lineTo(0.20, -0.05);
    crossShape.lineTo(0.05, -0.05);
    crossShape.lineTo(0.05, -0.25);
    crossShape.lineTo(-0.05, -0.25);
    crossShape.lineTo(-0.05, -0.05);
    crossShape.lineTo(-0.20, -0.05);
    crossShape.lineTo(-0.20, 0.07);
    crossShape.lineTo(-0.05, 0.07);
    crossShape.closePath();
    const crossGeo = new THREE.ShapeGeometry(crossShape);
    const crossMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
    });
    const frontCross = new THREE.Mesh(crossGeo, crossMat);
    frontCross.position.z = 0.09;
    root.add(frontCross);

    const backCross = frontCross.clone();
    backCross.position.z = -0.09;
    backCross.rotation.y = Math.PI;
    root.add(backCross);

    // 1C. Outer protective transparent energy bubble
    const bubbleGeo = new THREE.SphereGeometry(0.68, 20, 16);
    const bubbleMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.shieldBubble = new THREE.Mesh(bubbleGeo, bubbleMat);
    root.add(this.shieldBubble);

    // 1D. Dual orbital energy rings
    const ringGeoA = new THREE.TorusGeometry(0.74, 0.025, 8, 32);
    const ringMatA = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const ringA = new THREE.Mesh(ringGeoA, ringMatA);
    ringA.rotation.x = Math.PI / 3;
    root.add(ringA);
    this.shieldRings.push(ringA);

    const ringGeoB = new THREE.TorusGeometry(0.70, 0.022, 8, 32);
    const ringMatB = new THREE.MeshBasicMaterial({ color: 0x00c8ff });
    const ringB = new THREE.Mesh(ringGeoB, ringMatB);
    ringB.rotation.x = -Math.PI / 4;
    ringB.rotation.y = Math.PI / 4;
    root.add(ringB);
    this.shieldRings.push(ringB);

    return root;
  }

  // =========================================================================
  // 2. MAGNET MODEL: 3D Horseshoe Magnet with Contrasting Poles & Plasma Arc
  // =========================================================================
  private createMagnetModel(): THREE.Group {
    const root = new THREE.Group();
    root.name = 'magnetGroup';

    const magnetMat = new THREE.MeshStandardMaterial({
      color: 0xff0066,
      roughness: 0.25,
      metalness: 0.8,
      emissive: new THREE.Color(0xff0055),
      emissiveIntensity: 0.5,
    });

    const poleMat = new THREE.MeshStandardMaterial({
      color: 0xf5f8ff,
      roughness: 0.15,
      metalness: 0.95,
      emissive: new THREE.Color(0xddeeff),
      emissiveIntensity: 0.6,
    });

    // 2A. Curved upper horseshoe arch (half torus)
    const arcRadius = 0.28;
    const tubeRadius = 0.075;
    const arcGeo = new THREE.TorusGeometry(arcRadius, tubeRadius, 14, 24, Math.PI);
    const arch = new THREE.Mesh(arcGeo, magnetMat);
    arch.position.y = 0.12;
    arch.rotation.z = 0; // arch points up
    root.add(arch);

    // 2B. Two vertical downward legs (left & right)
    const legLength = 0.32;
    const legGeo = new THREE.CylinderGeometry(tubeRadius, tubeRadius, legLength, 14);
    
    // Left leg
    const leftLeg = new THREE.Mesh(legGeo, magnetMat);
    leftLeg.position.set(-arcRadius, 0.12 - legLength / 2, 0);
    root.add(leftLeg);

    // Right leg
    const rightLeg = new THREE.Mesh(legGeo, magnetMat);
    rightLeg.position.set(arcRadius, 0.12 - legLength / 2, 0);
    root.add(rightLeg);

    // 2C. Metallic Pole Tips (North and South)
    const poleLength = 0.13;
    const poleGeo = new THREE.CylinderGeometry(tubeRadius * 1.05, tubeRadius * 1.05, poleLength, 14);

    const leftPole = new THREE.Mesh(poleGeo, poleMat);
    leftPole.position.set(-arcRadius, 0.12 - legLength - poleLength / 2, 0);
    root.add(leftPole);

    const rightPole = new THREE.Mesh(poleGeo, poleMat);
    rightPole.position.set(arcRadius, 0.12 - legLength - poleLength / 2, 0);
    root.add(rightPole);

    // 2D. Magnetic Plasma Arc between the two poles
    const arcBetweenGeo = new THREE.TorusGeometry(arcRadius, 0.018, 6, 20, Math.PI);
    const arcBetweenMat = new THREE.MeshBasicMaterial({
      color: 0xff33aa,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    this.magnetArc = new THREE.Mesh(arcBetweenGeo, arcBetweenMat);
    this.magnetArc.rotation.z = Math.PI; // arcs downwards between pole tips
    this.magnetArc.position.set(0, 0.12 - legLength - poleLength + 0.02, 0);
    root.add(this.magnetArc);

    // 2E. Orbiting magnetic field ring
    const fieldRingGeo = new THREE.TorusGeometry(0.55, 0.02, 8, 30);
    const fieldRingMat = new THREE.MeshBasicMaterial({
      color: 0xff007f,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    const fieldRing = new THREE.Mesh(fieldRingGeo, fieldRingMat);
    fieldRing.rotation.x = Math.PI / 2.5;
    root.add(fieldRing);

    return root;
  }

  // =========================================================================
  // 3. BOOST MODEL: 3D Sharp Lightning Bolt + Trailing Speed Chevrons
  // =========================================================================
  private createBoostModel(): THREE.Group {
    const root = new THREE.Group();
    root.name = 'boostGroup';

    // 3A. Extruded 3D Lightning Bolt
    const boltShape = new THREE.Shape();
    boltShape.moveTo(0.06, 0.52);    // top tip
    boltShape.lineTo(-0.24, 0.05);   // left down
    boltShape.lineTo(-0.04, 0.05);   // center notch
    boltShape.lineTo(-0.16, -0.52);  // bottom tip
    boltShape.lineTo(0.20, -0.06);   // right up
    boltShape.lineTo(0.02, -0.06);   // center notch
    boltShape.closePath();

    const boltExtrude: THREE.ExtrudeGeometryOptions = {
      depth: 0.12,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.025,
      bevelThickness: 0.025,
    };
    const boltGeo = new THREE.ExtrudeGeometry(boltShape, boltExtrude);
    boltGeo.center();

    const boltMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      metalness: 0.85,
      roughness: 0.15,
      emissive: new THREE.Color(0xff8800),
      emissiveIntensity: 0.8,
    });
    const boltMesh = new THREE.Mesh(boltGeo, boltMat);
    root.add(boltMesh);

    // 3B. Trailing Speed Chevrons (>> shape)
    const chevronGeo = this.createChevronGeometry();
    const chevronMat = new THREE.MeshBasicMaterial({
      color: 0xffcc00,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < 2; i++) {
      const chGroup = new THREE.Group();
      const chMesh = new THREE.Mesh(chevronGeo, chevronMat);
      chMesh.rotation.x = Math.PI / 2;
      chMesh.scale.set(0.65, 0.65, 0.65);
      chGroup.add(chMesh);
      chGroup.position.set(0, 0, (i + 1) * 0.28);
      root.add(chGroup);
      this.boostChevrons.push(chGroup);
    }

    // 3C. Amber Energy Rings
    const ringGeo = new THREE.TorusGeometry(0.58, 0.024, 8, 28);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 5;
    root.add(ring);

    return root;
  }

  private createChevronGeometry(): THREE.BufferGeometry {
    const shape = new THREE.Shape();
    shape.moveTo(-0.35, -0.25);
    shape.lineTo(0.0, 0.12);
    shape.lineTo(0.35, -0.25);
    shape.lineTo(0.35, -0.10);
    shape.lineTo(0.0, 0.27);
    shape.lineTo(-0.35, -0.10);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }

  // =========================================================================
  // 4. MULTIPLIER MODEL: 3D "2×" Starburst Badge with Orbiting Star Sparks
  // =========================================================================
  private createMultiplierModel(): THREE.Group {
    const root = new THREE.Group();
    root.name = 'multiplierGroup';

    // 4A. Outer Starburst Ring / Octagonal Bezel
    const ringGeo = new THREE.TorusGeometry(0.48, 0.05, 8, 8); // 8-sided faceted ring
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      metalness: 0.9,
      roughness: 0.15,
      emissive: new THREE.Color(0xff8800),
      emissiveIntensity: 0.6,
    });
    const starRing = new THREE.Mesh(ringGeo, ringMat);
    root.add(starRing);

    // 4B. High-Contrast Procedural "2×" Texture Disc
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Dark translucent circular background
      ctx.beginPath();
      ctx.arc(128, 128, 120, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(20, 6, 38, 0.92)';
      ctx.fill();

      // Glowing border
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#b53cff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 18;
      ctx.stroke();

      // Bold "2×" Text
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 24;
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 118px Orbitron, Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('2×', 128, 132);

      // Gold outline stroke
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ffaa00';
      ctx.strokeText('2×', 128, 132);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;

    const discMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const discGeo = new THREE.CircleGeometry(0.46, 24);
    const badgeMesh = new THREE.Mesh(discGeo, discMat);
    root.add(badgeMesh);

    // 4C. Orbiting Micro Star Sparks
    const sparkGeo = new THREE.OctahedronGeometry(0.08, 0);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    for (let i = 0; i < 3; i++) {
      const spark = new THREE.Mesh(sparkGeo, sparkMat);
      root.add(spark);
      this.multiplierSparks.push(spark);
    }

    // 4D. Purple Resonance Ring
    const purpleRingGeo = new THREE.TorusGeometry(0.56, 0.02, 8, 32);
    const purpleRingMat = new THREE.MeshBasicMaterial({
      color: 0xb53cff,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });
    const purpleRing = new THREE.Mesh(purpleRingGeo, purpleRingMat);
    purpleRing.rotation.x = Math.PI / 3;
    root.add(purpleRing);

    return root;
  }

  // =========================================================================
  // SPAWN & LIFECYCLE
  // =========================================================================
  public spawn(type: PowerUpType, lane: LaneIndex, z: number): void {
    this.type = type;
    this.active = true;
    this.collected = false;

    // Toggle corresponding 3D model
    this.shieldGroup.visible = (type === PowerUpType.SHIELD);
    this.magnetGroup.visible = (type === PowerUpType.MAGNET);
    this.boostGroup.visible = (type === PowerUpType.BOOST);
    this.multiplierGroup.visible = (type === PowerUpType.MULTIPLIER);

    // Match ground disc color to power-up type
    const config = POWER_UP_CONFIGS[type];
    this.groundDiscMat.color.setHex(config.colorHex);

    const x = TrackManager.getLaneX(lane);
    this.group.position.set(x, 0.90, z);
    this.group.scale.set(1, 1, 1);
    this.group.visible = true;
    this.bobTime = Math.random() * Math.PI * 2;
    this.animTimer = 0;
    this.updateBoundingBox();
  }

  public update(delta: number, forwardDistance: number): void {
    if (!this.active) return;

    this.group.position.z += forwardDistance;
    this.bobTime += delta * 3.5;
    this.animTimer += delta;

    // Hover bobbing
    this.group.position.y = 0.90 + Math.sin(this.bobTime) * 0.12;

    // Type-specific dynamic animations
    switch (this.type) {
      case PowerUpType.SHIELD: {
        this.shieldGroup.rotation.y += 1.8 * delta;
        if (this.shieldBubble) {
          const pulse = 1.0 + Math.sin(this.animTimer * 5) * 0.05;
          this.shieldBubble.scale.set(pulse, pulse, pulse);
        }
        if (this.shieldRings[0]) this.shieldRings[0].rotation.z += 2.2 * delta;
        if (this.shieldRings[1]) this.shieldRings[1].rotation.z -= 1.8 * delta;
        break;
      }

      case PowerUpType.MAGNET: {
        this.magnetGroup.rotation.y += 1.6 * delta;
        // Subtle magnetic tilt nod
        this.magnetGroup.rotation.x = Math.sin(this.animTimer * 4) * 0.15;
        // Pulse plasma arc opacity
        if (this.magnetArc) {
          const mat = this.magnetArc.material as THREE.MeshBasicMaterial;
          mat.opacity = 0.4 + Math.sin(this.animTimer * 12) * 0.45;
        }
        break;
      }

      case PowerUpType.BOOST: {
        // High-energy lightning spin and electric jitter
        this.boostGroup.rotation.y += 3.2 * delta;
        this.boostGroup.rotation.z = Math.sin(this.animTimer * 16) * 0.08;
        // Trailing chevrons slide backward and wrap
        this.boostChevrons.forEach((ch, idx) => {
          ch.position.z = 0.2 + ((this.animTimer * 2.2 + idx * 0.35) % 0.8);
          const mat = (ch.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
          mat.opacity = Math.max(0, 1 - (ch.position.z / 0.8));
        });
        break;
      }

      case PowerUpType.MULTIPLIER: {
        this.multiplierGroup.rotation.y += 2.0 * delta;
        // Orbiting star sparks
        this.multiplierSparks.forEach((spark, idx) => {
          const angle = this.animTimer * 3.5 + (idx * Math.PI * 2) / 3;
          spark.position.set(Math.cos(angle) * 0.62, Math.sin(angle) * 0.3, Math.sin(angle) * 0.62);
          spark.rotation.x += 3 * delta;
          spark.rotation.y += 2 * delta;
        });
        break;
      }
    }

    this.updateBoundingBox();
  }

  public collect(): void {
    if (this.collected) return;
    this.collected = true;
    this.active = false;

    // Punch pop and ascend animation
    gsap.to(this.group.scale, {
      x: 1.6,
      y: 1.6,
      z: 1.6,
      duration: 0.18,
      ease: 'power2.out',
    });
    gsap.to(this.group.position, {
      y: this.group.position.y + 0.6,
      duration: 0.18,
      ease: 'power2.out',
      onComplete: () => {
        this.recycle();
      },
    });
  }

  public recycle(): void {
    gsap.killTweensOf(this.group.scale);
    gsap.killTweensOf(this.group.position);
    this.active = false;
    this.collected = false;
    this.group.visible = false;
    this.group.position.set(0, -50, 0);
  }

  private updateBoundingBox(): void {
    const pos = this.group.position;
    const radius = 0.58;
    this.boundingBox.min.set(pos.x - radius, pos.y - radius, pos.z - radius);
    this.boundingBox.max.set(pos.x + radius, pos.y + radius, pos.z + radius);
  }

  public dispose(): void {
    gsap.killTweensOf(this.group.scale);
    gsap.killTweensOf(this.group.position);
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material?.dispose();
        }
      }
    });
  }
}
