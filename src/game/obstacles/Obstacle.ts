import * as THREE from 'three';
import gsap from 'gsap';
import { ObstacleType, type IObstacle } from './ObstacleTypes';
import { TrackManager } from '../track/TrackManager';
import type { LaneIndex } from '../character/DiliCharacter';

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

  private createHighBarrierMesh(): THREE.Group {
    const root = new THREE.Group();
    const laneHalfWidth = 1.05;

    // Side structural posts
    const postGeo = new THREE.BoxGeometry(0.2, 0.9, 0.25);
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x1e2030,
      roughness: 0.4,
      metalness: 0.8,
    });

    const leftPost = new THREE.Mesh(postGeo, postMat);
    leftPost.position.set(-laneHalfWidth, 0.45, 0);
    root.add(leftPost);

    const rightPost = new THREE.Mesh(postGeo, postMat);
    rightPost.position.set(laneHalfWidth, 0.45, 0);
    root.add(rightPost);

    // Glowing amber beacon caps on posts
    const capGeo = new THREE.BoxGeometry(0.24, 0.12, 0.28);
    const capMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

    const leftCap = new THREE.Mesh(capGeo, capMat);
    leftCap.position.set(-laneHalfWidth, 0.9, 0);
    root.add(leftCap);

    const rightCap = new THREE.Mesh(capGeo, capMat);
    rightCap.position.set(laneHalfWidth, 0.9, 0);
    root.add(rightCap);

    // Dual horizontal hurdle beams (low hurdle structure)
    const beamGeo = new THREE.BoxGeometry(laneHalfWidth * 2 - 0.1, 0.18, 0.12);
    const beamMat = new THREE.MeshStandardMaterial({
      color: 0x141828,
      roughness: 0.35,
      metalness: 0.85,
    });

    // Lower beam at 0.35m
    const lowerBeam = new THREE.Mesh(beamGeo, beamMat);
    lowerBeam.position.set(0, 0.35, 0);
    root.add(lowerBeam);

    // Upper top hurdle rail at 0.82m
    const upperBeam = new THREE.Mesh(beamGeo, beamMat);
    upperBeam.position.set(0, 0.82, 0);
    root.add(upperBeam);

    // High-visibility glowing Amber/Yellow laser hurdle bar
    const neonBarGeo = new THREE.BoxGeometry(laneHalfWidth * 2 - 0.15, 0.08, 0.16);
    const neonBarMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const neonBar = new THREE.Mesh(neonBarGeo, neonBarMat);
    neonBar.position.set(0, 0.85, 0);
    root.add(neonBar);

    // Central hurdle chevron backing plate
    const plateGeo = new THREE.PlaneGeometry(laneHalfWidth * 1.8, 0.42);
    const plateMat = new THREE.MeshBasicMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.set(0, 0.58, 0);
    root.add(plate);

    // 3 Upward Jump Chevrons (▲ ▲ ▲) - immediate visual affordance for "JUMP OVER"
    const chevronGeo = new THREE.ConeGeometry(0.14, 0.28, 3);
    const chevronMat = new THREE.MeshBasicMaterial({ color: 0xffdd00 });

    for (const xOff of [-0.65, 0, 0.65]) {
      const chevron = new THREE.Mesh(chevronGeo, chevronMat);
      chevron.position.set(xOff, 0.58, 0.08);
      root.add(chevron);

      const chevronBack = new THREE.Mesh(chevronGeo, chevronMat);
      chevronBack.position.set(xOff, 0.58, -0.08);
      root.add(chevronBack);
    }

    // Ground laser boundary line
    const groundLineGeo = new THREE.PlaneGeometry(laneHalfWidth * 2, 0.12);
    const groundLineMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const groundLine = new THREE.Mesh(groundLineGeo, groundLineMat);
    groundLine.rotation.x = -Math.PI / 2;
    groundLine.position.set(0, 0.02, 0);
    root.add(groundLine);

    return root;
  }

  private createLowBarrierMesh(): THREE.Group {
    const root = new THREE.Group();
    const laneHalfWidth = 1.05;
    const archHeight = 2.4;

    // Tall side upright columns (arch posts)
    const postGeo = new THREE.BoxGeometry(0.18, archHeight, 0.2);
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x16182c,
      roughness: 0.4,
      metalness: 0.8,
    });

    const leftCol = new THREE.Mesh(postGeo, postMat);
    leftCol.position.set(-laneHalfWidth, archHeight / 2, 0);
    root.add(leftCol);

    const rightCol = new THREE.Mesh(postGeo, postMat);
    rightCol.position.set(laneHalfWidth, archHeight / 2, 0);
    root.add(rightCol);

    // Neon edge stripes on columns
    const colStripeGeo = new THREE.BoxGeometry(0.04, archHeight, 0.22);
    const colStripeMat = new THREE.MeshBasicMaterial({ color: 0xff007f });

    const leftColStripe = new THREE.Mesh(colStripeGeo, colStripeMat);
    leftColStripe.position.set(-laneHalfWidth + 0.08, archHeight / 2, 0);
    root.add(leftColStripe);

    const rightColStripe = new THREE.Mesh(colStripeGeo, colStripeMat);
    rightColStripe.position.set(laneHalfWidth - 0.08, archHeight / 2, 0);
    root.add(rightColStripe);

    // Overhead scanner casing gantry
    const casingGeo = new THREE.BoxGeometry(laneHalfWidth * 2 + 0.2, 0.48, 0.35);
    const casingMat = new THREE.MeshStandardMaterial({
      color: 0x0c0e1c,
      roughness: 0.3,
      metalness: 0.9,
    });
    const casing = new THREE.Mesh(casingGeo, casingMat);
    casing.position.set(0, archHeight - 0.24, 0);
    root.add(casing);

    // Magenta top neon accent on gantry
    const gantryTrimGeo = new THREE.BoxGeometry(laneHalfWidth * 2 + 0.22, 0.06, 0.38);
    const gantryTrimMat = new THREE.MeshBasicMaterial({ color: 0xff007f });
    const gantryTrim = new THREE.Mesh(gantryTrimGeo, gantryTrimMat);
    gantryTrim.position.set(0, archHeight + 0.02, 0);
    root.add(gantryTrim);

    // Warning emergency beacons
    const lightGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });

    const light1 = new THREE.Mesh(lightGeo, lightMat);
    light1.position.set(-0.7, archHeight + 0.1, 0);
    root.add(light1);

    const light2 = new THREE.Mesh(lightGeo, lightMat);
    light2.position.set(0.7, archHeight + 0.1, 0);
    root.add(light2);

    // Downward Slide Chevrons (▼ ▼ ▼) on gantry casing - immediate visual affordance for "SLIDE UNDER"
    const slideChevronGeo = new THREE.ConeGeometry(0.12, 0.22, 3);
    const slideChevronMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    for (const xOff of [-0.55, 0, 0.55]) {
      const chevron = new THREE.Mesh(slideChevronGeo, slideChevronMat);
      chevron.rotation.z = Math.PI; // point downward
      chevron.position.set(xOff, archHeight - 0.26, 0.19);
      root.add(chevron);

      const chevronBack = new THREE.Mesh(slideChevronGeo, slideChevronMat);
      chevronBack.rotation.z = Math.PI;
      chevronBack.position.set(xOff, archHeight - 0.26, -0.19);
      root.add(chevronBack);
    }

    // Glowing downward laser scan sheet (leaves clear gap at y: 0 to 0.8m for sliding)
    const laserSheetGeo = new THREE.PlaneGeometry(laneHalfWidth * 2 - 0.1, 1.25);
    const laserSheetMat = new THREE.MeshBasicMaterial({
      color: 0xff007f,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    });
    const laserSheet = new THREE.Mesh(laserSheetGeo, laserSheetMat);
    laserSheet.position.set(0, 1.48, 0);
    root.add(laserSheet);

    // Laser bottom emitter line at y = 0.82m — razor sharp visual collision floor
    const emitterGeo = new THREE.BoxGeometry(laneHalfWidth * 2 - 0.1, 0.08, 0.1);
    const emitterMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const emitter = new THREE.Mesh(emitterGeo, emitterMat);
    emitter.position.set(0, 0.82, 0);
    root.add(emitter);

    return root;
  }

  private createBlockadeMesh(): THREE.Group {
    const root = new THREE.Group();
    const width = 2.1;
    const height = 2.5;

    // Heavy reinforced frame (full impassable barricade)
    const frameGeo = new THREE.BoxGeometry(width, height, 0.35);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x120810,
      roughness: 0.4,
      metalness: 0.85,
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.y = height / 2;
    root.add(frame);

    // Danger Red/Crimson Holographic digital barrier face (DISTINCT FROM CYAN COLLECTIBLES!)
    const holoGeo = new THREE.PlaneGeometry(width * 0.88, height * 0.84);
    const holoMat = new THREE.MeshBasicMaterial({
      color: 0xff1744, // Vivid Crimson Danger Red
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });
    const holoFront = new THREE.Mesh(holoGeo, holoMat);
    holoFront.position.set(0, height / 2, 0.18);
    root.add(holoFront);

    const holoBack = new THREE.Mesh(holoGeo, holoMat);
    holoBack.position.set(0, height / 2, -0.18);
    root.add(holoBack);

    // Prominent Glowing Hazard Cross / X across the barrier face (unmistakable "BLOCKED" silhouette)
    const crossBarGeo = new THREE.BoxGeometry(width * 0.9, 0.14, 0.04);
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });

    // Diagonal bar 1
    const cross1 = new THREE.Mesh(crossBarGeo, crossMat);
    cross1.position.set(0, height / 2, 0.2);
    cross1.rotation.z = Math.PI / 4;
    root.add(cross1);

    // Diagonal bar 2
    const cross2 = new THREE.Mesh(crossBarGeo, crossMat);
    cross2.position.set(0, height / 2, 0.2);
    cross2.rotation.z = -Math.PI / 4;
    root.add(cross2);

    // Top and bottom high-visibility warning border stripes
    const stripeGeo = new THREE.BoxGeometry(width * 0.95, 0.18, 0.38);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xff3d00 }); // Electric Red-Orange
    const topStripe = new THREE.Mesh(stripeGeo, stripeMat);
    topStripe.position.set(0, height - 0.15, 0);
    root.add(topStripe);

    const bottomStripe = new THREE.Mesh(stripeGeo, stripeMat);
    bottomStripe.position.set(0, 0.18, 0);
    root.add(bottomStripe);

    // Top Danger Strobe Beacon
    const beaconGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.25, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0, height + 0.12, 0);
    root.add(beacon);

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
        // Overhead laser: spans from y=0.8m to y=2.4m (clearance 0-0.75m underneath)
        this.boundingBox.min.set(pos.x - halfWidth, 0.8, pos.z - 0.25);
        this.boundingBox.max.set(pos.x + halfWidth, 2.4, pos.z + 0.25);
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
