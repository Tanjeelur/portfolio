import { profile } from "@/data/resume";

export default function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-svh flex-col items-center justify-end px-4 pb-16 text-center sm:px-6 sm:pb-20"
    >
      {/* The particle name renders in the WebGL canvas behind this. */}
      <div id="hero-copy" className="max-w-2xl">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-cyan">
          {profile.role}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {profile.name}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted sm:text-lg">
          {profile.tagline}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            data-magnetic
            href="#projects"
            className="rounded-full bg-cyan px-6 py-3 text-sm font-semibold text-bg transition-transform hover:scale-105"
          >
            See my work
          </a>
          <a
            data-magnetic
            href={`mailto:${profile.email}`}
            className="glass rounded-full px-6 py-3 text-sm font-semibold transition-colors hover:border-cyan"
          >
            Get in touch
          </a>
        </div>
      </div>
      {/* tighter on short screens so the particle name above gets more room */}
      <div className="mt-14 flex flex-col items-center gap-2 font-mono [@media(max-height:780px)]:mt-6 [@media(max-height:680px)]:hidden text-[10px] uppercase tracking-[0.3em] text-muted">
        scroll
        <span className="h-10 w-px animate-pulse bg-gradient-to-b from-cyan to-transparent" />
      </div>
    </section>
  );
}
