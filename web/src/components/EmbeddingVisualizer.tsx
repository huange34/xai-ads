"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

interface Point {
  x: number;
  y: number;
  z: number | null;
  index: number;
  is_new: boolean;
}

interface EmbeddingVisualizerProps {
  newEmbedding?: number[];
  onClose: () => void;
}

// Individual glowing particle
function GlowingParticle({
  position,
  isNew,
  isHovered,
  onClick,
}: {
  position: [number, number, number];
  isNew: boolean;
  isHovered: boolean;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const baseColor = isNew ? "#00ff88" : "#4488ff";
  const hoverColor = "#ffffff";
  
  useFrame((state) => {
    if (meshRef.current) {
      // Pulse animation for new embedding
      if (isNew) {
        const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.3;
        meshRef.current.scale.setScalar(scale);
      }
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      onClick={onClick}
    >
      <sphereGeometry args={[isNew ? 0.25 : 0.12, 16, 16]} />
      <meshStandardMaterial
        color={isHovered ? hoverColor : baseColor}
        emissive={isHovered ? hoverColor : baseColor}
        emissiveIntensity={isNew ? 2 : 0.8}
        toneMapped={false}
      />
    </mesh>
  );
}

// Instanced particles for better performance
function ParticleCloud({
  points,
  is3D,
}: {
  points: Point[];
  is3D: boolean;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  const { regularPoints, newPoint } = useMemo(() => {
    const regular = points.filter((p) => !p.is_new);
    const newP = points.find((p) => p.is_new);
    return { regularPoints: regular, newPoint: newP };
  }, [points]);

  // Set up instanced mesh positions and colors
  useEffect(() => {
    if (!meshRef.current) return;

    const tempObject = new THREE.Object3D();
    const color = new THREE.Color();

    regularPoints.forEach((point, i) => {
      tempObject.position.set(
        point.x,
        point.y,
        is3D && point.z !== null ? point.z : 0
      );
      tempObject.updateMatrix();
      meshRef.current!.setMatrixAt(i, tempObject.matrix);

      // Color gradient based on position
      const hue = (point.x + 10) / 20; // Map x from [-10,10] to [0,1]
      color.setHSL(hue * 0.6 + 0.55, 0.8, 0.6);
      meshRef.current!.setColorAt(i, color);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [regularPoints, is3D]);

  return (
    <group>
      {/* Instanced mesh for regular points */}
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, regularPoints.length]}
      >
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshStandardMaterial
          vertexColors
          emissive="#4488ff"
          emissiveIntensity={0.5}
          toneMapped={false}
        />
      </instancedMesh>

      {/* Special particle for new embedding */}
      {newPoint && (
        <GlowingParticle
          position={[
            newPoint.x,
            newPoint.y,
            is3D && newPoint.z !== null ? newPoint.z : 0,
          ]}
          isNew={true}
          isHovered={false}
          onClick={() => {}}
        />
      )}
    </group>
  );
}

// Axis helper with labels
function AxisLabels({ is3D }: { is3D: boolean }) {
  return (
    <group>
      {/* X axis */}
      <Text position={[12, 0, 0]} fontSize={0.5} color="#ff4444">
        X
      </Text>
      {/* Y axis */}
      <Text position={[0, 12, 0]} fontSize={0.5} color="#44ff44">
        Y
      </Text>
      {/* Z axis (only in 3D) */}
      {is3D && (
        <Text position={[0, 0, 12]} fontSize={0.5} color="#4444ff">
          Z
        </Text>
      )}
    </group>
  );
}

// Grid floor
function Grid({ is3D }: { is3D: boolean }) {
  return (
    <gridHelper
      args={[24, 24, "#333333", "#222222"]}
      rotation={is3D ? [0, 0, 0] : [Math.PI / 2, 0, 0]}
      position={[0, is3D ? -10 : 0, 0]}
    />
  );
}

// Camera controller
function CameraController({ is3D }: { is3D: boolean }) {
  const { camera } = useThree();
  
  useEffect(() => {
    if (is3D) {
      camera.position.set(20, 15, 20);
    } else {
      camera.position.set(0, 0, 25);
    }
    camera.lookAt(0, 0, 0);
  }, [is3D, camera]);

  return null;
}

// Main Scene
function Scene({
  points,
  is3D,
}: {
  points: Point[];
  is3D: boolean;
}) {
  return (
    <>
      <CameraController is3D={is3D} />
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#4488ff" />
      
      <ParticleCloud points={points} is3D={is3D} />
      <Grid is3D={is3D} />
      <AxisLabels is3D={is3D} />
      
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        enablePan={true}
        enableZoom={true}
        minDistance={5}
        maxDistance={50}
      />
      
      {/* Bloom effect */}
      <EffectComposer>
        <Bloom
          intensity={1.5}
          luminanceThreshold={0.1}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

export default function EmbeddingVisualizer({
  newEmbedding,
  onClose,
}: EmbeddingVisualizerProps) {
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<"pca" | "tsne">("pca");
  const [dimensions, setDimensions] = useState<2 | 3>(3);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchVisualizationData = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/visualize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          dimensions,
          include_new_embedding: newEmbedding || null,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Failed to fetch visualization data");
      }

      const data = await response.json();
      setPoints(data.points);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    fetchVisualizationData();
  }, [method, dimensions]);

  const newPointCount = points.filter((p) => p.is_new).length;
  const regularPointCount = points.length - newPointCount;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-900/80 backdrop-blur border-b border-gray-800">
        <div className="flex items-center gap-6">
          <h2 className="text-xl font-bold text-white">
            Embedding Space Visualization
          </h2>
          
          {/* Method selector */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Method:</span>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as "pca" | "tsne")}
              disabled={isProcessing}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="pca">PCA</option>
              <option value="tsne">t-SNE</option>
            </select>
          </div>

          {/* Dimension selector */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Dimensions:</span>
            <select
              value={dimensions}
              onChange={(e) => setDimensions(Number(e.target.value) as 2 | 3)}
              disabled={isProcessing}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value={3}>3D</option>
              <option value={2}>2D</option>
            </select>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-400">
              <span className="text-blue-400 font-semibold">{regularPointCount}</span> existing users
            </span>
            {newPointCount > 0 && (
              <span className="text-gray-400">
                <span className="text-green-400 font-semibold">{newPointCount}</span> new user
              </span>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
        >
          Close
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        {loading || isProcessing ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-gray-400">
                {method === "tsne" ? "Computing t-SNE (this may take a moment)..." : "Loading visualization..."}
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-red-400">
              <p className="text-xl mb-2">Error</p>
              <p>{error}</p>
              <button
                onClick={fetchVisualizationData}
                className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <Canvas
            camera={{ position: [20, 15, 20], fov: 60 }}
            gl={{ antialias: true, alpha: true }}
          >
            <color attach="background" args={["#000000"]} />
            <fog attach="fog" args={["#000000", 30, 60]} />
            <Scene points={points} is3D={dimensions === 3} />
          </Canvas>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-gray-900/80 backdrop-blur rounded-lg p-4 text-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-gray-300">Existing users (408-dim → {dimensions}D)</span>
          </div>
          {newPointCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
              <span className="text-gray-300">Newly scraped user</span>
            </div>
          )}
          <div className="mt-3 text-gray-500 text-xs">
            Drag to rotate • Scroll to zoom • Shift+drag to pan
          </div>
        </div>
      </div>
    </div>
  );
}
