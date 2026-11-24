import * as THREE from 'three';

function finalizeCanvasTexture(
  canvas: HTMLCanvasElement,
  repeatX = 1,
  repeatY = 1,
  anisotropy = 4,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createPlasterWallTexture(baseHex: string, anisotropy = 4): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle weathered Indian plaster & horizontal masonry lines
  for (let i = 0; i < 420; i++) {
    const x = (i * 53) % 256;
    const y = (i * 97) % 256;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(x, y, 8, 4);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.09)';
  ctx.fillRect(0, 212, 256, 44); // subtle street-level weathering band
  return finalizeCanvasTexture(c, 1, 1, anisotropy);
}

export function createClassroomFloorTexture(anisotropy = 4): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#d6cfc2';
  ctx.fillRect(0, 0, 512, 512);

  // Mosaic classroom terrazzo tiles
  ctx.strokeStyle = 'rgba(120, 113, 108, 0.35)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }
  for (let i = 0; i < 900; i++) {
    const x = (i * 89) % 512;
    const y = (i * 151) % 512;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(180,83,9,0.14)' : 'rgba(255,255,255,0.2)';
    ctx.fillRect(x, y, 3, 3);
  }
  return finalizeCanvasTexture(c, 4, 3, anisotropy);
}

export function createMohallaRoadTexture(anisotropy = 4): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#47433f';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 1600; i++) {
    const x = (i * 73) % 512;
    const y = (i * 139) % 512;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.14)';
    ctx.fillRect(x, y, 3, 3);
  }

  // Painted yellow street lane dashes
  ctx.fillStyle = '#EAB308';
  for (let x = 20; x < 512; x += 96) {
    ctx.fillRect(x, 248, 56, 14);
  }

  // Sidewalk terracotta curb strips
  ctx.fillStyle = '#B45309';
  ctx.fillRect(0, 0, 512, 46);
  ctx.fillStyle = '#F5F5F4';
  for (let x = 0; x < 512; x += 64) {
    ctx.fillRect(x, 42, 32, 12);
    ctx.fillStyle = '#18181B';
    ctx.fillRect(x + 32, 42, 32, 12);
    ctx.fillStyle = '#F5F5F4';
  }

  return finalizeCanvasTexture(c, 4, 2, anisotropy);
}

export function createChaiSignTexture(anisotropy = 4): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#FACC15';
  ctx.fillRect(0, 0, 512, 160);
  ctx.strokeStyle = '#DC2626';
  ctx.lineWidth = 12;
  ctx.strokeRect(8, 8, 496, 144);

  ctx.fillStyle = '#B91C1C';
  ctx.font = 'bold 42px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SHARMA CHAI TAPRI', 256, 72);

  ctx.fillStyle = '#1E293B';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('CUTTING CHAI · BUN MASKA · ₹10', 256, 122);

  return finalizeCanvasTexture(c, 1, 1, anisotropy);
}

export function createBuffetBannerTexture(anisotropy = 4): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#991B1B';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 10;
  ctx.strokeRect(6, 6, 500, 116);

  ctx.fillStyle = '#FEF08A';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SHAHI PANEER BUFFET', 256, 56);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('UNLIMITED GULAB JAMUN · NO PUSHING!', 256, 98);

  return finalizeCanvasTexture(c, 1, 1, anisotropy);
}

export function createBlackboardTexture(anisotropy = 4): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#14432a';
  ctx.fillRect(0, 0, 1024, 512);

  const grad = ctx.createRadialGradient(512, 256, 40, 512, 256, 480);
  grad.addColorStop(0, 'rgba(255,255,255,0.09)');
  grad.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 42px sans-serif';
  ctx.fillText('SUPER-3000 COACHING CENTRE', 44, 72);

  ctx.fillStyle = '#FDE047';
  ctx.font = 'bold 34px monospace';
  ctx.fillText('1) (a + b)² = a² + b² + 2ab  [V.V. IMP!]', 48, 152);
  ctx.fillText('2) F = m × DHISHUM', 48, 218);
  ctx.fillText('3) HOMEWORK = 500 QUESTIONS BY 6 AM', 48, 284);

  ctx.fillStyle = '#FCA5A5';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('NO TALKING! SHARMA JI KA BETA TOPPED AGAIN!', 48, 378);

  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(760, 320);
  ctx.lineTo(940, 320);
  ctx.lineTo(850, 150);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '26px monospace';
  ctx.fillText('θ = 90°', 805, 295);

  return finalizeCanvasTexture(c, 1, 1, anisotropy);
}

export function createExamPosterTexture(title: string, accent: string, anisotropy = 4): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 360;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#FEFCE8';
  ctx.fillRect(0, 0, 256, 360);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 256, 84);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, 128, 52);

  ctx.fillStyle = '#1E293B';
  ctx.font = 'bold 20px monospace';
  const rows = ['MON: MATHS', 'TUE: PHYSICS', 'WED: TEST', 'THU: RE-TEST', 'FRI: PTM!', 'SAT: EXTRA'];
  rows.forEach((row, idx) => {
    ctx.fillText(row, 128, 128 + idx * 36);
  });

  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 248, 352);

  return finalizeCanvasTexture(c, 1, 1, anisotropy);
}

export interface DynamicNewsScreen {
  texture: THREE.CanvasTexture;
  update: (elapsed: number, excitement: number) => void;
}

export function createDynamicNewsScreen(anisotropy = 4): DynamicNewsScreen {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  const drawStaticTop = () => {
    const bg = ctx.createLinearGradient(0, 0, 1024, 512);
    bg.addColorStop(0, '#0f172a');
    bg.addColorStop(0.5, '#1e1b4b');
    bg.addColorStop(1, '#450a0a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1024, 512);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.lineWidth = 2;
    for (let x = 0; x < 1024; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }
    for (let y = 0; y < 512; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    ctx.fillStyle = '#DC2626';
    ctx.fillRect(60, 74, 904, 134);
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(60, 208, 904, 58);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 80px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BREAKING BAKWAS', 512, 168);

    ctx.fillStyle = '#111827';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('DESI SHOWDOWN · 9 PM MAHA-DEBATE LIVE', 512, 249);
  };

  drawStaticTop();
  const texture = finalizeCanvasTexture(c, 1, 1, anisotropy);
  let lastDraw = -1;

  return {
    texture,
    update(elapsed: number, excitement: number) {
      // Update equalizer bars at ~12 Hz so it looks lively with minimal CPU cost
      if (elapsed - lastDraw < 0.085) return;
      lastDraw = elapsed;

      ctx.fillStyle = '#111632';
      ctx.fillRect(90, 300, 844, 180);

      const boost = 1 + Math.min(0.65, excitement * 0.55);
      for (let i = 0; i < 12; i++) {
        const wave = (Math.sin(elapsed * 5.2 + i * 0.85) * 0.5 + 0.5) * 110 * boost;
        const h = Math.min(165, Math.max(22, 28 + wave));
        ctx.fillStyle = i % 2 === 0 ? '#38BDF8' : '#F43F5E';
        ctx.fillRect(110 + i * 68, 470 - h, 44, h);
        ctx.fillStyle = '#FDE047';
        ctx.fillRect(110 + i * 68, 462 - h, 44, 8);
      }
      texture.needsUpdate = true;
    },
  };
}

export function createStudioFloorTexture(anisotropy = 4): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(256, 256, 210, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(256, 256, 140, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(256, 256, 75, 0, Math.PI * 2);
  ctx.stroke();

  return finalizeCanvasTexture(c, 1, 1, anisotropy);
}

export function createShaadiCarpetTexture(anisotropy = 4): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#991B1B';
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 18;
  ctx.strokeRect(18, 18, 476, 476);

  ctx.strokeStyle = 'rgba(250, 204, 21, 0.35)';
  ctx.lineWidth = 4;
  for (let y = 64; y < 480; y += 96) {
    for (let x = 64; x < 480; x += 96) {
      ctx.beginPath();
      ctx.moveTo(x, y - 24);
      ctx.lineTo(x + 24, y);
      ctx.lineTo(x, y + 24);
      ctx.lineTo(x - 24, y);
      ctx.closePath();
      ctx.stroke();
    }
  }

  return finalizeCanvasTexture(c, 3, 2, anisotropy);
}

export function createRailwayPlatformTexture(anisotropy = 4): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#64748b';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 800; i++) {
    const x = (i * 67) % 512;
    const y = (i * 123) % 512;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)';
    ctx.fillRect(x, y, 4, 4);
  }

  ctx.strokeStyle = 'rgba(15, 23, 42, 0.25)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  ctx.fillStyle = '#FACC15';
  ctx.fillRect(0, 24, 512, 42);
  ctx.fillStyle = '#1E293B';
  for (let x = 0; x < 512; x += 48) {
    ctx.fillRect(x, 24, 16, 42);
  }

  return finalizeCanvasTexture(c, 4, 1, anisotropy);
}

export function createStationBoardTexture(anisotropy = 4): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#FACC15';
  ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = '#1D4ED8';
  ctx.fillRect(0, 0, 1024, 44);
  ctx.fillRect(0, 212, 1024, 44);

  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 1014, 246);

  ctx.fillStyle = '#0F172A';
  ctx.font = '900 76px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BAKWAS JUNCTION', 512, 134);

  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('PLATFORM NO. 9¾  ·  CHAI-SAMOSA EXPRESS', 512, 188);

  return finalizeCanvasTexture(c, 1, 1, anisotropy);
}
