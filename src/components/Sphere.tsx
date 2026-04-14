import { useRef, useState, useEffect, useCallback } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Float, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';
import type { ActiveSphere } from '../types';

const HEX: Record<string, string> = {
  green:  '#00ff88',
  blue:   '#00d4ff',
  red:    '#ff2d55',
  yellow: '#ffd60a',
};

interface Props { sphere: ActiveSphere }

export default function Sphere({ sphere }: Props) {
  const meshRef   = useRef<THREE.Mesh>(null);
  const ringRef   = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [flash,   setFlash]   = useState<'success' | 'error' | null>(null);

  const dragStart   = useRef<{ x: number; y: number } | null>(null);
  const holdTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inhibitTimer= useRef<ReturnType<typeof setTimeout> | null>(null);

  const { registerInput, registerInhibition, adaptive } = useGameStore();
  const col = HEX[sphere.color];

  // Red spheres: auto-register inhibition after timeout
  useEffect(() => {
    if (sphere.color !== 'red') return;
    inhibitTimer.current = setTimeout(() => {
      registerInhibition(sphere.id);
    }, 1800 / adaptive.objectSpeed);
    return () => { if (inhibitTimer.current) clearTimeout(inhibitTimer.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerFlash = (type: 'success' | 'error') => {
    setFlash(type);
    setTimeout(() => setFlash(null), 380);
  };

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    dragStart.current = { x: e.clientX, y: e.clientY };

    // Touching red = inhibition error
    if (sphere.color === 'red') {
      if (inhibitTimer.current) clearTimeout(inhibitTimer.current);
      triggerFlash('error');
      registerInput({
        sphereId: sphere.id,
        action: 'left', // any non-inhibit
        reactionTime: Date.now() - sphere.spawnTime,
        driftMagnitude: 0,
      });
      return;
    }

    // Yellow: hold for 2 s
    if (sphere.color === 'yellow') {
      holdTimer.current = setTimeout(() => {
        triggerFlash('success');
        registerInput({
          sphereId: sphere.id,
          action: 'hold',
          reactionTime: Date.now() - sphere.spawnTime,
          driftMagnitude: 0,
        });
      }, 2000);
    }
  }, [sphere, registerInput]);

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!dragStart.current || sphere.color === 'red' || sphere.color === 'yellow') return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) < 28) return;

    const action = dx < 0 ? 'left' : 'right';
    const drift  = Math.abs(dy) / window.innerHeight;
    dragStart.current = null;

    triggerFlash('success');
    registerInput({
      sphereId: sphere.id,
      action,
      reactionTime: Date.now() - sphere.spawnTime,
      driftMagnitude: drift * 2,
    });
  }, [sphere, registerInput]);

  const handlePointerUp = useCallback(() => {
    dragStart.current = null;
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }, []);

  // Animate scale + ring rotation
  useFrame((state) => {
    if (!meshRef.current) return;
    const base  = adaptive.targetSize * 0.52;
    const target = hovered ? base * 1.18 : base;
    meshRef.current.scale.lerp(new THREE.Vector3(target, target, target), 0.12);

    if (ringRef.current) {
      ringRef.current.rotation.z += 0.008;
      const rt = flash === 'success' ? 0.95 : flash === 'error' ? 0.6 : hovered ? 0.75 : 0.35;
      (ringRef.current.material as THREE.MeshStandardMaterial).opacity =
        THREE.MathUtils.lerp(
          (ringRef.current.material as THREE.MeshStandardMaterial).opacity,
          rt,
          0.15
        );
    }

    // Subtle wobble
    meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.8 + sphere.spawnTime) * 0.12;
  });

  const emissiveInt = flash === 'success' ? 3.5 : flash === 'error' ? 0.2 : hovered ? 1.8 : 0.9;
  const distort     = hovered ? 0.32 : 0.12;

  return (
    <Float speed={1.4 * adaptive.objectSpeed} rotationIntensity={0.15} floatIntensity={0.6}>
      <group position={sphere.position}>
        {/* Glow point light */}
        <pointLight
          color={col}
          intensity={hovered ? 5 : 2.5}
          distance={6}
          decay={2}
        />

        {/* Main sphere */}
        <mesh
          ref={meshRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => {
            setHovered(false);
            dragStart.current = null;
            if (holdTimer.current) clearTimeout(holdTimer.current);
          }}
        >
          <sphereGeometry args={[1, 64, 64]} />
          <MeshDistortMaterial
            color={col}
            emissive={col}
            emissiveIntensity={emissiveInt}
            distort={distort}
            speed={hovered ? 5 : 1.8}
            roughness={0.08}
            metalness={0.25}
          />
        </mesh>

        {/* Outer orbital ring */}
        <mesh ref={ringRef} rotation={[Math.PI / 2.4, 0.3, 0]}>
          <torusGeometry args={[0.78, 0.018, 8, 80]} />
          <meshStandardMaterial
            color={col}
            emissive={col}
            emissiveIntensity={1.2}
            transparent
            opacity={0.35}
          />
        </mesh>

        {/* Distractor marker – faint red X overlay */}
        {sphere.isDistractor && (
          <mesh position={[0, 0, 0.56]}>
            <ringGeometry args={[0.18, 0.22, 4]} />
            <meshBasicMaterial color="#ff2d55" transparent opacity={0.55} />
          </mesh>
        )}
      </group>
    </Float>
  );
}
