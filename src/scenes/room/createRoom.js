import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export function createRoom(scene) {
  const materials = {};
  function mat(color, roughness = 0.85) {
    const key = color + '-' + roughness;
    return (materials[key] ??= new THREE.MeshStandardMaterial({ color, roughness }));
  }
  const room = new THREE.Group();
  scene.add(room);
  const interactables = [];
  const obstacles = [];
  function box(w, h, d, color, x = 0, y = 0, z = 0, parent = room, r = 0.06) {
    const m = new THREE.Mesh(
      new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 3, h / 3, d / 3)),
      typeof color === 'object' ? color : mat(color),
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function sphere(w, h, d, color, x, y, z, parent = room) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), mat(color));
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function cyl(rt, rb, h, color, x, y, z, parent = room) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 40), mat(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function torus(radius, tube, color, x, y, z, parent = room) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 12, 64), mat(color));
    m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  }
  function group(x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    room.add(g);
    return g;
  }
  function tag(g, action) {
    g.traverse((m) => {
      if (m.isMesh) {
        m.userData.action = action;
        interactables.push(m);
      }
    });
  }
  function obstacle(x, z, w, d) {
    obstacles.push({ x, z, w: w / 2 + 0.3, d: d / 2 + 0.3 });
  }
  function woodTexture() {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 1024;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#aa7956';
    ctx.fillRect(0, 0, 1024, 1024);
    let seed = 4;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let row = 0; row < 12; row++) {
      let y = row * 85;
      ctx.fillStyle = row % 2 ? '#b58864' : '#a47552';
      ctx.fillRect(0, y, 1024, 84);
      ctx.strokeStyle = '#b99a6b55';
      ctx.strokeRect(0, y, 1024, 85);
      for (let j = 0; j < 30; j++) {
        ctx.strokeStyle = `rgba(140,103,57,${rand() * 0.08})`;
        ctx.beginPath();
        const yy = y + rand() * 85;
        ctx.moveTo(0, yy);
        ctx.bezierCurveTo(330, yy + rand() * 10, 700, yy - 4, 1024, yy + 4);
        ctx.stroke();
      }
      for (let x = (row % 3) * 140; x < 1024; x += 440) {
        ctx.fillStyle = '#af8c6150';
        ctx.fillRect(x, y, 2, 85);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.84 });
  box(8.4, 0.32, 7, 0xbcaa89, 0, -0.21, 0, room, 0.12);
  box(8.15, 0.08, 6.8, woodMat, 0, -0.015, 0, room, 0.02);
  // Walls fade from the outside, keeping the room readable throughout a full orbit.
  const back = group(0, 0, 0),
    left = group(0, 0, 0);
  box(8.3, 3.55, 0.14, 0xb9cad0, 0, 1.75, -3.4, back, 0.025);
  box(0.14, 3.55, 6.85, 0x7294a4, -4.1, 1.75, 0, left, 0.025);
  box(8.15, 0.16, 0.09, 0xdacaba, 0, 0.11, -3.29, back, 0.02);
  box(0.1, 0.16, 6.7, 0xdacaba, -4, 0.11, 0, left, 0.02);
  // Large recessed window and linen curtains.
  box(0.08, 2.2, 2.45, 0xf5efdf, -3.99, 2, -0.9, left, 0.02);
  box(0.09, 1.96, 2.18, 0x779fb0, -3.93, 2, -0.9, left, 0.01);
  box(0.11, 1.9, 0.07, 0xfff6e4, -3.86, 2, -0.9, left, 0.01);
  box(0.11, 0.075, 2.18, 0xfff6e4, -3.86, 2, -0.9, left, 0.01);
  box(0.38, 0.1, 2.6, 0xf6ebd7, -3.9, 0.93, -0.9, left, 0.015);
  for (let side of [-1, 1])
    for (let i = 0; i < 5; i++) {
      let z = -0.9 + side * 1.18 + (i - 2) * 0.07;
      const c = cyl(0.075, 0.1, 2.35, 0xece6d4, -3.75, 1.93, z, left);
      c.scale.x = 0.75;
    }
  box(0.16, 0.1, 2.9, 0xb5a080, -3.8, 3.12, -0.9, left);
  // Framed botanical artwork.
  box(0.92, 1.18, 0.09, 0xb29b73, -0.8, 2.3, -3.28, back);
  box(0.78, 1.04, 0.03, 0xf7f3e4, -0.8, 2.3, -3.22, back, 0.01);
  for (let i = 0; i < 6; i++) {
    const leaf = sphere(
      0.12,
      0.055,
      0.014,
      0x8d9e75,
      -0.8 + (i % 2 ? 1 : -1) * 0.12,
      2.04 + i * 0.09,
      -3.19,
      back,
    );
    leaf.rotation.z = i % 2 ? 0.6 : -0.6;
  }
  box(0.015, 0.63, 0.02, 0x8d9e75, -0.8, 2.28, -3.18, back, 0.005);
  // Sofa with separate upholstered cushions, piping, feet and decorative pillows.
  const sofa = group(-1.55, 0, -2.12);
  for (const x of [-1.2, 1.2])
    for (const z of [-0.48, 0.48]) cyl(0.055, 0.045, 0.28, 0x947652, x, 0.15, z, sofa);
  box(3, 0.39, 1.35, 0xa96d50, 0, 0.39, 0, sofa, 0.16);
  box(2.9, 0.85, 0.29, 0xdcb79e, 0, 0.96, -0.52, sofa, 0.13);
  box(0.28, 0.72, 1.36, 0xe2c0a6, -1.39, 0.69, 0, sofa, 0.12);
  box(0.28, 0.72, 1.36, 0xe2c0a6, 1.39, 0.69, 0, sofa, 0.12);
  for (let x of [-0.64, 0.64]) {
    box(1.23, 0.22, 1.05, 0xf3d6b9, x, 0.68, 0.03, sofa, 0.1);
    box(1.23, 0.58, 0.18, 0xeaceb4, x, 1.03, -0.32, sofa, 0.1);
  }
  const pillow = box(0.59, 0.55, 0.23, 0x527c93, -0.81, 1.02, -0.12, sofa, 0.13);
  pillow.rotation.z = 0.15;
  const pillow2 = box(0.55, 0.51, 0.24, 0xc07652, 0.81, 1.0, -0.1, sofa, 0.14);
  pillow2.rotation.z = -0.19;
  obstacle(-1.55, -2.12, 3.05, 1.4);
  // Soft rounded rug and woven trim.
  box(3.7, 0.028, 2.55, 0xc27d59, -0.15, 0.045, 0.25, room, 0.012);
  for (let i = 0; i < 42; i++)
    box(0.012, 0.008, 2.41, 0xd29c77, -1.92 + i * 0.087, 0.062, 0.25, room, 0.003);
  // Coffee table, ceramic cup, books.
  const table = group(-1.05, 0, -0.13);
  for (let x of [-0.57, 0.57])
    for (let z of [-0.3, 0.3]) {
      const leg = cyl(0.045, 0.055, 0.54, 0xa98355, x, 0.3, z, table);
      leg.rotation.z = x * 0.16;
    }
  box(1.48, 0.13, 0.95, 0xa36e48, 0, 0.61, 0, table, 0.06);
  box(0.38, 0.05, 0.28, 0x9ba58c, 0.25, 0.7, 0.06, table, 0.01);
  box(0.33, 0.04, 0.27, 0xf0e8d0, 0.22, 0.745, 0.06, table, 0.01);
  cyl(0.095, 0.075, 0.13, 0xf1e7cd, -0.32, 0.75, -0.08, table);
  cyl(0.076, 0.076, 0.006, 0x78614a, -0.32, 0.819, -0.08, table);
  obstacle(-1.05, -0.13, 1.5, 0.97);
  // Side cabinet and plant.
  const cabinet = group(2.87, 0, -2.6);
  box(1.51, 0.86, 0.65, 0x93694e, 0, 0.57, 0, cabinet);
  box(1.62, 0.09, 0.73, 0xb88861, 0, 1.04, 0, cabinet);
  for (let x of [-0.37, 0.37]) {
    box(0.7, 0.66, 0.04, 0xae7a57, x, 0.58, 0.34, cabinet);
    sphere(0.035, 0.035, 0.025, 0x876d48, x, 0.7, 0.38, cabinet);
  }
  for (let x of [-0.57, 0.57])
    for (let z of [-0.2, 0.2]) cyl(0.045, 0.035, 0.23, 0x967b53, x, 0.13, z, cabinet);
  obstacle(2.87, -2.6, 1.65, 0.75);
  function plant(x, y, z, size = 1, parent = room) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.scale.setScalar(size);
    parent.add(g);
    cyl(0.22, 0.16, 0.36, 0xf1e8d7, 0, 0.18, 0, g);
    cyl(0.19, 0.19, 0.015, 0x665c43, 0, 0.37, 0, g);
    for (let i = 0; i < 9; i++) {
      let a = i * 2.4;
      const stem = cyl(
        0.012,
        0.014,
        0.62,
        0x718257,
        Math.sin(a) * 0.08,
        0.6,
        Math.cos(a) * 0.08,
        g,
      );
      stem.rotation.z = Math.sin(a) * 0.3;
      const l = sphere(
        0.12,
        0.32,
        0.075,
        i % 2 ? 0x8a9f6a : 0x6e8858,
        Math.sin(a) * 0.2,
        0.77 + (i % 3) * 0.1,
        Math.cos(a) * 0.2,
        g,
      );
      l.rotation.z = -Math.sin(a) * 0.6;
    }
    return g;
  }
  plant(2.5, 1.09, -2.6, 0.57);
  box(0.3, 0.37, 0.1, 0xd8d2b8, 3.2, 1.28, -2.65, room);
  box(0.24, 0.31, 0.04, 0xf8efe0, 3.2, 1.28, -2.57, room);
  plant(-3.3, 0, 2.55, 1.5);
  obstacle(-3.3, 2.55, 0.8, 0.8);
  // Floating shelf, books and tiny ceramic house.
  box(2.04, 0.1, 0.42, 0xab7958, 2.55, 2.52, -3.15, back);
  for (let i = 0; i < 5; i++) {
    let b = box(
      0.12,
      0.35 + (i % 2) * 0.08,
      0.23,
      [0xa7af8d, 0xe1cba5, 0xc9b49d, 0x9faea6, 0xe5d8ba][i],
      1.85 + i * 0.14,
      2.75,
      -3.13,
      back,
      0.015,
    );
    b.rotation.z = i === 4 ? -0.15 : 0;
  }
  plant(2.95, 2.57, -3.15, 0.43, back);
  // Floor lamp glows at night.
  cyl(0.28, 0.28, 0.06, 0x9a8c69, 0.62, 0.06, -2.85);
  cyl(0.024, 0.024, 1.97, 0x9a8c69, 0.62, 1.04, -2.85);
  cyl(0.28, 0.42, 0.47, 0xf6e8bf, 0.62, 2.1, -2.85);
  const lamp = new THREE.PointLight(0xffd18e, 0, 7, 2);
  lamp.position.set(0.62, 1.95, -2.85);
  scene.add(lamp);
  obstacle(0.62, -2.85, 0.5, 0.5);
  // Pet bed, feeding tray, bath and ball are direct raycast targets.
  const bed = group(2.9, 0, -0.83);
  cyl(0.66, 0.61, 0.17, 0x647f8e, 0, 0.12, 0, bed);
  torus(0.56, 0.13, 0x8daab2, 0, 0.23, 0, bed);
  sphere(0.48, 0.085, 0.48, 0xd7d8c9, 0, 0.19, 0, bed);
  tag(bed, 'sleep');
  const feeding = group(-2.64, 0, 1.64);
  box(1.1, 0.07, 0.63, 0xc2b08b, 0, 0.08, 0, feeding);
  for (let x of [-0.28, 0.28]) {
    cyl(0.22, 0.17, 0.14, x < 0 ? 0xf0e4ce : 0xa9b9b1, x, 0.17, 0, feeding);
    cyl(0.173, 0.173, 0.018, x < 0 ? 0x976c43 : 0x83b7bc, x, 0.247, 0, feeding);
    torus(0.194, 0.03, x < 0 ? 0xf7ecda : 0xbaccc3, x, 0.25, 0, feeding);
    if (x < 0)
      for (let i = 0; i < 12; i++)
        sphere(
          0.035,
          0.026,
          0.032,
          0x885b37,
          x + Math.sin(i * 2.4) * 0.11,
          0.27,
          Math.cos(i * 2.4) * 0.11,
          feeding,
        );
  }
  tag(feeding, 'feed');
  obstacle(-2.64, 1.64, 1.1, 0.63);
  const bath = group(3.05, 0, 1.42);
  box(1.1, 0.25, 0.8, 0x6995a5, 0, 0.16, 0, bath, 0.1);
  box(0.92, 0.025, 0.62, 0x9ebac1, 0, 0.295, 0, bath, 0.01);
  for (let x of [-0.52, 0.52]) box(0.08, 0.1, 0.78, 0xc0d7d7, x, 0.3, 0, bath);
  for (let z of [-0.37, 0.37]) box(1.08, 0.1, 0.08, 0xc0d7d7, 0, 0.3, z, bath);
  tag(bath, 'wash');
  obstacle(3.05, 1.42, 1.1, 0.8);
  const ball = group(1.35, 0.19, 1.65);
  sphere(0.19, 0.19, 0.19, 0xd77542, 0, 0, 0, ball);
  const ring = torus(0.187, 0.016, 0xf8d7a3, 0, 0, 0, ball);
  ring.rotation.x = 0.8;
  tag(ball, 'play');
  // A little scratching post and scattered toy.
  cyl(0.32, 0.32, 0.07, 0xc4a375, 3.12, 0.055, 2.6);
  cyl(0.08, 0.08, 0.91, 0xb99b70, 3.12, 0.52, 2.6);
  for (let i = 0; i < 24; i++) torus(0.083, 0.01, 0xd4bc8d, 3.12, 0.13 + i * 0.032, 2.6);
  cyl(0.29, 0.29, 0.09, 0xd7c1a0, 3.12, 1.03, 2.6);
  obstacle(3.12, 2.6, 0.55, 0.55);

  return { room, interactables, obstacles, back, left, feeding, ball, lamp };
}
