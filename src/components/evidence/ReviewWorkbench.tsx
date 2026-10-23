import {
  ClipboardCheck,
  FileText,
  GitCompareArrows,
  History,
  Plus,
} from "lucide-react";
import type { EvidenceStore, ReviewRecord } from "../../domain/evidence/types";
import { BackupPanel } from "./BackupPanel";
import { ComparisonView } from "./ComparisonView";
import { EvidenceReport } from "./EvidenceReport";
import { ManualReview } from "./ManualReview";

export type ReviewSection = "review" | "compare" | "report" | "backup";
interface Props {
  data: EvidenceStore;
  currentKey: string;
  selectedId: string;
  section: ReviewSection;
  beforeId: string;
  afterId: string;
  locked: boolean;
  persisted: boolean;
  onSection: (section: ReviewSection) => void;
  onSelect: (id: string) => void;
  onCompare: (before: string, after: string) => void;
  onCurrent: () => void;
  onDemo: () => void;
  onReview: (record: ReviewRecord) => void;
  onRecompute: () => void;
  onImport: (data: EvidenceStore) => void;
  onClear: () => void;
  onNotice: (message: string) => void;
}
const sections = [
  { id: "review", label: "Human review", icon: ClipboardCheck },
  { id: "compare", label: "Compare versions", icon: GitCompareArrows },
  { id: "report", label: "Evidence report", icon: FileText },
  { id: "backup", label: "Backup & restore", icon: History },
] as const;
export function ReviewWorkbench(props: Props) {
  const { data, section, currentKey } = props;
  const snapshot =
    data.snapshots.find((s) => s.id === props.selectedId) ?? data.snapshots[0];
  const before = data.snapshots.find((s) => s.id === props.beforeId);
  const after = data.snapshots.find((s) => s.id === props.afterId);
  return (
    <div
      className={`review-workbench ${section === "report" ? "report-active" : ""}`}
    >
      <div className="page-heading channel-page-heading screen-only">
        <div>
          <span className="eyebrow">
            <span className="eyebrow-line" /> THE REVIEW & EVIDENCE LAB
          </span>
          <h1>
            Make the review <span>visible.</span>
          </h1>
          <p>Keep what was checked. See what changed. Record human judgment.</p>
        </div>
        <span className="simulation-badge">LOCAL · SELF-ATTESTED</span>
      </div>
      <div className="review-journey screen-only">
        <div>
          <span>01 Record</span>
          <span>02 Compare</span>
          <span>03 Review</span>
          <span>04 Evidence</span>
        </div>
        <button className="button button-secondary" onClick={props.onDemo}>
          Create two demo snapshots
        </button>
      </div>
      <div className="evidence-workspace-note screen-only">
        {props.persisted
          ? "Evidence saved in this browser"
          : "Evidence currently in memory — export a backup"}{" "}
        · Local device clock · No external audit guarantee
      </div>
      <div
        className="review-tabs screen-only"
        role="tablist"
        aria-label="Review and evidence sections"
      >
        {sections.map(({ id, label, icon: Icon }, index) => (
          <button
            key={id}
            id={`review-tab-${id}`}
            role="tab"
            aria-selected={section === id}
            tabIndex={section === id ? 0 : -1}
            aria-controls="review-section"
            onClick={() => props.onSection(id)}
            onKeyDown={(e) => {
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                const next =
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? 3
                      : (index + (e.key === "ArrowRight" ? 1 : 3)) % 4;
                props.onSection(sections[next].id);
                document
                  .getElementById(`review-tab-${sections[next].id}`)
                  ?.focus();
              }
            }}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="review-section"
        aria-labelledby={`review-tab-${section}`}
      >
        {section === "backup" ? (
          <BackupPanel
            data={data}
            locked={props.locked}
            onImport={props.onImport}
            onClear={props.onClear}
            onNotice={props.onNotice}
          />
        ) : (
          <>
            {(section === "review" || section === "report") && (
              <div className="evidence-selection screen-only">
                <div className="form-field">
                  <label htmlFor="review-snapshot">Recorded snapshot</label>
                  <select
                    id="review-snapshot"
                    value={snapshot?.id ?? ""}
                    onChange={(e) => props.onSelect(e.target.value)}
                  >
                    {!data.snapshots.length && (
                      <option value="">No recorded snapshots</option>
                    )}
                    {data.snapshots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.draft.title || "Untitled"} ·{" "}
                        {s.origin === "demo" ? "Demo · " : ""}
                        {s.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className="button button-secondary"
                  onClick={props.onCurrent}
                >
                  <Plus size={14} /> Record current draft
                </button>
              </div>
            )}
            {section === "compare" ? (
              <ComparisonView
                snapshots={data.snapshots}
                reviews={data.reviews}
                beforeId={props.beforeId}
                afterId={props.afterId}
                onSelect={props.onCompare}
                onReport={(id) => {
                  props.onSelect(id);
                  props.onSection("report");
                }}
              />
            ) : !snapshot ? (
              <div className="panel empty-state">
                <ClipboardCheck size={32} />
                <h2>Start with a recorded version.</h2>
                <p>
                  Capture the current draft, or create two illustrative demo
                  snapshots. Human reviews are never prefilled.
                </p>
                <button
                  className="button button-primary"
                  onClick={props.onCurrent}
                >
                  Record first snapshot
                </button>
              </div>
            ) : section === "review" ? (
              <ManualReview
                key={snapshot.id}
                snapshot={snapshot}
                reviews={data.reviews}
                currentKey={currentKey}
                onRecord={props.onReview}
                onRecompute={props.onRecompute}
                onReport={() => props.onSection("report")}
              />
            ) : (
              <EvidenceReport
                key={`${snapshot.id}-${props.beforeId}-${props.afterId}`}
                snapshot={snapshot}
                reviews={data.reviews}
                currentKey={currentKey}
                comparison={before && after ? { before, after } : undefined}
                onNotice={props.onNotice}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
