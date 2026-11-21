import { profile } from "@/data/resume";
import SplitWords from "@/components/fx/SplitWords";
import DecodeText from "@/components/fx/DecodeText";
import CopyEmail from "@/components/contact/CopyEmail";

export default function Contact() {
  const links = [
    { label: "GitHub", href: profile.links.github },
    { label: "LinkedIn", href: profile.links.linkedin },
    { label: "Google Scholar", href: profile.links.scholar },
  ];
  return (
    <section id="contact" className="relative mx-auto max-w-6xl px-4 py-28 text-center sm:px-6 sm:py-40">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">
        <span className="text-cyan">07</span> / <DecodeText text="CONTACT" />
      </p>
      <h2 data-split className="mx-auto mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
        <SplitWords>
          <>
            Let&apos;s build something <span className="text-gradient">intelligent.</span>
          </>
        </SplitWords>
      </h2>
      <div data-reveal>
        <CopyEmail email={profile.email} />
      </div>
      <ul data-reveal className="mt-10 flex flex-wrap justify-center gap-3">
        {links.map((l) => (
          <li key={l.label}>
            <a
              href={l.href}
              target="_blank"
              rel="noreferrer"
              data-magnetic
              className="glass inline-block rounded-full px-5 py-2.5 text-sm transition-colors hover:border-cyan"
            >
              {l.label} ↗
            </a>
          </li>
        ))}
      </ul>
      <footer className="mt-28 font-mono text-[11px] text-muted">
        © {new Date().getFullYear()} {profile.name} · {profile.location}
      </footer>
    </section>
  );
}
