"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// three.js only runs in the browser and is loaded after the page content.
const Scene = dynamic(() => import("./Scene"), { ssr: false });

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function BackgroundCanvas() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => setOk(hasWebGL()), []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      {/* Static gradient: shown before WebGL loads and as the no-WebGL fallback */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(94,234,212,0.10),transparent_50%),radial-gradient(ellipse_at_75%_70%,rgba(167,139,250,0.12),transparent_55%)]" />
      {ok && <Scene />}
      {/* Vignette keeps text readable over the particles */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(5,6,10,0.75)_100%)]" />
    </div>
  );
}
