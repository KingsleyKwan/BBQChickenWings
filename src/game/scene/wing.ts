import * as THREE from "three";

/**
 * MagicaVoxel-style 3D pixel 中翼 / wingette.
 * Cubes, limited palette, two parallel bones, cut-end marrow holes.
 */

export const VOX = 0.014;
const LX = 24;
const LY = 5;
const LZ = 15;

const KIND = {
  skin: 0,
  meat: 1,
  fat: 2,
  bone: 3,
  marrow: 4,
  cut: 5,
  cart: 6,
} as const;

/** Raw palette. Cook tints these in paintMidWing. */
const PALETTE: [number, number, number][] = [
  [0.95, 0.82, 0.74], // skin
  [0.9, 0.58, 0.5], // meat
  [0.93, 0.78, 0.4], // fat
  [0.94, 0.9, 0.8], // bone
  [0.42, 0.16, 0.14], // marrow
  [0.91, 0.66, 0.58], // cut
  [0.93, 0.86, 0.78], // cart
];

const FACE_DIR: [number, number, number][] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
const FACE_SHADE = [0.84, 0.7, 1, 0.52, 0.9, 0.76];

function hash3(x: number, y: number, z: number) {
  return ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0;
}

function dither(k: number, x: number, y: number, z: number): [number, number, number] {
  const p = PALETTE[k];
  const h = hash3(x, y, z);
  const t = ((h & 255) / 255 - 0.5) * 0.07;
  return [p[0] + t, p[1] + t * 0.7, p[2] + t * 0.5];
}

function voxelKind(x: number, y: number, z: number): number | null {
  const u = x / (LX - 1);
  const mid = Math.sin(Math.PI * u);
  const cz = z - (LZ - 1) / 2;
  const cy = y - 1.7;
  const hw = 2.5 + Math.pow(mid, 0.68) * 4.7 + (u < 0.16 ? 0.9 : 0) + (u > 0.86 ? 0.5 : 0);
  if (Math.abs(cz) > hw + 0.02) return null;
  const leading = cz > 0.15;
  const maxY = (leading ? 0.85 : 0.5) + mid * (leading ? 0.95 : 0.55);
  const minY = -(0.95 + mid * 0.75 + (leading ? 0.2 : 0));
  if (cy > maxY + 0.12 || cy < minY - 0.12) return null;
  if (!leading && Math.abs(cz) > hw * 0.7 && cy > 0.35) return null;

  const isCut = x === 0 || x === LX - 1;
  const marrowA = z === 4 && y === 1;
  const marrowB = z === 10 && y === 1;
  const boneCol = (z === 4 || z === 5 || z === 9 || z === 10) && (y === 1 || y === 2);

  if (isCut && (marrowA || marrowB)) return KIND.marrow;
  if (boneCol) return KIND.bone;
  if (isCut) {
    if (y === 0 || y === LY - 1 || Math.abs(cz) > hw - 0.9) return KIND.cart;
    return KIND.cut;
  }
  if (cy >= maxY - 0.5 || cy <= minY + 0.4) return KIND.skin;
  if (leading && cy > 0.05 && Math.abs(cz) > 1.6) return KIND.fat;
  return KIND.meat;
}

function fillGrid(): Uint8Array {
  const g = new Uint8Array(LX * LY * LZ);
  g.fill(255);
  for (let x = 0; x < LX; x++) {
    for (let y = 0; y < LY; y++) {
      for (let z = 0; z < LZ; z++) {
        const k = voxelKind(x, y, z);
        if (k == null) continue;
        g[x + y * LX + z * LX * LY] = k;
      }
    }
  }
  return g;
}

function at(g: Uint8Array, x: number, y: number, z: number) {
  if (x < 0 || y < 0 || z < 0 || x >= LX || y >= LY || z >= LZ) return 255;
  return g[x + y * LX + z * LX * LY];
}

function worldPos(x: number, y: number, z: number): [number, number, number] {
  return [(x + 0.5 - LX / 2) * VOX, (y + 0.5 - 1.7) * VOX, (z + 0.5 - LZ / 2) * VOX];
}

/** Face-culled voxel mesh. One BufferGeometry, vertex colors, per-face normals. */
export function makeMidWingGeo(): THREE.BufferGeometry {
  const grid = fillGrid();
  const pos: number[] = [];
  const nrm: number[] = [];
  const col: number[] = [];
  const kind: number[] = [];
  const shade: number[] = [];
  const idx: number[] = [];

  const corners: [number, number, number][][] = [
    [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
    ],
    [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
      [0, 0, 0],
    ],
    [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
    [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
  ];

  for (let x = 0; x < LX; x++) {
    for (let y = 0; y < LY; y++) {
      for (let z = 0; z < LZ; z++) {
        const k = at(grid, x, y, z);
        if (k === 255) continue;
        const [r0, g0, b0] = dither(k, x, y, z);
        for (let f = 0; f < 6; f++) {
          const [dx, dy, dz] = FACE_DIR[f];
          if (at(grid, x + dx, y + dy, z + dz) !== 255) continue;
          const s = FACE_SHADE[f];
          const base = pos.length / 3;
          for (const c of corners[f]) {
            pos.push((x + c[0] - LX / 2) * VOX, (y + c[1] - 1.7) * VOX, (z + c[2] - LZ / 2) * VOX);
            nrm.push(dx, dy, dz);
            col.push(r0 * s, g0 * s, b0 * s);
            kind.push(k);
            shade.push(s);
          }
          idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute("kind", new THREE.Float32BufferAttribute(kind, 1));
  geo.setAttribute("shade", new THREE.Float32BufferAttribute(shade, 1));
  geo.setIndex(idx);
  return geo;
}

let sharedMeatGeo: THREE.BufferGeometry | null = null;
let sharedGlazeGeo: THREE.BufferGeometry | null = null;

function meatGeo() {
  if (!sharedMeatGeo) sharedMeatGeo = makeMidWingGeo();
  return sharedMeatGeo;
}

function glazeGeo() {
  if (!sharedGlazeGeo) {
    sharedGlazeGeo = meatGeo().clone();
    sharedGlazeGeo.scale(1.04, 1.08, 1.04);
  }
  return sharedGlazeGeo;
}

function voxelMat(opts?: { roughness?: number }) {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: opts?.roughness ?? 0.72,
    metalness: 0,
    flatShading: true,
    emissive: new THREE.Color(0x2a1810),
    emissiveIntensity: 0.06,
  });
}

export function assembleMidWing(opts?: { uniqueGeo?: boolean }): THREE.Group {
  const grp = new THREE.Group();
  const geo = opts?.uniqueGeo ? meatGeo().clone() : meatGeo();
  const meat = new THREE.Mesh(geo, voxelMat());
  meat.name = "meat";
  grp.add(meat);

  const glazeMat = new THREE.MeshPhysicalMaterial({
    color: 0xc47a12,
    roughness: 0.12,
    metalness: 0.08,
    transmission: 0.35,
    thickness: 0.03,
    transparent: true,
    opacity: 0,
    emissive: 0x3a1800,
    emissiveIntensity: 0,
    clearcoat: 0.8,
    clearcoatRoughness: 0.12,
    side: THREE.FrontSide,
    depthWrite: false,
    vertexColors: true,
  });
  const glaze = new THREE.Mesh(opts?.uniqueGeo ? glazeGeo().clone() : glazeGeo(), glazeMat);
  glaze.name = "glaze";
  glaze.visible = false;
  grp.add(glaze);

  const [ax, ay, az] = worldPos(12, 4, 10);
  const [bx, by, bz] = worldPos(12, 4, 4);
  const tA = new THREE.Object3D();
  tA.name = "targetA";
  tA.position.set(ax, ay + VOX * 0.2, az);
  grp.add(tA);
  const tB = new THREE.Object3D();
  tB.name = "targetB";
  tB.position.set(bx, by + VOX * 0.2, bz);
  grp.add(tB);

  return grp;
}

/** Tiny voxel lump inside a closed bag. */
export function assemblePileWing(marinated = false): THREE.Group {
  const grp = new THREE.Group();
  const geo = new THREE.BoxGeometry(VOX, VOX, VOX);
  const pal = marinated ? [0.62, 0.38, 0.22] : [0.93, 0.78, 0.68];
  const count = 28;
  const mesh = new THREE.InstancedMesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(pal[0], pal[1], pal[2]),
      roughness: marinated ? 0.4 : 0.7,
      flatShading: true,
    }),
    count,
  );
  mesh.name = "meat";
  const dummy = new THREE.Object3D();
  let i = 0;
  for (let x = 0; x < 7 && i < count; x++) {
    for (let z = 0; z < 4 && i < count; z++) {
      const y = (x + z) % 2 === 0 ? 0 : 1;
      dummy.position.set((x - 3) * VOX, (y - 0.4) * VOX, (z - 1.5) * VOX * 1.1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      i++;
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  grp.add(mesh);
  return grp;
}

export function paintMidWing(
  mesh: THREE.Mesh,
  heat: number,
  char: number,
  honey: number,
  faceA: number,
  faceB: number,
  innerShade = 0,
  innerSign = 0,
) {
  const g = mesh.geometry as THREE.BufferGeometry;
  const pos = g.attributes.position;
  const kinds = g.attributes.kind as THREE.BufferAttribute | undefined;
  const shades = g.attributes.shade as THREE.BufferAttribute | undefined;
  let col = g.attributes.color as THREE.BufferAttribute;
  if (!col) {
    col = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3);
    g.setAttribute("color", col);
  }
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const x = pos.getX(i);
    const k = kinds ? Math.round(kinds.getX(i)) : KIND.skin;
    const s = shades ? shades.getX(i) : 1;
    const pal = PALETTE[k] ?? PALETTE[KIND.skin];
    const face = y > 0.004 ? faceA : faceB;
    const cookable = k === KIND.bone || k === KIND.marrow || k === KIND.cart ? 0.12 : 1;
    const cook = Math.min(1, (heat * 0.55 + face * 0.55) * cookable);
    let r = pal[0] - cook * 0.42 - char * 0.48 * cookable + honey * 0.1;
    let gch = pal[1] - cook * 0.38 - char * 0.46 * cookable + honey * 0.04;
    let b = pal[2] - cook * 0.34 - char * 0.36 * cookable;
    if (k === KIND.marrow) {
      r = pal[0] * (1 - cook * 0.2);
      gch = pal[1] * (1 - cook * 0.2);
      b = pal[2] * (1 - cook * 0.15);
    }
    r *= s;
    gch *= s;
    b *= s;
    if (innerShade > 0.01 && innerSign !== 0) {
      const t = THREE.MathUtils.clamp((x * innerSign) / 0.09 + 0.35, 0, 1);
      const sh = innerShade * t * t;
      r *= 1 - sh * 0.5;
      gch *= 1 - sh * 0.45;
      b *= 1 - sh * 0.35;
    }
    col.setXYZ(i, Math.max(0.03, r), Math.max(0.02, gch), Math.max(0.015, b));
  }
  col.needsUpdate = true;
}
