import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatchState, stepMatch, createEmptyInput } from './combat';
import {
  applyRemoteInputPacket,
  applyStateSnapshotToGuest,
  consumeRemoteInput,
  createRemoteInputBuffer,
  generateRoomCode,
  isFriendRoomPacket,
  isValidRoomCode,
  packMatchStateSnapshot,
  PEER_ICE_SERVERS,
  PEER_ID_PREFIX,
  resetRemoteInputBuffer,
  roomCodeToPeerId,
  sanitizeRoomCode,
  type GuestInterpolationTarget,
} from './friendRoomProtocol';

test('4-digit room code generation, sanitization, and PeerJS ID prefixing prevent collisions', () => {
  for (let i = 0; i < 40; i++) {
    const code = generateRoomCode();
    assert.ok(isValidRoomCode(code), `generated code ${code} must be 4 digits`);
    assert.ok(Number(code) >= 1000 && Number(code) <= 9999);
    assert.equal(roomCodeToPeerId(code), `${PEER_ID_PREFIX}${code}`);
  }
  assert.equal(sanitizeRoomCode('ab48-29xyz'), '4829');
  assert.equal(isValidRoomCode('482'), false);
  assert.equal(isValidRoomCode('4829'), true);
  assert.ok(PEER_ICE_SERVERS.some((s) => String(s.urls).includes('stun.l.google.com:19302')));
  assert.ok(PEER_ICE_SERVERS.some((s) => String(s.urls).includes('stun1.l.google.com:19302')));
});

test('Host RemoteInputBuffer persists Guest held movement while consuming one-shot attack taps exactly once', () => {
  const buf = createRemoteInputBuffer();

  // Guest holds left and taps punch
  applyRemoteInputPacket(buf, { type: 'INPUT', moveDir: -1, down: false, action: 'punch' });
  const frame1 = consumeRemoteInput(buf);
  assert.equal(frame1.left, true);
  assert.equal(frame1.right, false);
  assert.equal(frame1.punch, true);

  // Next Host frame without a new packet: still walking left, punch is NOT double-fired
  const frame2 = consumeRemoteInput(buf);
  assert.equal(frame2.left, true);
  assert.equal(frame2.punch, false);

  // Guest taps 5th Signature Move and releases direction
  applyRemoteInputPacket(buf, { type: 'INPUT', moveDir: 0, down: false, action: 'special' });
  const frame3 = consumeRemoteInput(buf);
  assert.equal(frame3.left, false);
  assert.equal(frame3.special, true);

  // Reset clears everything cleanly on round restart
  applyRemoteInputPacket(buf, { type: 'INPUT', moveDir: 1, down: true, action: 'superMove' });
  resetRemoteInputBuffer(buf);
  const frame4 = consumeRemoteInput(buf);
  assert.equal(frame4.right, false);
  assert.equal(frame4.down, false);
  assert.equal(frame4.superMove, false);
});

test('Host-authoritative simulation drives Player 2 solely from remote inputs and syncs snapshots cleanly to Guest', () => {
  const hostState = createMatchState('father', 'samyak', true);
  const guestState = createMatchState('father', 'samyak', true);
  const guestTargets: [GuestInterpolationTarget, GuestInterpolationTarget] = [
    { x: 0, y: 0, initialized: false },
    { x: 0, y: 0, initialized: false },
  ];

  const p2Buf = createRemoteInputBuffer();
  const initialP2X = hostState.fighters[1].x;

  // Guest walks left toward Host and fires Samyak's Signature Move (LAXMIKANT SLAM)
  applyRemoteInputPacket(p2Buf, { type: 'INPUT', moveDir: -1 });
  for (let i = 0; i < 12; i++) {
    stepMatch(hostState, [createEmptyInput(), consumeRemoteInput(p2Buf)], 1 / 60);
  }
  assert.ok(hostState.fighters[1].x < initialP2X - 0.3, 'P2 moved left solely via remote input');

  applyRemoteInputPacket(p2Buf, { type: 'INPUT', moveDir: 0, action: 'special' });
  const events = stepMatch(hostState, [createEmptyInput(), consumeRemoteInput(p2Buf)], 1 / 60);
  assert.ok(events.some((e) => e.type === 'special' && e.attackerSlot === 1));

  // Pack Host state snapshot and verify Guest applies HP, Shakti, action, cooldown, projectiles & interpolation targets
  const snap = packMatchStateSnapshot(hostState, 1);
  assert.ok(isFriendRoomPacket(snap));
  assert.equal(snap.fighters[1].action, 'special');
  assert.ok(snap.fighters[1].specialCooldown > 3.0);

  applyStateSnapshotToGuest(guestState, snap, guestTargets);
  assert.equal(guestState.fighters[1].action, 'special');
  assert.equal(guestState.fighters[1].specialCooldown, snap.fighters[1].specialCooldown);
  assert.equal(guestTargets[1].x, snap.fighters[1].x);
  assert.equal(guestState.fighters[0].maxHp, 200);
  assert.equal(guestState.fighters[1].maxHp, 185);
});
