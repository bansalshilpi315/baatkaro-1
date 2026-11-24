import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatchState } from '../combat';
import {
  applyEase,
  computeCombatPose,
  computeGuardPose,
  evalStrikeCurve,
  getActiveStrikeTrailInfo,
  getFighterKinematicScale,
  sampleKeyframeTrack,
  type PoseKeyframe,
} from './kinematics';

test('applyEase and sampleKeyframeTrack interpolate smoothly with impact holds', () => {
  assert.equal(applyEase(0, 'easeOutExpo'), 0);
  assert.equal(applyEase(1, 'easeOutExpo'), 1);
  assert.ok(applyEase(0.3, 'easeOutExpo') > applyEase(0.3, 'easeInQuad'));
  assert.equal(applyEase(0.5, 'hold'), 0);
  assert.equal(applyEase(1.0, 'hold'), 1);

  const base = computeGuardPose('sheru', 0, 0, 1.0, false, 1);
  const track: PoseKeyframe[] = [
    { t: 0.0, pose: { lElbX: -1.66 } },
    { t: 0.3, ease: 'easeOutExpo', pose: { lElbX: -0.08 } },
    { t: 0.5, ease: 'hold', pose: { lElbX: -0.08 } },
    { t: 1.0, ease: 'smooth', pose: { lElbX: -1.66 } },
  ];
  const heldA = sampleKeyframeTrack(base, track, 0.34);
  const heldB = sampleKeyframeTrack(base, track, 0.48);
  assert.ok(Math.abs(heldA.lElbX - -0.08) < 1e-4, 'Impact pose should hold crisp at extension');
  assert.ok(Math.abs(heldB.lElbX - -0.08) < 1e-4, 'Impact hold plateau must remain flat');
  const recovered = sampleKeyframeTrack(base, track, 1.0);
  assert.ok(Math.abs(recovered.lElbX - -1.66) < 1e-4, 'Track should recover smoothly to guard');
});

test('evalStrikeCurve progresses cleanly through Wind-Up -> Snappy Strike -> Recovery', () => {
  const wind = evalStrikeCurve(0.12);
  assert.ok(wind.windup > 0.25 && wind.strike === 0 && wind.recover === 0);

  const impact = evalStrikeCurve(0.55);
  assert.ok(impact.strike > 0.9 && impact.recover === 0);

  const rec = evalStrikeCurve(0.95);
  assert.ok(rec.recover > 0.9 && rec.strike < 0.1);
});

test('computeGuardPose establishes authentic Kung-Fu stance (~25° knees, ~35° torso, ~95° elbows) for both P1 and CPU', () => {
  const p1 = computeGuardPose('sheru', 0, 0.5, 1.0, false, 1);
  const p2 = computeGuardPose('billa', 1, 0.5, 1.0, false, -1);

  // Elbows bent ~95° (~-1.66 rad) holding fists up near chin/chest
  assert.ok(p1.lElbX < -1.5 && p1.rElbX < -1.55, 'P1 elbows should be bent ~95° in high guard');
  assert.ok(p1.lShX < -0.9 && p1.rShX < -0.85, 'P1 arms should be raised forward');

  // Lowered pelvis, front foot forward, rear foot angled, both knees bent ~25° (~0.44 rad)
  assert.ok(p1.pelvisY < 1.0, 'Pelvis should sit slightly lowered in kung-fu guard');
  assert.ok(p1.lHipX < -0.28 && p1.rHipX > 0.22, 'Front and rear feet should be planted apart');
  assert.ok(p1.lKneeX > 0.35 && p1.rKneeX > 0.35, 'Both knees must be bent ~25°');
  assert.ok(Math.abs(p1.rHipY) > 0.2, 'Rear foot should angle outward for grounded base');

  // Facing-symmetric torso yaw ~35° (~0.61 rad) open toward camera (+Z)
  assert.ok(p1.torsoRotY < -0.45, `P1 torso yaw should angle ~35° open, got ${p1.torsoRotY}`);
  assert.ok(p2.torsoRotY > 0.45, `CPU torso yaw should mirror open ~35°, got ${p2.torsoRotY}`);
  assert.ok(p1.headRotY > 0.35 && p2.headRotY < -0.35, 'Heads should track opponent across angled torso');

  // Proportion scaling for Anda Bhai & Laddoo Mausi avoids limb clipping
  const andaScale = getFighterKinematicScale('anda', true);
  const mausiScale = getFighterKinematicScale('mausi', false);
  assert.ok(andaScale.guardSpread > 0.1 && andaScale.limbReach < 1.0);
  assert.ok(mausiScale.guardSpread > 0.08 && mausiScale.twistScale < 1.0);
});

test('3-hit punch combo executes Lead Jab (95°->5°) -> Power Cross (~55° twist) -> Rising Uppercut (dip -> curved 90°)', () => {
  const match = createMatchState('sheru', 'billa', true);
  const f = match.fighters[0];
  f.action = 'punch';

  // Hit 1: Lead Jab — lead elbow snaps 95° -> ~5° (-0.08 rad), rear hand glued to chin
  f.comboStep = 0;
  f.actionDuration = 0.29;
  f.actionTimer = 0.12; // ~0.41 progress (in impact hold)
  const jab = computeCombatPose(f, 1.0, 1.0, false);
  assert.ok(jab.lElbX > -0.15, `Lead jab elbow must snap nearly straight (~5°), got ${jab.lElbX}`);
  assert.ok(jab.rElbX < -1.65, `Lead jab rear fist must stay glued at chin, got ${jab.rElbX}`);
  assert.ok(jab.torsoRotY > 0.35, `Lead jab should twist torso cleanly, got ${jab.torsoRotY}`);

  // Hit 2: Twisting Power Cross — ~55° torso rotation (-0.96 rad), rear elbow straight, deep front lunge
  f.comboStep = 1;
  f.actionDuration = 0.34;
  f.actionTimer = 0.16; // ~0.47 progress (in impact hold)
  const cross = computeCombatPose(f, 1.0, 1.0, false);
  assert.ok(cross.rElbX > -0.15, `Power cross rear elbow must snap straight, got ${cross.rElbX}`);
  assert.ok(cross.torsoRotY < -0.85, `Power cross must twist torso ~55°, got ${cross.torsoRotY}`);
  assert.ok(cross.lKneeX > 0.7 && cross.lHipX < -0.55, 'Power cross should lunge deeply onto bent front knee');

  // Hit 3: Rising Uppercut — deep pelvis dip on windup -> explosive skyward drive with curved ~90° elbow
  f.comboStep = 2;
  f.actionDuration = 0.44;
  f.actionTimer = 0.095; // ~0.22 progress (deep knee dip)
  const dip = computeCombatPose(f, 1.0, 1.0, false);
  f.actionTimer = 0.23; // ~0.52 progress (impact hold)
  const uppercut = computeCombatPose(f, 1.0, 1.0, false);
  assert.ok(dip.pelvisY < uppercut.pelvisY - 0.3, 'Uppercut must dip pelvis low then explode upward');
  assert.ok(uppercut.rShX < -2.35, 'Uppercut shoulder must drive skyward');
  assert.ok(
    uppercut.rElbX < -1.35 && uppercut.rElbX > -1.75,
    `Uppercut elbow must hold curved ~90° hook, got ${uppercut.rElbX}`,
  );
  assert.ok(uppercut.torsoRotX < -0.25, 'Uppercut must arch torso explosively upward');
});

test('3-hit Kung-Fu kick combo covers Chambered Front Snap -> Side/Roundhouse (~80° pivot) -> Jump Spinning Kick, plus Low Sweep', () => {
  const match = createMatchState('sheru', 'billa', true);
  const f = match.fighters[0];
  f.action = 'kick';

  // Hit 1: Chambered Front Snap Kick (Phase 1 chamber ~110° -> Phase 2 snap ~0° -> Phase 3 rechamber)
  f.comboStep = 0;
  f.actionDuration = 0.44;
  f.actionTimer = 0.097; // t=0.22 (chamber peak ~110°)
  const chamber = computeCombatPose(f, 1.0, 1.0, false);
  f.actionTimer = 0.19; // t=0.43 (impact hold)
  const snap = computeCombatPose(f, 1.0, 1.0, false);
  f.actionTimer = 0.32; // t=0.73 (rechamber)
  const rechamber = computeCombatPose(f, 1.0, 1.0, false);
  assert.ok(chamber.rKneeX > 1.85, `Front snap Phase 1 must chamber knee ~110°, got ${chamber.rKneeX}`);
  assert.ok(snap.rKneeX < 0.08 && snap.rHipX < -1.65, 'Front snap Phase 2 must whip knee straight out');
  assert.ok(snap.torsoRotX < -0.35, 'Front snap must lean torso back ~25° for counter-balance');
  assert.ok(rechamber.rKneeX > 1.5, 'Front snap Phase 3 must fold knee back into rechamber before landing');

  // Hit 2: Side / Roundhouse Kick (pelvis pivots ~80° open toward camera, torso leans away ~35°, horizontal straight leg)
  f.comboStep = 1;
  f.actionDuration = 0.43;
  f.actionTimer = 0.21; // t=0.49 (impact hold)
  const roundhouse = computeCombatPose(f, 1.0, 1.0, false);
  assert.ok(
    roundhouse.pelvisRotY < -1.25,
    `Roundhouse must pivot pelvis ~80° open toward camera, got ${roundhouse.pelvisRotY}`,
  );
  assert.ok(
    roundhouse.torsoRotZ > 0.5,
    `Roundhouse must lean torso away ~35°, got ${roundhouse.torsoRotZ}`,
  );
  assert.ok(
    roundhouse.rKneeX < 0.1 && roundhouse.rHipZ > 1.45,
    `Roundhouse kicking leg must whip horizontally straight toward opponent, got rHipZ=${roundhouse.rHipZ}`,
  );

  // Hit 3: Jumping Spinning Kick (airborne spin + extended kicking leg + tucked support knee)
  f.comboStep = 2;
  f.actionDuration = 0.50;
  f.actionTimer = 0.26; // t=0.52 (impact hold)
  const jumpSpin = computeCombatPose(f, 1.0, 1.0, false);
  assert.ok(jumpSpin.pelvisY > 1.15, 'Jumping spinning kick must hop cleanly off ground');
  assert.ok(Math.abs(jumpSpin.pelvisRotY) > 1.0, 'Jumping spinning kick must spin pelvis mid-air');
  assert.ok(jumpSpin.rKneeX < 0.1 && jumpSpin.lKneeX > 1.4, 'Jump spin extends striking leg & tucks support knee');

  // Dedicated Low Kung-Fu Sweep (Down + Kick): near-floor pelvis, tucked knee, balancing hand, straight sweep leg
  f.action = 'sweep';
  f.comboStep = 0;
  f.actionDuration = 0.46;
  f.actionTimer = 0.21; // t=0.46 (impact hold)
  const lowSweep = computeCombatPose(f, 1.0, 1.0, false);
  assert.ok(lowSweep.pelvisY < 0.52, `Low kung-fu sweep must drop pelvis near floor, got ${lowSweep.pelvisY}`);
  assert.ok(lowSweep.lKneeX >= 1.75, `Low kung-fu sweep must tuck support knee deeply, got ${lowSweep.lKneeX}`);
  assert.ok(lowSweep.rKneeX < 0.1 && lowSweep.rHipZ > 1.1, 'Low kung-fu sweep must whip extended leg straight along floor');
  assert.ok(lowSweep.lElbX > -0.35, 'Low kung-fu sweep must extend balancing hand down toward floor');
});

test('Grab 180° hip-throw, knockdown flat on back, 2-stage get-up, and active strike trail tracking work cleanly', () => {
  const match = createMatchState('anda', 'mausi', true);
  const f = match.fighters[0];

  // Grab clinch lunge vs whiff recoil
  f.action = 'grab';
  f.actionDuration = 0.44;
  f.actionTimer = 0.13; // t=0.30
  const lunge = computeCombatPose(f, 1.0, 1.0, true);
  f.actionTimer = 0.30; // t=0.68
  const whiff = computeCombatPose(f, 1.0, 1.0, true);
  assert.ok(lunge.pelvisX > 0.16 && lunge.lElbX > -0.45, 'Grab clinch should reach forward with both arms');
  assert.ok(whiff.torsoRotX < lunge.torsoRotX - 0.15, 'Grab whiff should show clear recoil');

  // Grab Hold -> 180° Hip-Throw pivot (t=0.54) -> Violent Slam Finish (t=0.74)!
  f.action = 'grab_hold';
  f.actionDuration = 0.50;
  f.actionTimer = 0.27; // t=0.54 (180° hip-throw hoist)
  const hipThrow = computeCombatPose(f, 1.0, 1.0, false);
  assert.ok(
    Math.abs(hipThrow.pelvisRotY) > 2.5,
    `Hip-throw must pivot pelvis ~180° (π rad), got ${hipThrow.pelvisRotY}`,
  );
  f.actionTimer = 0.37; // t=0.74 (explosive slam finish)
  const slamFinish = computeCombatPose(f, 1.0, 1.0, false);
  assert.ok(slamFinish.torsoRotX > 0.55, 'Hip-throw slam must drive torso forward to slam opponent');

  // Knockdown grounded flat on back
  f.action = 'knockdown';
  f.y = 0;
  f.actionTimer = 0.5;
  const flat = computeCombatPose(f, 1.0, 1.0, true);
  assert.ok(flat.pelvisRotX < -1.4, 'Grounded knockdown must lie flat on back');

  // 2-Stage Get-Up: Stage 1 push onto bent knees/hands -> Stage 2 rise back to kung-fu guard
  f.action = 'getup';
  f.actionDuration = 0.56;
  f.actionTimer = 0.28; // t=0.50 (Stage 1 crouch push-up)
  const stage1 = computeCombatPose(f, 1.0, 1.0, true);
  f.actionTimer = 0.55; // t=0.98 (Stage 2 standing guard)
  const stage2 = computeCombatPose(f, 1.0, 1.0, true);
  assert.ok(stage1.lKneeX > 1.3 && stage1.torsoRotX > 0.5, 'Get-up Stage 1 must push onto bent knees/hands');
  assert.ok(stage2.pelvisY > stage1.pelvisY + 0.18, 'Get-up Stage 2 must rise cleanly back into kung-fu guard');
  assert.ok(stage2.lElbX < -1.4 && stage2.rElbX < -1.4, 'Get-up Stage 2 must restore raised fists guard');

  // Active strike trail limb selection across punches, kicks, sweeps, and idle
  f.action = 'idle';
  assert.equal(getActiveStrikeTrailInfo(f).limb, null);

  f.action = 'punch';
  f.comboStep = 0;
  f.actionDuration = 0.29;
  f.actionTimer = 0.11;
  assert.equal(getActiveStrikeTrailInfo(f).limb, 'leftFist');

  f.comboStep = 1;
  f.actionDuration = 0.34;
  f.actionTimer = 0.14;
  assert.equal(getActiveStrikeTrailInfo(f).limb, 'rightFist');

  f.action = 'kick';
  f.comboStep = 1;
  f.actionDuration = 0.43;
  f.actionTimer = 0.19;
  assert.equal(getActiveStrikeTrailInfo(f).limb, 'rightFoot');

  f.action = 'sweep';
  f.actionDuration = 0.46;
  f.actionTimer = 0.20;
  assert.equal(getActiveStrikeTrailInfo(f).limb, 'rightFoot');
});
