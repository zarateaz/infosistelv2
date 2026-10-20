export function YapeIcon({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Círculo morado oficial de Yape con gradiente sutil */}
      <defs>
        <linearGradient id="yapeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#872b9a" />
          <stop offset="100%" stopColor="#671978" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#yapeGrad)" />

      {/* Isotipo Yape: Tilde turquesa vibrante y óvalo blanco característico */}
      {/* Tilde turquesa / destello */}
      <path
        d="M14 26.5L20.5 33L34 16"
        stroke="#00D4B8"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Detalle de destello blanco */}
      <circle cx="34" cy="16" r="3" fill="#FFFFFF" />
      {/* Acento púrpura claro interior */}
      <circle cx="14" cy="26.5" r="2" fill="#00D4B8" />
    </svg>
  );
}

export function YapeBadge({
  titular,
  number,
}: {
  titular?: string;
  number?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs font-bold text-purple-700 dark:text-purple-300">
      <YapeIcon size={14} />
      <span>{titular || "Yape"}</span>
      {number && <span className="opacity-75 font-mono text-[11px]">{number}</span>}
    </span>
  );
}
