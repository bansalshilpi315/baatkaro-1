import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatchState } from '../combat';
import {
  computeCombatPose,
  computeGuardPose,
  evalStrikeCurve,
  getFighterKinematicScale,
} from './kinematics';

test('evalStrikeCurve progresses cleanly through Wind-Up -> Snappy Strike -> Recovery', () => {
  const wind = evalStrikeCurve(0.12);
  assert.ok(wind.windup > 0.4 && wind.strike === 0 && wind.recover === 0);

  const impact = evalStrikeCurve(0.55);
  assert.ok(impact.strike > 0.9 && impact.recover === 0);

  const rec = evalStrikeCurve(0.95);
  assert.ok(rec.recover > 0.9 && rec.strike < 0.1);
});

test('computeGuardPose establishes bent-knee split stance, raised fists, and camera-open torso for both P1 and CPU', () => {
  const p1 = computeGuardPose('sheru', 0, 0.5, 1.0, false, 1);
  const p2 = computeGuardPose('billa', 1, 0.5, 1.0, false, -1);

  // Raised fists near chest/chin (both elbows sharply bent, shoulders lifted forward)
  assert.ok(p1.lElbX < -1.3 && p1.rElbX < -1.5, 'P1 elbows should be tucked in high guard');
  assert.ok(p1.lShX < -0.9 && p1.rShX < -0.8, 'P1 arms should be raised forward');

  // Split feet & athletic knee bend
  assert.ok(p1.lHipX < -0.2 && p1.rHipX > 0.2, 'Front and rear legs should be planted apart');
  assert.ok(p1.lKneeX > 0.25 && p1.rKneeX > 0.25, 'Knees must be athletically bent');

  // Facing-symmetric torso yaw so both P1 and CPU open ~30° toward camera (+Z)
  assert.ok(p1.torsoRotY < -0.2, 'P1 torso yaw should open toward camera');
  assert.ok(p2.torsoRotY > 0.2, 'CPU torso yaw should mirror open toward camera');
  assert.ok(p1.headRotY > 0.2 && p2.headRotY < -0.2, 'Heads should look across angled torsos at opponent');

  // Proportion scaling for Anda Bhai & Laddoo Mausi avoids limb clipping
  const andaScale = getFighterKinematicScale('anda', true);
  const mausiScale = getFighterKinematicScale('mausi', false);
  assert.ok(andaScale.guardSpread > 0.1 && andaScale.limbReach < 1.0);
  assert.ok(mausiScale.guardSpread > 0.08 && mausiScale.twistScale < 1.0);
});

test('3-hit punch kinematics drive distinct Jab -> Power Cross -> Rising Uppercut poses', () => {
  const match = createMatchState('sheru', 'billa', true);
  const f = match.fighters[0];
  f.action = 'punch';
  f.actionDuration = 0.28;

  // Hit 1: Quick Jab (front arm straight, rear hand stays tucked at chin)
  f.comboStep = 0;
  f.actionTimer = 0.15;
  const jab = computeCombatPose(f, 1.0, 1.0, false);
  assert.ok(jab.lElbX > -0.2, `Jab front arm should extend straight, got lElbX=${jab.lElbX}`);
  assert.ok(jab.rElbX < -1.5, `Jab rear hand must stay tucked at chin, got rElbX=${jab.rElbX}`);
  assert.ok(jab.torsoRotY > 0.3, `Jab should twist torso ~25°, got torsoRotY=${jab.torsoRotY}`);

  // Hit 2: Power Cross (rear arm straight, ~45° torso twist, front leg lunge)
  f.comboStep = 1;
  f.actionDuration = 0.32;
  f.actionTimer = 0.17;
  const cross = computeCombatPose(f, 1.0, 1.0, false);
  assert.ok(cross.rElbX > -0.2, `Cross rear arm should extend straight, got rElbX=${cross.rElbX}`);
  assert.ok(cross.torsoRotY < -0.65, `Cross should rotate torso ~45°, got torsoRotY=${cross.torsoRotY}`);
  assert.ok(cross.lHipX < -0.5, 'Cross should lunge forward on front leg');

  // Hit 3: Heavy Rising Uppercut (knee dip on windup -> explosive upward extension on strike)
  f.comboStep = 2;
  f.actionDuration = 0.42;
  f.actionTimer = 0.08;
  const dip = computeCombatPose(f, 1.0, 1.0, false);
  f.actionTimer = 0.25;
  const uppercut = computeCombatPose(f, 1.0, 1.0, false);
  assert.ok(dip.pelvisY < uppercut.pelvisY - 0.18, 'Uppercut must dip knees first then drive upward');
  assert.ok(uppercut.rShX < -2.3, 'Uppercut fist should explode upward');
  assert.ok(uppercut.torsoRotX < -0.2, 'Uppercut should lean upper body back explosively');
});

test('Kick kinematics cover High Snap Kick, 2nd-Combo Low Sweep, and 3rd-Combo Jump-Kick Finisher', () => {
  const match = createMatchState('sheru', 'billa', true);
  const f = match.fighters[0];
  f.action = 'kick';

  // Hit 1: High Snap Kick (chamber -> straight snap + counter-balance lean + tucked arms)
  f.comboStep = 0;
  f.actionDuration = 0.34;
  f.actionTimer = 0.06;
  const chamber = computeCombatPose(f, 1.0, 1.0, false);
  f.actionTimer = 0.19;
  const snap = computeCombatPose(f, 1.0, 1.0, false);
  assert.ok(chamber.rKneeX > 1.2, 'High kick windup must chamber knee tightly');
  assert.ok(snap.rKneeX < 0.15 && snap.rHipX < -1.6, 'High kick strike must snap straight out high');
  assert.ok(snap.torsoRotX < -0.25, 'High kick must lean upper torso back for counter-balance');
  assert.ok(snap.lElbX < -1.4 && snap.rElbX < -1.3, 'Arms must stay tucked for balance during kick');

  // Hit 2: Low Sweep Kick (drops low into crouch, sweeps extended leg horizontally)
  f.comboStep = 1;
  f.actionDuration = 0.40;
  f.actionTimer = 0.23;
  const sweep = computeCombatPose(f, 1.0, 1.0, false);
  assert.ok(sweep.pelvisY < 0.65, `Low sweep must drop pelvis low, got ${sweep.pelvisY}`);
  assert.ok(sweep.rKneeX < 0.15 && sweep.rHipZ > 0.4, 'Low sweep must extend leg horizontally along floor');

  // Hit 3: Jump-Kick Finisher (forward hop + extended kicking leg + tucked support leg)
  f.comboStep = 2;
  f.actionDuration = 0.44;
  f.actionTimer = 0.24;
  const jumpKick = computeCombatPose(f, 1.0, 1.0, false);
  assert.ok(jumpKick.pelvisY > 1.15, '3rd kick finisher must include brisk aerial hop');
  assert.ok(jumpKick.rKneeX < 0.15 && jumpKick.lKneeX > 1.2, 'Jump kick extends kicking leg & tucks support leg');
});

test('Grab clinch/whiff, knockdown flat on back, and 2-stage get-up transition cleanly', () => {
  const match = createMatchState('anda', 'mausi', true);
  const f = match.fighters[0];

  // Grab clinch lunge vs whiff recoil
  f.action = 'grab';
  f.actionDuration = 0.40;
  f.actionTimer = 0.16;
  const lunge = computeCombatPose(f, 1.0, 1.0, true);
  f.actionTimer = 0.28;
  const whiff = computeCombatPose(f, 1.0, 1.0, true);
  assert.ok(lunge.pelvisX > 0.18 && lunge.lElbX > -0.5, 'Grab clinch should lunge forward reaching both arms');
  assert.ok(whiff.torsoRotX < lunge.torsoRotX - 0.15, 'Grab whiff should show clear recoil');

  // Knockdown grounded flat on back
  f.action = 'knockdown';
  f.y = 0;
  f.actionTimer = 0.5;
  const flat = computeCombatPose(f, 1.0, 1.0, true);
  assert.ok(flat.pelvisRotX < -1.4, 'Grounded knockdown must lie flat on back');

  // 2-Stage Get-Up: Stage 1 tucked crouch push-up -> Stage 2 rise back to guard
  f.action = 'getup';
  f.actionDuration = 0.56;
  f.actionTimer = 0.26; // End of Stage 1
  const stage1 = computeCombatPose(f, 1.0, 1.0, true);
  f.actionTimer = 0.54; // End of Stage 2
  const stage2 = computeCombatPose(f, 1.0, 1.0, true);
  assert.ok(stage1.lKneeX > 1.2 && stage1.torsoRotX > 0.5, 'Get-up Stage 1 must push onto tucked crouch base');
  assert.ok(stage2.pelvisY > stage1.pelvisY + 0.18, 'Get-up Stage 2 must rise cleanly back into fighting stance');
  assert.ok(stage2.lElbX < -1.3 && stage2.rElbX < -1.4, 'Get-up Stage 2 must return hands to fighting guard');
});
