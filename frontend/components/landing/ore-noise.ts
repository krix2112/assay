/**
 * Seeded pseudo-random number generator and 3D Perlin/simplex noise
 * for deterministic procedural ore generation.
 */

// Mulberry32 seeded PRNG
export function createRNG(seed: number) {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 3D Simplex-style gradient noise implementation
export class SimplexNoise3D {
  private perm: Uint8Array = new Uint8Array(512);

  constructor(seed: number = 42) {
    const rng = createRNG(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }

  noise(x: number, y: number, z: number): number {
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    const floorZ = Math.floor(z);

    const X = floorX & 255;
    const Y = floorY & 255;
    const Z = floorZ & 255;

    const fx = x - floorX;
    const fy = y - floorY;
    const fz = z - floorZ;

    // Fade curves
    const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const w = fz * fz * fz * (fz * (fz * 6 - 15) + 10);

    const A = this.perm[X] + Y;
    const AA = this.perm[A] + Z;
    const AB = this.perm[A + 1] + Z;
    const B = this.perm[X + 1] + Y;
    const BA = this.perm[B] + Z;
    const BB = this.perm[B + 1] + Z;

    const grad = (hash: number, gx: number, gy: number, gz: number) => {
      const h = hash & 15;
      const uGrad = h < 8 ? gx : gy;
      const vGrad = h < 4 ? gy : h === 12 || h === 14 ? gx : gz;
      return ((h & 1) === 0 ? uGrad : -uGrad) + ((h & 2) === 0 ? vGrad : -vGrad);
    };

    const lerp = (a: number, b: number, t: number) => a + t * (b - a);

    const x1 = lerp(grad(this.perm[AA], fx, fy, fz), grad(this.perm[BA], fx - 1, fy, fz), u);
    const x2 = lerp(grad(this.perm[AB], fx, fy - 1, fz), grad(this.perm[BB], fx - 1, fy - 1, fz), u);
    const y1 = lerp(x1, x2, v);

    const x3 = lerp(grad(this.perm[AA + 1], fx, fy, fz - 1), grad(this.perm[BA + 1], fx - 1, fy, fz - 1), u);
    const x4 = lerp(grad(this.perm[AB + 1], fx, fy - 1, fz - 1), grad(this.perm[BB + 1], fx - 1, fy - 1, fz - 1), u);
    const y2 = lerp(x3, x4, v);

    return lerp(y1, y2, w);
  }

  // Ridged multi-fractal noise for sharp rock facets and fractures
  ridgedFBM(x: number, y: number, z: number, octaves: number = 4): number {
    let sum = 0;
    let freq = 1.0;
    let amp = 0.5;
    let prev = 1.0;

    for (let i = 0; i < octaves; i++) {
      let n = Math.abs(this.noise(x * freq, y * freq, z * freq));
      n = 1.0 - n; // invert for ridges
      n = n * n;   // sharpen ridges
      sum += n * amp * prev;
      prev = n;
      freq *= 2.1;
      amp *= 0.48;
    }

    return sum;
  }
}
