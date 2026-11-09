import * as THREE from "three";
import type { Zone } from "../data/questions";

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function terrainHeight(x: number, z: number) {
  const far = clamp((Math.hypot(x, z + 25) - 35) / 90, 0, 1);
  return (
    Math.sin(x * 0.09) * 0.22 +
    Math.cos(z * 0.075) * 0.2 +
    Math.sin((x + z) * 0.13) * 0.1 +
    far * (Math.sin(x * 0.028 + z * 0.018) * 2.4 + Math.cos(z * 0.025) * 1.7)
  );
}

export function createCamoTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const rand = seeded(71);
  ctx.fillStyle = "#575c3b";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = Math.floor(90 + rand() * 70);
    ctx.fillStyle = `rgba(${v},${v + 5},${Math.floor(v * 0.75)},${0.06 + rand() * 0.1})`;
    ctx.fillRect(rand() * 512, rand() * 512, 2 + rand() * 4, 2 + rand() * 4);
  }
  const colors = ["#343d2a", "#77734a", "#414934", "#8a855e"];
  for (let i = 0; i < 55; i++) {
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    ctx.globalAlpha = 0.46 + rand() * 0.35;
    ctx.beginPath();
    const cx = rand() * 512;
    const cy = rand() * 512;
    const r = 18 + rand() * 48;
    for (let p = 0; p <= 10; p++) {
      const a = (p / 10) * Math.PI * 2;
      const rr = r * (0.65 + rand() * 0.6);
      const px = cx + Math.cos(a) * rr;
      const py = cy + Math.sin(a) * rr * 0.65;
      if (p === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createGroundTexture(tint: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const rand = seeded(tint);
  const base = new THREE.Color(tint);
  const r = Math.floor(base.r * 255);
  const g = Math.floor(base.g * 255);
  const b = Math.floor(base.b * 255);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 14000; i++) {
    const d = Math.floor((rand() - 0.5) * 75);
    ctx.fillStyle = `rgba(${clamp(r + d, 0, 255)},${clamp(g + d, 0, 255)},${clamp(b + d * 0.7, 0, 255)},${0.1 + rand() * 0.22})`;
    const size = 1 + rand() * 7;
    ctx.fillRect(rand() * 512, rand() * 512, size, size * (0.4 + rand()));
  }
  for (let i = 0; i < 120; i++) {
    ctx.strokeStyle = `rgba(45,38,25,${0.05 + rand() * 0.12})`;
    ctx.lineWidth = 0.5 + rand() * 2;
    ctx.beginPath();
    const x = rand() * 512;
    const y = rand() * 512;
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + rand() * 50 - 25, y + rand() * 30, x + rand() * 90 - 45, y + rand() * 70);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(28, 28);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function createTreadTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#20231e";
  ctx.fillRect(0, 0, 128, 256);
  for (let y = 0; y < 256; y += 24) {
    ctx.fillStyle = "#3d4136";
    ctx.fillRect(8, y + 3, 112, 16);
    ctx.fillStyle = "#11130f";
    ctx.fillRect(8, y + 19, 112, 4);
    ctx.fillStyle = "rgba(180,170,130,0.25)";
    ctx.fillRect(14, y + 5, 100, 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export type TankRig = {
  root: THREE.Group;
  hull: THREE.Group;
  turret: THREE.Group;
  barrelPivot: THREE.Group;
  recoil: THREE.Group;
  muzzle: THREE.Object3D;
  wheelGroups: THREE.Group[];
  treadTexture: THREE.CanvasTexture;
  shadow: THREE.Mesh;
};

export function createTank(): TankRig {
  const root = new THREE.Group();
  const hull = new THREE.Group();
  root.add(hull);

  const camo = createCamoTexture();
  const armor = new THREE.MeshStandardMaterial({
    map: camo,
    bumpMap: camo,
    bumpScale: 0.025,
    color: 0xcdd0bc,
    roughness: 0.72,
    metalness: 0.32,
  });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x252a24, roughness: 0.65, metalness: 0.65 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x171a17, roughness: 0.95, metalness: 0.05 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x4d5448, roughness: 0.45, metalness: 0.78 });
  const light = new THREE.MeshStandardMaterial({ color: 0xe5d8a0, emissive: 0x8f7a36, emissiveIntensity: 0.45 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(3.9, 1.15, 6.7), armor);
  body.position.y = 1.35;
  body.castShadow = true;
  body.receiveShadow = true;
  hull.add(body);

  const glacis = new THREE.Mesh(new THREE.BoxGeometry(3.85, 0.2, 2.35), armor);
  glacis.rotation.x = -0.36;
  glacis.position.set(0, 1.92, -3.0);
  glacis.castShadow = true;
  hull.add(glacis);

  const rear = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.9, 0.5), armor);
  rear.position.set(0, 1.3, 3.45);
  rear.castShadow = true;
  hull.add(rear);

  for (const side of [-1, 1]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.82, 6.8), armor);
    skirt.position.set(side * 2.03, 1.18, 0);
    skirt.castShadow = true;
    hull.add(skirt);
    for (let i = 0; i < 6; i++) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.68, 0.9), darkMetal);
      plate.position.set(side * 2.14, 1.18, -2.9 + i * 1.16);
      hull.add(plate);
    }
  }

  const treadTexture = createTreadTexture();
  const treadMat = new THREE.MeshStandardMaterial({ map: treadTexture, color: 0x999c8e, roughness: 0.9, metalness: 0.2 });
  const wheelGroups: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const track = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.22, 7.45), treadMat);
    track.position.set(side * 2.12, 0.72, 0);
    track.castShadow = true;
    track.receiveShadow = true;
    hull.add(track);

    const top = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.13, 7.2), rubber);
    top.position.set(side * 2.12, 1.35, 0);
    hull.add(top);
    const bottom = top.clone();
    bottom.position.y = 0.11;
    hull.add(bottom);

    for (let i = 0; i < 7; i++) {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(side * 2.52, 0.7, -3 + i);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.32, 18), rubber);
      wheel.rotation.z = Math.PI / 2;
      wheel.castShadow = true;
      wheelGroup.add(wheel);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.36, 12), steel);
      hub.rotation.z = Math.PI / 2;
      wheelGroup.add(hub);
      for (let s = 0; s < 6; s++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.06), steel);
        spoke.rotation.x = (s / 6) * Math.PI;
        wheelGroup.add(spoke);
      }
      hull.add(wheelGroup);
      wheelGroups.push(wheelGroup);
    }
  }

  // Detailed angular turret and equipment.
  const turret = new THREE.Group();
  turret.position.set(0, 2.05, -0.15);
  hull.add(turret);
  const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 2.2, 0.95, 8), armor);
  turretBase.scale.z = 1.28;
  turretBase.rotation.y = Math.PI / 8;
  turretBase.position.y = 0.42;
  turretBase.castShadow = true;
  turret.add(turretBase);
  const turretTop = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.28, 2.8), armor);
  turretTop.position.set(0, 0.95, -0.25);
  turretTop.castShadow = true;
  turret.add(turretTop);
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.75, 1.7), armor);
    cheek.position.set(side * 1.34, 0.45, -0.85);
    cheek.rotation.y = side * 0.18;
    cheek.castShadow = true;
    turret.add(cheek);
    const stowage = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 1.4), darkMetal);
    stowage.position.set(side * 1.9, 0.4, 0.9);
    turret.add(stowage);
    for (let i = 0; i < 3; i++) {
      const launcher = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.36, 8), darkMetal);
      launcher.rotation.x = Math.PI / 2.6;
      launcher.position.set(side * (1.65 + i * 0.1), 0.72, -1.05 + i * 0.22);
      turret.add(launcher);
    }
  }
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.16, 16), steel);
  hatch.position.set(0.62, 1.15, 0.35);
  turret.add(hatch);
  const commanderGun = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.25, 8), darkMetal);
  commanderGun.rotation.x = Math.PI / 2;
  commanderGun.position.set(0.62, 1.4, -0.4);
  turret.add(commanderGun);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 2.5, 5), darkMetal);
  antenna.position.set(-1.5, 1.9, 1.1);
  antenna.rotation.z = -0.08;
  turret.add(antenna);

  const barrelPivot = new THREE.Group();
  barrelPivot.position.set(0, 0.35, -1.15);
  turret.add(barrelPivot);
  const recoil = new THREE.Group();
  barrelPivot.add(recoil);
  const mantlet = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.85, 0.7), armor);
  mantlet.position.set(0, 0, -0.25);
  mantlet.castShadow = true;
  recoil.add(mantlet);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 5.8, 16), steel);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -3.15;
  barrel.castShadow = true;
  recoil.add(barrel);
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 2.1, 16), darkMetal);
  sleeve.rotation.x = Math.PI / 2;
  sleeve.position.z = -2.4;
  recoil.add(sleeve);
  const brake = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.65, 16), darkMetal);
  brake.rotation.x = Math.PI / 2;
  brake.position.z = -5.95;
  recoil.add(brake);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, -6.35);
  recoil.add(muzzle);

  for (const side of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 12), light);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(side * 1.4, 1.38, -3.55);
    hull.add(lamp);
  }

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(4.6, 32),
    new THREE.MeshBasicMaterial({ color: 0x10150e, transparent: true, opacity: 0.28, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(1, 1.5, 1);
  shadow.position.y = 0.04;
  root.add(shadow);

  return { root, hull, turret, barrelPivot, recoil, muzzle, wheelGroups, treadTexture, shadow };
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export function createTargetTexture(letter: string, answer: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1536;
  canvas.height = 960;
  const ctx = canvas.getContext("2d")!;
  const rand = seeded(letter.charCodeAt(0) * 31 + answer.length * 17);

  const gradient = ctx.createLinearGradient(0, 0, 0, 960);
  gradient.addColorStop(0, "#4b5542");
  gradient.addColorStop(0.45, "#283127");
  gradient.addColorStop(1, "#141c16");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1536, 960);

  for (let i = 0; i < 11000; i++) {
    const v = Math.floor(rand() * 90);
    ctx.fillStyle = `rgba(${v + 50},${v + 55},${v + 40},${0.02 + rand() * 0.05})`;
    ctx.fillRect(rand() * 1536, rand() * 960, 2 + rand() * 6, 1 + rand() * 4);
  }
  ctx.strokeStyle = "#9aa282";
  ctx.lineWidth = 24;
  ctx.strokeRect(22, 22, 1492, 916);
  ctx.strokeStyle = "rgba(8,12,9,0.9)";
  ctx.lineWidth = 10;
  ctx.strokeRect(50, 50, 1436, 860);
  ctx.strokeStyle = "rgba(225,220,180,0.22)";
  ctx.lineWidth = 4;
  ctx.strokeRect(64, 64, 1408, 832);

  for (const [x, y] of [[88, 88], [1448, 88], [88, 872], [1448, 872], [768, 88], [768, 872]]) {
    const rivet = ctx.createRadialGradient(x - 6, y - 6, 3, x, y, 23);
    rivet.addColorStop(0, "#d4d0ad");
    rivet.addColorStop(0.45, "#7c826c");
    rivet.addColorStop(1, "#1c241d");
    ctx.fillStyle = rivet;
    ctx.beginPath();
    ctx.arc(x, y, 21, 0, Math.PI * 2);
    ctx.fill();
  }

  // Red identification bullseyes on enemy armor panels.
  for (const cx of [180, 1356]) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(cx, 150, 63 - i * 19, 0, Math.PI * 2);
      ctx.strokeStyle = i % 2 === 0 ? "#c43a2c" : "#e7e2ca";
      ctx.lineWidth = 15;
      ctx.stroke();
    }
  }

  ctx.fillStyle = "#f0c336";
  ctx.fillRect(628, 48, 280, 208);
  ctx.strokeStyle = "#fff0ac";
  ctx.lineWidth = 9;
  ctx.strokeRect(628, 48, 280, 208);
  ctx.fillStyle = "#10150f";
  ctx.font = "900 180px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, 768, 154);

  ctx.fillStyle = "#e0c98b";
  ctx.font = "800 34px Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("TANK MUSUH", 340, 125);
  ctx.textAlign = "right";
  ctx.fillText("HOSTILE UNIT", 1196, 125);
  ctx.textAlign = "center";

  // Large high-contrast answer plate for long readable text.
  const panel = ctx.createLinearGradient(0, 280, 0, 826);
  panel.addColorStop(0, "#0d1410");
  panel.addColorStop(0.5, "#111b14");
  panel.addColorStop(1, "#080e0a");
  ctx.fillStyle = panel;
  ctx.fillRect(105, 280, 1326, 546);
  ctx.strokeStyle = "#9da480";
  ctx.lineWidth = 10;
  ctx.strokeRect(105, 280, 1326, 546);
  ctx.strokeStyle = "#e9c64b";
  ctx.lineWidth = 5;
  ctx.strokeRect(126, 301, 1284, 504);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  let fontSize = 132;
  ctx.font = `800 ${fontSize}px Arial, sans-serif`;
  let lines = wrapText(ctx, answer, 1190);
  if (lines.length > 2) {
    fontSize = 116;
    ctx.font = `800 ${fontSize}px Arial, sans-serif`;
    lines = wrapText(ctx, answer, 1210);
  }
  if (lines.length > 3) {
    fontSize = 100;
    ctx.font = `800 ${fontSize}px Arial, sans-serif`;
    lines = wrapText(ctx, answer, 1230);
  }
  if (lines.length > 4) {
    fontSize = 86;
    ctx.font = `800 ${fontSize}px Arial, sans-serif`;
    lines = wrapText(ctx, answer, 1240);
  }
  const lineHeight = fontSize * 1.12;
  const startY = 555 - ((lines.length - 1) * lineHeight) / 2;
  ctx.lineWidth = 17;
  lines.forEach((line, i) => {
    const y = startY + i * lineHeight;
    ctx.strokeStyle = "rgba(0,0,0,0.95)";
    ctx.strokeText(line, 768, y);
    ctx.fillStyle = "#fff9e7";
    ctx.fillText(line, 768, y);
  });

  ctx.fillStyle = "rgba(235,218,160,0.72)";
  ctx.font = "700 31px Arial, sans-serif";
  ctx.fillText("BIDIK TANK MUSUH YANG MEMBAWA JAWABAN BENAR", 768, 875);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export type TargetVisual = {
  group: THREE.Group;
  hitboxes: THREE.Mesh[];
  board: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  frame: THREE.MeshStandardMaterial;
  texture: THREE.CanvasTexture;
  turret: THREE.Group;
  muzzle: THREE.Object3D;
  wheels: THREE.Group[];
  treadTexture: THREE.CanvasTexture;
  armor: THREE.MeshStandardMaterial;
};

export function createTarget(letter: string, answer: string): TargetVisual {
  const group = new THREE.Group();
  const texture = createTargetTexture(letter, answer);

  // Oversized armored answer board carried by a hostile tank.
  const boardMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.68, metalness: 0.26, side: THREE.DoubleSide });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(12.8, 8), boardMat);
  board.position.z = 0.2;
  board.castShadow = true;
  group.add(board);

  const frame = new THREE.MeshStandardMaterial({ color: 0x606854, roughness: 0.48, metalness: 0.72, emissive: 0x000000 });
  const framePieces: [number, number, number, number][] = [
    [13.15, 0.28, 0, 4.13],
    [13.15, 0.28, 0, -4.13],
    [0.28, 8.35, -6.55, 0],
    [0.28, 8.35, 6.55, 0],
  ];
  for (const [w, h, x, y] of framePieces) {
    const piece = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.42), frame);
    piece.position.set(x, y, 0.12);
    piece.castShadow = true;
    group.add(piece);
  }
  for (const x of [-6.2, -3.1, 0, 3.1, 6.2]) {
    for (const y of [-3.9, 3.9]) {
      const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.48, 8), new THREE.MeshStandardMaterial({ color: 0xa8ad91, metalness: 0.75, roughness: 0.45 }));
      rivet.rotation.x = Math.PI / 2;
      rivet.position.set(x, y, 0.36);
      group.add(rivet);
    }
  }

  // Hostile tank chassis, turret, cannon and running gear.
  const armor = new THREE.MeshStandardMaterial({ color: 0x4a4c3e, roughness: 0.68, metalness: 0.48 });
  const armorDark = new THREE.MeshStandardMaterial({ color: 0x282c25, roughness: 0.75, metalness: 0.55 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x63685b, roughness: 0.45, metalness: 0.8 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x171a16, roughness: 0.95, metalness: 0.08 });
  const hostile = new THREE.MeshStandardMaterial({ color: 0x8f3329, roughness: 0.65, metalness: 0.35, emissive: 0x220704 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xff6550, emissive: 0xd12b1b, emissiveIntensity: 1.1 });
  const caution = new THREE.MeshStandardMaterial({ color: 0xd9ac35, roughness: 0.7, metalness: 0.25 });

  const hull = new THREE.Mesh(new THREE.BoxGeometry(7.9, 1.65, 4.9), armor);
  hull.position.set(0, -5.95, -0.65);
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);
  const glacis = new THREE.Mesh(new THREE.BoxGeometry(7.85, 0.24, 1.8), armor);
  glacis.rotation.x = -0.38;
  glacis.position.set(0, -5.12, 1.65);
  glacis.castShadow = true;
  group.add(glacis);
  const rearPlate = new THREE.Mesh(new THREE.BoxGeometry(7.6, 1.3, 0.35), armorDark);
  rearPlate.position.set(0, -5.85, -3.15);
  group.add(rearPlate);

  const treadTexture = createTreadTexture();
  const treadMat = new THREE.MeshStandardMaterial({ map: treadTexture, color: 0x8f8d7d, roughness: 0.9, metalness: 0.2 });
  const wheels: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const track = new THREE.Mesh(new THREE.BoxGeometry(1.08, 1.5, 5.8), treadMat);
    track.position.set(side * 4.12, -6.35, -0.65);
    track.castShadow = true;
    track.receiveShadow = true;
    group.add(track);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.85, 5.7), armorDark);
    skirt.position.set(side * 4.68, -5.48, -0.65);
    group.add(skirt);
    for (let i = 0; i < 6; i++) {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(side * 4.7, -6.35, -3.1 + i * 1.02);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.22, 14), rubber);
      wheel.rotation.z = Math.PI / 2;
      wheel.castShadow = true;
      wheelGroup.add(wheel);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.27, 10), steel);
      hub.rotation.z = Math.PI / 2;
      wheelGroup.add(hub);
      for (let spoke = 0; spoke < 4; spoke++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.07, 0.72), steel);
        bar.rotation.x = (spoke / 4) * Math.PI;
        wheelGroup.add(bar);
      }
      group.add(wheelGroup);
      wheels.push(wheelGroup);
    }
  }

  const turret = new THREE.Group();
  turret.position.set(0, -4.72, -0.7);
  group.add(turret);
  const turretBody = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.25, 3.4), armor);
  turretBody.castShadow = true;
  turret.add(turretBody);
  const turretRoof = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.2, 2.6), armorDark);
  turretRoof.position.y = 0.72;
  turret.add(turretRoof);
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 1.8), armorDark);
    cheek.position.set(side * 2.05, -0.05, 0.5);
    turret.add(cheek);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.13, 1.6), hostile);
    stripe.position.set(side * 2.08, 0.25, 0.5);
    turret.add(stripe);
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.12), lamp);
    light.position.set(side * 2.4, -5.25, 2.63);
    group.add(light);
  }
  const mantlet = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.95, 0.7), armorDark);
  mantlet.position.set(0, -0.04, 1.85);
  turret.add(mantlet);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.23, 3.8, 14), steel);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, -0.04, 3.65);
  barrel.castShadow = true;
  turret.add(barrel);
  const brake = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.55, 14), armorDark);
  brake.rotation.x = Math.PI / 2;
  brake.position.set(0, -0.04, 5.5);
  turret.add(brake);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, -0.04, 5.88);
  turret.add(muzzle);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 2.2, 5), armorDark);
  antenna.position.set(-1.6, 1.75, -1.0);
  antenna.rotation.z = -0.12;
  turret.add(antenna);

  // Heavy mounting pylons make the board visibly part of the vehicle.
  const pylonMat = new THREE.MeshStandardMaterial({ color: 0x4d5544, roughness: 0.55, metalness: 0.72 });
  for (const x of [-4.8, 4.8]) {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.75, 0.55), pylonMat);
    pylon.position.set(x, -4.65, -0.15);
    pylon.castShadow = true;
    group.add(pylon);
    const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 3.2, 7), steel);
    brace.position.set(x * 0.78, -5.45, -1.35);
    brace.rotation.x = 0.55;
    brace.rotation.z = x > 0 ? -0.24 : 0.24;
    group.add(brace);
  }
  for (const x of [-2.6, -1.3, 0, 1.3, 2.6]) {
    const hazard = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.18, 0.12), caution);
    hazard.position.set(x, -5.9, 2.38);
    group.add(hazard);
  }

  const invisible = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
  const boardHitbox = new THREE.Mesh(new THREE.BoxGeometry(12.95, 8.15, 1.15), invisible);
  boardHitbox.position.z = 0.2;
  boardHitbox.userData.letter = letter;
  group.add(boardHitbox);
  const bodyHitbox = new THREE.Mesh(new THREE.BoxGeometry(9.3, 3.4, 6.4), invisible);
  bodyHitbox.position.set(0, -5.8, -0.4);
  bodyHitbox.userData.letter = letter;
  group.add(bodyHitbox);

  return { group, hitboxes: [boardHitbox, bodyHitbox], board, frame, texture, turret, muzzle, wheels, treadTexture, armor };
}

export function createTextSprite(text: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "900 110px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(0,0,0,0.9)";
  ctx.lineWidth = 18;
  ctx.strokeText(text, 512, 128);
  ctx.fillStyle = color;
  ctx.fillText(text, 512, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(16, 4, 1);
  return sprite;
}

export function loadHorizon() {
  const loader = new THREE.TextureLoader();
  const texture = loader.load("/images/horizon.jpg");
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeFrondGeometry() {
  const positions: number[] = [];
  const widths = [0.12, 0.42, 0.66, 0.52, 0.08];
  const heights = [0, 0.35, 0.12, -0.45, -1.2];
  for (let i = 0; i < 4; i++) {
    const z0 = i * 1.05;
    const z1 = (i + 1) * 1.05;
    const x0 = widths[i];
    const x1 = widths[i + 1];
    positions.push(-x0, heights[i], z0, x0, heights[i], z0, -x1, heights[i + 1], z1);
    positions.push(x0, heights[i], z0, x1, heights[i + 1], z1, -x1, heights[i + 1], z1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function buildEnvironment(zone: Zone): { group: THREE.Group; groundTexture: THREE.CanvasTexture } {
  const group = new THREE.Group();
  const rand = seeded(1000 + zone.id * 97);
  const groundTexture = createGroundTexture(zone.ground);
  const groundMat = new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 0.98, metalness: 0.02 });
  const groundGeo = new THREE.PlaneGeometry(340, 340, 80, 80);
  groundGeo.rotateX(-Math.PI / 2);
  const pos = groundGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  group.add(ground);

  // Compacted dirt track running toward the answer targets.
  const roadGeo = new THREE.PlaneGeometry(26, 115, 8, 24);
  roadGeo.rotateX(-Math.PI / 2);
  const rp = roadGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < rp.count; i++) {
    rp.setY(i, terrainHeight(rp.getX(i), rp.getZ(i) - 22) + 0.035);
  }
  roadGeo.computeVertexNormals();
  const road = new THREE.Mesh(
    roadGeo,
    new THREE.MeshStandardMaterial({ color: zone.id === 3 ? 0x746d5e : 0x8b7351, roughness: 1, transparent: true, opacity: 0.8 })
  );
  road.position.z = -22;
  road.receiveShadow = true;
  group.add(road);

  const wood = new THREE.MeshStandardMaterial({ color: 0x594433, roughness: 0.9 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x3b3025, roughness: 0.95 });
  const leafMats = [
    new THREE.MeshStandardMaterial({ color: 0x294d24, roughness: 0.88, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ color: 0x3b652d, roughness: 0.88, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ color: 0x52732f, roughness: 0.88, side: THREE.DoubleSide }),
  ];
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x696b61, roughness: 0.98, flatShading: true });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8f8a79, roughness: 0.96 });
  const rustMat = new THREE.MeshStandardMaterial({ color: 0x77402c, roughness: 0.75, metalness: 0.35 });
  const frondGeo = makeFrondGeometry();
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.32, 6, 7);
  const crownGeo = new THREE.SphereGeometry(1, 8, 6);
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);

  const yAt = (x: number, z: number) => terrainHeight(x, z);

  function palm(x: number, z: number, scale = 1) {
    const palmGroup = new THREE.Group();
    palmGroup.position.set(x, yAt(x, z), z);
    palmGroup.scale.setScalar(scale);
    const trunk = new THREE.Mesh(trunkGeo, wood);
    trunk.position.y = 3;
    trunk.rotation.z = (rand() - 0.5) * 0.16;
    trunk.castShadow = true;
    palmGroup.add(trunk);
    for (let i = 0; i < 9; i++) {
      const leaf = new THREE.Mesh(frondGeo, leafMats[i % leafMats.length]);
      leaf.position.y = 6 + (rand() - 0.5) * 0.2;
      leaf.rotation.y = (i / 9) * Math.PI * 2 + rand() * 0.2;
      leaf.rotation.x = -0.12 + rand() * 0.16;
      leaf.castShadow = true;
      palmGroup.add(leaf);
    }
    const coconut = new THREE.Mesh(crownGeo, darkWood);
    coconut.scale.setScalar(0.36);
    coconut.position.y = 5.9;
    palmGroup.add(coconut);
    group.add(palmGroup);
  }

  function tree(x: number, z: number, scale = 1) {
    const t = new THREE.Group();
    t.position.set(x, yAt(x, z), z);
    t.scale.setScalar(scale);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, 4.6, 7), wood);
    trunk.position.y = 2.3;
    trunk.castShadow = true;
    t.add(trunk);
    for (let i = 0; i < 3; i++) {
      const crown = new THREE.Mesh(crownGeo, leafMats[(i + zone.id) % leafMats.length]);
      crown.position.set((rand() - 0.5) * 2.1, 4.6 + rand() * 1.3, (rand() - 0.5) * 2.1);
      crown.scale.set(1.7 + rand(), 1.1 + rand() * 0.6, 1.7 + rand());
      crown.castShadow = true;
      t.add(crown);
    }
    group.add(t);
  }

  function rock(x: number, z: number, scale = 1) {
    const mesh = new THREE.Mesh(rockGeo, rockMat);
    mesh.position.set(x, yAt(x, z) + scale * 0.45, z);
    mesh.scale.set(scale * (0.8 + rand() * 0.7), scale * (0.5 + rand() * 0.4), scale * (0.8 + rand() * 0.7));
    mesh.rotation.set(rand(), rand() * Math.PI, rand());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  function barrel(x: number, z: number) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.35, 14), rustMat);
    b.position.set(x, yAt(x, z) + 0.68, z);
    b.castShadow = true;
    group.add(b);
    for (const y of [0.25, 1.12]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.045, 5, 16), darkWood);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, yAt(x, z) + y, z);
      group.add(ring);
    }
  }

  function crate(x: number, z: number, size = 1.4) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), wood);
    box.position.set(x, yAt(x, z) + size / 2, z);
    box.rotation.y = rand() * 0.5;
    box.castShadow = true;
    box.receiveShadow = true;
    group.add(box);
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(box.geometry),
      new THREE.LineBasicMaterial({ color: 0x241c14, transparent: true, opacity: 0.55 })
    );
    edge.position.copy(box.position);
    edge.rotation.copy(box.rotation);
    group.add(edge);
  }

  function sandbags(x: number, z: number) {
    const bagMat = new THREE.MeshStandardMaterial({ color: 0x9b8d67, roughness: 1 });
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 5 - row; i++) {
        const bag = new THREE.Mesh(crownGeo, bagMat);
        bag.scale.set(0.65, 0.28, 0.4);
        bag.position.set(x + (i - (4 - row) / 2) * 1.15, yAt(x, z) + 0.22 + row * 0.42, z + (rand() - 0.5) * 0.15);
        bag.rotation.y = rand() * 0.3;
        bag.castShadow = true;
        group.add(bag);
      }
    }
  }

  function watchtower(x: number, z: number) {
    const g = new THREE.Group();
    g.position.set(x, yAt(x, z), z);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 6.4, 0.24), wood);
      post.position.set(sx * 1.6, 3.2, sz * 1.5);
      post.castShadow = true;
      g.add(post);
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.25, 3.8), darkWood);
    deck.position.y = 6;
    g.add(deck);
    for (let i = 0; i < 5; i++) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 0.12), wood);
      rail.position.set(0, 6.7, -1.8 + i * 0.9);
      g.add(rail);
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.3, 1.5, 4), darkWood);
    roof.position.y = 8;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    g.add(roof);
    group.add(g);
  }

  function flag(x: number, z: number) {
    const g = new THREE.Group();
    g.position.set(x, yAt(x, z), z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 8, 8), stoneMat);
    pole.position.y = 4;
    g.add(pole);
    const red = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.85), new THREE.MeshStandardMaterial({ color: 0xc8232c, side: THREE.DoubleSide, roughness: 0.85 }));
    red.position.set(1.3, 7.2, 0);
    g.add(red);
    const white = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.85), new THREE.MeshStandardMaterial({ color: 0xf2f0e8, side: THREE.DoubleSide, roughness: 0.85 }));
    white.position.set(1.3, 6.35, 0);
    g.add(white);
    group.add(g);
  }

  function hut(x: number, z: number) {
    const g = new THREE.Group();
    g.position.set(x, yAt(x, z), z);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4), new THREE.MeshStandardMaterial({ color: 0x8a7556, roughness: 0.95 }));
    wall.position.y = 1.5;
    wall.castShadow = true;
    g.add(wall);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.1, 4), new THREE.MeshStandardMaterial({ color: 0x5d422b, roughness: 0.95 }));
    roof.position.y = 4;
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.9;
    roof.castShadow = true;
    g.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2, 0.08), darkWood);
    door.position.set(0, 1, 2.05);
    g.add(door);
    group.add(g);
  }

  function fortWall(x: number, z: number, width: number) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, 4.2, 2.1), stoneMat);
    wall.position.set(x, yAt(x, z) + 2.1, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
    for (let i = -Math.floor(width / 3); i <= Math.floor(width / 3); i++) {
      const merlon = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 2.2), stoneMat);
      merlon.position.set(x + i * 3, yAt(x, z) + 4.55, z);
      group.add(merlon);
    }
  }

  function tower(x: number, z: number) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.4, 7, 10), stoneMat);
    t.position.set(x, yAt(x, z) + 3.5, z);
    t.castShadow = true;
    group.add(t);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.5, 2, 10), rustMat);
    roof.position.set(x, yAt(x, z) + 8, z);
    group.add(roof);
  }

  function cannon(x: number, z: number) {
    const g = new THREE.Group();
    g.position.set(x, yAt(x, z) + 0.55, z);
    const barrelMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 2.5, 10), darkWood);
    barrelMesh.rotation.x = Math.PI / 2;
    barrelMesh.position.z = -0.8;
    g.add(barrelMesh);
    const carriage = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 1.5), wood);
    carriage.position.y = -0.25;
    g.add(carriage);
    for (const sx of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.16, 12), darkWood);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * 0.7, -0.2, 0);
      g.add(wheel);
    }
    group.add(g);
  }

  function cropRows() {
    const bushGeo = new THREE.SphereGeometry(0.75, 7, 5);
    const bushMat = new THREE.MeshStandardMaterial({ color: zone.id === 2 ? 0x365b2a : 0x5a7a32, roughness: 1 });
    for (const side of [-1, 1]) {
      for (let row = 0; row < 4; row++) {
        for (let i = 0; i < 9; i++) {
          const x = side * (29 + row * 6 + (rand() - 0.5) * 0.7);
          const z = -15 - i * 10 + (rand() - 0.5) * 1.5;
          const bush = new THREE.Mesh(bushGeo, bushMat);
          bush.position.set(x, yAt(x, z) + 0.55, z);
          bush.scale.set(1.1 + rand() * 0.4, 0.85 + rand() * 0.35, 1.1 + rand() * 0.4);
          bush.castShadow = true;
          group.add(bush);
        }
      }
    }
  }

  function riceField(x: number, z: number) {
    const patch = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 12),
      new THREE.MeshStandardMaterial({ color: 0x6e8a48, roughness: 1, transparent: true, opacity: 0.75 })
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(x, yAt(x, z) + 0.08, z);
    group.add(patch);
    for (let i = 0; i < 6; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 11), new THREE.MeshStandardMaterial({ color: 0x534b31, roughness: 1 }));
      line.position.set(x - 8 + i * 3.2, yAt(x, z) + 0.12, z);
      group.add(line);
    }
  }

  // Distant volcanic ridges; visible in every zone with zone-specific tint.
  const hillMat = new THREE.MeshStandardMaterial({ color: zone.id === 3 ? 0x54605b : 0x4f6a5b, roughness: 1, flatShading: true });
  for (let i = 0; i < 11; i++) {
    const x = -150 + i * 31 + (rand() - 0.5) * 12;
    const z = -145 - rand() * 30;
    const hill = new THREE.Mesh(new THREE.ConeGeometry(24 + rand() * 18, 22 + rand() * 26, 7), hillMat);
    hill.position.set(x, 7, z);
    hill.rotation.y = rand() * Math.PI;
    group.add(hill);
  }

  // Common battlefield dressing.
  for (let i = 0; i < 9; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (25 + rand() * 26);
    const z = -12 - rand() * 75;
    if (rand() > 0.45) palm(x, z, 0.8 + rand() * 0.6);
    else tree(x, z, 0.9 + rand() * 0.7);
  }
  for (let i = 0; i < 14; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    rock(side * (18 + rand() * 34), -8 - rand() * 90, 0.5 + rand() * 1.4);
  }
  sandbags(-17, -12);
  sandbags(17, -15);
  barrel(-21, 2);
  barrel(22, -6);
  crate(-24, -3);
  crate(25, 1, 1.1);
  watchtower(31, -37);
  flag(-30, -14);

  if (zone.id === 1) {
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(340, 70),
      new THREE.MeshStandardMaterial({ color: 0x356b80, roughness: 0.28, metalness: 0.25, transparent: true, opacity: 0.85 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -1.3, -130);
    group.add(water);
    for (let i = 0; i < 16; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      palm(side * (28 + rand() * 48), -18 - rand() * 95, 0.75 + rand() * 0.8);
    }
    for (let i = 0; i < 9; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      tree(side * (35 + rand() * 35), -30 - rand() * 75, 1.1 + rand() * 0.8);
    }
  } else if (zone.id === 2) {
    cropRows();
    const warehouse = new THREE.Mesh(new THREE.BoxGeometry(15, 7, 9), stoneMat);
    warehouse.position.set(37, yAt(37, -55) + 3.5, -55);
    warehouse.castShadow = true;
    group.add(warehouse);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(16, 0.6, 10), rustMat);
    roof.position.set(37, yAt(37, -55) + 7.3, -55);
    group.add(roof);
    for (let i = 0; i < 8; i++) crate(-26 - (i % 3) * 2, -20 - i * 3.5, 1.1 + rand() * 0.5);
    for (let i = 0; i < 5; i++) barrel(24 + i * 1.5, -30 - i * 2);
    const dock = new THREE.Mesh(new THREE.BoxGeometry(30, 0.8, 8), wood);
    dock.position.set(-37, yAt(-37, -70) + 0.4, -70);
    group.add(dock);
    for (let i = 0; i < 6; i++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3, 8), darkWood);
      post.position.set(-49 + i * 5, yAt(-37, -70) + 1.2, -73);
      group.add(post);
    }
    const boatHull = new THREE.Mesh(new THREE.BoxGeometry(12, 2.2, 4), darkWood);
    boatHull.position.set(-43, yAt(-43, -82) + 1, -82);
    boatHull.rotation.y = 0.12;
    group.add(boatHull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 8, 8), wood);
    mast.position.set(-43, yAt(-43, -82) + 5, -82);
    group.add(mast);
  } else if (zone.id === 3) {
    fortWall(0, -82, 62);
    fortWall(-37, -52, 32);
    fortWall(37, -52, 32);
    tower(-31, -80);
    tower(31, -80);
    cannon(-17, -28);
    cannon(17, -31);
    for (let i = 0; i < 6; i++) crate(-28 - (i % 2) * 2, -22 - i * 5, 1.3);
    for (let i = 0; i < 7; i++) palm((i % 2 ? -1 : 1) * (34 + rand() * 20), -20 - rand() * 80, 0.8 + rand() * 0.5);
    const gate = new THREE.Mesh(new THREE.BoxGeometry(7, 5, 0.5), darkWood);
    gate.position.set(0, yAt(0, -82) + 2.5, -80.7);
    group.add(gate);
  } else {
    hut(-31, -32);
    hut(32, -45);
    hut(-39, -69);
    hut(38, -73);
    riceField(-34, -18);
    riceField(35, -24);
    riceField(-35, -64);
    riceField(36, -68);
    cropRows();
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      palm(side * (27 + rand() * 25), -20 - rand() * 85, 0.8 + rand() * 0.5);
    }
    for (let i = 0; i < 7; i++) {
      const x = -26 + i * 8.5;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.6, 0.2), wood);
      post.position.set(x, yAt(x, -8) + 0.8, -8);
      group.add(post);
    }
    const fenceRail = new THREE.Mesh(new THREE.BoxGeometry(52, 0.15, 0.15), wood);
    fenceRail.position.set(0, yAt(0, -8) + 1.2, -8);
    group.add(fenceRail);
  }

  return { group, groundTexture };
}
