import { FileCheck2, ListChecks, PencilLine, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { containDialogTab } from "../lib/dialogFocus";

export function HelpDialog({
  onClose,
  returnFocusTo,
}: {
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
      className="help-dialog"
      aria-labelledby="help-title"
      onCancel={onClose}
      onKeyDown={containDialogTab}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const rect = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <button
        className="icon-button dialog-close"
        autoFocus
        aria-label="Close help"
        onClick={onClose}
      >
        <X size={19} />
      </button>
      <span className="eyebrow">YOUR PRE-SEND LAB</span>
      <h2 id="help-title">A clearer message starts here.</h2>
      <p>
        SignalProof helps you find missing information before publishing an
        important announcement.
      </p>
      <ol className="help-steps">
        <li>
          <PencilLine size={20} />
          <div>
            <strong>01. Draft with structure</strong>
            <p>
              Pick a scenario and add the facts people need. Load an example for
              a quick walkthrough.
            </p>
          </div>
        </li>
        <li>
          <ListChecks size={20} />
          <div>
            <strong>02. Check and improve</strong>
            <p>
              Findings update live. Run validation to save a snapshot in this
              browser's persistent history.
            </p>
          </div>
        </li>
        <li>
          <FileCheck2 size={20} />
          <div>
            <strong>03. Review the final announcement</strong>
            <p>
              Preview, copy, or download the message generated from your fields.
              Obtain human approval before sharing.
            </p>
          </div>
        </li>
      </ol>
      <div className="help-limits">
        <strong>NEW · Channel Lab</strong>
        <p>
          Open “What your audience sees” or Channel Lab in the navigation to
          simulate SMS, push, and email from the same draft. Compare full fact
          coverage with collapsed push visibility, inspect SMS encoding and
          segments, or deliberately test a first-segment cutoff. Edit the source
          once to update every channel.
        </p>
        <p>
          Device layouts and visibility budgets are generic approximations.
          Passing channel checks never override source errors or human review.
          No message is sent.
        </p>
      </div>
      <div className="help-limits">
        <strong>Decision support, with clear limits.</strong>
        <p>
          This rules engine checks completeness and basic consistency. It cannot
          establish real-world safety, verify facts or routes, interpret prose,
          or authorize emergency alerts. A passing check is not certification.
        </p>
        <p>
          Your current draft, version history and recorded review notes are
          stored only in this browser when storage is available. Back up
          important local evidence. Demo contact details use reserved .example
          addresses and are not real contacts.
        </p>
      </div>
      <button className="button button-primary" onClick={onClose}>
        Let’s make it clear
      </button>
    </dialog>
  );
}
