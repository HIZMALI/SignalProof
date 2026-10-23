import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { containDialogTab } from "../../lib/dialogFocus";

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
  returnFocusTo,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const trigger = returnFocusTo ?? document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      window.setTimeout(() => {
        if (trigger instanceof HTMLElement && trigger.isConnected)
          trigger.focus({ preventScroll: true });
      }, 0);
    };
  }, [returnFocusTo]);
  return (
    <dialog
      ref={ref}
      className="help-dialog confirm-dialog"
      aria-labelledby="confirm-title"
      onCancel={onClose}
      onKeyDown={containDialogTab}
    >
      <button
        className="icon-button dialog-close"
        aria-label="Close confirmation"
        autoFocus
        onClick={onClose}
      >
        <X size={18} />
      </button>
      <span className="eyebrow">LOCAL EVIDENCE</span>
      <h2 id="confirm-title">{title}</h2>
      <div className="confirmation-body">{children}</div>
      <div className="review-actions">
        <button className="button button-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="button button-primary" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
