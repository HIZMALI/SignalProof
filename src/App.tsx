import {
  ArrowDownRight,
  Check,
  CircleAlert,
  Smartphone,
  RotateCcw,
  TriangleAlert,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Editor } from "./components/Editor";
import { DemoExamples } from "./components/DemoExamples";
import { ChannelLab } from "./components/channels/ChannelLab";
import type { ChannelOptions, ChannelType } from "./domain/channels/types";
import { DEFAULT_CHANNEL_OPTIONS } from "./domain/channels/generation";
import type { EditorTab } from "./components/Editor";
import { HelpDialog } from "./components/HelpDialog";
import { History } from "./components/History";
import { ReviewWorkbench } from "./components/evidence/ReviewWorkbench";
import type { ReviewSection } from "./components/evidence/ReviewWorkbench";
import { Results } from "./components/Results";
import { Rulebook } from "./components/Rulebook";
import { Shell } from "./components/Shell";
import type { View } from "./components/Shell";
import { examples, getInitialDraft } from "./data/examples";
import { createEmptyDraft } from "./domain/scenarios";
import type { Draft, FieldKey } from "./domain/types";
import type {
  EvidenceSnapshot,
  EvidenceStore,
  ReviewRecord,
} from "./domain/evidence/types";
import {
  canonicalSerialize,
  createSnapshot,
  emptyEvidence,
  evaluateEvidence,
} from "./domain/evidence/snapshot";
import {
  appendReview,
  appendSnapshot,
  HISTORY_KEY,
  LEGACY_HISTORY_KEY,
  loadEvidence,
  MAX_HISTORY_CHARS,
  MAX_RECORD_CHARS,
  mergeEvidence,
  parseEvidence,
  saveEvidence,
} from "./lib/evidenceStorage";
import { validateAnnouncement } from "./domain/validation";
import { loadDraft, saveDraft } from "./lib/storage";
const routeView = (): View | null => {
  const value = window.location.hash.slice(1);
  return ["lab", "channels", "history", "review", "rules"].includes(value)
    ? (value as View)
    : null;
};

export default function App() {
  const [loaded] = useState(loadDraft);
  const [historyLoad] = useState(loadEvidence);
  const [draft, setDraft] = useState<Draft>(
    () => loaded.draft || getInitialDraft(),
  );
  const [view, setView] = useState<View>(() => routeView() ?? "lab");
  const [channel, setChannel] = useState<ChannelType>("sms");
  const [channelOptions, setChannelOptions] = useState<ChannelOptions>({
    ...DEFAULT_CHANNEL_OPTIONS,
  });
  const [tab, setTab] = useState<EditorTab>("edit");
  const [evidence, setEvidence] = useState(historyLoad.data);
  const [historyWarning, setHistoryWarning] = useState(historyLoad.warning);
  const [historyLocked, setHistoryLocked] = useState(historyLoad.locked);
  const [historySaved, setHistorySaved] = useState(!historyLoad.warning);
  const persistedRevision = useRef(historyLoad.data.revision);
  const [reviewSection, setReviewSection] = useState<ReviewSection>("review");
  const [selectedSnapshot, setSelectedSnapshot] = useState("");
  const [comparisonBefore, setComparisonBefore] = useState(
    historyLoad.data.snapshots[1]?.id ?? "",
  );
  const [comparisonAfter, setComparisonAfter] = useState(
    historyLoad.data.snapshots[0]?.id ?? "",
  );
  const [help, setHelp] = useState(false);
  const helpTrigger = useRef<HTMLElement | null>(null);
  const [saved, setSaved] = useState(true);
  const [notice, setNotice] = useState<string | null>(loaded.notice);
  const [undo, setUndo] = useState<Draft | null>(null);
  const result = useMemo(() => validateAnnouncement(draft), [draft]);
  const currentKey = useMemo(
    () => canonicalSerialize(evaluateEvidence(draft, channelOptions)),
    [draft, channelOptions],
  );
  const runs = evidence.snapshots;
  const latest = runs[0];
  const isRecorded = !!latest && latest.contentKey === currentKey;
  const latestCompletedReview = evidence.reviews.find(
    (review) => review.status === "completed",
  );
  const needsReview =
    !!latestCompletedReview &&
    !evidence.reviews.some(
      (review) =>
        review.status === "completed" && review.contentKey === currentKey,
    );

  useEffect(() => {
    const restoreRoute = () => {
      const next = routeView();
      if (next) {
        setView(next);
        setNotice(null);
        document.getElementById("main-content")?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("hashchange", restoreRoute);
    return () => window.removeEventListener("hashchange", restoreRoute);
  }, []);

  useEffect(() => {
    const success = saveDraft(draft);
    setSaved(success);
    if (!success)
      setNotice(
        "Your browser could not save this draft. Keep this tab open and download a copy before leaving.",
      );
  }, [draft]);

  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (
        event.key === HISTORY_KEY ||
        event.key === LEGACY_HISTORY_KEY ||
        event.key === null
      ) {
        setHistoryLocked(true);
        setHistorySaved(false);
        setHistoryWarning(
          "History changed in another tab. Existing storage will not be overwritten. Export this tab's evidence before reloading.",
        );
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);

  function commitEvidence(next: EvidenceStore): boolean {
    if (
      next.snapshots.some(
        (snapshot) => JSON.stringify(snapshot).length > MAX_RECORD_CHARS,
      )
    ) {
      setHistoryWarning(
        "Snapshot exceeds the 400,000-character record limit. No new record was added. Shorten the draft before recording.",
      );
      return false;
    }
    if (JSON.stringify(next).length > MAX_HISTORY_CHARS) {
      setHistoryWarning(
        "Evidence exceeds the storage size limit. No new record was added. Export a backup before clearing history.",
      );
      return false;
    }
    if (!parseEvidence(JSON.stringify(next)).data) {
      setHistoryWarning(
        "This evidence could not be validated for storage. No new record was added; the editor remains available.",
      );
      return false;
    }
    setEvidence(next);
    const outcome = historyLocked
      ? {
          ok: false,
          warning:
            "Existing unreadable or changed storage is preserved. New records remain in memory; export a backup before leaving.",
          reason: "conflict",
        }
      : saveEvidence(next, persistedRevision.current);
    setHistorySaved(outcome.ok);
    setHistoryWarning(outcome.warning ?? null);
    if (outcome.ok) persistedRevision.current = next.revision;
    else if (outcome.reason === "conflict") setHistoryLocked(true);
    return true;
  }

  function replaceDraft(next: Draft, message: string, keepView = false) {
    setUndo({ ...draft });
    setDraft({ ...next });
    if (!keepView) navigate("lab");
    setTab("edit");
    setNotice(message);
  }

  function runValidation() {
    const run = createSnapshot(draft, channelOptions);
    if (!commitEvidence(appendSnapshot(evidence, run))) return;
    setSelectedSnapshot(run.id);
    setNotice(
      `Validation recorded: ${run.result.errorCount} errors, ${run.result.warningCount} warnings. Snapshot includes all three channels; see the history storage indicator.`,
    );
  }

  function openReview(id?: string, section: ReviewSection = "review") {
    if (id) setSelectedSnapshot(id);
    setReviewSection(section);
    navigate("review");
  }
  function recordForReview() {
    const snapshot = createSnapshot(draft, channelOptions);
    if (commitEvidence(appendSnapshot(evidence, snapshot))) {
      setSelectedSnapshot(snapshot.id);
      setReviewSection("review");
      navigate("review");
    }
  }
  function createDemoEvidence() {
    const before = createSnapshot(examples[0].draft, DEFAULT_CHANNEL_OPTIONS, {
      origin: "demo",
    });
    const after = createSnapshot(examples[1].draft, DEFAULT_CHANNEL_OPTIONS, {
      origin: "demo",
    });
    if (
      !commitEvidence(appendSnapshot(appendSnapshot(evidence, before), after))
    )
      return;
    setComparisonBefore(before.id);
    setComparisonAfter(after.id);
    setSelectedSnapshot(after.id);
    setReviewSection("compare");
    navigate("review");
    setNotice(
      "Two illustrative demo snapshots recorded from the real rules engine. No human review was fabricated; your current draft is unchanged.",
    );
  }
  function restoreSnapshot(snapshot: EvidenceSnapshot) {
    setChannelOptions({ ...snapshot.options });
    replaceDraft(
      snapshot.draft,
      "History snapshot restored. Source and channels are revalidated under the current rules; the original evidence is unchanged.",
    );
  }
  function saveReview(record: ReviewRecord) {
    try {
      if (commitEvidence(appendReview(evidence, record)))
        setNotice(
          record.status === "completed"
            ? "Review completed — self-attested. This records acknowledgement only, not authorization or a safety certificate."
            : "Observations recorded for this exact snapshot. Incomplete checks remain visible.",
        );
    } catch (error) {
      setHistoryWarning(
        error instanceof Error
          ? error.message
          : "The review could not be recorded.",
      );
    }
  }
  function importEvidence(incoming: EvidenceStore) {
    const merged = mergeEvidence(evidence, incoming);
    if (!merged.data) {
      setHistoryWarning(merged.error);
      return;
    }
    if (commitEvidence(merged.data))
      setNotice(
        `Imported ${merged.added} records; ${merged.duplicates} identical duplicates skipped. Current draft preserved. Imported evidence is not authenticated.`,
      );
  }
  function clearEvidence() {
    const next = emptyEvidence();
    const result = saveEvidence(next, persistedRevision.current, true);
    if (!result.ok) {
      setHistoryWarning(
        "Evidence could not be cleared from storage. Existing records are still retained. " +
          result.warning,
      );
      return;
    }
    setEvidence(next);
    setHistoryLocked(false);
    setHistoryWarning(null);
    setHistorySaved(true);
    persistedRevision.current = 0;
    setSelectedSnapshot("");
    setComparisonBefore("");
    setComparisonAfter("");
    setNotice(
      "Local snapshots and reviews cleared after confirmation. The current draft was preserved.",
    );
  }
  function recomputeSelected() {
    const snapshot =
      evidence.snapshots.find((s) => s.id === selectedSnapshot) ??
      evidence.snapshots[0];
    if (!snapshot) return;
    const updated = createSnapshot(snapshot.draft, snapshot.options);
    if (commitEvidence(appendSnapshot(evidence, updated))) {
      setSelectedSnapshot(updated.id);
      setNotice(
        "A new version was recorded under the current rules. Historical evidence and reviews were not transferred.",
      );
    }
  }

  function fixField(field: FieldKey) {
    navigate("lab");
    setTab("edit");
    window.setTimeout(() => {
      const element = document.getElementById(`field-${field}`);
      element?.scrollIntoView({
        behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")
          .matches
          ? "instant"
          : "smooth",
        block: "center",
      });
      element?.focus({ preventScroll: true });
    }, 0);
  }

  function navigate(next: View) {
    if (routeView() !== next) window.history.pushState(null, "", `#${next}`);
    setView(next);
    setNotice(null);
    window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "instant" });
      document.getElementById("main-content")?.focus({ preventScroll: true });
    }, 0);
  }

  const demos = (
    <DemoExamples
      draft={draft}
      onLoad={(next, label) =>
        replaceDraft(
          next,
          `${label} example loaded. Demo contacts are fictional.`,
          view === "channels",
        )
      }
    />
  );

  return (
    <Shell
      view={view}
      onNavigate={navigate}
      onNewDraft={() =>
        replaceDraft(
          createEmptyDraft(draft.scenario),
          "A new draft is ready. You can undo to return to your previous draft.",
        )
      }
      onHelp={(trigger) => {
        helpTrigger.current =
          trigger ??
          (document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null);
        setHelp(true);
      }}
      historyCount={runs.length}
    >
      {historyWarning && (
        <div className="history-storage-warning screen-only" role="alert">
          <span>{historyWarning}</span>
          <button onClick={() => openReview(undefined, "backup")}>
            Backup options
          </button>
        </div>
      )}
      {needsReview && (
        <div
          className="review-outdated global-review-notice screen-only"
          role="status"
        >
          Content changed since review. Re-review required.{" "}
          <button onClick={() => openReview(latestCompletedReview.snapshotId)}>
            Inspect historical review
          </button>
        </div>
      )}
      {notice && (
        <div className="notice-banner" role="status">
          <span>
            <Check size={16} />
            {notice}
          </span>
          <div>
            {undo && (
              <button
                onClick={() => {
                  setDraft(undo);
                  setUndo(null);
                  setNotice("Previous draft restored.");
                }}
              >
                <RotateCcw size={13} /> Undo draft change
              </button>
            )}
            <button
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => setNotice(null)}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
      {view === "lab" ? (
        <>
          <div className="page-heading lab-heading">
            <div>
              <span className="eyebrow">
                <span className="eyebrow-line" /> THE ANNOUNCEMENT LAB
              </span>
              <h1>
                Send a message.
                <br className="mobile-break" /> <span>Leave no gaps.</span>
              </h1>
              <p>
                Test the details. Catch the confusion. Make every announcement
                clearer.
              </p>
            </div>
            <button
              className="button button-secondary channel-lab-cta"
              onClick={() => navigate("channels")}
            >
              <Smartphone size={15} /> What your audience sees
            </button>
          </div>
          <div className="review-discovery screen-only">
            <span>
              <strong>From a draft to a review trail.</strong> Record versions,
              compare changes and preserve human acknowledgements.
            </span>
            <button onClick={() => openReview()}>Open Review & Evidence</button>
          </div>
          <section className="metrics-grid" aria-label="Current draft overview">
            <div className="metric-card">
              <div className="metric-title">
                <span>Required fixes</span>
                <span className="metric-symbol error">
                  <CircleAlert size={17} />
                </span>
              </div>
              <div className="metric-main">
                <strong>{String(result.errorCount).padStart(2, "0")}</strong>
                <span>
                  {result.errorCount
                    ? "Details your audience needs"
                    : "All required checks pass"}
                  <ArrowDownRight size={14} />
                </span>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-title">
                <span>Worth a closer look</span>
                <span className="metric-symbol warning">
                  <TriangleAlert size={17} />
                </span>
              </div>
              <div className="metric-main">
                <strong>{String(result.warningCount).padStart(2, "0")}</strong>
                <span>
                  {result.warningCount
                    ? "Recommendations to review"
                    : "No open recommendations"}
                  <ArrowDownRight size={14} />
                </span>
              </div>
            </div>
            <div className="metric-card completeness-card">
              <div className="metric-title">
                <span>Field completeness</span>
                <span className="metric-fraction">
                  {result.completedFields} of {result.requiredFields} required
                  fields
                </span>
              </div>
              <div className="metric-main">
                <strong>
                  {result.completeness}
                  <small>%</small>
                </strong>
                <div
                  className="completeness-track"
                  role="progressbar"
                  aria-label="Required field completeness"
                  aria-valuenow={result.completeness}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: `${result.completeness}%` }} />
                </div>
              </div>
              <p>Field presence only · not a safety score</p>
            </div>
          </section>
          {demos}
          <div className="lab-grid">
            <Editor
              draft={draft}
              result={result}
              onChange={(field, value) => {
                setDraft((previous) => {
                  const next = { ...previous, [field]: value };
                  if (
                    previous.timeInterpretation &&
                    (field === "startTime" || field === "endTime")
                  ) {
                    next.timeInterpretation = {
                      ...previous.timeInterpretation,
                    };
                    delete next.timeInterpretation[
                      field === "startTime"
                        ? "startOccurrence"
                        : "endOccurrence"
                    ];
                  }
                  return next;
                });
                setUndo(null);
              }}
              onTimeZone={(timeZone, timeInterpretation) => {
                setDraft((previous) => {
                  const next = { ...previous, timeZone };
                  if (timeInterpretation)
                    next.timeInterpretation = timeInterpretation;
                  else delete next.timeInterpretation;
                  return next;
                });
                setUndo(null);
              }}
              onRun={runValidation}
              tab={tab}
              onTab={setTab}
              storageSaved={saved}
              onNotice={setNotice}
            />
            <Results
              result={result}
              onFix={fixField}
              historySaved={historySaved}
              isRecorded={isRecorded}
              onRun={runValidation}
            />
          </div>
        </>
      ) : view === "channels" ? (
        <>
          <div className="page-heading channel-page-heading">
            <div>
              <span className="eyebrow">
                <span className="eyebrow-line" /> THE MULTI-CHANNEL LAB
              </span>
              <h1>
                One message. <span>Three realities.</span>
              </h1>
              <p>
                See what survives the format. Find what your audience could
                miss.
              </p>
            </div>
            <span className="simulation-badge">SIMULATION ONLY</span>
          </div>
          {demos}
          <ChannelLab
            draft={draft}
            selected={channel}
            options={channelOptions}
            onOptions={setChannelOptions}
            onSelect={setChannel}
            onEdit={(field) => {
              if (field) fixField(field);
              else {
                setTab("edit");
                navigate("lab");
              }
            }}
            onNotice={setNotice}
          />
        </>
      ) : view === "review" ? (
        <ReviewWorkbench
          data={evidence}
          currentKey={currentKey}
          selectedId={selectedSnapshot}
          section={reviewSection}
          beforeId={comparisonBefore}
          afterId={comparisonAfter}
          locked={historyLocked}
          persisted={historySaved}
          onSection={setReviewSection}
          onSelect={setSelectedSnapshot}
          onCompare={(before, after) => {
            setComparisonBefore(before);
            setComparisonAfter(after);
          }}
          onCurrent={recordForReview}
          onDemo={createDemoEvidence}
          onReview={saveReview}
          onRecompute={recomputeSelected}
          onImport={importEvidence}
          onClear={clearEvidence}
          onNotice={setNotice}
        />
      ) : view === "history" ? (
        <History
          runs={runs}
          onBack={() => navigate("lab")}
          onRestore={restoreSnapshot}
          onReview={(id) => openReview(id)}
          onReport={(id) => openReview(id, "report")}
          onCompare={() => {
            setComparisonBefore(runs[1]?.id ?? runs[0]?.id ?? "");
            setComparisonAfter(runs[0]?.id ?? "");
            openReview(undefined, "compare");
          }}
          persisted={historySaved}
        />
      ) : (
        <Rulebook onBack={() => navigate("lab")} />
      )}
      {help && (
        <HelpDialog
          returnFocusTo={helpTrigger.current}
          onClose={() => setHelp(false)}
        />
      )}
    </Shell>
  );
}
