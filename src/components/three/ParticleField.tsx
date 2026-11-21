"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";
import { scrollState } from "@/lib/scrollState";
import { galaxy, neuralNet, noiseCloud, textPoints } from "./shapes";
import { onBooted } from "@/lib/boot";
import { profile } from "@/data/resume";

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uMorph;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uFit;
  uniform float uTextY;
  uniform float uNetX;
  uniform float uNetScale;
  uniform float uNetAlpha;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uMotion;
  uniform vec2 uMouse;

  attribute vec3 aText;
  attribute vec3 aNet;
  attribute vec3 aGalaxy;
  attribute vec2 aSignal;
  attribute float aRandom;

  varying vec3 vColor;
  varying float vAlpha;

  // Staggered 0..1 transition for morph stage k
  float stage(float m, float k) {
    return smoothstep(0.0, 1.0, clamp((m - k) * 1.6 - aRandom * 0.6, 0.0, 1.0));
  }

  mat2 rot(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
  }

  void main() {
    float s1 = stage(uMorph, 0.0); // noise  -> name
    float s2 = stage(uMorph, 1.0); // name   -> neural net
    float s3 = stage(uMorph, 2.0); // net    -> galaxy

    vec3 txt = aText * uFit + vec3(0.0, uTextY, 0.0);

    vec3 net = aNet * uFit * uNetScale;
    net.xz = rot(sin(uTime * 0.25) * 0.35) * net.xz;
    net.x += uNetX;

    vec3 gal = aGalaxy;
    gal.xz = rot(uTime * 0.035) * gal.xz;
    gal.yz = rot(-1.05) * gal.yz;
    gal.z -= 5.0;

    vec3 p = mix(position, txt, s1);

    // name -> network: particles spiral (around z) instead of fading through noise
    float w2 = sin(s2 * 3.14159);
    p = mix(p, net, s2);
    p.xy = rot(w2 * (0.9 + aRandom * 1.2)) * p.xy * (1.0 - 0.2 * w2);

    // network -> galaxy: a vortex that pulls inward and spins around y
    float w3 = sin(s3 * 3.14159);
    p = mix(p, gal, s3);
    vec3 vc = vec3(0.0, 0.0, -2.5);
    p -= vc;
    p.xz = rot(w3 * (2.0 + aRandom * 2.5)) * p.xz;
    p *= 1.0 - 0.3 * w3;
    p += vc;

    // Idle shimmer (stronger while still a cloud)
    float drift = uMotion * (0.035 + 0.25 * (1.0 - s1));
    p += drift * vec3(
      sin(uTime * 1.3 + aRandom * 40.0),
      cos(uTime * 1.1 + aRandom * 60.0),
      sin(uTime * 0.9 + aRandom * 80.0)
    );

    // Cursor repulsion
    vec2 dir = p.xy - uMouse;
    float d = length(dir);
    float push = (1.0 - smoothstep(0.0, 1.5, d)) * 0.85 * (1.0 - s3);
    p.xy += normalize(dir + 1e-4) * push;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    // Data pulses travelling along network edges
    float pulse = 0.0;
    if (aSignal.x >= 0.0) {
      float head = fract(uTime * 0.45 + aSignal.y);
      pulse = 1.0 - smoothstep(0.0, 0.07, abs(head - aSignal.x));
    } else {
      pulse = 0.35 + 0.35 * sin(uTime * 2.0 + aRandom * 20.0); // node glow
    }
    pulse *= s2 * (1.0 - s3);

    // Two-colour palette that shifts per page section (set from JS)
    vec3 amber = vec3(0.98, 0.75, 0.14);
    vec3 col = mix(uColorA, uColorB, smoothstep(0.2, 0.8, aRandom));
    if (aRandom > 0.93) col = amber;
    col = mix(col, vec3(1.0), pulse * 0.75);
    vColor = col;

    // Full brightness for the name; dimmer behind section content
    vAlpha = (0.5 + 0.5 * pulse) * mix(1.0, uNetAlpha, s2 - s3) * mix(1.0, 0.5, s3);

    float size = uSize * (0.55 + aRandom * 0.9) * (1.0 + pulse * 1.4);
    gl_PointSize = size * uPixelRatio / -mv.z;
  }
`;

/** Particle colours per page section: [primary, secondary]. */
const PALETTES: Record<string, [string, string]> = {
  top: ["#5eead4", "#a78bfa"],
  about: ["#5eead4", "#a78bfa"],
  experience: ["#a78bfa", "#60a5fa"],
  projects: ["#5eead4", "#60a5fa"],
  demos: ["#5eead4", "#fbbf24"],
  research: ["#fbbf24", "#f472b6"],
  skills: ["#a78bfa", "#f472b6"],
  contact: ["#5eead4", "#a78bfa"],
};
const tmpA = new THREE.Color();
const tmpB = new THREE.Color();
const tmpV = new THREE.Vector2();

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = pow(smoothstep(0.5, 0.0, d), 1.7);
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

export default function ParticleField({ count, reducedMotion }: { count: number; reducedMotion: boolean }) {
  const { viewport, gl } = useThree();
  const pointsRef = useRef<THREE.Points>(null);
  const intro = useRef({ v: reducedMotion ? 1 : 0 });
  const morph = useRef(0);
  const mouse = useRef(new THREE.Vector2(99, 99));

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const net = neuralNet(count);
    const rnd = new Float32Array(count);
    for (let i = 0; i < count; i++) rnd[i] = Math.random();
    g.setAttribute("position", new THREE.BufferAttribute(noiseCloud(count), 3));
    g.setAttribute("aText", new THREE.BufferAttribute(textPoints(profile.shortName, count, 0), 3));
    g.setAttribute("aNet", new THREE.BufferAttribute(net.pos, 3));
    g.setAttribute("aSignal", new THREE.BufferAttribute(net.signal, 2));
    g.setAttribute("aGalaxy", new THREE.BufferAttribute(galaxy(count), 3));
    g.setAttribute("aRandom", new THREE.BufferAttribute(rnd, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 30);
    return g;
  }, [count]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uMorph: { value: 0 },
          uSize: { value: 30 },
          uPixelRatio: { value: 1 },
          uFit: { value: 1 },
          uTextY: { value: 1 },
          uNetX: { value: 0 },
          uNetScale: { value: 1 },
          uNetAlpha: { value: 0.45 },
          uColorA: { value: new THREE.Color(PALETTES.top[0]) },
          uColorB: { value: new THREE.Color(PALETTES.top[1]) },
          uMotion: { value: reducedMotion ? 0 : 1 },
          uMouse: { value: new THREE.Vector2(99, 99) },
        },
      }),
    [reducedMotion]
  );

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  // Intro: particles assemble into the name
  useEffect(() => {
    if (reducedMotion) return;
    // Wait for the boot screen to wipe away, then assemble the name
    let tween: gsap.core.Tween | undefined;
    const off = onBooted(() => {
      tween = gsap.to(intro.current, { v: 1, duration: 2.6, delay: 0.15, ease: "power3.inOut" });
    });
    return () => {
      off();
      tween?.kill();
    };
  }, [reducedMotion]);

  // Track the cursor on the window (the canvas itself ignores pointer events)
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      mouse.current.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    };
    const onLeave = () => mouse.current.set(99, 99);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  useFrame((state, delta) => {
    const u = material.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uPixelRatio.value = gl.getPixelRatio();
    u.uFit.value = Math.min(1, (viewport.width * 0.88) / 10, (viewport.height * 0.2) / 1.5);
    // Keep the particle name in the upper part of the hero, clear of the HTML copy
    u.uTextY.value = viewport.height * 0.25;
    // On wide screens, shrink the network and park it on the right so the About copy stays
    // clear; on narrow screens keep it centred but much dimmer behind the text.
    const wide = viewport.width > 12;
    const netScale = wide ? 0.55 : 1;
    u.uNetScale.value = netScale;
    u.uNetX.value = wide ? viewport.width / 2 - 4.5 * netScale * u.uFit.value - 0.5 : 0;
    u.uNetAlpha.value = wide ? 0.5 : 0.28;

    // Section-tinted palette
    const pal = PALETTES[scrollState.section] ?? PALETTES.top;
    const k = 1 - Math.exp(-2.5 * delta);
    (u.uColorA.value as THREE.Color).lerp(tmpA.set(pal[0]), k);
    (u.uColorB.value as THREE.Color).lerp(tmpB.set(pal[1]), k);

    // Scroll: 0–1 viewport morphs name -> network, 1.3–2.3 viewports morphs network -> galaxy
    const s = scrollState.y / scrollState.vh;
    const scrollStage = THREE.MathUtils.clamp(s, 0, 1) + THREE.MathUtils.clamp(s - 1.3, 0, 1);
    const target = intro.current.v + scrollStage;
    morph.current = reducedMotion
      ? target
      : THREE.MathUtils.damp(morph.current, target, 3.5, delta);
    u.uMorph.value = morph.current;

    // Cursor in world units on the z=0 plane
    const m = mouse.current;
    const mw = u.uMouse.value as THREE.Vector2;
    if (m.x > 50) mw.set(99, 99);
    else mw.lerp(tmpV.set((m.x * viewport.width) / 2, (m.y * viewport.height) / 2), 0.15);

    // Gentle parallax
    const pts = pointsRef.current;
    if (pts && !reducedMotion && m.x < 50) {
      pts.rotation.y = THREE.MathUtils.damp(pts.rotation.y, m.x * 0.12, 2, delta);
      pts.rotation.x = THREE.MathUtils.damp(pts.rotation.x, -m.y * 0.08, 2, delta);
    }
  });

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />;
}
