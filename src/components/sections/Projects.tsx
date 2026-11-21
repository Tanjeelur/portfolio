import SectionHeading from "./SectionHeading";
import ProjectExplorer from "@/components/galaxy/ProjectExplorer";

export default function Projects() {
  return (
    <section id="projects" className="relative mx-auto max-w-6xl px-4 py-28 sm:px-6 sm:py-40">
      <SectionHeading
        index="03"
        eyebrow="Selected work"
        title={
          <>
            Points in my <span className="text-gradient">latent space</span>.
          </>
        }
      />
      <ProjectExplorer />
    </section>
  );
}
