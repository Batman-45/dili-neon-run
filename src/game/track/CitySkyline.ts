import * as THREE from 'three';

interface BuildingData {
  mesh: THREE.Group;
  initialX: number;
}

export class CitySkyline {
  public readonly group: THREE.Group;
  private buildings: BuildingData[] = [];
  private gridFloor1!: THREE.GridHelper;
  private gridFloor2!: THREE.GridHelper;
  private gridLength: number = 300;
  private neonParticles!: THREE.Points;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.buildCyberGridFloor();
    this.buildSkyscrapers();
    this.buildAtmosphericParticles();
  }

  private buildCyberGridFloor(): void {
    // Endless neon grid floors spanning the city horizon
    const size = 300;
    const divisions = 60;

    this.gridFloor1 = new THREE.GridHelper(size, divisions, 0x00f0ff, 0x1f1147);
    this.gridFloor1.position.set(0, -0.1, 0);
    this.group.add(this.gridFloor1);

    this.gridFloor2 = new THREE.GridHelper(size, divisions, 0x00f0ff, 0x1f1147);
    this.gridFloor2.position.set(0, -0.1, -size);
    this.group.add(this.gridFloor2);
  }

  private buildSkyscrapers(): void {
    const buildingCount = 28;
    const depths = [-280, 20];
    const zSpan = depths[1] - depths[0];

    const windowColors = [0x00f0ff, 0xff007f, 0x9d00ff, 0x00ff88];

    for (let i = 0; i < buildingCount; i++) {
      const bGroup = new THREE.Group();

      const width = 6 + Math.random() * 8;
      const depth = 8 + Math.random() * 10;
      const height = 18 + Math.random() * 45;

      // Base building geometry
      const geo = new THREE.BoxGeometry(width, height, depth);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x070914,
        roughness: 0.8,
        metalness: 0.2,
      });

      const body = new THREE.Mesh(geo, mat);
      body.position.y = height / 2;
      bGroup.add(body);

      // Glowing rooftop beacon
      const tipGeo = new THREE.CylinderGeometry(0.1, 0.4, 4 + Math.random() * 6, 6);
      const tipMat = new THREE.MeshBasicMaterial({
        color: windowColors[i % windowColors.length],
      });
      const tip = new THREE.Mesh(tipGeo, tipMat);
      tip.position.set(0, height + 2, 0);
      bGroup.add(tip);

      // Neon edge stripes on building corners
      const edgeGeo = new THREE.BoxGeometry(0.15, height, 0.15);
      const edgeMat = new THREE.MeshBasicMaterial({
        color: windowColors[(i + 1) % windowColors.length],
      });
      const edge1 = new THREE.Mesh(edgeGeo, edgeMat);
      edge1.position.set(width / 2, height / 2, depth / 2);
      bGroup.add(edge1);

      const edge2 = new THREE.Mesh(edgeGeo, edgeMat);
      edge2.position.set(-width / 2, height / 2, depth / 2);
      bGroup.add(edge2);

      // Position buildings on left flank (x < -14) or right flank (x > 14)
      const isLeft = i % 2 === 0;
      const xDistance = 14 + Math.random() * 22;
      const posX = isLeft ? -xDistance : xDistance;
      const posZ = depths[0] + (i / buildingCount) * zSpan;

      bGroup.position.set(posX, 0, posZ);
      this.buildings.push({ mesh: bGroup, initialX: posX });
      this.group.add(bGroup);
    }
  }

  private buildAtmosphericParticles(): void {
    // Drifting cyber dust / light orbs in the air
    const count = 300;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = Math.random() * 25 + 0.5;
      positions[i * 3 + 2] = -Math.random() * 250;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.25,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });

    this.neonParticles = new THREE.Points(geometry, material);
    this.group.add(this.neonParticles);
  }

  public update(delta: number, speed: number): void {
    const moveDist = speed * delta;

    // Scroll buildings forward
    for (const b of this.buildings) {
      b.mesh.position.z += moveDist;
      // Recycle building if it goes behind camera
      if (b.mesh.position.z > 30) {
        b.mesh.position.z -= 300;
      }
    }

    // Scroll city grid floor
    this.gridFloor1.position.z += moveDist;
    this.gridFloor2.position.z += moveDist;

    if (this.gridFloor1.position.z > this.gridLength) {
      this.gridFloor1.position.z = this.gridFloor2.position.z - this.gridLength;
    }
    if (this.gridFloor2.position.z > this.gridLength) {
      this.gridFloor2.position.z = this.gridFloor1.position.z - this.gridLength;
    }

    // Animate atmospheric particles
    const positions = this.neonParticles.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 2] += moveDist * 1.1; // Move slightly faster for parallax
      if (positions[i + 2] > 20) {
        positions[i + 2] = -250;
      }
    }
    this.neonParticles.geometry.attributes.position.needsUpdate = true;
  }
}
