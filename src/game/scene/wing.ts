import * as THREE from "three";

/**
 * 雞中翼 / chicken mid-wing — flat dual-lobe BBQ paddle (procedural).
 * Thin Y, wide Z, mid groove between ulna/radius; cut face from 04-cut-end.
 * Labels: 醃製中翼 / 鮮雞中翼. Grill/fork: 燒烤爐 / 長燒烤叉.
 * Not a thick roast / sausage / ham-ring cylinder.
 */

export const VOX = 0.012;

const KIND = {
  skin: 0,
  meat: 1,
  fat: 2,
  bone: 3,
  marrow: 4,
  cut: 5,
  cart: 6,
} as const;

/** Raw pale pink-cream skin / pink meat / cream fat / ivory bone / dark-pink marrow */
const PALETTE: [number, number, number][] = [
  [0.97, 0.74, 0.62], // skin
  [0.88, 0.48, 0.46], // meat
  [0.96, 0.88, 0.62], // fat
  [0.94, 0.9, 0.82], // bone
  [0.55, 0.22, 0.28], // marrow (dark pink)
  [0.9, 0.55, 0.52], // cut
  [0.93, 0.88, 0.78], // cart
];

const LEN = 0.4;
/** Half-span between the two bone centers (ulna +Z, radius −Z). */
const BONE_SEP = 0.042;
/** Lobe radii — sep < ulna so the peanut stays connected with a clear mid groove. */
const ULNA_R = 0.05;
const RADIUS_R = 0.042;
/** Overall thickness (Y) / width (Z). Flat BBQ 雞中翼 paddle (not sausage). */
const FLAT_Y = 0.22;
/** Superellipse power — flatter faces on each lobe. */
const LOBE_N = 3.3;
const STATIONS = 28;
const RADIAL = 48;
/** Extra Z stretch so the dual-lobe paddle reads wide/flat in silhouette. */
const Z_STRETCH = 1.28;

/**
 * 04-cut-end.jpg with Texture.flipY (default).
 * Ivory rings measured at about u = 0.504 ± 0.295, v = 0.486.
 */
const CUT_U = 0.504;
const CUT_V = 0.486;

function hash2(i: number, j: number) {
  return ((i * 73856093) ^ (j * 19349663)) >>> 0;
}

function ditherRgb(k: number, seed: number): [number, number, number] {
  const p = PALETTE[k];
  const t = ((seed & 255) / 255 - 0.5) * 0.04;
  return [p[0] + t, p[1] + t * 0.6, p[2] + t * 0.45];
}

function stationScale(u: number): { s: number; sep: number; groove: number } {
  // u: 0 = cut (−X), 1 = knuckle (+X). Gentle belly, no bulb at the joint.
  const belly = 1 + Math.sin(Math.PI * u) * 0.08;
  const cut = u < 0.12 ? 0.94 + (u / 0.12) * 0.06 : 1;
  const tip = u > 0.84 ? 1 - Math.pow((u - 0.84) / 0.16, 1.35) * 0.08 : 1;
  const s = belly * cut * tip;
  const sep = BONE_SEP * (0.96 + 0.08 * Math.sin(Math.PI * u));
  // Mid-body groove between ulna/radius; cut face keeps a readable peanut.
  const groove = 0.04 + 0.22 * Math.sin(Math.PI * u);
  return { s, sep, groove };
}

function inLobe(y: number, z: number, cz: number, rx: number, ry: number): boolean {
  const a = Math.abs(z - cz) / Math.max(1e-6, rx);
  const b = Math.abs(y) / Math.max(1e-6, ry);
  return a ** LOBE_N + b ** LOBE_N <= 1.001;
}

/**
 * Radial distance in the YZ plane to the fused paddle outline.
 * Each lobe is a flat superellipse; FLAT_Y sets thickness / width.
 * A waist pinch opens the mid groove between the two bones.
 */
function peanutRadius(ang: number, rU: number, rR: number, sep: number, groove: number): number {
  const dy = Math.sin(ang);
  const dz = Math.cos(ang);
  const yHalf = FLAT_Y * (sep + Math.max(rU, rR));
  const ryU = yHalf;
  const ryR = yHalf * 0.93;
  let lo = 0;
  let hi = (sep + rU + yHalf) * 2.4;
  for (let iter = 0; iter < 20; iter++) {
    const mid = (lo + hi) * 0.5;
    const y = dy * mid;
    const z = dz * mid;
    if (inLobe(y, z, sep, rU, ryU) || inLobe(y, z, -sep, rR, ryR)) lo = mid;
    else hi = mid;
  }
  // Waist pinch opens the mid groove; fascia floor keeps a thin connected bridge.
  const waist = Math.exp(-((dz * 1.55) ** 2));
  const floor = (rU + rR) * 0.12;
  return Math.max(floor, lo * (1 - waist * groove));
}

function sectionYZ(u: number, ang: number, wobble = true): { y: number; z: number } {
  const { s, sep, groove } = stationScale(u);
  let rad = peanutRadius(ang, ULNA_R * s, RADIUS_R * s, sep, groove);
  if (wobble) {
    rad *= 1 + Math.sin(u * 16 + ang * 5) * 0.01 + Math.cos(u * 9 + ang * 3) * 0.006;
  }
  // Y stays thin (FLAT_Y); Z_STRETCH widens the dual-lobe paddle silhouette.
  return { y: Math.sin(ang) * rad, z: Math.cos(ang) * rad * Z_STRETCH };
}

function tagBodyKinds(
  positions: Float32Array,
  count: number,
): { kinds: Float32Array; shades: Float32Array; colors: Float32Array } {
  const kinds = new Float32Array(count);
  const shades = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const dU = Math.hypot(y, z - BONE_SEP);
    const dR = Math.hypot(y, z + BONE_SEP);
    const d = Math.min(dU, dR);
    const rRef = dU < dR ? ULNA_R : RADIUS_R;
    let kind: number = KIND.meat;
    if (d > rRef * 0.62) kind = KIND.skin;
    else if (y > 0.004 && d < rRef * 0.48) kind = KIND.fat;
    kinds[i] = kind;
    shades[i] = 0.9 + (hash2(i, 5) & 31) / 255;
    const [cr, cg, cb] = ditherRgb(kind, hash2(i, kind));
    colors[i * 3] = cr * shades[i];
    colors[i * 3 + 1] = cg * shades[i];
    colors[i * 3 + 2] = cb * shades[i];
  }
  return { kinds, shades, colors };
}

/** Lofted 雞中翼 paddle. Cut at −X, knuckle at +X. */
export function makeMidWingGeo(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let s = 0; s <= STATIONS; s++) {
    const u = s / STATIONS;
    const x = (u - 0.5) * LEN;
    for (let i = 0; i < RADIAL; i++) {
      const ang = (i / RADIAL) * Math.PI * 2;
      const { y, z } = sectionYZ(u, ang, true);
      positions.push(x, y, z);
      uvs.push(u, i / RADIAL);
      const ny = Math.sin(ang);
      const nz = Math.cos(ang);
      const nl = Math.hypot(0.12, ny, nz) || 1;
      normals.push(0.04 / nl, ny / nl, nz / nl);
    }
  }

  for (let s = 0; s < STATIONS; s++) {
    for (let i = 0; i < RADIAL; i++) {
      const i0 = s * RADIAL + i;
      const i1 = s * RADIAL + ((i + 1) % RADIAL);
      const i2 = (s + 1) * RADIAL + i;
      const i3 = (s + 1) * RADIAL + ((i + 1) % RADIAL);
      indices.push(i0, i2, i1, i1, i2, i3);
    }
  }

  const cutCenter = positions.length / 3;
  positions.push(-LEN / 2, 0, 0);
  normals.push(-1, 0, 0);
  uvs.push(0, 0.5);
  for (let i = 0; i < RADIAL; i++) {
    const a = i;
    const b = (i + 1) % RADIAL;
    indices.push(cutCenter, b, a);
  }

  const knCenter = positions.length / 3;
  positions.push(LEN / 2, 0, 0);
  normals.push(1, 0, 0);
  uvs.push(1, 0.5);
  for (let i = 0; i < RADIAL; i++) {
    const a = STATIONS * RADIAL + i;
    const b = STATIONS * RADIAL + ((i + 1) % RADIAL);
    indices.push(knCenter, a, b);
  }

  const posArr = new Float32Array(positions);
  const { kinds, shades, colors } = tagBodyKinds(posArr, posArr.length / 3);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute("kind", new THREE.Float32BufferAttribute(kinds, 1));
  geo.setAttribute("shade", new THREE.Float32BufferAttribute(shades, 1));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Peanut cut cap matched to the loft at u = 0. UV keeps both bone rings circular. */
function makeCutCapGeo(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const rim: { y: number; z: number }[] = [];
  let maxAbsY = 0;
  let maxAbsZ = 0;
  for (let i = 0; i < RADIAL; i++) {
    const ang = (i / RADIAL) * Math.PI * 2;
    const { y, z } = sectionYZ(0, ang, false);
    rim.push({ y, z });
    maxAbsY = Math.max(maxAbsY, Math.abs(y));
    maxAbsZ = Math.max(maxAbsZ, Math.abs(z));
  }
  // Same world scale on U and V so the two ivory rings stay circles, side by side.
  const S = Math.max(maxAbsZ, 1e-4) / 0.46;
  const inset = 1.012;

  positions.push(0, 0, 0);
  normals.push(-1, 0, 0);
  uvs.push(CUT_U, CUT_V);

  for (let i = 0; i < RADIAL; i++) {
    const y = rim[i].y * inset;
    const z = rim[i].z * inset;
    positions.push(0, y, z);
    normals.push(-1, 0, 0);
    uvs.push(CUT_U + z / S, CUT_V + y / S);
  }
  for (let i = 0; i < RADIAL; i++) {
    const a = 1 + i;
    const b = 1 + ((i + 1) % RADIAL);
    // Facing −X: winding so the normal points out of the meat.
    indices.push(0, b, a);
  }

  const n = positions.length / 3;
  const kinds = new Float32Array(n).fill(KIND.cut);
  const shades = new Float32Array(n).fill(1);
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const [cr, cg, cb] = ditherRgb(KIND.cut, hash2(i, 9));
    colors[i * 3] = cr;
    colors[i * 3 + 1] = cg;
    colors[i * 3 + 2] = cb;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute("kind", new THREE.Float32BufferAttribute(kinds, 1));
  geo.setAttribute("shade", new THREE.Float32BufferAttribute(shades, 1));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  return geo;
}

/**
 * Wrinkled skin cuff at the knuckle of 雞中翼.
 * Same peanut section as the paddle tip — a short sleeve, not a round ball.
 */
function makeIrregularKnuckleGeo(): THREE.BufferGeometry {
  const { s: sc, sep, groove } = stationScale(1);
  const rU = ULNA_R * sc;
  const rR = RADIUS_R * sc;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const depth = 0.042;
  const x0 = -0.016;
  const rings = 10;
  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const x = x0 + t * depth;
    // Start inside the paddle, then ease into a short wrinkled cuff.
    const rootFit = 0.96 + 0.04 * t;
    const close = 1 - Math.pow(t, 1.8) * 0.22;
    const cart = t > 0.82 ? (t - 0.82) / 0.18 : 0;
    const fold = t * t;
    for (let i = 0; i < RADIAL; i++) {
      const ang = (i / RADIAL) * Math.PI * 2;
      let rad = peanutRadius(ang, rU, rR, sep, groove);
      const wrinkle =
        1 +
        fold *
          (0.07 * Math.sin(ang * 3 + t * 6) +
            0.045 * Math.cos(ang * 5 + t * 4) +
            0.03 * Math.sin(ang * 2 + t * 8));
      rad *= wrinkle * close * rootFit;
      if (cart > 0) rad *= 1 + cart * 0.04 * Math.max(0, Math.cos(ang * 2));
      const y = Math.sin(ang) * rad;
      const z = Math.cos(ang) * rad * Z_STRETCH * 0.96;
      positions.push(x, y, z);
      uvs.push(t, i / RADIAL);
      const ny = Math.sin(ang);
      const nz = Math.cos(ang);
      const nl = Math.hypot(0.4, ny, nz) || 1;
      normals.push(0.35 / nl, ny / nl, nz / nl);
    }
  }
  for (let r = 0; r < rings; r++) {
    for (let i = 0; i < RADIAL; i++) {
      const i0 = r * RADIAL + i;
      const i1 = r * RADIAL + ((i + 1) % RADIAL);
      const i2 = (r + 1) * RADIAL + i;
      const i3 = (r + 1) * RADIAL + ((i + 1) % RADIAL);
      indices.push(i0, i2, i1, i1, i2, i3);
    }
  }
  const attachCenter = positions.length / 3;
  positions.push(x0, 0, 0);
  normals.push(-1, 0, 0);
  uvs.push(0, 0.5);
  for (let i = 0; i < RADIAL; i++) {
    const a = i;
    const b = (i + 1) % RADIAL;
    indices.push(attachCenter, b, a);
  }
  const tipCenter = positions.length / 3;
  positions.push(x0 + depth, 0, 0);
  normals.push(1, 0, 0);
  uvs.push(1, 0.5);
  for (let i = 0; i < RADIAL; i++) {
    const a = rings * RADIAL + i;
    const b = rings * RADIAL + ((i + 1) % RADIAL);
    indices.push(tipCenter, a, b);
  }

  const posArr = new Float32Array(positions);
  const n = posArr.length / 3;
  const kinds = new Float32Array(n);
  const shades = new Float32Array(n);
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = posArr[i * 3];
    const onCart = x > x0 + depth * 0.72;
    const kind = onCart ? KIND.cart : KIND.skin;
    kinds[i] = kind;
    shades[i] = 0.9 + (hash2(i, 7) & 31) / 255;
    const [cr, cg, cb] = ditherRgb(kind, hash2(i, 11));
    const fat = !onCart && (hash2(i, 3) & 255) > 235;
    const r = onCart ? cr * 0.96 + 0.02 : fat ? 0.93 : cr;
    const gch = onCart ? cg * 0.96 + 0.02 : fat ? 0.8 : cg;
    const b = onCart ? cb * 0.96 + 0.03 : fat ? 0.6 : cb;
    colors[i * 3] = r * shades[i];
    colors[i * 3 + 1] = gch * shades[i];
    colors[i * 3 + 2] = b * shades[i];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute("kind", new THREE.Float32BufferAttribute(kinds, 1));
  geo.setAttribute("shade", new THREE.Float32BufferAttribute(shades, 1));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

let sharedMeatGeo: THREE.BufferGeometry | null = null;
let sharedGlazeGeo: THREE.BufferGeometry | null = null;
let sharedCutTex: THREE.Texture | null = null;

export function invalidateMidWingGeoCache() {
  sharedMeatGeo?.dispose();
  sharedGlazeGeo?.dispose();
  sharedMeatGeo = null;
  sharedGlazeGeo = null;
}

function meatGeo() {
  if (!sharedMeatGeo) sharedMeatGeo = makeMidWingGeo();
  return sharedMeatGeo;
}

function glazeGeo() {
  if (!sharedGlazeGeo) {
    sharedGlazeGeo = meatGeo().clone();
    sharedGlazeGeo.scale(1.02, 1.03, 1.02);
  }
  return sharedGlazeGeo;
}

function loadCutTexture(): THREE.Texture {
  if (sharedCutTex) return sharedCutTex;
  const loader = new THREE.TextureLoader();
  sharedCutTex = loader.load("/drawn-midwing/04-cut-end.jpg");
  sharedCutTex.colorSpace = THREE.SRGBColorSpace;
  sharedCutTex.wrapS = THREE.ClampToEdgeWrapping;
  sharedCutTex.wrapT = THREE.ClampToEdgeWrapping;
  sharedCutTex.anisotropy = 4;
  return sharedCutTex;
}

function meatMat() {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.58,
    metalness: 0,
    flatShading: false,
    envMapIntensity: 0.35,
    emissive: new THREE.Color(0x1a100c),
    emissiveIntensity: 0.03,
  });
}

function worldBoneTarget(zOff: number): [number, number, number] {
  return [0, 0, zOff];
}

export function assembleMidWing(opts?: { uniqueGeo?: boolean }): THREE.Group {
  const grp = new THREE.Group();
  const geo = opts?.uniqueGeo ? meatGeo().clone() : meatGeo();
  const meat = new THREE.Mesh(geo, meatMat());
  meat.name = "meat";
  meat.castShadow = true;
  meat.receiveShadow = true;
  grp.add(meat);

  const glazeMat = new THREE.MeshPhysicalMaterial({
    color: 0xc47a12,
    roughness: 0.22,
    metalness: 0.05,
    transmission: 0.3,
    thickness: 0.03,
    transparent: true,
    opacity: 0,
    emissive: 0x3a1800,
    emissiveIntensity: 0,
    clearcoat: 0.15,
    clearcoatRoughness: 0.4,
    side: THREE.FrontSide,
    depthWrite: false,
    vertexColors: true,
    flatShading: false,
  });
  const glaze = new THREE.Mesh(opts?.uniqueGeo ? glazeGeo().clone() : glazeGeo(), glazeMat);
  glaze.name = "glaze";
  glaze.visible = false;
  grp.add(glaze);

  const cutTex = loadCutTexture();
  const cutMat = new THREE.MeshStandardMaterial({
    map: cutTex,
    roughness: 0.65,
    metalness: 0,
    flatShading: false,
    side: THREE.DoubleSide,
    depthWrite: true,
    vertexColors: false,
  });
  const cutA = new THREE.Mesh(makeCutCapGeo(), cutMat);
  cutA.name = "cutFaceA";
  cutA.position.set(-LEN / 2 - 0.0006, 0, 0);
  grp.add(cutA);

  const [ax, ay, az] = worldBoneTarget(BONE_SEP);
  const [bx, by, bz] = worldBoneTarget(-BONE_SEP);
  const tA = new THREE.Object3D();
  tA.name = "targetA";
  tA.position.set(ax, ay, az);
  tA.add(boneDisc("boneMarkA"));
  grp.add(tA);
  const tB = new THREE.Object3D();
  tB.name = "targetB";
  tB.position.set(bx, by, bz);
  tB.add(boneDisc("boneMarkB"));
  grp.add(tB);

  const knuckleMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.6,
    metalness: 0,
    flatShading: false,
    envMapIntensity: 0.3,
  });
  const knuckle = new THREE.Mesh(makeIrregularKnuckleGeo(), knuckleMat);
  knuckle.name = "knuckle";
  // Tuck the cuff into the paddle tip so the skin reads as one piece.
  knuckle.position.set(LEN * 0.5 - 0.004, 0, 0);
  grp.add(knuckle);

  return grp;
}

function boneDisc(name: string) {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(VOX * 2.2, 20),
    new THREE.MeshBasicMaterial({
      color: 0xffe1a8,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    }),
  );
  mesh.name = name;
  mesh.position.set(0, VOX * 1.3, 0);
  mesh.visible = false;
  mesh.renderOrder = 3;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(VOX * 2.4, VOX * 3.3, 22),
    new THREE.MeshBasicMaterial({
      color: 0xfff6e0,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    }),
  );
  ring.name = `${name}Ring`;
  ring.renderOrder = 3;
  mesh.add(ring);
  return mesh;
}

export function assemblePileWing(marinated = false): THREE.Group {
  const grp = new THREE.Group();
  const geo = new THREE.SphereGeometry(VOX * 0.9, 6, 4);
  const pal = marinated ? [0.62, 0.38, 0.22] : [0.93, 0.78, 0.68];
  const count = 22;
  const mesh = new THREE.InstancedMesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(pal[0], pal[1], pal[2]),
      roughness: marinated ? 0.4 : 0.65,
      flatShading: false,
    }),
    count,
  );
  mesh.name = "meat";
  const dummy = new THREE.Object3D();
  let i = 0;
  for (let x = 0; x < 6 && i < count; x++) {
    for (let z = 0; z < 4 && i < count; z++) {
      const y = (x + z) % 2 === 0 ? 0 : 1;
      dummy.position.set((x - 2.5) * VOX * 1.1, (y - 0.3) * VOX, (z - 1.5) * VOX * 1.1);
      dummy.scale.setScalar(0.7 + ((x + z) % 3) * 0.15);
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
  const xExtent = LEN * 0.5;
  const zExtent = BONE_SEP + ULNA_R;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const k = kinds ? Math.round(kinds.getX(i)) : KIND.skin;
    const s = shades ? shades.getX(i) : 1;
    const pal = PALETTE[k] ?? PALETTE[KIND.skin];
    const face = y > 0.004 ? faceA : faceB;
    const pale = k === KIND.bone || k === KIND.marrow || k === KIND.cart;
    const cookable = pale ? 0.12 : 1;
    const cook = Math.min(1, (heat * 0.55 + face * 0.55) * cookable);
    const xN = Math.min(1, Math.abs(x) / Math.max(0.08, xExtent));
    const zN = Math.min(1, Math.abs(z) / Math.max(0.05, zExtent));
    const rim = pale ? 0.18 : 0.42 + Math.max(xN, zN) * 0.95;
    let r = pal[0] - cook * 0.42 - char * 0.48 * cookable * rim + honey * 0.1;
    let gch = pal[1] - cook * 0.38 - char * 0.46 * cookable * rim + honey * 0.04;
    let b = pal[2] - cook * 0.34 - char * 0.36 * cookable * rim;
    if (k === KIND.marrow) {
      r = pal[0] * (1 - cook * 0.2);
      gch = pal[1] * (1 - cook * 0.2);
      b = pal[2] * (1 - cook * 0.15);
    }
    r *= s;
    gch *= s;
    b *= s;
    if (innerShade > 0.01 && innerSign !== 0) {
      const t = THREE.MathUtils.clamp((x * innerSign) / 0.12 + 0.35, 0, 1);
      const sh = innerShade * t * t;
      r *= 1 - sh * 0.5;
      gch *= 1 - sh * 0.45;
      b *= 1 - sh * 0.35;
    }
    col.setXYZ(i, Math.max(0.03, r), Math.max(0.02, gch), Math.max(0.015, b));
  }
  col.needsUpdate = true;
}
