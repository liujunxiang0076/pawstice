import * as THREE from 'three';

/**
 * Deterministic, local short-coat texture. It keeps the base pigment, soft
 * undercoat and markings separate so a tabby reads as fur rather than a noisy
 * coloured plastic surface. No canvas or downloaded assets are used.
 */
export function createCoatTexture(color, pattern = 'solid', undercoat = color) {
  const size = 512,
    data = new Uint8Array(size * size * 4);
  const base = new THREE.Color(color);
  const under = new THREE.Color(undercoat);
  // Texture bytes are sRGB; Color stores linear values.
  base.convertLinearToSRGB();
  under.convertLinearToSRGB();
  let seed = 9347;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size;
      // u follows the circumference of the surface. Its lower half receives
      // a gentler undercoat, which gives the belly and muzzle their natural
      // light falloff without needing a separate decal for every mesh.
      const underside = Math.max(0, -Math.sin(u * Math.PI * 2));
      const belly = Math.pow(underside, 2.2) * (pattern === 'solid' ? 0.13 : 0.44);
      const stripeWave = Math.cos(v * Math.PI * 14 + Math.sin(u * Math.PI * 3) * 1.8);
      const stripe = pattern === 'stripes' ? Math.pow(Math.max(0, stripeWave), 12) * 0.38 : 0;
      const grain = (random() - 0.5) * 0.035;
      const fine = Math.sin(x * 2.1 + Math.sin(y * 0.04) * 1.7) * 0.012;
      const long = Math.sin((u * 0.7 + v * 0.35) * Math.PI * 42) * 0.01;
      const pigment = 0.985 + grain + fine + long - stripe;
      const r = THREE.MathUtils.lerp(base.r, under.r, belly) * pigment;
      const g = THREE.MathUtils.lerp(base.g, under.g, belly) * pigment;
      const b = THREE.MathUtils.lerp(base.b, under.b, belly) * pigment;
      const i = (y * size + x) * 4;
      data[i] = Math.min(255, r * 255);
      data[i + 1] = Math.min(255, g * 255);
      data[i + 2] = Math.min(255, b * 255);
      data[i + 3] = 255;
    }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Tapered continuous curve; used for tails and whiskers without bead seams. */
export function taperedTube(points, radius, tipRadius, segments = 40, radial = 10) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const frames = curve.computeFrenetFrames(segments, false);
  const positions = [],
    normals = [],
    uv = [],
    indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments,
      center = curve.getPointAt(t);
    const r = radius * (1 - t) + tipRadius * t;
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const n = frames.normals[i]
        .clone()
        .multiplyScalar(Math.cos(a))
        .addScaledVector(frames.binormals[i], Math.sin(a));
      const p = center.clone().addScaledVector(n, r);
      positions.push(p.x, p.y, p.z);
      normals.push(n.x, n.y, n.z);
      uv.push(j / radial, t);
      if (i < segments && j < radial) {
        const k = i * (radial + 1) + j;
        indices.push(k, k + radial + 1, k + 1, k + 1, k + radial + 1, k + radial + 2);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  return g;
}
