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

  private coreMesh: THREE.Mesh;
  private ringMesh: THREE.Mesh;
  private ringMesh2: THREE.Mesh;
  private bobTime: number = 0;

  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;

    // Outer primary orbiting energy ring
    const ringGeo = new THREE.TorusGeometry(0.48, 0.045, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    this.ringMesh = new THREE.Mesh(ringGeo, ringMat);
    this.group.add(this.ringMesh);

    // Secondary perpendicular planetary ring (creates gyro power sphere silhouette)
    const ringGeo2 = new THREE.TorusGeometry(0.42, 0.035, 8, 24);
    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    this.ringMesh2 = new THREE.Mesh(ringGeo2, ringMat2);
    this.ringMesh2.rotation.y = Math.PI / 2;
    this.group.add(this.ringMesh2);

    // Inner glowing power polyhedron with high-luminance emissive
    const coreGeo = new THREE.IcosahedronGeometry(0.32, 0);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      roughness: 0.15,
      metalness: 0.85,
      emissive: new THREE.Color(0x00f0ff),
      emissiveIntensity: 0.85,
    });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.group.add(this.coreMesh);
  }

  public spawn(type: PowerUpType, lane: LaneIndex, z: number): void {
    this.type = type;
    this.active = true;
    this.collected = false;

    const config = POWER_UP_CONFIGS[type];
    const coreMat = this.coreMesh.material as THREE.MeshStandardMaterial;
    coreMat.color.setHex(config.colorHex);
    coreMat.emissive.setHex(config.colorHex);
    coreMat.emissiveIntensity = 0.85;

    (this.ringMesh.material as THREE.MeshBasicMaterial).color.setHex(config.colorHex);
    (this.ringMesh2.material as THREE.MeshBasicMaterial).color.setHex(config.colorHex);

    const x = TrackManager.getLaneX(lane);
    this.group.position.set(x, 0.85, z);
    this.group.scale.set(1, 1, 1);
    this.group.visible = true;
    this.bobTime = 0;
    this.updateBoundingBox();
  }

  public update(delta: number, forwardDistance: number): void {
    if (!this.active) return;

    this.group.position.z += forwardDistance;

    // Hover bob and orbital rotation
    this.bobTime += delta * 3.5;
    this.group.position.y = 0.85 + Math.sin(this.bobTime) * 0.12;

    this.coreMesh.rotation.y += 2.0 * delta;
    this.coreMesh.rotation.x += 1.0 * delta;

    this.ringMesh.rotation.x += 1.8 * delta;
    this.ringMesh.rotation.z += 1.2 * delta;

    this.ringMesh2.rotation.y += 1.6 * delta;
    this.ringMesh2.rotation.z -= 1.1 * delta;

    this.updateBoundingBox();
  }

  public collect(): void {
    if (this.collected) return;
    this.collected = true;
    this.active = false;

    // Radial pop animation
    gsap.to(this.group.scale, {
      x: 1.8,
      y: 1.8,
      z: 1.8,
      duration: 0.16,
      ease: 'power2.out',
      onComplete: () => {
        this.recycle();
      },
    });
  }

  public recycle(): void {
    gsap.killTweensOf(this.group.scale);
    this.active = false;
    this.collected = false;
    this.group.visible = false;
    this.group.position.set(0, -50, 0);
  }

  private updateBoundingBox(): void {
    const pos = this.group.position;
    const radius = 0.55;
    this.boundingBox.min.set(pos.x - radius, pos.y - radius, pos.z - radius);
    this.boundingBox.max.set(pos.x + radius, pos.y + radius, pos.z + radius);
  }

  public dispose(): void {
    gsap.killTweensOf(this.group.scale);
    this.coreMesh.geometry.dispose();
    (this.coreMesh.material as THREE.Material).dispose();
    this.ringMesh.geometry.dispose();
    (this.ringMesh.material as THREE.Material).dispose();
    this.ringMesh2.geometry.dispose();
    (this.ringMesh2.material as THREE.Material).dispose();
  }
}
