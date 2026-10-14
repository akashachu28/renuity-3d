import { useEffect, useMemo, useRef, useState } from "react";
import { buildBathroomDecor } from "./bathroom-design/bathroomDecor";
import {
  Archive,
  Armchair,
  ArrowLeft,
  Bath,
  Box,
  ChevronDown,
  ChevronsUp,
  CircleHelp,
  CornerDownRight,
  DoorClosed,
  DoorOpen,
  Gem,
  GripHorizontal,
  Grid3x3,
  Hexagon,
  Layers,
  LayoutGrid,
  Maximize2,
  Minus,
  Mountain,
  MoveDiagonal,
  Package,
  Rotate3D,
  RotateCcw,
  RotateCw,
  ShowerHead,
  Square,
  Trash2,
  Undo2,
  Waves,
  X,
} from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildBathroomWalls, buildFloor, createFloorTile, createMarble } from "./wet-area-elements/bathroomWalls";
import { createAsset } from "./wet-area-elements/bathroomComponents";

// Wall tile images. Put wall1.jpg, wall2.jpg and wall3.jpg in src/assets/.
// If TypeScript complains about .jpg imports, add `declare module "*.jpg";` to a .d.ts file.
import wall1Url from "./assets/wall1.jpg";
import wall2Url from "./assets/wall2.jpg";
import wall3Url from "./assets/wall3.jpg";
import wall4Url from "./assets/wall4.jpg";
import wall5Url from "./assets/wall5.jpg";
import wall6Url from "./assets/wall6.jpg";
import wall7Url from "./assets/wall7.jpg";
import wall8Url from "./assets/wall8.jpg";
import wall9Url from "./assets/wall9.jpg";
import wall10Url from "./assets/wall10.jpg";
import wall11Url from "./assets/wall11.jpg";
import wall12Url from "./assets/wall12.jpg";

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
  | "grabAngled"
  | "nicheBox"
  | "cornerShelf";

type Category =
  | "Bathtubs"
  | "Fixtures"
  | "Rods"
  | "Grab bars"
  | "Accessories"
  | "Shower doors"
  | "Wall tiles";
type Mount = "floor" | "wall" | "corner";

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
  /** Locked items can be selected and recoloured but not moved or rotated. */
  locked?: boolean;
  /** where the first copy appears (wall items snap to the closest wall) */
  home: [number, number];
  homeRotation?: number;
  /** Half of the item's width along the wall; keeps wall items inside their wall segment. */
  halfWidth?: number;
  /** Starting colour / finish for items that offer swatches. */
  defaultColor?: number;
};

// The alcove is sized around the built-in tub so it fits wall-to-wall.
// Change these three numbers to resize both together.
const TUB_LENGTH = 4.8;
const TUB_DEPTH = 2.8;
const TUB_HEIGHT = 1.1;

const categories: Category[] = [
  "Bathtubs",
  "Fixtures",
  "Rods",
  "Grab bars",
  "Accessories",
  "Shower doors",
  "Wall tiles",
];

const assets: AssetDefinition[] = [
  {
    id: "alcoveTub",
    name: "Alcove bathtub",
    detail: "Built-in · wall to wall",
    icon: Bath,
    tone: "sand",
    category: "Bathtubs",
    mount: "floor",
    locked: true,
    home: [0, -6.55],
  },
  {
    id: "freeTub",
    name: "Freestanding tub",
    detail: "Freestanding · wall to wall",
    icon: Bath,
    tone: "clay",
    category: "Bathtubs",
    mount: "floor",
    locked: true,
    home: [0, -6.55],
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
    id: "nicheBox",
    name: "Shower niche box",
    detail: "Two compartments · 4 colours",
    icon: Archive,
    tone: "olive",
    category: "Accessories",
    mount: "wall",
    home: [-1.2, -7.4],
    halfWidth: 0.8,
    defaultColor: 0x1f2124,
  },
  {
    id: "cornerShelf",
    name: "Corner shelf",
    detail: "Slotted metal · 4 colours",
    icon: CornerDownRight,
    tone: "clay",
    category: "Accessories",
    mount: "corner",
    home: [-2.4, -7.4],
    defaultColor: 0xd4a937,
  },
  {
    id: "clearDoor",
    name: "Clear glass door",
    detail: "Fully transparent · sliding",
    icon: DoorClosed,
    tone: "sand",
    category: "Shower doors",
    mount: "floor",
    locked: true,
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
    locked: true,
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

const assetById = Object.fromEntries(
  assets.map((asset) => [asset.id, asset]),
) as Record<AssetId, AssetDefinition>;

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

// ---------------------------------------------------------------------------------------------
// Room dimensions
// ---------------------------------------------------------------------------------------------
// A compact cut-away room around the bath area (the alcove keeps its size; only the room shrinks).
// The back wall (z = -5) has the recessed alcove; the side walls sit at x = ±ROOM_HALF_WIDTH.
//
//   ROOM_HALF_WIDTH  distance from the centre line to each side wall (was 6). The wall strip beside
//                    the alcove is ROOM_HALF_WIDTH - ALCOVE_HALF_WIDTH wide.
//   ROOM_FRONT_Z     where the side walls and floor end at the front (was 1).
const ROOM_HALF_WIDTH = 4.4 ;
const ROOM_FRONT_Z = 1;
const ROOM_LIMIT_X = ROOM_HALF_WIDTH - 0.7; // how far floor items can be dragged sideways
const ROOM_MIN_Z = -4.3; // back limit for floor items outside the alcove
const ROOM_MAX_Z = ROOM_FRONT_Z - 0.4; // front limit for floor items
const ALCOVE_HALF_WIDTH = TUB_LENGTH / 2;
const ALCOVE_DEPTH = TUB_DEPTH;
const ALCOVE_HEIGHT = 4.7;
const BACK_WALL_Z = -4.995;
const ALCOVE_BACK_Z = -5 - ALCOVE_DEPTH + 0.01; // -7.79
const LEFT_WALL_X = -ROOM_HALF_WIDTH + 0.005;
const RIGHT_WALL_X = ROOM_HALF_WIDTH - 0.005;

const CAMERA_START = new THREE.Vector3(0, 3.2, 5.5); // Zoomed in closer, front-facing
const TARGET_START = new THREE.Vector3(0, 2.2, -5.5); // Centered on bath area

const clamp = (value: number, limit: number) =>
  Math.max(-limit, Math.min(limit, value));

/** Keep floor items inside the room; allow big pieces (tubs) to slide into the alcove. */
function clampFloor(x: number, z: number) {
  const cx = clamp(x, ROOM_LIMIT_X);
  const minZ =
    Math.abs(cx) <= ALCOVE_HALF_WIDTH - 0.3 ? ALCOVE_BACK_Z + 1.2 : ROOM_MIN_Z;
  return { x: cx, z: Math.max(minZ, Math.min(ROOM_MAX_Z, z)) };
}

const clampRange = (value: number, lo: number, hi: number) =>
  lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, value));

/**
 * Snap a wall-mounted item to the closest wall surface. Candidate walls:
 * the alcove back, both alcove side walls, the two narrow strips of back wall either side of the
 * alcove opening, and the room's left and right walls.
 */
function snapToWall(x: number, z: number, halfWidth = 0.4) {
  const H = ALCOVE_HALF_WIDTH;
  const inner = H - halfWidth - 0.1;
  const sideLo = ALCOVE_BACK_Z + halfWidth + 0.05;
  const sideHi = BACK_WALL_Z - 0.1 - halfWidth;
  const stripLo = H + 0.1 + halfWidth;
  const stripHi = ROOM_HALF_WIDTH - 0.1 - halfWidth;
  // Side walls run from the back wall to the front of the room.
  const sideWallLo = BACK_WALL_Z + 0.1 + halfWidth;
  const sideWallHi = ROOM_FRONT_Z - 0.1 - halfWidth;

  const candidates = [
    {
      x: clampRange(x, -inner, inner),
      z: ALCOVE_BACK_Z,
      rotation: 0,
      alcove: true,
    },
    {
      x: -H + 0.005,
      z: clampRange(z, sideLo, sideHi),
      rotation: Math.PI / 2,
      alcove: true,
    },
    {
      x: H - 0.005,
      z: clampRange(z, sideLo, sideHi),
      rotation: -Math.PI / 2,
      alcove: true,
    },
    {
      x:
        x < 0
          ? -clampRange(-x, stripLo, stripHi)
          : clampRange(x, stripLo, stripHi),
      z: BACK_WALL_Z,
      rotation: 0,
      alcove: false,
    },
    {
      x: LEFT_WALL_X,
      z: clampRange(z, sideWallLo, sideWallHi),
      rotation: Math.PI / 2,
      alcove: false,
    },
    {
      x: RIGHT_WALL_X,
      z: clampRange(z, sideWallLo, sideWallHi),
      rotation: -Math.PI / 2,
      alcove: false,
    },
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

/** Snap a corner item (L-shaped shelf) to the nearest inside corner of the alcove. */
function snapToCorner(x: number, z: number) {
  const H = ALCOVE_HALF_WIDTH;
  const candidates = [
    { x: -H + 0.01, z: ALCOVE_BACK_Z + 0.005, rotation: 0 },
    { x: H - 0.01, z: ALCOVE_BACK_Z + 0.005, rotation: -Math.PI / 2 },
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

// ---------------------------------------------------------------------------------------------
// Wall tile designs (image based)
// ---------------------------------------------------------------------------------------------

type WallTileDesign = {
  id: string;
  name: string;
  detail: string;
  icon: typeof Bath;
  /** CSS background for the library card. */
  preview: string;
  iconColor: string;
  /** Image used as the wall texture. */
  url: string;
  /** World size (units) covered by one repeat of the image. */
  world: [number, number];
  roughness: number;
};

const wallTiles: WallTileDesign[] = [
  {
    id: "greySubway",
    name: "Grey subway tile",
    detail: "Soft grey · white grout",
    icon: Grid3x3,
    preview: `url(${wall1Url}) center / cover`,
    iconColor: "#8a8680",
    url: wall1Url,
    world: [1.6, 1.6],
    roughness: 0.2,
  },
  {
    id: "blackGrout",
    name: "White tile, black grout",
    detail: "Running bond · bold grout",
    icon: LayoutGrid,
    preview: `url(${wall2Url}) center / cover`,
    iconColor: "#555555",
    url: wall2Url,
    world: [1.47, 1.8],
    roughness: 0.18,
  },
  {
    id: "marble",
    name: "Veined marble",
    detail: "White with warm veining",
    icon: Layers,
    preview: `url(${wall3Url}) center / cover`,
    iconColor: "#a39078",
    url: wall3Url,
    world: [2.4, 2.4],
    roughness: 0.25,
  },
  {
    id: "travertine",
    name: "Beige travertine",
    detail: "Warm natural stone",
    icon: Mountain,
    preview: `url(${wall4Url}) center / cover`,
    iconColor: "#8a6f4e",
    url: wall4Url,
    world: [2.0, 2.0],
    roughness: 0.55,
  },
  {
    id: "statuario",
    name: "White statuario marble",
    detail: "Bright white · grey veining",
    icon: Gem,
    preview: `url(${wall5Url}) center / cover`,
    iconColor: "#8d949a",
    url: wall5Url,
    world: [2.4, 2.4],
    roughness: 0.2,
  },
  {
    id: "sand",
    name: "Sand plain tile",
    detail: "Solid warm cream",
    icon: Square,
    preview: `url(${wall6Url}) center / cover`,
    iconColor: "#a8935f",
    url: wall6Url,
    world: [2.4, 2.4],
    roughness: 0.22,
  },
  {
    id: "greyOnyx",
    name: "Grey onyx",
    detail: "Vertical striated stone",
    icon: Waves,
    preview: `url(${wall7Url}) center / cover`,
    iconColor: "#6f7478",
    url: wall7Url,
    world: [2.4, 2.4],
    roughness: 0.3,
  },
  {
    id: "copperHerringbone",
    name: "Copper herringbone",
    detail: "Rustic slate · white grout",
    icon: ChevronsUp,
    preview: `url(${wall8Url}) center / cover`,
    iconColor: "#fff3e0",
    url: wall8Url,
    world: [2.0, 2.0],
    roughness: 0.4,
  },
  {
    id: "greyHerringbone",
    name: "Grey marble herringbone",
    detail: "Soft grey · white grout",
    icon: ChevronsUp,
    preview: `url(${wall9Url}) center / cover`,
    iconColor: "#6f7478",
    url: wall9Url,
    world: [1.6, 2.36],
    roughness: 0.22,
  },
  {
    id: "honeyHex",
    name: "Honey hexagon",
    detail: "Warm cream · white grout",
    icon: Hexagon,
    preview: `url(${wall10Url}) center / cover`,
    iconColor: "#fff8e8",
    url: wall10Url,
    world: [2.0, 2.0],
    roughness: 0.25,
  },
  {
    id: "mochaHex",
    name: "Mocha marble hexagon",
    detail: "Brown veined · white grout",
    icon: Hexagon,
    preview: `url(${wall11Url}) center / cover`,
    iconColor: "#fff3e6",
    url: wall11Url,
    world: [2.0, 1.87],
    roughness: 0.25,
  },
  {
    id: "whiteHex",
    name: "White hexagon",
    detail: "Matte white · grey grout",
    icon: Hexagon,
    preview: `url(${wall12Url}) center / cover`,
    iconColor: "#9a9a9a",
    url: wall12Url,
    world: [2.0, 2.0],
    roughness: 0.3,
  },
];

// ---------------------------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------------------------

function material(color: number, roughness = 0.82, metalness = 0.04) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function metalMaterial(color: number) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.28,
    metalness: 0.85,
  });
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
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 24),
    metalMaterial(color),
  );
  if (axis === "x") mesh.rotation.z = Math.PI / 2;
  if (axis === "z") mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.finish = color === palette.chrome;
  return mesh;
}

function ball(
  radius: number,
  x: number,
  y: number,
  z: number,
  color: number = palette.chrome,
) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 20, 14),
    metalMaterial(color),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.userData.finish = color === palette.chrome;
  return mesh;
}

/** Round wall plate; wall items have their origin on the wall surface and extend toward +z. */
function flange(
  x: number,
  y: number,
  radius: number,
  color: number = palette.chrome,
) {
  return tube(radius, 0.04, "z", x, y, 0.02, color);
}

/** Invisible box that makes thin items easy to click and drag. */
function hitBox(
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
) {
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
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop, rBottom, length, 24),
    metalMaterial(color),
  );
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
      ctx.fillStyle =
        rand() < 0.5 ? "rgba(255,255,255,0.35)" : "rgba(150,170,172,0.14)";
      ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2);
    }
  });
  texture.repeat.set(4, 2);
  return texture;
}

/** Soft diagonal light bands that fake a window reflection across a glass panel. */
function createGlassStreakTexture() {
  const texture = paintTexture(256, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-Math.PI / 7);
    const bands: [number, number, number][] = [
      [-190, 70, 0.55],
      [-90, 18, 0.35],
      [10, 120, 0.4],
      [150, 24, 0.5],
    ];
    bands.forEach(([x, width, alpha]) => {
      const gradient = ctx.createLinearGradient(x - width, 0, x + width, 0);
      gradient.addColorStop(0, "rgba(255,255,255,0)");
      gradient.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(x - width, -h, width * 2, h * 2);
    });
    ctx.restore();
    // Fade the reflection toward the bottom so it reads like light from above.
    const fade = ctx.createLinearGradient(0, 0, 0, h);
    fade.addColorStop(0, "rgba(0,0,0,0)");
    fade.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, w, h);
  });
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/** Sliding shower door that stands on the bath platform: one fixed panel plus one sliding panel. */
function buildShowerDoor(group: THREE.Group, frosted: boolean) {
  const width = 4.72;
  // The glass runs all the way down to the platform (top of the base is y = 0.12).
  const bottom = 0.16;
  const top = 4.3;
  const height = top - bottom;

  const frostMap = frosted ? createFrostTexture() : null;

  const makeGlass = () =>
    frosted
      ? new THREE.MeshPhysicalMaterial({
          color: 0xeaf1f2,
          map: frostMap,
          roughness: 0.8,
          metalness: 0,
          clearcoat: 0.15,
          clearcoatRoughness: 0.4,
          transparent: true,
          opacity: 0.38,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      : new THREE.MeshPhysicalMaterial({
          color: 0xdcf0f4,
          roughness: 0.02,
          metalness: 0,
          clearcoat: 0.25,
          clearcoatRoughness: 0.05,
          transparent: true,
          opacity: 0.07,
          side: THREE.DoubleSide,
          depthWrite: false,
        });

  const panel = (panelWidth: number, x: number, z: number) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(panelWidth, height, 0.05),
      makeGlass(),
    );
    mesh.position.set(x, bottom + height / 2, z);
    mesh.userData.glass = true;
    mesh.renderOrder = 2;
    return mesh;
  };

  // Reflection streaks drawn just in front of a panel.
  const streaks = (panelWidth: number, x: number, z: number) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(panelWidth, height),
      new THREE.MeshBasicMaterial({
        map: createGlassStreakTexture(),
        transparent: true,
        opacity: frosted ? 0.08 : 0.14,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    mesh.position.set(x, bottom + height / 2, z + 0.03);
    mesh.userData.glass = true;
    mesh.userData.streak = true;
    mesh.renderOrder = 3;
    return mesh;
  };

  // Every metal part is tagged "shiny" so it gets a mirror-like finish and environment reflections.
  const add = (mesh: THREE.Mesh) => {
    mesh.userData.shiny = true;
    group.add(mesh);
  };

  // Fixed panel against the left wall and a sliding panel in front of it.
  group.add(panel(2.2, -1.26, 0));
  group.add(panel(2.6, 1.06, 0.07));
  group.add(streaks(2.2, -1.26, 0));
  group.add(streaks(2.6, 1.06, 0.07));

  // Top rail and bottom track.
  add(metalBox(width, 0.08, 0.14, palette.chrome, 0, top + 0.04, 0.035, 0.015));
  add(metalBox(width, 0.08, 0.16, palette.chrome, 0, 0.16, 0.035, 0.015));

  // Vertical edge profiles framing each panel.
  [-2.36, -0.16].forEach((x) => {
    add(
      metalBox(
        0.04,
        height,
        0.07,
        palette.chrome,
        x,
        bottom + height / 2,
        0,
        0.008,
      ),
    );
  });
  [-0.24, 2.36].forEach((x) => {
    add(
      metalBox(
        0.04,
        height,
        0.07,
        palette.chrome,
        x,
        bottom + height / 2,
        0.07,
        0.008,
      ),
    );
  });

  // Wall clamps for the fixed panel.
  [0.7, 1.7, 2.7, 3.7].forEach((y) => {
    add(metalBox(0.05, 0.16, 0.16, palette.chrome, -2.385, y, 0, 0.01));
  });

  // Roller hangers on the sliding panel.
  [0.1, 1.9].forEach((x) => {
    add(metalBox(0.05, 0.2, 0.04, palette.chrome, x, top - 0.1, 0.1, 0.008));
    add(tube(0.05, 0.03, "z", x, top - 0.02, 0.13));
  });

  // Vertical handle on the leading edge of the sliding panel.
  add(tube(0.025, 1.0, "y", -0.12, 2.7, 0.19));
  [2.3, 3.1].forEach((y) => {
    add(tube(0.015, 0.14, "z", -0.12, y, 0.12));
  });
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
  {
    id: "chrome",
    name: "Steel / Chrome",
    hex: 0xdde1e4,
    roughness: 0.28,
    metalness: 0.85,
  },
  { id: "gold", name: "Gold", hex: 0xd4a937, roughness: 0.25, metalness: 0.9 },
  {
    id: "black",
    name: "Black",
    hex: 0x1f2124,
    roughness: 0.42,
    metalness: 0.55,
  },
  {
    id: "bronze",
    name: "Bronze",
    hex: 0x8a5a32,
    roughness: 0.34,
    metalness: 0.8,
  },
];

/** Re-finish every metal part of a fixture (parts tagged as `finish`). */
function applyFinish(
  object: THREE.Object3D,
  finish: (typeof fixtureFinishes)[number],
) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh && child.userData.finish) {
      const mat = child.material as THREE.MeshStandardMaterial;
      mat.color.setHex(finish.hex);
      // Parts tagged "shiny" (shower door frames) get a near-mirror polish.
      mat.roughness = child.userData.shiny
        ? finish.roughness * 0.3
        : finish.roughness;
      mat.metalness = child.userData.shiny
        ? Math.min(1, finish.metalness + 0.1)
        : finish.metalness;
    }
  });
}

/** Give shower door metal and glass real environment reflections. */
function applyDoorReflections(
  object: THREE.Object3D,
  env: THREE.Texture | null,
) {
  if (!env) return;
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    if (!child.userData.glass && !child.userData.shiny) return;
    if (child.userData.streak) return;
    const mat = child.material as THREE.MeshStandardMaterial;
    if (mat.envMap === env) return;
    mat.envMap = env;
    mat.envMapIntensity = child.userData.glass ? 0.6 : 1.8;
    mat.needsUpdate = true;
  });
}

/** Give the glazed ceramic tub real environment reflections. */
function applyCeramicReflections(
  object: THREE.Object3D,
  env: THREE.Texture | null,
) {
  if (!env) return;
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.userData.paint) return;
    const mat = child.material as THREE.MeshStandardMaterial;
    if (mat.envMap === env) return;
    mat.envMap = env;
    mat.envMapIntensity = 1.2;
    mat.needsUpdate = true;
  });
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
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
  onMove: (
    uid: number,
    x: number,
    z: number,
    rotation?: number,
    y?: number,
  ) => void;
  onRotate: (uid: number, rotation: number) => void;
  onReady: (reset: () => void) => void;
  wallTile: string | null;
};

function RoomCanvas({
  items,
  selectedUid,
  onSelect,
  onMove,
  onRotate,
  onReady,
  wallTile,
}: RoomCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const assetGroupRef = useRef<THREE.Group | null>(null);
  const objectsRef = useRef<Map<number, THREE.Group>>(new Map());
  const selectedRef = useRef<number | null>(selectedUid);
  const tilePlanesRef = useRef<
    { mesh: THREE.Mesh; width: number; height: number }[]
  >([]);
  const marbleRef = useRef<THREE.Mesh | null>(null);
  const tileTexturesRef = useRef<THREE.Texture[]>([]);
  const envRef = useRef<THREE.Texture | null>(null);

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
    renderer.toneMappingExposure = 0.9;
    mount.appendChild(renderer.domElement);

    // Soft studio reflections so chrome and porcelain read properly.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    envRef.current = envTexture;
    Object.assign(scene, { environmentIntensity: 0.2 });

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.target.copy(TARGET_START);
    controls.minDistance = 5; // Restrict zoom-in minimum
    controls.maxDistance = 10; // Restrict zoom-out to keep bath area prominent
    // Restrict vertical rotation to keep bath area in view
    controls.minPolarAngle = Math.PI / 3; // 45 degrees - prevents looking too far down
    controls.maxPolarAngle = Math.PI / 2.02; // ~78 degrees - prevents looking too far up
    // Tighter horizontal rotation limit to keep focus on bath area
    controls.minAzimuthAngle = -Math.PI / 8; // -30 degrees (reduced from -45)
    controls.maxAzimuthAngle = Math.PI / 8;  // +30 degrees (reduced from +45)
    controls.update();

    const reset = () => {
      camera.position.copy(CAMERA_START);
      controls.target.copy(TARGET_START);
      controls.update();
    };
    onReady(reset);

    // ---------- Lighting ----------
    scene.add(new THREE.HemisphereLight(0xfff8e7, 0x827568, 1.0));
    const hemiLight = new THREE.HemisphereLight(
      0xfff8e7, // Creamy ivory sky
      0x827568, // Warm taupe ground
      1.1,
    );
    scene.add(hemiLight);
    const sun = new THREE.DirectionalLight(0xf5e6cc, 2.5);
    sun.position.set(4, 6, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -9;
    sun.shadow.camera.right = 9;
    sun.shadow.camera.top = 9;
    sun.shadow.camera.bottom = -9;
    sun.shadow.radius = 4;
    sun.shadow.bias = -0.0001;
    scene.add(sun);

    // Recessed ceiling lights inside the alcove washing the stone panel.
    const downlightXs = [-ALCOVE_HALF_WIDTH * 0.5, 0, ALCOVE_HALF_WIDTH * 0.5];
    downlightXs.forEach((lx) => {
      const downlight = new THREE.SpotLight(0xffddaa, 6, 10, Math.PI / 3, 1, 2);
      downlight.position.set(lx, ALCOVE_HEIGHT - 0.08, -6.3);
      downlight.target.position.set(lx, 1.4, ALCOVE_BACK_Z);
      scene.add(downlight, downlight.target);
    });

    // ---------- Floor ----------
    const FLOOR_BACK_Z = -6.5; // tucks under the bath platform
    const floorWidth = ROOM_HALF_WIDTH * 2;
    const floorDepth = ROOM_FRONT_Z - FLOOR_BACK_Z;
    const floorTexture = createFloorTile();
    floorTexture.repeat.set(floorWidth / 1.2, floorDepth / 1.2);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(floorWidth, floorDepth),
      new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.55 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = FLOOR_BACK_Z + floorDepth / 2;
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

    const wallMaterial = new THREE.MeshStandardMaterial({
      color: palette.wall,
      roughness: 0.96,
    });
    const trimMaterial = new THREE.MeshStandardMaterial({
      color: palette.trim,
      roughness: 0.6,
      side: THREE.DoubleSide,
    });

    // Back wall: narrow side segments plus a header above the wide alcove opening.
    const sideWidth = ROOM_HALF_WIDTH - ALCOVE_HALF_WIDTH;
    const alcoveWidth = ALCOVE_HALF_WIDTH * 2;
    const alcoveMidZ = -5 - ALCOVE_DEPTH / 2;
    addPlane(
      sideWidth,
      6,
      -(ALCOVE_HALF_WIDTH + sideWidth / 2),
      3,
      -5,
      wallMaterial,
    );
    addPlane(
      sideWidth,
      6,
      ALCOVE_HALF_WIDTH + sideWidth / 2,
      3,
      -5,
      wallMaterial,
    );
    addPlane(
      alcoveWidth,
      6 - ALCOVE_HEIGHT,
      0,
      ALCOVE_HEIGHT + (6 - ALCOVE_HEIGHT) / 2,
      -5,
      wallMaterial,
    );

    // Deep recessed alcove: white returns, ceiling and a pale veined stone panel.
    addPlane(
      alcoveWidth,
      ALCOVE_HEIGHT,
      0,
      ALCOVE_HEIGHT / 2,
      -5 - ALCOVE_DEPTH,
      trimMaterial,
    );
    addPlane(
      ALCOVE_DEPTH,
      ALCOVE_HEIGHT,
      -ALCOVE_HALF_WIDTH,
      ALCOVE_HEIGHT / 2,
      alcoveMidZ,
      trimMaterial,
      Math.PI / 2,
    );
    addPlane(
      ALCOVE_DEPTH,
      ALCOVE_HEIGHT,
      ALCOVE_HALF_WIDTH,
      ALCOVE_HEIGHT / 2,
      alcoveMidZ,
      trimMaterial,
      -Math.PI / 2,
    );
    addPlane(
      alcoveWidth,
      ALCOVE_DEPTH,
      0,
      ALCOVE_HEIGHT,
      alcoveMidZ,
      trimMaterial,
      0,
      Math.PI / 2,
    );
    const marblePanel = addPlane(
      alcoveWidth - 0.7,
      4.3,
      0,
      2.3,
      -5 - ALCOVE_DEPTH + 0.005,
      new THREE.MeshStandardMaterial({ map: createMarble(), roughness: 0.45 }),
    );

    // Wall-tile planes covering the three inner walls of the wet area (hidden until a tile is chosen).
    const makeTileMaterial = () =>
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const tileBack = addPlane(
      alcoveWidth,
      ALCOVE_HEIGHT,
      0,
      ALCOVE_HEIGHT / 2,
      -5 - ALCOVE_DEPTH + 0.004,
      makeTileMaterial(),
    );
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
    scene.add(
      box(
        0.14,
        ALCOVE_HEIGHT + 0.12,
        0.06,
        palette.trim,
        -ALCOVE_HALF_WIDTH - 0.07,
        ALCOVE_HEIGHT / 2 + 0.06,
        -4.97,
      ),
    );
    scene.add(
      box(
        0.14,
        ALCOVE_HEIGHT + 0.12,
        0.06,
        palette.trim,
        ALCOVE_HALF_WIDTH + 0.07,
        ALCOVE_HEIGHT / 2 + 0.06,
        -4.97,
      ),
    );
    scene.add(
      box(
        alcoveWidth + 0.28,
        0.14,
        0.06,
        palette.trim,
        0,
        ALCOVE_HEIGHT + 0.07,
        -4.97,
      ),
    );

    // Shower base / bath platform filling the floor of the alcove, with a low front lip.
    scene.add(
      box(
        alcoveWidth,
        0.12,
        ALCOVE_DEPTH + 0.5,
        0xf9f8f5,
        0,
        0.06,
        -5 - ALCOVE_DEPTH / 2 + 0.25,
        0.03,
      ),
    );

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

    // Side walls: short cut-away walls on each side of the bath area, running from the back wall
    // to the front of the room.
    const sideWallLength = ROOM_FRONT_Z - BACK_WALL_Z;
    const sideWallCenterZ = (ROOM_FRONT_Z + BACK_WALL_Z) / 2;
    const makeSideWall = (x: number, rotationY: number) => {
      const texture = createMarble();
      texture.repeat.set(sideWallLength / 4, 1);
      const wall = new THREE.Mesh(
        new THREE.PlaneGeometry(sideWallLength, 6),
        new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.45,
          side: THREE.DoubleSide,
        }),
      );
      wall.position.set(x, 3, sideWallCenterZ);
      wall.rotation.y = rotationY;
      wall.receiveShadow = true;
      scene.add(wall);
    };
    makeSideWall(-ROOM_HALF_WIDTH, Math.PI / 2); // left wall
    makeSideWall(ROOM_HALF_WIDTH, -Math.PI / 2); // right wall

    // Baseboards for the back wall strips and both side walls.
    scene.add(
      box(
        sideWidth,
        0.22,
        0.08,
        palette.base,
        -(ALCOVE_HALF_WIDTH + sideWidth / 2),
        0.11,
        -4.96,
      ),
    );
    scene.add(
      box(
        sideWidth,
        0.22,
        0.08,
        palette.base,
        ALCOVE_HALF_WIDTH + sideWidth / 2,
        0.11,
        -4.96,
      ),
    );
    scene.add(
      box(
        0.08,
        0.22,
        sideWallLength,
        palette.base,
        -ROOM_HALF_WIDTH + 0.04,
        0.11,
        sideWallCenterZ,
      ),
    );
    scene.add(
      box(
        0.08,
        0.22,
        sideWallLength,
        palette.base,
        ROOM_HALF_WIDTH - 0.04,
        0.11,
        sideWallCenterZ,
      ),
    );

    // ---------- Placed assets ----------
    const assetGroup = new THREE.Group();
    assetGroupRef.current = assetGroup;
    scene.add(assetGroup);

    // Static decor so the outer walls aren't blank (not selectable or draggable):
    // tiled vanity wall, vanity, mirror, lights and towels.
    const decor = buildBathroomDecor({
      rightWallX: RIGHT_WALL_X,
      backWallZ: BACK_WALL_Z,
      frontWallZ: ROOM_FRONT_Z,
      alcoveHalfWidth: ALCOVE_HALF_WIDTH,
      wallHeight: 6,
      envMap: envTexture,
    });
    scene.add(decor);

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
      corner: boolean;
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

    const pickItem = (): {
      group: THREE.Group;
      point: THREE.Vector3;
    } | null => {
      const hits = raycaster.intersectObjects(assetGroup.children, true);
      // Glass is see-through for picking: prefer whatever is behind it, fall back to the door itself.
      const hit =
        hits.find((candidate) => !candidate.object.userData.glass) ?? hits[0];
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

      // Locked items (the tubs): select them (shows the colour toolbar) but never drag them.
      // We don't stop propagation, so orbiting still works when dragging over them.
      if (hit && hit.group.userData.locked) {
        onSelectRef.current(hit.group.userData.uid as number);
        return;
      }

      let canDrag = false;
      if (hit) {
        if (hit.group.userData.mount === "wall") {
          // Wall items drag across the face of their wall, so they also move up and down.
          setWallPlane(hit.group);
        } else if (hit.group.userData.mount === "corner") {
          // Corner items drag on the alcove's back wall plane: sideways picks the corner, vertical sets the height.
          dragPlane.normal.set(0, 0, 1);
          dragPlane.constant = -ALCOVE_BACK_Z;
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
          corner: hit.group.userData.mount === "corner",
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
          let angle = Math.atan2(
            hitPoint.x - rotating.position.x,
            hitPoint.z - rotating.position.z,
          );
          // Hold Shift to snap to 15° steps.
          if (event.shiftKey)
            angle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
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
            const snapped = snapToWall(
              nx,
              nz,
              (drag.object.userData.halfWidth as number) ?? 0.4,
            );
            const minY = (drag.object.userData.minY as number) ?? 0;
            const maxY = (drag.object.userData.maxY as number) ?? 4;
            const top = snapped.alcove ? ALCOVE_HEIGHT - 0.1 : 5.9;
            const y = clampRange(
              hitPoint.y + drag.offsetY,
              0.1 - minY,
              top - maxY,
            );
            drag.object.position.set(snapped.x, y, snapped.z);
            drag.object.rotation.y = snapped.rotation;
          } else if (drag.corner) {
            const snapped = snapToCorner(nx, ALCOVE_BACK_Z);
            const minY = (drag.object.userData.minY as number) ?? 0;
            const maxY = (drag.object.userData.maxY as number) ?? 4;
            const y = clampRange(
              hitPoint.y + drag.offsetY,
              0.1 - minY,
              ALCOVE_HEIGHT - 0.1 - maxY,
            );
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
        const overHandle =
          handle.visible && raycaster.intersectObject(handle).length > 0;
        const over = pickItem();
        const movable = !!over && !over.group.userData.locked;
        canvasEl.style.cursor = overHandle || movable ? "grab" : "";
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
        const { object, moved, wall, corner } = drag;
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
            wall || corner ? object.rotation.y : undefined,
            wall || corner ? object.position.y : undefined,
          );
        }
        return;
      }
      if (backgroundDown) {
        const distance = Math.hypot(
          event.clientX - backgroundDown.x,
          event.clientY - backgroundDown.y,
        );
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

      const selected =
        selectedRef.current !== null
          ? objectsRef.current.get(selectedRef.current)
          : undefined;
      if (
        selected &&
        selected.userData.mount === "floor" &&
        !selected.userData.locked
      ) {
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
      // The decor mirror owns its own render target; free it before disposing the scene.
      (decor.userData.dispose as (() => void) | undefined)?.();
      disposeObject(scene);
      objectsRef.current.clear();
      assetGroupRef.current = null;
      tilePlanesRef.current = [];
      marbleRef.current = null;
      tileTexturesRef.current = [];
      envRef.current = null;
    };
  }, [onReady]);

  // Apply (or clear) the wall tile on the three inner walls of the wet area.
  useEffect(() => {
    const planes = tilePlanesRef.current;
    const marble = marbleRef.current;
    if (!planes.length || !marble) return;

    tileTexturesRef.current.forEach((texture) => texture.dispose());
    tileTexturesRef.current = [];

    const design = wallTile
      ? wallTiles.find((tile) => tile.id === wallTile)
      : undefined;
    marble.visible = !design;

    let cancelled = false;
    const loader = new THREE.TextureLoader();

    planes.forEach(({ mesh, width, height }) => {
      mesh.visible = !!design;
      if (!design) return;

      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.roughness = design.roughness;

      console.log('Loading texture:', design.name, 'URL:', design.url);

      loader.load(
        design.url,
        (texture) => {
          if (cancelled) {
            texture.dispose();
            return;
          }
          console.log('✓ Loaded:', design.name);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.anisotropy = 8;
          texture.repeat.set(width / design.world[0], height / design.world[1]);
          mat.map = texture;
          mat.needsUpdate = true;
          tileTexturesRef.current.push(texture);
        },
        undefined,
        (error) => {
          console.error('✗ Failed to load:', design.name, 'URL:', design.url, 'Error:', error);
        }
      );
    });

    return () => {
      cancelled = true;
    };
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
        object.userData.locked = !!assetById[item.type].locked;
        object.userData.halfWidth = assetById[item.type].halfWidth ?? 0.4;
        assetGroup.add(object);
        objects.set(item.uid, object);
      }
      object.position.set(item.x, item.y, item.z);
      object.rotation.y = item.rotation;
      const itemCategory = assetById[item.type].category;
      if (itemCategory === "Bathtubs") {
        applyTubColor(object, item.color ?? tubColors[0].hex);
      } else if (
        itemCategory === "Fixtures" ||
        itemCategory === "Grab bars" ||
        itemCategory === "Shower doors" ||
        itemCategory === "Accessories"
      ) {
        const finish =
          fixtureFinishes.find((f) => f.hex === item.color) ??
          fixtureFinishes[0];
        applyFinish(object, finish);
      }
      if (
        itemCategory === "Shower doors" ||
        itemCategory === "Accessories" ||
        itemCategory === "Fixtures" ||
        itemCategory === "Grab bars"
      )
        applyDoorReflections(object, envRef.current);
      if (itemCategory === "Bathtubs")
        applyCeramicReflections(object, envRef.current);
    });
  }, [items]);

  // Highlight the selected item.
  useEffect(() => {
    objectsRef.current.forEach((object, uid) => {
      const isSelected = uid === selectedUid;
      object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];
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

  return (
    <div
      ref={mountRef}
      className="room-canvas"
      aria-label="Interactive 3D bathroom preview"
    />
  );
}

function App() {
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
    setPlacedItems((current) => {
      // Check if this asset is already placed
      const existingItem = current.find((item) => item.type === asset.id);

      if (existingItem) {
        // If clicking the same asset again, remove it (deselect)
        setSelectedUid(null);
        showToast(`${asset.name} removed`, 1400);
        return current.filter((item) => item.type !== asset.id);
      }

      // Remove any other items from the same category (mutually exclusive)
      const filteredItems = current.filter((item) => {
        const itemAsset = assetById[item.type];
        // Accessories can be combined; every other category allows one item at a time.
        return (
          asset.category === "Accessories" ||
          itemAsset.category !== asset.category
        );
      });

      // Add the new item
      uidRef.current += 1;
      const uid = uidRef.current;
      let [x, z] = asset.home;
      let rotation = asset.homeRotation ?? 0;

      if (asset.mount === "wall") {
        const hw = asset.halfWidth ?? 0.4;
        const snapped = snapToWall(x, z, hw);
        x = snapped.x;
        z = snapped.z;
        rotation = snapped.rotation;
      } else if (asset.mount === "corner") {
        const snapped = snapToCorner(x, z);
        x = snapped.x;
        z = snapped.z;
        rotation = snapped.rotation;
      } else {
        const next = clampFloor(x, z);
        x = next.x;
        z = next.z;
      }

      setSelectedUid(uid);
      showToast(`${asset.name} added to the bathroom`, 1800);
      return [
        ...filteredItems,
        {
          uid,
          type: asset.id,
          x,
          z,
          rotation,
          y: 0,
          color: asset.defaultColor,
        },
      ];
    });
  };

  const moveItem = (
    uid: number,
    x: number,
    z: number,
    rotation?: number,
    y?: number,
  ) => {
    setPlacedItems((current) =>
      current.map((item) =>
        item.uid === uid
          ? {
              ...item,
              x,
              z,
              rotation: rotation ?? item.rotation,
              y: y ?? item.y,
            }
          : item,
      ),
    );
  };

  const rotateItem = (uid: number, rotation: number) => {
    setPlacedItems((current) =>
      current.map((item) => (item.uid === uid ? { ...item, rotation } : item)),
    );
  };

  /** Floor items that aren't locked can be rotated. */
  const canRotateItem = (item: PlacedAsset) => {
    const asset = assetById[item.type];
    return asset.mount === "floor" && !asset.locked;
  };

  const rotateSelected = () => {
    if (selectedUid === null) return;
    setPlacedItems((current) =>
      current.map((item) =>
        item.uid === selectedUid && canRotateItem(item)
          ? { ...item, rotation: item.rotation + Math.PI / 4 }
          : item,
      ),
    );
  };

  const applyWallTile = (tile: WallTileDesign) => {
    const next = wallTile === tile.id ? null : tile.id;
    setWallTile(next);
    showToast(
      next
        ? `${tile.name} applied to the bath area walls`
        : "Original stone panel restored",
      1800,
    );
  };

  const recolorItem = (uid: number, color: number) => {
    setPlacedItems((current) =>
      current.map((item) => (item.uid === uid ? { ...item, color } : item)),
    );
  };

  const removeSelected = () => {
    if (selectedUid === null) return;
    setPlacedItems((current) =>
      current.filter((item) => item.uid !== selectedUid),
    );
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
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
        return;
      if (event.key === "Escape") {
        setSelectedUid(null);
      } else if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedUid !== null
      ) {
        event.preventDefault();
        setPlacedItems((current) =>
          current.filter((item) => item.uid !== selectedUid),
        );
        setSelectedUid(null);
      } else if (
        (event.key === "r" || event.key === "R") &&
        selectedUid !== null
      ) {
        setPlacedItems((current) =>
          current.map((item) =>
            item.uid === selectedUid &&
            assetById[item.type].mount === "floor" &&
            !assetById[item.type].locked
              ? { ...item, rotation: item.rotation + Math.PI / 4 }
              : item,
          ),
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedUid]);

  const selectedItem = placedItems.find((item) => item.uid === selectedUid);
  const selectedAsset = selectedItem ? assetById[selectedItem.type] : undefined;
  const canRotate =
    selectedAsset?.mount === "floor" && !selectedAsset.locked;
  // Floating swatch bar: tub colours for bathtubs, metal finishes for fixtures.
  const swatches: { id: string; name: string; hex: number }[] | null =
    selectedAsset?.category === "Bathtubs"
      ? tubColors
      : selectedAsset?.category === "Fixtures" ||
          selectedAsset?.category === "Grab bars" ||
          selectedAsset?.category === "Shower doors" ||
          (selectedAsset?.category === "Accessories" &&
            selectedAsset.id !== "showerShelf")
        ? fixtureFinishes
        : null;
  const swatchLabel =
    selectedAsset?.category === "Bathtubs" ? "Tub colour" : "Finish";
  const showColorToolbar = !!swatches && !!selectedItem;
  const activeSwatch = selectedItem?.color ?? swatches?.[0]?.hex;
  const activeSwatchName =
    swatches?.find((c) => c.hex === activeSwatch)?.name ?? "";

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
              aria-label={
                sidebarOpen ? "Collapse asset library" : "Open asset library"
              }
            >
              <ChevronDown size={18} />
            </button>
          </div>

          <div className="categories-list">
            {categories.map((cat) => {
              return (
                <div key={cat} className="category-section">
                  <div className="category-header">
                    <span className="category-name">{cat}</span>
                    <small className="category-count">
                      {cat === "Wall tiles"
                        ? wallTiles.length
                        : assets.filter((a) => a.category === cat).length}{" "}
                      items
                    </small>
                  </div>

                  <div className="asset-grid">
                    {cat === "Wall tiles"
                      ? wallTiles.map((tile) => {
                          const Icon = tile.icon;
                          return (
                            <button
                              key={tile.id}
                              type="button"
                              className={`asset-card ${wallTile === tile.id ? "selected" : ""}`}
                              onClick={() => applyWallTile(tile)}
                            >
                              <span
                                className="asset-visual"
                                style={{
                                  background: tile.preview,
                                  color: tile.iconColor,
                                }}
                              >
                                <Icon size={46} strokeWidth={1.3} />
                                <span className="add-mark">
                                  {wallTile === tile.id ? "✓" : "+"}
                                </span>
                              </span>
                              <strong>{tile.name}</strong>
                              <small>{tile.detail}</small>
                            </button>
                          );
                        })
                      : assets
                          .filter((a) => a.category === cat)
                          .map((asset) => {
                            const Icon = asset.icon;
                            const isPlaced = placedItems.some(
                              (item) => item.type === asset.id,
                            );
                            return (
                              <button
                                key={asset.id}
                                type="button"
                                className={`asset-card ${isPlaced ? "selected" : ""}`}
                                onClick={() => addAsset(asset)}
                              >
                                <span className={`asset-visual ${asset.tone}`}>
                                  <Icon size={46} strokeWidth={1.3} />
                                  <span className="add-mark">
                                    {isPlaced ? "✓" : "+"}
                                  </span>
                                </span>
                                <strong>{asset.name}</strong>
                                <small>{asset.detail}</small>
                              </button>
                            );
                          })}
                  </div>
                </div>
              );
            })}
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
              <button
                type="button"
                onClick={removeLast}
                disabled={!placedItems.length}
                title="Undo last item"
              >
                <Undo2 size={17} />
                <span>Undo</span>
              </button>
              <button
                type="button"
                onClick={clearRoom}
                disabled={!placedItems.length}
                title="Clear room"
              >
                <Trash2 size={17} />
                <span>Clear</span>
              </button>
              <button
                type="button"
                onClick={() => resetCameraRef.current()}
                title="Reset camera"
              >
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
            {!placedItems.length && !wallTile && (
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
              <span>
                Drag a piece to move (wall pieces slide up and down too);
                bathtubs are fixed in place
              </span>
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
                        boxShadow: active
                          ? "0 0 0 2px #fff, 0 0 0 4px #2f6f5e"
                          : "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    />
                  );
                })}
                <small style={{ minWidth: 86, opacity: 0.7 }}>
                  {activeSwatchName}
                </small>
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