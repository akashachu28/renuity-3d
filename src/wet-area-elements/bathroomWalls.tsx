import * as THREE from "three";

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

/** Pale veined stone panel for the back of the alcove. */
export function createMarble() {
  return paintTexture(1024, 832, (ctx, w, h) => {
    const rand = rng(7);
    ctx.fillStyle = "#ebe0c9";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i += 1) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 90 + rand() * 240;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(
        0,
        rand() < 0.5 ? "rgba(205,192,172,0.14)" : "rgba(255,255,255,0.05)",
      );
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
      ctx.strokeStyle =
        rand() < 0.5 ? "rgba(255,255,255,0.18)" : "rgba(160,148,132,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * 4, y + 6 + rand() * 30);
      ctx.stroke();
    }
  });
}

/** Large pale floor tile with fine grout lines. */
export function createFloorTile() {
  return paintTexture(256, 256, (ctx, w, h) => {
    const rand = rng(11);
    ctx.fillStyle = "#ddd7cc";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i += 1) {
      ctx.fillStyle =
        rand() < 0.5 ? "rgba(255,255,255,0.12)" : "rgba(150,138,120,0.07)";
      ctx.fillRect(rand() * w, rand() * h, 2, 2);
    }
    ctx.strokeStyle = "#c6bfb2";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, w, h);
  });
}

function material(color: number, roughness = 0.82, metalness = 0.04) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

export function box(
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

type WallsConfig = {
  ROOM_HALF_WIDTH: number;
  ROOM_FRONT_Z: number;
  BACK_WALL_Z: number;
  ALCOVE_HALF_WIDTH: number;
  ALCOVE_DEPTH: number;
  ALCOVE_HEIGHT: number;
  ALCOVE_BACK_Z: number;
  downlightXs: number[];
};

export function buildBathroomWalls(
  scene: THREE.Scene,
  config: WallsConfig,
): {
  tilePlanes: { mesh: THREE.Mesh; width: number; height: number }[];
  marblePanel: THREE.Mesh;
} {
  const {
    ROOM_HALF_WIDTH,
    ROOM_FRONT_Z,
    BACK_WALL_Z,
    ALCOVE_HALF_WIDTH,
    ALCOVE_DEPTH,
    ALCOVE_HEIGHT,
    ALCOVE_BACK_Z,
    downlightXs,
  } = config;

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

  const tilePlanes = [
    { mesh: tileBack, width: alcoveWidth, height: ALCOVE_HEIGHT },
    { mesh: tileLeft, width: ALCOVE_DEPTH, height: ALCOVE_HEIGHT },
    { mesh: tileRight, width: ALCOVE_DEPTH, height: ALCOVE_HEIGHT },
  ];

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

  // Side walls: short cut-away walls on each side of the bath area
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

  return { tilePlanes, marblePanel };
}

export function buildFloor(
  scene: THREE.Scene,
  config: { ROOM_HALF_WIDTH: number; ROOM_FRONT_Z: number },
): void {
  const { ROOM_HALF_WIDTH, ROOM_FRONT_Z } = config;
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
}
