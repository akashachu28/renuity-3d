import { useEffect, useMemo, useRef, useState } from "react";
import {
  Armchair,
  ArrowLeft,
  Bath,
  Box,
  ChevronDown,
  CircleHelp,
  DoorClosed,
  DoorOpen,
  GripHorizontal,
  Grid3x3,
  Layers,
  LayoutGrid,
  Maximize2,
  Minus,
  MousePointer2,
  MoveDiagonal,
  Package,
  Rotate3D,
  RotateCcw,
  RotateCw,
  ShowerHead,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

type AssetId =
  | "alcoveTub"
  | "freeTub"
  | "rainShower"
  | "handShower"
  | "showerShelf"
  | "clearDoor"
  | "frostedDoor"
  | "showerRod"
  | "grabHorizontal"
  | "grabAngled";

type Category = "Bathtubs" | "Fixtures" | "Rods" | "Grab bars" | "Accessories" | "Shower doors" | "Wall tiles";
type Mount = "floor" | "wall";

type PlacedAsset = {
  uid: number;
  type: AssetId;
  x: number;
  z: number;
  rotation: number;
  /** Height offset above the default mount height (wall items can slide up and down). */
  y: number;
  /** Optional paint colour (tubs) or finish (fixtures). */
  color?: number;
};

type AssetDefinition = {
  id: AssetId;
  name: string;
  detail: string;
  icon: typeof Bath;
  tone: string;
  category: Category;
  /** floor items can be dragged anywhere; wall items snap to the nearest wall */
  mount: Mount;
  /** where the first copy appears (wall items snap to the closest wall) */
  home: [number, number];
  homeRotation?: number;
  /** Half of the item's width along the wall; keeps wall items inside their wall segment. */
  halfWidth?: number;
};

// The alcove is sized around the built-in tub so it fits wall-to-wall.
// Change these three numbers to resize both together.
const TUB_LENGTH = 4.8;
const TUB_DEPTH = 2.8;
const TUB_HEIGHT = 1.1;

const categories: Category[] = ["Bathtubs", "Fixtures", "Rods", "Grab bars", "Accessories", "Shower doors", "Wall tiles"];

const assets: AssetDefinition[] = [
  {
    id: "alcoveTub",
    name: "Alcove bathtub",
    detail: "Built-in · wall to wall",
    icon: Bath,
    tone: "sand",
    category: "Bathtubs",
    mount: "floor",
    home: [0, -5 - TUB_DEPTH + 0.01 + (TUB_DEPTH - 0.02) / 2],
  },
  {
    id: "freeTub",
    name: "Freestanding tub",
    detail: "310 × 110 cm",
    icon: Bath,
    tone: "clay",
    category: "Bathtubs",
    mount: "floor",
    home: [-1.6, -0.9],
  },
  {
    id: "rainShower",
    name: "Rain shower set",
    detail: "Ø 30 cm head",
    icon: ShowerHead,
    tone: "olive",
    category: "Fixtures",
    mount: "wall",
    home: [1.2, -7.4],
    halfWidth: 0.5,
  },
  {
    id: "handShower",
    name: "Handheld shower",
    detail: "Slide bar · 80 cm",
    icon: ShowerHead,
    tone: "sand",
    category: "Fixtures",
    mount: "wall",
    home: [-2.4, -6.1],
    halfWidth: 0.55,
  },
  {
    id: "showerShelf",
    name: "Shower shelf",
    detail: "Wall shelf · 60 cm",
    icon: Package,
    tone: "clay",
    category: "Accessories",
    mount: "wall",
    home: [1.5, -7.4],
    halfWidth: 0.65,
  },
  {
    id: "clearDoor",
    name: "Clear glass door",
    detail: "Fully transparent · sliding",
    icon: DoorClosed,
    tone: "sand",
    category: "Shower doors",
    mount: "floor",
    home: [0, -5.12],
  },
  {
    id: "frostedDoor",
    name: "Frosted glass door",
    detail: "Semi-transparent · sliding",
    icon: DoorOpen,
    tone: "olive",
    category: "Shower doors",
    mount: "floor",
    home: [0, -5.12],
  },
  {
    id: "showerRod",
    name: "Shower curtain rod",
    detail: "Ø 25 mm · 225 cm",
    icon: Minus,
    tone: "walnut",
    category: "Rods",
    mount: "wall",
    home: [0, -7.4],
    halfWidth: 1.45,
  },
  {
    id: "grabHorizontal",
    name: "Horizontal grab bar",
    detail: "60 cm",
    icon: GripHorizontal,
    tone: "olive",
    category: "Grab bars",
    mount: "wall",
    home: [0, -7.4],
    halfWidth: 0.65,
  },
  {
    id: "grabAngled",
    name: "Angled grab bar",
    detail: "50 cm · 35°",
    icon: MoveDiagonal,
    tone: "green",
    category: "Grab bars",
    mount: "wall",
    home: [2.4, -6.2],
    halfWidth: 0.4,
  },
];

const assetById = Object.fromEntries(assets.map((asset) => [asset.id, asset])) as Record<AssetId, AssetDefinition>;

const palette = {
  cream: 0xf3f0ea,
  wall: 0xe8dcc2,
  trim: 0xf0e6d0,
  base: 0xd9ccb2,
  porcelain: 0xf8f7f3,
  basin: 0xeeede8,
  chrome: 0xdde1e4,
  steel: 0xc2c7cb,
  dark: 0x8d949a,
  sage: 0x9ba58f,
  sageDark: 0x87927b,
};

// Room is 12 × 10 units centred on the origin. The back wall (z = -5) has a recessed alcove
// (x from -3 to 3, 0.9 deep) like the reference; the left wall is at x = -6.
const ROOM_LIMIT_X = 5.3;
const ROOM_LIMIT_Z = 4.3;
const ALCOVE_HALF_WIDTH = TUB_LENGTH / 2;
const ALCOVE_DEPTH = TUB_DEPTH;
const ALCOVE_HEIGHT = 4.7;
const BACK_WALL_Z = -4.995;
const ALCOVE_BACK_Z = -5 - ALCOVE_DEPTH + 0.01; // -7.39
const LEFT_WALL_X = -5.995;

const CAMERA_START = new THREE.Vector3(7.4, 6.2, 10.6);
const TARGET_START = new THREE.Vector3(0, 1.6, -2.2);

const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

/** Keep floor items inside the room; allow big pieces (tubs) to slide into the alcove. */
function clampFloor(x: number, z: number) {
  const cx = clamp(x, ROOM_LIMIT_X);
  const minZ = Math.abs(cx) <= ALCOVE_HALF_WIDTH - 1.2 ? ALCOVE_BACK_Z + 0.65 : -ROOM_LIMIT_Z;
  return { x: cx, z: Math.max(minZ, Math.min(ROOM_LIMIT_Z, z)) };
}

const clampRange = (value: number, lo: number, hi: number) =>
  lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, value));

/**
 * Snap a wall-mounted item to the closest wall surface. Candidate walls:
 * the alcove back, both alcove side walls, the two narrow strips of back wall either side of the
 * alcove opening, and the room's left wall.
 */
function snapToWall(x: number, z: number, halfWidth = 0.4) {
  const H = ALCOVE_HALF_WIDTH;
  const inner = H - halfWidth - 0.1;
  const sideLo = ALCOVE_BACK_Z + halfWidth + 0.05;
  const sideHi = BACK_WALL_Z - 0.1 - halfWidth;
  const stripLo = H + 0.1 + halfWidth;
  const stripHi = ROOM_LIMIT_X + 0.6 - halfWidth;

  const candidates = [
    { x: clampRange(x, -inner, inner), z: ALCOVE_BACK_Z, rotation: 0, alcove: true },
    { x: -H + 0.005, z: clampRange(z, sideLo, sideHi), rotation: Math.PI / 2, alcove: true },
    { x: H - 0.005, z: clampRange(z, sideLo, sideHi), rotation: -Math.PI / 2, alcove: true },
    {
      x: x < 0 ? -clampRange(-x, stripLo, stripHi) : clampRange(x, stripLo, stripHi),
      z: BACK_WALL_Z,
      rotation: 0,
      alcove: false,
    },
    { x: LEFT_WALL_X, z: clampRange(z, -ROOM_LIMIT_Z, ROOM_LIMIT_Z), rotation: Math.PI / 2, alcove: false },
  ];

  let best = candidates[0];
  let bestDistance = Infinity;
  candidates.forEach((candidate) => {
    const distance = Math.hypot(candidate.x - x, candidate.z - z);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  });
  return best;
}

// ---------------------------------------------------------------------------------------------
// Procedural textures (no image files needed)
// ---------------------------------------------------------------------------------------------

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paintTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

/** Warm greige woven wall covering (left wall in the reference). */
function createGrasscloth() {
  return paintTexture(512, 512, (ctx, w, h) => {
    const rand = rng(21);
    ctx.fillStyle = "#cdbba4";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i += 1) {
      const x = rand() * w;
      const y = rand() * h;
      const length = 8 + rand() * 50;
      const light = rand() < 0.5;
      ctx.strokeStyle = light
        ? `rgba(255,248,235,${0.05 + rand() * 0.09})`
        : `rgba(110,90,70,${0.04 + rand() * 0.08})`;
      ctx.lineWidth = 1 + rand() * 1.4;
      [0, -w].forEach((dx) => {
        ctx.beginPath();
        ctx.moveTo(x + dx, y);
        ctx.lineTo(x + dx + length, y + (rand() - 0.5) * 1.2);
        ctx.stroke();
      });
    }
    for (let i = 0; i < 40; i += 1) {
      ctx.fillStyle = `rgba(120,95,70,${0.012 + rand() * 0.02})`;
      ctx.fillRect(rand() * w, 0, 2 + rand() * 9, h);
    }
  });
}

/** Pale veined stone panel for the back of the alcove. */
function createMarble() {
  return paintTexture(1024, 832, (ctx, w, h) => {
    const rand = rng(7);
    ctx.fillStyle = "#ebe0c9";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i += 1) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 90 + rand() * 240;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, rand() < 0.5 ? "rgba(205,192,172,0.14)" : "rgba(255,255,255,0.05)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.lineCap = "round";
    for (let i = 0; i < 16; i += 1) {
      let x = rand() * w;
      let y = rand() * h * 0.3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const steps = 20 + Math.floor(rand() * 25);
      for (let s = 0; s < steps; s += 1) {
        x += (rand() - 0.5) * 40;
        y += 10 + rand() * 28;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(150,138,122,${0.12 + rand() * 0.2})`;
      ctx.lineWidth = 0.6 + rand() * 1.6;
      ctx.stroke();
    }
    for (let i = 0; i < 500; i += 1) {
      const x = rand() * w;
      const y = rand() * h;
      ctx.strokeStyle = rand() < 0.5 ? "rgba(255,255,255,0.18)" : "rgba(160,148,132,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * 4, y + 6 + rand() * 30);
      ctx.stroke();
    }
  });
}

/** Glossy sage-green wall tile (right side of the reference). 4 columns × 8 rows. */
function createGreenTile() {
  return paintTexture(256, 512, (ctx, w, h) => {
    const rand = rng(3);
    ctx.fillStyle = "#c9d4c4";
    ctx.fillRect(0, 0, w, h);
    const cell = 64;
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const shade = Math.round(rand() * 14 - 7);
        ctx.fillStyle = `rgb(${138 + shade},${164 + shade},${139 + shade})`;
        ctx.fillRect(col * cell + 2, row * cell + 2, cell - 4, cell - 4);
        const gradient = ctx.createLinearGradient(col * cell, row * cell, col * cell + cell, row * cell + cell);
        gradient.addColorStop(0, "rgba(255,255,255,0.05)");
        gradient.addColorStop(1, "rgba(0,0,0,0.08)");
        ctx.fillStyle = gradient;
        ctx.fillRect(col * cell + 2, row * cell + 2, cell - 4, cell - 4);
      }
    }
  });
}

/** Large pale floor tile with fine grout lines. */
function createFloorTile() {
  return paintTexture(256, 256, (ctx, w, h) => {
    const rand = rng(11);
    ctx.fillStyle = "#ddd7cc";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i += 1) {
      ctx.fillStyle = rand() < 0.5 ? "rgba(255,255,255,0.12)" : "rgba(150,138,120,0.07)";
      ctx.fillRect(rand() * w, rand() * h, 2, 2);
    }
    ctx.strokeStyle = "#c6bfb2";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, w, h);
  });
}

/** Warm white subway tile in a running bond. One repeat = 2 × 4 tiles. */
function createSubwayTile() {
  return paintTexture(512, 512, (ctx, w, h) => {
    const rand = rng(5);
    ctx.fillStyle = "#cfc6b3";
    ctx.fillRect(0, 0, w, h);
    const tw = 256;
    const th = 128;
    const g = 3;
    for (let row = 0; row < 4; row += 1) {
      const offset = row % 2 ? -tw / 2 : 0;
      for (let col = 0; col < 3; col += 1) {
        const x = offset + col * tw;
        const y = row * th;
        const shade = Math.round(rand() * 8 - 4);
        ctx.fillStyle = `rgb(${244 + shade},${238 + shade},${224 + shade})`;
        ctx.fillRect(x + g, y + g, tw - 2 * g, th - 2 * g);
        const gloss = ctx.createLinearGradient(0, y, 0, y + th);
        gloss.addColorStop(0, "rgba(255,255,255,0.35)");
        gloss.addColorStop(0.5, "rgba(255,255,255,0)");
        gloss.addColorStop(1, "rgba(0,0,0,0.08)");
        ctx.fillStyle = gloss;
        ctx.fillRect(x + g, y + g, tw - 2 * g, th - 2 * g);
      }
    }
  });
}

/** Hand-glazed sage square tile (zellige look). One repeat = 4 × 4 tiles. */
function createZelligeTile() {
  return paintTexture(512, 512, (ctx, w) => {
    const rand = rng(9);
    ctx.fillStyle = "#aebba6";
    ctx.fillRect(0, 0, w, w);
    const n = 4;
    const cell = w / n;
    for (let row = 0; row < n; row += 1) {
      for (let col = 0; col < n; col += 1) {
        const shift = Math.round(rand() * 18 - 9);
        const inset = 3 + rand() * 3;
        const x = col * cell + inset;
        const y = row * cell + inset;
        const size = cell - inset * 2;
        ctx.fillStyle = `rgb(${132 + shift},${160 + shift},${134 + shift})`;
        ctx.fillRect(x, y, size, size);
        const cx = x + size * (0.25 + rand() * 0.5);
        const cy = y + size * (0.25 + rand() * 0.5);
        const glaze = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.8);
        glaze.addColorStop(0, "rgba(255,255,255,0.32)");
        glaze.addColorStop(1, "rgba(0,0,0,0.1)");
        ctx.fillStyle = glaze;
        ctx.fillRect(x, y, size, size);
      }
    }
  });
}

/** Large-format charcoal slate slab with pale veins. One repeat = one slab. */
function createSlateTile() {
  return paintTexture(512, 1024, (ctx, w, h) => {
    const rand = rng(13);
    ctx.fillStyle = "#4b4e51";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i += 1) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 60 + rand() * 200;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, rand() < 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.14)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.lineCap = "round";
    for (let i = 0; i < 12; i += 1) {
      let x = rand() * w;
      let y = rand() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const steps = 12 + Math.floor(rand() * 16);
      for (let k = 0; k < steps; k += 1) {
        x += (rand() - 0.5) * 50;
        y += (rand() - 0.5) * 50;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(190,195,200,${0.15 + rand() * 0.2})`;
      ctx.lineWidth = 0.6 + rand() * 1.4;
      ctx.stroke();
    }
    for (let i = 0; i < 900; i += 1) {
      ctx.fillStyle = rand() < 0.5 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.1)";
      ctx.fillRect(rand() * w, rand() * h, 2, 2);
    }
    ctx.strokeStyle = "#26282a";
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, w, h);
  });
}

type WallTileDesign = {
  id: string;
  name: string;
  detail: string;
  icon: typeof Bath;
  /** CSS background for the library card. */
  preview: string;
  iconColor: string;
  create: () => THREE.CanvasTexture;
  /** World size (units) covered by one texture repeat. */
  world: [number, number];
  roughness: number;
};

const wallTiles: WallTileDesign[] = [
  {
    id: "subway",
    name: "Subway tile",
    detail: "Warm white · running bond",
    icon: Grid3x3,
    preview: "repeating-linear-gradient(0deg, #f4efe3 0 17px, #cfc6b3 17px 20px)",
    iconColor: "#8a7f68",
    create: createSubwayTile,
    world: [1, 1],
    roughness: 0.18,
  },
  {
    id: "zellige",
    name: "Sage zellige",
    detail: "Glazed square tile",
    icon: LayoutGrid,
    preview: "linear-gradient(135deg, #9db39c, #7f9a80)",
    iconColor: "#e9f0e4",
    create: createZelligeTile,
    world: [1.6, 1.6],
    roughness: 0.22,
  },
  {
    id: "slate",
    name: "Charcoal slate",
    detail: "Large-format slab",
    icon: Layers,
    preview: "linear-gradient(160deg, #5a5d60, #3d4043)",
    iconColor: "#d6dadd",
    create: createSlateTile,
    world: [1.2, 2.4],
    roughness: 0.6,
  },
];

// ---------------------------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------------------------

function material(color: number, roughness = 0.82, metalness = 0.04) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function metalMaterial(color: number) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.85 });
}

function box(
  width: number,
  height: number,
  depth: number,
  color: number,
  x: number,
  y: number,
  z: number,
  radius = 0,
) {
  const geometry = radius
    ? new THREE.BoxGeometry(width, height, depth, 3, 3, 3)
    : new THREE.BoxGeometry(width, height, depth);
  if (radius) {
    const position = geometry.attributes.position;
    const vector = new THREE.Vector3();
    for (let i = 0; i < position.count; i += 1) {
      vector.fromBufferAttribute(position, i);
      const ox = Math.max(0, Math.abs(vector.x) - width / 2 + radius);
      const oy = Math.max(0, Math.abs(vector.y) - height / 2 + radius);
      const oz = Math.max(0, Math.abs(vector.z) - depth / 2 + radius);
      const distance = Math.sqrt(ox * ox + oy * oy + oz * oz);
      if (distance > 0) {
        const scale = radius / distance;
        vector.set(
          Math.sign(vector.x) * (width / 2 - radius + ox * scale),
          Math.sign(vector.y) * (height / 2 - radius + oy * scale),
          Math.sign(vector.z) * (depth / 2 - radius + oz * scale),
        );
        position.setXYZ(i, vector.x, vector.y, vector.z);
      }
    }
    geometry.computeVertexNormals();
  }
  const mesh = new THREE.Mesh(geometry, material(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Metal cylinder lying along the given axis. */
function tube(
  radius: number,
  length: number,
  axis: "x" | "y" | "z",
  x: number,
  y: number,
  z: number,
  color: number = palette.chrome,
) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 24), metalMaterial(color));
  if (axis === "x") mesh.rotation.z = Math.PI / 2;
  if (axis === "z") mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.finish = color === palette.chrome;
  return mesh;
}

function ball(radius: number, x: number, y: number, z: number, color: number = palette.chrome) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 14), metalMaterial(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.userData.finish = color === palette.chrome;
  return mesh;
}

/** Round wall plate; wall items have their origin on the wall surface and extend toward +z. */
function flange(x: number, y: number, radius: number, color: number = palette.chrome) {
  return tube(radius, 0.04, "z", x, y, 0.02, color);
}

/** Invisible box that makes thin items easy to click and drag. */
function hitBox(width: number, height: number, depth: number, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  mesh.position.set(x, y, z);
  return mesh;
}

function metalBox(
  width: number,
  height: number,
  depth: number,
  color: number,
  x: number,
  y: number,
  z: number,
  radius = 0,
) {
  const mesh = box(width, height, depth, color, x, y, z, radius);
  mesh.material = metalMaterial(color);
  mesh.userData.finish = color === palette.chrome;
  return mesh;
}

/** Cylinder that tapers from rTop (at +y / +z) to rBottom. */
function taperTube(
  rTop: number,
  rBottom: number,
  length: number,
  axis: "y" | "z",
  x: number,
  y: number,
  z: number,
  color: number = palette.chrome,
) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, length, 24), metalMaterial(color));
  if (axis === "z") mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.userData.finish = color === palette.chrome;
  return mesh;
}

/** Small spray nozzles arranged in rings on a shower face. */
function addNozzles(
  group: THREE.Group,
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  facing: "down" | "front",
) {
  const geometry = new THREE.CylinderGeometry(0.014, 0.014, 0.012, 10);
  const mat = metalMaterial(palette.chrome);
  const rings: [number, number][] = [
    [0, 1],
    [0.3, 6],
    [0.58, 12],
    [0.86, 18],
  ];
  rings.forEach(([r, count]) => {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      const dx = Math.cos(angle) * r * radius;
      const dy = Math.sin(angle) * r * radius;
      const nozzle = new THREE.Mesh(geometry, mat);
      nozzle.userData.finish = true;
      if (facing === "down") {
        nozzle.position.set(cx + dx, cy, cz + dy);
      } else {
        nozzle.rotation.x = Math.PI / 2;
        nozzle.position.set(cx + dx, cy + dy, cz);
      }
      group.add(nozzle);
    }
  });
}

/** Fine speckle used to give frosted glass its milky, diffused look. */
function createFrostTexture() {
  const texture = paintTexture(256, 256, (ctx, w, h) => {
    const rand = rng(31);
    ctx.fillStyle = "#eef3f3";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i += 1) {
      ctx.fillStyle = rand() < 0.5 ? "rgba(255,255,255,0.35)" : "rgba(150,170,172,0.14)";
      ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2);
    }
  });
  texture.repeat.set(4, 2);
  return texture;
}

/** Sliding shower door that sits on the tub rim: one fixed panel plus one sliding panel. */
function buildShowerDoor(group: THREE.Group, frosted: boolean) {
  const width = 4.72;
  const bottom = 1.12;
  const top = 4.3;
  const height = top - bottom;

  const frostMap = frosted ? createFrostTexture() : null;

  const makeGlass = () =>
    frosted
      ? new THREE.MeshStandardMaterial({
          color: 0xeaf1f2,
          map: frostMap,
          roughness: 0.92,
          metalness: 0,
          transparent: true,
          opacity: 0.68,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      : new THREE.MeshStandardMaterial({
          color: 0xcfe9ee,
          roughness: 0.04,
          metalness: 0.1,
          transparent: true,
          opacity: 0.16,
          side: THREE.DoubleSide,
          depthWrite: false,
        });

  const panel = (panelWidth: number, x: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(panelWidth, height, 0.05), makeGlass());
    mesh.position.set(x, bottom + height / 2, z);
    mesh.userData.glass = true;
    mesh.renderOrder = 2;
    return mesh;
  };

  // Fixed panel against the left wall and a sliding panel in front of it.
  group.add(panel(2.2, -1.26, 0));
  group.add(panel(2.6, 1.06, 0.07));

  // Top rail and bottom track.
  group.add(metalBox(width, 0.08, 0.14, palette.chrome, 0, top + 0.04, 0.035, 0.015));
  group.add(metalBox(width, 0.06, 0.16, palette.chrome, 0, bottom - 0.03, 0.035, 0.015));

  // Wall clamps for the fixed panel.
  [1.7, 2.7, 3.7].forEach((y) => {
    group.add(metalBox(0.05, 0.16, 0.16, palette.chrome, -2.385, y, 0, 0.01));
  });

  // Roller hangers on the sliding panel.
  [0.1, 1.9].forEach((x) => {
    group.add(metalBox(0.05, 0.2, 0.04, palette.chrome, x, top - 0.1, 0.1, 0.008));
    group.add(tube(0.05, 0.03, "z", x, top - 0.02, 0.13));
  });

  // Vertical handle on the leading edge of the sliding panel.
  group.add(tube(0.025, 1.0, "y", -0.12, 2.7, 0.19));
  [2.3, 3.1].forEach((y) => {
    group.add(tube(0.015, 0.14, "z", -0.12, y, 0.12));
  });
}

function createAsset(type: AssetId) {
  const group = new THREE.Group();

  switch (type) {
    case "alcoveTub": {
      // Built-in tub sized to sit snugly in the alcove (slightly inset to avoid z-fighting).
      const L = TUB_LENGTH - 0.04;
      const D = TUB_DEPTH - 0.02;
      const H = TUB_HEIGHT;
      const t = 0.22;
      const floorH = 0.3;
      group.add(paint(box(L, H, t, palette.porcelain, 0, H / 2, D / 2 - t / 2, 0.05), "body"));
      group.add(paint(box(L, H, t, palette.porcelain, 0, H / 2, -D / 2 + t / 2, 0.05), "body"));
      group.add(paint(box(t, H, D - 2 * t, palette.porcelain, -L / 2 + t / 2, H / 2, 0, 0.05), "body"));
      group.add(paint(box(t, H, D - 2 * t, palette.porcelain, L / 2 - t / 2, H / 2, 0, 0.05), "body"));
      group.add(paint(box(L - 2 * t, floorH, D - 2 * t, palette.basin, 0, floorH / 2, 0), "basin"));
      group.add(tube(0.09, 0.02, "y", -L / 2 + 0.9, floorH + 0.005, 0));
      group.add(tube(0.1, 0.02, "x", -L / 2 + t + 0.01, H - 0.2, 0));
      break;
    }

    case "freeTub": {
      const shellMaterial = new THREE.MeshStandardMaterial({
        color: palette.porcelain,
        roughness: 0.35,
        metalness: 0.04,
        side: THREE.DoubleSide,
      });
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.4, 0.74, 48, 1, true), shellMaterial);
      shell.scale.x = 2.6;
      shell.userData.paint = "body";
      shell.position.y = 0.45;
      shell.castShadow = true;
      shell.receiveShadow = true;
      group.add(shell);

      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.04, 14, 64), material(palette.porcelain, 0.35));
      rim.rotation.x = Math.PI / 2;
      rim.scale.x = 2.6;
      rim.userData.paint = "body";
      rim.position.y = 0.82;
      rim.castShadow = true;
      group.add(rim);

      const basin = new THREE.Mesh(
        new THREE.CircleGeometry(0.43, 40),
        new THREE.MeshStandardMaterial({ color: palette.basin, roughness: 0.5, side: THREE.DoubleSide }),
      );
      basin.rotation.x = -Math.PI / 2;
      basin.scale.x = 2.6;
      basin.userData.paint = "basin";
      basin.position.y = 0.2;
      basin.receiveShadow = true;
      group.add(basin);

      group.add(tube(0.05, 0.01, "y", -1.15, 0.205, 0));
      [-1.0, 1.0].forEach((x) => {
        [-0.22, 0.22].forEach((z) => group.add(tube(0.05, 0.1, "y", x, 0.05, z)));
      });
      group.scale.setScalar(1.4);
      break;
    }

    case "rainShower": {
      // Thermostatic valve plate with two dials and a diverter.
      group.add(metalBox(0.8, 0.44, 0.05, palette.chrome, 0, 2.5, 0.025, 0.02));
      [-0.2, 0.2].forEach((x) => {
        group.add(tube(0.12, 0.07, "z", x, 2.5, 0.085));
        group.add(tube(0.08, 0.09, "z", x, 2.5, 0.1, palette.dark));
        group.add(metalBox(0.022, 0.07, 0.012, palette.chrome, x, 2.5 + 0.045, 0.15, 0.004));
      });
      group.add(ball(0.045, 0, 2.5, 0.1));

      // Riser with collars and a wall clamp.
      group.add(tube(0.035, 1.58, "y", 0, 3.51, 0.07));
      group.add(tube(0.055, 0.06, "y", 0, 2.8, 0.07));
      group.add(flange(0, 3.5, 0.075));
      group.add(tube(0.05, 0.07, "y", 0, 3.5, 0.07));

      // Elbow, arm and a wide rain head with nozzles.
      group.add(ball(0.06, 0, 4.3, 0.07));
      group.add(tube(0.04, 0.9, "z", 0, 4.3, 0.52));
      group.add(tube(0.055, 0.08, "z", 0, 4.3, 0.13));
      group.add(ball(0.05, 0, 4.3, 0.97));
      group.add(tube(0.035, 0.12, "y", 0, 4.24, 0.97));
      group.add(tube(0.48, 0.03, "y", 0, 4.19, 0.97));
      group.add(tube(0.46, 0.06, "y", 0, 4.145, 0.97));
      group.add(tube(0.42, 0.015, "y", 0, 4.11, 0.97, palette.dark));
      addNozzles(group, 0, 4.1, 0.97, 0.38, "down");

      group.add(hitBox(1.0, 0.3, 1.0, 0, 4.15, 0.97));
      group.add(hitBox(0.9, 0.55, 0.35, 0, 2.5, 0.12));
      group.add(hitBox(0.25, 1.7, 0.3, 0, 3.5, 0.07));
      group.add(hitBox(0.2, 0.2, 0.9, 0, 4.3, 0.52));
      break;
    }

    case "handShower": {
      // Slide rail with end caps and plate brackets.
      group.add(tube(0.022, 1.6, "y", 0, 2.9, 0.09));
      group.add(ball(0.03, 0, 2.1, 0.09));
      group.add(ball(0.03, 0, 3.7, 0.09));
      [2.25, 3.55].forEach((y) => {
        group.add(metalBox(0.12, 0.1, 0.02, palette.chrome, 0, y, 0.01, 0.01));
        group.add(tube(0.02, 0.08, "z", 0, y, 0.05));
      });

      // Sliding holder, contoured handle and round spray face.
      group.add(metalBox(0.1, 0.16, 0.09, palette.chrome, 0, 3.1, 0.15, 0.02));
      group.add(taperTube(0.05, 0.03, 0.62, "y", 0, 3.15, 0.25));
      group.add(tube(0.056, 0.05, "y", 0, 3.12, 0.25, palette.dark));
      group.add(ball(0.07, 0, 3.5, 0.26));
      group.add(tube(0.17, 0.05, "z", 0, 3.62, 0.3));
      group.add(tube(0.14, 0.012, "z", 0, 3.62, 0.33, palette.dark));
      addNozzles(group, 0, 3.62, 0.342, 0.12, "front");

      // Wall outlet with a dome cover and a looping hose.
      group.add(flange(0, 1.6, 0.1));
      group.add(taperTube(0.05, 0.08, 0.08, "z", 0, 1.6, 0.07));
      group.add(ball(0.045, 0, 1.6, 0.13));
      group.add(ball(0.04, 0, 2.85, 0.25));
      const hose = new THREE.Mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 1.6, 0.14),
            new THREE.Vector3(0.15, 1.5, 0.35),
            new THREE.Vector3(0.45, 1.9, 0.45),
            new THREE.Vector3(0.35, 2.4, 0.4),
            new THREE.Vector3(0.1, 2.75, 0.3),
            new THREE.Vector3(0, 2.85, 0.25),
          ]),
          48,
          0.024,
          8,
        ),
        metalMaterial(palette.steel),
      );
      hose.castShadow = true;
      group.add(hose);

      group.add(hitBox(0.9, 2.6, 0.7, 0.2, 2.45, 0.3));
      break;
    }

    case "showerShelf": {
      // Metal shelf on two brackets holding three bottles.
      group.add(box(1.2, 0.05, 0.34, palette.steel, 0, 2.0, 0.17, 0.012));
      [-0.5, 0.5].forEach((x) => {
        group.add(box(0.04, 0.2, 0.3, palette.steel, x, 1.89, 0.15, 0.01));
      });
      group.add(box(1.2, 0.08, 0.03, palette.steel, 0, 2.03, 0.335, 0.01));
      [
        { x: -0.35, r: 0.09, h: 0.5, color: palette.sage },
        { x: 0, r: 0.08, h: 0.4, color: 0xf1e4c3 },
        { x: 0.35, r: 0.09, h: 0.45, color: 0xc7795c },
      ].forEach(({ x, r, h, color }) => {
        const bottle = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), material(color, 0.5));
        bottle.position.set(x, 2.025 + h / 2, 0.16);
        bottle.castShadow = true;
        group.add(bottle);
        group.add(tube(r * 0.45, 0.07, "y", x, 2.025 + h + 0.035, 0.16));
      });
      group.add(hitBox(1.3, 0.8, 0.45, 0, 2.3, 0.2));
      break;
    }

    case "clearDoor": {
      buildShowerDoor(group, false);
      break;
    }

    case "frostedDoor": {
      buildShowerDoor(group, true);
      break;
    }

    case "showerRod": {
      group.add(tube(0.035, 2.8, "x", 0, 3.6, 0.28));
      [-1.4, 1.4].forEach((x) => {
        group.add(tube(0.03, 0.28, "z", x, 3.6, 0.14));
        group.add(flange(x, 3.6, 0.1));
        group.add(ball(0.04, x, 3.6, 0.28));
      });
      for (let i = 0; i < 9; i += 1) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.014, 8, 24), metalMaterial(palette.chrome));
        ring.rotation.y = Math.PI / 2;
        ring.position.set(-1.1 + i * 0.275, 3.6, 0.28);
        ring.castShadow = true;
        group.add(ring);
      }
      group.add(hitBox(2.9, 0.3, 0.45, 0, 3.6, 0.2));
      break;
    }

    case "grabHorizontal": {
      group.add(tube(0.045, 1.2, "x", 0, 1.5, 0.3));
      [-0.5, 0.5].forEach((x) => {
        group.add(tube(0.035, 0.3, "z", x, 1.5, 0.15));
        group.add(flange(x, 1.5, 0.1));
      });
      group.add(ball(0.045, -0.6, 1.5, 0.3));
      group.add(ball(0.045, 0.6, 1.5, 0.3));
      group.add(hitBox(1.3, 0.35, 0.45, 0, 1.5, 0.22));
      break;
    }

    case "grabAngled": {
      const angle = 0.6; // ≈ 35° from vertical
      const half = 0.55;
      const bar = tube(0.045, half * 2, "y", 0, 1.7, 0.3);
      bar.rotation.z = -angle;
      group.add(bar);
      [-0.8, 0.8].forEach((t) => {
        const px = Math.sin(angle) * half * t;
        const py = 1.7 + Math.cos(angle) * half * t;
        group.add(tube(0.035, 0.3, "z", px, py, 0.15));
        group.add(flange(px, py, 0.1));
      });
      group.add(ball(0.045, Math.sin(angle) * half, 1.7 + Math.cos(angle) * half, 0.3));
      group.add(ball(0.045, -Math.sin(angle) * half, 1.7 - Math.cos(angle) * half, 0.3));
      group.add(hitBox(0.9, 1.3, 0.45, 0, 1.7, 0.22));
      break;
    }
  }

  return group;
}

const tubColors = [
  { id: "white", name: "White", hex: 0xf8f7f3 },
  { id: "cream", name: "Cream", hex: 0xf1e4c3 },
  { id: "gray", name: "Gray", hex: 0x9ea3a8 },
  { id: "sandbar", name: "Sandbar", hex: 0xcdb48c },
];

const toCss = (hex: number) => `#${hex.toString(16).padStart(6, "0")}`;

/** Tag a mesh as a paintable tub surface. */
function paint<T extends THREE.Mesh>(mesh: T, kind: "body" | "basin") {
  mesh.userData.paint = kind;
  return mesh;
}

/** Recolour every paintable surface of a tub (the inner basin is a touch darker). */
function applyTubColor(object: THREE.Object3D, color: number) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh && child.userData.paint) {
      const mat = child.material as THREE.MeshStandardMaterial;
      mat.color.setHex(color);
      if (child.userData.paint === "basin") mat.color.multiplyScalar(0.96);
    }
  });
}

const fixtureFinishes = [
  { id: "chrome", name: "Steel / Chrome", hex: 0xdde1e4, roughness: 0.28, metalness: 0.85 },
  { id: "gold", name: "Gold", hex: 0xd4a937, roughness: 0.25, metalness: 0.9 },
  { id: "black", name: "Black", hex: 0x1f2124, roughness: 0.42, metalness: 0.55 },
  { id: "bronze", name: "Bronze", hex: 0x8a5a32, roughness: 0.34, metalness: 0.8 },
];

/** Re-finish every metal part of a fixture (parts tagged as `finish`). */
function applyFinish(object: THREE.Object3D, finish: (typeof fixtureFinishes)[number]) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh && child.userData.finish) {
      const mat = child.material as THREE.MeshStandardMaterial;
      mat.color.setHex(finish.hex);
      mat.roughness = finish.roughness;
      mat.metalness = finish.metalness;
    }
  });
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((item) => {
        (item as THREE.MeshStandardMaterial).map?.dispose();
        item.dispose();
      });
    }
  });
}

type RoomCanvasProps = {
  items: PlacedAsset[];
  selectedUid: number | null;
  onSelect: (uid: number | null) => void;
  onMove: (uid: number, x: number, z: number, rotation?: number, y?: number) => void;
  onRotate: (uid: number, rotation: number) => void;
  onReady: (reset: () => void) => void;
  wallTile: string | null;
};

function RoomCanvas({ items, selectedUid, onSelect, onMove, onRotate, onReady, wallTile }: RoomCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const assetGroupRef = useRef<THREE.Group | null>(null);
  const objectsRef = useRef<Map<number, THREE.Group>>(new Map());
  const selectedRef = useRef<number | null>(selectedUid);
  const tilePlanesRef = useRef<{ mesh: THREE.Mesh; width: number; height: number }[]>([]);
  const marbleRef = useRef<THREE.Mesh | null>(null);
  const tileTexturesRef = useRef<THREE.Texture[]>([]);

  // Keep the latest callbacks without re-creating the scene.
  const onSelectRef = useRef(onSelect);
  const onMoveRef = useRef(onMove);
  const onRotateRef = useRef(onRotate);
  onSelectRef.current = onSelect;
  onMoveRef.current = onMove;
  onRotateRef.current = onRotate;
  selectedRef.current = selectedUid;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(palette.cream);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.copy(CAMERA_START);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.appendChild(renderer.domElement);

    // Soft studio reflections so chrome and porcelain read properly.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    Object.assign(scene, { environmentIntensity: 0.35 });

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.target.copy(TARGET_START);
    controls.minDistance = 4;
    controls.maxDistance = 18;
    controls.maxPolarAngle = Math.PI / 2.02;
    controls.update();

    const reset = () => {
      camera.position.copy(CAMERA_START);
      controls.target.copy(TARGET_START);
      controls.update();
    };
    onReady(reset);

    // ---------- Lighting ----------
    scene.add(new THREE.HemisphereLight(0xfffbf2, 0x6f7868, 2.2));
    const sun = new THREE.DirectionalLight(0xfff3dc, 3.2);
    sun.position.set(3, 7, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -9;
    sun.shadow.camera.right = 9;
    sun.shadow.camera.top = 9;
    sun.shadow.camera.bottom = -9;
    scene.add(sun);

    // Recessed ceiling lights inside the alcove washing the stone panel.
    const downlightXs = [-ALCOVE_HALF_WIDTH * 0.5, 0, ALCOVE_HALF_WIDTH * 0.5];
    downlightXs.forEach((lx) => {
      const downlight = new THREE.SpotLight(0xfff1d6, 6, 10, Math.PI / 3, 1, 2);
      downlight.position.set(lx, ALCOVE_HEIGHT - 0.08, -6.3);
      downlight.target.position.set(lx, 1.4, ALCOVE_BACK_Z);
      scene.add(downlight, downlight.target);
    });

    // ---------- Floor ----------
    const floorTexture = createFloorTile();
    floorTexture.repeat.set(10, 8.33);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 10),
      new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.55 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // ---------- Walls ----------
    const addPlane = (
      width: number,
      height: number,
      x: number,
      y: number,
      z: number,
      mat: THREE.Material,
      rotationY = 0,
      rotationX = 0,
    ) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
      mesh.position.set(x, y, z);
      mesh.rotation.set(rotationX, rotationY, 0);
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    };

    const wallMaterial = new THREE.MeshStandardMaterial({ color: palette.wall, roughness: 0.96 });
    const trimMaterial = new THREE.MeshStandardMaterial({
      color: palette.trim,
      roughness: 0.6,
      side: THREE.DoubleSide,
    });

    // Back wall: narrow side segments plus a header above the wide alcove opening.
    const sideWidth = 6 - ALCOVE_HALF_WIDTH;
    const alcoveWidth = ALCOVE_HALF_WIDTH * 2;
    const alcoveMidZ = -5 - ALCOVE_DEPTH / 2;
    addPlane(sideWidth, 6, -(ALCOVE_HALF_WIDTH + sideWidth / 2), 3, -5, wallMaterial);
    addPlane(sideWidth, 6, ALCOVE_HALF_WIDTH + sideWidth / 2, 3, -5, wallMaterial);
    addPlane(alcoveWidth, 6 - ALCOVE_HEIGHT, 0, ALCOVE_HEIGHT + (6 - ALCOVE_HEIGHT) / 2, -5, wallMaterial);

    // Deep recessed alcove: white returns, ceiling and a pale veined stone panel.
    addPlane(alcoveWidth, ALCOVE_HEIGHT, 0, ALCOVE_HEIGHT / 2, -5 - ALCOVE_DEPTH, trimMaterial);
    addPlane(ALCOVE_DEPTH, ALCOVE_HEIGHT, -ALCOVE_HALF_WIDTH, ALCOVE_HEIGHT / 2, alcoveMidZ, trimMaterial, Math.PI / 2);
    addPlane(ALCOVE_DEPTH, ALCOVE_HEIGHT, ALCOVE_HALF_WIDTH, ALCOVE_HEIGHT / 2, alcoveMidZ, trimMaterial, -Math.PI / 2);
    addPlane(alcoveWidth, ALCOVE_DEPTH, 0, ALCOVE_HEIGHT, alcoveMidZ, trimMaterial, 0, Math.PI / 2);
    const marblePanel = addPlane(
      alcoveWidth - 0.7,
      4.3,
      0,
      2.3,
      -5 - ALCOVE_DEPTH + 0.005,
      new THREE.MeshStandardMaterial({ map: createMarble(), roughness: 0.45 }),
    );

    // Wall-tile planes covering the three inner walls of the wet area (hidden until a tile is chosen).
    const makeTileMaterial = () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const tileBack = addPlane(alcoveWidth, ALCOVE_HEIGHT, 0, ALCOVE_HEIGHT / 2, -5 - ALCOVE_DEPTH + 0.004, makeTileMaterial());
    const tileLeft = addPlane(
      ALCOVE_DEPTH,
      ALCOVE_HEIGHT,
      -ALCOVE_HALF_WIDTH + 0.004,
      ALCOVE_HEIGHT / 2,
      alcoveMidZ,
      makeTileMaterial(),
      Math.PI / 2,
    );
    const tileRight = addPlane(
      ALCOVE_DEPTH,
      ALCOVE_HEIGHT,
      ALCOVE_HALF_WIDTH - 0.004,
      ALCOVE_HEIGHT / 2,
      alcoveMidZ,
      makeTileMaterial(),
      -Math.PI / 2,
    );
    [tileBack, tileLeft, tileRight].forEach((mesh) => {
      mesh.visible = false;
    });
    tilePlanesRef.current = [
      { mesh: tileBack, width: alcoveWidth, height: ALCOVE_HEIGHT },
      { mesh: tileLeft, width: ALCOVE_DEPTH, height: ALCOVE_HEIGHT },
      { mesh: tileRight, width: ALCOVE_DEPTH, height: ALCOVE_HEIGHT },
    ];
    marbleRef.current = marblePanel;

    // White lip framing the opening.
    scene.add(box(0.14, ALCOVE_HEIGHT + 0.12, 0.06, palette.trim, -ALCOVE_HALF_WIDTH - 0.07, ALCOVE_HEIGHT / 2 + 0.06, -4.97));
    scene.add(box(0.14, ALCOVE_HEIGHT + 0.12, 0.06, palette.trim, ALCOVE_HALF_WIDTH + 0.07, ALCOVE_HEIGHT / 2 + 0.06, -4.97));
    scene.add(box(alcoveWidth + 0.28, 0.14, 0.06, palette.trim, 0, ALCOVE_HEIGHT + 0.07, -4.97));

    // Shower base / bath platform filling the floor of the alcove, with a low front lip.
    scene.add(box(alcoveWidth, 0.12, ALCOVE_DEPTH + 0.5, 0xf9f8f5, 0, 0.06, -5 - ALCOVE_DEPTH / 2 + 0.25, 0.03));

    // Recessed ceiling light fixtures.
    downlightXs.forEach((lx) => {
      const lightTrim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.02, 32),
        new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 0.5 }),
      );
      lightTrim.position.set(lx, ALCOVE_HEIGHT - 0.01, -6.3);
      scene.add(lightTrim);
      const lightDisc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 0.02, 32),
        new THREE.MeshBasicMaterial({ color: 0xfffbe8 }),
      );
      lightDisc.position.set(lx, ALCOVE_HEIGHT - 0.02, -6.3);
      scene.add(lightDisc);
    });

    // Left wall: warm woven wall covering.
    const grasscloth = createGrasscloth();
    grasscloth.repeat.set(3.3, 2);
    const leftWall = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 6),
      new THREE.MeshStandardMaterial({
        map: grasscloth,
        roughness: 0.98,
        side: THREE.DoubleSide,
      }),
    );
    leftWall.position.set(-6, 3, 0);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    // Green tile accent on the right of the back wall.
    const tilePanel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.68, 3.36),
      new THREE.MeshStandardMaterial({ map: createGreenTile(), roughness: 0.25 }),
    );
    tilePanel.position.set(5.16, 1.68, -4.99);
    tilePanel.receiveShadow = true;
    scene.add(tilePanel);
    scene.add(box(1.68, 0.06, 0.08, 0xe4ebe0, 5.16, 3.39, -4.96));

    // Baseboards.
    scene.add(box(6 - ALCOVE_HALF_WIDTH, 0.22, 0.08, palette.base, -(ALCOVE_HALF_WIDTH + (6 - ALCOVE_HALF_WIDTH) / 2), 0.11, -4.96));
    scene.add(box(0.08, 0.22, 10, palette.base, -5.96, 0.11, 0));

    // Decorative towel on a hook, like the reference.
    scene.add(tube(0.03, 0.08, "z", -5.1, 3.2, -4.96));
    const towel = new THREE.Group();
    towel.add(box(0.62, 1.25, 0.05, palette.sage, 0, 0, 0, 0.02));
    towel.add(box(0.62, 0.12, 0.08, palette.sageDark, 0, 0.6, 0.01, 0.02));
    towel.position.set(-5.1, 2.55, -4.93);
    towel.rotation.z = -0.04;
    scene.add(towel);

    // ---------- Placed assets ----------
    const assetGroup = new THREE.Group();
    assetGroupRef.current = assetGroup;
    scene.add(assetGroup);

    // Selection ring that follows the selected floor item.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1, 64),
      new THREE.MeshBasicMaterial({
        color: 0x2f6f5e,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.025;
    ring.visible = false;
    scene.add(ring);
    const ringBox = new THREE.Box3();
    const ringSize = new THREE.Vector3();

    // Rotation handle: a dot on the selection ring (floor items only). Drag it to rotate.
    const handle = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0x2f6f5e, depthTest: false }),
    );
    handle.renderOrder = 10;
    handle.visible = false;
    scene.add(handle);

    // ---------- Pointer interaction: select, drag-to-move, click-away to deselect ----------
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hitPoint = new THREE.Vector3();
    const canvasEl = renderer.domElement;

    type DragState = {
      object: THREE.Group;
      offsetX: number;
      offsetY: number;
      offsetZ: number;
      moved: boolean;
      wall: boolean;
    };
    let drag: DragState | null = null;
    let rotating: THREE.Group | null = null;
    let backgroundDown: { x: number; y: number } | null = null;

    const setRay = (event: PointerEvent) => {
      const rect = canvasEl.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
    };

    const pickItem = (): { group: THREE.Group; point: THREE.Vector3 } | null => {
      const hits = raycaster.intersectObjects(assetGroup.children, true);
      // Glass is see-through for picking: prefer whatever is behind it, fall back to the door itself.
      const hit = hits.find((candidate) => !candidate.object.userData.glass) ?? hits[0];
      if (!hit) return null;
      let target: THREE.Object3D | null = hit.object;
      while (target && target.parent !== assetGroup) target = target.parent;
      if (!target) return null;
      return { group: target as THREE.Group, point: hit.point.clone() };
    };

    // Vertical plane lying in the wall an item is currently mounted on.
    const setWallPlane = (object: THREE.Object3D) => {
      const nx = Math.sin(object.rotation.y);
      const nz = Math.cos(object.rotation.y);
      dragPlane.normal.set(nx, 0, nz);
      dragPlane.constant = -(nx * object.position.x + nz * object.position.z);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      setRay(event);

      if (handle.visible && selectedRef.current !== null) {
        const target = objectsRef.current.get(selectedRef.current);
        if (target && raycaster.intersectObject(handle).length) {
          event.stopPropagation();
          rotating = target;
          controls.enabled = false;
          canvasEl.setPointerCapture(event.pointerId);
          canvasEl.style.cursor = "grabbing";
          return;
        }
      }

      const hit = pickItem();
      let canDrag = false;
      if (hit) {
        if (hit.group.userData.mount === "wall") {
          // Wall items drag across the face of their wall, so they also move up and down.
          setWallPlane(hit.group);
        } else {
          // Floor items drag on a horizontal plane at the grabbed height.
          dragPlane.normal.set(0, 1, 0);
          dragPlane.constant = -hit.point.y;
        }
        canDrag = raycaster.ray.intersectPlane(dragPlane, hitPoint) !== null;
      }

      if (hit && canDrag) {
        // Start dragging an item; stop the orbit controls from also reacting.
        event.stopPropagation();
        drag = {
          object: hit.group,
          offsetX: hit.group.position.x - hitPoint.x,
          offsetY: hit.group.position.y - hitPoint.y,
          offsetZ: hit.group.position.z - hitPoint.z,
          moved: false,
          wall: hit.group.userData.mount === "wall",
        };
        controls.enabled = false;
        canvasEl.setPointerCapture(event.pointerId);
        canvasEl.style.cursor = "grabbing";
        onSelectRef.current(hit.group.userData.uid as number);
      } else {
        backgroundDown = { x: event.clientX, y: event.clientY };
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      setRay(event);
      if (rotating) {
        if (raycaster.ray.intersectPlane(floorPlane, hitPoint)) {
          let angle = Math.atan2(hitPoint.x - rotating.position.x, hitPoint.z - rotating.position.z);
          // Hold Shift to snap to 15° steps.
          if (event.shiftKey) angle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
          rotating.rotation.y = angle;
        }
        return;
      }
      if (drag) {
        if (drag.wall) setWallPlane(drag.object);
        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          const nx = hitPoint.x + drag.offsetX;
          const nz = hitPoint.z + drag.offsetZ;
          if (drag.wall) {
            const snapped = snapToWall(nx, nz, (drag.object.userData.halfWidth as number) ?? 0.4);
            const minY = (drag.object.userData.minY as number) ?? 0;
            const maxY = (drag.object.userData.maxY as number) ?? 4;
            const top = snapped.alcove ? ALCOVE_HEIGHT - 0.1 : 5.9;
            const y = clampRange(hitPoint.y + drag.offsetY, 0.1 - minY, top - maxY);
            drag.object.position.set(snapped.x, y, snapped.z);
            drag.object.rotation.y = snapped.rotation;
          } else {
            const next = clampFloor(nx, nz);
            drag.object.position.x = next.x;
            drag.object.position.z = next.z;
          }
          drag.moved = true;
        }
        return;
      }
      if (event.buttons === 0) {
        const overHandle = handle.visible && raycaster.intersectObject(handle).length > 0;
        canvasEl.style.cursor = overHandle || pickItem() ? "grab" : "";
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (rotating) {
        const object = rotating;
        rotating = null;
        controls.enabled = true;
        if (canvasEl.hasPointerCapture(event.pointerId)) {
          canvasEl.releasePointerCapture(event.pointerId);
        }
        canvasEl.style.cursor = "grab";
        onRotateRef.current(object.userData.uid as number, object.rotation.y);
        return;
      }
      if (drag) {
        const { object, moved, wall } = drag;
        drag = null;
        controls.enabled = true;
        if (canvasEl.hasPointerCapture(event.pointerId)) {
          canvasEl.releasePointerCapture(event.pointerId);
        }
        canvasEl.style.cursor = "grab";
        if (moved) {
          onMoveRef.current(
            object.userData.uid as number,
            object.position.x,
            object.position.z,
            wall ? object.rotation.y : undefined,
            wall ? object.position.y : undefined,
          );
        }
        return;
      }
      if (backgroundDown) {
        const distance = Math.hypot(event.clientX - backgroundDown.x, event.clientY - backgroundDown.y);
        backgroundDown = null;
        // A click (not an orbit drag) on empty space deselects.
        if (distance < 5) onSelectRef.current(null);
      }
    };

    // Capture phase on the wrapper so we run before OrbitControls' own listener.
    mount.addEventListener("pointerdown", handlePointerDown, true);
    mount.addEventListener("pointermove", handlePointerMove);
    mount.addEventListener("pointerup", handlePointerUp);
    mount.addEventListener("pointercancel", handlePointerUp);

    const resize = () => {
      const { clientWidth, clientHeight } = mount;
      camera.aspect = clientWidth / Math.max(clientHeight, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight, false);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();

      const selected = selectedRef.current !== null ? objectsRef.current.get(selectedRef.current) : undefined;
      if (selected && selected.userData.mount === "floor") {
        ringBox.setFromObject(selected);
        ringBox.getSize(ringSize);
        const radius = Math.max(ringSize.x, ringSize.z) / 2 + 0.14;
        ring.scale.set(radius, radius, 1);
        ring.position.x = selected.position.x;
        ring.position.z = selected.position.z;
        ring.visible = true;
        handle.position.set(
          selected.position.x + Math.sin(selected.rotation.y) * radius,
          0.09,
          selected.position.z + Math.cos(selected.rotation.y) * radius,
        );
        handle.visible = true;
      } else {
        ring.visible = false;
        handle.visible = false;
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mount.removeEventListener("pointerdown", handlePointerDown, true);
      mount.removeEventListener("pointermove", handlePointerMove);
      mount.removeEventListener("pointerup", handlePointerUp);
      mount.removeEventListener("pointercancel", handlePointerUp);
      controls.dispose();
      envTexture.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      disposeObject(scene);
      objectsRef.current.clear();
      assetGroupRef.current = null;
      tilePlanesRef.current = [];
      marbleRef.current = null;
      tileTexturesRef.current = [];
    };
  }, [onReady]);

  // Apply (or clear) the wall tile on the three inner walls of the wet area.
  useEffect(() => {
    const planes = tilePlanesRef.current;
    const marble = marbleRef.current;
    if (!planes.length || !marble) return;
    tileTexturesRef.current.forEach((texture) => texture.dispose());
    tileTexturesRef.current = [];
    const design = wallTile ? wallTiles.find((tile) => tile.id === wallTile) : undefined;
    marble.visible = !design;
    planes.forEach(({ mesh, width, height }) => {
      mesh.visible = !!design;
      if (!design) return;
      const texture = design.create();
      texture.repeat.set(width / design.world[0], height / design.world[1]);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.map = texture;
      mat.roughness = design.roughness;
      mat.needsUpdate = true;
      tileTexturesRef.current.push(texture);
    });
  }, [wallTile]);

  // Sync placed items (add / remove / update transform) without rebuilding existing meshes.
  useEffect(() => {
    const assetGroup = assetGroupRef.current;
    if (!assetGroup) return;
    const objects = objectsRef.current;
    const liveIds = new Set(items.map((item) => item.uid));

    objects.forEach((object, uid) => {
      if (!liveIds.has(uid)) {
        assetGroup.remove(object);
        disposeObject(object);
        objects.delete(uid);
      }
    });

    items.forEach((item) => {
      let object = objects.get(item.uid);
      if (!object) {
        object = createAsset(item.type);
        const bounds = new THREE.Box3().setFromObject(object);
        object.userData.minY = bounds.min.y;
        object.userData.maxY = bounds.max.y;
        object.userData.uid = item.uid;
        object.userData.mount = assetById[item.type].mount;
        object.userData.halfWidth = assetById[item.type].halfWidth ?? 0.4;
        assetGroup.add(object);
        objects.set(item.uid, object);
      }
      object.position.set(item.x, item.y, item.z);
      object.rotation.y = item.rotation;
      const itemCategory = assetById[item.type].category;
      if (itemCategory === "Bathtubs") {
        applyTubColor(object, item.color ?? tubColors[0].hex);
      } else if (itemCategory === "Fixtures" || itemCategory === "Grab bars" || itemCategory === "Shower doors") {
        const finish = fixtureFinishes.find((f) => f.hex === item.color) ?? fixtureFinishes[0];
        applyFinish(object, finish);
      }
    });
  }, [items]);

  // Highlight the selected item.
  useEffect(() => {
    objectsRef.current.forEach((object, uid) => {
      const isSelected = uid === selectedUid;
      object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((item) => {
            if (item instanceof THREE.MeshStandardMaterial) {
              item.emissive.setHex(isSelected ? 0x2f6f5e : 0x000000);
              item.emissiveIntensity = isSelected ? 0.22 : 0;
            }
          });
        }
      });
    });
  }, [selectedUid, items]);

  return <div ref={mountRef} className="room-canvas" aria-label="Interactive 3D bathroom preview" />;
}

function App() {
  const [category, setCategory] = useState<Category>("Bathtubs");
  const [wallTile, setWallTile] = useState<string | null>(null);
  const [placedItems, setPlacedItems] = useState<PlacedAsset[]>([]);
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const resetCameraRef = useRef<() => void>(() => undefined);
  const uidRef = useRef(0);
  const onCanvasReady = useMemo(
    () => (reset: () => void) => {
      resetCameraRef.current = reset;
    },
    [],
  );

  const showToast = (message: string, duration = 1600) => {
    setToast(message);
    window.setTimeout(() => setToast(""), duration);
  };

  const addAsset = (asset: AssetDefinition) => {
    uidRef.current += 1;
    const uid = uidRef.current;
    setPlacedItems((current) => {
      const copies = current.filter((item) => item.type === asset.id).length;
      let [x, z] = asset.home;
      let rotation = asset.homeRotation ?? 0;

      if (asset.mount === "wall") {
        // Snap to the nearest wall, then slide further copies along that wall.
        const hw = asset.halfWidth ?? 0.4;
        const first = snapToWall(x, z, hw);
        const shift = copies * 0.8;
        const snapped = first.rotation === 0 ? snapToWall(x + shift, z, hw) : snapToWall(x, z + shift, hw);
        x = snapped.x;
        z = snapped.z;
        rotation = snapped.rotation;
      } else {
        const next = clampFloor(x + copies * 0.7, z + copies * 0.7);
        x = next.x;
        z = next.z;
      }

      return [...current, { uid, type: asset.id, x, z, rotation, y: 0 }];
    });
    setSelectedUid(uid);
    showToast(`${asset.name} added to the bathroom`, 1800);
  };

  const moveItem = (uid: number, x: number, z: number, rotation?: number, y?: number) => {
    setPlacedItems((current) =>
      current.map((item) =>
        item.uid === uid ? { ...item, x, z, rotation: rotation ?? item.rotation, y: y ?? item.y } : item,
      ),
    );
  };

  const rotateItem = (uid: number, rotation: number) => {
    setPlacedItems((current) => current.map((item) => (item.uid === uid ? { ...item, rotation } : item)));
  };

  const rotateSelected = () => {
    if (selectedUid === null) return;
    setPlacedItems((current) =>
      current.map((item) =>
        item.uid === selectedUid && assetById[item.type].mount === "floor"
          ? { ...item, rotation: item.rotation + Math.PI / 4 }
          : item,
      ),
    );
  };

  const applyWallTile = (tile: WallTileDesign) => {
    const next = wallTile === tile.id ? null : tile.id;
    setWallTile(next);
    showToast(next ? `${tile.name} applied to the bath area walls` : "Original stone panel restored", 1800);
  };

  const recolorItem = (uid: number, color: number) => {
    setPlacedItems((current) => current.map((item) => (item.uid === uid ? { ...item, color } : item)));
  };

  const removeSelected = () => {
    if (selectedUid === null) return;
    setPlacedItems((current) => current.filter((item) => item.uid !== selectedUid));
    setSelectedUid(null);
    showToast("Item removed", 1400);
  };

  const removeLast = () => {
    setPlacedItems((current) => {
      const last = current[current.length - 1];
      if (last && last.uid === selectedUid) setSelectedUid(null);
      return current.slice(0, -1);
    });
    showToast("Last item removed", 1400);
  };

  const clearRoom = () => {
    setPlacedItems([]);
    setSelectedUid(null);
  };

  // Keyboard shortcuts: Esc deselects, Delete/Backspace removes the selected item, R rotates floor items.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key === "Escape") {
        setSelectedUid(null);
      } else if ((event.key === "Delete" || event.key === "Backspace") && selectedUid !== null) {
        event.preventDefault();
        setPlacedItems((current) => current.filter((item) => item.uid !== selectedUid));
        setSelectedUid(null);
      } else if ((event.key === "r" || event.key === "R") && selectedUid !== null) {
        setPlacedItems((current) =>
          current.map((item) =>
            item.uid === selectedUid && assetById[item.type].mount === "floor"
              ? { ...item, rotation: item.rotation + Math.PI / 4 }
              : item,
          ),
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedUid]);

  const visibleAssets = assets.filter((asset) => asset.category === category);
  const selectedItem = placedItems.find((item) => item.uid === selectedUid);
  const selectedAsset = selectedItem ? assetById[selectedItem.type] : undefined;
  const canRotate = selectedAsset?.mount === "floor";
  // Floating swatch bar: tub colours for bathtubs, metal finishes for fixtures.
  const swatches: { id: string; name: string; hex: number }[] | null =
    selectedAsset?.category === "Bathtubs"
      ? tubColors
      : selectedAsset?.category === "Fixtures" ||
          selectedAsset?.category === "Grab bars" ||
          selectedAsset?.category === "Shower doors"
        ? fixtureFinishes
        : null;
  const swatchLabel = selectedAsset?.category === "Bathtubs" ? "Tub colour" : "Finish";
  const showColorToolbar = !!swatches && !!selectedItem;
  const activeSwatch = selectedItem?.color ?? swatches?.[0]?.hex;
  const activeSwatchName = swatches?.find((c) => c.hex === activeSwatch)?.name ?? "";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-side">
          <button className="back-button" type="button">
            <ArrowLeft size={17} strokeWidth={2.2} />
            <span>Back to projects</span>
          </button>
          <div className="divider" />
          <div className="brand">
            <span className="brand-mark">
              <Box size={18} strokeWidth={2.3} />
            </span>
            <span>Roomly</span>
          </div>
        </div>
        <div className="title-block">
          <span>Bathroom</span>
          <small>Design studio</small>
        </div>
        <div className="topbar-actions">
          <button className="help-button" type="button">
            <CircleHelp size={17} />
            <span>Help</span>
          </button>
          <button className="save-button" type="button">
            Save design
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className={`asset-sidebar ${sidebarOpen ? "" : "collapsed"}`}>
          <div className="sidebar-heading">
            <div>
              <span className="eyebrow">Asset library</span>
              <h1>Make it yours</h1>
              <p>Choose a piece to place it in your bathroom.</p>
            </div>
            <button
              className="collapse-button"
              type="button"
              onClick={() => setSidebarOpen((open) => !open)}
              aria-label={sidebarOpen ? "Collapse asset library" : "Open asset library"}
            >
              <ChevronDown size={18} />
            </button>
          </div>

          <div className="category-tabs">
            {categories.map((item) => (
              <button
                type="button"
                className={category === item ? "active" : ""}
                onClick={() => setCategory(item)}
                key={item}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="asset-count">
            <span>{category}</span>
            <small>{category === "Wall tiles" ? wallTiles.length : visibleAssets.length} items</small>
          </div>

          <div className="asset-grid">
            {category === "Wall tiles"
              ? wallTiles.map((tile) => {
                  const Icon = tile.icon;
                  return (
                    <button
                      key={tile.id}
                      type="button"
                      className={`asset-card ${wallTile === tile.id ? "selected" : ""}`}
                      onClick={() => applyWallTile(tile)}
                    >
                      <span className="asset-visual" style={{ background: tile.preview, color: tile.iconColor }}>
                        <Icon size={46} strokeWidth={1.3} />
                        <span className="add-mark">{wallTile === tile.id ? "✓" : "+"}</span>
                      </span>
                      <strong>{tile.name}</strong>
                      <small>{tile.detail}</small>
                    </button>
                  );
                })
              : visibleAssets.map((asset) => {
              const Icon = asset.icon;
              return (
                <button
                  key={asset.id}
                  type="button"
                  className={`asset-card ${selectedItem?.type === asset.id ? "selected" : ""}`}
                  onClick={() => addAsset(asset)}
                >
                  <span className={`asset-visual ${asset.tone}`}>
                    <Icon size={46} strokeWidth={1.3} />
                    <span className="add-mark">+</span>
                  </span>
                  <strong>{asset.name}</strong>
                  <small>{asset.detail}</small>
                </button>
              );
            })}
          </div>

          <div className="sidebar-tip">
            <MousePointer2 size={17} />
            <p>
              <strong>Quick add</strong>
              Select any item to place it. Tubs and floor fixtures move freely; rods, grab bars and
              wall fixtures snap to the nearest wall.
            </p>
          </div>
        </aside>

        <section className="viewer">
          <div className="viewer-toolbar">
            <div>
              <span className="status-dot" />
              <span>Interactive 3D preview</span>
              <small>{placedItems.length} items placed</small>
            </div>
            <div className="viewer-actions">
              <button
                type="button"
                onClick={rotateSelected}
                disabled={!canRotate}
                title="Rotate selected floor item (R)"
              >
                <RotateCw size={17} />
                <span>Rotate</span>
              </button>
              <button
                type="button"
                onClick={removeSelected}
                disabled={selectedUid === null}
                title="Remove selected (Delete)"
              >
                <X size={17} />
                <span>Remove</span>
              </button>
              <button type="button" onClick={removeLast} disabled={!placedItems.length} title="Undo last item">
                <Undo2 size={17} />
                <span>Undo</span>
              </button>
              <button type="button" onClick={clearRoom} disabled={!placedItems.length} title="Clear room">
                <Trash2 size={17} />
                <span>Clear</span>
              </button>
              <button type="button" onClick={() => resetCameraRef.current()} title="Reset camera">
                <RotateCcw size={17} />
                <span>Reset view</span>
              </button>
              <button type="button" title="Fit preview">
                <Maximize2 size={17} />
              </button>
            </div>
          </div>

          <div className="canvas-frame">
            <RoomCanvas
              items={placedItems}
              selectedUid={selectedUid}
              onSelect={setSelectedUid}
              onMove={moveItem}
              onRotate={rotateItem}
              onReady={onCanvasReady}
              wallTile={wallTile}
            />
            {!placedItems.length && (
              <div className="empty-room-message">
                <span>
                  <Armchair size={24} />
                </span>
                <strong>Your bathroom is ready</strong>
                <p>Pick an asset from the library to begin fitting it out.</p>
              </div>
            )}
            <div className="orbit-hint">
              <Rotate3D size={17} />
              <span>Drag to orbit</span>
              <i />
              <span>Drag a piece to move (wall pieces slide up and down too), green dot to rotate tubs</span>
              <i />
              <span>Click empty space to deselect</span>
            </div>
            <div className="view-cube" aria-hidden="true">
              <span>TOP</span>
              <Box size={28} strokeWidth={1.25} />
            </div>
            {showColorToolbar && selectedItem && swatches && (
              <div
                className="color-toolbar"
                role="toolbar"
                aria-label={swatchLabel}
                style={{
                  position: "absolute",
                  top: 16,
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 16px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.94)",
                  boxShadow: "0 6px 24px rgba(40,34,24,0.16)",
                  backdropFilter: "blur(8px)",
                  fontSize: 13,
                  color: "#3b362d",
                }}
              >
                <span style={{ fontWeight: 600 }}>{swatchLabel}</span>
                {swatches.map((color) => {
                  const active = color.hex === activeSwatch;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      title={color.name}
                      aria-label={color.name}
                      aria-pressed={active}
                      onClick={() => recolorItem(selectedItem.uid, color.hex)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: toCss(color.hex),
                        border: "1px solid rgba(0,0,0,0.18)",
                        boxShadow: active ? "0 0 0 2px #fff, 0 0 0 4px #2f6f5e" : "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    />
                  );
                })}
                <small style={{ minWidth: 86, opacity: 0.7 }}>{activeSwatchName}</small>
              </div>
            )}
            {toast && <div className="toast">{toast}</div>}
          </div>

          <footer className="viewer-footer">
            <div>
              <span className="footer-swatch" />
              <p>
                <small>Current selection</small>
                <strong>{selectedAsset?.name ?? "No item selected"}</strong>
              </p>
            </div>
            <button type="button">
              Continue to review
              <ArrowLeft size={17} className="continue-arrow" />
            </button>
          </footer>
        </section>
      </div>
    </main>
  );
}

export default App;