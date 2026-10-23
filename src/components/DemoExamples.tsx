import { ArrowRight, Check, Sparkles } from "lucide-react";
import { examples } from "../data/examples";
import type { Draft } from "../domain/types";

export function DemoExamples({
  draft,
  onLoad,
}: {
  draft: Draft;
  onLoad: (draft: Draft, label: string) => void;
}) {
  const activeExample = examples.find(
    (e) => JSON.stringify(e.draft) === JSON.stringify(draft),
  )?.id;
  return (
    <section className="demo-strip" aria-label="Load demo examples">
      <div>
        <Sparkles size={16} />
        <span>Take it for a test drive</span>
        <span className="demo-caption">Load an example</span>
      </div>
      <div className="demo-buttons">
        {examples.map((example, index) => (
          <button
            key={example.id}
            className={activeExample === example.id ? "active" : ""}
            aria-pressed={activeExample === example.id}
            title={example.description}
            onClick={() => onLoad(example.draft, example.label)}
          >
            {index === 0 ? (
              <span className="demo-dot warning-dot" />
            ) : index === 1 ? (
              <Check size={12} />
            ) : null}
            {example.label}
            {index > 1 && <ArrowRight size={12} />}
          </button>
        ))}
      </div>
    </section>
  );
}
