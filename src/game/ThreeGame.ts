import * as THREE from "three";
import type { GameAudio } from "./audio";
import {
  buildEnvironment,
  createTank,
  createTarget,
  createTextSprite,
  loadHorizon,
  terrainHeight,
  type TankRig,
  type TargetVisual,
} from "./assets";
import { LETTERS, ZONES, type Question, type Zone } from "../data/questions";

export type Telemetry = {
  turret: number;
  elevation: number;
  speed: number;
  camera: string;
};

export type GameCallbacks = {
  audio: GameAudio;
  onTargetHit: (letter: string) => void;
  onMiss: () => void;
  onEnemyFire: () => void;
  onAimChange: (letter: string | null) => void;
  onTelemetry: (data: Telemetry) => void;
  onCameraMode: (mode: string) => void;
};

type TargetState = {
  letter: string;
  visual: TargetVisual;
  base: THREE.Vector3;
  phase: number;
  hit: boolean;
  marked: boolean;
  shake: number;
  recoil: number;
  destroyIn: number | null;
};

type Shot = {
  group: THREE.Group;
  direction: THREE.Vector3;
  speed: number;
  life: number;
};

type Effect = {
  update: (dt: number) => boolean;
  dispose: () => void;
};

type CameraMode = "CHASE" | "TACTICAL" | "GUNNER";

const CAMERA_PRESETS: Record<CameraMode, { distance: number; height: number; fov: number }> = {
  CHASE: { distance: 16, height: 6.4, fov: 58 },
  TACTICAL: { distance: 25, height: 13, fov: 62 },
  GUNNER: { distance: 9, height: 4.6, fov: 48 },
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function disposeHierarchy(object: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => materials.add(m));
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => {
    const withMap = m as THREE.MeshStandardMaterial & { map?: THREE.Texture; alphaMap?: THREE.Texture };
    withMap.map?.dispose();
    withMap.alphaMap?.dispose();
    m.dispose();
  });
}

export class ThreeGame {
  private container: HTMLElement;
  private callbacks: GameCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private frame = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver | null = null;

  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private fill: THREE.DirectionalLight;
  private horizon: THREE.Texture;
  private environment: THREE.Group | null = null;
  private envZoneId = 0;
  private tank: TankRig;
  private dust: THREE.Points;

  private targets: TargetState[] = [];
  private hitboxes: THREE.Mesh[] = [];
  private correctLetter = "A";
  private aimedLetter: string | null = null;
  private answerLocked = false;
  private pendingResult: { letter: string; delay: number; sent: boolean } | null = null;
  private enemyReturn: { letter: string; delay: number; fired: boolean } | null = null;

  private shots: Shot[] = [];
  private effects: Effect[] = [];
  private shotRay = new THREE.Raycaster();
  private aimRay = new THREE.Raycaster();
  private center = new THREE.Vector2(0, 0);
  private keys = new Set<string>();
  private joystick = { x: 0, y: 0 };
  private active = false;
  private cinematic = false;
  private introTime = 0;
  private introSmokeTimer = 0;

  private hullYaw = 0;
  private targetAimYaw = 0;
  private currentAimYaw = 0;
  private targetAimPitch = 0.08;
  private currentAimPitch = 0.08;
  private recoil = 0;
  private cameraShake = 0;
  private fireCooldown = 0;
  private lastSpeed = 0;
  private elapsed = 0;
  private telemetryTimer = 0;
  private cameraMode: CameraMode = "CHASE";
  private cameraDistance = CAMERA_PRESETS.CHASE.distance;
  private cameraHeight = CAMERA_PRESETS.CHASE.height;
  private activeLookPointer: number | null = null;
  private lastPointer = { x: 0, y: 0 };

  constructor(container: HTMLElement, callbacks: GameCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setSize(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.touchAction = "none";
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.horizon = loadHorizon();
    this.scene.background = this.horizon;
    this.scene.fog = new THREE.FogExp2(ZONES[0].fog, 0.0035);

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 500);
    this.camera.position.set(0, 8, 26);

    this.hemi = new THREE.HemisphereLight(0xcfe4ff, 0x6d5f3c, 1.65);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffe4b5, 2.7);
    this.sun.position.set(-45, 65, 35);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(window.innerWidth < 800 ? 1024 : 2048, window.innerWidth < 800 ? 1024 : 2048);
    this.sun.shadow.camera.left = -75;
    this.sun.shadow.camera.right = 75;
    this.sun.shadow.camera.top = 75;
    this.sun.shadow.camera.bottom = -75;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 180;
    this.sun.shadow.bias = -0.0006;
    this.scene.add(this.sun);
    this.fill = new THREE.DirectionalLight(0x8fb8d7, 0.55);
    this.fill.position.set(35, 25, -45);
    this.scene.add(this.fill);

    this.setZone(ZONES[0]);
    this.tank = createTank();
    this.tank.root.position.set(0, terrainHeight(0, 8) + 0.08, 8);
    this.scene.add(this.tank.root);
    this.dust = this.createDust();
    this.scene.add(this.dust);

    this.bindEvents();
    this.resize();
    this.animate();
  }

  private createDust() {
    const count = 260;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 120;
      positions[i * 3 + 1] = 0.5 + Math.random() * 18;
      positions[i * 3 + 2] = -100 + Math.random() * 125;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xe2cda0,
      size: 0.14,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      sizeAttenuation: true,
    });
    return new THREE.Points(geometry, material);
  }

  private setZone(zone: Zone) {
    this.scene.background = this.horizon;
    this.scene.fog = new THREE.FogExp2(zone.fog, zone.id === 3 ? 0.0042 : 0.0035);
    this.hemi.color.setHex(zone.sky);
    this.sun.color.setHex(zone.id === 4 ? 0xffc07a : zone.id === 3 ? 0xdce4e5 : 0xffe4b5);
    if (this.envZoneId === zone.id && this.environment) return;
    if (this.environment) {
      this.scene.remove(this.environment);
      disposeHierarchy(this.environment);
    }
    const built = buildEnvironment(zone);
    this.environment = built.group;
    this.groundTexture = built.groundTexture;
    this.scene.add(this.environment);
    this.envZoneId = zone.id;
  }

  private groundTexture: THREE.CanvasTexture | null = null;

  private bindEvents() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    canvas.addEventListener("contextmenu", this.preventContext);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
  }

  private preventContext = (event: Event) => event.preventDefault();

  private onKeyDown = (event: KeyboardEvent) => {
    if (!this.active || this.answerLocked) return;
    const key = event.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
    this.keys.add(key);
    if ((key === " " || key === "enter") && !event.repeat) this.fire();
    if (key === "q") this.targetAimYaw = clamp(this.targetAimYaw + 0.09, -0.7, 0.7);
    if (key === "e") this.targetAimYaw = clamp(this.targetAimYaw - 0.09, -0.7, 0.7);
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.key.toLowerCase());
  };

  private onBlur = () => {
    this.keys.clear();
    this.joystick = { x: 0, y: 0 };
  };

  private onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse") {
      if (event.button === 0) {
        this.setAimFromScreen(event.offsetX, event.offsetY, this.container.clientWidth, this.container.clientHeight);
        this.fire();
      }
      return;
    }
    if (event.clientX > window.innerWidth * 0.32) {
      this.activeLookPointer = event.pointerId;
      this.lastPointer = { x: event.clientX, y: event.clientY };
      this.renderer.domElement.setPointerCapture(event.pointerId);
    }
  };

  private onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === "mouse") {
      this.setAimFromScreen(event.offsetX, event.offsetY, this.container.clientWidth, this.container.clientHeight);
      return;
    }
    if (this.activeLookPointer === event.pointerId) {
      const dx = event.clientX - this.lastPointer.x;
      const dy = event.clientY - this.lastPointer.y;
      this.lastPointer = { x: event.clientX, y: event.clientY };
      this.applyLookDelta(dx, dy);
    }
  };

  private onPointerUp = (event: PointerEvent) => {
    if (this.activeLookPointer === event.pointerId) {
      this.activeLookPointer = null;
      try { this.renderer.domElement.releasePointerCapture(event.pointerId); } catch { /* ignored */ }
    }
  };

  private onWheel = (event: WheelEvent) => {
    event.preventDefault();
    this.cameraDistance = clamp(this.cameraDistance + event.deltaY * 0.012, 8, 30);
  };

  setAimFromScreen(x: number, y: number, width: number, height: number) {
    if (!this.active || this.answerLocked || this.cinematic) return;
    const nx = x / Math.max(1, width);
    const ny = y / Math.max(1, height);
    this.targetAimYaw = clamp(-(nx - 0.5) * 1.5, -0.7, 0.7);
    this.targetAimPitch = clamp(0.08 - (ny - 0.5) * 0.25, -0.025, 0.18);
  }

  applyLookDelta(dx: number, dy: number) {
    if (!this.active || this.answerLocked || this.cinematic) return;
    this.targetAimYaw = clamp(this.targetAimYaw - dx * 0.004, -0.7, 0.7);
    this.targetAimPitch = clamp(this.targetAimPitch - dy * 0.0024, -0.025, 0.18);
  }

  setJoystick(x: number, y: number) {
    this.joystick.x = clamp(x, -1, 1);
    this.joystick.y = clamp(y, -1, 1);
  }

  setActive(active: boolean) {
    this.active = active;
    if (!active) {
      this.joystick = { x: 0, y: 0 };
      this.keys.clear();
    }
  }

  playIntro() {
    this.clearTargets();
    this.clearEffects();
    this.setZone(ZONES[0]);
    this.active = false;
    this.cinematic = true;
    this.introTime = 0;
    this.introSmokeTimer = 0;
    this.answerLocked = false;
    this.pendingResult = null;
    this.hullYaw = 0;
    this.tank.root.position.set(0, terrainHeight(0, 8) + 0.08, 8);
    this.tank.hull.rotation.set(0, 0, 0);
    this.cameraMode = "CHASE";
    this.cameraDistance = CAMERA_PRESETS.CHASE.distance;
    this.cameraHeight = CAMERA_PRESETS.CHASE.height;
    this.camera.position.set(-38, 26, 48);
    this.callbacks.audio.start();
    this.callbacks.audio.setEngine(0.55);
    this.callbacks.onCameraMode(this.cameraMode);
  }

  startQuestion(index: number, question: Question, zone: Zone) {
    this.cinematic = false;
    this.setZone(zone);
    this.clearTargets();
    this.clearEffects();
    this.correctLetter = LETTERS[question.answer];
    this.answerLocked = false;
    this.pendingResult = null;
    this.aimedLetter = null;
    this.callbacks.onAimChange(null);
    this.fireCooldown = 0;
    this.recoil = 0;
    this.cameraShake = 0;
    this.hullYaw = 0;
    this.targetAimYaw = 0;
    this.currentAimYaw = 0;
    this.targetAimPitch = 0.08;
    this.currentAimPitch = 0.08;
    this.tank.root.position.set(0, terrainHeight(0, 8) + 0.08, 8);
    this.tank.hull.rotation.set(0, 0, 0);

    // Four hostile tanks, each carrying one oversized answer board.
    const positions = [
      { x: -27, z: -43 },
      { x: -9, z: -48 },
      { x: 9, z: -44 },
      { x: 27, z: -49 },
    ];
    question.options.forEach((option, i) => {
      const letter = LETTERS[i];
      const visual = createTarget(letter, option);
      const p = positions[i];
      const base = new THREE.Vector3(p.x, terrainHeight(p.x, p.z) + 7.25, p.z);
      visual.group.position.copy(base);
      visual.group.rotation.y = Math.atan2(this.tank.root.position.x - p.x, this.tank.root.position.z - p.z);
      this.scene.add(visual.group);
      this.targets.push({ letter, visual, base, phase: i * 1.7 + index * 0.43, hit: false, marked: false, shake: 0, recoil: 0, destroyIn: null });
      this.hitboxes.push(...visual.hitboxes);
    });
    this.active = true;
  }

  private clearTargets() {
    for (const target of this.targets) {
      this.scene.remove(target.visual.group);
      target.visual.texture.dispose();
      disposeHierarchy(target.visual.group);
    }
    this.targets = [];
    this.hitboxes = [];
    this.aimedLetter = null;
  }

  private clearEffects() {
    this.effects.forEach((e) => e.dispose());
    this.effects = [];
    for (const shot of this.shots) {
      this.scene.remove(shot.group);
      disposeHierarchy(shot.group);
    }
    this.shots = [];
    this.pendingResult = null;
    this.enemyReturn = null;
  }

  cycleCamera() {
    const modes: CameraMode[] = ["CHASE", "TACTICAL", "GUNNER"];
    this.cameraMode = modes[(modes.indexOf(this.cameraMode) + 1) % modes.length];
    const preset = CAMERA_PRESETS[this.cameraMode];
    this.cameraDistance = preset.distance;
    this.cameraHeight = preset.height;
    this.callbacks.onCameraMode(this.cameraMode);
    return this.cameraMode;
  }

  fire(): boolean {
    if (!this.active || this.answerLocked || this.cinematic || this.fireCooldown > 0 || this.disposed) return false;
    this.fireCooldown = 0.62;
    this.recoil = 0.65;
    this.cameraShake = 0.32;
    // Commit the newest aim input before the ballistic ray is calculated.
    this.currentAimYaw = this.targetAimYaw;
    this.currentAimPitch = this.targetAimPitch;
    this.tank.turret.rotation.y = this.currentAimYaw - this.hullYaw;
    this.tank.barrelPivot.rotation.x = this.currentAimPitch;
    this.scene.updateMatrixWorld(true);
    this.updateCamera(0.35);
    this.camera.updateMatrixWorld(true);

    const muzzlePos = this.tank.muzzle.getWorldPosition(new THREE.Vector3());
    this.aimRay.setFromCamera(this.center, this.camera);
    const intersections = this.hitboxes.length ? this.aimRay.intersectObjects(this.hitboxes, false) : [];
    let aimPoint: THREE.Vector3;
    if (intersections.length) {
      aimPoint = intersections[0].point.clone();
    } else {
      const cameraDir = this.camera.getWorldDirection(new THREE.Vector3());
      aimPoint = this.camera.position.clone().addScaledVector(cameraDir, 135);
    }
    const direction = aimPoint.sub(muzzlePos).normalize();
    if (!Number.isFinite(direction.x)) return false;

    this.callbacks.audio.fire();
    this.spawnMuzzle(muzzlePos, direction);

    const group = new THREE.Group();
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), coreMat);
    group.add(core);
    const trailMat = new THREE.MeshBasicMaterial({ color: 0xff9a28, transparent: true, opacity: 0.8 });
    const trail = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.14, 1.8, 8), trailMat);
    trail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone());
    trail.position.addScaledVector(direction, -0.9);
    group.add(trail);
    const light = new THREE.PointLight(0xff9a3c, 4, 12, 2);
    group.add(light);
    group.position.copy(muzzlePos);
    this.scene.add(group);
    this.shots.push({ group, direction, speed: 155, life: 1.05 });
    return true;
  }

  private spawnMuzzle(position: THREE.Vector3, direction: THREE.Vector3) {
    const flashPos = position.clone().addScaledVector(direction, 0.5);
    this.spawnBurst(flashPos, 0xffc45a, 24, 0.22, 5, 0.28, 0, 0x000000);
    for (let i = 0; i < 5; i++) this.spawnSmoke(flashPos, 0.55, 0.22, direction, 1.3);
    const geometry = new THREE.SphereGeometry(0.48, 12, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(flashPos);
    const light = new THREE.PointLight(0xffb44a, 14, 26, 2);
    light.position.copy(flashPos);
    this.scene.add(mesh, light);
    let life = 0.11;
    this.effects.push({
      update: (dt) => {
        life -= dt;
        mesh.scale.setScalar(1 + (0.11 - life) * 18);
        material.opacity = Math.max(0, life / 0.11);
        light.intensity = Math.max(0, (life / 0.11) * 14);
        return life > 0;
      },
      dispose: () => { this.scene.remove(mesh, light); geometry.dispose(); material.dispose(); },
    });
  }

  private spawnBurst(
    origin: THREE.Vector3,
    color: number,
    count: number,
    size: number,
    speed: number,
    life: number,
    gravity: number,
    secondaryColor = 0x000000
  ) {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const c1 = new THREE.Color(color);
    const c2 = new THREE.Color(secondaryColor === 0x000000 ? color : secondaryColor);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = origin.x + (Math.random() - 0.5) * 0.35;
      positions[i * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.35;
      positions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.35;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const s = speed * (0.35 + Math.random() * 0.85);
      velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * s;
      velocities[i * 3 + 1] = Math.cos(phi) * s * 0.75 + speed * 0.18;
      velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * s;
      const c = Math.random() > 0.5 ? c1 : c2;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geometry, material);
    this.scene.add(points);
    let remaining = life;
    this.effects.push({
      update: (dt) => {
        remaining -= dt;
        for (let i = 0; i < count; i++) {
          velocities[i * 3 + 1] -= gravity * dt;
          positions[i * 3] += velocities[i * 3] * dt;
          positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
          positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
        }
        (geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        material.opacity = Math.max(0, remaining / life) * 0.95;
        return remaining > 0;
      },
      dispose: () => { this.scene.remove(points); geometry.dispose(); material.dispose(); },
    });
  }

  private spawnSmoke(origin: THREE.Vector3, size: number, opacity: number, direction?: THREE.Vector3, rise = 1) {
    const geometry = new THREE.SphereGeometry(1, 8, 6);
    const material = new THREE.MeshBasicMaterial({ color: 0x5a574b, transparent: true, opacity, depthWrite: false });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(origin);
    mesh.position.x += (Math.random() - 0.5) * 0.6;
    mesh.position.y += (Math.random() - 0.5) * 0.4;
    mesh.position.z += (Math.random() - 0.5) * 0.6;
    mesh.scale.setScalar(size);
    this.scene.add(mesh);
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 1.6 + (direction?.x ?? 0) * 2.4,
      rise * (0.7 + Math.random() * 1.2),
      (Math.random() - 0.5) * 1.6 + (direction?.z ?? 0) * 2.4
    );
    const life = 1.1 + Math.random() * 0.8;
    let remaining = life;
    this.effects.push({
      update: (dt) => {
        remaining -= dt;
        mesh.position.addScaledVector(velocity, dt);
        velocity.multiplyScalar(0.985);
        const progress = 1 - remaining / life;
        mesh.scale.setScalar(size * (1 + progress * 2.2));
        material.opacity = Math.max(0, opacity * (1 - progress));
        return remaining > 0;
      },
      dispose: () => { this.scene.remove(mesh); geometry.dispose(); material.dispose(); },
    });
  }

  private spawnFloatingText(position: THREE.Vector3, text: string, color: string) {
    const sprite = createTextSprite(text, color);
    sprite.position.copy(position);
    this.scene.add(sprite);
    const material = sprite.material as THREE.SpriteMaterial;
    const texture = material.map;
    let life = 2.4;
    this.effects.push({
      update: (dt) => {
        life -= dt;
        sprite.position.y += dt * 1.15;
        material.opacity = Math.min(1, Math.max(0, life / 0.6));
        return life > 0;
      },
      dispose: () => { this.scene.remove(sprite); texture?.dispose(); material.dispose(); },
    });
  }

  private spawnExplosion(position: THREE.Vector3) {
    this.spawnBurst(position, 0xffb12e, 75, 0.38, 17, 1.05, 9, 0xff5325);
    this.spawnBurst(position, 0x4a4337, 35, 0.65, 9, 1.4, 3, 0x211f1a);
    for (let i = 0; i < 14; i++) this.spawnSmoke(position, 0.75 + Math.random() * 0.8, 0.38, undefined, 1.7);
    const geometry = new THREE.SphereGeometry(1.2, 16, 10);
    const material = new THREE.MeshBasicMaterial({ color: 0xffd274, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
    const flash = new THREE.Mesh(geometry, material);
    flash.position.copy(position);
    const light = new THREE.PointLight(0xff8b2b, 22, 40, 2);
    light.position.copy(position);
    this.scene.add(flash, light);
    let life = 0.22;
    this.effects.push({
      update: (dt) => {
        life -= dt;
        const p = 1 - Math.max(0, life) / 0.22;
        flash.scale.setScalar(1 + p * 3.5);
        material.opacity = Math.max(0, 1 - p);
        light.intensity = Math.max(0, (1 - p) * 22);
        return life > 0;
      },
      dispose: () => { this.scene.remove(flash, light); geometry.dispose(); material.dispose(); },
    });
  }

  private spawnGroundImpact(position: THREE.Vector3) {
    this.spawnBurst(position, 0xb99a6c, 28, 0.32, 6, 0.75, 8, 0x6b5840);
    for (let i = 0; i < 5; i++) this.spawnSmoke(position, 0.6, 0.28, undefined, 1);
  }

  private spawnPlayerImpact(position: THREE.Vector3) {
    this.callbacks.audio.impact();
    this.cameraShake = 0.85;
    this.spawnExplosion(position);
    this.spawnFloatingText(position.clone().add(new THREE.Vector3(0, 4.2, 0)), "ARMOR HIT!", "#ff7358");
  }

  private launchReturnFire(letter: string) {
    const target = this.targets.find((t) => t.letter === letter);
    if (!target) return;
    this.scene.updateMatrixWorld(true);
    const start = target.visual.muzzle.getWorldPosition(new THREE.Vector3());
    const end = this.tank.root.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 1.75, 0));
    const direction = end.clone().sub(start).normalize();
    const distance = Math.max(1, start.distanceTo(end));

    target.recoil = 0.65;
    this.callbacks.audio.fire();
    this.spawnMuzzle(start, direction);
    this.spawnBurst(start, 0xff5335, 32, 0.3, 7, 0.35, 0, 0xffbe55);
    this.spawnFloatingText(start.clone().add(new THREE.Vector3(0, 2.6, 0)), "RETURN FIRE!", "#ff8b5e");

    const group = new THREE.Group();
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffb16a, blending: THREE.AdditiveBlending });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), coreMat);
    group.add(core);
    const trailMat = new THREE.MeshBasicMaterial({ color: 0xff3d26, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
    const trail = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.2, 2.6, 8), trailMat);
    trail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    trail.position.addScaledVector(direction, -1.3);
    group.add(trail);
    const light = new THREE.PointLight(0xff4a25, 7, 18, 2);
    group.add(light);
    group.position.copy(start);
    this.scene.add(group);

    const speed = 92;
    let traveled = 0;
    this.effects.push({
      update: (dt) => {
        traveled += speed * dt;
        const progress = Math.min(1, traveled / distance);
        group.position.lerpVectors(start, end, progress);
        light.intensity = 5 + Math.sin(this.elapsed * 45) * 2;
        if (progress >= 1) {
          this.spawnPlayerImpact(end);
          return false;
        }
        return true;
      },
      dispose: () => { this.scene.remove(group); disposeHierarchy(group); },
    });
    this.callbacks.onEnemyFire();
  }

  private registerHit(letter: string, point: THREE.Vector3) {
    if (this.answerLocked) return;
    this.answerLocked = true;
    this.aimedLetter = null;
    this.callbacks.onAimChange(null);
    const target = this.targets.find((t) => t.letter === letter);
    const isCorrect = letter === this.correctLetter;
    this.callbacks.audio.impact();
    if (isCorrect) {
      this.spawnExplosion(point);
      this.callbacks.audio.success();
    } else {
      this.spawnBurst(point, 0xffa23a, 38, 0.28, 9, 0.65, 8, 0xff4e25);
      for (let i = 0; i < 5; i++) this.spawnSmoke(point, 0.55, 0.3);
      this.callbacks.audio.wrong();
    }
    if (target) {
      target.hit = true;
      target.shake = 0.7;
      target.destroyIn = isCorrect ? 0.5 : null;
      this.spawnFloatingText(target.visual.group.position.clone().add(new THREE.Vector3(0, 5.6, 1)), isCorrect ? "CORRECT!" : "WRONG ANSWER!", isCorrect ? "#8dff9a" : "#ff6a4a");
    }
    // Reveal the key only after the shot has landed.
    for (const t of this.targets) {
      t.marked = true;
      const correct = t.letter === this.correctLetter;
      t.visual.frame.emissive.setHex(correct ? 0x2e9c3c : t.letter === letter ? 0x9e2f20 : 0x000000);
      t.visual.frame.emissiveIntensity = correct ? 0.9 : t.letter === letter ? 0.65 : 0;
      t.visual.board.material.emissive.setHex(correct ? 0x174b1e : t.letter === letter ? 0x40120b : 0x000000);
      t.visual.board.material.emissiveIntensity = correct ? 0.55 : t.letter === letter ? 0.4 : 0;
      t.visual.armor.emissive.setHex(correct ? 0x173d1b : t.letter === letter ? 0x6c1b10 : 0x000000);
      t.visual.armor.emissiveIntensity = correct ? 0.55 : t.letter === letter ? 0.65 : 0;
    }
    this.enemyReturn = isCorrect ? null : { letter, delay: 0.28, fired: false };
    this.pendingResult = { letter, delay: isCorrect ? 0.65 : 1.4, sent: false };
  }

  private removeShot(index: number) {
    const shot = this.shots[index];
    this.scene.remove(shot.group);
    disposeHierarchy(shot.group);
    this.shots.splice(index, 1);
  }

  private updateShots(dt: number) {
    if (!this.hitboxes.length) return;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const shot = this.shots[i];
      const previous = shot.group.position.clone();
      const travel = shot.speed * dt;
      shot.group.position.addScaledVector(shot.direction, travel);
      shot.life -= dt;
      this.shotRay.set(previous, shot.direction);
      this.shotRay.far = travel + 0.3;
      const hits = this.shotRay.intersectObjects(this.hitboxes, false);
      if (hits.length) {
        const letter = hits[0].object.userData.letter as string;
        this.registerHit(letter, hits[0].point.clone());
        this.removeShot(i);
        continue;
      }
      const p = shot.group.position;
      if (p.y <= terrainHeight(p.x, p.z) + 0.08 || shot.life <= 0 || p.z < -95 || p.y > 30) {
        const ground = new THREE.Vector3(p.x, terrainHeight(p.x, p.z) + 0.15, p.z);
        if (p.y <= terrainHeight(p.x, p.z) + 0.08 && shot.life > 0) this.spawnGroundImpact(ground);
        this.removeShot(i);
        if (!this.answerLocked) this.callbacks.onMiss();
      }
    }
  }

  private updateEffects(dt: number) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      if (!this.effects[i].update(dt)) {
        this.effects[i].dispose();
        this.effects.splice(i, 1);
      }
    }
  }

  private updateTank(dt: number) {
    const forwardInput = clamp(
      this.joystick.y + (this.keys.has("w") || this.keys.has("arrowup") ? 1 : 0) - (this.keys.has("s") || this.keys.has("arrowdown") ? 1 : 0),
      -1,
      1
    );
    const steerInput = clamp(
      this.joystick.x + (this.keys.has("d") || this.keys.has("arrowright") ? 1 : 0) - (this.keys.has("a") || this.keys.has("arrowleft") ? 1 : 0),
      -1,
      1
    );
    const canMove = this.active && !this.answerLocked && !this.cinematic;
    const throttle = canMove ? forwardInput : 0;
    const steering = canMove ? steerInput : 0;
    this.hullYaw -= steering * dt * 1.15;
    const forwardDir = new THREE.Vector3(-Math.sin(this.hullYaw), 0, -Math.cos(this.hullYaw));
    const movement = throttle * 9 * dt;
    this.tank.root.position.addScaledVector(forwardDir, movement);
    this.tank.root.position.x = clamp(this.tank.root.position.x, -24, 24);
    this.tank.root.position.z = clamp(this.tank.root.position.z, -14, 20);
    const ground = terrainHeight(this.tank.root.position.x, this.tank.root.position.z);
    this.tank.root.position.y = lerp(this.tank.root.position.y, ground + 0.08, 1 - Math.exp(-dt * 12));
    this.tank.root.rotation.y = 0;
    this.tank.hull.rotation.y = this.hullYaw;
    const slopeX = terrainHeight(this.tank.root.position.x + 1, this.tank.root.position.z) - terrainHeight(this.tank.root.position.x - 1, this.tank.root.position.z);
    const slopeZ = terrainHeight(this.tank.root.position.x, this.tank.root.position.z + 1) - terrainHeight(this.tank.root.position.x, this.tank.root.position.z - 1);
    this.tank.hull.rotation.x = lerp(this.tank.hull.rotation.x, slopeZ * 0.11 + Math.sin(this.elapsed * 12) * Math.abs(throttle) * 0.008, 0.12);
    this.tank.hull.rotation.z = lerp(this.tank.hull.rotation.z, -slopeX * 0.11 + Math.sin(this.elapsed * 8) * Math.abs(throttle) * 0.012, 0.12);

    this.currentAimYaw = lerp(this.currentAimYaw, this.targetAimYaw, 1 - Math.exp(-dt * 11));
    this.currentAimPitch = lerp(this.currentAimPitch, this.targetAimPitch, 1 - Math.exp(-dt * 11));
    this.tank.turret.rotation.y = this.currentAimYaw - this.hullYaw;
    this.tank.barrelPivot.rotation.x = this.currentAimPitch;
    this.recoil = Math.max(0, this.recoil - dt * 3.4);
    this.tank.recoil.position.z = this.recoil * 0.58;
    const wheelSpin = movement / 0.54;
    this.tank.wheelGroups.forEach((w) => { w.rotation.x -= wheelSpin; });
    this.tank.treadTexture.offset.y -= movement * 0.17;
    (this.tank.shadow.material as THREE.MeshBasicMaterial).opacity = 0.23 + Math.abs(throttle) * 0.04;
    this.lastSpeed = Math.abs(throttle);
    this.callbacks.audio.setEngine(this.cinematic ? 0.55 : 0.18 + this.lastSpeed * 0.65);
  }

  private updateTargets(dt: number) {
    const tankPos = this.tank.root.position;
    for (const target of this.targets) {
      const wobbleX = Math.sin(this.elapsed * 0.43 + target.phase) * 0.55;
      const wobbleY = Math.sin(this.elapsed * 0.7 + target.phase * 1.5) * 0.18;
      const wobbleZ = Math.cos(this.elapsed * 0.32 + target.phase) * 0.35;
      target.shake = Math.max(0, target.shake - dt * 1.8);
      const shakeX = target.shake ? Math.sin(this.elapsed * 70) * target.shake * 0.16 : 0;
      const shakeY = target.shake ? Math.cos(this.elapsed * 62) * target.shake * 0.09 : 0;
      target.visual.group.position.set(target.base.x + wobbleX + shakeX, target.base.y + wobbleY + shakeY, target.base.z + wobbleZ);
      const face = Math.atan2(tankPos.x - target.visual.group.position.x, tankPos.z - target.visual.group.position.z);
      target.visual.group.rotation.y = face + Math.sin(this.elapsed * 0.3 + target.phase) * 0.045;
      target.visual.group.rotation.z = target.shake ? Math.sin(this.elapsed * 55) * target.shake * 0.05 : 0;
      target.recoil = Math.max(0, target.recoil - dt * 2.8);
      target.visual.turret.position.z = -0.7 + target.recoil * 0.5;
      target.visual.turret.rotation.y = Math.sin(this.elapsed * 0.5 + target.phase) * 0.035;
      for (const wheel of target.visual.wheels) wheel.rotation.x -= dt * 0.65;
      target.visual.treadTexture.offset.y -= dt * 0.08;
      if (target.destroyIn !== null) {
        target.destroyIn -= dt;
        if (target.destroyIn <= 0 && target.visual.board.visible) {
          target.visual.board.visible = false;
          target.visual.turret.rotation.z = 0.22;
          target.visual.armor.color.setHex(0x252820);
          const wreck = target.visual.group.position.clone().add(new THREE.Vector3(0, -4.5, 0));
          for (let i = 0; i < 7; i++) this.spawnSmoke(wreck, 0.7, 0.34, undefined, 1.4);
          this.spawnBurst(wreck, 0xff8a2d, 34, 0.32, 9, 0.8, 8, 0x3b3329);
          target.destroyIn = null;
        }
      }
      if (!target.marked) {
        const locked = this.aimedLetter === target.letter && !this.answerLocked;
        target.visual.frame.emissive.setHex(locked ? 0x9b6a16 : 0x000000);
        target.visual.frame.emissiveIntensity = locked ? 0.55 : 0;
      }
    }
  }

  private updateAimIndicator() {
    if (!this.active || this.answerLocked || !this.hitboxes.length) {
      if (this.aimedLetter !== null) {
        this.aimedLetter = null;
        this.callbacks.onAimChange(null);
      }
      return;
    }
    this.aimRay.setFromCamera(this.center, this.camera);
    const hits = this.aimRay.intersectObjects(this.hitboxes, false);
    const letter = hits.length ? (hits[0].object.userData.letter as string) : null;
    if (letter !== this.aimedLetter) {
      this.aimedLetter = letter;
      this.callbacks.onAimChange(letter);
    }
  }

  private updateCamera(dt: number) {
    const preset = CAMERA_PRESETS[this.cameraMode];
    const horizontal = new THREE.Vector3(-Math.sin(this.currentAimYaw), 0, -Math.cos(this.currentAimYaw));
    const desired = this.tank.root.position.clone().addScaledVector(horizontal, -this.cameraDistance);
    desired.y += this.cameraHeight;
    const aimDir = new THREE.Vector3(
      -Math.sin(this.currentAimYaw) * Math.cos(this.currentAimPitch),
      Math.sin(this.currentAimPitch),
      -Math.cos(this.currentAimYaw) * Math.cos(this.currentAimPitch)
    );
    const muzzle = this.tank.muzzle.getWorldPosition(new THREE.Vector3());
    const focus = muzzle.addScaledVector(aimDir, 62);
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * 6));
    if (this.cameraShake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.cameraShake * 0.22;
      this.camera.position.y += (Math.random() - 0.5) * this.cameraShake * 0.18;
      this.cameraShake = Math.max(0, this.cameraShake - dt * 1.7);
    }
    this.camera.lookAt(focus);
    if (Math.abs(this.camera.fov - preset.fov) > 0.05) {
      this.camera.fov = lerp(this.camera.fov, preset.fov, 1 - Math.exp(-dt * 5));
      this.camera.updateProjectionMatrix();
    }
  }

  private updateIntro(dt: number) {
    this.introTime += dt;
    const t = clamp(this.introTime / 4.4, 0, 1);
    const eased = t * t * (3 - 2 * t);
    const start = new THREE.Vector3(-38, 26, 48);
    const end = new THREE.Vector3(0, 7.2, 24);
    this.camera.position.lerpVectors(start, end, eased);
    this.camera.position.y += Math.sin(eased * Math.PI) * 7;
    this.camera.position.x += Math.sin(this.introTime * 0.8) * 0.4;
    this.camera.lookAt(this.tank.root.position.clone().add(new THREE.Vector3(0, 2.3, -9)));
    this.targetAimYaw = Math.sin(this.introTime * 1.15) * 0.22 * (1 - t);
    this.targetAimPitch = 0.035 + Math.sin(this.introTime * 1.35) * 0.035 * (1 - t);
    this.introSmokeTimer -= dt;
    if (this.introSmokeTimer <= 0) {
      this.introSmokeTimer = 0.24;
      const exhaust = this.tank.root.localToWorld(new THREE.Vector3(-1.4, 1.6, 3.6));
      this.spawnSmoke(exhaust, 0.35, 0.22, undefined, 1.5);
    }
    this.currentAimYaw = lerp(this.currentAimYaw, this.targetAimYaw, 1 - Math.exp(-dt * 4));
    this.currentAimPitch = lerp(this.currentAimPitch, this.targetAimPitch, 1 - Math.exp(-dt * 4));
    this.tank.turret.rotation.y = this.currentAimYaw;
    this.tank.barrelPivot.rotation.x = this.currentAimPitch;
  }

  private updateDust(dt: number) {
    const attr = this.dust.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < attr.count; i++) {
      arr[i * 3 + 1] += dt * (0.25 + (i % 5) * 0.05);
      arr[i * 3] += Math.sin(this.elapsed * 0.25 + i) * dt * 0.08;
      if (arr[i * 3 + 1] > 19) arr[i * 3 + 1] = 0.4;
    }
    attr.needsUpdate = true;
  }

  private animate = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += dt;
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.updateTank(dt);
    this.updateTargets(dt);
    if (this.cinematic) this.updateIntro(dt);
    else this.updateCamera(dt);
    this.scene.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    this.updateShots(dt);
    if (this.enemyReturn && !this.enemyReturn.fired) {
      this.enemyReturn.delay -= dt;
      if (this.enemyReturn.delay <= 0) {
        this.enemyReturn.fired = true;
        this.launchReturnFire(this.enemyReturn.letter);
      }
    }
    this.updateEffects(dt);
    this.updateDust(dt);
    this.updateAimIndicator();
    if (this.pendingResult) {
      this.pendingResult.delay -= dt;
      if (this.pendingResult.delay <= 0 && !this.pendingResult.sent) {
        this.pendingResult.sent = true;
        const letter = this.pendingResult.letter;
        this.callbacks.onTargetHit(letter);
      }
    }
    this.telemetryTimer -= dt;
    if (this.telemetryTimer <= 0) {
      this.telemetryTimer = 0.15;
      this.callbacks.onTelemetry({
        turret: Math.round((-this.currentAimYaw * 180) / Math.PI),
        elevation: Math.round((this.currentAimPitch * 180) / Math.PI),
        speed: Math.round(this.lastSpeed * 32),
        camera: this.cameraMode,
      });
    }
    this.renderer.render(this.scene, this.camera);
  };

  private resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.onPointerUp);
    canvas.removeEventListener("wheel", this.onWheel);
    canvas.removeEventListener("contextmenu", this.preventContext);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.resizeObserver?.disconnect();
    this.clearTargets();
    this.clearEffects();
    if (this.environment) disposeHierarchy(this.environment);
    disposeHierarchy(this.tank.root);
    this.dust.geometry.dispose();
    (this.dust.material as THREE.Material).dispose();
    this.horizon.dispose();
    this.groundTexture?.dispose();
    this.renderer.dispose();
    canvas.remove();
  }
}
