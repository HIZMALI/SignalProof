import {
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  CircleHelp,
  FlaskConical,
  History,
  LockKeyhole,
  Plus,
  Radio,
  Sparkles,
  Smartphone,
  ClipboardCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { Brand } from "./Brand";

export type View = "lab" | "channels" | "history" | "rules" | "review";

interface Props {
  children: ReactNode;
  view: View;
  onNavigate: (view: View) => void;
  onNewDraft: () => void;
  onHelp: (trigger?: HTMLElement) => void;
  historyCount: number;
}

export function Shell({
  children,
  view,
  onNavigate,
  onNewDraft,
  onHelp,
  historyCount,
}: Props) {
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          const main = document.getElementById("main-content");
          main?.focus();
          main?.scrollIntoView({ block: "start", behavior: "instant" });
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar">
        <a
          className="brand-link"
          href="#main-content"
          aria-label="SignalProof announcement lab"
          onClick={(event) => {
            event.preventDefault();
            onNavigate("lab");
          }}
        >
          <Brand />
        </a>
        <div className="workspace-card">
          <span className="workspace-icon">
            <FlaskConical size={18} />
          </span>
          <div>
            <strong>My workspace</strong>
            <span>Personal sandbox</span>
          </div>
          <span className="workspace-indicator" />
        </div>
        <p className="nav-caption">WORKSPACE</p>
        <nav aria-label="Primary navigation">
          <button
            className={`nav-item ${view === "lab" ? "active" : ""}`}
            aria-label="Announcement lab"
            aria-current={view === "lab" ? "page" : undefined}
            onClick={() => onNavigate("lab")}
          >
            <FlaskConical size={18} />
            <span>Announcement lab</span>
            <ChevronRight size={15} />
          </button>
          <button
            className={`nav-item ${view === "channels" ? "active" : ""}`}
            aria-label="Channel Lab"
            aria-current={view === "channels" ? "page" : undefined}
            onClick={() => onNavigate("channels")}
          >
            <Smartphone size={18} />
            <span>Channel Lab</span>
            <span className="nav-new">NEW</span>
          </button>
          <button
            className={`nav-item ${view === "history" ? "active" : ""}`}
            aria-label="Validation history"
            aria-current={view === "history" ? "page" : undefined}
            onClick={() => onNavigate("history")}
          >
            <History size={18} />
            <span>Validation history</span>
            {historyCount > 0 && (
              <span className="nav-count">{historyCount}</span>
            )}
          </button>
          <button
            className={`nav-item ${view === "review" ? "active" : ""}`}
            aria-label="Review & Evidence"
            aria-current={view === "review" ? "page" : undefined}
            onClick={() => onNavigate("review")}
          >
            <ClipboardCheck size={18} />
            <span>Review & Evidence</span>
          </button>
          <button
            className={`nav-item ${view === "rules" ? "active" : ""}`}
            aria-label="Rulebook"
            aria-current={view === "rules" ? "page" : undefined}
            onClick={() => onNavigate("rules")}
          >
            <BookOpen size={18} />
            <span>Rulebook</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="small-eyebrow">
              <Sparkles size={14} /> BUILT FOR CLARITY
            </span>
            <p>
              Better announcements.
              <br />
              Fewer unanswered questions.
            </p>
            <button onClick={(event) => onHelp(event.currentTarget)}>
              Meet your pre-send lab <ArrowUpRight size={14} />
            </button>
          </div>
          <button
            className="sidebar-help"
            onClick={(event) => onHelp(event.currentTarget)}
          >
            <CircleHelp size={17} /> How SignalProof works
          </button>
          <div className="sidebar-local">
            <span>
              <LockKeyhole size={14} /> Local workspace
            </span>
            <span className="build-tag">BUILD 04</span>
          </div>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <div className="mobile-brand">
            <Brand compact />
          </div>
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>
              {view === "lab"
                ? "Announcement lab"
                : view === "channels"
                  ? "Channel Lab"
                  : view === "history"
                    ? "Validation history"
                    : view === "review"
                      ? "Review & Evidence"
                      : "Rulebook"}
            </strong>
          </div>
          <div className="topbar-actions">
            <span className="local-indicator">
              <Radio size={13} /> Runs locally
            </span>
            <button
              className="icon-button help-button"
              aria-label="Help and limitations"
              onClick={(event) => onHelp(event.currentTarget)}
            >
              <CircleHelp size={18} />
            </button>
            <button
              className="button button-small button-secondary"
              onClick={onNewDraft}
            >
              <Plus size={15} /> New draft
            </button>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <footer className="app-footer">
          <span>
            <Brand compact /> Before you send it, prove it works.
          </span>
          <span>Decision support. Human judgment required.</span>
        </footer>
      </div>
    </div>
  );
}
