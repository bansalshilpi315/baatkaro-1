import test from 'node:test';
import assert from 'node:assert/strict';
import { getSuperAudioUrl, SAMYAK_SUPER_AUDIO_URL } from './audio';
import { computeSuperCameraTarget } from './camera';
import { FIGHTER_CONFIGS, FIGHTER_LIST, STAGE_LIST } from './characters/configs';
import {
  computeSignatureDamage,
  computeTotalSuperDamage,
  createEmptyInput,
  createMatchState,
  getAttackTiming,
  shouldAllowFloatingCallout,
  stepMatch,
} from './combat';
import {
  SAMYAK_BOOK_COUNT,
  SAMYAK_DUMBBELL_COUNT,
  SAMYAK_SUPER_BANNER,
  SAMYAK_SUPER_DURATION,
  SAMYAK_SUPER_SIGNATURE_TEXT,
} from './samyakSuper';
import type { CombatEvent, FighterId } from './types';

test('Samyak is registered in the 10-playable roster (slot #9) with 185 HP, /audio/supers/ias.mp3 and 6 stages', () => {
  assert.equal(FIGHTER_LIST.length, 10, 'Roster must preserve Samyak and all playable fighters');
  assert.equal(FIGHTER_LIST[8].id, 'samyak');
  assert.equal(STAGE_LIST.length, 6, 'No new stage should be added (must remain 6 existing stages)');

  const samyak = FIGHTER_CONFIGS.samyak;
  assert.equal(samyak.name, 'Samyak');
  assert.equal(samyak.maxHp, 185, 'Samyak must have 2nd-strongest 185 HP');
  assert.equal(samyak.attackPowerMultiplier, 1.1, 'Samyak must have 1.10x attack power');
  assert.ok(
    samyak.maxHp < FIGHTER_CONFIGS.father.maxHp && samyak.maxHp > FIGHTER_CONFIGS.neta.maxHp,
    'Samyak must rank 2nd in maxHp right behind Principal Man',
  );
  const cmpSheru = createMatchState('samyak', 'sheru', true);
  cmpSheru.fighters[0].action = 'punch';
  cmpSheru.fighters[1].action = 'punch';
  assert.ok(
    getAttackTiming(cmpSheru.fighters[0]).damage > getAttackTiming(cmpSheru.fighters[1]).damage,
    'Samyak punches must deal ~10% boosted damage',
  );
  const cmpFather = createMatchState('father', 'samyak', true);
  cmpFather.fighters[0].action = 'punch';
  cmpFather.fighters[1].action = 'punch';
  assert.ok(
    getAttackTiming(cmpFather.fighters[0]).damage >= getAttackTiming(cmpFather.fighters[1]).damage,
    'Father Roy Dolphus must remain stronger than Samyak',
  );
  assert.equal(samyak.special.shortLabel, 'LAXMIKANT SLAM');
  assert.equal(samyak.special.id, 'laxmikant_slam');
  assert.equal(samyak.special.cooldown, 3.5);
  assert.equal(samyak.superName, 'MISSION IAS: BEAST MODE');

  assert.equal(getSuperAudioUrl('samyak'), '/audio/supers/ias.mp3');
  assert.equal(SAMYAK_SUPER_AUDIO_URL, '/audio/supers/ias.mp3');
  assert.equal(SAMYAK_BOOK_COUNT, 8);
  assert.equal(SAMYAK_DUMBBELL_COUNT, 6);
});

test('Samyak LAXMIKANT SLAM hurls a spinning red Polity book projectile for 11%-13% maxHP with 3.5s cooldown', () => {
  const state = createMatchState('samyak', 'sheru', true);
  const [samyak, sheru] = state.fighters;
  samyak.x = -2.2;
  sheru.x = 1.6;
  const startHp = sheru.hp;
  const oppMaxHp = sheru.maxHp;

  const triggerEvents = stepMatch(
    state,
    [{ ...createEmptyInput(), special: true }, createEmptyInput()],
    1 / 60,
  );
  assert.equal(samyak.action, 'special');
  assert.equal(samyak.specialCooldown, 3.5);
  assert.ok(
    triggerEvents.some((e) => e.type === 'special' && e.word === 'LAXMIKANT SLAM!'),
    'LAXMIKANT SLAM must emit LAXMIKANT SLAM! callout on activation',
  );

  let sawPolityProj = false;
  const events: CombatEvent[] = [];
  for (let i = 0; i < 45; i++) {
    events.push(...stepMatch(state, [createEmptyInput(), createEmptyInput()], 1 / 60));
    if (state.projectiles.some((p) => p.active && p.kind === 'polity')) {
      sawPolityProj = true;
    }
  }

  assert.ok(sawPolityProj, 'LAXMIKANT SLAM must spawn a spinning polity textbook projectile');
  const dmg = startHp - sheru.hp;
  const expectedBoostedDmg = computeSignatureDamage(
    oppMaxHp,
    FIGHTER_CONFIGS.samyak.attackPowerMultiplier,
  );
  assert.equal(dmg, expectedBoostedDmg);
  assert.ok(
    dmg > computeSignatureDamage(oppMaxHp, 1),
    `LAXMIKANT SLAM damage (${dmg}) must be ~10% boosted over baseline`,
  );
  assert.ok(events.some((e) => e.moveCallout === 'LAXMIKANT SLAM!'));
});

test('Samyak MISSION IAS: BEAST MODE! choreography, signature pop-up, strict 33% maxHP cap across all 7 opponents', () => {
  const opponents: FighterId[] = ['sheru', 'billa', 'neta', 'anda', 'mausi', 'father', 'samyak'];
  assert.equal(SAMYAK_SUPER_BANNER, 'MISSION IAS: BEAST MODE!');

  for (const oppId of opponents) {
    const state = createMatchState('samyak', oppId, true);
    const [samyak, opp] = state.fighters;
    samyak.shakti = 100;
    samyak.x = -2.0;
    opp.x = 2.0;
    const startHp = opp.hp;
    const expectedCap = computeTotalSuperDamage(opp.maxHp);

    stepMatch(state, [{ ...createEmptyInput(), superMove: true }, createEmptyInput()], 1 / 60);
    assert.equal(samyak.shakti, 0);
    assert.equal(samyak.action, 'super');
    assert.ok(state.samyakSuper?.active, 'Samyak Super must be active');

    let sawFlexStart = false;
    let sawLensGlint = false;
    let sawBarrageSummon = false;
    let barrageHitCount = 0;
    let sawSlamLeap = false;
    let sawAir1Slam = false;
    let sawSuperEnd = false;
    let maxJumpY = 0;
    const signatureEvents: CombatEvent[] = [];
    let genericAllowedCount = 0;

    for (let f = 0; f < 340; f++) {
      const evs = stepMatch(state, [createEmptyInput(), createEmptyInput()], 1 / 60);
      if (samyak.y > maxJumpY) maxJumpY = samyak.y;

      for (const ev of evs) {
        if (ev.isSuperSignature && ev.word === SAMYAK_SUPER_SIGNATURE_TEXT) {
          signatureEvents.push(ev);
          assert.equal(
            shouldAllowFloatingCallout(state, ev),
            true,
            'Samyak iconic signature tagline pop-up must be allowed during Super',
          );
        } else if (ev.word && state.samyakSuper?.active && shouldAllowFloatingCallout(state, ev)) {
          genericAllowedCount += 1;
        }
      }

      for (const sig of state.samyakSuperSignals) {
        if (sig.kind === 'flex_start') sawFlexStart = true;
        if (sig.kind === 'lens_glint') sawLensGlint = true;
        if (sig.kind === 'barrage_summon') sawBarrageSummon = true;
        if (sig.kind === 'barrage_hit') barrageHitCount += 1;
        if (sig.kind === 'slam_leap') sawSlamLeap = true;
        if (sig.kind === 'air1_slam_impact') sawAir1Slam = true;
        if (sig.kind === 'super_end') sawSuperEnd = true;
      }

      if (!state.samyakSuper?.active && sawSuperEnd) break;
    }

    assert.equal(state.samyakSuper?.active ?? false, false, 'Samyak Super must finish cleanly at 4.8s');
    assert.equal(sawFlexStart, true, 'Phase 1 double-bicep flex must fire');
    assert.equal(sawLensGlint, true, 'Phase 1 sunglasses anime glint must fire');
    assert.equal(sawBarrageSummon, true, 'Phase 2 UPSC book & dumbbell barrage must start');
    assert.equal(barrageHitCount, 7, 'All 7 timed UPSC book + gym dumbbell barrage impacts must fire');
    assert.equal(sawSlamLeap, true, 'Phase 3 superhero leap must fire');
    assert.equal(sawAir1Slam, true, 'Phase 3 IAS AIR 1 ground-slam must fire');
    assert.equal(sawSuperEnd, true, 'super_end must fire cleanly');
    assert.ok(maxJumpY >= 3.2, `Samyak must leap high during Phase 3 slam, reached y=${maxJumpY}`);
    assert.equal(samyak.y, 0, 'Samyak must return cleanly to ground y=0 at 4.8s');
    assert.equal(samyak.action, 'idle', 'Samyak must return cleanly to idle after Super');
    assert.equal(signatureEvents.length, 1, 'Samyak iconic signature tagline pop-up must fire once');
    assert.equal(genericAllowedCount, 0, 'Generic comic hit-text spam must stay suppressed during Samyak Super');

    const totalDealt = startHp - opp.hp;
    assert.equal(
      totalDealt,
      expectedCap,
      `Samyak Super against ${oppId} (maxHp ${opp.maxHp}) must deal exact 33% cap (${expectedCap}), got ${totalDealt}`,
    );
    assert.equal(samyak.superDamageDealt, expectedCap);
    assert.ok(
      totalDealt <= Math.round(opp.maxHp * 0.33),
      `Total Super damage ${totalDealt} must never exceed 33% of ${opp.maxHp}`,
    );
  }
});

test('Samyak barrage keeps low-HP opponent alive until the IAS AIR 1 slam delivers a clean KO', () => {
  const state = createMatchState('samyak', 'billa', true);
  const [samyak, billa] = state.fighters;
  samyak.shakti = 100;
  billa.hp = 10;

  stepMatch(state, [{ ...createEmptyInput(), superMove: true }, createEmptyInput()], 1 / 60);

  let koBeforeSlam = false;
  for (let f = 0; f < 320; f++) {
    stepMatch(state, [createEmptyInput(), createEmptyInput()], 1 / 60);
    if (state.samyakSuper?.active && state.samyakSuper.elapsed < 4.05 && billa.hp <= 0) {
      koBeforeSlam = true;
    }
    if (state.phase === 'ko_freeze') break;
  }

  assert.equal(koBeforeSlam, false, 'Barrage ticks must leave opponent at 1 HP until the AIR 1 slam');
  assert.equal(billa.hp, 0, 'IAS AIR 1 slam must finish the opponent cleanly');
  assert.equal(state.phase, 'ko_freeze');
  assert.equal(state.koCalloutText, 'DAHI KHATAM!');
});

test('Samyak Super camera follows 3-phase flex close-up -> barrage orbit -> AIR 1 slam -> smooth return', () => {
  const p1 = computeSuperCameraTarget(0.8, SAMYAK_SUPER_DURATION, -2.0, 1, 2.0, false, 'samyak', 0);
  const p2 = computeSuperCameraTarget(2.5, SAMYAK_SUPER_DURATION, -2.0, 1, 2.0, false, 'samyak', 0);
  const p3 = computeSuperCameraTarget(4.0, SAMYAK_SUPER_DURATION, -0.5, 1, 2.0, false, 'samyak', 1.4);
  const pEnd = computeSuperCameraTarget(SAMYAK_SUPER_DURATION, SAMYAK_SUPER_DURATION, 0, 1, 2.0, false, 'samyak', 0);

  assert.ok(p1.z < 6.0, 'Phase 1 must zoom in closely for double-bicep flex & sunglasses glint');
  assert.ok(p2.z > p1.z + 2.5, 'Phase 2 must widen out dynamically to frame both fighters and barrage');
  assert.ok(p3.y >= 2.8, 'Phase 3 must rise to capture superhero leap and IAS AIR 1 slam');
  assert.ok(Math.abs(pEnd.z - 9.2) < 0.05, 'Camera must smoothly return to standard Z=9.2 at 4.8s');
});
