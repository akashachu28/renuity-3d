import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

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

const TUB_LENGTH = 4.8;
const TUB_DEPTH = 2.8;
const TUB_HEIGHT = 1.1;

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

/** Soft silicone spray nozzles (light grey rubber, not metal) on a shower face, facing down. */
function addRubberNozzles(
  group: THREE.Group,
  cx: number,
  cy: number,
  cz: number,
  radius: number,
) {
  const geometry = new THREE.CylinderGeometry(0.011, 0.013, 0.014, 10);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xf1f3f4,
    roughness: 0.65,
    metalness: 0,
  });
  const rings: [number, number][] = [
    [0, 1],
    [0.25, 6],
    [0.5, 12],
    [0.75, 18],
    [0.95, 24],
  ];
  rings.forEach(([r, count]) => {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + r;
      const nozzle = new THREE.Mesh(geometry, mat);
      nozzle.position.set(
        cx + Math.cos(angle) * r * radius,
        cy,
        cz + Math.sin(angle) * r * radius,
      );
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

/** Tag a mesh as a paintable tub surface. */
function paint<T extends THREE.Mesh>(mesh: T, kind: "body" | "basin") {
  mesh.userData.paint = kind;
  return mesh;
}

/* -------------------------------------------------------------------------- */
/*  Ceramic alcove tub                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Footprint of a rounded rectangle, described in world X/Z terms.
 * hw = half width (X), hd = half depth (Z), rf = radius of the two front
 * (+z) corners, rb = radius of the two back (-z) corners.
 */
type RoundedRect = {
  hw: number;
  hd: number;
  rf: number;
  rb: number;
  /** How far the middle of the front (+z) edge bows outward. */
  bowF?: number;
  /** How far the middle of the back (-z) edge bows outward. */
  bowB?: number;
};

const BEVEL_SIZE = 0.03;
const BEVEL_THICKNESS = 0.03;

function growRect(rect: RoundedRect, delta: number): RoundedRect {
  return {
    ...rect,
    hw: rect.hw + delta,
    hd: rect.hd + delta,
    rf: Math.max(rect.rf + delta, 0.02),
    rb: Math.max(rect.rb + delta, 0.02),
  };
}

/**
 * Traces the footprint on a Shape/Path. The shape's Y axis is the negative of
 * world Z (it ends up that way after the extrusion is rotated upright), so the
 * "front" of the tub is shape -Y.
 */
function roundedRectPath<T extends THREE.Path>(path: T, rect: RoundedRect): T {
  const { hw, hd, rf, rb, bowF = 0, bowB = 0 } = rect;
  path.moveTo(-hw + rf, -hd);
  if (bowF) path.quadraticCurveTo(0, -hd - 2 * bowF, hw - rf, -hd);
  else path.lineTo(hw - rf, -hd);
  path.quadraticCurveTo(hw, -hd, hw, -hd + rf);
  path.lineTo(hw, hd - rb);
  path.quadraticCurveTo(hw, hd, hw - rb, hd);
  if (bowB) path.quadraticCurveTo(0, hd + 2 * bowB, -hw + rb, hd);
  else path.lineTo(-hw + rb, hd);
  path.quadraticCurveTo(-hw, hd, -hw, hd - rb);
  path.lineTo(-hw, -hd + rf);
  path.quadraticCurveTo(-hw, -hd, -hw + rf, -hd);
  return path;
}

let glazeMap: THREE.CanvasTexture | null = null;

/** Very subtle roughness variation so the glaze never looks like perfect plastic. */
function getGlazeMap() {
  if (!glazeMap) {
    glazeMap = paintTexture(256, 256, (ctx, w, h) => {
      const rand = rng(7);
      ctx.fillStyle = "#f4f4f4";
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i += 1) {
        const g = Math.floor(205 + rand() * 50);
        ctx.fillStyle = `rgba(${g},${g},${g},0.45)`;
        const s = 2 + rand() * 9;
        ctx.fillRect(rand() * w, rand() * h, s, s);
      }
    });
    glazeMap.colorSpace = THREE.NoColorSpace;
  }
  return glazeMap;
}

/** Glossy glazed ceramic: low roughness, strong clearcoat, plenty of env reflection. */
function ceramicMaterial(color: number, roughness = 0.14) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    roughnessMap: getGlazeMap(),
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.035,
    ior: 1.52,
    specularIntensity: 1,
    envMapIntensity: 1.35,
  });
}

function ceramicMesh(geometry: THREE.BufferGeometry, kind: "body" | "basin") {
  const mesh = new THREE.Mesh(
    geometry,
    ceramicMaterial(kind === "body" ? palette.porcelain : palette.basin),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return paint(mesh, kind);
}

/**
 * Rounded-edge hollow ring (outer footprint with a hole) spanning y0..y1.
 * Bevels round both the outer edges and the rim of the opening.
 */
function ceramicRing(
  outer: RoundedRect,
  hole: RoundedRect,
  y0: number,
  y1: number,
) {
  const shape = roundedRectPath(
    new THREE.Shape(),
    growRect(outer, -BEVEL_SIZE),
  );
  shape.holes.push(
    roundedRectPath(new THREE.Path(), growRect(hole, BEVEL_SIZE)),
  );
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: y1 - y0 - 2 * BEVEL_THICKNESS,
    bevelEnabled: true,
    bevelSize: BEVEL_SIZE,
    bevelThickness: BEVEL_THICKNESS,
    bevelSegments: 5,
    curveSegments: 14,
    steps: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y0 + BEVEL_THICKNESS, 0);
  return toCreasedNormals(geometry, Math.PI / 3);
}

/** Flat slab that forms the basin floor. */
function ceramicSlab(rect: RoundedRect, height: number) {
  const shape = roundedRectPath(new THREE.Shape(), rect);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    curveSegments: 14,
  });
  geometry.rotateX(-Math.PI / 2);
  return toCreasedNormals(geometry, Math.PI / 3);
}

/** Concave quarter-round that blends the basin walls into the floor. */
function ceramicFillet(inner: RoundedRect, floorY: number, radius: number) {
  const steps = 8;
  const loops: { points: THREE.Vector2[]; y: number }[] = [];
  for (let k = 0; k <= steps; k += 1) {
    const a = (k / steps) * (Math.PI / 2);
    const offset = radius * (1 - Math.cos(a));
    const points = roundedRectPath(
      new THREE.Path(),
      growRect(inner, -offset),
    ).getPoints(10);
    loops.push({ points, y: floorY + radius - radius * Math.sin(a) });
  }

  const count = loops[0].points.length;
  const positions: number[] = [];
  loops.forEach(({ points, y }) => {
    points.forEach((p) => positions.push(p.x, y, -p.y));
  });

  const index: number[] = [];
  for (let k = 0; k < steps; k += 1) {
    for (let j = 0; j < count - 1; j += 1) {
      const a = k * count + j;
      const b = a + 1;
      const c = a + count;
      const d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(index);
  geometry.computeVertexNormals();

  // Make sure the surface faces up/into the basin; flip the winding if not.
  if (geometry.attributes.normal.getY(steps * count + 2) < 0) {
    for (let i = 0; i < index.length; i += 3) {
      const tmp = index[i + 1];
      index[i + 1] = index[i + 2];
      index[i + 2] = tmp;
    }
    geometry.setIndex(index);
    geometry.computeVertexNormals();
  }
  return geometry;
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

type TubConfig = {
  L: number;
  D: number;
  H: number;
  wall: number;
  floorH: number;
  /** Height of the recessed plinth the tub sits on (0 = none). */
  plinth: number;
  bodyRf: number;
  bodyRb: number;
  /** Outward bow of the front / back apron. */
  bowF: number;
  bowB: number;
  innerR: number;
  drainOffset: number;
  /** "ends": lines rise at both ends. "step": lines step down from left to right. */
  profile: "ends" | "step";
  /** [low, rise] of each contour line, as fractions of the apron height. */
  lines: [number, number][];
  /** Which long sides get contour lines: 1 = front, -1 = back. */
  sides: (1 | -1)[];
};

const ALCOVE_TUB: TubConfig = {
  L: TUB_LENGTH - 0.04,
  D: 2.4, // shallower than the alcove so the shower door fits in front
  H: TUB_HEIGHT,
  wall: 0.24,
  floorH: 0.3,
  plinth: 0,
  bodyRf: 0.26,
  bodyRb: 0.05,
  bowF: 0.1,
  bowB: 0,
  innerR: 0.45,
  drainOffset: 0.9,
  profile: "ends",
  lines: [
    [0.31, 0.1],
    [0.236, 0.1],
  ],
  sides: [1],
};

const FREESTANDING_TUB: TubConfig = {
  L: TUB_LENGTH - 0.04, // wall to wall, same as the alcove tub
  D: 2.2,
  H: TUB_HEIGHT,
  wall: 0.24,
  floorH: 0.38,
  plinth: 0.1,
  bodyRf: 0.55,
  bodyRb: 0.55,
  bowF: 0.08,
  bowB: 0.08,
  innerR: 0.55,
  drainOffset: 0.9,
  profile: "step",
  lines: [
    [0.36, 0.28],
    [0.26, 0.28],
  ],
  sides: [1, -1],
};

/**
 * Glazed ceramic tub modelled on the reference photos: a smooth apron with
 * parallel contour lines, a slightly proud top rim, softly rounded corners, an
 * outward-bowed apron and a deep rounded basin. Used for both the alcove and
 * the freestanding tub.
 */
function buildCeramicTub(group: THREE.Group, cfg: TubConfig) {
  const { L, D, H, wall, floorH, plinth } = cfg;
  const lipInset = 0; // no separate top border, so the body is full size

  const inner: RoundedRect = {
    hw: L / 2 - wall,
    hd: D / 2 - wall,
    rf: cfg.innerR,
    rb: cfg.innerR,
  };
  const bodyOuter: RoundedRect = {
    hw: L / 2 - lipInset,
    hd: D / 2 - lipInset,
    rf: cfg.bodyRf,
    rb: cfg.bodyRb,
    bowF: cfg.bowF,
    bowB: cfg.bowB,
  };

  // Recessed plinth under the apron (freestanding tub).
  if (plinth > 0) {
    const plinthRect: RoundedRect = {
      hw: bodyOuter.hw - 0.12,
      hd: bodyOuter.hd - 0.12,
      rf: Math.max(bodyOuter.rf - 0.12, 0.1),
      rb: Math.max(bodyOuter.rb - 0.12, 0.1),
    };
    group.add(ceramicMesh(ceramicSlab(plinthRect, plinth + 0.02), "body"));
  }

  // One continuous body from the base to the rim (no separate top border).
  group.add(ceramicMesh(ceramicRing(bodyOuter, inner, plinth, H), "body"));

  // Basin floor and the concave blend into the walls.
  group.add(
    ceramicMesh(ceramicSlab(growRect(inner, 0.02), floorH), "basin"),
  );
  group.add(ceramicMesh(ceramicFillet(inner, floorH, 0.12), "basin"));

  // Contour lines that follow the bowed apron.
  const beadRadius = 0.013;
  const xFlat = bodyOuter.hw - bodyOuter.rf; // end of the flat/bowed front face
  const extent = xFlat - 0.05;
  const span = H - plinth;

  const makeBead = (lowFrac: number, riseFrac: number, side: 1 | -1) => {
    const low = plinth + lowFrac * span;
    const rise = riseFrac * span;
    const bow = side > 0 ? cfg.bowF : cfg.bowB;
    const segments = 140;
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i += 1) {
      const x = -extent + (2 * extent * i) / segments;
      const u = x * side; // mirror on the back so it reads the same from behind
      let s: number;
      if (cfg.profile === "ends") {
        const center = extent - 0.45;
        s = smoothstep(center - 0.24, center + 0.24, Math.abs(x));
      } else {
        const center = -0.08 * L;
        const half = 0.14 * L;
        s = 1 - smoothstep(center - half, center + half, u);
      }
      const z = side * (bodyOuter.hd + bow * (1 - (x / xFlat) ** 2));
      points.push(new THREE.Vector3(x, low + rise * s, z));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    group.add(
      ceramicMesh(
        new THREE.TubeGeometry(curve, 220, beadRadius, 10, false),
        "body",
      ),
    );
    [points[0], points[points.length - 1]].forEach((p) => {
      const cap = ceramicMesh(
        new THREE.SphereGeometry(beadRadius, 12, 10),
        "body",
      );
      cap.position.copy(p);
      group.add(cap);
    });
  };
  cfg.sides.forEach((side) => {
    cfg.lines.forEach(([low, rise]) => makeBead(low, rise, side));
  });

  // Drain and overflow.
  const drainX = -L / 2 + cfg.drainOffset;
  group.add(tube(0.1, 0.02, "y", drainX, floorH + 0.012, 0));
  group.add(tube(0.065, 0.024, "y", drainX, floorH + 0.013, 0, palette.dark));
  group.add(tube(0.04, 0.03, "y", drainX, floorH + 0.02, 0));

  const overflowX = -inner.hw + 0.012;
  group.add(tube(0.11, 0.024, "x", overflowX, H - 0.3, 0));
  group.add(tube(0.05, 0.03, "x", overflowX + 0.004, H - 0.3, 0, palette.dark));
}

/** Sliding shower door that stands on the bath platform: one fixed panel plus one sliding panel. */
function buildShowerDoor(group: THREE.Group, frosted: boolean) {
  const width = 4.72;
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

  const add = (mesh: THREE.Mesh) => {
    mesh.userData.shiny = true;
    group.add(mesh);
  };

  group.add(panel(2.2, -1.26, 0));
  group.add(panel(2.6, 1.06, 0.07));
  group.add(streaks(2.2, -1.26, 0));
  group.add(streaks(2.6, 1.06, 0.07));

  add(metalBox(width, 0.08, 0.14, palette.chrome, 0, top + 0.04, 0.035, 0.015));
  add(metalBox(width, 0.08, 0.16, palette.chrome, 0, 0.16, 0.035, 0.015));

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

  [0.7, 1.7, 2.7, 3.7].forEach((y) => {
    add(metalBox(0.05, 0.16, 0.16, palette.chrome, -2.385, y, 0, 0.01));
  });

  [0.1, 1.9].forEach((x) => {
    add(metalBox(0.05, 0.2, 0.04, palette.chrome, x, top - 0.1, 0.1, 0.008));
    add(tube(0.05, 0.03, "z", x, top - 0.02, 0.13));
  });

  add(tube(0.025, 1.0, "y", -0.12, 2.7, 0.19));
  [2.3, 3.1].forEach((y) => {
    add(tube(0.015, 0.14, "z", -0.12, y, 0.12));
  });
}

export function createAsset(type: AssetId) {
  const group = new THREE.Group();

  switch (type) {
    case "alcoveTub": {
      buildCeramicTub(group, ALCOVE_TUB);
      break;
    }

    case "freeTub": {
      buildCeramicTub(group, FREESTANDING_TUB);
      break;
    }

    case "rainShower": {
      // Wall mixer: round plate with a boss and an L-shaped lever.
      group.add(tube(0.2, 0.04, "z", 0, 2.5, 0.02));
      group.add(tube(0.14, 0.03, "z", 0, 2.5, 0.055));
      group.add(tube(0.07, 0.12, "z", 0, 2.5, 0.12));
      group.add(metalBox(0.22, 0.055, 0.07, palette.chrome, 0.1, 2.5, 0.19, 0.02));
      group.add(metalBox(0.055, 0.4, 0.07, palette.chrome, 0.19, 2.33, 0.19, 0.02));

      // Gooseneck arm: leaves the wall plate on a rise, arches over and drops to the head.
      group.add(tube(0.12, 0.04, "z", 0, 3.35, 0.02));
      group.add(tube(0.075, 0.06, "z", 0, 3.35, 0.065));
      const arm = new THREE.Mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 3.35, 0.05),
            new THREE.Vector3(0, 3.5, 0.15),
            new THREE.Vector3(0, 3.85, 0.34),
            new THREE.Vector3(0, 4.2, 0.52),
            new THREE.Vector3(0, 4.4, 0.72),
            new THREE.Vector3(0, 4.42, 0.88),
            new THREE.Vector3(0, 4.34, 0.98),
            new THREE.Vector3(0, 4.2, 1.0),
          ]),
          96,
          0.038,
          18,
        ),
        metalMaterial(palette.chrome),
      );
      arm.castShadow = true;
      arm.userData.finish = true;
      group.add(arm);

      // Swivel joint between the arm and the head.
      group.add(ball(0.055, 0, 4.17, 1.0));
      group.add(tube(0.04, 0.1, "y", 0, 4.11, 1.0));

      // Slim round rain head: lathed profile with a rounded polished rim, a soft top and a
      // light grey silicone spray plate. Tilted so the spray points down and slightly forward.
      const head = new THREE.Group();
      head.position.set(0, 4.03, 1.0);
      head.rotation.x = -0.18;
      const rimMaterial = metalMaterial(palette.chrome);
      rimMaterial.side = THREE.DoubleSide;
      const rim = new THREE.Mesh(
        new THREE.LatheGeometry(
          [
            new THREE.Vector2(0.0, 0.04),
            new THREE.Vector2(0.2, 0.043),
            new THREE.Vector2(0.3, 0.04),
            new THREE.Vector2(0.34, 0.03),
            new THREE.Vector2(0.36, 0.012),
            new THREE.Vector2(0.36, -0.012),
            new THREE.Vector2(0.345, -0.03),
            new THREE.Vector2(0.325, -0.036),
          ],
          72,
        ),
        rimMaterial,
      );
      rim.castShadow = true;
      rim.userData.finish = true;
      head.add(rim);
      const sprayPlate = new THREE.Mesh(
        new THREE.CylinderGeometry(0.325, 0.325, 0.012, 64),
        new THREE.MeshStandardMaterial({
          color: 0xdfe3e6,
          roughness: 0.55,
          metalness: 0,
        }),
      );
      sprayPlate.position.y = -0.03;
      sprayPlate.receiveShadow = true;
      head.add(sprayPlate);
      addRubberNozzles(head, 0, -0.042, 0, 0.29);
      group.add(head);

      // Give every metal part a mirror-like polish so it picks up real reflections.
      group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.userData.finish) {
          child.userData.shiny = true;
        }
      });

      group.add(hitBox(0.8, 0.3, 0.8, 0, 4.05, 1.0));
      group.add(hitBox(0.6, 0.7, 0.35, 0.08, 2.5, 0.15));
      group.add(hitBox(0.3, 1.3, 1.1, 0, 3.8, 0.5));
      break;
    }

    case "handShower": {
      // Slide rail with square wall brackets at the top and bottom.
      const railX = 0;
      const railZ = 0.12;
      group.add(tube(0.037, 2.0, "y", railX, 2.8, railZ));
      group.add(ball(0.037, railX, 3.8, railZ));
      group.add(ball(0.037, railX, 1.8, railZ));
      [3.65, 1.95].forEach((y) => {
        group.add(metalBox(0.17, 0.19, 0.1, palette.chrome, railX, y, 0.05, 0.012));
      });

      // Slider: sleeve around the rail plus a horizontal barrel that holds the handset.
      const sliderY = 2.84;
      group.add(tube(0.062, 0.16, "y", railX, sliderY, railZ));
      group.add(tube(0.057, 0.34, "x", 0.04, sliderY, railZ));
      group.add(ball(0.04, -0.12, sliderY, railZ)); // lock button
      group.add(tube(0.045, 0.05, "y", 0.18, sliderY + 0.06, railZ)); // collar

      // Handset: slim round handle topped by a round multi-hole head facing the room.
      const headX = 0.18;
      group.add(tube(0.034, 0.4, "y", headX, 3.1, railZ));
      group.add(tube(0.17, 0.07, "z", headX, 3.45, railZ)); // head body
      group.add(tube(0.15, 0.02, "z", headX, 3.45, railZ + 0.03)); // front lip
      group.add(tube(0.135, 0.012, "z", headX, 3.45, railZ + 0.04, palette.steel)); // spray plate
      addNozzles(group, headX, 3.45, railZ + 0.048, 0.115, "front");

      // Braided hose: leaves the handle base, swings down into a big loop and returns up
      // to a wall outlet with a conical end.
      const hoseZ = 0.2;
      const hose = new THREE.Mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3([
            new THREE.Vector3(headX, 2.8, railZ),
            new THREE.Vector3(headX, 2.7, 0.17),
            new THREE.Vector3(0.17, 2.55, hoseZ),
            new THREE.Vector3(0.12, 2.25, hoseZ),
            new THREE.Vector3(0.08, 2.05, hoseZ),
            new THREE.Vector3(0.1, 1.85, hoseZ),
            new THREE.Vector3(0.2, 1.73, hoseZ),
            new THREE.Vector3(0.34, 1.71, hoseZ),
            new THREE.Vector3(0.48, 1.78, hoseZ),
            new THREE.Vector3(0.57, 1.92, hoseZ),
            new THREE.Vector3(0.57, 2.1, hoseZ),
            new THREE.Vector3(0.51, 2.3, hoseZ),
            new THREE.Vector3(0.46, 2.5, hoseZ),
            new THREE.Vector3(0.45, 2.58, hoseZ),
          ]),
          140,
          0.016,
          10,
        ),
        metalMaterial(palette.steel),
      );
      hose.castShadow = true;
      group.add(hose);

      // Wall outlet for the hose: plate, short stem and a conical hose end.
      group.add(flange(0.45, 2.6, 0.07));
      group.add(tube(0.03, 0.2, "z", 0.45, 2.6, 0.1));
      group.add(ball(0.04, 0.45, 2.6, hoseZ));
      group.add(taperTube(0.04, 0.022, 0.14, "y", 0.45, 2.68, hoseZ));

      group.add(hitBox(0.9, 2.3, 0.6, 0.25, 2.8, 0.2));
      break;
    }

    case "showerShelf": {
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
        const bottle = new THREE.Mesh(
          new THREE.CylinderGeometry(r, r, h, 24),
          material(color, 0.5),
        );
        bottle.position.set(x, 2.025 + h / 2, 0.16);
        bottle.castShadow = true;
        group.add(bottle);
        group.add(tube(r * 0.45, 0.07, "y", x, 2.025 + h + 0.035, 0.16));
      });
      group.add(hitBox(1.3, 0.8, 0.45, 0, 2.3, 0.2));
      break;
    }

    case "nicheBox": {
      const Wn = 1.6;
      const Hn = 0.7;
      const D = 0.32;
      const t = 0.05;
      const Y = 2.5;
      const part = (
        w: number,
        h: number,
        d: number,
        x: number,
        y: number,
        z: number,
      ) => {
        const mesh = metalBox(w, h, d, palette.chrome, x, y, z, 0.006);
        mesh.userData.shiny = true;
        group.add(mesh);
      };
      part(Wn, Hn, 0.03, 0, Y, 0.015);
      part(Wn, t, D, 0, Y + Hn / 2 - t / 2, D / 2);
      part(Wn, t, D, 0, Y - Hn / 2 + t / 2, D / 2);
      part(t, Hn, D, -Wn / 2 + t / 2, Y, D / 2);
      part(t, Hn, D, Wn / 2 - t / 2, Y, D / 2);
      part(0.04, Hn - 2 * t, D, 0, Y, D / 2);
      group.add(hitBox(Wn, Hn, D + 0.05, 0, Y, D / 2));
      break;
    }

    case "cornerShelf": {
      const L = 1.1;
      const W = 0.45;
      const Y = 2.2;
      const T = 0.04;
      const rail = 0.28;
      const R = 0.035;
      const part = (
        w: number,
        h: number,
        d: number,
        x: number,
        y: number,
        z: number,
      ) => {
        const mesh = metalBox(w, h, d, palette.chrome, x, y, z, 0.006);
        mesh.userData.shiny = true;
        group.add(mesh);
      };

      part(W, T, W, W / 2, Y, W / 2);
      for (let x = W + 0.045; x < L - 0.05; x += 0.09)
        part(0.05, T, W, x, Y, W / 2);
      for (let z = W + 0.045; z < L - 0.05; z += 0.09)
        part(W, T, 0.05, W / 2, Y, z);
      part(0.05, T, W, L - 0.025, Y, W / 2);
      part(W, T, 0.05, W / 2, Y, L - 0.025);

      const AH = 0.13;
      const AY = Y - 0.045;
      part(L - W, AH, 0.03, W + (L - W) / 2, AY, W - 0.015);
      part(0.03, AH, W, L - 0.015, AY, W / 2);
      part(0.03, AH, L - W, W - 0.015, AY, W + (L - W) / 2);
      part(W, AH, 0.03, W / 2, AY, L - 0.015);
      part(L, AH, 0.02, L / 2, AY, 0.01);
      part(0.02, AH, L, 0.01, AY, L / 2);

      const RY = Y + rail;
      part(L - W, R, R, W + (L - W) / 2, RY, W - 0.02);
      part(R, R, W, L - 0.02, RY, W / 2);
      part(R, R, L - W, W - 0.02, RY, W + (L - W) / 2);
      part(W, R, R, W / 2, RY, L - 0.02);
      part(L, R, R, L / 2, RY, 0.02);
      part(R, R, L, 0.02, RY, L / 2);
      [
        [W - 0.02, W - 0.02],
        [L - 0.02, W - 0.02],
        [L - 0.02, 0.02],
        [W - 0.02, L - 0.02],
        [0.02, L - 0.02],
        [0.02, 0.02],
      ].forEach(([px, pz]) => {
        const post = tube(0.016, rail, "y", px, Y + rail / 2, pz);
        post.userData.shiny = true;
        group.add(post);
      });

      group.add(hitBox(L, 0.5, L, L / 2, Y + 0.1, L / 2));
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
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.075, 0.014, 8, 24),
          metalMaterial(palette.chrome),
        );
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
      const angle = 0.6;
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
      group.add(
        ball(0.045, Math.sin(angle) * half, 1.7 + Math.cos(angle) * half, 0.3),
      );
      group.add(
        ball(0.045, -Math.sin(angle) * half, 1.7 - Math.cos(angle) * half, 0.3),
      );
      group.add(hitBox(0.9, 1.3, 0.45, 0, 1.7, 0.22));
      break;
    }
  }

  return group;
}