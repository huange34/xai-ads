"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

interface Point {
  x: number;
  y: number;
  z: number | null;
  index: number;
  is_new: boolean;
  username?: string;
  user_id?: string;
  profile_image_url?: string;
}

interface EmbeddingVisualizerProps {
  newEmbedding?: number[];
  newUserInfo?: { username: string; user_id: string; profile_image_url?: string };
  onClose?: () => void;
  highlightedNodeIndex?: number | null;
  similarNodeIndices?: number[];
  hideHeader?: boolean;
  onPointsUpdate?: (points: Point[]) => void;
  onAddNewPoint?: (embedding: number[], userInfo: { username: string; user_id: string }) => void;
  method?: "pca" | "tsne";
  onMethodChange?: (method: "pca" | "tsne") => void;
}

// Avatar node with profile image
function AvatarNode({
  position,
  profileImageUrl,
  isHovered,
  isHighlighted,
  isSimilar,
  onClick,
  animateIn = false,
  size = 0.15,
}: {
  position: [number, number, number];
  profileImageUrl: string;
  isHovered: boolean;
  isHighlighted?: boolean;
  isSimilar?: boolean;
  onClick: () => void;
  animateIn?: boolean;
  size?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const textureRef = useRef<THREE.Texture | null>(null);
  const animationProgressRef = useRef(0);
  const [textureLoaded, setTextureLoaded] = useState(false);

  // Load texture
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    // X API returns URLs like https://pbs.twimg.com/profile_images/..._normal.jpg
    // Replace _normal with _400x400 for better quality
    const imageUrl = profileImageUrl.replace('_normal', '_400x400');
    
    loader.load(
      imageUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        textureRef.current = texture;
        setTextureLoaded(true);
        if (materialRef.current) {
          materialRef.current.map = texture;
          materialRef.current.needsUpdate = true;
        }
      },
      undefined,
      (error) => {
        console.error("Failed to load avatar:", error);
        // Fallback: try original URL
        if (imageUrl !== profileImageUrl) {
          loader.load(
            profileImageUrl,
            (texture) => {
              texture.colorSpace = THREE.SRGBColorSpace;
              textureRef.current = texture;
              setTextureLoaded(true);
              if (materialRef.current) {
                materialRef.current.map = texture;
                materialRef.current.needsUpdate = true;
              }
            }
          );
        }
      }
    );
  }, [profileImageUrl]);

  let displaySize = size;
  if (isHighlighted) {
    displaySize = size * 1.3;
  } else if (isSimilar) {
    displaySize = size * 1.1;
  }

  useFrame((state, delta) => {
    if (meshRef.current) {
      // Animate in new nodes
      if (animateIn && animationProgressRef.current < 1) {
        animationProgressRef.current = Math.min(1, animationProgressRef.current + delta * 3);
        const scale = animationProgressRef.current;
        meshRef.current.scale.setScalar(scale);
        if (materialRef.current) {
          materialRef.current.opacity = animationProgressRef.current;
        }
      } else if (isHighlighted) {
        // Pulsing glow for highlighted node
        const scale = 1.2 + Math.sin(state.clock.elapsedTime * 4) * 0.2;
        meshRef.current.scale.setScalar(scale);
      } else if (isSimilar) {
        // Subtle pulse for similar nodes
        const scale = 1.05 + Math.sin(state.clock.elapsedTime * 2) * 0.05;
        meshRef.current.scale.setScalar(scale);
      } else if (!animateIn) {
        meshRef.current.scale.setScalar(1);
      }
    }
  });

  return (
    <group>
      <mesh
        ref={meshRef}
        position={position}
        onClick={onClick}
      >
        <sphereGeometry args={[displaySize, 32, 32]} />
        <meshStandardMaterial
          ref={materialRef}
          map={textureRef.current || null}
          emissive={isHighlighted ? "#00ffff" : isSimilar ? "#00ffaa" : "#00aacc"}
          emissiveIntensity={isHighlighted ? 0.5 : isSimilar ? 0.3 : 0.2}
          toneMapped={false}
          transparent={animateIn || !textureLoaded}
          opacity={animateIn ? animationProgressRef.current : textureLoaded ? 1 : 0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      {isHighlighted && (
        <mesh position={position}>
          <ringGeometry args={[displaySize * 1.5, displaySize * 1.8, 32]} />
          <meshStandardMaterial
            color="#00ffff"
            emissive="#00ffff"
            emissiveIntensity={1}
            side={THREE.DoubleSide}
            transparent
            opacity={0.6}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  );
}

// Individual glowing particle (fallback for nodes without avatars)
function GlowingParticle({
  position,
  isNew,
  isHovered,
  isHighlighted,
  isSimilar,
  onClick,
  animateIn = false,
}: {
  position: [number, number, number];
  isNew: boolean;
  isHovered: boolean;
  isHighlighted?: boolean;
  isSimilar?: boolean;
  onClick: () => void;
  animateIn?: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const animationProgressRef = useRef(0);
  
  let baseColor = isNew ? "#00ff88" : "#00aacc"; // Teal for graph nodes
  let emissiveIntensity = isNew ? 2 : 0.8;
  let size = isNew ? 0.25 : 0.12;
  
  if (isHighlighted) {
    baseColor = "#00ffff"; // Cyan for highlighted
    emissiveIntensity = 3;
    size = 0.2;
  } else if (isSimilar) {
    baseColor = "#00ffaa"; // Teal-green for similar
    emissiveIntensity = 1.5;
    size = 0.15;
  }
  
  const hoverColor = "#ffffff";
  
  useFrame((state, delta) => {
    if (meshRef.current) {
      // Animate in new nodes
      if (animateIn && animationProgressRef.current < 1) {
        animationProgressRef.current = Math.min(1, animationProgressRef.current + delta * 3);
        const scale = animationProgressRef.current;
        meshRef.current.scale.setScalar(scale);
        if (materialRef.current) {
          materialRef.current.opacity = animationProgressRef.current;
        }
      } else if (isHighlighted) {
        // Pulsing glow for highlighted node
        const scale = 1.2 + Math.sin(state.clock.elapsedTime * 4) * 0.2;
        meshRef.current.scale.setScalar(scale);
      } else if (isSimilar) {
        // Subtle pulse for similar nodes
        const scale = 1.05 + Math.sin(state.clock.elapsedTime * 2) * 0.05;
        meshRef.current.scale.setScalar(scale);
      } else if (isNew && !animateIn) {
        const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.3;
        meshRef.current.scale.setScalar(scale);
      } else if (!animateIn) {
        meshRef.current.scale.setScalar(1);
      }
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      onClick={onClick}
    >
      <sphereGeometry args={[size, 16, 16]} />
      <meshStandardMaterial
        ref={materialRef}
        color={isHovered ? hoverColor : baseColor}
        emissive={isHovered ? hoverColor : baseColor}
        emissiveIntensity={emissiveIntensity}
        toneMapped={false}
        transparent={animateIn}
        opacity={animateIn ? 0 : 1}
      />
      {isHighlighted && (
        <mesh>
          <ringGeometry args={[size * 1.5, size * 1.8, 32]} />
          <meshStandardMaterial
            color="#00ffff"
            emissive="#00ffff"
            emissiveIntensity={1}
            side={THREE.DoubleSide}
            transparent
            opacity={0.6}
            toneMapped={false}
          />
        </mesh>
      )}
    </mesh>
  );
}

// Instanced particles for better performance
function ParticleCloud({
  points,
  is3D,
  highlightedNodeIndex,
  similarNodeIndices,
  onHover,
}: {
  points: Point[];
  is3D: boolean;
  highlightedNodeIndex?: number | null;
  similarNodeIndices?: number[];
  onHover?: (index: number | null, point: Point | null) => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [avatarCache, setAvatarCache] = useState<Map<string, string>>(new Map());
  const fetchedUserIdsRef = useRef<Set<string>>(new Set());
  const { raycaster, pointer, camera } = useThree();
  
  const { regularPoints, newPoint } = useMemo(() => {
    const regular = points.filter((p) => !p.is_new);
    const newP = points.find((p) => p.is_new);
    return { regularPoints: regular, newPoint: newP };
  }, [points]);

  // Filter out highlighted and similar nodes from regular points for instanced rendering
  const highlightedSet = useMemo(() => {
    const set = new Set(similarNodeIndices || []);
    if (highlightedNodeIndex !== null && highlightedNodeIndex !== undefined) {
      set.add(highlightedNodeIndex);
    }
    return set;
  }, [highlightedNodeIndex, similarNodeIndices]);

  const regularPointsForInstancing = useMemo(() => {
    return regularPoints.filter((point) => {
      const pointIndex = points.findIndex(p => p === point);
      // Exclude highlighted/similar points (they render individually)
      // Exclude points with user_ids (they render individually)
      return !highlightedSet.has(pointIndex) && !point.user_id;
    });
  }, [regularPoints, highlightedSet, points]);

  // Fetch avatar for a specific user_id when hovering
  const fetchAvatarForUser = async (user_id: string) => {
    if (avatarCache.has(user_id) || fetchedUserIdsRef.current.has(user_id)) {
      return; // Already fetched or fetching
    }
    
    fetchedUserIdsRef.current.add(user_id);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    
    try {
      const response = await fetch(`${apiUrl}/users/${user_id}/avatar`);
      if (response.ok) {
        const data = await response.json();
        if (data.profile_image_url) {
          setAvatarCache(prev => {
            const newCache = new Map(prev);
            newCache.set(user_id, data.profile_image_url);
            return newCache;
          });
        }
      }
    } catch (err) {
      console.error(`Failed to fetch avatar for user ${user_id}:`, err);
      fetchedUserIdsRef.current.delete(user_id); // Allow retry on error
    }
  };

  // Raycast for hover detection - check all points (including avatar nodes)
  useFrame(() => {
    raycaster.setFromCamera(pointer, camera);
    
    // Check instanced mesh first
    let hoveredPointIndex: number | null = null;
    if (meshRef.current) {
      const intersects = raycaster.intersectObject(meshRef.current);
      if (intersects.length > 0) {
        const instanceId = intersects[0].instanceId;
        if (instanceId !== undefined && instanceId < regularPointsForInstancing.length) {
          const hoveredPoint = regularPointsForInstancing[instanceId];
          const originalIndex = points.findIndex(p => p === hoveredPoint);
          if (originalIndex !== -1) {
            hoveredPointIndex = originalIndex;
          }
        }
      }
    }
    
    // Also check individual avatar/particle nodes
    if (hoveredPointIndex === null) {
      // Raycast against all points with user_ids or special rendering
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        if (point.user_id || highlightedSet.has(i)) {
          // Create a temporary object for raycasting
          const tempPos = new THREE.Vector3(
            point.x,
            point.y,
            is3D && point.z !== null ? point.z : 0
          );
          const distance = raycaster.ray.distanceToPoint(tempPos);
          if (distance < 0.3) { // Within hover distance
            hoveredPointIndex = i;
            break;
          }
        }
      }
    }
    
    // Update hover state and fetch avatar if needed
    if (hoveredPointIndex !== null && hoveredPointIndex !== hoveredIndex) {
      setHoveredIndex(hoveredPointIndex);
      const hoveredPoint = points[hoveredPointIndex];
      onHover?.(hoveredPointIndex, hoveredPoint);
      
      // Fetch avatar if this point has a user_id and we don't have it yet
      if (hoveredPoint.user_id && !avatarCache.has(hoveredPoint.user_id)) {
        fetchAvatarForUser(hoveredPoint.user_id);
      }
    } else if (hoveredPointIndex === null && hoveredIndex !== null) {
      setHoveredIndex(null);
      onHover?.(null, null);
    }
  });

  // Set up instanced mesh positions and colors
  useEffect(() => {
    if (!meshRef.current) return;

    const tempObject = new THREE.Object3D();
    const color = new THREE.Color("#00aacc"); // Teal color

    regularPointsForInstancing.forEach((point, i) => {
      tempObject.position.set(
        point.x,
        point.y,
        is3D && point.z !== null ? point.z : 0
      );
      tempObject.updateMatrix();
      meshRef.current!.setMatrixAt(i, tempObject.matrix);
      meshRef.current!.setColorAt(i, color);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [regularPointsForInstancing, is3D]);

  return (
    <group>
      {/* Instanced mesh for regular points */}
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, regularPointsForInstancing.length]}
      >
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial
          vertexColors
          emissive="#00aacc"
          emissiveIntensity={0.8}
          toneMapped={false}
        />
      </instancedMesh>

      {/* Avatar nodes for all points with user_ids */}
      {points.map((point, i) => {
        if (!point.user_id) return null;
        
        const isHighlighted = i === highlightedNodeIndex;
        const isSimilar = similarNodeIndices?.includes(i) && !isHighlighted;
        const isNew = point.is_new;
        const isNewlyAdded = isNew && points.length > 0 && i === points.length - 1;
        const hasAvatar = point.profile_image_url || avatarCache.has(point.user_id);
        const avatarUrl = point.profile_image_url || avatarCache.get(point.user_id);
        
        // Render avatar node if we have a profile image, otherwise show placeholder
        if (hasAvatar && avatarUrl) {
          return (
            <AvatarNode
              key={`avatar-${i}-${point.user_id}`}
              position={[
                point.x,
                point.y,
                is3D && point.z !== null ? point.z : 0,
              ]}
              profileImageUrl={avatarUrl}
              isHovered={hoveredIndex === i}
              isHighlighted={isHighlighted}
              isSimilar={isSimilar}
              onClick={() => {}}
              animateIn={isNewlyAdded}
              size={isHighlighted ? 0.2 : isSimilar ? 0.15 : 0.12}
            />
          );
        }
        
        // Show placeholder particle while avatar loads
        return (
          <GlowingParticle
            key={`placeholder-${i}-${point.user_id}`}
            position={[
              point.x,
              point.y,
              is3D && point.z !== null ? point.z : 0,
            ]}
            isNew={isNew}
            isHovered={hoveredIndex === i}
            isHighlighted={isHighlighted}
            isSimilar={isSimilar}
            onClick={() => {}}
            animateIn={isNewlyAdded}
          />
        );
      })}

      {/* Special particles for highlighted, similar, and new nodes without user_ids */}
      {points.map((point, i) => {
        if (point.user_id) return null; // Already handled above
        
        const isHighlighted = i === highlightedNodeIndex;
        const isSimilar = similarNodeIndices?.includes(i) && !isHighlighted;
        const isNew = point.is_new;
        const isNewlyAdded = isNew && points.length > 0 && i === points.length - 1;
        
        if (isHighlighted || isSimilar || isNew) {
          return (
            <GlowingParticle
              key={`special-${i}-${isNew ? 'new' : 'existing'}`}
              position={[
                point.x,
                point.y,
                is3D && point.z !== null ? point.z : 0,
              ]}
              isNew={isNew && !isHighlighted}
              isHovered={hoveredIndex === i}
              isHighlighted={isHighlighted}
              isSimilar={isSimilar}
              onClick={() => {}}
              animateIn={isNewlyAdded}
            />
          );
        }
        return null;
      })}
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

// Camera controller with smooth transitions to highlighted node
function CameraController({ 
  is3D,
  targetNodeIndex,
  points,
}: { 
  is3D: boolean;
  targetNodeIndex?: number | null;
  points: Point[];
}) {
  const { camera } = useThree();
  const targetRef = useRef<THREE.Vector3 | null>(null);
  const isTransitioningRef = useRef(false);
  const transitionStartRef = useRef<THREE.Vector3 | null>(null);
  const transitionProgressRef = useRef(0);
  
  useEffect(() => {
    if (targetNodeIndex !== null && targetNodeIndex !== undefined && points[targetNodeIndex]) {
      const point = points[targetNodeIndex];
      targetRef.current = new THREE.Vector3(
        point.x,
        point.y,
        is3D && point.z !== null ? point.z : 0
      );
      transitionStartRef.current = camera.position.clone();
      transitionProgressRef.current = 0;
      isTransitioningRef.current = true;
    } else {
      targetRef.current = null;
      isTransitioningRef.current = false;
    }
  }, [targetNodeIndex, points, is3D, camera]);
  
  useEffect(() => {
    if (!targetRef.current && !isTransitioningRef.current) {
      if (is3D) {
        camera.position.set(20, 15, 20);
      } else {
        camera.position.set(0, 0, 25);
      }
      camera.lookAt(0, 0, 0);
    }
  }, [is3D, camera]);
  
  useFrame((state, delta) => {
    if (targetRef.current && isTransitioningRef.current && transitionStartRef.current) {
      transitionProgressRef.current += delta * 2;
      
      if (transitionProgressRef.current >= 1) {
        // Transition complete, stop interfering
        const targetPos = targetRef.current.clone();
        targetPos.add(new THREE.Vector3(0, 0, 15));
        camera.position.copy(targetPos);
        camera.lookAt(targetRef.current);
        isTransitioningRef.current = false;
      } else {
        // Smoothly interpolate
        const targetPos = targetRef.current.clone();
        targetPos.add(new THREE.Vector3(0, 0, 15));
        camera.position.lerpVectors(transitionStartRef.current, targetPos, transitionProgressRef.current);
        const lookAtTarget = targetRef.current.clone();
        lookAtTarget.lerp(new THREE.Vector3(0, 0, 0), 1 - transitionProgressRef.current);
        camera.lookAt(lookAtTarget);
      }
    }
  });

  return null;
}

// Main Scene
function Scene({
  points,
  is3D,
  highlightedNodeIndex,
  similarNodeIndices,
  onHover,
}: {
  points: Point[];
  is3D: boolean;
  highlightedNodeIndex?: number | null;
  similarNodeIndices?: number[];
  onHover?: (index: number | null, point: Point | null) => void;
}) {
  return (
    <>
      <CameraController 
        is3D={is3D} 
        targetNodeIndex={highlightedNodeIndex}
        points={points}
      />
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#00aacc" />
      
      <ParticleCloud 
        points={points} 
        is3D={is3D}
        highlightedNodeIndex={highlightedNodeIndex}
        similarNodeIndices={similarNodeIndices}
        onHover={onHover}
      />
      <Grid is3D={is3D} />
      
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
  newUserInfo,
  onClose,
  highlightedNodeIndex,
  similarNodeIndices,
  hideHeader = false,
  onPointsUpdate,
  onAddNewPoint,
  method: externalMethod,
  onMethodChange,
}: EmbeddingVisualizerProps) {
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [internalMethod, setInternalMethod] = useState<"pca" | "tsne">("pca");
  const method = externalMethod ?? internalMethod;
  const setMethod = (newMethod: "pca" | "tsne") => {
    if (onMethodChange) {
      onMethodChange(newMethod);
    } else {
      setInternalMethod(newMethod);
    }
  };
  const [dimensions, setDimensions] = useState<2 | 3>(3);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previousEmbedding, setPreviousEmbedding] = useState<number[] | undefined>(undefined);
  const [hoveredPoint, setHoveredPoint] = useState<{ index: number; point: Point } | null>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);

  // Handle new embedding dynamically without reload
  useEffect(() => {
    if (newEmbedding && newUserInfo && JSON.stringify(newEmbedding) !== JSON.stringify(previousEmbedding)) {
      if (points.length > 0) {
        // We have existing points, add the new one dynamically without showing loading
        fetchVisualizationData(newEmbedding, false, newUserInfo);
      } else {
        // No points yet, do initial load with new embedding
        fetchVisualizationData(newEmbedding, true, newUserInfo);
      }
      setPreviousEmbedding(newEmbedding);
    }
  }, [newEmbedding, newUserInfo]);

  const handleHover = (index: number | null, point: Point | null) => {
    if (index !== null && point) {
      setHoveredPoint({ index, point });
    } else {
      setHoveredPoint(null);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const fetchVisualizationData = async (includeNewEmbedding: number[] | null = null, isInitial = false, newUserInfo?: { username: string; user_id: string; profile_image_url?: string }) => {
    // Only show loading screen on initial load
    if (isInitial) {
      setIsProcessing(true);
      setLoading(true);
    }
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/visualize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          dimensions,
          include_new_embedding: includeNewEmbedding,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Failed to fetch visualization data");
      }

      const data = await response.json();
      
      if (isInitial) {
        // Initial load - set all points
        setPoints(data.points);
        onPointsUpdate?.(data.points);
      } else if (includeNewEmbedding && newUserInfo) {
        // Adding new point - find the new one and add it with animation
        const newPoint = data.points.find((p: Point) => p.is_new);
        if (newPoint) {
          // Remove is_new from existing points and add the new one with user info
          const existingPoints = points.map(p => ({ ...p, is_new: false }));
          const updatedPoints = [...existingPoints, { 
            ...newPoint, 
            is_new: true,
            username: newUserInfo.username,
            user_id: newUserInfo.user_id,
            profile_image_url: newUserInfo.profile_image_url
          }];
          setPoints(updatedPoints);
          // Notify parent that points have been updated
          onPointsUpdate?.(updatedPoints);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      if (isInitial) {
        setLoading(false);
        setIsProcessing(false);
      }
    }
  };

  // Initial load
  useEffect(() => {
    fetchVisualizationData(null, true);
  }, [method, dimensions]);

  // Handle new embedding dynamically - this is handled by parent component now

  const newPointCount = points.filter((p) => p.is_new).length;
  const regularPointCount = points.length - newPointCount;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      {!hideHeader && (
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

        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
          >
            Close
          </button>
        )}
      </div>
      )}

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
                onClick={() => fetchVisualizationData(null, true)}
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
            <Scene 
              points={points} 
              is3D={dimensions === 3}
              highlightedNodeIndex={highlightedNodeIndex}
              similarNodeIndices={similarNodeIndices}
              onHover={handleHover}
            />
          </Canvas>
        )}

        {/* Legend */}
        {!hideHeader && (
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
        )}

        {/* Hover Tooltip */}
        {hoveredPoint && mousePosition && (
          <div
            className="absolute pointer-events-none z-50 bg-black/80 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-2 text-sm text-white"
            style={{
              left: `${mousePosition.x + 10}px`,
              top: `${mousePosition.y - 10}px`,
              transform: 'translateY(-100%)',
            }}
          >
            <div className="font-semibold">
              {hoveredPoint.point.username ? `@${hoveredPoint.point.username}` : `Node ${hoveredPoint.index}`}
            </div>
            {hoveredPoint.point.user_id && (
              <div className="text-xs text-gray-400 mt-1">ID: {hoveredPoint.point.user_id}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
