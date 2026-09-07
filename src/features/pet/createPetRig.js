import * as THREE from 'three';
import { createCoatTexture, taperedTube } from './coat.js';

/** Anatomical low-cost rig: articulated limbs, separate eyelids and continuous tail. */
export function createPetRig(profile) {
  const cat = profile.species === 'cat';
  const group = new THREE.Group();
  group.name = `pet-rig:${profile.species}`;
  const geometries = new Set(),
    materials = new Set(),
    textures = new Set();
  function coat(color, pattern = 'solid') {
    const map = createCoatTexture(color, pattern);
    textures.add(map);
    const m = new THREE.MeshStandardMaterial({ map, roughness: 0.94 });
    materials.add(m);
    return m;
  }
  function surface(color, roughness = 0.7) {
    const m = new THREE.MeshStandardMaterial({ color, roughness });
    materials.add(m);
    return m;
  }
  const fur = coat(profile.fur),
    bodyFur = profile.pattern === 'stripes' ? coat(profile.fur, 'stripes') : fur,
    cream = coat(profile.accent);
  const innerEar = surface('#a77872'),
    noseMat = surface(cat ? '#806261' : '#252827', 0.3);
  const rim = surface('#333735', 0.5),
    iris = surface(profile.eyes, 0.2),
    pupil = surface('#101817', 0.12);
  const highlight = surface('#fff9e6', 0.1),
    whiskerMat = surface('#cfc7b6');
  function mesh(geo, material, parent = group) {
    geometries.add(geo);
    const m = new THREE.Mesh(geo, material);
    m.castShadow = m.receiveShadow = true;
    m.userData.action = 'pet';
    parent.add(m);
    return m;
  }
  const unitSphere = new THREE.SphereGeometry(1, 32, 24);
  function ellipsoid(w, h, d, material, x, y, z, parent = group) {
    const m = mesh(unitSphere, material, parent);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    return m;
  }
  // A smooth axial body with a narrower waist. One mesh avoids joined-ball outlines.
  const points = cat
    ? [
        [-0.46, 0.07, 0.13, 0.54],
        [-0.36, 0.195, 0.205, 0.53],
        [-0.18, 0.205, 0.215, 0.54],
        [0.02, 0.17, 0.19, 0.56],
        [0.23, 0.19, 0.23, 0.57],
        [0.37, 0.12, 0.19, 0.6],
        [0.43, 0.04, 0.09, 0.63],
      ]
    : [
        [-0.47, 0.075, 0.15, 0.55],
        [-0.34, 0.205, 0.235, 0.54],
        [-0.13, 0.205, 0.22, 0.56],
        [0.08, 0.225, 0.26, 0.58],
        [0.27, 0.225, 0.29, 0.59],
        [0.41, 0.14, 0.21, 0.64],
        [0.47, 0.055, 0.13, 0.67],
      ];
  const p = [],
    uv = [],
    idx = [];
  const curve = new THREE.CatmullRomCurve3(points.map((v) => new THREE.Vector3(v[1], v[2], v[3])));
  for (let i = 0; i <= 40; i++) {
    const t = i / 40,
      shape = curve.getPoint(t),
      z = points[0][0] + t * (points.at(-1)[0] - points[0][0]);
    for (let j = 0; j <= 32; j++) {
      const a = (j / 32) * Math.PI * 2;
      p.push(Math.cos(a) * shape.x, Math.sin(a) * shape.y + shape.z, z);
      uv.push(j / 32, t);
      if (i < 40 && j < 32) {
        const k = i * 33 + j;
        idx.push(k, k + 1, k + 33, k + 1, k + 34, k + 33);
      }
    }
  }
  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  bodyGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  bodyGeo.setIndex(idx);
  bodyGeo.computeVertexNormals();
  const body = mesh(bodyGeo, bodyFur);
  body.name = 'continuous-torso';
  // Sparse short guard hairs add a soft silhouette with one extra draw call.
  const hairPositions = [],
    hairColors = [];
  let seed = 47;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const baseHair = new THREE.Color(profile.fur);
  for (let i = 0; i < 1400; i++) {
    const t = 0.04 + rand() * 0.9,
      a = rand() * Math.PI * 2,
      shape = curve.getPoint(t);
    const z = points[0][0] + t * (points.at(-1)[0] - points[0][0]);
    const x = Math.cos(a) * shape.x,
      y = Math.sin(a) * shape.y + shape.z;
    const length = 0.009 + rand() * 0.015;
    hairPositions.push(
      x * 1.012,
      y + Math.sin(a) * 0.002,
      z,
      x + Math.cos(a) * 0.008,
      y + Math.sin(a) * 0.008,
      z - length,
    );
    const shade = 0.7 + rand() * 0.45;
    for (let j = 0; j < 2; j++)
      hairColors.push(baseHair.r * shade, baseHair.g * shade, baseHair.b * shade);
  }
  const hairGeo = new THREE.BufferGeometry();
  hairGeo.setAttribute('position', new THREE.Float32BufferAttribute(hairPositions, 3));
  hairGeo.setAttribute('color', new THREE.Float32BufferAttribute(hairColors, 3));
  const hairMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  geometries.add(hairGeo);
  materials.add(hairMat);
  body.add(new THREE.LineSegments(hairGeo, hairMat));
  ellipsoid(points[0][1], points[0][2], 0.025, fur, 0, points[0][3], points[0][0]);

  // Low chest bib and sloping neck merge into the torso.
  ellipsoid(cat ? 0.115 : 0.17, 0.2, 0.14, cream, 0, 0.52, 0.31);
  const neck = ellipsoid(cat ? 0.14 : 0.18, cat ? 0.24 : 0.26, 0.16, fur, 0, 0.74, 0.35);
  neck.rotation.x = 0.23;
  const head = new THREE.Group();
  head.position.set(0, cat ? 0.91 : 0.94, cat ? 0.4 : 0.43);
  group.add(head);
  ellipsoid(cat ? 0.197 : 0.22, cat ? 0.19 : 0.215, cat ? 0.19 : 0.23, fur, 0, 0, 0, head);
  // Cheeks taper naturally into muzzle; dog has a longer nose bridge.
  for (const sign of [-1, 1])
    ellipsoid(cat ? 0.115 : 0.125, 0.1, 0.105, fur, sign * 0.09, -0.055, 0.09, head);
  if (!cat) {
    const bridge = ellipsoid(0.105, 0.085, 0.19, fur, 0, -0.055, 0.2, head);
    bridge.rotation.x = 0.08;
  }
  const muzzleZ = cat ? 0.165 : 0.3;
  for (const sign of [-1, 1])
    ellipsoid(
      cat ? 0.071 : 0.082,
      cat ? 0.052 : 0.065,
      cat ? 0.074 : 0.092,
      cream,
      sign * (cat ? 0.047 : 0.049),
      -0.088,
      muzzleZ,
      head,
    );
  ellipsoid(
    cat ? 0.065 : 0.079,
    0.036,
    cat ? 0.057 : 0.08,
    cream,
    0,
    -0.126,
    muzzleZ - 0.009,
    head,
  );
  const nose = ellipsoid(
    cat ? 0.029 : 0.048,
    cat ? 0.022 : 0.032,
    0.025,
    noseMat,
    0,
    -0.072,
    muzzleZ + (cat ? 0.067 : 0.079),
    head,
  );
  nose.rotation.z = Math.PI;
  for (const sign of [-1, 1]) {
    const line = mesh(
      taperedTube(
        [
          [0, -0.09, muzzleZ + 0.07],
          [sign * 0.026, -0.117, muzzleZ + 0.059],
          [sign * 0.052, -0.112, muzzleZ + 0.037],
        ],
        0.002,
        0.001,
        8,
        4,
      ),
      rim,
      head,
    );
    line.castShadow = false;
  }
  const ears = [],
    eyes = [],
    eyeLids = [];
  for (const sign of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(sign * (cat ? 0.132 : 0.153), cat ? 0.13 : 0.16, -0.015);
    ear.rotation.z = -sign * 0.13;
    head.add(ear);
    const shape = new THREE.Shape();
    shape.moveTo(-0.074, 0);
    shape.bezierCurveTo(-0.069, 0.085, -0.045, 0.155, -0.009, cat ? 0.17 : 0.155);
    shape.bezierCurveTo(0.018, 0.18, 0.076, 0.06, 0.074, 0);
    shape.quadraticCurveTo(0, -0.025, -0.074, 0);
    const e = mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.038,
        bevelEnabled: true,
        bevelThickness: 0.014,
        bevelSize: 0.011,
        bevelSegments: 3,
        steps: 1,
        curveSegments: 12,
      }),
      fur,
      ear,
    );
    e.position.z = -0.022;
    const inner = mesh(new THREE.ShapeGeometry(shape, 12), innerEar, ear);
    inner.scale.set(0.68, 0.72, 1);
    inner.position.set(0, 0.018, 0.034);
    ears.push(ear);
    // Eyelid group closes iris, pupils and highlights together.
    const eye = new THREE.Group();
    eye.position.set(sign * (cat ? 0.101 : 0.116), cat ? 0.019 : 0.032, cat ? 0.155 : 0.184);
    eye.rotation.y = sign * 0.27;
    head.add(eye);
    ellipsoid(cat ? 0.051 : 0.046, cat ? 0.033 : 0.037, 0.024, rim, 0, 0, 0, eye);
    ellipsoid(cat ? 0.044 : 0.038, cat ? 0.026 : 0.03, 0.023, iris, 0, 0, 0.01, eye);
    ellipsoid(cat ? 0.011 : 0.02, cat ? 0.026 : 0.024, 0.01, pupil, 0, 0, 0.032, eye);
    ellipsoid(0.008, 0.008, 0.004, highlight, -0.012, 0.01, 0.041, eye);
    eyes.push(eye);
    eyeLids.push(eye);
    const brow = ellipsoid(
      cat ? 0.064 : 0.059,
      0.025,
      0.042,
      fur,
      sign * (cat ? 0.1 : 0.118),
      cat ? 0.052 : 0.069,
      cat ? 0.139 : 0.165,
      head,
    );
    brow.rotation.z = sign * 0.11;
    if (cat)
      for (let k = 0; k < 3; k++) {
        const start = [sign * 0.068, -0.088 + k * 0.013, muzzleZ + 0.04];
        const w = mesh(
          taperedTube(
            [
              start,
              [sign * 0.18, -0.084 + k * 0.018, muzzleZ + 0.07],
              [sign * (0.29 - k * 0.025), -0.1 + k * 0.034, muzzleZ + 0.025],
            ],
            0.0015,
            0.00045,
            12,
            4,
          ),
          whiskerMat,
          head,
        );
        w.castShadow = false;
      }
  }
  const legs = [],
    limbs = [];
  for (const x of [-0.145, 0.145])
    for (const z of [-0.28, 0.27]) {
      const hind = z < 0;
      const hip = new THREE.Group();
      hip.position.set(x, 0.49, z);
      group.add(hip);
      const upperLength = 0.25,
        lowerLength = 0.26;
      ellipsoid(hind ? 0.092 : 0.062, 0.145, hind ? 0.106 : 0.063, fur, 0, -0.09, 0, hip);
      const knee = new THREE.Group();
      knee.position.y = -upperLength;
      hip.add(knee);
      ellipsoid(hind ? 0.047 : 0.043, 0.125, 0.047, fur, 0, -0.1, 0, knee);
      const ankle = new THREE.Group();
      ankle.position.y = -lowerLength;
      knee.add(ankle);
      const pawMat = profile.pattern === 'socks' ? cream : fur;
      ellipsoid(cat ? 0.061 : 0.071, 0.042, cat ? 0.085 : 0.095, pawMat, 0, 0, 0.026, ankle);
      for (const toe of [-1, 0, 1])
        ellipsoid(0.018, 0.025, 0.036, pawMat, toe * 0.027, -0.006, 0.08, ankle);
      legs.push(hip);
      limbs.push({ hip, knee, ankle, upperLength, lowerLength, hind });
    }
  const tail = new THREE.Group();
  tail.position.set(0, 0.64, -0.4);
  group.add(tail);
  const tailPoints = cat
    ? [
        [0, 0, 0],
        [0, 0.04, -0.16],
        [0.03, 0.19, -0.36],
        [0.07, 0.42, -0.47],
        [0.11, 0.57, -0.43],
      ]
    : [
        [0, 0, 0],
        [0, 0.12, -0.13],
        [0.015, 0.33, -0.17],
        [0.025, 0.44, -0.05],
        [0.015, 0.32, 0.035],
      ];
  mesh(taperedTube(tailPoints, cat ? 0.042 : 0.087, 0.009, 40, 12), fur, tail);
  if (profile.collar) {
    const collar = mesh(
      new THREE.TorusGeometry(cat ? 0.146 : 0.176, 0.018, 10, 48),
      surface(profile.collarColor),
    );
    collar.position.set(0, 0.77, 0.36);
    collar.rotation.x = Math.PI / 2 + 0.27;
    ellipsoid(0.022, 0.03, 0.009, surface('#c1a064', 0.3), 0, 0.68, 0.51);
  }
  let disposed = false;
  return {
    group,
    body,
    head,
    legs,
    limbs,
    ears,
    eyes,
    eyeLids,
    tail,
    restHead: head.position.clone(),
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      group.clear();
    },
  };
}
