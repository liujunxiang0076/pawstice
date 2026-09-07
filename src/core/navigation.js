import * as THREE from 'three';
export function createNavigator(obstacles, getRadius) {
  const step = 0.2,
    minX = -3.7,
    minZ = -3.0,
    nx = 38,
    nz = 31;
  function blocked(x, z) {
    return obstacles.some(
      (o) =>
        Math.abs(x - o.x) < o.w - 0.3 + getRadius() && Math.abs(z - o.z) < o.d - 0.3 + getRadius(),
    );
  }
  function findPath(startPosition, target) {
    const cell = (v) => [
      Math.max(0, Math.min(nx - 1, Math.round((v.x - minX) / step))),
      Math.max(0, Math.min(nz - 1, Math.round((v.z - minZ) / step))),
    ];
    const [sx, sz] = cell(startPosition),
      [tx, tz] = cell(target);
    const key = (x, z) => x + z * nx;
    const start = key(sx, sz),
      end = key(tx, tz);
    const open = [start],
      cost = new Map([[start, 0]]),
      prev = new Map();
    let iterations = 0;
    while (open.length && iterations++ < 1800) {
      open.sort(
        (a, b) =>
          cost.get(a) +
          Math.hypot((a % nx) - tx, Math.floor(a / nx) - tz) -
          (cost.get(b) + Math.hypot((b % nx) - tx, Math.floor(b / nx) - tz)),
      );
      const cur = open.shift();
      if (cur === end) {
        let points = [],
          k = cur;
        while (k !== start) {
          points.push(
            new THREE.Vector3(minX + (k % nx) * step, 0, minZ + Math.floor(k / nx) * step),
          );
          k = prev.get(k);
        }
        return points.reverse();
      }
      const x = cur % nx,
        z = Math.floor(cur / nx);
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        const xx = x + dx,
          zz = z + dz;
        if (xx < 0 || xx >= nx || zz < 0 || zz >= nz || blocked(minX + xx * step, minZ + zz * step))
          continue;
        if (
          dx &&
          dz &&
          (blocked(minX + (x + dx) * step, minZ + z * step) ||
            blocked(minX + x * step, minZ + (z + dz) * step))
        )
          continue;
        const nk = key(xx, zz),
          nc = cost.get(cur) + Math.hypot(dx, dz);
        if (nc < (cost.get(nk) ?? Infinity)) {
          prev.set(nk, cur);
          cost.set(nk, nc);
          if (!open.includes(nk)) open.push(nk);
        }
      }
    }
    return [];
  }
  return { blocked, findPath };
}
