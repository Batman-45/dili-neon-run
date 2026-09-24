import * as THREE from 'three';

export interface TrackChunkConfig {
  length: number;
  roadWidth: number;
  laneWidth: number;
}

export class TrackChunk {
  public readonly group: THREE.Group;
  public readonly length: number;
  public readonly roadWidth: number;
  public readonly laneWidth: number;

  constructor(index: number, config: TrackChunkConfig) {
    this.length = config.length;
    this.roadWidth = config.roadWidth;
    this.laneWidth = config.laneWidth;
    this.group = new THREE.Group();

    this.buildRoadMesh();
    this.buildLaneDividers();
    this.buildGuardrails();
    this.buildRoadsidePylons();

    // Add an overhead cyber arch on every other chunk
    if (index % 2 === 1) {
      this.buildOverheadArch();
    }
  }

  private buildRoadMesh(): void {
    // Main road surface - sleek cyberpunk asphalt with subtle metallic sheen
    const roadGeo = new THREE.PlaneGeometry(this.roadWidth, this.length, 1, 10);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x0c0f20,
      roughness: 0.4,
      metalness: 0.5,
    });

    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0;
    this.group.add(road);

    // Glowing under-track rim
    const underGeo = new THREE.PlaneGeometry(this.roadWidth + 0.8, this.length);
    const underMat = new THREE.MeshBasicMaterial({
      color: 0x03040c,
    });
    const under = new THREE.Mesh(underGeo, underMat);
    under.rotation.x = -Math.PI / 2;
    under.position.y = -0.05;
    this.group.add(under);
  }

  private buildLaneDividers(): void {
    // 2 divider lines separating the 3 lanes:
    // Left divider at x = -laneWidth / 2 = -1.2 (between -2.4 and 0)
    // Right divider at x = +1.2 (between 0 and +2.4)
    const dividerOffsets = [-this.laneWidth / 2, this.laneWidth / 2];

    const dashLength = 3.0;
    const gapLength = 2.0;
    const period = dashLength + gapLength;
    const numDashes = Math.floor(this.length / period);

    const dashGeo = new THREE.PlaneGeometry(0.12, dashLength);
    const dashMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
    });

    for (const x of dividerOffsets) {
      for (let i = 0; i < numDashes; i++) {
        const dash = new THREE.Mesh(dashGeo, dashMat);
        dash.rotation.x = -Math.PI / 2;
        const z = -this.length / 2 + i * period + period / 2;
        dash.position.set(x, 0.02, z);
        this.group.add(dash);
      }
    }
  }

  private buildGuardrails(): void {
    const halfWidth = this.roadWidth / 2;
    const railRadius = 0.08;

    const railGeo = new THREE.CylinderGeometry(railRadius, railRadius, this.length, 8);
    const railMat = new THREE.MeshBasicMaterial({
      color: 0xff007f, // Glowing magenta
    });

    // Left guardrail
    const leftRail = new THREE.Mesh(railGeo, railMat);
    leftRail.rotation.x = Math.PI / 2;
    leftRail.position.set(-halfWidth, 0.25, 0);
    this.group.add(leftRail);

    // Right guardrail
    const rightRail = new THREE.Mesh(railGeo, railMat);
    rightRail.rotation.x = Math.PI / 2;
    rightRail.position.set(halfWidth, 0.25, 0);
    this.group.add(rightRail);

    // Neon curb strips on pavement edge
    const curbGeo = new THREE.PlaneGeometry(0.2, this.length);
    const curbMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    const leftCurb = new THREE.Mesh(curbGeo, curbMat);
    leftCurb.rotation.x = -Math.PI / 2;
    leftCurb.position.set(-halfWidth + 0.1, 0.015, 0);
    this.group.add(leftCurb);

    const rightCurb = new THREE.Mesh(curbGeo, curbMat);
    rightCurb.rotation.x = -Math.PI / 2;
    rightCurb.position.set(halfWidth - 0.1, 0.015, 0);
    this.group.add(rightCurb);
  }

  private buildRoadsidePylons(): void {
    const halfWidth = this.roadWidth / 2 + 0.3;
    const pylonCount = 4;
    const spacing = this.length / pylonCount;

    const postGeo = new THREE.BoxGeometry(0.12, 1.2, 0.12);
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x181a28,
      roughness: 0.5,
      metalness: 0.8,
    });

    const tipGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const cyanLightMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const pinkLightMat = new THREE.MeshBasicMaterial({ color: 0xff007f });

    for (let i = 0; i < pylonCount; i++) {
      const z = -this.length / 2 + (i + 0.5) * spacing;
      const isCyan = i % 2 === 0;

      // Left post
      const leftPost = new THREE.Mesh(postGeo, postMat);
      leftPost.position.set(-halfWidth, 0.6, z);
      this.group.add(leftPost);

      const leftTip = new THREE.Mesh(tipGeo, isCyan ? cyanLightMat : pinkLightMat);
      leftTip.position.set(-halfWidth, 1.25, z);
      this.group.add(leftTip);

      // Right post
      const rightPost = new THREE.Mesh(postGeo, postMat);
      rightPost.position.set(halfWidth, 0.6, z);
      this.group.add(rightPost);

      const rightTip = new THREE.Mesh(tipGeo, isCyan ? pinkLightMat : cyanLightMat);
      rightTip.position.set(halfWidth, 1.25, z);
      this.group.add(rightTip);
    }
  }

  private buildOverheadArch(): void {
    const archGroup = new THREE.Group();
    const halfWidth = this.roadWidth / 2 + 0.4;
    const archHeight = 4.8;

    const columnGeo = new THREE.BoxGeometry(0.3, archHeight, 0.3);
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x111320,
      roughness: 0.4,
      metalness: 0.9,
    });

    // Left column
    const colLeft = new THREE.Mesh(columnGeo, metalMat);
    colLeft.position.set(-halfWidth, archHeight / 2, 0);
    archGroup.add(colLeft);

    // Right column
    const colRight = new THREE.Mesh(columnGeo, metalMat);
    colRight.position.set(halfWidth, archHeight / 2, 0);
    archGroup.add(colRight);

    // Overhead beam
    const beamGeo = new THREE.BoxGeometry(this.roadWidth + 1.1, 0.35, 0.35);
    const beam = new THREE.Mesh(beamGeo, metalMat);
    beam.position.set(0, archHeight, 0);
    archGroup.add(beam);

    // Glowing neon sign board on arch
    const signGeo = new THREE.PlaneGeometry(this.roadWidth * 0.7, 0.7);
    const signMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0, archHeight - 0.55, 0.05);
    archGroup.add(sign);

    // Neon border line
    const borderGeo = new THREE.BoxGeometry(this.roadWidth * 0.7 + 0.1, 0.06, 0.06);
    const borderMat = new THREE.MeshBasicMaterial({ color: 0xff007f });
    const borderTop = new THREE.Mesh(borderGeo, borderMat);
    borderTop.position.set(0, archHeight - 0.18, 0.1);
    archGroup.add(borderTop);

    const borderBottom = new THREE.Mesh(borderGeo, borderMat);
    borderBottom.position.set(0, archHeight - 0.92, 0.1);
    archGroup.add(borderBottom);

    archGroup.position.set(0, 0, 0);
    this.group.add(archGroup);
  }

  public setPositionZ(z: number): void {
    this.group.position.z = z;
  }

  public getPositionZ(): number {
    return this.group.position.z;
  }
}
