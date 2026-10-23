export function downloadEvidence(
  content: string,
  filename: string,
  mime: "application/json" | "text/plain" = "application/json",
): boolean {
  let url: string | undefined;
  let anchor: HTMLAnchorElement | undefined;
  try {
    url = URL.createObjectURL(
      new Blob([content], { type: `${mime};charset=utf-8` }),
    );
    anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
    document.body.append(anchor);
    anchor.click();
    return true;
  } catch {
    return false;
  } finally {
    anchor?.remove();
    if (url) {
      const temporaryUrl = url;
      window.setTimeout(() => URL.revokeObjectURL(temporaryUrl), 1000);
    }
  }
}
