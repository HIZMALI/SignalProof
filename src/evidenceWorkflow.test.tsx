import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import { EvidenceReport } from "./components/evidence/EvidenceReport";
import { examples } from "./data/examples";
import {
  emptyReviewForm,
  manualChecklist,
  recordReview,
  snapshotIssues,
} from "./domain/evidence/review";
import { createSnapshot, emptyEvidence } from "./domain/evidence/snapshot";
import {
  appendReview,
  appendSnapshot,
  HISTORY_KEY,
  loadEvidence,
} from "./lib/evidenceStorage";
import { saveDraft, STORAGE_KEY } from "./lib/storage";
import * as exports from "./lib/export";
import * as downloads from "./lib/evidenceExport";

function reviewedStore() {
  const snapshot = createSnapshot(examples[1].draft);
  const form = {
    ...emptyReviewForm(),
    name: "Illustrative test reviewer",
    notes: "Fictional test source checked.",
  };
  for (const item of manualChecklist(snapshot)) form.checklist[item.id] = true;
  for (const issue of snapshotIssues(snapshot).filter(
    (f) => f.severity === "warning",
  ))
    form.acknowledgements[issue.key] = {
      acknowledged: true,
      note: "Test acknowledgement",
    };
  const review = recordReview(snapshot, form, "completed").record!;
  return appendReview(appendSnapshot(emptyEvidence(), snapshot), review);
}

describe("review and evidence user workflows", () => {
  it("creates real demo differences without changing the draft or inventing a reviewer", async () => {
    const user = userEvent.setup();
    render(<App />);
    const raw = localStorage.getItem(STORAGE_KEY);
    await user.click(screen.getByRole("button", { name: "Review & Evidence" }));
    await user.click(
      screen.getByRole("button", { name: "Create two demo snapshots" }),
    );
    const evidence = loadEvidence().data;
    expect(evidence.snapshots).toHaveLength(2);
    expect(evidence.reviews).toHaveLength(0);
    expect(evidence.snapshots.map((s) => s.origin)).toEqual(["demo", "demo"]);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    expect(screen.getByText("source errors resolved")).toHaveTextContent(
      "3 source errors resolved",
    );
    const before = screen.getByLabelText("Before snapshot");
    const after = screen.getByLabelText("After snapshot");
    const firstId = (before as HTMLSelectElement).value;
    const secondId = (after as HTMLSelectElement).value;
    await user.selectOptions(before, secondId);
    await user.selectOptions(after, firstId);
    expect(screen.getByText("new source issues introduced")).toHaveTextContent(
      "5 new source issues introduced",
    );
    await user.click(screen.getByRole("tab", { name: "Human review" }));
    expect(screen.getByLabelText(/Reviewer display name/)).toHaveValue("");
    expect(
      screen.getByText(/No human review was prefilled/),
    ).toBeInTheDocument();
  });

  it("blocks incomplete review, records observations, and preserves the exact snapshot on remount", async () => {
    const user = userEvent.setup();
    const app = render(<App />);
    await user.click(
      screen.getByRole("button", { name: "Open Review & Evidence" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Record first snapshot" }),
    );
    expect(
      screen.getByRole("button", { name: "Complete review — self-attest" }),
    ).toBeDisabled();
    await user.type(
      screen.getByLabelText("Review notes"),
      "Time still needs checking.",
    );
    await user.click(
      screen.getByRole("button", { name: "Record observations" }),
    );
    const saved = loadEvidence().data;
    expect(saved.reviews[0].notes).toBe("Time still needs checking.");
    expect(saved.reviews[0].status).toBe("observations");
    app.unmount();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Review & Evidence" }));
    await user.click(
      screen.getByText(/Review in progress — recorded observations/),
    );
    expect(screen.getByText("Notes: Time still needs checking.")).toBeVisible();
    expect(loadEvidence().data.snapshots[0]).toEqual(saved.snapshots[0]);
  });

  it("requires manual checks and every warning before saving a completed self-attestation", async () => {
    const user = userEvent.setup();
    saveDraft(examples[1].draft);
    render(<App />);
    await user.click(
      screen.getByRole("button", { name: "Open Review & Evidence" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Record first snapshot" }),
    );
    await user.type(
      screen.getByLabelText(/Reviewer display name/),
      "Illustrative reviewer",
    );
    const complete = screen.getByRole("button", {
      name: "Complete review — self-attest",
    });
    const checks = screen.getAllByRole("checkbox");
    for (const checkbox of checks.slice(0, -1)) await user.click(checkbox);
    expect(complete).toBeDisabled();
    await user.click(checks.at(-1)!);
    await user.type(
      screen.getByLabelText("Review notes"),
      "Fictional demo only.",
    );
    expect(complete).toBeEnabled();
    await user.click(complete);
    expect(loadEvidence().data.reviews[0]).toMatchObject({
      status: "completed",
      name: "Illustrative reviewer",
      notes: "Fictional demo only.",
    });
    expect(
      screen.getByText(
        /Review completed — self-attested · Illustrative reviewer/,
      ),
    ).toBeVisible();
  });

  it("retains review on navigation, invalidates it on channel configuration or source edits, and preserves the historical record", async () => {
    const store = reviewedStore();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(store));
    saveDraft(examples[1].draft);
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Channel Lab" }));
    await user.click(screen.getByRole("tab", { name: /Push notification/ }));
    expect(
      screen.queryByText(/Content changed since review/),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Generic card preset"), {
      target: { value: "roomy" },
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Content changed since review. Re-review required.",
    );
    fireEvent.change(screen.getByLabelText("Generic card preset"), {
      target: { value: "compact" },
    });
    expect(
      screen.queryByText(/Content changed since review/),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Announcement lab" }));
    fireEvent.change(
      screen.getByLabelText("Required action", { exact: false }),
      { target: { value: "Changed action" } },
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Content changed since review",
    );
    expect(loadEvidence().data.reviews).toEqual(store.reviews);
  });

  it("supports keyboard tab navigation and confirms imports and clearing while preserving draft.v1", async () => {
    const user = userEvent.setup();
    render(<App />);
    const draftRaw = localStorage.getItem(STORAGE_KEY);
    await user.click(
      screen.getByRole("button", { name: "Open Review & Evidence" }),
    );
    const reviewTab = screen.getByRole("tab", { name: "Human review" });
    reviewTab.focus();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Backup & restore" })).toHaveFocus();
    expect(
      screen.getByRole("tab", { name: "Backup & restore" }),
    ).toHaveAttribute("aria-selected", "true");
    const incoming = reviewedStore();
    const file = new File([JSON.stringify(incoming)], "backup.json", {
      type: "application/json",
    });
    Object.defineProperty(file, "text", {
      value: async () => JSON.stringify(incoming),
    });
    await user.upload(screen.getByLabelText("Import evidence backup"), file);
    const dialog = await screen.findByRole("dialog", {
      name: "Import this evidence backup?",
    });
    expect(loadEvidence().data.snapshots).toHaveLength(0);
    await user.click(
      within(dialog).getByRole("button", { name: "Import records" }),
    );
    expect(loadEvidence().data.snapshots).toHaveLength(1);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(draftRaw);
    await user.click(
      screen.getByRole("button", { name: "Clear local evidence…" }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancel",
      }),
    );
    expect(loadEvidence().data.snapshots).toHaveLength(1);
    await user.click(
      screen.getByRole("button", { name: "Clear local evidence…" }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Clear evidence only",
      }),
    );
    expect(loadEvidence().data.snapshots).toHaveLength(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(draftRaw);
  });

  it("leaves the editor usable when corrupt history is preserved with a visible storage warning", () => {
    localStorage.setItem(HISTORY_KEY, "{broken");
    render(<App />);
    expect(screen.getByRole("alert")).toHaveTextContent("malformed");
    const title = screen.getByLabelText("Announcement title", { exact: false });
    fireEvent.change(title, { target: { value: "Still editable" } });
    expect(title).toHaveValue("Still editable");
    expect(localStorage.getItem(HISTORY_KEY)).toBe("{broken");
  });

  it("escapes report text, copies and exports the selected snapshot, and expands complete findings for print", async () => {
    const user = userEvent.setup();
    const snapshot = createSnapshot({
      ...examples[1].draft,
      title: '<img src=x onerror="window.evil=true">',
    });
    const notice = vi.fn();
    const copy = vi.spyOn(exports, "copyText").mockResolvedValue(true);
    const download = vi
      .spyOn(downloads, "downloadEvidence")
      .mockReturnValue(true);
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const { container } = render(
      <EvidenceReport
        snapshot={snapshot}
        reviews={[]}
        currentKey={snapshot.contentKey}
        onNotice={notice}
      />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      snapshot.draft.title,
    );
    expect(container.querySelector("img")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Copy summary" }));
    expect(copy.mock.calls[0][0]).toContain(snapshot.id);
    await user.click(
      screen.getByRole("button", { name: "Export report JSON" }),
    );
    expect(JSON.parse(download.mock.calls[0][0]).snapshot.id).toBe(snapshot.id);
    await user.click(
      screen.getByRole("button", { name: "Print / Save as PDF" }),
    );
    expect(print).toHaveBeenCalledOnce();
    const details = container.querySelector<HTMLDetailsElement>("details")!;
    expect(details.open).toBe(false);
    fireEvent(window, new Event("beforeprint"));
    expect(details.open).toBe(true);
    fireEvent(window, new Event("afterprint"));
    expect(details.open).toBe(false);
    expect(
      screen.getByText(/No actual sending or delivery confirmation/),
    ).toBeInTheDocument();
  });
});
