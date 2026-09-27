import * as THREE from 'three';
import gsap from 'gsap';

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  fov?: number;
  near?: number;
  far?: number;
}

export class Engine {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer;
  private readonly canvas: HTMLCanvasElement;
  private resizeObserver: ResizeObserver | null = null;
  private defaultFov: number;

  // Camera Shake, Follow & Base Position
  public readonly baseCameraPos = new THREE.Vector3(0, 3.4, 6.6);
  private cameraFollowX: number = 0;
  private currentBaseFov: number = 56;
  private shakeIntensity: number = 0;
  private shakeDuration: number = 0;
  private shakeTimer: number = 0;

  constructor(options: EngineOptions) {
    this.canvas = options.canvas;
    this.defaultFov = options.fov ?? 56;
    this.currentBaseFov = this.defaultFov;

    // 1. Scene with atmospheric cyber-metropolis depth
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070918);
    // Linear fog preserves crisp visibility for obstacles up to 50m while softly blending the skyline
    this.scene.fog = new THREE.Fog(0x070918, 35, 185);

    // 2. Perspective Camera (Heroic 3rd-person runner framing)
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(
      this.defaultFov,
      aspect,
      options.near ?? 0.1,
      options.far ?? 1000
    );

    // 3. WebGLRenderer with high-DPI, soft shadow mapping, and ACES tone mapping
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
      depth: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.handleResize();
    this.setupLighting();
    this.initResizeListener();
  }

  private setupLighting(): void {
    // 1. Natural ambient fill - dark indigo twilight
    const ambient = new THREE.AmbientLight(0x1a203e, 1.4);
    this.scene.add(ambient);

    // 2. Primary directional key light (cool daylight fill from upper-forward right)
    // Illuminates physical asphalt grain, obstacle bevels, and character depth
    const keyLight = new THREE.DirectionalLight(0xd4e2ff, 1.85);
    keyLight.position.set(12, 22, 14);
    this.scene.add(keyLight);

    // 3. Atmospheric hemisphere bounce (cool sky, warm city ground bounce)
    const hemiLight = new THREE.HemisphereLight(0x223055, 0x140e26, 1.05);
    this.scene.add(hemiLight);

    // 4. Subtle cyber rim directional light (separates obstacles & character from distant fog)
    const rimLight = new THREE.DirectionalLight(0x00f0ff, 1.1);
    rimLight.position.set(-14, 12, -18);
    this.scene.add(rimLight);
  }

  private handleResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;

    this.camera.aspect = aspect;

    // Responsive framing: Dili occupies 18–22% of viewport height on all devices
    if (aspect < 1.0) {
      // Mobile Portrait (e.g. 390x844, 412x915)
      this.baseCameraPos.set(0, 3.5, 6.5);
      this.currentBaseFov = 64;
    } else if (aspect < 1.4) {
      // Tablet / Square viewports
      this.baseCameraPos.set(0, 3.45, 6.6);
      this.currentBaseFov = 59;
    } else {
      // Desktop / Landscape (16:9, 1366x768, 1920x1080)
      this.baseCameraPos.set(0, 3.4, 6.6);
      this.currentBaseFov = this.defaultFov;
    }

    this.camera.fov = this.currentBaseFov;
    this.camera.position.set(this.baseCameraPos.x, this.baseCameraPos.y, this.baseCameraPos.z);
    this.camera.lookAt(0, 1.35, -22);
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height, false);
  }

  private initResizeListener(): void {
    window.addEventListener('resize', () => this.handleResize());

    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(document.body);
    }
  }

  public kickFov(targetFov: number, duration: number): void {
    gsap.killTweensOf(this.camera);
    const boostedFov = Math.max(targetFov, this.currentBaseFov + 10);
    gsap.to(this.camera, {
      fov: boostedFov,
      duration: 0.15,
      ease: 'power2.out',
      onUpdate: () => this.camera.updateProjectionMatrix(),
      onComplete: () => {
        gsap.to(this.camera, {
          fov: this.currentBaseFov,
          duration: Math.max(duration - 0.15, 0.25),
          ease: 'power2.inOut',
          onUpdate: () => this.camera.updateProjectionMatrix(),
        });
      },
    });
  }

  public shake(intensity: number, duration: number): void {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeTimer = duration;
  }

  public update(delta: number, playerX: number = 0): void {
    const isPortrait = this.camera.aspect < 1.0;
    // Smooth subtle camera X-follow keeps Dili beautifully framed in left & right lanes
    const followRatio = isPortrait ? 0.32 : 0.16;
    const targetCameraX = this.baseCameraPos.x + playerX * followRatio;
    this.cameraFollowX = THREE.MathUtils.damp(this.cameraFollowX, targetCameraX, 9, delta);

    if (this.shakeTimer > 0) {
      this.shakeTimer -= delta;
      const progress = Math.max(0, this.shakeTimer / this.shakeDuration);
      const currentIntensity = this.shakeIntensity * progress;
      this.camera.position.x = this.cameraFollowX + (Math.random() - 0.5) * currentIntensity;
      this.camera.position.y = this.baseCameraPos.y + (Math.random() - 0.5) * currentIntensity;
    } else {
      this.camera.position.x = this.cameraFollowX;
      this.camera.position.y = this.baseCameraPos.y;
    }
    this.camera.position.z = this.baseCameraPos.z;
    this.camera.lookAt(this.cameraFollowX * 0.35, 1.35, -22);
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    this.resizeObserver?.disconnect();
    this.renderer.dispose();
  }
}
