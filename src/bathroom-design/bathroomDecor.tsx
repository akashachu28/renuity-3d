import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";

/**
 * Static (non-interactive) decor for the outer walls of the bathroom:
 *  - the right wall tiled in glossy sage vertical tiles
 *  - a floating, polished-oak wash-basin vanity with a marble top, undermount basin and black tap
 *  - an oval mirror that shows a real reflection of the room
 *  - warm wall sconces, a soft spot light and an under-cabinet glow
 *  - a hand towel on a ring and a bath towel on a bar, both with a terry-cloth texture
 *
 * Nothing here is added to the interactive asset group, so it can't be picked or dragged.
 */

export type BathroomDecorOptions = {
  /** x of the right wall surface. */
  rightWallX?: number;
  /** z of the back wall surface (the wall beside the alcove). */
  backWallZ?: number;
  /** z where the right wall ends at the front of the room. */
  frontWallZ?: number;
  /** Height of the right wall. */
  wallHeight?: number;
  /** Half width of the alcove (bath area); the bath towel hangs on the wall strip between it and the right wall. */
  alcoveHalfWidth?: number;
  /** z of the vanity centre along the right wall. */
  vanityZ?: number;
  /** x of the hanging bath towel on the back wall (defaults to the middle of the wall strip). */
  towelX?: number;
  /** Scene environment map: gives the wood, marble, tile and metal real reflections. */
  envMap?: THREE.Texture | null;
  /** Multiplier for the vanity lights (sconces, spot, under-cabinet glow). */
  lightScale?: number;
};

const SAGE = 0x9ba58f;
const BLACK = 0x1d1e20;

// ---------------------------------------------------------------------------------------------
// Procedural textures
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
  srgb = true,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

/** Honey oak with long, slightly wavy fibres and fine pores. */
function createWoodTexture() {
  return paintTexture(1024, 1024, (ctx, w, h) => {
    const rand = rng(5);
    const base = ctx.createLinearGradient(0, 0, w, 0);
    base.addColorStop(0, "#c6975e");
    base.addColorStop(0.5, "#d2a672");
    base.addColorStop(1, "#c3925a");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    // Broad tonal streaks (drawn twice so they wrap).
    for (let i = 0; i < 40; i += 1) {
      const x = rand() * w;
      const bandWidth = 12 + rand() * 90;
      ctx.fillStyle = rand() < 0.5 ? `rgba(110,70,32,${0.03 + rand() * 0.06})` : `rgba(255,228,188,${0.04 + rand() * 0.07})`;
      ctx.fillRect(x, 0, bandWidth, h);
      ctx.fillRect(x - w, 0, bandWidth, h);
    }

    // Fibres that wander gently along the grain.
    for (let i = 0; i < 2600; i += 1) {
      const x = rand() * w;
      const y0 = rand() * h;
      const length = 120 + rand() * 500;
      const wobble = 2 + rand() * 8;
      const phase = rand() * 6.28;
      ctx.strokeStyle =
        rand() < 0.65 ? `rgba(105,66,30,${0.04 + rand() * 0.14})` : `rgba(255,236,205,${0.04 + rand() * 0.1})`;
      ctx.lineWidth = 0.5 + rand() * 1.5;
      ctx.beginPath();
      for (let s = 0; s <= length; s += 20) {
        const y = y0 + s;
        const xx = x + Math.sin(y * 0.006 + phase) * wobble + Math.sin(y * 0.021 + phase * 3) * wobble * 0.25;
        if (s === 0) ctx.moveTo(xx, y);
        else ctx.lineTo(xx, y);
      }
      ctx.stroke();
    }

    // Pores.
    for (let i = 0; i < 1800; i += 1) {
      ctx.fillStyle = `rgba(90,56,26,${0.05 + rand() * 0.12})`;
      ctx.fillRect(rand() * w, rand() * h, 1, 2 + rand() * 7);
    }
  });
}

/** White marble with soft grey-brown veining for the counter. */
function createMarbleTop() {
  return paintTexture(1024, 512, (ctx, w, h) => {
    const rand = rng(17);
    ctx.fillStyle = "#f2f0eb";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i += 1) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 70 + rand() * 200;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, rand() < 0.5 ? "rgba(190,184,176,0.16)" : "rgba(255,255,255,0.1)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.lineCap = "round";
    for (let i = 0; i < 14; i += 1) {
      let x = rand() * w;
      let y = rand() * h;
      let angle = (rand() - 0.5) * 1.6 + 0.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const steps = 24 + Math.floor(rand() * 30);
      for (let s = 0; s < steps; s += 1) {
        angle += (rand() - 0.5) * 0.7;
        x += Math.cos(angle) * (10 + rand() * 18);
        y += Math.sin(angle) * (10 + rand() * 18);
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(120,112,104,${0.1 + rand() * 0.22})`;
      ctx.lineWidth = 0.6 + rand() * 1.8;
      ctx.stroke();
    }
  });
}

/** Tiny terry-cloth loops; used both as colour and as bump so the towel reads as woven cotton. */
function createTerryTexture() {
  return paintTexture(256, 256, (ctx, w, h) => {
    const rand = rng(41);
    ctx.fillStyle = "#cfcfcf";
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 64; row += 1) {
      for (let col = 0; col < 64; col += 1) {
        const cx = col * 4 + 2 + (rand() - 0.5) * 2.2;
        const cy = row * 4 + 2 + (rand() - 0.5) * 2.2;
        ctx.fillStyle = rand() < 0.55 ? `rgba(255,255,255,${0.35 + rand() * 0.4})` : `rgba(90,90,90,${0.2 + rand() * 0.3})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 1.2 + rand() * 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(70,70,70,${0.15 + rand() * 0.2})`;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.arc(cx + 0.6, cy + 0.6, 1.8, 0.3, Math.PI * 1.3);
        ctx.stroke();
      }
    }
  });
}

/**
 * Glossy sage vertical tiles with slight colour variation per tile, bevelled edges and recessed
 * grout. Returns a colour map and a matching bump map.
 */
function createTilePair() {
  const cols = 4;
  const rows = 2;
  const width = 512;
  const height = 1024;
  const tileW = width / cols;
  const tileH = height / rows;
  const gap = 5;

  const colorMap = paintTexture(width, height, (ctx) => {
    const rand = rng(77);
    ctx.fillStyle = "#d8d5cb"; // grout
    ctx.fillRect(0, 0, width, height);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x = col * tileW + gap / 2;
        const y = row * tileH + gap / 2;
        const w = tileW - gap;
        const h = tileH - gap;
        const lightness = 52 + (rand() - 0.5) * 8;
        const hue = 104 + (rand() - 0.5) * 8;
        ctx.fillStyle = `hsl(${hue}, 15%, ${lightness}%)`;
        ctx.fillRect(x, y, w, h);

        // Glaze: soft highlight from the top-left, a little depth toward the bottom-right.
        const glaze = ctx.createLinearGradient(x, y, x + w, y + h);
        glaze.addColorStop(0, "rgba(255,255,255,0.16)");
        glaze.addColorStop(0.45, "rgba(255,255,255,0)");
        glaze.addColorStop(1, "rgba(0,0,0,0.08)");
        ctx.fillStyle = glaze;
        ctx.fillRect(x, y, w, h);

        // Bevelled edges.
        ctx.fillStyle = "rgba(255,255,255,0.28)";
        ctx.fillRect(x, y, w, 3);
        ctx.fillRect(x, y, 3, h);
        ctx.fillStyle = "rgba(0,0,0,0.16)";
        ctx.fillRect(x, y + h - 3, w, 3);
        ctx.fillRect(x + w - 3, y, 3, h);
      }
    }
  });

  const bumpMap = paintTexture(
    width,
    height,
    (ctx) => {
      ctx.fillStyle = "#2a2a2a"; // grout is recessed
      ctx.fillRect(0, 0, width, height);
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const x = col * tileW + gap / 2;
          const y = row * tileH + gap / 2;
          ctx.fillStyle = "#d0d0d0";
          ctx.fillRect(x + 2, y + 2, tileW - gap - 4, tileH - gap - 4);
          ctx.fillStyle = "#8a8a8a"; // bevel
          ctx.fillRect(x, y, tileW - gap, 2);
          ctx.fillRect(x, y + tileH - gap - 2, tileW - gap, 2);
          ctx.fillRect(x, y, 2, tileH - gap);
          ctx.fillRect(x + tileW - gap - 2, y, 2, tileH - gap);
        }
      }
    },
    false,
  );

  return { colorMap, bumpMap, tileWorldWidth: 0.42, cols, rows };
}

// ---------------------------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------------------------

function createMaterials(envMap: THREE.Texture | null | undefined) {
  const withEnv = <T extends THREE.MeshStandardMaterial>(material: T, intensity = 1) => {
    if (envMap) {
      material.envMap = envMap;
      material.envMapIntensity = intensity;
    }
    return material;
  };

  const woodTexture = createWoodTexture();
  const drawerTexture = woodTexture.clone();
  drawerTexture.center.set(0.5, 0.5);
  drawerTexture.rotation = Math.PI / 2; // grain runs sideways on the drawer fronts
  drawerTexture.needsUpdate = true;

  const marbleTexture = createMarbleTop();
  marbleTexture.repeat.set(0.45, 0.45);

  const tile = createTilePair();
  tile.colorMap.anisotropy = 16;

  return {
    tile,
    black: withEnv(new THREE.MeshStandardMaterial({ color: BLACK, roughness: 0.32, metalness: 1 }), 1.3),
    trim: withEnv(new THREE.MeshStandardMaterial({ color: 0xe6e1d4, roughness: 0.35, metalness: 0.6 }), 1.0),
    // Satin-lacquered oak: wood colour plus a glossy clear coat that picks up the room and lights.
    body: withEnv(
      new THREE.MeshPhysicalMaterial({
        color: 0xe6d3b4,
        map: woodTexture,
        bumpMap: woodTexture,
        bumpScale: 0.5,
        roughness: 0.5,
        clearcoat: 0.9,
        clearcoatRoughness: 0.14,
      }),
      1.1,
    ),
    drawer: withEnv(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: drawerTexture,
        bumpMap: drawerTexture,
        bumpScale: 0.5,
        roughness: 0.46,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
      }),
      1.2,
    ),
    gap: new THREE.MeshStandardMaterial({ color: 0x15100b, roughness: 0.9 }),
    marble: withEnv(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: marbleTexture,
        roughness: 0.16,
        clearcoat: 0.7,
        clearcoatRoughness: 0.06,
      }),
      1.1,
    ),
    porcelain: withEnv(
      new THREE.MeshPhysicalMaterial({
        color: 0xf8f7f3,
        roughness: 0.1,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        side: THREE.DoubleSide,
      }),
      1.0,
    ),
    wallTile: withEnv(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: tile.colorMap,
        bumpMap: tile.bumpMap,
        bumpScale: 2.5,
        roughness: 0.2,
        clearcoat: 0.8,
        clearcoatRoughness: 0.08,
      }),
      1.0,
    ),
    globe: new THREE.MeshStandardMaterial({
      color: 0xffe2b3,
      emissive: 0xffa94d,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.45,
      roughness: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    bulb: new THREE.MeshBasicMaterial({ color: 0xffc77a, toneMapped: false }),
    led: new THREE.MeshBasicMaterial({ color: 0xffd9a8, toneMapped: false }),
  };
}

type Materials = ReturnType<typeof createMaterials>;

/** Woven cotton: terry-loop colour + bump, a fabric sheen, and (optionally) vertex-colour borders. */
function createTowelMaterial(color: number, width: number, length: number, vertexColors: boolean) {
  const terry = createTerryTexture();
  terry.repeat.set(Math.max(2, width / 0.25), Math.max(2, length / 0.25));
  return new THREE.MeshPhysicalMaterial({
    color,
    map: terry,
    bumpMap: terry,
    bumpScale: 0.8,
    roughness: 1,
    metalness: 0,
    sheen: 1,
    sheenRoughness: 0.7,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.55),
    side: THREE.DoubleSide,
    vertexColors,
  });
}

// ---------------------------------------------------------------------------------------------
// Small builders
// ---------------------------------------------------------------------------------------------

function place<T extends THREE.Mesh>(mesh: T, x: number, y: number, z: number) {
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function roundedBox(
  width: number,
  height: number,
  depth: number,
  radius: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
) {
  return place(new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 4, radius), material), x, y, z);
}

/** Cylinder lying along the given axis. */
function rod(
  radius: number,
  length: number,
  axis: "x" | "y" | "z",
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 28), material);
  if (axis === "x") mesh.rotation.z = Math.PI / 2;
  if (axis === "z") mesh.rotation.x = Math.PI / 2;
  return place(mesh, x, y, z);
}

function sphere(radius: number, material: THREE.Material, x: number, y: number, z: number) {
  return place(new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), material), x, y, z);
}

/**
 * A towel folded over a bar. The group origin is the centre of the bar; the towel hangs down (-y)
 * with a front and a back layer, soft folds, woven border stripes and a terry-cloth surface.
 */
function buildTowel(options: {
  width: number;
  frontLength: number;
  backLength: number;
  color: number;
  /** Distance between the front and back layers (also the diameter of the fold at the bar). */
  gap: number;
  /** Fold amplitude. */
  amplitude: number;
  seed: number;
}) {
  const { width, frontLength, backLength, color, gap, amplitude, seed } = options;
  const group = new THREE.Group();

  const layerMaterial = createTowelMaterial(color, width, frontLength, true);
  const rollMaterial = createTowelMaterial(color, width, frontLength, false);

  const layer = (length: number, side: 1 | -1, amp: number, phase: number) => {
    const geometry = new THREE.PlaneGeometry(width, length, 16, 64);
    geometry.translate(0, -length / 2, 0);
    const position = geometry.attributes.position;
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const y = position.getY(i);
      const t = Math.min(1, -y / length); // 0 at the bar, 1 at the hem
      const folds = Math.sin(x * 7 + phase) * 0.6 + Math.sin(x * 15 + phase * 2) * 0.25;
      const z = side * (gap / 2) + amp * folds * (0.15 + t) + side * t * 0.025;
      position.setXYZ(i, x * (1 + 0.035 * t * Math.sin(phase)), y, z);

      // Darker woven border stripes near the hem and a touch of shading in the fold troughs.
      const fromHem = length + y;
      let shade = (fromHem > 0.08 && fromHem < 0.13) || (fromHem > 0.17 && fromHem < 0.2) ? 0.78 : 1;
      shade *= 0.9 + 0.1 * (0.5 + 0.5 * folds);
      colors[i * 3] = shade;
      colors[i * 3 + 1] = shade;
      colors[i * 3 + 2] = shade;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return place(new THREE.Mesh(geometry, layerMaterial), 0, 0, 0);
  };

  group.add(layer(frontLength, 1, amplitude, seed));
  group.add(layer(backLength, -1, amplitude * 0.6, seed + 2));
  group.add(rod(gap / 2, width, "x", rollMaterial, 0, 0, 0));
  return group;
}

// ---------------------------------------------------------------------------------------------
// Vanity + mirror + lighting + hand towel (wall-local frame)
// ---------------------------------------------------------------------------------------------

/**
 * Built in the same frame as the wall items: origin on the wall surface, the room is toward +z,
 * +x runs along the wall, +y is up.
 */
function buildVanityWall(mats: Materials, lightScale: number) {
  const group = new THREE.Group();
  const { black } = mats;

  const W = 2.2; // cabinet width
  const H = 0.8; // cabinet height
  const D = 1.0; // cabinet depth from the wall
  const FLOAT = 1.0; // gap under the floating cabinet
  const TOP = FLOAT + H; // top of the cabinet
  const SLAB = 0.1; // counter thickness
  const COUNTER_TOP = TOP + SLAB;

  // ----- Cabinet: polished oak body, dark reveal panel, two drawer fronts -----
  group.add(roundedBox(W, H, D, 0.02, mats.body, 0, FLOAT + H / 2, D / 2));
  group.add(roundedBox(W - 0.04, H - 0.04, 0.012, 0.004, mats.gap, 0, FLOAT + H / 2, D + 0.0));

  const drawerHeight = 0.34;
  [FLOAT + 0.2, FLOAT + H - 0.2].forEach((y) => {
    group.add(roundedBox(W - 0.08, drawerHeight, 0.04, 0.014, mats.drawer, 0, y, D + 0.005));
    // Slim black pull on each drawer.
    group.add(rod(0.018, 0.8, "x", black, 0, y, D + 0.09));
    [-0.34, 0.34].forEach((x) => group.add(rod(0.014, 0.07, "z", black, x, y, D + 0.055)));
  });

  // ----- Marble counter with an oval hole for the basin -----
  const counterWidth = W + 0.08;
  const counterDepth = D + 0.06;
  const counterCenterZ = counterDepth / 2;
  const basinZ = 0.6;
  const basinRadiusX = 0.62;
  const basinRadiusZ = 0.34;
  const bevel = 0.008;

  const shape = new THREE.Shape();
  const r = 0.04;
  const x0 = -counterWidth / 2;
  const x1 = counterWidth / 2;
  const y0 = -counterDepth / 2;
  const y1 = counterDepth / 2;
  shape.moveTo(x0 + r, y0);
  shape.lineTo(x1 - r, y0);
  shape.quadraticCurveTo(x1, y0, x1, y0 + r);
  shape.lineTo(x1, y1 - r);
  shape.quadraticCurveTo(x1, y1, x1 - r, y1);
  shape.lineTo(x0 + r, y1);
  shape.quadraticCurveTo(x0, y1, x0, y1 - r);
  shape.lineTo(x0, y0 + r);
  shape.quadraticCurveTo(x0, y0, x0 + r, y0);

  // After rotateX(-90°) shape-y becomes -z, so the hole's y is the negative of its z offset.
  const hole = new THREE.Path();
  hole.absellipse(0, -(basinZ - counterCenterZ), basinRadiusX, basinRadiusZ, 0, Math.PI * 2, true, 0);
  shape.holes.push(hole);

  const counterGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: SLAB - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 48,
  });
  counterGeometry.rotateX(-Math.PI / 2);
  counterGeometry.translate(0, bevel, 0); // the bevel adds `bevel` below the base; slab spans 0 → SLAB
  group.add(place(new THREE.Mesh(counterGeometry, mats.marble), 0, TOP, counterCenterZ));

  // ----- Undermount basin: a shallow porcelain bowl sitting in the hole -----
  const bowlProfile = [
    new THREE.Vector2(1.0, 0),
    new THREE.Vector2(0.97, -0.02),
    new THREE.Vector2(0.88, -0.055),
    new THREE.Vector2(0.7, -0.085),
    new THREE.Vector2(0.4, -0.096),
    new THREE.Vector2(0, -0.098),
  ];
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlProfile, 64), mats.porcelain);
  bowl.scale.set(basinRadiusX, 1, basinRadiusZ);
  group.add(place(bowl, 0, COUNTER_TOP, basinZ));
  group.add(rod(0.062, 0.012, "y", black, 0, TOP + 0.008, basinZ)); // drain
  group.add(rod(0.045, 0.014, "y", mats.trim, 0, TOP + 0.009, basinZ));

  // ----- Matte black deck-mounted tap with a side lever -----
  const faucetZ = 0.14;
  group.add(rod(0.075, 0.05, "y", black, 0, COUNTER_TOP + 0.025, faucetZ));
  group.add(rod(0.045, 0.55, "y", black, 0, COUNTER_TOP + 0.325, faucetZ));
  group.add(sphere(0.045, black, 0, COUNTER_TOP + 0.6, faucetZ));
  const spout = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, COUNTER_TOP + 0.6, faucetZ),
        new THREE.Vector3(0, COUNTER_TOP + 0.68, faucetZ + 0.07),
        new THREE.Vector3(0, COUNTER_TOP + 0.7, faucetZ + 0.2),
        new THREE.Vector3(0, COUNTER_TOP + 0.68, faucetZ + 0.33),
        new THREE.Vector3(0, COUNTER_TOP + 0.6, faucetZ + 0.4),
      ]),
      48,
      0.032,
      18,
    ),
    black,
  );
  spout.castShadow = true;
  group.add(spout);
  group.add(rod(0.038, 0.06, "y", black, 0, COUNTER_TOP + 0.57, faucetZ + 0.4)); // aerator
  group.add(rod(0.016, 0.26, "x", black, 0.17, COUNTER_TOP + 0.28, faucetZ)); // lever
  group.add(sphere(0.03, black, 0.3, COUNTER_TOP + 0.28, faucetZ));

  // ----- Counter styling: soap pump and a stack of washcloths -----
  const ceramic = mats.porcelain;
  group.add(rod(0.07, 0.3, "y", ceramic, -0.95, COUNTER_TOP + 0.15, 0.4));
  group.add(rod(0.02, 0.1, "y", black, -0.95, COUNTER_TOP + 0.35, 0.4));
  group.add(rod(0.012, 0.1, "z", black, -0.95, COUNTER_TOP + 0.4, 0.45));
  const clothColors = [0xf1ede4, SAGE, 0xf1ede4];
  clothColors.forEach((color, i) => {
    const cloth = roundedBox(
      0.34,
      0.05,
      0.28,
      0.015,
      createTowelMaterial(color, 0.34, 0.28, false),
      0.98 + (i - 1) * 0.01,
      COUNTER_TOP + 0.025 + i * 0.05,
      0.55,
    );
    cloth.rotation.y = (i - 1) * 0.08;
    group.add(cloth);
  });

  // ----- Oval mirror with a real planar reflection and a thin black frame -----
  const mirrorY = 3.65;
  const glassGeometry = new THREE.CircleGeometry(0.6, 96);
  glassGeometry.scale(1, 1.35, 1);
  const mirror = new Reflector(glassGeometry, {
    color: 0x8a9496,
    textureWidth: 768,
    textureHeight: 1024,
    clipBias: 0.003,
  });
  mirror.position.set(0, mirrorY, 0.03);
  group.add(mirror);

  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.03, 20, 128), black);
  frame.scale.set(1, 1.35, 1);
  group.add(place(frame, 0, mirrorY, 0.04));

  // ----- Warm wall sconces either side of the mirror (as in the reference) -----
  const sconceY = 3.6;
  [-1.05, 1.05].forEach((x) => {
    const sconce = new THREE.Group();
    sconce.position.set(x, sconceY, 0);
    sconce.add(rod(0.05, 0.02, "z", black, 0, 0.12, 0.01)); // wall plate
    sconce.add(rod(0.016, 0.26, "z", black, 0, 0.12, 0.13)); // arm
    sconce.add(rod(0.028, 0.08, "y", black, 0, 0.115, 0.26)); // socket
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 14), mats.bulb);
    bulb.position.set(0, 0, 0.26);
    sconce.add(bulb);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.13, 28, 20), mats.globe);
    globe.position.set(0, 0, 0.26);
    globe.renderOrder = 2;
    sconce.add(globe);
    group.add(sconce);

    const light = new THREE.PointLight(0xffcf94, 1.6 * lightScale, 6, 2);
    light.position.set(x, sconceY, 0.34);
    group.add(light);
  });

  // ----- Soft overhead light with a shadow, plus a warm glow under the floating cabinet -----
  const spot = new THREE.SpotLight(0xfff0d8, 14 * lightScale, 9, 0.75, 0.9, 2);
  spot.position.set(0, 5.6, 1.1);
  spot.target.position.set(0, COUNTER_TOP, 0.5);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0004;
  spot.shadow.radius = 4;
  group.add(spot, spot.target);

  const led = new THREE.Mesh(new THREE.BoxGeometry(W - 0.3, 0.012, 0.03), mats.led);
  led.position.set(0, FLOAT - 0.004, 0.12);
  group.add(led);
  const glow = new THREE.PointLight(0xffc58a, 0.7 * lightScale, 3, 2);
  glow.position.set(0, FLOAT - 0.1, 0.4);
  group.add(glow);

  // ----- Towel ring with a hand towel, beside the vanity -----
  const ringX = 1.55;
  const ringY = 3.0;
  const ringRadius = 0.2;
  const ringZ = 0.14;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ringRadius, 0.018, 16, 64), black);
  group.add(place(ring, ringX, ringY, ringZ));
  group.add(rod(0.05, 0.02, "z", black, ringX, ringY + ringRadius, 0.01)); // wall plate
  group.add(rod(0.016, ringZ, "z", black, ringX, ringY + ringRadius, ringZ / 2)); // post

  const handTowel = buildTowel({
    width: 0.38,
    frontLength: 0.62,
    backLength: 0.5,
    color: 0xf1ede4,
    gap: 0.05,
    amplitude: 0.018,
    seed: 3,
  });
  handTowel.position.set(ringX, ringY + ringRadius, ringZ);
  group.add(handTowel);

  return { group, mirror };
}

// ---------------------------------------------------------------------------------------------
// Public builder
// ---------------------------------------------------------------------------------------------

export function buildBathroomDecor(options: BathroomDecorOptions = {}) {
  const {
    rightWallX = 5.995,
    backWallZ = -4.995,
    frontWallZ = 1,
    wallHeight = 6,
    alcoveHalfWidth = 2.4,
    vanityZ = -2.8,
    envMap = null,
    lightScale = 1,
  } = options;

  const towelX = options.towelX ?? alcoveHalfWidth + (rightWallX - alcoveHalfWidth) / 2;
  const root = new THREE.Group();
  root.name = "bathroom-decor";
  const mats = createMaterials(envMap);

  // ----- Right wall tiled in glossy sage vertical tiles -----
  const wallLength = frontWallZ - backWallZ;
  const { colorMap, bumpMap, tileWorldWidth, cols, rows } = mats.tile;
  const tileTextureWidth = tileWorldWidth * cols; // world width covered by one texture repeat
  const tileTextureHeight = tileWorldWidth * 4 * rows; // tiles are 1:4
  [colorMap, bumpMap].forEach((texture) => texture.repeat.set(wallLength / tileTextureWidth, wallHeight / tileTextureHeight));

  const tiledWall = new THREE.Mesh(new THREE.PlaneGeometry(wallLength, wallHeight), mats.wallTile);
  tiledWall.position.set(rightWallX - 0.004, wallHeight / 2, (backWallZ + frontWallZ) / 2);
  tiledWall.rotation.y = -Math.PI / 2; // faces into the room; texture starts at the back corner
  tiledWall.receiveShadow = true;
  root.add(tiledWall);

  // Slim metal trim capping the free vertical edge of the tile.
  const edgeTrim = new THREE.Mesh(new THREE.BoxGeometry(0.03, wallHeight, 0.03), mats.trim);
  edgeTrim.position.set(rightWallX - 0.016, wallHeight / 2, frontWallZ - 0.015);
  edgeTrim.castShadow = true;
  root.add(edgeTrim);

  // ----- Vanity wall: local +z points into the room, local +x runs toward the front of the room -----
  const { group: vanity, mirror } = buildVanityWall(mats, lightScale);
  vanity.position.set(rightWallX - 0.006, 0, vanityZ);
  vanity.rotation.y = -Math.PI / 2;
  root.add(vanity);

  // ----- Sage bath towel on a short black bar, on the back wall right next to the alcove -----
  const barY = 3.95;
  const barZ = 0.22;
  const towelWall = new THREE.Group();
  towelWall.position.set(towelX, 0, backWallZ);
  // The bar and towel shrink to fit narrow wall strips beside the alcove.
  const barLength = Math.min(1.3, rightWallX - alcoveHalfWidth - 0.35);
  towelWall.add(rod(0.022, barLength, "x", mats.black, 0, barY, barZ));
  [-1, 1].forEach((side) => {
    const x = side * (barLength / 2 - 0.1);
    towelWall.add(rod(0.018, barZ, "z", mats.black, x, barY, barZ / 2));
    towelWall.add(rod(0.05, 0.02, "z", mats.black, x, barY, 0.01));
    towelWall.add(sphere(0.035, mats.black, side * (barLength / 2), barY, barZ));
  });
  const bathTowel = buildTowel({
    width: barLength * 0.73,
    frontLength: 1.95,
    backLength: 1.65,
    color: SAGE,
    gap: 0.09,
    amplitude: 0.05,
    seed: 1,
  });
  bathTowel.position.set(0, barY, barZ);
  towelWall.add(bathTowel);
  root.add(towelWall);

  // The mirror owns a render target; free it together with the scene.
  root.userData.dispose = () => mirror.dispose();

  return root;
}