import { Download, FolderInput, LockKeyhole } from "lucide-react";
import { useRef, useState } from "react";
import { backupData } from "../../domain/evidence/report";
import type { EvidenceStore } from "../../domain/evidence/types";
import {
  HISTORY_KEY,
  LEGACY_HISTORY_KEY,
  MAX_BACKUP_BYTES,
  MAX_HISTORY_CHARS,
  mergeEvidence,
  parseEvidence,
} from "../../lib/evidenceStorage";
import { downloadEvidence } from "../../lib/evidenceExport";
import { ConfirmDialog } from "./ConfirmDialog";

export function BackupPanel({
  data,
  locked,
  onImport,
  onClear,
  onNotice,
}: {
  data: EvidenceStore;
  locked: boolean;
  onImport: (data: EvidenceStore) => void;
  onClear: () => void;
  onNotice: (message: string) => void;
}) {
  const [incoming, setIncoming] = useState<EvidenceStore | null>(null);
  const [error, setError] = useState("");
  const [clear, setClear] = useState(false);
  const dialogTrigger = useRef<HTMLElement | null>(null);
  const merged = incoming ? mergeEvidence(data, incoming) : null;
  async function inspect(file?: File) {
    if (!file) return;
    setError("");
    if (file.size > MAX_BACKUP_BYTES) {
      setError(
        "Backup file exceeds the 4 MB file limit. Nothing was imported.",
      );
      return;
    }
    try {
      const raw = await file.text();
      if (raw.length > MAX_HISTORY_CHARS) {
        setError("Backup exceeds the 2,000,000-character evidence limit.");
        return;
      }
      const parsed = parseEvidence(raw);
      if (!parsed.data) {
        setError(parsed.error ?? "Invalid evidence backup.");
        return;
      }
      const proposed = mergeEvidence(data, parsed.data);
      if (!proposed.data) {
        setError(proposed.error ?? "Import could not be merged.");
        return;
      }
      setIncoming(parsed.data);
    } catch {
      setError("The backup file could not be read. Nothing was imported.");
    }
  }
  return (
    <section className="panel evidence-section backup-panel">
      <span className="eyebrow">
        <LockKeyhole size={14} /> YOUR DEVICE, YOUR RECORDS
      </span>
      <h2>Back up the evidence, not a guarantee.</h2>
      <p>
        Only this browser stores these snapshots and self-provided review notes.
        A backup is portable, unverified JSON; it is not an authenticated audit
        log. The current draft is never replaced by import or clearing evidence.
      </p>
      <div className="backup-stats">
        <strong>{data.snapshots.length} / 50 snapshots</strong>
        <strong>{data.reviews.length} / 200 reviews</strong>
        <span>Storage revision {data.revision}</span>
      </div>
      <div className="review-actions">
        <button
          className="button button-primary"
          onClick={() =>
            onNotice(
              downloadEvidence(
                backupData(data),
                "signalproof-evidence-backup.json",
              )
                ? "Evidence backup downloaded. Keep it private; it is not externally authenticated."
                : "Backup download failed. This browser could not create a downloadable file.",
            )
          }
        >
          <Download size={15} /> Export evidence backup
        </button>
        <label className="button button-secondary file-input-button">
          <FolderInput size={15} /> Choose JSON backup
          <input
            type="file"
            accept="application/json,.json"
            aria-label="Import evidence backup"
            onChange={(e) => {
              dialogTrigger.current = e.currentTarget;
              void inspect(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <p className="evidence-muted">
        Up to 50 snapshots, 200 review records, 400,000 characters per snapshot,
        and 2,000,000 characters total. A new recorded snapshot beyond 50 evicts
        the oldest snapshot and its linked reviews. Imports never evict existing
        records and require confirmation. Conflicting IDs reject the whole
        import; identical duplicates are skipped.
      </p>
      {error && (
        <p className="evidence-error" role="alert">
          {error}
        </p>
      )}
      {locked && (
        <div className="evidence-note">
          <p>
            Unrecognized/corrupt storage is preserved. New records are in memory
            until you export them or explicitly clear/replace the stored
            evidence.
          </p>
          <button
            className="button button-secondary"
            onClick={() => {
              try {
                const raw =
                  localStorage.getItem(HISTORY_KEY) ??
                  localStorage.getItem(LEGACY_HISTORY_KEY);
                onNotice(
                  raw !== null &&
                    downloadEvidence(
                      JSON.stringify(
                        { kind: "unreadable-local-evidence", raw },
                        null,
                        2,
                      ),
                      "signalproof-stored-raw-data.json",
                    )
                    ? "Stored raw data downloaded as unexecuted text."
                    : "Stored data could not be downloaded.",
                );
              } catch {
                onNotice("Stored data is unavailable.");
              }
            }}
          >
            Download stored raw data
          </button>
        </div>
      )}
      <div className="backup-danger">
        <h3>Clear local evidence</h3>
        <p>
          This removes recorded snapshots and reviews after confirmation. Export
          first. Your working draft stays intact.
        </p>
        <button
          className="button button-secondary"
          onClick={(event) => {
            dialogTrigger.current = event.currentTarget;
            setClear(true);
          }}
        >
          Clear local evidence…
        </button>
      </div>
      {incoming && merged?.data && (
        <ConfirmDialog
          title="Import this evidence backup?"
          returnFocusTo={dialogTrigger.current}
          confirmLabel="Import records"
          onClose={() => setIncoming(null)}
          onConfirm={() => {
            onImport(incoming);
            setIncoming(null);
          }}
        >
          <p>
            {merged.added} new records will be merged; {merged.duplicates}{" "}
            identical duplicates skipped. Existing records will not be
            overwritten. Current working draft stays unchanged.
          </p>
          <p>
            Imported names, timestamps and results are unverified. They do not
            establish authenticity or authority.
          </p>
        </ConfirmDialog>
      )}
      {clear && (
        <ConfirmDialog
          title="Clear snapshots and reviews?"
          returnFocusTo={dialogTrigger.current}
          confirmLabel="Clear evidence only"
          onClose={() => setClear(false)}
          onConfirm={() => {
            onClear();
            setClear(false);
          }}
        >
          <p>
            All evidence currently loaded in this tab and its stored history
            will be replaced with an empty evidence store. This cannot be undone
            without a backup. Preserved legacy v1 evidence is also removed after
            this explicit confirmation.
          </p>
          <p>
            Your current draft is preserved. Export a backup before continuing.
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}
