"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Float, Line } from "@react-three/drei";
import * as THREE from "three";
import { clusters, projects, type Cluster } from "@/data/resume";

const COLORS = { cyan: "#5eead4", violet: "#a78bfa", amber: "#fbbf24" } as const;

type Props = {
  selected: number | null;
  hovered: number | null;
  onSelect: (i: number) => void;
  onHover: (i: number | null) => void;
  active: boolean;
};

/* ---------- Glow halo (additive radial gradient on a camera-facing quad) ---------- */
const haloVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const haloFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = pow(max(0.0, 1.0 - d), 2.6) * uIntensity;
    gl_FragColor = vec4(uColor, a);
  }
`;

function Halo({ color, intensity }: { color: string; intensity: number }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: haloVertex,
        fragmentShader: haloFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color(color) }, uIntensity: { value: intensity } },
      }),
    [color] // eslint-disable-line react-hooks/exhaustive-deps
  );
  useFrame((_, dt) => {
    mat.uniforms.uIntensity.value = THREE.MathUtils.damp(mat.uniforms.uIntensity.value, intensity, 6, dt);
  });
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <Billboard>
      <mesh material={mat}>
        <planeGeometry args={[2.6, 2.6]} />
      </mesh>
    </Billboard>
  );
}

/* ---------- One project "star" ---------- */
function ProjectNode({
  index,
  isSelected,
  isHovered,
  dimmed,
  onSelect,
  onHover,
  nodeRef,
}: {
  index: number;
  isSelected: boolean;
  isHovered: boolean;
  dimmed: boolean;
  onSelect: (i: number) => void;
  onHover: (i: number | null) => void;
  nodeRef: (o: THREE.Object3D | null) => void;
}) {
  const p = projects[index];
  const color = COLORS[p.accent];
  const core = useRef<THREE.Group>(null);
  const shell = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const focus = isSelected || isHovered;

  useFrame((state, dt) => {
    const s = focus ? 1.35 : 1;
    if (core.current) {
      const cur = core.current.scale.x;
      core.current.scale.setScalar(THREE.MathUtils.damp(cur, s, 8, dt));
    }
    if (shell.current) {
      shell.current.rotation.y += dt * 0.4;
      shell.current.rotation.x += dt * 0.15;
    }
    if (ring.current) {
      ring.current.rotation.z = state.clock.elapsedTime * 0.8;
      const rs = ring.current.scale.x;
      ring.current.scale.setScalar(THREE.MathUtils.damp(rs, isSelected ? 1 : 0.001, 8, dt));
    }
  });

  return (
    <group position={p.position}>
      <Float speed={1.4} floatIntensity={0.35} rotationIntensity={0}>
        <group ref={nodeRef}>
          <group ref={core}>
            <mesh>
              <icosahedronGeometry args={[0.3, 3]} />
              <meshBasicMaterial color={color} transparent opacity={dimmed ? 0.35 : 1} />
            </mesh>
            <mesh ref={shell}>
              <icosahedronGeometry args={[0.52, 1]} />
              <meshBasicMaterial color={color} wireframe transparent opacity={dimmed ? 0.08 : 0.28} />
            </mesh>
          </group>
          <Halo color={color} intensity={dimmed ? 0.25 : focus ? 1.1 : 0.7} />
          <Billboard>
            <mesh ref={ring} scale={0.001}>
              <torusGeometry args={[0.85, 0.012, 8, 96, Math.PI * 1.6]} />
              <meshBasicMaterial color={color} transparent opacity={0.9} />
            </mesh>
          </Billboard>

          {/* Generous invisible hit area — easy to tap on phones */}
          <mesh
            onClick={(e) => {
              e.stopPropagation();
              onSelect(index);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              onHover(index);
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              onHover(null);
              document.body.style.cursor = "";
            }}
          >
            <sphereGeometry args={[0.8, 12, 12]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>

        </group>
      </Float>
    </group>
  );
}

/* ---------- Edges between projects that share tools or a cluster ---------- */
function useEdges() {
  return useMemo(() => {
    const edges: { a: number; b: number; strength: number }[] = [];
    for (let i = 0; i < projects.length; i++) {
      for (let j = i + 1; j < projects.length; j++) {
        const shared = projects[i].stack.filter((s) => projects[j].stack.includes(s)).length;
        const same = projects[i].cluster === projects[j].cluster ? 1 : 0;
        if (shared + same > 0) edges.push({ a: i, b: j, strength: shared + same });
      }
    }
    return edges;
  }, []);
}

/* ---------- Background dust: the "embedding space" ---------- */
function Dust() {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const n = 1400;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 3 + Math.random() * 11;
      const t = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(ph) * Math.cos(t);
      arr[i * 3 + 1] = r * Math.sin(ph) * Math.sin(t) * 0.6;
      arr[i * 3 + 2] = r * Math.cos(ph);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.01;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial size={0.035} color="#9aa3c7" transparent opacity={0.55} sizeAttenuation depthWrite={false} />
    </points>
  );
}

/* ---------- Scene + camera choreography ---------- */
type LabelRefs = { nodes: (HTMLDivElement | null)[]; clusters: (HTMLDivElement | null)[] };
const CLUSTER_KEYS = Object.keys(clusters) as Cluster[];

function Scene({ selected, hovered, onSelect, onHover, labels }: Omit<Props, "active"> & { labels: LabelRefs }) {
  const group = useRef<THREE.Group>(null);
  const nodes = useRef<(THREE.Object3D | null)[]>([]);
  const { camera, size } = useThree();
  const look = useRef(new THREE.Vector3());
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const desiredPos = useMemo(() => new THREE.Vector3(), []);
  const desiredLook = useMemo(() => new THREE.Vector3(), []);
  const pointer = useRef({ x: 0, y: 0 });
  const edges = useEdges();
  const focusIdx = selected ?? hovered;

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((state, dt) => {
    const wide = size.width >= 768;
    const aspect = size.width / size.height;
    const g = group.current;

    if (g && selected === null) {
      // Gentle sway + parallax while browsing
      const t = state.clock.elapsedTime;
      g.rotation.y = THREE.MathUtils.damp(g.rotation.y, Math.sin(t * 0.12) * 0.35 + pointer.current.x * 0.15, 2, dt);
      g.rotation.x = THREE.MathUtils.damp(g.rotation.x, pointer.current.y * 0.08, 2, dt);
    }

    if (selected !== null && nodes.current[selected]) {
      if (wide) {
        // Panel sits on the right: frame the star in the left half
        nodes.current[selected]!.getWorldPosition(desiredLook);
        desiredLook.x += 2.4;
        desiredPos.copy(desiredLook).add(tmp.set(0, 0.6, 8.5));
      } else {
        // Panel is a bottom sheet: frame the star in the top half
        nodes.current[selected]!.getWorldPosition(desiredLook);
        // Distance chosen so ~7 world units fit across a portrait frame
        const dist = Math.max(9, 3.5 / (Math.tan(THREE.MathUtils.degToRad(22.5)) * aspect));
        desiredLook.y -= dist * 0.2;
        desiredPos.copy(desiredLook).add(tmp.set(0, 0.4, dist));
      }
    } else {
      const z = Math.max(14, 6.8 / (Math.tan(THREE.MathUtils.degToRad(22.5)) * aspect));
      desiredPos.set(0, 0.8, z);
      desiredLook.set(0, -0.2, 0);
    }

    const k = 1 - Math.exp(-3 * dt);
    camera.position.lerp(desiredPos, k);
    look.current.lerp(desiredLook, k);
    camera.lookAt(look.current);

    // Project label anchors to screen space and move the DOM labels (one shared layer)
    const place = (el: HTMLDivElement | null, world: THREE.Vector3) => {
      if (!el) return;
      world.project(camera);
      const hidden = world.z > 1;
      const x = (world.x * 0.5 + 0.5) * size.width;
      const y = (-world.y * 0.5 + 0.5) * size.height;
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      el.style.visibility = hidden ? "hidden" : "visible";
    };
    nodes.current.forEach((n, i) => {
      if (!n) return;
      n.getWorldPosition(tmp);
      tmp.y -= 0.95;
      place(labels.nodes[i], tmp);
    });
    CLUSTER_KEYS.forEach((c, i) => {
      const ctr = clusters[c].center;
      tmp.set(ctr[0], ctr[1] + 2.7, ctr[2]);
      g?.localToWorld(tmp);
      place(labels.clusters[i], tmp);
    });
  });

  return (
    <>
      <Dust />
      <group ref={group}>
        {edges.map(({ a, b, strength }) => {
          const lit = focusIdx !== null && (a === focusIdx || b === focusIdx);
          const ca = COLORS[projects[a].accent];
          return (
            <Line
              key={`${a}-${b}`}
              points={[projects[a].position, projects[b].position]}
              color={lit ? ca : "#6b7394"}
              lineWidth={lit ? 1.6 : 0.6 + strength * 0.2}
              transparent
              opacity={lit ? 0.85 : focusIdx !== null ? 0.08 : 0.22}
              dashed={!lit}
              dashSize={0.15}
              gapSize={0.12}
            />
          );
        })}


        {projects.map((p, i) => (
          <ProjectNode
            key={p.title}
            index={i}
            isSelected={selected === i}
            isHovered={hovered === i}
            dimmed={selected !== null && selected !== i}
            onSelect={onSelect}
            onHover={onHover}
            nodeRef={(o) => (nodes.current[i] = o)}
          />
        ))}
      </group>
    </>
  );
}

export default function GalaxyCanvas({ active, ...props }: Props) {
  const labels = useRef<LabelRefs>({ nodes: [], clusters: [] });
  const { selected } = props;
  return (
    <div className="absolute inset-0">
    <Canvas
      frameloop={active ? "always" : "never"}
      camera={{ position: [0, 0.8, 14], fov: 45 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={() => props.onHover(null)}
    >
      <Scene {...props} labels={labels.current} />
    </Canvas>

      {/* Labels: plain DOM positioned every frame from the 3D scene */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {CLUSTER_KEYS.map((c, i) => (
          <div
            key={c}
            ref={(el) => {
              labels.current.clusters[i] = el;
            }}
            className="invisible absolute left-0 top-0 whitespace-nowrap rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] transition-opacity duration-500 will-change-transform"
            style={{
              color: COLORS[clusters[c].accent],
              borderColor: `${COLORS[clusters[c].accent]}40`,
              opacity: selected !== null ? 0 : 0.85,
            }}
          >
            {c}
          </div>
        ))}
        {projects.map((p, i) => (
          <div
            key={p.title}
            ref={(el) => {
              labels.current.nodes[i] = el;
            }}
            className="invisible absolute left-0 top-0 whitespace-nowrap text-center transition-opacity duration-300 will-change-transform"
            style={{ opacity: selected !== null && selected !== i ? 0.3 : 1 }}
          >
            <div className="text-[13px] font-semibold text-fg">{p.title}</div>
            <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: COLORS[p.accent] }}>
              {p.kind}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
