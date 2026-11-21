"use client";

import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import ParticleField from "./ParticleField";

export default function Scene() {
  const [config, setConfig] = useState<{ count: number; bloom: boolean; reduced: boolean } | null>(null);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 768px), (pointer: coarse)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Wait for web fonts so the particle name uses the display font
    document.fonts.ready.then(() =>
      setConfig({ count: mobile ? 9000 : 26000, bloom: !mobile, reduced })
    );
  }, []);

  if (!config) return null;

  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 50 }}
      dpr={[1, 1.75]}
      gl={{ antialias: false, powerPreference: "high-performance" }}
    >
      <ParticleField count={config.count} reducedMotion={config.reduced} />
      {config.bloom ? (
        <EffectComposer>
          <Bloom intensity={0.9} luminanceThreshold={0.15} luminanceSmoothing={0.4} mipmapBlur />
        </EffectComposer>
      ) : (
        <></>
      )}
    </Canvas>
  );
}
