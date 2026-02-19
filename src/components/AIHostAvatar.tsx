'use client';

import React, { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles, Stars } from '@react-three/drei';
import * as THREE from 'three';

export type AIHostAvatarProps = {
  isSpeaking?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl'; // kept for compatibility
};

// -- Materials --
const WhiteGlowMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#ffffff'),
  emissive: new THREE.Color('#ffffff'),
  emissiveIntensity: 4,
  toneMapped: false,
  roughness: 0,
  metalness: 0,
});

// -- Components --

const WhiteCore: React.FC<{ isSpeaking: boolean }> = ({ isSpeaking }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current || !glowRef.current) return;
    const time = state.clock.getElapsedTime();

    const baseScale = 1;
    let pulse = 0;

    if (isSpeaking) {
      pulse = Math.sin(time * 20) * 0.1 + Math.cos(time * 40) * 0.05;
      (meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 4 + Math.sin(time * 25) * 2;
    } else {
      pulse = Math.sin(time * 1.5) * 0.02;
      (meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 3 + Math.sin(time * 2) * 1;
    }

    const scale = baseScale + pulse;
    meshRef.current.scale.setScalar(scale);

    glowRef.current.scale.setScalar(scale * 1.6);
    glowRef.current.rotation.z -= 0.02;
    glowRef.current.rotation.x += 0.02;
  });

  return (
    <group>
      <mesh ref={meshRef} material={WhiteGlowMaterial}>
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
          depthWrite={false}
        />
      </mesh>

      <pointLight distance={10} decay={2} intensity={5} color="#ffffff" />
      <pointLight distance={15} decay={2} intensity={3} color="#3b82f6" />
    </group>
  );
};

const DigitalNebula: React.FC = () => {
  const points = useRef<THREE.Points>(null);

  const [positions, colors] = useMemo(() => {
    const count = 4000;
    const pos = new Float32Array(count * 3);
    const cols = new Float32Array(count * 3);
    const color1 = new THREE.Color('#3b82f6');
    const color2 = new THREE.Color('#ffffff');
    const color3 = new THREE.Color('#06b6d4');

    for (let i = 0; i < count; i++) {
      const r = 1.0 + Math.pow(Math.random(), 2) * 2.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      const rand = Math.random();
      const mixedColor = rand > 0.7 ? color2 : rand > 0.4 ? color3 : color1;

      cols[i * 3] = mixedColor.r;
      cols[i * 3 + 1] = mixedColor.g;
      cols[i * 3 + 2] = mixedColor.b;
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
};

const DashRing: React.FC<{
  radius: number;
  count: number;
  width: number;
  height: number;
  speed: number;
  color?: string;
  opacity?: number;
}> = ({ radius, count, width, height, speed, color, opacity = 0.5 }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.z += speed * delta;
  });

  const segments = useMemo(() => {
    const segs: React.ReactNode[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      segs.push(
        <mesh key={i} position={[Math.cos(angle) * radius, Math.sin(angle) * radius, 0]} rotation={[0, 0, angle]}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial
            color={color || '#60a5fa'}
            side={THREE.DoubleSide}
            transparent
            opacity={opacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>,
      );
    }
    return segs;
  }, [count, radius, width, height, color, opacity]);

  return <group ref={groupRef}>{segments}</group>;
};

const DotRing: React.FC<{ radius: number; count: number; speed: number; size: number; color?: string }> = ({
  radius,
  count,
  speed,
  size,
  color,
}) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.z += speed * delta;
  });

  const dots = useMemo(() => {
    const d: React.ReactNode[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      d.push(
        <mesh key={i} position={[Math.cos(angle) * radius, Math.sin(angle) * radius, 0]}>
          <circleGeometry args={[size, 8]} />
          <meshBasicMaterial
            color={color || '#60a5fa'}
            transparent
            opacity={0.8}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>,
      );
    }
    return d;
  }, [count, radius, size, color]);

  return <group ref={groupRef}>{dots}</group>;
};

const ComplexOuterRig: React.FC<{ isSpeaking: boolean }> = ({ isSpeaking }) => {
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
        <meshBasicMaterial color={cPrimary} transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      <DashRing radius={1.8} count={32} width={0.05} height={0.3} speed={0.05} color={cSecondary} opacity={0.6} />
      <DashRing radius={2.8} count={80} width={0.02} height={0.15} speed={-0.02} color={cAccent} opacity={0.4} />

      <DotRing radius={2.2} count={16} speed={-0.08} size={0.06} color={cDot} />
      <DotRing radius={1.2} count={8} speed={0.15} size={0.04} color={cDot} />

      <group rotation={[0.4, 0.4, 0]}>
        <mesh>
          <torusGeometry args={[3.2, 0.01, 16, 100]} />
          <meshBasicMaterial color={cDot} transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <DotRing radius={3.2} count={4} speed={0.05} size={0.1} color={cDot} />
      </group>

      <group rotation={[-0.4, -0.4, 0]}>
        <mesh>
          <torusGeometry args={[3.0, 0.01, 16, 100]} />
          <meshBasicMaterial
            color={cSecondary}
            transparent
            opacity={0.2}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <DashRing radius={3.0} count={12} width={0.05} height={0.4} speed={-0.03} color={cWhite} opacity={0.1} />
      </group>
    </group>
  );
};

const AmplitudeSpikes: React.FC<{ isSpeaking: boolean }> = ({ isSpeaking }) => {
  const count = 48;
  const radius = 0.8;
  const bars = useRef<THREE.Mesh[]>([]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    bars.current.forEach((bar, i) => {
      if (!bar) return;
      let targetScale = 0.1;
      if (isSpeaking) {
        const noise = Math.sin(t * 25 + i * 0.5) * 0.5 + 0.5;
        targetScale = 0.2 + noise * 1.8;
      }
      bar.scale.y += (targetScale - bar.scale.y) * 0.25;
    });
  });

  return (
    <group>
      {new Array(count).fill(0).map((_, i) => {
        const angle = (i / count) * Math.PI * 2;
        return (
          <mesh
            key={i}
            ref={(el) => {
              if (el) bars.current[i] = el;
            }}
            position={[Math.cos(angle) * radius, Math.sin(angle) * radius, 0]}
            rotation={[0, 0, angle + Math.PI / 2]}
          >
            <boxGeometry args={[0.03, 0.3, 0.01]} />
            <meshBasicMaterial
              color="#93c5fd"
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
};

const Scene: React.FC<{ isSpeaking: boolean }> = ({ isSpeaking }) => {
  return (
    <>
      {/* enforce background color inside the canvas */}
      <color attach="background" args={['#071027']} />
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
};

function PingLoader() {
  return (
    <div className="grid h-full w-full place-items-center bg-[#071027]">
      <div className="relative">
        <span className="absolute inset-0 rounded-full bg-blue-400/30 blur-md" />
        <span className="relative block h-4 w-4 animate-ping rounded-full bg-blue-400" />
        <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-200" />
      </div>
    </div>
  );
}

export default function AIHostAvatar({ isSpeaking = false }: AIHostAvatarProps) {
  return (
    <div className="w-full h-full bg-[#071027]">
      <Suspense fallback={<PingLoader />}>
        <Canvas
          className="w-full h-full"
          camera={{ position: [0, 0, 7], fov: 55 }}
          gl={{ antialias: true, alpha: false, toneMapping: THREE.NoToneMapping }}
        >
          <Scene isSpeaking={isSpeaking} />
        </Canvas>
      </Suspense>
    </div>
  );
}
