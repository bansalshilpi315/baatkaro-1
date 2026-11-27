import * as THREE from 'three';

export interface ProceduralFabricTexturePair {
  diffuse: THREE.CanvasTexture | null;
  bump: THREE.CanvasTexture | null;
}

export interface ClothPbrOptions {
  fallbackColor: number;
  roughness: number;
  bumpScale: number;
  side?: THREE.Side;
  envMapIntensity?: number;
  polygonOffset?: boolean;
}

interface FabricCache {
  adiOliveTee?: ProceduralFabricTexturePair;
  adiPlaidShirt?: ProceduralFabricTexturePair;
  adiPlaidPanel?: ProceduralFabricTexturePair;
  adiDenimJeans?: ProceduralFabricTexturePair;
  krishSweatshirt?: ProceduralFabricTexturePair;
  krishRibbedTrim?: ProceduralFabricTexturePair;
  krishJoggers?: ProceduralFabricTexturePair;
  krishBackpack?: ProceduralFabricTexturePair;
  krishWristband?: ProceduralFabricTexturePair;
}

const fabricCache: FabricCache = {};

const TEX_SIZE = 512;

function createHash(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function createCanvasPair():
  | {
      diffCanvas: HTMLCanvasElement;
      diffCtx: CanvasRenderingContext2D;
      bumpCanvas: HTMLCanvasElement;
      bumpCtx: CanvasRenderingContext2D;
    }
  | null {
  if (typeof document === 'undefined') return null;
  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = TEX_SIZE;
  diffCanvas.height = TEX_SIZE;
  const diffCtx = diffCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = TEX_SIZE;
  bumpCanvas.height = TEX_SIZE;
  const bumpCtx = bumpCanvas.getContext('2d');

  if (!diffCtx || !bumpCtx) return null;
  return { diffCanvas, diffCtx, bumpCanvas, bumpCtx };
}

function finalizeTexturePair(
  diffCanvas: HTMLCanvasElement,
  bumpCanvas: HTMLCanvasElement,
  wrapS: THREE.Wrapping,
  wrapT: THREE.Wrapping,
  repeatX = 1,
  repeatY = 1,
): ProceduralFabricTexturePair {
  const diffuse = new THREE.CanvasTexture(diffCanvas);
  diffuse.colorSpace = THREE.SRGBColorSpace;
  diffuse.wrapS = wrapS;
  diffuse.wrapT = wrapT;
  diffuse.repeat.set(repeatX, repeatY);
  diffuse.anisotropy = 4;
  diffuse.needsUpdate = true;

  // Data/height map MUST remain in linear space (NoColorSpace)
  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.colorSpace = THREE.NoColorSpace;
  bump.wrapS = wrapS;
  bump.wrapT = wrapT;
  bump.repeat.set(repeatX, repeatY);
  bump.anisotropy = 4;
  bump.needsUpdate = true;

  return { diffuse, bump };
}

/**
 * Creates a matte anti-plastic PBR cloth material paired with cached diffuse + bump maps.
 * Enforces metalness = 0.0, matte cloth roughness (0.85–0.92), and subtle bump relief (0.018–0.03).
 */
export function createClothPbrMaterial(
  pair: ProceduralFabricTexturePair,
  opts: ClothPbrOptions,
  flashMaterials?: THREE.MeshStandardMaterial[],
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    map: pair.diffuse ?? undefined,
    bumpMap: pair.bump ?? undefined,
    bumpScale: opts.bumpScale,
    color: pair.diffuse ? 0xffffff : opts.fallbackColor,
    roughness: opts.roughness,
    metalness: 0.0,
    envMapIntensity: opts.envMapIntensity ?? 0.16,
    side: opts.side ?? THREE.FrontSide,
    polygonOffset: opts.polygonOffset ?? false,
    polygonOffsetFactor: opts.polygonOffset ? -1 : 0,
    polygonOffsetUnits: opts.polygonOffset ? -1 : 0,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
  });
  if (flashMaterials) {
    flashMaterials.push(mat);
  }
  return mat;
}

/**
 * Helper to draw soft organic fabric drape creases on both diffuse and bump canvases.
 */
function drawClothFolds(
  diffCtx: CanvasRenderingContext2D,
  bumpCtx: CanvasRenderingContext2D,
  folds: Array<{ x1: number; y1: number; cx: number; cy: number; x2: number; y2: number; width: number; strength: number }>,
): void {
  diffCtx.lineCap = 'round';
  bumpCtx.lineCap = 'round';
  for (const f of folds) {
    // Soft dark shadow trough
    diffCtx.strokeStyle = `rgba(12, 14, 10, ${f.strength})`;
    diffCtx.lineWidth = f.width;
    diffCtx.beginPath();
    diffCtx.moveTo(f.x1, f.y1);
    diffCtx.quadraticCurveTo(f.cx, f.cy, f.x2, f.y2);
    diffCtx.stroke();

    // Adjacent subtle fabric ridge highlight
    diffCtx.strokeStyle = `rgba(255, 252, 240, ${f.strength * 0.48})`;
    diffCtx.lineWidth = f.width * 0.55;
    diffCtx.beginPath();
    diffCtx.moveTo(f.x1, f.y1 - f.width * 0.45);
    diffCtx.quadraticCurveTo(f.cx, f.cy - f.width * 0.45, f.x2, f.y2 - f.width * 0.45);
    diffCtx.stroke();

    // Matching grayscale height map valley + crest
    bumpCtx.strokeStyle = 'rgba(72, 72, 72, 0.55)';
    bumpCtx.lineWidth = f.width;
    bumpCtx.beginPath();
    bumpCtx.moveTo(f.x1, f.y1);
    bumpCtx.quadraticCurveTo(f.cx, f.cy, f.x2, f.y2);
    bumpCtx.stroke();

    bumpCtx.strokeStyle = 'rgba(202, 202, 202, 0.52)';
    bumpCtx.lineWidth = f.width * 0.55;
    bumpCtx.beginPath();
    bumpCtx.moveTo(f.x1, f.y1 - f.width * 0.45);
    bumpCtx.quadraticCurveTo(f.cx, f.cy - f.width * 0.45, f.x2, f.y2 - f.width * 0.45);
    bumpCtx.stroke();
  }
}

/**
 * 1. ADI — Inner Olive-Green Graphic Crew-Neck T-Shirt (512x512 Diffuse + Bump)
 * Matches Reference Image 1: #4a5237 matte cotton jersey, knit grain, lower-torso drapery folds,
 * ribbed collar edge, and distressed dark charcoal-navy vintage block graphic across center chest.
 */
export function getAdiOliveTeeTextures(): ProceduralFabricTexturePair {
  if (fabricCache.adiOliveTee) return fabricCache.adiOliveTee;
  const pair = createCanvasPair();
  if (!pair) return { diffuse: null, bump: null };

  const { diffCanvas, diffCtx, bumpCanvas, bumpCtx } = pair;
  const rand = createHash(1017);

  // Neutral mid-gray height base
  bumpCtx.fillStyle = '#808080';
  bumpCtx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  // Rich matte olive-green jersey base (#4a5237) with soft upper-chest to waist shading
  const baseGrad = diffCtx.createLinearGradient(0, 0, 0, TEX_SIZE);
  baseGrad.addColorStop(0, '#555e40');
  baseGrad.addColorStop(0.45, '#4a5237');
  baseGrad.addColorStop(0.85, '#3e462e');
  baseGrad.addColorStop(1, '#333925');
  diffCtx.fillStyle = baseGrad;
  diffCtx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  // Fine cotton jersey knit wale/course micro-grain on diffuse + bump
  for (let y = 0; y < TEX_SIZE; y += 3) {
    diffCtx.fillStyle = y % 6 === 0 ? 'rgba(255,255,255,0.025)' : 'rgba(10,12,8,0.03)';
    diffCtx.fillRect(0, y, TEX_SIZE, 1.4);
    bumpCtx.fillStyle = y % 6 === 0 ? '#8c8c8c' : '#747474';
    bumpCtx.fillRect(0, y, TEX_SIZE, 1.4);
  }
  for (let i = 0; i < 3200; i++) {
    const x = Math.floor(rand() * TEX_SIZE);
    const y = Math.floor(rand() * TEX_SIZE);
    const light = rand() > 0.5;
    diffCtx.fillStyle = light ? 'rgba(215, 224, 190, 0.045)' : 'rgba(18, 22, 12, 0.055)';
    diffCtx.fillRect(x, y, 2, 2);
    bumpCtx.fillStyle = light ? '#909090' : '#707070';
    bumpCtx.fillRect(x, y, 2, 2);
  }

  // Ribbed crew-neck trim along top collar edge
  diffCtx.fillStyle = '#3a412a';
  diffCtx.fillRect(0, 0, TEX_SIZE, 28);
  bumpCtx.fillStyle = '#9c9c9c';
  bumpCtx.fillRect(0, 0, TEX_SIZE, 28);
  for (let x = 0; x < TEX_SIZE; x += 6) {
    diffCtx.fillStyle = 'rgba(15, 18, 10, 0.28)';
    diffCtx.fillRect(x, 0, 2, 28);
    bumpCtx.fillStyle = '#5c5c5c';
    bumpCtx.fillRect(x, 0, 2, 28);
  }

  // Soft cotton chest & lower-abdomen drape folds (matching Reference Image 1)
  drawClothFolds(diffCtx, bumpCtx, [
    { x1: 168, y1: 355, cx: 256, cy: 382, x2: 344, y2: 352, width: 12, strength: 0.24 },
    { x1: 180, y1: 405, cx: 256, cy: 426, x2: 332, y2: 402, width: 14, strength: 0.28 },
    { x1: 175, y1: 452, cx: 256, cy: 468, x2: 338, y2: 448, width: 11, strength: 0.22 },
    { x1: 185, y1: 118, cx: 215, cy: 148, x2: 204, y2: 210, width: 8, strength: 0.16 },
    { x1: 326, y1: 118, cx: 298, cy: 148, x2: 308, y2: 210, width: 8, strength: 0.16 },
  ]);

  // Distressed Dark Charcoal-Navy Vintage Graphic Print across Center Chest (u=0.5 -> x=256)
  // Matches Reference Image 1: dark slate-navy rectangular banner, bold vintage olive-cutout lettering + retro emblem
  const gx = 256;
  const gy = 195;

  diffCtx.save();
  // Dark distressed slate-charcoal vintage screen-print block
  diffCtx.fillStyle = 'rgba(26, 34, 42, 0.88)';
  diffCtx.fillRect(gx - 78, gy - 68, 156, 134);

  // Subtle top/bottom vintage print border bars
  diffCtx.fillStyle = 'rgba(74, 82, 55, 0.72)';
  diffCtx.fillRect(gx - 74, gy - 54, 148, 5);
  diffCtx.fillRect(gx - 74, gy + 50, 148, 5);

  // Bold distressed varsity/urban typography ("ENB CIT" style from Reference Image 1)
  diffCtx.fillStyle = '#6f7958';
  diffCtx.font = '900 32px Impact, "Arial Black", sans-serif';
  diffCtx.textAlign = 'center';
  diffCtx.textBaseline = 'middle';
  diffCtx.fillText('ENB CIT', gx, gy - 26);

  // Illustrated retro graphic motif underneath letters (circular camera/lens + street blocks)
  diffCtx.strokeStyle = '#687353';
  diffCtx.lineWidth = 4;
  diffCtx.beginPath();
  diffCtx.arc(gx + 14, gy + 18, 22, 0, Math.PI * 2);
  diffCtx.stroke();
  diffCtx.beginPath();
  diffCtx.arc(gx + 14, gy + 18, 11, 0, Math.PI * 2);
  diffCtx.stroke();

  diffCtx.fillStyle = '#687353';
  diffCtx.fillRect(gx - 64, gy + 2, 16, 36);
  diffCtx.fillRect(gx - 42, gy + 10, 12, 28);
  diffCtx.fillRect(gx - 25, gy + 4, 10, 34);
  diffCtx.fillRect(gx + 44, gy + 8, 20, 30);

  // Subtle horizontal weathered screen-print distress streaks (olive cloth peeking through ink)
  for (let i = 0; i < 420; i++) {
    const dx = gx - 80 + rand() * 160;
    const dy = gy - 70 + rand() * 138;
    const rw = 2 + rand() * 9;
    diffCtx.fillStyle = rand() > 0.35 ? 'rgba(74, 82, 55, 0.55)' : 'rgba(56, 64, 42, 0.45)';
    diffCtx.fillRect(dx, dy, rw, 1.6);
  }
  diffCtx.restore();

  // Gentle tactile ink height on bump map over the graphic print
  bumpCtx.fillStyle = 'rgba(148, 148, 148, 0.32)';
  bumpCtx.fillRect(gx - 78, gy - 68, 156, 134);

  // Bottom hem double-stitch line
  diffCtx.strokeStyle = 'rgba(28, 34, 20, 0.48)';
  diffCtx.lineWidth = 2.5;
  diffCtx.setLineDash([7, 5]);
  diffCtx.beginPath();
  diffCtx.moveTo(0, 492);
  diffCtx.lineTo(TEX_SIZE, 492);
  diffCtx.stroke();
  diffCtx.setLineDash([]);

  const result = finalizeTexturePair(
    diffCanvas,
    bumpCanvas,
    THREE.RepeatWrapping,
    THREE.ClampToEdgeWrapping,
  );
  fabricCache.adiOliveTee = result;
  return result;
}

function paintPlaidFlannelBase(
  diffCtx: CanvasRenderingContext2D,
  bumpCtx: CanvasRenderingContext2D,
  seed: number,
): void {
  const rand = createHash(seed);

  // Deep charcoal-navy flannel base (#1b2128) matching Reference Image 1 under bright arena light
  diffCtx.fillStyle = '#1b2128';
  diffCtx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  bumpCtx.fillStyle = '#808080';
  bumpCtx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  const cell = 128; // 4 full plaid repeats across 512px -> sharp, readable authentic flannel check
  for (let i = 0; i < TEX_SIZE; i += cell) {
    // 1. Wide muted slate-blue bands
    diffCtx.fillStyle = 'rgba(56, 68, 80, 0.62)';
    diffCtx.fillRect(i, 0, 48, TEX_SIZE);
    diffCtx.fillRect(0, i, TEX_SIZE, 48);

    // 2. Deep charcoal-navy crossing blocks
    diffCtx.fillStyle = 'rgba(16, 20, 26, 0.68)';
    diffCtx.fillRect(i + 48, 0, 32, TEX_SIZE);
    diffCtx.fillRect(0, i + 48, TEX_SIZE, 32);

    // 3. Muted warm beige/cream highlight checks (calibrated so sunlight doesn't wash them out)
    diffCtx.fillStyle = 'rgba(178, 165, 142, 0.66)';
    diffCtx.fillRect(i + 82, 0, 26, TEX_SIZE);
    diffCtx.fillRect(0, i + 82, TEX_SIZE, 26);

    // 4. Warm ochre/tan accent stripes framing cream check
    diffCtx.fillStyle = 'rgba(128, 108, 74, 0.74)';
    diffCtx.fillRect(i + 74, 0, 8, TEX_SIZE);
    diffCtx.fillRect(0, i + 74, TEX_SIZE, 8);
    diffCtx.fillRect(i + 108, 0, 10, TEX_SIZE);
    diffCtx.fillRect(0, i + 108, TEX_SIZE, 10);

    // 5. Crisp thin cream double pinstripe bisecting the slate-blue field
    diffCtx.fillStyle = 'rgba(196, 184, 162, 0.64)';
    diffCtx.fillRect(i + 18, 0, 4, TEX_SIZE);
    diffCtx.fillRect(0, i + 18, TEX_SIZE, 4);
    diffCtx.fillRect(i + 28, 0, 3, TEX_SIZE);
    diffCtx.fillRect(0, i + 28, TEX_SIZE, 3);

    // 6. Fine charcoal-navy hairline bisecting the cream check
    diffCtx.fillStyle = 'rgba(24, 30, 38, 0.78)';
    diffCtx.fillRect(i + 94, 0, 3, TEX_SIZE);
    diffCtx.fillRect(0, i + 94, TEX_SIZE, 3);
  }

  // Authentic brushed flannel twill weave (diagonal crosshatch threads on both diffuse + bump)
  for (let y = 0; y < TEX_SIZE; y += 4) {
    diffCtx.fillStyle = y % 8 === 0 ? 'rgba(255, 250, 240, 0.045)' : 'rgba(12, 16, 22, 0.06)';
    diffCtx.fillRect(0, y, TEX_SIZE, 1.5);
    bumpCtx.fillStyle = y % 8 === 0 ? '#969696' : '#6a6a6a';
    bumpCtx.fillRect(0, y, TEX_SIZE, 1.6);
  }
  for (let x = 0; x < TEX_SIZE; x += 4) {
    diffCtx.fillStyle = x % 8 === 0 ? 'rgba(255, 250, 240, 0.04)' : 'rgba(12, 16, 22, 0.055)';
    diffCtx.fillRect(x, 0, 1.5, TEX_SIZE);
    bumpCtx.fillStyle = x % 8 === 0 ? 'rgba(170,170,170,0.45)' : 'rgba(92,92,92,0.45)';
    bumpCtx.fillRect(x, 0, 1.6, TEX_SIZE);
  }

  // Diagonal flannel twill micro-grain
  diffCtx.strokeStyle = 'rgba(255, 248, 236, 0.045)';
  diffCtx.lineWidth = 1.2;
  bumpCtx.strokeStyle = 'rgba(180, 180, 180, 0.32)';
  bumpCtx.lineWidth = 1.4;
  for (let i = -TEX_SIZE; i < TEX_SIZE * 2; i += 8) {
    diffCtx.beginPath();
    diffCtx.moveTo(i, 0);
    diffCtx.lineTo(i + TEX_SIZE, TEX_SIZE);
    diffCtx.stroke();

    bumpCtx.beginPath();
    bumpCtx.moveTo(i, 0);
    bumpCtx.lineTo(i + TEX_SIZE, TEX_SIZE);
    bumpCtx.stroke();
  }

  // Soft brushed flannel fuzz micro-speckles
  for (let i = 0; i < 1800; i++) {
    const x = Math.floor(rand() * TEX_SIZE);
    const y = Math.floor(rand() * TEX_SIZE);
    bumpCtx.fillStyle = rand() > 0.5 ? '#949494' : '#6c6c6c';
    bumpCtx.fillRect(x, y, 2, 2);
  }
}

/**
 * 2A. ADI — Open Plaid Flannel Shirt (Seamless 512x512 Diffuse + Woven Twill Bump)
 */
export function getAdiPlaidShirtTextures(): ProceduralFabricTexturePair {
  if (fabricCache.adiPlaidShirt) return fabricCache.adiPlaidShirt;
  const pair = createCanvasPair();
  if (!pair) return { diffuse: null, bump: null };

  const { diffCanvas, diffCtx, bumpCanvas, bumpCtx } = pair;
  paintPlaidFlannelBase(diffCtx, bumpCtx, 2029);

  const result = finalizeTexturePair(
    diffCanvas,
    bumpCanvas,
    THREE.RepeatWrapping,
    THREE.RepeatWrapping,
    1.35,
    1.35,
  );
  fabricCache.adiPlaidShirt = result;
  return result;
}

/**
 * 2B. ADI — Front Plaid Panel with Tailored Vertical Placket Stitching & Soft Drape (512x512)
 */
export function getAdiPlaidPanelTextures(): ProceduralFabricTexturePair {
  if (fabricCache.adiPlaidPanel) return fabricCache.adiPlaidPanel;
  const pair = createCanvasPair();
  if (!pair) return { diffuse: null, bump: null };

  const { diffCanvas, diffCtx, bumpCanvas, bumpCtx } = pair;
  paintPlaidFlannelBase(diffCtx, bumpCtx, 2089);

  // Subtle vertical front placket border along left & right edges + double-needle stitching
  const placketW = 46;
  diffCtx.fillStyle = 'rgba(20, 25, 32, 0.18)';
  diffCtx.fillRect(0, 0, placketW, TEX_SIZE);
  diffCtx.fillRect(TEX_SIZE - placketW, 0, placketW, TEX_SIZE);

  diffCtx.strokeStyle = 'rgba(220, 210, 190, 0.55)';
  diffCtx.lineWidth = 2.5;
  diffCtx.setLineDash([8, 6]);
  [placketW - 6, TEX_SIZE - placketW + 6].forEach((sx) => {
    diffCtx.beginPath();
    diffCtx.moveTo(sx, 0);
    diffCtx.lineTo(sx, TEX_SIZE);
    diffCtx.stroke();

    bumpCtx.strokeStyle = '#c8c8c8';
    bumpCtx.lineWidth = 3.5;
    bumpCtx.beginPath();
    bumpCtx.moveTo(sx, 0);
    bumpCtx.lineTo(sx, TEX_SIZE);
    bumpCtx.stroke();
  });
  diffCtx.setLineDash([]);

  // Soft vertical drape folds down the unbuttoned flannel shirt front
  drawClothFolds(diffCtx, bumpCtx, [
    { x1: 165, y1: 45, cx: 185, cy: 256, x2: 155, y2: 495, width: 16, strength: 0.22 },
    { x1: 335, y1: 55, cx: 318, cy: 268, x2: 342, y2: 495, width: 14, strength: 0.2 },
  ]);

  const result = finalizeTexturePair(
    diffCanvas,
    bumpCanvas,
    THREE.RepeatWrapping,
    THREE.ClampToEdgeWrapping,
    1,
    1,
  );
  fabricCache.adiPlaidPanel = result;
  return result;
}

/**
 * 3. ADI — Distressed Charcoal-Slate Washed Denim Jeans (512x512 Diffuse + Twill Bump)
 * Matches Reference Image 1: #2d3238 charcoal denim, diagonal 3x1 twill, lighter thigh fades & whiskers,
 * double outer side-seam stitching, waistband/pocket arcs, and horizontal white-thread distressed knee rips.
 */
export function getAdiDenimJeansTextures(): ProceduralFabricTexturePair {
  if (fabricCache.adiDenimJeans) return fabricCache.adiDenimJeans;
  const pair = createCanvasPair();
  if (!pair) return { diffuse: null, bump: null };

  const { diffCanvas, diffCtx, bumpCanvas, bumpCtx } = pair;
  const rand = createHash(3041);

  // Deep dark charcoal-grey washed denim base calibrated for bright arena light (Reference Image 1)
  const baseGrad = diffCtx.createLinearGradient(0, 0, 0, TEX_SIZE);
  baseGrad.addColorStop(0, '#1c2026');
  baseGrad.addColorStop(0.38, '#262b33');
  baseGrad.addColorStop(0.68, '#20242b');
  baseGrad.addColorStop(1, '#171a20');
  diffCtx.fillStyle = baseGrad;
  diffCtx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  bumpCtx.fillStyle = '#808080';
  bumpCtx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  // Diagonal 3x1 denim twill weave across full 512x512 surface
  diffCtx.strokeStyle = 'rgba(195, 202, 214, 0.042)';
  diffCtx.lineWidth = 1.2;
  bumpCtx.strokeStyle = 'rgba(168, 168, 168, 0.42)';
  bumpCtx.lineWidth = 1.3;
  for (let i = -TEX_SIZE; i < TEX_SIZE * 2; i += 5) {
    diffCtx.beginPath();
    diffCtx.moveTo(i, 0);
    diffCtx.lineTo(i + TEX_SIZE * 0.65, TEX_SIZE);
    diffCtx.stroke();

    bumpCtx.beginPath();
    bumpCtx.moveTo(i, 0);
    bumpCtx.lineTo(i + TEX_SIZE * 0.65, TEX_SIZE);
    bumpCtx.stroke();
  }

  // Fine washed slub denim texture flecks
  for (let i = 0; i < 2600; i++) {
    const x = Math.floor(rand() * TEX_SIZE);
    const y = Math.floor(rand() * TEX_SIZE);
    const len = 3 + Math.floor(rand() * 10);
    const light = rand() > 0.52;
    diffCtx.fillStyle = light ? 'rgba(166, 174, 186, 0.055)' : 'rgba(10, 12, 16, 0.08)';
    diffCtx.fillRect(x, y, len, 1.5);
    bumpCtx.fillStyle = light ? '#949494' : '#6c6c6c';
    bumpCtx.fillRect(x, y, len, 1.5);
  }

  // Subtle washed thigh highlight centered at front (u = 0.5 -> x = 256)
  const thighFade = diffCtx.createRadialGradient(256, 230, 18, 256, 235, 160);
  thighFade.addColorStop(0, 'rgba(130, 138, 148, 0.22)');
  thighFade.addColorStop(0.55, 'rgba(104, 112, 122, 0.1)');
  thighFade.addColorStop(1, 'rgba(104, 112, 122, 0)');
  diffCtx.fillStyle = thighFade;
  diffCtx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  // Subtle upper-thigh denim whiskers
  drawClothFolds(diffCtx, bumpCtx, [
    { x1: 185, y1: 112, cx: 235, cy: 126, x2: 295, y2: 108, width: 6, strength: 0.22 },
    { x1: 192, y1: 142, cx: 245, cy: 155, x2: 312, y2: 138, width: 5, strength: 0.18 },
    { x1: 178, y1: 174, cx: 248, cy: 184, x2: 304, y2: 170, width: 5, strength: 0.15 },
  ]);

  // Waistband top stitching & curved front pocket scoop arcs
  diffCtx.strokeStyle = 'rgba(178, 162, 134, 0.5)';
  diffCtx.lineWidth = 2.5;
  diffCtx.setLineDash([7, 5]);
  diffCtx.beginPath();
  diffCtx.moveTo(0, 24);
  diffCtx.lineTo(TEX_SIZE, 24);
  diffCtx.moveTo(0, 44);
  diffCtx.lineTo(TEX_SIZE, 44);
  // Pocket curve arcs
  diffCtx.moveTo(132, 44);
  diffCtx.quadraticCurveTo(164, 108, 224, 96);
  diffCtx.moveTo(380, 44);
  diffCtx.quadraticCurveTo(348, 108, 288, 96);
  diffCtx.stroke();

  // Double outer side-seam stitching (gold/grey denim thread)
  [124, 132, 380, 388].forEach((sx) => {
    diffCtx.beginPath();
    diffCtx.moveTo(sx, 0);
    diffCtx.lineTo(sx, TEX_SIZE);
    diffCtx.stroke();

    bumpCtx.strokeStyle = '#bcbcbc';
    bumpCtx.lineWidth = 2.6;
    bumpCtx.beginPath();
    bumpCtx.moveTo(sx, 0);
    bumpCtx.lineTo(sx, TEX_SIZE);
    bumpCtx.stroke();
  });
  diffCtx.setLineDash([]);

  // Realistic horizontal white-thread distressed/ripped knee patch + subtle upper thigh distress
  const drawDenimDistress = (rx: number, ry: number, rw: number, rh: number) => {
    // Dark torn recess + faded frayed halo around rip
    const halo = diffCtx.createRadialGradient(rx, ry, rw * 0.25, rx, ry, rw * 0.85);
    halo.addColorStop(0, 'rgba(195, 198, 204, 0.34)');
    halo.addColorStop(1, 'rgba(195, 198, 204, 0)');
    diffCtx.fillStyle = halo;
    diffCtx.fillRect(rx - rw, ry - rh * 1.4, rw * 2, rh * 2.8);

    // Torn denim aperture with warm recessed shadow / subtle skin hint
    diffCtx.fillStyle = '#332924';
    diffCtx.beginPath();
    diffCtx.ellipse(rx, ry, rw * 0.52, rh * 0.52, 0, 0, Math.PI * 2);
    diffCtx.fill();

    diffCtx.fillStyle = '#a87858';
    diffCtx.beginPath();
    diffCtx.ellipse(rx, ry + 1, rw * 0.42, rh * 0.36, 0, 0, Math.PI * 2);
    diffCtx.fill();

    // Recessed bump pit for the rip
    bumpCtx.fillStyle = '#323232';
    bumpCtx.beginPath();
    bumpCtx.ellipse(rx, ry, rw * 0.52, rh * 0.52, 0, 0, Math.PI * 2);
    bumpCtx.fill();

    // Horizontal frayed off-white cotton warp threads spanning across the rip
    const rows = Math.max(4, Math.floor(rh / 5));
    for (let r = 0; r < rows; r++) {
      const ty = ry - rh * 0.42 + (r / Math.max(1, rows - 1)) * rh * 0.84;
      diffCtx.strokeStyle = r % 2 === 0 ? '#dbd8d0' : '#b7b4ac';
      diffCtx.lineWidth = 2.4;
      diffCtx.beginPath();
      diffCtx.moveTo(rx - rw * 0.54, ty);
      diffCtx.quadraticCurveTo(rx, ty + (r % 2 === 0 ? 2.5 : -2), rx + rw * 0.54, ty);
      diffCtx.stroke();

      bumpCtx.strokeStyle = '#eaeaea';
      bumpCtx.lineWidth = 2.8;
      bumpCtx.beginPath();
      bumpCtx.moveTo(rx - rw * 0.54, ty);
      bumpCtx.quadraticCurveTo(rx, ty + (r % 2 === 0 ? 2.5 : -2), rx + rw * 0.54, ty);
      bumpCtx.stroke();
    }
  };

  drawDenimDistress(256, 336, 84, 34); // Primary knee distress patch
  drawDenimDistress(244, 214, 46, 16); // Subtle upper-thigh scrape

  const result = finalizeTexturePair(
    diffCanvas,
    bumpCanvas,
    THREE.RepeatWrapping,
    THREE.ClampToEdgeWrapping,
  );
  fabricCache.adiDenimJeans = result;
  return result;
}

/**
 * 4. KRISH — Olive-Green Heavy Fleece Crew-Neck Sweatshirt (512x512 Diffuse + Fleece Bump)
 * Matches Reference Image 2: #4f5939 heavy olive fleece with micro-heather speckles,
 * soft lower-torso drape creases, shoulder seam lines, and crisp stitched triangular V-gusset.
 */
export function getKrishSweatshirtTextures(): ProceduralFabricTexturePair {
  if (fabricCache.krishSweatshirt) return fabricCache.krishSweatshirt;
  const pair = createCanvasPair();
  if (!pair) return { diffuse: null, bump: null };

  const { diffCanvas, diffCtx, bumpCanvas, bumpCtx } = pair;
  const rand = createHash(4051);

  // Heavy muted olive-sage cotton fleece base (calibrated for bright arena light, Reference Image 2)
  const grad = diffCtx.createLinearGradient(0, 0, 0, TEX_SIZE);
  grad.addColorStop(0, '#4e583a');
  grad.addColorStop(0.42, '#444d31');
  grad.addColorStop(0.84, '#394129');
  grad.addColorStop(1, '#2f3622');
  diffCtx.fillStyle = grad;
  diffCtx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  bumpCtx.fillStyle = '#808080';
  bumpCtx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  // Heavy cotton fleece micro-heather knit speckles & fine horizontal weft grain
  for (let y = 0; y < TEX_SIZE; y += 3) {
    diffCtx.fillStyle = y % 6 === 0 ? 'rgba(220, 232, 192, 0.032)' : 'rgba(18, 22, 12, 0.042)';
    diffCtx.fillRect(0, y, TEX_SIZE, 1.5);
    bumpCtx.fillStyle = y % 6 === 0 ? '#8e8e8e' : '#727272';
    bumpCtx.fillRect(0, y, TEX_SIZE, 1.5);
  }
  for (let i = 0; i < 5200; i++) {
    const x = Math.floor(rand() * TEX_SIZE);
    const y = Math.floor(rand() * TEX_SIZE);
    const r = rand();
    diffCtx.fillStyle =
      r > 0.62
        ? 'rgba(116, 130, 88, 0.16)'
        : r > 0.3
          ? 'rgba(34, 40, 22, 0.15)'
          : 'rgba(182, 192, 152, 0.08)';
    diffCtx.fillRect(x, y, 2.5, 2.2);
    bumpCtx.fillStyle = r > 0.5 ? '#969696' : '#686868';
    bumpCtx.fillRect(x, y, 2.5, 2.2);
  }

  // Subtle set-in shoulder & side seam topstitching
  diffCtx.strokeStyle = 'rgba(30, 36, 18, 0.38)';
  diffCtx.lineWidth = 3;
  diffCtx.setLineDash([7, 5]);
  [124, 388].forEach((sx) => {
    diffCtx.beginPath();
    diffCtx.moveTo(sx, 0);
    diffCtx.lineTo(sx, TEX_SIZE);
    diffCtx.stroke();

    bumpCtx.strokeStyle = '#a8a8a8';
    bumpCtx.lineWidth = 3;
    bumpCtx.beginPath();
    bumpCtx.moveTo(sx, 0);
    bumpCtx.lineTo(sx, TEX_SIZE);
    bumpCtx.stroke();
  });
  diffCtx.setLineDash([]);

  // Soft organic sweatshirt drape folds across chest & lower abdomen (subtle fleece shading, never striped)
  drawClothFolds(diffCtx, bumpCtx, [
    { x1: 162, y1: 256, cx: 242, cy: 278, x2: 332, y2: 262, width: 15, strength: 0.09 },
    { x1: 156, y1: 344, cx: 264, cy: 368, x2: 356, y2: 338, width: 17, strength: 0.12 },
    { x1: 168, y1: 410, cx: 248, cy: 428, x2: 344, y2: 404, width: 18, strength: 0.13 },
    // Soft diagonal underarm drape creases
    { x1: 144, y1: 118, cx: 186, cy: 162, x2: 212, y2: 214, width: 11, strength: 0.12 },
    { x1: 368, y1: 118, cx: 326, cy: 162, x2: 300, y2: 214, width: 11, strength: 0.12 },
  ]);

  // Iconic Stitched Triangular V-Gusset right below front crew-neck collar (centered at u=0.5 -> x=256)
  const vx = 256;
  const vTop = 18;
  const vBot = 94;
  const vHalfW = 40;

  // Slightly deeper olive ribbed V-gusset panel fill
  diffCtx.fillStyle = '#454f31';
  diffCtx.beginPath();
  diffCtx.moveTo(vx - vHalfW, vTop);
  diffCtx.lineTo(vx + vHalfW, vTop);
  diffCtx.lineTo(vx, vBot);
  diffCtx.closePath();
  diffCtx.fill();

  // Fine vertical rib lines inside the V-gusset insert
  diffCtx.save();
  diffCtx.beginPath();
  diffCtx.moveTo(vx - vHalfW, vTop);
  diffCtx.lineTo(vx + vHalfW, vTop);
  diffCtx.lineTo(vx, vBot);
  diffCtx.closePath();
  diffCtx.clip();
  for (let rx = vx - vHalfW; rx <= vx + vHalfW; rx += 5) {
    diffCtx.fillStyle = 'rgba(22, 27, 14, 0.24)';
    diffCtx.fillRect(rx, vTop, 2, vBot - vTop);
    bumpCtx.fillStyle = '#5e5e5e';
    bumpCtx.fillRect(rx, vTop, 2, vBot - vTop);
  }
  diffCtx.restore();

  // Crisp double-needle overlock stitch outlining the V-gusset triangle
  diffCtx.strokeStyle = '#29301c';
  diffCtx.lineWidth = 4.2;
  diffCtx.lineJoin = 'round';
  diffCtx.beginPath();
  diffCtx.moveTo(vx - vHalfW, vTop + 2);
  diffCtx.lineTo(vx, vBot);
  diffCtx.lineTo(vx + vHalfW, vTop + 2);
  diffCtx.stroke();

  diffCtx.strokeStyle = 'rgba(164, 178, 132, 0.42)';
  diffCtx.lineWidth = 1.8;
  diffCtx.setLineDash([5, 4]);
  diffCtx.beginPath();
  diffCtx.moveTo(vx - vHalfW + 6, vTop + 4);
  diffCtx.lineTo(vx, vBot - 7);
  diffCtx.lineTo(vx + vHalfW - 6, vTop + 4);
  diffCtx.stroke();
  diffCtx.setLineDash([]);

  // Matching V-gusset stitched ridge on bump map
  bumpCtx.strokeStyle = '#d4d4d4';
  bumpCtx.lineWidth = 5;
  bumpCtx.beginPath();
  bumpCtx.moveTo(vx - vHalfW, vTop + 2);
  bumpCtx.lineTo(vx, vBot);
  bumpCtx.lineTo(vx + vHalfW, vTop + 2);
  bumpCtx.stroke();

  // Ribbed hem transition shading along very bottom edge
  diffCtx.fillStyle = '#3e472d';
  diffCtx.fillRect(0, 466, TEX_SIZE, 46);
  for (let x = 0; x < TEX_SIZE; x += 8) {
    diffCtx.fillStyle = 'rgba(18, 22, 12, 0.34)';
    diffCtx.fillRect(x, 466, 3, 46);
    bumpCtx.fillStyle = x % 16 === 0 ? '#505050' : '#b2b2b2';
    bumpCtx.fillRect(x, 466, 3, 46);
  }

  const result = finalizeTexturePair(
    diffCanvas,
    bumpCanvas,
    THREE.RepeatWrapping,
    THREE.ClampToEdgeWrapping,
  );
  fabricCache.krishSweatshirt = result;
  return result;
}

/**
 * 5. KRISH — Ribbed Olive Knit Trim Texture (Collar, Waistband Hem & Pushed-Up Wrist Cuffs)
 */
export function getKrishRibbedTrimTextures(): ProceduralFabricTexturePair {
  if (fabricCache.krishRibbedTrim) return fabricCache.krishRibbedTrim;
  const pair = createCanvasPair();
  if (!pair) return { diffuse: null, bump: null };

  const { diffCanvas, diffCtx, bumpCanvas, bumpCtx } = pair;
  diffCtx.fillStyle = '#3f482e';
  diffCtx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  bumpCtx.fillStyle = '#808080';
  bumpCtx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  // Tactile 1x1 vertical sweatshirt rib knit channels
  for (let x = 0; x < TEX_SIZE; x += 8) {
    diffCtx.fillStyle = '#2f3721';
    diffCtx.fillRect(x, 0, 3.5, TEX_SIZE);
    diffCtx.fillStyle = 'rgba(138, 152, 108, 0.22)';
    diffCtx.fillRect(x + 4, 0, 2.5, TEX_SIZE);

    bumpCtx.fillStyle = '#3c3c3c';
    bumpCtx.fillRect(x, 0, 3.5, TEX_SIZE);
    bumpCtx.fillStyle = '#c8c8c8';
    bumpCtx.fillRect(x + 4, 0, 3.5, TEX_SIZE);
  }

  // Subtle horizontal knit loop ticks
  for (let y = 0; y < TEX_SIZE; y += 6) {
    diffCtx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    diffCtx.fillRect(0, y, TEX_SIZE, 1.5);
  }

  const result = finalizeTexturePair(
    diffCanvas,
    bumpCanvas,
    THREE.RepeatWrapping,
    THREE.RepeatWrapping,
    2.5,
    1,
  );
  fabricCache.krishRibbedTrim = result;
  return result;
}

/**
 * 6. KRISH — Heather Dark-Grey Cotton Fleece Joggers (512x512 Diffuse + Fleece Bump)
 * Matches Reference Image 2: #4a4d52 mottled heather melange knit, vertical drape folds,
 * side pocket seam lines, elastic gathered waistband, and subtle knee creasing.
 */
export function getKrishJoggersTextures(): ProceduralFabricTexturePair {
  if (fabricCache.krishJoggers) return fabricCache.krishJoggers;
  const pair = createCanvasPair();
  if (!pair) return { diffuse: null, bump: null };

  const { diffCanvas, diffCtx, bumpCanvas, bumpCtx } = pair;
  const rand = createHash(5077);

  // Heather charcoal-grey cotton fleece base (#4a4d52)
  const grad = diffCtx.createLinearGradient(0, 0, 0, TEX_SIZE);
  grad.addColorStop(0, '#44474c');
  grad.addColorStop(0.45, '#4d5056');
  grad.addColorStop(1, '#3a3d42');
  diffCtx.fillStyle = grad;
  diffCtx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  bumpCtx.fillStyle = '#808080';
  bumpCtx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  // Dense authentic heather-grey melange knit flecks (light silver-grey & deep charcoal yarns)
  for (let i = 0; i < 8200; i++) {
    const x = Math.floor(rand() * TEX_SIZE);
    const y = Math.floor(rand() * TEX_SIZE);
    const r = rand();
    const w = 2 + Math.floor(rand() * 5);
    diffCtx.fillStyle =
      r > 0.64
        ? 'rgba(176, 182, 192, 0.16)'
        : r > 0.3
          ? 'rgba(24, 26, 30, 0.18)'
          : 'rgba(130, 136, 145, 0.12)';
    diffCtx.fillRect(x, y, w, 1.8);
    bumpCtx.fillStyle = r > 0.5 ? '#969696' : '#6a6a6a';
    bumpCtx.fillRect(x, y, w, 1.8);
  }

  // Elastic gathered waistband vertical puckering at top edge
  for (let x = 0; x < TEX_SIZE; x += 14) {
    diffCtx.fillStyle = 'rgba(16, 18, 22, 0.24)';
    diffCtx.fillRect(x, 0, 4, 42);
    bumpCtx.fillStyle = '#4e4e4e';
    bumpCtx.fillRect(x, 0, 4, 42);
    bumpCtx.fillStyle = '#b4b4b4';
    bumpCtx.fillRect(x + 5, 0, 4, 42);
  }

  // Side seam lines & diagonal side-pocket welt seams
  diffCtx.strokeStyle = 'rgba(20, 22, 26, 0.52)';
  diffCtx.lineWidth = 3.2;
  [128, 384].forEach((sx) => {
    diffCtx.beginPath();
    diffCtx.moveTo(sx, 0);
    diffCtx.lineTo(sx, TEX_SIZE);
    diffCtx.stroke();

    bumpCtx.strokeStyle = '#b8b8b8';
    bumpCtx.lineWidth = 3.2;
    bumpCtx.beginPath();
    bumpCtx.moveTo(sx, 0);
    bumpCtx.lineTo(sx, TEX_SIZE);
    bumpCtx.stroke();
  });

  // Diagonal front-side pocket openings
  diffCtx.strokeStyle = 'rgba(18, 20, 24, 0.62)';
  diffCtx.lineWidth = 4;
  diffCtx.beginPath();
  diffCtx.moveTo(138, 48);
  diffCtx.lineTo(178, 144);
  diffCtx.moveTo(374, 48);
  diffCtx.lineTo(334, 144);
  diffCtx.stroke();

  // Vertical relaxed jogger drape folds & subtle knee horizontal creases
  drawClothFolds(diffCtx, bumpCtx, [
    { x1: 215, y1: 58, cx: 204, cy: 240, x2: 218, y2: 472, width: 15, strength: 0.22 },
    { x1: 296, y1: 62, cx: 306, cy: 255, x2: 292, y2: 478, width: 15, strength: 0.22 },
    { x1: 205, y1: 318, cx: 256, cy: 332, x2: 308, y2: 314, width: 10, strength: 0.2 },
    { x1: 212, y1: 356, cx: 256, cy: 368, x2: 302, y2: 354, width: 9, strength: 0.16 },
  ]);

  const result = finalizeTexturePair(
    diffCanvas,
    bumpCanvas,
    THREE.RepeatWrapping,
    THREE.ClampToEdgeWrapping,
  );
  fabricCache.krishJoggers = result;
  return result;
}

/**
 * 7. KRISH — Matte-Black Woven Ballistic Nylon Backpack & Padded Strap (512x512 Diffuse + Bump)
 */
export function getKrishBackpackTextures(): ProceduralFabricTexturePair {
  if (fabricCache.krishBackpack) return fabricCache.krishBackpack;
  const pair = createCanvasPair();
  if (!pair) return { diffuse: null, bump: null };

  const { diffCanvas, diffCtx, bumpCanvas, bumpCtx } = pair;
  diffCtx.fillStyle = '#1b1d22';
  diffCtx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  bumpCtx.fillStyle = '#808080';
  bumpCtx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  // Fine matte ballistic nylon basket-weave grid
  for (let y = 0; y < TEX_SIZE; y += 6) {
    diffCtx.fillStyle = y % 12 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.16)';
    diffCtx.fillRect(0, y, TEX_SIZE, 2);
    bumpCtx.fillStyle = y % 12 === 0 ? '#9c9c9c' : '#626262';
    bumpCtx.fillRect(0, y, TEX_SIZE, 2);
  }
  for (let x = 0; x < TEX_SIZE; x += 6) {
    diffCtx.fillStyle = x % 12 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.14)';
    diffCtx.fillRect(x, 0, 2, TEX_SIZE);
    bumpCtx.fillStyle = x % 12 === 0 ? 'rgba(176,176,176,0.5)' : 'rgba(84,84,84,0.5)';
    bumpCtx.fillRect(x, 0, 2, TEX_SIZE);
  }

  // Stitched seam piping borders
  diffCtx.strokeStyle = '#2d3038';
  diffCtx.lineWidth = 4;
  diffCtx.strokeRect(20, 20, TEX_SIZE - 40, TEX_SIZE - 40);

  const result = finalizeTexturePair(
    diffCanvas,
    bumpCanvas,
    THREE.RepeatWrapping,
    THREE.RepeatWrapping,
    1.5,
    1.5,
  );
  fabricCache.krishBackpack = result;
  return result;
}

/**
 * 8. KRISH — Dark Layered Charcoal-Grey Cloth Wristband (512x512 Diffuse + Wrap Bump)
 */
export function getKrishWristbandTextures(): ProceduralFabricTexturePair {
  if (fabricCache.krishWristband) return fabricCache.krishWristband;
  const pair = createCanvasPair();
  if (!pair) return { diffuse: null, bump: null };

  const { diffCanvas, diffCtx, bumpCanvas, bumpCtx } = pair;
  diffCtx.fillStyle = '#30333a';
  diffCtx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  bumpCtx.fillStyle = '#808080';
  bumpCtx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  // Overlapping horizontal wrapped jersey cloth folds matching Reference Image 2
  const bandStep = 64;
  for (let y = 0; y < TEX_SIZE; y += bandStep) {
    const g = diffCtx.createLinearGradient(0, y, 0, y + bandStep);
    g.addColorStop(0, '#3e424b');
    g.addColorStop(0.55, '#2d3037');
    g.addColorStop(1, '#1a1c21');
    diffCtx.fillStyle = g;
    diffCtx.fillRect(0, y, TEX_SIZE, bandStep);

    const bg = bumpCtx.createLinearGradient(0, y, 0, y + bandStep);
    bg.addColorStop(0, '#c8c8c8');
    bg.addColorStop(0.6, '#848484');
    bg.addColorStop(1, '#343434');
    bumpCtx.fillStyle = bg;
    bumpCtx.fillRect(0, y, TEX_SIZE, bandStep);
  }

  // Fine cloth knit texture overlay
  for (let x = 0; x < TEX_SIZE; x += 5) {
    diffCtx.fillStyle = 'rgba(255,255,255,0.03)';
    diffCtx.fillRect(x, 0, 1.5, TEX_SIZE);
  }

  const result = finalizeTexturePair(
    diffCanvas,
    bumpCanvas,
    THREE.RepeatWrapping,
    THREE.ClampToEdgeWrapping,
  );
  fabricCache.krishWristband = result;
  return result;
}
