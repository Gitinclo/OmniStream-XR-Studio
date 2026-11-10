import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as xb from 'xrblocks';
import { hardwareGovernor } from '../services/hardwareGovernor';

// Module-scope pre-allocated scratch math objects (Zero GC in render loop)
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();

export const isSoftwareGl = (() => {
  if (typeof document === 'undefined') return false;
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
})();

// Procedural Web Audio Synthesizer for Game Feel & UI Feedback
class StudioAudioSynth {
  private ctx: AudioContext | null = null;
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playTone(freq: number, durationMs: number, type: OscillatorType = 'sine', gainVal = 0.12) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.35, ctx.currentTime + durationMs / 1000);
    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  }

  playImpact() {
    this.playTone(110, 140, 'sawtooth', 0.18);
  }

  playCollect() {
    this.playTone(520, 90, 'triangle', 0.14);
  }

  playBoost() {
    this.playTone(340, 120, 'sine', 0.15);
  }
}

export const studioSynth = new StudioAudioSynth();

export type GameStateMode = 'TITLE' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'GAMEOVER';

export interface GameHudSnapshot {
  state: GameStateMode;
  score: number;
  bandwidthGbps: number;
  health: number;
  wave: number;
  muted: boolean;
}

function createProceduralGridTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 508, 508);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 12);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class SpatialStudioScript extends xb.Script {
  public heroRigGroup = new THREE.Group();
  private rigParts: THREE.Object3D[] = [];
  private cdnInstancedMesh?: THREE.InstancedMesh;
  private proteinGroup = new THREE.Group();
  private hazardMeshes: Array<{ mesh: THREE.Mesh; vx: number; vz: number; windup: number }> = [];
  private packetOrb?: THREE.Mesh;

  private clock = new THREE.Clock();
  private explodedTarget = 0;
  private explodedCurrent = 0;
  private finishColorHex = 0x38bdf8;
  private cameraPresetIndex = 0;

  // Game loop & input state
  public gameState: GameStateMode = 'TITLE';
  public score = 0;
  public bandwidthGbps = 32.0;
  public health = 100;
  public wave = 1;
  public gmOverrideActive = false;
  private hitstopTimer = 0;
  private shakeIntensity = 0;
  private playerPos = new THREE.Vector3(0, 0.9, -1.8);

  private heldKeys = new Set<string>();
  private justPressedKeys = new Set<string>();
  private uiValidated = false;
  private statusTextNode?: any;

  private onHudUpdate?: (snapshot: GameHudSnapshot) => void;

  constructor(onHudUpdate?: (snapshot: GameHudSnapshot) => void) {
    super();
    this.onHudUpdate = onHudUpdate;
  }

  init() {
    // 1. Configure Renderer PBR & Studio Environment
    const rawRenderer = xb.core?.renderer;
    const renderer =
      rawRenderer instanceof THREE.WebGLRenderer ? rawRenderer : undefined;
    const scene = xb.core?.scene;
    if (renderer) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      renderer.shadowMap.enabled = !isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      if (scene) {
        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        scene.environment = pmremGenerator.fromScene(
          new RoomEnvironment(),
          0.04
        ).texture;
        pmremGenerator.dispose();
        scene.fog = new THREE.FogExp2(0x070b14, 0.045);
      }
    }

    // 2. Balanced Warm/Cool Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e1b4b, 1.4);
    this.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1e6, 2.6);
    keyLight.position.set(4, 7, 3);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.camera.left = -5;
    keyLight.shadow.camera.right = 5;
    keyLight.shadow.camera.top = 5;
    keyLight.shadow.camera.bottom = -5;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    this.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.5);
    rimLight.position.set(-4, 4, -5);
    this.add(rimLight);

    // 3. Ground Plane with Procedural Anisotropic Grid Texture
    const maxAniso = renderer ? renderer.capabilities.getMaxAnisotropy() : 4;
    const floorGeo = new THREE.PlaneGeometry(36, 36);
    const floorMat = new THREE.MeshStandardMaterial({
      map: createProceduralGridTexture(maxAniso),
      roughness: 0.75,
      metalness: 0.2,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = 0;
    floorMesh.receiveShadow = !isSoftwareGl;
    this.add(floorMesh);

    // 4. Composite 8-Part Procedural Hero Model: OmniStream 32K Broadcast Rig
    this.buildCompositeBroadcastRig();

    // 5. InstancedMesh (>20 repeated orbital CDN relay nodes)
    this.buildInstancedCdnNodes();

    // 6. Interactive Game Props (Packet Orb + Hazard Telegraphs)
    this.buildGameEntities();

    // 7. 3D Molecular Backbone Preview Group (for Bioscience mode)
    this.buildMolecularPreview('P04637');
    this.proteinGroup.visible = false;
    this.add(this.proteinGroup);

    // 8. XR Blocks Spatial UI Card in World Space
    this.buildSpatialUiCard();

    // 9. Keyboard Input Listeners with Window Blur Safety
    this.setupKeyboardListeners();
  }

  private buildCompositeBroadcastRig() {
    this.heroRigGroup.position.set(0, 0.9, -1.8);

    // Part 1: Primary Silhouette — Beveled ExtrudeGeometry Core Chassis
    const shape = new THREE.Shape();
    shape.moveTo(-0.22, -0.12);
    shape.lineTo(0.22, -0.12);
    shape.lineTo(0.28, 0.0);
    shape.lineTo(0.22, 0.12);
    shape.lineTo(-0.22, 0.12);
    shape.lineTo(-0.28, 0.0);
    shape.closePath();

    const chassisGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.28,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.025,
      bevelThickness: 0.025,
    });
    chassisGeo.center();
    const chassisMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      metalness: 0.92,
      roughness: 0.18,
      clearcoat: 0.8,
    });
    const chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
    chassisMesh.castShadow = !isSoftwareGl;
    this.heroRigGroup.add(chassisMesh);
    this.rigParts.push(chassisMesh);

    // Part 2: Secondary Read — LatheGeometry 32K Parabolic Dish
    const lathePoints = [
      new THREE.Vector2(0.01, 0),
      new THREE.Vector2(0.08, 0.03),
      new THREE.Vector2(0.16, 0.09),
      new THREE.Vector2(0.21, 0.16),
    ];
    const dishGeo = new THREE.LatheGeometry(lathePoints, 28);
    const dishMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.65,
      roughness: 0.45,
      side: THREE.DoubleSide,
    });
    const dishMesh = new THREE.Mesh(dishGeo, dishMat);
    dishMesh.position.set(0, 0.22, 0);
    this.heroRigGroup.add(dishMesh);
    this.rigParts.push(dishMesh);

    // Part 3: Secondary Read — TubeGeometry Cryo-Cooling Torus Conduit
    const curve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(-0.32, 0, -0.15),
        new THREE.Vector3(0, 0.14, -0.25),
        new THREE.Vector3(0.32, 0, -0.15),
        new THREE.Vector3(0, -0.14, 0.22),
      ],
      true
    );
    const tubeGeo = new THREE.TubeGeometry(curve, 36, 0.022, 12, true);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.95,
      roughness: 0.15,
    });
    const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
    this.heroRigGroup.add(tubeMesh);
    this.rigParts.push(tubeMesh);

    // Part 4 & 5: Dual Gimbal Stabilizer Arms
    const armGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.42, 16);
    const armMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.7,
      roughness: 0.48,
    });
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.rotation.z = Math.PI / 2;
    leftArm.position.set(-0.34, 0, 0);
    this.heroRigGroup.add(leftArm);
    this.rigParts.push(leftArm);

    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.rotation.z = Math.PI / 2;
    rightArm.position.set(0.34, 0, 0);
    this.heroRigGroup.add(rightArm);
    this.rigParts.push(rightArm);

    // Part 6: Accent Detail — 32K Optical Camera Lens Assembly
    const lensGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.14, 24);
    const lensMat = new THREE.MeshPhysicalMaterial({
      color: 0x0ea5e9,
      metalness: 0.15,
      roughness: 0.1,
      transmission: isSoftwareGl ? 0 : 0.85,
      transparent: true,
      opacity: isSoftwareGl ? 0.65 : 1,
      ior: 1.6,
    });
    const lensMesh = new THREE.Mesh(lensGeo, lensMat);
    lensMesh.rotation.x = Math.PI / 2;
    lensMesh.position.set(0, 0, 0.22);
    this.heroRigGroup.add(lensMesh);
    this.rigParts.push(lensMesh);

    // Part 7: Accent Detail — Rear Thruster Nozzles
    const thrusterGeo = new THREE.ConeGeometry(0.06, 0.14, 16);
    const thrusterMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.8,
      roughness: 0.35,
    });
    const thrusterMesh = new THREE.Mesh(thrusterGeo, thrusterMat);
    thrusterMesh.rotation.x = -Math.PI / 2;
    thrusterMesh.position.set(0, 0, -0.24);
    this.heroRigGroup.add(thrusterMesh);
    this.rigParts.push(thrusterMesh);

    // Part 8: Soft Radial Contact Shadow Disc Flush on Ground
    const shadowGeo = new THREE.PlaneGeometry(1.4, 1.4);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: createContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.45,
    });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(0, -0.88, 0);
    this.heroRigGroup.add(shadowPlane);

    this.add(this.heroRigGroup);
  }

  private buildInstancedCdnNodes() {
    const count = 36;
    const geo = new THREE.OctahedronGeometry(0.075, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.85,
      roughness: 0.22,
    });
    this.cdnInstancedMesh = new THREE.InstancedMesh(geo, mat, count);

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 3.2 + (i % 3) * 0.55;
      const y = 0.35 + (i % 4) * 0.45;
      _vec3A.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius - 1.5);
      _quat.identity();
      const scaleFactor = 0.85 + (i % 5) * 0.07;
      _scale.set(scaleFactor, scaleFactor, scaleFactor);
      _mat4.compose(_vec3A, _quat, _scale);
      this.cdnInstancedMesh.setMatrixAt(i, _mat4);

      _color.setHSL(0.54 + (i % 6) * 0.03, 0.85, 0.58);
      this.cdnInstancedMesh.setColorAt(i, _color);
    }
    this.cdnInstancedMesh.instanceMatrix.needsUpdate = true;
    if (this.cdnInstancedMesh.instanceColor) {
      this.cdnInstancedMesh.instanceColor.needsUpdate = true;
    }
    this.cdnInstancedMesh.computeBoundingSphere();
    this.add(this.cdnInstancedMesh);
  }

  private buildGameEntities() {
    const orbGeo = new THREE.IcosahedronGeometry(0.14, 2);
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.6,
      roughness: 0.15,
      metalness: 0.8,
    });
    this.packetOrb = new THREE.Mesh(orbGeo, orbMat);
    this.packetOrb.position.set(1.2, 0.9, -2.2);
    this.add(this.packetOrb);

    // 4 Network Congestion Hazards with Windup Telegraphs
    const hazGeo = new THREE.DodecahedronGeometry(0.16, 0);
    for (let i = 0; i < 4; i++) {
      const hazMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0x991b1b,
        emissiveIntensity: 0.4,
        roughness: 0.3,
        metalness: 0.7,
      });
      const mesh = new THREE.Mesh(hazGeo, hazMat);
      const angle = (i / 4) * Math.PI * 2;
      mesh.position.set(Math.cos(angle) * 2.0, 0.9, -1.8 + Math.sin(angle) * 1.4);
      this.add(mesh);
      this.hazardMeshes.push({
        mesh,
        vx: (i % 2 === 0 ? 1 : -1) * (0.9 + i * 0.15),
        vz: (i < 2 ? 1 : -1) * 0.75,
        windup: i * 0.8,
      });
    }
  }

  public buildMolecularPreview(accession: string) {
    while (this.proteinGroup.children.length > 0) {
      this.proteinGroup.remove(this.proteinGroup.children[0]);
    }
    this.proteinGroup.position.set(0, 1.15, -1.8);

    // Canonical AlphaFold 4-band pLDDT palette
    const plddtColors = [0x0053d6, 0x65cbf3, 0xffdb13, 0xff7d45];
    const seed = accession.charCodeAt(0) + accession.charCodeAt(accession.length - 1);
    const points: THREE.Vector3[] = [];
    const residueCount = 36;

    for (let i = 0; i < residueCount; i++) {
      const t = i * 0.42;
      const r = 0.28 + 0.12 * Math.sin(i * 0.3 + seed);
      const x = Math.cos(t) * r;
      const y = (i - residueCount / 2) * 0.025;
      const z = Math.sin(t) * r;
      points.push(new THREE.Vector3(x, y, z));

      const bandIdx = i < 20 ? 0 : i < 28 ? 1 : i < 33 ? 2 : 3;
      const atomGeo = new THREE.SphereGeometry(0.038, 16, 16);
      const atomMat = new THREE.MeshStandardMaterial({
        color: plddtColors[bandIdx],
        roughness: 0.25,
        metalness: 0.3,
      });
      const atomMesh = new THREE.Mesh(atomGeo, atomMat);
      atomMesh.position.set(x, y, z);
      this.proteinGroup.add(atomMesh);
    }

    const backboneCurve = new THREE.CatmullRomCurve3(points);
    const backboneGeo = new THREE.TubeGeometry(backboneCurve, 72, 0.016, 8, false);
    const backboneMat = new THREE.MeshStandardMaterial({
      color: 0x0053d6,
      roughness: 0.35,
      metalness: 0.4,
    });
    this.proteinGroup.add(new THREE.Mesh(backboneGeo, backboneMat));
  }

  private buildSpatialUiCard() {
    try {
      const xbAny = xb as Record<string, any>;
      if (!xbAny.UICard || !xbAny.UIPanel || !xbAny.UIText || !xbAny.UIButton) {
        return;
      }
      const card = new xbAny.UICard({
        size: { width: 1.1, height: 'auto' },
      });
      card.position.set(0, 1.55, -2.1);

      const panel = new xbAny.UIPanel({
        flexDirection: 'column',
        gap: 8,
        padding: 14,
      });

      const title = new xbAny.UIText({
        text: 'OMNISTREAM 32K SPATIAL DECK',
        fontSize: 20,
      });
      this.statusTextNode = new xbAny.UIText({
        text: 'Mode: 32K Broadcast Rig · Pinch or Use Dock to Control',
        fontSize: 14,
      });

      const btn = new xbAny.UIButton({
        text: 'Cycle Finish Color',
        onClick: () => {
          this.cycleFinishColor();
        },
      });

      panel.add(title);
      panel.add(this.statusTextNode);
      panel.add(btn);
      card.add(panel);
      this.add(card);
    } catch {
      // Fallback gracefully if XR UI runtime is initializing
    }
  }

  private setupKeyboardListeners() {
    window.addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const code = e.code;
      if (!this.heldKeys.has(code)) {
        this.justPressedKeys.add(code);
      }
      this.heldKeys.add(code);

      if (code === 'Escape' && (this.gameState === 'PLAYING' || this.gameState === 'PAUSED')) {
        this.gameState = this.gameState === 'PLAYING' ? 'PAUSED' : 'PLAYING';
        this.emitHud();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.heldKeys.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.heldKeys.clear();
      this.justPressedKeys.clear();
    });
  }

  public setExplodedView(amount: number) {
    this.explodedTarget = THREE.MathUtils.clamp(amount, 0, 1);
  }

  public cycleFinishColor() {
    const palette = [0x38bdf8, 0xf59e0b, 0x10b981, 0xa855f7];
    this.finishColorHex =
      palette[(palette.indexOf(this.finishColorHex) + 1) % palette.length];
    this.rigParts.forEach((part, idx) => {
      if (idx === 1 && (part as THREE.Mesh).material) {
        ((part as THREE.Mesh).material as THREE.MeshStandardMaterial).color.setHex(
          this.finishColorHex
        );
      }
    });
    studioSynth.playCollect();
  }

  public cycleCameraPreset() {
    this.cameraPresetIndex = (this.cameraPresetIndex + 1) % 3;
    studioSynth.playBoost();
  }

  public setScienceMode(enabled: boolean, accession = 'P04637') {
    this.proteinGroup.visible = enabled;
    this.heroRigGroup.visible = !enabled;
    if (enabled) {
      this.buildMolecularPreview(accession);
    }
  }

  public applyHardwareRenderScale(scaleFactor: number) {
    const rawRenderer = xb.core?.renderer;
    if (rawRenderer instanceof THREE.WebGLRenderer && typeof window !== 'undefined') {
      const baseDpr = Math.min(window.devicePixelRatio || 1, 2);
      rawRenderer.setPixelRatio(Math.max(0.5, baseDpr * scaleFactor));
    }
  }

  public startGame() {
    this.gameState = 'PLAYING';
    this.score = 0;
    this.bandwidthGbps = 32.0;
    this.health = 100;
    this.wave = 1;
    this.playerPos.set(0, 0.9, -1.8);
    this.heroRigGroup.position.copy(this.playerPos);
    studioSynth.playBoost();
    this.emitHud();
  }

  public togglePauseGame() {
    if (this.gameState === 'PLAYING') {
      this.gameState = 'PAUSED';
    } else if (this.gameState === 'PAUSED') {
      this.gameState = 'PLAYING';
    }
    this.emitHud();
  }

  // Game Master (GM) Live Control Deck Overrides
  public gmBoostBandwidth(amountGbps = 32.0) {
    this.bandwidthGbps = Math.min(256.0, this.bandwidthGbps + amountGbps);
    studioSynth.playBoost();
    this.emitHud();
  }

  public gmRestoreIntegrity() {
    this.health = 100;
    if (this.gameState === 'GAMEOVER') {
      this.gameState = 'PLAYING';
    }
    studioSynth.playCollect();
    this.emitHud();
  }

  public gmAddScore(bonus = 2500) {
    this.score += bonus;
    this.wave = Math.max(this.wave, 1 + Math.floor(this.score / 300));
    studioSynth.playCollect();
    this.emitHud();
  }

  public gmAdvanceWave() {
    this.wave += 1;
    this.score += 300;
    studioSynth.playBoost();
    this.emitHud();
  }

  public gmForceVictory() {
    this.score = Math.max(this.score, 10000);
    this.bandwidthGbps = Math.max(this.bandwidthGbps, 128.0);
    this.health = 100;
    this.gameState = 'VICTORY';
    studioSynth.playCollect();
    this.emitHud();
  }

  public gmToggleOverride(): boolean {
    this.gmOverrideActive = !this.gmOverrideActive;
    if (this.gmOverrideActive) {
      this.health = 100;
      this.bandwidthGbps = Math.max(64.0, this.bandwidthGbps);
    }
    studioSynth.playBoost();
    this.emitHud();
    return this.gmOverrideActive;
  }

  private emitHud() {
    if (this.onHudUpdate) {
      this.onHudUpdate({
        state: this.gameState,
        score: this.score,
        bandwidthGbps: Number(this.bandwidthGbps.toFixed(1)),
        health: this.health,
        wave: this.wave,
        muted: studioSynth.muted,
      });
    }
  }

  update() {
    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);
    if (rawDt > 0.001 && rawDt < 0.25) {
      hardwareGovernor.recordFrameTimeMs(rawDt * 1000);
    }

    if (!this.uiValidated) {
      this.uiValidated = true;
      try {
        (xb as Record<string, any>).ui?.validate?.();
      } catch {
        // Ignore if UI validation is not required on this frame
      }
    }

    // Smooth exponential damping for exploded-view separation
    const dampFactor = 1 - Math.exp(-8 * dt);
    this.explodedCurrent = THREE.MathUtils.lerp(
      this.explodedCurrent,
      this.explodedTarget,
      dampFactor
    );

    // Apply exploded offset to composite rig parts
    this.rigParts.forEach((part, idx) => {
      if (idx === 1) part.position.y = 0.22 + this.explodedCurrent * 0.28;
      if (idx === 3) part.position.x = -0.34 - this.explodedCurrent * 0.25;
      if (idx === 4) part.position.x = 0.34 + this.explodedCurrent * 0.25;
      if (idx === 5) part.position.z = 0.22 + this.explodedCurrent * 0.3;
      if (idx === 6) part.position.z = -0.24 - this.explodedCurrent * 0.3;
    });

    if (this.proteinGroup.visible) {
      this.proteinGroup.rotation.y += dt * 0.45;
    }

    // Hitstop simulation pause on heavy impacts
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return;
    }

    if (this.gameState === 'PLAYING') {
      const moveSpeed = 2.4;
      if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) {
        this.playerPos.z -= moveSpeed * dt;
      }
      if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) {
        this.playerPos.z += moveSpeed * dt;
      }
      if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) {
        this.playerPos.x -= moveSpeed * dt;
      }
      if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) {
        this.playerPos.x += moveSpeed * dt;
      }

      // Edge-triggered Space pulse boost
      if (this.justPressedKeys.has('Space')) {
        studioSynth.playBoost();
        this.heroRigGroup.scale.set(1.22, 0.82, 1.22); // Squash and stretch
        this.bandwidthGbps = Math.min(64, this.bandwidthGbps + 2.5);
      }

      this.playerPos.x = THREE.MathUtils.clamp(this.playerPos.x, -2.4, 2.4);
      this.playerPos.z = THREE.MathUtils.clamp(this.playerPos.z, -3.4, -0.8);

      this.heroRigGroup.position.lerp(this.playerPos, dampFactor);
      // Recover squash-and-stretch
      _vec3B.set(1, 1, 1);
      this.heroRigGroup.scale.lerp(_vec3B, dampFactor);

      // Packet Orb Collection
      if (this.packetOrb) {
        this.packetOrb.rotation.y += dt * 2.2;
        if (this.heroRigGroup.position.distanceTo(this.packetOrb.position) < 0.48) {
          this.score += 100;
          this.bandwidthGbps += 4.0;
          this.wave = 1 + Math.floor(this.score / 300);
          studioSynth.playCollect();
          const angle = Math.random() * Math.PI * 2;
          this.packetOrb.position.set(
            Math.cos(angle) * 1.8,
            0.9,
            -1.8 + Math.sin(angle) * 1.2
          );
          if (this.score >= 1000) {
            this.gameState = 'VICTORY';
          }
          this.emitHud();
        }
      }

      // Update Enemy Hazards with Windup Telegraph
      const speedMult = 1 + (this.wave - 1) * 0.18;
      for (const haz of this.hazardMeshes) {
        haz.windup += dt * 3;
        const pulseScale = 1 + 0.18 * Math.sin(haz.windup);
        haz.mesh.scale.setScalar(pulseScale);
        haz.mesh.position.x += haz.vx * speedMult * dt;
        haz.mesh.position.z += haz.vz * speedMult * dt;

        if (Math.abs(haz.mesh.position.x) > 2.5) haz.vx *= -1;
        if (haz.mesh.position.z < -3.4 || haz.mesh.position.z > -0.8) haz.vz *= -1;

        if (this.heroRigGroup.position.distanceTo(haz.mesh.position) < 0.42) {
          if (this.gmOverrideActive) {
            // GM Invulnerability deflects congestion hazard and awards bonus score
            this.score += 250;
            haz.mesh.position.x *= -1;
            studioSynth.playCollect();
            this.emitHud();
          } else {
            this.health = Math.max(0, this.health - 25);
            this.bandwidthGbps = Math.max(8, this.bandwidthGbps - 6);
            this.hitstopTimer = 0.055; // 55ms hitstop
            this.shakeIntensity = 0.08;
            studioSynth.playImpact();
            haz.mesh.position.x *= -1;
            if (this.health <= 0) {
              this.gameState = 'GAMEOVER';
            }
            this.emitHud();
          }
        }
      }
    } else {
      // Idle atmospheric rotation
      this.heroRigGroup.rotation.y += dt * 0.35;
    }

    // Decaying camera shake feel
    if (this.shakeIntensity > 0.001) {
      this.heroRigGroup.position.x += (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity *= Math.exp(-12 * dt);
    }

    this.justPressedKeys.clear();
  }

  onSelectEnd(_event: xb.SelectEvent) {
    this.cycleFinishColor();
  }
}
