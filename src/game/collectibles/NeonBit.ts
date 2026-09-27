import * as THREE from 'three';
import gsap from 'gsap';
import type { ICollectible } from './CollectibleTypes';

export class NeonBit implements ICollectible {
  public readonly group: THREE.Group;
  public active: boolean = false;
  public collected: boolean = false;
  public readonly boundingBox: THREE.Box3 = new THREE.Box3();

  private mesh: THREE.Mesh;
  private coreMesh: THREE.Mesh;
  private rotationSpeed: number = 2.5;
  private bobTime: number = 0;
  private basePosY: number = 0.5;

  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;

    // Outer crystalline octahedron with bright neon emissive glow
    const geo = new THREE.OctahedronGeometry(0.24, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      roughness: 0.15,
      metalness: 0.8,
      emissive: new THREE.Color(0x00c8e0),
      emissiveIntensity: 0.85,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.group.add(this.mesh);

    // Glowing intense magenta core
    const coreGeo = new THREE.OctahedronGeometry(0.12, 0);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xff007f });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.group.add(this.coreMesh);

    // Outer orbital energy ring (enhances visibility from far down the track)
    const ringGeo = new THREE.RingGeometry(0.28, 0.32, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    this.group.add(ring);

    // Ground light projection on asphalt
    const groundGeo = new THREE.PlaneGeometry(0.8, 0.8);
    const groundMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.groundGlow = new THREE.Mesh(groundGeo, groundMat);
    this.groundGlow.rotation.x = -Math.PI / 2;
    this.group.add(this.groundGlow);
  }

  private groundGlow: THREE.Mesh;

  public spawn(x: number, y: number, z: number): void {
    this.active = true;
    this.collected = false;
    this.basePosY = y;
    this.group.position.set(x, y, z);
    this.groundGlow.position.set(0, -y + 0.02, 0);
    this.group.scale.set(1, 1, 1);
    this.group.visible = true;
    this.bobTime = Math.random() * Math.PI * 2;
    this.updateBoundingBox();
  }

  public update(delta: number, forwardDistance: number): void {
    if (!this.active) return;

    this.group.position.z += forwardDistance;

    // Rotation and hover bob
    this.bobTime += delta * 4;
    this.mesh.rotation.y += this.rotationSpeed * delta;
    this.mesh.rotation.x += this.rotationSpeed * 0.5 * delta;
    this.coreMesh.rotation.y -= this.rotationSpeed * delta;

    this.group.position.y = this.basePosY + Math.sin(this.bobTime) * 0.08;

    this.updateBoundingBox();
  }

  public attractToward(targetPos: THREE.Vector3, delta: number, speed: number = 18): void {
    if (!this.active || this.collected) return;

    // Lerp towards target position
    const pos = this.group.position;
    pos.x += (targetPos.x - pos.x) * Math.min(delta * speed, 1);
    pos.y += (targetPos.y + 0.6 - pos.y) * Math.min(delta * speed, 1);
    pos.z += (targetPos.z - pos.z) * Math.min(delta * speed, 1);

    this.updateBoundingBox();
  }

  public collect(): void {
    if (this.collected) return;
    this.collected = true;
    this.active = false;

    // Crisp pickup shrink & flash animation
    gsap.to(this.group.scale, {
      x: 0,
      y: 0,
      z: 0,
      duration: 0.14,
      ease: 'back.in(2)',
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
    const radius = 0.35;
    this.boundingBox.min.set(pos.x - radius, pos.y - radius, pos.z - radius);
    this.boundingBox.max.set(pos.x + radius, pos.y + radius, pos.z + radius);
  }

  public dispose(): void {
    gsap.killTweensOf(this.group.scale);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.coreMesh.geometry.dispose();
    (this.coreMesh.material as THREE.Material).dispose();
  }
}
