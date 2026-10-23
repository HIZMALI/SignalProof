import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import { examples } from "./data/examples";
import { STORAGE_KEY } from "./lib/storage";

describe("announcement lab workflows", () => {
  it("loads an incomplete demo with live actionable findings", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Needs attention" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "An alternative entrance" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Announcement title", { exact: false }),
    ).toHaveValue("North Gate closure");
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "63",
    );
  });

  it("loads the corrected demo and never leaves a stale passing result after an edit", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Corrected closure" }));
    expect(
      screen.getByRole("heading", { name: "Applicable checks passed" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    await user.clear(
      screen.getByLabelText("Alternative entrance", { exact: false }),
    );
    expect(
      screen.getByRole("heading", { name: "Needs attention" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "An alternative entrance" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Live changes · not yet recorded"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Final preview" }));
    expect(
      screen.getByLabelText("Generated final announcement"),
    ).toHaveTextContent("Alternative entrance: [not specified]");
  });

  it("records immutable validation snapshots, restores them, and preserves session history", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /Run validation/ }));
    await user.click(screen.getByRole("button", { name: "Corrected closure" }));
    await user.click(screen.getByRole("button", { name: /Run validation/ }));
    await user.click(
      screen.getByRole("button", { name: /Validation history/ }),
    );
    const restoreButtons = screen.getAllByRole("button", {
      name: "Restore draft",
    });
    expect(restoreButtons).toHaveLength(2);
    expect(screen.getByText("3 errors")).toBeInTheDocument();
    expect(screen.getByText("0 errors")).toBeInTheDocument();
    await user.click(restoreButtons[1]);
    expect(
      screen.getByRole("heading", { name: "Needs attention" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Alternative entrance", { exact: false }),
    ).toHaveValue("");
    await user.click(
      screen.getByRole("button", { name: /Validation history/ }),
    );
    expect(
      screen.getAllByRole("button", { name: "Restore draft" }),
    ).toHaveLength(2);
  });

  it("reopens the current saved draft and persistent evidence history on remount", async () => {
    const user = userEvent.setup();
    const app = render(<App />);
    await user.click(screen.getByRole("button", { name: "Service outage" }));
    const title = screen.getByLabelText("Announcement title", { exact: false });
    fireEvent.change(title, {
      target: { value: "Updated network maintenance" },
    });
    await user.click(screen.getByRole("button", { name: /Run validation/ }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).draft.title).toBe(
      "Updated network maintenance",
    );
    app.unmount();
    render(<App />);
    expect(
      screen.getByLabelText("Announcement title", { exact: false }),
    ).toHaveValue("Updated network maintenance");
    expect(
      screen.getByLabelText("Announcement scenario", { exact: false }),
    ).toHaveValue("outage");
    await user.click(
      screen.getByRole("button", { name: /Validation history/ }),
    );
    expect(
      screen.getByRole("heading", { name: "Updated network maintenance" }),
    ).toBeInTheDocument();
  });

  it("filters findings and focuses the correct field from a correction", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Warnings" }));
    expect(
      screen.queryByRole("heading", { name: "An alternative entrance" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Accessible route described" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Errors" }));
    const card = screen
      .getByRole("heading", { name: "An alternative entrance" })
      .closest("article")!;
    await user.click(within(card).getByRole("button", { name: "Go to field" }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(
      screen.getByLabelText("Alternative entrance", { exact: false }),
    ).toHaveFocus();
  });

  it("supports new draft and undo without discarding the previous content", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "New draft" }));
    expect(
      screen.getByLabelText("Announcement title", { exact: false }),
    ).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Undo draft change" }));
    expect(
      screen.getByLabelText("Announcement title", { exact: false }),
    ).toHaveValue("North Gate closure");
  });

  it("switches scenarios and applies their actual required fields", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(
      screen.getByLabelText("Announcement scenario", { exact: false }),
      "outage",
    );
    expect(
      screen.getByLabelText("Affected service", { exact: false }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "The affected service" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "An alternative entrance" }),
    ).not.toBeInTheDocument();
  });

  it("offers a scenario-specific rulebook and a working help dialog", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Rulebook" }));
    await user.selectOptions(
      screen.getByLabelText("Rules for scenario"),
      "cancellation",
    );
    expect(
      screen.getByRole("heading", { name: "The cancelled class or event" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "An alternative entrance" }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Help and limitations" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("Decision support, with clear limits."),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: "Close help" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("copies the exact generated announcement rather than only metadata", async () => {
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Corrected closure" }));
    await user.click(screen.getByRole("tab", { name: "Final preview" }));
    await user.click(screen.getByRole("button", { name: "Copy announcement" }));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining(examples[1].draft.alternativeLocation),
    );
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining(examples[1].draft.action),
    );
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("explains clipboard failures and keeps the preview available", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new DOMException("Denied", "NotAllowedError"),
    );
    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Final preview" }));
    await user.click(screen.getByRole("button", { name: "Copy announcement" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Clipboard access is unavailable",
    );
    expect(
      screen.getByLabelText("Generated final announcement"),
    ).toBeInTheDocument();
  });

  it("recovers gracefully from corrupted saved data and blocked writes", () => {
    localStorage.setItem(STORAGE_KEY, "{broken");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Full", "QuotaExceededError");
    });
    render(<App />);
    expect(
      screen.getByLabelText("Announcement title", { exact: false }),
    ).toHaveValue("North Gate closure");
    expect(screen.getByText("Draft is not saved")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("could not save");
  });

  it("records validation with the editor keyboard shortcut", () => {
    render(<App />);
    fireEvent.keyDown(
      screen.getByLabelText("Announcement title", { exact: false }),
      { key: "Enter", ctrlKey: true },
    );
    expect(
      screen.getByText("This version is recorded in local history"),
    ).toBeInTheDocument();
  });
});
