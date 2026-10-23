import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";
import { examples } from "./data/examples";
import { saveDraft, loadDraft } from "./lib/storage";
import { HISTORY_KEY, loadEvidence } from "./lib/evidenceStorage";

describe("release time controls and accessibility", () => {
  it("rejects DST gaps, requires occurrence selection, resets choices after an edit and persists v2 metadata", async () => {
    const user = userEvent.setup();
    saveDraft(examples[1].draft);
    render(<App />);
    await user.selectOptions(screen.getByLabelText("Time zone mode"), "iana");
    expect(screen.getByLabelText("Time zone", { exact: false, selector: "input" })).toHaveValue("");
    fireEvent.change(
      screen.getByLabelText("Time zone", { exact: false, selector: "input" }),
      { target: { value: "America/New_York" } },
    );
    fireEvent.change(
      screen.getByLabelText("Closure starts", { exact: false }),
      { target: { value: "2026-03-08T02:30" } },
    );
    expect(screen.getByText(/This local time does not exist/)).toBeVisible();
    expect(
      screen.getByLabelText("Closure starts", { exact: false }),
    ).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(
      screen.getByLabelText("Closure starts", { exact: false }),
      { target: { value: "2026-11-01T01:30" } },
    );
    expect(screen.getByLabelText("Start occurrence")).toHaveValue("");
    await user.selectOptions(
      screen.getByLabelText("Start occurrence"),
      "later",
    );
    expect(loadDraft().draft?.timeInterpretation?.startOccurrence).toBe(
      "later",
    );
    expect(
      screen.getByText(/UTC-05:00 · instant 2026-11-01T06:30/),
    ).toBeVisible();
    await user.selectOptions(screen.getByLabelText("Start occurrence"), "");
    expect(
      loadDraft().draft?.timeInterpretation?.startOccurrence,
    ).toBeUndefined();
    await user.selectOptions(
      screen.getByLabelText("Start occurrence"),
      "earlier",
    );
    fireEvent.change(
      screen.getByLabelText("Closure starts", { exact: false }),
      { target: { value: "2026-11-01T01:40" } },
    );
    expect(screen.getByLabelText("Start occurrence")).toHaveValue("");
  });
  it("associates errors with fields, offers a results focus shortcut, and supports editor Home/End keys", async () => {
    const user = userEvent.setup();
    render(<App />);
    const start = screen.getByLabelText("Closure starts", { exact: false });
    expect(start.getAttribute("aria-describedby")).toContain("error-startTime");
    expect(start).toHaveAttribute("aria-required", "true");
    await user.click(
      screen.getByRole("link", { name: "Inspect current validation results" }),
    );
    expect(
      screen.getByRole("region", { name: "Current automated source results" }),
    ).toHaveFocus();
    screen.getByRole("tab", { name: "Announcement editor" }).focus();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Final preview" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(
      screen.getByRole("tab", { name: "Announcement editor" }),
    ).toHaveFocus();
  });
  it("locks evidence writes on a cross-tab change while preserving the editor and in-memory records", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /Run validation/ }));
    const raw = localStorage.getItem(HISTORY_KEY);
    fireEvent(
      window,
      new StorageEvent("storage", { key: HISTORY_KEY, newValue: raw }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("another tab");
    await user.click(screen.getByRole("button", { name: /Run validation/ }));
    expect(localStorage.getItem(HISTORY_KEY)).toBe(raw);
    expect(loadEvidence().data.snapshots).toHaveLength(1);
    await user.click(
      screen.getByRole("button", { name: "Validation history" }),
    );
    expect(
      screen.getAllByRole("button", { name: "Restore draft" }),
    ).toHaveLength(2);
    expect(screen.getByText("Memory only — export a backup")).toBeVisible();
  });
});
