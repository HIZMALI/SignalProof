import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadEvidence } from "./evidenceExport";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("portable evidence downloads", () => {
  it("downloads UTF-8 JSON with a sanitized filename and revokes its temporary URL", () => {
    vi.useFakeTimers();
    const create = vi.fn().mockReturnValue("blob:test-evidence");
    const revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe("evidence-unsafe-.json");
        expect(this.href).toBe("blob:test-evidence");
      });
    expect(
      downloadEvidence('{"title":"Üniversite"}', "evidence<unsafe>.json"),
    ).toBe(true);
    expect(create.mock.calls[0][0].type).toBe("application/json;charset=utf-8");
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector("a[download]")).toBeNull();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith("blob:test-evidence");
  });
  it("also cleans up when a browser blocks the download action", () => {
    vi.useFakeTimers();
    const revoke = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:blocked",
      revokeObjectURL: revoke,
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("Denied");
    });
    expect(downloadEvidence("{}", "backup.json")).toBe(false);
    expect(document.querySelector("a[download]")).toBeNull();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith("blob:blocked");
  });
  it("returns a recoverable failure if Blob URL creation is unavailable", () => {
    vi.stubGlobal("URL", {
      createObjectURL: () => {
        throw new Error("Unavailable");
      },
    });
    expect(downloadEvidence("{}", "backup.json")).toBe(false);
  });
});
