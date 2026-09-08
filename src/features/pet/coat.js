import * as THREE from 'three';

/** Deterministic, local short-coat texture. No canvas or downloaded assets. */
export function createCoatTexture(color, pattern = 'solid') {
  const size = 512,
    data = new Uint8Array(size * size * 4);
  const base = new THREE.Color(color);
  // Texture bytes are sRGB; Color stores linear values.
  base.convertLinearToSRGB();
  let seed = 9347;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size;
      const stripe =
        pattern === 'stripes'
          ? Math.pow(
              Math.max(0, Math.cos(v * Math.PI * 18 + Math.sin(u * Math.PI * 6) * 1.4)),
              10,
            ) * 0.17
          : 0;
      const grain = (random() - 0.5) * 0.065;
      const fine = Math.sin(x * 2.8 + Math.sin(y * 0.045) * 1.9) * 0.024;
      const long = Math.sin((u + v * 0.35) * Math.PI * 54) * 0.018;
      const shade = 0.985 + grain + fine + long - stripe;
      const i = (y * size + x) * 4;
      data[i] = Math.min(255, base.r * shade * 255);
      data[i + 1] = Math.min(255, base.g * shade * 255);
      data[i + 2] = Math.min(255, base.b * shade * 255);
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
