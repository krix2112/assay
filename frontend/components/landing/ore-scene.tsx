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
import {
  createOreGeometry,
  generateFleckData,
  FleckData,
} from "./ore-geometry";
import { createOreMaterial, createFleckMaterial } from "./ore-material";

interface OreModelProps {
  splitProgress: number;
  rotationY: number;
  rotationX: number;
  detail: number;
  isDragging: boolean;
  onFrameRendered: (frameTime: number) => void;
}

// 4 Shard displacement directions for the split
const SHARD_VECTORS = [
  new THREE.Vector3(1.2, 0.45, 0.3),   // GOLDM (upper right)
  new THREE.Vector3(-1.2, 0.45, 0.3),  // GOLDTEN (upper left)
  new THREE.Vector3(-1.1, -0.45, 0.2), // GOLDGUINEA (lower left)
  new THREE.Vector3(1.1, -0.45, 0.2),  // GOLDPETAL (lower right)
];

function OreModel({
  splitProgress,
  rotationY,
  rotationX,
  detail,
  isDragging,
  onFrameRendered,
}: OreModelProps) {
  const { invalidate } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const flecksRef = useRef<THREE.InstancedMesh>(null);

  // Measure frame time for performance monitoring
  const lastTimeRef = useRef(performance.now());

  // Unified ore geometry (detail adjusted dynamically)
  const fullGeometry = useMemo(() => createOreGeometry(detail, -1), [detail]);
  // 4 discrete shard geometries
  const shardGeometries = useMemo(
    () => [
      createOreGeometry(Math.max(1, detail - 1), 0),
      createOreGeometry(Math.max(1, detail - 1), 1),
      createOreGeometry(Math.max(1, detail - 1), 2),
      createOreGeometry(Math.max(1, detail - 1), 3),
    ],
    [detail]
  );

  const oreMaterial = useMemo(() => createOreMaterial(), []);
  const fleckMaterial = useMemo(() => createFleckMaterial(), []);
  const fleckData: FleckData[] = useMemo(() => generateFleckData(32), []);

  // Update instanced fleck matrices once on load
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

  useFrame(() => {
    const now = performance.now();
    const delta = now - lastTimeRef.current;
    lastTimeRef.current = now;

    if (isDragging || splitProgress > 0) {
      onFrameRendered(delta);
    }

    if (!groupRef.current) return;
    groupRef.current.rotation.y = rotationY;
    groupRef.current.rotation.x = rotationX;
  });

  // Calculate shard positions and overall opacity based on splitProgress
  const opacity = Math.max(0, 1 - Math.max(0, splitProgress - 0.7) / 0.3);
  const isSplitActive = splitProgress > 0.02;

  return (
    <group ref={groupRef} position={[0, 0.08, 0]}>
      {!isSplitActive ? (
        // Unified single ore
        <group>
          <mesh
            geometry={fullGeometry}
            material={oreMaterial}
            castShadow
            receiveShadow
          />
          <instancedMesh
            ref={flecksRef}
            args={[new THREE.OctahedronGeometry(1, 0), fleckMaterial, fleckData.length]}
            castShadow
          />
        </group>
      ) : (
        // Four split pieces separating along quadrant vectors
        <group>
          {shardGeometries.map((geom, idx) => {
            const dir = SHARD_VECTORS[idx];
            // Eased outward displacement
            const travel = Math.min(1.2, splitProgress * 1.6);
            const px = dir.x * travel;
            const py = dir.y * travel;
            const pz = dir.z * travel;

            return (
              <mesh
                key={idx}
                geometry={geom}
                material={oreMaterial}
                position={[px, py, pz]}
                scale={Math.max(0.01, 1 - splitProgress * 0.45)}
                castShadow
              />
            );
          })}
        </group>
      )}
    </group>
  );
}

export interface OreSceneProps {
  splitProgress?: number;
  onLoaded?: () => void;
  onError?: () => void;
}

export function OreScene({
  splitProgress = 0,
  onLoaded,
  onError,
}: OreSceneProps) {
  const [detail, setDetail] = useState(3);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [rotY, setRotY] = useState(-0.35); // initial settled angle
  const [rotX, setRotX] = useState(0.12);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameTimesRef = useRef<number[]>([]);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const velRef = useRef({ x: 0, y: 0 });
  const animFrameRef = useRef<number | null>(null);

  // One-time load settle animation (~1.2s turn)
  useEffect(() => {
    let start = performance.now();
    const duration = 1200;
    const initialTurn = 0.5;

    const animateSettle = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setRotY(-0.35 + (1 - eased) * initialTurn);

      if (progress < 1) {
        requestAnimationFrame(animateSettle);
      } else {
        if (onLoaded) onLoaded();
      }
    };

    requestAnimationFrame(animateSettle);
  }, [onLoaded]);

  // Performance budget: monitor frame times during drag/scroll
  const handleFrameRendered = useCallback((frameTime: number) => {
    frameTimesRef.current.push(frameTime);
    if (frameTimesRef.current.length > 30) {
      const avg =
        frameTimesRef.current.reduce((a, b) => a + b, 0) /
        frameTimesRef.current.length;
      // If average frame time exceeds 33.3ms (< 30fps), downgrade detail automatically
      if (avg > 33.3 && detail > 1) {
        setDetail((d) => Math.max(1, d - 1));
        frameTimesRef.current = [];
      }
    }
  }, [detail]);

  // Inertia damping loop
  const updateInertia = useCallback(() => {
    if (Math.abs(velRef.current.x) > 0.0001 || Math.abs(velRef.current.y) > 0.0001) {
      setRotY((y) => y + velRef.current.x);
      setRotX((x) => Math.max(-0.4, Math.min(0.5, x + velRef.current.y)));
      velRef.current.x *= 0.92;
      velRef.current.y *= 0.92;
      animFrameRef.current = requestAnimationFrame(updateInertia);
    } else {
      velRef.current = { x: 0, y: 0 };
    }
  }, []);

  // Mouse & touch handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setHasInteracted(true);
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    velRef.current = { x: 0, y: 0 };
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };

    const speed = 0.0065;
    const vx = dx * speed;
    const vy = dy * speed;

    velRef.current = { x: vx, y: vy };
    setRotY((y) => y + vx);
    setRotX((x) => Math.max(-0.4, Math.min(0.5, x + vy)));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    animFrameRef.current = requestAnimationFrame(updateInertia);
  };

  // Keyboard accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    setHasInteracted(true);
    const step = 0.14; // ~8 degrees
    if (e.key === "ArrowLeft") {
      setRotY((y) => y - step);
    } else if (e.key === "ArrowRight") {
      setRotY((y) => y + step);
    } else if (e.key === "ArrowUp") {
      setRotX((x) => Math.min(0.5, x + step));
    } else if (e.key === "ArrowDown") {
      setRotX((x) => Math.max(-0.4, x - step));
    } else if (e.key === "Escape") {
      setRotY(-0.35);
      setRotX(0.12);
    }
  };

  return (
    <div
      className="relative w-full h-full select-none cursor-grab active:cursor-grabbing focus:outline-none"
      style={{ touchAction: "pan-y" }}
      tabIndex={0}
      role="img"
      aria-label="A decorative 3D model of gold ore"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
    >
      <Canvas
        ref={canvasRef}
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.4, 3.4], fov: 42 }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
        }}
        onCreated={({ gl }) => {
          const dom = gl.domElement;
          dom.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            if (onError) onError();
          });
        }}
      >
        {/* Local Lighting: no external HDRI */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[4, 5, 3]}
          intensity={2.2}
          color="#FFF8E7"
          castShadow
        />
        <directionalLight
          position={[-4, 2, -3]}
          intensity={1.6}
          color="#E6CF8F"
        />

        {/* Local Environment lightformers for realistic gold specular reflections */}
        <Environment frames={1}>
          <Lightformer
            form="rect"
            intensity={2.5}
            color="#FFF4D0"
            position={[2, 3, 2]}
            scale={[4, 4, 1]}
          />
          <Lightformer
            form="rect"
            intensity={1.8}
            color="#E6CF8F"
            position={[-3, 2, -2]}
            scale={[5, 2, 1]}
          />
          <Lightformer
            form="circle"
            intensity={1.2}
            color="#FFFFFF"
            position={[0, 4, 0]}
            scale={[3, 3, 1]}
          />
        </Environment>

        <OreModel
          splitProgress={splitProgress}
          rotationY={rotY}
          rotationX={rotX}
          detail={detail}
          isDragging={isDragging}
          onFrameRendered={handleFrameRendered}
        />

        {/* Soft contact shadow onto the touchstone slab */}
        <ContactShadows
          position={[0, -0.42, 0]}
          opacity={0.65}
          scale={3.6}
          blur={2.2}
          far={1.2}
          resolution={256}
          color="#0B100F"
        />
      </Canvas>

      {/* Keyboard & drag hint */}
      {!hasInteracted && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-xs text-[11px] font-mono pointer-events-none transition-opacity duration-500 backdrop-blur-xs border"
          style={{
            background: "rgba(23, 34, 32, 0.75)",
            borderColor: "rgba(255, 255, 255, 0.08)",
            color: "#9AA5A1",
          }}
        >
          Drag to turn the ore
        </div>
      )}
    </div>
  );
}
