import React from "react";

const Icon = ({ children, size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

/**
 * Top navigation / global toolbar:
 * - Branding block with subtle gradient glow
 * - Breadcrumb for current context
 * - Action cluster (import positions button, demo dropdown, demo badge)
 */
const TopNav = ({
  breadcrumb,
  onUploadClick,
  positionsLoading,
  demoMode,
  demoPortfolios = [],
  activeDemo,
  onSelectDemo,
  onExitDemo,
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <header
      className="top-nav sticky top-0 z-40 backdrop-blur-xl bg-black/50 border-b border-white/5 px-6 py-3.5 shadow-xl"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        gap: "16px",
        minHeight: "76px",
      }}
    >
      {/* Glow accent behind logo */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: "-20px auto auto 8px",
          width: "180px",
          height: "120px",
          background: "radial-gradient(circle at 30% 40%, rgba(79,140,255,0.22), transparent 55%), radial-gradient(circle at 70% 60%, rgba(88,28,135,0.18), transparent 60%)",
          filter: "blur(68px)",
          opacity: 0.6,
          pointerEvents: "none",
          zIndex: -1,
        }}
      />

      {/* LEFT: Branding + breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "12px",
            background: "linear-gradient(135deg, rgba(79,140,255,0.22), rgba(45,212,191,0.18))",
            border: "1px solid rgba(255,255,255,0.06)",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 8px 30px rgba(79,140,255,0.25)",
            flexShrink: 0,
          }}
        >
          <Icon size={22}>
            <path d="M6 15L12 5l6 10" />
            <path d="M8 14h8" />
            <circle cx="12" cy="18" r="1.2" />
          </Icon>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontWeight: 700, fontSize: "18px", letterSpacing: "0.2px", whiteSpace: "nowrap" }}>Saxton PI</span>
            <span className="muted" style={{ fontSize: "13px" }}>
              Portfolio Intelligence
            </span>
          </div>
          {breadcrumb ? (
            <span className="label-sm" style={{ color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {breadcrumb}
            </span>
          ) : null}
        </div>
      </div>

      {/* CENTER: Empty (market data feature removed) */}
      <div />

      {/* RIGHT: Action cluster */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "flex-end" }}>
        {/* Import positions button */}
        <button
          className="btn btn-primary"
          onClick={onUploadClick}
          style={{ minWidth: "150px", display: "flex", gap: "8px", alignItems: "center" }}
        >
          <Icon>
            <path d="M12 16V8" />
            <path d="M8 12l4-4 4 4" />
            <path d="M4 16h16" />
          </Icon>
          {positionsLoading ? "Importing..." : "Import positions"}
        </button>

        {/* Demo dropdown + badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", position: "relative" }}>
          <button
            className="btn btn-ghost"
            onClick={() => setMenuOpen((o) => !o)}
            title="Load sample portfolios to explore analytics."
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Icon>
              <path d="M4 6h16" />
              <path d="M4 12h16" />
              <path d="M4 18h16" />
            </Icon>
            <span className="label-sm">Demo portfolios</span>
          </button>
          {demoMode && (
            <span
              className="label-sm"
              style={{
                background: "rgba(239,68,68,0.18)",
                color: "#fca5a5",
                border: "1px solid rgba(239,68,68,0.5)",
                borderRadius: 999,
                padding: "6px 10px",
                letterSpacing: "0.4px",
                fontWeight: 700,
              }}
            >
              IN DEMO
            </span>
          )}
          {menuOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "110%",
                background: "rgba(16,23,38,0.95)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "12px",
                boxShadow: "0 18px 36px rgba(0,0,0,0.4)",
                minWidth: 280,
                zIndex: 50,
                padding: "8px",
              }}
            >
              {demoPortfolios.map((demo) => (
                <button
                  key={demo.id}
                  className="btn btn-ghost"
                  style={{
                    width: "100%",
                    textAlign: "left",
                    justifyContent: "flex-start",
                    marginBottom: "6px",
                    borderColor: demo.id === activeDemo ? "rgba(79,140,255,0.5)" : "var(--border-subtle)",
                    background: demo.id === activeDemo ? "rgba(79,140,255,0.12)" : "transparent",
                  }}
                  onClick={() => {
                    onSelectDemo?.(demo);
                    setMenuOpen(false);
                  }}
                  title={demo.description}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontWeight: 700 }}>{demo.name}</span>
                    <span className="muted" style={{ fontSize: "12px" }}>
                      {demo.description}
                    </span>
                  </div>
                </button>
              ))}
              {demoMode && (
                <button className="btn" style={{ width: "100%", marginTop: 4 }} onClick={() => { onExitDemo?.(); setMenuOpen(false); }}>
                  Exit demo
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Animated bottom accent */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 2,
          background: "linear-gradient(90deg, rgba(79,140,255,0.4), rgba(14,165,233,0.45), rgba(79,140,255,0.4))",
          boxShadow: "0 0 12px rgba(79,140,255,0.45)",
          opacity: 0.95,
        }}
      />
    </header>
  );
};

export default TopNav;
