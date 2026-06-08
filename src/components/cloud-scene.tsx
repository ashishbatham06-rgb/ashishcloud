/**
 * Luxury animated cloud scene — pure CSS/SVG, no video, no heavy libs.
 * Drifting volumetric clouds + aurora gradient + parallax depth.
 */
export function CloudScene() {
  return (
    <div aria-hidden className="cloud-scene pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Aurora gradient base */}
      <div className="absolute inset-0 cloud-aurora" />

      {/* Subtle grid */}
      <div className="absolute inset-0 bg-grid opacity-60" />

      {/* Glow orbs (depth) */}
      <div className="absolute -top-40 -left-40 size-[560px] rounded-full bg-primary/25 blur-[140px] animate-orb" />
      <div className="absolute top-10 -right-40 size-[600px] rounded-full bg-primary-glow/25 blur-[140px] animate-orb-2" />
      <div className="absolute bottom-[-200px] left-1/3 size-[520px] rounded-full bg-primary/20 blur-[140px] animate-orb" />

      {/* Drifting clouds */}
      <svg className="cloud-drift cloud-drift-1" viewBox="0 0 600 220" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="cg1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="oklch(0.95 0.04 280 / 0.85)" />
            <stop offset="60%" stopColor="oklch(0.78 0.12 280 / 0.35)" />
            <stop offset="100%" stopColor="oklch(0.4 0.18 280 / 0)" />
          </radialGradient>
        </defs>
        <ellipse cx="200" cy="110" rx="200" ry="80" fill="url(#cg1)" />
        <ellipse cx="380" cy="120" rx="170" ry="70" fill="url(#cg1)" />
      </svg>

      <svg className="cloud-drift cloud-drift-2" viewBox="0 0 600 220" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="cg2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="oklch(0.92 0.06 215 / 0.8)" />
            <stop offset="60%" stopColor="oklch(0.72 0.14 215 / 0.3)" />
            <stop offset="100%" stopColor="oklch(0.35 0.16 215 / 0)" />
          </radialGradient>
        </defs>
        <ellipse cx="220" cy="120" rx="220" ry="90" fill="url(#cg2)" />
        <ellipse cx="420" cy="100" rx="160" ry="65" fill="url(#cg2)" />
      </svg>

      <svg className="cloud-drift cloud-drift-3" viewBox="0 0 600 220" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="cg3" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="oklch(0.9 0.05 320 / 0.75)" />
            <stop offset="60%" stopColor="oklch(0.7 0.16 320 / 0.28)" />
            <stop offset="100%" stopColor="oklch(0.35 0.18 320 / 0)" />
          </radialGradient>
        </defs>
        <ellipse cx="300" cy="110" rx="260" ry="95" fill="url(#cg3)" />
      </svg>

      {/* Floating particles */}
      <div className="particles">
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} style={{ "--i": i } as React.CSSProperties} />
        ))}
      </div>

      {/* Vignette */}
      <div className="absolute inset-0 cloud-vignette" />
    </div>
  );
}
