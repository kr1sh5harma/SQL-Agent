/**
 * components/Logo.tsx — Brand logo vector for SQL Agent.
 */
export function Logo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <div className={`relative flex-shrink-0 ${className}`}>
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_0_12px_rgba(37,99,235,0.45)]"
      >
        <defs>
          <linearGradient id="logoBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0c1222" />
            <stop offset="100%" stopColor="#030611" />
          </linearGradient>
          <linearGradient id="logoPrimaryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="logoCyanGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#60a5fa" />
          </linearGradient>
          <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Rounded square container */}
        <rect
          width="64"
          height="64"
          rx="16"
          fill="url(#logoBgGrad)"
          stroke="rgba(255, 255, 255, 0.16)"
          strokeWidth="1.5"
        />

        {/* Ambient glow */}
        <circle cx="32" cy="32" r="16" fill="#2563eb" opacity="0.3" filter="url(#logoGlow)" />

        {/* Database tier 3 */}
        <path
          d="M19 37 C19 41.2 24.8 44.5 32 44.5 C39.2 44.5 45 41.2 45 37 V41 C45 45.2 39.2 48.5 32 48.5 C24.8 48.5 19 45.2 19 41 Z"
          fill="url(#logoPrimaryGrad)"
          opacity="0.75"
        />

        {/* Database tier 2 */}
        <path
          d="M19 28 C19 32.2 24.8 35.5 32 35.5 C39.2 35.5 45 32.2 45 28 V32 C45 36.2 39.2 39.5 32 39.5 C24.8 39.5 19 36.2 19 32 Z"
          fill="url(#logoPrimaryGrad)"
          opacity="0.9"
        />

        {/* Database tier 1 cap */}
        <path
          d="M19 19 C19 23.2 24.8 26.5 32 26.5 C39.2 26.5 45 23.2 45 19 V23 C45 27.2 39.2 30.5 32 30.5 C24.8 30.5 19 27.2 19 23 Z"
          fill="url(#logoPrimaryGrad)"
        />
        <ellipse cx="32" cy="19" rx="13" ry="5" fill="url(#logoCyanGrad)" />

        {/* AI Query Bolt */}
        <path
          d="M34 11 L25 26.5 L32.5 26.5 L29.5 39 L40 23 L32.5 23 Z"
          fill="#ffffff"
          filter="url(#logoGlow)"
        />
      </svg>
    </div>
  );
}
