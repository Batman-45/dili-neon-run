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
  public readonly baseCameraPos = new THREE.Vector3(0, 4.2, 7.5);
  private cameraFollowX: number = 0;
  private currentBaseFov: number = 60;
  private shakeIntensity: number = 0;
  private shakeDuration: number = 0;
  private shakeTimer: number = 0;

  constructor(options: EngineOptions) {
    this.canvas = options.canvas;
    this.defaultFov = options.fov ?? 60;
    this.currentBaseFov = this.defaultFov;

    // 1. Scene with cyberpunk atmosphere
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060715);
    // Linear fog preserves crisp visibility for incoming obstacles up to 40m while smoothly blending horizon
    this.scene.fog = new THREE.Fog(0x060715, 40, 165);

    // 2. Perspective Camera (2.5D Over-the-shoulder runner view)
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(
      this.defaultFov,
      aspect,
      options.near ?? 0.1,
      options.far ?? 1000
    );

    // 3. WebGLRenderer with high-DPI and tone mapping
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
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.handleResize();
    this.setupLighting();
    this.initResizeListener();
  }

  private setupLighting(): void {
    // Ambient light - deep indigo with calibrated fill
    const ambient = new THREE.AmbientLight(0x22264c, 2.1);
    this.scene.add(ambient);

    // Key directional light - neon cyan from upper right
    const cyanKey = new THREE.DirectionalLight(0x00f0ff, 2.2);
    cyanKey.position.set(10, 20, 10);
    this.scene.add(cyanKey);

    // Rim directional light - hot magenta from upper left
    const magentaRim = new THREE.DirectionalLight(0xff007f, 2.0);
    magentaRim.position.set(-10, 15, -15);
    this.scene.add(magentaRim);

    // Under-track purple ground glow
    const groundGlow = new THREE.HemisphereLight(0x00f0ff, 0x9d00ff, 0.85);
    this.scene.add(groundGlow);
  }

  private handleResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;

    this.camera.aspect = aspect;

    // Responsive framing: Guarantee all 3 lanes are always visible on every viewport
    if (aspect < 1.0) {
      // Mobile Portrait (e.g. 390x844, 375x667):
      // Elevate and pull camera back slightly, and adjust vertical FOV to maintain horizontal coverage
      this.baseCameraPos.set(0, 5.0, 9.2);
      const targetHFovRad = (56 * Math.PI) / 180;
      const vFovRad = 2 * Math.atan(Math.tan(targetHFovRad / 2) / aspect);
      this.currentBaseFov = Math.min(Math.max((vFovRad * 180) / Math.PI, 68), 84);
    } else if (aspect < 1.4) {
      // Tablet / Near-square viewports (4:3, 5:4)
      this.baseCameraPos.set(0, 4.5, 8.2);
      this.currentBaseFov = 64;
    } else {
      // Desktop / Mobile Landscape (16:9, 19.5:9, 21:9)
      this.baseCameraPos.set(0, 4.2, 7.5);
      this.currentBaseFov = this.defaultFov;
    }

    this.camera.fov = this.currentBaseFov;
    this.camera.position.y = this.baseCameraPos.y;
    this.camera.position.z = this.baseCameraPos.z;
    this.camera.lookAt(0, 1.4, -18);
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
    this.camera.lookAt(this.cameraFollowX * 0.45, 1.4, -18);
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    this.resizeObserver?.disconnect();
    this.renderer.dispose();
  }
}
