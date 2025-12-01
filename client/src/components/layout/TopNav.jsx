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
 * - Action cluster (upload, guide, demo toggle, theme, notifications, avatar)
 */
const TopNav = ({
  breadcrumb,
  onUploadClick,
  onGuideClick,
  positionsLoading,
  demoMode,
  onToggleDemo,
}) => {
  return (
    <header
      className="top-nav"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        backdropFilter: "blur(12px)",
        background: "rgba(12, 17, 28, 0.7)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        minHeight: "76px",
        display: "flex",
        alignItems: "center",
        padding: "14px 24px",
        boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
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

      {/* Branding + breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1 }}>
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
          }}
        >
          <Icon size={22}>
            <path d="M6 15L12 5l6 10" />
            <path d="M8 14h8" />
            <circle cx="12" cy="18" r="1.2" />
          </Icon>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontWeight: 700, fontSize: "18px", letterSpacing: "0.2px" }}>Saxton PI</span>
            <span className="muted" style={{ fontSize: "13px" }}>
              Portfolio Intelligence
            </span>
          </div>
          {breadcrumb ? (
            <span className="label-sm" style={{ color: "#9ca3af" }}>
              {breadcrumb}
            </span>
          ) : null}
        </div>
      </div>

      {/* Action cluster */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
            {positionsLoading ? "Uploading..." : "Upload positions"}
          </button>
          <button
            className="btn btn-ghost"
            onClick={onGuideClick}
            title="How to format files"
            style={{ display: "flex", gap: "6px", alignItems: "center" }}
          >
            <Icon>
              <path d="M12 6h0" />
              <path d="M9 10h3" />
              <path d="M9 14h6" />
              <rect x="5" y="4" width="14" height="16" rx="2" ry="2" />
            </Icon>
            <span className="label-sm">How to format files</span>
          </button>
        </div>

        {/* Demo toggle */}
        <label
          className="btn btn-ghost"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 10px",
            border: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <Icon>
            <path d="M8 21V11l-5 3 9-11 9 11-5-3v10" />
          </Icon>
          <span className="label-sm">Demo mode</span>
          <div
            onClick={onToggleDemo}
            style={{
              position: "relative",
              width: 38,
              height: 18,
              borderRadius: 999,
              background: demoMode ? "rgba(79,140,255,0.6)" : "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.12)",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 2,
                left: demoMode ? 20 : 2,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#0b1020",
                boxShadow: "0 6px 14px rgba(0,0,0,0.35)",
                transition: "all 0.2s ease",
              }}
            />
          </div>
        </label>

        {/* Theme toggle (stub) */}
        <button className="icon-btn" title="Toggle theme" style={iconBtnStyle}>
          <Icon>
            <path d="M12 3v2" />
            <path d="M12 19v2" />
            <path d="M5 12H3" />
            <path d="M21 12h-2" />
            <path d="M17.657 6.343 16.243 7.757" />
            <path d="m7.757 16.243-1.414 1.414" />
            <path d="m6.343 6.343 1.414 1.414" />
            <path d="m16.243 16.243 1.414 1.414" />
            <circle cx="12" cy="12" r="4" />
          </Icon>
        </button>

        {/* Notifications */}
        <button className="icon-btn" title="Notifications" style={iconBtnStyle}>
          <Icon>
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </Icon>
        </button>

        {/* User avatar */}
        <button
          className="icon-btn"
          title="User menu"
          style={{
            ...iconBtnStyle,
            width: 40,
            height: 40,
            borderRadius: "12px",
            background: "linear-gradient(135deg, rgba(79,140,255,0.2), rgba(14,165,233,0.22))",
          }}
        >
          <span style={{ fontWeight: 700, fontSize: "14px" }}>DS</span>
        </button>
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

const iconBtnStyle = {
  width: 38,
  height: 38,
  borderRadius: "10px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  display: "grid",
  placeItems: "center",
  color: "#e5e7eb",
  transition: "all 0.2s ease",
};

export default TopNav;
