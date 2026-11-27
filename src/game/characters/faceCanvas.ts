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

  // Sharp, angled stern arcade boss brows (instantly readable above aviator rims)
  ctx.strokeStyle = '#3B2F25';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  const browTilt =
    expression === 'attack' || expression === 'block'
      ? 14
      : expression === 'hit' || expression === 'ko'
        ? -8
        : 10;
  [-1, 1].forEach((side) => {
    const ex = cx + side * eyeOffsetX;
    ctx.beginPath();
    ctx.moveTo(ex - side * 19, eyeY - 24 - browTilt * 0.28);
    ctx.lineTo(ex + side * 15, eyeY - 21 + browTilt);
    ctx.stroke();
    // Crisp dark brow ridge shadow underneath for sculpted 3D arcade depth
    ctx.strokeStyle = '#140D0B';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(ex - side * 17, eyeY - 19 - browTilt * 0.24);
    ctx.lineTo(ex + side * 14, eyeY - 16 + browTilt);
    ctx.stroke();
    ctx.strokeStyle = '#3B2F25';
    ctx.lineWidth = 10;
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
    // Confident asymmetrical billionaire boss smirk with sharp fang glint
    ctx.beginPath();
    ctx.moveTo(cx - 22, mouthY + 4);
    ctx.quadraticCurveTo(cx - 4, mouthY + 1, cx + 10, mouthY - 2);
    ctx.quadraticCurveTo(cx + 18, mouthY - 5, cx + 25, mouthY - 7);
    ctx.stroke();
    // Subtle lower-lip crease & confident canine glint
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(cx + 12, mouthY - 2);
    ctx.lineTo(cx + 15, mouthY + 5);
    ctx.lineTo(cx + 18, mouthY - 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(20, 13, 11, 0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 8, mouthY + 10);
    ctx.quadraticCurveTo(cx + 2, mouthY + 12, cx + 10, mouthY + 8);
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
      ctx.ellipse(ex, eyeY, 13.5, expression === 'attack' ? 11 : 12.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#18110D';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      const pupilY = expression === 'attack' ? eyeY - 1 : eyeY + 0.5;
      ctx.fillStyle = '#18110D';
      ctx.beginPath();
      ctx.arc(ex + side * 1.2, pupilY, 6.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ex + side * 1.2 - 2.2, pupilY - 2.4, 2.3, 0, Math.PI * 2);
      ctx.fill();

      // Sharp angled upper eyelid for intense determined neta glare behind spectacles
      const lidDip = expression === 'attack' ? 2.5 : 1.0;
      ctx.fillStyle = '#A86D48';
      ctx.beginPath();
      ctx.moveTo(ex - side * 15, eyeY - 14);
      ctx.lineTo(ex + side * 15, eyeY - 14);
      ctx.lineTo(ex + side * 15, eyeY - 5.5 - lidDip);
      ctx.lineTo(ex - side * 15, eyeY - 2.0 + lidDip);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#1C110B';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(ex - side * 14, eyeY - 2.2 + lidDip);
      ctx.lineTo(ex + side * 14, eyeY - 6.0 - lidDip);
      ctx.stroke();
    });
  }

  // Sharp Furrowed Salt-and-Pepper Arcade Fighter Eyebrows
  ctx.lineCap = 'round';
  const browTilt =
    expression === 'attack' || expression === 'block'
      ? 13
      : expression === 'hit' || expression === 'ko'
        ? -10
        : 8;
  const browLift = expression === 'hit' ? -7 : 0;
  [-1, 1].forEach((side) => {
    const ex = cx + side * eyeOffsetX;
    ctx.strokeStyle = '#2E3238';
    ctx.lineWidth = 8.0;
    ctx.beginPath();
    ctx.moveTo(ex - side * 17, eyeY - 21 + browLift - browTilt * 0.25);
    ctx.lineTo(ex + side * 15, eyeY - 21 + browLift + browTilt);
    ctx.stroke();
    // Crisp silver salt-and-pepper highlight streak inside brow
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(ex - side * 13, eyeY - 22 + browLift - browTilt * 0.2);
    ctx.lineTo(ex + side * 7, eyeY - 21 + browLift + browTilt * 0.55);
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

      // Bright crisp eye catchlight
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(irisX - irisR * 0.35, irisY - irisR * 0.38, irisR * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(irisX + irisR * 0.25, irisY + irisR * 0.3, irisR * 0.13, 0, Math.PI * 2);
      ctx.fill();

      // Smug angled upper eyelids (sheds blank baby-eye look while keeping iconic Humpty Egg charm!)
      if (!isHit) {
        const lidSlope = isAttack ? 9.5 : 5.5;
        const lidDrop = isBlock ? eyeRy * 0.25 : isAttack ? eyeRy * 0.42 : eyeRy * 0.48;
        ctx.fillStyle = '#EFB884';
        ctx.beginPath();
        ctx.moveTo(ex - side * (rx + 4), eyeY - ry - 4);
        ctx.lineTo(ex + side * (rx + 4), eyeY - ry - 4);
        ctx.lineTo(ex + side * (rx + 4), eyeY - lidDrop - lidSlope);
        ctx.lineTo(ex - side * (rx + 4), eyeY - lidDrop + lidSlope);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 4.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ex - side * (rx + 2), eyeY - lidDrop + lidSlope);
        ctx.lineTo(ex + side * (rx + 2), eyeY - lidDrop - lidSlope);
        ctx.stroke();
      }
    });
  }

  // === 5. SMUG, CHEEKY ANGLED ARCADE FIGHTER EYEBROWS ===
  const browY = eyeY - eyeRy - h * 0.018;
  ctx.strokeStyle = '#231610';
  ctx.lineWidth = 7.8;
  ctx.lineCap = 'round';
  [-1, 1].forEach((side) => {
    const bx = cx + side * eyeOffsetX;
    ctx.beginPath();
    if (expression === 'attack') {
      // Fierce determined inward-angled brows
      ctx.moveTo(bx - side * 20, browY + 11);
      ctx.quadraticCurveTo(bx, browY - 3, bx + side * 21, browY - 8);
    } else if (expression === 'hit' || expression === 'ko') {
      // High alarmed surprised brows
      ctx.moveTo(bx - side * 18, browY - 12);
      ctx.quadraticCurveTo(bx, browY - 22, bx + side * 19, browY - 4);
    } else if (expression === 'block') {
      ctx.moveTo(bx - side * 18, browY + 9);
      ctx.lineTo(bx + side * 18, browY + 2);
    } else {
      // Smug cheeky asymmetrical cocked brow (right brow arched high, left angled slickly!)
      if (side === 1) {
        ctx.moveTo(bx - 19, browY + 3);
        ctx.quadraticCurveTo(bx, browY - 13, bx + 20, browY - 4);
      } else {
        ctx.moveTo(bx + 19, browY + 7);
        ctx.quadraticCurveTo(bx, browY - 2, bx - 20, browY - 3);
      }
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

function paintMausiFace(ctx: CanvasRenderingContext2D, expression: FaceExpression): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const cx = w * 0.5;
  const cy = h * 0.53;
  // Equirectangular SphereGeometry maps 2*PI lon across w and PI lat across h -> 2:1 horizontal stretch!
  // Drawing horizontal radii/offsets at ~0.52x relative to vertical keeps bindi, eyes & smile crisp and round in 3D.
  const uvX = 0.54;

  // Base warm wheatish-tan skin tone (#DFB48E)
  ctx.fillStyle = '#DFB48E';
  ctx.fillRect(0, 0, w, h);

  // Soft chubby cheek volumetric shading (matte vinyl-caricature depth, no blown highlights)
  const skinGrad = ctx.createRadialGradient(cx, cy - h * 0.03, w * 0.04, cx, cy, w * 0.52);
  skinGrad.addColorStop(0, 'rgba(255, 240, 224, 0.20)');
  skinGrad.addColorStop(0.65, 'rgba(223, 180, 142, 0.0)');
  skinGrad.addColorStop(1, 'rgba(135, 86, 52, 0.22)');
  ctx.fillStyle = skinGrad;
  ctx.fillRect(0, 0, w, h);

  // Subtle painted center-parted hairline edge at very top of forehead so 3D hair blends seamlessly
  ctx.fillStyle = '#3A1412';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(w, h * 0.26);
  ctx.quadraticCurveTo(cx + w * 0.09, h * 0.2, cx, h * 0.16);
  ctx.quadraticCurveTo(cx - w * 0.09, h * 0.2, 0, h * 0.26);
  ctx.closePath();
  ctx.fill();

  // Warm rosy chubby cheeks (aspect-compensated)
  ctx.fillStyle = 'rgba(214, 78, 84, 0.24)';
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.088, cy + h * 0.068, w * 0.032, h * 0.034, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + w * 0.088, cy + h * 0.068, w * 0.032, h * 0.034, 0, 0, Math.PI * 2);
  ctx.fill();

  // Subtle plump chin contour curve
  ctx.strokeStyle = 'rgba(138, 86, 52, 0.34)';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(cx, cy + h * 0.175, w * 0.036, h * 0.022, 0, Math.PI * 0.18, Math.PI * 0.82);
  ctx.stroke();

  // Prominent BRIGHT RED ROUND BINDI centered dead-on forehead (aspect-compensated so it renders perfectly circular!)
  const bindiY = cy - h * 0.145;
  const bindiRx = w * 0.022;
  const bindiRy = h * 0.039;
  ctx.fillStyle = '#E11D2A';
  ctx.beginPath();
  ctx.ellipse(cx, bindiY, bindiRx, bindiRy, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#991B1B';
  ctx.lineWidth = 1.8;
  ctx.stroke();
  // Crisp highlight dot on bindi
  ctx.fillStyle = 'rgba(255, 228, 228, 0.5)';
  ctx.beginPath();
  ctx.ellipse(cx - bindiRx * 0.3, bindiY - bindiRy * 0.28, bindiRx * 0.26, bindiRy * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wide expressive dark eyes (aspect-compensated for spherical UV)
  const eyeOffsetX = w * 0.064;
  const eyeY = cy - h * 0.032;
  const eyeRx = w * 0.031;
  const eyeRy = h * 0.054;

  if (expression === 'ko') {
    // Dizzy X eyes
    ctx.strokeStyle = '#240E0C';
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    [-1, 1].forEach((side) => {
      const ex = cx + side * eyeOffsetX;
      ctx.beginPath();
      ctx.moveTo(ex - 7.5, eyeY - 11);
      ctx.lineTo(ex + 7.5, eyeY + 11);
      ctx.moveTo(ex + 7.5, eyeY - 11);
      ctx.lineTo(ex - 7.5, eyeY + 11);
      ctx.stroke();
    });
  } else if (expression === 'victory') {
    // Joyful arched ^ ^ eyes with cute eyelash flicks
    ctx.strokeStyle = '#240E0C';
    ctx.lineWidth = 5.2;
    ctx.lineCap = 'round';
    [-1, 1].forEach((side) => {
      const ex = cx + side * eyeOffsetX;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY + 6, eyeRx * 0.95, eyeRy * 0.85, 0, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(ex + side * eyeRx * 0.85, eyeY + 2);
      ctx.lineTo(ex + side * (eyeRx + 4), eyeY - 3);
      ctx.stroke();
      ctx.lineWidth = 5.2;
    });
  } else if (expression === 'hit') {
    // Wide-eyed shocked expression!
    [-1, 1].forEach((side) => {
      const ex = cx + side * eyeOffsetX;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeRx * 1.12, eyeRy * 1.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#240E0C';
      ctx.lineWidth = 3.2;
      ctx.stroke();

      // Tiny shocked pinprick pupil
      ctx.fillStyle = '#180A08';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY + 1, 3.0, 5.2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(ex - 1.2, eyeY - 1.5, 1.2, 2.0, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  } else {
    // Expressive big dark eyes (idle, attack, block)
    [-1, 1].forEach((side) => {
      const ex = cx + side * eyeOffsetX;
      const hScale = expression === 'block' ? 0.66 : expression === 'attack' ? 0.92 : 1.02;

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeRx, eyeRy * hScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#240E0C';
      ctx.lineWidth = 3.0;
      ctx.stroke();

      // Deep espresso-brown iris + dark pupil (aspect-compensated circles!)
      const pupilY = expression === 'attack' ? eyeY - 1.5 : eyeY + 1;
      ctx.fillStyle = '#2E1610';
      ctx.beginPath();
      ctx.ellipse(ex + side * 0.8, pupilY, 9.2 * uvX, 9.2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#120806';
      ctx.beginPath();
      ctx.ellipse(ex + side * 0.8, pupilY, 5.8 * uvX, 5.8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Twin catchlight sparkles
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(ex + side * 0.8 - 1.8, pupilY - 3.2, 2.8 * uvX, 2.8, 0, 0, Math.PI * 2);
      ctx.ellipse(ex + side * 0.8 + 1.6, pupilY + 2.5, 1.4 * uvX, 1.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Bold upper kohl eyeliner + outer lash flick
      ctx.strokeStyle = '#1E0C0A';
      ctx.lineWidth = 3.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeRx + 0.4, eyeRy * hScale, 0, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();

      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(ex + side * (eyeRx - 0.5), eyeY - 2);
      ctx.lineTo(ex + side * (eyeRx + 4.2), eyeY - 6);
      ctx.stroke();

      // Fierce formidable aunty angled kajal upper eyelid (stronger on attack, sharp & commanding in idle!)
      if (expression === 'attack' || expression === 'idle') {
        const lidInnerY = expression === 'attack' ? eyeY - eyeRy * 0.08 : eyeY - eyeRy * 0.36;
        const lidOuterY = expression === 'attack' ? eyeY - eyeRy * 0.92 : eyeY - eyeRy * 0.88;
        ctx.fillStyle = '#DFB48E';
        ctx.beginPath();
        ctx.moveTo(ex - side * (eyeRx + 3), eyeY - eyeRy - 2);
        ctx.lineTo(ex + side * (eyeRx + 3), eyeY - eyeRy - 2);
        ctx.lineTo(ex + side * (eyeRx + 3), lidOuterY);
        ctx.lineTo(ex - side * (eyeRx + 3), lidInnerY);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#1E0C0A';
        ctx.lineWidth = expression === 'attack' ? 3.8 : 3.4;
        ctx.beginPath();
        ctx.moveTo(ex - side * (eyeRx + 1.5), lidInnerY);
        ctx.lineTo(ex + side * (eyeRx + 2.5), lidOuterY);
        ctx.stroke();
      }
    });
  }

  // Fierce sculpted arched dark eyebrows (#2D0E0C, aspect-compensated)
  ctx.strokeStyle = '#2D0E0C';
  ctx.lineWidth = expression === 'attack' ? 5.6 : 4.8;
  ctx.lineCap = 'round';
  [-1, 1].forEach((side) => {
    const ex = cx + side * eyeOffsetX;
    ctx.beginPath();
    if (expression === 'attack') {
      ctx.moveTo(ex - side * 9.8, eyeY - 11);
      ctx.quadraticCurveTo(ex, eyeY - 18, ex + side * 9.8, eyeY - 25);
    } else if (expression === 'hit') {
      ctx.moveTo(ex - side * 9.2, eyeY - 24);
      ctx.quadraticCurveTo(ex, eyeY - 33, ex + side * 9.5, eyeY - 22);
    } else if (expression === 'block') {
      ctx.moveTo(ex - side * 9.5, eyeY - 13);
      ctx.lineTo(ex + side * 9.2, eyeY - 19);
    } else {
      // Formidable commanding aunty brow angle
      ctx.moveTo(ex - side * 9.6, eyeY - 14);
      ctx.quadraticCurveTo(ex + side * 1.2, eyeY - 24, ex + side * 10.2, eyeY - 21);
    }
    ctx.stroke();
  });

  // Cute round button nose shade under 3D nose bump
  const noseY = cy + h * 0.036;
  ctx.fillStyle = 'rgba(156, 98, 62, 0.30)';
  ctx.beginPath();
  ctx.ellipse(cx, noseY + 2, 6.2, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8F5838';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(cx, noseY, 4.6, 5.5, 0, Math.PI * 0.16, Math.PI * 0.84);
  ctx.stroke();

  // Expressive mouth (aspect-compensated)
  const mouthY = cy + h * 0.118;
  ctx.strokeStyle = '#3B1218';
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';

  if (expression === 'attack') {
    // Fierce angry battle shout / scowl!
    ctx.fillStyle = '#7A161E';
    ctx.beginPath();
    ctx.moveTo(cx - 13.5, mouthY + 4);
    ctx.quadraticCurveTo(cx, mouthY - 12, cx + 13.5, mouthY + 4);
    ctx.quadraticCurveTo(cx, mouthY + 19, cx - 13.5, mouthY + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(cx - 8.5, mouthY - 4, 17, 7, 2.5);
    ctx.fill();
  } else if (expression === 'hit') {
    // Shocked open O mouth
    ctx.fillStyle = '#7A161E';
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + 4, 8.2, 15.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (expression === 'ko') {
    // Dizzy wavy mouth
    ctx.beginPath();
    ctx.moveTo(cx - 13, mouthY + 4);
    ctx.quadraticCurveTo(cx - 6, mouthY - 7, cx, mouthY + 4);
    ctx.quadraticCurveTo(cx + 6, mouthY + 13, cx + 13, mouthY + 2);
    ctx.stroke();
  } else if (expression === 'block') {
    // Gritted determined teeth
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(cx - 12, mouthY - 5, 24, 12.5, 4);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 11, mouthY + 1.5);
    ctx.lineTo(cx + 11, mouthY + 1.5);
    ctx.stroke();
  } else if (expression === 'victory') {
    // Big cheerful triumphant sweet-shop boss grin!
    ctx.fillStyle = '#991B29';
    ctx.beginPath();
    ctx.ellipse(cx, mouthY - 2, 13.5, 19, 0, 0.08 * Math.PI, 0.92 * Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(cx - 10, mouthY - 3, 20, 7.5, 2.5);
    ctx.fill();
    ctx.stroke();
  } else {
    // Bold cheerful-yet-fierce confident aunty smile with warm berry lip tint
    ctx.fillStyle = '#B83848';
    ctx.beginPath();
    ctx.moveTo(cx - 13.5, mouthY - 1);
    ctx.quadraticCurveTo(cx, mouthY + 15, cx + 14, mouthY - 3);
    ctx.quadraticCurveTo(cx, mouthY + 5.5, cx - 13.5, mouthY - 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function paintFatherFace(ctx: CanvasRenderingContext2D, expression: FaceExpression): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const cx = w * 0.5;
  const cy = h * 0.52;
  // Equirectangular UV horizontal aspect compensation (~0.52x) so eyes & features render realistically proportioned
  const uvX = 0.52;

  // Natural warm medium-brown South Asian skin tone (#A66F4B)
  ctx.fillStyle = '#A66F4B';
  ctx.fillRect(0, 0, w, h);

  // Subtle realistic anatomical facial shading (forehead highlight, cheekbone contour, jaw shadow)
  const skinGrad = ctx.createRadialGradient(cx, cy - h * 0.05, w * 0.03, cx, cy, w * 0.48);
  skinGrad.addColorStop(0, 'rgba(218, 166, 126, 0.24)');
  skinGrad.addColorStop(0.55, 'rgba(166, 111, 75, 0.0)');
  skinGrad.addColorStop(1, 'rgba(84, 48, 28, 0.28)');
  ctx.fillStyle = skinGrad;
  ctx.fillRect(0, 0, w, h);

  // Subtle neat dark hairline & side-part taper on upper forehead to blend seamlessly with 3D hair
  ctx.fillStyle = '#181618';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(w, h * 0.29);
  ctx.quadraticCurveTo(cx + w * 0.14, h * 0.24, cx + w * 0.03, h * 0.245);
  ctx.lineTo(cx - w * 0.04, h * 0.22);
  ctx.quadraticCurveTo(cx - w * 0.13, h * 0.245, 0, h * 0.29);
  ctx.closePath();
  ctx.fill();

  // Subtle realistic brow-ridge, eye-socket, and cheekbone shadows
  ctx.fillStyle = 'rgba(72, 38, 22, 0.24)';
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.072, cy - h * 0.035, w * 0.042, h * 0.032, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + w * 0.072, cy - h * 0.035, w * 0.042, h * 0.032, 0, 0, Math.PI * 2);
  ctx.fill();

  // Faint dignified laugh/expression lines beside nose & mouth (mature adult principal)
  ctx.strokeStyle = 'rgba(74, 40, 22, 0.34)';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.moveTo(cx + side * w * 0.044, cy + h * 0.065);
    ctx.quadraticCurveTo(
      cx + side * w * 0.064,
      cy + h * 0.115,
      cx + side * w * 0.055,
      cy + h * 0.16,
    );
    ctx.stroke();
  });

  // Realistic natural adult eyes (almond-shaped, proportional, legible at 3D fighting distance)
  const eyeOffsetX = w * 0.072;
  const eyeY = cy - h * 0.03;
  const eyeRx = w * 0.033;
  const eyeRy = h * 0.029;

  if (expression === 'ko') {
    // Closed grimacing KO eyes (composed realistic style)
    ctx.strokeStyle = '#18100C';
    ctx.lineWidth = 5.4;
    ctx.lineCap = 'round';
    [-1, 1].forEach((side) => {
      const ex = cx + side * eyeOffsetX;
      ctx.beginPath();
      ctx.moveTo(ex - eyeRx * 0.92, eyeY - 3);
      ctx.quadraticCurveTo(ex, eyeY + 10, ex + eyeRx * 0.92, eyeY - 2);
      ctx.stroke();
    });
  } else {
    [-1, 1].forEach((side) => {
      const ex = cx + side * eyeOffsetX;
      const openScale =
        expression === 'hit'
          ? 1.18
          : expression === 'attack'
            ? 0.84
            : expression === 'block'
              ? 0.65
              : 0.94;

      // Natural crisp off-white sclera
      ctx.fillStyle = '#F7F2EC';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeRx, eyeRy * openScale, 0, 0, Math.PI * 2);
      ctx.fill();

      // Deep espresso-brown adult iris + dark pupil (aspect-compensated circular)
      const irisR = expression === 'hit' ? 9.5 : 11.4;
      ctx.fillStyle = '#24140E';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY + 0.5, irisR * uvX, irisR, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0D0705';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY + 0.5, irisR * 0.54 * uvX, irisR * 0.54, 0, 0, Math.PI * 2);
      ctx.fill();

      // Crisp realistic corneal catchlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.ellipse(ex - 2.0, eyeY - 2.6, 2.8 * uvX, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Natural upper eyelid crease & dark lash line (stern composed principal gaze)
      ctx.strokeStyle = '#160E0B';
      ctx.lineWidth = 4.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeRx + 0.8, eyeRy * openScale, 0, Math.PI * 1.04, Math.PI * 1.96);
      ctx.stroke();

      // Subtle upper eyelid fold line
      ctx.strokeStyle = 'rgba(64, 34, 20, 0.56)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY - 4, eyeRx * 1.05, eyeRy * openScale * 1.08, 0, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();

      // Slight lower-lid shadow
      ctx.strokeStyle = 'rgba(68, 36, 20, 0.45)';
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY + 1.2, eyeRx * 0.92, eyeRy * openScale * 0.96, 0, Math.PI * 0.12, Math.PI * 0.88);
      ctx.stroke();
    });
  }

  // Serious, authoritative realistic dark eyebrows (#181312)
  ctx.strokeStyle = '#181312';
  ctx.lineWidth = expression === 'attack' ? 9.6 : 8.6;
  ctx.lineCap = 'round';
  [-1, 1].forEach((side) => {
    const ex = cx + side * eyeOffsetX;
    ctx.beginPath();
    if (expression === 'attack') {
      // Stern disciplinary furrowed principal brow
      ctx.moveTo(ex - side * eyeRx * 1.08, eyeY - 19);
      ctx.quadraticCurveTo(ex, eyeY - 28, ex + side * eyeRx * 1.15, eyeY - 34);
    } else if (expression === 'hit') {
      ctx.moveTo(ex - side * eyeRx * 1.0, eyeY - 32);
      ctx.quadraticCurveTo(ex, eyeY - 40, ex + side * eyeRx * 1.05, eyeY - 28);
    } else if (expression === 'victory') {
      // Composed authoritative slight raise
      ctx.moveTo(ex - side * eyeRx * 1.0, eyeY - 25);
      ctx.quadraticCurveTo(ex, eyeY - 33, ex + side * eyeRx * 1.1, eyeY - 26);
    } else {
      // Serious, calm straight-angled principal brows
      ctx.moveTo(ex - side * eyeRx * 1.05, eyeY - 23);
      ctx.quadraticCurveTo(ex + side * 2.5, eyeY - 30, ex + side * eyeRx * 1.14, eyeY - 26);
    }
    ctx.stroke();
  });

  // Subtle sculpted nose bridge & nostril shading (aligns with 3D sculpted nose)
  const noseY = cy + h * 0.055;
  ctx.fillStyle = 'rgba(226, 178, 140, 0.28)';
  ctx.fillRect(cx - 3.2, eyeY + 2, 6.4, h * 0.076);
  ctx.fillStyle = 'rgba(66, 36, 20, 0.45)';
  ctx.beginPath();
  ctx.ellipse(cx - 8.2, noseY + 4, 4.4, 2.8, -0.2, 0, Math.PI * 2);
  ctx.ellipse(cx + 8.2, noseY + 4, 4.4, 2.8, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Firm, composed realistic mouth (clean-shaven, dignified)
  const mouthY = cy + h * 0.142;
  ctx.lineCap = 'round';
  if (expression === 'attack') {
    // Stern commanding shouting/warning mouth
    ctx.fillStyle = '#421614';
    ctx.strokeStyle = '#5E2B1E';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + 2, w * 0.046, h * 0.026, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#F5F1EC';
    ctx.fillRect(cx - w * 0.032, mouthY - 7, w * 0.064, 7.5);
  } else if (expression === 'hit' || expression === 'ko') {
    // Tight wince
    ctx.strokeStyle = '#3B1B13';
    ctx.lineWidth = 5.2;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.044, mouthY + 6);
    ctx.quadraticCurveTo(cx, mouthY - 5, cx + w * 0.044, mouthY + 6);
    ctx.stroke();
  } else if (expression === 'victory') {
    // Subtle composed principal smile
    ctx.strokeStyle = '#441E16';
    ctx.lineWidth = 4.6;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.048, mouthY);
    ctx.quadraticCurveTo(cx, mouthY + 12, cx + w * 0.048, mouthY - 1);
    ctx.stroke();
  } else {
    // Firm, authoritative neutral mouth with subtle upper/lower lip tone
    ctx.fillStyle = 'rgba(104, 52, 38, 0.68)';
    ctx.beginPath();
    ctx.ellipse(cx, mouthY - 2.5, w * 0.044, 5.4, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(126, 66, 50, 0.56)';
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + 4.2, w * 0.038, 6.0, 0, 0, Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#3B1A12';
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.048, mouthY + 1);
    ctx.quadraticCurveTo(cx, mouthY - 1, cx + w * 0.048, mouthY + 1);
    ctx.stroke();
  }

  // Subtle chin dimple shadow
  ctx.fillStyle = 'rgba(72, 40, 24, 0.26)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + h * 0.195, w * 0.022, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function paintSamyakFace(ctx: CanvasRenderingContext2D, expression: FaceExpression): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const cx = w * 0.5;
  const cy = h * 0.52;
  const uvX = 0.52;

  // Natural warm-tan South Asian young adult male skin tone (#BC8866)
  ctx.fillStyle = '#BC8866';
  ctx.fillRect(0, 0, w, h);

  // Sculpted anatomical facial lighting gradient
  const skinGrad = ctx.createRadialGradient(cx, cy - h * 0.06, w * 0.03, cx, cy, w * 0.48);
  skinGrad.addColorStop(0, 'rgba(235, 192, 156, 0.26)');
  skinGrad.addColorStop(0.55, 'rgba(188, 136, 102, 0.0)');
  skinGrad.addColorStop(1, 'rgba(98, 58, 36, 0.28)');
  ctx.fillStyle = skinGrad;
  ctx.fillRect(0, 0, w, h);

  // Short dark slightly tousled hairline at upper forehead
  ctx.fillStyle = '#141214';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(w, h * 0.29);
  ctx.quadraticCurveTo(cx + w * 0.14, h * 0.25, cx + w * 0.06, h * 0.27);
  ctx.lineTo(cx + w * 0.02, h * 0.235);
  ctx.lineTo(cx - w * 0.03, h * 0.275);
  ctx.lineTo(cx - w * 0.08, h * 0.24);
  ctx.quadraticCurveTo(cx - w * 0.14, h * 0.26, 0, h * 0.29);
  ctx.closePath();
  ctx.fill();

  // Subtle cheekbone and eye-socket shading behind sunglasses
  const eyeOffsetX = w * 0.072;
  const eyeY = cy - h * 0.03;
  const eyeRx = w * 0.032;
  const eyeRy = h * 0.026;

  // Strong athletic dark eyebrows peeking cleanly above sunglasses frame
  ctx.strokeStyle = '#161212';
  ctx.lineWidth = expression === 'attack' ? 10.2 : 8.8;
  ctx.lineCap = 'round';
  [-1, 1].forEach((side) => {
    const ex = cx + side * eyeOffsetX;
    ctx.beginPath();
    if (expression === 'attack') {
      ctx.moveTo(ex - side * eyeRx * 1.05, eyeY - 22);
      ctx.quadraticCurveTo(ex, eyeY - 31, ex + side * eyeRx * 1.15, eyeY - 36);
    } else if (expression === 'hit') {
      ctx.moveTo(ex - side * eyeRx * 1.0, eyeY - 32);
      ctx.quadraticCurveTo(ex, eyeY - 40, ex + side * eyeRx * 1.05, eyeY - 28);
    } else {
      ctx.moveTo(ex - side * eyeRx * 1.05, eyeY - 25);
      ctx.quadraticCurveTo(ex + side * 2, eyeY - 32, ex + side * eyeRx * 1.15, eyeY - 28);
    }
    ctx.stroke();
  });

  // Subtle realistic eyes underneath the tinted lenses (for oblique angles)
  [-1, 1].forEach((side) => {
    const ex = cx + side * eyeOffsetX;
    ctx.fillStyle = '#EAE4DD';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, eyeRx * 0.85, eyeRy * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1D120D';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, 9.5 * uvX, 9.5, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Sculpted nose bridge & nostrils
  const noseY = cy + h * 0.052;
  ctx.fillStyle = 'rgba(235, 192, 158, 0.28)';
  ctx.fillRect(cx - 3.4, eyeY + 2, 6.8, h * 0.072);
  ctx.fillStyle = 'rgba(72, 40, 22, 0.44)';
  ctx.beginPath();
  ctx.ellipse(cx - 8.5, noseY + 4, 4.4, 2.8, -0.2, 0, Math.PI * 2);
  ctx.ellipse(cx + 8.5, noseY + 4, 4.4, 2.8, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Neatly trimmed full black beard wrapping jawline & chin (matches reference photo!)
  ctx.fillStyle = '#161416';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.145, cy + h * 0.01);
  ctx.quadraticCurveTo(cx - w * 0.142, cy + h * 0.15, cx - w * 0.088, cy + h * 0.22);
  ctx.quadraticCurveTo(cx, cy + h * 0.275, cx + w * 0.088, cy + h * 0.22);
  ctx.quadraticCurveTo(cx + w * 0.142, cy + h * 0.15, cx + w * 0.145, cy + h * 0.01);
  // Crisp trimmed upper-cheek beard edge curving down around cheeks & mouth
  ctx.lineTo(cx + w * 0.125, cy + h * 0.025);
  ctx.quadraticCurveTo(cx + w * 0.105, cy + h * 0.11, cx + w * 0.056, cy + h * 0.125);
  ctx.quadraticCurveTo(cx + w * 0.052, cy + h * 0.185, cx, cy + h * 0.19);
  ctx.quadraticCurveTo(cx - w * 0.052, cy + h * 0.185, cx - w * 0.056, cy + h * 0.125);
  ctx.quadraticCurveTo(cx - w * 0.105, cy + h * 0.11, cx - w * 0.125, cy + h * 0.025);
  ctx.closePath();
  ctx.fill();

  // Subtle soul-patch & dense chin fill
  ctx.fillStyle = '#161416';
  ctx.beginPath();
  ctx.ellipse(cx, cy + h * 0.195, w * 0.048, h * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();

  // Neatly trimmed black moustache connecting cleanly to beard corners
  const mouthY = cy + h * 0.14;
  ctx.fillStyle = '#171416';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.062, mouthY - 1);
  ctx.quadraticCurveTo(cx - w * 0.028, mouthY - 17, cx, mouthY - 12);
  ctx.quadraticCurveTo(cx + w * 0.028, mouthY - 17, cx + w * 0.062, mouthY - 1);
  ctx.quadraticCurveTo(cx + w * 0.032, mouthY - 5, cx, mouthY - 4);
  ctx.quadraticCurveTo(cx - w * 0.032, mouthY - 5, cx - w * 0.062, mouthY - 1);
  ctx.closePath();
  ctx.fill();

  // Expressive athletic mouth beneath moustache
  ctx.lineCap = 'round';
  if (expression === 'attack') {
    // Fierce battle shout showing crisp teeth
    ctx.fillStyle = '#421614';
    ctx.strokeStyle = '#6B3426';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + 6, w * 0.044, h * 0.024, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(cx - w * 0.03, mouthY - 1, w * 0.06, 7);
  } else if (expression === 'hit' || expression === 'ko') {
    ctx.strokeStyle = '#3B1B13';
    ctx.lineWidth = 4.6;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.038, mouthY + 8);
    ctx.quadraticCurveTo(cx, mouthY - 2, cx + w * 0.038, mouthY + 8);
    ctx.stroke();
  } else if (expression === 'victory') {
    // Confident AIR-1 smirk
    ctx.strokeStyle = '#4A2118';
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.04, mouthY + 3);
    ctx.quadraticCurveTo(cx + 4, mouthY + 11, cx + w * 0.044, mouthY);
    ctx.stroke();
  } else {
    // Composed determined lips
    ctx.fillStyle = 'rgba(130, 68, 54, 0.72)';
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + 5, w * 0.036, 5.2, 0, 0, Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#3C1B14';
    ctx.lineWidth = 3.8;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.04, mouthY + 3);
    ctx.quadraticCurveTo(cx, mouthY + 2, cx + w * 0.04, mouthY + 3);
    ctx.stroke();
  }
}

function paintPrincipalFace(ctx: CanvasRenderingContext2D, expression: FaceExpression): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const cx = w * 0.5;
  const cy = h * 0.52;
  const uvX = 0.52;

  // Warm medium-brown skin base (#B57853)
  ctx.fillStyle = '#B57853';
  ctx.fillRect(0, 0, w, h);

  const skinGrad = ctx.createRadialGradient(cx, cy - h * 0.05, w * 0.03, cx, cy, w * 0.48);
  skinGrad.addColorStop(0, 'rgba(232, 184, 146, 0.28)');
  skinGrad.addColorStop(0.55, 'rgba(181, 120, 83, 0.0)');
  skinGrad.addColorStop(1, 'rgba(92, 52, 30, 0.3)');
  ctx.fillStyle = skinGrad;
  ctx.fillRect(0, 0, w, h);

  // Dark hair with silver/gray-dappled temples along upper hairline
  ctx.fillStyle = '#18181B';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(w, h * 0.28);
  ctx.quadraticCurveTo(cx + w * 0.14, h * 0.23, cx - w * 0.05, h * 0.245);
  ctx.lineTo(cx - w * 0.09, h * 0.205);
  ctx.lineTo(cx - w * 0.12, h * 0.255);
  ctx.quadraticCurveTo(cx - w * 0.16, h * 0.26, 0, h * 0.28);
  ctx.closePath();
  ctx.fill();

  // Gray-dappled temple streaks
  ctx.strokeStyle = 'rgba(203, 213, 225, 0.72)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.15, h * 0.25);
  ctx.lineTo(cx - w * 0.13, h * 0.34);
  ctx.moveTo(cx + w * 0.15, h * 0.25);
  ctx.lineTo(cx + w * 0.13, h * 0.34);
  ctx.stroke();

  const eyeOffsetX = w * 0.072;
  const eyeY = cy - h * 0.032;
  const eyeRx = w * 0.038;
  const eyeRy = h * 0.03;

  // Expressive caricature eyes (wide alert eyes on idle/attack, squeezed on hit/ko)
  if (expression === 'hit' || expression === 'ko') {
    ctx.strokeStyle = '#1B0E09';
    ctx.lineWidth = 6.5;
    ctx.lineCap = 'round';
    [-1, 1].forEach((side) => {
      const ex = cx + side * eyeOffsetX;
      ctx.beginPath();
      ctx.moveTo(ex - side * 14, eyeY - 10);
      ctx.lineTo(ex + side * 6, eyeY);
      ctx.lineTo(ex - side * 14, eyeY + 10);
      ctx.stroke();
    });
  } else {
    [-1, 1].forEach((side) => {
      const ex = cx + side * eyeOffsetX;
      const openScale = expression === 'attack' ? 1.05 : 1.0;

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeRx, eyeRy * openScale, 0, 0, Math.PI * 2);
      ctx.fill();

      const irisR = 11.8;
      ctx.fillStyle = '#24140E';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, irisR * uvX, irisR, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#090707';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, irisR * 0.52 * uvX, irisR * 0.52, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(ex - 2.2, eyeY - 2.6, 3.0 * uvX, 3.0, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#140C09';
      ctx.lineWidth = 4.6;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeRx + 0.8, eyeRy * openScale, 0, Math.PI * 1.04, Math.PI * 1.96);
      ctx.stroke();
    });
  }

  // Thick playful arched dark caricature eyebrows
  ctx.strokeStyle = '#141111';
  ctx.lineWidth = 10.5;
  ctx.lineCap = 'round';
  [-1, 1].forEach((side) => {
    const ex = cx + side * eyeOffsetX;
    ctx.beginPath();
    if (expression === 'attack') {
      ctx.moveTo(ex - side * eyeRx * 1.08, eyeY - 20);
      ctx.quadraticCurveTo(ex, eyeY - 32, ex + side * eyeRx * 1.15, eyeY - 36);
    } else if (expression === 'hit') {
      ctx.moveTo(ex - side * eyeRx * 1.0, eyeY - 34);
      ctx.quadraticCurveTo(ex, eyeY - 42, ex + side * eyeRx * 1.05, eyeY - 28);
    } else {
      ctx.moveTo(ex - side * eyeRx * 1.06, eyeY - 24);
      ctx.quadraticCurveTo(ex, eyeY - 36, ex + side * eyeRx * 1.12, eyeY - 25);
    }
    ctx.stroke();
  });

  // Confident playful smirk / stern warning shout
  const mouthY = cy + h * 0.142;
  ctx.lineCap = 'round';
  if (expression === 'attack') {
    ctx.fillStyle = '#421614';
    ctx.strokeStyle = '#5E2B1E';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + 2, w * 0.048, h * 0.028, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(cx - w * 0.032, mouthY - 7, w * 0.064, 7.5);
  } else if (expression === 'hit' || expression === 'ko') {
    ctx.strokeStyle = '#3B1B13';
    ctx.lineWidth = 5.2;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.044, mouthY + 6);
    ctx.quadraticCurveTo(cx, mouthY - 5, cx + w * 0.044, mouthY + 6);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#3B1A12';
    ctx.lineWidth = 4.8;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.052, mouthY + 1);
    ctx.quadraticCurveTo(cx + 4, mouthY + 13, cx + w * 0.054, mouthY - 4);
    ctx.stroke();
  }
}

export function paintFighterFace(
  ctx: CanvasRenderingContext2D,
  id: FighterId,
  expression: FaceExpression,
  crackLevel = 0,
): void {
  switch (id) {
    case 'sheru':
      paintWhiteLionFace(ctx, expression);
      return;
    case 'billa':
      paintBlueBillaFace(ctx, expression);
      return;
    case 'neta':
      paintNetaFace(ctx, expression);
      return;
    case 'anda':
      paintAndaEggFace(ctx, expression, crackLevel);
      return;
    case 'mausi':
      paintMausiFace(ctx, expression);
      return;
    case 'father':
      paintPrincipalFace(ctx, expression);
      return;
    case 'samyak':
      paintSamyakFace(ctx, expression);
      return;
    case 'adi':
      paintAdiFace(ctx, expression);
      return;
    case 'krish':
      paintKrishFace(ctx, expression);
      return;
  }
}

function paintAdiFace(ctx: CanvasRenderingContext2D, expression: FaceExpression): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const cx = w * 0.5;

  // Warm youthful Indian skin tone with subtle arcade shading
  const skinGrad = ctx.createRadialGradient(cx, h * 0.45, w * 0.06, cx, h * 0.5, w * 0.52);
  skinGrad.addColorStop(0, '#D49E76');
  skinGrad.addColorStop(0.62, '#C28A64');
  skinGrad.addColorStop(1, '#9A6442');
  ctx.fillStyle = skinGrad;
  ctx.fillRect(0, 0, w, h);

  // Subtle cheek warmth & jawline contour
  const cheekY = h * 0.57;
  [-1, 1].forEach((side) => {
    const chX = cx + side * w * 0.14;
    const g = ctx.createRadialGradient(chX, cheekY, 4, chX, cheekY, w * 0.085);
    g.addColorStop(0, 'rgba(186, 98, 72, 0.24)');
    g.addColorStop(1, 'rgba(186, 98, 72, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(chX, cheekY, w * 0.085, 0, Math.PI * 2);
    ctx.fill();
  });

  // Dark stylish textured hair fringe along top forehead
  ctx.fillStyle = '#171518';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(w, h * 0.31);
  ctx.quadraticCurveTo(w * 0.78, h * 0.24, w * 0.58, h * 0.29);
  ctx.quadraticCurveTo(w * 0.42, h * 0.22, w * 0.22, h * 0.31);
  ctx.quadraticCurveTo(w * 0.1, h * 0.29, 0, h * 0.34);
  ctx.closePath();
  ctx.fill();

  // Sharp expressive eyebrows
  const eyeY = h * 0.48;
  const eyeSpan = w * 0.115;
  ctx.strokeStyle = '#181415';
  ctx.lineWidth = Math.max(6, w * 0.022);
  ctx.lineCap = 'round';
  const browTilt =
    expression === 'attack' ? 14 : expression === 'hit' || expression === 'ko' ? -10 : 5;
  [-1, 1].forEach((side) => {
    const bx = cx + side * eyeSpan;
    ctx.beginPath();
    ctx.moveTo(bx - side * w * 0.075, eyeY - h * 0.08 - browTilt * 0.5);
    ctx.quadraticCurveTo(bx, eyeY - h * 0.105, bx + side * w * 0.068, eyeY - h * 0.068 + browTilt * 0.6);
    ctx.stroke();
  });

  // Expressive eyes
  if (expression === 'ko') {
    ctx.strokeStyle = '#181415';
    ctx.lineWidth = Math.max(7, w * 0.02);
    [-1, 1].forEach((side) => {
      const ex = cx + side * eyeSpan;
      ctx.beginPath();
      ctx.moveTo(ex - 20, eyeY - 16);
      ctx.lineTo(ex + 20, eyeY + 16);
      ctx.moveTo(ex + 20, eyeY - 16);
      ctx.lineTo(ex - 20, eyeY + 16);
      ctx.stroke();
    });
  } else {
    const eyeH = expression === 'hit' ? h * 0.05 : expression === 'block' ? h * 0.022 : h * 0.038;
    [-1, 1].forEach((side) => {
      const ex = cx + side * eyeSpan;
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, w * 0.056, eyeH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1E1512';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#231712';
      ctx.beginPath();
      ctx.arc(ex, eyeY, w * 0.027, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ex - 6, eyeY - 6, w * 0.011, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Clean subtle nose shading
  ctx.strokeStyle = 'rgba(84, 44, 24, 0.55)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx, eyeY + h * 0.03);
  ctx.lineTo(cx - 4, h * 0.60);
  ctx.quadraticCurveTo(cx + 2, h * 0.635, cx + 14, h * 0.61);
  ctx.stroke();

  // Confident mouth / expression
  const mouthY = h * 0.72;
  ctx.strokeStyle = '#4A1F18';
  ctx.lineWidth = 6.5;
  ctx.lineCap = 'round';
  if (expression === 'attack') {
    ctx.fillStyle = '#521515';
    ctx.beginPath();
    ctx.roundRect(cx - 34, mouthY - 12, 68, 30, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(cx - 26, mouthY - 10, 52, 9);
  } else if (expression === 'hit' || expression === 'ko') {
    ctx.fillStyle = '#451212';
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + 4, 24, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (expression === 'victory') {
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.arc(cx, mouthY - 4, 34, 0.08 * Math.PI, 0.92 * Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // Cool relaxed Last-Bench smirk
    ctx.beginPath();
    ctx.moveTo(cx - 28, mouthY + 2);
    ctx.quadraticCurveTo(cx + 4, mouthY + 14, cx + 32, mouthY - 6);
    ctx.stroke();
  }
}

function paintKrishFace(ctx: CanvasRenderingContext2D, expression: FaceExpression): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const cx = w * 0.5;

  // Warm rounded Indian skin tone with soft brawler shading
  const skinGrad = ctx.createRadialGradient(cx, h * 0.46, w * 0.06, cx, h * 0.5, w * 0.54);
  skinGrad.addColorStop(0, '#C68D67');
  skinGrad.addColorStop(0.62, '#B07854');
  skinGrad.addColorStop(1, '#8A583A');
  ctx.fillStyle = skinGrad;
  ctx.fillRect(0, 0, w, h);

  // Fuller friendly cheeks
  const cheekY = h * 0.585;
  [-1, 1].forEach((side) => {
    const chX = cx + side * w * 0.125;
    const g = ctx.createRadialGradient(chX, cheekY, 4, chX, cheekY, w * 0.075);
    g.addColorStop(0, 'rgba(176, 86, 62, 0.24)');
    g.addColorStop(1, 'rgba(176, 86, 62, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(chX, cheekY, w * 0.075, 0, Math.PI * 2);
    ctx.fill();
  });

  // Short neat dark hair hairline along forehead
  ctx.fillStyle = '#161416';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(w, h * 0.32);
  ctx.quadraticCurveTo(w * 0.72, h * 0.25, cx, h * 0.27);
  ctx.quadraticCurveTo(w * 0.28, h * 0.25, 0, h * 0.32);
  ctx.closePath();
  ctx.fill();

  // Thick expressive eyebrows
  const eyeY = h * 0.49;
  const eyeSpan = w * 0.082;
  ctx.strokeStyle = '#181415';
  ctx.lineWidth = Math.max(7, w * 0.022);
  ctx.lineCap = 'round';
  const browTilt =
    expression === 'attack' ? 12 : expression === 'hit' || expression === 'ko' ? -9 : 4;
  [-1, 1].forEach((side) => {
    const bx = cx + side * eyeSpan;
    ctx.beginPath();
    ctx.moveTo(bx - side * w * 0.056, eyeY - h * 0.078 - browTilt * 0.45);
    ctx.quadraticCurveTo(bx, eyeY - h * 0.098, bx + side * w * 0.052, eyeY - h * 0.066 + browTilt * 0.55);
    ctx.stroke();
  });

  // Expressive eyes
  if (expression === 'ko') {
    ctx.strokeStyle = '#181415';
    ctx.lineWidth = Math.max(7, w * 0.02);
    [-1, 1].forEach((side) => {
      const ex = cx + side * eyeSpan;
      ctx.beginPath();
      ctx.moveTo(ex - 16, eyeY - 14);
      ctx.lineTo(ex + 16, eyeY + 14);
      ctx.moveTo(ex + 16, eyeY - 14);
      ctx.lineTo(ex - 16, eyeY + 14);
      ctx.stroke();
    });
  } else {
    const eyeH = expression === 'hit' ? h * 0.044 : expression === 'block' ? h * 0.02 : h * 0.032;
    [-1, 1].forEach((side) => {
      const ex = cx + side * eyeSpan;
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, w * 0.042, eyeH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1E1512';
      ctx.lineWidth = 3.6;
      ctx.stroke();

      ctx.fillStyle = '#231712';
      ctx.beginPath();
      ctx.arc(ex, eyeY, w * 0.022, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ex - 5, eyeY - 5, w * 0.009, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Soft nose contour
  ctx.strokeStyle = 'rgba(84, 44, 24, 0.55)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx, eyeY + h * 0.03);
  ctx.lineTo(cx - 5, h * 0.60);
  ctx.quadraticCurveTo(cx + 2, h * 0.64, cx + 15, h * 0.61);
  ctx.stroke();

  // Confident brawler grin / battle shout
  const mouthY = h * 0.725;
  ctx.strokeStyle = '#4A1F18';
  ctx.lineWidth = 6.5;
  ctx.lineCap = 'round';
  if (expression === 'attack') {
    ctx.fillStyle = '#521515';
    ctx.beginPath();
    ctx.roundRect(cx - 36, mouthY - 12, 72, 30, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(cx - 28, mouthY - 10, 56, 9);
  } else if (expression === 'hit' || expression === 'ko') {
    ctx.fillStyle = '#451212';
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + 4, 24, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (expression === 'victory') {
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.arc(cx, mouthY - 4, 36, 0.08 * Math.PI, 0.92 * Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(cx - 30, mouthY + 2);
    ctx.quadraticCurveTo(cx, mouthY + 16, cx + 32, mouthY - 4);
    ctx.stroke();
  }
}

export function createDynamicFace(id: FighterId): DynamicFace {
  const canvas = document.createElement('canvas');
  const size =
    id === 'anda' || id === 'father' || id === 'samyak' || id === 'adi' || id === 'krish'
      ? 512
      : 256;
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

function paintMausiPortrait(ctx: CanvasRenderingContext2D): void {
  // Vibrant golden-amber to deep teal arcade comic radial backdrop
  const bg = ctx.createRadialGradient(80, 68, 12, 80, 82, 102);
  bg.addColorStop(0, '#FDE073');
  bg.addColorStop(0.55, '#1C7E82');
  bg.addColorStop(1, '#0C353A');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 160, 160);

  // Crisp subtle comic halftone starburst rays
  ctx.save();
  ctx.translate(80, 74);
  ctx.fillStyle = 'rgba(255, 245, 200, 0.13)';
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-7, -96);
    ctx.lineTo(7, -96);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Iconic wooden Belan (rolling pin) angled proudly behind her right shoulder
  ctx.save();
  ctx.translate(128, 84);
  ctx.rotate(0.46);
  // Handle tip
  ctx.fillStyle = '#9B642C';
  ctx.strokeStyle = '#3B1F0B';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.roundRect(-5, -56, 10, 18, 4);
  ctx.fill();
  ctx.stroke();
  // Turned wooden barrel
  const belanGrad = ctx.createLinearGradient(-11, 0, 11, 0);
  belanGrad.addColorStop(0, '#A86E34');
  belanGrad.addColorStop(0.45, '#DFAC6B');
  belanGrad.addColorStop(1, '#9E662C');
  ctx.fillStyle = belanGrad;
  ctx.beginPath();
  ctx.roundRect(-10, -40, 20, 64, 7);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Back round hair bun (juda) peeking neatly behind crown/side
  ctx.fillStyle = '#3A1412';
  ctx.strokeStyle = '#1E0807';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.arc(80, 24, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Subtle reddish-brown sheen on hair bun
  ctx.strokeStyle = 'rgba(128, 56, 46, 0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(76, 21, 12, Math.PI * 1.1, Math.PI * 1.8);
  ctx.stroke();

  // Plump Heavyweight Shoulders: Dark Forest-Green Blouse (#1E5E3A)
  ctx.fillStyle = '#1E5E3A';
  ctx.strokeStyle = '#0E301D';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(8, 162);
  ctx.quadraticCurveTo(16, 118, 52, 112);
  ctx.lineTo(108, 112);
  ctx.quadraticCurveTo(144, 118, 152, 162);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Subtle green blouse shoulder highlight & neckline curve
  ctx.fillStyle = '#267549';
  ctx.beginPath();
  ctx.ellipse(34, 134, 18, 10, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Sturdy wheatish-tan neck & upper chest neckline
  ctx.fillStyle = '#DFB48E';
  ctx.strokeStyle = '#6E4228';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(62, 108);
  ctx.lineTo(98, 108);
  ctx.lineTo(104, 124);
  ctx.quadraticCurveTo(80, 144, 56, 124);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Rich Teal-Blue Saree (#1F8E91) draped diagonally over her left shoulder (viewer's right)
  ctx.fillStyle = '#1F8E91';
  ctx.strokeStyle = '#0D464B';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(92, 112);
  ctx.lineTo(132, 118);
  ctx.quadraticCurveTo(146, 134, 148, 162);
  ctx.lineTo(36, 162);
  ctx.quadraticCurveTo(64, 136, 92, 112);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Dark-teal saree pleat lines along diagonal pallu
  ctx.strokeStyle = '#11585D';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  const pleatOffsets = [0, 11, 22, 33];
  pleatOffsets.forEach((off) => {
    ctx.beginPath();
    ctx.moveTo(98 + off * 0.72, 115 + off * 0.12);
    ctx.quadraticCurveTo(82 + off * 0.65, 138, 56 + off * 0.85, 160);
    ctx.stroke();
  });

  // Thick V-shaped Metallic Gold Necklace (#F0C420) resting over upper chest
  const goldGrad = ctx.createLinearGradient(54, 114, 106, 144);
  goldGrad.addColorStop(0, '#FFF1A6');
  goldGrad.addColorStop(0.45, '#F0C420');
  goldGrad.addColorStop(1, '#B8840A');

  ctx.strokeStyle = '#5E3D04';
  ctx.lineWidth = 10.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(56, 115);
  ctx.lineTo(80, 138);
  ctx.lineTo(104, 115);
  ctx.stroke();

  ctx.strokeStyle = goldGrad;
  ctx.lineWidth = 6.5;
  ctx.beginPath();
  ctx.moveTo(56, 115);
  ctx.lineTo(80, 138);
  ctx.lineTo(104, 115);
  ctx.stroke();

  // Gold central V-pendant drop
  ctx.fillStyle = '#F0C420';
  ctx.strokeStyle = '#6E4806';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.arc(80, 143, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#FFF5B8';
  ctx.beginPath();
  ctx.arc(78.5, 141.5, 2.0, 0, Math.PI * 2);
  ctx.fill();

  // Round ears + shiny round gold earrings (#F0C420)
  [-1, 1].forEach((side) => {
    const ex = 80 + side * 44;
    ctx.fillStyle = '#DFB48E';
    ctx.strokeStyle = '#6E4228';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(ex, 80, 7.5, 10.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Round gold earring stud/jhumka
    ctx.fillStyle = '#F0C420';
    ctx.strokeStyle = '#6E4806';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(ex + side * 1, 90, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFF6BF';
    ctx.beginPath();
    ctx.arc(ex + side * 1 - 1.8, 88.2, 2.0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Round chubby wheatish-tan face (#DFB48E)
  const faceGrad = ctx.createRadialGradient(74, 68, 8, 80, 76, 48);
  faceGrad.addColorStop(0, '#ECC5A2');
  faceGrad.addColorStop(0.75, '#DFB48E');
  faceGrad.addColorStop(1, '#C4926B');
  ctx.fillStyle = faceGrad;
  ctx.strokeStyle = '#59331C';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.ellipse(80, 78, 43, 41, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Warm rosy chubby cheek glow
  ctx.fillStyle = 'rgba(218, 78, 84, 0.25)';
  ctx.beginPath();
  ctx.ellipse(54, 87, 10, 6.5, 0, 0, Math.PI * 2);
  ctx.ellipse(106, 87, 10, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Center-parted Dark Reddish-Brown Hair (#3A1412) framing both sides cleanly
  ctx.fillStyle = '#3A1412';
  ctx.strokeStyle = '#1E0807';
  ctx.lineWidth = 2.4;
  // Left hair lobe
  ctx.beginPath();
  ctx.moveTo(80, 42);
  ctx.quadraticCurveTo(56, 36, 39, 54);
  ctx.quadraticCurveTo(33, 66, 37, 81);
  ctx.quadraticCurveTo(42, 65, 55, 56);
  ctx.quadraticCurveTo(70, 50, 80, 46);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Right hair lobe
  ctx.beginPath();
  ctx.moveTo(80, 42);
  ctx.quadraticCurveTo(104, 36, 121, 54);
  ctx.quadraticCurveTo(127, 66, 123, 81);
  ctx.quadraticCurveTo(118, 65, 105, 56);
  ctx.quadraticCurveTo(90, 50, 80, 46);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Warm mahogany hair highlights
  ctx.strokeStyle = 'rgba(130, 58, 46, 0.55)';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(47, 56);
  ctx.quadraticCurveTo(58, 47, 72, 46);
  ctx.moveTo(113, 56);
  ctx.quadraticCurveTo(102, 47, 88, 46);
  ctx.stroke();

  // Prominent Bright Red Round Bindi dead-center on forehead!
  ctx.fillStyle = '#E11D2A';
  ctx.strokeStyle = '#8F111A';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(80, 60.5, 6.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 224, 224, 0.55)';
  ctx.beginPath();
  ctx.arc(78.2, 58.8, 1.8, 0, Math.PI * 2);
  ctx.fill();

  // Neat arched eyebrows (#3A1412)
  ctx.strokeStyle = '#3A1412';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(54, 67);
  ctx.quadraticCurveTo(63, 61, 71, 67);
  ctx.moveTo(89, 67);
  ctx.quadraticCurveTo(97, 61, 106, 67);
  ctx.stroke();

  // Wide expressive dark eyes with kohl eyeliner & catchlights
  [-1, 1].forEach((side) => {
    const ex = 80 + side * 16.5;
    const ey = 76;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#1E0C0A';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(ex, ey, 8.6, 8.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#2B130E';
    ctx.beginPath();
    ctx.arc(ex + side * 0.8, ey + 0.5, 5.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#120705';
    ctx.beginPath();
    ctx.arc(ex + side * 0.8, ey + 0.5, 3.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ex + side * 0.8 - 1.8, ey - 1.5, 1.9, 0, Math.PI * 2);
    ctx.fill();

    // Lash flick
    ctx.strokeStyle = '#1E0C0A';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(ex + side * 8, ey - 1.5);
    ctx.lineTo(ex + side * 12, ey - 4.2);
    ctx.stroke();
  });

  // Cute round nose
  ctx.fillStyle = 'rgba(155, 98, 62, 0.32)';
  ctx.beginPath();
  ctx.ellipse(80, 87.5, 5.8, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8F5838';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.arc(80, 86.5, 4.4, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();

  // Bold cheerful-yet-fierce smile
  ctx.fillStyle = '#B83848';
  ctx.strokeStyle = '#3B1218';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(65, 97.5);
  ctx.quadraticCurveTo(80, 110, 96, 96.5);
  ctx.quadraticCurveTo(80, 102.5, 65, 97.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function paintFatherPortrait(ctx: CanvasRenderingContext2D): void {
  // Dignified warm institutional slate-to-crimson-gold studio portrait backdrop
  const bg = ctx.createRadialGradient(80, 62, 12, 80, 82, 108);
  bg.addColorStop(0, '#334155');
  bg.addColorStop(0.55, '#1E293B');
  bg.addColorStop(1, '#0F172A');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 160, 160);

  // Subtle crimson-gold disciplinary halo accent behind shoulders
  const rim = ctx.createRadialGradient(80, 74, 24, 80, 74, 68);
  rim.addColorStop(0, 'rgba(203, 230, 245, 0.22)');
  rim.addColorStop(0.7, 'rgba(220, 38, 38, 0.14)');
  rim.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, 160, 160);

  // Crisp matte-white cassock sleeves at shoulders
  ctx.fillStyle = '#F3F4F6';
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(16, 160);
  ctx.quadraticCurveTo(22, 126, 46, 118);
  ctx.lineTo(114, 118);
  ctx.quadraticCurveTo(138, 126, 144, 160);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Pale sky-blue sleeveless Nehru vest / Bandhgala jacket (#CBE6F5)
  const vestGrad = ctx.createLinearGradient(38, 112, 122, 160);
  vestGrad.addColorStop(0, '#D9EEF9');
  vestGrad.addColorStop(0.5, '#CBE6F5');
  vestGrad.addColorStop(1, '#A9D3EA');
  ctx.fillStyle = vestGrad;
  ctx.strokeStyle = '#6B9DB8';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(32, 160);
  ctx.lineTo(39, 120);
  ctx.quadraticCurveTo(56, 113, 66, 111);
  ctx.lineTo(94, 111);
  ctx.quadraticCurveTo(104, 113, 121, 120);
  ctx.lineTo(128, 160);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Center front placket & buttons on sky-blue Nehru vest
  ctx.strokeStyle = '#7AA9C4';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(80, 118);
  ctx.lineTo(80, 160);
  ctx.stroke();
  [131, 145, 156].forEach((by) => {
    ctx.fillStyle = '#E6F4FC';
    ctx.strokeStyle = '#5D8AA8';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(80, by, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // Left chest pocket (viewer right) with clipped dark metallic pen!
  ctx.fillStyle = '#B8DBEE';
  ctx.strokeStyle = '#6B9DB8';
  ctx.lineWidth = 1.3;
  ctx.fillRect(94, 134, 19, 14);
  ctx.strokeRect(94, 134, 19, 14);
  // Clipped pen barrel + silver clip sticking neatly above pocket edge
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(102, 124, 3.6, 12);
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(104.2, 125, 1.5, 11);

  // Standing crisp white clerical collar peeking cleanly above the Nehru vest mandarin collar
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(65, 102, 30, 13, 4);
  ctx.fill();
  ctx.stroke();

  // Sky-blue mandarin collar wrapping outer base of white clerical collar
  ctx.fillStyle = '#CBE6F5';
  ctx.strokeStyle = '#6B9DB8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(62, 116);
  ctx.lineTo(65, 107);
  ctx.lineTo(76, 111);
  ctx.lineTo(80, 118);
  ctx.lineTo(84, 111);
  ctx.lineTo(95, 107);
  ctx.lineTo(98, 116);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Natural proportional neck
  ctx.fillStyle = '#966140';
  ctx.fillRect(69, 92, 22, 14);

  // Realistic adult ears
  ctx.fillStyle = '#9C6644';
  ctx.strokeStyle = '#633B22';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(51.5, 69, 4.5, 8.5, -0.1, 0, Math.PI * 2);
  ctx.ellipse(108.5, 69, 4.5, 8.5, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Realistic sculpted oval-jawed adult male head (clean-shaven South Asian warm brown skin)
  const headGrad = ctx.createRadialGradient(73, 56, 6, 80, 68, 38);
  headGrad.addColorStop(0, '#BC825A');
  headGrad.addColorStop(0.6, '#A66F4B');
  headGrad.addColorStop(1, '#7D4E31');
  ctx.fillStyle = headGrad;
  ctx.strokeStyle = '#4A2B18';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(54, 56);
  ctx.quadraticCurveTo(54, 30, 80, 30);
  ctx.quadraticCurveTo(106, 30, 106, 56);
  ctx.quadraticCurveTo(106, 82, 96, 94);
  ctx.quadraticCurveTo(88, 101, 80, 102);
  ctx.quadraticCurveTo(72, 101, 64, 94);
  ctx.quadraticCurveTo(54, 82, 54, 56);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Neat short dark-black hair with clean side part & temple taper
  ctx.fillStyle = '#181618';
  ctx.beginPath();
  ctx.moveTo(52, 62);
  ctx.quadraticCurveTo(50, 36, 66, 26);
  ctx.quadraticCurveTo(82, 20, 98, 28);
  ctx.quadraticCurveTo(110, 36, 108, 62);
  ctx.lineTo(104, 64);
  ctx.quadraticCurveTo(103, 47, 94, 42);
  ctx.quadraticCurveTo(76, 40, 66, 43);
  ctx.lineTo(64, 38);
  ctx.quadraticCurveTo(58, 45, 56, 64);
  ctx.closePath();
  ctx.fill();

  // Subtle side-part seam & combed dark sheen highlights
  ctx.strokeStyle = '#7D4E31';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(64, 34);
  ctx.lineTo(66, 43);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(70, 30);
  ctx.quadraticCurveTo(84, 28, 96, 35);
  ctx.stroke();

  // Serious authoritative dark eyebrows
  ctx.strokeStyle = '#191413';
  ctx.lineWidth = 2.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(61, 58);
  ctx.quadraticCurveTo(68, 56, 75, 59);
  ctx.moveTo(85, 59);
  ctx.quadraticCurveTo(92, 56, 99, 58);
  ctx.stroke();

  // Natural proportional adult eyes (calm, stern principal look)
  [-1, 1].forEach((side) => {
    const ex = 80 + side * 12;
    const ey = 65;
    ctx.fillStyle = '#F2ECE6';
    ctx.beginPath();
    ctx.ellipse(ex, ey, 5.4, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#24140E';
    ctx.beginPath();
    ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ex - 0.8, ey - 0.8, 0.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#1C1310';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(ex, ey, 5.6, 3.4, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
  });

  // Sculpted adult nose bridge & base
  ctx.strokeStyle = 'rgba(72, 40, 22, 0.45)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(80, 65);
  ctx.lineTo(79, 77);
  ctx.quadraticCurveTo(80, 80, 83.5, 78.5);
  ctx.stroke();

  // Firm neutral mouth
  ctx.strokeStyle = '#4B241A';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(71, 88);
  ctx.quadraticCurveTo(80, 87, 89, 88);
  ctx.stroke();
  ctx.fillStyle = 'rgba(130, 72, 56, 0.35)';
  ctx.beginPath();
  ctx.ellipse(80, 89.5, 7.5, 2.2, 0, 0, Math.PI);
  ctx.fill();
}

/**
 * Stylized realistic 2D portrait of Samyak (Bodybuilder & UPSC/IAS Aspirant):
 * - Broad shirtless muscular shoulders, trapezius & upper pectoral definition (warm-tan skin)
 * - Short dark slightly tousled hair, neatly trimmed full black beard & moustache
 * - Sleek reflective dark square black sunglasses with crisp studio diagonal lens glint
 */
function paintSamyakPortrait(ctx: CanvasRenderingContext2D): void {
  // Dramatic dark slate-to-amber-blue studio athletic portrait backdrop
  const bg = ctx.createRadialGradient(80, 62, 12, 80, 80, 108);
  bg.addColorStop(0, '#334155');
  bg.addColorStop(0.55, '#1E293B');
  bg.addColorStop(1, '#0B1120');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 160, 160);

  // Subtle golden-blue IAS beast-mode rim glow behind shoulders
  const rim = ctx.createRadialGradient(80, 106, 16, 80, 96, 76);
  rim.addColorStop(0, 'rgba(250, 204, 21, 0.34)');
  rim.addColorStop(0.55, 'rgba(56, 189, 248, 0.18)');
  rim.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, 160, 160);

  // Broad shirtless muscular shoulders, deltoids & trapezius (NO shirt/baniyan!)
  const bodyGrad = ctx.createLinearGradient(80, 94, 80, 160);
  bodyGrad.addColorStop(0, '#CFA07D');
  bodyGrad.addColorStop(0.5, '#BC8866');
  bodyGrad.addColorStop(1, '#8D5C3E');
  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = '#4B2B18';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(4, 160);
  ctx.quadraticCurveTo(6, 120, 34, 112);
  ctx.quadraticCurveTo(54, 106, 65, 97);
  ctx.lineTo(95, 97);
  ctx.quadraticCurveTo(106, 106, 126, 112);
  ctx.quadraticCurveTo(154, 120, 156, 160);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Sculpted upper pectoral & deltoid shadow contours
  ctx.strokeStyle = 'rgba(84, 46, 26, 0.48)';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  // Collarbone lines
  ctx.beginPath();
  ctx.moveTo(54, 118);
  ctx.quadraticCurveTo(67, 122, 76, 120);
  ctx.moveTo(106, 118);
  ctx.quadraticCurveTo(93, 122, 84, 120);
  ctx.stroke();

  // Deltoid separation arcs & pectoral cleft
  ctx.beginPath();
  ctx.moveTo(34, 124);
  ctx.quadraticCurveTo(38, 142, 42, 158);
  ctx.moveTo(126, 124);
  ctx.quadraticCurveTo(122, 142, 118, 158);
  ctx.moveTo(80, 134);
  ctx.lineTo(80, 158);
  ctx.stroke();

  // Subtle specular muscle highlights on delts & upper chest
  ctx.fillStyle = 'rgba(255, 228, 200, 0.24)';
  ctx.beginPath();
  ctx.ellipse(24, 130, 12, 8, -0.35, 0, Math.PI * 2);
  ctx.ellipse(136, 130, 12, 8, 0.35, 0, Math.PI * 2);
  ctx.ellipse(62, 142, 14, 7, -0.1, 0, Math.PI * 2);
  ctx.ellipse(98, 142, 14, 7, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Thick athletic neck
  ctx.fillStyle = '#A67252';
  ctx.fillRect(66, 90, 28, 20);

  // Realistic adult ears
  ctx.fillStyle = '#AF7B5A';
  ctx.strokeStyle = '#59341E';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(50, 68, 4.5, 8.5, -0.1, 0, Math.PI * 2);
  ctx.ellipse(110, 68, 4.5, 8.5, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Sculpted young South Asian adult male head
  const headGrad = ctx.createRadialGradient(74, 56, 6, 80, 68, 38);
  headGrad.addColorStop(0, '#D2A17E');
  headGrad.addColorStop(0.6, '#BC8866');
  headGrad.addColorStop(1, '#8D5D3F');
  ctx.fillStyle = headGrad;
  ctx.strokeStyle = '#4B2B18';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(52, 56);
  ctx.quadraticCurveTo(52, 28, 80, 28);
  ctx.quadraticCurveTo(108, 28, 108, 56);
  ctx.quadraticCurveTo(108, 83, 97, 96);
  ctx.quadraticCurveTo(88, 103, 80, 104);
  ctx.quadraticCurveTo(72, 103, 63, 96);
  ctx.quadraticCurveTo(52, 83, 52, 56);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Short dark slightly tousled hair with natural forward fringe strands
  ctx.fillStyle = '#141214';
  ctx.beginPath();
  ctx.moveTo(50, 61);
  ctx.quadraticCurveTo(48, 34, 65, 24);
  ctx.quadraticCurveTo(80, 18, 97, 25);
  ctx.quadraticCurveTo(112, 34, 110, 61);
  ctx.lineTo(106, 63);
  ctx.quadraticCurveTo(104, 46, 95, 42);
  ctx.lineTo(90, 48);
  ctx.lineTo(86, 40);
  ctx.lineTo(78, 49);
  ctx.lineTo(73, 41);
  ctx.lineTo(65, 47);
  ctx.quadraticCurveTo(56, 46, 54, 63);
  ctx.closePath();
  ctx.fill();

  // Subtle dark hair texture highlights
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(64, 29);
  ctx.quadraticCurveTo(80, 25, 96, 32);
  ctx.stroke();

  // Neatly trimmed full black beard along jawline & chin
  ctx.fillStyle = '#151315';
  ctx.beginPath();
  ctx.moveTo(52, 68);
  ctx.quadraticCurveTo(52, 88, 63, 97);
  ctx.quadraticCurveTo(72, 104, 80, 105);
  ctx.quadraticCurveTo(88, 104, 97, 97);
  ctx.quadraticCurveTo(108, 88, 108, 68);
  ctx.lineTo(104, 70);
  ctx.quadraticCurveTo(102, 84, 93, 91);
  ctx.quadraticCurveTo(88, 86, 80, 86);
  ctx.quadraticCurveTo(72, 86, 67, 91);
  ctx.quadraticCurveTo(58, 84, 56, 70);
  ctx.closePath();
  ctx.fill();

  // Chin beard fullness & trimmed moustache
  ctx.beginPath();
  ctx.ellipse(80, 96, 13, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(68, 85);
  ctx.quadraticCurveTo(74, 80, 80, 82);
  ctx.quadraticCurveTo(86, 80, 92, 85);
  ctx.quadraticCurveTo(86, 84, 80, 84.5);
  ctx.quadraticCurveTo(74, 84, 68, 85);
  ctx.closePath();
  ctx.fill();

  // Sculpted nose below sunglasses bridge
  ctx.strokeStyle = 'rgba(72, 38, 22, 0.5)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(80, 68);
  ctx.lineTo(78.5, 76.5);
  ctx.quadraticCurveTo(80, 79, 83.5, 77);
  ctx.stroke();

  // Confident composed mouth
  ctx.strokeStyle = '#5B2920';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(72, 88.5);
  ctx.quadraticCurveTo(80, 90, 88, 87.8);
  ctx.stroke();

  // Sleek dark SQUARE BLACK SUNGLASSES with metallic reflective lenses!
  ctx.fillStyle = '#090B0E';
  ctx.strokeStyle = '#27272A';
  ctx.lineWidth = 1.8;
  // Left square rim
  ctx.beginPath();
  ctx.roundRect(53.5, 54.5, 24, 16.5, 2.5);
  ctx.fill();
  ctx.stroke();
  // Right square rim
  ctx.beginPath();
  ctx.roundRect(82.5, 54.5, 24, 16.5, 2.5);
  ctx.fill();
  ctx.stroke();
  // Top bar & nose bridge
  ctx.fillRect(76, 56, 8, 3.6);
  ctx.fillRect(50, 56, 4.5, 3);
  ctx.fillRect(105.5, 56, 4.5, 3);

  // Reflective dark-tinted lens gradient + sharp anime diagonal glint
  [55.5, 84.5].forEach((lx) => {
    const lGrad = ctx.createLinearGradient(lx, 56, lx + 20, 70);
    lGrad.addColorStop(0, '#1E293B');
    lGrad.addColorStop(0.45, '#090D16');
    lGrad.addColorStop(1, '#1E293B');
    ctx.fillStyle = lGrad;
    ctx.fillRect(lx, 56.5, 20, 12.5);

    ctx.fillStyle = 'rgba(224, 242, 254, 0.45)';
    ctx.beginPath();
    ctx.moveTo(lx + 3, 56.5);
    ctx.lineTo(lx + 9, 56.5);
    ctx.lineTo(lx + 3, 66.5);
    ctx.lineTo(lx, 66.5);
    ctx.closePath();
    ctx.fill();
  });

  // Crisp star glint on sunglasses corner
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(99, 53);
  ctx.lineTo(100.6, 58.2);
  ctx.lineTo(105.8, 59.5);
  ctx.lineTo(100.6, 60.8);
  ctx.lineTo(99, 66);
  ctx.lineTo(97.4, 60.8);
  ctx.lineTo(92.2, 59.5);
  ctx.lineTo(97.4, 58.2);
  ctx.closePath();
  ctx.fill();
}

function paintPrincipalPortrait(ctx: CanvasRenderingContext2D): void {
  const bg = ctx.createRadialGradient(80, 66, 12, 80, 80, 108);
  bg.addColorStop(0, '#334155');
  bg.addColorStop(0.55, '#1E293B');
  bg.addColorStop(1, '#0F172A');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 160, 160);

  // Golden-orange discipline rim halo
  const rim = ctx.createRadialGradient(80, 86, 16, 80, 80, 74);
  rim.addColorStop(0, 'rgba(249, 115, 22, 0.34)');
  rim.addColorStop(1, 'rgba(249, 115, 22, 0)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, 160, 160);

  // White cassock shoulders + Powder-Blue Nehru vest (#7EC4E6)
  ctx.fillStyle = '#F0F2F5';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(12, 160);
  ctx.quadraticCurveTo(18, 114, 56, 104);
  ctx.lineTo(104, 104);
  ctx.quadraticCurveTo(142, 114, 148, 160);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#7EC4E6';
  ctx.strokeStyle = '#1E4E75';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(34, 160);
  ctx.lineTo(44, 108);
  ctx.lineTo(116, 108);
  ctx.lineTo(126, 160);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Left chest pocket + dark metallic pen
  ctx.fillStyle = '#3B8EC0';
  ctx.fillRect(90, 126, 20, 18);
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(98, 114, 4, 14);
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(98, 112, 4, 3);

  // Standing crisp white collar
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(64, 96, 32, 14);

  // Neck & caricature head
  ctx.fillStyle = '#9F6745';
  ctx.fillRect(68, 88, 24, 14);

  ctx.fillStyle = '#B57853';
  ctx.strokeStyle = '#4A2B18';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(80, 62, 29, 36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Hair with silver-gray temples
  ctx.fillStyle = '#18181B';
  ctx.beginPath();
  ctx.moveTo(50, 56);
  ctx.quadraticCurveTo(50, 22, 80, 20);
  ctx.quadraticCurveTo(110, 22, 110, 56);
  ctx.quadraticCurveTo(104, 38, 80, 38);
  ctx.quadraticCurveTo(56, 38, 50, 56);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(54, 44);
  ctx.lineTo(54, 58);
  ctx.moveTo(106, 44);
  ctx.lineTo(106, 58);
  ctx.stroke();

  // Expressive caricature brows & eyes
  ctx.strokeStyle = '#141111';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(59, 52);
  ctx.quadraticCurveTo(67, 46, 75, 51);
  ctx.moveTo(85, 51);
  ctx.quadraticCurveTo(93, 46, 101, 52);
  ctx.stroke();

  [-1, 1].forEach((side) => {
    const ex = 80 + side * 12;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(ex, 60, 6, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#24140E';
    ctx.beginPath();
    ctx.arc(ex, 60, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ex - 0.8, 59, 1.0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Confident cheeky smirk
  ctx.strokeStyle = '#441E16';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(68, 80);
  ctx.quadraticCurveTo(81, 86, 92, 76);
  ctx.stroke();
}

function paintAdiPortrait(ctx: CanvasRenderingContext2D): void {
  // Deep slate-olive arcade studio backdrop with energetic lime-gold rim glow
  const bg = ctx.createRadialGradient(80, 66, 12, 80, 82, 108);
  bg.addColorStop(0, '#365314');
  bg.addColorStop(0.55, '#1e293b');
  bg.addColorStop(1, '#090d16');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 160, 160);

  const rim = ctx.createRadialGradient(80, 82, 16, 80, 80, 74);
  rim.addColorStop(0, 'rgba(132, 204, 22, 0.34)');
  rim.addColorStop(1, 'rgba(132, 204, 22, 0)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, 160, 160);

  // Inner Olive-Green Graphic T-Shirt (#4b5338)
  ctx.fillStyle = '#4b5338';
  ctx.beginPath();
  ctx.moveTo(22, 160);
  ctx.quadraticCurveTo(28, 114, 58, 106);
  ctx.lineTo(102, 106);
  ctx.quadraticCurveTo(132, 114, 138, 160);
  ctx.closePath();
  ctx.fill();

  // Subtle dark front chest graphic block on olive t-shirt
  ctx.fillStyle = '#1f2419';
  ctx.fillRect(62, 125, 36, 22);
  ctx.fillStyle = '#a3e635';
  ctx.fillRect(66, 130, 28, 3);
  ctx.fillStyle = '#d6d3d1';
  ctx.fillRect(68, 136, 24, 3);
  ctx.fillRect(72, 141, 16, 2.5);

  // Open Checked Plaid Shirt panels framing both sides (charcoal + ochre/tan + slate-blue check)
  const drawPlaidPanel = (leftSide: boolean) => {
    ctx.save();
    ctx.beginPath();
    if (leftSide) {
      ctx.moveTo(14, 160);
      ctx.quadraticCurveTo(20, 112, 54, 104);
      ctx.lineTo(63, 106);
      ctx.lineTo(57, 160);
    } else {
      ctx.moveTo(146, 160);
      ctx.quadraticCurveTo(140, 112, 106, 104);
      ctx.lineTo(97, 106);
      ctx.lineTo(103, 160);
    }
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = '#2d333b';
    ctx.fillRect(10, 100, 140, 62);
    // Ochre/tan & slate-blue plaid cross-stripes
    ctx.fillStyle = 'rgba(166, 136, 91, 0.72)';
    for (let x = 14; x < 150; x += 14) ctx.fillRect(x, 100, 4, 62);
    for (let y = 104; y < 160; y += 14) ctx.fillRect(10, y, 140, 4);
    ctx.fillStyle = 'rgba(100, 124, 144, 0.65)';
    for (let x = 21; x < 150; x += 14) ctx.fillRect(x, 100, 3, 62);
    for (let y = 111; y < 160; y += 14) ctx.fillRect(10, y, 140, 3);
    ctx.restore();

    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (leftSide) {
      ctx.moveTo(63, 106);
      ctx.lineTo(57, 160);
    } else {
      ctx.moveTo(97, 106);
      ctx.lineTo(103, 160);
    }
    ctx.stroke();
  };
  drawPlaidPanel(true);
  drawPlaidPanel(false);

  // Crew-neck olive trim + neck
  ctx.fillStyle = '#a8724e';
  ctx.fillRect(68, 90, 24, 18);
  ctx.strokeStyle = '#363d28';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(80, 105, 15, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  // Youthful sculpted head
  ctx.fillStyle = '#c8916a';
  ctx.strokeStyle = '#4a2b18';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(80, 64, 27, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Stylish dark textured hair with side-swept top volume
  ctx.fillStyle = '#141316';
  ctx.beginPath();
  ctx.moveTo(51, 60);
  ctx.quadraticCurveTo(48, 22, 80, 18);
  ctx.quadraticCurveTo(112, 22, 109, 60);
  ctx.quadraticCurveTo(102, 41, 86, 40);
  ctx.quadraticCurveTo(72, 34, 57, 45);
  ctx.closePath();
  ctx.fill();

  // Subtle hair highlight streak
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(64, 27);
  ctx.quadraticCurveTo(80, 22, 95, 29);
  ctx.stroke();

  // Sharp brows & confident eyes
  ctx.strokeStyle = '#181415';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(59, 53);
  ctx.lineTo(74, 55);
  ctx.moveTo(101, 53);
  ctx.lineTo(86, 55);
  ctx.stroke();

  [-1, 1].forEach((side) => {
    const ex = 80 + side * 12;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(ex, 62, 5.8, 3.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#231712';
    ctx.beginPath();
    ctx.arc(ex, 62, 2.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ex - 0.8, 61, 1, 0, Math.PI * 2);
    ctx.fill();
  });

  // Cool smirk
  ctx.strokeStyle = '#4a1f18';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(69, 81);
  ctx.quadraticCurveTo(81, 86, 92, 77);
  ctx.stroke();
}

function paintKrishPortrait(ctx: CanvasRenderingContext2D): void {
  // Warm olive-charcoal studio backdrop with energetic olive-gold rim glow
  const bg = ctx.createRadialGradient(80, 66, 12, 80, 82, 108);
  bg.addColorStop(0, '#4d5c32');
  bg.addColorStop(0.55, '#27272a');
  bg.addColorStop(1, '#0c0d10');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 160, 160);

  const rim = ctx.createRadialGradient(80, 82, 16, 80, 80, 74);
  rim.addColorStop(0, 'rgba(132, 204, 22, 0.28)');
  rim.addColorStop(1, 'rgba(132, 204, 22, 0)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, 160, 160);

  // Stockier Olive-Green Crew-Neck Sweatshirt shoulders (#4f5939 / #586340)
  ctx.fillStyle = '#4f5939';
  ctx.strokeStyle = '#1f2416';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(10, 160);
  ctx.quadraticCurveTo(18, 110, 56, 102);
  ctx.lineTo(104, 102);
  ctx.quadraticCurveTo(142, 110, 150, 160);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Ribbed crew-neck collar + front V-stitch detail
  ctx.strokeStyle = '#363e26';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(80, 104, 18, 0.14 * Math.PI, 0.86 * Math.PI);
  ctx.stroke();
  ctx.strokeStyle = '#2d341f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(73, 121);
  ctx.lineTo(80, 134);
  ctx.lineTo(87, 121);
  ctx.stroke();

  // Dark padded backpack strap running over Krish's right shoulder (viewer's left side)
  ctx.fillStyle = '#1f2228';
  ctx.strokeStyle = '#090a0d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(42, 106);
  ctx.lineTo(56, 104);
  ctx.lineTo(48, 160);
  ctx.lineTo(32, 160);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Neck
  ctx.fillStyle = '#a4704d';
  ctx.fillRect(66, 88, 28, 18);

  // Slightly fuller rounded head
  ctx.fillStyle = '#c28b67';
  ctx.strokeStyle = '#4a2b18';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(80, 64, 30, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Neat short dark hair
  ctx.fillStyle = '#151417';
  ctx.beginPath();
  ctx.moveTo(49, 58);
  ctx.quadraticCurveTo(48, 22, 80, 20);
  ctx.quadraticCurveTo(112, 22, 111, 58);
  ctx.quadraticCurveTo(102, 41, 80, 39);
  ctx.quadraticCurveTo(58, 41, 49, 58);
  ctx.closePath();
  ctx.fill();

  // Thick brows & expressive eyes
  ctx.strokeStyle = '#181415';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(58, 53);
  ctx.lineTo(74, 55);
  ctx.moveTo(102, 53);
  ctx.lineTo(86, 55);
  ctx.stroke();

  [-1, 1].forEach((side) => {
    const ex = 80 + side * 12.5;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(ex, 62, 5.8, 3.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#231712';
    ctx.beginPath();
    ctx.arc(ex, 62, 2.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ex - 0.8, 61, 1, 0, Math.PI * 2);
    ctx.fill();
  });

  // Confident brawler grin
  ctx.strokeStyle = '#4a1f18';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(67, 81);
  ctx.quadraticCurveTo(80, 88, 93, 79);
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

  switch (id) {
    case 'sheru':
      paintSheruLionPortrait(ctx);
      break;
    case 'billa':
      paintBlueBillaPortrait(ctx);
      break;
    case 'neta':
      paintNetaPortrait(ctx);
      break;
    case 'anda':
      paintAndaPortrait(ctx);
      break;
    case 'mausi':
      paintMausiPortrait(ctx);
      break;
    case 'father':
      paintPrincipalPortrait(ctx);
      break;
    case 'samyak':
      paintSamyakPortrait(ctx);
      break;
    case 'adi':
      paintAdiPortrait(ctx);
      break;
    case 'krish':
      paintKrishPortrait(ctx);
      break;
  }

  const url = canvas.toDataURL('image/png');
  portraitCache.set(id, url);
  return url;
}
