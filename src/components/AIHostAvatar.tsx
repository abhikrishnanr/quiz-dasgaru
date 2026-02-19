'use client';

import React, { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles, Stars } from '@react-three/drei';
import * as THREE from 'three';

type AIHostAvatarProps = {
  isSpeaking?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
};

const whiteGlowMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#ffffff'),
  emissive: new THREE.Color('#ffffff'),
  emissiveIntensity: 4,
  toneMapped: false,
  roughness: 0,
  metalness: 0,
});

function WhiteCore({ isSpeaking }: { isSpeaking: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current || !glowRef.current) return;

    const time = state.clock.getElapsedTime();
    const material = meshRef.current.material as THREE.MeshStandardMaterial;

    const pulse = isSpeaking
      ? Math.sin(time * 20) * 0.1 + Math.cos(time * 40) * 0.05
      : Math.sin(time * 1.5) * 0.02;

    material.emissiveIntensity = isSpeaking ? 4 + Math.sin(time * 25) * 2 : 3 + Math.sin(time * 2);

    const scale = 1 + pulse;
    meshRef.current.scale.setScalar(scale);
    glowRef.current.scale.setScalar(scale * 1.6);
    glowRef.current.rotation.z -= 0.02;
    glowRef.current.rotation.x += 0.02;
  });

  return (
    <group>
      <mesh ref={meshRef} material={whiteGlowMaterial}>
        <icosahedronGeometry args={[0.35, 8]} />
      </mesh>

      <mesh ref={glowRef}>
        <icosahedronGeometry args={[0.45, 4]} />
        <meshBasicMaterial
          color="#60a5fa"
          transparent
          opacity={0.2}
          wireframe
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <pointLight distance={10} decay={2} intensity={5} color="#ffffff" />
      <pointLight distance={15} decay={2} intensity={3} color="#3b82f6" />
    </group>
  );
}

function DigitalNebula() {
  const points = useRef<THREE.Points>(null);

  const [positions, colors] = useMemo(() => {
    const count = 4000;
    const pos = new Float32Array(count * 3);
    const cols = new Float32Array(count * 3);

    const color1 = new THREE.Color('#3b82f6');
    const color2 = new THREE.Color('#ffffff');
    const color3 = new THREE.Color('#06b6d4');

    for (let i = 0; i < count; i++) {
      const r = 1 + Math.pow(Math.random(), 2) * 2.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      const rand = Math.random();
      const mixed = rand > 0.7 ? color2 : rand > 0.4 ? color3 : color1;
      cols[i * 3] = mixed.r;
      cols[i * 3 + 1] = mixed.g;
      cols[i * 3 + 2] = mixed.b;
    }

    return [pos, cols];
  }, []);

  useFrame((state) => {
    if (!points.current) return;
    const t = state.clock.elapsedTime * 0.1;
    points.current.rotation.y = t;
    points.current.rotation.z = t * 0.5;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={colors.length / 3} array={colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        vertexColors
        transparent
        opacity={0.5}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

function DashRing({
  radius,
  count,
  width,
  height,
  speed,
  color = '#60a5fa',
  opacity = 0.5,
}: {
  radius: number;
  count: number;
  width: number;
  height: number;
  speed: number;
  color?: string;
  opacity?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.z += speed * delta;
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(angle) * radius, Math.sin(angle) * radius, 0]} rotation={[0, 0, angle]}>
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial
              color={color}
              side={THREE.DoubleSide}
              transparent
              opacity={opacity}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function DotRing({
  radius,
  count,
  speed,
  size,
  color = '#60a5fa',
}: {
  radius: number;
  count: number;
  speed: number;
  size: number;
  color?: string;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.z += speed * delta;
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(angle) * radius, Math.sin(angle) * radius, 0]}>
            <circleGeometry args={[size, 8]} />
            <meshBasicMaterial color={color} transparent opacity={0.8} blending={THREE.AdditiveBlending} />
          </mesh>
        );
      })}
    </group>
  );
}

function ComplexOuterRig({ isSpeaking }: { isSpeaking: boolean }) {
  const rigRef = useRef<THREE.Group>(null);

  const cPrimary = isSpeaking ? '#3b82f6' : '#475569';
  const cSecondary = isSpeaking ? '#93c5fd' : '#64748b';
  const cAccent = isSpeaking ? '#2563eb' : '#334155';
  const cDot = isSpeaking ? '#60a5fa' : '#475569';
  const cWhite = isSpeaking ? '#ffffff' : '#94a3b8';

  useFrame((state) => {
    if (!rigRef.current) return;
    const t = state.clock.elapsedTime * 0.02;
    rigRef.current.rotation.x = Math.sin(t * 0.5) * 0.1;
    rigRef.current.rotation.y = Math.cos(t * 0.3) * 0.15;
  });

  return (
    <group ref={rigRef}>
      <mesh>
        <torusGeometry args={[2.5, 0.02, 16, 100]} />
        <meshBasicMaterial color={cPrimary} transparent opacity={0.3} blending={THREE.AdditiveBlending} />
      </mesh>

      <DashRing radius={1.8} count={32} width={0.05} height={0.3} speed={0.05} color={cSecondary} opacity={0.6} />
      <DashRing radius={2.8} count={80} width={0.02} height={0.15} speed={-0.02} color={cAccent} opacity={0.4} />
      <DotRing radius={2.2} count={16} speed={-0.08} size={0.06} color={cDot} />
      <DotRing radius={1.2} count={8} speed={0.15} size={0.04} color={cDot} />

      <group rotation={[0.4, 0.4, 0]}>
        <mesh>
          <torusGeometry args={[3.2, 0.01, 16, 100]} />
          <meshBasicMaterial color={cDot} transparent opacity={0.2} blending={THREE.AdditiveBlending} />
        </mesh>
        <DotRing radius={3.2} count={4} speed={0.05} size={0.1} color={cDot} />
      </group>

      <group rotation={[-0.4, -0.4, 0]}>
        <mesh>
          <torusGeometry args={[3.0, 0.01, 16, 100]} />
          <meshBasicMaterial color={cSecondary} transparent opacity={0.2} blending={THREE.AdditiveBlending} />
        </mesh>
        <DashRing radius={3.0} count={12} width={0.05} height={0.4} speed={-0.03} color={cWhite} opacity={0.1} />
      </group>
    </group>
  );
}

function AmplitudeSpikes({ isSpeaking }: { isSpeaking: boolean }) {
  const bars = useRef<THREE.Mesh[]>([]);
  const count = 48;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    bars.current.forEach((bar, i) => {
      if (!bar) return;
      const targetScale = isSpeaking ? 0.2 + (Math.sin(t * 25 + i * 0.5) * 0.5 + 0.5) * 1.8 : 0.1;
      bar.scale.y += (targetScale - bar.scale.y) * 0.25;
    });
  });

  return (
    <group>
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2;
        return (
          <mesh
            key={i}
            ref={(el) => {
              if (el) bars.current[i] = el;
            }}
            position={[Math.cos(angle) * 0.8, Math.sin(angle) * 0.8, 0]}
            rotation={[0, 0, angle + Math.PI / 2]}
          >
            <boxGeometry args={[0.03, 0.3, 0.01]} />
            <meshBasicMaterial color="#93c5fd" transparent opacity={0.9} blending={THREE.AdditiveBlending} />
          </mesh>
        );
      })}
    </group>
  );
}

function Scene({ isSpeaking }: { isSpeaking: boolean }) {
  return (
    <>
      <ambientLight intensity={0.2} />
      <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.1}>
        <DigitalNebula />
        <WhiteCore isSpeaking={isSpeaking} />
        <AmplitudeSpikes isSpeaking={isSpeaking} />
        <ComplexOuterRig isSpeaking={isSpeaking} />
      </Float>
      <Sparkles count={60} scale={6} size={2} speed={0.4} opacity={0.6} color="#60a5fa" />
      <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
    </>
  );
}

export default function AIHostAvatar({ isSpeaking = false, size = 'md' }: AIHostAvatarProps) {
  const sizeMap = {
    sm: 'h-24 w-24',
    md: 'h-48 w-48',
    lg: 'h-80 w-80',
    xl: 'h-[600px] w-[600px]',
  };

  return (
    <div className={`relative mx-auto min-h-[300px] ${sizeMap[size]}`}>
      <div
        className={`pointer-events-none absolute inset-0 rounded-full blur-[80px] transition-colors duration-1000 ${
          isSpeaking ? 'animate-pulse bg-blue-500/10' : 'bg-slate-500/5'
        }`}
      />
      <Suspense
        fallback={
          <div className="flex h-full w-full items-center justify-center">
            <div className="h-8 w-8 animate-ping rounded-full bg-blue-400 opacity-40" />
          </div>
        }
      >
        <Canvas
          camera={{ position: [0, 0, 7], fov: 50 }}
          gl={{ antialias: true, alpha: true, toneMapping: THREE.NoToneMapping }}
        >
          <Scene isSpeaking={isSpeaking} />
        </Canvas>
      </Suspense>
    </div>
  );
}
