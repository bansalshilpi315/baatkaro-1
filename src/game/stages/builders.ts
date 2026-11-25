import * as THREE from 'three';
import type { StageId } from '../types';
import {
  createLowPolyNpc,
  createStrayCow,
  updateAmbientNpcs,
  updateStrayCow,
  type AmbientCow,
  type AmbientNpc,
} from './npcs';
import {
  createBlackboardTexture,
  createBuffetBannerTexture,
  createChaiSignTexture,
  createClassroomFloorTexture,
  createCrowdSignTexture,
  createDjBannerTexture,
  createDynamicNewsScreen,
  createExamPosterTexture,
  createMohallaRoadTexture,
  createPlasterWallTexture,
  createRailwayPlatformTexture,
  createShaadiCarpetTexture,
  createStationBoardTexture,
  createStudioFloorTexture,
} from './textures';

export interface StageInstance {
  id: StageId;
  group: THREE.Group;
  backgroundColor: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
  keyLightColor: number;
  keyLightIntensity: number;
  hemiSkyColor: number;
  hemiGroundColor: number;
  hemiIntensity: number;
  rimLightColor: number;
  rimLightIntensity: number;
  update: (elapsed: number, dt: number) => void;
  triggerExcitement: (amount: number) => void;
  setLowGraphics: (low: boolean) => void;
  dispose: () => void;
}

function disposeGroup(group: THREE.Group, extraTextures: THREE.Texture[] = []): void {
  const disposedTextures = new Set<THREE.Texture>();
  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry && !mesh.geometry.userData?.shared) {
        mesh.geometry.dispose();
      }
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        if (!m || m.userData?.shared) return;
        const std = m as THREE.MeshStandardMaterial;
        if (std.map && !std.map.userData?.shared && !disposedTextures.has(std.map)) {
          disposedTextures.add(std.map);
          std.map.dispose();
        }
        m.dispose();
      });
    }
  });
  for (const tex of extraTextures) {
    if (!disposedTextures.has(tex)) {
      disposedTextures.add(tex);
      tex.dispose();
    }
  }
}

function buildAutoRickshaw(): THREE.Group {
  const auto = new THREE.Group();
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.25, metalness: 0.15 });
  const greenMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.3, metalness: 0.12 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85, metalness: 0.02 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.9 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.18, metalness: 0.9 });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfef08a,
    emissiveIntensity: 0.9,
  });

  const lower = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.72, 1.3), greenMat);
  lower.position.set(0, 0.65, 0);
  lower.castShadow = true;
  auto.add(lower);

  const upperBand = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.42, 1.28), yellowMat);
  upperBand.position.set(0, 1.18, 0);
  auto.add(upperBand);

  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 1.1, 12, 1, false, 0, Math.PI), yellowMat);
  nose.rotation.y = Math.PI / 2;
  nose.position.set(-1.2, 0.82, 0);
  auto.add(nose);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.28, 1.36), canopyMat);
  roof.position.set(0.05, 1.96, 0);
  auto.add(roof);

  [
    [-1.1, 0.56],
    [-1.1, -0.56],
    [1.1, 0.56],
    [1.1, -0.56],
  ].forEach(([px, pz]) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.75, 8), chromeMat);
    pole.position.set(px, 1.55, pz);
    auto.add(pole);
  });

  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 12), lampMat);
  lamp.rotation.z = Math.PI / 2;
  lamp.position.set(-1.55, 0.76, 0);
  auto.add(lamp);

  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.2, 14);
  wheelGeo.rotateX(Math.PI / 2);
  [
    [-1.08, 0.32, 0],
    [0.82, 0.32, 0.66],
    [0.82, 0.32, -0.66],
  ].forEach(([wx, wy, wz]) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, wy, wz);
    auto.add(w);
  });

  return auto;
}

function buildDesiMohalla(anisotropy: number): StageInstance {
  const group = new THREE.Group();
  let excitement = 0;

  const roadTex = createMohallaRoadTexture(anisotropy);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(92, 48),
    new THREE.MeshStandardMaterial({ color: 0xffffff, map: roadTex, roughness: 0.86, metalness: 0.04 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const houseHexes = ['#f59e0b', '#0d9488', '#e11d48', '#f97316', '#0284c7', '#d97706', '#16a34a', '#be185d', '#ca8a04'];
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2, metalness: 0.5 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.75 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.4, metalness: 0.7 });

  // 10 colourful mohalla houses spanning x = -24.3 to +24.3 (aligned with balconies at ±2.7)
  for (let i = 0; i < 10; i++) {
    const hx = -24.3 + i * 5.4;
    const hHeight = 5.4 + (i % 3) * 1.4;
    const house = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: createPlasterWallTexture(houseHexes[i % houseHexes.length], anisotropy),
      roughness: 0.84,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.8, hHeight, 3.8), wallMat);
    body.position.y = hHeight / 2;
    body.receiveShadow = true;
    house.add(body);

    const roofTrim = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.35, 4.0), trimMat);
    roofTrim.position.y = hHeight + 0.17;
    house.add(roofTrim);

    const balcony = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.22, 1.1), trimMat);
    balcony.position.set(0, 3.1, 2.35);
    house.add(balcony);

    const rail = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.7, 0.08), railMat);
    rail.position.set(0, 3.55, 2.86);
    house.add(rail);

    [-1.1, 1.1].forEach((wx) => {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.15, 0.12), windowMat);
      win.position.set(wx, 4.1, 1.9);
      house.add(win);
      const shutter = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.14, 0.3), trimMat);
      shutter.position.set(wx, 4.74, 2.02);
      house.add(shutter);
    });

    house.position.set(hx, 0, -7.8);
    group.add(house);
  }

  // Roadside Chai Tapri Stall (right-back)
  const tapri = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
  const counter = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.15, 1.4), woodMat);
  counter.position.y = 0.58;
  tapri.add(counter);

  const awningMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.65 });
  const awning = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.14, 1.9), awningMat);
  awning.position.set(0, 2.55, 0.1);
  awning.rotation.x = 0.18;
  tapri.add(awning);

  [-1.4, 1.4].forEach((px) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 8), woodMat);
    post.position.set(px, 1.25, 0.55);
    tapri.add(post);
  });

  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(3.1, 0.85, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, map: createChaiSignTexture(anisotropy), roughness: 0.45 }),
  );
  signBoard.position.set(0, 3.05, 0.85);
  tapri.add(signBoard);

  const kettle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.22, 0.34, 12),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.22, metalness: 0.88 }),
  );
  kettle.position.set(-0.5, 1.32, 0.2);
  tapri.add(kettle);

  const steamPuffs: THREE.Mesh[] = [];
  const steamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.48 });
  const steamGeo = new THREE.SphereGeometry(0.14, 8, 8);
  for (let i = 0; i < 4; i++) {
    const puff = new THREE.Mesh(steamGeo, steamMat);
    puff.position.set(-0.5, 1.65 + i * 0.3, 0.2);
    tapri.add(puff);
    steamPuffs.push(puff);
  }
  tapri.position.set(5.2, 0, -4.4);
  group.add(tapri);

  // Parked Auto-Rickshaw
  const auto = buildAutoRickshaw();
  auto.position.set(-5.8, 0, -4.1);
  auto.rotation.y = 0.28;
  group.add(auto);

  // Mohalla Street Lamp Posts flanking left & right ends
  const lampPostMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.5, metalness: 0.7 });
  const lampBulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfde047,
    emissiveIntensity: 1.3,
  });
  [-15.2, 15.2].forEach((lx) => {
    const lamp = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 5.2, 8), lampPostMat);
    pole.position.y = 2.6;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), lampPostMat);
    arm.position.set(lx < 0 ? 0.4 : -0.4, 5.15, 0);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), lampBulbMat);
    bulb.position.set(lx < 0 ? 0.75 : -0.75, 4.98, 0);
    lamp.add(pole, arm, bulb);
    lamp.position.set(lx, 0, -4.7);
    group.add(lamp);
  });

  // Extended swaying bunting spanning x = -17.5 to +17.5
  const flags: THREE.Mesh[] = [];
  const flagColors = [0xef4444, 0xfacc15, 0x22c55e, 0xec4899, 0x38bdf8];
  const flagGeo = new THREE.PlaneGeometry(0.45, 0.55);
  for (let i = 0; i < 24; i++) {
    const t = i / 23;
    const x = -17.5 + t * 35;
    const sag = Math.abs(Math.sin(t * Math.PI * 2)) * 0.65;
    const flag = new THREE.Mesh(
      flagGeo,
      new THREE.MeshStandardMaterial({
        color: flagColors[i % flagColors.length],
        side: THREE.DoubleSide,
        roughness: 0.7,
      }),
    );
    flag.position.set(x, 4.95 - sag, -5.2);
    group.add(flag);
    flags.push(flag);
  }

  // Cached cardboard crowd sign textures for Mohalla flanks
  const signJitegaTex = createCrowdSignTexture('JITEGA BHAI!', '#FACC15', '#B91C1C', '#7F1D1D', anisotropy);
  const signPowerTex = createCrowdSignTexture('FULL POWER!', '#FDBA74', '#C2410C', '#18181B', anisotropy);

  // LIVING MOHALLA NPCs (strictly behind z <= -2.3)
  const npcs: AmbientNpc[] = [
    // Chaiwala behind counter serving cutting chai
    createLowPolyNpc({
      shirtColor: 0xf8fafc,
      pantColor: 0x334155,
      turbanColor: 0xf97316,
      mode: 'vendor',
      x: 5.35,
      z: -5.1,
    }),
    // Balcony neighbours
    createLowPolyNpc({
      shirtColor: 0xec4899,
      pantColor: 0xbe185d,
      mode: 'balcony',
      x: -2.7,
      y: 3.18,
      z: -5.3,
    }),
    createLowPolyNpc({
      shirtColor: 0x38bdf8,
      pantColor: 0x1e293b,
      hairColor: 0x9ca3af,
      mode: 'balcony',
      x: 2.7,
      y: 3.18,
      z: -5.3,
      isSecondary: true,
    }),
    // Strolling mohalla uncle on center sidewalk
    createLowPolyNpc({
      shirtColor: 0xfef08a,
      pantColor: 0x475569,
      hairColor: 0xd4d4d8,
      mode: 'stroll',
      x: -1.5,
      z: -3.7,
      walkMinX: -3.2,
      walkMaxX: 2.6,
      speed: 1.05,
    }),

    // LEFT FLANK SUPPORT AUDIENCE (x = -8.8 to -13.5, z = -2.4 to -3.8)
    createLowPolyNpc({
      shirtColor: 0xf97316,
      pantColor: 0x334155,
      hairColor: 0x9ca3af,
      mode: 'supporter',
      prop: 'sign',
      signTexture: signJitegaTex,
      faceYaw: 0.3,
      x: -9.2,
      z: -2.7,
      phase: 0.2,
    }),
    createLowPolyNpc({
      shirtColor: 0x10b981,
      pantColor: 0x1e293b,
      mode: 'supporter',
      prop: 'chai',
      faceYaw: 0.34,
      x: -10.4,
      z: -3.25,
      phase: 1.1,
    }),
    createLowPolyNpc({
      shirtColor: 0x38bdf8,
      pantColor: 0x1e3a8a,
      mode: 'supporter',
      prop: 'sign',
      signTexture: signPowerTex,
      scale: 0.74, // Cheering mohalla kid!
      faceYaw: 0.28,
      x: -11.35,
      z: -2.55,
      phase: 2.0,
    }),
    createLowPolyNpc({
      shirtColor: 0xfacc15,
      pantColor: 0x475569,
      turbanColor: 0xdc2626,
      mode: 'supporter',
      prop: 'chai',
      faceYaw: 0.36,
      x: -12.4,
      z: -3.45,
      phase: 2.8,
      isSecondary: true,
    }),
    createLowPolyNpc({
      shirtColor: 0xec4899,
      pantColor: 0x9d174d,
      sareeColor: 0xfef08a,
      mode: 'supporter',
      prop: 'none',
      faceYaw: 0.32,
      x: -13.45,
      z: -2.9,
      phase: 3.6,
      isSecondary: true,
    }),

    // RIGHT FLANK SUPPORT AUDIENCE (x = +8.8 to +13.5, z = -2.4 to -3.8)
    createLowPolyNpc({
      shirtColor: 0x2563eb,
      pantColor: 0x1e293b,
      hairColor: 0x9ca3af,
      mode: 'supporter',
      prop: 'sign',
      signTexture: signPowerTex,
      faceYaw: -0.3,
      x: 9.2,
      z: -2.7,
      phase: 0.7,
    }),
    createLowPolyNpc({
      shirtColor: 0xf59e0b,
      pantColor: 0x334155,
      mode: 'supporter',
      prop: 'chai',
      faceYaw: -0.34,
      x: 10.4,
      z: -3.25,
      phase: 1.6,
    }),
    createLowPolyNpc({
      shirtColor: 0xef4444,
      pantColor: 0x1e293b,
      mode: 'supporter',
      prop: 'sign',
      signTexture: signJitegaTex,
      scale: 0.74, // Cheering mohalla kid!
      faceYaw: -0.28,
      x: 11.4,
      z: -2.55,
      phase: 2.4,
    }),
    createLowPolyNpc({
      shirtColor: 0x14b8a6,
      pantColor: 0x334155,
      turbanColor: 0xfacc15,
      mode: 'supporter',
      prop: 'chai',
      faceYaw: -0.36,
      x: 12.45,
      z: -3.45,
      phase: 3.2,
      isSecondary: true,
    }),
    createLowPolyNpc({
      shirtColor: 0xa855f7,
      pantColor: 0x581c87,
      sareeColor: 0xfde047,
      mode: 'supporter',
      prop: 'none',
      faceYaw: -0.32,
      x: 13.5,
      z: -2.9,
      phase: 4.1,
      isSecondary: true,
    }),
  ];
  npcs.forEach((n) => group.add(n.group));

  // Slow-moving Stylized Stray Cow strolling in far background!
  const strayCow: AmbientCow = createStrayCow(-3.8, -5.0, -7.2, 2.2);
  group.add(strayCow.group);

  return {
    id: 'mohalla',
    group,
    backgroundColor: 0xfdba74,
    fogColor: 0xfdba74,
    fogNear: 24,
    fogFar: 58,
    keyLightColor: 0xfff3d1,
    keyLightIntensity: 2.1,
    hemiSkyColor: 0x93c5fd,
    hemiGroundColor: 0x9a3412,
    hemiIntensity: 0.85,
    rimLightColor: 0xf59e0b,
    rimLightIntensity: 1.0,
    update(elapsed, dt) {
      excitement = Math.max(0, excitement - dt);
      steamPuffs.forEach((p, idx) => {
        const phase = (elapsed * 0.9 + idx * 0.25) % 1;
        p.position.y = 1.55 + phase * 1.1;
        p.position.x = -0.5 + Math.sin(elapsed * 3 + idx) * 0.14;
        const sc = 0.6 + phase * 1.2;
        p.scale.set(sc, sc, sc);
      });
      flags.forEach((f, idx) => {
        f.rotation.x = Math.sin(elapsed * 3.2 + idx * 0.7) * 0.24;
      });
      updateAmbientNpcs(npcs, elapsed, dt, excitement);
      updateStrayCow(strayCow, elapsed, dt);
    },
    triggerExcitement(amount) {
      excitement = Math.min(2.0, Math.max(excitement, amount));
    },
    setLowGraphics(low) {
      npcs.forEach((n) => {
        if (n.isSecondary) n.group.visible = !low;
      });
      strayCow.group.visible = !low;
    },
    dispose: () => disposeGroup(group, [signJitegaTex, signPowerTex]),
  };
}

function buildSchoolCoaching(anisotropy: number): StageInstance {
  const group = new THREE.Group();
  let excitement = 0;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(52, 28),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: createClassroomFloorTexture(anisotropy),
      roughness: 0.72,
      metalness: 0.05,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: createPlasterWallTexture('#fef3c7', anisotropy),
    roughness: 0.85,
  });
  const dadoMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.75 });

  // Extended wide classroom back wall covering x = -22 to +22
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(44, 9, 0.5), wallMat);
  backWall.position.set(0, 4.5, -5.8);
  backWall.receiveShadow = true;
  group.add(backWall);

  const dado = new THREE.Mesh(new THREE.BoxGeometry(44, 1.8, 0.56), dadoMat);
  dado.position.set(0, 0.9, -5.78);
  group.add(dado);

  // Enclosed left & right classroom side walls with sunny windows at x = ±19.2
  const windowGlassMat = new THREE.MeshStandardMaterial({
    color: 0xbae6fd,
    emissive: 0xe0f2fe,
    emissiveIntensity: 0.45,
    roughness: 0.15,
  });
  const windowFrameMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.65 });
  [-19.2, 19.2].forEach((sx) => {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9, 20), wallMat);
    sideWall.position.set(sx, 4.5, 2);
    group.add(sideWall);

    const sideDado = new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.8, 20), dadoMat);
    sideDado.position.set(sx, 0.9, 2);
    group.add(sideDado);

    [-2.5, 1.5].forEach((wz) => {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.62, 2.5, 2.2), windowFrameMat);
      frame.position.set(sx, 3.8, wz);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.66, 2.1, 1.8), windowGlassMat);
      glass.position.set(sx, 3.8, wz);
      group.add(frame, glass);
    });
  });

  const boardFrame = new THREE.Mesh(
    new THREE.BoxGeometry(8.8, 3.8, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.65 }),
  );
  boardFrame.position.set(0, 3.6, -5.48);
  group.add(boardFrame);

  const blackboard = new THREE.Mesh(
    new THREE.PlaneGeometry(8.3, 3.35),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: createBlackboardTexture(anisotropy),
      roughness: 0.78,
    }),
  );
  blackboard.position.set(0, 3.6, -5.36);
  group.add(blackboard);

  const posterSpecs: Array<[number, string, string]> = [
    [-12.6, 'IIT JEE 2099', '#0D9488'],
    [-6.1, 'EXAM SCHEDULE', '#DC2626'],
    [6.1, 'TOPPER RULES', '#2563EB'],
    [12.6, 'EXTRA CLASS!', '#D97706'],
  ];
  posterSpecs.forEach(([px, title, accent]) => {
    const poster = new THREE.Mesh(
      new THREE.PlaneGeometry(1.85, 2.5),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: createExamPosterTexture(title, accent, anisotropy),
        roughness: 0.6,
      }),
    );
    poster.position.set(px, 3.6, -5.5);
    group.add(poster);
  });

  // Wooden Desks + Seated Students reacting to heavy hits!
  const deskWoodMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.68 });
  const deskLegMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.7 });
  const deskPositions = [-15.2, -5.2, -2.5, 2.5, 5.2, 15.2];
  const uniformColors = [0xf8fafc, 0x93c5fd, 0xfef08a, 0xf8fafc];
  const npcs: AmbientNpc[] = [];

  deskPositions.forEach((dx, idx) => {
    const desk = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.9), deskWoodMat);
    top.position.y = 1.02;
    top.castShadow = true;
    desk.add(top);
    const modesty = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.45, 0.08), deskWoodMat);
    modesty.position.set(0, 0.72, 0.35);
    desk.add(modesty);
    [-0.78, 0.78].forEach((lx) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 0.8), deskLegMat);
      leg.position.set(lx, 0.5, 0);
      desk.add(leg);
    });
    desk.position.set(dx, 0, -3.9);
    group.add(desk);

    // Seated coaching students behind center desks
    if (Math.abs(dx) < 8) {
      const student = createLowPolyNpc({
        shirtColor: uniformColors[idx % uniformColors.length],
        pantColor: 0x1e3a8a,
        mode: 'seated',
        x: dx,
        y: 0.25,
        z: -4.45,
        phase: idx * 1.4,
        isSecondary: idx === 1 || idx === 4,
      });
      group.add(student.group);
      npcs.push(student);
    }
  });

  // LEFT & RIGHT FLANK COACHING STUDENTS waving notebooks and pens (x = ±8.8..±13.6, z = -2.4..-3.9)
  const leftStudentSpecs: Array<[number, number, number, 'notebook' | 'pen', boolean]> = [
    [-9.1, -2.65, 0xf8fafc, 'notebook', false],
    [-10.25, -3.25, 0x93c5fd, 'pen', false],
    [-11.3, -2.55, 0xfef08a, 'notebook', false],
    [-12.45, -3.4, 0xf8fafc, 'pen', true],
    [-13.5, -2.85, 0xbfdbfe, 'notebook', true],
  ];
  leftStudentSpecs.forEach(([sx, sz, shirt, prop, isSecondary], idx) => {
    const s = createLowPolyNpc({
      shirtColor: shirt,
      pantColor: 0x1e3a8a,
      mode: 'supporter',
      prop,
      faceYaw: 0.32,
      x: sx,
      z: sz,
      phase: idx * 0.9,
      isSecondary,
    });
    group.add(s.group);
    npcs.push(s);
  });

  const rightStudentSpecs: Array<[number, number, number, 'notebook' | 'pen', boolean]> = [
    [9.1, -2.65, 0x93c5fd, 'notebook', false],
    [10.25, -3.25, 0xf8fafc, 'pen', false],
    [11.3, -2.55, 0xbfdbfe, 'notebook', false],
    [12.45, -3.4, 0xfef08a, 'pen', true],
    [13.5, -2.85, 0xf8fafc, 'notebook', true],
  ];
  rightStudentSpecs.forEach(([sx, sz, shirt, prop, isSecondary], idx) => {
    const s = createLowPolyNpc({
      shirtColor: shirt,
      pantColor: 0x1e3a8a,
      mode: 'supporter',
      prop,
      faceYaw: -0.32,
      x: sx,
      z: sz,
      phase: idx * 0.9 + 1.5,
      isSecondary,
    });
    group.add(s.group);
    npcs.push(s);
  });

  // 3 Rotating Ceiling Fans spanning the widened classroom
  const fanMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.3, metalness: 0.5 });
  const bladeGeo = new THREE.BoxGeometry(1.85, 0.04, 0.28);
  const fanBladeGroups: THREE.Group[] = [];
  [-11, 0, 11].forEach((fx) => {
    const fanGroup = new THREE.Group();
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 8), fanMat);
    rod.position.y = 0.7;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.18, 14), fanMat);
    fanGroup.add(rod, hub);

    const fanBlades = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(bladeGeo, fanMat);
      const angle = (i * Math.PI * 2) / 3;
      b.position.set(Math.cos(angle) * 0.95, 0, Math.sin(angle) * 0.95);
      b.rotation.y = -angle;
      fanBlades.add(b);
    }
    fanGroup.add(fanBlades);
    fanGroup.position.set(fx, 6.2, -2.5);
    group.add(fanGroup);
    fanBladeGroups.push(fanBlades);
  });

  const tubeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xe0f2fe,
    emissiveIntensity: 1.2,
  });
  [-13.5, -4.5, 4.5, 13.5].forEach((tx) => {
    const tube = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.14), tubeMat);
    tube.position.set(tx, 5.9, -5.35);
    group.add(tube);
  });

  return {
    id: 'school',
    group,
    backgroundColor: 0xe7e5e4,
    fogColor: 0xe7e5e4,
    fogNear: 24,
    fogFar: 54,
    keyLightColor: 0xfffbeb,
    keyLightIntensity: 1.9,
    hemiSkyColor: 0xe0f2fe,
    hemiGroundColor: 0x78716c,
    hemiIntensity: 0.95,
    rimLightColor: 0x38bdf8,
    rimLightIntensity: 0.7,
    update(elapsed, dt) {
      excitement = Math.max(0, excitement - dt);
      fanBladeGroups.forEach((blades, idx) => {
        blades.rotation.y = elapsed * (8.5 + excitement * 4) + idx * 1.1;
      });
      updateAmbientNpcs(npcs, elapsed, dt, excitement);
    },
    triggerExcitement(amount) {
      excitement = Math.min(2.0, Math.max(excitement, amount));
    },
    setLowGraphics(low) {
      npcs.forEach((n) => {
        if (n.isSecondary) n.group.visible = !low;
      });
    },
    dispose: () => disposeGroup(group),
  };
}

function buildNewsStudio(anisotropy: number): StageInstance {
  const group = new THREE.Group();
  let excitement = 0;

  const baseFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(58, 30),
    new THREE.MeshStandardMaterial({ color: 0x0b1120, roughness: 0.2, metalness: 0.45 }),
  );
  baseFloor.rotation.x = -Math.PI / 2;
  baseFloor.receiveShadow = true;
  group.add(baseFloor);

  // Dark studio architectural backdrop enclosure spanning x = -25 to +25
  const studioWallMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.65, metalness: 0.25 });
  const studioBackWall = new THREE.Mesh(new THREE.BoxGeometry(52, 9.5, 0.4), studioWallMat);
  studioBackWall.position.set(0, 4.75, -7.2);
  group.add(studioBackWall);

  // Glowing studio LED floor border strips extending across x = -19..+19
  const redNeonMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 1.4,
  });
  const blueNeonMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.4,
  });
  const floorStripLeft = new THREE.Mesh(new THREE.BoxGeometry(19, 0.04, 0.16), blueNeonMat);
  floorStripLeft.position.set(-9.5, 0.025, -2.15);
  const floorStripRight = new THREE.Mesh(new THREE.BoxGeometry(19, 0.04, 0.16), redNeonMat);
  floorStripRight.position.set(9.5, 0.025, -2.15);
  group.add(floorStripLeft, floorStripRight);

  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: createStudioFloorTexture(anisotropy),
    emissive: 0x1e3a8a,
    emissiveIntensity: 0.55,
    roughness: 0.25,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const ringDecal = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), ringMat);
  ringDecal.rotation.x = -Math.PI / 2;
  ringDecal.position.y = 0.025;
  group.add(ringDecal);

  // Dynamic Animated BREAKING BAKWAS Studio LED Screens spanning x = -18 to +18!
  const dynScreen = createDynamicNewsScreen(anisotropy);
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: dynScreen.texture,
    emissive: 0xffffff,
    emissiveMap: dynScreen.texture,
    emissiveIntensity: 0.72,
    roughness: 0.2,
  });
  const bezelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.8 });

  const panels: Array<[number, number, number]> = [
    [-15.2, -5.6, 0.22],
    [-7.6, -5.8, 0.16],
    [0, -6.1, 0],
    [7.6, -5.8, -0.16],
    [15.2, -5.6, -0.22],
  ];
  panels.forEach(([px, pz, ry]) => {
    const pGroup = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(7.2, 4.0, 0.25), bezelMat);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 3.6), screenMat);
    screen.position.z = 0.14;
    pGroup.add(frame, screen);
    pGroup.position.set(px, 3.1, pz);
    pGroup.rotation.y = ry;
    group.add(pGroup);
  });

  [-11.6, -3.9, 3.9, 11.6].forEach((px, idx) => {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 6.2, 12),
      idx % 2 === 0 ? redNeonMat : blueNeonMat,
    );
    pillar.position.set(px, 3.1, -5.5);
    group.add(pillar);
  });

  // Left & Right Live Debate Barricades (z = -2.55, waist-high so audience & placards pop above!)
  const barricadeBodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.65 });
  [-11.3, 11.3].forEach((bx, sideIdx) => {
    const barricade = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.78, 0.28), barricadeBodyMat);
    wall.position.y = 0.39;
    const neonTop = new THREE.Mesh(
      new THREE.BoxGeometry(6.24, 0.1, 0.32),
      sideIdx === 0 ? blueNeonMat : redNeonMat,
    );
    neonTop.position.y = 0.82;
    const neonMid = new THREE.Mesh(
      new THREE.BoxGeometry(6.0, 0.055, 0.3),
      sideIdx === 0 ? redNeonMat : blueNeonMat,
    );
    neonMid.position.y = 0.42;
    barricade.add(wall, neonTop, neonMid);
    barricade.position.set(bx, 0, -2.55);
    group.add(barricade);
  });

  // 2 Broadcast TV Camera Rigs + Moving Studio Camera Operators behind them!
  const camRigs: THREE.Group[] = [];
  const npcs: AmbientNpc[] = [];
  const camBodyMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.35, metalness: 0.7 });
  const tallyMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 1.8,
  });

  [-6.6, 6.6].forEach((cx, idx) => {
    const camRig = new THREE.Group();
    const tripod = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.5, 3), camBodyMat);
    tripod.position.y = 0.75;
    camRig.add(tripod);

    const head = new THREE.Group();
    head.position.y = 1.65;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.85), camBodyMat);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.45, 12), bezelMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.z = 0.55;
    const tally = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), tallyMat);
    tally.position.set(0, 0.3, 0.25);
    head.add(box, lens, tally);
    camRig.add(head);

    camRig.position.set(cx, 0, -2.9);
    camRig.lookAt(0, 1.4, 0);
    group.add(camRig);
    camRigs.push(head);

    const operator = createLowPolyNpc({
      shirtColor: 0x1e293b,
      pantColor: 0x0f172a,
      hasCap: true,
      mode: 'operator',
      x: cx + (idx === 0 ? -0.65 : 0.65),
      z: -3.45,
      phase: idx * 2,
    });
    operator.group.lookAt(0, 0.5, 0);
    group.add(operator.group);
    npcs.push(operator);
  });

  // Floor producer pacing in far back
  const producer = createLowPolyNpc({
    shirtColor: 0xdc2626,
    pantColor: 0x18181b,
    mode: 'stroll',
    x: 0,
    z: -4.4,
    walkMinX: -3.2,
    walkMaxX: 3.2,
    speed: 1.25,
    isSecondary: true,
  });
  group.add(producer.group);
  npcs.push(producer);

  // Studio audience placard textures
  const placardTrpTex = createCrowdSignTexture('TRP HIGH!', '#FACC15', '#DC2626', '#111827', anisotropy);
  const placardBreakingTex = createCrowdSignTexture('BREAKING!', '#DC2626', '#FACC15', '#FFFFFF', anisotropy);

  // LEFT & RIGHT LIVE STUDIO AUDIENCE behind debate barricades (x = ±8.8..±13.8, z = -3.1..-3.9)
  const studioLeftSpecs: Array<[number, number, number, 'placard' | 'none', THREE.CanvasTexture | undefined, boolean]> = [
    [-9.0, -3.15, 0x38bdf8, 'placard', placardTrpTex, false],
    [-10.2, -3.65, 0xf8fafc, 'none', undefined, false],
    [-11.35, -3.2, 0xf43f5e, 'placard', placardBreakingTex, false],
    [-12.5, -3.75, 0xfacc15, 'none', undefined, true],
    [-13.6, -3.25, 0x22c55e, 'placard', placardTrpTex, true],
  ];
  studioLeftSpecs.forEach(([sx, sz, shirt, prop, tex, isSecondary], idx) => {
    const member = createLowPolyNpc({
      shirtColor: shirt,
      pantColor: 0x1e293b,
      mode: 'supporter',
      prop,
      signTexture: tex,
      faceYaw: 0.28,
      x: sx,
      z: sz,
      phase: idx * 0.85,
      isSecondary,
    });
    group.add(member.group);
    npcs.push(member);
  });

  const studioRightSpecs: Array<[number, number, number, 'placard' | 'none', THREE.CanvasTexture | undefined, boolean]> = [
    [9.0, -3.15, 0xf43f5e, 'placard', placardBreakingTex, false],
    [10.2, -3.65, 0x38bdf8, 'none', undefined, false],
    [11.35, -3.2, 0xfacc15, 'placard', placardTrpTex, false],
    [12.5, -3.75, 0xf8fafc, 'none', undefined, true],
    [13.6, -3.25, 0xa855f7, 'placard', placardBreakingTex, true],
  ];
  studioRightSpecs.forEach(([sx, sz, shirt, prop, tex, isSecondary], idx) => {
    const member = createLowPolyNpc({
      shirtColor: shirt,
      pantColor: 0x1e293b,
      mode: 'supporter',
      prop,
      signTexture: tex,
      faceYaw: -0.28,
      x: sx,
      z: sz,
      phase: idx * 0.85 + 1.4,
      isSecondary,
    });
    group.add(member.group);
    npcs.push(member);
  });

  const redSpot = new THREE.PointLight(0xef4444, 18, 28, 1.5);
  redSpot.position.set(-6.5, 5.5, -1.5);
  const blueSpot = new THREE.PointLight(0x38bdf8, 18, 28, 1.5);
  blueSpot.position.set(6.5, 5.5, -1.5);
  group.add(redSpot, blueSpot);

  return {
    id: 'studio',
    group,
    backgroundColor: 0x090d1a,
    fogColor: 0x090d1a,
    fogNear: 24,
    fogFar: 56,
    keyLightColor: 0xf8fafc,
    keyLightIntensity: 1.75,
    hemiSkyColor: 0x38bdf8,
    hemiGroundColor: 0x7f1d1d,
    hemiIntensity: 0.78,
    rimLightColor: 0xf43f5e,
    rimLightIntensity: 1.25,
    update(elapsed, dt) {
      excitement = Math.max(0, excitement - dt);
      redSpot.position.x = -6.5 + Math.sin(elapsed * 1.4) * 3.0;
      blueSpot.position.x = 6.5 + Math.cos(elapsed * 1.4) * 3.0;
      ringDecal.rotation.z = elapsed * 0.16;
      ringMat.emissiveIntensity = 0.5 + Math.sin(elapsed * 3.5) * 0.18 + excitement * 0.3;
      camRigs.forEach((h, i) => {
        h.rotation.y = Math.sin(elapsed * 0.9 + i * 2) * 0.24;
      });
      dynScreen.update(elapsed, excitement);
      updateAmbientNpcs(npcs, elapsed, dt, excitement);
    },
    triggerExcitement(amount) {
      excitement = Math.min(2.0, Math.max(excitement, amount));
    },
    setLowGraphics(low) {
      npcs.forEach((n) => {
        if (n.isSecondary) n.group.visible = !low;
      });
    },
    dispose: () => disposeGroup(group, [placardTrpTex, placardBreakingTex]),
  };
}

function buildShaadiPandal(anisotropy: number): StageInstance {
  const group = new THREE.Group();
  let excitement = 0;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(86, 48),
    new THREE.MeshStandardMaterial({ color: 0x2b1117, roughness: 0.88 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const carpet = new THREE.Mesh(
    new THREE.PlaneGeometry(38, 8.5),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: createShaadiCarpetTexture(anisotropy),
      roughness: 0.85,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.y = 0.025;
  carpet.receiveShadow = true;
  group.add(carpet);

  const redClothMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.78 });
  const goldClothMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.55, metalness: 0.25 });
  const pinkClothMat = new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.72 });

  // Extended festive red/gold back drapery spanning x = -20 to +20
  for (let i = 0; i < 17; i++) {
    const x = -20 + i * 2.5;
    const drape = new THREE.Mesh(
      new THREE.BoxGeometry(2.48, 6.2, 0.35),
      i % 2 === 0 ? redClothMat : goldClothMat,
    );
    drape.position.set(x, 3.1, -6.2);
    group.add(drape);
  }

  const archMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.25, metalness: 0.75 });
  const arch = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.28, 10, 28, Math.PI), archMat);
  arch.position.set(0, 1.8, -5.5);
  group.add(arch);

  [-17.2, -10.5, -3.2, 3.2, 10.5, 17.2].forEach((px) => {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 3.8, 12), goldClothMat);
    col.position.set(px, 1.9, -5.5);
    group.add(col);
  });

  const buffetBannerTex = createBuffetBannerTexture(anisotropy);
  buffetBannerTex.userData.shared = true;
  const dishMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.88 });
  const tableClothMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6 });

  const buildBuffetCounter = (bx: number, bz: number, width: number, rotY = 0) => {
    const buffet = new THREE.Group();
    const tableCloth = new THREE.Mesh(new THREE.BoxGeometry(width, 1.05, 1.1), tableClothMat);
    tableCloth.position.y = 0.525;
    buffet.add(tableCloth);

    [-1.1, 0, 1.1].forEach((dx) => {
      const dish = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.3, 0.56), dishMat);
      dish.position.set(dx * (width / 4.2), 1.2, 0);
      buffet.add(dish);
    });

    const buffetSign = new THREE.Mesh(
      new THREE.BoxGeometry(width - 0.15, 0.76, 0.08),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: buffetBannerTex,
        roughness: 0.45,
      }),
    );
    buffetSign.position.set(0, 2.35, -0.45);
    buffet.add(buffetSign);
    buffet.position.set(bx, 0, bz);
    buffet.rotation.y = rotY;
    group.add(buffet);
  };

  // Center Shahi Paneer Buffet + Right Flank Buffet Side (x = +14.2)
  buildBuffetCounter(0, -4.65, 4.4, 0);
  buildBuffetCounter(14.3, -3.9, 3.9, -0.22);

  // LEFT FLANK DJ CORNER (x = -14.3, z = -3.9): Dual speaker stacks + glowing DJ console!
  const djCorner = new THREE.Group();
  const speakerBodyMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.45, metalness: 0.4 });
  const wooferGlowMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0xec4899,
    emissiveIntensity: 1.5,
  });
  [-1.55, 1.55].forEach((sx) => {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.8, 0.95), speakerBodyMat);
    tower.position.set(sx, 1.4, 0);
    djCorner.add(tower);
    [0.8, 1.95].forEach((wy) => {
      const woofer = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.06, 8, 16), wooferGlowMat);
      woofer.position.set(sx, wy, 0.49);
      djCorner.add(woofer);
    });
  });
  const djDesk = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.12, 0.85), speakerBodyMat);
  djDesk.position.set(0, 0.56, 0.08);
  djCorner.add(djDesk);
  const djBannerTex = createDjBannerTexture(anisotropy);
  const djBanner = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 0.88, 0.1),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: djBannerTex,
      emissive: 0xffffff,
      emissiveMap: djBannerTex,
      emissiveIntensity: 0.45,
      roughness: 0.35,
    }),
  );
  djBanner.position.set(0, 3.15, 0.15);
  djCorner.add(djBanner);
  djCorner.position.set(-14.3, 0, -3.9);
  djCorner.rotation.y = 0.24;
  group.add(djCorner);

  // Extended overhead pink/gold pandal canopy spanning x = -18 to +18
  for (let i = 0; i < 13; i++) {
    const x = -18 + i * 3;
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(2.95, 0.16, 10),
      i % 2 === 0 ? pinkClothMat : goldClothMat,
    );
    canopy.position.set(x, 6.3, -2.5);
    group.add(canopy);
  }

  // Stacked Molded Plastic Chairs
  const chairMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.35 });
  const chairMatAlt = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.38 });
  [-6.8, 6.8].forEach((sx, sideIdx) => {
    const stack = new THREE.Group();
    const mat = sideIdx === 0 ? chairMat : chairMatAlt;
    for (let c = 0; c < 4; c++) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.08, 0.72), mat);
      seat.position.y = 0.55 + c * 0.22;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.65, 0.08), mat);
      back.position.set(0, 0.88 + c * 0.22, -0.32);
      stack.add(seat, back);
    }
    [
      [-0.32, -0.3],
      [0.32, -0.3],
      [-0.32, 0.3],
      [0.32, 0.3],
    ].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.55, 6), mat);
      leg.position.set(lx, 0.275, lz);
      stack.add(leg);
    });
    stack.position.set(sx, 0, -3.5);
    stack.rotation.y = sideIdx === 0 ? 0.35 : -0.35;
    group.add(stack);
  });

  // Blinking Colorful Fairy / DJ Lights spanning x = -16.8 to +16.8
  const fairyBulbs: THREE.MeshStandardMaterial[] = [];
  const bulbColors = [0xfef08a, 0xec4899, 0x38bdf8, 0x4ade80, 0xf97316];
  const bulbGeo = new THREE.SphereGeometry(0.14, 8, 8);
  for (let i = 0; i < 27; i++) {
    const col = bulbColors[i % bulbColors.length];
    const mat = new THREE.MeshStandardMaterial({
      color: col,
      emissive: col,
      emissiveIntensity: 1.5,
    });
    fairyBulbs.push(mat);
    const bulb = new THREE.Mesh(bulbGeo, mat);
    bulb.position.set(-16.8 + i * 1.29, 5.5 + Math.sin(i * 0.9) * 0.35, -4.6);
    group.add(bulb);
  }

  // Shaadi Guests strolling center + clapping near Left DJ Corner & Right Buffet Side!
  const npcs: AmbientNpc[] = [
    createLowPolyNpc({
      shirtColor: 0xfacc15,
      pantColor: 0xf8fafc,
      turbanColor: 0xdc2626,
      mode: 'stroll',
      x: -3.6,
      z: -3.5,
      walkMinX: -5.2,
      walkMaxX: -1.4,
      speed: 0.9,
    }),
    createLowPolyNpc({
      shirtColor: 0xec4899,
      pantColor: 0xf59e0b,
      mode: 'stroll',
      x: 3.4,
      z: -3.5,
      walkMinX: 1.4,
      walkMaxX: 5.2,
      speed: 1.0,
    }),
    createLowPolyNpc({
      shirtColor: 0x10b981,
      pantColor: 0xfef3c7,
      turbanColor: 0xf97316,
      mode: 'vendor',
      x: 0.2,
      z: -5.2,
      isSecondary: true,
    }),

    // LEFT DJ CORNER GUESTS (x = -8.7 to -12.6, z = -2.4 to -3.6)
    createLowPolyNpc({
      shirtColor: 0xf97316,
      pantColor: 0xfef3c7,
      turbanColor: 0xec4899,
      mode: 'supporter',
      prop: 'none',
      faceYaw: 0.34,
      x: -8.8,
      z: -2.6,
      phase: 0.3,
    }),
    createLowPolyNpc({
      shirtColor: 0xec4899,
      pantColor: 0xbe185d,
      sareeColor: 0xfacc15,
      mode: 'supporter',
      prop: 'none',
      faceYaw: 0.32,
      x: -9.85,
      z: -3.2,
      phase: 1.1,
    }),
    createLowPolyNpc({
      shirtColor: 0x38bdf8,
      pantColor: 0xf8fafc,
      turbanColor: 0xfacc15,
      mode: 'supporter',
      prop: 'none',
      faceYaw: 0.36,
      x: -10.85,
      z: -2.55,
      phase: 1.9,
    }),
    createLowPolyNpc({
      shirtColor: 0x10b981,
      pantColor: 0x047857,
      sareeColor: 0xfef08a,
      mode: 'supporter',
      prop: 'none',
      faceYaw: 0.34,
      x: -11.8,
      z: -3.35,
      phase: 2.7,
      isSecondary: true,
    }),
    createLowPolyNpc({
      shirtColor: 0xa855f7,
      pantColor: 0xfef3c7,
      turbanColor: 0xef4444,
      mode: 'supporter',
      prop: 'none',
      faceYaw: 0.3,
      x: -12.65,
      z: -2.75,
      phase: 3.5,
      isSecondary: true,
    }),

    // RIGHT BUFFET SIDE GUESTS (x = +8.7 to +12.6, z = -2.4 to -3.6)
    createLowPolyNpc({
      shirtColor: 0xfacc15,
      pantColor: 0xf8fafc,
      turbanColor: 0xdc2626,
      mode: 'supporter',
      prop: 'none',
      faceYaw: -0.34,
      x: 8.8,
      z: -2.6,
      phase: 0.6,
    }),
    createLowPolyNpc({
      shirtColor: 0xe11d48,
      pantColor: 0x9f1239,
      sareeColor: 0xfde047,
      mode: 'supporter',
      prop: 'none',
      faceYaw: -0.32,
      x: 9.85,
      z: -3.2,
      phase: 1.4,
    }),
    createLowPolyNpc({
      shirtColor: 0x14b8a6,
      pantColor: 0xfef3c7,
      turbanColor: 0xf97316,
      mode: 'supporter',
      prop: 'none',
      faceYaw: -0.36,
      x: 10.85,
      z: -2.55,
      phase: 2.2,
    }),
    createLowPolyNpc({
      shirtColor: 0x6366f1,
      pantColor: 0x3730a3,
      sareeColor: 0xf472b6,
      mode: 'supporter',
      prop: 'none',
      faceYaw: -0.34,
      x: 11.8,
      z: -3.35,
      phase: 3.0,
      isSecondary: true,
    }),
    createLowPolyNpc({
      shirtColor: 0xf97316,
      pantColor: 0xf8fafc,
      turbanColor: 0x22c55e,
      mode: 'supporter',
      prop: 'none',
      faceYaw: -0.3,
      x: 12.65,
      z: -2.75,
      phase: 3.8,
      isSecondary: true,
    }),
  ];
  npcs.forEach((n) => group.add(n.group));

  const djLight = new THREE.PointLight(0xec4899, 14, 28, 1.4);
  djLight.position.set(0, 5.2, -1.5);
  group.add(djLight);

  return {
    id: 'shaadi',
    group,
    backgroundColor: 0x260915,
    fogColor: 0x260915,
    fogNear: 24,
    fogFar: 58,
    keyLightColor: 0xffe8b6,
    keyLightIntensity: 2.0,
    hemiSkyColor: 0xf472b6,
    hemiGroundColor: 0x7f1d1d,
    hemiIntensity: 0.85,
    rimLightColor: 0xfacc15,
    rimLightIntensity: 1.15,
    update(elapsed, dt) {
      excitement = Math.max(0, excitement - dt);
      fairyBulbs.forEach((mat, i) => {
        const pulse = Math.sin(elapsed * (6.5 + excitement * 4) + i * 0.9);
        mat.emissiveIntensity = pulse > 0 ? 1.8 : 0.25;
      });
      wooferGlowMat.emissiveIntensity = 1.0 + Math.abs(Math.sin(elapsed * (7.5 + excitement * 4))) * 1.1;
      djLight.color.setHSL((elapsed * 0.18) % 1, 0.85, 0.55);
      updateAmbientNpcs(npcs, elapsed, dt, excitement);
    },
    triggerExcitement(amount) {
      excitement = Math.min(2.0, Math.max(excitement, amount));
    },
    setLowGraphics(low) {
      npcs.forEach((n) => {
        if (n.isSecondary) n.group.visible = !low;
      });
    },
    dispose: () => disposeGroup(group, [buffetBannerTex, djBannerTex]),
  };
}

function buildRailwayStation(anisotropy: number): StageInstance {
  const group = new THREE.Group();
  let excitement = 0;

  const ballast = new THREE.Mesh(
    new THREE.PlaneGeometry(108, 54),
    new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.95 }),
  );
  ballast.rotation.x = -Math.PI / 2;
  ballast.position.y = -0.65;
  group.add(ballast);

  const platTopTex = createRailwayPlatformTexture(anisotropy);
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(48, 0.65, 8.5),
    new THREE.MeshStandardMaterial({ color: 0xffffff, map: platTopTex, roughness: 0.8 }),
  );
  platform.position.set(0, -0.325, 0.4);
  platform.receiveShadow = true;
  group.add(platform);

  const railMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.85 });
  [-4.9, -6.2].forEach((rz) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(96, 0.12, 0.14), railMat);
    rail.position.set(0, -0.58, rz);
    group.add(rail);
  });

  const steelMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.45, metalness: 0.55 });
  [-15, -7.5, 0, 7.5, 15].forEach((px) => {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6.2, 10), steelMat);
    col.position.set(px, 3.1, -3.4);
    group.add(col);
  });
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(42, 0.22, 5.5),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 }),
  );
  roof.position.set(0, 6.2, -2.5);
  roof.rotation.x = 0.08;
  group.add(roof);

  const stationBoardTex = createStationBoardTexture(anisotropy);
  stationBoardTex.userData.shared = true;
  const stationBoardMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: stationBoardTex,
    roughness: 0.4,
  });

  // Main + flank platform nameboards spanning the widened station
  [-12.6, -2.5, 12.6].forEach((bx) => {
    const board = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.45, 0.16), stationBoardMat);
    board.position.set(bx, 4.45, -3.2);
    group.add(board);
  });

  // Classic Railway Platform Wooden Benches on both flanks
  const benchWoodMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.78 });
  const benchIronMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.7 });
  [-11.8, 11.8].forEach((bx) => {
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 0.65), benchWoodMat);
    seat.position.y = 0.55;
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.55, 0.1), benchWoodMat);
    back.position.set(0, 0.88, -0.28);
    bench.add(seat, back);
    [-1.1, 1.1].forEach((lx) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.58), benchIronMat);
      leg.position.set(lx, 0.275, 0);
      bench.add(leg);
    });
    bench.position.set(bx, 0, -3.55);
    group.add(bench);
  });

  const stall = new THREE.Group();
  const stallBody = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 2.3, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.6 }),
  );
  stallBody.position.y = 1.15;
  const counterTop = new THREE.Mesh(
    new THREE.BoxGeometry(2.95, 0.12, 1.6),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 }),
  );
  counterTop.position.y = 1.1;
  const stallSign = new THREE.Mesh(
    new THREE.BoxGeometry(2.9, 0.65, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xffffff, map: createChaiSignTexture(anisotropy), roughness: 0.4 }),
  );
  stallSign.position.set(0, 2.55, 0.68);
  stall.add(stallBody, counterTop, stallSign);
  stall.position.set(5.4, 0, -2.9);
  group.add(stall);

  // Platform Passengers + Red-Shirt Coolies + Chai Vendors (strictly behind z <= -2.15)
  const npcs: AmbientNpc[] = [
    createLowPolyNpc({
      shirtColor: 0xfef08a,
      pantColor: 0x1e293b,
      mode: 'vendor',
      x: 5.4,
      z: -2.15,
    }),
    createLowPolyNpc({
      shirtColor: 0xdc2626,
      pantColor: 0xf8fafc,
      turbanColor: 0xfacc15,
      mode: 'stroll',
      x: -4.2,
      z: -2.8,
      walkMinX: -6.8,
      walkMaxX: 2.2,
      speed: 1.25,
    }),
    createLowPolyNpc({
      shirtColor: 0x38bdf8,
      pantColor: 0x334155,
      mode: 'stroll',
      x: 1.2,
      z: -3.2,
      walkMinX: -5.5,
      walkMaxX: 3.2,
      speed: 1.05,
      isSecondary: true,
    }),

    // LEFT PLATFORM END SUPPORTERS: Red-Shirt Coolies, Passengers & Chai Vendors!
    createLowPolyNpc({
      shirtColor: 0xdc2626, // Iconic Red-Shirt Coolie!
      pantColor: 0xf8fafc,
      turbanColor: 0xf8fafc,
      mode: 'supporter',
      prop: 'luggage',
      faceYaw: 0.32,
      x: -8.9,
      z: -2.6,
      phase: 0.2,
    }),
    createLowPolyNpc({
      shirtColor: 0xfacc15, // Platform Chai Vendor
      pantColor: 0x334155,
      mode: 'supporter',
      prop: 'chai',
      faceYaw: 0.34,
      x: -10.1,
      z: -3.0,
      phase: 1.0,
    }),
    createLowPolyNpc({
      shirtColor: 0x38bdf8, // Cheering Passenger
      pantColor: 0x1e293b,
      mode: 'supporter',
      prop: 'none',
      faceYaw: 0.3,
      x: -11.2,
      z: -2.45,
      phase: 1.8,
    }),
    createLowPolyNpc({
      shirtColor: 0xdc2626, // Second Red-Shirt Coolie!
      pantColor: 0xf8fafc,
      turbanColor: 0xfacc15,
      mode: 'supporter',
      prop: 'luggage',
      faceYaw: 0.36,
      x: -12.45,
      z: -2.9,
      phase: 2.6,
      isSecondary: true,
    }),
    createLowPolyNpc({
      shirtColor: 0xec4899,
      pantColor: 0x9d174d,
      sareeColor: 0xfef08a,
      mode: 'supporter',
      prop: 'none',
      faceYaw: 0.32,
      x: -13.6,
      z: -2.6,
      phase: 3.4,
      isSecondary: true,
    }),

    // RIGHT PLATFORM END SUPPORTERS: Red-Shirt Coolies, Passengers & Chai Vendors!
    createLowPolyNpc({
      shirtColor: 0xdc2626, // Iconic Red-Shirt Coolie!
      pantColor: 0xf8fafc,
      turbanColor: 0xf8fafc,
      mode: 'supporter',
      prop: 'luggage',
      faceYaw: -0.32,
      x: 8.9,
      z: -2.6,
      phase: 0.6,
    }),
    createLowPolyNpc({
      shirtColor: 0xf97316, // Platform Chai Vendor
      pantColor: 0x1e293b,
      mode: 'supporter',
      prop: 'chai',
      faceYaw: -0.34,
      x: 10.1,
      z: -3.0,
      phase: 1.4,
    }),
    createLowPolyNpc({
      shirtColor: 0x10b981, // Cheering Passenger
      pantColor: 0x1e293b,
      mode: 'supporter',
      prop: 'none',
      faceYaw: -0.3,
      x: 11.2,
      z: -2.45,
      phase: 2.2,
    }),
    createLowPolyNpc({
      shirtColor: 0xdc2626, // Second Red-Shirt Coolie!
      pantColor: 0xf8fafc,
      turbanColor: 0xfacc15,
      mode: 'supporter',
      prop: 'luggage',
      faceYaw: -0.36,
      x: 12.45,
      z: -2.9,
      phase: 3.0,
      isSecondary: true,
    }),
    createLowPolyNpc({
      shirtColor: 0x6366f1,
      pantColor: 0x334155,
      mode: 'supporter',
      prop: 'chai',
      faceYaw: -0.32,
      x: 13.6,
      z: -2.6,
      phase: 3.8,
      isSecondary: true,
    }),
  ];
  npcs.forEach((n) => group.add(n.group));

  // Passing Stylized Indian Express Train
  const trainGroup = new THREE.Group();
  const coachBlueMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.32, metalness: 0.2 });
  const coachStripeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
  const winGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfef08a,
    emissiveIntensity: 0.85,
  });
  const locoRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3, metalness: 0.25 });

  for (let c = 0; c < 4; c++) {
    const coach = new THREE.Group();
    const isEngine = c === 0;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(6.8, 2.55, 2.1),
      isEngine ? locoRedMat : coachBlueMat,
    );
    body.position.y = 1.45;
    coach.add(body);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(6.85, 0.36, 2.14), coachStripeMat);
    stripe.position.y = 1.25;
    coach.add(stripe);

    for (let w = 0; w < 5; w++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.68, 2.18), winGlowMat);
      win.position.set(-2.3 + w * 1.15, 1.9, 0);
      coach.add(win);
    }
    coach.position.x = c * 7.25;
    trainGroup.add(coach);
  }
  trainGroup.position.set(-48, -0.55, -5.55);
  group.add(trainGroup);

  return {
    id: 'railway',
    group,
    backgroundColor: 0x93c5fd,
    fogColor: 0x93c5fd,
    fogNear: 26,
    fogFar: 62,
    keyLightColor: 0xfff7e6,
    keyLightIntensity: 2.0,
    hemiSkyColor: 0xbae6fd,
    hemiGroundColor: 0x57534e,
    hemiIntensity: 0.9,
    rimLightColor: 0xfacc15,
    rimLightIntensity: 0.85,
    update(elapsed, dt) {
      excitement = Math.max(0, excitement - dt);
      const cycle = (elapsed * 9.5) % 108;
      trainGroup.position.x = -48 + cycle;
      updateAmbientNpcs(npcs, elapsed, dt, excitement);
    },
    triggerExcitement(amount) {
      excitement = Math.min(2.0, Math.max(excitement, amount));
    },
    setLowGraphics(low) {
      npcs.forEach((n) => {
        if (n.isSecondary) n.group.visible = !low;
      });
    },
    dispose: () => disposeGroup(group, [stationBoardTex]),
  };
}

function createAssemblyCourtyardTexture(anisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  // Warm sun-baked Indian school courtyard stone pavers
  ctx.fillStyle = '#D6CBB8';
  ctx.fillRect(0, 0, 512, 512);

  const tile = 64;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const shade = ((row + col) % 2 === 0 ? 0 : -10) + ((row * 3 + col * 5) % 7) - 3;
      const r = 214 + shade;
      const g = 202 + shade;
      const b = 183 + shade;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(col * tile + 2, row * tile + 2, tile - 4, tile - 4);
    }
  }

  // Crisp assembly white chalk lineup guide lines
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.fillRect(0, 248, 512, 12);

  // Grout lines
  ctx.strokeStyle = 'rgba(115, 102, 86, 0.35)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 512; i += tile) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 4.5);
  tex.anisotropy = anisotropy;
  return tex;
}

function createSchoolFacadeSignTexture(anisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#0F294A';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 496, 112);

  ctx.fillStyle = '#FEF08A';
  ctx.font = '900 30px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ST. ROY CONVENT SCHOOL', 256, 48);

  ctx.fillStyle = '#CBE6F5';
  ctx.font = '700 18px sans-serif';
  ctx.fillText('DISCIPLINE · EXCELLENCE · PIN-DROP SILENCE', 256, 92);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

function buildSchoolAssemblyGround(anisotropy: number): StageInstance {
  const group = new THREE.Group();
  let excitement = 0;

  // 1. Tiled School Assembly Courtyard Floor (warm stone tint so white cassock & uniforms pop crisply)
  const floorTex = createAssemblyCourtyardTexture(anisotropy);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(88, 52),
    new THREE.MeshStandardMaterial({
      color: 0xd5cfc4,
      map: floorTex,
      roughness: 0.9,
      metalness: 0.01,
      envMapIntensity: 0.2,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Subtle decorative brick courtyard border behind fighting plane
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.88, envMapIntensity: 0.18 });
  const backCurb = new THREE.Mesh(new THREE.BoxGeometry(46, 0.24, 0.6), curbMat);
  backCurb.position.set(0, 0.12, -4.6);
  backCurb.receiveShadow = true;
  group.add(backCurb);

  // 2. Classic Indian Convent / Heritage School Building Facade with Arches & Windows
  const plasterTex = createPlasterWallTexture('#DCC39B', anisotropy);
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: plasterTex,
    roughness: 0.9,
    envMapIntensity: 0.18,
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xefe5d2, roughness: 0.84, envMapIntensity: 0.18 });
  const terracottaMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.82, envMapIntensity: 0.2 });
  const archShadowMat = new THREE.MeshStandardMaterial({ color: 0x263447, roughness: 0.92, envMapIntensity: 0.15 });
  const windowGlassMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    roughness: 0.26,
    metalness: 0.3,
  });
  const shutterMat = new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.68, envMapIntensity: 0.2 });

  // Main long two-story school building facade spanning x = -22 to +22
  const mainBuilding = new THREE.Mesh(new THREE.BoxGeometry(44, 7.6, 2.2), wallMat);
  mainBuilding.position.set(0, 3.8, -8.2);
  mainBuilding.receiveShadow = true;
  group.add(mainBuilding);

  // Terracotta cornice & roof parapet trim
  const roofBand = new THREE.Mesh(new THREE.BoxGeometry(44.6, 0.55, 2.55), terracottaMat);
  roofBand.position.set(0, 7.75, -8.2);
  const midLedge = new THREE.Mesh(new THREE.BoxGeometry(44.4, 0.28, 2.45), terracottaMat);
  midLedge.position.set(0, 4.15, -8.15);
  group.add(roofBand, midLedge);

  // Central School Entrance Pediment & Signboard ("ST. ROY CONVENT SCHOOL") clearly visible in 2.5D fight camera
  const pediment = new THREE.Mesh(new THREE.BoxGeometry(8.8, 1.5, 2.55), wallMat);
  pediment.position.set(0, 8.65, -8.15);
  const pedimentCap = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.34, 2.75), terracottaMat);
  pedimentCap.position.set(0, 9.55, -8.15);
  group.add(pediment, pedimentCap);

  const signTex = createSchoolFacadeSignTexture(anisotropy);
  const schoolSign = new THREE.Mesh(
    new THREE.BoxGeometry(7.6, 1.25, 0.14),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: signTex,
      roughness: 0.45,
      envMapIntensity: 0.2,
    }),
  );
  schoolSign.position.set(0, 5.1, -6.98);
  group.add(schoolSign);

  // Ground-floor arched corridor colonnade + upper-story classroom windows
  const archPositions = [-16.5, -13.2, -9.9, -6.6, -3.3, 0, 3.3, 6.6, 9.9, 13.2, 16.5];
  archPositions.forEach((ax) => {
    // Recessed dark arch doorway/corridor opening
    const recess = new THREE.Mesh(new THREE.BoxGeometry(2.1, 3.0, 0.25), archShadowMat);
    recess.position.set(ax, 1.65, -7.05);
    group.add(recess);

    // Arched top cream trim
    const archTop = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.16, 8, 16, Math.PI),
      trimMat,
    );
    archTop.position.set(ax, 2.85, -6.95);
    group.add(archTop);

    // Classic cream veranda pillar between bays
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.45, 4.0, 0.55), trimMat);
    pillar.position.set(ax + 1.65, 2.0, -6.92);
    group.add(pillar);

    // Upper-story classroom windows (skip center directly behind signboard)
    if (Math.abs(ax) > 4.2) {
      const winFrame = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.55, 0.18), shutterMat);
      winFrame.position.set(ax, 5.65, -7.05);
      const winGlass = new THREE.Mesh(new THREE.BoxGeometry(1.48, 1.24, 0.22), windowGlassMat);
      winGlass.position.set(ax, 5.65, -7.03);
      group.add(winFrame, winGlass);
    }
  });

  // 3. Raised School Assembly Podium + Microphone Stand (center-left background landmark)
  const podiumGroup = new THREE.Group();
  const stageDeckMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.78 });
  const podiumWoodMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.52 });
  const podiumGoldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3, metalness: 0.6 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.88 });

  const dais = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.55, 2.2), stageDeckMat);
  dais.position.y = 0.275;
  dais.receiveShadow = true;
  const daisCarpet = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 0.04, 1.9),
    new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.85 }),
  );
  daisCarpet.position.y = 0.56;
  podiumGroup.add(dais, daisCarpet);

  // Wooden Principal Lectern + Gold Emblem + Mic
  const lectern = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.18, 0.62), podiumWoodMat);
  lectern.position.set(0, 1.15, 0.35);
  lectern.castShadow = true;
  const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 14), podiumGoldMat);
  emblem.rotation.x = Math.PI / 2;
  emblem.position.set(0, 1.32, 0.68);
  const micStem = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.34, 8), chromeMat);
  micStem.position.set(0.14, 1.88, 0.38);
  micStem.rotation.x = 0.28;
  const micHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 }),
  );
  micHead.position.set(0.14, 2.04, 0.44);
  podiumGroup.add(lectern, emblem, micStem, micHead);
  podiumGroup.position.set(-2.6, 0, -5.0);
  group.add(podiumGroup);

  // 4. Tall School Flagpole + Gently Waving Institutional Pennant (center-right landmark)
  const flagGroup = new THREE.Group();
  const flagBase = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.72, 0.52, 12), trimMat);
  flagBase.position.y = 0.26;
  const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 7.6, 12), chromeMat);
  flagPole.position.y = 4.0;
  flagPole.castShadow = true;
  const flagFinial = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), podiumGoldMat);
  flagFinial.position.y = 7.85;
  flagGroup.add(flagBase, flagPole, flagFinial);

  const pennantPivot = new THREE.Group();
  pennantPivot.position.set(0.06, 7.15, 0);
  const pennantTop = new THREE.Mesh(
    new THREE.BoxGeometry(1.75, 0.34, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.7 }),
  );
  pennantTop.position.set(0.88, 0.34, 0);
  const pennantMid = new THREE.Mesh(
    new THREE.BoxGeometry(1.75, 0.34, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 }),
  );
  pennantMid.position.set(0.88, 0, 0);
  const pennantBot = new THREE.Mesh(
    new THREE.BoxGeometry(1.75, 0.34, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.7 }),
  );
  pennantBot.position.set(0.88, -0.34, 0);
  pennantPivot.add(pennantTop, pennantMid, pennantBot);
  flagGroup.add(pennantPivot);
  flagGroup.position.set(3.2, 0, -5.1);
  group.add(flagGroup);

  // 5. Flanking Courtyard Ashoka Trees on Far Left & Far Right
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.82 });
  [-15.6, -11.8, 11.8, 15.6].forEach((tx) => {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 2.2, 8), trunkMat);
    trunk.position.y = 1.1;
    const crown1 = new THREE.Mesh(new THREE.ConeGeometry(1.15, 2.8, 10), leafMat);
    crown1.position.y = 3.2;
    const crown2 = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.4, 10), leafMat);
    crown2.position.y = 4.6;
    tree.add(trunk, crown1, crown2);
    tree.position.set(tx, 0, -5.6);
    group.add(tree);
  });

  // 6. Left & Right Flanking Cheering School Assembly Crowds (uniform white shirts & navy pants!)
  const signDisciplineTex = createCrowdSignTexture('DISCIPLINE!', '#DC2626', '#FEF08A', '#FFFFFF', anisotropy);
  const signSilenceTex = createCrowdSignTexture('PIN-DROP SILENCE!', '#0284C7', '#FFFFFF', '#FEF08A', anisotropy);

  const npcs: AmbientNpc[] = [];
  const leftSpecs: Array<[number, number, number, 'placard' | 'none', THREE.CanvasTexture | undefined, boolean]> = [
    [-8.9, -3.15, 0xf8fafc, 'placard', signDisciplineTex, false],
    [-10.1, -3.65, 0xe0f2fe, 'none', undefined, false],
    [-11.3, -3.2, 0xf8fafc, 'placard', signSilenceTex, false],
    [-12.5, -3.7, 0xf8fafc, 'none', undefined, true],
    [-13.7, -3.25, 0xe0f2fe, 'placard', signDisciplineTex, true],
  ];
  leftSpecs.forEach(([sx, sz, shirt, prop, tex, isSecondary], idx) => {
    const student = createLowPolyNpc({
      shirtColor: shirt,
      pantColor: 0x1e3a5f,
      mode: 'supporter',
      prop,
      signTexture: tex,
      faceYaw: 0.28,
      x: sx,
      z: sz,
      phase: idx * 0.85,
      isSecondary,
    });
    group.add(student.group);
    npcs.push(student);
  });

  const rightSpecs: Array<[number, number, number, 'placard' | 'none', THREE.CanvasTexture | undefined, boolean]> = [
    [8.9, -3.15, 0xf8fafc, 'placard', signSilenceTex, false],
    [10.1, -3.65, 0xe0f2fe, 'none', undefined, false],
    [11.3, -3.2, 0xf8fafc, 'placard', signDisciplineTex, false],
    [12.5, -3.7, 0xf8fafc, 'none', undefined, true],
    [13.7, -3.25, 0xe0f2fe, 'placard', signSilenceTex, true],
  ];
  rightSpecs.forEach(([sx, sz, shirt, prop, tex, isSecondary], idx) => {
    const student = createLowPolyNpc({
      shirtColor: shirt,
      pantColor: 0x1e3a5f,
      mode: 'supporter',
      prop,
      signTexture: tex,
      faceYaw: -0.28,
      x: sx,
      z: sz,
      phase: idx * 0.85 + 1.2,
      isSecondary,
    });
    group.add(student.group);
    npcs.push(student);
  });

  return {
    id: 'assembly',
    group,
    backgroundColor: 0x8cc8f2,
    fogColor: 0x9fd2f5,
    fogNear: 28,
    fogFar: 64,
    keyLightColor: 0xfff3dc,
    keyLightIntensity: 1.62,
    hemiSkyColor: 0xbae6fd,
    hemiGroundColor: 0x6b5a47,
    hemiIntensity: 0.66,
    rimLightColor: 0xfef08a,
    rimLightIntensity: 0.92,
    update(elapsed, dt) {
      excitement = Math.max(0, excitement - dt);
      pennantPivot.rotation.y = Math.sin(elapsed * 2.6) * 0.24;
      pennantPivot.rotation.z = Math.cos(elapsed * 3.4) * 0.05;
      updateAmbientNpcs(npcs, elapsed, dt, excitement);
    },
    triggerExcitement(amount) {
      excitement = Math.min(2.0, Math.max(excitement, amount));
    },
    setLowGraphics(low) {
      npcs.forEach((n) => {
        if (n.isSecondary) n.group.visible = !low;
      });
    },
    dispose: () => disposeGroup(group, [floorTex, plasterTex, signTex, signDisciplineTex, signSilenceTex]),
  };
}

export function buildStage(id: StageId, anisotropy = 4): StageInstance {
  switch (id) {
    case 'mohalla':
      return buildDesiMohalla(anisotropy);
    case 'school':
      return buildSchoolCoaching(anisotropy);
    case 'studio':
      return buildNewsStudio(anisotropy);
    case 'shaadi':
      return buildShaadiPandal(anisotropy);
    case 'railway':
      return buildRailwayStation(anisotropy);
    case 'assembly':
      return buildSchoolAssemblyGround(anisotropy);
  }
}
