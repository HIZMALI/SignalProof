import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { examples } from "./data/examples";
import { analyzeChannel } from "./domain/channels/analysis";
import { copyText, downloadText } from "./lib/export";

vi.mock("./lib/export", () => ({ copyText: vi.fn(), downloadText: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(copyText).mockResolvedValue(true);
});

async function openChannels(corrected = true) {
  const user = userEvent.setup();
  render(<App />);
  if (corrected)
    await user.click(screen.getByRole("button", { name: "Corrected closure" }));
  await user.click(screen.getByRole("button", { name: "Channel Lab" }));
  return user;
}

describe("Channel Lab workflows", () => {
  it("is discoverable from the editor and shows missing source facts transparently", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      screen.getByRole("button", { name: "What your audience sees" }),
    );
    const source = screen.getByLabelText("Source announcement status");
    expect(
      within(source).getByText("3 errors · 2 warnings"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Source missing")).toHaveLength(3);
    expect(screen.getByTestId("sms-message")).toHaveTextContent(
      "[missing: alternativeLocation]",
    );
    expect(
      screen.getByText("Source review still required."),
    ).toBeInTheDocument();
  });
  it("switches demos seamlessly inside the Channel Lab", async () => {
    const user = await openChannels(false);
    await user.click(screen.getByRole("button", { name: "Corrected closure" }));
    expect(
      screen.getByRole("heading", { name: "One message. Three realities." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Applicable source checks passed"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Included")).toHaveLength(8);
    expect(
      screen.getByRole("heading", { name: "Review recommended" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Email/ }));
    await user.click(
      screen.getByRole("button", { name: "Class cancellation" }),
    );
    expect(screen.getByTestId("email-body")).toHaveTextContent(
      examples[2].draft.eventName,
    );
    expect(screen.getAllByText("Included")).toHaveLength(7);
    await user.click(screen.getByRole("button", { name: "Service outage" }));
    expect(screen.getByTestId("email-body")).toHaveTextContent(
      examples[3].draft.serviceName,
    );
  });
  it("reveals omitted facts only when the explicit SMS loss test is enabled", async () => {
    const user = await openChannels();
    const original = screen.getByTestId("sms-message").textContent!;
    await user.click(
      screen.getByRole("checkbox", { name: "Stress test: first segment only" }),
    );
    expect(
      screen.getByText("Intentional information loss test"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("sms-message").textContent!.length).toBeLessThan(
      original.length,
    );
    expect(screen.getAllByText("Omitted").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "Needs attention" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Applicable source checks passed"),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("checkbox", { name: "Stress test: first segment only" }),
    );
    expect(screen.getByTestId("sms-message").textContent).toBe(original);
  });
  it("expands full push content while keeping collapsed visibility separate", async () => {
    const user = await openChannels();
    await user.click(screen.getByRole("tab", { name: /Push notification/ }));
    expect(screen.getByTestId("push-body")).not.toHaveTextContent(
      examples[1].draft.contact,
    );
    expect(screen.getAllByText("Hidden").length).toBeGreaterThan(0);
    for (const label of screen.getAllByText("Hidden"))
      expect(label).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Expand full notification" }),
    );
    expect(screen.getByTestId("push-body")).toHaveTextContent(
      examples[1].draft.contact,
    );
    expect(screen.getAllByText("Hidden").length).toBeGreaterThan(0);
    for (const label of screen.getAllByText("Hidden"))
      expect(label).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Collapse notification" }),
    );
    const compact = screen.getByTestId("push-body").textContent!;
    await user.selectOptions(
      screen.getByLabelText("Generic card preset"),
      "roomy",
    );
    expect(screen.getByTestId("push-body").textContent!.length).toBeGreaterThan(
      compact.length,
    );
    await user.selectOptions(
      screen.getByLabelText("Lead the body with"),
      "details-first",
    );
    expect(screen.getByTestId("push-body").textContent).toMatch(/^Closed:/);
  });
  it("keeps the selected channel on return and updates all channels from one edited source", async () => {
    const user = await openChannels();
    await user.click(screen.getByRole("tab", { name: /Push notification/ }));
    await user.selectOptions(
      screen.getByLabelText("Generic card preset"),
      "roomy",
    );
    await user.click(screen.getByRole("button", { name: "Edit source" }));
    fireEvent.change(
      screen.getByLabelText("Announcement title", { exact: false }),
      { target: { value: "Updated Gate Plan" } },
    );
    await user.click(screen.getByRole("button", { name: "Channel Lab" }));
    expect(
      screen.getByRole("tab", { name: /Push notification/ }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Generic card preset")).toHaveValue("roomy");
    expect(screen.getByTestId("push-title")).toHaveTextContent(
      "Updated Gate Plan",
    );
    await user.click(screen.getByRole("tab", { name: /SMS/ }));
    expect(screen.getByTestId("sms-message")).toHaveTextContent(
      "Updated Gate Plan",
    );
    await user.click(screen.getByRole("tab", { name: /Email/ }));
    expect(screen.getByTestId("email-subject")).toHaveTextContent(
      "Updated Gate Plan",
    );
  });
  it("focuses the source field from semantic coverage inspection", async () => {
    const user = await openChannels();
    await user.click(
      screen.getByRole("button", { name: "Alternative entrance" }),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(
      screen.getByLabelText("Alternative entrance", { exact: false }),
    ).toHaveFocus();
  });
  it("supports keyboard channel switching and preserves accessible tab focus", async () => {
    const user = await openChannels();
    await user.click(screen.getByRole("tab", { name: /SMS/ }));
    await user.keyboard("{ArrowRight}");
    expect(
      screen.getByRole("tab", { name: /Push notification/ }),
    ).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: /Email/ })).toHaveFocus();
    expect(screen.getByTestId("email-subject")).toHaveTextContent(
      examples[1].draft.title,
    );
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: /SMS/ })).toHaveFocus();
  });
  it("copies the exact SMS and full push payload rather than only the collapsed card", async () => {
    const user = await openChannels();
    await user.click(screen.getByRole("button", { name: "Copy SMS text" }));
    expect(copyText).toHaveBeenLastCalledWith(
      analyzeChannel(examples[1].draft, "sms").payload.body.text,
    );
    await user.click(screen.getByRole("tab", { name: /Push notification/ }));
    await user.click(
      screen.getByRole("button", { name: "Copy full push payload" }),
    );
    expect(copyText).toHaveBeenLastCalledWith(
      expect.stringContaining(examples[1].draft.contact),
    );
    expect(copyText).toHaveBeenLastCalledWith(
      expect.stringContaining("Title: North Gate closure"),
    );
  });
  it("copies email subject/body separately and downloads the complete payload", async () => {
    const user = await openChannels();
    await user.click(screen.getByRole("tab", { name: /Email/ }));
    await user.click(screen.getByRole("button", { name: "Copy subject" }));
    expect(copyText).toHaveBeenLastCalledWith(examples[1].draft.title);
    await user.click(screen.getByRole("button", { name: "Copy body" }));
    expect(copyText).toHaveBeenLastCalledWith(
      analyzeChannel(examples[1].draft, "email").payload.body.text,
    );
    await user.click(screen.getByRole("button", { name: "Download .txt" }));
    expect(downloadText).toHaveBeenCalledWith(
      expect.stringContaining("Subject: North Gate closure"),
      "North Gate closure-email",
    );
    await user.click(screen.getByRole("button", { name: "Mobile" }));
    expect(screen.getByRole("button", { name: "Mobile" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
  it("handles clipboard failure without losing the simulation", async () => {
    const user = await openChannels();
    vi.mocked(copyText).mockResolvedValue(false);
    await user.click(screen.getByRole("button", { name: "Copy SMS text" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Clipboard access is unavailable",
    );
    expect(screen.getByTestId("sms-message")).toBeInTheDocument();
  });
  it("filters channel findings and expands passed explanations", async () => {
    const user = await openChannels();
    const findings = screen.getByLabelText("Channel findings");
    await user.click(within(findings).getByRole("button", { name: "Errors" }));
    expect(within(findings).getByText(/No open errors/)).toBeInTheDocument();
    await user.click(
      within(findings).getByRole("button", { name: /passed channel checks/ }),
    );
    expect(
      within(findings).getByText("CH-SMS-001-alternativeLocation"),
    ).toBeInTheDocument();
  });
});
