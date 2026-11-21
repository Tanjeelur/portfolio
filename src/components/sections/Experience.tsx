import { experience } from "@/data/resume";
import SectionHeading from "./SectionHeading";
import TrainingRun from "@/components/experience/TrainingRun";

export default function Experience() {
  return (
    <section id="experience" className="relative mx-auto max-w-6xl px-4 py-28 sm:px-6 sm:py-40">
      <SectionHeading index="02" eyebrow="Experience" title="Three teams. Shipped to production every time." />

      {/* Desktop: scroll-driven training curve. Mobile/tablet: the plain timeline below. */}
      <div className="hidden lg:block">
        <TrainingRun />
      </div>

      <ol data-timeline className="relative ml-2 lg:hidden border-l border-line pl-8 sm:ml-4 sm:pl-12">
        <span
          data-timeline-line
          aria-hidden
          className="absolute -left-px top-0 h-full w-px origin-top bg-gradient-to-b from-cyan via-violet to-amber"
        />
        {experience.map((job) => (
          <li key={job.company} data-reveal className="relative pb-16 last:pb-0">
            <span
              aria-hidden
              className="absolute -left-[37px] top-1.5 h-3 w-3 rounded-full bg-cyan shadow-[0_0_20px_var(--cyan)] sm:-left-[53px]"
            />
            <p className="font-mono text-xs uppercase tracking-widest text-muted">{job.period}</p>
            <h3 className="mt-2 text-2xl font-semibold">
              {job.role} <span className="text-muted">@</span>{" "}
              <span className="text-gradient">{job.company}</span>
            </h3>
            <ul className="mt-4 max-w-3xl space-y-3 text-muted">
              {job.highlights.map((h) => (
                <li key={h} className="flex gap-3">
                  <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-cyan" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
            <ul className="mt-5 flex flex-wrap gap-2">
              {job.stack.map((s) => (
                <li key={s} className="rounded-md bg-white/5 px-2 py-1 font-mono text-[11px] text-fg/70">
                  {s}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
