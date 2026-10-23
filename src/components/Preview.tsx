import { Check, Copy, Download, FileText, Info } from "lucide-react";
import { useState } from "react";
import type { Draft, ValidationResult } from "../domain/types";
import { copyText, downloadText } from "../lib/export";

export function Preview({
  draft,
  result,
  onNotice,
}: {
  draft: Draft;
  result: ValidationResult;
  onNotice: (message: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const success = await copyText(result.finalAnnouncement);
    setCopied(success);
    onNotice(
      success
        ? "Final announcement copied. Review it before publication."
        : "Clipboard access is unavailable. Select the preview text or download the .txt file.",
    );
  }
  return (
    <div className="preview-content">
      <div className="section-intro">
        <div>
          <h2>The announcement people will read</h2>
          <p>Generated from your current structured details.</p>
        </div>
        <FileText size={20} />
      </div>
      <div
        className={`preview-notice ${result.errorCount ? "has-errors" : ""}`}
      >
        <Info size={16} />
        <span>
          {result.errorCount
            ? "This draft has missing or invalid essentials. Resolve the errors before sharing."
            : "Rule checks support your review. Verify facts, accessibility, and authorization before sharing."}
        </span>
      </div>
      <pre
        className="announcement-paper"
        tabIndex={0}
        aria-label="Generated final announcement"
      >
        {result.finalAnnouncement}
      </pre>
      <div className="preview-actions">
        <button className="button button-secondary" onClick={copy}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copied" : "Copy announcement"}
        </button>
        <button
          className="button button-quiet"
          onClick={() => {
            downloadText(result.finalAnnouncement, draft.title);
            onNotice("Announcement downloaded as a text file.");
          }}
        >
          <Download size={15} /> Download .txt
        </button>
      </div>
      <p className="preview-footnote">
        Exporting does not send or approve this announcement. Missing fields
        remain visibly marked in the exported text.
      </p>
    </div>
  );
}
