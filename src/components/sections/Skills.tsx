import { education } from "@/data/resume";
import SectionHeading from "./SectionHeading";
import AttentionMap from "@/components/skills/AttentionMap";

export default function Skills() {
  return (
    <section id="skills" className="relative mx-auto max-w-6xl px-4 py-28 sm:px-6 sm:py-40">
      <SectionHeading
        index="06"
        eyebrow="Toolkit"
        title={
          <>
            Skills, with <span className="text-gradient">attention</span>.
          </>
        }
      />
      <AttentionMap />
      <p data-reveal className="mt-16 text-muted">
        <span className="text-fg">{education.degree}</span> — {education.school}, {education.period}
      </p>
    </section>
  );
}
