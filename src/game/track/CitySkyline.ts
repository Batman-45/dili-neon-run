import * as THREE from 'three';

interface BuildingData {
  mesh: THREE.Group;
  initialX: number;
}

/**
 * CitySkyline — Immersive cyber-metropolis environment for Dili: Neon Run.
 * Layered Depth Architecture:
 * - LOWER DECK: Deep urban abyss at Y = -18m with lower transit light streams
 * - MIDGROUND: Corporate monoliths with architectural mullions, lit offices & rooftop spires
 * - HOLOGRAPHIC BILLBOARDS: Large Dlicom media screens mounted on building facades
 * - DISTANT SKYLINE: Atmospheric mega-towers and suspension bridges fading into deep twilight
 * - TRANSIT ARCS: Cross-city sky-bridges and monorail tubes connecting distant districts
 */
export class CitySkyline {
  public readonly group: THREE.Group;
  private buildings: BuildingData[] = [];
  private lowerCityDeck1!: THREE.Mesh;
  private lowerCityDeck2!: THREE.Mesh;
  private deckLength: number = 320;
  private horizonMesh!: THREE.Mesh;
  private billboardMaterials: THREE.MeshBasicMaterial[] = [];
  private timeAccumulator: number = 0;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.buildAtmosphericHorizon();
    this.buildLowerCityDecks();
    this.buildSkyscrapers();
    this.buildSkyBridges();
  }

  private buildAtmosphericHorizon(): void {
    // Cinematic horizon gradient backdrop
    const horizonGeo = new THREE.PlaneGeometry(500, 120);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Cosmic indigo to deep atmospheric haze gradient
    const grad = ctx.createLinearGradient(0, 256, 0, 0);
    grad.addColorStop(0, 'rgba(16, 12, 38, 0.95)');
    grad.addColorStop(0.25, 'rgba(10, 14, 32, 0.85)');
    grad.addColorStop(0.65, 'rgba(7, 9, 24, 0.95)');
    grad.addColorStop(1, '#070918');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
    });
    this.horizonMesh = new THREE.Mesh(horizonGeo, mat);
    this.horizonMesh.position.set(0, 45, -290);
    this.group.add(this.horizonMesh);
  }

  private static sharedLowerDeckTexture: THREE.CanvasTexture | null = null;

  private static getLowerDeckTexture(): THREE.CanvasTexture {
    if (!CitySkyline.sharedLowerDeckTexture) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;

      // Deep city floor dark slate
      ctx.fillStyle = '#060814';
      ctx.fillRect(0, 0, 512, 512);

      // Distant city street grid lines
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 512; i += 64) {
        ctx.beginPath();
        ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
      }

      // Lower transit traffic light streams
      ctx.strokeStyle = 'rgba(255, 170, 0, 0.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(120, 0); ctx.lineTo(120, 512);
      ctx.moveTo(380, 0); ctx.lineTo(380, 512);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
      ctx.beginPath();
      ctx.moveTo(0, 200); ctx.lineTo(512, 200);
      ctx.stroke();

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(8, 8);
      tex.colorSpace = THREE.SRGBColorSpace;
      CitySkyline.sharedLowerDeckTexture = tex;
    }
    return CitySkyline.sharedLowerDeckTexture;
  }

  private buildLowerCityDecks(): void {
    const geo = new THREE.PlaneGeometry(420, this.deckLength);
    const mat = new THREE.MeshStandardMaterial({
      map: CitySkyline.getLowerDeckTexture(),
      roughness: 0.7,
      metalness: 0.4,
    });

    this.lowerCityDeck1 = new THREE.Mesh(geo, mat);
    this.lowerCityDeck1.rotation.x = -Math.PI / 2;
    this.lowerCityDeck1.position.set(0, -18, 0);
    this.group.add(this.lowerCityDeck1);

    this.lowerCityDeck2 = new THREE.Mesh(geo, mat);
    this.lowerCityDeck2.rotation.x = -Math.PI / 2;
    this.lowerCityDeck2.position.set(0, -18, -this.deckLength);
    this.group.add(this.lowerCityDeck2);
  }

  private static sharedFacadeTexture: THREE.CanvasTexture | null = null;

  private static getFacadeTexture(): THREE.CanvasTexture {
    if (!CitySkyline.sharedFacadeTexture) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;

      // Deep titanium curtain-wall facade
      ctx.fillStyle = '#080a18';
      ctx.fillRect(0, 0, 256, 512);

      // Vertical structural mullions
      ctx.strokeStyle = '#12162a';
      ctx.lineWidth = 3;
      for (let x = 0; x < 256; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
      }

      // Horizontal floor slabs
      ctx.strokeStyle = '#101424';
      ctx.lineWidth = 2;
      for (let y = 0; y < 512; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
      }

      // Lit office windows (architectural warm amber, daylight cyan & soft white)
      const windowPalettes = ['#ffcc00', '#d4e6ff', '#00f0ff', '#ffffff', '#ff9900'];
      for (let y = 4; y < 508; y += 20) {
        for (let x = 4; x < 250; x += 16) {
          // 40% chance of lit office window
          if (Math.random() < 0.4) {
            const col = windowPalettes[Math.floor(Math.random() * windowPalettes.length)];
            ctx.fillStyle = col;
            ctx.fillRect(x, y, 9, 12);
          } else {
            // Dark window pane
            ctx.fillStyle = '#0c1022';
            ctx.fillRect(x, y, 9, 12);
          }
        }
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(2, 4);
      tex.colorSpace = THREE.SRGBColorSpace;
      CitySkyline.sharedFacadeTexture = tex;
    }
    return CitySkyline.sharedFacadeTexture;
  }

  private createBillboardTexture(title: string, subtitle: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#050814';
    ctx.fillRect(0, 0, 512, 256);

    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 492, 236);

    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 58px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, 256, 110);

    ctx.fillStyle = '#ff007f';
    ctx.font = '28px sans-serif';
    ctx.fillText(subtitle, 256, 175);

    // Subtle scanline overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    for (let y = 0; y < 256; y += 4) {
      ctx.fillRect(0, y, 512, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private static sharedBuildingMaterial: THREE.MeshStandardMaterial | null = null;
  private static sharedSpireMaterial: THREE.MeshStandardMaterial | null = null;
  private static sharedBeaconMaterial: THREE.MeshBasicMaterial | null = null;
  private static sharedBeaconGeometry: THREE.SphereGeometry | null = null;

  private static getBuildingMaterial(): THREE.MeshStandardMaterial {
    if (!CitySkyline.sharedBuildingMaterial) {
      CitySkyline.sharedBuildingMaterial = new THREE.MeshStandardMaterial({
        map: CitySkyline.getFacadeTexture(),
        roughness: 0.45,
        metalness: 0.65,
        color: 0xdddddd,
      });
    }
    return CitySkyline.sharedBuildingMaterial;
  }

  private static getSpireMaterial(): THREE.MeshStandardMaterial {
    if (!CitySkyline.sharedSpireMaterial) {
      CitySkyline.sharedSpireMaterial = new THREE.MeshStandardMaterial({
        color: 0x222638,
        roughness: 0.3,
        metalness: 0.9,
      });
    }
    return CitySkyline.sharedSpireMaterial;
  }

  private static getBeaconMaterial(): THREE.MeshBasicMaterial {
    if (!CitySkyline.sharedBeaconMaterial) {
      CitySkyline.sharedBeaconMaterial = new THREE.MeshBasicMaterial({ color: 0xff0044 });
    }
    return CitySkyline.sharedBeaconMaterial;
  }

  private static getBeaconGeometry(): THREE.SphereGeometry {
    if (!CitySkyline.sharedBeaconGeometry) {
      CitySkyline.sharedBeaconGeometry = new THREE.SphereGeometry(0.25, 8, 8);
    }
    return CitySkyline.sharedBeaconGeometry;
  }

  private buildSkyscrapers(): void {
    const buildingCount = 32;
    const depths = [-280, 20];
    const zSpan = depths[1] - depths[0];

    const billboardData = [
      { title: 'DLICOM', sub: 'NEON RUN // SEC-07' },
      { title: 'CYBER-CORE', sub: 'DATA HIGHWAY ACTIVE' },
      { title: 'HYPERNET', sub: 'QUANTUM LINK ONLINE' },
      { title: 'SECTOR 07', sub: 'DLICOM METROPOLIS' },
    ];

    for (let i = 0; i < buildingCount; i++) {
      const bGroup = new THREE.Group();

      const width = 8 + Math.random() * 10;
      const depth = 9 + Math.random() * 12;
      const height = 28 + Math.random() * 54;

      // Building main body
      const geo = new THREE.BoxGeometry(width, height, depth);
      const body = new THREE.Mesh(geo, CitySkyline.getBuildingMaterial());
      body.position.y = height / 2 - 18; // base grounded at lower deck Y = -18
      bGroup.add(body);

      // Rooftop architectural crown / communications spire
      const spireH = 8 + Math.random() * 14;
      const spireGeo = new THREE.CylinderGeometry(0.12, 0.4, spireH, 6);
      const spire = new THREE.Mesh(spireGeo, CitySkyline.getSpireMaterial());
      spire.position.set(0, height - 18 + spireH / 2, 0);
      bGroup.add(spire);

      // Aircraft warning beacon at spire tip
      const beacon = new THREE.Mesh(CitySkyline.getBeaconGeometry(), CitySkyline.getBeaconMaterial());
      beacon.position.set(0, height - 18 + spireH, 0);
      bGroup.add(beacon);

      // Select high-rises get high-visibility holographic Dlicom media billboards
      if (i % 5 === 0) {
        const bInfo = billboardData[(i / 5) % billboardData.length];
        const bbTex = this.createBillboardTexture(bInfo.title, bInfo.sub);
        const bbMat = new THREE.MeshBasicMaterial({
          map: bbTex,
          side: THREE.DoubleSide,
        });
        this.billboardMaterials.push(bbMat);

        const bbGeo = new THREE.PlaneGeometry(width * 0.85, (width * 0.85) * 0.5);
        const billboard = new THREE.Mesh(bbGeo, bbMat);
        billboard.position.set(0, height * 0.7 - 18, depth / 2 + 0.15);
        bGroup.add(billboard);
      }

      // Position buildings on left or right flanks outside the 8.4m highway
      const isLeft = i % 2 === 0;
      const xDistance = 14 + Math.random() * 32;
      const posX = isLeft ? -xDistance : xDistance;
      const posZ = depths[0] + (i / buildingCount) * zSpan + (Math.random() - 0.5) * 15;

      bGroup.position.set(posX, 0, posZ);
      this.group.add(bGroup);
      this.buildings.push({ mesh: bGroup, initialX: posX });
    }
  }

  private buildSkyBridges(): void {
    // Distant elevated sky-bridges crossing high above between skyscrapers
    const bridgeCount = 3;
    for (let b = 0; b < bridgeCount; b++) {
      const zPos = -90 - b * 75;
      const yPos = 18 + b * 6;

      const bridgeGeo = new THREE.BoxGeometry(120, 1.4, 3.5);
      const bridgeMat = new THREE.MeshStandardMaterial({
        color: 0x111626,
        roughness: 0.6,
        metalness: 0.8,
      });
      const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
      bridge.position.set(0, yPos, zPos);
      this.group.add(bridge);

      // Glass illuminated tube interior
      const tubeGeo = new THREE.BoxGeometry(120, 0.6, 2.2);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.35,
      });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      tube.position.set(0, yPos + 0.6, zPos);
      this.group.add(tube);
    }
  }

  public update(delta: number, roadSpeed: number): void {
    this.timeAccumulator += delta;

    // Parallax scrolling for lower city decks (moves slower than road for deep scale)
    const deckMove = roadSpeed * delta * 0.75;
    this.lowerCityDeck1.position.z += deckMove;
    this.lowerCityDeck2.position.z += deckMove;

    if (this.lowerCityDeck1.position.z > this.deckLength) {
      this.lowerCityDeck1.position.z = this.lowerCityDeck2.position.z - this.deckLength;
    }
    if (this.lowerCityDeck2.position.z > this.deckLength) {
      this.lowerCityDeck2.position.z = this.lowerCityDeck1.position.z - this.deckLength;
    }

    // Scroll city buildings along Z with parallax
    const buildingMove = roadSpeed * delta * 0.85;
    for (const b of this.buildings) {
      b.mesh.position.z += buildingMove;
      if (b.mesh.position.z > 35) {
        b.mesh.position.z -= 300;
      }
    }
  }
}
