import * as THREE from 'three';
import type { FaceExpression, FighterId } from '../types';
import { FIGHTER_CONFIGS } from './configs';

export interface DynamicFace {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  lastExpression: FaceExpression | null;
  lastCrackLevel: number;
  update: (expression: FaceExpression, crackLevel?: number) => void;
  dispose: () => void;
}


function paintWhiteLionFace(
  ctx: CanvasRenderingContext2D,
  expression: FaceExpression,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const cx = w * 0.5;
  const cy = h * 0.52;

  // Soft off-white lion fur base (#F4EFE6) matching 3D muzzle & paws
  ctx.fillStyle = '#F4EFE6';
  ctx.fillRect(0, 0, w, h);

  // Sculpted warm cheek & crown shading (no blown-out pure white)
  const grad = ctx.createRadialGradient(cx, cy - h * 0.04, w * 0.06, cx, cy, w * 0.62);
  grad.addColorStop(0, '#F7F2EA');
  grad.addColorStop(0.62, '#EFE7D9');
  grad.addColorStop(1, '#CFC2AA');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle fur-tuft strokes along brow & cheekbones
  ctx.strokeStyle = 'rgba(130, 114, 92, 0.55)';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * 16, cy - h * 0.27);
    ctx.lineTo(cx + i * 18, cy - h * 0.21);
    ctx.stroke();
  }

  // Defined muzzle cheek pad shading
  ctx.fillStyle = '#F8F4EC';
  ctx.beginPath();
  ctx.ellipse(cx - 21, cy + 20, 27, 20, -0.12, 0, Math.PI * 2);
  ctx.ellipse(cx + 21, cy + 20, 27, 20, 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(110, 96, 78, 0.65)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Confident lion eyes (partially peeking behind/under aviator shades)
  const eyeOffsetX = w * 0.095;
  const eyeY = cy - h * 0.055;
  if (expression === 'ko') {
    ctx.strokeStyle = '#140D0B';
    ctx.lineWidth = 7;
    [-1, 1].forEach((side) => {
      const ex = cx + side * eyeOffsetX;
      ctx.beginPath();
      ctx.moveTo(ex - 11, eyeY - 11);
      ctx.lineTo(ex + 11, eyeY + 11);
      ctx.moveTo(ex + 11, eyeY - 11);
      ctx.lineTo(ex - 11, eyeY + 11);
      ctx.stroke();
    });
  } else {
    [-1, 1].forEach((side) => {
      const ex = cx + side * eyeOffsetX;
      ctx.fillStyle = '#FEF3C7';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 13, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#140D0B';
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.fillStyle = '#140D0B';
      ctx.beginPath();
      ctx.arc(ex, eyeY, 5.8, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Darker, crisp stern lion brows (instantly readable above aviator rims)
  ctx.strokeStyle = '#4B3F33';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  const browTilt =
    expression === 'attack' || expression === 'block'
      ? 11
      : expression === 'hit' || expression === 'ko'
        ? -7
        : 7;
  [-1, 1].forEach((side) => {
    const ex = cx + side * eyeOffsetX;
    ctx.beginPath();
    ctx.moveTo(ex - side * 18, eyeY - 22 - browTilt * 0.25);
    ctx.lineTo(ex + side * 14, eyeY - 22 + browTilt);
    ctx.stroke();
  });

  // Lion Nose: darker bold outline with rich pinkish-brown tip for fighting-camera clarity
  const noseY = cy + 6;
  ctx.fillStyle = '#9C5249';
  ctx.strokeStyle = '#140D0B';
  ctx.lineWidth = 5.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 18, noseY - 7);
  ctx.quadraticCurveTo(cx, noseY - 13, cx + 18, noseY - 7);
  ctx.quadraticCurveTo(cx + 15, noseY + 7, cx, noseY + 15);
  ctx.quadraticCurveTo(cx - 15, noseY + 7, cx - 18, noseY - 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Subtle nose bridge shine
  ctx.fillStyle = 'rgba(255, 232, 224, 0.35)';
  ctx.beginPath();
  ctx.ellipse(cx - 4, noseY - 4, 5, 2.4, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Bold dark philtrum line down to mouth
  ctx.strokeStyle = '#140D0B';
  ctx.lineWidth = 5.5;
  ctx.beginPath();
  ctx.moveTo(cx, noseY + 15);
  ctx.lineTo(cx, noseY + 27);
  ctx.stroke();

  // Darker, sharper Whisker Dots on both sides of muzzle
  ctx.fillStyle = '#1B1410';
  [-1, 1].forEach((side) => {
    const dots: Array<[number, number]> = [
      [cx + side * 20, noseY + 14],
      [cx + side * 31, noseY + 12],
      [cx + side * 24, noseY + 22],
      [cx + side * 35, noseY + 21],
    ];
    for (const [dx, dy] of dots) {
      ctx.beginPath();
      ctx.arc(dx, dy, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Darker Stern Boss Mouth lines for instant readability from fighting camera
  const mouthY = noseY + 29;
  ctx.strokeStyle = '#140D0B';
  ctx.lineWidth = 5.8;
  ctx.lineCap = 'round';
  if (expression === 'attack') {
    // Roaring boss mouth with fangs
    ctx.fillStyle = '#6B1414';
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + 6, 23, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(cx - 14, mouthY - 5);
    ctx.lineTo(cx - 9, mouthY + 6);
    ctx.lineTo(cx - 4, mouthY - 6);
    ctx.moveTo(cx + 14, mouthY - 5);
    ctx.lineTo(cx + 9, mouthY + 6);
    ctx.lineTo(cx + 4, mouthY - 6);
    ctx.fill();
  } else if (expression === 'hit') {
    ctx.fillStyle = '#6B1414';
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + 5, 14, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (expression === 'ko') {
    ctx.beginPath();
    ctx.moveTo(cx - 21, mouthY + 5);
    ctx.quadraticCurveTo(cx - 8, mouthY - 6, cx, mouthY + 5);
    ctx.quadraticCurveTo(cx + 8, mouthY + 15, cx + 21, mouthY + 3);
    ctx.stroke();
  } else if (expression === 'block') {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(cx - 21, mouthY - 3, 42, 13, 4);
    ctx.fill();
    ctx.stroke();
  } else if (expression === 'victory') {
    ctx.beginPath();
    ctx.moveTo(cx - 21, mouthY + 3);
    ctx.quadraticCurveTo(cx, mouthY - 3, cx + 23, mouthY - 4);
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(cx + 11, mouthY - 2);
    ctx.lineTo(cx + 14, mouthY + 6);
    ctx.lineTo(cx + 17, mouthY - 3);
    ctx.closePath();
    ctx.fill();
  } else {
    // Bold serious feline boss mouth
    ctx.beginPath();
    ctx.moveTo(cx - 23, mouthY + 4);
    ctx.quadraticCurveTo(cx - 10, mouthY - 4, cx, mouthY - 1);
    ctx.quadraticCurveTo(cx + 10, mouthY - 4, cx + 23, mouthY + 3);
    ctx.stroke();
  }
}

function paintBlueBillaFace(
  ctx: CanvasRenderingContext2D,
  expression: FaceExpression,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const cx = w * 0.5;
  const cy = h * 0.52;

  // Matte sky-blue cat fur base (#55BCE8) matching 3D head & flared cheeks
  ctx.fillStyle = '#55BCE8';
  ctx.fillRect(0, 0, w, h);

  // Soft cheek & forehead shading for crisp vinyl-cartoon volume
  const grad = ctx.createRadialGradient(cx, cy - h * 0.05, w * 0.08, cx, cy, w * 0.62);
  grad.addColorStop(0, '#6BC9F0');
  grad.addColorStop(0.65, '#55BCE8');
  grad.addColorStop(1, '#3A9AC6');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle lighter snout-cheek highlight below where the 3D red jellybean nose sits
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 20, w * 0.24, h * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();

  // Startled cartoon sweat drop on hit/ko
  if (expression === 'hit' || expression === 'ko') {
    ctx.fillStyle = '#E0F2FE';
    ctx.strokeStyle = '#0369A1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + 58, cy - 36);
    ctx.quadraticCurveTo(cx + 70, cy - 16, cx + 58, cy - 10);
    ctx.quadraticCurveTo(cx + 46, cy - 16, cx + 58, cy - 36);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Cheek smile-dimple creases framing the wide mouth
  ctx.strokeStyle = '#1E4E6E';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.arc(cx + side * 52, cy + 32, 12, side === -1 ? 0.65 * Math.PI : -0.15 * Math.PI, side === -1 ? 1.15 * Math.PI : 0.35 * Math.PI);
    ctx.stroke();
  });

  // Wide Cheeky Open Grin / Goofy Expressions on Lower Face
  const mouthY = cy + 30;
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 5.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (expression === 'hit') {
    // Funny startled wide-open panic scream mouth!
    ctx.fillStyle = '#4A1259';
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + 12, 30, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Panic uvula / wavy lavender tongue
    ctx.fillStyle = '#F29EDB';
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + 26, 17, 10, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Two tiny panicked upper fangs
    ctx.fillStyle = '#FFFFFF';
    [-16, 16].forEach((fx) => {
      ctx.beginPath();
      ctx.moveTo(cx + fx - 5, mouthY - 10);
      ctx.lineTo(cx + fx, mouthY + 1);
      ctx.lineTo(cx + fx + 5, mouthY - 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
  } else if (expression === 'ko') {
    // Hilarious dizzy wavy mouth with goofy lavender-pink tongue hanging out sideways
    ctx.beginPath();
    ctx.moveTo(cx - 38, mouthY + 8);
    ctx.quadraticCurveTo(cx - 18, mouthY - 6, cx, mouthY + 8);
    ctx.quadraticCurveTo(cx + 18, mouthY + 20, cx + 38, mouthY + 6);
    ctx.stroke();

    // Floppy tongue sticking out right side
    ctx.fillStyle = '#F29EDB';
    ctx.beginPath();
    ctx.ellipse(cx + 20, mouthY + 22, 13, 18, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 18, mouthY + 11);
    ctx.lineTo(cx + 22, mouthY + 27);
    ctx.stroke();
  } else if (expression === 'block') {
    // Scrunched clenched teeth grimace
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(cx - 34, mouthY - 2, 68, 20, 8);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 34, mouthY + 8);
    ctx.lineTo(cx + 34, mouthY + 8);
    for (let x = -18; x <= 18; x += 12) {
      ctx.moveTo(cx + x, mouthY - 2);
      ctx.lineTo(cx + x, mouthY + 18);
    }
    ctx.stroke();
  } else if (expression === 'attack') {
    // Wild manic open battle grin with bigger fangs & purple mouth
    ctx.fillStyle = '#4A1259';
    ctx.beginPath();
    ctx.moveTo(cx - 48, mouthY - 2);
    ctx.quadraticCurveTo(cx, mouthY + 10, cx + 48, mouthY - 2);
    ctx.quadraticCurveTo(cx + 38, mouthY + 42, cx, mouthY + 42);
    ctx.quadraticCurveTo(cx - 38, mouthY + 42, cx - 48, mouthY - 2);
    ctx.closePath();
    ctx.fill();

    // Playful lavender-pink tongue
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#F29EDB';
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + 38, 28, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#9D174D';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 5.5;
    ctx.stroke();

    // Two sharp tiny white cartoon fangs
    ctx.fillStyle = '#FFFFFF';
    [-26, 26].forEach((fx) => {
      ctx.beginPath();
      ctx.moveTo(cx + fx - 7, mouthY + 2);
      ctx.lineTo(cx + fx, mouthY + 16);
      ctx.lineTo(cx + fx + 7, mouthY + 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
  } else {
    // Signature wide cheeky open grin (idle / walk / victory): dark purple mouth, 2 tiny white fangs, lavender-pink tongue
    const extraOpen = expression === 'victory' ? 8 : 0;
    ctx.fillStyle = '#4A1259';
    ctx.beginPath();
    ctx.moveTo(cx - 46, mouthY - 2);
    ctx.quadraticCurveTo(cx, mouthY + 9, cx + 46, mouthY - 2);
    ctx.quadraticCurveTo(cx + 36, mouthY + 34 + extraOpen, cx, mouthY + 36 + extraOpen);
    ctx.quadraticCurveTo(cx - 36, mouthY + 34 + extraOpen, cx - 46, mouthY - 2);
    ctx.closePath();
    ctx.fill();

    // Playful lavender-pink tongue tucked inside bottom of grin
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#F29EDB';
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + 32 + extraOpen * 0.8, 26, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#9D174D';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Crisp outer mouth outline
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 5.5;
    ctx.stroke();

    // Two tiny white fangs peeking from upper lip
    ctx.fillStyle = '#FFFFFF';
    ctx.lineWidth = 3.2;
    [-24, 24].forEach((fx) => {
      ctx.beginPath();
      ctx.moveTo(cx + fx - 6, mouthY + 2);
      ctx.lineTo(cx + fx, mouthY + 13);
      ctx.lineTo(cx + fx + 6, mouthY + 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
  }
}

function paintNetaFace(
  ctx: CanvasRenderingContext2D,
  expression: FaceExpression,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const cx = w * 0.5;
  const cy = h * 0.52;

  // Warm medium-brown matte skin base (#B87D56)
  ctx.fillStyle = '#B87D56';
  ctx.fillRect(0, 0, w, h);

  // Soft natural facial contour shading
  const grad = ctx.createRadialGradient(cx, cy - h * 0.04, w * 0.06, cx, cy, w * 0.62);
  grad.addColorStop(0, '#C58B64');
  grad.addColorStop(0.65, '#B87D56');
  grad.addColorStop(1, '#8C5838');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle salt-and-pepper sideburn fade framing temples
  ctx.fillStyle = 'rgba(85, 89, 94, 0.45)';
  ctx.fillRect(cx - 88, cy - 42, 16, 46);
  ctx.fillRect(cx + 72, cy - 42, 16, 46);

  // Soft warm cheek tone
  ctx.fillStyle = 'rgba(165, 72, 54, 0.16)';
  ctx.beginPath();
  ctx.ellipse(cx - 38, cy + 16, 15, 9, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 38, cy + 16, 15, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Subtle forehead worry/determination lines
  ctx.strokeStyle = 'rgba(92, 52, 28, 0.42)';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy - 44);
  ctx.quadraticCurveTo(cx, cy - 47, cx + 24, cy - 44);
  ctx.moveTo(cx - 18, cy - 37);
  ctx.quadraticCurveTo(cx, cy - 39, cx + 18, cy - 37);
  ctx.stroke();

  // Expressive Eyes (humble, slightly tired lower-lid crease)
  const eyeOffsetX = w * 0.095;
  const eyeY = cy - h * 0.045;

  // Light under-eye tiredness crease
  ctx.strokeStyle = 'rgba(92, 52, 28, 0.48)';
  ctx.lineWidth = 2.5;
  [-1, 1].forEach((side) => {
    const ex = cx + side * eyeOffsetX;
    ctx.beginPath();
    ctx.arc(ex, eyeY + 4, 15, 0.18 * Math.PI, 0.82 * Math.PI);
    ctx.stroke();
  });

  if (expression === 'ko') {
    ctx.strokeStyle = '#18181B';
    ctx.lineWidth = 6.5;
    ctx.lineCap = 'round';
    [-1, 1].forEach((side) => {
      const ex = cx + side * eyeOffsetX;
      ctx.beginPath();
      ctx.moveTo(ex - 11, eyeY - 11);
      ctx.lineTo(ex + 11, eyeY + 11);
      ctx.moveTo(ex + 11, eyeY - 11);
      ctx.lineTo(ex - 11, eyeY + 11);
      ctx.stroke();
    });
  } else if (expression === 'hit') {
    // Wide shocked eyes behind spectacles!
    [-1, 1].forEach((side) => {
      const ex = cx + side * eyeOffsetX;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 15, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#18181B';
      ctx.lineWidth = 3.8;
      ctx.stroke();
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(ex, eyeY, 4.5, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (expression === 'victory') {
    // Warm joyful curved ^ ^ eyes
    ctx.strokeStyle = '#18181B';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    [-1, 1].forEach((side) => {
      const ex = cx + side * eyeOffsetX;
      ctx.beginPath();
      ctx.arc(ex, eyeY + 6, 14, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
    });
  } else {
    [-1, 1].forEach((side) => {
      const ex = cx + side * eyeOffsetX;
      ctx.fillStyle = '#FFFDF9';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 13.5, expression === 'attack' ? 11.5 : 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1F2937';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Subtle relaxed upper eyelid droop for humble tired look in idle
      if (expression === 'idle') {
        ctx.fillStyle = '#A86D48';
        ctx.beginPath();
        ctx.ellipse(ex, eyeY - 10, 14, 5.5, 0, 0, Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#2B1B12';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(ex - 13, eyeY - 7);
        ctx.quadraticCurveTo(ex, eyeY - 4, ex + 13, eyeY - 7);
        ctx.stroke();
      }

      const pupilY = expression === 'attack' ? eyeY - 1 : eyeY + 1;
      ctx.fillStyle = '#18110D';
      ctx.beginPath();
      ctx.arc(ex + side * 1.2, pupilY, 6.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ex + side * 1.2 - 2.4, pupilY - 2.5, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Expressive Salt-and-Pepper Eyebrows
  ctx.lineCap = 'round';
  const browTilt =
    expression === 'attack' || expression === 'block'
      ? 11
      : expression === 'hit' || expression === 'ko'
        ? -10
        : 3;
  const browLift = expression === 'hit' ? -7 : 0;
  [-1, 1].forEach((side) => {
    const ex = cx + side * eyeOffsetX;
    ctx.strokeStyle = '#3F4348';
    ctx.lineWidth = 7.5;
    ctx.beginPath();
    ctx.moveTo(ex - side * 16, eyeY - 21 + browLift - browTilt * 0.25);
    ctx.lineTo(ex + side * 14, eyeY - 21 + browLift + browTilt);
    ctx.stroke();
    // Subtle grey salt-and-pepper highlight streak inside brow
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(ex - side * 12, eyeY - 22 + browLift - browTilt * 0.2);
    ctx.lineTo(ex + side * 6, eyeY - 21 + browLift + browTilt * 0.55);
    ctx.stroke();
  });

  // Gentle nose contour shading
  ctx.strokeStyle = 'rgba(92, 52, 28, 0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 7, cy + 12);
  ctx.quadraticCurveTo(cx, cy + 16, cx + 7, cy + 12);
  ctx.stroke();

  // Light laugh lines (nasolabial folds) framing the humble smile
  ctx.strokeStyle = 'rgba(92, 52, 28, 0.55)';
  ctx.lineWidth = 3;
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.moveTo(cx + side * 20, cy + 14);
    ctx.quadraticCurveTo(cx + side * 31, cy + 26, cx + side * 27, cy + 40);
    ctx.stroke();
  });

  // Mouth based on expression
  const mouthY = cy + 31;
  ctx.strokeStyle = '#26140C';
  ctx.lineWidth = 4.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (expression === 'attack') {
    // Passionate rally shout!
    ctx.fillStyle = '#6B1818';
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + 4, 21, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(cx - 13, mouthY - 8, 26, 6);
  } else if (expression === 'hit') {
    // Shocked open O mouth
    ctx.fillStyle = '#6B1818';
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + 5, 14, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (expression === 'ko') {
    // Wavy dizzy mouth
    ctx.beginPath();
    ctx.moveTo(cx - 21, mouthY + 4);
    ctx.quadraticCurveTo(cx - 9, mouthY - 7, cx, mouthY + 4);
    ctx.quadraticCurveTo(cx + 9, mouthY + 14, cx + 21, mouthY + 2);
    ctx.stroke();
  } else if (expression === 'block') {
    // Determined gritted teeth during dharna / block
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.roundRect(cx - 20, mouthY - 5, 40, 13, 5);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 20, mouthY + 1.5);
    ctx.lineTo(cx + 20, mouthY + 1.5);
    ctx.stroke();
  } else if (expression === 'victory') {
    // Warm beaming grassroots smile
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.arc(cx, mouthY - 3, 22, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // Humble, warm yet determined desi neta smile
    ctx.beginPath();
    ctx.moveTo(cx - 20, mouthY);
    ctx.quadraticCurveTo(cx, mouthY + 13, cx + 21, mouthY - 1);
    ctx.stroke();
    // Subtle lower lip shadow
    ctx.strokeStyle = 'rgba(92, 52, 28, 0.45)';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(cx - 9, mouthY + 11);
    ctx.quadraticCurveTo(cx, mouthY + 14, cx + 9, mouthY + 11);
    ctx.stroke();
  }
}

function drawAndaEggCracks(
  ctx: CanvasRenderingContext2D,
  crackLevel: number,
  w: number,
  h: number,
): void {
  if (crackLevel <= 0) return;

  const drawJaggedPath = (pts: Array<[number, number]>, width: number) => {
    // Subtle pale eggshell fracture highlight alongside the dark crack
    ctx.strokeStyle = 'rgba(255, 244, 230, 0.72)';
    ctx.lineWidth = width + 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    pts.forEach(([px, py], i) => {
      if (i === 0) ctx.moveTo(px + 1.5, py + 1.5);
      else ctx.lineTo(px + 1.5, py + 1.5);
    });
    ctx.stroke();

    // Razor-sharp dark jagged crack line
    ctx.strokeStyle = '#261710';
    ctx.lineWidth = width;
    ctx.beginPath();
    pts.forEach(([px, py], i) => {
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  };

  // Level 1 (< 70% HP): Sharp forehead hairline fracture + side branch
  drawJaggedPath(
    [
      [w * 0.41, h * 0.14],
      [w * 0.445, h * 0.2],
      [w * 0.425, h * 0.25],
      [w * 0.46, h * 0.295],
    ],
    4.2,
  );
  drawJaggedPath(
    [
      [w * 0.445, h * 0.2],
      [w * 0.49, h * 0.225],
      [w * 0.51, h * 0.255],
    ],
    2.8,
  );

  // Level 2 (< 40% HP): Spreading cracks across cheek & right side of eggshell
  if (crackLevel >= 2) {
    drawJaggedPath(
      [
        [w * 0.61, h * 0.17],
        [w * 0.585, h * 0.24],
        [w * 0.625, h * 0.3],
        [w * 0.59, h * 0.365],
        [w * 0.635, h * 0.43],
      ],
      4.5,
    );
    drawJaggedPath(
      [
        [w * 0.625, h * 0.3],
        [w * 0.675, h * 0.325],
        [w * 0.705, h * 0.37],
      ],
      3.0,
    );
    drawJaggedPath(
      [
        [w * 0.35, h * 0.34],
        [w * 0.385, h * 0.41],
        [w * 0.365, h * 0.475],
      ],
      3.4,
    );
  }

  // Level 3 (< 20% HP): Dramatic spiderweb shatter fractures across entire peach eggshell!
  if (crackLevel >= 3) {
    drawJaggedPath(
      [
        [w * 0.46, h * 0.295],
        [w * 0.495, h * 0.35],
        [w * 0.535, h * 0.335],
        [w * 0.585, h * 0.24],
      ],
      4.4,
    );
    drawJaggedPath(
      [
        [w * 0.59, h * 0.365],
        [w * 0.555, h * 0.445],
        [w * 0.58, h * 0.52],
        [w * 0.54, h * 0.56],
      ],
      4.0,
    );
    drawJaggedPath(
      [
        [w * 0.28, h * 0.24],
        [w * 0.33, h * 0.29],
        [w * 0.31, h * 0.37],
        [w * 0.365, h * 0.475],
        [w * 0.39, h * 0.545],
      ],
      3.6,
    );
    drawJaggedPath(
      [
        [w * 0.68, h * 0.22],
        [w * 0.73, h * 0.29],
        [w * 0.71, h * 0.37],
        [w * 0.75, h * 0.45],
      ],
      3.4,
    );
  }
}

function paintAndaEggFace(
  ctx: CanvasRenderingContext2D,
  expression: FaceExpression,
  crackLevel: number,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const cx = w * 0.5;

  // === 1. WARM PEACH-TAN EGGSHELL UPPER BODY (#F5C69A, NOT plain white) ===
  const shellGrad = ctx.createLinearGradient(0, 0, 0, h * 0.62);
  shellGrad.addColorStop(0, '#F8CFA8'); // Warm creamy peach highlight near pointed top
  shellGrad.addColorStop(0.45, '#F2BB8B'); // Rich warm peach-tan eggshell under bright stage lighting
  shellGrad.addColorStop(1, '#DC9F6E'); // Warm tan shadow toward white folded collar seam
  ctx.fillStyle = shellGrad;
  ctx.fillRect(0, 0, w, h * 0.62);

  // Soft warm highlight halo on the front upper face
  const faceGlow = ctx.createRadialGradient(
    cx - w * 0.03,
    h * 0.26,
    w * 0.02,
    cx,
    h * 0.34,
    w * 0.24,
  );
  faceGlow.addColorStop(0, 'rgba(255, 240, 224, 0.24)');
  faceGlow.addColorStop(1, 'rgba(242, 187, 139, 0)');
  ctx.fillStyle = faceGlow;
  ctx.fillRect(0, 0, w, h * 0.62);

  // Subtle organic eggshell freckles & tiny warm tan speckles across the shell
  const speckles: Array<[number, number, number, number]> = [
    [0.14, 0.22, 3.2, 0.26],
    [0.21, 0.36, 2.5, 0.22],
    [0.27, 0.18, 2.8, 0.24],
    [0.32, 0.44, 2.6, 0.25],
    [0.37, 0.26, 2.2, 0.2],
    [0.38, 0.47, 2.4, 0.28],
    [0.41, 0.45, 1.9, 0.26],
    [0.43, 0.19, 2.5, 0.2],
    [0.57, 0.21, 2.4, 0.2],
    [0.59, 0.46, 2.2, 0.26],
    [0.62, 0.48, 2.5, 0.28],
    [0.65, 0.29, 2.6, 0.22],
    [0.72, 0.41, 3.0, 0.24],
    [0.79, 0.25, 2.7, 0.22],
    [0.86, 0.35, 3.1, 0.25],
    [0.92, 0.21, 2.4, 0.2],
    [0.08, 0.44, 2.9, 0.22],
    [0.48, 0.15, 2.3, 0.18],
    [0.53, 0.12, 2.0, 0.18],
    [0.69, 0.51, 2.6, 0.22],
    [0.3, 0.52, 2.5, 0.22],
  ];
  for (const [sx, sy, r, alpha] of speckles) {
    ctx.fillStyle = `rgba(176, 114, 68, ${alpha})`;
    ctx.beginPath();
    ctx.arc(sx * w, sy * h, r * (w / 512), 0, Math.PI * 2);
    ctx.fill();
  }

  // === 2. BRIGHT RED VEST WRAPPING LOWER HALF OF EGG (#D92323) ===
  const vestTopY = h * 0.58;
  const vestGrad = ctx.createLinearGradient(0, vestTopY, 0, h);
  vestGrad.addColorStop(0, '#E32B2B');
  vestGrad.addColorStop(0.55, '#D92323');
  vestGrad.addColorStop(1, '#A61717');
  ctx.fillStyle = vestGrad;
  ctx.fillRect(0, vestTopY, w, h - vestTopY);

  // Crisp subtle front vest center placket seam
  ctx.strokeStyle = '#8F1212';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx, vestTopY);
  ctx.lineTo(cx, h);
  ctx.stroke();

  // Dark Navy-Blue Vertical Suspenders painted cleanly down the front of the red vest (#1B3B6F)
  const suspW = w * 0.036;
  [-1, 1].forEach((side) => {
    const sx = cx + side * w * 0.088 - suspW * 0.5;
    ctx.fillStyle = '#1B3B6F';
    ctx.fillRect(sx, vestTopY, suspW, h - vestTopY);
    ctx.strokeStyle = '#0F2244';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(sx, vestTopY, suspW, h - vestTopY);

    // Subtle light navy highlight stitch along suspender center
    ctx.strokeStyle = 'rgba(147, 197, 253, 0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.moveTo(sx + suspW * 0.5, vestTopY + 10);
    ctx.lineTo(sx + suspW * 0.5, h - 10);
    ctx.stroke();
    ctx.setLineDash([]);

    // Small brass suspender adjuster buckle
    ctx.fillStyle = '#FACC15';
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 2;
    ctx.fillRect(sx - 2, vestTopY + h * 0.09, suspW + 4, 14);
    ctx.strokeRect(sx - 2, vestTopY + h * 0.09, suspW + 4, 14);
  });

  // Clean dark red vest waist trim along the top seam (sits right beneath 3D white collar)
  ctx.fillStyle = '#991B1B';
  ctx.fillRect(0, vestTopY - 3, w, 7);

  // === 3. ROSY CHEEK HIGHLIGHTS ===
  const cheekY = h * 0.435;
  [-1, 1].forEach((side) => {
    const chX = cx + side * w * 0.092;
    const chGrad = ctx.createRadialGradient(chX, cheekY, 2, chX, cheekY, w * 0.042);
    chGrad.addColorStop(0, 'rgba(239, 68, 68, 0.42)');
    chGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = chGrad;
    ctx.beginPath();
    ctx.ellipse(chX, cheekY, w * 0.044, h * 0.028, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // === 4. BIG, WIDE, GOOFY WHITE-AND-BLUE CARTOON EYES ===
  const eyeOffsetX = w * 0.056;
  const eyeY = h * 0.35;
  const eyeRx = w * 0.042;
  const eyeRy = h * 0.054;

  if (expression === 'ko') {
    // Huge panicked dizzy spiral / X cartoon eyes!
    [-1, 1].forEach((side) => {
      const ex = cx + side * eyeOffsetX;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeRx * 1.1, eyeRy * 1.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#18181B';
      ctx.lineWidth = 5;
      ctx.stroke();

      ctx.strokeStyle = '#1E3A8A';
      ctx.lineWidth = 5.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex - 11, eyeY - 12);
      ctx.lineTo(ex + 11, eyeY + 12);
      ctx.moveTo(ex + 11, eyeY - 12);
      ctx.lineTo(ex - 11, eyeY + 12);
      ctx.stroke();
    });
  } else if (expression === 'victory') {
    // Cheerful curved ^ ^ joyful cartoon eyes!
    ctx.strokeStyle = '#18181B';
    ctx.lineWidth = 7.5;
    ctx.lineCap = 'round';
    [-1, 1].forEach((side) => {
      const ex = cx + side * eyeOffsetX;
      ctx.beginPath();
      ctx.arc(ex, eyeY + 10, 19, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
    });
  } else {
    const isHit = expression === 'hit';
    const isBlock = expression === 'block';
    const isAttack = expression === 'attack';

    [-1, 1].forEach((side) => {
      const ex = cx + side * eyeOffsetX;
      const rx = isHit ? eyeRx * 1.18 : eyeRx;
      const ry = isHit ? eyeRy * 1.18 : isBlock ? eyeRy * 0.55 : eyeRy;

      // Crisp white cartoon sclera
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 4.5;
      ctx.stroke();

      // Vivid cartoon blue iris!
      const irisR = isHit ? w * 0.017 : w * 0.025;
      const irisX = ex - side * (isAttack ? 1.5 : 3.2); // Slightly goofy inward charm!
      const irisY = eyeY + (isAttack ? 2 : 1);

      const irisGrad = ctx.createRadialGradient(irisX, irisY - 3, 2, irisX, irisY, irisR);
      irisGrad.addColorStop(0, '#60A5FA');
      irisGrad.addColorStop(0.6, '#2563EB');
      irisGrad.addColorStop(1, '#1E3A8A');
      ctx.fillStyle = irisGrad;
      ctx.beginPath();
      ctx.arc(irisX, irisY, irisR, 0, Math.PI * 2);
      ctx.fill();

      // Jet-black pupil
      const pupilR = isHit ? irisR * 0.48 : irisR * 0.56;
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(irisX, irisY, pupilR, 0, Math.PI * 2);
      ctx.fill();

      // Bright glossy cartoon eye catchlight
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(irisX - irisR * 0.35, irisY - irisR * 0.38, irisR * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(irisX + irisR * 0.25, irisY + irisR * 0.3, irisR * 0.14, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // === 5. ARCHED EXPRESSIVE DARK EYEBROWS ===
  const browY = eyeY - eyeRy - h * 0.024;
  ctx.strokeStyle = '#271A14';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  [-1, 1].forEach((side) => {
    const bx = cx + side * eyeOffsetX;
    ctx.beginPath();
    if (expression === 'attack') {
      // Cheeky determined inward-angled brows
      ctx.moveTo(bx - side * 19, browY + 8);
      ctx.quadraticCurveTo(bx, browY - 4, bx + side * 20, browY - 7);
    } else if (expression === 'hit' || expression === 'ko') {
      // High alarmed surprised brows
      ctx.moveTo(bx - side * 18, browY - 12);
      ctx.quadraticCurveTo(bx, browY - 22, bx + side * 19, browY - 4);
    } else if (expression === 'block') {
      ctx.moveTo(bx - side * 18, browY + 8);
      ctx.lineTo(bx + side * 18, browY + 2);
    } else {
      // High, arched goofy Humpty eyebrows!
      ctx.moveTo(bx - side * 18, browY - 2);
      ctx.quadraticCurveTo(bx, browY - 16, bx + side * 18, browY + 2);
    }
    ctx.stroke();
  });

  // === 6. FUNNY SURPRISED/PUCKERED WHISTLING MOUTH (OR PANIC / CHEEKY GRIN) ===
  const mouthY = h * 0.495;
  ctx.strokeStyle = '#271A14';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';

  if (expression === 'hit' || expression === 'ko') {
    // Wide-eyed panic wavy open mouth!
    ctx.fillStyle = '#7F1D1D';
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + 4, 20, 23, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Little panic tongue
    ctx.fillStyle = '#FB7185';
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + 17, 11, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (expression === 'attack') {
    // Cheeky goofy grin!
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(cx - 28, mouthY - 6);
    ctx.quadraticCurveTo(cx, mouthY - 2, cx + 28, mouthY - 8);
    ctx.quadraticCurveTo(cx + 22, mouthY + 22, cx, mouthY + 22);
    ctx.quadraticCurveTo(cx - 22, mouthY + 22, cx - 28, mouthY - 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (expression === 'victory') {
    // Big proud joyful smile
    ctx.fillStyle = '#991B1B';
    ctx.beginPath();
    ctx.arc(cx, mouthY - 6, 24, 0.08 * Math.PI, 0.92 * Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(cx - 17, mouthY - 4, 34, 8);
  } else if (expression === 'block') {
    // Tight braced grimace
    ctx.beginPath();
    ctx.moveTo(cx - 18, mouthY + 2);
    ctx.quadraticCurveTo(cx, mouthY - 4, cx + 18, mouthY + 2);
    ctx.stroke();
  } else {
    // Iconic funny surprised/puckered whistling "o" mouth!
    ctx.fillStyle = '#9F1239';
    ctx.beginPath();
    ctx.ellipse(cx, mouthY, 10.5, 13.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cute whistling lip-pucker highlight
    ctx.strokeStyle = '#FECDD3';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx - 2, mouthY - 3, 5, Math.PI * 1.0, Math.PI * 1.65);
    ctx.stroke();
  }

  // === 7. DYNAMIC HP EGGSHELL CRACKS (<70%, <40%, <20%) ===
  drawAndaEggCracks(ctx, crackLevel, w, h);
}

function paintAndaPortrait(ctx: CanvasRenderingContext2D): void {
  // High-craft 160x160 2D portrait: Peach Humpty Egg with tilted navy top hat + red band,
  // big white-and-blue eyes, 3D-shaded pointy nose, white folded collar & bright yellow bow tie!
  const w = 160;
  const h = 160;

  // Rich arcade radial backdrop (warm golden-amber center to deep navy-crimson rim)
  const bg = ctx.createRadialGradient(80, 74, 10, 80, 80, 96);
  bg.addColorStop(0, '#F59E0B');
  bg.addColorStop(0.55, '#991B1B');
  bg.addColorStop(1, '#111827');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle sunburst comic rays
  ctx.save();
  ctx.translate(80, 82);
  ctx.fillStyle = 'rgba(255, 212, 38, 0.14)';
  for (let i = 0; i < 10; i++) {
    ctx.rotate((Math.PI * 2) / 10);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-10, -100);
    ctx.lineTo(10, -100);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Red vest lower shoulders & dark blue suspenders at bottom of frame
  ctx.fillStyle = '#D92323';
  ctx.beginPath();
  ctx.ellipse(80, 152, 62, 34, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#18181B';
  ctx.lineWidth = 2.6;
  ctx.stroke();

  // Dark blue vertical suspenders on red vest
  ctx.fillStyle = '#1B3B6F';
  ctx.fillRect(48, 128, 10, 32);
  ctx.fillRect(102, 128, 10, 32);

  // Small green vest button peeking right below the bow tie
  ctx.fillStyle = '#22C55E';
  ctx.strokeStyle = '#14532D';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(80, 151, 5.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Pointed-top warm peach-tan egg head (#F5C69A)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(80, 26);
  ctx.bezierCurveTo(116, 28, 128, 72, 122, 108);
  ctx.bezierCurveTo(116, 134, 44, 134, 38, 108);
  ctx.bezierCurveTo(32, 72, 44, 28, 80, 26);
  ctx.closePath();

  const eggGrad = ctx.createRadialGradient(68, 62, 6, 80, 84, 58);
  eggGrad.addColorStop(0, '#FCE2C6');
  eggGrad.addColorStop(0.55, '#F5C69A');
  eggGrad.addColorStop(1, '#DD9F6B');
  ctx.fillStyle = eggGrad;
  ctx.fill();
  ctx.strokeStyle = '#3B2316';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Subtle warm freckles on peach eggshell
  ctx.fillStyle = 'rgba(176, 114, 68, 0.35)';
  [
    [54, 96, 1.7],
    [59, 100, 1.4],
    [104, 95, 1.7],
    [99, 101, 1.4],
    [62, 54, 1.5],
    [98, 56, 1.5],
  ].forEach(([fx, fy, fr]) => {
    ctx.beginPath();
    ctx.arc(fx, fy, fr, 0, Math.PI * 2);
    ctx.fill();
  });

  // Rosy cheek blush
  ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
  ctx.beginPath();
  ctx.ellipse(53, 94, 9, 5.5, 0, 0, Math.PI * 2);
  ctx.ellipse(107, 94, 9, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Big goofy white-and-blue cartoon eyes
  [-1, 1].forEach((side) => {
    const ex = 80 + side * 17;
    const ey = 77;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(ex, ey, 12.5, 15.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2.6;
    ctx.stroke();

    const ix = ex - side * 2;
    ctx.fillStyle = '#2563EB';
    ctx.beginPath();
    ctx.arc(ix, ey + 1, 7.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(ix, ey + 1, 4.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ix - 2.4, ey - 2, 2.3, 0, Math.PI * 2);
    ctx.fill();

    // Arched dark eyebrow
    ctx.strokeStyle = '#271A14';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex - side * 9, ey - 19);
    ctx.quadraticCurveTo(ex, ey - 26, ex + side * 9, ey - 18);
    ctx.stroke();
  });

  // Sculpted-look pointy peach nose
  ctx.fillStyle = '#ECA973';
  ctx.strokeStyle = '#6B3E22';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(76, 86);
  ctx.quadraticCurveTo(88, 92, 81, 99);
  ctx.quadraticCurveTo(75, 99, 75, 93);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Cute surprised/puckered whistling "o" mouth
  ctx.fillStyle = '#9F1239';
  ctx.strokeStyle = '#271A14';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.ellipse(80, 111, 5.5, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Wide, crisp white folded collar (#F4F4F4)
  ctx.fillStyle = '#F4F4F4';
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(80, 129);
  ctx.lineTo(44, 118);
  ctx.lineTo(36, 134);
  ctx.lineTo(66, 141);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(80, 129);
  ctx.lineTo(116, 118);
  ctx.lineTo(124, 134);
  ctx.lineTo(94, 141);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Chunky bright yellow bow tie (#FFD426)
  ctx.fillStyle = '#FFD426';
  ctx.strokeStyle = '#78350F';
  ctx.lineWidth = 2.2;
  // Left wing
  ctx.beginPath();
  ctx.moveTo(77, 134);
  ctx.lineTo(56, 124);
  ctx.lineTo(56, 144);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Right wing
  ctx.beginPath();
  ctx.moveTo(83, 134);
  ctx.lineTo(104, 124);
  ctx.lineTo(104, 144);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Center knot
  ctx.beginPath();
  ctx.roundRect(74, 128, 12, 12, 4);
  ctx.fill();
  ctx.stroke();

  // Dapper tilted Dark Navy-Blue Top Hat (#1B3B6F) with bright Red Ribbon Band (#D92B2B)!
  ctx.save();
  ctx.translate(92, 31);
  ctx.rotate(0.24);

  // Hat crown (slightly flared top hat silhouette)
  ctx.fillStyle = '#1B3B6F';
  ctx.strokeStyle = '#0B162C';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-22, 6);
  ctx.lineTo(-27, -27);
  ctx.lineTo(27, -27);
  ctx.lineTo(22, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Glossy sheen highlight on dark navy top hat
  ctx.fillStyle = 'rgba(147, 197, 253, 0.25)';
  ctx.fillRect(-15, -24, 8, 28);

  // Bright red ribbon band around hat base (#D92B2B)
  ctx.fillStyle = '#D92B2B';
  ctx.fillRect(-23, -4, 46, 9);
  ctx.strokeRect(-23, -4, 46, 9);

  // Curved top hat brim
  ctx.fillStyle = '#16305C';
  ctx.beginPath();
  ctx.ellipse(0, 7, 34, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function paintFighterFace(
  ctx: CanvasRenderingContext2D,
  id: FighterId,
  expression: FaceExpression,
  crackLevel = 0,
): void {
  if (id === 'sheru') {
    paintWhiteLionFace(ctx, expression);
    return;
  }
  if (id === 'billa') {
    paintBlueBillaFace(ctx, expression);
    return;
  }
  if (id === 'neta') {
    paintNetaFace(ctx, expression);
    return;
  }
  if (id === 'anda') {
    paintAndaEggFace(ctx, expression, crackLevel);
    return;
  }

  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const cfg = FIGHTER_CONFIGS[id];

  // Fill base skin/surface color
  ctx.fillStyle = cfg.skinHex;
  ctx.fillRect(0, 0, w, h);

  // Subtle top-down cheek shading for vinyl-toy softness
  const grad = ctx.createRadialGradient(w * 0.5, h * 0.45, w * 0.08, w * 0.5, h * 0.5, w * 0.65);
  grad.addColorStop(0, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(0,0,0,0.14)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Face center coordinates (front UV patch on sphere is centered at u=0.5, v=0.5)
  const cx = w * 0.5;
  const cy = h * 0.52;

  // Blush cheeks
  ctx.fillStyle = 'rgba(225, 29, 72, 0.22)';
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.14, cy + h * 0.06, w * 0.045, h * 0.028, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + w * 0.14, cy + h * 0.06, w * 0.045, h * 0.028, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  const eyeOffsetX = w * 0.095;
  const eyeY = cy - h * 0.05;
  const eyeW = w * 0.052;
  const eyeH = h * 0.058;

  if (expression === 'ko') {
    // Classic cartoon X eyes
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    [-1, 1].forEach((side) => {
      const ex = cx + side * eyeOffsetX;
      ctx.beginPath();
      ctx.moveTo(ex - 13, eyeY - 13);
      ctx.lineTo(ex + 13, eyeY + 13);
      ctx.moveTo(ex + 13, eyeY - 13);
      ctx.lineTo(ex - 13, eyeY + 13);
      ctx.stroke();
    });
  } else if (expression === 'hit') {
    // Tightly winced > < eyes
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - eyeOffsetX - 14, eyeY - 10);
    ctx.lineTo(cx - eyeOffsetX + 10, eyeY);
    ctx.lineTo(cx - eyeOffsetX - 14, eyeY + 10);
    ctx.moveTo(cx + eyeOffsetX + 14, eyeY - 10);
    ctx.lineTo(cx + eyeOffsetX - 10, eyeY);
    ctx.lineTo(cx + eyeOffsetX + 14, eyeY + 10);
    ctx.stroke();
  } else if (expression === 'victory') {
    // Happy curved ^ ^ eyes
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    [-1, 1].forEach((side) => {
      const ex = cx + side * eyeOffsetX;
      ctx.beginPath();
      ctx.arc(ex, eyeY + 6, 15, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
    });
  } else {
    // Crisp cartoon white sclera + dark pupils + specular sparkle
    [-1, 1].forEach((side) => {
      const ex = cx + side * eyeOffsetX;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 4;
      ctx.stroke();

      const pupilShiftY = expression === 'attack' ? -2 : 1;
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(ex + side * 2, eyeY + pupilShiftY, 8, 0, Math.PI * 2);
      ctx.fill();

      // Catchlight dot
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ex + side * 2 - 3, eyeY + pupilShiftY - 3, 3.2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Eyebrows (expressive angles)
  ctx.strokeStyle = '#18181B';
  ctx.lineWidth = id === 'mausi' ? 5 : 7;
  ctx.lineCap = 'round';
  const browTilt =
    expression === 'attack' || expression === 'block'
      ? 10
      : expression === 'hit' || expression === 'ko'
        ? -8
        : 4;
  [-1, 1].forEach((side) => {
    const ex = cx + side * eyeOffsetX;
    ctx.beginPath();
    ctx.moveTo(ex - side * 16, eyeY - 22 - browTilt * 0.3);
    ctx.lineTo(ex + side * 14, eyeY - 22 + browTilt);
    ctx.stroke();
  });

  // Character-specific facial marks
  if (id === 'mausi') {
    // Iconic bright red bindi + subtle sindoor
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.arc(cx, eyeY - 20, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Mouth based on expression
  const mouthY = cy + h * 0.12;
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';

  if (expression === 'attack') {
    // Shouting arcade battle mouth
    ctx.fillStyle = '#991B1B';
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + 2, 22, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // White teeth strip
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(cx - 14, mouthY - 10, 28, 7);
  } else if (expression === 'hit') {
    // Shocked O mouth
    ctx.fillStyle = '#7F1D1D';
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + 4, 15, 19, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (expression === 'ko') {
    // Dizzy wavy mouth
    ctx.beginPath();
    ctx.moveTo(cx - 22, mouthY + 4);
    ctx.quadraticCurveTo(cx - 10, mouthY - 8, cx, mouthY + 4);
    ctx.quadraticCurveTo(cx + 10, mouthY + 14, cx + 22, mouthY + 2);
    ctx.stroke();
  } else if (expression === 'block') {
    // Gritted teeth determination
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(cx - 20, mouthY - 6, 40, 14, 5);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 20, mouthY + 1);
    ctx.lineTo(cx + 20, mouthY + 1);
    ctx.stroke();
  } else if (expression === 'victory') {
    // Big triumphant grin
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx, mouthY - 4, 24, 0.08 * Math.PI, 0.92 * Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // Confident smirk
    ctx.beginPath();
    ctx.moveTo(cx - 18, mouthY);
    ctx.quadraticCurveTo(cx + 2, mouthY + 14, cx + 22, mouthY - 3);
    ctx.stroke();
  }
}

export function createDynamicFace(id: FighterId): DynamicFace {
  const canvas = document.createElement('canvas');
  const size = id === 'anda' ? 512 : 256;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const face: DynamicFace = {
    canvas,
    ctx,
    texture,
    lastExpression: null,
    lastCrackLevel: -1,
    update(expression: FaceExpression, crackLevel = 0) {
      if (this.lastExpression === expression && this.lastCrackLevel === crackLevel) {
        return;
      }
      this.lastExpression = expression;
      this.lastCrackLevel = crackLevel;
      paintFighterFace(this.ctx, id, expression, crackLevel);
      this.texture.needsUpdate = true;
    },
    dispose() {
      this.texture.dispose();
    },
  };

  face.update('idle', 0);
  return face;
}

const portraitCache = new Map<FighterId, string>();

function paintSheruLionPortrait(ctx: CanvasRenderingContext2D): void {
  // Rich luxury gold-to-obsidian radial backdrop
  const bg = ctx.createRadialGradient(80, 68, 12, 80, 80, 102);
  bg.addColorStop(0, '#F59E0B');
  bg.addColorStop(0.55, '#92400E');
  bg.addColorStop(1, '#140E0B');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 160, 160);

  // Tailored all-white suit shoulders & lapels peeking at bottom
  ctx.fillStyle = '#F8FAFC';
  ctx.strokeStyle = '#1C1917';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(14, 162);
  ctx.quadraticCurveTo(22, 124, 52, 118);
  ctx.lineTo(108, 118);
  ctx.quadraticCurveTo(138, 124, 146, 162);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Suit lapel V-lines
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(52, 120);
  ctx.lineTo(80, 158);
  ctx.lineTo(108, 120);
  ctx.stroke();

  // Fluffy layered White & Cream Lion Mane (outer cream tufts + inner ivory ruff)
  const drawManeRing = (radius: number, tuftCount: number, tuftSize: number, fill: string, stroke: string) => {
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2.5;
    for (let i = 0; i < tuftCount; i++) {
      const a = (i / tuftCount) * Math.PI * 2;
      const tx = 80 + Math.cos(a) * radius;
      const ty = 74 + Math.sin(a) * (radius * 0.96);
      ctx.beginPath();
      ctx.arc(tx, ty, tuftSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  };
  drawManeRing(49, 14, 19, '#E6DFCE', '#3F362E');
  drawManeRing(42, 12, 17, '#F5F0E3', '#8C7E6B');

  // Rounded White Lion Ears peeking at top of mane
  [-1, 1].forEach((side) => {
    const ex = 80 + side * 34;
    const ey = 32;
    ctx.fillStyle = '#F8F5EE';
    ctx.strokeStyle = '#29211B';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ex, ey, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#E6B3A8';
    ctx.beginPath();
    ctx.arc(ex, ey + 1, 7, 0, Math.PI * 2);
    ctx.fill();
  });

  // Strong Ivory-White Lion Head & Cheekbones
  const headGrad = ctx.createRadialGradient(78, 66, 8, 80, 78, 44);
  headGrad.addColorStop(0, '#FFFFFF');
  headGrad.addColorStop(0.7, '#F6F2E8');
  headGrad.addColorStop(1, '#DFD6C5');
  ctx.fillStyle = headGrad;
  ctx.strokeStyle = '#29211B';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(80, 76, 38, 40, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Prominent Protruding Muzzle Pads + Chin
  ctx.fillStyle = '#FFFDF9';
  ctx.strokeStyle = '#A89B87';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(69, 95, 16, 13, -0.1, 0, Math.PI * 2);
  ctx.ellipse(91, 95, 16, 13, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Stern Brows peeking above Aviators
  ctx.strokeStyle = '#7C6F5E';
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(49, 54);
  ctx.lineTo(72, 60);
  ctx.moveTo(111, 54);
  ctx.lineTo(88, 60);
  ctx.stroke();

  // Sleek Glossy Jet-Black Aviator Sunglasses with Gold Metallic Rims & Double Bridge
  ctx.save();
  const drawAviatorLens = (side: -1 | 1) => {
    const lx = 80 + side * 21;
    ctx.beginPath();
    ctx.moveTo(lx - side * 14, 60);
    ctx.lineTo(lx + side * 16, 60);
    ctx.quadraticCurveTo(lx + side * 19, 77, lx + side * 7, 83);
    ctx.quadraticCurveTo(lx - side * 10, 84, lx - side * 15, 70);
    ctx.closePath();
    const lg = ctx.createLinearGradient(lx - 14, 58, lx + 14, 84);
    lg.addColorStop(0, '#1F242D');
    lg.addColorStop(0.45, '#07080B');
    lg.addColorStop(1, '#11141A');
    ctx.fillStyle = lg;
    ctx.fill();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Crisp glossy specular reflection streak
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(lx - 7, 64);
    ctx.lineTo(lx + 4, 76);
    ctx.stroke();
  };
  drawAviatorLens(-1);
  drawAviatorLens(1);
  // Gold double aviator bridge
  ctx.strokeStyle = '#FBBF24';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(73, 61);
  ctx.lineTo(87, 61);
  ctx.moveTo(74, 66);
  ctx.lineTo(86, 66);
  ctx.stroke();
  ctx.restore();

  // Lion Nose (dark outline + pinkish-brown tip)
  ctx.fillStyle = '#C67E75';
  ctx.strokeStyle = '#231815';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(69, 84);
  ctx.quadraticCurveTo(80, 81, 91, 84);
  ctx.quadraticCurveTo(88, 93, 80, 96);
  ctx.quadraticCurveTo(72, 93, 69, 84);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Philtrum & stern confident mouth
  ctx.strokeStyle = '#231815';
  ctx.lineWidth = 2.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(80, 96);
  ctx.lineTo(80, 103);
  ctx.moveTo(66, 106);
  ctx.quadraticCurveTo(74, 102, 80, 103);
  ctx.quadraticCurveTo(86, 102, 94, 105);
  ctx.stroke();

  // Whisker dots
  ctx.fillStyle = '#3F362E';
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.arc(80 + side * 14, 96, 1.8, 0, Math.PI * 2);
    ctx.arc(80 + side * 21, 95, 1.8, 0, Math.PI * 2);
    ctx.arc(80 + side * 18, 101, 1.8, 0, Math.PI * 2);
    ctx.fill();
  });

  // Chunky Segmented Metallic Gold Chain across White Suit Collar
  const links = 9;
  for (let i = 0; i < links; i++) {
    const t = i / (links - 1);
    const angle = Math.PI * (0.14 + t * 0.72);
    const cxLink = 80 - Math.cos(angle) * 32;
    const cyLink = 123 + Math.sin(angle) * 24;
    ctx.fillStyle = i % 2 === 0 ? '#FBBF24' : '#FDE047';
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cxLink, cyLink, 6.5, 5, angle - Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function paintBlueBillaPortrait(ctx: CanvasRenderingContext2D): void {
  // Vibrant lime-to-deep-cobalt cartoon comic backdrop so sky-blue cat pops cleanly
  const bg = ctx.createRadialGradient(80, 68, 12, 80, 80, 102);
  bg.addColorStop(0, '#4ADE80');
  bg.addColorStop(0.52, '#0284C7');
  bg.addColorStop(1, '#0F172A');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 160, 160);

  // Subtle neck & pear-shaped sky-blue shoulders + off-white belly hint at bottom
  ctx.fillStyle = '#55BCE8';
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(40, 162);
  ctx.quadraticCurveTo(46, 128, 80, 126);
  ctx.quadraticCurveTo(114, 128, 120, 162);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#E5E8EC';
  ctx.beginPath();
  ctx.ellipse(80, 158, 22, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tall, Narrow Jet-Black Top Head Crest Splitting into Two Sharp Vertical Pointy Black Ears
  ctx.fillStyle = '#111111';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(56, 62);
  ctx.lineTo(54, 13); // Left sharp vertical ear tip
  ctx.lineTo(75, 42); // Center valley
  ctx.lineTo(85, 42);
  ctx.lineTo(106, 13); // Right sharp vertical ear tip
  ctx.lineTo(104, 62);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Wide, Horizontally Flared Sky-Blue Cartoon Cat Head (#55BCE8)
  const headGrad = ctx.createRadialGradient(80, 86, 10, 80, 92, 58);
  headGrad.addColorStop(0, '#70CDF2');
  headGrad.addColorStop(0.7, '#55BCE8');
  headGrad.addColorStop(1, '#399CC7');
  ctx.fillStyle = headGrad;
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(56, 60);
  ctx.quadraticCurveTo(80, 50, 104, 60);
  ctx.quadraticCurveTo(122, 72, 137, 94); // Sharp right cheek flare
  ctx.quadraticCurveTo(132, 122, 102, 130);
  ctx.quadraticCurveTo(80, 136, 58, 130);
  ctx.quadraticCurveTo(28, 122, 23, 94); // Sharp left cheek flare
  ctx.quadraticCurveTo(38, 72, 56, 60);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Tiny Yellow/Gold Cheek Studs + 2 Sharp Black Tapered Whiskers per side
  [-1, 1].forEach((side) => {
    const sx = 80 + side * 52;
    const sy = 96;

    // 2 Sharp tapered black whiskers sticking cleanly outward
    ctx.fillStyle = '#111111';
    [-1, 1].forEach((dy) => {
      ctx.beginPath();
      ctx.moveTo(sx, sy - 2.2);
      ctx.lineTo(sx + side * 24, sy + dy * 10);
      ctx.lineTo(sx, sy + 2.2);
      ctx.closePath();
      ctx.fill();
    });

    // Yellow/gold cheek stud
    ctx.fillStyle = '#FACC15';
    ctx.strokeStyle = '#713F12';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // Two Tall Vertical Oval White Eyes Close Together Right Below Black Ears, with Bright Emerald-Green Irises
  [-1, 1].forEach((side) => {
    const ex = 80 + side * 14;
    const ey = 61;

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.ellipse(ex, ey, 12.5, 20.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Bright emerald-green iris
    ctx.fillStyle = '#10B981';
    ctx.strokeStyle = '#064E3B';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(ex - side * 1.5, ey + 2, 7.2, 11.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Black pupil
    ctx.fillStyle = '#0B0F19';
    ctx.beginPath();
    ctx.ellipse(ex - side * 1.5, ey + 2, 3.8, 6.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crisp white specular catchlight
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ex - side * 1.5 - 2.2, ey - 3.5, 2.6, 0, Math.PI * 2);
    ctx.fill();
  });

  // Wide Cheeky Open Grin (Dark Purple Inner Mouth, Two Tiny White Fangs, Lavender-Pink Tongue)
  ctx.fillStyle = '#4A1259';
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(48, 102);
  ctx.quadraticCurveTo(80, 109, 112, 102);
  ctx.quadraticCurveTo(104, 126, 80, 127);
  ctx.quadraticCurveTo(56, 126, 48, 102);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#F29EDB';
  ctx.beginPath();
  ctx.ellipse(80, 124, 17, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.stroke();

  // Two tiny crisp white fangs
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  [-16, 16].forEach((fx) => {
    ctx.beginPath();
    ctx.moveTo(80 + fx - 4, 104);
    ctx.lineTo(80 + fx, 112);
    ctx.lineTo(80 + fx + 4, 104);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  // Oversized Glossy Bright-Red Oval/Jellybean Nose (#D91E2A) right below the eyes
  const noseGrad = ctx.createRadialGradient(73, 81, 3, 80, 88, 25);
  noseGrad.addColorStop(0, '#FF4D5A');
  noseGrad.addColorStop(0.55, '#D91E2A');
  noseGrad.addColorStop(1, '#88111B');
  ctx.fillStyle = noseGrad;
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(80, 88, 24, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Glossy specular shine streak on the red jellybean nose
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.beginPath();
  ctx.ellipse(72, 82, 7.5, 3.6, -0.25, 0, Math.PI * 2);
  ctx.fill();
}

function paintNetaPortrait(ctx: CanvasRenderingContext2D): void {
  // Warm earthy saffron-crimson-to-charcoal radial backdrop so dusty kurta & checkered gamcha pop!
  const bg = ctx.createRadialGradient(80, 68, 12, 80, 80, 102);
  bg.addColorStop(0, '#EA580C');
  bg.addColorStop(0.54, '#881337');
  bg.addColorStop(1, '#181210');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 160, 160);

  // Dusty off-white cotton kurta shoulders (#DDD4C4)
  ctx.fillStyle = '#DDD4C4';
  ctx.strokeStyle = '#261C15';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(18, 162);
  ctx.quadraticCurveTo(26, 124, 56, 118);
  ctx.lineTo(104, 118);
  ctx.quadraticCurveTo(134, 124, 142, 162);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Subtle kurta front placket & buttons
  ctx.strokeStyle = '#A89F8F';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(80, 124);
  ctx.lineTo(80, 160);
  ctx.stroke();

  // Diagonal worn khaki jhola strap over right shoulder
  ctx.fillStyle = '#B5A892';
  ctx.strokeStyle = '#4A4035';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(106, 118);
  ctx.lineTo(122, 122);
  ctx.lineTo(104, 162);
  ctx.lineTo(89, 162);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Signature Red-and-White Checkered Gamcha wrapped around neck + hanging down left chest!
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(45, 115);
  ctx.quadraticCurveTo(80, 132, 114, 115);
  ctx.lineTo(118, 130);
  ctx.quadraticCurveTo(80, 146, 66, 134);
  ctx.lineTo(64, 162);
  ctx.lineTo(36, 162);
  ctx.closePath();
  ctx.clip();

  // Base off-white weave (#EDE6DA) + red checks (#C84B42)
  ctx.fillStyle = '#EDE6DA';
  ctx.fillRect(32, 110, 92, 56);
  ctx.fillStyle = '#C84B42';
  for (let gx = 32; gx < 126; gx += 12) {
    ctx.fillRect(gx, 110, 6, 56);
  }
  ctx.fillStyle = 'rgba(200, 75, 66, 0.72)';
  for (let gy = 112; gy < 166; gy += 12) {
    ctx.fillRect(32, gy, 92, 6);
  }
  ctx.restore();

  // Crisp outline around checkered gamcha
  ctx.strokeStyle = '#3B1816';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(45, 115);
  ctx.quadraticCurveTo(80, 132, 114, 115);
  ctx.lineTo(118, 130);
  ctx.quadraticCurveTo(80, 146, 66, 134);
  ctx.lineTo(64, 162);
  ctx.lineTo(36, 162);
  ctx.closePath();
  ctx.stroke();

  // Neck
  ctx.fillStyle = '#A46B46';
  ctx.fillRect(68, 106, 24, 20);

  // Ears
  [-1, 1].forEach((side) => {
    ctx.fillStyle = '#B87D56';
    ctx.strokeStyle = '#2B1B12';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.ellipse(80 + side * 37, 78, 7.5, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // Warm Medium-Brown Face (#B87D56)
  const headGrad = ctx.createRadialGradient(78, 68, 8, 80, 78, 44);
  headGrad.addColorStop(0, '#C78D66');
  headGrad.addColorStop(0.7, '#B87D56');
  headGrad.addColorStop(1, '#8C5838');
  ctx.fillStyle = headGrad;
  ctx.strokeStyle = '#2B1B12';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(80, 77, 36, 42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Short, Neatly Parted Salt-and-Pepper Hair (#55595E + silver-grey streaks)
  ctx.fillStyle = '#55595E';
  ctx.strokeStyle = '#1F2429';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(43, 72);
  ctx.quadraticCurveTo(40, 34, 78, 28);
  ctx.quadraticCurveTo(116, 30, 117, 72);
  ctx.quadraticCurveTo(112, 54, 102, 50);
  ctx.quadraticCurveTo(84, 42, 61, 47);
  ctx.quadraticCurveTo(50, 52, 43, 72);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Grey salt-and-pepper highlight streaks & side part line
  ctx.strokeStyle = '#D1D5DB';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(58, 39);
  ctx.quadraticCurveTo(80, 32, 104, 42);
  ctx.moveTo(46, 62);
  ctx.lineTo(48, 52);
  ctx.moveTo(114, 62);
  ctx.lineTo(112, 52);
  ctx.stroke();

  ctx.strokeStyle = '#272A2E';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(60, 46);
  ctx.lineTo(66, 32);
  ctx.stroke();

  // Expressive Salt-and-Pepper Eyebrows
  ctx.strokeStyle = '#3F4348';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(53, 62);
  ctx.lineTo(71, 64);
  ctx.moveTo(107, 62);
  ctx.lineTo(89, 64);
  ctx.stroke();

  // Warm Eyes behind Glasses
  [-1, 1].forEach((side) => {
    const ex = 80 + side * 16;
    ctx.fillStyle = '#FFFDF9';
    ctx.strokeStyle = '#1F2937';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(ex, 74, 8, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#18110D';
    ctx.beginPath();
    ctx.arc(ex, 74.5, 3.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ex - 1.4, 73, 1.4, 0, Math.PI * 2);
    ctx.fill();
  });

  // Thin Wire-Frame Rectangular Spectacles with subtle translucent lens sheen
  [-1, 1].forEach((side) => {
    const lx = side === -1 ? 50 : 84;
    ctx.fillStyle = 'rgba(224, 242, 254, 0.22)';
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(lx, 65, 26, 17, 3);
    ctx.fill();
    ctx.stroke();

    // Subtle glass reflection diagonal
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(lx + 4, 78);
    ctx.lineTo(lx + 11, 68);
    ctx.stroke();
  });
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(76, 72);
  ctx.lineTo(84, 72);
  ctx.moveTo(44, 71);
  ctx.lineTo(50, 71);
  ctx.moveTo(110, 71);
  ctx.lineTo(116, 71);
  ctx.stroke();

  // Nose & Light Laugh Lines
  ctx.strokeStyle = '#6B3E23';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(76, 87);
  ctx.quadraticCurveTo(80, 90, 84, 87);
  ctx.moveTo(64, 90);
  ctx.quadraticCurveTo(60, 98, 63, 104);
  ctx.moveTo(96, 90);
  ctx.quadraticCurveTo(100, 98, 97, 104);
  ctx.stroke();

  // Humble, Determined Desi Neta Smile
  ctx.strokeStyle = '#26140C';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(67, 98);
  ctx.quadraticCurveTo(80, 107, 94, 97);
  ctx.stroke();
}

export function getFighterPortraitDataUrl(id: FighterId): string {
  const cached = portraitCache.get(id);
  if (cached) return cached;
  if (typeof document === 'undefined') return '';

  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  if (id === 'sheru') {
    paintSheruLionPortrait(ctx);
    const url = canvas.toDataURL('image/png');
    portraitCache.set(id, url);
    return url;
  }

  if (id === 'billa') {
    paintBlueBillaPortrait(ctx);
    const url = canvas.toDataURL('image/png');
    portraitCache.set(id, url);
    return url;
  }

  if (id === 'neta') {
    paintNetaPortrait(ctx);
    const url = canvas.toDataURL('image/png');
    portraitCache.set(id, url);
    return url;
  }

  if (id === 'anda') {
    paintAndaPortrait(ctx);
    const url = canvas.toDataURL('image/png');
    portraitCache.set(id, url);
    return url;
  }

  const cfg = FIGHTER_CONFIGS[id];

  // Comic radial backdrop
  const bg = ctx.createRadialGradient(80, 72, 10, 80, 80, 95);
  bg.addColorStop(0, cfg.accentHex);
  bg.addColorStop(1, '#1A1210');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 160, 160);

  // Draw crisp face circle centered
  ctx.save();
  ctx.beginPath();
  ctx.arc(80, 84, 52, 0, Math.PI * 2);
  ctx.clip();

  const temp = document.createElement('canvas');
  temp.width = 256;
  temp.height = 256;
  const tctx = temp.getContext('2d')!;
  paintFighterFace(tctx, id, 'idle', 0);
  ctx.drawImage(temp, -28, -22, 216, 216);
  ctx.restore();

  // Signature headgear / shades overlay on portrait
  ctx.save();
  if (id === 'mausi') {
    // Hair bun + gajra
    ctx.fillStyle = '#18181B';
    ctx.beginPath();
    ctx.arc(80, 26, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FEF9C3';
    ctx.lineWidth = 4;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(80, 26, 19, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  const url = canvas.toDataURL('image/png');
  portraitCache.set(id, url);
  return url;
}
