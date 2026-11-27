import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildFighterRig } from './characters/builders';

// Minimal headless canvas shim so Three.js CanvasTexture & faceCanvas work in Node tests
if (typeof globalThis.document === 'undefined') {
  const noop = () => {};
  const makeStubGradient = () => ({ addColorStop: noop });
  const makeStubCtx = () =>
    new Proxy(
      {
        fillStyle: '#000',
        strokeStyle: '#000',
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
        globalAlpha: 1,
        font: '12px sans-serif',
        textAlign: 'left',
        textBaseline: 'alphabetic',
        shadowColor: 'transparent',
        shadowBlur: 0,
        createLinearGradient: makeStubGradient,
        createRadialGradient: makeStubGradient,
        getImageData: (_x: number, _y: number, w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
          width: w,
          height: h,
        }),
        measureText: (txt: string) => ({ width: txt.length * 8 }),
      } as Record<string, unknown>,
      {
        get(target, prop) {
          if (prop in target) return target[prop as string];
          return noop;
        },
      },
    );

  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 256,
          height: 256,
          getContext: () => makeStubCtx(),
        };
      }
      return {};
    },
  };
}

function findByName(root: THREE.Object3D, name: string): THREE.Object3D | undefined {
  return root.getObjectByName(name);
}

function getWorldBox(obj: THREE.Object3D): THREE.Box3 {
  obj.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(obj);
}

test('Adi builds multi-layered 3D torso, open plaid shirt, rolled cuffs, distressed jeans & sneakers on 2-bone rig', () => {
  const rig = buildFighterRig('adi');
  try {
    // Layer 1 & Layer 2 on torso
    const tee = findByName(rig.torso, 'adi_olive_tee_torso') as THREE.Mesh | undefined;
    const plaidBack = findByName(rig.torso, 'adi_plaid_back_shell') as THREE.Mesh | undefined;
    const plaidLeft = findByName(rig.torso, 'adi_plaid_front_left') as THREE.Mesh | undefined;
    const plaidRight = findByName(rig.torso, 'adi_plaid_front_right') as THREE.Mesh | undefined;
    const collar = findByName(rig.torso, 'adi_plaid_collar');
    const pocket = findByName(rig.torso, 'adi_chest_pocket');

    assert.ok(tee, 'Adi must have sculpted inner olive graphic tee');
    assert.ok(plaidBack, 'Adi must have separate outer open plaid back shell');
    assert.ok(plaidLeft && plaidRight, 'Adi must have separate left & right open plaid front panels');
    assert.ok(collar, 'Adi must have 3D folded spread plaid collar');
    assert.ok(pocket, 'Adi must have stitched left-chest patch pocket');

    // Anti-plastic cloth PBR discipline on Adi's garments
    for (const mesh of [tee, plaidBack, plaidLeft, plaidRight]) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      assert.equal(mat.metalness, 0, `${mesh.name} must have metalness = 0`);
      assert.ok(
        mat.roughness >= 0.85 && mat.roughness <= 0.92,
        `${mesh.name} cloth roughness (${mat.roughness}) must stay in matte 0.85-0.92`,
      );
      assert.ok(
        mat.bumpScale >= 0.018 && mat.bumpScale <= 0.03,
        `${mesh.name} bumpScale (${mat.bumpScale}) must stay in 0.018-0.03`,
      );
    }

    // 2-bone arm & leg parenting integrity
    assert.ok(findByName(rig.leftElbow, 'adi_rolled_cuff_left'), 'Left rolled cuff parented to leftElbow');
    assert.ok(findByName(rig.rightElbow, 'adi_rolled_cuff_right'), 'Right rolled cuff parented to rightElbow');
    assert.ok(findByName(rig.leftHip, 'adi_denim_thigh_left'), 'Left denim thigh parented to leftHip');
    assert.ok(findByName(rig.leftHip, 'adi_knee_rip_left'), 'Left distressed knee rip parented to leftHip');
    assert.ok(findByName(rig.rightKnee, 'adi_sneaker_right'), 'Right casual sneaker parented to rightKnee');

    // Sneaker grounded cleanly at y ≈ 0 in standing pose
    const shoe = findByName(rig.leftKnee, 'adi_sneaker_left')!;
    const shoeBox = getWorldBox(shoe);
    assert.ok(
      Math.abs(shoeBox.min.y) < 0.025,
      `Adi sneaker bottom (${shoeBox.min.y.toFixed(3)}) must rest flush near ground y=0`,
    );
  } finally {
    rig.dispose();
  }
});

test('Krish builds stockier fuller Lathe torso, 3D ribbed trim, matte backpack + strap, right wristband & heather joggers', () => {
  const adiRig = buildFighterRig('adi');
  const krishRig = buildFighterRig('krish');
  try {
    const adiTee = findByName(adiRig.torso, 'adi_olive_tee_torso') as THREE.Mesh;
    const krishSweat = findByName(krishRig.torso, 'krish_sweatshirt_torso') as THREE.Mesh;
    assert.ok(krishSweat, 'Krish must have sculpted olive fleece sweatshirt torso');

    // Verify Krish has a genuinely broader AND deeper fuller silhouette than lean Adi
    const adiSize = new THREE.Vector3();
    const krishSize = new THREE.Vector3();
    getWorldBox(adiTee).getSize(adiSize);
    getWorldBox(krishSweat).getSize(krishSize);
    assert.ok(
      krishSize.x > adiSize.x * 1.18,
      `Krish torso width (${krishSize.x.toFixed(3)}) must be distinctly broader than Adi (${adiSize.x.toFixed(3)})`,
    );
    assert.ok(
      krishSize.z > adiSize.z * 1.35,
      `Krish torso depth (${krishSize.z.toFixed(3)}) must be distinctly fuller than Adi (${adiSize.z.toFixed(3)})`,
    );

    // 3D ribbed collar, hem, backpack & curved padded shoulder strap parented to torso
    assert.ok(findByName(krishRig.torso, 'krish_ribbed_collar'), 'Krish has 3D ribbed crew-neck collar');
    assert.ok(findByName(krishRig.torso, 'krish_ribbed_hem'), 'Krish has 3D ribbed waist hem');
    assert.ok(findByName(krishRig.torso, 'krish_backpack'), 'Krish has 3D matte-black backpack on torso');
    assert.ok(
      findByName(krishRig.torso, 'krish_backpack_strap'),
      'Krish has 3D curved right-shoulder backpack strap on torso',
    );

    // Pushed-up cuffs + anatomical-right-wrist dark cloth wristband (-X = rig.leftElbow, matching Reference Image 2)
    assert.ok(findByName(krishRig.leftElbow, 'krish_ribbed_cuff_left'), 'Left ribbed forearm cuff');
    assert.ok(findByName(krishRig.rightElbow, 'krish_ribbed_cuff_right'), 'Right ribbed forearm cuff');
    assert.ok(findByName(krishRig.leftElbow, 'krish_wristband'), 'Anatomical-right layered cloth wristband on leftElbow (-X)');
    assert.equal(findByName(krishRig.rightElbow, 'krish_wristband'), undefined, 'Wristband is on anatomical-right wrist only');

    // Joggers, ankle cuffs & black sneakers parented to 2-bone legs
    const thigh = findByName(krishRig.leftHip, 'krish_jogger_thigh_left') as THREE.Mesh;
    assert.ok(thigh, 'Heather jogger thigh parented to leftHip');
    assert.ok(findByName(krishRig.leftKnee, 'krish_ankle_cuff_left'), 'Gathered ankle cuff parented to leftKnee');
    const sneaker = findByName(krishRig.rightKnee, 'krish_sneaker_right')!;
    assert.ok(sneaker, 'Matte-black athletic sneaker parented to rightKnee');

    // Anti-plastic matte cloth PBR discipline on Krish's sweatshirt & joggers
    for (const mesh of [krishSweat, thigh]) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      assert.equal(mat.metalness, 0, `${mesh.name} must have metalness = 0`);
      assert.ok(
        mat.roughness >= 0.85 && mat.roughness <= 0.92,
        `${mesh.name} cloth roughness (${mat.roughness}) must stay in 0.85-0.92`,
      );
      assert.ok(
        mat.bumpScale >= 0.018 && mat.bumpScale <= 0.03,
        `${mesh.name} bumpScale (${mat.bumpScale}) must stay in 0.018-0.03`,
      );
    }

    const shoeBox = getWorldBox(sneaker);
    assert.ok(
      Math.abs(shoeBox.min.y) < 0.025,
      `Krish sneaker bottom (${shoeBox.min.y.toFixed(3)}) must rest flush near ground y=0`,
    );
  } finally {
    adiRig.dispose();
    krishRig.dispose();
  }
});
