import * as THREE from "three";
import { ALL_TOOLS, DISTRICTS, ROOMS, STORY_GREETING } from "./game-data";

export type GameLocation = "surface" | "lizard" | "room";
export type SpawnNpcSpecies = "human" | "robot" | "alien";
export type CreationAbility = "none" | "pilot" | "defend" | "companion" | "gravity";
export type PlacedDreamcore = {
  id: string;
  mesh: THREE.Group;
  sphereMesh: THREE.Group;
  particles: THREE.Points;
  hitbox: Hitbox;
  creationId: string;
  creationMesh: THREE.Group | null;
  creationHitbox: Hitbox | null;
  coreMesh: THREE.Group | null;
  coreHitbox: Hitbox | null;
  prompt: string;
  ability: CreationAbility;
  building: boolean;
  buildProgress: number;
  piloted: boolean;
};
export type SoundEffect =
  | "pulse" | "grapple" | "portal" | "shrink" | "grow" | "pylon" | "saber" | "saberHit" | "beacon" | "collect" | "npc" | "elevator"
  | "dialogue" | "save" | "ui" | "jump" | "land" | "selfShrink" | "mechGun" | "mechEnter" | "mechExit" | "fly"
  | "unlock" | "defeat" | "respawn" | "chat";
export type InteractionKind = "elevator" | "chrono" | "district" | "exit" | "artifact" | "mech";
export type Interactable = {
  kind: InteractionKind;
  id: string;
  label: string;
  position: THREE.Vector3;
  range: number;
};

type EngineCallbacks = {
  onTick: (state: { x: number; y: number; z: number; heading: number; pitch: number; scale: number; grounded: boolean; flying: boolean; piloting: boolean; colliderCount: number; nearest: Interactable | null; targetCount: number; location: GameLocation; roomIndex: number; fps: number }) => void;
  onToast: (message: string) => void;
  onTargets: (count: number) => void;
  onArtifact: (index: number) => void;
  onWeapon: (message: string) => void;
  onSound: (effect: SoundEffect) => void;
  onOpenDreamcore: (id: string) => void;
  onOpenAbilityCore: (id: string) => void;
  canMove: () => boolean;
};

type Target = { mesh: THREE.Mesh; id: string; active: boolean };
type AnimationMode = "spin" | "bob" | "orbit" | "swing" | "pulse" | "rise" | "patrol";
type AnimatedProp = {
  object: THREE.Object3D;
  baseX?: number;
  baseY: number;
  baseZ?: number;
  radius?: number;
  minY?: number;
  maxY?: number;
  speed: number;
  phase: number;
  mode?: AnimationMode;
};
type Walker = { actor: THREE.Group; from: THREE.Vector3; to: THREE.Vector3; speed: number; elapsed: number; phase: number };
type CharacterParts = {
  root: THREE.Group;
  head: THREE.Mesh;
  hair: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
};
type NpcTarget = {
  actor: THREE.Group;
  id: string;
  name: string;
  species: SpawnNpcSpecies;
  scale: number;
  normalScale: number;
  walker?: Walker;
  parts?: CharacterParts;
  home: THREE.Vector3;
  hitbox?: Hitbox;
  defeated: boolean;
  dissolved: boolean;
  defeatedAt: number;
  respawnAt: number;
};
type MechTarget = { actor: THREE.Group; id: string; phase: number };
type HitboxOwner = "player" | "npc" | "target" | "artifact" | "interactable" | "mech" | "weapon" | "prop" | "projectile" | "terrain";
type HitboxShape = "cylinder" | "box";
type Hitbox = {
  id: string;
  owner: HitboxOwner;
  objectId: string;
  shape: HitboxShape;
  center: THREE.Vector3;
  radius: number;
  halfDepth: number;
  minY: number;
  maxY: number;
  solid: boolean;
  standable?: boolean;
  disabled?: boolean;
  dynamic?: () => THREE.Vector3;
};
type HitboxHit = { hitbox: Hitbox; point: THREE.Vector3; distance: number };
type ProjectileIntent = {
  toolId: string;
  npcId?: string;
  targetId?: string;
  mechId?: string;
  artifactId?: string;
  hitPoint: THREE.Vector3;
  direction: THREE.Vector3;
};
type Projectile = {
  id: string;
  mesh: THREE.Group;
  hitboxId: string;
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  speed: number;
  life: number;
  maxLife: number;
  intent: ProjectileIntent;
  resolved: boolean;
};

const BASE_GREETING = STORY_GREETING;
const TOWN_POSITION = new THREE.Vector3(0, 0, 0);
const SURFACE_START = new THREE.Vector3(1.5, 0, 0.5);
const SURFACE_ELEVATOR = new THREE.Vector3(-3.5, 0, -5.4);
const HUB_CHRONO = new THREE.Vector3(0, 0, -6.5);
const ROOM_ENTRY = new THREE.Vector3(0, 0, 8.2);
const MERCATOR_LIMIT = 85.05112878;
const PLAYER_EYE_HEIGHT = 1.67;
const PLAYER_BODY_HEIGHT = 1.9;
const PLAYER_RADIUS = 0.42;
const POCKET_SCALE = 0.36;
const SELF_SHRINK_PITCH = -70 * Math.PI / 180;
const JUMP_SPEED = 8.6;
const JUMP_BUFFER_SECONDS = 0.14;
const COYOTE_SECONDS = 0.11;
const GIANT_SCALE = 2.2;
const SIZE_LADDER = [POCKET_SCALE, 1, GIANT_SCALE];
const MECH_SCALE = 1.28;
const PILOT_EYE_HEIGHT = 3.45;
const PILOT_BODY_HEIGHT = 4.6;
const PILOT_RADIUS = 1.18;
const FLY_VERTICAL_SPEED = 6.5;
const FLY_HORIZONTAL_SPEED = 12.5;
const DOUBLE_TAP_SECONDS = 0.32;
const NPC_RESPAWN_SECONDS = 12;
const SABER_REACH = 2.9;

export class FrontierEngine {
  private canvas: HTMLCanvasElement;
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(54, 1, 0.1, 450);
  private world = new THREE.Group();
  private player = new THREE.Group();
  private playerPosition = SURFACE_START.clone();
  private firstPersonActive = false;
  private viewYaw = 0;
  private viewPitch = -0.035;
  private lookSensitivity = 0.0022;
  private invertLookY = false;
  private viewModel: THREE.Group | null = null;
  private viewModelGrip: THREE.Group | null = null;
  private viewModelAccent: THREE.MeshStandardMaterial | null = null;
  private weaponRecoil = 0;
  private location: GameLocation = "surface";
  private roomIndex = 0;
  private activeTool = "pulse";
  private inputEnabled = false;
  private keys = new Set<string>();
  private pointer = new THREE.Vector2(0, 0);
  private raycaster = new THREE.Raycaster();
  private targets: Target[] = [];
  private targetCount = 0;
  private interactables: Interactable[] = [];
  private walkers: Walker[] = [];
  private npcs: NpcTarget[] = [];
  private mechs: MechTarget[] = [];
  private animated: AnimatedProp[] = [];
  private hitboxes: Hitbox[] = [];
  private projectiles: Projectile[] = [];
  private debugHitboxes = false;
  private debugMeshes: { hitbox: Hitbox; mesh: THREE.Mesh; radius: number; depth: number; height: number }[] = [];
  private debugMaterials: THREE.MeshBasicMaterial[] = [];
  private playerParts: CharacterParts | null = null;
  private playerShadow: THREE.Mesh | null = null;
  private playerHitbox: Hitbox | null = null;
  private pylonUnlocked = false;
  private placedDreamcores: PlacedDreamcore[] = [];
  private pilotedDreamcore: PlacedDreamcore | null = null;
  private playerScale = 1;
  private playerScaleTarget = 1;
  private sizeCooldownUntil = 0;
  private sizeEffects: { mesh: THREE.Mesh; life: number; maxLife: number; from: number; to: number }[] = [];
  private jumpBufferUntil = -1;
  private coyoteUntil = -1;
  private verticalVelocity = 0;
  private grounded = true;
  private landingEffects: { mesh: THREE.Mesh; life: number }[] = [];
  private impactEffects: { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number; maxLife: number }[] = [];
  private sparkMaterials = new Map<string, THREE.MeshBasicMaterial>();
  private flightUnlocked = false;
  private npcSpawnerUnlocked = false;
  private spawnSerial = 0;
  private flying = false;
  private lastJumpPress = -10;
  private mechUnlocked = false;
  private piloting = false;
  private drivableMech: { actor: THREE.Group; hitbox: Hitbox | null; interactable: Interactable } | null = null;
  private mechCockpit: THREE.Group | null = null;
  private mechCannons: THREE.Group[] = [];
  private mechFlashes: THREE.Mesh[] = [];
  private mechRecoil = [0, 0];
  private mechGunSide = 0;
  private mechFireCooldownUntil = 0;
  private triggerHeld = false;
  private saberGrip: THREE.Group | null = null;
  private saberBlade: THREE.Mesh | null = null;
  private saberSwingStart = -10;
  private saberSwingDirection = 1;
  private saberCooldownUntil = 0;
  private nextObjectId = 1;
  private cachedGeometry = new Map<string, THREE.BufferGeometry>();
  private cachedMaterials = new Map<string, THREE.MeshStandardMaterial>();
  private frame = 0;
  private previousTime = 0;
  private lastTick = 0;
  private frameRate = 60;
  private pixelRatio = 1;
  private qualityReviewAt = 5;
  private elapsed = 0;
  private toastCooldown = 0;
  private disposed = false;
  private callbacks: EngineCallbacks;
  private cameraTarget = new THREE.Vector3();
  private beamLines: { line: THREE.Line; life: number }[] = [];

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        stencil: false,
        depth: true,
      });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.16;
      this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.renderer.setSize(window.innerWidth, window.innerHeight, false);
      this.renderer.setClearColor("#748581", 1);
      this.camera.rotation.order = "YXZ";
      this.scene.add(this.world);
      this.scene.fog = new THREE.Fog("#a9bbb1", 68, 210);
      this.buildWorld("surface", 0);
      this.resize();
      this.frame = requestAnimationFrame(this.animate);
      window.addEventListener("resize", this.resize);
    } catch (error) {
      console.error("Frontier 3D renderer could not start:", error);
      throw error;
    }
  }

  private readonly animate = (now: number) => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    const delta = Math.min((now - (this.previousTime || now)) / 1000, 0.04);
    this.previousTime = now;
    if (delta > 0.001) this.frameRate = THREE.MathUtils.lerp(this.frameRate, 1 / delta, 0.08);
    this.elapsed += delta;
    if (this.elapsed >= this.qualityReviewAt) {
      const maxRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      const nextRatio = this.frameRate < 49
        ? Math.max(0.82, this.pixelRatio - 0.12)
        : this.frameRate > 58
          ? Math.min(maxRatio, this.pixelRatio + 0.06)
          : this.pixelRatio;
      if (Math.abs(nextRatio - this.pixelRatio) > 0.01) {
        this.pixelRatio = nextRatio;
        this.renderer.setPixelRatio(this.pixelRatio);
        this.resize();
      }
      this.qualityReviewAt = this.elapsed + 5;
    }
    this.update(delta);
    this.renderer.render(this.scene, this.camera);
    if (now - this.lastTick > 110) {
      this.lastTick = now;
      const nearest = this.findNearest();
      this.callbacks.onTick({
        x: this.playerPosition.x,
        y: Math.max(0, this.playerPosition.y - this.visibleFloorHeight()),
        z: this.playerPosition.z,
        heading: Math.round(((this.viewYaw * -180 / Math.PI) % 360 + 360) % 360),
        pitch: Math.round(this.viewPitch * 180 / Math.PI),
        scale: Math.round(this.playerScale * 100) / 100,
        grounded: this.grounded,
        flying: this.flying,
        piloting: this.piloting,
        colliderCount: this.hitboxes.length,
        nearest,
        targetCount: this.targetCount,
        location: this.location,
        roomIndex: this.roomIndex,
        fps: Math.round(this.frameRate),
      });
    }
  };

  private resize = () => {
    if (!this.renderer) return;
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  private update(delta: number) {
    if (this.inputEnabled && this.callbacks.canMove()) this.movePlayer(delta);
    else this.player.userData.moving = false;
    this.updateVertical(delta);
    this.updatePlayerScale(delta);
    if (this.playerParts) this.animateCharacter(this.playerParts, Boolean(this.player.userData.moving), delta, false, !this.grounded);

    for (const walker of this.walkers) {
      if (walker.actor.userData.defeated) continue;
      walker.elapsed += delta * walker.speed;
      if (walker.elapsed >= 1) {
        walker.from.copy(walker.to);
        walker.elapsed = 0;
        const angle = Math.random() * Math.PI * 2;
        const next = new THREE.Vector3(walker.from.x + Math.cos(angle) * (2 + Math.random() * 6), 0, walker.from.z + Math.sin(angle) * (2 + Math.random() * 6));
        this.clampWorldPosition(next);
        walker.to.copy(next);
      }
      const t = walker.elapsed;
      walker.actor.position.x = THREE.MathUtils.lerp(walker.from.x, walker.to.x, t);
      walker.actor.position.z = THREE.MathUtils.lerp(walker.from.z, walker.to.z, t);
      walker.actor.position.y = Math.abs(Math.sin(this.elapsed * 8 + walker.phase)) * 0.035;
      if (t > 0.025) walker.actor.rotation.y = Math.atan2(walker.from.x - walker.to.x, walker.from.z - walker.to.z);
    }

    for (const npc of this.npcs) {
      if (npc.defeated) {
        this.updateDefeatedNpc(npc);
        continue;
      }
      const reactionEnd = Number(npc.actor.userData.reactionEnd ?? 0);
      const reacting = reactionEnd > this.elapsed;
      const bounce = reacting ? Math.abs(Math.sin(this.elapsed * 14)) * 0.24 : 0;
      npc.actor.scale.setScalar(npc.scale * (reacting ? 1 + Math.sin(this.elapsed * 17) * 0.045 : 1));
      npc.actor.rotation.z = reacting ? Math.sin(this.elapsed * 13) * 0.11 : THREE.MathUtils.lerp(npc.actor.rotation.z, 0, 0.18);
      npc.actor.position.y = npc.home.y + bounce;
      if (npc.parts) this.animateCharacter(npc.parts, Boolean(npc.walker), delta, reacting);
    }

    for (const mech of this.mechs) {
      const parts = mech.actor.userData.parts as Record<string, THREE.Object3D> | undefined;
      if (!parts || !mech.actor.visible) continue;
      const phase = this.elapsed * 0.85 + mech.phase;
      const spark = Number(mech.actor.userData.sparkUntil ?? 0) > this.elapsed;
      if (parts.head) parts.head.rotation.y = Math.sin(phase * 0.7) * 0.28;
      if (parts.leftArm) parts.leftArm.rotation.x = Math.sin(phase) * 0.16 + (spark ? 0.18 : 0);
      if (parts.rightArm) parts.rightArm.rotation.x = Math.sin(phase + Math.PI) * 0.16 + (spark ? 0.18 : 0);
      if (parts.leftLeg) parts.leftLeg.rotation.x = Math.sin(phase + Math.PI) * 0.1;
      if (parts.rightLeg) parts.rightLeg.rotation.x = Math.sin(phase) * 0.1;
      const core = parts.core as THREE.Mesh | undefined;
      if (core) core.scale.setScalar(1 + Math.sin(phase * 2.2) * (spark ? 0.28 : 0.08));
      const antenna = parts.antennaTip as THREE.Mesh | undefined;
      if (antenna) antenna.position.y = 0.91 + Math.sin(phase * 3) * (spark ? 0.08 : 0.025);
    }

    for (const prop of this.animated) {
      const time = this.elapsed * prop.speed + prop.phase;
      const mode = prop.mode ?? "spin";
      if (mode === "spin") {
        prop.object.rotation.y += delta * prop.speed;
        prop.object.position.y = prop.baseY + Math.sin(this.elapsed * 1.65 + prop.phase) * 0.16;
      } else if (mode === "bob") {
        prop.object.position.y = prop.baseY + Math.sin(time * 2.1) * 0.075;
        const core = prop.object.userData.core as THREE.Mesh | undefined;
        if (core) core.scale.setScalar(1 + Math.sin(time * 4) * 0.16);
      } else if (mode === "orbit") {
        const radius = prop.radius ?? 1;
        prop.object.position.x = (prop.baseX ?? 0) + Math.cos(time) * radius;
        prop.object.position.z = (prop.baseZ ?? 0) + Math.sin(time) * radius;
        prop.object.position.y = prop.baseY + Math.sin(time * 2) * 0.08;
        prop.object.rotation.y += delta * prop.speed;
      } else if (mode === "swing") {
        prop.object.rotation.z = Math.sin(time * 1.7) * 0.2;
        prop.object.rotation.x = Math.sin(time * 1.1) * 0.06;
        prop.object.position.y = prop.baseY + Math.sin(time) * 0.035;
      } else if (mode === "pulse") {
        const pulse = 1 + Math.sin(time * 3.2) * 0.11;
        prop.object.scale.setScalar(pulse);
        prop.object.position.y = prop.baseY + Math.sin(time) * 0.035;
      } else if (mode === "rise") {
        prop.object.position.y = prop.baseY + ((this.elapsed * prop.speed + prop.phase) % 2.4);
        prop.object.rotation.y += delta * prop.speed;
      } else if (mode === "patrol") {
        const minY = prop.minY ?? prop.baseY - 1;
        const maxY = prop.maxY ?? prop.baseY + 1;
        prop.object.position.y = minY + (Math.sin(time) + 1) * 0.5 * (maxY - minY);
      }
    }

    this.updateProjectiles(delta);
    this.updateTrigger();
    this.updateSparks(delta);
    this.updateDreamcores(delta);
    this.updateDebugMeshes();

    for (let i = this.beamLines.length - 1; i >= 0; i -= 1) {
      const beam = this.beamLines[i];
      beam.life -= delta;
      (beam.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, beam.life / 0.17);
      if (beam.life <= 0) {
        this.world.remove(beam.line);
        beam.line.geometry.dispose();
        (beam.line.material as THREE.Material).dispose();
        this.beamLines.splice(i, 1);
      }
    }

    if (this.location === "surface" && !this.firstPersonActive) {
      const target = new THREE.Vector3(-4, 9, -7);
      const position = new THREE.Vector3(26 + Math.sin(this.elapsed * 0.035) * 2, 18, 29 + Math.cos(this.elapsed * 0.035) * 2);
      this.camera.position.lerp(position, 0.035);
      this.camera.lookAt(target);
    } else {
      const walking = Boolean(this.player.userData.moving) && this.grounded && this.inputEnabled;
      const bob = !walking ? 0 : this.piloting ? Math.abs(Math.sin(this.elapsed * 5.6)) * 0.08 : Math.sin(this.elapsed * (this.keys.has("shift") ? 14 : 10)) * 0.022 * this.playerScale;
      this.camera.position.set(this.playerPosition.x, this.playerPosition.y + this.eyeHeight() + bob, this.playerPosition.z);
      this.camera.rotation.set(this.viewPitch, this.viewYaw, 0, "YXZ");
      this.camera.updateMatrixWorld();
    }
    const walkingNow = Boolean(this.player.userData.moving) && this.grounded && this.inputEnabled;
    const sway = walkingNow ? Math.sin(this.elapsed * 10) : 0;
    if (this.viewModel && this.viewModelGrip) {
      this.viewModel.position.copy(this.camera.position);
      this.viewModel.quaternion.copy(this.camera.quaternion);
      this.weaponRecoil *= Math.pow(0.002, delta);
      this.viewModelGrip.position.set(0.43 + sway * 0.012, -0.43 + Math.abs(sway) * 0.012, -0.84 + this.weaponRecoil * 0.18);
      this.viewModelGrip.rotation.x = -this.weaponRecoil * 0.16;
    }
    this.animateSaber(sway);
    this.animateCockpit(delta);
  }

  private eyeHeight() {
    return this.piloting ? PILOT_EYE_HEIGHT : PLAYER_EYE_HEIGHT * this.playerScale;
  }

  isPiloting() {
    return this.piloting;
  }

  private isInside(object: THREE.Object3D, ancestor: THREE.Object3D) {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current === ancestor) return true;
      current = current.parent;
    }
    return false;
  }

  private removeHitbox(hitbox: Hitbox) {
    this.hitboxes = this.hitboxes.filter((item) => item !== hitbox);
    const index = this.debugMeshes.findIndex((entry) => entry.hitbox === hitbox);
    if (index >= 0) {
      const [entry] = this.debugMeshes.splice(index, 1);
      this.world.remove(entry.mesh);
      entry.mesh.geometry.dispose();
      (entry.mesh.material as THREE.Material).dispose();
      this.debugMaterials = this.debugMaterials.filter((material) => material !== entry.mesh.material);
    }
  }

  private updateViewModelVisibility() {
    if (this.viewModel) this.viewModel.visible = this.firstPersonActive && !this.piloting;
    if (this.viewModelGrip) this.viewModelGrip.visible = this.activeTool !== "saber";
    if (this.saberGrip) this.saberGrip.visible = this.activeTool === "saber";
    if (this.mechCockpit) this.mechCockpit.visible = this.firstPersonActive && this.piloting;
  }

  private animateSaber(sway: number) {
    const saber = this.saberGrip;
    if (!saber || !saber.visible) return;
    const swing = (this.elapsed - this.saberSwingStart) / 0.26;
    if (swing >= 0 && swing < 1) {
      const eased = 1 - Math.pow(1 - swing, 3);
      const arc = Math.sin(swing * Math.PI);
      const direction = this.saberSwingDirection;
      saber.position.set(0.25 + direction * (0.3 - 0.6 * eased), -0.4 + arc * 0.14, -0.78 - arc * 0.12);
      saber.rotation.set(-0.42 - arc * 0.95, 0, THREE.MathUtils.lerp(-0.95 * direction, 1.25 * direction, eased));
    } else {
      saber.position.set(0.44 + sway * 0.012, -0.46 + Math.abs(sway) * 0.012, -0.8);
      saber.rotation.set(-0.42, 0, 0.35);
    }
    if (this.saberBlade) {
      const flicker = 1 + Math.sin(this.elapsed * 47) * 0.05 + Math.sin(this.elapsed * 13) * 0.03;
      this.saberBlade.scale.set(flicker, 1, flicker);
    }
  }

  private animateCockpit(delta: number) {
    const cockpit = this.mechCockpit;
    if (!cockpit) return;
    cockpit.visible = this.firstPersonActive && this.piloting;
    if (!cockpit.visible) return;
    cockpit.position.copy(this.camera.position);
    cockpit.quaternion.copy(this.camera.quaternion);
    for (let side = 0; side < 2; side += 1) {
      this.mechRecoil[side] *= Math.pow(0.0008, delta);
      const cannon = this.mechCannons[side];
      if (cannon) cannon.position.z = -1.22 + this.mechRecoil[side] * 0.24;
      const flash = this.mechFlashes[side];
      if (flash) flash.scale.setScalar(this.mechRecoil[side] > 0.5 ? this.mechRecoil[side] * (0.85 + Math.random() * 0.3) : 0.001);
    }
  }

  private spawnSparks(point: THREE.Vector3, color: string, count: number, speed: number) {
    const geometry = this.geometry("spark-cube", () => new THREE.BoxGeometry(0.075, 0.075, 0.075));
    let material = this.sparkMaterials.get(color);
    if (!material) {
      material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
      this.sparkMaterials.set(color, material);
    }
    for (let i = 0; i < count; i += 1) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(point);
      const velocity = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 1.3 + 0.2, Math.random() * 2 - 1).normalize().multiplyScalar(speed * (0.45 + Math.random() * 0.8));
      const life = 0.32 + Math.random() * 0.45;
      this.world.add(mesh);
      this.impactEffects.push({ mesh, velocity, life, maxLife: life });
    }
    while (this.impactEffects.length > 280) {
      const oldest = this.impactEffects.shift();
      if (oldest) this.world.remove(oldest.mesh);
    }
  }

  private updateSparks(delta: number) {
    for (let i = this.impactEffects.length - 1; i >= 0; i -= 1) {
      const spark = this.impactEffects[i];
      spark.life -= delta;
      spark.velocity.y -= 9.8 * delta;
      spark.mesh.position.addScaledVector(spark.velocity, delta);
      spark.mesh.rotation.x += delta * 9;
      spark.mesh.rotation.y += delta * 7;
      spark.mesh.scale.setScalar(Math.max(0.02, spark.life / spark.maxLife));
      if (spark.life <= 0) {
        this.world.remove(spark.mesh);
        this.impactEffects.splice(i, 1);
      }
    }
  }

  private defeatNpc(npc: NpcTarget, source: THREE.Vector3) {
    if (npc.defeated) return;
    npc.defeated = true;
    npc.dissolved = false;
    npc.defeatedAt = this.elapsed;
    npc.respawnAt = this.elapsed + NPC_RESPAWN_SECONDS;
    npc.actor.userData.defeated = true;
    npc.actor.userData.reactionEnd = 0;
    if (npc.hitbox) npc.hitbox.disabled = true;
    const dx = source.x - npc.actor.position.x;
    const dz = source.z - npc.actor.position.z;
    const facing = Math.abs(dx) + Math.abs(dz) > 0.001 ? Math.atan2(-dx, -dz) : npc.actor.rotation.y;
    npc.actor.rotation.order = "YXZ";
    npc.actor.rotation.set(0, facing, 0);
    npc.actor.position.y = npc.home.y;
    this.spawnSparks(npc.actor.position.clone().add(new THREE.Vector3(0, 1.15 * npc.scale, 0)), "#ff5d6e", 22, 4.4);
    this.callbacks.onSound("defeat");
  }

  private updateDefeatedNpc(npc: NpcTarget) {
    const t = this.elapsed - npc.defeatedAt;
    npc.actor.rotation.x = THREE.MathUtils.smoothstep(t, 0, 0.42) * Math.PI * 0.5;
    npc.actor.position.y = npc.home.y;
    if (t > 0.95 && !npc.dissolved) {
      npc.dissolved = true;
      this.spawnSparks(npc.actor.position.clone().add(new THREE.Vector3(0, 0.3 * npc.scale, 0)), "#ffb36b", 18, 3);
    }
    const dissolve = THREE.MathUtils.clamp((t - 0.95) / 0.55, 0, 1);
    npc.actor.scale.setScalar(Math.max(0.001, npc.scale * (1 - dissolve)));
    npc.actor.visible = dissolve < 1;
    if (this.elapsed >= npc.respawnAt) this.respawnNpc(npc);
  }

  private respawnNpc(npc: NpcTarget) {
    npc.defeated = false;
    npc.dissolved = false;
    npc.scale = npc.normalScale;
    npc.actor.visible = true;
    npc.actor.rotation.order = "XYZ";
    npc.actor.rotation.set(0, npc.actor.rotation.y, 0);
    npc.actor.position.copy(npc.home);
    npc.actor.scale.setScalar(npc.scale);
    npc.actor.userData.defeated = false;
    npc.actor.userData.reactionEnd = this.elapsed + 0.9;
    if (npc.hitbox) {
      npc.hitbox.disabled = false;
      npc.hitbox.radius = 0.58 * npc.scale;
      npc.hitbox.halfDepth = npc.hitbox.radius;
      npc.hitbox.maxY = npc.hitbox.minY + 2.15 * npc.scale;
    }
    if (npc.walker) {
      npc.walker.from.copy(npc.home);
      npc.walker.to.copy(npc.home).add(new THREE.Vector3(1.6, 0, 1.1));
      npc.walker.elapsed = 0;
    }
    if (npc.id === "chrono") this.interactables.find((item) => item.id === "chrono")?.position.copy(npc.home);
    this.spawnSparks(npc.home.clone().add(new THREE.Vector3(0, 1, 0)), "#8ff7e0", 16, 2.4);
    this.callbacks.onSound("respawn");
  }

  private spawnDrivableMech(atPlayer = false) {
    this.removeDrivableMech();
    const right = new THREE.Vector3(Math.cos(this.viewYaw), 0, -Math.sin(this.viewYaw));
    const forward = new THREE.Vector3(-Math.sin(this.viewYaw), 0, -Math.cos(this.viewYaw));
    const position = atPlayer ? this.playerPosition.clone() : this.playerPosition.clone().addScaledVector(right, 3.4).addScaledVector(forward, 1.6);
    position.y = this.visibleFloorHeight();
    this.clampWorldPosition(position);
    this.resolveCollision(position, 1.5, PILOT_BODY_HEIGHT);
    const actor = this.createMech(this.world, position.x, position.y, position.z, "#ff6a4d", MECH_SCALE);
    actor.rotation.y = this.viewYaw;
    const hitbox = (actor.userData.hitbox as Hitbox | undefined) ?? null;
    const interactable: Interactable = { kind: "mech", id: "withrow-mech", label: "Pilot the Withrow Mech", position: position.clone(), range: 3.4 };
    this.interactables.push(interactable);
    this.drivableMech = { actor, hitbox, interactable };
    return actor;
  }

  private removeDrivableMech() {
    if (!this.drivableMech) return;
    const { actor, hitbox, interactable } = this.drivableMech;
    this.world.remove(actor);
    this.mechs = this.mechs.filter((mech) => mech.actor !== actor);
    this.animated = this.animated.filter((entry) => !this.isInside(entry.object, actor));
    if (hitbox) this.removeHitbox(hitbox);
    this.interactables = this.interactables.filter((item) => item !== interactable);
    this.drivableMech = null;
  }

  enterMech(silent = false) {
    if (!this.drivableMech || this.piloting) return false;
    const { actor, hitbox } = this.drivableMech;
    this.piloting = true;
    actor.visible = false;
    if (hitbox) hitbox.disabled = true;
    this.playerPosition.set(actor.position.x, actor.position.y, actor.position.z);
    if (!silent) this.viewYaw = actor.rotation.y;
    this.verticalVelocity = 0;
    if (!this.flying) this.grounded = true;
    this.applyPlayerScale();
    this.resolvePlayerCollision(this.playerPosition);
    this.player.position.copy(this.playerPosition);
    this.updateViewModelVisibility();
    if (!silent) this.callbacks.onSound("mechEnter");
    return true;
  }

  exitMech() {
    if (!this.piloting || !this.drivableMech) return false;
    const { actor, hitbox, interactable } = this.drivableMech;
    this.piloting = false;
    const ground = this.supportHeightAt(this.playerPosition, -2, this.playerPosition.y + 0.05) ?? this.visibleFloorHeight();
    actor.position.set(this.playerPosition.x, ground, this.playerPosition.z);
    actor.rotation.y = this.viewYaw;
    actor.visible = true;
    if (hitbox) hitbox.disabled = false;
    interactable.position.copy(actor.position);
    const right = new THREE.Vector3(Math.cos(this.viewYaw), 0, -Math.sin(this.viewYaw));
    this.playerPosition.addScaledVector(right, 2.4);
    this.clampWorldPosition(this.playerPosition);
    this.applyPlayerScale();
    this.resolvePlayerCollision(this.playerPosition);
    this.player.position.copy(this.playerPosition);
    this.updateViewModelVisibility();
    this.callbacks.onSound("mechExit");
    return true;
  }

  toggleMech() {
    if (this.piloting) return this.exitMech();
    const mech = this.drivableMech;
    if (!mech) return false;
    const distance = Math.hypot(mech.actor.position.x - this.playerPosition.x, mech.actor.position.z - this.playerPosition.z);
    return distance <= mech.interactable.range + 0.6 ? this.enterMech() : false;
  }

  unlockWithrow() {
    this.flightUnlocked = true;
    this.mechUnlocked = true;
    this.npcSpawnerUnlocked = true;
    if (this.piloting) return false;
    const actor = this.spawnDrivableMech();
    this.spawnSparks(actor.position.clone().add(new THREE.Vector3(0, 2.4, 0)), "#ffd27a", 34, 4.2);
    return true;
  }

  setAbilities(abilities: { flight: boolean; mech: boolean; npcSpawner: boolean }) {
    this.flightUnlocked = abilities.flight;
    if (!abilities.flight) this.flying = false;
    this.mechUnlocked = abilities.mech;
    this.npcSpawnerUnlocked = abilities.npcSpawner;
    if (!abilities.mech) {
      this.piloting = false;
      this.removeDrivableMech();
      this.applyPlayerScale();
      this.updateViewModelVisibility();
    }
  }

  setTriggerHeld(held: boolean) {
    this.triggerHeld = held && this.inputEnabled;
  }

  private updateTrigger() {
    if (!this.triggerHeld || !this.inputEnabled || !this.callbacks.canMove()) return;
    if (this.piloting) this.fireMechGuns();
    else if (this.activeTool === "saber") this.swingSaber();
  }

  private aimAtCrosshair(maxDistance: number) {
    this.camera.updateMatrixWorld();
    this.pointer.set(0, 0);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const origin = this.raycaster.ray.origin.clone();
    const direction = this.raycaster.ray.direction.clone().normalize();
    const hit = this.raycastHitboxes(origin, direction, maxDistance, ["npc", "target", "mech", "artifact", "weapon", "prop"]);
    let point: THREE.Vector3;
    if (hit) point = hit.point.clone();
    else if (direction.y < -0.0001) point = origin.clone().addScaledVector(direction, THREE.MathUtils.clamp((origin.y - this.visibleFloorHeight()) / -direction.y, 0.3, maxDistance));
    else point = origin.clone().addScaledVector(direction, maxDistance);
    return { direction, hit, point };
  }

  private mechMuzzle(side: number) {
    const offset = new THREE.Vector3(side === 0 ? -0.98 : 0.98, -0.58, -2.6);
    if (this.mechCockpit) {
      this.mechCockpit.updateMatrixWorld();
      return this.mechCockpit.localToWorld(offset);
    }
    this.camera.updateMatrixWorld();
    return this.camera.localToWorld(offset);
  }

  private fireMechGuns() {
    if (!this.piloting || this.elapsed < this.mechFireCooldownUntil) return;
    this.mechFireCooldownUntil = this.elapsed + 0.13;
    const aim = this.aimAtCrosshair(70);
    const side = this.mechGunSide;
    this.mechGunSide = 1 - side;
    this.mechRecoil[side] = 1;
    const intent: ProjectileIntent = { toolId: "mech", hitPoint: aim.point, direction: aim.direction };
    if (aim.hit?.hitbox.owner === "npc") intent.npcId = aim.hit.hitbox.objectId;
    if (aim.hit?.hitbox.owner === "target") intent.targetId = aim.hit.hitbox.objectId;
    if (aim.hit?.hitbox.owner === "mech") intent.mechId = aim.hit.hitbox.objectId;
    this.addProjectile(intent, "#ff8a4c", this.mechMuzzle(side), 1.45);
    this.callbacks.onSound("mechGun");
  }

  private resolveMechShot(impact: HitboxHit | null, intent: ProjectileIntent) {
    const owner = impact?.hitbox.owner;
    const objectId = impact?.hitbox.objectId;
    const point = impact?.point ?? intent.hitPoint;
    const npc = impact ? (owner === "npc" ? this.npcs.find((item) => item.id === objectId) : undefined) : this.npcs.find((item) => item.id === intent.npcId);
    if (npc && !npc.defeated) {
      this.defeatNpc(npc, this.playerPosition);
      return;
    }
    const target = impact ? (owner === "target" ? this.targets.find((item) => item.id === objectId) : undefined) : this.targets.find((item) => item.id === intent.targetId);
    if (target) {
      if (!target.active) this.activateTarget(target);
      this.spawnSparks(point, "#9dffe0", 8, 2.6);
      return;
    }
    const mech = impact ? (owner === "mech" ? this.mechs.find((item) => item.id === objectId) : undefined) : this.mechs.find((item) => item.id === intent.mechId);
    if (mech) mech.actor.userData.sparkUntil = this.elapsed + 0.9;
    this.spawnSparks(point, "#ffb26b", 10, 3.2);
  }

  private swingSaber() {
    if (this.piloting || this.elapsed < this.saberCooldownUntil) return;
    this.saberCooldownUntil = this.elapsed + 0.3;
    this.saberSwingStart = this.elapsed;
    this.saberSwingDirection *= -1;
    this.callbacks.onSound("saber");
    this.camera.updateMatrixWorld();
    const eye = this.camera.position.clone();
    const look = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    const flat = new THREE.Vector3(look.x, 0, look.z);
    if (flat.lengthSq() < 0.0001) flat.set(-Math.sin(this.viewYaw), 0, -Math.cos(this.viewYaw));
    flat.normalize();
    const reach = SABER_REACH * Math.max(0.65, this.playerScale);
    const cone = Math.cos(THREE.MathUtils.degToRad(62));
    let struck = false;
    for (const npc of this.npcs) {
      if (npc.defeated || !npc.actor.visible) continue;
      const feet = npc.actor.position.y;
      if (eye.y - reach > feet + 2.15 * npc.scale || eye.y + reach < feet) continue;
      const offset = new THREE.Vector3(npc.actor.position.x - eye.x, 0, npc.actor.position.z - eye.z);
      const distance = offset.length();
      if (distance - 0.55 * npc.scale > reach) continue;
      if (distance > 0.35 && offset.normalize().dot(flat) < cone) continue;
      this.defeatNpc(npc, this.playerPosition);
      struck = true;
    }
    for (const target of this.targets) {
      if (target.active) continue;
      const offset = target.mesh.getWorldPosition(new THREE.Vector3()).sub(eye);
      if (offset.length() > reach + 0.6 || offset.normalize().dot(look) < cone) continue;
      this.activateTarget(target);
      struck = true;
    }
    for (const mech of this.mechs) {
      if (!mech.actor.visible) continue;
      const offset = new THREE.Vector3(mech.actor.position.x - eye.x, 0, mech.actor.position.z - eye.z);
      const distance = offset.length();
      if (distance > reach + 1.3 || (distance > 0.5 && offset.normalize().dot(flat) < cone)) continue;
      mech.actor.userData.sparkUntil = this.elapsed + 0.8;
      this.spawnSparks(mech.actor.position.clone().add(new THREE.Vector3(0, 1.8, 0)), "#ffcf7a", 10, 3);
      struck = true;
    }
    if (!struck) {
      const contact = this.raycastHitboxes(eye, look, reach, ["prop", "artifact", "weapon"]);
      if (contact) {
        this.spawnSparks(contact.point, "#ff8fa3", 9, 2.8);
        struck = true;
      }
    }
    if (struck) this.callbacks.onSound("saberHit");
  }

  private toggleFlight() {
    this.flying = !this.flying;
    this.jumpBufferUntil = -1;
    if (this.flying) {
      this.grounded = false;
      this.verticalVelocity = Math.max(this.verticalVelocity * 0.25, 1.2);
      this.callbacks.onSound("fly");
      this.createLandingRipple(this.playerPosition.y, "#9fe8ff");
    } else {
      this.verticalVelocity = Math.min(this.verticalVelocity, 0);
    }
  }

  private flightCeiling() {
    if (this.location === "room") return 11.6 - this.playerHeight();
    return this.location === "lizard" ? 40 : 90;
  }

  private updateFlight(delta: number) {
    const rise = Number(this.keys.has("space")) - Number(this.keys.has("shift") || this.keys.has("c"));
    const speed = FLY_VERTICAL_SPEED * (this.piloting ? 1.2 : Math.max(0.7, this.playerScale));
    this.verticalVelocity = THREE.MathUtils.damp(this.verticalVelocity, rise * speed, 9, delta);
    const previousY = this.playerPosition.y;
    let nextY = previousY + this.verticalVelocity * delta;
    if (this.verticalVelocity > 0) {
      const bodyHeight = this.playerHeight();
      for (const hitbox of this.hitboxes) {
        if (!hitbox.solid || hitbox.disabled) continue;
        const center = this.hitboxCenter(hitbox);
        const bottom = this.hitboxYRange(hitbox, center).min;
        if (previousY + bodyHeight <= bottom + 0.001 && nextY + bodyHeight >= bottom && this.supportsPlayer(hitbox, center, this.playerPosition)) {
          nextY = bottom - bodyHeight;
          this.verticalVelocity = 0;
          break;
        }
      }
      this.playerPosition.y = Math.min(nextY, this.flightCeiling());
      return;
    }
    if (this.verticalVelocity < -0.05) {
      const support = this.supportHeightAt(this.playerPosition, nextY, previousY + 0.035);
      if (support !== null) {
        this.playerPosition.y = support;
        this.flying = false;
        this.grounded = true;
        this.verticalVelocity = 0;
        this.callbacks.onSound("land");
        this.createLandingRipple(support, "#9fe8ff");
        return;
      }
    }
    this.playerPosition.y = Math.max(this.visibleFloorHeight(), nextY);
  }

  private animateCharacter(parts: CharacterParts, moving: boolean, delta: number, reacting: boolean, airborne = false) {
    const frame = THREE.MathUtils.clamp(delta * 60, 0.08, 1);
    const phase = this.elapsed * (moving ? 9 : 1.1);
    if (airborne) {
      parts.leftArm.rotation.x = THREE.MathUtils.lerp(parts.leftArm.rotation.x, -0.52, frame);
      parts.rightArm.rotation.x = THREE.MathUtils.lerp(parts.rightArm.rotation.x, -0.52, frame);
      parts.leftLeg.rotation.x = THREE.MathUtils.lerp(parts.leftLeg.rotation.x, 0.48, frame);
      parts.rightLeg.rotation.x = THREE.MathUtils.lerp(parts.rightLeg.rotation.x, -0.31, frame);
      parts.root.rotation.x = THREE.MathUtils.lerp(parts.root.rotation.x, -0.09, frame);
      parts.root.position.y = THREE.MathUtils.lerp(parts.root.position.y, 0, frame);
      return;
    }
    parts.root.rotation.x = THREE.MathUtils.lerp(parts.root.rotation.x, 0, frame);
    if (reacting) {
      parts.leftArm.rotation.x = THREE.MathUtils.lerp(parts.leftArm.rotation.x, -1.68 + Math.sin(this.elapsed * 12) * 0.12, frame);
      parts.rightArm.rotation.x = THREE.MathUtils.lerp(parts.rightArm.rotation.x, -1.68 + Math.sin(this.elapsed * 12 + 0.4) * 0.12, frame);
      parts.leftLeg.rotation.x = THREE.MathUtils.lerp(parts.leftLeg.rotation.x, Math.sin(this.elapsed * 14) * 0.16, frame);
      parts.rightLeg.rotation.x = THREE.MathUtils.lerp(parts.rightLeg.rotation.x, Math.sin(this.elapsed * 14 + Math.PI) * 0.16, frame);
      parts.root.position.y = THREE.MathUtils.lerp(parts.root.position.y, 0.08 + Math.abs(Math.sin(this.elapsed * 14)) * 0.035, frame);
      parts.head.rotation.y = THREE.MathUtils.lerp(parts.head.rotation.y, Math.sin(this.elapsed * 7) * 0.22, frame);
      parts.hair.rotation.z = THREE.MathUtils.lerp(parts.hair.rotation.z, Math.sin(this.elapsed * 6) * 0.08, frame);
      return;
    }
    parts.leftLeg.rotation.x = THREE.MathUtils.lerp(parts.leftLeg.rotation.x, moving ? Math.sin(phase) * 0.52 : Math.sin(phase) * 0.035, frame);
    parts.rightLeg.rotation.x = THREE.MathUtils.lerp(parts.rightLeg.rotation.x, moving ? Math.sin(phase + Math.PI) * 0.52 : Math.sin(phase + Math.PI) * 0.035, frame);
    parts.leftArm.rotation.x = THREE.MathUtils.lerp(parts.leftArm.rotation.x, moving ? Math.sin(phase + Math.PI) * 0.38 : Math.sin(phase * 0.8) * 0.05, frame);
    parts.rightArm.rotation.x = THREE.MathUtils.lerp(parts.rightArm.rotation.x, moving ? Math.sin(phase) * 0.38 : Math.sin(phase * 0.8 + Math.PI) * 0.05, frame);
    parts.root.position.y = THREE.MathUtils.lerp(parts.root.position.y, moving ? 0.025 + Math.abs(Math.sin(phase)) * 0.035 : 0.018 + Math.sin(this.elapsed * 1.3) * 0.006, frame);
    parts.head.rotation.y = THREE.MathUtils.lerp(parts.head.rotation.y, Math.sin(this.elapsed * 0.6) * 0.08, frame);
    parts.hair.rotation.y = THREE.MathUtils.lerp(parts.hair.rotation.y, Math.sin(this.elapsed * 0.45) * 0.05, frame);
  }

  private muzzlePosition() {
    if (this.firstPersonActive) {
      this.camera.updateMatrixWorld();
      return this.camera.localToWorld(new THREE.Vector3(0.2, -0.18, -0.35));
    }
    return this.playerPosition.clone().add(new THREE.Vector3(0, 1.38 * this.playerScale, 0));
  }

  private addProjectile(intent: ProjectileIntent, color: string, originOverride?: THREE.Vector3, size = 1) {
    const origin = originOverride ?? this.muzzlePosition();
    const toTarget = intent.hitPoint.clone().sub(origin);
    const distance = Math.max(0.45, toTarget.length());
    const direction = toTarget.lengthSq() > 0.001 ? toTarget.normalize() : new THREE.Vector3(0, -0.4, -1).normalize();
    const id = this.objectId("projectile");
    const mesh = new THREE.Group();
    mesh.position.copy(origin);
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.11 * size, 10, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.96, blending: THREE.AdditiveBlending }),
    );
    const trail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025 * size, 0.055 * size, 0.48 * size, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending }),
    );
    trail.rotation.x = Math.PI / 2;
    trail.position.z = -0.24 * size;
    mesh.add(core, trail);
    this.world.add(mesh);
    mesh.lookAt(origin.clone().add(direction));
    const hitbox = this.registerHitbox({
      owner: "projectile",
      objectId: id,
      shape: "cylinder",
      center: origin.clone(),
      radius: 0.14,
      halfDepth: 0.14,
      minY: origin.y - 0.2,
      maxY: origin.y + 0.2,
      solid: false,
      dynamic: () => mesh.getWorldPosition(new THREE.Vector3()),
    });
    const speed = THREE.MathUtils.clamp(distance * 2.4, 18, 38);
    const flightTime = THREE.MathUtils.clamp(distance / speed + 0.035, 0.12, 1.15);
    this.projectiles.push({
      id,
      mesh,
      hitboxId: hitbox.id,
      origin: origin.clone(),
      direction,
      speed,
      life: flightTime,
      maxLife: flightTime,
      intent,
      resolved: false,
    });
  }

  private removeProjectile(projectile: Projectile) {
    this.world.remove(projectile.mesh);
    projectile.mesh.traverse((object) => {
      const drawable = object as THREE.Object3D & { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] };
      drawable.geometry?.dispose();
      const materials = Array.isArray(drawable.material) ? drawable.material : drawable.material ? [drawable.material] : [];
      for (const material of materials) material.dispose();
    });
    this.hitboxes = this.hitboxes.filter((hitbox) => hitbox.id !== projectile.hitboxId);
    const debugIndex = this.debugMeshes.findIndex((entry) => entry.hitbox.id === projectile.hitboxId);
    if (debugIndex >= 0) {
      const [entry] = this.debugMeshes.splice(debugIndex, 1);
      this.world.remove(entry.mesh);
      entry.mesh.geometry.dispose();
      (entry.mesh.material as THREE.Material).dispose();
      this.debugMaterials = this.debugMaterials.filter((material) => material !== entry.mesh.material);
    }
  }

  private updateProjectiles(delta: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = this.projectiles[i];
      projectile.life -= delta;
      const step = projectile.speed * delta;
      const hit = this.raycastHitboxes(projectile.mesh.position, projectile.direction, Math.max(step, 0.001), [
        "npc",
        "target",
        "mech",
        "artifact",
        "prop",
      ]);
      if (hit) {
        projectile.mesh.position.copy(hit.point);
        this.resolveProjectile(projectile, hit);
        this.removeProjectile(projectile);
        this.projectiles.splice(i, 1);
        continue;
      }
      projectile.mesh.position.addScaledVector(projectile.direction, step);
      projectile.mesh.scale.setScalar(THREE.MathUtils.lerp(projectile.mesh.scale.x, 0.55 + 0.45 * (projectile.life / projectile.maxLife), 0.25));
      if (projectile.life <= 0) {
        this.resolveProjectile(projectile, null);
        this.removeProjectile(projectile);
        this.projectiles.splice(i, 1);
      }
    }
  }

  private resolveProjectile(projectile: Projectile, impact: HitboxHit | null) {
    if (projectile.resolved) return;
    projectile.resolved = true;
    const intent = projectile.intent;
    const toolId = intent.toolId;
    if (toolId === "mech") {
      this.resolveMechShot(impact, intent);
      return;
    }
    const impactOwner = impact?.hitbox.owner;
    const impactObjectId = impact?.hitbox.objectId;
    const target = impact
      ? (impactOwner === "target" ? this.targets.find((item) => item.id === impactObjectId) : undefined)
      : this.targets.find((item) => item.id === intent.targetId);
    const npc = impact
      ? (impactOwner === "npc" ? this.npcs.find((item) => item.id === impactObjectId) : undefined)
      : this.npcs.find((item) => item.id === intent.npcId);
    const mech = impact
      ? (impactOwner === "mech" ? this.mechs.find((item) => item.id === impactObjectId) : undefined)
      : this.mechs.find((item) => item.id === intent.mechId);
    const artifactHitbox = impact
      ? (impactOwner === "artifact" ? impact.hitbox : undefined)
      : this.hitboxes.find((item) => item.owner === "artifact" && item.objectId === intent.artifactId);

    if (npc) {
      this.applyNpcGadget(npc, toolId, impact?.point ?? intent.hitPoint);
      return;
    }
    if (target) {
      if (!target.active) {
        if (toolId === "shrink") target.mesh.scale.multiplyScalar(0.68);
        if (toolId === "grow") target.mesh.scale.multiplyScalar(1.35);
        if (toolId === "grapple") target.mesh.position.y = Math.max(1.55, target.mesh.position.y - 0.6);
        this.activateTarget(target);
      }
      return;
    }
    if (mech) {
      mech.actor.userData.sparkUntil = this.elapsed + 1.2;
      this.callbacks.onSound("npc");
      this.spawnSparks(impact?.point ?? intent.hitPoint, "#ffcf7a", 8, 2.6);
      return;
    }
    if (artifactHitbox) {
      this.spawnSparks(impact?.point ?? intent.hitPoint, "#cfe9df", 5, 1.6);
      return;
    }

    if (impactOwner === "prop" || impactOwner === "interactable") {
      if (impact) this.spawnSparks(impact.point, "#cfe9df", 5, 1.6);
      return;
    }

    if (toolId === "pylon") {
      const targetSpot = intent.hitPoint.clone();
      targetSpot.y = this.visibleFloorHeight();
      this.clampWorldPosition(targetSpot);
      const original = targetSpot.clone();
      this.resolveCollision(targetSpot, 0.55, 1.5);
      if (targetSpot.distanceToSquared(original) < 0.28 && targetSpot.distanceTo(this.playerPosition) > 1.45) {
        this.spawnPylon(targetSpot);
        this.callbacks.onSound("pylon");
        const spawned = this.placedDreamcores[this.placedDreamcores.length - 1];
        if (spawned) this.callbacks.onOpenDreamcore(spawned.id);
      } else {
        this.spawnSparks(intent.hitPoint, "#e2b6ff", 5, 1.6);
      }
      return;
    }

    if (toolId === "portal") {
      const targetSpot = intent.hitPoint.clone().addScaledVector(intent.direction, -2.2);
      targetSpot.y = this.visibleFloorHeight();
      this.clampWorldPosition(targetSpot);
      if (Math.hypot(targetSpot.x, targetSpot.z) > 2.3 && Math.abs(targetSpot.x) < 48 && Math.abs(targetSpot.z) < 48 && Math.abs(targetSpot.x - this.playerPosition.x) + Math.abs(targetSpot.z - this.playerPosition.z) > 5) {
        this.playerPosition.copy(targetSpot);
        this.resolvePlayerCollision(this.playerPosition);
        this.verticalVelocity = 0;
        this.grounded = true;
        this.player.position.copy(this.playerPosition);
        this.createLandingRipple(this.playerPosition.y, "#f494d1");
      } else {
        this.spawnSparks(intent.hitPoint, "#f494d1", 6, 1.8);
      }
      return;
    }

    this.spawnSparks(intent.hitPoint, "#cfe9df", 4, 1.4);
  }

  jump() {
    if (!this.inputEnabled || !this.callbacks.canMove()) return false;
    const doubleTap = this.elapsed - this.lastJumpPress <= DOUBLE_TAP_SECONDS;
    this.lastJumpPress = doubleTap ? -10 : this.elapsed;
    if (doubleTap && this.flightUnlocked) {
      this.toggleFlight();
      return true;
    }
    if (this.flying) return true;
    if (this.grounded || this.elapsed <= this.coyoteUntil) {
      this.performJump();
      return true;
    }
    this.jumpBufferUntil = this.elapsed + JUMP_BUFFER_SECONDS;
    return false;
  }

  private performJump() {
    this.grounded = false;
    this.coyoteUntil = -1;
    this.jumpBufferUntil = -1;
    this.verticalVelocity = this.piloting ? 9.4 : JUMP_SPEED * (0.55 + 0.45 * this.playerScale);
    this.callbacks.onSound("jump");
    this.createLandingRipple(this.playerPosition.y, "#a4f4dc");
  }

  private playerRadius() {
    return this.piloting ? PILOT_RADIUS : PLAYER_RADIUS * this.playerScale;
  }

  private playerHeight() {
    return this.piloting ? PILOT_BODY_HEIGHT : PLAYER_BODY_HEIGHT * this.playerScale;
  }

  private updateCameraFov() {
    const fov = !this.firstPersonActive ? 54 : this.piloting ? 70 : Math.max(62, 72 + (1 - this.playerScale) * 9);
    if (Math.abs(this.camera.fov - fov) < 0.01) return;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  private applyPlayerScale() {
    this.player.scale.setScalar(this.playerScale);
    if (this.playerHitbox) {
      this.playerHitbox.radius = this.piloting ? PILOT_RADIUS : 0.45 * this.playerScale;
      this.playerHitbox.halfDepth = this.playerHitbox.radius;
      this.playerHitbox.maxY = this.playerHitbox.minY + (this.piloting ? PILOT_BODY_HEIGHT : 2.1 * this.playerScale);
    }
    this.updateCameraFov();
  }

  private updatePlayerScale(delta: number) {
    if (Math.abs(this.playerScale - this.playerScaleTarget) > 0.0015) {
      this.playerScale = THREE.MathUtils.damp(this.playerScale, this.playerScaleTarget, 10, delta);
      if (Math.abs(this.playerScale - this.playerScaleTarget) <= 0.0015) this.playerScale = this.playerScaleTarget;
      this.applyPlayerScale();
      this.resolvePlayerCollision(this.playerPosition);
      this.player.position.copy(this.playerPosition);
    }
    for (let i = this.sizeEffects.length - 1; i >= 0; i -= 1) {
      const effect = this.sizeEffects[i];
      effect.life -= delta;
      const progress = 1 - Math.max(0, effect.life) / effect.maxLife;
      effect.mesh.scale.setScalar(THREE.MathUtils.lerp(effect.from, effect.to, 1 - Math.pow(1 - progress, 3)));
      effect.mesh.position.x = this.playerPosition.x;
      effect.mesh.position.z = this.playerPosition.z;
      (effect.mesh.material as THREE.MeshBasicMaterial).opacity = Math.sin(Math.min(1, progress) * Math.PI) * 0.82;
      if (effect.life <= 0) {
        this.world.remove(effect.mesh);
        effect.mesh.geometry.dispose();
        (effect.mesh.material as THREE.Material).dispose();
        this.sizeEffects.splice(i, 1);
      }
    }
  }

  private hasHeadroomFor(scale: number) {
    const radius = PLAYER_RADIUS * scale;
    const feet = this.playerPosition.y;
    const top = feet + PLAYER_BODY_HEIGHT * scale;
    for (const hitbox of this.hitboxes) {
      if (!hitbox.solid || hitbox.owner === "player" || hitbox.owner === "projectile" || hitbox.owner === "interactable" || hitbox.owner === "terrain" || hitbox.disabled) continue;
      const center = this.hitboxCenter(hitbox);
      const range = this.hitboxYRange(hitbox, center);
      if (range.min <= feet + 0.05 || range.min >= top) continue;
      const horizontalGap = hitbox.shape === "box"
        ? Math.hypot(Math.max(Math.abs(this.playerPosition.x - center.x) - hitbox.radius, 0), Math.max(Math.abs(this.playerPosition.z - center.z) - hitbox.halfDepth, 0))
        : Math.max(0, Math.hypot(this.playerPosition.x - center.x, this.playerPosition.z - center.z) - hitbox.radius);
      if (horizontalGap < radius) return false;
    }
    return true;
  }

  private createSizeRings(shrinking: boolean, color: string) {
    const heights = [0.12, 0.85, 1.6];
    const span = Math.max(this.playerScale, this.playerScaleTarget);
    for (let i = 0; i < heights.length; i += 1) {
      const material = new THREE.MeshBasicMaterial({ color: i === 1 ? "#fff1c9" : color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62 * Math.max(0.6, span), 0.025 * Math.max(1, span), 6, 32), material);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(this.playerPosition.x, this.playerPosition.y + heights[i] * span, this.playerPosition.z);
      this.world.add(ring);
      const maxLife = 0.48 + i * 0.07;
      this.sizeEffects.push({ mesh: ring, life: maxLife, maxLife, from: shrinking ? 1.65 : 0.45, to: shrinking ? 0.35 : 1.9 });
    }
  }

  private changeSelfSize(direction: -1 | 1) {
    if (this.elapsed < this.sizeCooldownUntil) return;
    let index = 0;
    for (let i = 1; i < SIZE_LADDER.length; i += 1) {
      if (Math.abs(SIZE_LADDER[i] - this.playerScaleTarget) < Math.abs(SIZE_LADDER[index] - this.playerScaleTarget)) index = i;
    }
    const nextIndex = THREE.MathUtils.clamp(index + direction, 0, SIZE_LADDER.length - 1);
    if (nextIndex === index) {
      this.callbacks.onSound("ui");
      this.callbacks.onWeapon(direction < 0 ? "Already pocket-size — switch to the Grow Ray (5) to grow." : "Already giant-size — switch to the Shrink Ray (4) to shrink.");
      return;
    }
    const nextScale = SIZE_LADDER[nextIndex];
    if (nextScale > this.playerScaleTarget && !this.hasHeadroomFor(nextScale)) {
      this.callbacks.onSound("ui");
      this.callbacks.onWeapon("Not enough headroom to grow here — step into the open.");
      return;
    }
    const shrinking = nextScale < this.playerScaleTarget;
    const color = shrinking ? "#ffc277" : "#a6f08f";
    this.sizeCooldownUntil = this.elapsed + 0.55;
    this.playerScaleTarget = nextScale;
    const start = this.camera.localToWorld(new THREE.Vector3(0.26, -0.24, -0.55));
    this.addBeam(start, this.playerPosition.clone().add(new THREE.Vector3(0, 0.05, 0)), color);
    this.createSizeRings(shrinking, color);
    this.createLandingRipple(this.playerPosition.y, color);
    this.callbacks.onSound(shrinking ? "selfShrink" : "grow");
  }

  private supportsPlayer(hitbox: Hitbox, center: THREE.Vector3, position: THREE.Vector3) {
    if (hitbox.shape === "box") {
      return Math.abs(position.x - center.x) < hitbox.radius + 0.2
        && Math.abs(position.z - center.z) < hitbox.halfDepth + 0.2;
    }
    return Math.hypot(position.x - center.x, position.z - center.z) < hitbox.radius + 0.18;
  }

  private supportHeightAt(position: THREE.Vector3, minY: number, maxY: number) {
    const floor = this.visibleFloorHeight();
    let highest = minY <= floor + 0.03 && maxY >= floor - 0.03 ? floor : -Infinity;
    for (const hitbox of this.hitboxes) {
      if (!hitbox.solid || !hitbox.standable || hitbox.disabled) continue;
      const center = this.hitboxCenter(hitbox);
      const top = this.hitboxYRange(hitbox, center).max;
      if (top < minY - 0.02 || top > maxY + 0.02) continue;
      if (this.supportsPlayer(hitbox, center, position)) highest = Math.max(highest, top);
    }
    return Number.isFinite(highest) ? highest : null;
  }

  private visibleFloorHeight() {
    return this.location === "lizard" ? 0.56 : this.location === "room" ? 0.23 : 0.14;
  }

  private createLandingRipple(height: number, color: string) {
    const geometry = new THREE.TorusGeometry(0.44 * Math.max(0.45, this.playerScale), 0.027, 5, 24);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.65, depthWrite: false });
    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(this.playerPosition.x, Math.max(this.visibleFloorHeight(), height + 0.06), this.playerPosition.z);
    this.world.add(ring);
    this.landingEffects.push({ mesh: ring, life: 0.36 });
  }

  private updateVertical(delta: number) {
    if (this.flying) this.updateFlight(delta);
    else this.updateGravity(delta);
    this.updateGroundEffects(delta);
  }

  private updateGravity(delta: number) {
    if (this.grounded) {
      const support = this.supportHeightAt(this.playerPosition, this.playerPosition.y - 0.09, this.playerPosition.y + 0.09);
      if (support === null) {
        this.grounded = false;
        this.verticalVelocity = 0;
        this.coyoteUntil = this.elapsed + COYOTE_SECONDS;
      } else {
        this.playerPosition.y = support;
      }
    }
    if (!this.grounded) {
      const previousY = this.playerPosition.y;
      this.verticalVelocity -= 21.2 * delta;
      let nextY = previousY + this.verticalVelocity * delta;
      if (this.verticalVelocity > 0) {
        for (const hitbox of this.hitboxes) {
          if (!hitbox.solid || hitbox.disabled) continue;
          const center = this.hitboxCenter(hitbox);
          const bottom = this.hitboxYRange(hitbox, center).min;
          const bodyHeight = this.playerHeight();
          if (previousY + bodyHeight <= bottom && nextY + bodyHeight >= bottom && this.supportsPlayer(hitbox, center, this.playerPosition)) {
            nextY = bottom - bodyHeight;
            this.verticalVelocity = 0;
            break;
          }
        }
      }
      if (this.verticalVelocity <= 0) {
        const support = this.supportHeightAt(this.playerPosition, nextY, previousY + 0.035);
        if (support !== null) {
          this.playerPosition.y = support;
          this.verticalVelocity = 0;
          this.grounded = true;
          if (previousY - support > 0.025) {
            this.callbacks.onSound("land");
            this.createLandingRipple(support, "#ecc787");
          }
          if (this.elapsed <= this.jumpBufferUntil && this.inputEnabled && this.callbacks.canMove()) this.performJump();
        } else {
          this.playerPosition.y = Math.max(-1.5, nextY);
        }
      } else {
        this.playerPosition.y = nextY;
      }
    }
  }

  private updateGroundEffects(delta: number) {
    this.player.position.copy(this.playerPosition);
    if (this.playerShadow) {
      const ground = this.supportHeightAt(this.playerPosition, -2, this.playerPosition.y + 0.02) ?? this.visibleFloorHeight();
      this.playerShadow.position.set(this.playerPosition.x, Math.max(this.visibleFloorHeight(), ground + 0.05), this.playerPosition.z);
      const airborneHeight = Math.max(0, this.playerPosition.y - ground);
      this.playerShadow.scale.set((1 + airborneHeight * 0.18) * this.playerScale, (0.6 + airborneHeight * 0.11) * this.playerScale, 1);
      (this.playerShadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.08, 0.28 - airborneHeight * 0.08);
    }
    for (let i = this.landingEffects.length - 1; i >= 0; i -= 1) {
      const effect = this.landingEffects[i];
      effect.life -= delta;
      effect.mesh.scale.setScalar(1 + (0.36 - effect.life) * 3.5);
      (effect.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, effect.life / 0.36) * 0.65;
      if (effect.life <= 0) {
        this.world.remove(effect.mesh);
        effect.mesh.geometry.dispose();
        (effect.mesh.material as THREE.Material).dispose();
        this.landingEffects.splice(i, 1);
      }
    }
  }

  private movePlayer(delta: number) {
    const forward = Number(this.keys.has("w") || this.keys.has("arrowup")) - Number(this.keys.has("s") || this.keys.has("arrowdown"));
    const strafe = Number(this.keys.has("d") || this.keys.has("arrowright")) - Number(this.keys.has("a") || this.keys.has("arrowleft"));
    if (forward === 0 && strafe === 0) {
      this.player.userData.moving = false;
      return;
    }
    const magnitude = Math.hypot(forward, strafe);
    const moveForward = forward / magnitude;
    const moveRight = strafe / magnitude;
    const dx = -Math.sin(this.viewYaw) * moveForward + Math.cos(this.viewYaw) * moveRight;
    const dz = -Math.cos(this.viewYaw) * moveForward - Math.sin(this.viewYaw) * moveRight;
    const sizeFactor = this.piloting ? 1.25 : 0.45 + 0.55 * this.playerScale;
    const speed = (this.flying ? FLY_HORIZONTAL_SPEED : this.keys.has("shift") ? 9.5 : 6.1) * sizeFactor;
    const next = this.playerPosition.clone();
    next.x += dx * speed * delta;
    next.z += dz * speed * delta;
    this.clampWorldPosition(next);
    this.resolvePlayerCollision(next);
    this.player.userData.moving = next.distanceToSquared(this.playerPosition) > 0.000001;
    this.playerPosition.copy(next);
    this.player.position.copy(this.playerPosition);
    this.player.rotation.y = this.viewYaw;
  }

  setFirstPersonActive(active: boolean) {
    this.firstPersonActive = active;
    this.player.visible = !active;
    this.updateViewModelVisibility();
    this.updateCameraFov();
    if (active) {
      this.camera.position.set(this.playerPosition.x, this.playerPosition.y + this.eyeHeight(), this.playerPosition.z);
      this.camera.rotation.set(this.viewPitch, this.viewYaw, 0, "YXZ");
      this.camera.updateMatrixWorld();
    }
  }

  setLookSettings(sensitivity: number, invertY: boolean) {
    this.lookSensitivity = THREE.MathUtils.clamp(sensitivity, 0.0008, 0.006);
    this.invertLookY = invertY;
  }

  look(deltaX: number, deltaY: number) {
    if (!this.firstPersonActive || !this.inputEnabled || !this.callbacks.canMove()) return;
    this.viewYaw -= deltaX * this.lookSensitivity;
    this.viewPitch = THREE.MathUtils.clamp(this.viewPitch + deltaY * this.lookSensitivity * (this.invertLookY ? 1 : -1), -1.5, 1.5);
    this.camera.rotation.set(this.viewPitch, this.viewYaw, 0, "YXZ");
    this.camera.updateMatrixWorld();
    this.player.rotation.y = this.viewYaw;
  }

  setInputEnabled(enabled: boolean) {
    this.inputEnabled = enabled;
    if (!enabled) {
      this.keys.clear();
      this.triggerHeld = false;
    }
  }

  setKeys(keys: Set<string>) {
    this.keys = keys;
  }

  setPointer(x: number, y: number) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set((x / Math.max(1, rect.width)) * 2 - 1, -(y / Math.max(1, rect.height)) * 2 + 1);
  }

  setActiveTool(id: string) {
    this.activeTool = id;
    const tool = ALL_TOOLS.find((item) => item.id === id) ?? ALL_TOOLS[0];
    if (this.viewModelAccent) {
      this.viewModelAccent.color.set(tool.color);
      this.viewModelAccent.emissive.set(tool.color);
    }
    this.updateViewModelVisibility();
  }

  getLocation() {
    return this.location;
  }

  getRoomIndex() {
    return this.roomIndex;
  }

  getPosition() {
    return this.playerPosition.clone();
  }

  getTargetCount() {
    return this.targetCount;
  }

  goTo(location: GameLocation, roomIndex = this.roomIndex) {
    this.buildWorld(location, roomIndex);
  }

  loadCheckpoint(location: GameLocation, roomIndex: number) {
    this.playerScale = 1;
    this.playerScaleTarget = 1;
    this.sizeCooldownUntil = 0;
    this.buildWorld(location, roomIndex);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    window.removeEventListener("resize", this.resize);
    this.releaseWorld();
    this.renderer.dispose();
  }

  private releaseWorld() {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    this.world.traverse((object) => {
      const drawable = object as THREE.Object3D & { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] };
      if (drawable.geometry) geometries.add(drawable.geometry);
      if (!drawable.material) return;
      const assigned = Array.isArray(drawable.material) ? drawable.material : [drawable.material];
      for (const material of assigned) {
        materials.add(material);
        const mapped = material as THREE.Material & { map?: THREE.Texture | null };
        if (mapped.map) textures.add(mapped.map);
      }
    });
    for (const geometry of this.cachedGeometry.values()) geometries.add(geometry);
    for (const material of this.cachedMaterials.values()) materials.add(material);
    for (const material of this.sparkMaterials.values()) materials.add(material);
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    this.beamLines = [];
    this.cachedMaterials.clear();
    this.sparkMaterials.clear();
    this.cachedGeometry.clear();
    this.world.clear();
    this.targets = [];
    this.walkers = [];
    this.npcs = [];
    this.mechs = [];
    this.animated = [];
    this.interactables = [];
    this.hitboxes = [];
    this.projectiles = [];
    this.debugMeshes = [];
    this.debugMaterials = [];
    this.landingEffects = [];
    this.placedDreamcores = [];
    this.pilotedDreamcore = null;
    this.sizeEffects = [];
    this.impactEffects = [];
    this.drivableMech = null;
    this.mechCockpit = null;
    this.mechCannons = [];
    this.mechFlashes = [];
    this.saberGrip = null;
    this.saberBlade = null;
    this.playerHitbox = null;
    this.playerShadow = null;
    this.playerParts = null;
    this.viewModel = null;
    this.viewModelGrip = null;
    this.viewModelAccent = null;
  }

  private buildWorld(location: GameLocation, roomIndex: number) {
    this.releaseWorld();
    this.verticalVelocity = 0;
    this.grounded = true;
    this.jumpBufferUntil = -1;
    this.coyoteUntil = -1;
    this.flying = false;
    this.triggerHeld = false;
    this.mechGunSide = 0;
    this.playerScale = this.playerScaleTarget;
    this.location = location;
    this.viewYaw = location === "surface" ? Math.atan2(SURFACE_START.x - SURFACE_ELEVATOR.x, SURFACE_START.z - SURFACE_ELEVATOR.z) : 0;
    this.viewPitch = -0.035;
    this.roomIndex = Math.max(0, Math.min(99, Math.floor(roomIndex)));
    this.targetCount = 0;
    this.callbacks.onTargets(0);
    if (location === "surface") this.buildSurface();
    else if (location === "lizard") this.buildLizardTown();
    else this.buildRoom(this.roomIndex);
    this.playerPosition.y = this.visibleFloorHeight();
    this.buildPlayer();
    this.player.position.copy(this.playerPosition);
    this.world.add(this.player);
    this.playerHitbox = this.registerHitbox({
      owner: "player",
      objectId: "player",
      shape: "cylinder",
      center: this.playerPosition.clone(),
      radius: 0.45,
      halfDepth: 0.45,
      minY: this.playerPosition.y,
      maxY: this.playerPosition.y + 2.1,
      solid: false,
      dynamic: () => this.playerPosition.clone(),
    });
    this.buildViewModel();
    this.applyPlayerScale();
    const wasPiloting = this.piloting;
    this.piloting = false;
    if (this.mechUnlocked) {
      this.spawnDrivableMech(wasPiloting);
      if (wasPiloting) this.enterMech(true);
    }
    this.updateViewModelVisibility();
  }

  private geometry(key: string, create: () => THREE.BufferGeometry) {
    const existing = this.cachedGeometry.get(key);
    if (existing) return existing;
    const value = create();
    this.cachedGeometry.set(key, value);
    return value;
  }

  private material(color: number | string, settings: Partial<THREE.MeshStandardMaterialParameters> = {}) {
    const key = `${String(color)}|${settings.roughness ?? 0.72}|${settings.metalness ?? 0.03}|${settings.emissive ?? ""}|${settings.emissiveIntensity ?? 0}|${settings.transparent ? 1 : 0}|${settings.opacity ?? 1}`;
    let value = this.cachedMaterials.get(key);
    if (!value) {
      value = new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.03, ...settings });
      this.cachedMaterials.set(key, value);
    }
    return value;
  }

  private objectId(prefix = "obj") {
    this.nextObjectId += 1;
    return `${prefix}-${this.nextObjectId}`;
  }

  private registerHitbox(hitbox: Omit<Hitbox, "id"> & { id?: string }) {
    const record: Hitbox = { id: hitbox.id ?? this.objectId("hitbox"), ...hitbox };
    this.hitboxes.push(record);
    if (this.debugHitboxes) this.addDebugMesh(record);
    return record;
  }

  private addDebugMesh(hitbox: Hitbox) {
    const center = this.hitboxCenter(hitbox);
    const bounds = this.hitboxYRange(hitbox, center);
    const height = Math.max(0.08, bounds.max - bounds.min);
    const radius = Math.max(0.02, hitbox.radius);
    const depth = Math.max(0.02, hitbox.halfDepth);
    const geometry = hitbox.shape === "box"
      ? new THREE.BoxGeometry(radius * 2, height, depth * 2)
      : new THREE.CylinderGeometry(radius, radius, height, 12, 1, true);
    const color = hitbox.owner === "player" ? "#f9d48e"
      : hitbox.owner === "npc" ? "#f0a4c4"
        : hitbox.owner === "target" ? "#92f5ca"
          : hitbox.owner === "projectile" ? "#ffe39b"
            : hitbox.solid ? "#77d9ee" : "#a9a0f4";
    const material = new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.58, depthTest: false, depthWrite: false });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 100;
    mesh.position.set(center.x, (bounds.min + bounds.max) / 2, center.z);
    this.world.add(mesh);
    this.debugMaterials.push(material);
    this.debugMeshes.push({ hitbox, mesh, radius, depth, height });
  }

  setHitboxDebug(enabled: boolean) {
    if (this.debugHitboxes === enabled) return this.debugHitboxes;
    this.debugHitboxes = enabled;
    if (enabled) {
      for (const hitbox of this.hitboxes) this.addDebugMesh(hitbox);
    } else {
      for (const entry of this.debugMeshes) {
        this.world.remove(entry.mesh);
        entry.mesh.geometry.dispose();
      }
      for (const material of this.debugMaterials) material.dispose();
      this.debugMeshes = [];
      this.debugMaterials = [];
    }
    return this.debugHitboxes;
  }

  toggleHitboxDebug() {
    return this.setHitboxDebug(!this.debugHitboxes);
  }

  private updateDebugMeshes() {
    if (!this.debugHitboxes) return;
    for (const entry of this.debugMeshes) {
      entry.mesh.visible = !entry.hitbox.disabled;
      const center = this.hitboxCenter(entry.hitbox);
      const bounds = this.hitboxYRange(entry.hitbox, center);
      entry.mesh.position.set(center.x, (bounds.min + bounds.max) / 2, center.z);
      entry.mesh.scale.set(entry.hitbox.radius / entry.radius, Math.max(0.08, bounds.max - bounds.min) / entry.height, entry.hitbox.halfDepth / entry.depth);
    }
  }

  private registerObjectHitbox(
    object: THREE.Object3D,
    objectId: string,
    radius: number,
    height: number,
    yOffset = height / 2,
    owner: HitboxOwner = "prop",
    solid = true,
    standable = false,
  ) {
    const center = object.getWorldPosition(new THREE.Vector3());
    return this.registerHitbox({
      owner,
      objectId,
      shape: "cylinder",
      center,
      radius,
      halfDepth: radius,
      minY: center.y + yOffset - height / 2,
      maxY: center.y + yOffset + height / 2,
      solid,
      standable,
      dynamic: () => {
        const next = object.getWorldPosition(new THREE.Vector3());
        return next;
      },
    });
  }

  private registerInteractableHitboxes() {
    for (const item of this.interactables) {
      this.registerHitbox({
        owner: "interactable",
        objectId: item.id,
        shape: "cylinder",
        center: item.position.clone(),
        radius: item.range,
        halfDepth: item.range,
        minY: 0,
        maxY: 3.2,
        solid: false,
        dynamic: () => {
          const found = this.interactables.find((entry) => entry.id === item.id);
          return (found?.position ?? item.position).clone();
        },
      });
    }
  }

  private hitboxCenter(hitbox: Hitbox) {
    return hitbox.dynamic ? hitbox.dynamic() : hitbox.center;
  }

  private hitboxYRange(hitbox: Hitbox, center: THREE.Vector3) {
    const shift = hitbox.dynamic ? center.y - hitbox.center.y : 0;
    return { min: hitbox.minY + shift, max: hitbox.maxY + shift };
  }

  private raycastHitboxes(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    owners?: HitboxOwner[],
  ): HitboxHit | null {
    let closest: HitboxHit | null = null;
    for (const hitbox of this.hitboxes) {
      if (hitbox.disabled || (owners && !owners.includes(hitbox.owner))) continue;
      const center = this.hitboxCenter(hitbox);
      const height = this.hitboxYRange(hitbox, center);
      let distance = Number.POSITIVE_INFINITY;
      if (hitbox.shape === "cylinder") {
        const ox = origin.x - center.x;
        const oz = origin.z - center.z;
        const a = direction.x * direction.x + direction.z * direction.z;
        const b = 2 * (ox * direction.x + oz * direction.z);
        const c = ox * ox + oz * oz - hitbox.radius * hitbox.radius;
        if (c <= 0 && origin.y >= height.min && origin.y <= height.max) distance = 0;
        if (a > 0.000001) {
          const discriminant = b * b - 4 * a * c;
          if (discriminant >= 0) {
            const root = Math.sqrt(discriminant);
            for (const t of [(-b - root) / (2 * a), (-b + root) / (2 * a)]) {
              const y = origin.y + t * direction.y;
              if (t >= 0 && t <= maxDistance && y >= height.min && y <= height.max) distance = Math.min(distance, t);
            }
          }
        }
        if (Math.abs(direction.y) > 0.000001) {
          for (const y of [height.min, height.max]) {
            const t = (y - origin.y) / direction.y;
            const xAt = ox + direction.x * t;
            const zAt = oz + direction.z * t;
            if (t >= 0 && t <= maxDistance && xAt * xAt + zAt * zAt <= hitbox.radius * hitbox.radius) distance = Math.min(distance, t);
          }
        }
      } else {
        let near = 0;
        let far = maxDistance;
        const axes: [number, number, number, number][] = [
          [origin.x, direction.x, center.x - hitbox.radius, center.x + hitbox.radius],
          [origin.y, direction.y, height.min, height.max],
          [origin.z, direction.z, center.z - hitbox.halfDepth, center.z + hitbox.halfDepth],
        ];
        for (const [start, step, min, max] of axes) {
          if (Math.abs(step) < 0.000001) {
            if (start < min || start > max) { near = Number.POSITIVE_INFINITY; break; }
            continue;
          }
          const first = (min - start) / step;
          const second = (max - start) / step;
          near = Math.max(near, Math.min(first, second));
          far = Math.min(far, Math.max(first, second));
          if (near > far) break;
        }
        if (near <= far && near <= maxDistance) distance = near;
      }
      if (Number.isFinite(distance) && distance <= maxDistance && (!closest || distance < closest.distance)) {
        closest = { hitbox, distance, point: origin.clone().addScaledVector(direction, distance) };
      }
    }
    return closest;
  }

  private clampWorldPosition(position: THREE.Vector3) {
    if (this.location === "room") {
      position.x = THREE.MathUtils.clamp(position.x, -12.55, 12.55);
      position.z = THREE.MathUtils.clamp(position.z, -12.35, 10.45);
    } else if (this.location === "lizard") {
      const radius = Math.hypot(position.x, position.z);
      if (radius > 44) {
        position.x *= 44 / radius;
        position.z *= 44 / radius;
      }
    } else {
      position.x = THREE.MathUtils.clamp(position.x, -51, 51);
      position.z = THREE.MathUtils.clamp(position.z, -51, 51);
    }
    return position;
  }

  private resolvePlayerCollision(position: THREE.Vector3) {
    return this.resolveCollision(position, this.playerRadius(), this.playerHeight());
  }

  private resolveCollision(position: THREE.Vector3, playerRadius: number, bodyHeight: number) {
    for (let iteration = 0; iteration < 2; iteration += 1) {
      for (const hitbox of this.hitboxes) {
        if (!hitbox.solid || hitbox.disabled || hitbox.owner === "player" || hitbox.owner === "projectile" || hitbox.owner === "interactable") continue;
        const center = this.hitboxCenter(hitbox);
        const height = this.hitboxYRange(hitbox, center);
        if (position.y >= height.max - 0.025 || position.y + bodyHeight <= height.min + 0.025) continue;
        if (hitbox.shape === "box") {
          const minX = center.x - hitbox.radius;
          const maxX = center.x + hitbox.radius;
          const minZ = center.z - hitbox.halfDepth;
          const maxZ = center.z + hitbox.halfDepth;
          const closestX = THREE.MathUtils.clamp(position.x, minX, maxX);
          const closestZ = THREE.MathUtils.clamp(position.z, minZ, maxZ);
          const inside = position.x > minX && position.x < maxX && position.z > minZ && position.z < maxZ;
          if (inside) {
            const pushLeft = position.x - minX;
            const pushRight = maxX - position.x;
            const pushBack = position.z - minZ;
            const pushFront = maxZ - position.z;
            const smallest = Math.min(pushLeft, pushRight, pushBack, pushFront);
            if (smallest === pushLeft) position.x = minX - playerRadius - 0.015;
            else if (smallest === pushRight) position.x = maxX + playerRadius + 0.015;
            else if (smallest === pushBack) position.z = minZ - playerRadius - 0.015;
            else position.z = maxZ + playerRadius + 0.015;
          } else {
            const dx = position.x - closestX;
            const dz = position.z - closestZ;
            const distance = Math.hypot(dx, dz);
            if (distance < playerRadius && distance > 0.0001) {
              position.x = closestX + (dx / distance) * (playerRadius + 0.015);
              position.z = closestZ + (dz / distance) * (playerRadius + 0.015);
            } else if (distance <= 0.0001) {
              position.x = closestX + playerRadius + 0.015;
            }
          }
        } else {
          const dx = position.x - center.x;
          const dz = position.z - center.z;
          const overlap = hitbox.radius + playerRadius - Math.hypot(dx, dz);
          if (overlap > 0) {
            if (Math.abs(dx) + Math.abs(dz) > 0.001) {
              const length = Math.hypot(dx, dz);
              position.x = center.x + (dx / length) * (hitbox.radius + playerRadius + 0.015);
              position.z = center.z + (dz / length) * (hitbox.radius + playerRadius + 0.015);
            } else {
              position.x = center.x + hitbox.radius + playerRadius + 0.015;
            }
          }
        }
      }
      this.clampWorldPosition(position);
    }
    return position;
  }

  private box(width: number, height: number, depth: number, color: number | string, x: number, y: number, z: number, settings: Partial<THREE.MeshStandardMaterialParameters> = {}) {
    const key = `box:${width.toFixed(3)}:${height.toFixed(3)}:${depth.toFixed(3)}`;
    const mesh = new THREE.Mesh(this.geometry(key, () => new THREE.BoxGeometry(width, height, depth)), this.material(color, settings));
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    this.world.add(mesh);
    return mesh;
  }

  private cylinder(radiusTop: number, radiusBottom: number, height: number, color: number | string, x: number, y: number, z: number, radialSegments = 16, settings: Partial<THREE.MeshStandardMaterialParameters> = {}) {
    const key = `cylinder:${radiusTop}:${radiusBottom}:${height}:${radialSegments}`;
    const mesh = new THREE.Mesh(this.geometry(key, () => new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments)), this.material(color, settings));
    mesh.position.set(x, y, z);
    this.world.add(mesh);
    return mesh;
  }

  private sphere(radius: number, color: number | string, x: number, y: number, z: number, segments = 12, settings: Partial<THREE.MeshStandardMaterialParameters> = {}) {
    const key = `sphere:${radius}:${segments}`;
    const mesh = new THREE.Mesh(this.geometry(key, () => new THREE.SphereGeometry(radius, segments, Math.max(8, segments - 2))), this.material(color, settings));
    mesh.position.set(x, y, z);
    this.world.add(mesh);
    return mesh;
  }

  private torus(radius: number, tube: number, color: number | string, x: number, y: number, z: number, segments = 48, settings: Partial<THREE.MeshStandardMaterialParameters> = {}) {
    const key = `torus:${radius}:${tube}:${segments}`;
    const mesh = new THREE.Mesh(this.geometry(key, () => new THREE.TorusGeometry(radius, tube, 8, segments)), this.material(color, settings));
    mesh.position.set(x, y, z);
    this.world.add(mesh);
    return mesh;
  }

  private light(color: number | string, intensity: number, position: THREE.Vector3, distance = 80) {
    const lamp = new THREE.PointLight(color, intensity, distance, 2);
    lamp.position.copy(position);
    this.world.add(lamp);
    return lamp;
  }

  private basicPlane(width: number, height: number, color: number | string, x: number, y: number, z: number, opacity = 1) {
    const material = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(x, y, z);
    this.world.add(plane);
    return plane;
  }

  private addSky(top: string, horizon: string, bottom: string) {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 512;
    const context = canvas.getContext("2d");
    if (context) {
      const gradient = context.createLinearGradient(0, 0, 0, 512);
      gradient.addColorStop(0, top);
      gradient.addColorStop(0.55, horizon);
      gradient.addColorStop(1, bottom);
      context.fillStyle = gradient;
      context.fillRect(0, 0, 16, 512);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(280, 22, 16), new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, depthWrite: false }));
    dome.renderOrder = -10;
    this.world.add(dome);
  }

  private label(text: string, x: number, y: number, z: number, width = 3.5, tint = "#9af6ec") {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 192;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(4, 16, 24, 0.85)";
    context.beginPath();
    context.roundRect(20, 15, 728, 160, 30);
    context.fill();
    context.strokeStyle = `${tint}80`;
    context.lineWidth = 5;
    context.stroke();
    context.font = "600 48px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = tint;
    context.fillText(text.toUpperCase(), canvas.width / 2, 96, 680);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.position.set(x, y, z);
    sprite.scale.set(width, width * 0.25, 1);
    this.world.add(sprite);
  }

  private addRingMesh(radius: number, tube: number, color: string | number, x: number, y: number, z: number, rotationY = 0, scaleY = 1, opacity = 1) {
    const ring = new THREE.Mesh(
      this.geometry(`torus:${radius}:${tube}:48`, () => new THREE.TorusGeometry(radius, tube, 8, 48)),
      new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity }),
    );
    ring.position.set(x, y, z);
    ring.rotation.set(0, rotationY, 0);
    ring.scale.y = scaleY;
    this.world.add(ring);
    return ring;
  }

  private setAtmosphere(background: string, fog: string, near: number, far: number, ambient: number, sun: number) {
    this.scene.background = new THREE.Color(background);
    this.scene.fog = new THREE.Fog(fog, near, far);
    this.world.add(new THREE.HemisphereLight(0xe5f1ff, 0x58766e, ambient));
    const directional = new THREE.DirectionalLight(0xffefd5, sun);
    directional.position.set(-30, 50, 40);
    this.world.add(directional);
  }

  private floor(size: number, color: string | number, y = -0.12, roughness = 0.9, metalness = 0) {
    const key = `floor:${size}`;
    const mesh = new THREE.Mesh(
      this.geometry(key, () => new THREE.PlaneGeometry(size, size)),
      this.material(color, { roughness, metalness }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    this.world.add(mesh);
    this.registerHitbox({
      owner: "terrain", objectId: this.objectId("floor"), shape: "box",
      center: new THREE.Vector3(0, y, 0), radius: size / 2, halfDepth: size / 2,
      minY: y - 0.04, maxY: y + 0.04, solid: false,
    });
    return mesh;
  }

  private buildSurface() {
    this.playerPosition.copy(SURFACE_START);
    this.setAtmosphere("#a8c3c5", "#b9c4b2", 74, 220, 1.3, 2.3);
    this.addSky("#253e55", "#f2b993", "#a9c0af");
    this.floor(220, "#738468", -0.17, 0.96);

    for (let i = 0; i < 12; i += 1) {
      const angle = (Math.PI * 2 * i) / 12;
      const radius = 102 + (i % 3) * 13;
      const hill = new THREE.Mesh(
        this.geometry(`mountain:${i % 3}`, () => new THREE.ConeGeometry(26 + (i % 3) * 10, 27 + (i % 3) * 11, 5 + (i % 4))),
        this.material(i % 3 === 0 ? "#64796e" : i % 3 === 1 ? "#899184" : "#6d817e", { roughness: 1 }),
      );
      hill.position.set(Math.sin(angle) * radius, 7 + (i % 3) * 3, Math.cos(angle) * radius);
      hill.rotation.y = angle * 0.3;
      this.world.add(hill);
    }

    this.box(140, 0.09, 4.3, "#4b504a", 0, 0.02, 18);
    this.box(136, 0.035, 0.11, "#d9bd82", 0, 0.08, 18);
    this.box(4.3, 0.09, 115, "#535750", -29, 0.025, 1);
    this.box(0.1, 0.035, 112, "#d9bd82", -29, 0.08, 0);
    for (let i = -5; i <= 5; i += 1) {
      this.box(3.4, 0.035, 0.11, "#e7c37e", i * 12, 0.085, 18);
      this.box(0.1, 0.035, 3.5, "#e7c37e", -29, 0.09, i * 12);
    }

    const buildingColors = ["#dcdfcf", "#e7ccae", "#c7d6cb", "#ddceb5", "#bfc8c0", "#d8c3bb", "#d2d7c9"];
    let seed = 47;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let row = -4; row <= 4; row += 1) {
      for (let col = -4; col <= 4; col += 1) {
        const x = col * 12.2 + (random() - 0.5) * 2.2;
        const z = row * 11.2 - 2 + (random() - 0.5) * 2;
        if ((Math.abs(x + 3.5) < 10 && Math.abs(z + 10) < 12) || Math.abs(z - 18) < 5 || Math.abs(x + 29) < 5) continue;
        const width = 4.7 + random() * 2.8;
        const depth = 4.5 + random() * 2.2;
        const height = 2.8 + random() * 3;
        const color = buildingColors[Math.floor(random() * buildingColors.length)];
        this.buildTownHouse(x, z, width, height, depth, color, random() > 0.42);
      }
    }

    for (let i = 0; i < 31; i += 1) {
      const angle = i * 2.39996;
      const radius = 22 + (i % 6) * 5.8;
      const x = Math.cos(angle) * radius + 4;
      const z = Math.sin(angle) * radius + 4;
      if (Math.abs(x + 3.5) < 14 && Math.abs(z + 10) < 15) continue;
      this.cylinder(0.11, 0.17, 1.15, "#776b58", x, 0.57, z, 7);
      const canopy = this.sphere(0.9 + (i % 3) * 0.18, i % 4 === 0 ? "#78866d" : "#687c64", x, 1.62, z, 9, { roughness: 0.92 });
      canopy.scale.set(1.1, 1.45, 1.04);
      this.registerHitbox({
        owner: "prop",
        objectId: this.objectId("tree"),
        shape: "cylinder",
        center: new THREE.Vector3(x, 0, z),
        radius: 0.72,
        halfDepth: 0.72,
        minY: 0,
        maxY: 2.35,
        solid: true,
      });
      this.animated.push({ object: canopy, baseY: 1.62, speed: 0.22 + (i % 4) * 0.035, phase: i * 1.3, mode: "swing" });
    }

    this.buildSurfaceDetails();
    this.buildGlassTower();
    this.buildTownHall();
    const neighborNames = ["Mara", "Eli", "June", "Sol", "Nico", "Bea", "Milo"];
    for (let i = 0; i < 7; i += 1) {
      const x = (i % 4) * 7 - 17 + (i % 2) * 2;
      const z = 13 + Math.floor(i / 4) * 7;
      const npc = this.buildCharacter(i % 3 === 0 ? "#d17b4f" : i % 3 === 1 ? "#e6c8a6" : "#9a7456", i % 2 === 0 ? "#ed8766" : "#6cb4a2", false);
      npc.position.set(x, 0, z);
      npc.scale.setScalar(0.7 + (i % 3) * 0.05);
      this.world.add(npc);
      const walker: Walker = { actor: npc, from: npc.position.clone(), to: npc.position.clone().add(new THREE.Vector3((i % 2 ? 1 : -1) * 3, 0, 2)), speed: 0.16 + (i % 4) * 0.035, elapsed: 0, phase: i * 1.7 };
      this.walkers.push(walker);
      this.registerNpc(npc, `neighbor-${i}`, neighborNames[i], walker);
    }

    this.interactables.push({ kind: "elevator", id: "glass-elevator", label: "Descend to Lizard Town", position: SURFACE_ELEVATOR.clone(), range: 5.4 });
    this.label("Walsenburg · Huerfano County", 15, 4.8, 17, 9.4, "#f5dfad");
    this.light("#74e8eb", 2.5, new THREE.Vector3(-3.5, 16, -10), 62);
    this.light("#f6b786", 1.5, new THREE.Vector3(13, 10, 18), 34);
    this.registerInteractableHitboxes();
  }

  private buildTownHouse(x: number, z: number, width: number, height: number, depth: number, color: string, hasRoof: boolean) {
    this.box(width + 0.17, 0.28, depth + 0.17, "#6c6860", x, 0.14, z);
    this.box(width, height, depth, color, x, height / 2 + 0.3, z, { roughness: 0.9 });
    this.box(width + 0.12, 0.22, 0.14, "#857c6c", x, 0.41, z + depth * 0.51, { roughness: 0.85 });
    this.box(width + 0.18, 0.12, 0.24, "#eee0c5", x, height + 0.33, z + depth * 0.5, { roughness: 0.79 });
    const roofColor = hasRoof ? "#805e4b" : "#7e8980";
    if (hasRoof) {
      const roof = new THREE.Mesh(
        this.geometry(`roof:${width.toFixed(1)}:${depth.toFixed(1)}`, () => new THREE.ConeGeometry(Math.max(width, depth) * 0.83, Math.max(1.1, height * 0.42), 4)),
        this.material(roofColor, { roughness: 0.94 }),
      );
      roof.position.set(x, height + 0.62, z);
      roof.rotation.y = Math.PI / 4;
      this.world.add(roof);
      this.box(0.54, 1.4, 0.54, "#897061", x + width * 0.27, height + 1.12, z - depth * 0.12, { roughness: 0.92 });
      this.box(0.66, 0.12, 0.66, "#6b5a50", x + width * 0.27, height + 1.82, z - depth * 0.12, { roughness: 0.9 });
    } else {
      this.box(width + 0.32, 0.2, depth + 0.32, "#85847a", x, height + 0.44, z);
      this.box(0.12, 0.35, depth + 0.12, "#eee0bd", x, height + 0.7, z);
    }
    this.box(width * 0.18, height * 0.54, 0.12, "#334953", x, height * 0.48 + 0.25, z + depth * 0.504, { metalness: 0.15, roughness: 0.37 });
    this.box(width * 0.2, 0.12, 0.18, "#ead9b8", x, height * 0.77 + 0.3, z + depth * 0.52, { roughness: 0.64 });
    this.sphere(0.055, "#e3bd78", x + width * 0.055, height * 0.48 + 0.22, z + depth * 0.57, 8, { metalness: 0.7, roughness: 0.2 });
    if (width > 5.2) {
      for (const side of [-1, 1]) {
        const windowX = x + side * width * 0.25;
        const windowY = height * 0.64 + 0.25;
        this.box(0.86, 0.8, 0.1, side < 0 ? "#89b9b7" : "#e2b77e", windowX, windowY, z + depth * 0.51, { emissive: side < 0 ? "#245b5a" : "#65491e", emissiveIntensity: 0.16, roughness: 0.25 });
        this.box(0.055, 0.82, 0.06, "#eee1c4", windowX, windowY, z + depth * 0.57, { roughness: 0.62 });
        this.box(0.88, 0.055, 0.06, "#eee1c4", windowX, windowY, z + depth * 0.57, { roughness: 0.62 });
        this.box(1.02, 0.1, 0.22, "#9b8062", windowX, windowY - 0.49, z + depth * 0.56, { roughness: 0.78 });
      }
    }
    this.box(width * 0.28, 0.16, 0.22, "#8f8069", x, 0.1, z + depth * 0.56, { roughness: 0.8 });
    for (const side of [-1, 1]) this.box(0.08, 0.34, 0.1, "#d8c9a7", x + side * width * 0.08, 0.72, z + depth * 0.58, { roughness: 0.72 });
    this.registerHitbox({
      owner: "prop",
      objectId: this.objectId("house"),
      shape: "box",
      center: new THREE.Vector3(x, height / 2 + 0.3, z),
      radius: width / 2,
      halfDepth: depth / 2,
      minY: 0,
      maxY: height + 1.15,
      solid: true,
    });
  }

  private buildSurfaceDetails() {
    // Sidewalks and curbs clarify the town grid without expensive texture maps.
    this.box(140, 0.12, 1.35, "#a49f90", 0, 0.08, 14.95, { roughness: 0.98 });
    this.box(140, 0.12, 1.35, "#aaa596", 0, 0.08, 21.05, { roughness: 0.98 });
    this.box(1.35, 0.12, 115, "#a6a193", -25.95, 0.08, 1, { roughness: 0.98 });
    this.box(1.35, 0.12, 115, "#9f9b8e", -32.05, 0.08, 1, { roughness: 0.98 });
    for (let i = -3; i <= 3; i += 1) {
      this.box(1.25, 0.025, 3.4, "#eee6cf", i * 1.82 - 3, 0.12, 18, { emissive: "#746e60", emissiveIntensity: 0.04 });
      this.box(3.35, 0.025, 1.22, "#eee6cf", -29, 0.12, i * 1.8 + 18, { emissive: "#746e60", emissiveIntensity: 0.04 });
    }

    const lampLocations = [
      [-18, 14.2], [-6, 21.7], [17, 14.2], [31, 21.7], [-25.2, -18], [-32.8, -4], [-25.2, 31], [-32.8, 39],
    ];
    for (let i = 0; i < lampLocations.length; i += 1) {
      const [x, z] = lampLocations[i];
      this.cylinder(0.075, 0.12, 3.2, "#38484a", x, 1.65, z, 9, { metalness: 0.65, roughness: 0.3 });
      this.box(0.65, 0.08, 0.1, "#4e5a59", x + 0.24, 3.18, z, { metalness: 0.55 });
      const bulb = this.sphere(0.18, "#f0d6a4", x + 0.52, 3.12, z, 10, { emissive: "#f4bd78", emissiveIntensity: 0.72, roughness: 0.25 });
      this.cylinder(0.21, 0.28, 0.12, "#59605b", x, 0.1, z, 10, { metalness: 0.42 });
      this.registerHitbox({
        owner: "prop",
        objectId: this.objectId("lamp"),
        shape: "cylinder",
        center: new THREE.Vector3(x, 0, z),
        radius: 0.34,
        halfDepth: 0.34,
        minY: 0,
        maxY: 3.35,
        solid: true,
      });
      this.animated.push({ object: bulb, baseY: 3.12, speed: 0.45 + i * 0.03, phase: i, mode: "pulse" });
    }

    this.buildVehicle(-13, 0.18, 16.2, "#47737b", 0.12);
    this.buildVehicle(20, 0.18, 19.8, "#a96b51", Math.PI + 0.08);
    this.buildVehicle(-27.2, 0.18, 32, "#d2c09b", Math.PI / 2);

    const supplies = [
      { x: 7, z: 1.4, height: 0.58 },
      { x: 8.3, z: 3.9, height: 1.02 },
      { x: 7, z: 6.1, height: 1.48 },
    ];
    for (let i = 0; i < supplies.length; i += 1) {
      const supply = supplies[i];
      this.box(1.35, supply.height, 1.35, i % 2 ? "#756957" : "#667870", supply.x, supply.height / 2 + 0.13, supply.z, { roughness: 0.69, metalness: 0.24 });
      this.box(1.38, 0.09, 1.38, "#c4b493", supply.x, supply.height + 0.18, supply.z, { metalness: 0.39, roughness: 0.42 });
      for (const side of [-1, 1]) this.box(0.07, supply.height * 0.72, 0.09, "#dfc08b", supply.x + side * 0.47, supply.height * 0.51, supply.z + 0.69, { metalness: 0.42 });
      const lamp = this.sphere(0.11, i % 2 ? "#a6f3d9" : "#f0cb8f", supply.x, supply.height + 0.25, supply.z, 8, { emissive: i % 2 ? "#72eacc" : "#dfab60", emissiveIntensity: 0.75 });
      this.animated.push({ object: lamp, baseY: lamp.position.y, speed: 0.48 + i * 0.11, phase: i, mode: "pulse" });
      this.registerHitbox({
        owner: "prop", objectId: this.objectId("field-supply"), shape: "box",
        center: new THREE.Vector3(supply.x, supply.height / 2, supply.z),
        radius: 0.7, halfDepth: 0.7, minY: 0,
        maxY: supply.height + 0.23, solid: true, standable: true,
      });
    }

    for (const x of [-20, 13, 33]) {
      this.box(2.35, 0.12, 0.55, "#765e44", x, 0.68, 13.8, { roughness: 0.85 });
      this.box(0.12, 0.58, 0.45, "#414847", x - 0.83, 0.35, 13.8, { metalness: 0.48 });
      this.box(0.12, 0.58, 0.45, "#414847", x + 0.83, 0.35, 13.8, { metalness: 0.48 });
      this.box(2.35, 0.08, 0.48, "#836b4d", x, 1.05, 14.02, { roughness: 0.86 });
      this.registerHitbox({
        owner: "prop",
        objectId: this.objectId("bench"),
        shape: "box",
        center: new THREE.Vector3(x, 0, 13.9),
        radius: 1.17,
        halfDepth: 0.47,
        minY: 0,
        maxY: 1.15,
        solid: true,
        standable: true,
      });
    }

    this.cylinder(0.13, 0.18, 1.45, "#4a5551", 39, 0.73, 14.6, 9, { metalness: 0.45 });
    this.box(2.8, 0.76, 0.13, "#b79b6d", 39, 1.68, 14.6, { roughness: 0.54, metalness: 0.12 });
    this.label("DOWNTOWN · 0.2 MI", 39, 1.7, 14.45, 2.55, "#f4dfb1");
    this.registerHitbox({
      owner: "prop",
      objectId: this.objectId("sign"),
      shape: "cylinder",
      center: new THREE.Vector3(39, 0, 14.6),
      radius: 0.32,
      halfDepth: 0.32,
      minY: 0,
      maxY: 2.1,
      solid: true,
    });
    this.cylinder(0.15, 0.22, 0.8, "#ac5547", 28, 0.42, 14.45, 10, { metalness: 0.32, roughness: 0.55 });
    this.sphere(0.19, "#c66551", 28, 0.86, 14.45, 10, { metalness: 0.25 });
    this.box(0.55, 0.1, 0.38, "#d2b47e", 28, 0.2, 14.45, { metalness: 0.38 });
    this.registerHitbox({
      owner: "prop",
      objectId: this.objectId("hydrant"),
      shape: "cylinder",
      center: new THREE.Vector3(28, 0, 14.45),
      radius: 0.34,
      halfDepth: 0.34,
      minY: 0,
      maxY: 1.1,
      solid: true,
    });
  }

  private buildVehicle(x: number, y: number, z: number, color: string, rotation: number) {
    const vehicle = new THREE.Group();
    vehicle.position.set(x, y, z);
    vehicle.rotation.y = rotation;
    this.world.add(vehicle);
    this.boxIn(vehicle, 3.2, 0.58, 1.42, color, 0, 0.58, 0, { metalness: 0.28, roughness: 0.46 });
    this.boxIn(vehicle, 3.32, 0.12, 1.48, "#5b4c44", 0, 0.91, 0, { metalness: 0.42, roughness: 0.34 });
    this.boxIn(vehicle, 1.72, 0.66, 1.26, color, -0.25, 1.12, 0, { metalness: 0.25, roughness: 0.42 });
    this.boxIn(vehicle, 1.58, 0.08, 1.34, "#6d6258", -0.25, 1.48, 0, { metalness: 0.38, roughness: 0.3 });
    this.boxIn(vehicle, 0.72, 0.44, 1.29, "#66878b", -0.8, 1.16, 0, { metalness: 0.18, roughness: 0.2, emissive: "#243d42", emissiveIntensity: 0.18 });
    this.boxIn(vehicle, 0.56, 0.44, 1.29, "#719196", 0.42, 1.16, 0, { metalness: 0.18, roughness: 0.2 });
    this.boxIn(vehicle, 1.05, 0.07, 0.16, "#d8c79f", -0.12, 1.58, 0, { metalness: 0.48, roughness: 0.26 });
    this.boxIn(vehicle, 0.04, 0.31, 1.27, "#dfcfae", -0.12, 0.74, 0, { metalness: 0.42 });
    for (const side of [-1, 1]) {
      for (const axle of [-1.05, 1.05]) {
        const wheel = this.sphereIn(vehicle, 0.31, "#252827", axle, 0.38, side * 0.72, 10, { roughness: 0.95 });
        wheel.scale.set(1, 0.72, 0.42);
        const hub = this.sphereIn(vehicle, 0.11, "#b9b2a2", axle, 0.38, side * 0.78, 8, { metalness: 0.72, roughness: 0.2 });
        hub.scale.set(1, 0.55, 0.28);
      }
      const headlight = this.boxIn(vehicle, 0.2, 0.21, 0.08, "#f2d5a1", -1.58, 0.63, side * 0.47, { emissive: "#f4c477", emissiveIntensity: 0.5 });
      const taillight = this.boxIn(vehicle, 0.18, 0.22, 0.08, "#b44d42", 1.58, 0.61, side * 0.48, { emissive: "#6d1719", emissiveIntensity: 0.25 });
      this.animated.push({ object: headlight, baseY: 0.63, speed: 0.8 + Math.abs(x) * 0.01, phase: side + z, mode: "pulse" });
      this.animated.push({ object: taillight, baseY: 0.61, speed: 0.65 + Math.abs(z) * 0.01, phase: side * 2 + x, mode: "pulse" });
    }
    this.registerObjectHitbox(vehicle, this.objectId("vehicle"), 1.75, 1.55, 0.75, "prop", true, true);
    return vehicle;
  }

  private buildGlassTower() {
    const x = -3.5;
    const z = -10.5;
    const width = 12;
    const depth = 10;
    const height = 32;
    this.box(width + 2.4, 0.42, depth + 2.2, "#566873", x, 0.21, z);
    this.box(width, height, depth, "#39748a", x, height / 2 + 0.42, z, { roughness: 0.16, metalness: 0.56, emissive: "#0e364a", emissiveIntensity: 0.15 });
    this.box(width + 0.34, height + 0.55, 0.3, "#c5d8d3", x, height / 2 + 0.49, z + depth / 2 + 0.12, { roughness: 0.24, metalness: 0.52, emissive: "#91e3ea", emissiveIntensity: 0.48 });
    this.box(width + 0.3, height + 0.55, 0.22, "#72b5bc", x, height / 2 + 0.49, z - depth / 2 - 0.08, { roughness: 0.18, metalness: 0.62 });
    for (let column = -2; column <= 2; column += 1) {
      const frameX = x + column * 2.35;
      this.box(0.11, height + 0.6, 0.21, column === 0 ? "#e3d3a7" : "#a4cbd0", frameX, height / 2 + 0.49, z + depth / 2 + 0.26, { emissive: "#3aa2ad", emissiveIntensity: 0.2, metalness: 0.55 });
    }
    for (let storey = 1; storey < 14; storey += 1) {
      this.box(width + 0.25, 0.075, 0.24, "#bed9d5", x, storey * 2.23 + 0.45, z + depth / 2 + 0.25, { emissive: "#74dce7", emissiveIntensity: 0.28, metalness: 0.45 });
    }
    this.box(0.28, height, depth + 0.3, "#ccd3ca", x - width / 2 - 0.08, height / 2 + 0.48, z, { emissive: "#a4f1f0", emissiveIntensity: 0.44, metalness: 0.5 });
    this.box(0.28, height, depth + 0.3, "#bed5d0", x + width / 2 + 0.08, height / 2 + 0.48, z, { emissive: "#a4f1f0", emissiveIntensity: 0.38, metalness: 0.5 });
    this.box(14.3, 0.6, 12.2, "#bbc5bb", x, height + 0.76, z, { metalness: 0.42 });
    this.box(11.8, 1.4, 9.9, "#225267", x, height + 1.55, z, { metalness: 0.6, roughness: 0.26, emissive: "#136577", emissiveIntensity: 0.35 });
    for (let corner = -1; corner <= 1; corner += 2) {
      this.box(0.22, 2.4, 0.22, "#f0d78f", x + corner * 5.2, height + 2.7, z + corner * 4.1, { emissive: "#ffe6a4", emissiveIntensity: 0.8 });
    }
    this.box(4.8, 5.2, 0.55, "#adf5e4", x, 2.85, z + depth / 2 + 0.32, { roughness: 0.17, metalness: 0.45, emissive: "#76f5dd", emissiveIntensity: 0.48 });
    this.box(5.8, 0.42, 0.64, "#f1cf8d", x, 5.6, z + depth / 2 + 0.4, { metalness: 0.62, emissive: "#f8d99e", emissiveIntensity: 0.3 });
    this.box(5.8, 0.42, 0.64, "#f1cf8d", x, 0.12, z + depth / 2 + 0.4, { metalness: 0.6, emissive: "#f8d99e", emissiveIntensity: 0.27 });
    this.registerHitbox({
      owner: "prop",
      objectId: "skyline-lift-tower",
      shape: "box",
      center: new THREE.Vector3(x, height / 2 + 0.42, z),
      radius: width / 2 + 0.2,
      halfDepth: depth / 2 + 0.2,
      minY: 0,
      maxY: height + 3,
      solid: true,
    });
    const shaft = this.box(1.3, 3.5, 0.13, "#f6f0d5", x, 2.65, z + depth / 2 + 0.68, { metalness: 0.3, emissive: "#fff1bb", emissiveIntensity: 0.48 });
    shaft.userData.glass = true;
    this.box(3.7, 0.18, 0.22, "#1b5663", x, 6.25, z + depth / 2 + 0.23, { metalness: 0.2 });
    const elevatorCar = new THREE.Group();
    elevatorCar.position.set(x, 1.15, z + depth / 2 + 0.68);
    this.world.add(elevatorCar);
    this.boxIn(elevatorCar, 1.05, 1.25, 0.16, "#d7fff1", 0, 0, 0, { emissive: "#7cf5e5", emissiveIntensity: 0.38, metalness: 0.34, roughness: 0.18, transparent: true, opacity: 0.72 });
    this.boxIn(elevatorCar, 0.86, 1.02, 0.08, "#315a61", 0, 0, -0.04, { metalness: 0.3, roughness: 0.25 });
    this.sphereIn(elevatorCar, 0.09, "#cffff4", 0, 0.64, 0, 8, { emissive: "#8ffff0", emissiveIntensity: 1.2 });
    this.registerHitbox({
      owner: "prop",
      objectId: "skyline-lift-car",
      shape: "cylinder",
      center: new THREE.Vector3(x, 3.1, z + depth / 2 + 0.68),
      radius: 0.78,
      halfDepth: 0.78,
      minY: 0.35,
      maxY: 6.1,
      solid: false,
    });
    this.animated.push({ object: elevatorCar, baseY: 1.15, speed: 0.16, phase: 0.7, mode: "patrol", minY: 0.45, maxY: 5.75 });
    // Exposed lift engineering gives the tower a believable mechanical core.
    for (const side of [-1, 1]) {
      this.cylinder(0.12, 0.12, 5.35, "#6d7776", x + side * 2.15, 2.84, z + depth / 2 + 0.66, 10, { metalness: 0.72, roughness: 0.23 });
      this.sphere(0.22, side < 0 ? "#76f1df" : "#efbd7c", x + side * 2.15, 5.28, z + depth / 2 + 0.68, 12, { emissive: side < 0 ? "#43c7ba" : "#d78d49", emissiveIntensity: 0.95 });
    }
    for (let level = 0; level < 4; level += 1) {
      this.box(4.35, 0.08, 0.34, level % 2 ? "#819e9d" : "#d2b47f", x, 1.05 + level * 1.18, z + depth / 2 + 0.76, { metalness: 0.55, emissive: "#3c7f82", emissiveIntensity: 0.17 });
    }
    this.box(0.58, 1.3, 0.18, "#273c46", x + 3.18, 1.28, z + depth / 2 + 0.73, { metalness: 0.58, roughness: 0.28 });
    for (let button = 0; button < 4; button += 1) {
      this.sphere(0.055, button === 0 ? "#9ff7df" : "#d9c28e", x + 3.18, 0.87 + button * 0.24, z + depth / 2 + 0.59, 8, { emissive: button === 0 ? "#6af1d2" : "#8a7449", emissiveIntensity: 0.85 });
    }
    this.label("LIFT ACCESS · LT-01", x + 3.2, 2.18, z + depth / 2 + 0.95, 2.05, "#dff7d9");
    this.cylinder(0.1, 0.16, 4.6, "#7d8986", x, height + 4.4, z, 9, { metalness: 0.72, roughness: 0.2 });
    for (let antenna = 0; antenna < 3; antenna += 1) {
      const ring = this.addRingMesh(0.45 + antenna * 0.34, 0.035, antenna % 2 ? "#efc985" : "#80f5e3", x, height + 4.8 + antenna * 0.52, z, antenna * 0.8, 0.42, 0.78);
      ring.rotation.x = Math.PI / 2;
      this.animated.push({ object: ring, baseY: ring.position.y, speed: 0.22 + antenna * 0.08, phase: antenna, mode: "spin" });
    }
    const beacon = this.sphere(0.18, "#f4d190", x, height + 6.78, z, 10, { emissive: "#f4b55e", emissiveIntensity: 1.25 });
    this.animated.push({ object: beacon, baseY: beacon.position.y, speed: 0.8, phase: 1.2, mode: "pulse" });
    this.label("THE SKYLINE LIFT", x, 7.25, z + depth / 2 + 1.8, 4.6, "#b9f7e8");
    this.label("Mechanical Frontier", x, 30.2, z + depth / 2 + 0.35, 6.9, "#c6fff1");
    this.addRingMesh(5.2, 0.055, "#82fff1", x, 0.21, z + depth / 2 + 0.6, 0, 1, 0.75);
    this.addRingMesh(5.7, 0.035, "#efc988", x, 0.22, z + depth / 2 + 0.6, 0, 1, 0.8);
    this.light("#60efe4", 4.4, new THREE.Vector3(x, 3.5, z + depth / 2 + 1.2), 23);
  }

  private buildTownHall() {
    this.box(12.5, 0.35, 8.2, "#716652", 5, 0.17, 20);
    this.box(11, 4.9, 7, "#dbceb2", 5, 2.62, 20, { roughness: 0.88 });
    const roof = new THREE.Mesh(this.geometry("hall-roof", () => new THREE.ConeGeometry(7.4, 2.4, 4)), this.material("#835a4a", { roughness: 0.9 }));
    roof.position.set(5, 5.85, 20);
    roof.rotation.y = Math.PI / 4;
    this.world.add(roof);
    this.box(2.2, 3.2, 0.15, "#315a61", 5, 1.9, 23.54);
    for (const offset of [-3.1, -1.05, 1.05, 3.1]) this.box(0.9, 1.2, 0.1, "#8db6b5", 5 + offset, 3.15, 23.57, { roughness: 0.25, emissive: "#406e72", emissiveIntensity: 0.25 });
    this.label("WALSENBURG FIELD OFFICE", 5, 6.8, 22.8, 6.8, "#f2d9a8");
    this.registerHitbox({
      owner: "prop",
      objectId: "field-office",
      shape: "box",
      center: new THREE.Vector3(5, 2.75, 20),
      radius: 5.8,
      halfDepth: 3.8,
      minY: 0,
      maxY: 6.25,
      solid: true,
    });
  }

  private buildLizardTown() {
    this.playerPosition.set(0, 0, 4.2);
    this.setAtmosphere("#111423", "#171c2b", 42, 170, 0.94, 0.7);
    this.addSky("#0c1428", "#302441", "#4e3545");
    const cave = new THREE.Mesh(
      new THREE.SphereGeometry(88, 24, 17, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: "#25253b", side: THREE.BackSide, roughness: 1, metalness: 0.04 }),
    );
    cave.position.y = -20;
    this.world.add(cave);
    this.floor(250, "#292b37", -0.22, 0.76, 0.11);

    this.cylinder(33, 35, 0.7, "#303741", 0, 0.05, 0, 64, { metalness: 0.25, roughness: 0.62 });
    this.cylinder(24.5, 26, 0.17, "#373b45", 0, 0.44, 0, 64, { metalness: 0.36, roughness: 0.55 });
    this.torus(31.6, 0.15, "#39b4bb", 0, 0.5, 0, 72, { emissive: "#167c91", emissiveIntensity: 0.6, metalness: 0.35 });
    this.torus(26.4, 0.08, "#ecae68", 0, 0.54, 0, 72, { emissive: "#a76240", emissiveIntensity: 0.36 });

    for (let i = 0; i < 40; i += 1) {
      const angle = i * 2.39996;
      const radius = 37 + (i % 7) * 3.7;
      const crystalColor = i % 3 === 0 ? "#62d6cb" : i % 3 === 1 ? "#a57af1" : "#f5b86c";
      const crystal = new THREE.Mesh(this.geometry(`crystal:${i % 4}`, () => new THREE.OctahedronGeometry(0.46 + (i % 4) * 0.12)), this.material(crystalColor, { roughness: 0.2, metalness: 0.3, emissive: crystalColor, emissiveIntensity: 0.38 }));
      crystal.position.set(Math.cos(angle) * radius, 1.7 + (i % 3) * 0.7, Math.sin(angle) * radius);
      crystal.rotation.set(0.3, angle, 0.2);
      crystal.scale.y = 1.7;
      this.world.add(crystal);
      this.registerHitbox({
        owner: "prop",
        objectId: this.objectId("crystal"),
        shape: "cylinder",
        center: crystal.position.clone(),
        radius: 0.48,
        halfDepth: 0.48,
        minY: 0.2,
        maxY: 3.4,
        solid: false,
      });
      this.animated.push({ object: crystal, baseY: crystal.position.y, speed: 0.12 + (i % 5) * 0.025, phase: angle, mode: "spin" });
    }

    const stalls = ["#403344", "#2b4042", "#423a37", "#34404a", "#49384a", "#353746", "#394444", "#443833"];
    for (let i = 0; i < 10; i += 1) {
      const angle = (Math.PI * 2 * i) / 10;
      const x = Math.sin(angle) * 27;
      const z = Math.cos(angle) * 27;
      const body = this.box(6.2, 3.6, 5.2, stalls[i % stalls.length], x, 1.95, z, { roughness: 0.52, metalness: 0.1 });
      body.rotation.y = -angle;
      const canopy = this.box(6.8, 0.26, 5.8, DISTRICTS[i].color, x, 4, z, { roughness: 0.36, metalness: 0.17, emissive: DISTRICTS[i].color, emissiveIntensity: 0.17 });
      canopy.rotation.y = -angle;
      this.label(DISTRICTS[i].name, x, 5.1, z, 4.3, DISTRICTS[i].color);
      this.light(DISTRICTS[i].tint, 1.9, new THREE.Vector3(x, 3, z), 18);
      this.registerHitbox({
        owner: "prop",
        objectId: this.objectId("stall"),
        shape: "cylinder",
        center: new THREE.Vector3(x, 0, z),
        radius: 3.45,
        halfDepth: 3.1,
        minY: 0,
        maxY: 4.2,
        solid: true,
      });
      this.animated.push({ object: canopy, baseY: 4, speed: 0.18 + i * 0.012, phase: angle, mode: "bob" });
    }

    this.buildLizardTownDetails();

    for (let i = 0; i < 10; i += 1) {
      const angle = (Math.PI * 2 * i) / 10;
      const radius = 15.3;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      const district = DISTRICTS[i];
      const ring = this.addRingMesh(1.55, 0.09, district.color, x, 2.15, z, angle, 1.45, 0.94);
      ring.material = new THREE.MeshBasicMaterial({ color: district.color, transparent: true, opacity: 0.9 });
      const postA = this.box(0.22, 4.5, 0.35, "#8c9891", x - Math.cos(angle) * 1.65, 2.25, z + Math.sin(angle) * 1.65, { roughness: 0.28, metalness: 0.43 });
      const postB = this.box(0.22, 4.5, 0.35, "#8c9891", x + Math.cos(angle) * 1.65, 2.25, z - Math.sin(angle) * 1.65, { roughness: 0.28, metalness: 0.43 });
      postA.rotation.y = angle;
      postB.rotation.y = angle;
      for (const pillar of [postA, postB]) {
        this.registerHitbox({
          owner: "prop", objectId: this.objectId("gate-pillar"), shape: "cylinder",
          center: new THREE.Vector3(pillar.position.x, 2.25, pillar.position.z),
          radius: 0.28, halfDepth: 0.28, minY: 0, maxY: 4.55, solid: true,
        });
      }
      const keystone = this.sphere(0.22, district.color, x, 4.47, z, 10, { emissive: district.color, emissiveIntensity: 1.6 });
      this.animated.push({ object: keystone, baseY: 4.47, speed: 0.56, phase: angle });
      this.interactables.push({ kind: "district", id: String(i), label: `Explore ${district.name}`, position: new THREE.Vector3(x, 0, z), range: 3.7 });
    }

    this.cylinder(4.2, 5, 1.3, "#424754", 0, 0.65, -7.8, 32, { metalness: 0.4, roughness: 0.43 });
    this.registerHitbox({
      owner: "prop",
      objectId: "chrono-platform",
      shape: "cylinder",
      center: new THREE.Vector3(0, 0.65, -7.8),
      radius: 4.6,
      halfDepth: 4.6,
      minY: 0,
      maxY: 1.3,
      solid: true,
      standable: true,
    });
    this.torus(3.2, 0.12, "#7a5df4", 0, 1.43, -7.8, 40, { emissive: "#592ff2", emissiveIntensity: 0.8 });
    this.addRingMesh(2.25, 0.045, "#93efe3", 0, 1.46, -7.8, 0, 1, 0.8);
    const chrono = this.buildCharacter("#ef9d69", "#bc5144", true);
    chrono.position.set(HUB_CHRONO.x, 0, HUB_CHRONO.z);
    chrono.rotation.y = Math.PI;
    this.world.add(chrono);
    this.registerNpc(chrono, "chrono", "Chrono");
    this.label("CHRONO · FIELD GUIDE", 0, 3.3, -6.1, 4.7, "#ffc59a");
    this.interactables.push({ kind: "chrono", id: "chrono", label: "Talk to Chrono", position: HUB_CHRONO.clone(), range: 4.3 });
    this.box(5, 0.2, 0.6, "#dcae6d", 0, 0.17, 8.7, { emissive: "#cc8e54", emissiveIntensity: 0.15 });
    this.label("SURFACE ELEVATOR", 0, 0.95, 8.2, 3.3, "#e2c99b");
    this.interactables.push({ kind: "exit", id: "surface-exit", label: "Ride the elevator to Walsenburg", position: new THREE.Vector3(0, 0, 10), range: 4.2 });
    this.playerPosition.set(0, 0, 4.2);
    this.light("#a67dff", 4.3, new THREE.Vector3(0, 8, 0), 58);
    this.light("#50d9d1", 2.7, new THREE.Vector3(-19, 10, -10), 50);
    this.light("#f3a55e", 2.5, new THREE.Vector3(20, 10, 9), 50);
    this.label("LIZARD TOWN · UNDERMOUNTAIN", 0, 19, 0, 12, "#c7f4e5");
    this.registerInteractableHitboxes();
  }

  private buildLizardTownDetails() {
    // Radial brass inlays, handrails, and suspended utility hoops establish the hub's age and scale.
    for (let spoke = 0; spoke < 10; spoke += 1) {
      const angle = (Math.PI * 2 * spoke) / 10;
      const inlay = this.box(0.12, 0.035, 10.4, spoke % 2 ? "#6ebdb7" : "#c29361", Math.sin(angle) * 20.6, 0.56, Math.cos(angle) * 20.6, { metalness: 0.58, emissive: spoke % 2 ? "#236d70" : "#694328", emissiveIntensity: 0.22 });
      inlay.rotation.y = -angle;
      const market = new THREE.Group();
      market.position.set(Math.sin(angle) * 26.1, 0, Math.cos(angle) * 26.1);
      market.rotation.y = -angle;
      this.world.add(market);
      this.boxIn(market, 4.25, 0.24, 1.05, "#7a654c", 0, 1.03, -2.85, { roughness: 0.65, metalness: 0.2 });
      this.boxIn(market, 0.22, 1.9, 0.22, "#4f5554", -1.72, 0.05, -2.85, { metalness: 0.55 });
      this.boxIn(market, 0.22, 1.9, 0.22, "#4f5554", 1.72, 0.05, -2.85, { metalness: 0.55 });
      for (let item = 0; item < 4; item += 1) {
        const color = item % 2 ? DISTRICTS[spoke].color : "#e4c58e";
        const display = this.sphereIn(market, 0.16 + (item % 2) * 0.06, color, -1.25 + item * 0.82, 1.35 + (item % 2) * 0.11, -2.85, 9, { emissive: color, emissiveIntensity: 0.56, metalness: 0.28, roughness: 0.23 });
        display.scale.y = 1.35;
        this.animated.push({ object: display, baseY: display.position.y, speed: 0.35 + item * 0.06, phase: spoke + item, mode: "bob" });
      }
      this.boxIn(market, 0.9, 0.62, 0.14, "#293b42", 0, 2.12, -3.02, { metalness: 0.45, roughness: 0.25, emissive: DISTRICTS[spoke].color, emissiveIntensity: 0.25 });
      this.registerObjectHitbox(market, this.objectId("market-counter"), 2.45, 2.2, 1.1, "prop", true);
    }

    for (let rail = 0; rail < 24; rail += 1) {
      const angle = (Math.PI * 2 * rail) / 24;
      const x = Math.sin(angle) * 23.2;
      const z = Math.cos(angle) * 23.2;
      this.cylinder(0.055, 0.075, 1.05, "#6b7471", x, 0.98, z, 7, { metalness: 0.66, roughness: 0.25 });
      if (rail % 3 === 0) this.sphere(0.095, rail % 2 ? "#80e4d4" : "#e9bc78", x, 1.54, z, 8, { emissive: rail % 2 ? "#45c8bc" : "#d48643", emissiveIntensity: 0.9 });
    }
    for (let hoop = 0; hoop < 3; hoop += 1) {
      const ring = this.addRingMesh(20 + hoop * 4.5, 0.065, hoop === 1 ? "#d29a64" : "#4dbcb8", 0, 8.5 + hoop * 2.15, 0, hoop * 0.4, 0.34, 0.48);
      ring.rotation.x = Math.PI / 2;
    }

    const machine = new THREE.Group();
    machine.position.set(-7.8, 0.7, 0);
    this.world.add(machine);
    for (let gear = 0; gear < 4; gear += 1) {
      const wheel = new THREE.Mesh(this.geometry(`hub-gear:${gear}`, () => new THREE.TorusGeometry(0.55 + gear * 0.24, 0.11, 7, 16)), this.material(gear % 2 ? "#7ed9cf" : "#d8aa70", { metalness: 0.68, roughness: 0.28, emissive: gear % 2 ? "#267c79" : "#74451f", emissiveIntensity: 0.31 }));
      wheel.position.set((gear % 2) * 1.6, 1.1 + gear * 0.55, (gear % 3) * 0.15);
      wheel.rotation.y = gear * 0.55;
      machine.add(wheel);
      this.animated.push({ object: wheel, baseY: wheel.position.y, speed: 0.18 + gear * 0.07, phase: gear });
    }
    this.boxIn(machine, 2.9, 0.42, 1.55, "#424b50", 0.7, 0.22, 0, { metalness: 0.58, roughness: 0.36 });
    this.label("CIVIC CLOCKWORK", -7.1, 4.65, 0, 3.8, "#e4c38a");
    this.registerObjectHitbox(machine, this.objectId("clockwork"), 1.8, 3.2, 1.6, "prop", true);

    const cargo = [{ x: 5.8, z: 5.8, height: 0.52 }, { x: 8.3, z: 4.3, height: 0.94 }, { x: 10.7, z: 6.2, height: 1.34 }];
    for (let i = 0; i < cargo.length; i += 1) {
      const crate = cargo[i];
      const top = crate.height + 0.55;
      this.box(1.65, crate.height, 1.65, "#53646b", crate.x, 0.55 + crate.height / 2, crate.z, { roughness: 0.55, metalness: 0.38 });
      this.box(1.72, 0.08, 1.72, i % 2 ? "#e2bb88" : "#89dfce", crate.x, top + 0.04, crate.z, { metalness: 0.52, emissive: i % 2 ? "#a57547" : "#368a83", emissiveIntensity: 0.24 });
      const gem = this.sphere(0.14, DISTRICTS[i].color, crate.x, top + 0.25, crate.z, 9, { emissive: DISTRICTS[i].color, emissiveIntensity: 0.88 });
      this.animated.push({ object: gem, baseY: gem.position.y, speed: 0.37 + i * 0.1, phase: i, mode: "spin" });
      this.registerHitbox({
        owner: "prop", objectId: this.objectId("underground-cargo"), shape: "box",
        center: new THREE.Vector3(crate.x, 0.55 + crate.height / 2, crate.z),
        radius: 0.84, halfDepth: 0.84, minY: 0.55,
        maxY: top + 0.08, solid: true, standable: true,
      });
    }

    const residentNames = ["Tavi", "Pip", "Rook", "Mina", "Kestrel"];
    const residentColors = ["#73c7b7", "#d79867", "#9a83dc", "#d184a7", "#a7c86f"];
    for (let i = 0; i < residentNames.length; i += 1) {
      const angle = i * 1.256 + 0.42;
      const position = new THREE.Vector3(Math.sin(angle) * 9.5, 0.56, Math.cos(angle) * 9.5);
      const resident = this.buildCharacter(i % 2 ? "#cf916d" : "#b87559", residentColors[i], i === 1);
      resident.position.copy(position);
      resident.scale.setScalar(0.76 + (i % 2) * 0.05);
      this.world.add(resident);
      const walker: Walker = { actor: resident, from: position.clone(), to: position.clone().add(new THREE.Vector3(Math.cos(angle) * 3.2, 0, -Math.sin(angle) * 3.2)), speed: 0.13 + i * 0.018, elapsed: 0, phase: i * 0.9 };
      this.walkers.push(walker);
      this.registerNpc(resident, `lizard-resident-${i}`, residentNames[i], walker);
    }
  }

  private buildRoom(index: number) {
    const room = ROOMS[index];
    const palette = new THREE.Color(room.color);
    const tintHex = `#${palette.getHexString()}`;
    this.playerPosition.copy(ROOM_ENTRY);
    this.setAtmosphere("#0e1421", "#171c28", 34, 105, 0.83, 0.72);
    this.addSky("#0b1020", "#152432", "#1a242a");
    this.floor(68, "#242935", -0.15, 0.38, 0.36);
    this.box(27, 0.35, 25, "#262b34", 0, 0.02, -0.7, { metalness: 0.18 });
    this.box(28, 12, 0.42, "#303746", 0, 5.95, -13.2, { roughness: 0.63, metalness: 0.24 });
    this.box(0.42, 12, 24.6, "#303746", -13.4, 5.95, -0.55, { roughness: 0.63, metalness: 0.24 });
    this.box(0.42, 12, 24.6, "#303746", 13.4, 5.95, -0.55, { roughness: 0.63, metalness: 0.24 });
    this.box(28, 0.4, 25, "#252935", 0, 12.05, -0.65, { metalness: 0.38, roughness: 0.44 });
    this.registerHitbox({ owner: "prop", objectId: "room-back-wall", shape: "box", center: new THREE.Vector3(0, 6, -13.2), radius: 14, halfDepth: 0.45, minY: 0, maxY: 12, solid: true });
    this.registerHitbox({ owner: "prop", objectId: "room-left-wall", shape: "box", center: new THREE.Vector3(-13.4, 6, -0.55), radius: 0.45, halfDepth: 12.3, minY: 0, maxY: 12, solid: true });
    this.registerHitbox({ owner: "prop", objectId: "room-right-wall", shape: "box", center: new THREE.Vector3(13.4, 6, -0.55), radius: 0.45, halfDepth: 12.3, minY: 0, maxY: 12, solid: true });
    this.box(26, 0.18, 0.26, tintHex, 0, 0.12, -11.75, { emissive: tintHex, emissiveIntensity: 0.32 });
    this.box(0.17, 0.18, 22.4, tintHex, -12.1, 0.1, -0.6, { emissive: tintHex, emissiveIntensity: 0.36 });
    this.box(0.17, 0.18, 22.4, tintHex, 12.1, 0.1, -0.6, { emissive: tintHex, emissiveIntensity: 0.36 });
    for (let x = -10; x <= 10; x += 2) {
      this.box(0.035, 0.02, 24, "#626572", x, 0.045, -0.55, { emissive: "#353d49", emissiveIntensity: 0.18 });
    }
    for (let z = -11; z <= 10; z += 2) this.box(26, 0.02, 0.035, "#626572", 0, 0.05, z - 0.5, { emissive: "#353d49", emissiveIntensity: 0.14 });
    for (let i = -1; i <= 1; i += 1) {
      this.box(0.2, 0.12, 2.3, tintHex, i * 7, 11.82, -6.5, { emissive: tintHex, emissiveIntensity: 0.8 });
      this.light(tintHex, 0.8, new THREE.Vector3(i * 7, 8.7, -4.8), 17);
    }
    this.buildRoomDetails(index, tintHex);
    this.buildJumpPlatforms(index, tintHex);

    this.cylinder(1.8, 2.15, 0.75, "#50555f", 0, 0.58, -7.4, 40, { metalness: 0.53, roughness: 0.33 });
    this.cylinder(1.2, 1.56, 0.18, "#99928b", 0, 1.05, -7.4, 32, { metalness: 0.61, roughness: 0.25 });
    this.torus(1.65, 0.08, tintHex, 0, 1.03, -7.4, 48, { emissive: tintHex, emissiveIntensity: 0.7, metalness: 0.25 });
    this.registerHitbox({
      owner: "prop", objectId: `artifact-pedestal-${index}`, shape: "cylinder",
      center: new THREE.Vector3(0, 0.58, -7.4), radius: 1.85, halfDepth: 1.85,
      minY: 0, maxY: 1.14, solid: true, standable: true,
    });

    const artifact = new THREE.Group();
    artifact.position.set(0, 1.25, -7.4);
    this.world.add(artifact);
    const artifactIndex = index % 10;
    if (artifactIndex === 0) {
      const orb = new THREE.Mesh(this.geometry("artifact-orb", () => new THREE.IcosahedronGeometry(0.9, 2)), this.material(tintHex, { roughness: 0.16, metalness: 0.34, emissive: tintHex, emissiveIntensity: 0.95 }));
      orb.position.y = 1.1;
      artifact.add(orb);
      const halo = new THREE.Mesh(this.geometry("artifact-halo", () => new THREE.TorusGeometry(1.34, 0.055, 8, 64)), new THREE.MeshBasicMaterial({ color: tintHex, transparent: true, opacity: 0.75 }));
      halo.rotation.x = 0.8;
      halo.position.y = 1.1;
      artifact.add(halo);
    } else if (artifactIndex === 1) {
      const crystal = new THREE.Mesh(this.geometry("artifact-crystal", () => new THREE.OctahedronGeometry(1.13, 1)), this.material(tintHex, { roughness: 0.17, metalness: 0.3, emissive: tintHex, emissiveIntensity: 0.78 }));
      crystal.position.y = 1.28;
      crystal.rotation.z = 0.3;
      artifact.add(crystal);
      for (let i = 0; i < 3; i += 1) {
        const chip = new THREE.Mesh(this.geometry("artifact-chip", () => new THREE.OctahedronGeometry(0.22)), this.material("#e5e5cb", { metalness: 0.5, emissive: tintHex, emissiveIntensity: 0.3 }));
        chip.position.set(Math.cos(i * 2.1) * 1.65, 0.75 + i * 0.49, Math.sin(i * 2.1) * 1.12);
        artifact.add(chip);
      }
    } else if (artifactIndex === 2 || artifactIndex === 7) {
      for (let i = 0; i < 3; i += 1) {
        const ring = new THREE.Mesh(this.geometry(`artifact-torus-${i}`, () => new THREE.TorusGeometry(0.65 + i * 0.38, 0.075, 10, 48)), new THREE.MeshStandardMaterial({ color: i === 1 ? "#e3b87b" : tintHex, metalness: 0.78, roughness: 0.18, emissive: tintHex, emissiveIntensity: 0.42 }));
        ring.position.y = 1.2;
        ring.rotation.set(i * 0.82, i * 1.1, i * 0.36);
        artifact.add(ring);
      }
      const core = new THREE.Mesh(this.geometry("artifact-core", () => new THREE.SphereGeometry(0.37, 22, 16)), this.material("#f8ebc8", { emissive: tintHex, emissiveIntensity: 1.25, metalness: 0.08, roughness: 0.16 }));
      core.position.y = 1.2;
      artifact.add(core);
    } else if (artifactIndex === 3 || artifactIndex === 8) {
      const upright = new THREE.Mesh(this.geometry("artifact-tall", () => new THREE.CylinderGeometry(0.36, 0.63, 2.1, 12)), this.material(tintHex, { metalness: 0.6, roughness: 0.27, emissive: tintHex, emissiveIntensity: 0.5 }));
      upright.position.y = 1.15;
      artifact.add(upright);
      const cap = new THREE.Mesh(this.geometry("artifact-cap", () => new THREE.SphereGeometry(0.72, 16, 12)), this.material("#b5ddd1", { emissive: tintHex, emissiveIntensity: 0.4, metalness: 0.44, roughness: 0.2 }));
      cap.position.y = 2.25;
      artifact.add(cap);
      const bar = new THREE.Mesh(this.geometry("artifact-rib", () => new THREE.BoxGeometry(1.8, 0.12, 0.2)), this.material("#e7d4a9", { metalness: 0.67 }));
      bar.position.y = 1.1;
      artifact.add(bar);
    } else if (artifactIndex === 4 || artifactIndex === 9) {
      const mech = this.createMech(artifact, 0, 0.98, 0, tintHex, 0.64);
      mech.rotation.y = -0.28;
    } else if (artifactIndex === 5) {
      const planet = new THREE.Mesh(this.geometry("artifact-planet", () => new THREE.SphereGeometry(0.82, 20, 18)), this.material(tintHex, { roughness: 0.2, metalness: 0.16, emissive: tintHex, emissiveIntensity: 0.48 }));
      planet.position.y = 1.3;
      artifact.add(planet);
      const orbit = new THREE.Mesh(this.geometry("artifact-orbit", () => new THREE.TorusGeometry(1.34, 0.055, 8, 44)), this.material("#f3ddb6", { metalness: 0.7, emissive: tintHex, emissiveIntensity: 0.4 }));
      orbit.position.y = 1.3;
      orbit.rotation.x = 1.07;
      orbit.rotation.y = 0.4;
      artifact.add(orbit);
      const moon = new THREE.Mesh(this.geometry("artifact-moon", () => new THREE.SphereGeometry(0.25, 14, 11)), this.material("#f1d9a4", { metalness: 0.4, emissive: "#e6a969", emissiveIntensity: 0.42 }));
      moon.position.set(1.15, 1.8, 0.3);
      artifact.add(moon);
    } else {
      const gear = new THREE.Mesh(this.geometry("artifact-gear", () => new THREE.DodecahedronGeometry(0.96, 1)), this.material(tintHex, { metalness: 0.7, roughness: 0.24, emissive: tintHex, emissiveIntensity: 0.67 }));
      gear.position.y = 1.27;
      artifact.add(gear);
      const dial = new THREE.Mesh(this.geometry("artifact-dial", () => new THREE.TorusGeometry(1.28, 0.06, 8, 40)), this.material("#e4c38b", { metalness: 0.7, roughness: 0.2 }));
      dial.rotation.x = Math.PI / 2.8;
      dial.position.y = 1.27;
      artifact.add(dial);
    }
    this.detailRoomGadget(artifact, index, tintHex);
    this.animated.push({ object: artifact, baseY: 1.25, speed: 0.25 + (index % 4) * 0.09, phase: index * 0.14 });
    this.registerHitbox({
      owner: "artifact",
      objectId: `room-${index}-gadget`,
      shape: "cylinder",
      center: artifact.position.clone(),
      radius: 1.85,
      halfDepth: 1.85,
      minY: 0.35,
      maxY: 4.8,
      solid: false,
      dynamic: () => artifact.getWorldPosition(new THREE.Vector3()),
    });

    this.label(room.gadget, 0, 5.15, -6.8, 5.8, room.color);
    const count = 3;
    const targetPositions = [new THREE.Vector3(-5.45, 2.2, -1.15), new THREE.Vector3(0, 3.5, -2.55), new THREE.Vector3(5.45, 2.2, -1.15)];
    for (let i = 0; i < count; i += 1) {
      const p = targetPositions[i];
      this.cylinder(0.45, 0.58, 0.75, "#4c515b", p.x, 0.38, p.z, 14, { roughness: 0.36, metalness: 0.58 });
      this.registerHitbox({
        owner: "prop", objectId: `beacon-stand-${index}-${i}`, shape: "cylinder",
        center: new THREE.Vector3(p.x, 0.38, p.z), radius: 0.51, halfDepth: 0.51,
        minY: 0, maxY: 0.76, solid: true, standable: true,
      });
      const target = this.sphere(0.42, "#515b68", p.x, p.y, p.z, 18, { metalness: 0.12, roughness: 0.22, emissive: "#29343c", emissiveIntensity: 0.34 });
      target.userData.targetId = `target-${i}`;
      const halo = this.torus(0.63, 0.04, tintHex, p.x, p.y, p.z, 36, { emissive: tintHex, emissiveIntensity: 0.42 });
      halo.rotation.x = Math.PI / 2.3;
      this.targets.push({ mesh: target, id: `target-${i}`, active: false });
      this.registerHitbox({
        owner: "target",
        objectId: `target-${i}`,
        shape: "cylinder",
        center: target.position.clone(),
        radius: 0.72,
        halfDepth: 0.72,
        minY: p.y - 1.35,
        maxY: p.y + 1.35,
        solid: false,
        dynamic: () => target.getWorldPosition(new THREE.Vector3()),
      });
      this.animated.push({ object: halo, baseY: p.y, speed: 0.23, phase: i * 1.8 });
    }

    if (index === 35) this.buildMechArmory(tintHex);
    if (index === 56) this.buildPortalGallery(tintHex);
    if (index === 63) this.buildShrinkLab(tintHex);

    this.box(5.2, 0.24, 0.65, "#e2c38f", 0, 0.16, 9.6, { metalness: 0.34, emissive: "#d99a6b", emissiveIntensity: 0.2 });
    this.label("HUB RETURN", 0, 1.05, 9.2, 3.1, "#f0d3a7");
    this.interactables.push({ kind: "exit", id: "hub-exit", label: "Return to Lizard Town", position: ROOM_ENTRY.clone(), range: 4.4 });
    this.interactables.push({ kind: "artifact", id: String(index), label: this.targetCount === 3 ? `Recover ${room.gadget}` : `Align all three beacons · ${this.targetCount}/3`, position: new THREE.Vector3(0, 0, -7.4), range: 4.1 });
    this.light(tintHex, 3.7, new THREE.Vector3(0, 7, -7), 31);
    this.light("#c786ff", 1.8, new THREE.Vector3(-9, 5.2, -7.5), 19);
    this.light("#f1b876", 1.5, new THREE.Vector3(9, 5.2, -7.5), 19);
    this.registerInteractableHitboxes();
  }

  private buildJumpPlatforms(index: number, tint: string) {
    const pads = [
      { x: -4.7, z: 4.6, height: 0.58 },
      { x: 0, z: 2.4, height: 1.02 },
      { x: 4.7, z: 4.6, height: 1.43 },
    ];
    for (let i = 0; i < pads.length; i += 1) {
      const pad = pads[i];
      const top = pad.height + 0.18;
      const housing = this.box(2.18, pad.height, 1.65, i === 1 ? "#4f6266" : "#48505a", pad.x, 0.18 + pad.height / 2, pad.z, { metalness: 0.58, roughness: 0.32 });
      this.box(2.05, 0.12, 1.54, "#86908d", pad.x, top + 0.05, pad.z, { metalness: 0.63, roughness: 0.28 });
      for (const side of [-1, 1]) {
        this.box(0.055, 0.055, 1.38, tint, pad.x + side * 0.91, top + 0.12, pad.z, { emissive: tint, emissiveIntensity: 0.76 });
        this.sphere(0.095, "#e8d3a7", pad.x + side * 0.95, top + 0.16, pad.z - 0.62, 8, { emissive: tint, emissiveIntensity: 0.32 });
      }
      const marker = this.torus(0.36, 0.035, tint, pad.x, top + 0.135, pad.z, 20, { emissive: tint, emissiveIntensity: 0.62 });
      marker.rotation.x = -Math.PI / 2;
      this.animated.push({ object: marker, baseY: marker.position.y, speed: 0.42 + i * 0.1, phase: index + i, mode: "pulse" });
      this.registerHitbox({
        owner: "prop",
        objectId: `jump-platform-${index}-${i}`,
        shape: "box",
        center: housing.position.clone(),
        radius: 1.09,
        halfDepth: 0.83,
        minY: 0,
        maxY: top + 0.11,
        solid: true,
        standable: true,
      });
    }
  }

  private buildRoomDetails(index: number, tint: string) {
    const district = ROOMS[index].districtIndex;
    // Repeating wall architecture: inset panels, fasteners, service strips, workbenches, and ceiling ribs.
    for (const side of [-1, 1]) {
      for (let panel = 0; panel < 4; panel += 1) {
        const z = -9.5 + panel * 5.4;
        this.box(0.11, 3.4, 3.7, panel % 2 ? "#39414c" : "#343c47", side * 13.13, 4.5, z, { metalness: 0.34, roughness: 0.48 });
        this.box(0.08, 2.7, 0.08, tint, side * 13.04, 4.5, z - 1.45, { emissive: tint, emissiveIntensity: 0.47, metalness: 0.4 });
        this.box(0.08, 2.7, 0.08, tint, side * 13.04, 4.5, z + 1.45, { emissive: tint, emissiveIntensity: 0.47, metalness: 0.4 });
        for (const boltY of [3.2, 5.8]) {
          this.sphere(0.07, "#b3a98e", side * 12.96, boltY, z - 1.55, 7, { metalness: 0.72, roughness: 0.22 });
          this.sphere(0.07, "#b3a98e", side * 12.96, boltY, z + 1.55, 7, { metalness: 0.72, roughness: 0.22 });
        }
      }
      const benchX = side * 10.4;
      this.box(3.5, 0.28, 1.75, "#777369", benchX, 1.35, 3.25, { metalness: 0.48, roughness: 0.34 });
      this.box(3.22, 1.08, 1.45, "#38434c", benchX, 0.68, 3.25, { metalness: 0.4, roughness: 0.45 });
      for (let drawer = -1; drawer <= 1; drawer += 1) {
        this.box(0.86, 0.3, 0.08, "#59636a", benchX + drawer * 1.02, 0.83, 2.49, { metalness: 0.57, roughness: 0.3 });
        this.box(0.24, 0.045, 0.07, "#d4b47e", benchX + drawer * 1.02, 0.83, 2.43, { metalness: 0.62 });
      }
      this.box(1.42, 1.03, 0.12, "#243943", benchX, 2.2, 3.2, { emissive: tint, emissiveIntensity: 0.24, metalness: 0.4, roughness: 0.2 });
      this.box(1.1, 0.06, 0.08, tint, benchX, 2.22, 3.12, { emissive: tint, emissiveIntensity: 1.1 });
      const lamp = this.cylinder(0.08, 0.11, 0.83, "#687278", benchX, 1.74, 3.26, 8, { metalness: 0.65 });
      this.animated.push({ object: lamp, baseY: 1.74, speed: 0.25 + Math.abs(benchX) * 0.01, phase: benchX, mode: "pulse" });
      this.registerHitbox({
        owner: "prop",
        objectId: this.objectId("workbench"),
        shape: "box",
        center: new THREE.Vector3(benchX, 0.8, 3.25),
        radius: 1.75,
        halfDepth: 0.88,
        minY: 0,
        maxY: 1.5,
        solid: true,
        standable: true,
      });
    }
    for (let rib = -2; rib <= 2; rib += 1) {
      this.box(25.9, 0.22, 0.22, "#535c64", 0, 11.68, rib * 4.25 - 0.5, { metalness: 0.58, roughness: 0.32 });
      this.box(5.8, 0.05, 0.32, rib % 2 ? tint : "#d7bd8d", 0, 11.52, rib * 4.25 - 0.5, { emissive: rib % 2 ? tint : "#8b663d", emissiveIntensity: 0.6 });
    }
    for (let stripe = -3; stripe <= 3; stripe += 1) {
      const hazard = this.box(0.33, 0.026, 2.6, stripe % 2 ? "#292f35" : "#d2a75f", stripe * 0.66, 0.23, -4.75, { roughness: 0.6, metalness: 0.2 });
      hazard.rotation.y = 0.52;
    }

    if (district === 0) {
      for (const side of [-1, 1]) {
        const pipe = this.cylinder(0.17, 0.17, 7.4, side < 0 ? "#b06f47" : "#6baaa5", side * 8.5, 4.15, -10.7, 12, { metalness: 0.63, roughness: 0.31 });
        pipe.rotation.z = 0.04 * side;
        const valve = this.torus(0.52, 0.08, "#ddb876", side * 8.5, 4.2, -10.45, 18, { metalness: 0.66, emissive: "#734d2c", emissiveIntensity: 0.2 });
        valve.rotation.y = Math.PI / 2;
        this.animated.push({ object: valve, baseY: valve.position.y, speed: side < 0 ? 0.32 : -0.28, phase: side, mode: "spin" });
      }
      const furnace = this.box(5.4, 0.23, 1.1, "#8a5438", 0, 0.78, -10.8, { emissive: "#d75c31", emissiveIntensity: 0.32, metalness: 0.48 });
      this.animated.push({ object: furnace, baseY: 0.78, speed: 0.7, phase: index, mode: "pulse" });
      const furnaceGlow = this.sphere(1.35, "#ff8a4d", 0, 1.05, -10.85, 12, { emissive: "#ff7b3d", emissiveIntensity: 0.55, transparent: true, opacity: 0.22 });
      this.animated.push({ object: furnaceGlow, baseY: 1.05, speed: 0.55, phase: index * 0.4, mode: "pulse" });
    } else if (district === 1) {
      for (let plant = 0; plant < 6; plant += 1) {
        const x = -9.2 + plant * 3.7;
        this.box(1.5, 0.7, 1.3, "#596e5b", x, 0.55, -9.8, { roughness: 0.84 });
        this.cylinder(0.06, 0.09, 1.65 + (plant % 2) * 0.6, "#77a56d", x, 1.65, -9.8, 7, { roughness: 0.76 });
        for (let leaf = 0; leaf < 3; leaf += 1) {
          const bloom = this.sphere(0.28 + leaf * 0.04, leaf === 2 ? tint : "#85be7e", x + (leaf - 1) * 0.32, 2.15 + leaf * 0.27, -9.8, 9, { emissive: tint, emissiveIntensity: leaf === 2 ? 0.42 : 0.08 });
          bloom.scale.y = 0.52;
          this.animated.push({ object: bloom, baseY: bloom.position.y, speed: 0.28 + plant * 0.025 + leaf * 0.08, phase: plant + leaf, mode: "swing" });
        }
      }
    } else if (district === 2) {
      for (const side of [-1, 1]) {
        this.cylinder(0.1, 0.16, 5.4, "#75818a", side * 8.4, 2.75, -10.5, 9, { metalness: 0.68 });
        const dish = this.torus(1.1, 0.09, tint, side * 8.4, 5.4, -10.3, 28, { emissive: tint, emissiveIntensity: 0.58, metalness: 0.4 });
        dish.rotation.y = side * 0.62;
        dish.scale.y = 0.62;
        this.animated.push({ object: dish, baseY: 5.4, speed: side < 0 ? 0.16 : -0.16, phase: side, mode: "spin" });
        const receiver = this.sphere(0.17, "#fff0bc", side * 8.4, 5.4, -10.05, 9, { emissive: tint, emissiveIntensity: 1.1 });
        this.animated.push({ object: receiver, baseY: 5.4, speed: 0.9, phase: side * 2, mode: "pulse" });
      }
      for (let signal = 0; signal < 7; signal += 1) {
        const bar = this.box(0.08, 0.08 + signal * 0.07, 0.09, tint, -1.2 + signal * 0.4, 1.05 + signal * 0.035, -10.8, { emissive: tint, emissiveIntensity: 0.85 });
        this.animated.push({ object: bar, baseY: bar.position.y, speed: 0.75 + signal * 0.08, phase: signal, mode: "pulse" });
      }
    } else if (district === 3) {
      for (const side of [-1, 1]) {
        this.box(1.3, 2.5, 0.7, "#596776", side * 8.4, 1.55, -10.3, { metalness: 0.62, roughness: 0.3 });
        const mechCore = this.sphere(0.48, tint, side * 8.4, 3.12, -10.3, 12, { metalness: 0.56, emissive: tint, emissiveIntensity: 0.42 });
        this.animated.push({ object: mechCore, baseY: 3.12, speed: 0.5 + Math.abs(side), phase: side, mode: "pulse" });
        this.box(2.2, 0.28, 0.55, "#8f795d", side * 8.4, 0.23, -10.3, { metalness: 0.35 });
      }
      this.createWeapon(this.world, 0, 1.62, -10.4, tint, 0.75);
    } else if (district === 4) {
      for (const side of [-1, 1]) {
        for (let coil = 0; coil < 4; coil += 1) {
          const ring = this.torus(0.55 + coil * 0.12, 0.06, coil % 2 ? tint : "#e0bf83", side * 8.3, 1.15 + coil * 0.68, -10.5, 28, { emissive: tint, emissiveIntensity: 0.48, metalness: 0.6 });
          ring.rotation.x = 0.35 + coil * 0.15;
          this.animated.push({ object: ring, baseY: ring.position.y, speed: (coil % 2 ? -1 : 1) * (0.2 + coil * 0.05), phase: coil + side, mode: "spin" });
        }
        const arcCore = this.sphere(0.28, "#e9fff4", side * 8.3, 3.55, -10.5, 12, { emissive: tint, emissiveIntensity: 1.4 });
        this.animated.push({ object: arcCore, baseY: 3.55, speed: 0.85, phase: side * 3, mode: "pulse" });
      }
    } else if (district === 5) {
      for (let tank = 0; tank < 4; tank += 1) {
        const x = -8.4 + tank * 5.6;
        this.cylinder(0.9, 0.9, 3.6, "#3c7076", x, 2.05, -10.6, 18, { metalness: 0.25, roughness: 0.18, emissive: tint, emissiveIntensity: 0.22 });
        this.torus(0.91, 0.07, "#a8b8ad", x, 1, -10.6, 30, { metalness: 0.6 });
        this.torus(0.91, 0.07, "#a8b8ad", x, 3.1, -10.6, 30, { metalness: 0.6 });
        for (let bubble = 0; bubble < 3; bubble += 1) {
          const bubbleMesh = this.sphere(0.1 + bubble * 0.035, "#c5fff1", x + (bubble - 1) * 0.3, 1.5 + bubble * 0.55, -9.68, 8, { emissive: tint, emissiveIntensity: 0.85 });
          this.animated.push({ object: bubbleMesh, baseY: 0.9, speed: 0.35 + bubble * 0.08, phase: tank + bubble, mode: "rise" });
        }
        this.registerHitbox({
          owner: "prop",
          objectId: this.objectId("tide-tank"),
          shape: "cylinder",
          center: new THREE.Vector3(x, 0, -10.6),
          radius: 1.05,
          halfDepth: 1.05,
          minY: 0,
          maxY: 3.9,
          solid: true,
        });
      }
    } else if (district === 6) {
      for (const side of [-1, 1]) {
        for (let gear = 0; gear < 4; gear += 1) {
          const clock = this.torus(0.5 + gear * 0.18, 0.075, gear % 2 ? tint : "#d4ac70", side * 8.2, 1.2 + gear * 0.92, -10.7, 18, { metalness: 0.65, emissive: tint, emissiveIntensity: 0.25 });
          clock.rotation.set(gear * 0.25, side * 0.4, gear * 0.35);
          this.animated.push({ object: clock, baseY: clock.position.y, speed: (gear % 2 ? -1 : 1) * (0.11 + gear * 0.04), phase: gear });
        }
      }
    } else if (district === 7) {
      for (let moon = 0; moon < 5; moon += 1) {
        const angle = moon * 1.257;
        const orbRadius = 0.34 + (moon % 3) * 0.16;
        const orb = this.sphere(orbRadius, moon % 2 ? tint : "#e5ddc5", Math.cos(angle) * 8.8, 2.1 + (moon % 2) * 1.4, -9.8 + Math.sin(angle), 14, { emissive: tint, emissiveIntensity: 0.28, roughness: 0.42 });
        this.animated.push({ object: orb, baseX: 0, baseY: orb.position.y, baseZ: -9.8, radius: 8.8, speed: 0.1 + moon * 0.018, phase: angle, mode: "orbit" });
        this.registerHitbox({
          owner: "prop", objectId: this.objectId("moonwell-orb"), shape: "cylinder",
          center: orb.position.clone(), radius: orbRadius, halfDepth: orbRadius,
          minY: orb.position.y - orbRadius, maxY: orb.position.y + orbRadius, solid: false,
          dynamic: () => orb.getWorldPosition(new THREE.Vector3()),
        });
      }
      const moonRing = this.addRingMesh(4.2, 0.045, tint, 0, 3.1, -10.5, 0.4, 0.38, 0.56);
      this.animated.push({ object: moonRing, baseY: 3.1, speed: 0.12, phase: index, mode: "spin" });
    } else if (district === 8) {
      for (let rackIndex = 0; rackIndex < 5; rackIndex += 1) {
        const x = -8.7 + rackIndex * 4.35;
        this.box(1.65, 4.1, 0.82, "#33433f", x, 2.15, -10.7, { metalness: 0.43, roughness: 0.38 });
        for (let node = 0; node < 5; node += 1) {
          const nodeMesh = this.box(1.15, 0.1, 0.08, node % 2 ? tint : "#d7c080", x, 0.75 + node * 0.7, -10.25, { emissive: node % 2 ? tint : "#7f6239", emissiveIntensity: 0.7 });
          this.animated.push({ object: nodeMesh, baseY: nodeMesh.position.y, speed: 0.65 + node * 0.12, phase: x + node, mode: "pulse" });
        }
        const stem = this.cylinder(0.04, 0.07, 1.1, "#6da56b", x + 0.45, 4.75, -10.4, 6, { roughness: 0.75 });
        const flower = this.sphere(0.23, "#83b96e", x + 0.45, 5.3, -10.4, 8, { emissive: tint, emissiveIntensity: 0.18 });
        this.animated.push({ object: stem, baseY: 4.75, speed: 0.22, phase: x, mode: "swing" });
        this.animated.push({ object: flower, baseY: 5.3, speed: 0.48, phase: x + 1, mode: "pulse" });
        this.registerHitbox({
          owner: "prop",
          objectId: this.objectId("server-rack"),
          shape: "box",
          center: new THREE.Vector3(x, 2.15, -10.7),
          radius: 0.95,
          halfDepth: 0.55,
          minY: 0,
          maxY: 4.25,
          solid: true,
        });
      }
    } else {
      for (let crate = 0; crate < 5; crate += 1) {
        const side = crate % 2 ? 1 : -1;
        const x = side * (7.1 + (crate % 3) * 1.35);
        const y = 0.62 + Math.floor(crate / 3) * 1.1;
        this.box(1.75, 1.1, 1.55, crate % 2 ? "#59616b" : "#6e5b50", x, y, -9.9, { metalness: 0.42, roughness: 0.45 });
        this.box(1.48, 0.07, 0.08, tint, x, y, -9.08, { emissive: tint, emissiveIntensity: 0.5 });
        this.registerHitbox({
          owner: "prop",
          objectId: this.objectId("salvage-crate"),
          shape: "box",
          center: new THREE.Vector3(x, Math.max(0.55, y), -9.9),
          radius: 0.88,
          halfDepth: 0.78,
          minY: 0,
          maxY: Math.max(1.18, y + 0.55),
          solid: true,
          standable: true,
        });
      }
      const wing = this.box(6.2, 0.18, 1.7, "#6c7881", 0, 3.1, -11.2, { metalness: 0.69, roughness: 0.3 });
      wing.rotation.z = -0.18;
      const reactor = this.sphere(0.3, tint, 0, 3.1, -10.28, 12, { emissive: tint, emissiveIntensity: 1.05 });
      this.animated.push({ object: wing, baseY: 3.1, speed: 0.18, phase: index, mode: "swing" });
      this.animated.push({ object: reactor, baseY: 3.1, speed: 0.7, phase: index * 0.7, mode: "pulse" });
    }
    const fixtures: { x: number; z: number; radius: number; min: number; max: number; solid: boolean; standable?: boolean }[] = [];
    if (district === 0) for (const side of [-1, 1]) fixtures.push({ x: side * 8.5, z: -10.7, radius: 0.28, min: 0.4, max: 7.9, solid: true });
    if (district === 1) for (let plant = 0; plant < 6; plant += 1) fixtures.push({ x: -9.2 + plant * 3.7, z: -9.8, radius: 0.72, min: 0, max: 0.9, solid: true, standable: true });
    if (district === 2) for (const side of [-1, 1]) fixtures.push({ x: side * 8.4, z: -10.5, radius: 0.35, min: 0, max: 5.6, solid: true });
    if (district === 3) for (const side of [-1, 1]) fixtures.push({ x: side * 8.4, z: -10.3, radius: 0.7, min: 0, max: 3.6, solid: true });
    if (district === 4) for (const side of [-1, 1]) fixtures.push({ x: side * 8.3, z: -10.5, radius: 0.96, min: 0.6, max: 4.05, solid: false });
    if (district === 6) for (const side of [-1, 1]) fixtures.push({ x: side * 8.2, z: -10.7, radius: 1.12, min: 0.6, max: 5.15, solid: false });
    for (const fixture of fixtures) {
      this.registerHitbox({
        owner: "prop", objectId: this.objectId("district-fixture"), shape: "cylinder",
        center: new THREE.Vector3(fixture.x, (fixture.min + fixture.max) / 2, fixture.z),
        radius: fixture.radius, halfDepth: fixture.radius,
        minY: fixture.min, maxY: fixture.max,
        solid: fixture.solid, standable: fixture.standable,
      });
    }
  }

  private detailRoomGadget(parent: THREE.Group, index: number, tint: string) {
    const finCount = 2 + (index % 4);
    const accent = index % 3 === 0 ? "#f0cb8e" : index % 3 === 1 ? "#d9e7d5" : "#9eb8ca";
    for (let fin = 0; fin < finCount; fin += 1) {
      const angle = (Math.PI * 2 * fin) / finCount + (index % 7) * 0.08;
      const blade = this.boxIn(parent, 0.12 + (index % 3) * 0.025, 0.62 + (index % 5) * 0.055, 0.42, fin % 2 ? tint : accent, Math.cos(angle) * 1.05, 1.22 + (fin % 2) * 0.12, Math.sin(angle) * 0.72, { metalness: 0.64, roughness: 0.22, emissive: tint, emissiveIntensity: 0.18 });
      blade.rotation.y = -angle;
      blade.rotation.z = 0.18 * Math.sin(angle);
    }
    const chipCount = 1 + (Math.floor(index / 4) % 3);
    for (let chip = 0; chip < chipCount; chip += 1) {
      const angle = index * 0.37 + chip * 2.094;
      const node = this.sphereIn(parent, 0.11 + (index % 2) * 0.035, chip % 2 ? tint : accent, Math.cos(angle) * 1.48, 1.05 + chip * 0.38, Math.sin(angle) * 0.96, 8, { emissive: tint, emissiveIntensity: 0.92, metalness: 0.35 });
      node.scale.y = 1.25;
    }
    if (index % 2 === 0) {
      const signatureRing = this.torusIn(parent, 1.45 + (index % 5) * 0.045, 0.03 + (index % 3) * 0.012, tint, 0, 1.22, 0);
      signatureRing.rotation.set(0.35 + (index % 6) * 0.13, index * 0.11, 0.2);
    }
    const serialBars = 2 + (index % 5);
    for (let bar = 0; bar < serialBars; bar += 1) {
      this.boxIn(parent, 0.06, 0.04 + bar * 0.025, 0.22, bar % 2 ? tint : accent, -0.3 + bar * 0.12, 0.36, -0.82, { emissive: tint, emissiveIntensity: 0.64, metalness: 0.4 });
    }
  }

  private buildMechArmory(tint: string) {
    const big = this.createMech(this.world, -7.4, 0.24, -4.2, "#d0a66e", 1.42);
    big.rotation.y = 0.35;
    const second = this.createMech(this.world, 7.4, 0.24, -5.1, "#74b7b6", 1.13);
    second.rotation.y = -0.45;
    this.createWeapon(this.world, -8.8, 1.25, 1.4, "#edbf79", 0.85);
    this.createWeapon(this.world, 8.5, 1.25, 1.4, tint, 0.85);
    this.label("NONLETHAL MECH & WEAPON BAY", 0, 8.8, -12.65, 9.4, "#f3d295");
    for (const x of [-8.5, 8.5]) {
      this.box(3.5, 0.62, 2.4, "#3d4650", x, 0.45, 1.4, { metalness: 0.35 });
      this.registerHitbox({
        owner: "prop", objectId: this.objectId("armory-table"), shape: "box",
        center: new THREE.Vector3(x, 0.45, 1.4), radius: 1.75, halfDepth: 1.2,
        minY: 0, maxY: 0.76, solid: true, standable: true,
      });
    }
  }

  private buildPortalGallery(tint: string) {
    for (let i = 0; i < 3; i += 1) {
      const x = -7.5 + i * 7.5;
      const ring = this.addRingMesh(1.14, 0.11, i === 1 ? "#f3a9dc" : tint, x, 3.25, -8.1, 0, 1.42, 0.98);
      ring.rotation.y = Math.PI;
      this.box(0.28, 5.4, 0.38, "#727782", x - 1.3, 2.72, -8.1, { metalness: 0.52 });
      this.box(0.28, 5.4, 0.38, "#727782", x + 1.3, 2.72, -8.1, { metalness: 0.52 });
      for (const side of [-1, 1]) {
        this.registerHitbox({
          owner: "prop", objectId: this.objectId("portal-frame"), shape: "box",
          center: new THREE.Vector3(x + side * 1.3, 2.7, -8.1),
          radius: 0.2, halfDepth: 0.24, minY: 0, maxY: 5.5, solid: true,
        });
      }
      const pearl = this.sphere(0.24, i === 1 ? "#ffc9eb" : tint, x, 6.3, -8.1, 12, { emissive: tint, emissiveIntensity: 1.1 });
      this.animated.push({ object: pearl, baseY: 6.3, speed: 0.4, phase: i });
      this.registerHitbox({
        owner: "prop", objectId: this.objectId("portal-pearl"), shape: "cylinder",
        center: pearl.position.clone(), radius: 0.27, halfDepth: 0.27,
        minY: 6.0, maxY: 6.6, solid: false,
        dynamic: () => pearl.getWorldPosition(new THREE.Vector3()),
      });
      this.animated.push({ object: ring, baseY: 3.25, speed: 0.18 + i * 0.04, phase: i * 1.2, mode: "spin" });
      this.registerHitbox({
        owner: "prop",
        objectId: this.objectId("portal-gate"),
        shape: "cylinder",
        center: new THREE.Vector3(x, 3.25, -8.1),
        radius: 1.28,
        halfDepth: 1.28,
        minY: 1.85,
        maxY: 4.75,
        solid: false,
      });
    }
    this.createWeapon(this.world, 0, 1.9, -1.1, "#ec9fd0", 1.3);
    this.label("PORTAL GUN GALLERY", 0, 8.7, -12.55, 7.2, "#f3abdf");
  }

  private buildShrinkLab(tint: string) {
    for (let i = 0; i < 5; i += 1) {
      const scale = [1, 0.75, 0.52, 0.34, 0.2][i];
      const x = -8 + i * 4;
      const pedestal = this.cylinder(0.9, 1.08, 0.55, "#48505a", x, 0.28, -6.7, 22, { metalness: 0.55 });
      pedestal.scale.setScalar(1.03 - i * 0.04);
      this.registerHitbox({
        owner: "prop", objectId: this.objectId("shrink-pedestal"), shape: "cylinder",
        center: new THREE.Vector3(x, 0.28, -6.7), radius: 0.9, halfDepth: 0.9,
        minY: 0, maxY: 0.62, solid: true, standable: true,
      });
      const object = this.sphere(0.85, i % 2 ? tint : "#eebf7a", x, 1.15, -6.7, 17, { metalness: 0.28, emissive: tint, emissiveIntensity: 0.34 });
      object.scale.setScalar(scale);
      this.animated.push({ object, baseY: 1.15, speed: 0.24 + i * 0.08, phase: i, mode: "spin" });
      this.registerHitbox({
        owner: "prop", objectId: this.objectId("shrink-specimen"), shape: "cylinder",
        center: object.position.clone(), radius: Math.max(0.28, 0.85 * scale), halfDepth: Math.max(0.28, 0.85 * scale),
        minY: 1.15 - 0.85 * scale, maxY: 1.15 + 0.85 * scale, solid: false,
        dynamic: () => object.getWorldPosition(new THREE.Vector3()),
      });
      const halo = this.torus(1.2, 0.035, tint, x, 1.05, -6.7, 36);
      halo.scale.setScalar(1.08 - i * 0.14);
    }
    this.createWeapon(this.world, 0, 1.75, -1.3, "#ffc77c", 1.05);
    this.label("SHRINK-RAY LABORATORY", 0, 8.6, -12.4, 8, "#f7d393");
  }

  private createWeapon(parent: THREE.Group, x: number, y: number, z: number, color: number | string, scale = 1) {
    const weapon = new THREE.Group();
    weapon.position.set(x, y, z);
    weapon.scale.setScalar(scale);
    parent.add(weapon);
    const dark = this.boxIn(weapon, 0.68, 0.38, 1.28, "#343b47", 0, 0, 0);
    dark.rotation.x = 0.08;
    this.boxIn(weapon, 0.48, 0.16, 1.05, "#596271", 0, 0.08, 0.08, { metalness: 0.58, roughness: 0.24 });
    this.boxIn(weapon, 0.45, 0.34, 0.68, color, 0, 0.05, -0.56, { metalness: 0.53, roughness: 0.2, emissive: color, emissiveIntensity: 0.2 });
    const barrel = new THREE.Mesh(this.geometry("weapon-barrel", () => new THREE.CylinderGeometry(0.11, 0.14, 0.9, 12)), this.material(color, { metalness: 0.72, roughness: 0.18, emissive: color, emissiveIntensity: 0.28 }));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.05, -0.95);
    weapon.add(barrel);
    for (const ring of [-0.72, -0.38]) {
      const collar = new THREE.Mesh(this.geometry("weapon-collar", () => new THREE.TorusGeometry(0.16, 0.035, 7, 16)), this.material("#d6bd8c", { metalness: 0.72, roughness: 0.2 }));
      collar.rotation.y = Math.PI / 2;
      collar.position.set(0, 0.05, ring);
      weapon.add(collar);
    }
    const emitter = this.sphereIn(weapon, 0.17, color, 0, 0.05, -1.38, 12, { emissive: color, emissiveIntensity: 1.15 });
    weapon.userData.core = emitter;
    this.boxIn(weapon, 0.25, 0.52, 0.35, "#596271", 0, -0.34, 0.3, { metalness: 0.42, roughness: 0.25 });
    this.boxIn(weapon, 0.18, 0.42, 0.2, "#2e3841", 0, -0.52, 0.42, { metalness: 0.5, roughness: 0.3 });
    this.boxIn(weapon, 0.16, 0.2, 0.1, "#d3b77e", 0.08, -0.34, 0.48, { metalness: 0.62, roughness: 0.22 });
    this.boxIn(weapon, 0.72, 0.12, 0.24, "#2b333b", 0, 0.28, 0.42, { metalness: 0.62, roughness: 0.24 });
    this.boxIn(weapon, 0.62, 0.08, 0.18, color, 0, 0.34, 0.48, { emissive: color, emissiveIntensity: 0.32, metalness: 0.45 });
    for (const side of [-1, 1]) this.boxIn(weapon, 0.08, 0.22, 1.05, "#78828a", side * 0.28, 0.2, -0.05, { metalness: 0.58, roughness: 0.24 });
    const id = this.objectId("weapon");
    this.registerObjectHitbox(weapon, id, 0.38 * scale, 0.95 * scale, 0.45 * scale, "weapon", false);
    this.animated.push({ object: weapon, baseY: y, speed: 0.42, phase: x + z, mode: "bob" });
    return weapon;
  }

  private registerNpc(actor: THREE.Group, id: string, name: string, walker?: Walker, species: SpawnNpcSpecies = "human") {
    actor.traverse((object) => {
      object.userData.npcId = id;
    });
    const normalScale = actor.scale.x || 1;
    const parts = actor.userData.parts as CharacterParts | undefined;
    const hitbox = this.registerHitbox({
      owner: "npc",
      objectId: id,
      shape: "cylinder",
      center: actor.position.clone(),
      radius: 0.58 * normalScale,
      halfDepth: 0.58 * normalScale,
      minY: actor.position.y,
      maxY: actor.position.y + 2.15 * normalScale,
      solid: false,
      dynamic: () => actor.getWorldPosition(new THREE.Vector3()),
    });
    this.npcs.push({
      actor,
      id,
      name,
      species,
      scale: normalScale,
      normalScale,
      walker,
      parts,
      home: actor.position.clone(),
      hitbox,
      defeated: false,
      dissolved: false,
      defeatedAt: 0,
      respawnAt: 0,
    });
  }

  private buildSpawnedCharacter(species: SpawnNpcSpecies, serial: number) {
    const humanLooks = [
      { skin: "#c98b68", shirt: "#6db6a4" },
      { skin: "#9f684c", shirt: "#d68a68" },
      { skin: "#e0b497", shirt: "#899ed3" },
      { skin: "#825940", shirt: "#a7bd70" },
      { skin: "#d9a375", shirt: "#d47eac" },
    ];
    const look = humanLooks[(serial - 1) % humanLooks.length];
    const actor = species === "human"
      ? this.buildCharacter(look.skin, look.shirt, false)
      : species === "robot"
        ? this.buildCharacter("#92a6aa", "#344a54", false)
        : this.buildCharacter("#85c27b", "#7450a3", false);
    const parts = actor.userData.parts as CharacterParts;
    const root = parts.root;

    if (species === "robot") {
      this.boxIn(root, 0.74, 0.38, 0.12, "#687d81", 0, 1.99, -0.35, { metalness: 0.72, roughness: 0.22 });
      this.boxIn(root, 0.58, 0.2, 0.1, "#293942", 0, 1.99, -0.425, { metalness: 0.62, roughness: 0.18, emissive: "#235057", emissiveIntensity: 0.28 });
      for (const side of [-1, 1]) {
        this.sphereIn(root, 0.063, "#9dfff1", side * 0.16, 2, -0.49, 9, { emissive: "#53f0dd", emissiveIntensity: 1.45 });
        const ear = this.boxIn(root, 0.16, 0.33, 0.16, "#65767d", side * 0.46, 1.97, -0.02, { metalness: 0.68, roughness: 0.25 });
        ear.rotation.z = side * -0.12;
        this.boxIn(root, 0.19, 0.16, 0.07, "#d7bd88", side * 0.29, 1.42, -0.31, { metalness: 0.52, roughness: 0.29 });
        this.sphereIn(root, 0.095, "#91f0d5", side * 0.29, 1.13, -0.29, 8, { emissive: "#55cfae", emissiveIntensity: 0.78 });
      }
      const antenna = new THREE.Mesh(this.geometry("summoned-robot-antenna", () => new THREE.CylinderGeometry(0.025, 0.045, 0.38, 7)), this.material("#d8c391", { metalness: 0.75, roughness: 0.2 }));
      antenna.position.set(0.2, 2.34, 0.04);
      root.add(antenna);
      this.sphereIn(root, 0.09, "#93fae2", 0.2, 2.55, 0.04, 8, { emissive: "#66ead0", emissiveIntensity: 1.3 });
      this.boxIn(root, 0.82, 0.19, 0.08, "#819197", 0, 1.11, -0.29, { metalness: 0.7, roughness: 0.24 });
      for (let bar = -2; bar <= 2; bar += 1) this.boxIn(root, 0.09, 0.08, 0.04, bar % 2 ? "#8dffe6" : "#e5bf81", bar * 0.13, 1.11, -0.35, { emissive: "#64e8d0", emissiveIntensity: 0.58 });
      actor.scale.setScalar(0.94);
    } else if (species === "alien") {
      parts.head.scale.set(1.23, 1.19, 0.94);
      this.sphereIn(root, 0.075, "#f3fff0", 0, 1.96, -0.52, 10, { emissive: "#b7ffae", emissiveIntensity: 0.48 });
      this.sphereIn(root, 0.035, "#49375f", 0, 1.97, -0.555, 8, { roughness: 0.3 });
      for (const side of [-1, 1]) {
        const stalk = new THREE.Mesh(this.geometry("summoned-alien-stalk", () => new THREE.CylinderGeometry(0.045, 0.065, 0.43, 7)), this.material("#75a96c", { roughness: 0.64 }));
        stalk.position.set(side * 0.19, 2.36, 0.08);
        stalk.rotation.z = side * -0.22;
        root.add(stalk);
        this.sphereIn(root, 0.11, "#e3b9fb", side * 0.23, 2.59, 0.08, 10, { emissive: "#bd8fe8", emissiveIntensity: 0.72 });
        this.sphereIn(root, 0.065, "#ecfff0", side * 0.24, 1.96, -0.49, 9, { emissive: "#9effa7", emissiveIntensity: 0.38 });
        this.sphereIn(root, 0.03, "#573a76", side * 0.24, 1.97, -0.535, 7);
      }
      const tail = new THREE.Mesh(this.geometry("summoned-alien-tail", () => new THREE.CapsuleGeometry(0.09, 0.75, 3, 7)), this.material("#7956a5", { roughness: 0.62 }));
      tail.position.set(0, 0.73, 0.45);
      tail.rotation.x = -0.92;
      root.add(tail);
      const tailTip = this.sphereIn(root, 0.16, "#bd92df", 0, 0.29, 0.78, 8, { emissive: "#8e69bb", emissiveIntensity: 0.2 });
      actor.scale.setScalar(0.92);
    }
    return actor;
  }

  spawnFriendlyNpc(species: SpawnNpcSpecies): string | null {
    if (!this.npcSpawnerUnlocked) return null;
    const summoned = this.npcs.filter((npc) => npc.id.startsWith("summoned-")).length;
    if (summoned >= 14) return null;
    this.spawnSerial += 1;
    const names: Record<SpawnNpcSpecies, string[]> = {
      human: ["Ranger Jo", "Pioneer Kit", "Scout Wren", "Deputy Sol", "Maker Quinn"],
      robot: ["R-3LAY", "Copper-Byte", "Wrenchley", "Dot Matrix", "Servo-Pal"],
      alien: ["Zibble", "Moro of Vesta", "Glint", "Ploob", "Sprocket IX"],
    };
    const speciesLabel = species === "human" ? "Human" : species === "robot" ? "Robot" : "Alien";
    const name = names[species][(this.spawnSerial - 1) % names[species].length];
    const id = `summoned-${species}-${this.objectId("npc")}`;
    const angle = this.viewYaw + (Math.random() * 0.8 - 0.4);
    const distance = 2.8 + Math.random() * 1.7;
    const position = this.playerPosition.clone().add(new THREE.Vector3(-Math.sin(angle) * distance, 0, -Math.cos(angle) * distance));
    this.clampWorldPosition(position);
    position.y = this.visibleFloorHeight();
    this.resolveCollision(position, 0.49, 2 * 0.86);
    const skins: Record<SpawnNpcSpecies, string> = { human: "#c98b68", robot: "#92a6aa", alien: "#85c27b" };
    const clothes: Record<SpawnNpcSpecies, string> = { human: "#6db6a4", robot: "#344a54", alien: "#7450a3" };
    const actor = this.buildSpawnedCharacter(species, this.spawnSerial);
    actor.position.copy(position);
    actor.rotation.y = Math.atan2(this.playerPosition.x - position.x, this.playerPosition.z - position.z);
    actor.scale.multiplyScalar(0.86);
    this.world.add(actor);
    const walker: Walker = {
      actor,
      from: position.clone(),
      to: position.clone().add(new THREE.Vector3(Math.cos(angle) * 2, 0, Math.sin(angle) * 2)),
      speed: 0.12 + Math.random() * 0.055,
      elapsed: 0,
      phase: this.spawnSerial * 0.73,
    };
    this.walkers.push(walker);
    this.registerNpc(actor, id, name, walker, species);
    const npc = this.npcs.find((entry) => entry.id === id);
    if (npc) {
      npc.home.copy(position);
      npc.hitbox!.minY = position.y;
      npc.hitbox!.maxY = position.y + 2.15 * actor.scale.x;
    }
    return `${speciesLabel} NPC ${name}`;
  }

  private buildPlayer() {
    this.player = this.buildCharacter("#c88a65", "#54b7a6", false);
    this.player.scale.setScalar(1);
    this.player.position.copy(this.playerPosition);
    this.player.visible = !this.firstPersonActive;
    this.playerParts = this.player.userData.parts as CharacterParts;
    this.playerShadow = new THREE.Mesh(
      this.geometry("player-contact-shadow", () => new THREE.CircleGeometry(0.58, 20)),
      new THREE.MeshBasicMaterial({ color: "#08141a", transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.playerShadow.rotation.x = -Math.PI / 2;
    this.playerShadow.scale.set(1, 0.6, 1);
    this.playerShadow.position.set(this.playerPosition.x, this.visibleFloorHeight(), this.playerPosition.z);
    this.world.add(this.playerShadow);
  }

  private spawnPylon(position: THREE.Vector3) {
    if (this.placedDreamcores.length >= 10) {
      const oldest = this.placedDreamcores.shift();
      if (oldest) {
        this.world.remove(oldest.mesh);
        this.removeHitbox(oldest.hitbox);
        if (oldest.creationHitbox) this.removeHitbox(oldest.creationHitbox);
        if (oldest.coreHitbox) this.removeHitbox(oldest.coreHitbox);
      }
    }

    const group = new THREE.Group();
    group.position.copy(position);
    this.world.add(group);

    // Dreamcore model: outer rotating gold/brass loops, inner glowing blue core, and a floating particle field.
    const outerRadius = 0.58;
    const innerRadius = 0.32;
    const sphereMesh = new THREE.Group();
    sphereMesh.position.set(0, 0.85, 0);
    group.add(sphereMesh);

    const brass = this.material("#d8c28f", { metalness: 0.84, roughness: 0.18 });
    const blueMiddle = this.material("#8ff0da", { emissive: "#5addc5", emissiveIntensity: 1.15, transparent: true, opacity: 0.9 });

    const coreSphere = new THREE.Mesh(this.geometry(`sphere:${innerRadius}:14`, () => new THREE.SphereGeometry(innerRadius, 14, 10)), blueMiddle);
    sphereMesh.add(coreSphere);

    const ringA = new THREE.Mesh(this.geometry(`torus:${outerRadius}:0.045:32`, () => new THREE.TorusGeometry(outerRadius, 0.045, 6, 32)), brass);
    ringA.rotation.x = Math.PI / 2;
    sphereMesh.add(ringA);

    const ringB = new THREE.Mesh(this.geometry(`torus:${outerRadius + 0.11}:0.028:32`, () => new THREE.TorusGeometry(outerRadius + 0.11, 0.028, 4, 32)), brass);
    ringB.rotation.y = Math.PI / 3;
    sphereMesh.add(ringB);

    this.animated.push({ object: ringA, baseY: 0, speed: 2.1, phase: position.x, mode: "spin" });
    this.animated.push({ object: ringB, baseY: 0, speed: -1.7, phase: position.z, mode: "spin" });
    this.animated.push({ object: sphereMesh, baseY: 0.85, speed: 0.45, phase: position.x + position.z, mode: "bob" });

    // Orbital dust particle field
    const pCount = 20;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const r = outerRadius + 0.18 + Math.random() * 0.22;
      pPos[i * 3] = Math.cos(angle) * r;
      pPos[i * 3 + 1] = (Math.random() * 2 - 1) * 0.42;
      pPos[i * 3 + 2] = Math.sin(angle) * r;
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ color: "#8ff0da", size: 0.085, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending });
    const particles = new THREE.Points(pGeo, pMat);
    sphereMesh.add(particles);

    const id = this.objectId("dreamcore");
    const hitbox = this.registerHitbox({
      owner: "prop",
      objectId: id,
      shape: "cylinder",
      center: position.clone(),
      radius: 0.58,
      halfDepth: 0.58,
      minY: position.y,
      maxY: position.y + 1.55,
      solid: true,
      standable: true,
    });

    const record: PlacedDreamcore = {
      id,
      mesh: group,
      sphereMesh,
      particles,
      hitbox,
      creationId: this.objectId("creation"),
      creationMesh: null,
      creationHitbox: null,
      coreMesh: null,
      coreHitbox: null,
      prompt: "",
      ability: "none",
      building: false,
      buildProgress: 0,
      piloted: false,
    };

    this.placedDreamcores.push(record);
    this.spawnSparks(position.clone().add(new THREE.Vector3(0, 0.85, 0)), "#8ff0da", 14, 2.4);
  }

  private buildDreamcoreMesh(core: PlacedDreamcore, prompt: string) {
    const text = prompt.toLowerCase();
    core.prompt = prompt;
    core.building = true;
    core.buildProgress = 0;

    const group = new THREE.Group();
    // Anchor creations slightly offset so they don't spawn directly on the pylon's core
    group.position.set(0, 0.04, -2.1);
    core.mesh.add(group);
    core.creationMesh = group;

    const colors = [
      { name: "red", hex: "#e55039" },
      { name: "white", hex: "#f1f2f6" },
      { name: "blue", hex: "#4a69bd" },
      { name: "gold", hex: "#f8c291" },
      { name: "purple", hex: "#a55eea" },
      { name: "green", hex: "#78e08f" },
      { name: "orange", hex: "#f0932b" },
      { name: "yellow", hex: "#f6e58d" },
      { name: "pink", hex: "#ff7979" },
      { name: "cyan", hex: "#22a6b3" },
      { name: "black", hex: "#1e272e" },
      { name: "grey", hex: "#8395a7" },
    ];
    const parsedColors = colors.filter((c) => text.includes(c.name)).map((c) => c.hex);
    const colorA = parsedColors[0] ?? "#cbd6cf";
    const colorB = parsedColors[1] ?? "#53645b";

    let radius = 1.1;
    let height = 1.9;

    // Procedural AI Mesh Generator parses subjects and matches them to detailed, colored multi-mesh models
    if (text.includes("rocket") || text.includes("ship") || text.includes("spacecraft") || text.includes("missile")) {
      radius = 1.25;
      height = 3.8;
      const body = new THREE.Mesh(this.geometry("dream-rocket-body", () => new THREE.CylinderGeometry(0.55, 0.55, 2.4, 12)), this.material(colorA, { roughness: 0.3, metalness: 0.4 }));
      body.position.y = 1.48;
      group.add(body);
      const nose = new THREE.Mesh(this.geometry("dream-rocket-nose", () => new THREE.ConeGeometry(0.55, 1, 12)), this.material(colorB, { roughness: 0.2, metalness: 0.5 }));
      nose.position.y = 3.18;
      group.add(nose);
      for (let fin = 0; fin < 3; fin += 1) {
        const angle = (fin / 3) * Math.PI * 2;
        const wing = this.boxIn(group, 0.11, 0.95, 0.72, colorB, Math.cos(angle) * 0.72, 0.76, Math.sin(angle) * 0.72, { metalness: 0.3 });
        wing.rotation.y = -angle;
      }
      const nozzle = new THREE.Mesh(this.geometry("dream-rocket-nozzle", () => new THREE.CylinderGeometry(0.34, 0.43, 0.28, 10)), this.material("#2f3640", { metalness: 0.78 }));
      nozzle.position.y = 0.14;
      group.add(nozzle);
      const windowFrame = this.sphereIn(group, 0.24, "#1e272e", 0, 2.2, -0.47, 10);
      windowFrame.scale.set(1, 1, 0.42);
      this.sphereIn(group, 0.18, "#7cedd5", 0, 2.2, -0.55, 9, { emissive: "#5cebc3", emissiveIntensity: 0.48 });
    } else if (text.includes("car") || text.includes("hovercar") || text.includes("vehicle") || text.includes("rover")) {
      radius = 1.65;
      height = 1.34;
      const base = this.boxIn(group, 3.1, 0.38, 1.45, colorA, 0, 0.38, 0, { metalness: 0.52, roughness: 0.31 });
      const canopy = this.boxIn(group, 1.72, 0.55, 1.25, colorB, -0.22, 0.85, 0, { metalness: 0.45, roughness: 0.26 });
      const windowMesh = this.boxIn(group, 0.9, 0.35, 1.28, "#8ff2dd", -0.66, 0.89, 0, { transparent: true, opacity: 0.65, emissive: "#54edd0", emissiveIntensity: 0.32 });
      windowMesh.rotation.z = -0.14;
      for (const side of [-1, 1]) {
        for (const axle of [-0.94, 0.94]) {
          const pad = this.cylinderIn(group, 0.34, 0.34, 0.16, axle, 0.16, side * 0.78, 10, "#1c242a", { metalness: 0.65 });
          pad.rotation.x = Math.PI / 2;
          const hub = this.sphereIn(group, 0.19, "#7ffcdc", axle, 0.16, side * 0.88, 8, { emissive: "#54edd0", emissiveIntensity: 0.85 });
          this.animated.push({ object: hub, baseY: 0.16, speed: 2.1, phase: axle, mode: "pulse" });
        }
      }
    } else if (text.includes("mech") || text.includes("walker") || text.includes("robot") || text.includes("sentinel")) {
      radius = 1.2;
      height = 2.45;
      const body = this.boxIn(group, 0.95, 1.05, 0.67, colorA, 0, 1.48, 0, { metalness: 0.42, roughness: 0.35 });
      const face = this.boxIn(group, 0.55, 0.38, 0.14, colorB, 0, 1.62, -0.38, { metalness: 0.4 });
      const eye = this.sphereIn(group, 0.11, "#9ffde4", 0, 1.62, -0.46, 8, { emissive: "#54edd0", emissiveIntensity: 1.15 });
      this.animated.push({ object: eye, baseY: 1.62, speed: 0.7, phase: 0, mode: "pulse" });
      const pelvis = this.cylinderIn(group, 0.34, 0.42, 0.38, 0, 0.96, 0, 10, "#2c3e50", { metalness: 0.65 });
      for (const side of [-1, 1]) {
        this.boxIn(group, 0.24, 0.82, 0.28, "#2e3b4e", side * 0.68, 1.48, 0.08, { metalness: 0.52 });
        this.sphereIn(group, 0.11, colorB, side * 0.85, 1.2, -0.16, 8, { emissive: colorB, emissiveIntensity: 0.55 });
        const leg = this.boxIn(group, 0.28, 0.72, 0.34, "#536474", side * 0.28, 0.48, 0.02, { metalness: 0.48 });
        const toe = this.boxIn(group, 0.38, 0.14, 0.44, colorB, side * 0.31, 0.12, -0.14);
      }
    } else if (text.includes("turret") || text.includes("cannon") || text.includes("pylon") || text.includes("laser") || text.includes("gun")) {
      radius = 1.1;
      height = 1.95;
      const base = this.boxIn(group, 1.5, 0.18, 1.5, "#1e272e", 0, 0.1, 0, { metalness: 0.65 });
      const pillar = this.cylinderIn(group, 0.28, 0.38, 0.82, 0, 0.51, 0, 10, colorA, { metalness: 0.43 });
      const head = new THREE.Group();
      head.position.set(0, 1.15, 0);
      group.add(head);
      this.boxIn(head, 0.82, 0.55, 0.82, colorB, 0, 0, 0, { metalness: 0.5 });
      const barrel = this.cylinderIn(head, 0.1, 0.13, 1.1, 0, 0.05, -0.72, 10, "#2f3640", { metalness: 0.76 });
      barrel.rotation.x = Math.PI / 2;
      const muzzle = this.sphereIn(head, 0.14, "#fff0a3", 0, 0.05, -1.28, 9, { emissive: "#ffd277", emissiveIntensity: 1.15 });
      this.animated.push({ object: head, baseY: 1.15, speed: 0.11, phase: core.mesh.position.x, mode: "spin" });
      this.animated.push({ object: muzzle, baseY: 0.05, speed: 0.8, phase: 0, mode: "pulse" });
    } else if (text.includes("tree") || text.includes("plant") || text.includes("flower") || text.includes("flora")) {
      radius = 1.34;
      height = 2.85;
      const stem = this.cylinderIn(group, 0.11, 0.24, 1.62, 0, 0.82, 0, 8, "#7f8c8d", { roughness: 0.82 });
      this.animated.push({ object: stem, baseY: 0.82, speed: 0.22, phase: core.mesh.position.x, mode: "swing" });
      const canopy = this.sphereIn(group, 0.94, colorA, 0, 2.2, 0, 12, { roughness: 0.72 });
      this.animated.push({ object: canopy, baseY: 2.2, speed: 0.22, phase: core.mesh.position.x, mode: "swing" });
      for (let leaf = 0; leaf < 3; leaf += 1) {
        const bloom = this.sphereIn(group, 0.22 + leaf * 0.035, colorB, Math.cos(leaf * 2) * 0.72, 1.76 + leaf * 0.38, Math.sin(leaf * 2) * 0.72, 9, { emissive: colorB, emissiveIntensity: 0.58 });
        bloom.scale.y = 0.52;
        this.animated.push({ object: bloom, baseY: bloom.position.y, speed: 0.28 + leaf * 0.08, phase: leaf, mode: "swing" });
      }
    } else if (text.includes("sword") || text.includes("blade") || text.includes("weapon") || text.includes("saber")) {
      radius = 0.78;
      height = 3.12;
      const guard = this.boxIn(group, 1.15, 0.16, 0.24, "#4b6584", 0, 0.86, 0, { metalness: 0.65 });
      this.cylinderIn(group, 0.07, 0.07, 0.67, 0, 0.44, 0, 8, "#2d3436", { metalness: 0.42 });
      const hilt = this.sphereIn(group, 0.1, "#f7b731", 0, 0.1, 0, 9, { metalness: 0.74, roughness: 0.2 });
      const blade = this.boxIn(group, 0.18, 2.1, 0.08, colorA, 0, 1.96, 0, { metalness: 0.82, roughness: 0.2, emissive: colorA, emissiveIntensity: 0.16 });
      this.animated.push({ object: blade, baseY: 1.96, speed: 0.56, phase: 0, mode: "pulse" });
      const edge = this.boxIn(group, 0.22, 2.15, 0.02, colorB, 0, 1.96, 0, { emissive: colorB, emissiveIntensity: 0.48, transparent: true, opacity: 0.78 });
      this.animated.push({ object: edge, baseY: 1.96, speed: 0.56, phase: 0, mode: "pulse" });
    } else if (text.includes("house") || text.includes("shelter") || text.includes("pod") || text.includes("home")) {
      radius = 1.95;
      height = 1.72;
      const shell = this.boxIn(group, 2.45, 1.34, 1.85, colorA, 0, 0.78, 0, { metalness: 0.42, roughness: 0.35 });
      const roof = new THREE.Mesh(this.geometry("dream-pod-roof", () => new THREE.ConeGeometry(1.6, 0.52, 4)), this.material(colorB, { roughness: 0.72 }));
      roof.position.set(0, 1.68, 0);
      roof.rotation.y = Math.PI / 4;
      group.add(roof);
      this.boxIn(group, 0.55, 0.84, 0.12, "#34495e", 0, 0.55, -0.95);
      const windowFrame = this.sphereIn(group, 0.42, colorB, 0, 1.05, 0.94, 12);
      windowFrame.scale.set(1, 1, 0.38);
      this.sphereIn(group, 0.34, "#a5e2f7", 0, 1.05, 1, 10, { emissive: "#54cbff", emissiveIntensity: 0.35, transparent: true, opacity: 0.65 });
    } else {
      // Abstract Artifact fallback
      radius = 1.15;
      height = 2.05;
      const stand = this.cylinderIn(group, 0.16, 0.34, 0.85, 0, 0.42, 0, 10, "#485460", { metalness: 0.62 });
      const orb = this.sphereIn(group, 0.55, colorA, 0, 1.35, 0, 14, { metalness: 0.43, roughness: 0.28, emissive: colorA, emissiveIntensity: 0.25 });
      this.animated.push({ object: orb, baseY: 1.35, speed: 0.8, phase: core.mesh.position.x, mode: "bob" });
      const signatureRing = this.torusIn(group, 0.94, 0.055, colorB, 0, 1.35, 0);
      signatureRing.rotation.x = Math.PI / 2.3;
      this.animated.push({ object: signatureRing, baseY: 1.35, speed: 0.38, phase: core.mesh.position.z, mode: "spin" });
    }

    // Hide creation and hitbox until construction completes
    group.visible = false;
    group.scale.setScalar(0.001);

    const creationHitbox = this.registerHitbox({
      owner: "prop",
      objectId: core.creationId,
      shape: "cylinder",
      center: core.mesh.position.clone().add(new THREE.Vector3(0, 0.04, -2.1)),
      radius,
      halfDepth: radius,
      minY: core.mesh.position.y,
      maxY: core.mesh.position.y + height + 0.1,
      solid: true,
      standable: true,
      disabled: true,
    });
    core.creationHitbox = creationHitbox;
  }

  private cylinderIn(parent: THREE.Group, top: number, bottom: number, length: number, x: number, y: number, z: number, segments = 12, color: number | string, settings: Partial<THREE.MeshStandardMaterialParameters> = {}) {
    const key = `cylinder:${top}:${bottom}:${length}:${segments}`;
    const mesh = new THREE.Mesh(this.geometry(key, () => new THREE.CylinderGeometry(top, bottom, length, segments)), this.material(color, settings));
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  submitDreamcorePrompt(id: string, prompt: string) {
    const core = this.placedDreamcores.find((item) => item.id === id);
    if (!core) return false;
    this.buildDreamcoreMesh(core, prompt);
    this.callbacks.onSound("pulse");
    return true;
  }

  openAbilityCoreInterface(id: string) {
    const core = this.placedDreamcores.find((item) => item.id === id);
    if (core && !core.building) this.callbacks.onOpenAbilityCore(id);
  }

  applyAbilityCore(id: string, ability: CreationAbility) {
    const core = this.placedDreamcores.find((item) => item.id === id);
    if (!core || !core.creationMesh || core.building) return false;
    core.ability = ability;
    if (core.coreMesh) {
      this.world.remove(core.coreMesh);
      core.coreMesh.traverse((object) => {
        const drawable = object as THREE.Object3D & { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] };
        drawable.geometry?.dispose();
        const materials = Array.isArray(drawable.material) ? drawable.material : drawable.material ? [drawable.material] : [];
        for (const material of materials) material.dispose();
      });
    }
    if (core.coreHitbox) this.removeHitbox(core.coreHitbox);

    const interactable = this.interactables.find((item) => item.id === `core-${id}`);
    if (interactable) this.interactables = this.interactables.filter((item) => item !== interactable);

    this.callbacks.onSound("unlock");
    this.spawnSparks(core.mesh.position.clone().add(new THREE.Vector3(0, 1.45, -2.1)), "#ffd38f", 18, 3);
    const abilityLabels: Record<CreationAbility, string> = {
      none: "Core deactivated.",
      pilot: "Creation now drivable! Press E near it to pilot; F to exit.",
      defend: "Automated Sentry activated — patrolling nearby airspace.",
      companion: "Chronal Follower online — following you closely.",
      gravity: "Chronal Disruptor active — slowing nearby walkers.",
    };
    this.callbacks.onWeapon(abilityLabels[ability]);
    return true;
  }

  private spawnAbilityCore(core: PlacedDreamcore) {
    const position = core.mesh.position.clone().add(new THREE.Vector3(0, 1.45, -2.1));
    const group = new THREE.Group();
    group.position.copy(position);
    this.world.add(group);
    core.coreMesh = group;

    const accentColor = "#ffd59a";
    const coreSphere = this.sphereIn(group, 0.16, "#ffeed2", 0, 0, 0, 10, { emissive: accentColor, emissiveIntensity: 1.1 });
    const signatureRing = this.torusIn(group, 0.32, 0.025, accentColor, 0, 0, 0);
    signatureRing.rotation.x = Math.PI / 2.3;

    this.animated.push({ object: signatureRing, baseY: 0, speed: 1.65, phase: position.x, mode: "spin" });
    this.animated.push({ object: group, baseY: 1.45, speed: 0.6, phase: position.z, mode: "bob" });

    const id = `core-${core.id}`;
    const hitbox = this.registerHitbox({
      owner: "interactable",
      objectId: id,
      shape: "cylinder",
      center: position.clone(),
      radius: 2.1,
      halfDepth: 2.1,
      minY: position.y - 1.1,
      maxY: position.y + 1.1,
      solid: false,
      dynamic: () => group.getWorldPosition(new THREE.Vector3()),
    });
    core.coreHitbox = hitbox;

    this.interactables.push({
      kind: "artifact",
      id: core.id,
      label: "Activate the Ability Core",
      position: position.clone(),
      range: 2.1,
    });
    this.callbacks.onSound("respawn");
  }

  private updateDreamcores(delta: number) {
    const nowSec = this.elapsed;
    const playerPos = this.playerPosition;
    for (const core of this.placedDreamcores) {
      if (core.building) {
        core.buildProgress = Math.min(1, core.buildProgress + delta * 0.34);
        const progress = core.buildProgress;
        if (core.creationMesh) {
          core.creationMesh.visible = true;
          core.creationMesh.scale.setScalar(THREE.MathUtils.lerp(0.001, 1, 1 - Math.pow(1 - progress, 3)));
          if (progress % 0.12 < 0.04) this.spawnSparks(core.mesh.position.clone().add(new THREE.Vector3(0, 0.72 * progress, -2.1)), "#8ff0da", 3, 1.25);
        }
        if (progress >= 1) {
          core.building = false;
          if (core.creationHitbox) core.creationHitbox.disabled = false;
          this.spawnAbilityCore(core);
        }
      }
      if (core.ability === "companion" && core.creationMesh) {
        const mesh = core.creationMesh;
        const targetPos = playerPos.clone().add(new THREE.Vector3(Math.cos(nowSec * 0.7) * 2.3, 1.12 + Math.sin(nowSec * 1.3) * 0.09, 2 + Math.sin(nowSec * 0.7) * 1.6));
        const worldPos = mesh.getWorldPosition(new THREE.Vector3());
        worldPos.lerp(targetPos, delta * 1.85);
        mesh.position.copy(core.mesh.worldToLocal(worldPos));
        mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, this.viewYaw + Math.PI, delta * 2.1);
        if (core.creationHitbox) {
          core.creationHitbox.center.copy(worldPos);
          core.creationHitbox.minY = worldPos.y - 0.55;
          core.creationHitbox.maxY = worldPos.y + 1.6;
        }
      }
      if (core.ability === "defend" && core.creationMesh) {
        const head = core.creationMesh.children.find((child) => child instanceof THREE.Group);
        if (head) {
          let foundEnemy = false;
          for (const npc of this.npcs) {
            if (npc.defeated || !npc.actor.visible) continue;
            const npcPos = npc.actor.getWorldPosition(new THREE.Vector3());
            const distance = core.mesh.position.distanceTo(npcPos);
            if (distance <= 18) {
              const localTarget = head.parent?.worldToLocal(npcPos.clone()) ?? npcPos;
              head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, Math.atan2(localTarget.x, localTarget.z), delta * 5.4);
              foundEnemy = true;
              const shootTimeKey = `lastDefend-${npc.id}`;
              const lastShoot = Number(core.mesh.userData[shootTimeKey] ?? 0);
              if (nowSec - lastShoot > 1.4) {
                core.mesh.userData[shootTimeKey] = nowSec;
                const muzzle = head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.05, -0.65).applyQuaternion(head.quaternion));
                const intent: ProjectileIntent = { toolId: "mech", hitPoint: npcPos.clone().add(new THREE.Vector3(0, npc.scale, 0)), direction: new THREE.Vector3(0, 0, -1).applyQuaternion(head.quaternion) };
                intent.npcId = npc.id;
                this.addProjectile(intent, "#ffd27a", muzzle, 0.62);
                this.callbacks.onSound("mechGun");
              }
              break;
            }
          }
          if (!foundEnemy) head.rotation.y += delta * 0.42;
        }
      }
      if (core.ability === "gravity") {
        const pylonPos = core.mesh.position.clone().add(new THREE.Vector3(0, 0.04, -2.1));
        const gravityRing = core.mesh.children.find((child) => child instanceof THREE.LineLoop);
        if (!gravityRing) {
          const torus = new THREE.Mesh(this.geometry("gravity-ring-mesh", () => new THREE.TorusGeometry(5.2, 0.035, 6, 40)), new THREE.MeshBasicMaterial({ color: "#e2b6ff", transparent: true, opacity: 0.28 }));
          torus.rotation.x = Math.PI / 2;
          torus.position.set(0, 0.12, -2.1);
          core.mesh.add(torus);
        }
        for (const npc of this.npcs) {
          if (npc.defeated || !npc.actor.visible) continue;
          const npcPos = npc.actor.getWorldPosition(new THREE.Vector3());
          const distance = pylonPos.distanceTo(npcPos);
          if (distance <= 5.8) {
            npc.actor.userData.reactionEnd = nowSec + 0.12;
            const direction = npcPos.clone().sub(pylonPos);
            direction.y = 0;
            if (direction.lengthSq() > 0.01) direction.normalize();
            npc.actor.position.addScaledVector(direction, -delta * 0.42);
            if (npc.walker) npc.walker.elapsed = Math.max(0, npc.walker.elapsed - delta * 0.035);
          }
        }
      }
    }
  }

  private updatePlayerPiloting(delta: number) {
    if (!this.piloting || !this.pilotedDreamcore || !this.pilotedDreamcore.creationMesh) return;
    const core = this.pilotedDreamcore;
    const mesh = core.creationMesh;
    const forward = Number(this.keys.has("w") || this.keys.has("arrowup")) - Number(this.keys.has("s") || this.keys.has("arrowdown"));
    const strafe = Number(this.keys.has("d") || this.keys.has("arrowright")) - Number(this.keys.has("a") || this.keys.has("arrowleft"));
    const sizeFactor = 1.35;
    const speed = (this.flying ? FLY_HORIZONTAL_SPEED : this.keys.has("shift") ? 9.5 : 6.1) * sizeFactor;
    const moveForward = forward / (Math.hypot(forward, strafe) || 1);
    const moveRight = strafe / (Math.hypot(forward, strafe) || 1);
    const dx = -Math.sin(this.viewYaw) * moveForward + Math.cos(this.viewYaw) * moveRight;
    const dz = -Math.cos(this.viewYaw) * moveForward - Math.sin(this.viewYaw) * moveRight;
    const next = this.playerPosition.clone();
    if (forward !== 0 || strafe !== 0) {
      next.x += dx * speed * delta;
      next.z += dz * speed * delta;
      this.clampWorldPosition(next);
      this.resolvePlayerCollision(next);
    }
    this.player.userData.moving = next.distanceToSquared(this.playerPosition) > 0.000001;
    this.playerPosition.copy(next);
    if (this.flying) this.updateFlight(delta);
    else this.updateGravity(delta);
    this.updateGroundEffects(delta);
    if (mesh) {
      mesh.position.copy(core.mesh.worldToLocal(this.playerPosition.clone().add(new THREE.Vector3(0, 0.04, 0))));
      mesh.rotation.y = this.viewYaw;
    }
    if (core.creationHitbox) {
      core.creationHitbox.center.copy(this.playerPosition).add(new THREE.Vector3(0, 0.04, 0));
      core.creationHitbox.minY = this.playerPosition.y;
      core.creationHitbox.maxY = this.playerPosition.y + 3.8;
    }
  }

  enterDreamcorePilot() {
    if (this.piloting) return false;
    for (const core of this.placedDreamcores) {
      if (core.ability !== "pilot" || !core.creationMesh || core.building) continue;
      const meshPos = core.creationMesh.getWorldPosition(new THREE.Vector3());
      const distance = Math.hypot(meshPos.x - this.playerPosition.x, meshPos.z - this.playerPosition.z);
      if (distance <= 2.8) {
        this.piloting = true;
        this.pilotedDreamcore = core;
        core.piloted = true;
        this.player.visible = false;
        if (core.creationHitbox) core.creationHitbox.disabled = true;
        this.playerPosition.copy(meshPos);
        this.verticalVelocity = 0;
        if (!this.flying) this.grounded = true;
        this.applyPlayerScale();
        this.updateViewModelVisibility();
        this.callbacks.onSound("mechEnter");
        return true;
      }
    }
    return false;
  }

  exitDreamcorePilot() {
    if (!this.piloting || !this.pilotedDreamcore || !this.pilotedDreamcore.creationMesh) return false;
    const core = this.pilotedDreamcore;
    const mesh = core.creationMesh;
    this.piloting = false;
    core.piloted = false;
    this.pilotedDreamcore = null;
    const ground = this.supportHeightAt(this.playerPosition, -2, this.playerPosition.y + 0.05) ?? this.visibleFloorHeight();
    const worldPos = this.playerPosition.clone();
    worldPos.y = ground;
    if (mesh) {
      mesh.position.copy(core.mesh.worldToLocal(worldPos.clone().add(new THREE.Vector3(0, 0.04, 0))));
      mesh.rotation.y = this.viewYaw;
    }
    this.player.visible = true;
    if (core.creationHitbox) {
      core.creationHitbox.disabled = false;
      core.creationHitbox.center.copy(worldPos);
      core.creationHitbox.minY = worldPos.y;
      core.creationHitbox.maxY = worldPos.y + 3.8;
    }
    const right = new THREE.Vector3(Math.cos(this.viewYaw), 0, -Math.sin(this.viewYaw));
    this.playerPosition.addScaledVector(right, 2.4);
    this.clampWorldPosition(this.playerPosition);
    this.applyPlayerScale();
    this.resolvePlayerCollision(this.playerPosition);
    this.player.position.copy(this.playerPosition);
    this.updateViewModelVisibility();
    this.callbacks.onSound("mechExit");
    return true;
  }

  private buildViewModel() {
    const tool = ALL_TOOLS.find((item) => item.id === this.activeTool) ?? ALL_TOOLS[0];
    const root = new THREE.Group();
    const grip = new THREE.Group();
    root.add(grip);
    root.visible = this.firstPersonActive;
    this.world.add(root);
    this.viewModel = root;
    this.viewModelGrip = grip;
    this.weaponRecoil = 0;
    const armor = new THREE.MeshStandardMaterial({ color: "#354751", metalness: 0.66, roughness: 0.28, depthTest: false, depthWrite: false });
    const trim = new THREE.MeshStandardMaterial({ color: "#d4b77d", metalness: 0.65, roughness: 0.27, depthTest: false, depthWrite: false });
    const sleeve = new THREE.MeshStandardMaterial({ color: "#54b7a6", metalness: 0.12, roughness: 0.68, depthTest: false, depthWrite: false });
    const skin = new THREE.MeshStandardMaterial({ color: "#c88a65", roughness: 0.73, depthTest: false, depthWrite: false });
    const glow = new THREE.MeshStandardMaterial({ color: tool.color, emissive: tool.color, emissiveIntensity: 0.68, metalness: 0.3, roughness: 0.2, depthTest: false, depthWrite: false });
    this.viewModelAccent = glow;
    const addBox = (w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.MeshStandardMaterial) => {
      const geometry = this.geometry(`view-box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.renderOrder = 90;
      grip.add(mesh);
      return mesh;
    };
    const addCylinder = (top: number, bottom: number, length: number, x: number, y: number, z: number, material: THREE.MeshStandardMaterial) => {
      const geometry = this.geometry(`view-cylinder:${top}:${bottom}:${length}`, () => new THREE.CylinderGeometry(top, bottom, length, 12));
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(x, y, z);
      mesh.renderOrder = 90;
      grip.add(mesh);
      return mesh;
    };
    addBox(0.52, 0.27, 0.93, 0, 0, -0.12, armor);
    addBox(0.42, 0.075, 0.68, 0, 0.19, -0.16, trim);
    addBox(0.32, 0.12, 0.38, 0, 0.14, -0.49, glow);
    addCylinder(0.11, 0.15, 0.68, 0, 0.005, -0.66, armor);
    addCylinder(0.18, 0.18, 0.12, 0, 0.005, -0.96, trim);
    addCylinder(0.105, 0.105, 0.13, 0, 0.005, -1.03, glow);
    addBox(0.23, 0.48, 0.2, 0, -0.32, 0.22, armor);
    addBox(0.47, 0.13, 0.32, 0, -0.37, 0.3, trim);
    addBox(0.46, 0.12, 0.33, 0, -0.18, 0.49, armor);
    for (const side of [-1, 1]) {
      addBox(0.08, 0.19, 0.7, side * 0.25, 0.13, -0.12, trim);
      addBox(0.1, 0.1, 0.22, side * 0.2, 0.02, -0.67, glow);
      addBox(0.13, 0.08, 0.26, side * 0.12, 0.22, 0.32, glow);
    }
    addBox(0.52, 0.32, 0.52, 0.06, -0.54, 0.45, sleeve);
    addBox(0.35, 0.21, 0.36, 0.02, -0.27, 0.33, skin);
    addBox(0.49, 0.21, 0.35, 0.06, -0.75, 0.59, sleeve);

    // Withrow laser sword: hilt, emitter, fist, and a flickering energy blade.
    const saber = new THREE.Group();
    root.add(saber);
    this.saberGrip = saber;
    const hiltMaterial = new THREE.MeshStandardMaterial({ color: "#2b3138", metalness: 0.82, roughness: 0.24, depthTest: false, depthWrite: false });
    const bladeCore = new THREE.MeshBasicMaterial({ color: "#fff0f3", depthTest: false, depthWrite: false });
    const bladeGlow = new THREE.MeshBasicMaterial({ color: "#ff2f55", transparent: true, opacity: 0.58, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false });
    const addSaberPart = (geometry: THREE.BufferGeometry, material: THREE.Material, y: number, order = 92) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = y;
      mesh.renderOrder = order;
      saber.add(mesh);
      return mesh;
    };
    addSaberPart(this.geometry("saber-hilt", () => new THREE.CylinderGeometry(0.036, 0.042, 0.32, 14)), hiltMaterial, 0.16);
    for (const y of [0.06, 0.12, 0.18, 0.24]) addSaberPart(this.geometry("saber-ring", () => new THREE.CylinderGeometry(0.045, 0.045, 0.016, 14)), trim, y);
    addSaberPart(this.geometry("saber-emitter", () => new THREE.CylinderGeometry(0.052, 0.04, 0.07, 14)), trim, 0.35);
    addSaberPart(this.geometry("saber-fist", () => new THREE.BoxGeometry(0.13, 0.15, 0.13)), skin, 0.12, 95);
    addSaberPart(this.geometry("saber-core", () => new THREE.CylinderGeometry(0.016, 0.022, 1.14, 10)), bladeCore, 0.95, 94);
    this.saberBlade = addSaberPart(this.geometry("saber-glow", () => new THREE.CylinderGeometry(0.05, 0.058, 1.2, 14)), bladeGlow, 0.95, 93);
    addSaberPart(this.geometry("saber-tip", () => new THREE.SphereGeometry(0.05, 10, 8)), bladeGlow, 1.55, 93);

    // Withrow mech cockpit: twin cannons, muzzle flashes, and a dashboard lip.
    const cockpit = new THREE.Group();
    cockpit.visible = false;
    this.world.add(cockpit);
    this.mechCockpit = cockpit;
    this.mechCannons = [];
    this.mechFlashes = [];
    this.mechRecoil = [0, 0];
    const hull = new THREE.MeshStandardMaterial({ color: "#3a4650", metalness: 0.7, roughness: 0.3, depthTest: false, depthWrite: false });
    const hullAccent = new THREE.MeshStandardMaterial({ color: "#ff6a4d", metalness: 0.5, roughness: 0.3, emissive: "#ff6a4d", emissiveIntensity: 0.25, depthTest: false, depthWrite: false });
    const barrelMaterial = new THREE.MeshStandardMaterial({ color: "#232a31", metalness: 0.85, roughness: 0.22, depthTest: false, depthWrite: false });
    const muzzleMaterial = new THREE.MeshBasicMaterial({ color: "#ffb36b", depthTest: false, depthWrite: false });
    const flashMaterial = new THREE.MeshBasicMaterial({ color: "#ffd59a", transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false });
    for (const side of [-1, 1]) {
      const cannon = new THREE.Group();
      cannon.position.set(side * 0.98, -0.6, -1.22);
      cockpit.add(cannon);
      this.mechCannons.push(cannon);
      const addCannonPart = (mesh: THREE.Mesh, x: number, y: number, z: number) => {
        mesh.position.set(x, y, z);
        mesh.renderOrder = 88;
        cannon.add(mesh);
        return mesh;
      };
      addCannonPart(new THREE.Mesh(this.geometry("cockpit-housing", () => new THREE.BoxGeometry(0.42, 0.34, 0.95)), hull), 0, 0, 0);
      addCannonPart(new THREE.Mesh(this.geometry("cockpit-plate", () => new THREE.BoxGeometry(0.46, 0.08, 0.7)), hullAccent), 0, 0.2, 0.05);
      for (const offset of [-0.09, 0.09]) {
        const barrel = addCannonPart(new THREE.Mesh(this.geometry("cockpit-barrel", () => new THREE.CylinderGeometry(0.06, 0.07, 0.9, 12)), barrelMaterial), offset, 0.02, -0.82);
        barrel.rotation.x = Math.PI / 2;
      }
      addCannonPart(new THREE.Mesh(this.geometry("cockpit-muzzle", () => new THREE.SphereGeometry(0.05, 10, 8)), muzzleMaterial), 0, 0.02, -1.28);
      const flash = addCannonPart(new THREE.Mesh(this.geometry("cockpit-flash", () => new THREE.SphereGeometry(0.2, 12, 10)), flashMaterial), 0, 0.02, -1.36);
      flash.scale.setScalar(0.001);
      this.mechFlashes.push(flash);
    }
    const dash = new THREE.Mesh(this.geometry("cockpit-dash", () => new THREE.BoxGeometry(2.6, 0.22, 0.5)), hull);
    dash.position.set(0, -1.02, -1.05);
    dash.renderOrder = 87;
    cockpit.add(dash);
    const strip = new THREE.Mesh(this.geometry("cockpit-strip", () => new THREE.BoxGeometry(2.2, 0.03, 0.04)), hullAccent);
    strip.position.set(0, -0.9, -0.84);
    strip.renderOrder = 88;
    cockpit.add(strip);
    this.updateViewModelVisibility();
  }

  private buildCharacter(skin: string, clothing: string, redHair: boolean) {
    const body = new THREE.Group();
    const root = new THREE.Group();
    body.add(root);
    const skinMat = this.material(skin, { roughness: 0.84 });
    const jeans = this.material("#455a6a", { roughness: 0.88 });
    const shirt = this.material(clothing, { roughness: 0.71 });
    const shoeMat = this.material("#e5c99c", { roughness: 0.82 });
    const neck = new THREE.Mesh(this.geometry("humanoid-neck", () => new THREE.CylinderGeometry(0.11, 0.145, 0.24, 10)), skinMat);
    neck.position.set(0, 1.66, 0);
    root.add(neck);
    this.boxIn(root, 0.9, 0.85, 0.49, clothing, 0, 1.11, 0, { roughness: 0.82 });
    this.boxIn(root, 0.85, 0.18, 0.51, "#2b4049", 0, 0.67, 0, { roughness: 0.8 });
    this.boxIn(root, 0.82, 0.045, 0.06, "#d8c28f", 0, 1.16, -0.275, { metalness: 0.18, roughness: 0.54 });
    this.boxIn(root, 0.07, 0.63, 0.055, "#d8c28f", 0, 1.03, -0.278, { metalness: 0.16, roughness: 0.58 });
    this.boxIn(root, 0.2, 0.15, 0.07, "#e8c982", 0, 0.68, -0.29, { metalness: 0.58, roughness: 0.28, emissive: "#7c5b2f", emissiveIntensity: 0.12 });
    this.boxIn(root, 0.72, 0.045, 0.045, "#f1e6c8", 0, 1.34, -0.255, { roughness: 0.58 });
    this.boxIn(root, 0.68, 0.12, 0.035, "#c9b98f", -0.28, 1.29, -0.255, { roughness: 0.7 });
    this.boxIn(root, 0.68, 0.12, 0.035, "#c9b98f", 0.28, 1.29, -0.255, { roughness: 0.7 });
    for (const side of [-1, 1]) this.sphereIn(root, 0.025, "#f4e3bd", side * 0.18, 1.43, -0.25, 7, { metalness: 0.2, roughness: 0.35 });
    const collarLeft = this.boxIn(root, 0.26, 0.18, 0.06, "#e3d7b7", -0.14, 1.49, -0.278, { roughness: 0.64 });
    collarLeft.rotation.z = -0.45;
    const collarRight = this.boxIn(root, 0.26, 0.18, 0.06, "#e3d7b7", 0.14, 1.49, -0.278, { roughness: 0.64 });
    collarRight.rotation.z = 0.45;
    const legGeoKey = "humanoid-leg";
    const legGeo = this.geometry(legGeoKey, () => new THREE.CapsuleGeometry(0.145, 0.46, 3, 7));
    const leftLeg = new THREE.Mesh(legGeo, jeans);
    leftLeg.position.set(-0.23, 0.38, 0.005);
    root.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeo, jeans);
    rightLeg.position.set(0.23, 0.38, 0.005);
    root.add(rightLeg);
    for (const side of [-1, 1]) {
      this.boxIn(root, 0.36, 0.16, 0.55, "#e5c99c", side * 0.23, 0.11, -0.07);
      this.boxIn(root, 0.4, 0.055, 0.58, "#384248", side * 0.23, 0.025, -0.07, { roughness: 0.84 });
      this.boxIn(root, 0.28, 0.14, 0.18, "#f0d7a6", side * 0.23, 0.12, -0.31, { roughness: 0.72 });
      this.boxIn(root, 0.2, 0.025, 0.06, "#695d4a", side * 0.23, 0.16, -0.37, { roughness: 0.7 });
      this.boxIn(root, 0.2, 0.025, 0.06, "#695d4a", side * 0.23, 0.22, -0.37, { roughness: 0.7 });
      this.boxIn(root, 0.2, 0.16, 0.1, "#52616d", side * 0.23, 0.39, 0.12, { metalness: 0.28, roughness: 0.48 });
      this.sphereIn(root, 0.1, "#6e7b82", side * 0.23, 0.4, 0.16, 8, { metalness: 0.42, roughness: 0.32 });
    }
    const armGeo = this.geometry("humanoid-arm", () => new THREE.CapsuleGeometry(0.13, 0.49, 3, 7));
    const armLeft = new THREE.Mesh(armGeo, shirt);
    armLeft.position.set(-0.56, 1.11, 0.01);
    armLeft.rotation.z = -0.12;
    root.add(armLeft);
    const armRight = new THREE.Mesh(armGeo, shirt);
    armRight.position.set(0.56, 1.11, 0.01);
    armRight.rotation.z = 0.12;
    root.add(armRight);
    for (const side of [-1, 1]) {
      this.boxIn(root, 0.29, 0.13, 0.34, "#34434b", side * 0.58, 0.86, 0, { metalness: 0.3, roughness: 0.48 });
      this.sphereIn(root, 0.115, "#7d888d", side * 0.58, 0.9, 0.02, 9, { metalness: 0.52, roughness: 0.28 });
      this.boxIn(root, 0.24, 0.12, 0.28, "#e5d5b3", side * 0.58, 1.34, 0.03, { metalness: 0.18, roughness: 0.58 });
    }
    this.boxIn(root, 0.19, 0.08, 0.08, "#8cf0da", 0.58, 0.86, -0.18, { emissive: "#5addc5", emissiveIntensity: 0.9, metalness: 0.22 });
    this.sphereIn(root, 0.15, skin, -0.58, 0.76, 0.01, 12, { roughness: 0.82 });
    this.sphereIn(root, 0.15, skin, 0.58, 0.76, 0.01, 12, { roughness: 0.82 });
    const head = this.sphereIn(root, 0.41, skin, 0, 1.9, -0.01, 18, { roughness: 0.82 });
    this.sphereIn(root, 0.12, skin, -0.405, 1.9, -0.01, 10, { roughness: 0.84 });
    this.sphereIn(root, 0.12, skin, 0.405, 1.9, -0.01, 10, { roughness: 0.84 });
    const facePlate = this.boxIn(root, 0.38, 0.35, 0.085, skin, 0, 1.88, -0.34, { roughness: 0.78 });
    facePlate.rotation.x = 0.02;
    this.sphereIn(root, 0.06, "#452c28", -0.15, 1.96, -0.402, 9, { roughness: 0.72 });
    this.sphereIn(root, 0.06, "#452c28", 0.15, 1.96, -0.402, 9, { roughness: 0.72 });
    this.sphereIn(root, 0.022, "#fff5d6", -0.165, 1.98, -0.45, 8);
    this.sphereIn(root, 0.022, "#fff5d6", 0.135, 1.98, -0.45, 8);
    const browLeft = this.boxIn(root, 0.17, 0.028, 0.035, redHair ? "#9b392d" : "#49372e", -0.15, 2.075, -0.421, { roughness: 0.9 });
    browLeft.rotation.z = -0.1;
    const browRight = this.boxIn(root, 0.17, 0.028, 0.035, redHair ? "#9b392d" : "#49372e", 0.15, 2.075, -0.421, { roughness: 0.9 });
    browRight.rotation.z = 0.1;
    this.sphereIn(root, 0.042, "#c17a59", 0, 1.82, -0.435, 8);
    this.boxIn(root, 0.18, 0.035, 0.06, "#8a493e", 0, 1.7, -0.419);
    const cap = this.sphereIn(root, 0.39, redHair ? "#c64d34" : "#564535", 0, 2.08, 0.03, 14, { roughness: 0.91 });
    cap.scale.set(1.06, 0.55, 0.98);
    const hairBack = this.sphereIn(root, 0.43, redHair ? "#a93e31" : "#493a31", 0, 1.94, 0.11, 13, { roughness: 0.92 });
    hairBack.scale.set(0.9, 0.82, 0.72);
    for (let i = -2; i <= 2; i += 1) {
      const bang = this.sphereIn(root, 0.18, redHair ? "#be4734" : "#55473b", i * 0.13, 2.03 - Math.abs(i) * 0.025, -0.26, 10, { roughness: 0.9 });
      bang.scale.set(0.93, 0.82, 0.71);
    }
    for (const side of [-1, 1]) {
      const sideLock = this.sphereIn(root, 0.16, redHair ? "#a93e31" : "#493a31", side * 0.35, 1.91, -0.06, 9, { roughness: 0.92 });
      sideLock.scale.set(0.52, 1.45, 0.72);
      const tuft = this.sphereIn(root, 0.18, redHair ? "#d05a38" : "#5b493a", side * 0.16, 2.34 + (side > 0 ? 0.03 : 0), 0.02, 9, { roughness: 0.9 });
      tuft.scale.set(0.58, 1.18, 0.55);
      tuft.rotation.z = side * 0.45;
      const strap = this.boxIn(root, 0.12, 0.72, 0.045, "#6d5137", side * 0.24, 1.2, -0.24, { roughness: 0.72 });
      strap.rotation.x = 0.08;
    }
    if (redHair) {
      this.boxIn(root, 0.26, 0.32, 0.18, "#d5a85f", -0.35, 0.7, -0.31, { metalness: 0.28, roughness: 0.5 });
      this.boxIn(root, 0.17, 0.48, 0.15, "#637a7d", 0.35, 0.72, -0.31, { metalness: 0.52, roughness: 0.3 });
      this.sphereIn(root, 0.055, "#9ff7df", 0.35, 0.84, -0.42, 8, { emissive: "#61e8cf", emissiveIntensity: 1.1 });
    }
    if (!redHair) {
      const pack = this.boxIn(root, 0.55, 0.66, 0.28, "#dc9a54", 0, 1.12, 0.37, { roughness: 0.75, metalness: 0.1 });
      pack.rotation.x = -0.07;
      this.boxIn(root, 0.32, 0.14, 0.08, "#f0d093", 0, 1.1, 0.54, { emissive: "#f0d093", emissiveIntensity: 0.1 });
      const tool = this.boxIn(root, 0.16, 0.2, 0.86, "#37d5cf", 0.4, 0.96, -0.38, { metalness: 0.55, emissive: "#2abdb4", emissiveIntensity: 0.45 });
      tool.rotation.x = -0.24;
    }
    body.userData.parts = {
      root,
      head,
      hair: cap,
      leftArm: armLeft,
      rightArm: armRight,
      leftLeg,
      rightLeg,
    } satisfies CharacterParts;
    return body;
  }

  private boxIn(parent: THREE.Group, width: number, height: number, depth: number, color: number | string, x: number, y: number, z: number, settings: Partial<THREE.MeshStandardMaterialParameters> = {}) {
    const key = `box:${width.toFixed(3)}:${height.toFixed(3)}:${depth.toFixed(3)}`;
    const mesh = new THREE.Mesh(this.geometry(key, () => new THREE.BoxGeometry(width, height, depth)), this.material(color, settings));
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  private sphereIn(parent: THREE.Group, radius: number, color: number | string, x: number, y: number, z: number, segments = 12, settings: Partial<THREE.MeshStandardMaterialParameters> = {}) {
    const key = `sphere:${radius}:${segments}`;
    const mesh = new THREE.Mesh(this.geometry(key, () => new THREE.SphereGeometry(radius, segments, Math.max(8, segments - 2))), this.material(color, settings));
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  private createMech(parent: THREE.Group, x: number, y: number, z: number, color: number | string, scale = 1) {
    const mech = new THREE.Group();
    mech.position.set(x, y, z);
    mech.scale.setScalar(scale);
    parent.add(mech);
    const dark = "#3b4650";
    const mid = "#596875";
    const light = "#c8ae86";
    this.boxIn(mech, 1.34, 1.5, 0.9, dark, 0, 1.82, 0, { roughness: 0.32, metalness: 0.67 });
    this.boxIn(mech, 1.02, 0.9, 0.18, dark, 0, 1.82, -0.46, { roughness: 0.38, metalness: 0.58 });
    this.boxIn(mech, 0.77, 0.56, 0.19, color, 0, 2.04, -0.51, { roughness: 0.21, metalness: 0.54, emissive: color, emissiveIntensity: 0.32 });
    for (let vent = -1; vent <= 1; vent += 1) this.boxIn(mech, 0.12, 0.62, 0.035, "#202a31", vent * 0.32, 1.78, 0.455, { metalness: 0.52, roughness: 0.28 });
    const pelvis = new THREE.Mesh(this.geometry("mech-pelvis", () => new THREE.CylinderGeometry(0.48, 0.62, 0.58, 12)), this.material(dark, { metalness: 0.68, roughness: 0.28 }));
    pelvis.position.set(0, 1.18, 0);
    mech.add(pelvis);
    const backpack = this.boxIn(mech, 0.82, 1.1, 0.34, mid, 0, 2.05, 0.48, { metalness: 0.55, roughness: 0.32 });
    backpack.rotation.x = -0.08;
    for (const side of [-1, 1]) {
      const thruster = new THREE.Mesh(this.geometry("mech-thruster", () => new THREE.CylinderGeometry(0.11, 0.18, 0.52, 9)), this.material("#6f7b80", { metalness: 0.72, roughness: 0.2 }));
      thruster.rotation.x = Math.PI / 2;
      thruster.position.set(side * 0.25, 2.42, 0.68);
      mech.add(thruster);
      const flame = this.sphereIn(mech, 0.11, "#8df7e8", side * 0.25, 2.42, 0.98, 8, { emissive: "#56e8d2", emissiveIntensity: 0.85 });
      this.animated.push({ object: flame, baseY: flame.position.y, speed: 1.7 + side * 0.1, phase: side, mode: "pulse" });
    }
    const head = new THREE.Group();
    head.position.set(0, 2.81, 0.02);
    mech.add(head);
    this.boxIn(head, 0.42, 0.38, 0.43, "#67727c", 0, 0, 0, { metalness: 0.74, roughness: 0.2 });
    this.boxIn(head, 0.88, 0.13, 0.15, color, 0, 0.18, -0.1, { metalness: 0.55, emissive: color, emissiveIntensity: 0.5 });
    this.sphereIn(head, 0.18, "#b8fff0", 0, 0.02, -0.23, 12, { emissive: "#64f2e3", emissiveIntensity: 1.3 });
    this.sphereIn(head, 0.055, "#c9fff2", -0.11, 0.02, -0.24, 8, { emissive: "#68ead8", emissiveIntensity: 1.4 });
    this.sphereIn(head, 0.055, "#c9fff2", 0.11, 0.02, -0.24, 8, { emissive: "#68ead8", emissiveIntensity: 1.4 });
    this.boxIn(head, 0.08, 0.72, 0.08, "#aeb6ad", 0.18, 0.53, 0.03, { metalness: 0.75, roughness: 0.18 });
    const antennaTip = this.sphereIn(head, 0.09, "#f1c982", 0.18, 0.91, 0.03, 8, { emissive: "#f0a94f", emissiveIntensity: 1.25 });
    const cockpit = new THREE.Mesh(this.geometry("mech-cockpit", () => new THREE.SphereGeometry(0.34, 14, 10)), this.material("#9ed8d8", { metalness: 0.18, roughness: 0.12, emissive: color, emissiveIntensity: 0.22, transparent: true, opacity: 0.72 }));
    cockpit.scale.set(0.72, 0.48, 0.62);
    cockpit.position.set(0, -0.08, -0.08);
    head.add(cockpit);
    for (const side of [-1, 1]) {
      const shoulder = this.sphereIn(mech, 0.3, color, side * 0.84, 2.3, 0, 12, { metalness: 0.57, roughness: 0.25 });
      shoulder.scale.y = 0.72;
      const shoulderPlate = this.boxIn(mech, 0.64, 0.26, 0.72, color, side * 0.88, 2.43, 0.02, { metalness: 0.62, roughness: 0.22, emissive: color, emissiveIntensity: 0.18 });
      shoulderPlate.rotation.z = side * -0.12;
      const arm = new THREE.Group();
      arm.position.set(side * 0.9, 1.67, 0.06);
      mech.add(arm);
      this.boxIn(arm, 0.37, 1.02, 0.46, mid, 0, 0, 0, { metalness: 0.61, roughness: 0.29 });
      this.sphereIn(arm, 0.22, "#9eb1b1", 0, -0.48, 0, 10, { metalness: 0.68, roughness: 0.2 });
      this.boxIn(arm, 0.46, 0.55, 0.5, color, 0, -1, -0.04, { metalness: 0.46, roughness: 0.3 });
      const forearm = new THREE.Group();
      forearm.position.set(0, -1.25, -0.04);
      arm.add(forearm);
      this.boxIn(forearm, 0.34, 0.72, 0.42, mid, 0, 0, 0, { metalness: 0.56, roughness: 0.3 });
      this.boxIn(forearm, 0.59, 0.22, 0.64, light, 0, -0.32, -0.13, { metalness: 0.4 });
      this.boxIn(forearm, 0.67, 0.12, 0.82, color, 0, -0.48, -0.3, { metalness: 0.52, roughness: 0.27 });
      const barrel = new THREE.Mesh(this.geometry("mech-barrel", () => new THREE.CylinderGeometry(0.08, 0.1, 0.82, 10)), this.material("#3a4650", { metalness: 0.72, roughness: 0.18 }));
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, -0.48, -0.72);
      forearm.add(barrel);
      const muzzle = this.sphereIn(forearm, 0.11, color, 0, -0.48, -1.12, 9, { emissive: color, emissiveIntensity: 1.15, metalness: 0.32 });
      this.sphereIn(forearm, 0.14, "#91faf1", side * 0.22, -0.16, -0.23, 9, { emissive: "#59e7df", emissiveIntensity: 0.9 });
      const hand = new THREE.Group();
      hand.position.set(0, -0.72, -0.08);
      forearm.add(hand);
      this.boxIn(hand, 0.42, 0.24, 0.44, "#87918e", 0, 0, 0, { metalness: 0.7, roughness: 0.22 });
      for (let finger = -1; finger <= 1; finger += 1) this.boxIn(hand, 0.08, 0.32, 0.09, "#87918e", (finger * 0.12) + (finger === 0 ? 0 : side * 0.04), -0.18, 0, { metalness: 0.7, roughness: 0.22 });
      const leg = new THREE.Group();
      leg.position.set(side * 0.38, 0.95, 0.01);
      mech.add(leg);
      this.boxIn(leg, 0.44, 0.94, 0.51, "#576474", 0, 0, 0, { metalness: 0.5 });
      this.sphereIn(leg, 0.21, "#9eb1b1", 0, -0.43, 0, 10, { metalness: 0.68, roughness: 0.2 });
      const shin = new THREE.Group();
      shin.position.set(0, -0.78, 0);
      leg.add(shin);
      this.boxIn(shin, 0.4, 0.72, 0.48, mid, 0, 0, 0, { metalness: 0.52, roughness: 0.3 });
      this.boxIn(shin, 0.59, 0.22, 0.64, light, 0, -0.38, -0.06, { metalness: 0.4 });
      this.boxIn(shin, 0.68, 0.16, 0.82, color, 0, -0.68, -0.18, { metalness: 0.46, roughness: 0.28 });
      this.boxIn(shin, 0.72, 0.18, 0.78, dark, 0, -0.86, -0.05, { metalness: 0.58, roughness: 0.34 });
    }
    const core = this.torusIn(mech, 0.42, 0.063, color, 0, 1.88, -0.56);
    core.rotation.x = Math.PI / 2;
    const id = this.objectId("mech");
    mech.userData.parts = {
      head,
      leftArm: mech.children.find((child) => child instanceof THREE.Group && Math.abs(child.position.x + 0.9) < 0.01) as THREE.Group,
      rightArm: mech.children.find((child) => child instanceof THREE.Group && Math.abs(child.position.x - 0.9) < 0.01) as THREE.Group,
      leftLeg: mech.children.find((child) => child instanceof THREE.Group && Math.abs(child.position.x + 0.38) < 0.01) as THREE.Group,
      rightLeg: mech.children.find((child) => child instanceof THREE.Group && Math.abs(child.position.x - 0.38) < 0.01) as THREE.Group,
      core,
      antennaTip,
    };
    const hitbox = this.registerObjectHitbox(mech, id, 1.25 * scale, 3.65 * scale, 1.82 * scale, "mech", true);
    mech.userData.mechId = id;
    mech.userData.hitbox = hitbox;
    this.mechs.push({ actor: mech, id, phase: (x * 0.13 + z * 0.17 + scale) % 6.28 });
    return mech;
  }

  private torusIn(parent: THREE.Group, radius: number, tube: number, color: number | string, x: number, y: number, z: number) {
    const key = `torus:${radius}:${tube}:48`;
    const mesh = new THREE.Mesh(this.geometry(key, () => new THREE.TorusGeometry(radius, tube, 8, 48)), this.material(color, { emissive: color, emissiveIntensity: 0.55, metalness: 0.5, roughness: 0.24 }));
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  private findNearest(): Interactable | null {
    let closest: Interactable | null = null;
    let distance = Number.POSITIVE_INFINITY;
    const chronoDown = this.npcs.some((npc) => npc.id === "chrono" && npc.defeated);
    for (const object of this.interactables) {
      if ((object.kind === "chrono" && chronoDown) || (object.kind === "mech" && this.piloting)) continue;
      const dx = object.position.x - this.playerPosition.x;
      const dz = object.position.z - this.playerPosition.z;
      const current = Math.hypot(dx, dz);
      if (current <= object.range && current < distance) {
        closest = object;
        distance = current;
      }
    }
    return closest;
  }

  interact() {
    return this.findNearest();
  }

  fire(toolId: string) {
    if (this.piloting) {
      this.fireMechGuns();
      return;
    }
    if (toolId === "saber") {
      this.swingSaber();
      return;
    }
    const tool = ALL_TOOLS.find((item) => item.id === toolId) ?? ALL_TOOLS[0];
    this.pointer.set(0, 0);
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.weaponRecoil = Math.min(1, this.weaponRecoil + 0.55);
    if ((tool.id === "shrink" || tool.id === "grow") && this.firstPersonActive && this.viewPitch <= SELF_SHRINK_PITCH) {
      this.changeSelfSize(tool.id === "shrink" ? -1 : 1);
      return;
    }
    const aimOrigin = this.raycaster.ray.origin.clone();
    const direction = this.raycaster.ray.direction.clone().normalize();
    const maxDistance = 34;
    const hit = this.raycastHitboxes(aimOrigin, direction, maxDistance, ["npc", "target", "mech", "artifact", "weapon", "prop"]);
    let hitPoint: THREE.Vector3;
    const intent: ProjectileIntent = { toolId, hitPoint: new THREE.Vector3(), direction };
    if (hit) {
      hitPoint = hit.point.clone();
      if (hit.hitbox.owner === "npc") intent.npcId = hit.hitbox.objectId;
      if (hit.hitbox.owner === "target") intent.targetId = hit.hitbox.objectId;
      if (hit.hitbox.owner === "mech") intent.mechId = hit.hitbox.objectId;
      if (hit.hitbox.owner === "artifact") intent.artifactId = hit.hitbox.objectId;
    } else if (direction.y < -0.0001) {
      const groundDistance = THREE.MathUtils.clamp(aimOrigin.y / -direction.y, 0.2, maxDistance);
      hitPoint = aimOrigin.clone().addScaledVector(direction, groundDistance);
    } else {
      hitPoint = aimOrigin.clone().addScaledVector(direction, maxDistance);
    }
    intent.hitPoint = hitPoint;
    const colors: Record<string, string> = { pulse: "#76fff1", grapple: "#c5a5ff", portal: "#f494d1", shrink: "#ffc277", grow: "#a6f08f" };
    this.addBeam(this.muzzlePosition(), hitPoint, colors[tool.id] ?? "#76fff1");
    this.callbacks.onSound(tool.id);
    this.addProjectile(intent, colors[tool.id] ?? "#76fff1");
  }

  private applyNpcGadget(npc: NpcTarget, toolId: string, hitPoint: THREE.Vector3) {
    if (npc.defeated) return;
    const colors: Record<string, string> = { pulse: "#76fff1", grapple: "#c5a5ff", portal: "#f494d1", shrink: "#ffc277", grow: "#a6f08f" };
    this.addBeam(this.muzzlePosition(), hitPoint, colors[toolId] ?? "#76fff1");
    npc.actor.userData.reactionEnd = this.elapsed + 1.65;

    if (toolId === "grapple") {
      const direction = this.playerPosition.clone().sub(npc.actor.position);
      direction.y = 0;
      if (direction.lengthSq() > 0.01) direction.normalize();
      const destination = npc.actor.position.clone().addScaledVector(direction, 2.5);
      this.moveNpc(npc, destination);
      this.callbacks.onWeapon(`${npc.name} glides closer on a soft gravity cushion.`);
    } else if (toolId === "portal") {
      const angle = this.elapsed * 0.7 + npc.id.length;
      const destination = npc.actor.position.clone().add(new THREE.Vector3(Math.cos(angle) * 5.2, 0, Math.sin(angle) * 5.2));
      this.moveNpc(npc, destination);

    } else if (toolId === "shrink" || toolId === "grow") {
      const ladder = [0.55, 1, 1.65];
      const ratio = npc.scale / npc.normalScale;
      let index = 0;
      for (let i = 1; i < ladder.length; i += 1) if (Math.abs(ladder[i] - ratio) < Math.abs(ladder[index] - ratio)) index = i;
      const nextIndex = THREE.MathUtils.clamp(index + (toolId === "grow" ? 1 : -1), 0, ladder.length - 1);
      if (nextIndex === index) {
        this.callbacks.onWeapon(toolId === "grow" ? `${npc.name} is already giant-size.` : `${npc.name} is already pocket-size.`);
      } else {
        npc.scale = npc.normalScale * ladder[nextIndex];
        if (npc.hitbox) {
          npc.hitbox.radius = 0.58 * npc.scale;
          npc.hitbox.halfDepth = npc.hitbox.radius;
          npc.hitbox.maxY = npc.hitbox.minY + 2.15 * npc.scale;
        }
        this.spawnSparks(npc.actor.position.clone().add(new THREE.Vector3(0, npc.scale, 0)), toolId === "grow" ? "#b5ff9e" : "#ffd08a", 12, 2.4);
      }
    } else {
      npc.actor.userData.reactionEnd = this.elapsed + 2.2;
    }
    this.callbacks.onSound("npc");
  }

  private moveNpc(npc: NpcTarget, destination: THREE.Vector3) {
    destination.y = 0;
    this.clampWorldPosition(destination);
    this.resolveCollision(destination, 0.5 * npc.scale, 2 * npc.scale);
    npc.actor.position.copy(destination);
    if (npc.walker) {
      npc.walker.from.copy(destination);
      npc.walker.to.copy(destination).add(new THREE.Vector3(2.4, 0, 1.7));
      npc.walker.elapsed = 0;
    }
    if (npc.id === "chrono") {
      const chronoMarker = this.interactables.find((item) => item.id === "chrono");
      chronoMarker?.position.copy(destination);
    }
  }

  private activateTarget(target: Target) {
    if (target.active) {
      return;
    }
    target.active = true;
    this.callbacks.onSound("beacon");
    this.targetCount = Math.min(3, this.targetCount + 1);
    const exhibit = this.interactables.find((item) => item.kind === "artifact");
    if (exhibit) exhibit.label = this.targetCount === 3 ? `Recover ${ROOMS[this.roomIndex].gadget}` : `Align all three beacons · ${this.targetCount}/3`;
    target.mesh.material = this.material("#acffe8", { metalness: 0.2, roughness: 0.14, emissive: "#6dffdf", emissiveIntensity: 1.9 });
    target.mesh.scale.multiplyScalar(1.14);
    this.torus(0.76, 0.055, "#8affdc", target.mesh.position.x, target.mesh.position.y, target.mesh.position.z, 32, { emissive: "#55ffd6", emissiveIntensity: 1.5 });
    this.callbacks.onTargets(this.targetCount);
    if (this.targetCount === 3) this.spawnSparks(new THREE.Vector3(0, 2.6, -7.4), "#9dffe0", 26, 3.4);
  }

  private addBeam(start: THREE.Vector3, end: THREE.Vector3, color: string) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.92, linewidth: 3, blending: THREE.AdditiveBlending });
    const line = new THREE.Line(geometry, material);
    this.world.add(line);
    this.beamLines.push({ line, life: 0.17 });
  }

  collectArtifact() {
    if (this.location !== "room" || this.targetCount < 3) {
      this.callbacks.onWeapon("First align all three room beacons with a gadget.");
      return false;
    }
    this.callbacks.onSound("collect");
    this.callbacks.onArtifact(this.roomIndex);
    this.callbacks.onToast(`${ROOMS[this.roomIndex].gadget} gadget recovered! Room ${this.roomIndex + 1} explored.`);
    return true;
  }

  resetRoomBeacons() {
    this.targetCount = 0;
    for (const target of this.targets) {
      target.active = false;
      target.mesh.material = this.material("#515b68", { metalness: 0.12, roughness: 0.22, emissive: "#29343c", emissiveIntensity: 0.34 });
      target.mesh.scale.setScalar(1);
    }
    this.callbacks.onTargets(0);
  }

  getOpeningGreeting() {
    return BASE_GREETING;
  }
}

export const WALSENBURG = {
  name: "Walsenburg",
  state: "Colorado",
  latitude: 37.6242,
  longitude: -104.7803,
  longitudeWest: -104.7803,
  latitudeNorth: 37.6242,
  mercatorMaxLatitude: MERCATOR_LIMIT,
  nearestElevator: TOWN_POSITION,
};
