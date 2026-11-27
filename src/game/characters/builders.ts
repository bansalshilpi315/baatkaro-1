import * as THREE from 'three';
import type { FighterId } from '../types';
import { FIGHTER_CONFIGS } from './configs';
import { createDynamicFace } from './faceCanvas';
import {
  bindRealPhotoFacePlate,
  createBackHeadHemisphereGeometry,
  createFlatOvalFacePlateGeometry,
  PHOTO_BACK_DOME_COLOR,
  PHOTO_FACE_PLATE_Z,
  PHOTO_HEAD_OVAL_SCALE,
  type PhotoFaceFighterId,
} from './photoFaceLoader';
import { attachFatherGlbHead } from './fatherGlbHead';
import { createBaseRigSkeleton, type FighterRig } from './rig';

/**
 * Clean D-shaped 3D Hemisphere + Flat Front Face Plate head for photo-mapped fighters
 * (Father Roy Dolphus, Principal Man, Samyak):
 * - Rounded back hemisphere (`#1e1e22`, roughness 0.85) scaled (1.0, 1.12, 0.92) along -Z
 * - Subtle skin-tone lower neck/nape rim + sculpted 3D ears on left/right edges
 * - Flat oval CircleGeometry capped at z = 0.008 facing +Z with tightly cropped 512x512 PNG
 *   and zero spherical distortion.
 */
function buildPhotoHemisphereHead(
  rig: FighterRig,
  id: PhotoFaceFighterId,
  skinMat: THREE.MeshStandardMaterial,
  grayTempleMat?: THREE.MeshStandardMaterial,
): THREE.Group {
  const r = 0.15;
  const headDomeGroup = new THREE.Group();
  // Shift slightly forward over the neck axis so neck & collar sit cleanly inside the D-head base
  headDomeGroup.position.set(0, 0, 0.052);
  rig.head.add(headDomeGroup);

  const domeHairMat = new THREE.MeshStandardMaterial({
    color: PHOTO_BACK_DOME_COLOR,
    roughness: 0.85,
    metalness: 0.02,
    envMapIntensity: 0.16,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(domeHairMat);

  // Back Dome (3D Semi-Sphere facing backward along -Z, flat rim facing +Z)
  const backDome = new THREE.Mesh(createBackHeadHemisphereGeometry(r), domeHairMat);
  backDome.scale.set(
    PHOTO_HEAD_OVAL_SCALE.x,
    PHOTO_HEAD_OVAL_SCALE.y,
    PHOTO_HEAD_OVAL_SCALE.z,
  );
  backDome.castShadow = true;
  headDomeGroup.add(backDome);

  // Solid opaque dark-hair seal closing the hemisphere opening behind the 2-3px feathered face rim
  const backSeal = new THREE.Mesh(createFlatOvalFacePlateGeometry(r * 0.996), domeHairMat);
  backSeal.scale.set(PHOTO_HEAD_OVAL_SCALE.x, PHOTO_HEAD_OVAL_SCALE.y, 1.0);
  backSeal.position.set(0, 0, 0.002);
  headDomeGroup.add(backSeal);

  // Subtle skin-tone lower neck/nape rim using back-facing hemisphere strictly behind z = -0.004
  // (never pokes forward through the flat front face plate at z = +0.008!)
  const napeRim = new THREE.Mesh(createBackHeadHemisphereGeometry(r * 0.94), skinMat);
  napeRim.scale.set(0.88, 0.56, 0.84);
  napeRim.position.set(0, -0.074, -0.004);
  headDomeGroup.add(napeRim);

  // Small sculpted 3D ears & subtle skin-tone ear-base rims flanking the hemisphere strictly behind z = 0
  [-1, 1].forEach((side) => {
    const earRim = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), skinMat);
    earRim.scale.set(0.46, 1.32, 0.52);
    earRim.position.set(side * (r * 0.94), -0.024, -0.028);
    headDomeGroup.add(earRim);

    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.029, 10, 8), skinMat);
    ear.scale.set(0.42, 1.24, 0.66);
    ear.position.set(side * (r * 1.01), -0.012, -0.034);
    headDomeGroup.add(ear);
  });

  // Subtle salt-and-pepper temple accents on the dark hemisphere sides for Principal Man
  if (grayTempleMat) {
    [-1, 1].forEach((side) => {
      const grayStreak = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.056, 0.044), grayTempleMat);
      grayStreak.position.set(side * (r * 0.95), 0.026, -0.04);
      grayStreak.rotation.y = side * 0.25;
      headDomeGroup.add(grayStreak);
    });
  }

  // Flat Front Face Plate (CircleGeometry scaled 1.0 x 1.12 at z = 0.008 facing +Z)
  // Matte MeshStandardMaterial calibrated to ACESFilmic arena lighting with subtle emissiveMap lift
  const facePlateMat = new THREE.MeshStandardMaterial({
    map: rig.face.texture,
    emissiveMap: rig.face.texture,
    color: 0xd0d0d0,
    roughness: 0.72,
    metalness: 0.0,
    envMapIntensity: 0.05,
    transparent: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.05,
  });
  facePlateMat.userData.baseEmissiveIntensity = 0.05;
  rig.flashMaterials.push(facePlateMat);

  const facePlate = new THREE.Mesh(createFlatOvalFacePlateGeometry(r), facePlateMat);
  facePlate.scale.set(PHOTO_HEAD_OVAL_SCALE.x, PHOTO_HEAD_OVAL_SCALE.y, 1.0);
  facePlate.position.set(0, 0, PHOTO_FACE_PLATE_Z);
  headDomeGroup.add(facePlate);

  bindRealPhotoFacePlate(id, facePlateMat);
  return headDomeGroup;
}

const sharedFabricWeaveCache = new Map<string, THREE.CanvasTexture>();
let sharedSilhouetteOutlineMat: THREE.MeshBasicMaterial | null = null;

function getSilhouetteOutlineMat(): THREE.MeshBasicMaterial {
  if (!sharedSilhouetteOutlineMat) {
    sharedSilhouetteOutlineMat = new THREE.MeshBasicMaterial({
      color: 0x161d29,
      side: THREE.BackSide,
    });
  }
  return sharedSilhouetteOutlineMat;
}

/**
 * Adds a sleek, subtle dark inverted-hull rim outline on key silhouette meshes
 * so characters with light fabrics or warm skin pop sharply against bright stages.
 */
function attachSubtleOutline(
  parent: THREE.Object3D,
  sourceMesh: THREE.Mesh,
  pad = 1.032,
): void {
  const outline = new THREE.Mesh(sourceMesh.geometry, getSilhouetteOutlineMat());
  outline.position.copy(sourceMesh.position);
  outline.rotation.copy(sourceMesh.rotation);
  outline.scale.set(
    sourceMesh.scale.x * pad,
    sourceMesh.scale.y * pad,
    sourceMesh.scale.z * pad,
  );
  outline.castShadow = false;
  outline.receiveShadow = false;
  parent.add(outline);
}

/**
 * Generates and caches a lightweight 128x128 procedural woven cloth CanvasTexture
 * so suits, kurtas, sarees, vests, and jholas read with tactile textile depth
 * rather than flat untextured plastic.
 */
function createFabricWeaveTexture(
  baseHex: string,
  warpHex: string,
  weftHex: string,
  repeat = 3,
): THREE.CanvasTexture {
  const key = `${baseHex}|${warpHex}|${weftHex}|${repeat}`;
  const cached = sharedFabricWeaveCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 128, 128);

  // Fine cross-hatch woven threads
  ctx.fillStyle = warpHex;
  for (let x = 0; x < 128; x += 6) {
    ctx.fillRect(x, 0, 2, 128);
  }
  ctx.fillStyle = weftHex;
  for (let y = 0; y < 128; y += 6) {
    ctx.fillRect(0, y, 128, 2);
  }

  // Subtle diagonal twill sheen lines for tailored depth
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1.5;
  for (let d = -128; d < 256; d += 12) {
    ctx.beginPath();
    ctx.moveTo(d, 0);
    ctx.lineTo(d + 128, 128);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.needsUpdate = true;
  sharedFabricWeaveCache.set(key, tex);
  return tex;
}

function makeMat(
  color: number | string,
  roughness: number,
  metalness: number,
  flashList?: THREE.MeshStandardMaterial[],
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  if (flashList) flashList.push(mat);
  return mat;
}

function addStandardLimbs(
  rig: FighterRig,
  opts: {
    sleeveColor: number;
    skinColor: string;
    pantColor: number;
    shoeColor: number;
    limbScale?: number;
    sleeveRoughness?: number;
    shoeAccentColor?: number;
  },
): void {
  const s = opts.limbScale ?? 1;
  const sleeveMat = makeMat(
    opts.sleeveColor,
    opts.sleeveRoughness ?? 0.68,
    0.05,
    rig.flashMaterials,
  );
  const skinMat = makeMat(opts.skinColor, 0.42, 0.02, rig.flashMaterials);
  const pantMat = makeMat(opts.pantColor, 0.78, 0.02, rig.flashMaterials);
  const shoeMat = makeMat(opts.shoeColor, 0.28, 0.12, rig.flashMaterials);
  const soleMat = makeMat(opts.shoeAccentColor ?? 0xf8fafc, 0.5, 0.05);

  const upperArmGeo = new THREE.CapsuleGeometry(0.115 * s, 0.22 * s, 6, 12);
  const lowerArmGeo = new THREE.CapsuleGeometry(0.1 * s, 0.2 * s, 6, 12);
  const handGeo = new THREE.SphereGeometry(0.13 * s, 12, 10);

  // Arms
  [
    [rig.leftShoulder, rig.leftElbow],
    [rig.rightShoulder, rig.rightElbow],
  ].forEach(([shoulder, elbow]) => {
    const upper = new THREE.Mesh(upperArmGeo, sleeveMat);
    upper.position.y = -0.17 * s;
    upper.castShadow = true;
    shoulder.add(upper);

    const lower = new THREE.Mesh(lowerArmGeo, skinMat);
    lower.position.y = -0.15 * s;
    lower.castShadow = true;
    elbow.add(lower);

    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.y = -0.31 * s;
    hand.castShadow = true;
    elbow.add(hand);
  });

  // Legs
  const upperLegGeo = new THREE.CapsuleGeometry(0.14 * s, 0.24 * s, 6, 12);
  const lowerLegGeo = new THREE.CapsuleGeometry(0.12 * s, 0.22 * s, 6, 12);
  const shoeGeo = new THREE.BoxGeometry(0.24 * s, 0.14 * s, 0.36 * s);
  const soleGeo = new THREE.BoxGeometry(0.25 * s, 0.05 * s, 0.38 * s);

  [
    [rig.leftHip, rig.leftKnee],
    [rig.rightHip, rig.rightKnee],
  ].forEach(([hip, knee]) => {
    const thigh = new THREE.Mesh(upperLegGeo, pantMat);
    thigh.position.y = -0.22 * s;
    thigh.castShadow = true;
    hip.add(thigh);

    const shin = new THREE.Mesh(lowerLegGeo, pantMat);
    shin.position.y = -0.21 * s;
    shin.castShadow = true;
    knee.add(shin);

    const shoe = new THREE.Mesh(shoeGeo, shoeMat);
    shoe.position.set(0, -0.38 * s, 0.07 * s);
    shoe.castShadow = true;
    knee.add(shoe);

    const sole = new THREE.Mesh(soleGeo, soleMat);
    sole.position.set(0, -0.44 * s, 0.07 * s);
    knee.add(sole);
  });
}

function createHeadMesh(faceTex: THREE.CanvasTexture, radius = 0.36): THREE.Mesh {
  // Orient sphere UV so center of CanvasTexture (u=0.5) faces +Z directly
  const geo = new THREE.SphereGeometry(radius, 22, 18);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: faceTex,
    roughness: 0.62,
    metalness: 0,
    envMapIntensity: 0.24,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.y = -Math.PI / 2;
  mesh.castShadow = true;
  return mesh;
}

function createAviatorLensGeometry(): THREE.ExtrudeGeometry {
  // Sleek classic teardrop aviator lens profile
  const shape = new THREE.Shape();
  shape.moveTo(-0.1, 0.055);
  shape.lineTo(0.105, 0.055);
  shape.quadraticCurveTo(0.125, -0.02, 0.065, -0.075);
  shape.quadraticCurveTo(-0.02, -0.1, -0.095, -0.04);
  shape.quadraticCurveTo(-0.125, 0.01, -0.1, 0.055);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.022,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 2,
    curveSegments: 8,
  });
  geo.center();
  return geo;
}

function makeLionMat(
  color: number | string,
  roughness: number,
  metalness = 0,
  envMapIntensity = 0.22,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    envMapIntensity,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 0,
  });
}

function addLionSuitLimbs(
  rig: FighterRig,
  blazerMat: THREE.MeshStandardMaterial,
  trouserMat: THREE.MeshStandardMaterial,
  cuffMat: THREE.MeshStandardMaterial,
  furMat: THREE.MeshStandardMaterial,
  creamFurMat: THREE.MeshStandardMaterial,
  goldMat: THREE.MeshStandardMaterial,
  padMat: THREE.MeshStandardMaterial,
): void {
  const upperArmGeo = new THREE.CapsuleGeometry(0.13, 0.23, 6, 12);
  const lowerArmGeo = new THREE.CapsuleGeometry(0.115, 0.21, 6, 12);
  const cuffGeo = new THREE.CylinderGeometry(0.12, 0.115, 0.07, 12);
  const wristFurGeo = new THREE.TorusGeometry(0.095, 0.032, 6, 12);
  const pawPalmGeo = new THREE.SphereGeometry(0.135, 12, 10);
  const pawFingerGeo = new THREE.SphereGeometry(0.054, 8, 8);
  const ringGeo = new THREE.TorusGeometry(0.052, 0.015, 6, 12);

  // Arms (Tailored white suit sleeves + bare white lion paws + gold watch + gold finger rings)
  const armSides: Array<{ shoulder: THREE.Group; elbow: THREE.Group; side: -1 | 1 }> = [
    { shoulder: rig.leftShoulder, elbow: rig.leftElbow, side: -1 },
    { shoulder: rig.rightShoulder, elbow: rig.rightElbow, side: 1 },
  ];

  for (const { shoulder, elbow, side } of armSides) {
    // Broad tailored suit shoulder cap
    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.165, 12, 10), blazerMat);
    shoulderCap.scale.set(1.08, 0.92, 1.05);
    shoulderCap.castShadow = true;
    shoulder.add(shoulderCap);

    const upper = new THREE.Mesh(upperArmGeo, blazerMat);
    upper.position.y = -0.17;
    upper.castShadow = true;
    shoulder.add(upper);

    const lower = new THREE.Mesh(lowerArmGeo, blazerMat);
    lower.position.y = -0.14;
    lower.castShadow = true;
    elbow.add(lower);

    // Crisp shirt cuff + tiny metallic gold cufflink
    const cuff = new THREE.Mesh(cuffGeo, cuffMat);
    cuff.position.y = -0.25;
    elbow.add(cuff);

    const cufflink = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), goldMat);
    cufflink.position.set(side * 0.11, -0.25, -0.02);
    elbow.add(cufflink);

    // Chunky Gold Wristwatch on Sheru's left wrist (rig.leftElbow)
    if (side === -1) {
      const watchBand = new THREE.Mesh(
        new THREE.TorusGeometry(0.118, 0.028, 8, 16),
        goldMat,
      );
      watchBand.rotation.x = Math.PI / 2;
      watchBand.position.y = -0.275;
      elbow.add(watchBand);

      const watchBezel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.068, 0.068, 0.036, 14),
        goldMat,
      );
      watchBezel.rotation.z = Math.PI / 2;
      watchBezel.position.set(-0.125, -0.275, 0.03);
      elbow.add(watchBezel);

      const watchDial = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.039, 12),
        padMat,
      );
      watchDial.rotation.z = Math.PI / 2;
      watchDial.position.set(-0.127, -0.275, 0.03);
      elbow.add(watchDial);
    }

    // Furry white lion wrist ruff + chunky bare lion paw
    const wristFur = new THREE.Mesh(wristFurGeo, creamFurMat);
    wristFur.rotation.x = Math.PI / 2;
    wristFur.position.y = -0.295;
    elbow.add(wristFur);

    const pawGroup = new THREE.Group();
    pawGroup.position.set(0, -0.355, 0.02);
    elbow.add(pawGroup);

    const palm = new THREE.Mesh(pawPalmGeo, furMat);
    palm.scale.set(1.06, 0.92, 1.05);
    palm.castShadow = true;
    pawGroup.add(palm);

    // 3 sculpted rounded paw fingers + visible metallic gold rings
    [-0.075, 0, 0.075].forEach((fx, idx) => {
      const finger = new THREE.Mesh(pawFingerGeo, furMat);
      finger.position.set(fx, -0.075, 0.07);
      finger.scale.set(0.95, 1.15, 1.15);
      pawGroup.add(finger);

      // Chunky gold rings on outer & center paw fingers of both hands
      if (idx === 0 || idx === 2) {
        const ring = new THREE.Mesh(ringGeo, goldMat);
        ring.position.set(fx, -0.072, 0.088);
        ring.rotation.x = Math.PI * 0.42;
        pawGroup.add(ring);
      }
    });

    // Thumb lobe
    const thumb = new THREE.Mesh(pawFingerGeo, furMat);
    thumb.position.set(-side * 0.115, -0.015, 0.055);
    thumb.scale.set(1.05, 0.92, 1.05);
    pawGroup.add(thumb);
  }

  // Legs (Tailored white trousers + chunky bare white lion paws — NO human shoes!)
  const upperLegGeo = new THREE.CapsuleGeometry(0.155, 0.25, 6, 12);
  const lowerLegGeo = new THREE.CapsuleGeometry(0.132, 0.21, 6, 12);
  const trouserHemGeo = new THREE.CylinderGeometry(0.145, 0.15, 0.075, 12);
  const footBaseGeo = new THREE.SphereGeometry(0.155, 12, 10);
  const toeGeo = new THREE.SphereGeometry(0.072, 10, 8);
  const footPadGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.022, 10);

  [
    [rig.leftHip, rig.leftKnee],
    [rig.rightHip, rig.rightKnee],
  ].forEach(([hip, knee]) => {
    const thigh = new THREE.Mesh(upperLegGeo, trouserMat);
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    hip.add(thigh);

    const shin = new THREE.Mesh(lowerLegGeo, trouserMat);
    shin.position.y = -0.18;
    shin.castShadow = true;
    knee.add(shin);

    // Tailored trouser cuff ending above bare furry ankle
    const hem = new THREE.Mesh(trouserHemGeo, trouserMat);
    hem.position.y = -0.3;
    knee.add(hem);

    // Chunky furry bare white lion foot paw
    const footGroup = new THREE.Group();
    footGroup.position.set(0, -0.39, 0.05);
    knee.add(footGroup);

    const footArch = new THREE.Mesh(footBaseGeo, furMat);
    footArch.scale.set(1.05, 0.68, 1.32);
    footArch.castShadow = true;
    footGroup.add(footArch);

    // 3 chunky rounded white lion toes protruding forward
    [-0.088, 0, 0.088].forEach((tx, idx) => {
      const toe = new THREE.Mesh(toeGeo, idx === 1 ? furMat : creamFurMat);
      toe.position.set(tx, -0.02, idx === 1 ? 0.195 : 0.165);
      toe.scale.set(0.96, 0.82, 1.2);
      toe.castShadow = true;
      footGroup.add(toe);
    });

    // Dark lion paw pad underneath
    const pad = new THREE.Mesh(footPadGeo, padMat);
    pad.position.set(0, -0.095, 0.03);
    footGroup.add(pad);
  });
}

function buildSheruBhai(rig: FighterRig): void {
  // Broad billionaire-boss caricature proportions
  rig.leftShoulder.position.set(-0.49, 0.68, 0);
  rig.rightShoulder.position.set(0.49, 0.68, 0);
  rig.head.position.set(0, 0.9, 0);

  // Grounded PBR Materials: woven tailored white suiting (roughness 0.85-0.88), satin-matte fur (0.64), true specular gold (metalness 0.88, roughness 0.22)
  const suitWeaveTex = createFabricWeaveTexture('#DCE2EA', 'rgba(100,116,139,0.10)', 'rgba(255,255,255,0.14)', 3);
  const trouserWeaveTex = createFabricWeaveTexture('#D4DBE4', 'rgba(71,85,105,0.12)', 'rgba(255,255,255,0.10)', 3);
  const vestWeaveTex = createFabricWeaveTexture('#EAE3D2', 'rgba(120,104,80,0.11)', 'rgba(255,250,240,0.14)', 3);

  const blazerMat = makeLionMat(0xffffff, 0.86, 0, 0.16);
  blazerMat.map = suitWeaveTex;
  const lapelMat = makeLionMat(0xe5eaf0, 0.84, 0, 0.18);
  const trouserMat = makeLionMat(0xffffff, 0.88, 0, 0.14);
  trouserMat.map = trouserWeaveTex;
  const vestMat = makeLionMat(0xffffff, 0.86, 0, 0.18);
  vestMat.map = vestWeaveTex;
  const pipingMat = makeLionMat(0x374151, 0.84, 0, 0.15);
  const furFacePawMat = makeLionMat(0xf4efe6, 0.64, 0, 0.24); // Satin-matte lion fur & bare paws
  const maneOuterMat = makeLionMat(0xe8dec8, 0.68, 0, 0.2); // Sculpted satin-matte champagne mane
  const maneMidMat = makeLionMat(0xd4c4a6, 0.7, 0, 0.16);
  const maneInnerMat = makeLionMat(0xbda984, 0.74, 0, 0.14);
  const noseMat = makeLionMat(0x9c5249, 0.44, 0.02, 0.34);
  const darkOutlineMat = makeLionMat(0x140d0b, 0.58, 0.02, 0.2);
  const innerEarMat = makeLionMat(0xd8a397, 0.66, 0, 0.2);

  // Rich metallic gold bling (metalness 0.88, roughness 0.22)
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.22,
    metalness: 0.88,
    envMapIntensity: 1.45,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 0,
  });

  // Dark tinted reflective aviator lenses
  const aviatorLensMat = new THREE.MeshStandardMaterial({
    color: 0x0b111c,
    roughness: 0.14,
    metalness: 0.88,
    envMapIntensity: 1.5,
    emissive: new THREE.Color(0xd4af37),
    emissiveIntensity: 0.04,
  });
  rig.shadesLensMat = aviatorLensMat;

  // === PELVIS, TAILORED BLAZER COAT-TAIL & ANIMATED WHITE LION TAIL ===
  const pelvisMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.33, 0.24, 16), trouserMat);
  pelvisMesh.scale.set(1.06, 1, 0.88);
  rig.pelvis.add(pelvisMesh);

  // Sleek tailored blazer lower hem wrapping cleanly around hips with subtle front vent
  const blazerSkirt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.4, 0.24, 16, 1, false, Math.PI * 0.14, Math.PI * 1.72),
    blazerMat,
  );
  blazerSkirt.position.set(0, -0.04, 0);
  blazerSkirt.scale.set(1.08, 1, 0.88);
  blazerSkirt.castShadow = true;
  rig.pelvis.add(blazerSkirt);

  // Snug charcoal piping hugging the exact blazer skirt lower hem
  const blazerHemTrim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.399, 0.404, 0.024, 16, 1, false, Math.PI * 0.14, Math.PI * 1.72),
    pipingMat,
  );
  blazerHemTrim.position.set(0, -0.152, 0);
  blazerHemTrim.scale.set(1.08, 1, 0.88);
  rig.pelvis.add(blazerHemTrim);

  // Subtle White Lion Tail with Champagne Cream Tuft peeking behind the blazer
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, -0.02, -0.32);
  rig.pelvis.add(tailPivot);
  rig.tailPivot = tailPivot;

  const tailSeg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.044, 0.36, 8), furFacePawMat);
  tailSeg1.position.set(0, -0.04, -0.16);
  tailSeg1.rotation.x = Math.PI * 0.38;
  tailPivot.add(tailSeg1);

  const tailSeg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.036, 0.32, 8), furFacePawMat);
  tailSeg2.position.set(0, 0.06, -0.4);
  tailSeg2.rotation.x = Math.PI * 0.62;
  tailPivot.add(tailSeg2);

  const tailTuft = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.22, 8), maneOuterMat);
  tailTuft.position.set(0, 0.18, -0.54);
  tailTuft.rotation.x = -Math.PI * 0.35;
  tailPivot.add(tailTuft);
  const tailTuftBulb = new THREE.Mesh(new THREE.SphereGeometry(0.072, 8, 8), maneInnerMat);
  tailTuftBulb.position.set(0, 0.14, -0.5);
  tailPivot.add(tailTuftBulb);

  // === TAILORED 3-PIECE SUIT TORSO (PLATINUM BLAZER + WARM IVORY VEST + CHARCOAL PIPING) ===
  const torsoMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.34, 0.76, 16), blazerMat);
  torsoMesh.position.y = 0.38;
  torsoMesh.scale.set(1.1, 1, 0.86);
  torsoMesh.castShadow = true;
  rig.torso.add(torsoMesh);

  // Fitted warmer ivory waistcoat (vest) revealed inside open front
  const vestPanel = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.66, 0.08), vestMat);
  vestPanel.position.set(0, 0.37, 0.33);
  rig.torso.add(vestPanel);

  // Subtle vertical placket seam down waistcoat center
  const vestSeam = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.56, 0.086), pipingMat);
  vestSeam.position.set(0, 0.35, 0.332);
  rig.torso.add(vestSeam);

  // 4 Small Metallic Gold Buttons (#D4AF37) down the center of the waistcoat
  const buttonGeo = new THREE.CylinderGeometry(0.027, 0.027, 0.024, 10);
  for (let i = 0; i < 4; i++) {
    const btn = new THREE.Mesh(buttonGeo, goldMat);
    btn.rotation.x = Math.PI / 2;
    btn.position.set(0, 0.52 - i * 0.125, 0.379);
    rig.torso.add(btn);
  }

  // Sculpted Platinum Blazer Lapels with crisp charcoal/grey piping along inner & outer edges
  [-1, 1].forEach((side) => {
    const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.58, 0.095), lapelMat);
    lapel.position.set(side * 0.21, 0.42, 0.34);
    lapel.rotation.z = side * 0.16;
    lapel.rotation.y = -side * 0.18;
    lapel.castShadow = true;
    rig.torso.add(lapel);

    // Thin charcoal piping along inner lapel edge (bordering ivory waistcoat)
    const innerPiping = new THREE.Mesh(new THREE.BoxGeometry(0.017, 0.59, 0.1), pipingMat);
    innerPiping.position.set(side * 0.142, 0.42, 0.346);
    innerPiping.rotation.z = side * 0.16;
    innerPiping.rotation.y = -side * 0.18;
    rig.torso.add(innerPiping);

    // Thin charcoal piping along outer lapel edge
    const outerPiping = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.58, 0.098), pipingMat);
    outerPiping.position.set(side * 0.278, 0.42, 0.334);
    outerPiping.rotation.z = side * 0.16;
    outerPiping.rotation.y = -side * 0.18;
    rig.torso.add(outerPiping);

    // Sharp tailored peak-lapel notch accent & structured boss shoulder pad
    const lapelPeak = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.12, 4), lapelMat);
    lapelPeak.position.set(side * 0.28, 0.62, 0.32);
    lapelPeak.rotation.z = -side * 0.92;
    lapelPeak.rotation.y = -side * 0.18;
    lapelPeak.scale.set(1.0, 1.0, 0.38);
    rig.torso.add(lapelPeak);

    const shoulderPad = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.11, 0.36), blazerMat);
    shoulderPad.position.set(side * 0.41, 0.72, 0.0);
    shoulderPad.rotation.z = -side * 0.14;
    shoulderPad.castShadow = true;
    rig.torso.add(shoulderPad);
  });

  // Blazer collar wrapping behind neck with subtle charcoal piping edge
  const suitCollar = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.06, 8, 18, Math.PI * 1.25),
    lapelMat,
  );
  suitCollar.rotation.x = Math.PI / 2;
  suitCollar.rotation.z = Math.PI * 0.875;
  suitCollar.position.set(0, 0.75, 0.02);
  rig.torso.add(suitCollar);

  // Chest Pocket with charcoal welt piping & Folded Rich Gold Pocket Square
  const pocketWelt = new THREE.Mesh(new THREE.BoxGeometry(0.138, 0.024, 0.032), pipingMat);
  pocketWelt.position.set(0.26, 0.52, 0.356);
  pocketWelt.rotation.y = -0.28;
  rig.torso.add(pocketWelt);

  const pocketRimBottom = new THREE.Mesh(new THREE.BoxGeometry(0.132, 0.012, 0.028), pipingMat);
  pocketRimBottom.position.set(0.26, 0.498, 0.354);
  pocketRimBottom.rotation.y = -0.28;
  rig.torso.add(pocketRimBottom);

  const pocketSquare = new THREE.Mesh(new THREE.ConeGeometry(0.058, 0.105, 4), goldMat);
  pocketSquare.position.set(0.26, 0.574, 0.356);
  pocketSquare.rotation.y = -0.28 + Math.PI * 0.25;
  pocketSquare.rotation.z = -0.18;
  pocketSquare.scale.set(1.12, 1, 0.42);
  rig.torso.add(pocketSquare);

  // === CHUNKY SEGMENTED METALLIC GOLD CHAIN (#D4AF37) DRAPED OVER VEST ===
  const chainGroup = new THREE.Group();
  rig.torso.add(chainGroup);
  const linkGeo = new THREE.TorusGeometry(0.045, 0.023, 7, 12);
  const linkCount = 15;
  for (let i = 0; i < linkCount; i++) {
    const t = i / (linkCount - 1);
    const angle = (t - 0.5) * Math.PI * 0.92;
    const x = Math.sin(angle) * 0.24;
    const y = 0.72 - Math.cos(angle) * 0.31;
    const z = 0.28 + Math.cos(angle) * 0.125;
    const link = new THREE.Mesh(linkGeo, goldMat);
    link.position.set(x, y, z);
    link.rotation.y = i % 2 === 0 ? 0.35 : -0.35;
    link.rotation.z = -angle * 0.85;
    chainGroup.add(link);
  }
  const medallion = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.034, 8), goldMat);
  medallion.rotation.x = Math.PI / 2;
  medallion.position.set(0, 0.37, 0.422);
  chainGroup.add(medallion);

  // === SCULPTED OFF-WHITE LION HEAD, PROTRUDING MUZZLE, EARS & LAYERED CHAMPAGNE MANE ===
  const headMesh = createHeadMesh(rig.face.texture, 0.41);
  headMesh.position.y = 0.22;
  headMesh.scale.set(1.02, 1.0, 1.04);
  // Balanced satin-matte fur finish (roughness 0.64) with zero emissive washout
  const headMat = headMesh.material as THREE.MeshStandardMaterial;
  headMat.roughness = 0.64;
  headMat.metalness = 0;
  headMat.envMapIntensity = 0.24;
  headMat.emissive.setHex(0x000000);
  headMat.emissiveIntensity = 0;
  rig.head.add(headMesh);

  // Prominent Protruding 3D Lion Muzzle / Snout (#F4EFE6 matte fur)
  const muzzleBridge = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.24), furFacePawMat);
  muzzleBridge.position.set(0, 0.16, 0.38);
  muzzleBridge.castShadow = true;
  rig.head.add(muzzleBridge);

  // Twin plump whisker cheek pads on front of snout
  [-0.1, 0.1].forEach((x) => {
    const cheekPad = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), furFacePawMat);
    cheekPad.position.set(x, 0.1, 0.42);
    cheekPad.scale.set(1.05, 0.88, 0.95);
    cheekPad.castShadow = true;
    rig.head.add(cheekPad);
  });

  // Strong sculpted lion chin/jaw (slightly warmer champagne shade underneath for depth)
  const chin = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8), maneOuterMat);
  chin.position.set(0, 0.015, 0.38);
  chin.scale.set(1.15, 0.78, 0.95);
  rig.head.add(chin);

  // 3D Deeper Pinkish-Brown Lion Nose Tip with bold dark outline resting at front of snout
  const noseRim = new THREE.Mesh(new THREE.SphereGeometry(0.088, 10, 8), darkOutlineMat);
  noseRim.position.set(0, 0.175, 0.485);
  noseRim.scale.set(1.18, 0.82, 0.75);
  rig.head.add(noseRim);

  const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), noseMat);
  noseTip.position.set(0, 0.178, 0.504);
  noseTip.scale.set(1.15, 0.78, 0.68);
  rig.head.add(noseTip);

  // Rounded Off-White Lion Ears peeking out from top of the mane
  [-0.29, 0.29].forEach((x) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), furFacePawMat);
    ear.position.set(x, 0.56, 0.02);
    ear.scale.set(0.95, 1.05, 0.62);
    ear.castShadow = true;
    rig.head.add(ear);

    const innerEar = new THREE.Mesh(new THREE.SphereGeometry(0.072, 8, 8), innerEarMat);
    innerEar.position.set(x, 0.555, 0.072);
    innerEar.scale.set(0.88, 0.95, 0.45);
    rig.head.add(innerEar);
  });

  // Rich, Layered Champagne/Cream Lion Mane (darker inner tufts + matte #E8DEC8 outer tufts for depth)
  const maneGroup = new THREE.Group();
  maneGroup.position.set(0, 0.22, -0.02);
  rig.head.add(maneGroup);
  rig.maneGroup = maneGroup;

  const tuftSphereGeo = new THREE.SphereGeometry(0.19, 10, 8);
  const tuftConeGeo = new THREE.ConeGeometry(0.155, 0.34, 7);

  // Inner face-framing ruff uses slightly darker champagne shadow tufts so the face pops cleanly!
  const innerCount = 12;
  for (let i = 0; i < innerCount; i++) {
    const angle = (i / innerCount) * Math.PI * 2;
    const innerMat = i % 2 === 0 ? maneInnerMat : maneMidMat;
    const outerMat = i % 3 === 0 ? maneMidMat : maneOuterMat;
    const r = 0.42;
    const tx = Math.cos(angle) * r;
    const ty = Math.sin(angle) * (r * 1.04) - 0.02;
    const tz = Math.sin(angle) < -0.35 ? 0.05 : -0.04;

    const puff = new THREE.Mesh(tuftSphereGeo, innerMat);
    puff.position.set(tx, ty, tz);
    puff.scale.set(1.02, 1.08, 0.92);
    puff.castShadow = true;
    maneGroup.add(puff);

    // Flared outer champagne mane spikes reading cleanly in both front & side profile
    const spike = new THREE.Mesh(tuftConeGeo, outerMat);
    spike.position.set(tx * 1.24, ty * 1.22, tz - 0.08);
    spike.rotation.z = angle - Math.PI / 2;
    spike.rotation.x = -0.22;
    maneGroup.add(spike);
  }

  // Fuller back-of-head & neck mane volume with layered dark-inner to warm-cream-outer shading
  const backTuftOffsets: Array<[number, number, number, number, boolean]> = [
    [0, 0.34, -0.3, 1.25, false],
    [-0.26, 0.22, -0.3, 1.15, true],
    [0.26, 0.22, -0.3, 1.15, true],
    [-0.32, -0.04, -0.28, 1.2, false],
    [0.32, -0.04, -0.28, 1.2, false],
    [0, 0.04, -0.38, 1.38, false],
    [-0.2, -0.24, -0.24, 1.18, true],
    [0.2, -0.24, -0.24, 1.18, true],
    [0, -0.34, -0.14, 1.25, true],
    [0, -0.36, 0.14, 1.05, true], // Shaded lower chin mane ruff separating head from platinum collar
  ];
  backTuftOffsets.forEach(([x, y, z, sc, isInner], idx) => {
    const mat = isInner ? maneInnerMat : idx % 2 === 0 ? maneOuterMat : maneMidMat;
    const backPuff = new THREE.Mesh(tuftSphereGeo, mat);
    backPuff.position.set(x, y, z);
    backPuff.scale.set(sc, sc * 1.05, sc * 0.95);
    backPuff.castShadow = true;
    maneGroup.add(backPuff);
  });

  // === SIGNATURE GLOSSY JET-BLACK AVIATOR SUNGLASSES (#0A0A0A) WITH #D4AF37 GOLD FRAMES ===
  const shadesPivot = new THREE.Group();
  rig.head.add(shadesPivot);
  rig.shadesPivot = shadesPivot;

  const aviatorGeo = createAviatorLensGeometry();
  const rimGeo = createAviatorLensGeometry();
  [-1, 1].forEach((side) => {
    const lx = side * 0.155;
    const lens = new THREE.Mesh(aviatorGeo, aviatorLensMat);
    lens.position.set(lx, 0.265, 0.435);
    lens.rotation.y = side * 0.16;
    lens.scale.set(side, 1, 1);
    shadesPivot.add(lens);

    const goldRim = new THREE.Mesh(rimGeo, goldMat);
    goldRim.position.set(lx, 0.265, 0.422);
    goldRim.rotation.y = side * 0.16;
    goldRim.scale.set(side * 1.09, 1.09, 0.9);
    shadesPivot.add(goldRim);

    const temple = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.34), goldMat);
    temple.position.set(side * 0.275, 0.305, 0.27);
    temple.rotation.y = side * 0.14;
    shadesPivot.add(temple);
  });

  const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.022), goldMat);
  topBar.position.set(0, 0.315, 0.442);
  shadesPivot.add(topBar);

  const noseBridge = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.018, 0.022), goldMat);
  noseBridge.position.set(0, 0.278, 0.445);
  shadesPivot.add(noseBridge);

  // === SUIT LIMBS (PLATINUM SLEEVES + SLATE-WHITE TROUSERS + BARE OFF-WHITE LION PAWS + GOLD WATCH & RINGS) ===
  addLionSuitLimbs(
    rig,
    blazerMat,
    trouserMat,
    vestMat,
    furFacePawMat,
    maneOuterMat,
    goldMat,
    darkOutlineMat,
  );

  // === PAISA FLEX CURRENCY STACK PROP IN RIGHT PAW ===
  const cashBundle = new THREE.Group();
  const noteMat = makeMat(0x22c55e, 0.5, 0.08);
  const bandMat = goldMat;
  const stack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.15), noteMat);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.11, 0.16), bandMat);
  cashBundle.add(stack, band);
  cashBundle.position.set(0, -0.4, 0.14);
  cashBundle.visible = false;
  rig.rightElbow.add(cashBundle);
  rig.handProp = cashBundle;
}

let sharedBillaBellyTex: THREE.CanvasTexture | null = null;
let sharedSwatterMeshTex: THREE.CanvasTexture | null = null;

function createBillaBellyTexture(): THREE.CanvasTexture {
  if (sharedBillaBellyTex) return sharedBillaBellyTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Blend border into matte sky-blue torso fur
  ctx.fillStyle = '#55BCE8';
  ctx.fillRect(0, 0, 256, 256);

  // Crisp light-grey/off-white oval belly patch (#E5E8EC)
  const cx = 128;
  const cy = 128;
  ctx.fillStyle = '#E5E8EC';
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 86, 102, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Subtle inner rim highlight
  ctx.fillStyle = '#F1F5F9';
  ctx.beginPath();
  ctx.ellipse(cx - 8, cy - 12, 66, 80, 0, 0, Math.PI * 2);
  ctx.fill();

  // Distinct bold black Archimedean spiral swirl right in the center of the belly!
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const turns = 2.65;
  const steps = 110;
  const maxR = 54;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * turns * Math.PI * 2 - Math.PI * 0.35;
    const r = t * maxR;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * (r * 1.08);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  sharedBillaBellyTex = tex;
  return tex;
}

function createSwatterMeshTexture(): THREE.CanvasTexture {
  if (sharedSwatterMeshTex) return sharedSwatterMeshTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // Vibrant neon-green flyswatter base
  ctx.fillStyle = '#4ADE80';
  ctx.fillRect(0, 0, 128, 128);

  // Dark perforated flyswatter mesh holes
  ctx.fillStyle = '#14532D';
  const cols = 6;
  const rows = 5;
  const padX = 14;
  const padY = 14;
  const cellW = (128 - padX * 2) / cols;
  const cellH = (128 - padY * 2) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = padX + c * cellW + 3;
      const y = padY + r * cellH + 3;
      ctx.beginPath();
      ctx.roundRect(x, y, cellW - 6, cellH - 6, 3);
      ctx.fill();
    }
  }

  // Bright yellow cartoon border frame
  ctx.strokeStyle = '#FDE047';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 118, 118);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  sharedSwatterMeshTex = tex;
  return tex;
}

function addOggyCatLimbs(
  rig: FighterRig,
  skyBlueMat: THREE.MeshStandardMaterial,
  whiteGloveMat: THREE.MeshStandardMaterial,
  darkLineMat: THREE.MeshStandardMaterial,
): void {
  // === THIN FLEXIBLE SKY-BLUE NOODLE ARMS + OVERSIZED PUFFY WHITE CARTOON GLOVES ===
  const upperArmGeo = new THREE.CapsuleGeometry(0.064, 0.25, 6, 10);
  const lowerArmGeo = new THREE.CapsuleGeometry(0.058, 0.24, 6, 10);
  const cuffGeo = new THREE.TorusGeometry(0.088, 0.032, 8, 12);
  const palmGeo = new THREE.SphereGeometry(0.145, 12, 10);
  const fingerGeo = new THREE.SphereGeometry(0.056, 8, 8);
  const stitchGeo = new THREE.BoxGeometry(0.015, 0.08, 0.016);

  const armSides: Array<{ shoulder: THREE.Group; elbow: THREE.Group; side: -1 | 1 }> = [
    { shoulder: rig.leftShoulder, elbow: rig.leftElbow, side: -1 },
    { shoulder: rig.rightShoulder, elbow: rig.rightElbow, side: 1 },
  ];

  for (const { shoulder, elbow, side } of armSides) {
    const upper = new THREE.Mesh(upperArmGeo, skyBlueMat);
    upper.position.y = -0.17;
    upper.castShadow = true;
    shoulder.add(upper);

    const lower = new THREE.Mesh(lowerArmGeo, skyBlueMat);
    lower.position.y = -0.15;
    lower.castShadow = true;
    elbow.add(lower);

    // Oversized puffy white cartoon glove
    const cuff = new THREE.Mesh(cuffGeo, whiteGloveMat);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.285;
    elbow.add(cuff);

    const gloveGroup = new THREE.Group();
    gloveGroup.position.set(0, -0.38, 0.025);
    elbow.add(gloveGroup);

    const palm = new THREE.Mesh(palmGeo, whiteGloveMat);
    palm.scale.set(1.08, 0.94, 1.06);
    palm.castShadow = true;
    gloveGroup.add(palm);

    // 3 plump cartoon glove fingers + thumb
    [-0.075, 0, 0.075].forEach((fx) => {
      const finger = new THREE.Mesh(fingerGeo, whiteGloveMat);
      finger.position.set(fx, -0.088, 0.068);
      finger.scale.set(0.96, 1.25, 1.08);
      gloveGroup.add(finger);
    });
    const thumb = new THREE.Mesh(fingerGeo, whiteGloveMat);
    thumb.position.set(-side * 0.125, -0.01, 0.06);
    thumb.scale.set(1.05, 0.95, 1.05);
    gloveGroup.add(thumb);

    // Classic cartoon black back-of-glove accent lines
    [-0.036, 0.036].forEach((sx) => {
      const stitch = new THREE.Mesh(stitchGeo, darkLineMat);
      stitch.position.set(sx, 0.02, -0.145);
      gloveGroup.add(stitch);
    });
  }

  // === SHORT STUBBY SKY-BLUE LEGS + FLAT WHITE BARE CARTOON CAT FEET WITH TOE LINES ===
  const thighGeo = new THREE.CapsuleGeometry(0.088, 0.16, 6, 10);
  const shinGeo = new THREE.CapsuleGeometry(0.078, 0.15, 6, 10);
  const footBaseGeo = new THREE.CylinderGeometry(0.132, 0.148, 0.1, 14);
  const footDomeGeo = new THREE.SphereGeometry(0.132, 10, 8);
  const toeLineGeo = new THREE.BoxGeometry(0.018, 0.032, 0.145);

  [
    [rig.leftHip, rig.leftKnee],
    [rig.rightHip, rig.rightKnee],
  ].forEach(([hip, knee]) => {
    const thigh = new THREE.Mesh(thighGeo, skyBlueMat);
    thigh.position.y = -0.14;
    thigh.castShadow = true;
    hip.add(thigh);

    const shin = new THREE.Mesh(shinGeo, skyBlueMat);
    shin.position.y = -0.13;
    shin.castShadow = true;
    knee.add(shin);

    // Flat oversized white bare cartoon cat foot
    const footGroup = new THREE.Group();
    footGroup.position.set(0, -0.31, 0.09);
    knee.add(footGroup);

    const flatFoot = new THREE.Mesh(footBaseGeo, whiteGloveMat);
    flatFoot.scale.set(0.96, 1.0, 1.68);
    flatFoot.castShadow = true;
    footGroup.add(flatFoot);

    const footTop = new THREE.Mesh(footDomeGeo, whiteGloveMat);
    footTop.position.set(0, 0.028, 0.02);
    footTop.scale.set(0.96, 0.48, 1.56);
    footGroup.add(footTop);

    // Two crisp dark cartoon toe divider lines on top front of each bare white cat foot
    [-0.048, 0.048].forEach((tx) => {
      const toeLine = new THREE.Mesh(toeLineGeo, darkLineMat);
      toeLine.position.set(tx, 0.046, 0.155);
      footGroup.add(toeLine);
    });
  });
}

function buildBlueBilla(rig: FighterRig): void {
  // Grounded proportions for lanky pear body + short stubby legs + noodle arms
  rig.pelvis.position.set(0, 0.68, 0);
  rig.torso.position.set(0, 0.1, 0);
  rig.head.position.set(0, 0.84, 0);
  rig.leftShoulder.position.set(-0.3, 0.65, 0);
  rig.rightShoulder.position.set(0.3, 0.65, 0);
  rig.leftElbow.position.set(0, -0.34, 0);
  rig.rightElbow.position.set(0, -0.34, 0);
  rig.leftHip.position.set(-0.17, -0.02, 0);
  rig.rightHip.position.set(0.17, -0.02, 0);
  rig.leftKnee.position.set(0, -0.28, 0);
  rig.rightKnee.position.set(0, -0.28, 0);

  // Balanced Satin-Matte Sky-Blue Fur (0.62) + Matte Cotton Gloves (0.86) + Metallic Gold Studs (0.85/0.22)
  const billaFurTex = createFabricWeaveTexture('#55BCE8', 'rgba(20,90,130,0.08)', 'rgba(224,242,254,0.08)', 4);
  const skyBlueMat = new THREE.MeshStandardMaterial({
    map: billaFurTex,
    color: 0xffffff,
    roughness: 0.62,
    metalness: 0,
    envMapIntensity: 0.26,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(skyBlueMat);

  const jetBlackMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.58,
    metalness: 0.04,
    envMapIntensity: 0.28,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 0,
  });

  const whiteGloveMat = new THREE.MeshStandardMaterial({
    color: 0xf5f7fa,
    roughness: 0.86,
    metalness: 0,
    envMapIntensity: 0.18,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(whiteGloveMat);

  // Sculpted Glossy Bright-Red Jellybean Nose Material
  const redNoseMat = new THREE.MeshStandardMaterial({
    color: 0xd91e2a,
    roughness: 0.2,
    metalness: 0.08,
    envMapIntensity: 1.0,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 0,
  });

  const yellowStudMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.22,
    metalness: 0.85,
    envMapIntensity: 1.2,
  });

  const eyeWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.3,
    metalness: 0,
    envMapIntensity: 0.25,
  });

  const emeraldIrisMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    roughness: 0.22,
    metalness: 0.06,
    envMapIntensity: 0.55,
  });
  rig.billaEyeGlowMats = [eyeWhiteMat, emeraldIrisMat];

  // === PLUMP PEAR-SHAPED SKY-BLUE TORSO (#55BCE8) ===
  const pearProfile = [
    new THREE.Vector2(0.02, -0.14),
    new THREE.Vector2(0.28, -0.12),
    new THREE.Vector2(0.41, 0.02),
    new THREE.Vector2(0.44, 0.18),
    new THREE.Vector2(0.4, 0.36),
    new THREE.Vector2(0.32, 0.54),
    new THREE.Vector2(0.23, 0.72),
    new THREE.Vector2(0.17, 0.84),
    new THREE.Vector2(0.02, 0.85),
  ];
  const pearTorsoGeo = new THREE.LatheGeometry(pearProfile, 18);
  const torsoMesh = new THREE.Mesh(pearTorsoGeo, skyBlueMat);
  torsoMesh.scale.set(1.02, 1.0, 0.94);
  torsoMesh.castShadow = true;
  rig.torso.add(torsoMesh);

  // Crisp Light-Grey/Off-White Oval Belly Patch (#E5E8EC) with Black Spiral Swirl (2D Canvas Texture)
  const bellyTex = createBillaBellyTexture();
  const bellyMat = new THREE.MeshStandardMaterial({
    map: bellyTex,
    color: 0xffffff,
    roughness: 0.78,
    metalness: 0,
    envMapIntensity: 0.22,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const bellyPatch = new THREE.Mesh(new THREE.SphereGeometry(0.33, 16, 12), bellyMat);
  bellyPatch.rotation.y = -Math.PI / 2; // Orient canvas u=0.5 directly forward (+Z)
  bellyPatch.position.set(0, 0.22, 0.275);
  bellyPatch.scale.set(0.45, 0.98, 0.88);
  rig.torso.add(bellyPatch);

  // === THICK CURVED SWAYING SKY-BLUE CAT TAIL ===
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.04, -0.35);
  rig.pelvis.add(tailPivot);
  rig.tailPivot = tailPivot;

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, -0.02, -0.22),
    new THREE.Vector3(0.06, 0.14, -0.44),
    new THREE.Vector3(0.02, 0.36, -0.54),
    new THREE.Vector3(-0.04, 0.52, -0.48),
  ]);
  const tailMesh = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 14, 0.056, 8, false), skyBlueMat);
  tailMesh.castShadow = true;
  tailPivot.add(tailMesh);

  const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), skyBlueMat);
  tailTip.position.set(-0.04, 0.52, -0.48);
  tailPivot.add(tailTip);

  // === SIGNATURE WIDE HORIZONTALLY FLARED HEAD, POINTY BLACK EARS, VERTICAL GREEN EYES & BIG RED NOSE ===
  const headMesh = createHeadMesh(rig.face.texture, 0.38);
  headMesh.position.y = 0.21;
  headMesh.scale.set(1.26, 0.86, 0.9);
  const headMat = headMesh.material as THREE.MeshStandardMaterial;
  headMat.roughness = 0.62;
  headMat.metalness = 0;
  headMat.envMapIntensity = 0.26;
  rig.flashMaterials.push(headMat);
  rig.head.add(headMesh);

  // Sharply Flaring Sky-Blue Left & Right Cheek Cones + Yellow Cheek Studs + 2 Sharp Tapered Black Whiskers
  const cheekConeGeo = new THREE.ConeGeometry(0.185, 0.34, 10);
  const studGeo = new THREE.SphereGeometry(0.04, 8, 8);
  const whiskerGeo = new THREE.ConeGeometry(0.015, 0.34, 6);

  [-1, 1].forEach((side) => {
    const cheekFlare = new THREE.Mesh(cheekConeGeo, skyBlueMat);
    cheekFlare.position.set(side * 0.45, 0.18, 0.035);
    cheekFlare.rotation.z = -side * Math.PI * 0.48;
    cheekFlare.scale.set(1.0, 1.0, 0.74);
    cheekFlare.castShadow = true;
    rig.head.add(cheekFlare);

    // Tiny yellow/gold cheek stud on far end of cheek
    const stud = new THREE.Mesh(studGeo, yellowStudMat);
    stud.position.set(side * 0.585, 0.18, 0.065);
    rig.head.add(stud);

    // 2 Sharp tapered jet-black whiskers sticking cleanly out from each cheek stud
    [-1, 1].forEach((wy) => {
      const whisker = new THREE.Mesh(whiskerGeo, jetBlackMat);
      whisker.position.set(side * 0.73, 0.18 + wy * 0.048, 0.07);
      whisker.rotation.z = -side * (Math.PI * 0.5 - wy * 0.26);
      rig.head.add(whisker);
    });
  });

  // Narrow, Tall Jet-Black Head Crest Splitting into Two Sharp Vertical Pointy Black Ears (#111111)
  const crestBase = new THREE.Mesh(new THREE.SphereGeometry(0.205, 14, 10), jetBlackMat);
  crestBase.position.set(0, 0.49, -0.02);
  crestBase.scale.set(1.06, 0.72, 0.8);
  crestBase.castShadow = true;
  rig.head.add(crestBase);

  const pointyEarGeo = new THREE.ConeGeometry(0.105, 0.46, 8);
  [-1, 1].forEach((side) => {
    const ear = new THREE.Mesh(pointyEarGeo, jetBlackMat);
    ear.position.set(side * 0.112, 0.74, -0.02);
    ear.rotation.z = -side * 0.085;
    ear.scale.set(1.0, 1.0, 0.62);
    ear.castShadow = true;
    rig.head.add(ear);
  });

  // Two Tall Vertical Oval White Eyes Close Together Right in Front of the Black Ears (Emerald-Green Irises + Pupils)
  const eyesGroup = new THREE.Group();
  eyesGroup.position.set(0, 0.43, 0.27);
  rig.head.add(eyesGroup);
  rig.billaEyesGroup = eyesGroup;

  const rimGeo = new THREE.SphereGeometry(0.104, 12, 10);
  const scleraGeo = new THREE.SphereGeometry(0.095, 14, 12);
  const irisGeo = new THREE.SphereGeometry(0.056, 12, 10);
  const pupilGeo = new THREE.SphereGeometry(0.032, 10, 8);
  const glintGeo = new THREE.SphereGeometry(0.016, 8, 8);

  [-1, 1].forEach((side) => {
    const eyeSocket = new THREE.Group();
    eyeSocket.position.set(side * 0.098, 0, 0);
    eyesGroup.add(eyeSocket);

    const rim = new THREE.Mesh(rimGeo, jetBlackMat);
    rim.scale.set(0.98, 1.64, 0.36);
    eyeSocket.add(rim);

    const sclera = new THREE.Mesh(scleraGeo, eyeWhiteMat);
    sclera.position.z = 0.012;
    sclera.scale.set(0.94, 1.56, 0.44);
    eyeSocket.add(sclera);

    // Sculpted sly/determined angled 3D eyelid hood & jet-black arcade fighter brow ridge!
    const eyelidHood = new THREE.Mesh(new THREE.BoxGeometry(0.195, 0.085, 0.072), skyBlueMat);
    eyelidHood.position.set(0, 0.115, 0.032);
    eyelidHood.rotation.z = side * 0.28;
    eyeSocket.add(eyelidHood);

    const browRidge = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.034, 0.082), jetBlackMat);
    browRidge.position.set(0, 0.084, 0.044);
    browRidge.rotation.z = side * 0.28;
    eyeSocket.add(browRidge);

    const pupilGroup = new THREE.Group();
    pupilGroup.position.set(-side * 0.012, -0.012, 0.044);
    eyeSocket.add(pupilGroup);
    rig.billaPupils.push(pupilGroup);

    const iris = new THREE.Mesh(irisGeo, emeraldIrisMat);
    iris.scale.set(1.04, 1.56, 0.36);
    pupilGroup.add(iris);

    const pupil = new THREE.Mesh(pupilGeo, jetBlackMat);
    pupil.position.z = 0.012;
    pupil.scale.set(0.9, 1.42, 0.3);
    pupilGroup.add(pupil);

    const glint = new THREE.Mesh(glintGeo, eyeWhiteMat);
    glint.position.set(-0.016, 0.034, 0.02);
    pupilGroup.add(glint);
  });

  // Oversized Glossy Bright-Red Oval/Jellybean Nose (#D91E2A) Right Below the Eyes
  const redNose = new THREE.Mesh(new THREE.SphereGeometry(0.132, 16, 12), redNoseMat);
  redNose.position.set(0, 0.255, 0.38);
  redNose.scale.set(1.56, 0.88, 0.92);
  redNose.castShadow = true;
  rig.head.add(redNose);

  // === NOODLE LIMBS, PUFFY WHITE GLOVES & FLAT WHITE CAT FEET ===
  addOggyCatLimbs(rig, skyBlueMat, whiteGloveMat, jetBlackMat);

  // === CHUNKY 3D NEON-GREEN & YELLOW GIANT FLYSWATTER PROP ("SWATTER SMASH") ===
  const swatter = new THREE.Group();
  const handleMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.3,
    metalness: 0.1,
    envMapIntensity: 0.6,
  });
  const shaftMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    roughness: 0.32,
    metalness: 0.08,
    envMapIntensity: 0.5,
  });
  const paddleSideMat = new THREE.MeshStandardMaterial({
    color: 0xfde047,
    roughness: 0.28,
    metalness: 0.1,
    emissive: new THREE.Color(0x22c55e),
    emissiveIntensity: 0.16,
  });
  const paddleFaceMat = new THREE.MeshStandardMaterial({
    map: createSwatterMeshTexture(),
    color: 0xffffff,
    roughness: 0.32,
    metalness: 0.05,
    emissive: new THREE.Color(0x4ade80),
    emissiveIntensity: 0.14,
  });

  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.34, 10), handleMat);
  grip.position.y = 0.12;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 1.15, 10), shaftMat);
  shaft.position.y = 0.82;
  const neckCollar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.09), handleMat);
  neckCollar.position.y = 1.32;

  const paddle = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.66, 0.075), [
    paddleSideMat,
    paddleSideMat,
    paddleSideMat,
    paddleSideMat,
    paddleFaceMat,
    paddleFaceMat,
  ]);
  paddle.position.y = 1.66;
  paddle.castShadow = true;

  swatter.add(grip, shaft, neckCollar, paddle);
  swatter.position.set(0, -0.38, 0.12);
  swatter.rotation.x = Math.PI * 0.5;
  swatter.visible = false;
  rig.rightElbow.add(swatter);
  rig.handProp = swatter;
}

let sharedNetaHairTex: THREE.CanvasTexture | null = null;
let sharedNetaKurtaTex: THREE.CanvasTexture | null = null;
let sharedNetaGamchaTex: THREE.CanvasTexture | null = null;
let sharedDharnaBannerTex: THREE.CanvasTexture | null = null;

function createNetaHairTexture(): THREE.CanvasTexture {
  if (sharedNetaHairTex) return sharedNetaHairTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Short salt-and-pepper base (#55595E)
  ctx.fillStyle = '#55595E';
  ctx.fillRect(0, 0, 256, 256);

  // Combed directional dark & silver-grey salt-and-pepper hair strands
  for (let i = 0; i < 140; i++) {
    const x = (i * 19) % 256;
    const y = (i * 37) % 256;
    ctx.strokeStyle = i % 3 === 0 ? '#CBD5E1' : i % 3 === 1 ? '#94A3B8' : '#33373B';
    ctx.lineWidth = i % 4 === 0 ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 34, y + 10);
    ctx.stroke();
  }

  // Subtle neat side-part seam line
  ctx.strokeStyle = '#9E6E4F';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(96, 42);
  ctx.lineTo(108, 165);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  sharedNetaHairTex = tex;
  return tex;
}

function createNetaKurtaTexture(): THREE.CanvasTexture {
  if (sharedNetaKurtaTex) return sharedNetaKurtaTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Warm dusty beige / off-white humble khadi cotton (#D5C9B6 so it contrasts clearly against Sheru's suit)
  ctx.fillStyle = '#D5C9B6';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle organic handloom khadi weave texture
  ctx.fillStyle = 'rgba(115, 100, 80, 0.11)';
  for (let y = 0; y < 256; y += 6) {
    ctx.fillRect(0, y, 256, 2);
  }
  ctx.fillStyle = 'rgba(255, 248, 236, 0.15)';
  for (let x = 0; x < 256; x += 8) {
    ctx.fillRect(x, 0, 2, 256);
  }

  // Front Kurta Placket & Collar Stitch centered at u = 0.5 (x = 128)
  const cx = 128;
  ctx.fillStyle = '#C2B49E';
  ctx.fillRect(cx - 12, 6, 24, 118);
  ctx.strokeStyle = '#7A6E5C';
  ctx.lineWidth = 3;
  ctx.strokeRect(cx - 12, 6, 24, 118);

  // Subtle top collar neckband border
  ctx.strokeStyle = '#857865';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(0, 14);
  ctx.lineTo(256, 14);
  ctx.stroke();

  // 3 modest wooden/off-white kurta buttons down the placket
  [36, 68, 100].forEach((by) => {
    ctx.fillStyle = '#EFE7D8';
    ctx.strokeStyle = '#5C5144';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(cx, by, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  sharedNetaKurtaTex = tex;
  return tex;
}

function createNetaGamchaTexture(): THREE.CanvasTexture {
  if (sharedNetaGamchaTex) return sharedNetaGamchaTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Warm off-white base weave (#EDE6DA)
  ctx.fillStyle = '#EDE6DA';
  ctx.fillRect(0, 0, 256, 256);

  // Authentic sharp red-and-white checkered gamcha weave (#C84B42)
  const step = 32;
  ctx.fillStyle = '#C84B42';
  for (let x = 0; x < 256; x += step) {
    ctx.fillRect(x, 0, 15, 256);
  }
  ctx.fillStyle = 'rgba(200, 75, 66, 0.72)';
  for (let y = 0; y < 256; y += step) {
    ctx.fillRect(0, y, 256, 15);
  }

  // Deep crimson thread intersections for authentic handloom depth
  ctx.fillStyle = '#9E322B';
  for (let x = 0; x < 256; x += step) {
    for (let y = 0; y < 256; y += step) {
      ctx.fillRect(x, y, 15, 15);
    }
  }

  // Fine off-white pinstripe highlight
  ctx.strokeStyle = 'rgba(237, 230, 218, 0.45)';
  ctx.lineWidth = 1.5;
  for (let i = 7; i < 256; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  sharedNetaGamchaTex = tex;
  return tex;
}

function createDharnaBannerTexture(): THREE.CanvasTexture {
  if (sharedDharnaBannerTex) return sharedDharnaBannerTex;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // Translucent golden-saffron protest placard band
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(245, 158, 11, 0.92)');
  grad.addColorStop(0.5, 'rgba(253, 224, 71, 0.96)');
  grad.addColorStop(1, 'rgba(234, 88, 12, 0.92)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 12, 512, 104);

  // Crisp saffron/crimson placard borders
  ctx.fillStyle = '#7C2D12';
  ctx.fillRect(0, 12, 512, 10);
  ctx.fillRect(0, 106, 512, 10);

  // Bold repeating "DHARNA!" protest typography
  ctx.fillStyle = '#450A0A';
  ctx.font = '900 44px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★ DHARNA! ★ DHARNA! ★', 256, 66);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  sharedDharnaBannerTex = tex;
  return tex;
}

function addNetaLimbs(
  rig: FighterRig,
  kurtaMat: THREE.MeshStandardMaterial,
  pajamaMat: THREE.MeshStandardMaterial,
  skinMat: THREE.MeshStandardMaterial,
  chappalMat: THREE.MeshStandardMaterial,
  kalavaRedMat: THREE.MeshStandardMaterial,
  kalavaOrangeMat: THREE.MeshStandardMaterial,
): void {
  // === HALF-SLEEVE LOOSE KURTA UPPER ARMS + BARE MEDIUM-BROWN FOREARMS + RIGHT WRIST KALAVA ===
  const sleeveGeo = new THREE.CylinderGeometry(0.118, 0.132, 0.3, 12);
  const forearmGeo = new THREE.CapsuleGeometry(0.088, 0.21, 6, 10);
  const handGeo = new THREE.SphereGeometry(0.118, 10, 10);

  const armSides: Array<{ shoulder: THREE.Group; elbow: THREE.Group; side: -1 | 1 }> = [
    { shoulder: rig.leftShoulder, elbow: rig.leftElbow, side: -1 },
    { shoulder: rig.rightShoulder, elbow: rig.rightElbow, side: 1 },
  ];

  for (const { shoulder, elbow, side } of armSides) {
    // Loose dusty off-white half-sleeve kurta arm
    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.125, 10, 8), kurtaMat);
    shoulderCap.castShadow = true;
    shoulder.add(shoulderCap);

    const upperSleeve = new THREE.Mesh(sleeveGeo, kurtaMat);
    upperSleeve.position.y = -0.15;
    upperSleeve.castShadow = true;
    shoulder.add(upperSleeve);

    // Bare brown forearm
    const forearm = new THREE.Mesh(forearmGeo, skinMat);
    forearm.position.y = -0.14;
    forearm.castShadow = true;
    elbow.add(forearm);

    // Thin Red-Orange Sacred Thread (Kalava) wrapped around his right wrist
    if (side === 1) {
      const k1 = new THREE.Mesh(new THREE.TorusGeometry(0.094, 0.019, 6, 14), kalavaRedMat);
      k1.rotation.x = Math.PI / 2;
      k1.position.y = -0.228;
      elbow.add(k1);

      const k2 = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.016, 6, 14), kalavaOrangeMat);
      k2.rotation.x = Math.PI / 2 + 0.16;
      k2.position.y = -0.248;
      elbow.add(k2);
    }

    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.y = -0.3;
    hand.scale.set(0.95, 1.05, 1.02);
    hand.castShadow = true;
    elbow.add(hand);
  }

  // === LOOSE DUSTY OFF-WHITE PAJAMA LEGS + BARE FEET IN CRISS-CROSS LEATHER DESI CHAPPALS ===
  const thighGeo = new THREE.CapsuleGeometry(0.142, 0.24, 6, 12);
  const shinGeo = new THREE.CapsuleGeometry(0.126, 0.19, 6, 12);
  const cuffGeo = new THREE.CylinderGeometry(0.128, 0.136, 0.07, 12);
  const ankleGeo = new THREE.CylinderGeometry(0.078, 0.082, 0.11, 10);
  const bareFootGeo = new THREE.BoxGeometry(0.185, 0.075, 0.28);
  const toeBumpGeo = new THREE.SphereGeometry(0.036, 8, 8);
  const chappalSoleGeo = new THREE.BoxGeometry(0.23, 0.044, 0.37);
  const strapGeo = new THREE.BoxGeometry(0.235, 0.026, 0.052);

  [
    [rig.leftHip, rig.leftKnee],
    [rig.rightHip, rig.rightKnee],
  ].forEach(([hip, knee]) => {
    const thigh = new THREE.Mesh(thighGeo, pajamaMat);
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    hip.add(thigh);

    const shin = new THREE.Mesh(shinGeo, pajamaMat);
    shin.position.y = -0.17;
    shin.castShadow = true;
    knee.add(shin);

    const cuff = new THREE.Mesh(cuffGeo, pajamaMat);
    cuff.position.y = -0.295;
    knee.add(cuff);

    // Bare medium-brown ankle & foot resting on desi chappal
    const ankle = new THREE.Mesh(ankleGeo, skinMat);
    ankle.position.set(0, -0.355, 0.01);
    knee.add(ankle);

    const footGroup = new THREE.Group();
    footGroup.position.set(0, -0.415, 0.065);
    knee.add(footGroup);

    // Flat dark brown/charcoal leather desi chappal sole (#3A332E)
    const sole = new THREE.Mesh(chappalSoleGeo, chappalMat);
    sole.position.set(0, -0.032, 0.015);
    sole.castShadow = true;
    footGroup.add(sole);

    // Bare brown foot resting on top of the chappal sole
    const bareFoot = new THREE.Mesh(bareFootGeo, skinMat);
    bareFoot.position.set(0, 0.015, 0.01);
    bareFoot.castShadow = true;
    footGroup.add(bareFoot);

    // Subtle bare toes peeking out front of chappal
    [-0.052, 0, 0.052].forEach((tx) => {
      const toe = new THREE.Mesh(toeBumpGeo, skinMat);
      toe.position.set(tx, 0.008, 0.155);
      toe.scale.set(0.9, 0.78, 1.05);
      footGroup.add(toe);
    });

    // Criss-cross dark leather chappal straps arching across bare foot
    [-1, 1].forEach((dir) => {
      const strap = new THREE.Mesh(strapGeo, chappalMat);
      strap.position.set(0, 0.054, 0.045);
      strap.rotation.y = dir * 0.44;
      footGroup.add(strap);
    });
  });
}

function buildGaribSenaNeta(rig: FighterRig): void {
  // Lean everyday grassroots activist proportions
  rig.leftShoulder.position.set(-0.39, 0.65, 0);
  rig.rightShoulder.position.set(0.39, 0.65, 0);
  rig.head.position.set(0, 0.87, 0);

  // Humble Matte Cotton & Earthy Materials (zero pure white washout under studio spotlights!)
  const kurtaPlainMat = new THREE.MeshStandardMaterial({
    color: 0xd5c9b6, // Warm slightly dusty beige/off-white cotton (distinct from Sheru's crisp white suit)
    roughness: 0.94,
    metalness: 0,
    envMapIntensity: 0.14,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(kurtaPlainMat);

  const kurtaPlacketMat = new THREE.MeshStandardMaterial({
    map: createNetaKurtaTexture(),
    color: 0xffffff,
    roughness: 0.94,
    metalness: 0,
    envMapIntensity: 0.14,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(kurtaPlacketMat);

  const pajamaWeaveTex = createFabricWeaveTexture('#CBBFA9', 'rgba(92,80,62,0.12)', 'rgba(255,248,236,0.10)', 3);
  const jholaWeaveTex = createFabricWeaveTexture('#A8977C', 'rgba(66,54,38,0.16)', 'rgba(235,222,198,0.10)', 4);

  const pajamaMat = new THREE.MeshStandardMaterial({
    map: pajamaWeaveTex,
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0,
    envMapIntensity: 0.14,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(pajamaMat);

  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xb87d56, // Warm medium-brown skin (#B87D56) in satin-matte finish
    roughness: 0.62,
    metalness: 0,
    envMapIntensity: 0.24,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(skinMat);

  const gamchaMat = new THREE.MeshStandardMaterial({
    map: createNetaGamchaTexture(),
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0,
    envMapIntensity: 0.18,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(gamchaMat);

  const fringeCreamMat = new THREE.MeshStandardMaterial({
    color: 0xede6da,
    roughness: 0.9,
    metalness: 0,
    envMapIntensity: 0.18,
  });
  const fringeRedMat = new THREE.MeshStandardMaterial({
    color: 0xc84b42,
    roughness: 0.88,
    metalness: 0,
    envMapIntensity: 0.18,
  });

  const jholaMat = new THREE.MeshStandardMaterial({
    map: jholaWeaveTex,
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0,
    envMapIntensity: 0.14,
  });
  const jholaStrapMat = new THREE.MeshStandardMaterial({
    color: 0x877459,
    roughness: 0.9,
    metalness: 0,
    envMapIntensity: 0.14,
  });
  const jholaInsideMat = new THREE.MeshStandardMaterial({
    color: 0x423a2e,
    roughness: 0.95,
    metalness: 0,
    envMapIntensity: 0.1,
  });

  const chappalMat = new THREE.MeshStandardMaterial({
    color: 0x3a332e, // Dark brown/charcoal leather desi chappals (#3A332E)
    roughness: 0.72,
    metalness: 0.05,
    envMapIntensity: 0.25,
  });

  const kalavaRedMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.82,
    metalness: 0,
    envMapIntensity: 0.2,
  });
  const kalavaOrangeMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    roughness: 0.82,
    metalness: 0,
    envMapIntensity: 0.2,
  });

  const hairMat = new THREE.MeshStandardMaterial({
    map: createNetaHairTexture(),
    color: 0xffffff,
    roughness: 0.84,
    metalness: 0,
    envMapIntensity: 0.18,
  });

  const wireFrameMat = new THREE.MeshStandardMaterial({
    color: 0x4b5563, // Sleek gunmetal-silver wire frame so rectangular glasses pop cleanly
    roughness: 0.22,
    metalness: 0.85,
    envMapIntensity: 1.0,
  });

  const lensMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    roughness: 0.12,
    metalness: 0.15,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });

  // === WORN DUSTY OFF-WHITE HALF-SLEEVE KURTA & FLOWING LOWER HEM ===
  const kurtaSkirt = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.41, 0.44, 16), kurtaPlainMat);
  kurtaSkirt.position.y = -0.07;
  kurtaSkirt.scale.set(1.0, 1.0, 0.88);
  kurtaSkirt.castShadow = true;
  rig.pelvis.add(kurtaSkirt);

  const torsoMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.34, 0.74, 16), kurtaPlacketMat);
  torsoMesh.position.y = 0.36;
  torsoMesh.rotation.y = Math.PI; // Place canvas u=0.5 front placket directly at +Z
  torsoMesh.scale.set(1.0, 1.0, 0.88);
  torsoMesh.castShadow = true;
  rig.torso.add(torsoMesh);

  // Crisp tailored mandarin kurta collar with subtle dark top-stitch rim
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.188, 0.212, 0.115, 14), kurtaPlainMat);
  collar.position.y = 0.74;
  rig.torso.add(collar);

  const collarEdgeTrim = new THREE.Mesh(
    new THREE.TorusGeometry(0.188, 0.012, 6, 16),
    jholaStrapMat,
  );
  collarEdgeTrim.rotation.x = Math.PI / 2;
  collarEdgeTrim.position.y = 0.795;
  rig.torso.add(collarEdgeTrim);

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.16, 12), skinMat);
  neck.position.y = 0.8;
  rig.torso.add(neck);

  // === SIGNATURE RED-AND-WHITE CHECKERED GAMCHA WITH FRINGED ENDS ===
  // Sculpted cloth collar loop loosely wrapped around neck
  const gamchaNeck = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.055, 8, 18), gamchaMat);
  gamchaNeck.rotation.x = Math.PI / 2 + 0.14;
  gamchaNeck.position.set(0, 0.72, 0.02);
  gamchaNeck.scale.set(1.08, 1.02, 0.92);
  gamchaNeck.castShadow = true;
  rig.torso.add(gamchaNeck);

  // Long flat checkered gamcha strip hanging down his left chest (-X, faces camera in P1 stance!)
  const gamchaFrontStrip = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.74, 0.042), gamchaMat);
  gamchaFrontStrip.position.set(-0.18, 0.36, 0.335);
  gamchaFrontStrip.rotation.z = -0.1;
  gamchaFrontStrip.rotation.y = -0.24;
  gamchaFrontStrip.castShadow = true;
  rig.torso.add(gamchaFrontStrip);
  rig.gamchaFront = gamchaFrontStrip;

  // Tiny cotton fringe tassels along the bottom edge of the front hanging gamcha strip
  const fringeGeo = new THREE.CylinderGeometry(0.009, 0.006, 0.08, 5);
  for (let i = -2; i <= 2; i++) {
    const tassel = new THREE.Mesh(fringeGeo, i % 2 === 0 ? fringeCreamMat : fringeRedMat);
    tassel.position.set(-0.215 + i * 0.036, -0.035, 0.335 - i * 0.008);
    tassel.rotation.z = -0.08;
    rig.torso.add(tassel);
  }

  // Shorter checkered gamcha tail draping behind left shoulder
  const gamchaBackStrip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.52, 0.042), gamchaMat);
  gamchaBackStrip.position.set(-0.17, 0.45, -0.31);
  gamchaBackStrip.rotation.z = -0.08;
  rig.torso.add(gamchaBackStrip);
  rig.gamchaBack = gamchaBackStrip;

  for (let i = -2; i <= 2; i++) {
    const backTassel = new THREE.Mesh(fringeGeo, i % 2 === 0 ? fringeCreamMat : fringeRedMat);
    backTassel.position.set(-0.19 + i * 0.034, 0.16, -0.31);
    rig.torso.add(backTassel);
  }

  // === ICONIC STUFFED CLOTH JHOLA (SLING BAG) + DIAGONAL STRAP + BOBBING COLORFUL PAMPHLETS ===
  // Diagonal worn khaki strap running clearly proud of the torso from right shoulder (+X) to left hip (-X)
  const frontStrap = new THREE.Mesh(new THREE.BoxGeometry(0.076, 0.94, 0.03), jholaStrapMat);
  frontStrap.position.set(-0.04, 0.37, 0.316);
  frontStrap.rotation.z = -0.64;
  frontStrap.castShadow = true;
  rig.torso.add(frontStrap);

  const backStrap = new THREE.Mesh(new THREE.BoxGeometry(0.076, 0.94, 0.03), jholaStrapMat);
  backStrap.position.set(-0.04, 0.37, -0.31);
  backStrap.rotation.z = -0.64;
  rig.torso.add(backStrap);

  const shoulderStrapPad = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.055, 0.64), jholaStrapMat);
  shoulderStrapPad.position.set(0.24, 0.72, 0.0);
  rig.torso.add(shoulderStrapPad);

  // Bulky, slightly sagging cloth jhola bag hanging at left hip (-X)
  const jholaPivot = new THREE.Group();
  jholaPivot.position.set(-0.37, 0.05, 0.02);
  rig.torso.add(jholaPivot);
  rig.jholaPivot = jholaPivot;

  // Slightly sagging plump cloth sack (wider at bottom, soft rounded belly)
  const jholaBody = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.37, 12), jholaMat);
  jholaBody.position.set(-0.04, -0.18, 0);
  jholaBody.scale.set(0.7, 1.0, 1.2);
  jholaBody.castShadow = true;
  jholaPivot.add(jholaBody);

  // Darker khaki front pocket band on the outer side of the jhola for textile detail
  const jholaPocket = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.16, 0.22), jholaStrapMat);
  jholaPocket.position.set(-0.155, -0.2, 0.0);
  jholaPivot.add(jholaPocket);

  const jholaBottomSag = new THREE.Mesh(new THREE.SphereGeometry(0.175, 10, 8), jholaMat);
  jholaBottomSag.position.set(-0.045, -0.34, 0);
  jholaBottomSag.scale.set(0.7, 0.54, 1.2);
  jholaPivot.add(jholaBottomSag);

  // Dark inner opening rim at top of jhola
  const jholaRim = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.042, 10), jholaInsideMat);
  jholaRim.position.set(-0.04, -0.005, 0);
  jholaRim.scale.set(0.64, 1.0, 1.14);
  jholaPivot.add(jholaRim);

  // 4 Colorful Miniature Paper Stacks / Pamphlets / Notebooks peeking proudly out of open jhola top!
  const jholaPapersGroup = new THREE.Group();
  jholaPapersGroup.position.set(-0.04, 0.025, 0);
  jholaPivot.add(jholaPapersGroup);
  rig.jholaPapersGroup = jholaPapersGroup;

  const paperSpecs: Array<{
    color: number;
    size: [number, number, number];
    pos: [number, number, number];
    rot: [number, number, number];
  }> = [
    { color: 0xfacc15, size: [0.048, 0.22, 0.145], pos: [-0.025, 0.075, 0.065], rot: [0.22, 0.12, 0.14] }, // Yellow manifesto notebook
    { color: 0x38bdf8, size: [0.038, 0.24, 0.135], pos: [0.012, 0.095, -0.015], rot: [-0.16, -0.08, -0.1] }, // Sky-blue petition folder
    { color: 0xf43f5e, size: [0.034, 0.19, 0.12], pos: [-0.035, 0.06, -0.085], rot: [-0.28, 0.16, 0.18] }, // Crimson-pink rally pamphlets
    { color: 0x22c55e, size: [0.036, 0.2, 0.11], pos: [0.022, 0.068, 0.105], rot: [0.28, -0.14, -0.15] }, // Green leaflet stack
  ];
  for (const spec of paperSpecs) {
    const pMat = new THREE.MeshStandardMaterial({
      color: spec.color,
      roughness: 0.72,
      metalness: 0,
      envMapIntensity: 0.24,
    });
    const paper = new THREE.Mesh(new THREE.BoxGeometry(...spec.size), pMat);
    paper.position.set(...spec.pos);
    paper.rotation.set(...spec.rot);
    jholaPapersGroup.add(paper);
  }

  // === HEAD, SHORT NEATLY PARTED SALT-AND-PEPPER HAIR & WIRE-FRAME RECTANGULAR SPECTACLES ===
  const headMesh = createHeadMesh(rig.face.texture, 0.36);
  headMesh.position.y = 0.2;
  headMesh.scale.set(0.95, 1.05, 0.96);
  const headMat = headMesh.material as THREE.MeshStandardMaterial;
  headMat.roughness = 0.62;
  headMat.metalness = 0;
  headMat.envMapIntensity = 0.24;
  rig.flashMaterials.push(headMat);
  rig.head.add(headMesh);

  // Subtle sculpted nose & ears matching warm medium-brown skin
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 8), skinMat);
  nose.position.set(0, 0.185, 0.352);
  nose.scale.set(0.85, 1.05, 0.92);
  rig.head.add(nose);

  [-0.335, 0.335].forEach((ex) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.068, 8, 8), skinMat);
    ear.position.set(ex, 0.2, 0.0);
    ear.scale.set(0.55, 1.1, 0.8);
    rig.head.add(ear);
  });

  // Sculpted Short, Neatly Parted Salt-and-Pepper Hair Cap tilted back cleanly above eyebrows
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.376, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.49),
    hairMat,
  );
  hairCap.position.set(0, 0.235, -0.032);
  hairCap.rotation.x = -0.36; // Exposes forehead, expressive eyebrows & spectacles cleanly while covering back of head!
  hairCap.scale.set(0.97, 1.04, 0.99);
  hairCap.castShadow = true;
  rig.head.add(hairCap);

  // Subtle neatly combed side-part crown crest tucked closely to the top of skull
  const hairWave = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), hairMat);
  hairWave.position.set(0.05, 0.525, 0.07);
  hairWave.scale.set(1.22, 0.34, 0.78);
  hairWave.rotation.z = -0.12;
  rig.head.add(hairWave);

  // Tapered salt-and-pepper sideburns
  [-0.315, 0.315].forEach((tx) => {
    const sideburn = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.15, 0.11), hairMat);
    sideburn.position.set(tx, 0.265, 0.005);
    rig.head.add(sideburn);
  });

  // Thin, Understated Wire-Frame Rectangular Spectacles with Translucent Lenses
  const glassesGroup = new THREE.Group();
  glassesGroup.position.set(0, 0.242, 0.362);
  rig.head.add(glassesGroup);

  const frameW = 0.152;
  const frameH = 0.094;
  const barT = 0.013;
  const horizBarGeo = new THREE.BoxGeometry(frameW, barT, barT);
  const vertBarGeo = new THREE.BoxGeometry(barT, frameH, barT);
  const lensGeo = new THREE.PlaneGeometry(frameW - 0.012, frameH - 0.012);
  const templeArmGeo = new THREE.BoxGeometry(0.012, 0.012, 0.34);

  [-1, 1].forEach((side) => {
    const lx = side * 0.116;

    const topBar = new THREE.Mesh(horizBarGeo, wireFrameMat);
    topBar.position.set(lx, frameH / 2, 0);
    const botBar = new THREE.Mesh(horizBarGeo, wireFrameMat);
    botBar.position.set(lx, -frameH / 2, 0);
    const innerBar = new THREE.Mesh(vertBarGeo, wireFrameMat);
    innerBar.position.set(lx - side * (frameW / 2), 0, 0);
    const outerBar = new THREE.Mesh(vertBarGeo, wireFrameMat);
    outerBar.position.set(lx + side * (frameW / 2), 0, 0);

    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.set(lx, 0, -0.002);

    const temple = new THREE.Mesh(templeArmGeo, wireFrameMat);
    temple.position.set(lx + side * (frameW / 2 + 0.014), 0.012, -0.17);
    temple.rotation.y = side * 0.14;

    glassesGroup.add(topBar, botBar, innerBar, outerBar, lens, temple);
  });

  const noseBridge = new THREE.Mesh(new THREE.BoxGeometry(0.086, barT, barT), wireFrameMat);
  noseBridge.position.set(0, 0.016, 0.002);
  glassesGroup.add(noseBridge);

  // === HALF-SLEEVE KURTA ARMS, KALAVA WRIST THREAD, PAJAMA LEGS & BARE FEET IN DESI CHAPPALS ===
  addNetaLimbs(
    rig,
    kurtaPlainMat,
    pajamaMat,
    skinMat,
    chappalMat,
    kalavaRedMat,
    kalavaOrangeMat,
  );

  // === GLOWING GOLDEN-SAFFRON "DHARNA!" PLACARD RING ATTACHED TO HIS SHIELD AURA ===
  const dharnaRingGroup = new THREE.Group();
  dharnaRingGroup.position.y = 0.62;

  const placardBandMat = new THREE.MeshStandardMaterial({
    map: createDharnaBannerTexture(),
    color: 0xffffff,
    emissive: new THREE.Color(0xf59e0b),
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.92,
    roughness: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const placardCylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(1.18, 1.18, 0.34, 28, 1, true),
    placardBandMat,
  );
  dharnaRingGroup.add(placardCylinder);

  const glowRingMat = new THREE.MeshStandardMaterial({
    color: 0xfde047,
    emissive: new THREE.Color(0xf59e0b),
    emissiveIntensity: 1.2,
    roughness: 0.2,
  });
  [-0.18, 0.18].forEach((ry) => {
    const energyRim = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.028, 8, 32), glowRingMat);
    energyRim.rotation.x = Math.PI / 2;
    energyRim.position.y = ry;
    dharnaRingGroup.add(energyRim);
  });

  rig.shieldAura.add(dharnaRingGroup);
  rig.dharnaRing = dharnaRingGroup;
}

let sharedAndaStripeTex: THREE.CanvasTexture | null = null;

function createAndaStripeTexture(): THREE.CanvasTexture {
  if (sharedAndaStripeTex) return sharedAndaStripeTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // Crisp horizontal navy-blue (#1B3B6F) and white (#F4F4F4) shirt stripes
  const stripeH = 16;
  for (let y = 0; y < 128; y += stripeH) {
    const isNavy = (y / stripeH) % 2 === 0;
    ctx.fillStyle = isNavy ? '#1B3B6F' : '#F4F4F4';
    ctx.fillRect(0, y, 128, stripeH);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1.5);
  tex.needsUpdate = true;
  sharedAndaStripeTex = tex;
  return tex;
}

function addAndaLimbs(
  rig: FighterRig,
  stripeMat: THREE.MeshStandardMaterial,
  cuffRedMat: THREE.MeshStandardMaterial,
  peachSkinMat: THREE.MeshStandardMaterial,
  navyLegMat: THREE.MeshStandardMaterial,
  tealBootMat: THREE.MeshStandardMaterial,
  whiteRimMat: THREE.MeshStandardMaterial,
  redSoleMat: THREE.MeshStandardMaterial,
): void {
  // === SKINNY HORIZONTAL-STRIPED ARMS + RED WRIST CUFFS + PEACH CARTOON HANDS ===
  const upperArmGeo = new THREE.CylinderGeometry(0.064, 0.058, 0.28, 10);
  const forearmGeo = new THREE.CylinderGeometry(0.058, 0.054, 0.24, 10);
  const cuffGeo = new THREE.CylinderGeometry(0.076, 0.08, 0.068, 12);
  const handGeo = new THREE.SphereGeometry(0.105, 10, 10);
  const thumbGeo = new THREE.SphereGeometry(0.044, 8, 8);

  const armPairs: Array<{ shoulder: THREE.Group; elbow: THREE.Group; side: -1 | 1 }> = [
    { shoulder: rig.leftShoulder, elbow: rig.leftElbow, side: -1 },
    { shoulder: rig.rightShoulder, elbow: rig.rightElbow, side: 1 },
  ];

  for (const { shoulder, elbow, side } of armPairs) {
    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.072, 10, 8), stripeMat);
    shoulderCap.castShadow = true;
    shoulder.add(shoulderCap);

    const upperArm = new THREE.Mesh(upperArmGeo, stripeMat);
    upperArm.position.y = -0.14;
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const elbowCap = new THREE.Mesh(new THREE.SphereGeometry(0.062, 8, 8), stripeMat);
    elbow.add(elbowCap);

    const forearm = new THREE.Mesh(forearmGeo, stripeMat);
    forearm.position.y = -0.12;
    forearm.castShadow = true;
    elbow.add(forearm);

    // Small crisp red wrist cuff (#D92323)
    const wristCuff = new THREE.Mesh(cuffGeo, cuffRedMat);
    wristCuff.position.y = -0.22;
    wristCuff.castShadow = true;
    elbow.add(wristCuff);

    // Expressive peach cartoon hand + little thumb
    const hand = new THREE.Mesh(handGeo, peachSkinMat);
    hand.position.y = -0.31;
    hand.scale.set(0.95, 1.05, 1.02);
    hand.castShadow = true;
    elbow.add(hand);

    const thumb = new THREE.Mesh(thumbGeo, peachSkinMat);
    thumb.position.set(-side * 0.085, -0.285, 0.055);
    elbow.add(thumb);
  }

  // === THIN DARK NAVY-BLUE LEGS (#183059) + CHUNKY TEAL-GREEN BOOTS (#269484) WITH WHITE RIMS & RED SOLES ===
  const thighGeo = new THREE.CylinderGeometry(0.068, 0.06, 0.34, 10);
  const shinGeo = new THREE.CylinderGeometry(0.058, 0.054, 0.21, 10);
  const bootShaftGeo = new THREE.CylinderGeometry(0.112, 0.122, 0.17, 12);
  const bootCuffGeo = new THREE.TorusGeometry(0.112, 0.024, 8, 14);
  const bootBodyGeo = new THREE.BoxGeometry(0.215, 0.125, 0.31);
  const bootToeGeo = new THREE.SphereGeometry(0.115, 12, 10);
  const whiteRimGeo = new THREE.BoxGeometry(0.238, 0.036, 0.39);
  const redSoleGeo = new THREE.BoxGeometry(0.244, 0.028, 0.396);

  [
    [rig.leftHip, rig.leftKnee],
    [rig.rightHip, rig.rightKnee],
  ].forEach(([hip, knee]) => {
    const thigh = new THREE.Mesh(thighGeo, navyLegMat);
    thigh.position.y = -0.16;
    thigh.castShadow = true;
    hip.add(thigh);

    const kneeJoint = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), navyLegMat);
    knee.add(kneeJoint);

    const shin = new THREE.Mesh(shinGeo, navyLegMat);
    shin.position.y = -0.1;
    shin.castShadow = true;
    knee.add(shin);

    // Chunky Teal-Green Boot anchored cleanly so red sole bottom rests flush at y = 0
    const bootGroup = new THREE.Group();
    bootGroup.position.set(0, -0.24, 0.02);
    knee.add(bootGroup);

    const shaft = new THREE.Mesh(bootShaftGeo, tealBootMat);
    shaft.position.set(0, 0.0, 0);
    shaft.castShadow = true;
    bootGroup.add(shaft);

    const topLip = new THREE.Mesh(bootCuffGeo, tealBootMat);
    topLip.rotation.x = Math.PI / 2;
    topLip.position.set(0, 0.082, 0);
    bootGroup.add(topLip);

    const body = new THREE.Mesh(bootBodyGeo, tealBootMat);
    body.position.set(0, -0.065, 0.055);
    body.castShadow = true;
    bootGroup.add(body);

    const toeCap = new THREE.Mesh(bootToeGeo, tealBootMat);
    toeCap.position.set(0, -0.065, 0.195);
    toeCap.scale.set(0.95, 0.68, 1.04);
    toeCap.castShadow = true;
    bootGroup.add(toeCap);

    // Crisp white sole rim (#F4F4F4)
    const whiteRim = new THREE.Mesh(whiteRimGeo, whiteRimMat);
    whiteRim.position.set(0, -0.125, 0.075);
    bootGroup.add(whiteRim);

    const whiteToeRim = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.118, 0.036, 12), whiteRimMat);
    whiteToeRim.position.set(0, -0.125, 0.21);
    bootGroup.add(whiteToeRim);

    // Bright red boot bottom sole (#D92323)
    const redSole = new THREE.Mesh(redSoleGeo, redSoleMat);
    redSole.position.set(0, -0.152, 0.075);
    redSole.castShadow = true;
    bootGroup.add(redSole);

    const redToeSole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.028, 12), redSoleMat);
    redToeSole.position.set(0, -0.152, 0.21);
    bootGroup.add(redToeSole);
  });
}

function buildAndaBhai(rig: FighterRig): void {
  // === 1. POINTED-TOP WARM PEACH-TAN EGG BODY (LatheGeometry) ===
  // Exact profile helper so 3D nose, folded white collar, bow tie, buttons & hat sit flush on surface!
  const evalAndaEgg = (t: number): { y: number; r: number } => {
    const s = -Math.cos(t * Math.PI); // -1 (bottom) .. +1 (pointed top)
    const y = -0.04 + 0.69 * (1 + s); // spans y = -0.04 .. 1.34 (height 1.38)
    const rSphere = Math.sqrt(Math.max(0, 1 - s * s));
    const taper = 1.0 - 0.21 * s - 0.05 * s * s; // Chunky plump lower half, softly pointed oval top
    const r = Math.max(0.002, 0.53 * rSphere * taper);
    return { y, r };
  };

  const lathePts: THREE.Vector2[] = [];
  const profileSteps = 24;
  for (let i = 0; i <= profileSteps; i++) {
    const t = i / profileSteps;
    const { y, r } = evalAndaEgg(t);
    lathePts.push(new THREE.Vector2(i === 0 || i === profileSteps ? 0.001 : r, y));
  }

  const eggGeo = new THREE.LatheGeometry(lathePts, 24);
  eggGeo.computeVertexNormals();

  // Warm Peach-Tan Satin-Matte Eggshell + Lower Red Vest Canvas Material (roughness: 0.60, no shiny plastic look!)
  const eggMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: rig.face.texture,
    roughness: 0.6,
    metalness: 0,
    envMapIntensity: 0.24,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(eggMat);

  const eggMesh = new THREE.Mesh(eggGeo, eggMat);
  eggMesh.rotation.y = Math.PI; // Maps Canvas u = 0.5 (face, bow tie front, suspenders) directly to +Z!
  eggMesh.castShadow = true;
  rig.torso.add(eggMesh);

  // Grounded satin-matte eggshell & woven matte cloth materials for Anda Bhai
  const redVestWeaveTex = createFabricWeaveTexture('#D92323', 'rgba(127,29,29,0.18)', 'rgba(255,210,210,0.08)', 3);
  const topHatFeltTex = createFabricWeaveTexture('#1B3B6F', 'rgba(15,23,42,0.22)', 'rgba(148,163,184,0.08)', 3);

  const peachNoseMat = new THREE.MeshStandardMaterial({
    color: 0xf0ba88,
    roughness: 0.6,
    metalness: 0,
    envMapIntensity: 0.24,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(peachNoseMat);

  const topHatNavyMat = new THREE.MeshStandardMaterial({
    map: topHatFeltTex,
    color: 0xffffff,
    roughness: 0.78, // Tailored wool felt top hat instead of shiny plastic
    metalness: 0,
    envMapIntensity: 0.22,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(topHatNavyMat);

  const ribbonRedMat = new THREE.MeshStandardMaterial({
    color: 0xc82323,
    roughness: 0.72,
    metalness: 0,
    envMapIntensity: 0.22,
  });

  const redVestMat = new THREE.MeshStandardMaterial({
    map: redVestWeaveTex,
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0,
    envMapIntensity: 0.18,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(redVestMat);

  const whiteCollarMat = new THREE.MeshStandardMaterial({
    color: 0xf4f4f4,
    roughness: 0.84,
    metalness: 0,
    envMapIntensity: 0.18,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(whiteCollarMat);

  const bowTieYellowMat = new THREE.MeshStandardMaterial({
    color: 0xf5c518,
    roughness: 0.72,
    metalness: 0.02,
    envMapIntensity: 0.24,
  });

  const greenButtonMat = new THREE.MeshStandardMaterial({
    color: 0x16a34a,
    roughness: 0.28,
    metalness: 0.25,
    envMapIntensity: 0.55,
  });

  const navySuspenderMat = new THREE.MeshStandardMaterial({
    color: 0x183059,
    roughness: 0.86,
    metalness: 0,
    envMapIntensity: 0.18,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(navySuspenderMat);

  const stripeSleeveMat = new THREE.MeshStandardMaterial({
    map: createAndaStripeTexture(),
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0,
    envMapIntensity: 0.18,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(stripeSleeveMat);

  const tealBootMat = new THREE.MeshStandardMaterial({
    color: 0x228476,
    roughness: 0.52,
    metalness: 0.04,
    envMapIntensity: 0.28,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(tealBootMat);

  // === 2. SCULPTED 3D POINTY PEACH NOSE ===
  // Sits at t = 0.58 (between big white-and-blue eyes and puckered whistling mouth!)
  const nosePos = evalAndaEgg(0.58);
  const noseGroup = new THREE.Group();
  noseGroup.position.set(0, nosePos.y, nosePos.r - 0.015);
  rig.torso.add(noseGroup);

  const noseCone = new THREE.Mesh(new THREE.ConeGeometry(0.054, 0.15, 12), peachNoseMat);
  noseCone.rotation.x = Math.PI / 2 + 0.1;
  noseCone.position.set(0, 0.004, 0.055);
  noseCone.castShadow = true;
  noseGroup.add(noseCone);

  const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), peachNoseMat);
  noseTip.position.set(0, 0.008, 0.118);
  noseGroup.add(noseTip);

  // === 3. DAPPER TILTED DARK NAVY-BLUE TOP HAT WITH BRIGHT RED RIBBON BAND ===
  const hatPivot = new THREE.Group();
  hatPivot.position.set(-0.065, 1.215, -0.045);
  hatPivot.rotation.set(-0.24, 0, 0.26); // Playfully tilted on upper-back/side of pointed egg crown
  rig.torso.add(hatPivot);
  rig.hatPivot = hatPivot;

  // Curved navy top hat brim + subtle lip
  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.385, 0.405, 0.036, 20), topHatNavyMat);
  hatBrim.castShadow = true;
  hatPivot.add(hatBrim);

  const hatBrimRim = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.02, 8, 22), topHatNavyMat);
  hatBrimRim.rotation.x = Math.PI / 2;
  hatBrimRim.position.y = 0.01;
  hatPivot.add(hatBrimRim);

  // Classic slightly flared top hat crown
  const hatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.222, 0.44, 18), topHatNavyMat);
  hatCrown.position.y = 0.23;
  hatCrown.castShadow = true;
  hatPivot.add(hatCrown);

  // Bright red ribbon band wrapped snugly around hat crown base + metallic gold buckle clasp
  const hatRibbon = new THREE.Mesh(new THREE.CylinderGeometry(0.246, 0.232, 0.105, 18), ribbonRedMat);
  hatRibbon.position.y = 0.075;
  hatPivot.add(hatRibbon);

  const hatBuckleMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.22,
    metalness: 0.86,
    envMapIntensity: 1.3,
  });
  const hatClasp = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.078, 0.026), hatBuckleMat);
  hatClasp.position.set(0, 0.075, 0.242);
  hatPivot.add(hatClasp);

  // === 4. WIDE CRISP WHITE FOLDED COLLAR, CHUNKY 3D YELLOW BOW TIE, 2 GREEN BUTTONS & VEST HEM ===
  const collarPos = evalAndaEgg(0.42); // Right on the egg-to-red-vest seam!

  // Flaring crisp white collar ring wrapping around midsection
  const collarRing = new THREE.Mesh(
    new THREE.TorusGeometry(collarPos.r + 0.012, 0.052, 10, 26),
    whiteCollarMat,
  );
  collarRing.rotation.x = Math.PI / 2;
  collarRing.position.y = collarPos.y + 0.01;
  collarRing.scale.set(1.02, 1.02, 0.72);
  collarRing.castShadow = true;
  rig.torso.add(collarRing);

  // Wide, crisp front folded shirt collar wings flaring left & right under the chin!
  const collarWingGeo = new THREE.BoxGeometry(0.24, 0.145, 0.045);
  [-1, 1].forEach((side) => {
    const wing = new THREE.Mesh(collarWingGeo, whiteCollarMat);
    wing.position.set(side * 0.165, collarPos.y - 0.015, collarPos.r + 0.015);
    wing.rotation.y = side * 0.34;
    wing.rotation.z = -side * 0.36;
    wing.rotation.x = 0.22;
    wing.castShadow = true;
    rig.torso.add(wing);
  });

  // Chunky 3D Bright Yellow Bow Tie (#FFD426) centered right under the folded white collar!
  const bowTieGroup = new THREE.Group();
  bowTieGroup.position.set(0, collarPos.y - 0.032, collarPos.r + 0.055);
  rig.torso.add(bowTieGroup);

  const bowWingGeo = new THREE.ConeGeometry(0.11, 0.18, 4);
  [-1, 1].forEach((side) => {
    const wing = new THREE.Mesh(bowWingGeo, bowTieYellowMat);
    wing.position.set(side * 0.1, 0, 0);
    wing.rotation.z = side * (Math.PI / 2);
    wing.rotation.y = side * 0.15;
    wing.scale.set(1.0, 1.0, 0.48);
    wing.castShadow = true;
    bowTieGroup.add(wing);
  });

  const bowKnot = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.095, 0.072), bowTieYellowMat);
  bowKnot.castShadow = true;
  bowTieGroup.add(bowKnot);

  // Two Small Glossy Green Buttons vertically down the front of the red vest underneath the bow tie!
  const buttonGeo = new THREE.CylinderGeometry(0.044, 0.044, 0.026, 12);
  [0.33, 0.24].forEach((bt) => {
    const bp = evalAndaEgg(bt);
    const btn = new THREE.Mesh(buttonGeo, greenButtonMat);
    btn.position.set(0, bp.y, bp.r + 0.01);
    btn.rotation.x = Math.PI / 2 + (0.42 - bt) * 1.45;
    rig.torso.add(btn);
  });

  // Subtle raised 3D dark-blue suspender clips flanking the buttons so suspenders catch 3D side light
  const goldClipMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.25,
    metalness: 0.78,
  });
  const clipPos = evalAndaEgg(0.35);
  [-1, 1].forEach((side) => {
    const angle = side * 0.52;
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.042, 0.03), goldClipMat);
    clip.position.set(
      Math.sin(angle) * (clipPos.r + 0.012),
      clipPos.y,
      Math.cos(angle) * (clipPos.r + 0.012),
    );
    clip.rotation.y = angle;
    rig.torso.add(clip);
  });

  // Crisp red vest lower hem cuff hugging bottom of egg above navy legs
  const hemPos = evalAndaEgg(0.14);
  const vestHem = new THREE.Mesh(
    new THREE.TorusGeometry(hemPos.r + 0.01, 0.036, 8, 22),
    redVestMat,
  );
  vestHem.rotation.x = Math.PI / 2;
  vestHem.position.y = hemPos.y;
  rig.torso.add(vestHem);

  // === 5. SKINNY STRIPED ARMS WITH RED CUFFS + NAVY LEGS WITH CHUNKY TEAL BOOTS ===
  addAndaLimbs(
    rig,
    stripeSleeveMat,
    redVestMat,
    peachNoseMat,
    navySuspenderMat,
    tealBootMat,
    whiteCollarMat,
    redVestMat,
  );
}

function createMausiSareeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  // Rich matte teal / turquoise-blue saree base (#1F8E91)
  ctx.fillStyle = '#1F8E91';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle woven cotton-silk matte cloth micro-texture
  ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
  for (let y = 0; y < 512; y += 6) {
    ctx.fillRect(0, y, 512, 2);
  }

  // Crisp dark-teal draped vertical & slightly sweeping fold/pleat shadow lines
  for (let i = 0; i < 16; i++) {
    const x = i * 32 + 8;
    const pleatGrad = ctx.createLinearGradient(x - 8, 0, x + 12, 0);
    pleatGrad.addColorStop(0, 'rgba(13, 74, 79, 0.0)');
    pleatGrad.addColorStop(0.35, 'rgba(11, 66, 71, 0.52)');
    pleatGrad.addColorStop(0.6, 'rgba(46, 174, 178, 0.22)');
    pleatGrad.addColorStop(1, 'rgba(13, 74, 79, 0.0)');
    ctx.fillStyle = pleatGrad;
    ctx.fillRect(x - 8, 0, 20, 466);

    // Crisp hand-drawn comic fold crease line
    ctx.strokeStyle = '#115A60';
    ctx.lineWidth = i % 3 === 0 ? 4.2 : 2.6;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.quadraticCurveTo(x + (i % 2 === 0 ? 5 : -4), 240, x + 2, 468);
    ctx.stroke();
  }

  // Subtle diagonal cross-drape accent folds across mid-waist
  ctx.strokeStyle = 'rgba(14, 78, 84, 0.42)';
  ctx.lineWidth = 3.2;
  for (let k = 0; k < 5; k++) {
    const yStart = 42 + k * 28;
    ctx.beginPath();
    ctx.moveTo(0, yStart);
    ctx.quadraticCurveTo(256, yStart + 36, 512, yStart + 12);
    ctx.stroke();
  }

  // Tasteful deep-teal woven lower border band with fine subtle geometric stripe
  ctx.fillStyle = '#11585E';
  ctx.fillRect(0, 464, 512, 48);
  ctx.fillStyle = '#19757A';
  ctx.fillRect(0, 474, 512, 6);
  ctx.fillStyle = '#D4AF37';
  ctx.fillRect(0, 464, 512, 4);
  ctx.fillRect(0, 498, 512, 4);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function buildLaddooMausi(rig: FighterRig): void {
  // Heavyweight grounded proportions: noticeably wider & sturdier than the other 4 fighters
  rig.pelvis.position.set(0, 0.88, 0);
  rig.torso.position.set(0, 0.1, 0);
  rig.head.position.set(0, 0.82, 0.02);
  rig.leftShoulder.position.set(-0.56, 0.65, 0);
  rig.rightShoulder.position.set(0.56, 0.65, 0);
  rig.leftElbow.position.set(0, -0.32, 0);
  rig.rightElbow.position.set(0, -0.32, 0);
  rig.leftHip.position.set(-0.23, -0.02, 0);
  rig.rightHip.position.set(0.23, -0.02, 0);
  rig.leftKnee.position.set(0, -0.4, 0);
  rig.rightKnee.position.set(0, -0.4, 0);
  rig.contactShadow.scale.set(1.24, 1.24, 1);

  // Calibrated matte PBR materials (zero specular washout under bright stage spotlights)
  const sareeTex = createMausiSareeTexture();
  const sareeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: sareeTex,
    roughness: 0.88,
    metalness: 0,
    envMapIntensity: 0.16,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(sareeMat);

  const sareeSolidMat = makeMat(0x1f8e91, 0.88, 0, rig.flashMaterials);
  sareeSolidMat.envMapIntensity = 0.16;
  const sareeDeepMat = makeMat(0x125e64, 0.9, 0, rig.flashMaterials);
  sareeDeepMat.envMapIntensity = 0.14;

  const blouseWeaveTex = createFabricWeaveTexture('#1E5E3A', 'rgba(10,40,24,0.18)', 'rgba(134,239,172,0.06)', 3);
  const blouseMat = makeMat(0xffffff, 0.86, 0, rig.flashMaterials);
  blouseMat.map = blouseWeaveTex;
  blouseMat.envMapIntensity = 0.18;

  const skinMat = makeMat(0xdfb48e, 0.62, 0, rig.flashMaterials);
  skinMat.envMapIntensity = 0.22;

  const hairMat = makeMat(0x3a1412, 0.66, 0.04);
  hairMat.envMapIntensity = 0.24;
  const hairBandMat = makeMat(0x210a09, 0.78, 0.02);

  // True metallic gold jewelry (#F0C420, metalness 0.86, roughness 0.22)
  const goldMat = makeMat(0xf0c420, 0.22, 0.86, rig.flashMaterials);
  goldMat.envMapIntensity = 1.35;

  const chappalMat = makeMat(0x4a2c1a, 0.78, 0.04, rig.flashMaterials);
  const chappalStrapMat = makeMat(0x361e10, 0.72, 0.05);

  const belanWoodMat = makeMat(0xc68b49, 0.56, 0.04);
  const belanHandleMat = makeMat(0x9b642c, 0.5, 0.05);

  // --- 1. PLUMP HEAVYWEIGHT DRAPED SAREE LOWER SKIRT (rig.pelvis) ---
  // Smooth Lathe profile: ankle hem at y = -0.74 (world y = 0.14 so chappals peek beneath),
  // curving generously outward over sturdy hips (r = 0.56) into plump waist!
  const skirtPoints: THREE.Vector2[] = [
    new THREE.Vector2(0.49, -0.74),
    new THREE.Vector2(0.515, -0.58),
    new THREE.Vector2(0.545, -0.34),
    new THREE.Vector2(0.56, -0.08),
    new THREE.Vector2(0.535, 0.11),
    new THREE.Vector2(0.495, 0.2),
  ];
  const skirtGeo = new THREE.LatheGeometry(skirtPoints, 22);
  const skirtMesh = new THREE.Mesh(skirtGeo, sareeMat);
  skirtMesh.scale.set(1.06, 1.0, 0.96);
  skirtMesh.castShadow = true;
  skirtMesh.receiveShadow = true;
  rig.pelvis.add(skirtMesh);

  // Subtle sculpted front vertical saree pleats for tactile 3D silhouette depth
  [-0.085, 0, 0.085].forEach((px, idx) => {
    const pleat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.058, 0.86, 8),
      idx === 1 ? sareeSolidMat : sareeDeepMat,
    );
    pleat.position.set(px, -0.28, 0.495 - Math.abs(px) * 0.25);
    pleat.scale.set(0.85, 1.0, 0.42);
    pleat.castShadow = true;
    rig.pelvis.add(pleat);
  });

  // Soft draped waist-tuck wrap band where saree meets torso
  const waistFold = new THREE.Mesh(
    new THREE.TorusGeometry(0.515, 0.068, 8, 22),
    sareeSolidMat,
  );
  waistFold.rotation.x = Math.PI / 2;
  waistFold.position.y = 0.14;
  waistFold.scale.set(1.05, 0.95, 1.0);
  rig.pelvis.add(waistFold);

  // --- 2. PLUMP HEAVYWEIGHT TORSO + DARK FOREST-GREEN BLOUSE + DIAGONAL TEAL PALLU ---
  // Plump lower torso & belly wrapped in teal saree (#1F8E91)
  const lowerTorsoPoints: THREE.Vector2[] = [
    new THREE.Vector2(0.51, -0.02),
    new THREE.Vector2(0.535, 0.14),
    new THREE.Vector2(0.525, 0.3),
    new THREE.Vector2(0.49, 0.43),
  ];
  const lowerTorso = new THREE.Mesh(new THREE.LatheGeometry(lowerTorsoPoints, 20), sareeMat);
  lowerTorso.scale.set(1.06, 1.0, 0.96);
  lowerTorso.castShadow = true;
  rig.torso.add(lowerTorso);

  // Fitted Dark Forest-Green Blouse (#1E5E3A) across upper chest, broad shoulders & upper back
  const blousePoints: THREE.Vector2[] = [
    new THREE.Vector2(0.495, 0.34),
    new THREE.Vector2(0.515, 0.48),
    new THREE.Vector2(0.485, 0.63),
    new THREE.Vector2(0.39, 0.74),
    new THREE.Vector2(0.24, 0.77),
  ];
  const blouseMesh = new THREE.Mesh(new THREE.LatheGeometry(blousePoints, 20), blouseMat);
  blouseMesh.scale.set(1.06, 1.0, 0.94);
  blouseMesh.castShadow = true;
  rig.torso.add(blouseMesh);

  // Broad rounded blouse shoulder caps connecting seamlessly to half-sleeves
  [-1, 1].forEach((side) => {
    const shCap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), blouseMat);
    shCap.position.set(side * 0.48, 0.64, 0);
    shCap.scale.set(1.12, 0.95, 0.95);
    shCap.castShadow = true;
    rig.torso.add(shCap);
  });

  // Warm wheatish-tan upper neckline/decolletage inset + sturdy neck
  const necklineSkin = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 12), skinMat);
  necklineSkin.position.set(0, 0.69, 0.14);
  necklineSkin.scale.set(1.08, 0.74, 0.92);
  rig.torso.add(necklineSkin);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.21, 0.22, 14), skinMat);
  neck.position.set(0, 0.78, 0.02);
  rig.torso.add(neck);

  // Sculpted Diagonal Teal Saree Pallu draped snugly from right hip across chest over LEFT shoulder (-X) and down back
  const mausiPalluGroup = new THREE.Group();
  rig.torso.add(mausiPalluGroup);
  rig.mausiPalluGroup = mausiPalluGroup;

  const palluCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.41, 0.05, 0.34),
    new THREE.Vector3(0.14, 0.25, 0.48),
    new THREE.Vector3(-0.18, 0.5, 0.45),
    new THREE.Vector3(-0.36, 0.72, 0.15),
    new THREE.Vector3(-0.37, 0.7, -0.19),
    new THREE.Vector3(-0.33, 0.33, -0.47),
    new THREE.Vector3(-0.27, -0.08, -0.47),
  ]);
  const palluMain = new THREE.Mesh(new THREE.TubeGeometry(palluCurve, 26, 0.095, 10, false), sareeMat);
  palluMain.scale.set(1.12, 1.0, 0.94);
  palluMain.castShadow = true;
  mausiPalluGroup.add(palluMain);

  // Second adjacent folded pleat band for a wider, flatter cloth-drape feel (not a round tube)
  const palluFold2Curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.35, 0.11, 0.41),
    new THREE.Vector3(0.08, 0.32, 0.515),
    new THREE.Vector3(-0.12, 0.56, 0.46),
    new THREE.Vector3(-0.28, 0.73, 0.16),
    new THREE.Vector3(-0.29, 0.71, -0.18),
    new THREE.Vector3(-0.25, 0.34, -0.48),
  ]);
  const palluFold2 = new THREE.Mesh(
    new THREE.TubeGeometry(palluFold2Curve, 24, 0.062, 8, false),
    sareeSolidMat,
  );
  palluFold2.scale.set(1.06, 1.0, 0.94);
  mausiPalluGroup.add(palluFold2);

  // Crisp metallic gold zari pallu border trim running parallel along the draped edge
  const palluEdge = new THREE.Mesh(
    new THREE.TubeGeometry(palluFold2Curve, 22, 0.022, 7, false),
    goldMat,
  );
  palluEdge.position.set(0.032, 0.02, 0.034);
  mausiPalluGroup.add(palluEdge);

  // --- 3. SIGNATURE THICK V-SHAPED METALLIC GOLD NECKLACE (#F0C420) ---
  const necklaceCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.19, 0.78, -0.12),
    new THREE.Vector3(-0.24, 0.76, 0.15),
    new THREE.Vector3(-0.16, 0.68, 0.4),
    new THREE.Vector3(0, 0.53, 0.535),
    new THREE.Vector3(0.16, 0.68, 0.4),
    new THREE.Vector3(0.24, 0.76, 0.15),
    new THREE.Vector3(0.19, 0.78, -0.12),
  ]);
  const necklaceMesh = new THREE.Mesh(
    new THREE.TubeGeometry(necklaceCurve, 28, 0.044, 10, false),
    goldMat,
  );
  necklaceMesh.castShadow = true;
  rig.torso.add(necklaceMesh);

  // Ornate central gold V-pendant drop & flanking beads
  const pendant = new THREE.Mesh(new THREE.OctahedronGeometry(0.078, 1), goldMat);
  pendant.position.set(0, 0.475, 0.55);
  pendant.scale.set(0.88, 1.24, 0.55);
  rig.torso.add(pendant);

  [-0.09, 0.09].forEach((bx) => {
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), goldMat);
    bead.position.set(bx, 0.59, 0.485);
    rig.torso.add(bead);
  });

  // --- 4. ROUND CHUBBY HEAD, CENTER-PARTED DARK REDDISH-BROWN HAIR, BACK BUN & GOLD EARRINGS ---
  const headMesh = createHeadMesh(rig.face.texture, 0.385);
  const headMat = headMesh.material as THREE.MeshStandardMaterial;
  headMat.roughness = 0.62;
  headMat.metalness = 0;
  headMat.envMapIntensity = 0.22;
  rig.flashMaterials.push(headMat);
  headMesh.position.set(0, 0.22, 0);
  headMesh.scale.set(1.07, 0.97, 1.03);
  rig.head.add(headMesh);

  // Cute round sculpted nose bump for crisp 2.5D side-profile silhouette
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), skinMat);
  nose.position.set(0, 0.195, 0.39);
  nose.scale.set(1.05, 0.92, 0.95);
  rig.head.add(nose);

  // Sculpted ears + shiny small round metallic gold earrings (#F0C420)
  [-1, 1].forEach((side) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.072, 10, 8), skinMat);
    ear.position.set(side * 0.4, 0.2, 0.01);
    ear.scale.set(0.62, 1.12, 0.86);
    rig.head.add(ear);

    const earring = new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 10), goldMat);
    earring.position.set(side * 0.418, 0.125, 0.035);
    rig.head.add(earring);

    const earringStud = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), goldMat);
    earringStud.position.set(side * 0.412, 0.175, 0.042);
    rig.head.add(earringStud);
  });

  // Dark reddish-brown hair (#3A1412): back crown cap tilted slightly back so forehead + red bindi stay wide open
  const hairBackCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.405, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hairMat,
  );
  hairBackCap.position.set(0, 0.25, -0.045);
  hairBackCap.rotation.x = -0.38;
  hairBackCap.scale.set(1.06, 0.98, 1.04);
  hairBackCap.castShadow = true;
  rig.head.add(hairBackCap);

  // Center-parted front hair waves sweeping smoothly around both temples (lifted cleanly above red bindi!)
  [-1, 1].forEach((side) => {
    const hairWave = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 12), hairMat);
    hairWave.position.set(side * 0.23, 0.46, 0.085);
    hairWave.scale.set(1.06, 0.68, 1.12);
    hairWave.rotation.z = -side * 0.46;
    hairWave.rotation.y = side * 0.22;
    hairWave.castShadow = true;
    rig.head.add(hairWave);

    // Side temple sweep tucking cleanly behind each ear
    const sideLock = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.2, 6, 10), hairMat);
    sideLock.position.set(side * 0.36, 0.27, -0.025);
    sideLock.rotation.z = side * 0.22;
    sideLock.rotation.x = -0.18;
    rig.head.add(sideLock);
  });

  // Neat round hair bun (juda) perched proudly at the upper-back of the head (clear in both side & 3/4 view!)
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.225, 16, 14), hairMat);
  bun.position.set(0, 0.34, -0.425);
  bun.scale.set(1.05, 0.96, 0.9);
  bun.castShadow = true;
  rig.head.add(bun);

  const hairBand = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.028, 8, 16), hairBandMat);
  hairBand.position.set(0, 0.34, -0.335);
  rig.head.add(hairBand);

  // Crisp ivory jasmine gajra accent tucked neatly around her hair bun
  const gajraMat = makeMat(0xfef9ec, 0.72, 0);
  const gajraBeadGeo = new THREE.SphereGeometry(0.034, 7, 7);
  for (let gi = 0; gi < 8; gi++) {
    const ga = (gi / 8) * Math.PI * 2;
    const bead = new THREE.Mesh(gajraBeadGeo, gajraMat);
    bead.position.set(
      Math.cos(ga) * 0.175,
      0.34 + Math.sin(ga) * 0.165,
      -0.345,
    );
    rig.head.add(bead);
  }

  // --- 5. STURDY ARMS: DARK FOREST-GREEN HALF-SLEEVES + BARE ARMS + CHUNKY GOLD KADAS ---
  const halfSleeveGeo = new THREE.CylinderGeometry(0.158, 0.142, 0.25, 14);
  const sleeveTrimGeo = new THREE.TorusGeometry(0.142, 0.018, 6, 14);
  const upperBareGeo = new THREE.CapsuleGeometry(0.122, 0.12, 6, 12);
  const forearmGeo = new THREE.CapsuleGeometry(0.115, 0.19, 6, 12);
  const handGeo = new THREE.SphereGeometry(0.135, 12, 10);
  const kadaGeo = new THREE.TorusGeometry(0.118, 0.026, 8, 16);

  [
    [rig.leftShoulder, rig.leftElbow],
    [rig.rightShoulder, rig.rightElbow],
  ].forEach(([shoulder, elbow]) => {
    // Dark forest-green half-sleeve
    const sleeve = new THREE.Mesh(halfSleeveGeo, blouseMat);
    sleeve.position.y = -0.11;
    sleeve.castShadow = true;
    shoulder.add(sleeve);

    const cuff = new THREE.Mesh(sleeveTrimGeo, blouseMat);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.23;
    shoulder.add(cuff);

    // Sturdy bare upper-elbow skin
    const upperBare = new THREE.Mesh(upperBareGeo, skinMat);
    upperBare.position.y = -0.25;
    upperBare.castShadow = true;
    shoulder.add(upperBare);

    // Sturdy bare forearm + chubby fist
    const forearm = new THREE.Mesh(forearmGeo, skinMat);
    forearm.position.y = -0.15;
    forearm.castShadow = true;
    elbow.add(forearm);

    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.y = -0.31;
    hand.scale.set(1.04, 0.96, 1.08);
    hand.castShadow = true;
    elbow.add(hand);

    // Chunky stacked metallic gold bangles (kadas) around both wrists!
    [-0.195, -0.248].forEach((by) => {
      const kada = new THREE.Mesh(kadaGeo, goldMat);
      kada.rotation.x = Math.PI / 2;
      kada.position.y = by;
      elbow.add(kada);
    });
  });

  // --- 6. GROUNDED LEGS & DARK-BROWN DESI CHAPPALS PEEKING BENEATH SAREE HEM ---
  // Knee sits at world y = 0.88 - 0.02 - 0.40 = 0.46; chappal bottom rests at local y = -0.46 -> exact floor y = 0.0!
  const thighGeo = new THREE.CapsuleGeometry(0.145, 0.22, 6, 10);
  const ankleGeo = new THREE.CapsuleGeometry(0.098, 0.18, 6, 10);
  const footGeo = new THREE.BoxGeometry(0.185, 0.088, 0.31);
  const chappalSoleGeo = new THREE.BoxGeometry(0.235, 0.048, 0.385);
  const chappalStrapGeo = new THREE.TorusGeometry(0.095, 0.022, 6, 12, Math.PI);

  [
    [rig.leftHip, rig.leftKnee],
    [rig.rightHip, rig.rightKnee],
  ].forEach(([hip, knee]) => {
    // Inner saree petticoat thigh (prevents skin gap during kicks)
    const thigh = new THREE.Mesh(thighGeo, sareeDeepMat);
    thigh.position.y = -0.2;
    hip.add(thigh);

    // Bare wheatish-tan lower ankle & foot peeking cleanly below saree hem
    const ankle = new THREE.Mesh(ankleGeo, skinMat);
    ankle.position.y = -0.26;
    ankle.castShadow = true;
    knee.add(ankle);

    const foot = new THREE.Mesh(footGeo, skinMat);
    foot.position.set(0, -0.375, 0.065);
    foot.castShadow = true;
    knee.add(foot);

    // Simple dark-brown desi chappal resting flush on y = 0
    const sole = new THREE.Mesh(chappalSoleGeo, chappalMat);
    sole.position.set(0, -0.436, 0.072);
    sole.castShadow = true;
    knee.add(sole);

    const strap = new THREE.Mesh(chappalStrapGeo, chappalStrapMat);
    strap.position.set(0, -0.365, 0.11);
    strap.rotation.x = 0.22;
    knee.add(strap);
  });

  // --- 7. CLASSIC WOODEN ROLLING PIN (BELAN, #C68B49) IN RIGHT HAND ---
  const belan = new THREE.Group();
  const belanPoints: THREE.Vector2[] = [
    new THREE.Vector2(0.002, -0.47),
    new THREE.Vector2(0.036, -0.45),
    new THREE.Vector2(0.032, -0.32),
    new THREE.Vector2(0.062, -0.28),
    new THREE.Vector2(0.072, -0.14),
    new THREE.Vector2(0.075, 0.0),
    new THREE.Vector2(0.072, 0.14),
    new THREE.Vector2(0.062, 0.28),
    new THREE.Vector2(0.032, 0.32),
    new THREE.Vector2(0.036, 0.45),
    new THREE.Vector2(0.002, 0.47),
  ];
  const barrel = new THREE.Mesh(new THREE.LatheGeometry(belanPoints, 14), belanWoodMat);
  barrel.castShadow = true;
  belan.add(barrel);

  // Darker turned wood handle sleeves on both ends for unmistakable rolling-pin readability
  [-0.385, 0.385].forEach((hy) => {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.035, 0.15, 10), belanHandleMat);
    grip.position.y = hy;
    belan.add(grip);
  });

  belan.position.set(0.02, -0.32, 0.28);
  belan.rotation.x = Math.PI * 0.48;
  rig.rightElbow.add(belan);
  rig.handProp = belan;
}

let sharedFatherCassockTex: THREE.CanvasTexture | null = null;
let sharedFatherVestTex: THREE.CanvasTexture | null = null;

function createFatherCassockTexture(): THREE.CanvasTexture {
  if (sharedFatherCassockTex) return sharedFatherCassockTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  // Clean pleated off-white clerical cotton cassock (#F0F2F5) with vertical shadow folds
  ctx.fillStyle = '#F0F2F5';
  ctx.fillRect(0, 0, 256, 256);

  // Tailored vertical pleated fabric shadow folds so the closed cassock reads with crisp 3D depth
  for (let x = 0; x < 256; x += 25.6) {
    const grad = ctx.createLinearGradient(x, 0, x + 25.6, 0);
    grad.addColorStop(0, 'rgba(78, 96, 122, 0.36)');
    grad.addColorStop(0.22, 'rgba(255, 255, 255, 0.22)');
    grad.addColorStop(0.74, 'rgba(186, 198, 214, 0.18)');
    grad.addColorStop(1, 'rgba(78, 96, 122, 0.36)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, 25.6, 256);
  }

  // Fine subtle cotton weave grain
  ctx.fillStyle = 'rgba(51, 65, 85, 0.06)';
  for (let y = 0; y < 256; y += 6) {
    ctx.fillRect(0, y, 256, 1.5);
  }

  // Crisp bottom hem seam line
  ctx.fillStyle = 'rgba(71, 85, 105, 0.45)';
  ctx.fillRect(0, 240, 256, 5);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  sharedFatherCassockTex = tex;
  return tex;
}

function createFatherNehruVestTexture(): THREE.CanvasTexture {
  if (sharedFatherVestTex) return sharedFatherVestTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  // Richer crisp powder/sky-blue matte cotton Nehru vest (#7EC4E6) that contrasts cleanly with white cassock
  ctx.fillStyle = '#7EC4E6';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle cross-woven Nehru cotton grain
  ctx.fillStyle = 'rgba(18, 64, 98, 0.14)';
  for (let x = 0; x < 256; x += 6) {
    ctx.fillRect(x, 0, 1.5, 256);
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  for (let y = 0; y < 256; y += 6) {
    ctx.fillRect(0, y, 256, 1.5);
  }

  // Clearly readable darker tailored princess-seam lines
  ctx.strokeStyle = 'rgba(15, 58, 92, 0.56)';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(64, 0);
  ctx.lineTo(64, 256);
  ctx.moveTo(192, 0);
  ctx.lineTo(192, 256);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  sharedFatherVestTex = tex;
  return tex;
}

/**
 * Builds Father Roy Dolphus (School Principal) using realistic ~7.4-head adult human proportions
 * scaled cleanly to commanding ~2.22m arena stature beside the existing roster:
 * - Natural broad adult shoulder width, sculpted oval-jawed South Asian adult male head, neat short
 *   dark-black hair with side part & temple taper (NO cartoon/chibi big-head proportions)
 * - Full-length crisp matte-white clerical cassock (roughness 0.88) with standing white clerical collar
 *   and articulated front/back/side lower pleated panels that track leg kicks cleanly
 * - Pale sky-blue sleeveless Nehru vest (roughness 0.85) with mandarin collar, button placket,
 *   and left chest pocket holding a clipped dark metallic pen
 * - Classic round silver-dial wristwatch with dark leather strap on left wrist
 * - Polished dark-black formal dress shoes (roughness 0.35) peeking beneath the cassock hem
 */
function buildFatherRoyDolphus(rig: FighterRig): void {
  // === 1. FIGHTKARO-STYLE READABLE ~1:5.5 PROPORTIONS (~1.42x HEAD SCALE FOR MOBILE CLARITY) ===
  rig.pelvis.position.set(0, 1.06, 0);
  rig.torso.position.set(0, 0.09, 0);
  rig.head.position.set(0, 0.905, 0);
  rig.head.scale.setScalar(1.42);

  const shoulderX = 0.305;
  const shoulderY = 0.61;
  rig.leftShoulder.position.set(-shoulderX, shoulderY, 0);
  rig.rightShoulder.position.set(shoulderX, shoulderY, 0);
  rig.leftElbow.position.set(0, -0.34, 0);
  rig.rightElbow.position.set(0, -0.34, 0);

  rig.leftHip.position.set(-0.135, -0.02, 0);
  rig.rightHip.position.set(0.135, -0.02, 0);
  rig.leftKnee.position.set(0, -0.49, 0);
  rig.rightKnee.position.set(0, -0.49, 0);

  // === 2. GROUNDED PBR MATERIALS (calibrated envMapIntensity so white & sky-blue never blow out) ===
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xb0754e,
    roughness: 0.62,
    metalness: 0.01,
    envMapIntensity: 0.22,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(skinMat);

  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x161418,
    roughness: 0.78,
    metalness: 0.04,
    envMapIntensity: 0.18,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(hairMat);

  const cassockTex = createFatherCassockTexture();
  const cassockMat = new THREE.MeshStandardMaterial({
    map: cassockTex,
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.01,
    envMapIntensity: 0.16,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(cassockMat);

  const cassockDoubleMat = new THREE.MeshStandardMaterial({
    map: cassockTex,
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.01,
    envMapIntensity: 0.16,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(cassockDoubleMat);

  const collarWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xf4f7fb,
    roughness: 0.84,
    metalness: 0.01,
    envMapIntensity: 0.18,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(collarWhiteMat);

  const vestTex = createFatherNehruVestTexture();
  const vestMat = new THREE.MeshStandardMaterial({
    map: vestTex,
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0.02,
    envMapIntensity: 0.18,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(vestMat);

  const vestTrimMat = new THREE.MeshStandardMaterial({
    color: 0x3b8ec0,
    roughness: 0.78,
    metalness: 0.03,
    envMapIntensity: 0.18,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(vestTrimMat);

  const buttonMat = new THREE.MeshStandardMaterial({
    color: 0x172554,
    roughness: 0.36,
    metalness: 0.2,
    envMapIntensity: 0.34,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(buttonMat);

  const trouserMat = new THREE.MeshStandardMaterial({
    color: 0x1c212b,
    roughness: 0.86,
    metalness: 0.02,
    envMapIntensity: 0.16,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(trouserMat);

  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0x121418,
    roughness: 0.35,
    metalness: 0.18,
    envMapIntensity: 0.42,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(shoeMat);

  const shoeSoleMat = makeMat(0x0c0e11, 0.75, 0.05);
  const watchSilverMat = makeMat(0xe2e8f0, 0.2, 0.88);
  const watchDialMat = makeMat(0xf8fafc, 0.28, 0.15);
  const leatherStrapMat = makeMat(0x1c1917, 0.68, 0.05);
  const penDarkMat = makeMat(0x0f172a, 0.3, 0.55);
  const penClipMat = makeMat(0xe2e8f0, 0.18, 0.92);

  // === 3. REAL 3D GLB HEAD (/models/father_head.glb) WITH HEMISPHERE FALLBACK ===
  void hairMat;
  const fallbackHeadGroup = buildPhotoHemisphereHead(rig, 'father', skinMat);
  attachFatherGlbHead(
    rig.head,
    fallbackHeadGroup,
    rig.flashMaterials,
    () => rig.isDisposed,
  );

  // === 4. NECK, WHITE CLERICAL COLLAR, CASSOCK CHEST & PALE SKY-BLUE NEHRU VEST ===
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.074, 0.15, 14), skinMat);
  neck.position.set(0, 0.71, 0);
  rig.torso.add(neck);

  // Crisp standing matte-white clerical collar encircling neck
  const whiteCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.084, 0.092, 0.094, 18),
    collarWhiteMat,
  );
  whiteCollar.position.set(0, 0.676, 0.002);
  rig.torso.add(whiteCollar);

  // Inner white cassock upper torso base
  const innerChest = new THREE.Mesh(
    new THREE.CylinderGeometry(0.214, 0.182, 0.59, 18),
    cassockMat,
  );
  innerChest.scale.set(1.16, 1, 0.76);
  innerChest.position.set(0, 0.34, 0);
  innerChest.castShadow = true;
  rig.torso.add(innerChest);

  // Fitted Richer Sky-Blue (#7EC4E6) Sleeveless Nehru Vest / Bandhgala Jacket worn over the cassock
  const vestTorso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.23, 0.214, 0.63, 20),
    vestMat,
  );
  vestTorso.scale.set(1.18, 1, 0.8);
  vestTorso.position.set(0, 0.335, 0.003);
  vestTorso.castShadow = true;
  rig.torso.add(vestTorso);
  attachSubtleOutline(rig.torso, vestTorso, 1.03);

  // Structured sleeveless shoulder yoke panels so white cassock sleeves emerge cleanly
  [-1, 1].forEach((side) => {
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.126, 0.074, 0.265), vestMat);
    yoke.position.set(side * 0.205, 0.614, 0.002);
    yoke.rotation.z = -side * 0.12;
    rig.torso.add(yoke);
  });

  // Standing sky-blue mandarin collar slightly lower than the crisp white clerical collar peeking above
  const vestCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.102, 0.116, 0.074, 18, 1, true, 0.32, Math.PI * 1.82),
    vestTrimMat,
  );
  vestCollar.rotation.y = Math.PI * 0.91;
  vestCollar.position.set(0, 0.648, 0.003);
  rig.torso.add(vestCollar);

  // Crisp darker-blue front button placket & 5 visible dark-navy buttons down the Nehru vest
  const placket = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.59, 0.022), vestTrimMat);
  placket.position.set(0, 0.33, 0.178);
  rig.torso.add(placket);

  for (let b = 0; b < 5; b++) {
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.0155, 0.0155, 0.014, 10), buttonMat);
    btn.rotation.x = Math.PI / 2;
    btn.position.set(0, 0.545 - b * 0.108, 0.193);
    rig.torso.add(btn);
  }

  // Left chest welt pocket (character left = -X) + crisp dark pen clipped inside!
  const chestPocket = new THREE.Mesh(new THREE.BoxGeometry(0.096, 0.084, 0.02), vestTrimMat);
  chestPocket.position.set(-0.116, 0.47, 0.173);
  const pocketWelt = new THREE.Mesh(new THREE.BoxGeometry(0.104, 0.018, 0.026), buttonMat);
  pocketWelt.position.set(-0.116, 0.512, 0.179);
  rig.torso.add(chestPocket, pocketWelt);

  // Clipped dark metallic pen peeking clearly above left chest pocket
  const penBody = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.0095, 0.125, 8), penDarkMat);
  penBody.position.set(-0.096, 0.538, 0.186);
  penBody.rotation.z = -0.09;
  const penClip = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.064, 0.011), penClipMat);
  penClip.position.set(-0.094, 0.544, 0.198);
  penClip.rotation.z = -0.09;
  const penCapTip = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), penClipMat);
  penCapTip.position.set(-0.101, 0.598, 0.186);
  rig.torso.add(penBody, penClip, penCapTip);

  // Lower Nehru vest hem extending cleanly over waist/upper hips with sky-blue trim edge
  const vestSkirt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.214, 0.236, 0.24, 20),
    vestMat,
  );
  vestSkirt.scale.set(1.18, 1, 0.8);
  vestSkirt.position.set(0, -0.032, 0.003);
  vestSkirt.castShadow = true;
  rig.torso.add(vestSkirt);
  attachSubtleOutline(rig.torso, vestSkirt, 1.03);

  const vestHemBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.237, 0.239, 0.028, 20),
    vestTrimMat,
  );
  vestHemBand.scale.set(1.18, 1, 0.8);
  vestHemBand.position.set(0, -0.145, 0.003);
  rig.torso.add(vestHemBand);

  // Subtle lower side pocket welts on the Nehru vest
  [-1, 1].forEach((side) => {
    const lowWelt = new THREE.Mesh(new THREE.BoxGeometry(0.096, 0.018, 0.02), vestTrimMat);
    lowWelt.position.set(side * 0.128, 0.088, 0.174);
    rig.torso.add(lowWelt);
  });

  // === 5. FULL-LENGTH WHITE CASSOCK SLEEVES, NATURAL HANDS & LEFT WRISTWATCH ===
  const upperSleeveGeo = new THREE.CapsuleGeometry(0.075, 0.23, 8, 12);
  const lowerSleeveGeo = new THREE.CapsuleGeometry(0.062, 0.21, 8, 12);
  const cuffGeo = new THREE.CylinderGeometry(0.063, 0.058, 0.056, 12);
  const palmGeo = new THREE.BoxGeometry(0.074, 0.094, 0.048);

  const armSpecs: Array<{ shoulder: THREE.Group; elbow: THREE.Group; isLeft: boolean }> = [
    { shoulder: rig.leftShoulder, elbow: rig.leftElbow, isLeft: true },
    { shoulder: rig.rightShoulder, elbow: rig.rightElbow, isLeft: false },
  ];

  for (const { shoulder, elbow, isLeft } of armSpecs) {
    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.079, 12, 10), cassockMat);
    shoulderCap.castShadow = true;
    shoulder.add(shoulderCap);

    const upper = new THREE.Mesh(upperSleeveGeo, cassockMat);
    upper.position.y = -0.17;
    upper.castShadow = true;
    shoulder.add(upper);

    const lower = new THREE.Mesh(lowerSleeveGeo, cassockMat);
    lower.position.y = -0.15;
    lower.castShadow = true;
    elbow.add(lower);

    const cuff = new THREE.Mesh(cuffGeo, collarWhiteMat);
    cuff.position.y = -0.27;
    elbow.add(cuff);

    // Classic round silver-dial wristwatch with dark leather strap on LEFT wrist
    if (isLeft) {
      const watchGroup = new THREE.Group();
      const strap = new THREE.Mesh(
        new THREE.TorusGeometry(0.048, 0.012, 8, 16),
        leatherStrapMat,
      );
      strap.rotation.x = Math.PI / 2;
      const bezel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.028, 0.014, 14),
        watchSilverMat,
      );
      bezel.rotation.z = Math.PI / 2;
      bezel.position.set(-0.048, 0, 0.007);
      const dial = new THREE.Mesh(
        new THREE.CylinderGeometry(0.021, 0.021, 0.016, 14),
        watchDialMat,
      );
      dial.rotation.z = Math.PI / 2;
      dial.position.set(-0.049, 0, 0.007);
      watchGroup.add(strap, bezel, dial);
      watchGroup.position.set(0, -0.305, 0);
      elbow.add(watchGroup);
    }

    // Natural sculpted adult male hand (warm medium-brown skin)
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.042, 0.048, 10), skinMat);
    wrist.position.y = -0.312;
    elbow.add(wrist);

    const palm = new THREE.Mesh(palmGeo, skinMat);
    palm.position.set(0, -0.372, 0.008);
    palm.castShadow = true;
    elbow.add(palm);

    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.038, 4, 8), skinMat);
    thumb.position.set(isLeft ? 0.038 : -0.038, -0.366, 0.026);
    thumb.rotation.z = isLeft ? -0.45 : 0.45;
    elbow.add(thumb);
  }

  // === 6. REALISTIC LEGS (DRAPED IN CASSOCK CLOTH) + POLISHED BLACK FORMAL DRESS SHOES ===
  const thighGeo = new THREE.CapsuleGeometry(0.072, 0.33, 8, 12);
  const shinGeo = new THREE.CapsuleGeometry(0.058, 0.31, 8, 12);
  const ankleSockGeo = new THREE.CylinderGeometry(0.052, 0.05, 0.1, 10);

  [
    [rig.leftHip, rig.leftKnee],
    [rig.rightHip, rig.rightKnee],
  ].forEach(([hip, knee]) => {
    const thigh = new THREE.Mesh(thighGeo, cassockMat);
    thigh.position.y = -0.245;
    thigh.castShadow = true;
    hip.add(thigh);

    const shin = new THREE.Mesh(shinGeo, cassockMat);
    shin.position.y = -0.22;
    shin.castShadow = true;
    knee.add(shin);

    const ankleSock = new THREE.Mesh(ankleSockGeo, trouserMat);
    ankleSock.position.y = -0.455;
    knee.add(ankleSock);

    // Polished dark-black formal Oxford dress shoe (roughness 0.35) peeking beneath cassock hem
    const shoeGroup = new THREE.Group();
    const shoeHeel = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.092, 0.175), shoeMat);
    shoeHeel.position.set(0, 0.058, -0.022);
    shoeHeel.castShadow = true;
    const shoeVamp = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.135, 6, 10), shoeMat);
    shoeVamp.rotation.x = Math.PI / 2;
    shoeVamp.scale.set(1.04, 1, 0.72);
    shoeVamp.position.set(0, 0.048, 0.104);
    shoeVamp.castShadow = true;
    const shoeSole = new THREE.Mesh(new THREE.BoxGeometry(0.132, 0.024, 0.335), shoeSoleMat);
    shoeSole.position.set(0, 0.012, 0.06);
    shoeGroup.add(shoeHeel, shoeVamp, shoeSole);
    shoeGroup.position.set(0, -0.555, 0);
    knee.add(shoeGroup);
  });

  // === 7. CLEAN CLOSED PLEATED OFF-WHITE CASSOCK (#F0F2F5) WITH SUBTLE KICK ARTICULATION ===
  const waistBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.224, 0.252, 0.15, 24),
    cassockMat,
  );
  waistBand.scale.set(1.18, 1, 0.92);
  waistBand.position.set(0, -0.02, 0);
  rig.pelvis.add(waistBand);

  // Continuous closed 360-degree pleated conical cassock skirt (zero awkward split-cloak gap or dark leg clipping!)
  const closedCassockSkirt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.236, 0.312, 0.87, 28, 1, true),
    cassockDoubleMat,
  );
  closedCassockSkirt.scale.set(1.18, 1, 0.96);
  closedCassockSkirt.position.set(0, -0.455, 0);
  closedCassockSkirt.castShadow = true;
  rig.pelvis.add(closedCassockSkirt);
  attachSubtleOutline(rig.pelvis, closedCassockSkirt, 1.028);

  // Subtle sculpted lower-hem trim ring so the bottom hem reads cleanly above black dress shoes
  const hemRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.312, 0.011, 8, 28),
    cassockMat,
  );
  hemRing.rotation.x = Math.PI / 2;
  hemRing.scale.set(1.18, 0.96, 1);
  hemRing.position.set(0, -0.89, 0);
  rig.pelvis.add(hemRing);

  // Articulated lower pleated overlap panels moving smoothly with kicks/levitation without breaking closed silhouette
  const panelHeight = 0.86;

  const frontLeft = new THREE.Group();
  frontLeft.position.set(-0.075, -0.03, 0.175);
  const frontLeftMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.23, panelHeight, 12, 1, true, -0.55, 1.05),
    cassockDoubleMat,
  );
  frontLeftMesh.position.set(0, -panelHeight * 0.5, -0.09);
  frontLeft.add(frontLeftMesh);
  rig.pelvis.add(frontLeft);

  const frontRight = new THREE.Group();
  frontRight.position.set(0.075, -0.03, 0.175);
  const frontRightMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.23, panelHeight, 12, 1, true, -0.5, 1.05),
    cassockDoubleMat,
  );
  frontRightMesh.position.set(0, -panelHeight * 0.5, -0.09);
  frontRight.add(frontRightMesh);
  rig.pelvis.add(frontRight);

  const back = new THREE.Group();
  back.position.set(0, -0.03, -0.175);
  const backMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.28, panelHeight, 14, 1, true, Math.PI - 0.65, 1.3),
    cassockDoubleMat,
  );
  backMesh.position.set(0, -panelHeight * 0.5, 0.1);
  back.add(backMesh);
  rig.pelvis.add(back);

  const leftSide = new THREE.Group();
  leftSide.position.set(-0.22, -0.03, 0);
  const rightSide = new THREE.Group();
  rightSide.position.set(0.22, -0.03, 0);
  rig.pelvis.add(leftSide, rightSide);

  rig.cassockPanels = {
    frontLeft,
    frontRight,
    back,
    leftSide,
    rightSide,
  };
}

/**
 * Builds Principal Man — 8th playable character — as a high-quality 3D caricature parody:
 * - Expressive 1.45x caricature head with /textures/faces/principal_man.png front-projected photo shell,
 *   3D ears, visible gray-dappled temples, sculpted eyelids, playful animated dark eyebrows, and confident smirk
 * - Closed pleated off-white cassock (#F0F2F5) with subtle vertical shadow folds & articulated kick panels
 * - Vibrant powder-blue sleeveless Nehru vest (#7EC4E6) with dark-blue stitching/buttons & chest-pocket pen
 * - Left silver-dial wristwatch & polished black formal dress shoes
 */
function buildPrincipalMan(rig: FighterRig): void {
  rig.pelvis.position.set(0, 1.06, 0);
  rig.torso.position.set(0, 0.09, 0);
  rig.head.position.set(0, 0.905, 0);
  rig.head.scale.setScalar(1.45);

  const shoulderX = 0.305;
  const shoulderY = 0.61;
  rig.leftShoulder.position.set(-shoulderX, shoulderY, 0);
  rig.rightShoulder.position.set(shoulderX, shoulderY, 0);
  rig.leftElbow.position.set(0, -0.34, 0);
  rig.rightElbow.position.set(0, -0.34, 0);

  rig.leftHip.position.set(-0.135, -0.02, 0);
  rig.rightHip.position.set(0.135, -0.02, 0);
  rig.leftKnee.position.set(0, -0.49, 0);
  rig.rightKnee.position.set(0, -0.49, 0);

  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xb57853,
    roughness: 0.6,
    metalness: 0.01,
    envMapIntensity: 0.22,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(skinMat);

  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x161418,
    roughness: 0.76,
    metalness: 0.05,
    envMapIntensity: 0.2,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(hairMat);

  const grayTempleMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.68,
    metalness: 0.08,
    envMapIntensity: 0.25,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(grayTempleMat);

  const browMat = new THREE.MeshStandardMaterial({
    color: 0x141111,
    roughness: 0.68,
    metalness: 0.04,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(browMat);

  const eyelidMat = new THREE.MeshStandardMaterial({
    color: 0x9c6240,
    roughness: 0.58,
    metalness: 0.02,
    envMapIntensity: 0.2,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(eyelidMat);

  const cassockTex = createFatherCassockTexture();
  const cassockMat = new THREE.MeshStandardMaterial({
    map: cassockTex,
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.01,
    envMapIntensity: 0.16,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(cassockMat);

  const cassockDoubleMat = new THREE.MeshStandardMaterial({
    map: cassockTex,
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.01,
    envMapIntensity: 0.16,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(cassockDoubleMat);

  const collarWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xf4f7fb,
    roughness: 0.84,
    metalness: 0.01,
    envMapIntensity: 0.18,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(collarWhiteMat);

  const vestTex = createFatherNehruVestTexture();
  const vestMat = new THREE.MeshStandardMaterial({
    map: vestTex,
    color: 0xd0ecfc,
    roughness: 0.82,
    metalness: 0.02,
    envMapIntensity: 0.16,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(vestMat);

  const vestTrimMat = new THREE.MeshStandardMaterial({
    color: 0x2a7ab0,
    roughness: 0.76,
    metalness: 0.03,
    envMapIntensity: 0.18,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(vestTrimMat);

  const buttonMat = new THREE.MeshStandardMaterial({
    color: 0x172554,
    roughness: 0.34,
    metalness: 0.22,
    envMapIntensity: 0.35,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(buttonMat);

  const trouserMat = new THREE.MeshStandardMaterial({
    color: 0x1c212b,
    roughness: 0.86,
    metalness: 0.02,
    envMapIntensity: 0.16,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(trouserMat);

  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0x111317,
    roughness: 0.32,
    metalness: 0.2,
    envMapIntensity: 0.44,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(shoeMat);

  const shoeSoleMat = makeMat(0x0c0e11, 0.75, 0.05);
  const watchSilverMat = makeMat(0xe2e8f0, 0.2, 0.88);
  const watchDialMat = makeMat(0xf8fafc, 0.28, 0.15);
  const leatherStrapMat = makeMat(0x1c1917, 0.68, 0.05);
  const penDarkMat = makeMat(0x0f172a, 0.3, 0.58);
  const penClipMat = makeMat(0xe2e8f0, 0.18, 0.92);

  // === CLEAN D-SHAPED HEMISPHERE + FLAT FRONT FACE HEAD (PRINCIPAL MAN) ===
  void hairMat;
  void browMat;
  void eyelidMat;
  rig.principalBrows = null;
  buildPhotoHemisphereHead(rig, 'principal', skinMat, grayTempleMat);

  // === NECK, STANDING WHITE COLLAR, CLOSED PLEATED CASSOCK & POWDER-BLUE NEHRU VEST ===
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.074, 0.15, 14), skinMat);
  neck.position.set(0, 0.71, 0);
  rig.torso.add(neck);

  const whiteCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.084, 0.092, 0.094, 18),
    collarWhiteMat,
  );
  whiteCollar.position.set(0, 0.676, 0.002);
  rig.torso.add(whiteCollar);

  const innerChest = new THREE.Mesh(
    new THREE.CylinderGeometry(0.214, 0.182, 0.59, 18),
    cassockMat,
  );
  innerChest.scale.set(1.16, 1, 0.76);
  innerChest.position.set(0, 0.34, 0);
  innerChest.castShadow = true;
  rig.torso.add(innerChest);

  const vestTorso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.23, 0.214, 0.63, 20),
    vestMat,
  );
  vestTorso.scale.set(1.18, 1, 0.8);
  vestTorso.position.set(0, 0.335, 0.003);
  vestTorso.castShadow = true;
  rig.torso.add(vestTorso);
  attachSubtleOutline(rig.torso, vestTorso, 1.03);

  [-1, 1].forEach((side) => {
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.126, 0.074, 0.265), vestMat);
    yoke.position.set(side * 0.205, 0.614, 0.002);
    yoke.rotation.z = -side * 0.12;
    rig.torso.add(yoke);
  });

  const vestCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.102, 0.116, 0.074, 18, 1, true, 0.32, Math.PI * 1.82),
    vestTrimMat,
  );
  vestCollar.rotation.y = Math.PI * 0.91;
  vestCollar.position.set(0, 0.648, 0.003);
  rig.torso.add(vestCollar);

  const placket = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.59, 0.022), vestTrimMat);
  placket.position.set(0, 0.33, 0.178);
  rig.torso.add(placket);

  for (let b = 0; b < 5; b++) {
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.0155, 0.0155, 0.014, 10), buttonMat);
    btn.rotation.x = Math.PI / 2;
    btn.position.set(0, 0.545 - b * 0.108, 0.193);
    rig.torso.add(btn);
  }

  // Left chest pocket + clipped dark metallic pen
  const chestPocket = new THREE.Mesh(new THREE.BoxGeometry(0.096, 0.084, 0.02), vestTrimMat);
  chestPocket.position.set(-0.116, 0.47, 0.173);
  const pocketWelt = new THREE.Mesh(new THREE.BoxGeometry(0.104, 0.018, 0.026), buttonMat);
  pocketWelt.position.set(-0.116, 0.512, 0.179);
  rig.torso.add(chestPocket, pocketWelt);

  const penBody = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.0095, 0.125, 8), penDarkMat);
  penBody.position.set(-0.096, 0.538, 0.186);
  penBody.rotation.z = -0.09;
  const penClip = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.064, 0.011), penClipMat);
  penClip.position.set(-0.094, 0.544, 0.198);
  penClip.rotation.z = -0.09;
  const penCapTip = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), penClipMat);
  penCapTip.position.set(-0.101, 0.598, 0.186);
  rig.torso.add(penBody, penClip, penCapTip);

  const vestSkirt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.214, 0.236, 0.24, 20),
    vestMat,
  );
  vestSkirt.scale.set(1.18, 1, 0.8);
  vestSkirt.position.set(0, -0.032, 0.003);
  vestSkirt.castShadow = true;
  rig.torso.add(vestSkirt);
  attachSubtleOutline(rig.torso, vestSkirt, 1.03);

  const vestHemBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.237, 0.239, 0.028, 20),
    vestTrimMat,
  );
  vestHemBand.scale.set(1.18, 1, 0.8);
  vestHemBand.position.set(0, -0.145, 0.003);
  rig.torso.add(vestHemBand);

  [-1, 1].forEach((side) => {
    const lowWelt = new THREE.Mesh(new THREE.BoxGeometry(0.096, 0.018, 0.02), vestTrimMat);
    lowWelt.position.set(side * 0.128, 0.088, 0.174);
    rig.torso.add(lowWelt);
  });

  // === FULL-LENGTH WHITE CASSOCK SLEEVES, NATURAL HANDS & LEFT WRISTWATCH ===
  const upperSleeveGeo = new THREE.CapsuleGeometry(0.075, 0.23, 8, 12);
  const lowerSleeveGeo = new THREE.CapsuleGeometry(0.062, 0.21, 8, 12);
  const cuffGeo = new THREE.CylinderGeometry(0.063, 0.058, 0.056, 12);
  const palmGeo = new THREE.BoxGeometry(0.074, 0.094, 0.048);

  const armSpecs: Array<{ shoulder: THREE.Group; elbow: THREE.Group; isLeft: boolean }> = [
    { shoulder: rig.leftShoulder, elbow: rig.leftElbow, isLeft: true },
    { shoulder: rig.rightShoulder, elbow: rig.rightElbow, isLeft: false },
  ];

  for (const { shoulder, elbow, isLeft } of armSpecs) {
    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.079, 12, 10), cassockMat);
    shoulderCap.castShadow = true;
    shoulder.add(shoulderCap);

    const upper = new THREE.Mesh(upperSleeveGeo, cassockMat);
    upper.position.y = -0.17;
    upper.castShadow = true;
    shoulder.add(upper);

    const lower = new THREE.Mesh(lowerSleeveGeo, cassockMat);
    lower.position.y = -0.15;
    lower.castShadow = true;
    elbow.add(lower);

    const cuff = new THREE.Mesh(cuffGeo, collarWhiteMat);
    cuff.position.y = -0.27;
    elbow.add(cuff);

    if (isLeft) {
      const watchGroup = new THREE.Group();
      const strap = new THREE.Mesh(
        new THREE.TorusGeometry(0.048, 0.012, 8, 16),
        leatherStrapMat,
      );
      strap.rotation.x = Math.PI / 2;
      const bezel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.028, 0.014, 14),
        watchSilverMat,
      );
      bezel.rotation.z = Math.PI / 2;
      bezel.position.set(-0.048, 0, 0.007);
      const dial = new THREE.Mesh(
        new THREE.CylinderGeometry(0.021, 0.021, 0.016, 14),
        watchDialMat,
      );
      dial.rotation.z = Math.PI / 2;
      dial.position.set(-0.049, 0, 0.007);
      watchGroup.add(strap, bezel, dial);
      watchGroup.position.set(0, -0.305, 0);
      elbow.add(watchGroup);
    }

    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.042, 0.048, 10), skinMat);
    wrist.position.y = -0.312;
    elbow.add(wrist);

    const palm = new THREE.Mesh(palmGeo, skinMat);
    palm.position.set(0, -0.372, 0.008);
    palm.castShadow = true;
    elbow.add(palm);

    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.038, 4, 8), skinMat);
    thumb.position.set(isLeft ? 0.038 : -0.038, -0.366, 0.026);
    thumb.rotation.z = isLeft ? -0.45 : 0.45;
    elbow.add(thumb);
  }

  // === LEGS DRAPED IN CASSOCK CLOTH + POLISHED BLACK FORMAL DRESS SHOES ===
  const thighGeo = new THREE.CapsuleGeometry(0.072, 0.33, 8, 12);
  const shinGeo = new THREE.CapsuleGeometry(0.058, 0.31, 8, 12);
  const ankleSockGeo = new THREE.CylinderGeometry(0.052, 0.05, 0.1, 10);

  [
    [rig.leftHip, rig.leftKnee],
    [rig.rightHip, rig.rightKnee],
  ].forEach(([hip, knee]) => {
    const thigh = new THREE.Mesh(thighGeo, cassockMat);
    thigh.position.y = -0.245;
    thigh.castShadow = true;
    hip.add(thigh);

    const shin = new THREE.Mesh(shinGeo, cassockMat);
    shin.position.y = -0.22;
    shin.castShadow = true;
    knee.add(shin);

    const ankleSock = new THREE.Mesh(ankleSockGeo, trouserMat);
    ankleSock.position.y = -0.455;
    knee.add(ankleSock);

    const shoeGroup = new THREE.Group();
    const shoeHeel = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.092, 0.175), shoeMat);
    shoeHeel.position.set(0, 0.058, -0.022);
    shoeHeel.castShadow = true;
    const shoeVamp = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.135, 6, 10), shoeMat);
    shoeVamp.rotation.x = Math.PI / 2;
    shoeVamp.scale.set(1.04, 1, 0.72);
    shoeVamp.position.set(0, 0.048, 0.104);
    shoeVamp.castShadow = true;
    const shoeSole = new THREE.Mesh(new THREE.BoxGeometry(0.132, 0.024, 0.335), shoeSoleMat);
    shoeSole.position.set(0, 0.012, 0.06);
    shoeGroup.add(shoeHeel, shoeVamp, shoeSole);
    shoeGroup.position.set(0, -0.555, 0);
    knee.add(shoeGroup);
  });

  // === CLOSED PLEATED OFF-WHITE CASSOCK WITH KICK ARTICULATION ===
  const waistBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.224, 0.252, 0.15, 24),
    cassockMat,
  );
  waistBand.scale.set(1.18, 1, 0.92);
  waistBand.position.set(0, -0.02, 0);
  rig.pelvis.add(waistBand);

  const closedCassockSkirt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.236, 0.312, 0.87, 28, 1, true),
    cassockDoubleMat,
  );
  closedCassockSkirt.scale.set(1.18, 1, 0.96);
  closedCassockSkirt.position.set(0, -0.455, 0);
  closedCassockSkirt.castShadow = true;
  rig.pelvis.add(closedCassockSkirt);
  attachSubtleOutline(rig.pelvis, closedCassockSkirt, 1.028);

  const hemRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.312, 0.011, 8, 28),
    cassockMat,
  );
  hemRing.rotation.x = Math.PI / 2;
  hemRing.scale.set(1.18, 0.96, 1);
  hemRing.position.set(0, -0.89, 0);
  rig.pelvis.add(hemRing);

  const panelHeight = 0.86;
  const frontLeft = new THREE.Group();
  frontLeft.position.set(-0.075, -0.03, 0.175);
  const frontLeftMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.23, panelHeight, 12, 1, true, -0.55, 1.05),
    cassockDoubleMat,
  );
  frontLeftMesh.position.set(0, -panelHeight * 0.5, -0.09);
  frontLeft.add(frontLeftMesh);
  rig.pelvis.add(frontLeft);

  const frontRight = new THREE.Group();
  frontRight.position.set(0.075, -0.03, 0.175);
  const frontRightMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.23, panelHeight, 12, 1, true, -0.5, 1.05),
    cassockDoubleMat,
  );
  frontRightMesh.position.set(0, -panelHeight * 0.5, -0.09);
  frontRight.add(frontRightMesh);
  rig.pelvis.add(frontRight);

  const back = new THREE.Group();
  back.position.set(0, -0.03, -0.175);
  const backMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.28, panelHeight, 14, 1, true, Math.PI - 0.65, 1.3),
    cassockDoubleMat,
  );
  backMesh.position.set(0, -panelHeight * 0.5, 0.1);
  back.add(backMesh);
  rig.pelvis.add(back);

  const leftSide = new THREE.Group();
  leftSide.position.set(-0.22, -0.03, 0);
  const rightSide = new THREE.Group();
  rightSide.position.set(0.22, -0.03, 0);
  rig.pelvis.add(leftSide, rightSide);

  rig.cassockPanels = {
    frontLeft,
    frontRight,
    back,
    leftSide,
    rightSide,
  };
}

/**
 * Generates an anatomical shirtless bodybuilder upper-torso CanvasTexture (512x512)
 * with realistic warm-tan South Asian skin tone, pectoral cleft, 6-pack abdominal
 * definition, serratus/oblique shading, and sculpted back/latissimus contours so
 * muscle definition catches studio rim light naturally.
 */
function createSamyakTorsoTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  // CylinderGeometry U=0.5 aligns along +Z (front of torso); U=0/1 wraps back
  ctx.fillStyle = '#B87F5A';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle vertical warm highlight on upper chest/shoulders and natural shadow at lower waist
  const baseGrad = ctx.createLinearGradient(0, 0, 0, 512);
  baseGrad.addColorStop(0, 'rgba(235, 194, 160, 0.24)');
  baseGrad.addColorStop(0.45, 'rgba(188, 136, 102, 0)');
  baseGrad.addColorStop(1, 'rgba(86, 48, 28, 0.26)');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, 512, 512);

  const fx = 256; // front center (+Z)

  // Center linea alba & pectoral sternum cleft shadow
  const cleftGrad = ctx.createLinearGradient(fx - 10, 0, fx + 10, 0);
  cleftGrad.addColorStop(0, 'rgba(92, 52, 30, 0)');
  cleftGrad.addColorStop(0.5, 'rgba(78, 42, 22, 0.42)');
  cleftGrad.addColorStop(1, 'rgba(92, 52, 30, 0)');
  ctx.fillStyle = cleftGrad;
  ctx.fillRect(fx - 10, 88, 20, 340);

  // Sculpted upper pectoral highlights & lower pec underside shadows
  [-1, 1].forEach((side) => {
    const px = fx + side * 48;
    const pecHi = ctx.createRadialGradient(px, 134, 6, px, 146, 52);
    pecHi.addColorStop(0, 'rgba(245, 206, 174, 0.34)');
    pecHi.addColorStop(1, 'rgba(188, 136, 102, 0)');
    ctx.fillStyle = pecHi;
    ctx.beginPath();
    ctx.ellipse(px, 142, 46, 34, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crisp under-pec muscle groove
    ctx.strokeStyle = 'rgba(82, 44, 24, 0.48)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(fx + side * 12, 186);
    ctx.quadraticCurveTo(px, 198, fx + side * 86, 178);
    ctx.stroke();

    // Collarbone highlight
    ctx.strokeStyle = 'rgba(242, 204, 172, 0.36)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(fx + side * 14, 72);
    ctx.quadraticCurveTo(fx + side * 52, 64, fx + side * 92, 76);
    ctx.stroke();
  });

  // 6-Pack abdominal muscle highlight & tendon shadow grooves
  const abYs = [242, 302, 362];
  for (const ay of abYs) {
    [-1, 1].forEach((side) => {
      const ax = fx + side * 26;
      const abHi = ctx.createRadialGradient(ax, ay - 6, 4, ax, ay, 28);
      abHi.addColorStop(0, 'rgba(242, 200, 166, 0.34)');
      abHi.addColorStop(1, 'rgba(188, 136, 102, 0)');
      ctx.fillStyle = abHi;
      ctx.beginPath();
      ctx.ellipse(ax, ay, 22, 22, 0, 0, Math.PI * 2);
      ctx.fill();

      // Horizontal ab groove
      ctx.strokeStyle = 'rgba(82, 44, 24, 0.42)';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(fx + side * 8, ay + 24);
      ctx.quadraticCurveTo(ax, ay + 28, fx + side * 46, ay + 22);
      ctx.stroke();
    });
  }

  // Outer oblique & serratus framing shadows
  [-1, 1].forEach((side) => {
    ctx.strokeStyle = 'rgba(82, 44, 24, 0.36)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(fx + side * 66, 214);
    ctx.quadraticCurveTo(fx + side * 58, 315, fx + side * 48, 422);
    ctx.stroke();
  });

  // Back spine & shoulder-blade contour shading near U=0 and U=1
  [12, 500].forEach((bx) => {
    ctx.fillStyle = 'rgba(78, 42, 22, 0.34)';
    ctx.fillRect(bx - 6, 70, 12, 360);
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates matte-black athletic joggers texture with subtle woven grain & dark slate side-seam stripe.
 */
function createSamyakJoggersTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#16181E';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle athletic jersey fleece weave
  ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
  for (let y = 0; y < 256; y += 4) {
    ctx.fillRect(0, y, 256, 1);
  }
  // Subtle matte charcoal outer side-seam piping
  ctx.fillStyle = '#2B313E';
  ctx.fillRect(60, 0, 8, 256);
  ctx.fillRect(188, 0, 8, 256);
  ctx.fillStyle = '#475569';
  ctx.fillRect(63, 0, 2, 256);
  ctx.fillRect(191, 0, 2, 256);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * SAMYAK — Realistic Procedural 3D Human Bodybuilder & UPSC/IAS Aspirant:
 * - Authentic ~7.5-head adult bodybuilder proportions (~2.24m commanding height)
 * - Warm-tan South Asian skin (roughness 0.58), short dark slightly tousled hair,
 *   neatly trimmed full black beard & moustache, sleek reflective dark square black sunglasses
 * - Completely SHIRTLESS heavily sculpted bodybuilder upper body: broad V-taper shoulders,
 *   defined 3D pectorals, thick biceps/forearms, visible 6-pack abs, and thin red kalawa
 *   sacred thread wrapped around his right wrist
 * - Fitted matte-black athletic joggers (roughness 0.88) & sporty black-and-white gym sneakers
 */
function buildSamyak(rig: FighterRig): void {
  // === 1. FIGHTKARO-STYLE READABLE ~1:5.5 BODYBUILDER PROPORTIONS (~1.42x HEAD SCALE) ===
  rig.pelvis.position.set(0, 1.07, 0);
  rig.torso.position.set(0, 0.09, 0);
  rig.head.position.set(0, 0.905, 0);
  rig.head.scale.setScalar(1.42);

  // Broad athletic V-taper shoulder width
  const shoulderX = 0.355;
  const shoulderY = 0.62;
  rig.leftShoulder.position.set(-shoulderX, shoulderY, 0);
  rig.rightShoulder.position.set(shoulderX, shoulderY, 0);
  rig.leftElbow.position.set(0, -0.35, 0);
  rig.rightElbow.position.set(0, -0.35, 0);

  rig.leftHip.position.set(-0.135, -0.02, 0);
  rig.rightHip.position.set(0.135, -0.02, 0);
  rig.leftKnee.position.set(0, -0.495, 0);
  rig.rightKnee.position.set(0, -0.495, 0);

  // === 2. GROUNDED PBR MATERIALS ===
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xb87f5a,
    roughness: 0.58,
    metalness: 0.02,
    envMapIntensity: 0.28,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(skinMat);

  const torsoTex = createSamyakTorsoTexture();
  const torsoSkinMat = new THREE.MeshStandardMaterial({
    map: torsoTex,
    color: 0xffffff,
    roughness: 0.55,
    metalness: 0.02,
    envMapIntensity: 0.28,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(torsoSkinMat);

  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x141214,
    roughness: 0.78,
    metalness: 0.04,
    envMapIntensity: 0.18,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(hairMat);

  const kalawaRedMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.72,
    metalness: 0.04,
    envMapIntensity: 0.2,
    emissive: new THREE.Color(0x991b1b),
    emissiveIntensity: 0.12,
  });
  const kalawaGoldMat = makeMat(0xfacc15, 0.65, 0.08);

  const joggersTex = createSamyakJoggersTexture();
  const joggersMat = new THREE.MeshStandardMaterial({
    map: joggersTex,
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.02,
    envMapIntensity: 0.18,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(joggersMat);

  const cuffMat = new THREE.MeshStandardMaterial({
    color: 0x111318,
    roughness: 0.9,
    metalness: 0.02,
    envMapIntensity: 0.16,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(cuffMat);

  const sneakerUpperMat = new THREE.MeshStandardMaterial({
    color: 0x14161b,
    roughness: 0.6,
    metalness: 0.06,
    envMapIntensity: 0.26,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(sneakerUpperMat);

  const sneakerWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xf4f6f9,
    roughness: 0.48,
    metalness: 0.04,
    envMapIntensity: 0.22,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  rig.flashMaterials.push(sneakerWhiteMat);

  const sneakerTreadMat = makeMat(0x0b0c10, 0.82, 0.04);

  // === 3. CLEAN D-SHAPED HEMISPHERE + FLAT FRONT FACE HEAD (SAMYAK — NO DUPLICATE 3D SUNGLASSES) ===
  void hairMat;
  buildPhotoHemisphereHead(rig, 'samyak', skinMat);

  // === 4. SHIRTLESS HEAVILY SCULPTED BODYBUILDER UPPER BODY (NO SHIRT / NO BANIYAN!) ===
  // Muscular neck & broad trapezius slopes
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.092, 0.155, 14), skinMat);
  neck.position.set(0, 0.71, 0);
  rig.torso.add(neck);

  [-1, 1].forEach((side) => {
    const trap = new THREE.Mesh(new THREE.CapsuleGeometry(0.064, 0.175, 6, 10), skinMat);
    trap.position.set(side * 0.14, 0.66, -0.012);
    trap.rotation.z = side * 1.08;
    trap.castShadow = true;
    rig.torso.add(trap);
  });

  // Dramatic V-taper athletic ribcage & torso core (textured with subtle pec/ab/lat shading)
  const torsoCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.258, 0.172, 0.62, 22),
    torsoSkinMat,
  );
  torsoCore.scale.set(1.18, 1, 0.78);
  torsoCore.position.set(0, 0.34, 0);
  torsoCore.castShadow = true;
  rig.torso.add(torsoCore);
  attachSubtleOutline(rig.torso, torsoCore, 1.03);

  // Sculpted 3D Pectorals catching studio rim light cleanly
  [-1, 1].forEach((side) => {
    const pec = new THREE.Mesh(new THREE.SphereGeometry(0.132, 16, 12), skinMat);
    pec.scale.set(1.06, 0.76, 0.62);
    pec.position.set(side * 0.122, 0.478, 0.132);
    pec.rotation.y = side * 0.16;
    pec.castShadow = true;
    rig.torso.add(pec);

    // Sculpted latissimus dorsi wings for unmistakable V-taper silhouette
    const lat = new THREE.Mesh(new THREE.SphereGeometry(0.118, 12, 10), skinMat);
    lat.scale.set(0.68, 1.38, 0.74);
    lat.position.set(side * 0.242, 0.415, -0.035);
    lat.rotation.z = -side * 0.18;
    rig.torso.add(lat);
  });

  // Sculpted 3D 6-Pack Abs (3 pairs of clearly defined rounded abdominal muscles!)
  const abRows = [
    { y: 0.312, z: 0.146, sx: 0.056, sy: 0.044 },
    { y: 0.218, z: 0.144, sx: 0.054, sy: 0.044 },
    { y: 0.124, z: 0.138, sx: 0.05, sy: 0.046 },
  ];
  for (const row of abRows) {
    [-1, 1].forEach((side) => {
      const abBlock = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), skinMat);
      abBlock.scale.set(row.sx, row.sy, 0.036);
      abBlock.position.set(side * 0.058, row.y, row.z);
      rig.torso.add(abBlock);
    });
  }

  // Sculpted athletic obliques flanking the 6-pack abs
  [-1, 1].forEach((side) => {
    const oblique = new THREE.Mesh(new THREE.CapsuleGeometry(0.056, 0.22, 6, 10), skinMat);
    oblique.scale.set(0.85, 1, 0.92);
    oblique.position.set(side * 0.165, 0.205, 0.058);
    oblique.rotation.z = -side * 0.12;
    rig.torso.add(oblique);
  });

  // === 5. THICK SCULPTED BODYBUILDER ARMS (DELTS, BICEPS, FOREARMS) + RED KALAWA ON RIGHT WRIST ===
  const upperArmGeo = new THREE.CapsuleGeometry(0.078, 0.21, 8, 12);
  const forearmGeo = new THREE.CapsuleGeometry(0.064, 0.21, 8, 12);
  const fistGeo = new THREE.BoxGeometry(0.088, 0.095, 0.074);

  const armSpecs: Array<{ shoulder: THREE.Group; elbow: THREE.Group; isLeft: boolean }> = [
    { shoulder: rig.leftShoulder, elbow: rig.leftElbow, isLeft: true },
    { shoulder: rig.rightShoulder, elbow: rig.rightElbow, isLeft: false },
  ];

  for (const { shoulder, elbow, isLeft } of armSpecs) {
    // Broad sculpted 3D deltoid cap
    const delt = new THREE.Mesh(new THREE.SphereGeometry(0.114, 16, 12), skinMat);
    delt.scale.set(1.06, 1.04, 0.98);
    delt.castShadow = true;
    shoulder.add(delt);

    // Thick muscular upper arm core + prominent sculpted bicep peak & tricep curve
    const upper = new THREE.Mesh(upperArmGeo, skinMat);
    upper.position.y = -0.175;
    upper.castShadow = true;
    shoulder.add(upper);

    const bicep = new THREE.Mesh(new THREE.SphereGeometry(0.084, 12, 10), skinMat);
    bicep.scale.set(0.92, 1.32, 1.06);
    bicep.position.set(0, -0.175, 0.036);
    bicep.castShadow = true;
    shoulder.add(bicep);

    const tricep = new THREE.Mesh(new THREE.SphereGeometry(0.074, 10, 8), skinMat);
    tricep.scale.set(0.9, 1.35, 0.92);
    tricep.position.set(0, -0.17, -0.032);
    shoulder.add(tricep);

    // Muscular forearm with brachioradialis taper
    const forearm = new THREE.Mesh(forearmGeo, skinMat);
    forearm.position.y = -0.155;
    forearm.castShadow = true;
    elbow.add(forearm);

    const forearmBulge = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), skinMat);
    forearmBulge.scale.set(0.96, 1.35, 0.98);
    forearmBulge.position.set(0, -0.095, 0.016);
    elbow.add(forearmBulge);

    // Thin red sacred thread (kalawa) wrapped cleanly around RIGHT wrist!
    if (!isLeft) {
      const kalawa1 = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.0085, 8, 18), kalawaRedMat);
      kalawa1.rotation.x = Math.PI / 2;
      kalawa1.position.y = -0.296;
      const kalawa2 = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.0075, 8, 18), kalawaRedMat);
      kalawa2.rotation.x = Math.PI / 2;
      kalawa2.position.y = -0.312;
      const kalawaKnot = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), kalawaGoldMat);
      kalawaKnot.position.set(0.054, -0.304, 0.014);
      elbow.add(kalawa1, kalawa2, kalawaKnot);
    }

    // Sculpted wrist & muscular clenched fighter fist
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.05, 0.048, 10), skinMat);
    wrist.position.y = -0.318;
    elbow.add(wrist);

    const fist = new THREE.Mesh(fistGeo, skinMat);
    fist.position.set(0, -0.378, 0.01);
    fist.castShadow = true;
    elbow.add(fist);

    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.04, 5, 8), skinMat);
    thumb.position.set(isLeft ? 0.042 : -0.042, -0.37, 0.036);
    thumb.rotation.z = isLeft ? -0.45 : 0.45;
    elbow.add(thumb);
  }

  // === 6. MATTE-BLACK ATHLETIC JOGGERS & SPORTY BLACK-AND-WHITE GYM SNEAKERS ===
  // Athletic jogger waistband & pelvis block
  const joggerWaist = new THREE.Mesh(
    new THREE.CylinderGeometry(0.205, 0.214, 0.21, 20),
    joggersMat,
  );
  joggerWaist.scale.set(1.16, 1, 0.8);
  joggerWaist.position.set(0, 0.01, 0);
  joggerWaist.castShadow = true;
  rig.pelvis.add(joggerWaist);

  const elasticBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.208, 0.208, 0.052, 20),
    cuffMat,
  );
  elasticBand.scale.set(1.16, 1, 0.8);
  elasticBand.position.set(0, 0.095, 0);
  rig.pelvis.add(elasticBand);

  // Subtle white drawstring laces at front waistband
  [-1, 1].forEach((side) => {
    const lace = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.095, 6), sneakerWhiteMat);
    lace.position.set(side * 0.022, 0.052, 0.168);
    lace.rotation.z = side * 0.18;
    rig.pelvis.add(lace);
  });

  const thighGeo = new THREE.CapsuleGeometry(0.105, 0.34, 8, 12);
  const calfGeo = new THREE.CapsuleGeometry(0.072, 0.34, 8, 12);

  [
    [rig.leftHip, rig.leftKnee],
    [rig.rightHip, rig.rightKnee],
  ].forEach(([hip, knee]) => {
    const thigh = new THREE.Mesh(thighGeo, joggersMat);
    thigh.position.y = -0.245;
    thigh.castShadow = true;
    hip.add(thigh);

    const shin = new THREE.Mesh(calfGeo, joggersMat);
    shin.position.y = -0.235;
    shin.castShadow = true;
    knee.add(shin);

    // Ribbed fitted ankle jogger cuff
    const ankleCuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.06, 0.068, 12),
      cuffMat,
    );
    ankleCuff.position.y = -0.445;
    knee.add(ankleCuff);

    // Sporty Black-and-White Gym Sneaker (chunky crisp white midsole + matte black athletic upper)
    const shoeGroup = new THREE.Group();
    const midsole = new THREE.Mesh(new THREE.BoxGeometry(0.146, 0.046, 0.355), sneakerWhiteMat);
    midsole.position.set(0, 0.032, 0.06);
    midsole.castShadow = true;

    const tread = new THREE.Mesh(new THREE.BoxGeometry(0.148, 0.014, 0.358), sneakerTreadMat);
    tread.position.set(0, 0.007, 0.06);

    const heelUpper = new THREE.Mesh(new THREE.BoxGeometry(0.134, 0.088, 0.18), sneakerUpperMat);
    heelUpper.position.set(0, 0.088, -0.022);
    heelUpper.castShadow = true;

    const toeBox = new THREE.Mesh(new THREE.CapsuleGeometry(0.064, 0.14, 6, 10), sneakerUpperMat);
    toeBox.rotation.x = Math.PI / 2;
    toeBox.scale.set(1.06, 1, 0.72);
    toeBox.position.set(0, 0.076, 0.112);
    toeBox.castShadow = true;

    // White athletic side accents & crisp tongue laces
    [-1, 1].forEach((side) => {
      const slash = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.022, 0.115), sneakerWhiteMat);
      slash.position.set(side * 0.068, 0.082, 0.048);
      slash.rotation.x = 0.22;
      shoeGroup.add(slash);
    });
    const tongueAccent = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.026, 0.082), sneakerWhiteMat);
    tongueAccent.position.set(0, 0.112, 0.085);
    tongueAccent.rotation.x = 0.32;

    shoeGroup.add(midsole, tread, heelUpper, toeBox, tongueAccent);
    shoeGroup.position.set(0, -0.562, 0);
    knee.add(shoeGroup);
  });
}

export function buildFighterRig(id: FighterId): FighterRig {
  const face = createDynamicFace(id);
  const isEggBody = id === 'anda';
  const rig = createBaseRigSkeleton(id, face, isEggBody);

  switch (id) {
    case 'sheru':
      buildSheruBhai(rig);
      rig.leftFistAnchor.position.set(0, -0.355, 0.02);
      rig.rightFistAnchor.position.set(0, -0.355, 0.02);
      rig.leftFootAnchor.position.set(0, -0.39, 0.08);
      rig.rightFootAnchor.position.set(0, -0.39, 0.08);
      break;
    case 'billa':
      buildBlueBilla(rig);
      rig.leftFistAnchor.position.set(0, -0.38, 0.03);
      rig.rightFistAnchor.position.set(0, -0.38, 0.03);
      rig.leftFootAnchor.position.set(0, -0.31, 0.12);
      rig.rightFootAnchor.position.set(0, -0.31, 0.12);
      break;
    case 'neta':
      buildGaribSenaNeta(rig);
      rig.leftFistAnchor.position.set(0, -0.30, 0.02);
      rig.rightFistAnchor.position.set(0, -0.30, 0.02);
      rig.leftFootAnchor.position.set(0, -0.415, 0.08);
      rig.rightFootAnchor.position.set(0, -0.415, 0.08);
      break;
    case 'anda':
      buildAndaBhai(rig);
      rig.leftFistAnchor.position.set(0, -0.31, 0.02);
      rig.rightFistAnchor.position.set(0, -0.31, 0.02);
      rig.leftFootAnchor.position.set(0, -0.32, 0.12);
      rig.rightFootAnchor.position.set(0, -0.32, 0.12);
      break;
    case 'mausi':
      buildLaddooMausi(rig);
      rig.leftFistAnchor.position.set(0, -0.31, 0.02);
      rig.rightFistAnchor.position.set(0, -0.31, 0.02);
      rig.leftFootAnchor.position.set(0, -0.41, 0.10);
      rig.rightFootAnchor.position.set(0, -0.41, 0.10);
      break;
    case 'father':
      buildFatherRoyDolphus(rig);
      rig.leftFistAnchor.position.set(0, -0.35, 0.02);
      rig.rightFistAnchor.position.set(0, -0.35, 0.02);
      rig.leftFootAnchor.position.set(0, -0.47, 0.10);
      rig.rightFootAnchor.position.set(0, -0.47, 0.10);
      break;
    case 'samyak':
      buildSamyak(rig);
      rig.leftFistAnchor.position.set(0, -0.37, 0.02);
      rig.rightFistAnchor.position.set(0, -0.37, 0.02);
      rig.leftFootAnchor.position.set(0, -0.48, 0.10);
      rig.rightFootAnchor.position.set(0, -0.48, 0.10);
      break;
    case 'principal':
      buildPrincipalMan(rig);
      rig.leftFistAnchor.position.set(0, -0.35, 0.02);
      rig.rightFistAnchor.position.set(0, -0.35, 0.02);
      rig.leftFootAnchor.position.set(0, -0.47, 0.10);
      rig.rightFootAnchor.position.set(0, -0.47, 0.10);
      break;
  }

  return rig;
}
