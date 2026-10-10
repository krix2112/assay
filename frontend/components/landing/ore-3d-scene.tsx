"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { createOreGeometry, generateFleckData, FleckData } from "./ore-geometry";
import { createOreMaterial, createFleckMaterial } from "./ore-material";

export interface ProjectedTag {
  id: string;
  label: string;
  caption: string;
  screenX: number;
  screenY: number;
  visible: boolean;
  targetSide: "left" | "right";
}

interface Ore3DSceneProps {
  onTagsUpdate: (tags: ProjectedTag[]) => void;
  pointerParallax: { x: number; y: number };
  scrollProgress: number;
  tourFaceIndex?: number;
  onFrameRendered?: (frameTime: number) => void;
  onError?: () => void;
}

const SHARD_CONFIGS = [
  {
    id: "goldm",
    name: "GOLDM",
    basePos: new THREE.Vector3(1.75, 0.55, 0.35),
    scale: 0.38,
    color: "#C9A24B",
    shardIdx: 0,
  },
  {
    id: "goldten",
    name: "GOLDTEN",
    basePos: new THREE.Vector3(-1.75, 0.45, 0.30),
    scale: 0.32,
    color: "#D9B866",
    shardIdx: 1,
  },
  {
    id: "goldguinea",
    name: "GOLDGUINEA",
    basePos: new THREE.Vector3(-1.60, -0.55, 0.25),
    scale: 0.28,
    color: "#B98A2F",
    shardIdx: 2,
  },
  {
    id: "goldpetal",
    name: "GOLDPETAL",
    basePos: new THREE.Vector3(1.60, -0.55, 0.25),
    scale: 0.24,
    color: "#E6CF8F",
    shardIdx: 3,
  },
];

const ANCHOR_DEFS = [
  {
    id: "vein",
    label: "GOLD VEIN",
    caption: "One metal, four contracts.",
    pos: new THREE.Vector3(0.55, 0.35, 0.65),
    normal: new THREE.Vector3(0.5, 0.3, 0.8).normalize(),
    side: "right" as const,
  },
  {
    id: "quartz",
    label: "QUARTZ",
    caption: "Contracts that cannot trade are set aside.",
    pos: new THREE.Vector3(-0.65, 0.30, 0.60),
    normal: new THREE.Vector3(-0.6, 0.3, 0.7).normalize(),
    side: "left" as const,
  },
  {
    id: "mark",
    label: "ASSAY MARK",
    caption: "The daily score, marked draft.",
    pos: new THREE.Vector3(0.05, -0.35, 0.80),
    normal: new THREE.Vector3(0.1, -0.4, 0.9).normalize(),
    side: "right" as const,
  },
  {
    id: "shard",
    label: "SHARD",
    caption: "Each contract is tested on its own expiry.",
    pos: new THREE.Vector3(1.75, 0.55, 0.35),
    normal: new THREE.Vector3(0.2, 0.3, 0.9).normalize(),
    side: "right" as const,
  },
];

function OreModelGroup({
  onTagsUpdate,
  pointerParallax,
  scrollProgress,
  tourFaceIndex = 0,
  onFrameRendered,
}: Ore3DSceneProps) {
  const { camera, size, invalidate } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const flecksRef = useRef<THREE.InstancedMesh>(null);
  const shardRefs = useRef<(THREE.Mesh | null)[]>([]);

  const lastTimeRef = useRef(performance.now());

  // Geometries
  const oreGeom = useMemo(() => createOreGeometry(3, -1), []);
  const shardGeoms = useMemo(
    () => [
      createOreGeometry(2, 0),
      createOreGeometry(2, 1),
      createOreGeometry(2, 2),
      createOreGeometry(2, 3),
    ],
    []
  );

  const oreMat = useMemo(() => createOreMaterial(), []);
  const fleckMat = useMemo(() => createFleckMaterial(), []);
  const fleckData: FleckData[] = useMemo(() => generateFleckData(32), []);

  // Dedicated shard materials with slight gold tone variations
  const shardMaterials = useMemo(
    () =>
      SHARD_CONFIGS.map((c) => {
        const mat = createOreMaterial();
        mat.color = new THREE.Color(c.color).multiplyScalar(0.7);
        return mat;
      }),
    []
  );

  useEffect(() => {
    if (!flecksRef.current) return;
    const mesh = flecksRef.current;
    const dummy = new THREE.Object3D();

    fleckData.forEach((f, i) => {
      dummy.position.set(...f.position);
      dummy.rotation.set(...f.rotation);
      dummy.scale.set(...f.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    invalidate();
  }, [fleckData, invalidate]);

  // Settle turn on mount (1.8s)
  const settleProgressRef = useRef(0);
  const startTimeRef = useRef(performance.now());

  useFrame(() => {
    const now = performance.now();
    const delta = now - lastTimeRef.current;
    lastTimeRef.current = now;

    if (onFrameRendered) {
      onFrameRendered(delta);
    }

    const elapsed = (now - startTimeRef.current) / 1000;
    settleProgressRef.current = Math.min(1, elapsed / 1.8);
    const settleEase = 1 - Math.pow(1 - settleProgressRef.current, 3);

    if (!groupRef.current) return;

    // Base rotation + tour face angle + pointer parallax
    const tourAngles = [0, 0.85, 1.7, 2.5, 3.14];
    const targetTourAngle = tourAngles[Math.min(tourFaceIndex, tourAngles.length - 1)];

    const baseRotY = -0.32 + (1 - settleEase) * 0.45 + targetTourAngle + scrollProgress * 0.8;
    const targetRotY = baseRotY + pointerParallax.x * 0.25;
    const targetRotX = 0.12 + pointerParallax.y * 0.20;

    groupRef.current.rotation.y = targetRotY;
    groupRef.current.rotation.x = targetRotX;

    // Animate orbiting shards (arrive from slightly outside during settle, then follow parallax)
    SHARD_CONFIGS.forEach((cfg, idx) => {
      const mesh = shardRefs.current[idx];
      if (!mesh) return;

      const arriveDist = 1 + (1 - settleEase) * 0.8;
      const scrollOffset = scrollProgress * (idx % 2 === 0 ? 0.35 : -0.35);

      mesh.position.set(
        cfg.basePos.x * arriveDist + pointerParallax.x * (0.15 + idx * 0.05),
        cfg.basePos.y * arriveDist + pointerParallax.y * (0.15 + idx * 0.05) + scrollOffset,
        cfg.basePos.z + (idx === 0 || idx === 3 ? 0.1 : -0.1)
      );

      mesh.rotation.y = targetRotY * 1.2 + idx * 0.8;
      mesh.rotation.x = targetRotX + idx * 0.4;
    });

    // Project annotation tag anchors to 2D screen coordinates
    const tags: ProjectedTag[] = [];
    const tempVec = new THREE.Vector3();
    const tempNormal = new THREE.Vector3();
    const worldMatrix = groupRef.current.matrixWorld;

    ANCHOR_DEFS.forEach((def, i) => {
      tempVec.copy(def.pos);

      // If shard anchor, track shard position
      if (def.id === "shard" && shardRefs.current[0]) {
        tempVec.copy(shardRefs.current[0].position);
      } else {
        tempVec.applyMatrix4(worldMatrix);
      }

      // Check surface facing
      tempNormal.copy(def.normal).applyEuler(groupRef.current!.rotation);
      const isFacingCamera = tempNormal.z > -0.25;

      // Project to normalized device coordinates [-1, 1]
      tempVec.project(camera);

      // Convert to screen pixels
      const screenX = ((tempVec.x + 1) * 0.5) * size.width;
      const screenY = ((-tempVec.y + 1) * 0.5) * size.height;

      tags.push({
        id: def.id,
        label: def.label,
        caption: def.caption,
        screenX,
        screenY,
        visible: isFacingCamera && settleProgressRef.current > 0.4,
        targetSide: def.side,
      });
    });

    onTagsUpdate(tags);
  });

  return (
    <group ref={groupRef} position={[0.25, 0.05, 0]}>
      {/* Central dominant ore */}
      <mesh geometry={oreGeom} material={oreMat} castShadow receiveShadow />
      <instancedMesh
        ref={flecksRef}
        args={[new THREE.OctahedronGeometry(1, 0), fleckMat, fleckData.length]}
        castShadow
      />

      {/* Four floating contract shards */}
      {SHARD_CONFIGS.map((cfg, idx) => (
        <mesh
          key={cfg.id}
          ref={(el) => {
            shardRefs.current[idx] = el;
          }}
          geometry={shardGeoms[cfg.shardIdx]}
          material={shardMaterials[idx]}
          scale={cfg.scale}
          castShadow
        />
      ))}
    </group>
  );
}

export function Ore3DScene(props: Ore3DSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  return (
    <div
      className="relative w-full h-full cursor-grab active:cursor-grabbing select-none"
      style={{ touchAction: "pan-y" }}
      role="img"
      aria-label="A decorative 3D model of gold ore"
    >
      <Canvas
        ref={canvasRef}
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.25, 4.2], fov: 40 }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
        }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            if (props.onError) props.onError();
          });
        }}
      >
        <ambientLight intensity={0.45} />
        <directionalLight position={[4, 5, 3]} intensity={2.4} color="#FFF8E7" castShadow />
        <directionalLight position={[-4, 2, -3]} intensity={1.8} color="#E6CF8F" />

        <Environment frames={1}>
          <Lightformer form="rect" intensity={2.6} color="#FFF4D0" position={[2, 3, 2]} scale={[4, 4, 1]} />
          <Lightformer form="rect" intensity={1.8} color="#E6CF8F" position={[-3, 2, -2]} scale={[5, 2, 1]} />
          <Lightformer form="circle" intensity={1.4} color="#FFFFFF" position={[0, 4, 0]} scale={[3, 3, 1]} />
        </Environment>

        <OreModelGroup {...props} />

        <ContactShadows
          position={[0, -0.65, 0]}
          opacity={0.65}
          scale={4.5}
          blur={2.4}
          far={1.5}
          resolution={256}
          color="#070C0B"
        />
      </Canvas>
    </div>
  );
}
