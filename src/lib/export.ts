export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadText(text: string, title: string): void {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70) || "announcement";
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `signalproof-${slug}.txt`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Allow the browser to start the download before releasing the object URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
