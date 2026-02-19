// components/AIHostAvatar.tsx
'use client';

import React, { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles, Stars } from '@react-three/drei';
import * as THREE from 'three';

export type AIHostAvatarProps = {
  isSpeaking?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
};

type Palette = {
  primary: string;
  secondary: string;
  accent: string;
  dot: string;
  white: string;
};

const SPEAKING: Palette = {
  primary: '#3b82f6',
  secondary: '#93c5fd',
  accent: '#2563eb',
  dot: '#60a5fa',
  white: '#ffffff',
};

const SILENT: Palette = {
  primary: '#475569',
  secondary: '#64748b',
  accent: '#334155',
  dot: '#475569',
  white: '#94a3b8',
};

const sizeMap: Record<NonNullable<AIHostAvatarProps['size']>, string> = {
  sm: 'h-24 w-24',
  md: 'h-48 w-48',
  lg: 'h-80 w-80',
  xl: 'h-[600px] w-[600px]',
};

function PingLoader() {
  return (
    <div className="grid h-full w-full place-items-center">
      <div className="relative">
        <span className="absolute inset-0 rounded-full bg-blue-400/30 blur-md" />
        <span className="relative block h-4 w-4 animate-ping rounded-full bg-blue-400" />
        <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-200" />
      </div>
    </div>
  );
}

function WhiteCore({ isSpeaking, palette }: { isSpeaking: boolean; palette: Palette }) {
  const coreRef = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    const pulse = isSpeaking
      ? Math.sin(t * 6) * 0.08 + Math.cos(t * 12) * 0.03
      : Math.sin(t * 1.2) * 0.02;

    const emissiveIntensity = isSpeaking ? 4.4 + Math.sin(t * 8) * 1.2 : 3 + Math.sin(t * 2) * 0.7;

    const coreScale = 1 + pulse;
    const shellScale = coreScale * 1.6;

    if (coreRef.current) {
      coreRef.current.scale.setScalar(coreScale);
      const mat = coreRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = emissiveIntensity;
      mat.color.set(palette.white);
      mat.emissive.set(palette.white);
    }

    if (shellRef.current) {
      shellRef.current.scale.setScalar(shellScale);
      shellRef.current.rotation.x += 0.004;
      shellRef.current.rotation.z += 0.006;
    }
  });

  return (
    <group>
      {/* Bright white emissive icosahedron */}
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[0.35, 8]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={3.5}
          roughness={0}
          metalness={0}
          toneMapped={false}
        />
      </mesh>

      {/* Wireframe shell */}
      <mesh ref={shellRef}>
        <icosahedronGeometry args={[0.45, 4]} />
        <meshBasicMaterial
          color={palette.dot}
          transparent
          opacity={0.2}
          wireframe
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function DigitalNebula({ isSpeaking, palette }: { isSpeaking: boolean; palette: Palette }) {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, colors } = useMemo(() => {
    const count = 4000;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    const cWhite = new THREE.Color('#ffffff');
    const cCyan = new THREE.Color('#06b6d4');
    const cBlue = new THREE.Color('#3b82f6');

    for (let i = 0; i < count; i++) {
      const r = 1.0 + Math.pow(Math.random(), 2) * 2.5;
      const theta = Math.random() * Math.PI * 2;
      const u = Math.random() * 2 - 1;
      const phi = Math.acos(THREE.MathUtils.clamp(u, -1, 1));

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      const idx = i * 3;
      pos[idx] = x;
      pos[idx + 1] = y;
      pos[idx + 2] = z;

      // Color mix probabilities:
      // white 30%, cyan 30%, blue 40%
      const p = Math.random();
      const color = p < 0.3 ? cWhite : p < 0.6 ? cCyan : cBlue;

      col[idx] = color.r;
      col[idx + 1] = color.g;
      col[idx + 2] = color.b;
    }

    return { positions: pos, colors: col };
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (!pointsRef.current) return;

    pointsRef.current.rotation.y = t * 0.1;
    pointsRef.current.rotation.z = t * 0.05;

    // subtle “breathing” on speaking for extra life (kept minimal)
    const s = isSpeaking ? 1 + Math.sin(t * 6) * 0.01 : 1;
    pointsRef.current.scale.setScalar(s);
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
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
  segments,
  plane,
  speed,
  color,
  opacity,
}: {
  radius: number;
  segments: number;
  plane: [number, number];
  speed: number;
  color: string;
  opacity: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  const items = useMemo(() => {
    return Array.from({ length: segments }, (_, i) => {
      const a = (i / segments) * Math.PI * 2;
      const x = Math.cos(a) * radius;
      const z = Math.sin(a) * radius;
      const rotY = -a;
      return { i, x, z, rotY };
    });
  }, [radius, segments]);

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += speed;
  });

  return (
    <group ref={groupRef}>
      {items.map(({ i, x, z, rotY }) => (
        <mesh key={i} position={[x, 0, z]} rotation={[0, rotY, 0]}>
          <planeGeometry args={plane} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={opacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

function DotRing({
  radius,
  count,
  speed,
  dotSize,
  color,
  opacity,
}: {
  radius: number;
  count: number;
  speed: number;
  dotSize: number;
  color: string;
  opacity: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  const items = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2;
      const x = Math.cos(a) * radius;
      const z = Math.sin(a) * radius;
      return { i, x, z };
    });
  }, [radius, count]);

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += speed;
  });

  return (
    <group ref={groupRef}>
      {items.map(({ i, x, z }) => (
        <mesh key={i} position={[x, 0, z]}>
          <sphereGeometry args={[dotSize, 12, 12]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={opacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function ComplexOuterRig({ palette }: { palette: Palette }) {
  const rigRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!rigRef.current) return;

    // where t = elapsedTime * 0.02
    const t = clock.getElapsedTime() * 0.02;
    rigRef.current.position.x = Math.sin(t * 0.5) * 0.1;
    rigRef.current.position.y = Math.cos(t * 0.3) * 0.15;
  });

  return (
    <group ref={rigRef}>
      {/* Main torus ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.5, 0.02, 18, 240]} />
        <meshBasicMaterial
          color={palette.primary}
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Dash rings */}
      <DashRing radius={1.8} segments={32} plane={[0.05, 0.3]} speed={+0.012} color={palette.secondary} opacity={0.55} />
      <DashRing radius={2.8} segments={80} plane={[0.02, 0.15]} speed={-0.008} color={palette.dot} opacity={0.45} />

      {/* Dot rings */}
      <DotRing radius={2.2} count={16} speed={-0.01} dotSize={0.06} color={palette.primary} opacity={0.7} />
      <DotRing radius={1.2} count={8} speed={+0.02} dotSize={0.04} color={palette.secondary} opacity={0.8} />

      {/* Orbital ring group A */}
      <group rotation={[0.4, 0.4, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[3.2, 0.015, 16, 200]} />
          <meshBasicMaterial
            color={palette.accent}
            transparent
            opacity={0.25}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <DotRing radius={3.2} count={4} speed={+0.008} dotSize={0.06} color={palette.white} opacity={0.45} />
      </group>

      {/* Orbital ring group B */}
      <group rotation={[-0.4, -0.4, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[3.0, 0.013, 16, 200]} />
          <meshBasicMaterial
            color={palette.dot}
            transparent
            opacity={0.22}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <DashRing radius={3.0} segments={12} plane={[0.06, 0.22]} speed={-0.006} color={palette.secondary} opacity={0.35} />
      </group>
    </group>
  );
}

function AmplitudeSpikes({ isSpeaking, palette }: { isSpeaking: boolean; palette: Palette }) {
  const groupRef = useRef<THREE.Group>(null);

  const bars = useMemo(() => Array.from({ length: 48 }, (_, i) => i), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (!groupRef.current) return;

    const children = groupRef.current.children as THREE.Mesh[];
    for (let i = 0; i < children.length; i++) {
      const m = children[i];
      const target = isSpeaking ? 0.2 + ((Math.sin(t * 25 + i * 0.5) * 0.5 + 0.5) * 1.8) : 0.1;
      m.scale.y += (target - m.scale.y) * 0.25;
    }
  });

  return (
    <group ref={groupRef}>
      {bars.map((i) => {
        const a = (i / bars.length) * Math.PI * 2;
        const r = 0.8;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;

        return (
          <mesh key={i} position={[x, 0, z]} rotation={[0, -a, 0]} scale={[1, 0.1, 1]}>
            <boxGeometry args={[0.03, 0.3, 0.01]} />
            <meshBasicMaterial
              color={palette.secondary}
              transparent
              opacity={0.9}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function Scene({ isSpeaking }: { isSpeaking: boolean }) {
  const palette = isSpeaking ? SPEAKING : SILENT;

  return (
    <>
      {/* Atmosphere */}
      <ambientLight intensity={0.2} />

      {/* Two point lights as required */}
      <pointLight color="#ffffff" intensity={5} distance={10} decay={2} position={[0, 0.6, 2]} />
      <pointLight color="#3b82f6" intensity={3} distance={15} decay={2} position={[-2.2, 1.4, 3.5]} />

      <Stars radius={100} depth={50} count={2000} factor={4} fade speed={1} />

      <Sparkles count={60} scale={6} size={2} speed={0.4} opacity={0.6} color="#60a5fa" />

      <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.1}>
        <group>
          <DigitalNebula isSpeaking={isSpeaking} palette={palette} />
          <ComplexOuterRig palette={palette} />
          <AmplitudeSpikes isSpeaking={isSpeaking} palette={palette} />
          <WhiteCore isSpeaking={isSpeaking} palette={palette} />
        </group>
      </Float>
    </>
  );
}

export default function AIHostAvatar({ isSpeaking = false, size = 'lg' }: AIHostAvatarProps) {
  const box = sizeMap[size] ?? sizeMap.lg;

  return (
    <div className="relative">
      {/* Soft outer glow behind canvas */}
      <div
        aria-hidden
        className={[
          'pointer-events-none absolute -inset-6 rounded-[2.25rem] blur-[80px]',
          isSpeaking ? 'bg-blue-500/10 animate-pulse' : 'bg-slate-500/5',
        ].join(' ')}
      />

      <div
        className={[
          'relative overflow-hidden rounded-3xl border',
          isSpeaking ? 'border-blue-400/25' : 'border-slate-400/15',
          'bg-slate-950/60 shadow-[0_0_60px_rgba(59,130,246,0.18)]',
          box,
        ].join(' ')}
        style={{ minHeight: 300 }}
      >
        <Suspense fallback={<PingLoader />}>
          <Canvas
            camera={{ position: [0, 0, 7], fov: 50 }}
            gl={{
              antialias: true,
              alpha: true,
              toneMapping: THREE.NoToneMapping,
            }}
          >
            <Scene isSpeaking={isSpeaking} />
          </Canvas>
        </Suspense>

        {/* Small HUD label */}
        <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-blue-300/15 bg-slate-950/40 px-3 py-1 text-xs text-slate-200/80 backdrop-blur">
          AI Host Core
          <span className={['ml-2 inline-block h-2 w-2 rounded-full', isSpeaking ? 'bg-blue-400' : 'bg-slate-500'].join(' ')} />
        </div>
      </div>
    </div>
  );
}
