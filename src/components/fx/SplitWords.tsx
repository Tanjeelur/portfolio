import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";

/**
 * Splits text (and simple styled spans inside it) into masked words.
 * SmoothScroll animates `[data-split] .split-word > span` sliding up from behind the mask.
 */
function words(text: string, className: string | undefined, keyBase: string) {
  return text
    .split(/(\s+)/)
    .filter((w) => w.length)
    .map((w, i) =>
      /^\s+$/.test(w) ? (
        " "
      ) : (
        <span key={`${keyBase}${i}`} className="split-word -mb-[0.12em] inline-block overflow-hidden pb-[0.12em] align-top">
          <span className={`inline-block will-change-transform ${className ?? ""}`}>{w}</span>
        </span>
      )
    );
}

function split(node: ReactNode, key = "w"): ReactNode[] {
  // Explicit ReactNode[] return so the word arrays and the pass-through child unify
  return Children.toArray(node).flatMap((child, ci): ReactNode[] => {
    const k = `${key}-${ci}`;
    if (typeof child === "string") return words(child, undefined, k);
    if (isValidElement(child)) {
      const el = child as ReactElement<{ className?: string; children?: ReactNode }>;
      if (el.type === Fragment) return split(el.props.children, k);
      if (typeof el.props.children === "string") return words(el.props.children, el.props.className, k);
    }
    return [child];
  });
}

export default function SplitWords({ children }: { children: ReactNode }) {
  return <>{split(children)}</>;
}
