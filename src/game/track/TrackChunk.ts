import * as THREE from 'three';

export interface TrackChunkConfig {
  length: number;
  roadWidth: number;
  laneWidth: number;
}

/**
 * TrackChunk — High-fidelity physical cyber-highway chunk.
 * Features:
 * - Realistic textured asphalt with aggregate noise, subtle tire wear tracks, and specular sheen
 * - 3D concrete/composite road curbs with hazard reflectors
 * - Architectural dual-tier steel guardrails with structural stanchions
 * - Overhead highway gantry spans with illuminated Dlicom directional signage
 * - Structural under-bridge viaduct girders and support pillars
 */
export class TrackChunk {
  public readonly group: THREE.Group;
  public readonly length: number;
  public readonly roadWidth: number;
  public readonly laneWidth: number;
  public readonly chunkIndex: number;

  constructor(index: number, config: TrackChunkConfig) {
    this.chunkIndex = index;
    this.length = config.length;
    this.roadWidth = config.roadWidth;
    this.laneWidth = config.laneWidth;
    this.group = new THREE.Group();

    this.buildRoadMesh();
    this.buildLaneDividers();
    this.buildGuardrails();
    this.buildRoadsideLights();
    if (index % 3 === 0) {
      this.buildOverheadGantry();
    }
  }

  private static sharedRoadTexture: THREE.CanvasTexture | null = null;

  private static getRoadTexture(): THREE.CanvasTexture {
    if (!TrackChunk.sharedRoadTexture) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d')!;

      // 1. Rich dark-slate cyber asphalt base
      const bgGrad = ctx.createLinearGradient(0, 0, 512, 0);
      bgGrad.addColorStop(0, '#131622');
      bgGrad.addColorStop(0.12, '#181c2b');
      bgGrad.addColorStop(0.5, '#1e2335');
      bgGrad.addColorStop(0.88, '#181c2b');
      bgGrad.addColorStop(1, '#131622');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 512, 1024);

      // 2. Micro-aggregate asphalt texture (fine mineral grain noise)
      const imgData = ctx.getImageData(0, 0, 512, 1024);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 22;
        data[i] = Math.min(255, Math.max(0, data[i] + noise));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
      }
      ctx.putImageData(imgData, 0, 0);

      // 3. Subtle tire track wear grooves along the 3 travel lanes
      const laneCenters = [85, 256, 427];
      ctx.fillStyle = 'rgba(10, 12, 18, 0.45)';
      for (const cx of laneCenters) {
        // Left wheel path
        ctx.fillRect(cx - 36, 0, 24, 1024);
        // Right wheel path
        ctx.fillRect(cx + 12, 0, 24, 1024);
      }

      // 4. Longitudinal lane expansion seams
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(170, 0); ctx.lineTo(170, 1024);
      ctx.moveTo(342, 0); ctx.lineTo(342, 1024);
      ctx.stroke();

      // 5. Forward cyber speed chevrons along the center lane
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.28)';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let y = 64; y < 1024; y += 256) {
        ctx.beginPath();
        ctx.moveTo(234, y + 26);
        ctx.lineTo(256, y + 6);
        ctx.lineTo(278, y + 26);
        ctx.stroke();
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1, 4);
      tex.colorSpace = THREE.SRGBColorSpace;
      TrackChunk.sharedRoadTexture = tex;
    }
    return TrackChunk.sharedRoadTexture;
  }

  private buildRoadMesh(): void {
    // 1. Main road surface with realistic specular response
    const roadGeo = new THREE.PlaneGeometry(this.roadWidth, this.length, 1, 10);
    const roadMat = new THREE.MeshStandardMaterial({
      map: TrackChunk.getRoadTexture(),
      roughness: 0.42,
      metalness: 0.25,
      color: 0xffffff,
    });

    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0;
    this.group.add(road);

    // 2. Elevated viaduct box girder chassis
    const chassisGeo = new THREE.BoxGeometry(this.roadWidth + 0.4, 0.7, this.length);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x111420,
      roughness: 0.65,
      metalness: 0.8,
    });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.y = -0.38;
    this.group.add(chassis);

    // 3. Viaduct support piers descending into lower metropolis
    const pierGeo = new THREE.CylinderGeometry(0.55, 0.7, 18, 12);
    const pierMat = new THREE.MeshStandardMaterial({
      color: 0x0c0e18,
      roughness: 0.8,
      metalness: 0.5,
    });
    const leftPier = new THREE.Mesh(pierGeo, pierMat);
    leftPier.position.set(-this.roadWidth * 0.35, -9.5, 0);
    this.group.add(leftPier);

    const rightPier = new THREE.Mesh(pierGeo, pierMat);
    rightPier.position.set(this.roadWidth * 0.35, -9.5, 0);
    this.group.add(rightPier);
  }

  private buildLaneDividers(): void {
    // 2 divider lines separating the 3 lanes:
    // Left divider at x = -laneWidth / 2 = -1.2
    // Right divider at x = +1.2
    const dividerOffsets = [-this.laneWidth / 2, this.laneWidth / 2];

    const dashLength = 3.2;
    const gapLength = 2.4;
    const period = dashLength + gapLength;
    const numDashes = Math.floor(this.length / period);

    // 3D physical painted dash strips with subtle bevel
    const dashGeo = new THREE.PlaneGeometry(0.14, dashLength);
    const dashMat = new THREE.MeshStandardMaterial({
      color: 0xdff6ff,
      emissive: new THREE.Color(0x00c8e0),
      emissiveIntensity: 0.35,
      roughness: 0.3,
      metalness: 0.1,
    });

    for (const x of dividerOffsets) {
      for (let i = 0; i < numDashes; i++) {
        const dash = new THREE.Mesh(dashGeo, dashMat);
        dash.rotation.x = -Math.PI / 2;
        const z = -this.length / 2 + i * period + period / 2;
        dash.position.set(x, 0.015, z);
        this.group.add(dash);
      }
    }

    // Outer solid edge lines (highway white/amber shoulders)
    const edgeOffset = this.roadWidth / 2 - 0.25;
    const edgeGeo = new THREE.PlaneGeometry(0.12, this.length);
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0xffeedd,
      emissive: new THREE.Color(0xff8800),
      emissiveIntensity: 0.2,
      roughness: 0.35,
      metalness: 0.1,
    });

    const leftEdge = new THREE.Mesh(edgeGeo, edgeMat);
    leftEdge.rotation.x = -Math.PI / 2;
    leftEdge.position.set(-edgeOffset, 0.015, 0);
    this.group.add(leftEdge);

    const rightEdge = new THREE.Mesh(edgeGeo, edgeMat);
    rightEdge.rotation.x = -Math.PI / 2;
    rightEdge.position.set(edgeOffset, 0.015, 0);
    this.group.add(rightEdge);
  }

  private buildGuardrails(): void {
    const halfWidth = this.roadWidth / 2;

    // 1. Concrete roadside curbs with metallic cap
    const curbGeo = new THREE.BoxGeometry(0.35, 0.28, this.length);
    const curbMat = new THREE.MeshStandardMaterial({
      color: 0x1a1e2c,
      roughness: 0.6,
      metalness: 0.7,
    });

    const leftCurb = new THREE.Mesh(curbGeo, curbMat);
    leftCurb.position.set(-halfWidth + 0.05, 0.12, 0);
    this.group.add(leftCurb);

    const rightCurb = new THREE.Mesh(curbGeo, curbMat);
    rightCurb.position.set(halfWidth - 0.05, 0.12, 0);
    this.group.add(rightCurb);

    // 2. High-strength highway crash barrier rail (dual horizontal beams)
    const railGeo = new THREE.BoxGeometry(0.08, 0.15, this.length);
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x252b3d,
      roughness: 0.35,
      metalness: 0.9,
    });

    // Lower & upper rail beams on both sides
    for (const side of [-1, 1]) {
      const x = side * (halfWidth + 0.12);
      
      const lowerRail = new THREE.Mesh(railGeo, railMat);
      lowerRail.position.set(x, 0.35, 0);
      this.group.add(lowerRail);

      const upperRail = new THREE.Mesh(railGeo, railMat);
      upperRail.position.set(x, 0.62, 0);
      this.group.add(upperRail);

      // Embedded energy guide strip on top rail
      const guideGeo = new THREE.PlaneGeometry(0.04, this.length);
      const guideMat = new THREE.MeshBasicMaterial({
        color: side < 0 ? 0x00f0ff : 0xff007f,
      });
      const guide = new THREE.Mesh(guideGeo, guideMat);
      guide.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      guide.position.set(x - side * 0.045, 0.62, 0);
      this.group.add(guide);
    }

    // 3. Stanchions supporting the guardrails every 5 meters
    const postCount = Math.floor(this.length / 5);
    const postGeo = new THREE.BoxGeometry(0.12, 0.75, 0.14);
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x161926,
      roughness: 0.45,
      metalness: 0.85,
    });

    for (let i = 0; i < postCount; i++) {
      const z = -this.length / 2 + (i + 0.5) * 5;
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(side * (halfWidth + 0.12), 0.35, z);
        this.group.add(post);
      }
    }
  }

  private buildRoadsideLights(): void {
    const halfWidth = this.roadWidth / 2 + 0.5;
    const lightCount = 3;
    const spacing = this.length / lightCount;

    // Architectural curved highway lampposts
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 2.4, 8);
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x1b2030,
      roughness: 0.4,
      metalness: 0.85,
    });

    const armGeo = new THREE.BoxGeometry(0.5, 0.06, 0.06);
    const luminaireGeo = new THREE.BoxGeometry(0.24, 0.08, 0.16);
    const luminaireMat = new THREE.MeshBasicMaterial({ color: 0xd4eaff });

    for (let i = 0; i < lightCount; i++) {
      const z = -this.length / 2 + (i + 0.5) * spacing;

      for (const side of [-1, 1]) {
        const x = side * halfWidth;
        const postGroup = new THREE.Group();
        postGroup.position.set(x, 0, z);

        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 1.2;
        postGroup.add(pole);

        const arm = new THREE.Mesh(armGeo, poleMat);
        arm.position.set(-side * 0.22, 2.38, 0);
        postGroup.add(arm);

        const luminaire = new THREE.Mesh(luminaireGeo, luminaireMat);
        luminaire.position.set(-side * 0.42, 2.34, 0);
        postGroup.add(luminaire);

        this.group.add(postGroup);
      }
    }
  }

  private buildOverheadGantry(): void {
    // Overhead steel truss highway gantry span
    const gantry = new THREE.Group();
    const gantryHeight = 5.2;
    const spanWidth = this.roadWidth + 1.8;

    // Vertical side towers
    const towerGeo = new THREE.BoxGeometry(0.3, gantryHeight, 0.35);
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x151928,
      roughness: 0.5,
      metalness: 0.8,
    });

    const leftTower = new THREE.Mesh(towerGeo, towerMat);
    leftTower.position.set(-spanWidth / 2, gantryHeight / 2, 0);
    gantry.add(leftTower);

    const rightTower = new THREE.Mesh(towerGeo, towerMat);
    rightTower.position.set(spanWidth / 2, gantryHeight / 2, 0);
    gantry.add(rightTower);

    // Cross beam spanning across the 3 lanes
    const beamGeo = new THREE.BoxGeometry(spanWidth, 0.45, 0.4);
    const beam = new THREE.Mesh(beamGeo, towerMat);
    beam.position.set(0, gantryHeight - 0.2, 0);
    gantry.add(beam);

    // Digital Highway Signboard ("DLICOM METRO EXPRESS // SECTOR 07")
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 512;
    signCanvas.height = 128;
    const sCtx = signCanvas.getContext('2d')!;
    sCtx.fillStyle = '#080c18';
    sCtx.fillRect(0, 0, 512, 128);

    sCtx.strokeStyle = '#00f0ff';
    sCtx.lineWidth = 4;
    sCtx.strokeRect(6, 6, 500, 116);

    sCtx.fillStyle = '#00f0ff';
    sCtx.font = 'bold 36px sans-serif';
    sCtx.textAlign = 'center';
    sCtx.fillText('DLICOM METRO // SEC-07', 256, 54);

    sCtx.fillStyle = '#ffaa00';
    sCtx.font = '22px sans-serif';
    sCtx.fillText('SPEED ENFORCED  ▲  ALL LANES OPEN', 256, 96);

    const signTex = new THREE.CanvasTexture(signCanvas);
    const signGeo = new THREE.PlaneGeometry(spanWidth * 0.72, 1.1);
    const signMat = new THREE.MeshBasicMaterial({
      map: signTex,
      side: THREE.DoubleSide,
    });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0, gantryHeight - 0.75, 0.22);
    gantry.add(sign);

    this.group.add(gantry);
  }

  public setPositionZ(z: number): void {
    this.group.position.z = z;
  }

  public getPositionZ(): number {
    return this.group.position.z;
  }
}
