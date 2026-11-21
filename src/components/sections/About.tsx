import { metrics, pillars, profile } from "@/data/resume";
import SectionHeading from "./SectionHeading";

const pillarAccents = ["var(--cyan)", "var(--violet)", "var(--amber)"];

export default function About() {
  return (
    <section id="about" className="relative mx-auto max-w-6xl px-4 py-28 sm:px-6 sm:py-40">
      <SectionHeading
        index="01"
        eyebrow="About"
        title={
          <>
            Turning models into <span className="text-gradient">products people use</span>.
          </>
        }
      />
      <p data-reveal className="max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
        {profile.summary}
      </p>

      <div className="mt-16 grid gap-4 sm:grid-cols-3">
        {pillars.map((p, i) => (
          <div
            key={p.title}
            data-reveal
            className="glass rounded-2xl p-6"
            style={{ borderTop: `2px solid ${pillarAccents[i]}` }}
          >
            <h3 className="text-lg font-semibold">{p.title}</h3>
            <p className="mt-2 text-sm text-muted">{p.body}</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {p.tools.map((t) => (
                <li key={t} className="rounded-full border border-line px-2.5 py-1 font-mono text-[11px] text-fg/80">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <dl className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} data-reveal className="bg-bg/80 p-6">
            <dd className="font-mono text-3xl font-semibold text-fg sm:text-4xl">
              <span data-count={m.value}>{m.value.toLocaleString()}</span>
              <span className="text-cyan">{m.suffix}</span>
            </dd>
            <dt className="mt-2 text-xs text-muted">{m.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
