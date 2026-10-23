export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      {!compact && (
        <span>
          Signal<span className="brand-light">Proof</span>
          <span className="brand-dot">.</span>
        </span>
      )}
    </span>
  );
}
