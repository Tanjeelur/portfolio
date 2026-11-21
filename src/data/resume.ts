// Single source of truth for all portfolio content.
// Edit this file to update the site.

export const profile = {
  name: "Md. Tanjeelur Rahman Labib",
  /** The name shown large in the hero particles, the nav orb and the boot screen */
  shortName: "TANJEELUR",
  role: "AI / Machine Learning Engineer",
  location: "Dhaka, Bangladesh",
  email: "md.tanjeelur@gmail.com",
  // TODO: replace with your real profile URLs
  links: {
    github: "https://github.com/",
    linkedin: "https://www.linkedin.com/",
    scholar: "https://scholar.google.com/",
  },
  tagline:
    "I ship LLM and computer-vision systems to production — hybrid RAG, multi-agent workflows, real-time vision, and the backends that carry them.",
  summary:
    "AI engineer with ~2 years across three product teams. My work spans retrieval-augmented generation and multi-agent workflows, real-time vision services on YOLO and OpenCV, predictive models on tabular sports data, and the Python/FastAPI/PostgreSQL backends and Docker pipelines behind them. First-author IEEE publication (TENSYMP 2025).",
};

export const pillars = [
  {
    title: "LLM & Retrieval",
    body: "Hybrid RAG, agent workflows, evaluation and grounding.",
    tools: ["Qdrant", "pgvector", "CrewAI", "BM25 + RRF"],
  },
  {
    title: "Applied ML & Vision",
    body: "Detection and tracking, forecasting, deep learning.",
    tools: ["YOLOv8/v11", "XGBoost", "PyTorch", "OpenCV"],
  },
  {
    title: "Production Backend",
    body: "Async APIs, rate-limited pipelines, CI/CD on the cloud.",
    tools: ["FastAPI", "PostgreSQL", "Docker", "AWS"],
  },
];

export const metrics = [
  { value: 20000, suffix: "+", label: "daily users served by AISHA RAG" },
  { value: 1500, suffix: " RPM", label: "rate-limited multi-LLM pipeline" },
  { value: 200, suffix: "", label: "concurrent LLM calls with recovery" },
  { value: 92, suffix: "%", label: "fall-detection accuracy (IEEE)" },
];

export type Experience = {
  role: string;
  company: string;
  period: string;
  highlights: string[];
  stack: string[];
};

export const experience: Experience[] = [
  {
    role: "Junior AI Developer",
    company: "Chromatics AI",
    period: "Dec 2025 — Present",
    highlights: [
      "GEO Intelligence Platform: FastAPI SaaS tracking brand visibility across 6 LLM engines with an async pipeline, token-bucket rate limiting (1,500 RPM) and 200-call concurrency gates.",
      "Built an AI Analyze & Fix engine on 3-agent CrewAI workflows generating publish-ready content across 12 channels.",
      "AISHA: owned retrieval accuracy for a RAG platform serving ~20,000 users daily — hybrid vector + BM25 search fused via Reciprocal Rank Fusion on Qdrant.",
    ],
    stack: ["FastAPI", "PostgreSQL 16", "CrewAI", "Qdrant", "GPT-4o", "Gemini", "Stripe", "Docker"],
  },
  {
    role: "AI Developer",
    company: "Softvence Agency",
    period: "Jun 2025 — Nov 2025",
    highlights: [
      "WrapmyrideAI: real-time AI car-wrap visualisation with OpenCV + YOLOv11, shipped to production at wrapmyride.ai.",
      "Sports Lineup Prediction: XGBoost models predicting NFL and MLB lineups and win probability, shipped in the iOS app Full Send Sports AI.",
    ],
    stack: ["OpenCV", "YOLOv11", "XGBoost", "FastAPI", "AWS EC2", "Docker"],
  },
  {
    role: "Python Intern",
    company: "Genuine Technology & Research Ltd.",
    period: "Feb 2025 — May 2025",
    highlights: [
      "Ichamati: scheduled news scraping with Selenium + BeautifulSoup and a FastAPI backend.",
      "OwnGPT: personalised agent on local DeepSeek-R1 with RAG — ~15% faster responses, ~20% better accuracy.",
    ],
    stack: ["FastAPI", "Selenium", "PostgreSQL", "DeepSeek-R1", "RAG"],
  },
];

export type Cluster = "LLM & Retrieval" | "Computer Vision" | "Predictive ML";

export const clusters: Record<Cluster, { accent: Project["accent"]; center: [number, number, number] }> = {
  "LLM & Retrieval": { accent: "cyan", center: [-3.6, 0.6, -0.4] },
  "Computer Vision": { accent: "amber", center: [3.8, 0.6, -0.4] },
  "Predictive ML": { accent: "violet", center: [0.4, -2.6, 1.4] },
};

export type Project = {
  title: string;
  kind: string;
  year: string;
  description: string;
  stack: string[];
  url?: string;
  accent: "cyan" | "violet" | "amber";
  cluster: Cluster;
  /** Position in the 3D project galaxy */
  position: [number, number, number];
  highlights: string[];
};

export const projects: Project[] = [
  {
    title: "AISHA",
    kind: "Production RAG",
    year: "2026",
    description:
      "Retrieval-accuracy engineering for a RAG platform serving ~20,000 users daily, keeping answers fast and grounded.",
    highlights: [
      "Hybrid engine fusing Qdrant semantic search (3072-dim) with BM25 via Reciprocal Rank Fusion.",
      "Query distillation with GPT-4o structured outputs: intent classification + temporal extraction.",
      "GPT-4o-mini relevance filter plus distance-threshold gating to prune weak chunks.",
      "Dual-layer cache cutting latency and API overhead.",
    ],
    stack: ["Qdrant", "Gemini Embeddings", "GPT-4o", "BM25", "Redis"],
    url: "https://aisha.ai",
    accent: "cyan",
    cluster: "LLM & Retrieval",
    position: [-4.4, 1.9, 0.6],
  },
  {
    title: "GEO Intelligence",
    kind: "Multi-LLM SaaS",
    year: "2026",
    description:
      "SaaS that tracks how brands appear across ChatGPT, Gemini, Claude and Perplexity — and fixes it.",
    highlights: [
      "Async multi-engine pipeline: token-bucket limiting at 1,500 RPM, 200-call concurrency gates, error recovery.",
      "Unicode-normalized brand detection, sentiment and confidence-gated competitor discovery with citation checks.",
      "AI Analyze & Fix: 3-agent CrewAI workflows producing content for 12 channels.",
      "Stripe credit system, SSE streaming, Docker + GitHub Actions.",
    ],
    stack: ["FastAPI", "CrewAI", "PostgreSQL 16", "SSE", "Stripe"],
    accent: "cyan",
    cluster: "LLM & Retrieval",
    position: [-2.1, 0.2, -1.4],
  },
  {
    title: "Bengali Literature RAG",
    kind: "Multilingual RAG",
    year: "2025",
    description:
      "Bengali ↔ English question answering over scanned, non-Unicode literature PDFs.",
    highlights: [
      "EasyOCR ingestion with OCR-specific error correction.",
      "Paragraph chunking + all-MiniLM-L6-v2 embeddings on PostgreSQL + pgvector.",
      "Redis short-term memory for multi-turn context; ~2–5 s query latency.",
    ],
    stack: ["EasyOCR", "pgvector", "sentence-transformers", "Redis"],
    accent: "cyan",
    cluster: "LLM & Retrieval",
    position: [-4.8, -0.9, -0.6],
  },
  {
    title: "WrapmyrideAI",
    kind: "Computer Vision",
    year: "2025",
    description: "Real-time AI car-wrap visualisation, live at wrapmyride.ai.",
    highlights: [
      "YOLOv11 + OpenCV pipeline for vehicle segmentation and wrap rendering.",
      "Multi-angle preview system shipped to production.",
      "FastAPI backend with PostgreSQL on AWS EC2.",
    ],
    stack: ["YOLOv11", "OpenCV", "FastAPI", "AWS EC2"],
    url: "https://wrapmyride.ai",
    accent: "amber",
    cluster: "Computer Vision",
    position: [3.5, 1.7, 0.5],
  },
  {
    title: "Multimodal Fall Detection",
    kind: "IEEE Research",
    year: "2024",
    description: "Computer vision + IoT wearable for real-time elderly monitoring. First-author IEEE paper.",
    highlights: [
      "YOLOv8 + SORT tracking reaching 92% detection accuracy.",
      "Real-time PyTorch/OpenCV video pipeline with caregiver warning overlays.",
      "Trained on a custom fall-scenario dataset; presented at TENSYMP 2025.",
    ],
    stack: ["YOLOv8", "SORT", "PyTorch", "OpenCV", "IoT"],
    accent: "amber",
    cluster: "Computer Vision",
    position: [4.5, -0.7, -1.3],
  },
  {
    title: "Full Send Sports AI",
    kind: "Predictive ML",
    year: "2025",
    description: "NFL and MLB lineup and win-probability predictions, live in an iOS app.",
    highlights: [
      "Collected historical data from Goalserve and designed the feature pipeline.",
      "XGBoost models predicting lineups and win probability.",
      "Shipped in the live iOS app Full Send Sports AI.",
    ],
    stack: ["XGBoost", "pandas", "PostgreSQL"],
    accent: "violet",
    cluster: "Predictive ML",
    position: [0.5, -2.7, 1.5],
  },
];

export const research = {
  title: "Multimodal Fall Detection Wearable Sensor for Elderly People",
  venue: "IEEE TENSYMP 2025 · Christchurch, New Zealand",
  doi: "10.1109/TENSYMP63728.2025.11144987",
  supervisor: "Dr. Fariah Mahzabeen, ECE, North South University",
  points: [
    "Combined computer vision and IoT sensors for real-time elderly monitoring.",
    "92% detection accuracy with YOLOv8 + SORT tracking.",
    "Real-time video pipeline with automated caregiver warning overlays.",
  ],
};

export const skills: Record<string, string[]> = {
  Languages: ["Python", "Java", "SQL"],
  "ML & Deep Learning": ["PyTorch", "scikit-learn", "Transformers", "XGBoost", "OpenCV", "YOLOv8/v11"],
  "LLM & Agents": ["Hugging Face", "LoRA", "Unsloth", "LangChain", "LangGraph", "CrewAI", "OpenAI", "Gemini", "Anthropic"],
  "RAG & Vector Search": ["Qdrant", "pgvector", "BM25", "RRF", "sentence-transformers", "EasyOCR"],
  Backend: ["FastAPI", "Flask", "PostgreSQL", "Redis", "asyncio", "SSE"],
  "Cloud & DevOps": ["AWS EC2", "DigitalOcean", "Oracle Cloud", "Docker", "GitHub Actions"],
};

export const education = {
  degree: "B.Sc. in Computer Science and Engineering",
  school: "North South University",
  period: "2020 — 2024",
};
