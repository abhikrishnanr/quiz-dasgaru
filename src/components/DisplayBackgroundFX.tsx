'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

function Stardust() {
  const pointsRef = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const count = 3200;
    const data = new Float32Array(count * 3);

    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      data[i3] = (Math.random() - 0.5) * 28;
      data[i3 + 1] = (Math.random() - 0.5) * 16;
      data[i3 + 2] = (Math.random() - 0.5) * 20;
    }

    return data;
  }, []);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const t = clock.getElapsedTime();
    pointsRef.current.rotation.y = t * 0.01;
    pointsRef.current.rotation.x = Math.sin(t * 0.05) * 0.03;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color="#7dd3fc"
        transparent
        opacity={0.65}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function HoloRings() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.rotation.z = Math.sin(t * 0.08) * 0.2;
    groupRef.current.rotation.y += 0.0008;
  });

  return (
    <group ref={groupRef} position={[-7, 0, -3]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.8, 0.025, 12, 180]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.18} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0.5, 0]}>
        <torusGeometry args={[2.8, 0.02, 12, 180]} />
        <meshBasicMaterial color="#818cf8" transparent opacity={0.2} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 1.3, 0]}>
        <torusGeometry args={[2.1, 0.014, 12, 180]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.2} />
      </mesh>
    </group>
  );
}

export default function DisplayBackgroundFX() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10">
      <Canvas camera={{ position: [0, 0, 10], fov: 55 }} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.2} />
        <pointLight position={[-6, 1.5, 3]} intensity={1.2} color="#60a5fa" />
        <pointLight position={[5, -1, 2]} intensity={0.8} color="#818cf8" />
        <Stardust />
        <HoloRings />
      </Canvas>
    </div>
  );
}
