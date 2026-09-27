import * as THREE from 'three';
import gsap from 'gsap';
import { ObstacleType, type IObstacle } from './ObstacleTypes';
import { TrackManager } from '../track/TrackManager';
import type { LaneIndex } from '../character/DiliCharacter';

/**
 * Obstacle — High-fidelity 3D futuristic obstacle models.
 * Types:
 * - HIGH_BARRIER: Industrial Cyber Construction Hurdle (Jump Over)
 * - LOW_BARRIER: High-tech Security Scanner Gantry (Slide Under)
 * - BLOCKADE: Armored Autonomous Cyber Roadblock Drone (Switch Lanes / Dash Smash)
 */
export class Obstacle implements IObstacle {
  public readonly group: THREE.Group;
  public type: ObstacleType = ObstacleType.HIGH_BARRIER;
  public lane: LaneIndex = 0;
  public active: boolean = false;
  public clearedByPlayer: boolean = false;
  public nearMissAwarded: boolean = false;
  public smashedByDash: boolean = false;
  public readonly boundingBox: THREE.Box3 = new THREE.Box3();

  // Sub-groups for the 3 visual variants
  private highBarrierMesh: THREE.Group;
  private lowBarrierMesh: THREE.Group;
  private blockadeMesh: THREE.Group;

  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;

    this.highBarrierMesh = this.createHighBarrierMesh();
    this.lowBarrierMesh = this.createLowBarrierMesh();
    this.blockadeMesh = this.createBlockadeMesh();

    this.group.add(this.highBarrierMesh);
    this.group.add(this.lowBarrierMesh);
    this.group.add(this.blockadeMesh);
  }

  private static createHazardTexture(col1: string, col2: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = col1;
    ctx.fillRect(0, 0, 256, 64);

    // Diagonal hazard stripes
    ctx.fillStyle = col2;
    ctx.beginPath();
    for (let x = -64; x < 320; x += 32) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 20, 0);
      ctx.lineTo(x + 20 - 40, 64);
      ctx.lineTo(x - 40, 64);
    }
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 1);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private createHighBarrierMesh(): THREE.Group {
    const root = new THREE.Group();
    const laneHalfWidth = 1.05;

    // 1. Heavy industrial cast-steel base stanchions
    const baseGeo = new THREE.BoxGeometry(0.3, 0.22, 0.45);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x141824,
      roughness: 0.5,
      metalness: 0.8,
    });

    const leftBase = new THREE.Mesh(baseGeo, baseMat);
    leftBase.position.set(-laneHalfWidth, 0.11, 0);
    root.add(leftBase);

    const rightBase = new THREE.Mesh(baseGeo, baseMat);
    rightBase.position.set(laneHalfWidth, 0.11, 0);
    root.add(rightBase);

    // 2. Upright support pillars with hazard stripes
    const postGeo = new THREE.BoxGeometry(0.18, 0.72, 0.2);
    const hazardTex = Obstacle.createHazardTexture('#ff9900', '#111420');
    const postMat = new THREE.MeshStandardMaterial({
      map: hazardTex,
      roughness: 0.4,
      metalness: 0.6,
    });

    const leftPost = new THREE.Mesh(postGeo, postMat);
    leftPost.position.set(-laneHalfWidth, 0.48, 0);
    root.add(leftPost);

    const rightPost = new THREE.Mesh(postGeo, postMat);
    rightPost.position.set(laneHalfWidth, 0.48, 0);
    root.add(rightPost);

    // 3. Strobe warning beacon caps on posts
    const beaconGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.14, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

    const leftBeacon = new THREE.Mesh(beaconGeo, beaconMat);
    leftBeacon.position.set(-laneHalfWidth, 0.9, 0);
    root.add(leftBeacon);

    const rightBeacon = new THREE.Mesh(beaconGeo, beaconMat);
    rightBeacon.position.set(laneHalfWidth, 0.9, 0);
    root.add(rightBeacon);

    // 4. Heavy structural crossbar at Y = 0.45m
    const lowerBeamGeo = new THREE.BoxGeometry(laneHalfWidth * 2 - 0.15, 0.14, 0.14);
    const lowerBeam = new THREE.Mesh(lowerBeamGeo, baseMat);
    lowerBeam.position.set(0, 0.4, 0);
    root.add(lowerBeam);

    // 5. High-visibility top hurdle repulsor rail at Y = 0.82m
    const topRailGeo = new THREE.BoxGeometry(laneHalfWidth * 2 - 0.12, 0.12, 0.14);
    const topRailMat = new THREE.MeshStandardMaterial({
      color: 0x22283a,
      roughness: 0.35,
      metalness: 0.85,
    });
    const topRail = new THREE.Mesh(topRailGeo, topRailMat);
    topRail.position.set(0, 0.82, 0);
    root.add(topRail);

    // Glowing plasma core bar
    const plasmaGeo = new THREE.BoxGeometry(laneHalfWidth * 2 - 0.18, 0.06, 0.16);
    const plasmaMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const plasma = new THREE.Mesh(plasmaGeo, plasmaMat);
    plasma.position.set(0, 0.82, 0);
    root.add(plasma);

    // 6. Upward Jump Chevrons (▲ ▲ ▲)
    const chevronGeo = new THREE.ConeGeometry(0.12, 0.22, 3);
    const chevronMat = new THREE.MeshBasicMaterial({ color: 0xffdd00 });
    for (const xOff of [-0.65, 0, 0.65]) {
      const chFront = new THREE.Mesh(chevronGeo, chevronMat);
      chFront.position.set(xOff, 0.58, 0.08);
      root.add(chFront);

      const chBack = new THREE.Mesh(chevronGeo, chevronMat);
      chBack.position.set(xOff, 0.58, -0.08);
      root.add(chBack);
    }

    // 7. Ground shadow contact plane
    const shadowGeo = new THREE.PlaneGeometry(laneHalfWidth * 2.2, 0.6);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.5,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.015;
    root.add(shadow);

    return root;
  }

  private createLowBarrierMesh(): THREE.Group {
    const root = new THREE.Group();
    const laneHalfWidth = 1.05;
    const archHeight = 2.45;

    // 1. Heavy industrial upright side columns
    const postGeo = new THREE.BoxGeometry(0.24, archHeight, 0.28);
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x161a28,
      roughness: 0.45,
      metalness: 0.85,
    });

    const leftPost = new THREE.Mesh(postGeo, postMat);
    leftPost.position.set(-laneHalfWidth, archHeight / 2, 0);
    root.add(leftPost);

    const rightPost = new THREE.Mesh(postGeo, postMat);
    rightPost.position.set(laneHalfWidth, archHeight / 2, 0);
    root.add(rightPost);

    // 2. Heavy overhead scanner gantry housing
    const headerGeo = new THREE.BoxGeometry(laneHalfWidth * 2 + 0.3, 0.45, 0.35);
    const header = new THREE.Mesh(headerGeo, postMat);
    header.position.set(0, archHeight - 0.15, 0);
    root.add(header);

    // Strobe warning beacons on top of gantry
    const beaconGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.14, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    for (const xOff of [-laneHalfWidth, 0, laneHalfWidth]) {
      const b = new THREE.Mesh(beaconGeo, beaconMat);
      b.position.set(xOff, archHeight + 0.14, 0);
      root.add(b);
    }

    // 3. Downward Slide Chevrons (▼ ▼ ▼)
    const chevronGeo = new THREE.ConeGeometry(0.12, 0.22, 3);
    const chevronMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    for (const xOff of [-0.6, 0, 0.6]) {
      const ch = new THREE.Mesh(chevronGeo, chevronMat);
      ch.rotation.z = Math.PI; // point downward
      ch.position.set(xOff, archHeight - 0.26, 0.19);
      root.add(ch);
    }

    // 4. Downward holographic laser curtain (clearance 0 to 0.82m underneath)
    const laserGeo = new THREE.PlaneGeometry(laneHalfWidth * 2 - 0.1, 1.25);
    const laserMat = new THREE.MeshBasicMaterial({
      color: 0xff007f,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });
    const laser = new THREE.Mesh(laserGeo, laserMat);
    laser.position.set(0, 1.48, 0);
    root.add(laser);

    // Laser bottom emitter rail at Y = 0.82m
    const railGeo = new THREE.BoxGeometry(laneHalfWidth * 2 - 0.1, 0.08, 0.12);
    const railMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.set(0, 0.82, 0);
    root.add(rail);

    return root;
  }

  private createBlockadeMesh(): THREE.Group {
    const root = new THREE.Group();
    const width = 2.1;
    const height = 2.5;

    // 1. Armored chassis with chamfered profile
    const bodyGeo = new THREE.BoxGeometry(width, height - 0.2, 0.4);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x141824,
      roughness: 0.45,
      metalness: 0.8,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = (height - 0.2) / 2 + 0.1;
    root.add(body);

    // 2. High-contrast hazard caution stripes (Amber/Black) along top & bottom edges
    const hazardTex = Obstacle.createHazardTexture('#ff9900', '#10131d');
    const stripeGeo = new THREE.PlaneGeometry(width * 0.95, 0.28);
    const stripeMat = new THREE.MeshBasicMaterial({ map: hazardTex, side: THREE.DoubleSide });

    const topStripe = new THREE.Mesh(stripeGeo, stripeMat);
    topStripe.position.set(0, height - 0.28, 0.22);
    root.add(topStripe);

    const bottomStripe = new THREE.Mesh(stripeGeo, stripeMat);
    bottomStripe.position.set(0, 0.28, 0.22);
    root.add(bottomStripe);

    // 3. Central crimson emergency barrier face
    const faceGeo = new THREE.PlaneGeometry(width * 0.88, height * 0.55);
    const faceMat = new THREE.MeshBasicMaterial({
      color: 0xff1744,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.set(0, height / 2, 0.21);
    root.add(face);

    // Heavy diagonal hazard X brace
    const crossGeo = new THREE.BoxGeometry(width * 0.75, 0.14, 0.06);
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const x1 = new THREE.Mesh(crossGeo, crossMat);
    x1.position.set(0, height / 2, 0.23);
    x1.rotation.z = Math.PI / 4;
    root.add(x1);

    const x2 = new THREE.Mesh(crossGeo, crossMat);
    x2.position.set(0, height / 2, 0.23);
    x2.rotation.z = -Math.PI / 4;
    root.add(x2);

    // 4. Dual red emergency warning strobe beacons on top
    const beaconGeo = new THREE.CylinderGeometry(0.1, 0.14, 0.22, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });

    const leftBeacon = new THREE.Mesh(beaconGeo, beaconMat);
    leftBeacon.position.set(-width * 0.42, height + 0.05, 0);
    root.add(leftBeacon);

    const rightBeacon = new THREE.Mesh(beaconGeo, beaconMat);
    rightBeacon.position.set(width * 0.42, height + 0.05, 0);
    root.add(rightBeacon);

    // 5. Heavy ground contact shadow
    const shadowGeo = new THREE.PlaneGeometry(width * 1.1, 0.8);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.6,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.015;
    root.add(shadow);

    return root;
  }

  public spawn(type: ObstacleType, lane: LaneIndex, z: number): void {
    this.type = type;
    this.lane = lane;
    this.active = true;
    this.clearedByPlayer = false;
    this.nearMissAwarded = false;
    this.smashedByDash = false;

    // Switch mesh visibility
    this.highBarrierMesh.visible = type === ObstacleType.HIGH_BARRIER;
    this.lowBarrierMesh.visible = type === ObstacleType.LOW_BARRIER;
    this.blockadeMesh.visible = type === ObstacleType.BLOCKADE;

    const x = TrackManager.getLaneX(lane);
    this.group.position.set(x, 0, z);
    this.group.scale.set(1, 1, 1);
    this.group.visible = true;

    this.updateBoundingBox();
  }

  public update(_delta: number, forwardDistance: number): void {
    if (!this.active) return;

    this.group.position.z += forwardDistance;
    this.updateBoundingBox();
  }

  public smash(): void {
    this.smashedByDash = true;
    this.active = false;

    // Disintegration bounce animation
    gsap.to(this.group.scale, {
      x: 1.6,
      y: 0.1,
      z: 1.6,
      duration: 0.15,
      ease: 'power2.out',
      onComplete: () => {
        this.recycle();
      },
    });
  }

  public recycle(): void {
    gsap.killTweensOf(this.group.scale);
    this.active = false;
    this.group.visible = false;
    this.group.position.set(0, -50, 0);
    this.clearedByPlayer = false;
    this.nearMissAwarded = false;
    this.smashedByDash = false;
  }

  private updateBoundingBox(): void {
    const pos = this.group.position;
    const halfWidth = 1.05;

    switch (this.type) {
      case ObstacleType.HIGH_BARRIER:
        // Hurdle: ground to 0.9m
        this.boundingBox.min.set(pos.x - halfWidth, 0, pos.z - 0.25);
        this.boundingBox.max.set(pos.x + halfWidth, 0.9, pos.z + 0.25);
        break;

      case ObstacleType.LOW_BARRIER:
        // Overhead laser: spans from y=0.8m to y=2.45m (clearance 0-0.78m underneath for slide)
        this.boundingBox.min.set(pos.x - halfWidth, 0.8, pos.z - 0.25);
        this.boundingBox.max.set(pos.x + halfWidth, 2.45, pos.z + 0.25);
        break;

      case ObstacleType.BLOCKADE:
        // Full wall: ground to 2.5m
        this.boundingBox.min.set(pos.x - halfWidth, 0, pos.z - 0.35);
        this.boundingBox.max.set(pos.x + halfWidth, 2.5, pos.z + 0.35);
        break;
    }
  }

  public dispose(): void {
    gsap.killTweensOf(this.group.scale);
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
