import SplitWords from "@/components/fx/SplitWords";
import DecodeText from "@/components/fx/DecodeText";

export default function SectionHeading({
  index,
  eyebrow,
  title,
}: {
  index: string;
  eyebrow: string;
  title: React.ReactNode;
}) {
  return (
    <div className="mb-12 sm:mb-16">
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-muted">
        <span className="text-cyan">{index}</span> / <DecodeText text={eyebrow.toUpperCase()} />
      </p>
      <h2 data-split className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
        <SplitWords>{title}</SplitWords>
      </h2>
    </div>
  );
}
