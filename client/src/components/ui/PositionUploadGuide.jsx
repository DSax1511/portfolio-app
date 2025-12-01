import React from "react";
import Card from "./Card";

const PositionUploadGuide = ({ open, onClose }) => {
  if (!open) return null;

  const columns = [
    { name: "ticker", desc: "Symbol, uppercase (e.g., AAPL, MSFT)" },
    { name: "quantity", desc: "Number of shares; positive long, negative short" },
    { name: "portfolio / account", desc: "Optional portfolio/account identifier" },
    { name: "cost_basis", desc: "Optional price per share (decimal allowed)" },
    { name: "as_of", desc: "Optional date in YYYY-MM-DD" },
  ];

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)",
        zIndex: 100,
        display: "grid",
        placeItems: "center",
        padding: "20px",
      }}
      onClick={onClose}
    >
      <Card
        className="upload-guide-card"
        style={{ maxWidth: 760, width: "100%", background: "rgba(12,17,28,0.9)", border: "1px solid rgba(255,255,255,0.05)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="label-sm">Positions upload</p>
            <h3 style={{ margin: "4px 0" }}>How to format your file</h3>
            <p className="muted" style={{ marginTop: 4 }}>
              Upload a CSV of holdings; invalid rows are ignored and reported in the UI.
            </p>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          <p className="metric-label" style={{ marginBottom: 6 }}>
            Required / optional columns
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {columns.map((c) => (
              <div key={c.name} className="card" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", padding: "10px", borderRadius: "10px" }}>
                <p className="font-semibold text-slate-100">{c.name}</p>
                <p className="muted" style={{ margin: 0 }}>
                  {c.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <p className="metric-label" style={{ marginBottom: 6 }}>
            Example CSV
          </p>
          <pre
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              padding: "12px",
              borderRadius: "10px",
              overflowX: "auto",
              fontSize: "13px",
            }}
          >
{`ticker,quantity,portfolio,cost_basis,as_of
AAPL,150,core,132.50,2024-12-31
MSFT,80,core,310.10,2024-12-31
QQQ,-50,hedge,320.00,2024-12-31`}
          </pre>
          <ul className="simple-list" style={{ marginTop: 8 }}>
            <li>Accepted file type: .csv</li>
            <li>Dates: YYYY-MM-DD; decimals allowed for prices/quantities.</li>
            <li>Invalid rows: skipped; the UI will report failures if present.</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default PositionUploadGuide;
