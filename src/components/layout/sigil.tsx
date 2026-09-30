export function Sigil({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    >
      {/* A stack of three cards, the top one offset — the deck metaphor. */}
      <path d="M4 16.5 12 20l8-3.5" strokeLinecap="round" />
      <path d="M4 12.5 12 16l8-3.5" strokeLinecap="round" />
      <rect x="6" y="4" width="12" height="9" rx="1.5" />
      <path d="m12 6.4 0.9 1.9 2.1.3-1.5 1.5.4 2.1-1.9-1-1.9 1 .4-2.1L9 8.6l2.1-.3z" fill="currentColor" stroke="none" />
    </svg>
  );
}
