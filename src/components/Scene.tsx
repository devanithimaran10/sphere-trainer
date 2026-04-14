import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Sparkles, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';
import Sphere from './Sphere';

// Animated ambient mood lights
function MoodLights() {
  const r1 = useRef<THREE.PointLight>(null);
  const r2 = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (r1.current) {
      r1.current.position.x = Math.sin(t * 0.3) * 6;
      r1.current.position.y = Math.cos(t * 0.2) * 3 + 1;
      r1.current.intensity  = 0.4 + Math.sin(t * 0.5) * 0.2;
    }
    if (r2.current) {
      r2.current.position.x = Math.cos(t * 0.25) * 6;
      r2.current.position.y = Math.sin(t * 0.35) * 2 - 1;
      r2.current.intensity  = 0.3 + Math.cos(t * 0.4) * 0.15;
    }
  });

  return (
    <>
      <pointLight ref={r1} color="#00d4ff" intensity={0.4} distance={18} decay={2} />
      <pointLight ref={r2} color="#7b2fff" intensity={0.3} distance={18} decay={2} />
      <pointLight position={[0, -4, 2]} color="#ff2d55" intensity={0.12} distance={12} decay={2} />
    </>
  );
}

function SceneContent() {
  const activeSpheres = useGameStore((s) => s.activeSpheres);
  const phase         = useGameStore((s) => s.phase);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.06} />
      <hemisphereLight args={['#0a1628', '#000000', 0.15]} />
      <MoodLights />

      {/* Background */}
      <Stars radius={120} depth={60} count={4000} factor={3} saturation={0.1} fade speed={0.6} />

      {/* Ambient particles — visible during gameplay */}
      {phase === 'playing' && (
        <Sparkles
          count={60}
          scale={[12, 8, 4]}
          size={1.2}
          speed={0.25}
          color="#00d4ff"
          opacity={0.18}
        />
      )}

      {/* Ground grid */}
      <Grid
        args={[40, 40]}
        position={[0, -4, 0]}
        cellSize={1.2}
        cellThickness={0.4}
        cellColor="#0a2030"
        sectionSize={6}
        sectionThickness={0.8}
        sectionColor="#00d4ff"
        fadeDistance={28}
        fadeStrength={1.8}
        followCamera={false}
        infiniteGrid
      />

      {/* Active spheres */}
      {activeSpheres.map((s) => (
        <Sphere key={s.id} sphere={s} />
      ))}
    </>
  );
}

export default function Scene() {
  return (
    <div className="absolute inset-0 w-full h-full z-0">
      <Canvas
        camera={{ position: [0, 0.6, 9], fov: 62 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: '#03040a' }}
      >
        <SceneContent />
      </Canvas>
    </div>
  );
}
