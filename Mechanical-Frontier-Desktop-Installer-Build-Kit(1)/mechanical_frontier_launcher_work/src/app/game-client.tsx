"use client";

import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Boxes,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  CircleHelp,
  Clock3,
  Compass,
  Crosshair,
  Database,
  Download,
  FilePlus2,
  FolderOpen,
  Gamepad2,
  Gauge,
  Globe2,
  HardDrive,
  Keyboard,
  LoaderCircle,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  MousePointer2,
  Move,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  Upload,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import type { ChangeEvent, CSSProperties, FormEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import ChatPanel, { type ChatMessage } from "./chat-panel";
import { B10_PYLON, DISTRICTS, LASER_SWORD, ROOMS, SECRET_ITEMS, TOOLS, STORY_GREETING } from "./game-data";
import { FrontierEngine, type GameLocation, type Interactable, type SoundEffect, type SpawnNpcSpecies } from "./game-engine";
import UndergroundMap from "./underground-map";

type Stage = "title" | "loading" | "playing";
type Overlay = "none" | "pause" | "files" | "map" | "rooms" | "inventory" | "settings" | "help" | "dialogue" | "chat" | "dreamcore" | "abilityCore";
type Abilities = { flight: boolean; saber: boolean; mech: boolean; npcSpawner: boolean; pylon: boolean };

const NO_ABILITIES: Abilities = { flight: false, saber: false, mech: false, npcSpawner: false, pylon: false };

function abilitiesFromInventory(items: string[]): Abilities {
  return {
    flight: items.includes("Flight Module"),
    saber: items.includes("Withrow Laser Sword"),
    mech: items.includes("Withrow Mech"),
    npcSpawner: items.includes("NPC Synthesizer"),
    pylon: items.includes("B10 Chronal Pylon"),
  };
}
type ArchiveState = "connecting" | "online" | "offline";

type WorldFile = {
  id: string;
  title: string;
  playerName: string;
  region: string;
  roomIndex: number;
  playtimeSeconds: number;
  level: number;
  xp: number;
  inventory: string[];
  discoveredRooms: number[];
  collectedRooms: number[];
  updatedAt: string;
  createdAt?: string;
};

type PositionTick = {
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  scale: number;
  grounded: boolean;
  flying?: boolean;
  piloting?: boolean;
  colliderCount: number;
  nearest: Interactable | null;
  targetCount: number;
  location: GameLocation;
  roomIndex: number;
  fps: number;
};

type TileCenter = { x: number; y: number; zoom: number };

type Settings = { sound: boolean; reducedMotion: boolean; contrast: boolean; sensitivity: number; invertY: boolean };
type MapWorld = "surface" | "underground";
type MapLayer = "satellite" | "hybrid" | "streets";

const SAVE_KEY = "mechanical-frontier.world-files.v1";
const SETTINGS_KEY = "mechanical-frontier.settings.v1";
const STARTER_TOOLS = TOOLS.map((tool) => tool.name);
const DEFAULT_SETTINGS: Settings = { sound: true, reducedMotion: false, contrast: false, sensitivity: 0.0022, invertY: false };
const MAX_ARCHIVE = 30;
const MAP_TILE_SIZE = 256;
const MAP_TEMPLATE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile";
const MAP_STREETS_TEMPLATE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile";
const MAP_ROADS_TEMPLATE = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile";
const MAP_LABELS_TEMPLATE = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile";
const MAP_LAT = 37.6242;
const MAP_LON = -104.7803;

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().replaceAll("-", "");
  return `frontier_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function makeStarterWorld(): WorldFile {
  const stamp = new Date().toISOString();
  return {
    id: makeId(),
    title: "Walsenburg field notes",
    playerName: "Ranger",
    region: "Walsenburg, Colorado",
    roomIndex: 0,
    playtimeSeconds: 0,
    level: 1,
    xp: 0,
    inventory: [...STARTER_TOOLS],
    discoveredRooms: [0],
    collectedRooms: [],
    updatedAt: stamp,
    createdAt: stamp,
  };
}

function mergeFiles(previous: WorldFile[], incoming: WorldFile) {
  return [incoming, ...previous.filter((file) => file.id !== incoming.id)]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, MAX_ARCHIVE);
}

function prettyDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes} min`;
}

function relativeStamp(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "Just now";
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

function tilePosition(latitude: number, longitude: number, zoom: number): TileCenter {
  const boundedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const n = 2 ** zoom;
  const sine = Math.sin((boundedLatitude * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * n,
    y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * n,
    zoom,
  };
}

function locationFor(file: WorldFile): GameLocation {
  if (file.region === "Lizard Town") return "lizard";
  if (file.region.startsWith("Room ")) return "room";
  return "surface";
}

export default function GameClient() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<FrontierEngine | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const viewRef = useRef<Stage>("title");
  const overlayRef = useRef<Overlay>("none");
  const currentWorldRef = useRef<WorldFile | null>(null);
  const locationRef = useRef<GameLocation>("surface");
  const roomIndexRef = useRef(0);
  const inventoryRef = useRef<string[]>([...STARTER_TOOLS]);
  const discoveryRef = useRef<Set<number>>(new Set([0]));
  const collectedRef = useRef<Set<number>>(new Set());
  const xpRef = useRef(0);
  const levelRef = useRef(1);
  const playTimeRef = useRef(0);
  const storyFinishedRef = useRef(false);
  const saveCallbackRef = useRef<(silent?: boolean, title?: string) => Promise<void>>(async () => {});
  const mapDragRef = useRef<{ pointerId: number; x: number; y: number; center: TileCenter } | null>(null);
  const lookDragRef = useRef<{ pointerId: number; x: number; y: number; distance: number } | null>(null);
  const loadingTimerRef = useRef<number | null>(null);
  const toastSequenceRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [stage, setStage] = useState<Stage>("title");
  const [overlay, setOverlay] = useState<Overlay>("none");
  const [loadingPercent, setLoadingPercent] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("Preparing the expedition");
  const [worldFiles, setWorldFiles] = useState<WorldFile[]>([]);
  const [archiveState, setArchiveState] = useState<ArchiveState>("connecting");
  const [currentWorld, setCurrentWorld] = useState<WorldFile | null>(null);
  const [worldTitle, setWorldTitle] = useState("Walsenburg field notes");
  const [currentLocation, setCurrentLocation] = useState<GameLocation>("surface");
  const [currentRoom, setCurrentRoom] = useState(0);
  const [roomTargets, setRoomTargets] = useState(0);
  const [discoveredRooms, setDiscoveredRooms] = useState<number[]>([0]);
  const [collectedRooms, setCollectedRooms] = useState<number[]>([]);
  const [inventory, setInventory] = useState<string[]>([...STARTER_TOOLS]);
  const [selectedTool, setSelectedTool] = useState("pulse");
  const [selectedGadget, setSelectedGadget] = useState<string | null>(null);
  const [worldLevel, setWorldLevel] = useState(1);
  const [worldXp, setWorldXp] = useState(0);
  const [playTime, setPlayTime] = useState(0);
  const [hudTick, setHudTick] = useState<PositionTick>({ x: 0, y: 0, z: 0, heading: 320, pitch: -2, scale: 1, grounded: true, colliderCount: 0, nearest: null, targetCount: 0, location: "surface", roomIndex: 0, fps: 60 });
  const [toast, setToast] = useState("");
  const [mouseLocked, setMouseLocked] = useState(false);
  const [showHitboxes, setShowHitboxes] = useState(false);
  const [jumpPulse, setJumpPulse] = useState(0);
  const [activeDreamcoreId, setActiveDreamcoreId] = useState<string | null>(null);
  const [dreamcorePrompt, setDreamcorePrompt] = useState("");
  const playerScaleRef = useRef(1);
  const [dialogueLines, setDialogueLines] = useState<string[]>([]);
  const [dialogueStep, setDialogueStep] = useState(0);
  const [selectedDistrict, setSelectedDistrict] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<TileCenter>(() => tilePosition(MAP_LAT, MAP_LON, 12));
  const [mapWorld, setMapWorld] = useState<MapWorld>("surface");
  const [mapLayer, setMapLayer] = useState<MapLayer>("hybrid");
  const [fileImportError, setFileImportError] = useState("");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [webglError, setWebglError] = useState(false);
  const [abilities, setAbilityState] = useState<Abilities>(NO_ABILITIES);
  const abilitiesRef = useRef<Abilities>(NO_ABILITIES);
  const [hasLookedAround, setHasLookedAround] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [
    { id: 1, author: "system", text: "Field comms online. Press T to chat, Esc to close." },
    { id: 2, author: "chrono", text: "Hi Ranger! Chrono here. Holler if you need anything." },
  ]);
  const chatIdRef = useRef(3);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  viewRef.current = stage;
  overlayRef.current = overlay;
  currentWorldRef.current = currentWorld;
  locationRef.current = currentLocation;
  roomIndexRef.current = currentRoom;
  inventoryRef.current = inventory;
  discoveryRef.current = new Set(discoveredRooms);
  collectedRef.current = new Set(collectedRooms);
  xpRef.current = worldXp;
  levelRef.current = worldLevel;
  playTimeRef.current = playTime;

  const activeRoom = ROOMS[currentRoom] ?? ROOMS[0];
  const activeDistrict = DISTRICTS[selectedDistrict];
  const pocketSized = hudTick.scale < 0.8;
  const dockTools = [...TOOLS] as any[];
  if (abilities.saber) dockTools.push(LASER_SWORD);
  if (abilities.pylon) dockTools.push(B10_PYLON);
  const selfSizeReady = stage === "playing" && overlay === "none" && !hudTick.piloting && (selectedTool === "shrink" || selectedTool === "grow") && hudTick.pitch <= -71;
  const actionTarget = hudTick.nearest && !(hudTick.nearest.kind === "artifact" && (roomTargets < 3 || collectedRooms.includes(Number(hudTick.nearest.id)))) ? hudTick.nearest : null;
  const progressToNextLevel = worldXp % 500;
  const displayedProgress = Math.min(100, (progressToNextLevel / 500) * 100);

  const playSfx = useCallback((effect: SoundEffect) => {
    if (!settingsRef.current.sound || typeof window === "undefined") return;
    try {
      let context = audioContextRef.current;
      if (!context || context.state === "closed") {
        context = new AudioContext();
        audioContextRef.current = context;
      }
      if (context.state === "suspended") void context.resume();
      const tones: Record<SoundEffect, Array<[number, number, number, number, OscillatorType, number]>> = {
        pulse: [[510, 235, 0.14, 0, "triangle", 0.035]],
        grapple: [[145, 350, 0.25, 0, "sine", 0.04], [285, 180, 0.19, 0.04, "triangle", 0.018]],
        portal: [[210, 920, 0.34, 0, "sine", 0.035], [330, 1180, 0.27, 0.05, "triangle", 0.018]],
        shrink: [[760, 205, 0.23, 0, "square", 0.018], [980, 330, 0.19, 0.03, "sine", 0.018]],
        beacon: [[610, 810, 0.14, 0, "sine", 0.027], [810, 1080, 0.17, 0.08, "sine", 0.02]],
        collect: [[440, 660, 0.2, 0, "triangle", 0.032], [620, 880, 0.23, 0.11, "triangle", 0.029], [850, 1240, 0.31, 0.22, "sine", 0.024]],
        npc: [[310, 490, 0.11, 0.03, "triangle", 0.024], [480, 720, 0.12, 0.13, "triangle", 0.02]],
        elevator: [[78, 142, 0.85, 0, "sawtooth", 0.018], [220, 470, 0.56, 0.24, "sine", 0.022]],
        dialogue: [[510, 590, 0.055, 0, "triangle", 0.017]],
        save: [[390, 610, 0.15, 0, "sine", 0.026], [610, 760, 0.17, 0.1, "sine", 0.018]],
        ui: [[300, 390, 0.06, 0, "triangle", 0.014]],
        jump: [[210, 430, 0.16, 0, "triangle", 0.028], [450, 620, 0.12, 0.04, "sine", 0.016]],
        land: [[210, 105, 0.12, 0, "triangle", 0.029], [390, 260, 0.15, 0.05, "sine", 0.014]],
        selfShrink: [[880, 210, 0.44, 0, "sine", 0.034], [1320, 320, 0.38, 0.05, "triangle", 0.016], [660, 150, 0.32, 0.17, "sine", 0.014]],
        grow: [[170, 720, 0.44, 0, "sine", 0.034], [255, 1080, 0.38, 0.05, "triangle", 0.016], [340, 900, 0.3, 0.17, "sine", 0.014]],
        pylon: [[380, 1120, 0.48, 0, "sine", 0.032], [520, 980, 0.38, 0.08, "triangle", 0.02]],
        saber: [[190, 95, 0.24, 0, "sawtooth", 0.022], [880, 260, 0.2, 0, "sine", 0.018]],
        saberHit: [[1250, 180, 0.16, 0, "square", 0.02], [520, 90, 0.2, 0.02, "sawtooth", 0.016]],
        mechGun: [[170, 55, 0.12, 0, "square", 0.03], [900, 180, 0.08, 0, "triangle", 0.014]],
        mechEnter: [[90, 230, 0.5, 0, "sawtooth", 0.018], [300, 620, 0.4, 0.12, "sine", 0.02]],
        mechExit: [[230, 90, 0.45, 0, "sawtooth", 0.018], [520, 260, 0.35, 0.08, "sine", 0.016]],
        fly: [[300, 920, 0.36, 0, "sine", 0.028], [450, 1300, 0.3, 0.06, "triangle", 0.012]],
        unlock: [[523, 523, 0.14, 0, "triangle", 0.03], [659, 659, 0.14, 0.12, "triangle", 0.03], [784, 784, 0.16, 0.24, "triangle", 0.03], [1046, 1046, 0.36, 0.36, "sine", 0.032]],
        defeat: [[700, 80, 0.36, 0, "sawtooth", 0.022], [320, 60, 0.3, 0.04, "square", 0.014]],
        respawn: [[600, 1200, 0.4, 0, "sine", 0.016], [900, 1500, 0.3, 0.1, "triangle", 0.01]],
        chat: [[880, 990, 0.06, 0, "sine", 0.016]],
      };
      const now = context.currentTime;
      for (const [start, end, duration, delay, type, volume] of tones[effect]) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const begins = now + delay;
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(start, begins);
        oscillator.frequency.exponentialRampToValueAtTime(end, begins + duration);
        gain.gain.setValueAtTime(0.0001, begins);
        gain.gain.exponentialRampToValueAtTime(volume, begins + Math.min(0.025, duration * 0.2));
        gain.gain.exponentialRampToValueAtTime(0.0001, begins + duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(begins);
        oscillator.stop(begins + duration + 0.02);
      }
    } catch {
      // Audio is progressive enhancement; gameplay remains complete without it.
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let localFiles: WorldFile[] = [];
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) localFiles = parsed as WorldFile[];
      }
    } catch {
      localFiles = [];
    }
    if (mounted && localFiles.length > 0) setWorldFiles(localFiles);
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      const parsed: unknown = stored ? JSON.parse(stored) : null;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const value = parsed as Partial<Settings>;
        setSettings({
          sound: typeof value.sound === "boolean" ? value.sound : DEFAULT_SETTINGS.sound,
          reducedMotion: typeof value.reducedMotion === "boolean" ? value.reducedMotion : DEFAULT_SETTINGS.reducedMotion,
          contrast: typeof value.contrast === "boolean" ? value.contrast : DEFAULT_SETTINGS.contrast,
          sensitivity: typeof value.sensitivity === "number" && Number.isFinite(value.sensitivity) ? Math.max(0.0008, Math.min(0.006, value.sensitivity)) : DEFAULT_SETTINGS.sensitivity,
          invertY: typeof value.invertY === "boolean" ? value.invertY : DEFAULT_SETTINGS.invertY,
        });
      }
    } catch {
      // Invalid or blocked local storage should not prevent the game from loading.
    }

    const fetchArchive = async () => {
      try {
        const response = await fetch("/api/worlds", { cache: "no-store" });
        if (!response.ok) throw new Error("World archive unavailable");
        const body = (await response.json()) as { worlds?: WorldFile[] };
        if (!Array.isArray(body.worlds)) throw new Error("World archive response was invalid");
        if (!mounted) return;
        const remote = body.worlds.map((file) => ({ ...file, inventory: file.inventory ?? [], discoveredRooms: file.discoveredRooms ?? [], collectedRooms: file.collectedRooms ?? [] }));
        const merged = [...remote, ...localFiles.filter((local) => !remote.some((server) => server.id === local.id))]
          .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
          .slice(0, MAX_ARCHIVE);
        setWorldFiles(merged);
        setArchiveState("online");
        localStorage.setItem(SAVE_KEY, JSON.stringify(merged));
      } catch {
        if (mounted) setArchiveState("offline");
      }
    };
    void fetchArchive();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let engine: FrontierEngine;
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      engine = new FrontierEngine(canvas, {
        onTick: (next) => {
          playerScaleRef.current = next.scale;
          setHudTick(next);
        },
        onToast: (message) => showToast(message),
        onTargets: (count) => setRoomTargets(count),
        onWeapon: (message) => showToast(message),
        onArtifact: (index) => collectRoomArtifact(index),
        onSound: (effect) => playSfx(effect),
        onOpenDreamcore: (id) => {
          setActiveDreamcoreId(id);
          setDreamcorePrompt("");
          setOverlay("dreamcore");
        },
        onOpenAbilityCore: (id) => {
          setActiveDreamcoreId(id);
          setOverlay("abilityCore");
        },
        canMove: () => viewRef.current === "playing" && overlayRef.current === "none",
      });
      engineRef.current = engine;
      engine.setActiveTool(selectedTool);
    } catch {
      setWebglError(true);
    }
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
      if (audioContextRef.current && audioContextRef.current.state !== "closed") void audioContextRef.current.close();
      audioContextRef.current = null;
    };
    // The engine lives for the lifetime of the canvas; dynamic actions use refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setFirstPersonActive(stage === "playing");
    engineRef.current?.setInputEnabled(stage === "playing" && overlay === "none");
    if ((stage !== "playing" || overlay !== "none") && document.pointerLockElement === canvasRef.current) document.exitPointerLock();
  }, [stage, overlay]);

  useEffect(() => {
    engineRef.current?.setLookSettings(settings.sensitivity, settings.invertY);
  }, [settings.sensitivity, settings.invertY]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const onLockChange = () => {
      const locked = document.pointerLockElement === canvas;
      setMouseLocked(locked);
      if (locked) setHasLookedAround(true);
      else engineRef.current?.setTriggerHeld(false);
    };
    const onLook = (event: MouseEvent) => {
      if (document.pointerLockElement === canvas && viewRef.current === "playing" && overlayRef.current === "none") {
        engineRef.current?.look(event.movementX, event.movementY);
      }
    };
    document.addEventListener("pointerlockchange", onLockChange);
    document.addEventListener("mousemove", onLook);
    return () => {
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      document.removeEventListener("pointerlockchange", onLockChange);
      document.removeEventListener("mousemove", onLook);
    };
  }, []);

  useEffect(() => {
    if (overlay === "map") setMapWorld(currentLocation === "surface" ? "surface" : "underground");
  }, [overlay, currentLocation]);

  useEffect(() => {
    engineRef.current?.setActiveTool(selectedTool);
  }, [selectedTool]);

  useEffect(() => {
    if (stage !== "playing") return;
    const ticker = window.setInterval(() => {
      setPlayTime((seconds) => {
        const next = seconds + 1;
        playTimeRef.current = next;
        return next;
      });
    }, 1000);
    return () => window.clearInterval(ticker);
  }, [stage]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (viewRef.current === "playing" && currentWorldRef.current) void saveCallbackRef.current(true);
    }, 75_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (loadingTimerRef.current !== null) window.clearInterval(loadingTimerRef.current);
    };
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    const toastSequence = ++toastSequenceRef.current;
    window.setTimeout(() => {
      if (toastSequenceRef.current === toastSequence) setToast("");
    }, 3200);
  }, []);

  const updateArchive = useCallback((files: WorldFile[]) => {
    const trimmed = files.slice(0, MAX_ARCHIVE);
    setWorldFiles(trimmed);
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(trimmed));
    } catch {
      // Browsers with private or quota-limited storage can still use the world archive.
    }
  }, []);

  const saveWorldNow = useCallback(async (silent = false, requestedTitle?: string) => {
    const active = currentWorldRef.current;
    if (!active) {
      if (!silent) showToast("Start an expedition before saving a world file.");
      return;
    }
    const roomNumber = roomIndexRef.current;
    const place = locationRef.current === "surface"
      ? "Walsenburg, Colorado"
      : locationRef.current === "lizard"
        ? "Lizard Town"
        : `Room ${String(roomNumber + 1).padStart(2, "0")} · ${ROOMS[roomNumber]?.title ?? "Workshop"}`;
    const savedAt = new Date().toISOString();
    const next: WorldFile = {
      ...active,
      title: requestedTitle?.trim().slice(0, 60) || worldTitle.trim().slice(0, 60) || active.title,
      region: place,
      roomIndex: roomNumber,
      playtimeSeconds: playTimeRef.current,
      level: levelRef.current,
      xp: xpRef.current,
      inventory: [...inventoryRef.current],
      discoveredRooms: [...discoveryRef.current].sort((a, b) => a - b),
      collectedRooms: [...collectedRef.current].sort((a, b) => a - b),
      updatedAt: savedAt,
    };
    currentWorldRef.current = next;
    setCurrentWorld(next);
    setWorldTitle(next.title);
    updateArchive(mergeFiles(worldFiles, next));
    if (!silent) playSfx("save");
    setArchiveState("connecting");
    try {
      const response = await fetch("/api/worlds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!response.ok) throw new Error("Save did not reach the archive");
      setArchiveState("online");
      if (!silent) showToast("World file saved · archive synced.");
    } catch {
      setArchiveState("offline");
      if (!silent) showToast("Saved on this device. The world archive is offline.");
    }
  }, [playSfx, showToast, updateArchive, worldTitle, worldFiles]);
  saveCallbackRef.current = saveWorldNow;

  const startLoading = useCallback((message: string, complete: () => void) => {
    if (loadingTimerRef.current !== null) window.clearInterval(loadingTimerRef.current);
    setLoadingMessage(message);
    setLoadingPercent(0);
    setOverlay("none");
    setStage("loading");
    let progress = 0;
    loadingTimerRef.current = window.setInterval(() => {
      progress = Math.min(100, progress + 2 + Math.random() * 5.5);
      setLoadingPercent(Math.floor(progress));
      if (progress >= 100) {
        if (loadingTimerRef.current !== null) window.clearInterval(loadingTimerRef.current);
        loadingTimerRef.current = null;
        complete();
        setStage("playing");
      }
    }, 34);
  }, []);

  const beginNewWorld = useCallback(() => {
    const fresh = makeStarterWorld();
    currentWorldRef.current = fresh;
    inventoryRef.current = [...STARTER_TOOLS];
    discoveryRef.current = new Set([0]);
    collectedRef.current = new Set();
    playTimeRef.current = 0;
    xpRef.current = 0;
    levelRef.current = 1;
    locationRef.current = "surface";
    roomIndexRef.current = 0;
    storyFinishedRef.current = false;
    setCurrentWorld(fresh);
    setWorldTitle(fresh.title);
    setCurrentLocation("surface");
    setCurrentRoom(0);
    setInventory([...STARTER_TOOLS]);
    setSelectedGadget(null);
    setSelectedTool("pulse");
    setDiscoveredRooms([0]);
    setCollectedRooms([]);
    setPlayTime(0);
    setWorldXp(0);
    setWorldLevel(1);
    setRoomTargets(0);
    setOverlay("none");
    setWorldFiles((files) => mergeFiles(files, fresh));
    abilitiesRef.current = NO_ABILITIES;
    setAbilityState(NO_ABILITIES);
    engineRef.current?.setAbilities({ flight: false, mech: false, npcSpawner: false });
    engineRef.current?.loadCheckpoint("surface", 0);
    startLoading("Opening the Walsenburg field log", () => {
      engineRef.current?.loadCheckpoint("surface", 0);
      setHudTick({ x: 1.5, y: 0, z: 0.5, heading: 320, pitch: -2, scale: 1, grounded: true, colliderCount: 0, nearest: null, targetCount: 0, location: "surface", roomIndex: 0, fps: 60 });
      window.setTimeout(() => void saveCallbackRef.current(true), 300);
    });
  }, [startLoading]);

  const openWorld = useCallback((file: WorldFile) => {
    currentWorldRef.current = file;
    locationRef.current = locationFor(file);
    roomIndexRef.current = Math.max(0, Math.min(99, file.roomIndex ?? 0));
    inventoryRef.current = Array.isArray(file.inventory) ? file.inventory : [...STARTER_TOOLS];
    discoveryRef.current = new Set(file.discoveredRooms?.length ? file.discoveredRooms : [0]);
    collectedRef.current = new Set(file.collectedRooms ?? []);
    xpRef.current = file.xp ?? 0;
    levelRef.current = file.level ?? 1;
    playTimeRef.current = file.playtimeSeconds ?? 0;
    const nextLocation = locationFor(file);
    currentWorldRef.current = { ...file, inventory: inventoryRef.current, discoveredRooms: [...discoveryRef.current], collectedRooms: [...collectedRef.current] };
    setCurrentWorld(currentWorldRef.current);
    setWorldTitle(file.title || "Walsenburg field notes");
    setCurrentLocation(nextLocation);
    setCurrentRoom(roomIndexRef.current);
    setInventory([...inventoryRef.current]);
    setSelectedGadget(null);
    setSelectedTool("pulse");
    setDiscoveredRooms([...discoveryRef.current]);
    setCollectedRooms([...collectedRef.current]);
    setWorldXp(xpRef.current);
    setWorldLevel(levelRef.current);
    setPlayTime(playTimeRef.current);
    setRoomTargets(0);
    setFileImportError("");
    setOverlay("none");
    const unlocked = abilitiesFromInventory(inventoryRef.current);
    abilitiesRef.current = unlocked;
    setAbilityState(unlocked);
    startLoading("Restoring a saved frontier", () => {
      engineRef.current?.setAbilities({ flight: unlocked.flight, mech: unlocked.mech, npcSpawner: unlocked.npcSpawner });
      engineRef.current?.loadCheckpoint(nextLocation, roomIndexRef.current);
      const nextTick: PositionTick = { x: 0, y: 0, z: 0, heading: nextLocation === "surface" ? 320 : 0, pitch: -2, scale: 1, grounded: true, colliderCount: 0, nearest: null, targetCount: 0, location: nextLocation, roomIndex: roomIndexRef.current, fps: 60 };
      setHudTick(nextTick);
    });
  }, [startLoading]);

  const changeLocation = useCallback((location: GameLocation, roomIndex?: number) => {
    const nextRoom = Math.max(0, Math.min(99, roomIndex ?? roomIndexRef.current));
    engineRef.current?.goTo(location, nextRoom);
    locationRef.current = location;
    roomIndexRef.current = nextRoom;
    setCurrentLocation(location);
    setCurrentRoom(nextRoom);
    setRoomTargets(0);
    if (location === "room") {
      discoveryRef.current.add(nextRoom);
      setDiscoveredRooms([...discoveryRef.current].sort((a, b) => a - b));
    }
  }, []);

  const enterRoom = useCallback((index: number) => {
    const nextIndex = Math.max(0, Math.min(99, index));
    setSelectedDistrict(ROOMS[nextIndex].districtIndex);
    changeLocation("room", nextIndex);
    setSearchTerm("");
    setOverlay("none");
  }, [changeLocation]);

  function beginDialogue(lines: string[]) {
    setDialogueLines(lines);
    setDialogueStep(0);
    setOverlay("dialogue");
  }

  function advanceDialogue() {
    playSfx("dialogue");
    if (dialogueStep >= dialogueLines.length - 1) {
      setOverlay("none");
      storyFinishedRef.current = true;
      return;
    }
    setDialogueStep((step) => step + 1);
  }

  function handleInteraction() {
    const engine = engineRef.current;
    const nearest = engine?.interact();
    if (!nearest) {
      if (engine?.isPiloting()) engine.exitMech();
      return;
    }
    if (nearest.kind === "mech") {
      engine?.enterMech();
    } else if (nearest.kind === "elevator") {
      playSfx("elevator");
      changeLocation("lizard");
      if (!storyFinishedRef.current) beginDialogue([...STORY_GREETING]);
    } else if (nearest.kind === "chrono") {
      playSfx("dialogue");
      const pocketSized = playerScaleRef.current < 0.8;
      const giantSized = playerScaleRef.current > 1.5;
      const sizeLine = pocketSized
        ? "Whoa—you're pocket-size! Did you aim the shrink ray at your own shoes? That's exactly what I would do."
        : giantSized
          ? "WHOA. You're HUGE! Please don't step on Lizard Town—we just repaved it."
          : "";
      const sizeFollowUp = pocketSized
        ? "Everything looks enormous from down there, huh? Aim the grow ray straight down when you want to be tall enough for doorknobs."
        : "Aim the shrink ray straight down to come back to normal size. Gently!";
      beginDialogue(storyFinishedRef.current
        ? sizeLine
          ? [sizeLine, sizeFollowUp]
          : ["Hey, Ranger! New door, new mystery. Those beacons look like they need a friendly pulse. I'm right here if you need me.", "I wrote every room in this field guide myself. The one-hundredth room has my favorite view."]
        : sizeLine ? [sizeLine, ...STORY_GREETING] : [...STORY_GREETING]);
    } else if (nearest.kind === "district") {
      const districtIndex = Number(nearest.id);
      playSfx("portal");
      if (Number.isFinite(districtIndex)) enterRoom(Math.max(0, Math.min(9, districtIndex)) * 10);
    } else if (nearest.kind === "exit") {
      if (locationRef.current === "room") {
        playSfx("portal");
        changeLocation("lizard");
      } else {
        playSfx("elevator");
        changeLocation("surface");
      }
    } else if (nearest.kind === "artifact") {
      const idStr = nearest.id;
      if (idStr && idStr.startsWith("obj-")) {
        // Intercepting Ability Core activations to open the selection overlay
        engineRef.current?.openAbilityCoreInterface(idStr);
      } else {
        const index = Number(idStr);
        if (collectedRef.current.has(index)) showToast("Gadget already recovered.");
        else engine?.collectArtifact();
      }
    }
  }

  function collectRoomArtifact(index: number) {
    if (collectedRef.current.has(index)) {
      showToast(`${ROOMS[index]?.gadget ?? "Room gadget"} is already in your field bag.`);
      return;
    }
    collectedRef.current.add(index);
    discoveryRef.current.add(index);
    const reward = ROOMS[index].gadget;
    inventoryRef.current = [...inventoryRef.current.filter((item) => item !== reward), reward];
    const nextXp = xpRef.current + 120;
    const nextLevel = Math.min(99, Math.floor(nextXp / 500) + 1);
    xpRef.current = nextXp;
    levelRef.current = nextLevel;
    setCollectedRooms([...collectedRef.current].sort((a, b) => a - b));
    setDiscoveredRooms([...discoveryRef.current].sort((a, b) => a - b));
    setInventory([...inventoryRef.current]);
    setWorldXp(nextXp);
    setWorldLevel(nextLevel);
  }

  function chooseTool(id: string) {
    setSelectedTool(id);
    setSelectedGadget(null);
    engineRef.current?.setActiveTool(id);
    playSfx("ui");
  }

  function pushChat(author: ChatMessage["author"], text: string, tone?: ChatMessage["tone"]) {
    const id = chatIdRef.current;
    chatIdRef.current += 1;
    setChatMessages((list) => [...list, { id, author, text, tone }].slice(-60));
  }

  function chronoReply(text: string) {
    const message = text.toLowerCase();
    const location = locationRef.current;
    const room = ROOMS[roomIndexRef.current] ?? ROOMS[0];
    if (/\b(hi|hello|hey|yo|sup|howdy)\b/.test(message)) return "Hey Ranger! Chrono here — comms are crystal clear.";
    if (/\b(help|commands?)\b/.test(message)) return "Ask me where you are, what's next, or how a gadget works. Some words are… extra special. I'm not allowed to say which.";
    if (/\bwhere\b/.test(message)) {
      if (location === "surface") return "You're up in Walsenburg. The glass tower's Skyline Lift is the way down to Lizard Town.";
      if (location === "lizard") return "You're in Lizard Town! Each of the ten glowing gates leads to a district.";
      return `You're in Room ${room.number}, ${room.title}.`;
    }
    if (/\b(next|objective|goal|now what|todo)\b/.test(message)) {
      if (location === "room") return "Light up the three floating beacons with any gadget, then press E at the glowing exhibit.";
      if (location === "lizard") return "Walk up to any district gate and press E. Every room hides a unique gadget!";
      return "Find the gold elevator doors at the base of the glass tower and press E.";
    }
    if (/\b(fly|flying|flight)\b/.test(message)) return "Flying needs special clearance. Maybe there's a secret password…";
    if (/\b(mech|robot|sword|saber|laser)\b/.test(message)) return "Mechs and laser swords are restricted gear. Only folks with the password get those!";
    if (/\b(grow|giant|big)\b/.test(message)) return "The Grow Ray is slot 5! Aim it straight down to make yourself giant.";
    if (/\b(shrink|small|tiny)\b/.test(message)) return "The Shrink Ray is slot 4. Aim it straight down and you'll be pocket-size!";
    if (/\b(jump|space)\b/.test(message)) return "Space jumps! You can land on benches, crates, and platforms.";
    if (/\b(thanks|thank you|thx|ty)\b/.test(message)) return "Anytime, Ranger!";
    const replies = ["Copy that, Ranger!", "Ha! Noted in the field log.", "Roger. Chrono out— wait, no, I'm still here.", "That's the coolest thing anyone's said on this channel today.", "Mm-hmm! Totally. Definitely."];
    return replies[Math.floor(Math.random() * replies.length)];
  }

  function activateWithrow() {
    const current = abilitiesRef.current;
    const alreadyActive = current.flight && current.saber && current.mech && current.npcSpawner;
    const next: Abilities = { flight: true, saber: true, mech: true, npcSpawner: true, pylon: true };
    abilitiesRef.current = next;
    setAbilityState(next);
    const summoned = engineRef.current?.unlockWithrow() ?? false;
    const allRooms = ROOMS.map((room) => room.index);
    collectedRef.current = new Set(allRooms);
    setCollectedRooms(allRooms);
    inventoryRef.current = Array.from(new Set([...inventoryRef.current, ...SECRET_ITEMS, ...ROOMS.map((room) => room.gadget)]));
    setInventory([...inventoryRef.current]);
    playSfx("unlock");
    if (alreadyActive) {
      pushChat("system", summoned ? "Withrow protocol already active — your mech has been re-summoned beside you." : "Withrow protocol already active.", "unlock");
    } else {
      pushChat("system", "✦ WITHROW PROTOCOL ACCEPTED ✦", "unlock");
      pushChat("system", "Flight unlocked — double-tap Space to fly. Hold Space to rise; Shift or C to descend.", "unlock");
      pushChat("system", "All 100 room gadgets added to your field bag (I).", "unlock");
      pushChat("system", "Withrow Mech deployed beside you — walk up and press E to pilot. Left click fires its cannons; F exits.", "unlock");
      pushChat("system", "Withrow Laser Sword ready — press 6 to equip. It defeats NPCs, who respawn after a few seconds.", "unlock");
      pushChat("system", "NPC Synthesizer ready! Use the chat buttons to summon Humans, Robots, and Aliens.", "unlock");
      window.setTimeout(() => pushChat("chrono", "Wait, how do you know the password?! …Okay, okay. Just don't tell my mom about the sword. You found the NPC Synthesizer too?"), 900);
    }
    void saveCallbackRef.current(true);
  }

  function activateB10() {
    const current = abilitiesRef.current;
    const alreadyActive = current.pylon;
    const next: Abilities = { ...current, pylon: true };
    abilitiesRef.current = next;
    setAbilityState(next);
    inventoryRef.current = Array.from(new Set([...inventoryRef.current, "B10 Chronal Pylon"]));
    setInventory([...inventoryRef.current]);
    playSfx("unlock");
    if (alreadyActive) {
      pushChat("system", "B10 Chronal Pylon already active in your field bag.");
    } else {
      pushChat("system", "✦ B10 SECURITY ACCESS GRANTED ✦", "unlock");
      pushChat("system", "The Dreamcore added to your tools — press 7 to select.", "unlock");
      pushChat("system", "Equip, then RIGHT-CLICK on the ground to place it. It opens an AI menu where you can type anything to build it!", "unlock");
      window.setTimeout(() => pushChat("chrono", "Whoa, you found The Dreamcore! It's a sphere with a blue middle and rotating particles. Right-click to place it on the floor, type in any object you want, and watch it build!"), 900);
    }
    void saveCallbackRef.current(true);
  }

  function handleChatSend(text: string) {
    pushChat("you", text);
    playSfx("chat");
    if (/\bwithrow\b/i.test(text)) {
      activateWithrow();
      return;
    }
    if (/\bb10\b/i.test(text)) {
      activateB10();
      return;
    }
    const spawnMatch = text.match(/\b(?:spawn|summon)\s+(?:a\s+)?(human|robot|alien)(?:\s+npcs?)?\b/i);
    if (spawnMatch) {
      spawnNpcFromChat(spawnMatch[1].toLowerCase() as SpawnNpcSpecies);
      return;
    }
    const reply = chronoReply(text);
    window.setTimeout(() => pushChat("chrono", reply), 380);
  }

  function spawnNpcFromChat(species: SpawnNpcSpecies) {
    if (!abilitiesRef.current.npcSpawner) {
      pushChat("system", "NPC Synthesizer locked — enter the Withrow code first.");
      return;
    }
    const name = engineRef.current?.spawnFriendlyNpc(species);
    if (!name) {
      pushChat("system", "NPC Synthesizer roster full — up to 14 summoned NPCs can be active in one world.");
      return;
    }
    playSfx("npc");
    const note = `${name} materialized nearby. They're friendly, gadget-reactive, and they respawn if defeated.`;
    pushChat("system", note, "unlock");
  }

  function equipRoomGadget(index: number) {
    const room = ROOMS[index];
    if (!room || !collectedRef.current.has(index)) return;
    setSelectedTool(room.gadgetType);
    setSelectedGadget(room.gadget);
    engineRef.current?.setActiveTool(room.gadgetType);
    playSfx("ui");
    showToast(`${room.gadget} equipped · ${room.gadgetDetail}`);
    setOverlay("none");
  }

  function handleKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    const isTextEntry = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT";
    if (event.key === "Escape") {
      if (overlayRef.current === "none" && document.pointerLockElement === canvasRef.current) {
        document.exitPointerLock();
        event.preventDefault();
        return;
      }
      if (overlayRef.current !== "none") {
        setOverlay("none");
        event.preventDefault();
        return;
      }
      if (viewRef.current === "playing") {
        setOverlay("pause");
        event.preventDefault();
      }
      return;
    }
    if (isTextEntry || viewRef.current !== "playing" || overlayRef.current !== "none") return;
    const key = event.key.toLowerCase();
    if (event.code === "Space" || event.key === " " || key === "spacebar") {
      event.preventDefault();
      releaseUiFocus();
      keysRef.current.add("space");
      engineRef.current?.setKeys(keysRef.current);
      if (!event.repeat) triggerJump();
      return;
    }
    if (key === "t") {
      event.preventDefault();
      if (!event.repeat) setOverlay("chat");
      return;
    }
    if (key === "f") {
      event.preventDefault();
      if (!event.repeat) engineRef.current?.toggleMech();
      return;
    }
    if (key === "h") {
      event.preventDefault();
      if (!event.repeat) setShowHitboxes(engineRef.current?.toggleHitboxDebug() ?? false);
      return;
    }
    if (["w", "a", "s", "d", "c", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(key)) {
      event.preventDefault();
      keysRef.current.add(key);
      engineRef.current?.setKeys(keysRef.current);
    }
    if (key === "e") {
      event.preventDefault();
      handleInteraction();
    }
    if (key >= "1" && key <= "7") {
      const slots = [...TOOLS] as any[];
      if (abilitiesRef.current.saber) slots.push(LASER_SWORD);
      if (abilitiesRef.current.pylon) slots.push(B10_PYLON);
      const slot = slots[Number(key) - 1];
      if (slot) chooseTool(slot.id);
    }
    if (key === "m") setOverlay("map");
    if (key === "j") setOverlay("rooms");
    if (key === "i") setOverlay("inventory");
  }

  function handleKeyUp(event: KeyboardEvent) {
    if (event.code === "Space" || event.key === " ") {
      keysRef.current.delete("space");
      if (viewRef.current === "playing" && overlayRef.current === "none") event.preventDefault();
    }
    keysRef.current.delete(event.key.toLowerCase());
    engineRef.current?.setKeys(keysRef.current);
  }

  function releaseUiFocus() {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body && active.tagName !== "INPUT" && active.tagName !== "TEXTAREA") active.blur();
  }

  function triggerJump() {
    engineRef.current?.jump();
    setJumpPulse((value) => value + 1);
  }

  function releaseVirtualKey(key: string) {
    return () => {
      keysRef.current.delete(key);
      engineRef.current?.setKeys(keysRef.current);
    };
  }

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (loadingTimerRef.current !== null) window.clearInterval(loadingTimerRef.current);
    };
    // Event handlers intentionally read mutable game refs, avoiding a per-frame listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onCanvasPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = lookDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || overlay !== "none") return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.distance += Math.hypot(dx, dy);
    drag.x = event.clientX;
    drag.y = event.clientY;
    engineRef.current?.look(dx, dy);
  }

  function onCanvasPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (stage !== "playing") return;
    if (overlay === "chat") {
      event.preventDefault();
      setOverlay("none");
      return;
    }
    if (overlay !== "none") return;

    if (event.button === 2) {
      // Intercept right click for Dreamcore placement
      event.preventDefault();
      if (selectedTool === "pylon") {
        engineRef.current?.fire("pylon");
      }
      return;
    }

    if (event.button !== 0) return;
    event.preventDefault();
    releaseUiFocus();
    const canvas = event.currentTarget;
    if (document.pointerLockElement === canvas) {
      engineRef.current?.setTriggerHeld(true);
      engineRef.current?.fire(selectedTool);
      return;
    }
    const { pointerId, clientX, clientY } = event;
    const beginDrag = () => {
      lookDragRef.current = { pointerId, x: clientX, y: clientY, distance: 0 };
      try {
        if (!canvas.hasPointerCapture(pointerId)) canvas.setPointerCapture(pointerId);
      } catch {
        // A browser may reject capture after the pointer was released.
      }
    };
    if (event.pointerType !== "touch" && event.pointerType !== "pen" && typeof canvas.requestPointerLock === "function") {
      try {
        void canvas.requestPointerLock().catch(beginDrag);
      } catch {
        beginDrag();
      }
    } else {
      beginDrag();
    }
  }

  function onCanvasPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    engineRef.current?.setTriggerHeld(false);
    const drag = lookDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    lookDragRef.current = null;
    if (drag.distance >= 7) setHasLookedAround(true);
    if (drag.distance < 7 && viewRef.current === "playing" && overlayRef.current === "none") engineRef.current?.fire(selectedTool);
  }

  function onCanvasPointerCancel(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (lookDragRef.current?.pointerId === event.pointerId) lookDragRef.current = null;
  }

  async function deleteFile(file: WorldFile) {
    setPendingDelete(null);
    const remaining = worldFiles.filter((item) => item.id !== file.id);
    updateArchive(remaining);
    if (currentWorldRef.current?.id === file.id) {
      currentWorldRef.current = null;
      setCurrentWorld(null);
    }
    try {
      const response = await fetch(`/api/worlds?id=${encodeURIComponent(file.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("World archive delete failed");
      setArchiveState("online");
      showToast(`“${file.title}” removed from the world archive.`);
    } catch {
      setArchiveState("offline");
      showToast("This save was removed from local storage. The world archive is offline.");
    }
  }

  function exportFile(file: WorldFile) {
    const data = new Blob([JSON.stringify({ format: "mechanical-frontier-world-v1", world: file }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${file.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "frontier-world"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("World file exported as portable JSON.");
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setFileImportError("");
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const data = parsed && typeof parsed === "object" && "world" in parsed ? (parsed as { world: unknown }).world : parsed;
      if (!data || typeof data !== "object") throw new Error("Choose a Mechanical Frontier .json world file.");
      const item = data as Partial<WorldFile>;
      if (typeof item.id !== "string" || !Array.isArray(item.inventory) || !Array.isArray(item.discoveredRooms)) {
        throw new Error("This file is missing its world ID or field-bag data.");
      }
      const imported: WorldFile = {
        id: `${makeId()}_import`,
        title: (typeof item.title === "string" && item.title.trim() ? item.title : "Imported frontier").slice(0, 60),
        playerName: typeof item.playerName === "string" ? item.playerName.slice(0, 32) : "Ranger",
        region: typeof item.region === "string" ? item.region.slice(0, 100) : "Walsenburg, Colorado",
        roomIndex: Math.max(0, Math.min(99, Math.floor(Number(item.roomIndex) || 0))),
        playtimeSeconds: Math.max(0, Math.floor(Number(item.playtimeSeconds) || 0)),
        level: Math.max(1, Math.min(99, Math.floor(Number(item.level) || 1))),
        xp: Math.max(0, Math.floor(Number(item.xp) || 0)),
        inventory: item.inventory.filter((entry): entry is string => typeof entry === "string").slice(0, 120),
        discoveredRooms: item.discoveredRooms.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry)).map((entry) => Math.max(0, Math.min(99, Math.floor(entry)))).slice(0, 100),
        collectedRooms: Array.isArray(item.collectedRooms) ? item.collectedRooms.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry)).map((entry) => Math.max(0, Math.min(99, Math.floor(entry)))).slice(0, 100) : [],
        updatedAt: new Date().toISOString(),
      };
      updateArchive(mergeFiles(worldFiles, imported));
      try {
        const response = await fetch("/api/worlds", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(imported) });
        if (!response.ok) throw new Error("Local copy created, but archive sync is offline.");
        setArchiveState("online");
      } catch {
        setArchiveState("offline");
      }
      showToast(`“${imported.title}” added to your world files.`);
    } catch (error) {
      setFileImportError(error instanceof Error ? error.message : "That world file could not be imported.");
    }
  }

  function convertZoom(zoom: number) {
    const nextZoom = Math.max(10, Math.min(18, zoom));
    if (nextZoom === mapCenter.zoom) return;
    const factor = 2 ** (nextZoom - mapCenter.zoom);
    setMapCenter({ x: mapCenter.x * factor, y: mapCenter.y * factor, zoom: nextZoom });
  }

  function startMapDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    mapDragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, center: mapCenter };
  }

  function moveMapDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = mapDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setMapCenter({
      x: drag.center.x - (event.clientX - drag.x) / MAP_TILE_SIZE,
      y: drag.center.y - (event.clientY - drag.y) / MAP_TILE_SIZE,
      zoom: drag.center.zoom,
    });
  }

  function stopMapDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (mapDragRef.current?.pointerId === event.pointerId) mapDragRef.current = null;
  }

  function zoomMapWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    convertZoom(mapCenter.zoom + (event.deltaY < 0 ? 1 : -1));
  }

  const showCloudStatus = archiveState === "online" ? "World archive connected" : archiveState === "connecting" ? "Syncing world archive" : "Device save · archive offline";
  const locationName = currentLocation === "surface" ? "Walsenburg, Colorado" : currentLocation === "lizard" ? "Lizard Town" : `ROOM ${String(currentRoom + 1).padStart(2, "0")} · ${activeRoom.title}`;
  const mappedPlayer = currentLocation === "surface"
    ? tilePosition(MAP_LAT - (hudTick.z + 5.4) * 0.00011, MAP_LON + (hudTick.x + 3.5) * 0.00014, mapCenter.zoom)
    : null;
  const mappedTower = tilePosition(MAP_LAT, MAP_LON, mapCenter.zoom);
  const mapAddress = "Walsenburg · Huerfano County · Colorado";
  const tileRadius = 2;
  const centerTileX = Math.floor(mapCenter.x);
  const centerTileY = Math.floor(mapCenter.y);
  const tileRows: { x: number; y: number }[] = [];
  for (let y = centerTileY - tileRadius; y <= centerTileY + tileRadius; y += 1) {
    for (let x = centerTileX - tileRadius; x <= centerTileX + tileRadius; x += 1) {
      tileRows.push({ x, y });
    }
  }
  const tileCount = 2 ** mapCenter.zoom;
  const towerOffset = { x: (mappedTower.x - mapCenter.x) * MAP_TILE_SIZE, y: (mappedTower.y - mapCenter.y) * MAP_TILE_SIZE };
  const playerOffset = mappedPlayer ? { x: (mappedPlayer.x - mapCenter.x) * MAP_TILE_SIZE, y: (mappedPlayer.y - mapCenter.y) * MAP_TILE_SIZE } : null;
  const metersPerPixel = Math.cos(MAP_LAT * Math.PI / 180) * 40075016.686 / (MAP_TILE_SIZE * tileCount);
  const mapScaleMeters = [25, 50, 100, 250, 500, 1000, 2000, 5000, 10000, 20000].find((meters) => meters / metersPerPixel >= 85) ?? 20000;
  const mapScaleLabel = mapScaleMeters >= 1000 ? `${mapScaleMeters / 1000} km` : `${mapScaleMeters} m`;
  const mapScaleWidth = Math.min(170, Math.round(mapScaleMeters / metersPerPixel));

  const visibleRooms = ROOMS.filter((room) => {
    const matchesDistrict = room.districtIndex === selectedDistrict;
    const matchesSearch = `${room.title} ${room.gadget} ${room.description} ${room.district}`.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesDistrict && matchesSearch;
  });
  const experienceWidth = `${displayedProgress}%` as CSSProperties["width"];

  return (
    <main className={`frontier-app${settings.contrast ? " contrast-mode" : ""}${settings.reducedMotion ? " reduced-motion" : ""}${stage === "playing" && pocketSized ? " pocket-size-mode" : ""}`}>
      <canvas ref={canvasRef} className="frontier-canvas" aria-label="First-person three-dimensional world. Click to capture the mouse, move to look, and left-click to use a gadget." onPointerMove={onCanvasPointerMove} onPointerDown={onCanvasPointerDown} onPointerUp={onCanvasPointerUp} onPointerCancel={onCanvasPointerCancel} onContextMenu={(event) => event.preventDefault()} />
      <div className="world-vignette" aria-hidden="true" />
      {webglError && <div className="webgl-fallback">3D rendering is not available in this browser. Enable hardware acceleration or try a modern browser.</div>}

      {stage !== "playing" && (
        <div className={`title-scene ${stage === "loading" ? "title-scene-loading" : ""}`}>
          <div className="title-topbar">
            <LogoMark compact />
            <div className="title-world-state"><span className="tiny-pulse" /> FIELD NOTES <span className="title-world-separator">/</span> WALSENBURG, CO</div>
          </div>

          {stage === "title" ? (
            <div className="title-layout">
              <section className="title-copy">
                <div className="eyebrow"><span /> A COLORADO-LONG ADVENTURE <span className="eyebrow-line" /></div>
                <h1 className="title-heading"><span>Mechanical</span><em>Frontier</em></h1>
                <p className="title-deck">An extraordinary world is hiding under an ordinary Colorado town.</p>
                <p className="title-description">Find the glass tower above Walsenburg. Ride its secret elevator. Then meet Chrono and explore the wonderful, wonderfully weird world below.</p>
                <div className="title-primary-actions">
                  <button className="button-primary button-launch" onClick={beginNewWorld}><Play size={16} fill="currentColor" /><span>START EXPEDITION</span><ArrowRight size={17} /></button>
                  <button className="button-quiet button-continue" disabled={!worldFiles.length} onClick={() => openWorld(worldFiles[0])}><RotateCcw size={15} /><span>CONTINUE</span><span className="continue-meta">{worldFiles.length ? `· ${worldFiles[0].title}` : "· No field log yet"}</span></button>
                </div>
                <div className="title-secondary-actions">
                  <button onClick={() => setOverlay("files")}><FolderOpen size={15} /> WORLD FILES <span>{String(worldFiles.length).padStart(2, "0")}</span></button>
                  <button onClick={() => setOverlay("help")}><Keyboard size={15} /> CONTROLS</button>
                  <button onClick={() => setOverlay("settings")}><Settings2 size={15} /> SETTINGS</button>
                </div>
              </section>

              <aside className="title-aside">
                <div className="title-feature-card">
                  <div className="feature-card-image">
                    <div className="feature-sun" />
                    <div className="feature-range feature-range-back" />
                    <div className="feature-range feature-range-front" />
                    <div className="feature-town-roof roof-a" />
                    <div className="feature-town-roof roof-b" />
                    <div className="feature-town-roof roof-c" />
                    <div className="feature-tower"><i /><i /><i /><i /><span className="feature-tower-crown" /><b /></div>
                    <div className="feature-road" />
                    <div className="feature-coordinate">37°37&apos;27&quot;N &nbsp; 104°46&apos;49&quot;W</div>
                    <div className="feature-image-tag"><span className="tiny-pulse" /> FIELD SITE 001 · HUERFANO COUNTY</div>
                  </div>
                  <div className="feature-card-footer"><div><span className="micro-label">YOUR FIRST FIELD SITE</span><strong>Walsenburg, Colorado</strong></div><MapPin size={17} /></div>
                </div>
                <div className="title-facts">
                  <div className="title-fact"><strong>100</strong><span>ROOMS TO FIND</span></div><i />
                  <div className="title-fact"><strong>10</strong><span>HIDDEN DISTRICTS</span></div><i />
                  <div className="title-fact"><strong>∞</strong><span>GIZMOS TO TRY</span></div>
                </div>
                <div className="archive-health"><div className={`health-icon ${archiveState === "offline" ? "health-offline" : ""}`}>{archiveState === "online" ? <Database size={15} /> : archiveState === "connecting" ? <LoaderCircle size={15} className="spinner" /> : <HardDrive size={15} />}</div><div><strong>{showCloudStatus}</strong><span>Local backup always on</span></div><div className="health-dot" /></div>
              </aside>
            </div>
          ) : (
            <div className="loading-layout">
              <div className="loading-emblem"><LogoGlyph /></div>
              <p className="micro-label">MECHANICAL FRONTIER · FIELD SYSTEMS</p>
              <h2>{loadingMessage}</h2>
              <p className="loading-subtitle">Calibrating instruments · syncing coordinates · opening the elevator</p>
              <div className="loading-progress"><span style={{ width: `${loadingPercent}%` }} /></div>
              <div className="loading-numbers"><span>WORLD INITIALIZATION</span><strong>{String(loadingPercent).padStart(2, "0")}<i>%</i></strong></div>
              <div className="loading-steps"><span className={loadingPercent > 19 ? "step-done" : ""}>01 TERRAIN</span><span className={loadingPercent > 48 ? "step-done" : ""}>02 SYSTEMS</span><span className={loadingPercent > 78 ? "step-done" : ""}>03 FIELD LOG</span></div>
            </div>
          )}
          <footer className="title-footer"><span>MECHANICAL FRONTIER <i>·</i> EARTH-01</span><span>MADE OF CURIOSITY &amp; TINY SCREWS</span><button onClick={() => setOverlay("help")}><CircleHelp size={13} /> HOW TO PLAY</button></footer>
        </div>
      )}

      {stage === "playing" && (
        <div className="play-interface">
          <header className="game-topbar">
            <LogoMark compact />
            <div className="location-ribbon"><span className="tiny-pulse" /><span>{locationName}</span><ChevronDown size={13} /></div>
            <div className="heading-ribbon" title="First-person camera heading"><Compass size={14} /><span>{["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(hudTick.heading / 45) % 8]}</span><strong>{String(hudTick.heading).padStart(3, "0")}°</strong><i>{hudTick.fps} FPS</i></div>
            <div className="topbar-right">
              <div className="level-pill"><span>LVL</span><strong>{String(worldLevel).padStart(2, "0")}</strong><div className="mini-xp-track"><i style={{ width: experienceWidth }} /></div></div>
              <button className="icon-button" title="Explorer's map" aria-label="Open the Walsenburg satellite map" onClick={() => setOverlay("map")}><MapIcon size={17} /></button>
              <button className="icon-button" title="World files" aria-label="Open world files" onClick={() => setOverlay("files")}><FolderOpen size={17} /></button>
              <button className="icon-button" title="Save world" aria-label="Save the current world" onClick={() => void saveCallbackRef.current(false)}><Save size={17} /></button>
              <button className="icon-button" title="Field comms chat (T)" aria-label="Open chat" onClick={() => setOverlay("chat")}><MessageCircle size={17} /></button>
              <button className="icon-button pause-button" title="Pause menu" aria-label="Pause the game" onClick={() => setOverlay("pause")}><Pause size={17} fill="currentColor" /></button>
            </div>
          </header>



          <div className="loadout-dock" aria-label="Gadget loadout">
            <div className="tool-slots">
              {dockTools.map((item) => (
                <button key={item.id} className={`tool-slot ${selectedTool === item.id ? "tool-slot-active" : ""}`} onClick={() => chooseTool(item.id)} style={{ "--tool-color": item.color } as CSSProperties} title={`${item.name} · ${item.detail}`}>
                  <span className="tool-key">{item.key}</span><span className="tool-glyph">{item.glyph}</span><span className="tool-slot-copy"><strong>{item.short}</strong><small>{item.name}</small></span>
                </button>
              ))}
              <button className="inventory-shortcut" title="Open inventory" onClick={() => setOverlay("inventory")}><Boxes size={16} /><span>FIELD BAG</span><strong>{inventory.length}</strong></button>
            </div>
          </div>

          <button
            type="button"
            className={`jump-pad${hudTick.flying ? " jump-pad-flying" : hudTick.grounded ? "" : " jump-pad-airborne"}`}
            aria-label={hudTick.flying ? "Fly up (hold). Double-tap to stop flying." : "Jump (Space)"}
            title={hudTick.flying ? "Hold to rise · double-tap to land" : "Jump — press Space"}
            onMouseDown={(event) => event.preventDefault()}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Capture is optional. */ }
              keysRef.current.add("space");
              engineRef.current?.setKeys(keysRef.current);
              triggerJump();
            }}
            onPointerUp={releaseVirtualKey("space")}
            onPointerCancel={releaseVirtualKey("space")}
            onLostPointerCapture={releaseVirtualKey("space")}
            onClick={(event) => { if (event.detail === 0) triggerJump(); }}
          >
            {jumpPulse > 0 && <span key={jumpPulse} className="jump-pad-ring" aria-hidden="true" />}
            <ChevronsUp size={21} />
            <strong>{hudTick.flying ? "FLY" : hudTick.grounded ? "JUMP" : "AIR"}</strong>
            <kbd>{hudTick.flying ? "HOLD" : "SPACE"}</kbd>
          </button>
          {hudTick.flying && (
            <button
              type="button"
              className="descend-pad"
              aria-label="Fly down (hold)"
              title="Hold to descend · Shift or C"
              onMouseDown={(event) => event.preventDefault()}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Capture is optional. */ }
                keysRef.current.add("c");
                engineRef.current?.setKeys(keysRef.current);
              }}
              onPointerUp={releaseVirtualKey("c")}
              onPointerCancel={releaseVirtualKey("c")}
              onLostPointerCapture={releaseVirtualKey("c")}
            ><ChevronsDown size={18} /><span>DOWN</span></button>
          )}
          {overlay === "none" && <div className={`aim-reticle first-person-reticle${selfSizeReady ? (selectedTool === "grow" ? " reticle-self-grow" : " reticle-self-shrink") : ""}${hudTick.piloting ? " reticle-mech" : ""}`} aria-hidden="true"><span /><i /><b /></div>}
          {showHitboxes && overlay === "none" && <div className="hitbox-debug-indicator">HITBOX VISUALIZATION <kbd>H</kbd></div>}
          {selfSizeReady && <div className={`self-size-tag${selectedTool === "grow" ? " self-size-grow" : ""}`} aria-hidden="true">↓ {selectedTool === "grow" ? "GROW SELF" : "SHRINK SELF"}</div>}
          {overlay === "none" && actionTarget && <button type="button" className="action-prompt" onClick={handleInteraction}><kbd>E</kbd><span>{actionTarget.label}</span></button>}
          {overlay === "none" && hudTick.piloting && <div className="mech-cockpit-overlay" aria-hidden="true"><span className="cockpit-corner cockpit-tl" /><span className="cockpit-corner cockpit-tr" /><span className="cockpit-corner cockpit-bl" /><span className="cockpit-corner cockpit-br" /><div className="cockpit-status"><b>WITHROW MECH</b><span>LEFT CLICK FIRE <i>·</i> <kbd>F</kbd> EXIT</span></div></div>}
          {overlay === "none" && !mouseLocked && !hasLookedAround && <div className="camera-instruction"><MousePointer2 size={14} /><span className="camera-instruction-desktop">CLICK THE WORLD TO LOOK AROUND <i>·</i> ESC RELEASES MOUSE</span><span className="camera-instruction-mobile">DRAG TO LOOK <i>·</i> TAP TO FIRE</span></div>}
          {toast && overlay === "none" && <div className="game-toast" role="status"><Sparkles size={15} /><span>{toast}</span><button aria-label="Dismiss message" onClick={() => setToast("")}><X size={14} /></button></div>}

        </div>
      )}

      {overlay === "chat" && <ChatPanel messages={chatMessages} onSend={handleChatSend} onClose={() => setOverlay("none")} canSpawnNpcs={abilities.npcSpawner} onSpawnNpc={spawnNpcFromChat} />}

      {overlay === "dreamcore" && activeDreamcoreId && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOverlay("none"); }}>
          <section className="menu-modal dreamcore-modal" role="dialog" aria-modal="true" aria-label="Dreamcore AI interface">
            <div className="modal-topline"><div className="modal-kicker"><Sparkles size={14} /> DREAMCORE AI INTERFACE</div><button className="close-button" onClick={() => setOverlay("none")} aria-label="Close menu"><X size={18} /></button></div>
            <p className="modal-overline">CHRONAL MESH SYNTHESIS</p>
            <h2>What should we <em>build?</em></h2>
            <p className="modal-description">The Dreamcore uses chronal particles and procedural mesh builders to materialize any object you describe. Try colors and subjects!</p>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!dreamcorePrompt.trim()) return;
              engineRef.current?.submitDreamcorePrompt(activeDreamcoreId, dreamcorePrompt);
              setOverlay("none");
              showToast("AI synthesis started — holographic construction has begun.");
            }} className="dreamcore-form">
              <input
                value={dreamcorePrompt}
                onChange={(e) => setDreamcorePrompt(e.target.value)}
                placeholder="e.g. red and white rocket ship, stealth rover..."
                maxLength={80}
                required
                autoFocus
              />
              <button type="submit" className="button-primary"><Sparkles size={14} /> SYNTHESIZE MESH</button>
            </form>
            <div className="dreamcore-prompt-suggestions">
              <span>TRY SUGGESTIONS:</span>
              <button type="button" onClick={() => setDreamcorePrompt("red and white rocket ship")}>Rocket Ship</button>
              <button type="button" onClick={() => setDreamcorePrompt("gold laser cannon turret")}>Sentry Turret</button>
              <button type="button" onClick={() => setDreamcorePrompt("purple cyber spider mech")}>Sentinel Mech</button>
              <button type="button" onClick={() => setDreamcorePrompt("crystal glass light tree")}>luminous Tree</button>
              <button type="button" onClick={() => setDreamcorePrompt("gold relic laser sword")}>Ornate Blade</button>
            </div>
          </section>
        </div>
      )}

      {overlay === "abilityCore" && activeDreamcoreId && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOverlay("none"); }}>
          <section className="menu-modal ability-core-modal" role="dialog" aria-modal="true" aria-label="Ability Core Activation">
            <div className="modal-topline"><div className="modal-kicker"><Zap size={14} /> ABILITY CORE ACTIVATION</div><button className="close-button" onClick={() => setOverlay("none")} aria-label="Close menu"><X size={18} /></button></div>
            <p className="modal-overline">BEHAVIORAL MATRICES</p>
            <h2>Empower your <em>creation.</em></h2>
            <p className="modal-description">The Ability Core matches cognitive matrices to your procedural mesh. Select a functional ability to activate the object!</p>
            <div className="ability-grid">
              <button type="button" className="ability-card" onClick={() => { engineRef.current?.applyAbilityCore(activeDreamcoreId, "pilot"); setOverlay("none"); }}>
                <strong>✈ PILOT MECHANICS</strong>
                <span>Drivable! Walk up, press E to enter and fly/drive using WASD, Space, and Shift. F exits.</span>
              </button>
              <button type="button" className="ability-card" onClick={() => { engineRef.current?.applyAbilityCore(activeDreamcoreId, "defend"); setOverlay("none"); }}>
                <strong>⚔ DEFENSE MATRIX</strong>
                <span>Sentry mode! Automatically swivels and fires nonlethal energy bolts at nearby room beacons or neighbors.</span>
              </button>
              <button type="button" className="ability-card" onClick={() => { engineRef.current?.applyAbilityCore(activeDreamcoreId, "companion"); setOverlay("none"); }}>
                <strong>☁ CHRONAL COMPANION</strong>
                <span>Follower mode! Detaches, hovers, and follows you closely wherever you travel.</span>
              </button>
              <button type="button" className="ability-card" onClick={() => { engineRef.current?.applyAbilityCore(activeDreamcoreId, "gravity"); setOverlay("none"); }}>
                <strong>⚛ GRAVITY DISRUPTOR</strong>
                <span>Chronal well! Emits a local field that pulls in and slows down walking neighbors.</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {overlay !== "none" && overlay !== "chat" && overlay !== "dreamcore" && overlay !== "abilityCore" && (
        <div className={`modal-backdrop ${overlay === "map" ? "map-backdrop" : ""}${overlay === "dialogue" ? "dialogue-backdrop" : ""}`} onMouseDown={(event) => { if (event.target === event.currentTarget && overlay !== "dialogue") setOverlay("none"); }}>
          {overlay === "pause" && (
            <section className="menu-modal pause-modal" role="dialog" aria-modal="true" aria-label="Expedition paused">
              <div className="modal-topline"><LogoMark compact /><button className="close-button" onClick={() => setOverlay("none")} aria-label="Resume expedition"><X size={18} /></button></div>
              <div className="modal-overline">FIELD SYSTEMS / PAUSED</div>
              <h2>Take a breath,<br /><em>Ranger.</em></h2>
              <p className="modal-description">Your current expedition is safe. Time and the town can wait.</p>
              <div className="pause-actions"><button className="button-primary" onClick={() => setOverlay("none")}><Play size={16} fill="currentColor" /> RESUME EXPLORING</button><button className="modal-action-row" onClick={() => void saveCallbackRef.current(false)}><Save size={16} /> SAVE THIS WORLD <ArrowRight size={16} /></button><button className="modal-action-row" onClick={() => setOverlay("map")}><MapIcon size={16} /> TWO-LEVEL WORLD ATLAS <ArrowRight size={16} /></button><button className="modal-action-row" onClick={() => setOverlay("rooms")}><BookOpen size={16} /> 100-ROOM FIELD GUIDE <ArrowRight size={16} /></button><button className="modal-action-row" onClick={() => setOverlay("help")}><Keyboard size={16} /> CONTROLS & FIELD NOTES <ArrowRight size={16} /></button></div>
              <div className="pause-save-foot"><span className={`status-pip status-${archiveState}`} /> {showCloudStatus} <span>·</span> {prettyDuration(playTime)} elapsed</div>
            </section>
          )}

          {overlay === "files" && (
            <section className="wide-modal files-modal" role="dialog" aria-modal="true" aria-label="World files">
              <div className="modal-topline"><div className="modal-kicker"><FolderOpen size={15} /> MECHANICAL FRONTIER <span>/</span> WORLD FILES</div><button className="close-button" onClick={() => setOverlay("none")} aria-label="Close world files"><X size={18} /></button></div>
              <div className="files-heading"><div><p className="modal-overline">SAVE · CONTINUE · CARRY YOUR ADVENTURE</p><h2>Your field <em>archive.</em></h2><p className="modal-description">World files sync through the world archive when available and always keep a local device backup.</p></div><div className="archive-pill"><span className={`status-pip status-${archiveState}`} />{showCloudStatus}</div></div>
              {stage === "playing" && currentWorld && <div className="save-current-row"><div className="save-current-icon"><Save size={17} /></div><div className="save-current-fields"><label htmlFor="world-title">SAVE CURRENT EXPEDITION</label><input id="world-title" value={worldTitle} maxLength={60} onChange={(event) => setWorldTitle(event.target.value)} onKeyDown={(event) => event.stopPropagation()} placeholder="Name this field log" /></div><button className="button-primary save-world-button" onClick={() => void saveCallbackRef.current(false, worldTitle)}><Save size={15} /> SAVE NOW</button></div>}
              {worldFiles.length ? <div className="world-file-grid">{worldFiles.map((file, index) => {
                const savedLocation = file.region === "Lizard Town" ? "Lizard Town" : file.region.startsWith("Room ") ? ROOMS[file.roomIndex]?.title ?? "Workshop" : "Walsenburg, Colorado";
                return <article key={file.id} className={`world-file-card ${currentWorld?.id === file.id ? "world-file-active" : ""}`}>
                  <div className="file-art"><div className="file-art-star" /><div className="file-art-lines" /><div className="file-art-tower"><i /><b /></div><span>WORLD FILE {String(index + 1).padStart(2, "0")}</span><div className="file-art-region">{file.region.startsWith("Room ") ? `ROOM ${String(file.roomIndex + 1).padStart(2, "0")}` : file.region === "Lizard Town" ? "UNDERMOUNTAIN" : "COLORADO · EARTH"}</div></div>
                  <div className="file-card-content"><div className="file-card-title"><div><span className="micro-label">{file.playerName || "RANGER"} · LEVEL {String(file.level).padStart(2, "0")}</span><h3>{file.title}</h3></div><button className="file-menu-icon" title="Export world file" onClick={() => exportFile(file)}><Download size={15} /></button></div><div className="file-meta"><span><MapPin size={13} /> {savedLocation}</span><span><Clock3 size={13} /> {prettyDuration(file.playtimeSeconds ?? 0)}</span><span><BookOpen size={13} /> {file.discoveredRooms?.length ?? 1} / 100 rooms</span></div><div className="file-card-actions"><button className="file-load-button" onClick={() => openWorld(file)}><Play size={13} fill="currentColor" /> {currentWorld?.id === file.id ? "LOAD THIS FILE" : "CONTINUE"}</button><button className="file-delete-button" onClick={() => pendingDelete === file.id ? void deleteFile(file) : setPendingDelete(file.id)} title={pendingDelete === file.id ? "Confirm delete" : "Delete world file"}>{pendingDelete === file.id ? "CONFIRM?" : <Trash2 size={15} />}</button></div></div>
                </article>;
              })}</div> : <div className="empty-archive"><div className="empty-archive-icon"><FolderOpen size={22} /></div><div><strong>No worlds in the archive. Yet.</strong><p>Start an expedition and save your first Walsenburg field log here.</p></div><button className="button-primary" onClick={beginNewWorld}><Play size={15} fill="currentColor" /> START A NEW WORLD</button></div>}
              <div className="archive-footer"><div className="archive-footer-note"><ShieldCheck size={16} /><span>PORTABLE WORLD FILES <small>Import or export a world as a JSON field log.</small></span></div><input ref={fileInputRef} className="hidden-file-input" type="file" accept="application/json,.json" onChange={(event) => void importFile(event)} /><button className="button-secondary" onClick={() => fileInputRef.current?.click()}><Upload size={14} /> IMPORT WORLD</button><button className="button-secondary" onClick={() => currentWorld ? exportFile(currentWorld) : showToast("Load or start an expedition before exporting.")}><Download size={14} /> EXPORT CURRENT</button></div>
              {fileImportError && <p className="import-error" role="alert">{fileImportError}</p>}
            </section>
          )}

          {overlay === "rooms" && (
            <section className="wide-modal rooms-modal" role="dialog" aria-modal="true" aria-label="One hundred room field guide">
              <div className="modal-topline"><div className="modal-kicker"><BookOpen size={15} /> CHRONO&apos;S FIELD GUIDE <span>/</span> 100 ROOMS</div><button className="close-button" onClick={() => setOverlay("none")} aria-label="Close room guide"><X size={18} /></button></div>
              <div className="rooms-heading"><div><p className="modal-overline">10 DISTRICTS · 100 LITTLE WONDERS · ONE VERY LARGE MAP</p><h2>Pick a door. <em>Find a story.</em></h2><p className="modal-description">All one hundred chambers are built to explore. Each room rewards a different usable gadget with its own NPC-safe pulse, gravity, portal, or shrink behavior.</p></div><div className="room-count-seal"><strong>{String(discoveredRooms.length).padStart(2, "0")}<i>/100</i></strong><span>EXPLORED</span></div></div>
              <div className="district-tabs" role="tablist" aria-label="Districts">{DISTRICTS.map((district, index) => <button key={district.name} className={`district-tab ${selectedDistrict === index ? "district-tab-active" : ""}`} style={{ "--district-color": district.color } as CSSProperties} onClick={() => setSelectedDistrict(index)} role="tab" aria-selected={selectedDistrict === index}><span>{String(index + 1).padStart(2, "0")}</span>{district.name}</button>)}</div>
              <div className="district-feature" style={{ "--district-color": activeDistrict.color } as CSSProperties}><span className="district-signal"><Sparkles size={15} /></span><div><strong>{activeDistrict.name}</strong><span>{activeDistrict.tagline}</span></div><div className="district-feature-count">10 ROOMS <i>·</i> SECTOR {String(selectedDistrict + 1).padStart(2, "0")}</div></div>
              <div className="room-search"><Compass size={15} /><input aria-label="Search rooms in this district" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search this district..." /><span>SEARCH FIELD NOTES</span></div>
              <div className="room-card-grid">{visibleRooms.map((room) => {
                const found = discoveredRooms.includes(room.index);
                const collected = collectedRooms.includes(room.index);
                return <button key={room.index} className={`room-card ${found ? "room-card-found" : ""}`} onClick={() => enterRoom(room.index)} style={{ "--district-color": room.color } as CSSProperties}><span className="room-card-id">{room.number}<i>{collected ? <Check size={11} /> : found ? <Compass size={11} /> : <ArrowUpRight size={11} />}</i></span><strong>{room.title}</strong><span className="room-card-object"><Sparkles size={11} /> {room.gadget}<i>{room.gadgetType.toUpperCase()}</i></span><small>{room.description}</small><span className="room-enter-arrow"><ArrowRight size={14} /> VISIT ROOM</span></button>;
              })}{visibleRooms.length === 0 && <div className="no-room-results">No rooms match those field notes.</div>}</div>
              <div className="guide-footer"><span>PORTAL ACCESS ENABLED <i /> VISIT ANY ROOM FROM THE FIELD GUIDE</span><button onClick={() => setOverlay("none")}><X size={14} /> BACK TO WORLD</button></div>
            </section>
          )}

          {overlay === "map" && (
            <section className="wide-modal map-modal" role="dialog" aria-modal="true" aria-label="Detailed surface and underground world map">
              <div className="modal-topline"><div className="modal-kicker"><Globe2 size={15} /> FIELD CARTOGRAPHY <span>/</span> {mapWorld === "surface" ? "HUERFANO COUNTY" : "UNDERMOUNTAIN"}</div><button className="close-button" onClick={() => setOverlay("none")} aria-label="Close map"><X size={18} /></button></div>
              <div className="map-heading"><div><p className="modal-overline">{mapWorld === "surface" ? "LIVE WORLD IMAGERY · WALSENBURG, COLORADO" : "100 ROOMS · 10 DISTRICTS · ONE SECRET WORLD"}</p><h2>{mapWorld === "surface" ? <>Know the <em>ground.</em></> : <>Chart the <em>frontier.</em></>}</h2><p className="modal-description">{mapWorld === "surface" ? "Explore real imagery with optional road and place labels. Pan, zoom, and locate the fictional Skyline Lift field site." : "Follow the underground district network. Every glowing point is a playable room—select a gate or jump directly into a chamber."}</p></div><div className="coordinate-badge">{mapWorld === "surface" ? <><MapPin size={15} /><span><strong>37.6242° N</strong><small>104.7803° W · ELEV. 1,886 M</small></span></> : <><Compass size={15} /><span><strong>10 DISTRICTS</strong><small>100 ROOMS · DEPTH 312 M</small></span></>}</div></div>
              <div className="map-view-switch"><div role="tablist" aria-label="Map levels"><button type="button" className={mapWorld === "surface" ? "map-view-active" : ""} aria-selected={mapWorld === "surface"} role="tab" onClick={() => setMapWorld("surface")}><Globe2 size={13} /> WALSENBURG / SURFACE</button><button type="button" className={mapWorld === "underground" ? "map-view-active" : ""} aria-selected={mapWorld === "underground"} role="tab" onClick={() => setMapWorld("underground")}><Compass size={13} /> LIZARD TOWN / BELOW</button></div><span>{mapWorld === "surface" ? "EARTH · 37.6242° N" : `${discoveredRooms.length} / 100 ROOMS CHARTED`}</span></div>
              {mapWorld === "surface" ? <>
                <div className="map-layer-bar"><span>BASEMAP</span>{(["satellite", "hybrid", "streets"] as const).map((layer) => <button key={layer} type="button" className={mapLayer === layer ? "map-layer-active" : ""} onClick={() => setMapLayer(layer)}>{layer === "satellite" ? "SATELLITE" : layer === "hybrid" ? "IMAGERY + LABELS" : "STREET & TERRAIN"}</button>)}<small>ESRI MAP SERVICES</small></div>
                <div className="map-workbench">
                  <div className="satellite-stage" onPointerDown={startMapDrag} onPointerMove={moveMapDrag} onPointerUp={stopMapDrag} onPointerCancel={stopMapDrag} onWheel={zoomMapWheel}>
                    <div className="satellite-tiles">{tileRows.map((tile) => {
                      const wrappedX = ((tile.x % tileCount) + tileCount) % tileCount;
                      const safeY = Math.max(0, Math.min(tileCount - 1, tile.y));
                      const offsetLeft = (tile.x + 0.5 - mapCenter.x) * MAP_TILE_SIZE;
                      const offsetTop = (tile.y + 0.5 - mapCenter.y) * MAP_TILE_SIZE;
                      const tileStyle = { left: `calc(50% + ${offsetLeft}px)`, top: `calc(50% + ${offsetTop}px)` };
                      return <div key={`${mapCenter.zoom}-${tile.x}-${tile.y}`} className="satellite-tile-stack" style={tileStyle}><Image draggable={false} alt="" src={`${mapLayer === "streets" ? MAP_STREETS_TEMPLATE : MAP_TEMPLATE}/${mapCenter.zoom}/${safeY}/${wrappedX}`} width={MAP_TILE_SIZE} height={MAP_TILE_SIZE} unoptimized className="satellite-tile-image" />{mapLayer === "hybrid" && <><Image draggable={false} alt="" src={`${MAP_ROADS_TEMPLATE}/${mapCenter.zoom}/${safeY}/${wrappedX}`} width={MAP_TILE_SIZE} height={MAP_TILE_SIZE} unoptimized className="satellite-tile-image satellite-tile-overlay" /><Image draggable={false} alt="" src={`${MAP_LABELS_TEMPLATE}/${mapCenter.zoom}/${safeY}/${wrappedX}`} width={MAP_TILE_SIZE} height={MAP_TILE_SIZE} unoptimized className="satellite-tile-image satellite-tile-overlay" /></>}</div>;
                    })}</div>
                    <div className="map-imagery-filter" />
                    <div className="map-crosshair"><span /><i /></div>
                    <div className="satellite-marker" style={{ left: `calc(50% + ${towerOffset.x}px)`, top: `calc(50% + ${towerOffset.y}px)` }}><span className="marker-wave" /><MapPin size={23} fill="currentColor" /><b>SKYLINE LIFT · FIELD SITE</b></div>
                    {playerOffset && mapCenter.zoom >= 16 && <div className="satellite-player-marker" style={{ left: `calc(50% + ${playerOffset.x}px)`, top: `calc(50% + ${playerOffset.y}px)` }} title="Your approximate surface position and camera heading"><span style={{ transform: `rotate(${hudTick.heading}deg)` }} /></div>}
                    <div className="map-edge-tick map-edge-n">N <i>↑</i></div><div className="map-edge-tick map-edge-s">S <i>↓</i></div><div className="map-edge-tick map-edge-w">W <i>←</i></div><div className="map-edge-tick map-edge-e">E <i>→</i></div>
                    <div className="map-scale"><div style={{ width: mapScaleWidth }} /><span>{mapScaleLabel}</span></div>
                    <div className="satellite-credit">IMAGERY © ESRI, MAXAR, EARTHSTAR GEOGRAPHICS · {mapAddress.toUpperCase()}</div>
                    <div className="map-zoom-controls"><button onClick={() => convertZoom(mapCenter.zoom + 1)} aria-label="Zoom in"><span>+</span></button><span>{mapCenter.zoom}</span><button onClick={() => convertZoom(mapCenter.zoom - 1)} aria-label="Zoom out"><span>−</span></button><button className="reset-map-button" onClick={() => setMapCenter(tilePosition(MAP_LAT, MAP_LON, 12))} aria-label="Reset map to Walsenburg"><RotateCcw size={13} /></button></div>
                    <div className="map-pan-instruction"><Move size={12} /> DRAG TO EXPLORE <i>·</i> SCROLL TO ZOOM</div>
                  </div>
                  <aside className="map-legend"><div className="legend-kicker"><span className="tiny-pulse" /> LOCAL FIELD SITES</div><button className="legend-site legend-site-active" onClick={() => setMapCenter(tilePosition(MAP_LAT, MAP_LON, mapCenter.zoom))}><span className="legend-site-marker"><MapPin size={15} fill="currentColor" /></span><span><strong>Skyline Lift</strong><small>Walsenburg, Colorado</small></span><ArrowRight size={14} /></button><div className="legend-distance"><div className="distance-line" /><span>HUERFANO COUNTY</span><span>{mapScaleLabel} SCALE</span></div><div className="map-context-note"><Sparkles size={14} /><p><strong>A hidden frontier.</strong> Real map imagery surrounds the fictional glass-tower field site. Descend to see the room network below.</p></div><div className="map-coordinate-readout"><span>MAP CENTER / WGS84</span><strong>{Math.abs(mapCenter.x / tileCount * 360 - 180).toFixed(4)}° {mapCenter.x / tileCount * 360 - 180 < 0 ? "W" : "E"}</strong><strong>{Math.abs(Math.atan(Math.sinh(Math.PI * (1 - 2 * mapCenter.y / tileCount))) * 180 / Math.PI).toFixed(4)}° {Math.atan(Math.sinh(Math.PI * (1 - 2 * mapCenter.y / tileCount))) >= 0 ? "N" : "S"}</strong><small>{mapLayer === "hybrid" ? "IMAGERY + ROADS + PLACES" : mapLayer === "streets" ? "TOPOGRAPHIC STREETS" : "SATELLITE IMAGERY"} · ZOOM {mapCenter.zoom}</small></div><div className="map-legend-foot"><span className="map-color-key" /> CURRENT EXPEDITION <span className="legend-live">LIVE</span></div></aside>
                </div>
              </> : <UndergroundMap districtIndex={selectedDistrict} onSelectDistrict={setSelectedDistrict} onEnterRoom={enterRoom} onReturnHub={() => { changeLocation("lizard"); setOverlay("none"); showToast("Returned to the center of Lizard Town."); }} discoveredRooms={discoveredRooms} collectedRooms={collectedRooms} currentLocation={currentLocation} currentRoom={currentRoom} />}
              <div className="map-modal-footer"><span><ShieldCheck size={14} /> {mapWorld === "surface" ? "MAP SOURCES: ESRI, MAXAR, EARTHSTAR GEOGRAPHICS, AND THE GIS USER COMMUNITY." : "UNDERGROUND CARTOGRAPHY: CHRONO'S FIELD GUIDE · ALL 100 ROOMS ACCESSIBLE."}</span><button onClick={() => setOverlay("none")}><ArrowLeft size={14} /> RETURN TO FIELD</button></div>
            </section>
          )}

          {overlay === "inventory" && (
            <section className="wide-modal inventory-modal" role="dialog" aria-modal="true" aria-label="Field bag inventory">
              <div className="modal-topline"><div className="modal-kicker"><Boxes size={15} /> CHRONO&apos;S PACKING LIST <span>/</span> FIELD BAG</div><button className="close-button" onClick={() => setOverlay("none")} aria-label="Close inventory"><X size={18} /></button></div>
              <div className="rooms-heading"><div><p className="modal-overline">EVERY GADGET HAS A DIFFERENT KIND OF KINDNESS</p><h2>Tools &amp; <em>finds.</em></h2><p className="modal-description">Select a tool with 1–{dockTools.length} or equip one below. Left-click aims your active device.</p></div><div className="inventory-count-seal"><Boxes size={17} /><strong>{String(inventory.length).padStart(2, "0")}</strong><span>PACKED</span></div></div>
              <div className="inventory-tool-grid">{dockTools.map((item) => {
                const equipped = selectedTool === item.id && !selectedGadget;
                return <button key={item.id} className={`inventory-tool-card ${equipped ? "inventory-tool-selected" : ""}`} onClick={() => { chooseTool(item.id); setOverlay("none"); }} style={{ "--tool-color": item.color } as CSSProperties}><span className="inventory-tool-key">{item.key}</span><span className="inventory-tool-glyph">{item.glyph}</span><strong>{item.name}</strong><small>{item.detail}</small><span className="inventory-equip"><Zap size={13} /> {equipped ? "EQUIPPED" : "EQUIP TOOL"}</span></button>;
              })}</div>
              <div className="artifact-heading"><span className="micro-label">RECOVERED UNIQUE GADGETS</span><span>{collectedRooms.length} / 100 FOUND</span></div>
              {collectedRooms.length ? <div className="artifact-chip-list">{collectedRooms.slice().sort((a, b) => a - b).map((index) => {
                const room = ROOMS[index];
                return <button className={`artifact-chip ${selectedGadget === room.gadget ? "artifact-chip-active" : ""}`} key={index} onClick={() => equipRoomGadget(index)} title={room.gadgetDetail}><Sparkles size={13} /><span>{room.gadget}</span><small>{room.gadgetType.toUpperCase()} · ROOM {room.number}</small><b>{selectedGadget === room.gadget ? "EQUIPPED" : "EQUIP"}</b></button>;
              })}</div> : <div className="empty-artifact-bag"><Sparkles size={16} /> No room gadgets yet. The first unique one is waiting in a glowing chamber.</div>}
            </section>
          )}

          {overlay === "settings" && (
            <section className="menu-modal settings-modal" role="dialog" aria-modal="true" aria-label="Game settings">
              <div className="modal-topline"><div className="modal-kicker"><Settings2 size={15} /> FIELD SYSTEMS <span>/</span> SETTINGS</div><button className="close-button" onClick={() => setOverlay("none")} aria-label="Close settings"><X size={18} /></button></div>
              <p className="modal-overline">MAKE THIS WORLD YOUR OWN</p><h2>Field <em>settings.</em></h2><p className="modal-description">Three-dimensional scenes are rendered locally at your display&apos;s refresh pace.</p>
              <div className="setting-row"><div className="setting-icon"><Volume2 size={16} /></div><span><strong>Gadget &amp; world sounds</strong><small>Procedural audio for tools, NPC reactions, elevators, dialogue, saves, and rewards.</small></span><button className={`setting-switch ${settings.sound ? "switch-on" : ""}`} onClick={() => setSettings((current) => ({ ...current, sound: !current.sound }))} aria-pressed={settings.sound}><i /></button></div>
              <div className="setting-look-range"><div className="setting-icon"><MousePointer2 size={16} /></div><label htmlFor="camera-sensitivity"><strong>Mouse look sensitivity</strong><small>Drag or move your mouse to turn the first-person camera.</small><input id="camera-sensitivity" type="range" min="0.0008" max="0.006" step="0.0002" value={settings.sensitivity} onChange={(event) => setSettings((current) => ({ ...current, sensitivity: Number(event.target.value) }))} /></label><b>{(settings.sensitivity / 0.0022).toFixed(1)}×</b></div>
              <div className="setting-row"><div className="setting-icon"><Move size={16} /></div><span><strong>Invert vertical look</strong><small>Reverse up and down camera movement.</small></span><button className={`setting-switch ${settings.invertY ? "switch-on" : ""}`} onClick={() => setSettings((current) => ({ ...current, invertY: !current.invertY }))} aria-pressed={settings.invertY}><i /></button></div>
              <div className="setting-row"><div className="setting-icon"><Sparkles size={16} /></div><span><strong>Reduced motion</strong><small>Reduce decorative motion in interface transitions.</small></span><button className={`setting-switch ${settings.reducedMotion ? "switch-on" : ""}`} onClick={() => setSettings((current) => ({ ...current, reducedMotion: !current.reducedMotion }))} aria-pressed={settings.reducedMotion}><i /></button></div>
              <div className="setting-row"><div className="setting-icon"><Gauge size={16} /></div><span><strong>High-contrast interface</strong><small>Boost labels and game panel visibility.</small></span><button className={`setting-switch ${settings.contrast ? "switch-on" : ""}`} onClick={() => setSettings((current) => ({ ...current, contrast: !current.contrast }))} aria-pressed={settings.contrast}><i /></button></div>
              <div className="setting-hardware"><ShieldCheck size={15} /> Graphics presets dynamically target a smooth 60-frame experience; your device may vary.</div>
              <button className="button-primary settings-done" onClick={() => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* The live settings still work if storage is blocked. */ } setOverlay("none"); showToast("Camera and display preferences saved."); }}><Check size={15} /> SAVE PREFERENCES</button>
            </section>
          )}

          {overlay === "help" && (
            <section className="wide-modal help-modal" role="dialog" aria-modal="true" aria-label="How to play">
              <div className="modal-topline"><div className="modal-kicker"><Keyboard size={15} /> FIELD TRAINING <span>/</span> CONTROLS</div><button className="close-button" onClick={() => setOverlay("none")} aria-label="Close controls"><X size={18} /></button></div>
              <div className="rooms-heading"><div><p className="modal-overline">YOUR FIRST DAY ON THE FRONTIER</p><h2>Easy as <em>W · A · S · D.</em></h2><p className="modal-description">Find the tower, follow the warm lift light, and let Chrono show you the rest.</p></div><div className="training-icon"><Gamepad2 size={24} /></div></div>
              <div className="controls-grid"><div className="control-card control-card-movement"><div className="control-icon"><Move size={17} /></div><span className="micro-label">MOVE &amp; LOOK</span><div className="key-cluster"><div className="key-cap">W</div><div><div className="key-cap">A</div><div className="key-cap">S</div><div className="key-cap">D</div></div></div><p>Click the world to capture your mouse. Move it to look around; WASD moves relative to your view. Shift runs, Space jumps, and double-tapping Space flies once flight is unlocked. Esc releases the mouse. On touch, drag to look and tap to fire.</p></div><div className="control-card"><div className="control-icon"><Crosshair size={17} /></div><span className="micro-label">USE A GADGET</span><div className="mouse-key"><span className="mouse-drawing"><i /></span><span><b>LEFT CLICK</b><small>SHOOT · ACTIVATE</small></span></div><p>Switch tools with <kbd>1</kbd>–<kbd>5</kbd> and equip room gadgets from your field bag. Aim the Shrink Ray (4) or Grow Ray (5) straight down to resize yourself: pocket, normal, or giant.</p></div><div className="control-card"><div className="control-icon"><MessageCircle size={17} /></div><span className="micro-label">INTERACT</span><div className="key-feature"><span className="key-cap">E</span><span>Talk · enter · inspect</span></div><p>Get close to someone or a highlighted marker and press E.</p></div><div className="control-card"><div className="control-icon"><MapIcon size={17} /></div><span className="micro-label">FIELD GUIDE</span><div className="shortcut-row"><kbd>M</kbd><span>satellite map</span><kbd>J</kbd><span>rooms</span><kbd>I</kbd><span>inventory</span></div><p>Open the real-image map, all 100 rooms, or your gadget field bag. Press <kbd>T</kbd> to chat with Chrono and <kbd>H</kbd> to inspect 3D hitboxes.</p></div></div>
              <div className="training-footer"><div><ShieldCheck size={15} /><span>GADGETS ARE FRIENDLY BY DESIGN · DEFEATED NPCS RESPAWN</span></div><button onClick={() => setOverlay("none")}>GOT IT <ArrowRight size={15} /></button></div>
            </section>
          )}

          {overlay === "dialogue" && (
            <section className="chrono-dialogue" role="dialog" aria-modal="true" aria-label="Chrono's field greeting">
              <div className="dialogue-portrait"><div className="chrono-portrait-hair" /><div className="chrono-portrait-face"><i /><i /><span /></div><div className="portrait-spark portrait-spark-one" /><div className="portrait-spark portrait-spark-two" /></div>
              <div className="dialogue-copy"><div className="dialogue-overline"><span className="tiny-pulse" /> CHRONO <i>·</i> LIZARD TOWN FIELD GUIDE <small>AGE 10 · PROFESSIONAL ELEVATOR BUILDER</small></div><p key={dialogueStep}>{dialogueLines[dialogueStep]}</p><div className="dialogue-footer"><div className="dialogue-pages">{dialogueLines.map((_, index) => <i key={index} className={index <= dialogueStep ? "dialogue-page-on" : ""} />)}</div><button onClick={advanceDialogue}>{dialogueStep < dialogueLines.length - 1 ? "TELL ME MORE" : "LET'S EXPLORE"} <ArrowRight size={15} /></button></div></div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

function LogoGlyph() {
  return <svg viewBox="0 0 48 48" aria-hidden="true" className="logo-glyph-svg"><path d="M24 3.5 43.5 14.7v18.6L24 44.5 4.5 33.3V14.7L24 3.5Z" /><path d="M24 9.5v29M11.3 16.8l25.4 14.4M36.7 16.8 11.3 31.2" /><circle cx="24" cy="24" r="6.5" /><path d="M24 17.5v-8m6.5 14.5 6.2-3.6m-12.7 10v7.7m-6.5-11.3-6.2 3.6" /></svg>;
}

function LogoMark({ compact = false }: { compact?: boolean }) {
  return <div className={`brand-lockup${compact ? " brand-lockup-compact" : ""}`}><span className="brand-icon"><LogoGlyph /></span><span className="brand-wordmark"><strong>MECHANICAL</strong><em>FRONTIER</em><small>AN INDEPENDENT FIELD GUIDE</small></span></div>;
}
