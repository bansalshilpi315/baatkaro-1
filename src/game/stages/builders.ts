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

function disposeGroup(group: THREE.Group): void {
  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      mesh.geometry.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        const std = m as THREE.MeshStandardMaterial;
        if (std.map) std.map.dispose();
        m.dispose();
      });
    }
  });
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
    new THREE.PlaneGeometry(80, 48),
    new THREE.MeshStandardMaterial({ color: 0xffffff, map: roadTex, roughness: 0.86, metalness: 0.04 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const houseHexes = ['#f59e0b', '#0d9488', '#e11d48', '#f97316', '#0284c7', '#d97706'];
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2, metalness: 0.5 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.75 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.4, metalness: 0.7 });

  for (let i = 0; i < 6; i++) {
    const hx = -13.5 + i * 5.4;
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

  // Swaying bunting
  const flags: THREE.Mesh[] = [];
  const flagColors = [0xef4444, 0xfacc15, 0x22c55e, 0xec4899, 0x38bdf8];
  const flagGeo = new THREE.PlaneGeometry(0.45, 0.55);
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const x = -8.5 + t * 17;
    const sag = Math.sin(t * Math.PI) * 0.7;
    const flag = new THREE.Mesh(
      flagGeo,
      new THREE.MeshStandardMaterial({
        color: flagColors[i % flagColors.length],
        side: THREE.DoubleSide,
        roughness: 0.7,
      }),
    );
    flag.position.set(x, 4.9 - sag, -5.2);
    group.add(flag);
    flags.push(flag);
  }

  // LIVING MOHALLA NPCs (strictly behind z <= -3.3)
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
    // Balcony neighbour #1 (aunty in teal saree)
    createLowPolyNpc({
      shirtColor: 0xec4899,
      pantColor: 0xbe185d,
      mode: 'balcony',
      x: -2.7,
      y: 3.18,
      z: -5.3,
    }),
    // Balcony neighbour #2 (uncle watching from orange house)
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
    // Strolling mohalla uncle on far sidewalk
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
    fogNear: 18,
    fogFar: 46,
    keyLightColor: 0xfff3d1,
    keyLightIntensity: 2.1,
    hemiSkyColor: 0x93c5fd,
    hemiGroundColor: 0x9a3412,
    hemiIntensity: 0.85,
    rimLightColor: 0xf59e0b,
    rimLightIntensity: 1.0,
    update(elapsed, dt) {
      excitement = Math.max(0, excitement - dt * 1.1);
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
    dispose: () => disposeGroup(group),
  };
}

function buildSchoolCoaching(anisotropy: number): StageInstance {
  const group = new THREE.Group();
  let excitement = 0;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 26),
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

  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(28, 9, 0.5),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: createPlasterWallTexture('#fef3c7', anisotropy),
      roughness: 0.85,
    }),
  );
  backWall.position.set(0, 4.5, -5.8);
  backWall.receiveShadow = true;
  group.add(backWall);

  const dado = new THREE.Mesh(
    new THREE.BoxGeometry(28, 1.8, 0.56),
    new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.75 }),
  );
  dado.position.set(0, 0.9, -5.78);
  group.add(dado);

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

  const poster1 = new THREE.Mesh(
    new THREE.PlaneGeometry(1.85, 2.5),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: createExamPosterTexture('EXAM SCHEDULE', '#DC2626', anisotropy),
      roughness: 0.6,
    }),
  );
  poster1.position.set(-6.1, 3.6, -5.5);
  group.add(poster1);

  const poster2 = new THREE.Mesh(
    new THREE.PlaneGeometry(1.85, 2.5),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: createExamPosterTexture('TOPPER RULES', '#2563EB', anisotropy),
      roughness: 0.6,
    }),
  );
  poster2.position.set(6.1, 3.6, -5.5);
  group.add(poster2);

  // Wooden Desks + Seated Students reacting to heavy hits!
  const deskWoodMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.68 });
  const deskLegMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.7 });
  const deskPositions = [-5.2, -2.5, 2.5, 5.2];
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

    // Seated coaching student behind each desk facing forward toward fight
    const student = createLowPolyNpc({
      shirtColor: uniformColors[idx % uniformColors.length],
      pantColor: 0x1e3a8a,
      mode: 'seated',
      x: dx,
      y: 0.25,
      z: -4.45,
      phase: idx * 1.4,
      isSecondary: idx === 0 || idx === 3,
    });
    group.add(student.group);
    npcs.push(student);
  });

  // Rotating Ceiling Fan overhead
  const fanGroup = new THREE.Group();
  const fanMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.3, metalness: 0.5 });
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 8), fanMat);
  rod.position.y = 0.7;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.18, 14), fanMat);
  fanGroup.add(rod, hub);

  const fanBlades = new THREE.Group();
  const bladeGeo = new THREE.BoxGeometry(1.85, 0.04, 0.28);
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(bladeGeo, fanMat);
    const angle = (i * Math.PI * 2) / 3;
    b.position.set(Math.cos(angle) * 0.95, 0, Math.sin(angle) * 0.95);
    b.rotation.y = -angle;
    fanBlades.add(b);
  }
  fanGroup.add(fanBlades);
  fanGroup.position.set(0, 6.2, -2.5);
  group.add(fanGroup);

  const tubeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xe0f2fe,
    emissiveIntensity: 1.2,
  });
  [-4.5, 4.5].forEach((tx) => {
    const tube = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.14), tubeMat);
    tube.position.set(tx, 5.9, -5.35);
    group.add(tube);
  });

  return {
    id: 'school',
    group,
    backgroundColor: 0xe7e5e4,
    fogColor: 0xe7e5e4,
    fogNear: 16,
    fogFar: 38,
    keyLightColor: 0xfffbeb,
    keyLightIntensity: 1.9,
    hemiSkyColor: 0xe0f2fe,
    hemiGroundColor: 0x78716c,
    hemiIntensity: 0.95,
    rimLightColor: 0x38bdf8,
    rimLightIntensity: 0.7,
    update(elapsed, dt) {
      excitement = Math.max(0, excitement - dt * 1.15);
      fanBlades.rotation.y = elapsed * (8.5 + excitement * 4);
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
    new THREE.PlaneGeometry(40, 28),
    new THREE.MeshStandardMaterial({ color: 0x0b1120, roughness: 0.2, metalness: 0.45 }),
  );
  baseFloor.rotation.x = -Math.PI / 2;
  baseFloor.receiveShadow = true;
  group.add(baseFloor);

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

  // Dynamic Animated BREAKING BAKWAS Studio LED Screens with live pulsing equalizers!
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
    [-7.4, -4.6, 0.38],
    [0, -6.1, 0],
    [7.4, -4.6, -0.38],
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
  [-4.0, 4.0].forEach((px, idx) => {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 6.2, 12),
      idx === 0 ? redNeonMat : blueNeonMat,
    );
    pillar.position.set(px, 3.1, -5.6);
    group.add(pillar);
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

    // Camera operator standing behind rig
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

  const redSpot = new THREE.PointLight(0xef4444, 18, 22, 1.6);
  redSpot.position.set(-5.5, 5.5, -1.5);
  const blueSpot = new THREE.PointLight(0x38bdf8, 18, 22, 1.6);
  blueSpot.position.set(5.5, 5.5, -1.5);
  group.add(redSpot, blueSpot);

  return {
    id: 'studio',
    group,
    backgroundColor: 0x090d1a,
    fogColor: 0x090d1a,
    fogNear: 16,
    fogFar: 42,
    keyLightColor: 0xf8fafc,
    keyLightIntensity: 1.75,
    hemiSkyColor: 0x38bdf8,
    hemiGroundColor: 0x7f1d1d,
    hemiIntensity: 0.75,
    rimLightColor: 0xf43f5e,
    rimLightIntensity: 1.25,
    update(elapsed, dt) {
      excitement = Math.max(0, excitement - dt * 1.15);
      redSpot.position.x = -5.5 + Math.sin(elapsed * 1.4) * 2.5;
      blueSpot.position.x = 5.5 + Math.cos(elapsed * 1.4) * 2.5;
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
    dispose: () => disposeGroup(group),
  };
}

function buildShaadiPandal(anisotropy: number): StageInstance {
  const group = new THREE.Group();
  let excitement = 0;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(75, 45),
    new THREE.MeshStandardMaterial({ color: 0x2b1117, roughness: 0.88 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const carpet = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 8.5),
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

  for (let i = 0; i < 9; i++) {
    const x = -10 + i * 2.5;
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

  [-3.2, 3.2].forEach((px) => {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 3.8, 12), goldClothMat);
    col.position.set(px, 1.9, -5.5);
    group.add(col);
  });

  // Shahi Paneer Buffet Counter in background center!
  const buffet = new THREE.Group();
  const tableCloth = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 1.05, 1.1),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6 }),
  );
  tableCloth.position.y = 0.525;
  buffet.add(tableCloth);

  const dishMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.88 });
  [-1.3, 0, 1.3].forEach((dx) => {
    const dish = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.3, 0.58), dishMat);
    dish.position.set(dx, 1.2, 0);
    buffet.add(dish);
  });

  const buffetSign = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 0.78, 0.08),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: createBuffetBannerTexture(anisotropy),
      roughness: 0.45,
    }),
  );
  buffetSign.position.set(0, 2.35, -0.45);
  buffet.add(buffetSign);
  buffet.position.set(0, 0, -4.65);
  group.add(buffet);

  for (let i = 0; i < 7; i++) {
    const x = -9 + i * 3;
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

  // Blinking Colorful Fairy / DJ Lights
  const fairyBulbs: THREE.MeshStandardMaterial[] = [];
  const bulbColors = [0xfef08a, 0xec4899, 0x38bdf8, 0x4ade80, 0xf97316];
  const bulbGeo = new THREE.SphereGeometry(0.14, 8, 8);
  for (let i = 0; i < 14; i++) {
    const col = bulbColors[i % bulbColors.length];
    const mat = new THREE.MeshStandardMaterial({
      color: col,
      emissive: col,
      emissiveIntensity: 1.5,
    });
    fairyBulbs.push(mat);
    const bulb = new THREE.Mesh(bulbGeo, mat);
    bulb.position.set(-7.8 + i * 1.2, 5.5 + Math.sin(i * 0.9) * 0.35, -4.6);
    group.add(bulb);
  }

  // Shaadi Guests strolling near buffet & cheering!
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
    createLowPolyNpc({
      shirtColor: 0x38bdf8,
      pantColor: 0x1e293b,
      mode: 'stroll',
      x: -1.2,
      z: -3.9,
      walkMinX: -2.6,
      walkMaxX: 2.6,
      speed: 0.8,
      isSecondary: true,
    }),
  ];
  npcs.forEach((n) => group.add(n.group));

  const djLight = new THREE.PointLight(0xec4899, 14, 24, 1.5);
  djLight.position.set(0, 5.2, -1.5);
  group.add(djLight);

  return {
    id: 'shaadi',
    group,
    backgroundColor: 0x260915,
    fogColor: 0x260915,
    fogNear: 18,
    fogFar: 46,
    keyLightColor: 0xffe8b6,
    keyLightIntensity: 2.0,
    hemiSkyColor: 0xf472b6,
    hemiGroundColor: 0x7f1d1d,
    hemiIntensity: 0.85,
    rimLightColor: 0xfacc15,
    rimLightIntensity: 1.15,
    update(elapsed, dt) {
      excitement = Math.max(0, excitement - dt * 1.1);
      fairyBulbs.forEach((mat, i) => {
        const pulse = Math.sin(elapsed * (6.5 + excitement * 4) + i * 0.9);
        mat.emissiveIntensity = pulse > 0 ? 1.8 : 0.25;
      });
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
    dispose: () => disposeGroup(group),
  };
}

function buildRailwayStation(anisotropy: number): StageInstance {
  const group = new THREE.Group();
  let excitement = 0;

  const ballast = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 50),
    new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.95 }),
  );
  ballast.rotation.x = -Math.PI / 2;
  ballast.position.y = -0.65;
  group.add(ballast);

  const platTopTex = createRailwayPlatformTexture(anisotropy);
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(34, 0.65, 8.5),
    new THREE.MeshStandardMaterial({ color: 0xffffff, map: platTopTex, roughness: 0.8 }),
  );
  platform.position.set(0, -0.325, 0.4);
  platform.receiveShadow = true;
  group.add(platform);

  const railMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.85 });
  [-4.9, -6.2].forEach((rz) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(70, 0.12, 0.14), railMat);
    rail.position.set(0, -0.58, rz);
    group.add(rail);
  });

  const steelMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.45, metalness: 0.55 });
  [-7.5, 0, 7.5].forEach((px) => {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6.2, 10), steelMat);
    col.position.set(px, 3.1, -3.4);
    group.add(col);
  });
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(24, 0.22, 5.5),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 }),
  );
  roof.position.set(0, 6.2, -2.5);
  roof.rotation.x = 0.08;
  group.add(roof);

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(6.8, 1.65, 0.16),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: createStationBoardTexture(anisotropy),
      roughness: 0.4,
    }),
  );
  board.position.set(-2.5, 4.45, -3.2);
  group.add(board);

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

  // Platform Passengers + Chai-Samosa Vendor (behind z <= -2.6)
  const npcs: AmbientNpc[] = [
    createLowPolyNpc({
      shirtColor: 0xfef08a,
      pantColor: 0x1e293b,
      mode: 'vendor',
      x: 5.4,
      z: -2.15, // standing right beside stall counter (still well behind z=0 arena!)
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
    }),
    createLowPolyNpc({
      shirtColor: 0x10b981,
      pantColor: 0x1e293b,
      mode: 'stroll',
      x: -1.6,
      z: -3.0,
      walkMinX: -6.2,
      walkMaxX: 2.8,
      speed: 0.9,
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
  trainGroup.position.set(-34, -0.55, -5.55);
  group.add(trainGroup);

  return {
    id: 'railway',
    group,
    backgroundColor: 0x93c5fd,
    fogColor: 0x93c5fd,
    fogNear: 20,
    fogFar: 52,
    keyLightColor: 0xfff7e6,
    keyLightIntensity: 2.0,
    hemiSkyColor: 0xbae6fd,
    hemiGroundColor: 0x57534e,
    hemiIntensity: 0.9,
    rimLightColor: 0xfacc15,
    rimLightIntensity: 0.85,
    update(elapsed, dt) {
      excitement = Math.max(0, excitement - dt * 1.1);
      const cycle = (elapsed * 9.5) % 92;
      trainGroup.position.x = -38 + cycle;
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
  }
}
