"use client";

import { useEffect, useRef } from "react";

/**
 * A simulated "live inference feed" for the fall-detection paper:
 * - CCTV-style camera view with a 17-keypoint pose skeleton that walks, stumbles and falls
 * - YOLO-style tracking box with SORT track trail
 * - Two live signals (wearable IMU + vision fall score) fused into one decision
 */

type P = [number, number];
const CYCLE = 10; // seconds per loop

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** Pose at time t (seconds into the cycle). Units: person ≈ 1 tall, origin on the floor, y down. */
function pose(t: number) {
  const phi = Math.PI * 2 * 1.05 * Math.min(t, 4.4);
  let x = -0.95 + Math.min(t, 4) * 0.24;
  let lean = 0.05;
  let armRaise = 0;
  let stride = 1;
  let theta = 0; // whole-body rotation around the front ankle

  if (t > 4 && t <= 4.7) {
    const u = (t - 4) / 0.7;
    lean = 0.05 + 0.4 * u;
    armRaise = 1.3 * u;
    stride = 1 - 0.4 * u;
    x += 0.12 * u;
  } else if (t > 4.7) {
    lean = 0.45;
    armRaise = 1.6;
    stride = 0.6;
    x += 0.12;
    if (t <= 5.5) {
      const v = (t - 4.7) / 0.8;
      theta = v * v * 1.48;
    } else {
      const s = t - 5.5;
      theta = 1.48 + 0.07 * Math.exp(-s * 6) * Math.sin(s * 30);
    }
  }

  const hipH = 0.5 + 0.012 * Math.cos(phi * 2);
  const hip: P = [x, -hipH];
  const aL = 0.42 * Math.sin(phi) * stride;
  const aR = -aL;
  const bendL = 0.6 * Math.max(0, Math.sin(phi + 1.9)) * stride;
  const bendR = 0.6 * Math.max(0, Math.sin(phi + 1.9 + Math.PI)) * stride;

  const leg = (h: P, a: number, bend: number): [P, P] => {
    const knee: P = [h[0] + 0.25 * Math.sin(a), h[1] + 0.25 * Math.cos(a)];
    const ankle: P = [knee[0] + 0.25 * Math.sin(a - bend), knee[1] + 0.25 * Math.cos(a - bend)];
    return [knee, ankle];
  };

  // Slight depth offset so both sides are visible in a side view
  const dL: P = [-0.022, 0.008];
  const dR: P = [0.022, -0.008];
  const add = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]];

  const hipL = add(hip, dL);
  const hipR = add(hip, dR);
  const [kneeL, ankleL] = leg(hipL, aL, bendL);
  const [kneeR, ankleR] = leg(hipR, aR, bendR);

  const neck: P = [hip[0] + 0.3 * Math.sin(lean), hip[1] - 0.3 * Math.cos(lean)];
  const head: P = [neck[0] + 0.1 * Math.sin(lean), neck[1] - 0.1 * Math.cos(lean)];
  const shL = add(neck, dL);
  const shR = add(neck, dR);

  const arm = (sh: P, b: number): [P, P] => {
    const elbow: P = [sh[0] + 0.16 * Math.sin(b), sh[1] + 0.16 * Math.cos(b)];
    const fb = b + 0.35 + armRaise * 0.1;
    const wrist: P = [elbow[0] + 0.15 * Math.sin(fb), elbow[1] + 0.15 * Math.cos(fb)];
    return [elbow, wrist];
  };
  const [elL, wrL] = arm(shL, -aL * 0.8 + armRaise + lean);
  const [elR, wrR] = arm(shR, -aR * 0.8 + armRaise * 0.9 + lean);

  const nose: P = [head[0] + 0.05 * Math.cos(lean), head[1] + 0.05 * Math.sin(lean)];
  const eyeL: P = [head[0] + 0.03, head[1] - 0.015];
  const eyeR: P = [head[0] + 0.04, head[1] - 0.012];
  const earL: P = [head[0] - 0.015, head[1] - 0.005];
  const earR: P = [head[0] - 0.005, head[1] - 0.01];

  // COCO-17 order
  let kp: P[] = [nose, eyeL, eyeR, earL, earR, shL, shR, elL, elR, wrL, wrR, hipL, hipR, kneeL, kneeR, ankleL, ankleR];
  let headC = head;

  if (theta > 0) {
    const pivot = ankleL[0] > ankleR[0] ? ankleL : ankleR;
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const rot = (q: P): P => {
      const dx = q[0] - pivot[0];
      const dy = q[1] - pivot[1];
      return [pivot[0] + dx * c - dy * s, pivot[1] + dx * s + dy * c];
    };
    kp = kp.map(rot);
    headC = rot(head);
    // Keep everything above the floor
    const maxY = Math.max(...kp.map((p) => p[1]), headC[1] + 0.06);
    if (maxY > 0) {
      kp = kp.map(([a, b]) => [a, b - maxY]);
      headC = [headC[0], headC[1] - maxY];
    }
  }

  const state = t < 4 ? "WALKING" : t < 4.75 ? "UNSTABLE" : "FALL";
  return { kp, head: headC, hip, theta, state };
}

// Bones as pairs of COCO indices, tagged left (L) / right (R) / centre (C)
const BONES: [number, number, "L" | "R" | "C"][] = [
  [5, 6, "C"], [5, 11, "L"], [6, 12, "R"], [11, 12, "C"],
  [5, 7, "L"], [7, 9, "L"], [6, 8, "R"], [8, 10, "R"],
  [11, 13, "L"], [13, 15, "L"], [12, 14, "R"], [14, 16, "R"],
];

export default function FallDetectionFeed() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const mono = getComputedStyle(document.body).getPropertyValue("--font-code") || "monospace";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = 0;
    let H = 0;
    let camH = 0;
    let raf = 0;
    let last = performance.now();
    let t = reduced ? 6.6 : 0;
    let sampleAcc = 0;
    const N = 240;
    const imuHist: number[] = Array(N).fill(1);
    const visHist: number[] = Array(N).fill(0.05);
    let imuPeak = 0;
    let fusion = 0;
    let confirmed = false;
    let confirmedAt = 0;
    let bbox = { x0: 0, y0: 0, x1: 0, y1: 0, init: false };
    const trail: P[] = [];
    const clockStart = Date.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      W = canvas.clientWidth;
      camH = Math.round(W * 0.6);
      H = camH + 150;
      canvas.style.height = `${H}px`;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const drawLine = (data: number[], x: number, y: number, w: number, h: number, min: number, max: number, color: string) => {
      ctx.beginPath();
      data.forEach((v, i) => {
        const px = x + (i / (N - 1)) * w;
        const py = y + h - ((v - min) / (max - min)) * h;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    const frame = (dt: number) => {
      if (!reduced) t += dt;
      if (t >= CYCLE) {
        t = 0;
        confirmed = false;
        imuPeak = 0;
        trail.length = 0;
        bbox.init = false;
      }

      const p = pose(t);
      const floorY = camH * 0.86;
      const S = camH * 0.6;
      const toScreen = (q: P): P => [W / 2 + q[0] * S, floorY + q[1] * S];
      const pts = p.kp.map(toScreen);
      const headS = toScreen(p.head);
      const headR = 0.06 * S;

      // ---- Signals (sampled at 60 Hz) ----
      sampleAcc += reduced ? 1 / 60 : dt;
      const xs = pts.map((q) => q[0]).concat(headS[0] - headR, headS[0] + headR);
      const ys = pts.map((q) => q[1]).concat(headS[1] - headR);
      const tb = { x0: Math.min(...xs) - 8, y0: Math.min(...ys) - 8, x1: Math.max(...xs) + 8, y1: Math.max(...ys) + 6 };
      if (!bbox.init) bbox = { ...tb, init: true };
      const k = 1 - Math.exp(-dt * 14);
      bbox.x0 += (tb.x0 - bbox.x0) * k;
      bbox.y0 += (tb.y0 - bbox.y0) * k;
      bbox.x1 += (tb.x1 - bbox.x1) * k;
      bbox.y1 += (tb.y1 - bbox.y1) * k;
      const aspect = (bbox.x1 - bbox.x0) / Math.max(1, bbox.y1 - bbox.y0);

      while (sampleAcc >= 1 / 60) {
        sampleAcc -= 1 / 60;
        const n = (Math.random() - 0.5) * 2;
        let g = 1;
        if (t < 4) g = 1 + 0.13 * Math.sin(t * 2 * Math.PI * 2.1) + n * 0.03;
        else if (t < 5.45) g = 1 + n * 0.22 + (t > 4.7 ? -0.35 * smooth(4.7, 5.4, t) : 0); // free-fall dip
        else if (t < 6.4) {
          const s = t - 5.45;
          g = 1 + 2.4 * Math.exp(-s * 7) * Math.abs(Math.cos(s * 38)) + n * 0.04;
        } else g = 1 + n * 0.012;
        const vis = clamp((aspect - 0.55) / 1.5) * 0.92 + 0.04 + n * 0.015;
        imuHist.push(g);
        imuHist.shift();
        visHist.push(clamp(vis));
        visHist.shift();
        imuPeak = Math.max(clamp((g - 1) / 1.6), imuPeak * Math.exp(-(1 / 60) * 0.18));
        fusion = 0.45 * clamp(vis) + 0.55 * imuPeak;
        if (!confirmed && fusion > 0.75) {
          confirmed = true;
          confirmedAt = t;
        }
      }

      // ---- Camera ----
      ctx.clearRect(0, 0, W, H);
      const camBg = ctx.createRadialGradient(W * 0.5, camH * 0.45, 10, W * 0.5, camH * 0.5, W * 0.7);
      camBg.addColorStop(0, "#151a28");
      camBg.addColorStop(1, "#06070c");
      ctx.fillStyle = camBg;
      ctx.fillRect(0, 0, W, camH);

      // Room: back wall line, floor perspective grid, a door
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      const horizon = camH * 0.5;
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      ctx.lineTo(W, horizon);
      for (let i = -8; i <= 8; i++) {
        ctx.moveTo(W / 2 + i * W * 0.04, horizon);
        ctx.lineTo(W / 2 + i * W * 0.22, camH);
      }
      for (let j = 1; j < 6; j++) {
        const y = horizon + (camH - horizon) * Math.pow(j / 6, 1.7);
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.09)";
      ctx.strokeRect(W * 0.78, horizon - camH * 0.32, W * 0.1, camH * 0.32);

      const fade = t > CYCLE - 0.7 ? clamp((CYCLE - t) / 0.7) : clamp(t / 0.4);
      ctx.globalAlpha = reduced ? 1 : fade;

      // Track trail (SORT history)
      if (!reduced && Math.random() < 0.5) trail.push([(bbox.x0 + bbox.x1) / 2, bbox.y1]);
      if (trail.length > 40) trail.shift();
      trail.forEach((q, i) => {
        ctx.fillStyle = `rgba(251,191,36,${(i / trail.length) * 0.5})`;
        ctx.fillRect(q[0] - 1, q[1] - 1, 2, 2);
      });

      // Soft body "silhouette" under the skeleton
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(120,130,170,0.16)";
      ctx.lineWidth = S * 0.075;
      for (const [a, b] of BONES) {
        ctx.beginPath();
        ctx.moveTo(...pts[a]);
        ctx.lineTo(...pts[b]);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(120,130,170,0.16)";
      ctx.beginPath();
      ctx.arc(headS[0], headS[1], headR * 1.05, 0, Math.PI * 2);
      ctx.fill();

      // Skeleton (OpenPose-style left/right colouring)
      const boneColor = { L: "#5eead4", R: "#a78bfa", C: "#e8eaf2" };
      ctx.lineWidth = 2;
      for (const [a, b, side] of BONES) {
        ctx.strokeStyle = boneColor[side];
        ctx.shadowColor = boneColor[side];
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(...pts[a]);
        ctx.lineTo(...pts[b]);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(232,234,242,0.7)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(headS[0], headS[1], headR, 0, Math.PI * 2);
      ctx.stroke();
      pts.forEach((q, i) => {
        ctx.fillStyle = i < 5 ? "#fbbf24" : i % 2 ? "#5eead4" : "#a78bfa";
        ctx.beginPath();
        ctx.arc(q[0], q[1], i < 5 ? 1.6 : 2.6, 0, Math.PI * 2);
        ctx.fill();
      });

      // Tracking box
      const danger = confirmed;
      const boxColor = danger ? "#ef4444" : p.state === "UNSTABLE" ? "#fbbf24" : "#fbbf24";
      ctx.strokeStyle = boxColor;
      ctx.lineWidth = 1.5;
      const bw = bbox.x1 - bbox.x0;
      const bh = bbox.y1 - bbox.y0;
      // corner brackets
      const c = Math.min(14, bw * 0.25, bh * 0.25);
      ctx.beginPath();
      for (const [cx, cy, sx, sy] of [
        [bbox.x0, bbox.y0, 1, 1],
        [bbox.x1, bbox.y0, -1, 1],
        [bbox.x0, bbox.y1, 1, -1],
        [bbox.x1, bbox.y1, -1, -1],
      ]) {
        ctx.moveTo(cx + sx * c, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + sy * c);
      }
      ctx.stroke();
      ctx.strokeStyle = boxColor + "55";
      ctx.lineWidth = 1;
      ctx.strokeRect(bbox.x0, bbox.y0, bw, bh);

      const label = `#07 person ${danger ? "FALL 0.96" : p.state === "UNSTABLE" ? "unstable 0.71" : "walking 0.94"}`;
      ctx.font = `600 10px ${mono}`;
      const lw = ctx.measureText(label).width + 8;
      ctx.fillStyle = boxColor;
      ctx.fillRect(bbox.x0 - 0.75, bbox.y0 - 15, lw, 14);
      ctx.fillStyle = "#05060a";
      ctx.textAlign = "left";
      ctx.fillText(label, bbox.x0 + 3, bbox.y0 - 5);
      ctx.globalAlpha = 1;

      // CCTV overlay: scanlines, grain, HUD
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      for (let y = 0; y < camH; y += 3) ctx.fillRect(0, y, W, 1);
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
        ctx.fillRect(Math.random() * W, Math.random() * camH, 1.5, 1.5);
      }
      const vig = ctx.createRadialGradient(W / 2, camH / 2, camH * 0.3, W / 2, camH / 2, W * 0.75);
      vig.addColorStop(0, "transparent");
      vig.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, camH);

      ctx.font = `10px ${mono}`;
      ctx.fillStyle = "rgba(232,234,242,0.75)";
      ctx.textAlign = "left";
      ctx.fillText("CAM 02 · HALLWAY", 12, 20);
      ctx.fillText("YOLOv8-pose + SORT · 30 FPS · 18 ms", 12, camH - 12);
      ctx.textAlign = "right";
      ctx.fillText(new Date(reduced ? clockStart : Date.now()).toTimeString().slice(0, 8), W - 12, camH - 12);
      if (Math.floor(performance.now() / 600) % 2 === 0 || reduced) {
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(W - 46, 16.5, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(232,234,242,0.75)";
      ctx.fillText("REC", W - 12, 20);

      // Alert
      if (confirmed) {
        const pulse = 0.5 + 0.5 * Math.sin((t - confirmedAt) * 8);
        ctx.strokeStyle = `rgba(239,68,68,${0.4 + pulse * 0.5})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(1.5, 1.5, W - 3, camH - 3);
        const msg = "⚠ FALL DETECTED · caregiver notified";
        ctx.font = `700 ${W < 420 ? 10 : 11}px ${mono}`;
        const mw = ctx.measureText(msg).width + 20;
        const ay = 32 + (1 - smooth(confirmedAt, confirmedAt + 0.25, t)) * -20;
        ctx.fillStyle = "rgba(239,68,68,0.92)";
        ctx.beginPath();
        ctx.roundRect(W / 2 - mw / 2, ay, mw, 22, 11);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText(msg, W / 2, ay + 15);
      }

      // ---- Signals panel ----
      const top = camH + 10;
      const chartW = W * 0.76 - 12;
      const rowH = 56;
      ctx.textAlign = "left";
      ctx.font = `10px ${mono}`;

      const rows: [string, number[], number, number, string, number][] = [
        ["IMU · wearable |a| (g)", imuHist, 0.4, 3.6, "#5eead4", 2.2],
        ["VISION · fall score", visHist, 0, 1, "#a78bfa", 0.7],
      ];
      rows.forEach(([name, data, min, max, color, thr], r) => {
        const y = top + r * (rowH + 14);
        ctx.fillStyle = "rgba(255,255,255,0.025)";
        ctx.fillRect(0, y, chartW, rowH);
        ctx.fillStyle = "#8b90a5";
        ctx.fillText(name, 8, y + 13);
        const ty = y + rowH - ((thr - min) / (max - min)) * rowH;
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = "rgba(239,68,68,0.45)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, ty);
        ctx.lineTo(chartW, ty);
        ctx.stroke();
        ctx.setLineDash([]);
        drawLine(data, 0, y + 4, chartW, rowH - 8, min, max, color);
      });

      // Fusion gauge
      const gx = W * 0.76 + 4;
      const gw = W - gx;
      const gh = rowH * 2 + 14;
      ctx.fillStyle = "rgba(255,255,255,0.025)";
      ctx.fillRect(gx, top, gw, gh);
      ctx.fillStyle = "#8b90a5";
      ctx.textAlign = "center";
      ctx.fillText("FUSION", gx + gw / 2, top + 13);
      const barX = gx + gw / 2 - 7;
      const barTop = top + 22;
      const barH = gh - 48;
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(barX, barTop, 14, barH);
      const fh = clamp(fusion) * barH;
      const fg = ctx.createLinearGradient(0, barTop + barH, 0, barTop);
      fg.addColorStop(0, "#5eead4");
      fg.addColorStop(0.6, "#fbbf24");
      fg.addColorStop(1, "#ef4444");
      ctx.fillStyle = fg;
      ctx.fillRect(barX, barTop + barH - fh, 14, fh);
      const thY = barTop + barH * (1 - 0.75);
      ctx.strokeStyle = "#ef4444";
      ctx.beginPath();
      ctx.moveTo(barX - 5, thY);
      ctx.lineTo(barX + 19, thY);
      ctx.stroke();
      ctx.font = `700 12px ${mono}`;
      ctx.fillStyle = confirmed ? "#ef4444" : "#e8eaf2";
      ctx.fillText(fusion.toFixed(2), gx + gw / 2, top + gh - 12);
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      frame(dt);
      raf = requestAnimationFrame(loop);
    };

    if (reduced) {
      // Static frame at the moment of the alert
      for (let i = 0; i < N; i++) frame(1 / 60);
    }

    const io = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf);
      if (e.isIntersecting && !reduced) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Simulated camera feed: a pose-tracked person walks, falls, and the system fuses camera and wearable sensor signals to raise a fall alert."
      className="block w-full rounded-2xl border border-line bg-[#06070c]"
    />
  );
}
