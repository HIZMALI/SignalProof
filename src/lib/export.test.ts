import { describe, expect, it, vi } from "vitest";
import { examples } from "../data/examples";
import { generateAnnouncement } from "../domain/announcement";
import { copyText, downloadText } from "./export";

describe("announcement exports", () => {
  it("copies the exact final announcement", async () => {
    const finalText = generateAnnouncement(examples[1].draft);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    expect(await copyText(finalText)).toBe(true);
    expect(writeText).toHaveBeenCalledWith(finalText);
  });

  it("handles unsupported clipboard environments", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    expect(await copyText("announcement")).toBe(false);
  });

  it("downloads a UTF-8 text blob, sanitizes filenames, and releases the URL", () => {
    vi.useFakeTimers();
    const finalText = generateAnnouncement(examples[1].draft);
    const create = vi.fn().mockReturnValue("blob:announcement");
    const revoke = vi.fn();
    const previousCreate = URL.createObjectURL;
    const previousRevoke = URL.revokeObjectURL;
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    let filename = "";
    let href = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      filename = this.download;
      href = this.href;
    });
    try {
      downloadText(finalText, "../North Gate / closure!");
      const blob = create.mock.calls[0][0] as Blob;
      expect(blob.type).toBe("text/plain;charset=utf-8");
      expect(blob.size).toBe(new TextEncoder().encode(finalText).length);
      expect(filename).toBe("signalproof-north-gate-closure.txt");
      expect(href).toBe("blob:announcement");
      expect(document.querySelector("a[download]")).toBeNull();
      expect(revoke).not.toHaveBeenCalled();
      vi.runAllTimers();
      expect(revoke).toHaveBeenCalledWith("blob:announcement");
    } finally {
      URL.createObjectURL = previousCreate;
      URL.revokeObjectURL = previousRevoke;
      vi.useRealTimers();
    }
  });
});
