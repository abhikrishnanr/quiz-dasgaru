'use client';

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Stars } from '@react-three/drei';
import * as THREE from 'three';

type AIHostAvatarProps = {
  isSpeaking: boolean;
  size?: string;
};

function NeuralCore({ isSpeaking }: { isSpeaking: boolean }) {
  const coreRef = useRef<THREE.Mesh>(null);
  const ringARef = useRef<THREE.Mesh>(null);
  const ringBRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const positions = new Float32Array(900);
    for (let i = 0; i < positions.length; i += 3) {
      const radius = 1.4 + Math.random() * 1.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i + 2] = radius * Math.cos(phi);
    }
    return positions;
  }, []);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const pulse = isSpeaking ? 1 + Math.sin(time * 9) * 0.18 : 1 + Math.sin(time * 3) * 0.08;

    if (coreRef.current) {
      coreRef.current.scale.setScalar(pulse);
      const material = coreRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = isSpeaking ? 2.4 : 1.2;
      material.color.set(isSpeaking ? '#7dd3fc' : '#93c5fd');
    }

    if (ringARef.current) {
      ringARef.current.rotation.x += isSpeaking ? 0.02 : 0.009;
      ringARef.current.rotation.y += isSpeaking ? 0.02 : 0.008;
      const material = ringARef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = isSpeaking ? 1.6 : 0.7;
    }

    if (ringBRef.current) {
      ringBRef.current.rotation.x -= isSpeaking ? 0.017 : 0.007;
      ringBRef.current.rotation.z += isSpeaking ? 0.02 : 0.009;
      const material = ringBRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = isSpeaking ? 1.4 : 0.6;
    }

    if (particlesRef.current) {
      particlesRef.current.rotation.y += isSpeaking ? 0.005 : 0.002;
      particlesRef.current.rotation.x += 0.001;
    }
  });

  return (
    <Float speed={1.2} rotationIntensity={0.35} floatIntensity={0.4}>
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.7, 64, 64]} />
        <meshStandardMaterial color="#93c5fd" emissive="#38bdf8" emissiveIntensity={1.2} roughness={0.2} metalness={0.4} />
      </mesh>

      <mesh ref={ringARef} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[1.2, 0.05, 24, 200]} />
        <meshStandardMaterial color="#67e8f9" emissive="#06b6d4" emissiveIntensity={0.7} roughness={0.25} metalness={0.8} />
      </mesh>

      <mesh ref={ringBRef} rotation={[0, Math.PI / 3, Math.PI / 2]}>
        <torusGeometry args={[1.5, 0.035, 24, 200]} />
        <meshStandardMaterial color="#a78bfa" emissive="#8b5cf6" emissiveIntensity={0.6} roughness={0.3} metalness={0.9} />
      </mesh>

      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particles, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.03} color="#e0f2fe" transparent opacity={0.9} />
      </points>
    </Float>
  );
}

export default function AIHostAvatar({ isSpeaking, size = 'h-72 w-72' }: AIHostAvatarProps) {
  return (
    <div
      className={`${size} relative overflow-hidden rounded-[2rem] border border-cyan-300/35 bg-[radial-gradient(circle_at_35%_20%,rgba(103,232,249,0.28),transparent_52%),radial-gradient(circle_at_70%_80%,rgba(167,139,250,0.2),transparent_50%),rgba(2,6,23,0.92)] shadow-[0_0_65px_rgba(6,182,212,0.24)]`}
    >
      <div className="pointer-events-none absolute inset-0 z-10 rounded-[2rem] border border-white/10" />
      <div
        className={`pointer-events-none absolute -inset-16 rounded-full blur-3xl transition-opacity duration-500 ${
          isSpeaking ? 'bg-cyan-400/30 opacity-100' : 'bg-violet-400/20 opacity-70'
        }`}
      />

      <Canvas camera={{ position: [0, 0, 4], fov: 55 }}>
        <ambientLight intensity={0.55} />
        <pointLight position={[3, 3, 5]} intensity={1.2} color="#7dd3fc" />
        <pointLight position={[-4, -2, -2]} intensity={0.95} color="#8b5cf6" />
        <Stars radius={60} depth={45} count={3000} factor={3} saturation={0} fade speed={1.2} />
        <NeuralCore isSpeaking={isSpeaking} />
      </Canvas>
    </div>
  );
}
