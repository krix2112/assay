import * as THREE from "three";
import { SimplexNoise3D, createRNG } from "./ore-noise";

export interface FleckData {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

/**
 * Procedural displaced faceted geometry generator for the gold ore.
 */
export function createOreGeometry(
  detail: number = 3,
  shardIndex: number = -1 // -1 for full unified ore, 0-3 for individual shards
): THREE.BufferGeometry {
  const simplex = new SimplexNoise3D(1337);
  const baseGeom = new THREE.IcosahedronGeometry(1.3, detail);
  const posAttr = baseGeom.attributes.position;
  const count = posAttr.count;

  const positions: number[] = [];
  const uvs: number[] = [];

  const tempVec = new THREE.Vector3();

  for (let i = 0; i < count; i += 3) {
    // Check triangle centroid to determine shard ownership if splitting
    let triCenterX = 0;
    let triCenterY = 0;
    let triCenterZ = 0;

    for (let v = 0; v < 3; v++) {
      triCenterX += posAttr.getX(i + v);
      triCenterY += posAttr.getY(i + v);
      triCenterZ += posAttr.getZ(i + v);
    }
    triCenterX /= 3;
    triCenterY /= 3;
    triCenterZ /= 3;

    // Split logic into 4 quadrants
    let pieceId = 0;
    if (triCenterX >= 0 && triCenterY >= 0) pieceId = 0; // GOLDM (top right)
    else if (triCenterX < 0 && triCenterY >= 0) pieceId = 1; // GOLDTEN (top left)
    else if (triCenterX < 0 && triCenterY < 0) pieceId = 2; // GOLDGUINEA (bottom left)
    else pieceId = 3; // GOLDPETAL (bottom right)

    if (shardIndex !== -1 && pieceId !== shardIndex) {
      continue;
    }

    // Process all 3 vertices of the triangle
    for (let v = 0; v < 3; v++) {
      const idx = i + v;
      tempVec.set(posAttr.getX(idx), posAttr.getY(idx), posAttr.getZ(idx));

      // 1. Proportions: ~1.6 times wider than tall
      tempVec.x *= 1.55;
      tempVec.y *= 0.95;
      tempVec.z *= 1.15;

      const len = tempVec.length();
      const norm = tempVec.clone().normalize();

      // 2. 3D ridged fractal noise displacement for angular fractured facets
      const displacement = simplex.ridgedFBM(norm.x * 1.8, norm.y * 1.8, norm.z * 1.8, 4);
      const lowFreq = simplex.noise(norm.x * 0.8, norm.y * 0.8, norm.z * 0.8) * 0.35;
      const r = len * (0.82 + displacement * 0.42 + lowFreq);

      tempVec.copy(norm).multiplyScalar(r);

      // Flatten bottom slightly so it sits naturally on the touchstone slab
      if (tempVec.y < -0.4) {
        tempVec.y = -0.4 + (tempVec.y + 0.4) * 0.5;
      }

      positions.push(tempVec.x, tempVec.y, tempVec.z);

      // Planar/spherical UV approximation for noise shader evaluation
      uvs.push((norm.x + 1) * 0.5, (norm.y + 1) * 0.5);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));

  // Compute face normals for crisp, light-catching facets
  geometry.computeVertexNormals();

  return geometry;
}

/**
 * Generate 32 seeded instanced surface fleck transforms.
 */
export function generateFleckData(count: number = 32): FleckData[] {
  const rng = createRNG(777);
  const simplex = new SimplexNoise3D(1337);
  const flecks: FleckData[] = [];

  for (let i = 0; i < count; i++) {
    // Random direction on unit sphere
    const u = rng() * 2 - 1;
    const theta = rng() * Math.PI * 2;
    const rxy = Math.sqrt(Math.max(0, 1 - u * u));
    const dir = new THREE.Vector3(rxy * Math.cos(theta), u, rxy * Math.sin(theta)).normalize();

    // Scale to match ore outer contour
    dir.x *= 1.55;
    dir.y *= 0.95;
    dir.z *= 1.15;

    const len = dir.length();
    const norm = dir.clone().normalize();
    const disp = simplex.ridgedFBM(norm.x * 1.8, norm.y * 1.8, norm.z * 1.8, 4);
    const lowFreq = simplex.noise(norm.x * 0.8, norm.y * 0.8, norm.z * 0.8) * 0.35;
    const r = len * (0.83 + disp * 0.43 + lowFreq);

    const pos = norm.multiplyScalar(r * 1.01); // sit right on the facet surface

    // Filter out bottom flecks
    if (pos.y < -0.4) continue;

    const scaleVal = 0.025 + rng() * 0.035;

    flecks.push({
      position: [pos.x, pos.y, pos.z],
      rotation: [rng() * Math.PI, rng() * Math.PI, rng() * Math.PI],
      scale: [scaleVal * 1.2, scaleVal * 0.7, scaleVal],
    });
  }

  return flecks;
}
