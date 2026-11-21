// Generates the target positions the particles morph between.
// All shapes are centred on the origin, ~10 world units wide.

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Gaussian-ish random via averaging (cheap, good enough for clustering). */
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

/** Stage 0: a loose cloud filling the view. */
export function noiseCloud(count: number) {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    out[i * 3] = rand(-13, 13);
    out[i * 3 + 1] = rand(-8, 8);
    out[i * 3 + 2] = rand(-8, 3);
  }
  return out;
}

/** Stage 1: particles sampled from rasterised text. */
export function textPoints(text: string, count: number, yOffset: number) {
  const W = 1400;
  const H = 360;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const family = getComputedStyle(document.body).fontFamily || "sans-serif";

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = text.length > 6 ? "8px" : "18px";
  let size = 300;
  ctx.font = `700 ${size}px ${family}`;
  const measured = ctx.measureText(text).width;
  size = Math.min(size, (size * W * 0.94) / measured);
  ctx.font = `700 ${size}px ${family}`;
  ctx.fillText(text, W / 2, H / 2);

  const data = ctx.getImageData(0, 0, W, H).data;
  const pixels: number[] = [];
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      if (data[(y * W + x) * 4 + 3] > 128) pixels.push(x, y);
    }
  }

  const scale = 10 / W;
  const out = new Float32Array(count * 3);
  const n = pixels.length / 2;
  for (let i = 0; i < count; i++) {
    const k = Math.floor(Math.random() * n) * 2;
    out[i * 3] = (pixels[k] - W / 2) * scale + rand(-0.012, 0.012);
    out[i * 3 + 1] = -(pixels[k + 1] - H / 2) * scale + yOffset + rand(-0.012, 0.012);
    out[i * 3 + 2] = rand(-0.18, 0.18);
  }
  return out;
}

/**
 * Stage 2: a feed-forward neural network. Particles cluster at nodes or sit
 * along edges; `signal` holds (t along edge, per-edge phase) so the shader can
 * animate data pulses flowing through the network. t = -1 marks node particles.
 */
export function neuralNet(count: number) {
  const layers = [4, 7, 9, 7, 3];
  const width = 9;
  const height = 5.2;
  const nodes: [number, number, number][][] = layers.map((n, l) => {
    const x = -width / 2 + (width * l) / (layers.length - 1);
    return Array.from({ length: n }, (_, j) => {
      const y = n === 1 ? 0 : height / 2 - (height * j) / (n - 1);
      return [x, y * (0.55 + 0.45 * (n / 9)), rand(-0.4, 0.4)] as [number, number, number];
    });
  });

  const edges: { a: number[]; b: number[]; phase: number }[] = [];
  for (let l = 0; l < layers.length - 1; l++) {
    for (const a of nodes[l]) for (const b of nodes[l + 1]) edges.push({ a, b, phase: Math.random() });
  }
  const flatNodes = nodes.flat();

  const pos = new Float32Array(count * 3);
  const signal = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    if (Math.random() < 0.32) {
      const n = flatNodes[Math.floor(Math.random() * flatNodes.length)];
      pos[i * 3] = n[0] + gauss() * 0.13;
      pos[i * 3 + 1] = n[1] + gauss() * 0.13;
      pos[i * 3 + 2] = n[2] + gauss() * 0.13;
      signal[i * 2] = -1;
      signal[i * 2 + 1] = 0;
    } else {
      const e = edges[Math.floor(Math.random() * edges.length)];
      const t = Math.random();
      pos[i * 3] = e.a[0] + (e.b[0] - e.a[0]) * t + gauss() * 0.015;
      pos[i * 3 + 1] = e.a[1] + (e.b[1] - e.a[1]) * t + gauss() * 0.015;
      pos[i * 3 + 2] = e.a[2] + (e.b[2] - e.a[2]) * t + gauss() * 0.015;
      signal[i * 2] = t;
      signal[i * 2 + 1] = e.phase;
    }
  }
  return { pos, signal };
}

/** Stage 3: a three-armed spiral galaxy used as the background for the rest of the page. */
export function galaxy(count: number) {
  const out = new Float32Array(count * 3);
  const arms = 3;
  for (let i = 0; i < count; i++) {
    const r = Math.pow(Math.random(), 0.7) * 15;
    const arm = (i % arms) * ((Math.PI * 2) / arms);
    const angle = arm + r * 0.42;
    const spread = (0.25 + r * 0.06) * gauss();
    out[i * 3] = Math.cos(angle) * r + spread;
    out[i * 3 + 1] = gauss() * (0.6 - r * 0.03);
    out[i * 3 + 2] = Math.sin(angle) * r + spread;
  }
  return out;
}
