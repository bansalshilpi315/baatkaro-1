import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import type { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  attachFatherGlbHead,
  attachSamyakGlbHead,
  buildFittedFatherGlbHead,
  buildFittedSamyakGlbHead,
  clearFatherGlbHeadCacheForTests,
  clearSamyakGlbHeadCacheForTests,
  FATHER_COLLAR_PIVOT_Y,
  FATHER_GLB_HEAD_CONFIG,
  FATHER_GLB_HEAD_URL,
  FATHER_TARGET_HEAD_HEIGHT,
  getFatherGlbHeadStatus,
  getSamyakGlbHeadStatus,
  SAMYAK_GLB_HEAD_CONFIG,
  SAMYAK_GLB_HEAD_URL,
  SAMYAK_NECK_PIVOT_Y,
  SAMYAK_TARGET_HEAD_HEIGHT,
} from './characters/fatherGlbHead';

function createMockTrellisGlbScene(): THREE.Group {
  const root = new THREE.Group();
  // Simulate TRELLIS embedded KHR_lights_punctual lights
  const light1 = new THREE.PointLight(0xffffff, 5);
  light1.position.set(5, 5, 5);
  root.add(light1);

  const scaleNode = new THREE.Group();
  scaleNode.scale.setScalar(0.7);

  const tex = new THREE.DataTexture(new Uint8Array([200, 140, 100, 255]), 1, 1);
  tex.colorSpace = THREE.NoColorSpace;
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 1.0,
    metalness: 1.0,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.77, 1.0, 0.99), mat);
  mesh.position.set(0.25, 0.4, -0.15);
  scaleNode.add(mesh);
  root.add(scaleNode);
  return root;
}

test('buildFittedFatherGlbHead strips embedded lights, auto-centers/scales to neck pivot, and calibrates TRELLIS PBR materials', () => {
  const template = createMockTrellisGlbScene();
  const flashMaterials: THREE.MeshStandardMaterial[] = [];

  const fitted = buildFittedFatherGlbHead(template, FATHER_GLB_HEAD_CONFIG, flashMaterials);

  // Embedded PointLight must be stripped so arena lighting is never blown out
  let lightCount = 0;
  let meshRef: THREE.Mesh | null = null;
  fitted.traverse((obj) => {
    if ((obj as THREE.Light).isLight) lightCount += 1;
    if ((obj as THREE.Mesh).isMesh) meshRef = obj as THREE.Mesh;
  });
  assert.equal(lightCount, 0, 'Embedded GLB lights must be stripped');
  assert.ok(meshRef, 'Cloned GLB mesh must exist');

  // Verify bounding box height, X/Z centering, and collar-bottom alignment
  fitted.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(fitted);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  assert.ok(
    Math.abs(size.y - FATHER_TARGET_HEAD_HEIGHT * FATHER_GLB_HEAD_CONFIG.scaleMultiplier) < 1e-3,
    `Normalized height must match target (got ${size.y})`,
  );
  assert.ok(Math.abs(center.x) < 1e-3, `Head must be centered on X (got ${center.x})`);
  assert.ok(
    Math.abs(center.z - FATHER_GLB_HEAD_CONFIG.offsetZ) < 1e-3,
    `Head must align on Z with offsetZ (got ${center.z})`,
  );
  assert.ok(
    Math.abs(box.min.y - (FATHER_COLLAR_PIVOT_Y + FATHER_GLB_HEAD_CONFIG.offsetY)) < 1e-3,
    `Bottom neck pivot must align on collar (got ${box.min.y})`,
  );

  // Verify PBR material calibration
  const tunedMat = (meshRef as THREE.Mesh).material as THREE.MeshStandardMaterial;
  assert.equal(tunedMat.roughness, 0.72);
  assert.equal(tunedMat.metalness, 0.0);
  assert.equal(tunedMat.map?.colorSpace, THREE.SRGBColorSpace);
  assert.equal((meshRef as THREE.Mesh).frustumCulled, false);
  assert.equal((meshRef as THREE.Mesh).userData.sharedGeometry, true);
  assert.equal(flashMaterials.length, 1);
});

test('attachFatherGlbHead caches /models/father_head.glb once for mirror matches, hides fallback when loaded, and falls back silently on error', () => {
  clearFatherGlbHeadCacheForTests();
  let loadCalls = 0;
  let capturedOnLoad: ((gltf: GLTF) => void) | null = null;
  const mockLoaderFactory = (): Pick<GLTFLoader, 'load'> => ({
    load(url, onLoad) {
      assert.equal(url, FATHER_GLB_HEAD_URL);
      loadCalls += 1;
      capturedOnLoad = onLoad;
    },
  });

  const headGroup1 = new THREE.Group();
  const fallback1 = new THREE.Group();
  const headGroup2 = new THREE.Group();
  const fallback2 = new THREE.Group();
  const flash1: THREE.MeshStandardMaterial[] = [];
  const flash2: THREE.MeshStandardMaterial[] = [];

  // Mirror match (Father vs Father) while still loading -> only 1 fetch, both fallbacks visible
  attachFatherGlbHead(headGroup1, fallback1, flash1, () => false, mockLoaderFactory);
  attachFatherGlbHead(headGroup2, fallback2, flash2, () => false, mockLoaderFactory);
  assert.equal(loadCalls, 1, 'Mirror matches must fetch /models/father_head.glb only once');
  assert.equal(fallback1.visible, true);
  assert.equal(fallback2.visible, true);
  assert.equal(getFatherGlbHeadStatus(), 'loading');

  // Resolve load -> both rigs receive independent cloned heads & hide fallbacks
  const template = createMockTrellisGlbScene();
  const triggerLoad = capturedOnLoad as ((gltf: GLTF) => void) | null;
  assert.ok(triggerLoad, 'Loader onLoad callback must be registered');
  triggerLoad({ scene: template } as GLTF);
  assert.equal(getFatherGlbHeadStatus(), 'loaded');
  assert.equal(fallback1.visible, false);
  assert.equal(fallback2.visible, false);
  assert.equal(headGroup1.children.length, 1);
  assert.equal(headGroup2.children.length, 1);
  assert.notEqual(
    flash1[0],
    flash2[0],
    'Mirror-match Father rigs must clone materials independently for hit-flash isolation',
  );

  // Rematch after cached -> zero additional fetches, immediate mount
  const headGroup3 = new THREE.Group();
  const fallback3 = new THREE.Group();
  attachFatherGlbHead(headGroup3, fallback3, [], () => false, mockLoaderFactory);
  assert.equal(loadCalls, 1, 'Cached GLB must not refetch on rematches');
  assert.equal(fallback3.visible, false);
  assert.equal(headGroup3.children.length, 1);

  // Error fallback test -> silent keep fallback visible, zero throw
  clearFatherGlbHeadCacheForTests();
  const headGroupErr = new THREE.Group();
  const fallbackErr = new THREE.Group();
  const errorLoaderFactory = (): Pick<GLTFLoader, 'load'> => ({
    load(_url, _onLoad, _onProgress, onError) {
      onError?.(new Error('404'));
    },
  });
  attachFatherGlbHead(headGroupErr, fallbackErr, [], () => false, errorLoaderFactory);
  assert.equal(getFatherGlbHeadStatus(), 'failed');
  assert.equal(fallbackErr.visible, true, 'Fallback hemisphere head stays visible on load failure');
  assert.equal(headGroupErr.children.length, 0);

  clearFatherGlbHeadCacheForTests();
});

test('buildFittedSamyakGlbHead strips embedded lights, auto-centers/scales to neck pivot, and calibrates TRELLIS PBR materials', () => {
  const template = createMockTrellisGlbScene();
  const flashMaterials: THREE.MeshStandardMaterial[] = [];

  const fitted = buildFittedSamyakGlbHead(template, SAMYAK_GLB_HEAD_CONFIG, flashMaterials);

  let lightCount = 0;
  let meshRef: THREE.Mesh | null = null;
  fitted.traverse((obj) => {
    if ((obj as THREE.Light).isLight) lightCount += 1;
    if ((obj as THREE.Mesh).isMesh) meshRef = obj as THREE.Mesh;
  });
  assert.equal(lightCount, 0, 'Embedded GLB lights must be stripped from samyak_head.glb');
  assert.ok(meshRef, 'Cloned Samyak GLB mesh must exist');

  fitted.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(fitted);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  assert.ok(
    Math.abs(size.y - SAMYAK_TARGET_HEAD_HEIGHT * SAMYAK_GLB_HEAD_CONFIG.scaleMultiplier) < 1e-3,
    `Normalized height must match target (got ${size.y})`,
  );
  assert.ok(Math.abs(center.x) < 1e-3, `Samyak head must be centered on X (got ${center.x})`);
  assert.ok(
    Math.abs(center.z - SAMYAK_GLB_HEAD_CONFIG.offsetZ) < 1e-3,
    `Samyak head must align on Z with offsetZ (got ${center.z})`,
  );
  assert.ok(
    Math.abs(box.min.y - (SAMYAK_NECK_PIVOT_Y + SAMYAK_GLB_HEAD_CONFIG.offsetY)) < 1e-3,
    `Samyak bottom neck pivot must seat cleanly onto neck (got ${box.min.y})`,
  );

  const tunedMat = (meshRef as THREE.Mesh).material as THREE.MeshStandardMaterial;
  assert.equal(tunedMat.roughness, 0.72);
  assert.equal(tunedMat.metalness, 0.0);
  assert.equal(tunedMat.map?.colorSpace, THREE.SRGBColorSpace);
  assert.equal((meshRef as THREE.Mesh).frustumCulled, false);
  assert.equal((meshRef as THREE.Mesh).userData.sharedGeometry, true);
  assert.equal(flashMaterials.length, 1);
});

test('attachSamyakGlbHead caches /models/samyak_head.glb once for mirror matches, hides fallback when loaded, and falls back silently on error', () => {
  clearSamyakGlbHeadCacheForTests();
  let loadCalls = 0;
  let capturedOnLoad: ((gltf: GLTF) => void) | null = null;
  const mockLoaderFactory = (): Pick<GLTFLoader, 'load'> => ({
    load(url, onLoad) {
      assert.equal(url, SAMYAK_GLB_HEAD_URL);
      loadCalls += 1;
      capturedOnLoad = onLoad;
    },
  });

  const headGroup1 = new THREE.Group();
  const fallback1 = new THREE.Group();
  const headGroup2 = new THREE.Group();
  const fallback2 = new THREE.Group();
  const flash1: THREE.MeshStandardMaterial[] = [];
  const flash2: THREE.MeshStandardMaterial[] = [];

  // Mirror match (Samyak vs Samyak) while loading -> single fetch, both fallbacks visible
  attachSamyakGlbHead(headGroup1, fallback1, flash1, () => false, mockLoaderFactory);
  attachSamyakGlbHead(headGroup2, fallback2, flash2, () => false, mockLoaderFactory);
  assert.equal(loadCalls, 1, 'Samyak mirror matches must fetch /models/samyak_head.glb only once');
  assert.equal(fallback1.visible, true);
  assert.equal(fallback2.visible, true);
  assert.equal(getSamyakGlbHeadStatus(), 'loading');

  // Resolve load -> both rigs receive independent cloned heads & hide fallbacks
  const template = createMockTrellisGlbScene();
  const triggerLoad = capturedOnLoad as ((gltf: GLTF) => void) | null;
  assert.ok(triggerLoad, 'Loader onLoad callback must be registered');
  triggerLoad({ scene: template } as GLTF);
  assert.equal(getSamyakGlbHeadStatus(), 'loaded');
  assert.equal(fallback1.visible, false);
  assert.equal(fallback2.visible, false);
  assert.equal(headGroup1.children.length, 1);
  assert.equal(headGroup2.children.length, 1);
  assert.notEqual(
    flash1[0],
    flash2[0],
    'Mirror-match Samyak rigs must clone materials independently for hit-flash isolation',
  );

  // Rematch after cached -> zero additional fetches, immediate mount
  const headGroup3 = new THREE.Group();
  const fallback3 = new THREE.Group();
  attachSamyakGlbHead(headGroup3, fallback3, [], () => false, mockLoaderFactory);
  assert.equal(loadCalls, 1, 'Cached Samyak GLB must not refetch on rematches');
  assert.equal(fallback3.visible, false);
  assert.equal(headGroup3.children.length, 1);

  // Error fallback test -> silent keep fallback visible, zero throw
  clearSamyakGlbHeadCacheForTests();
  const headGroupErr = new THREE.Group();
  const fallbackErr = new THREE.Group();
  const errorLoaderFactory = (): Pick<GLTFLoader, 'load'> => ({
    load(_url, _onLoad, _onProgress, onError) {
      onError?.(new Error('404'));
    },
  });
  attachSamyakGlbHead(headGroupErr, fallbackErr, [], () => false, errorLoaderFactory);
  assert.equal(getSamyakGlbHeadStatus(), 'failed');
  assert.equal(fallbackErr.visible, true, 'Fallback hemisphere head stays visible on load failure');
  assert.equal(headGroupErr.children.length, 0);

  clearSamyakGlbHeadCacheForTests();
});
