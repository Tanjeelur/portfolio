import { research } from "@/data/resume";
import SectionHeading from "./SectionHeading";
import FallDetectionFeed from "@/components/research/FallDetectionFeed";

export default function Research() {
  return (
    <section id="research" className="relative mx-auto max-w-6xl px-4 py-28 sm:px-6 sm:py-40">
      <SectionHeading index="05" eyebrow="Research" title="Published first author at IEEE." />
      <div data-reveal className="glass grid items-center gap-8 rounded-3xl p-5 sm:p-8 lg:grid-cols-[1fr_1.25fr]">
        <div className="lg:pl-2">
          <p className="font-mono text-xs uppercase tracking-widest text-amber">{research.venue}</p>
          <h3 className="mt-3 text-2xl font-semibold sm:text-3xl">{research.title}</h3>
          <ul className="mt-6 space-y-3 text-muted">
            {research.points.map((p) => (
              <li key={p} className="flex gap-3">
                <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-amber" />
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted">Supervisor: {research.supervisor}</p>
          <a
            href={`https://doi.org/${research.doi}`}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-block font-mono text-sm text-amber hover:underline"
          >
            DOI: {research.doi} ↗
          </a>
        </div>
        <figure>
          <FallDetectionFeed />
          <figcaption className="mt-3 font-mono text-[11px] text-muted">
            Simulated feed: pose keypoints + wearable IMU, fused into one fall decision.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
