import React, { useState, useRef } from "react";
import { portfolioApi } from "../../../services/portfolioApi";

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
 * ImportPositionsModal - Modal for importing positions via file upload or manual entry
 * Follows global viewport-safe overlay standards:
 * - Stays fully within screen boundaries
 * - Uses internal scrolling for long content
 * - Fixed header and footer, scrollable body
 * - Maximum 600-700px width, 80-85vh height
 */
const ImportPositionsModal = ({ isOpen, onClose, onImportSuccess }) => {
  const [activeTab, setActiveTab] = useState("file"); // "file" or "manual"
  const [showFormatHelp, setShowFormatHelp] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState([]);
  const [manualRows, setManualRows] = useState([
    { ticker: "", quantity: "", costBasis: "", currency: "USD" },
  ]);
  const [manualErrors, setManualErrors] = useState({});
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  // Handle file upload via drag-and-drop or file picker
  const handleFileUpload = async (file) => {
    if (!file) return;

    setUploading(true);
    setUploadErrors([]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const positions = await portfolioApi.uploadPositions(formData);
      const summary = {
        positionsCount: positions.length,
        uniqueTickers: [...new Set(positions.map((p) => p.ticker))].length,
        benchmark: "SPY",
      };
      // Pass the positions data along with the summary
      onImportSuccess(summary, positions);
      onClose();
    } catch (err) {
      console.error("File upload error:", err);
      // Parse error message for row-specific errors
      const errorMsg = err.message || "Upload failed";
      if (errorMsg.includes("Row")) {
        // Try to extract row-level errors
        const errors = errorMsg.split("\n").filter((line) => line.trim());
        setUploadErrors(errors);
      } else {
        setUploadErrors([errorMsg]);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  // Manual entry handlers
  const addManualRow = () => {
    setManualRows([
      ...manualRows,
      { ticker: "", quantity: "", costBasis: "", currency: "USD" },
    ]);
  };

  const updateManualRow = (index, field, value) => {
    const updated = [...manualRows];
    updated[index][field] = value;
    setManualRows(updated);
    // Clear error for this field
    const errorKey = `${index}-${field}`;
    if (manualErrors[errorKey]) {
      const { [errorKey]: removed, ...rest } = manualErrors;
      setManualErrors(rest);
    }
  };

  const removeManualRow = (index) => {
    if (manualRows.length > 1) {
      setManualRows(manualRows.filter((_, i) => i !== index));
    }
  };

  const validateManualEntry = () => {
    const errors = {};
    const validRows = [];

    manualRows.forEach((row, index) => {
      // Skip completely empty rows
      if (!row.ticker && !row.quantity && !row.costBasis) {
        return;
      }

      // Validate ticker
      if (!row.ticker || row.ticker.trim() === "") {
        errors[`${index}-ticker`] = "Ticker required";
      }

      // Validate quantity
      const qty = parseFloat(row.quantity);
      if (!row.quantity || isNaN(qty) || qty === 0) {
        errors[`${index}-quantity`] = "Valid quantity required";
      }

      // Cost basis is optional, but if provided, must be valid
      if (row.costBasis && isNaN(parseFloat(row.costBasis))) {
        errors[`${index}-costBasis`] = "Invalid cost basis";
      }

      // If no errors for this row, it's valid
      const rowErrors = Object.keys(errors).filter((key) =>
        key.startsWith(`${index}-`)
      );
      if (rowErrors.length === 0 && row.ticker) {
        validRows.push({
          ticker: row.ticker.toUpperCase(),
          quantity: parseFloat(row.quantity),
          costBasis: row.costBasis ? parseFloat(row.costBasis) : null,
          currency: row.currency || "USD",
        });
      }
    });

    setManualErrors(errors);
    return { valid: Object.keys(errors).length === 0, validRows };
  };

  const handleManualImport = () => {
    const { valid, validRows } = validateManualEntry();

    if (!valid || validRows.length === 0) {
      return;
    }

    // For now, we'll convert manual entries to the format expected by the backend
    // In a real implementation, you might want a dedicated API endpoint for manual entry
    const summary = {
      positionsCount: validRows.length,
      uniqueTickers: [...new Set(validRows.map((p) => p.ticker))].length,
      benchmark: "SPY",
    };

    onImportSuccess(summary, validRows);
    onClose();
  };

  const hasValidInput = () => {
    if (activeTab === "manual") {
      // Check if at least one row has ticker and quantity
      return manualRows.some(
        (row) => row.ticker && row.quantity && !isNaN(parseFloat(row.quantity))
      );
    }
    return false;
  };

  const downloadSampleCSV = () => {
    const csv = `ticker,quantity,portfolio,cost_basis,as_of
AAPL,150,core,132.50,2024-12-31
MSFT,80,core,310.10,2024-12-31
QQQ,-50,hedge,320.00,2024-12-31`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample_positions.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={onClose}
    >
      {/* Modal container - viewport-safe */}
      <div
        style={{
          maxWidth: "700px",
          width: "100%",
          maxHeight: "85vh",
          background: "rgba(12,17,28,0.95)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "16px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div
          style={{
            padding: "24px 28px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.5rem", letterSpacing: "-0.02em" }}>
                Import portfolio positions
              </h2>
              <p className="muted" style={{ margin: "6px 0 0", fontSize: "14px" }}>
                Choose how you want to bring positions into SaxtonPI.
              </p>
            </div>
            <button
              className="btn btn-ghost"
              onClick={onClose}
              style={{ padding: "8px 12px" }}
            >
              <Icon size={18}>
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </Icon>
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px 28px",
          }}
        >
          {/* Tab Navigation */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginBottom: "24px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              paddingBottom: "4px",
            }}
          >
            <button
              className={`btn ${activeTab === "file" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => {
                setActiveTab("file");
                setUploadErrors([]);
              }}
              style={{ padding: "8px 16px", fontSize: "13px" }}
            >
              <Icon size={16}>
                <path d="M12 16V8" />
                <path d="M8 12l4-4 4 4" />
                <path d="M4 16h16" />
              </Icon>
              Upload CSV / Excel
            </button>
            <button
              className={`btn ${activeTab === "manual" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => {
                setActiveTab("manual");
                setManualErrors({});
              }}
              style={{ padding: "8px 16px", fontSize: "13px" }}
            >
              <Icon size={16}>
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </Icon>
              Enter manually
            </button>
          </div>

          {/* File Upload Tab */}
          {activeTab === "file" && (
            <div>
              <div style={{ marginBottom: "20px" }}>
                <label className="label-sm" style={{ display: "block", marginBottom: "8px" }}>
                  Upload CSV / Excel
                </label>
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${
                      dragActive ? "rgba(79,140,255,0.6)" : "rgba(255,255,255,0.12)"
                    }`,
                    borderRadius: "12px",
                    padding: "48px 24px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: dragActive
                      ? "rgba(79,140,255,0.08)"
                      : "rgba(255,255,255,0.02)",
                    transition: "all 0.2s ease",
                  }}
                >
                  <Icon size={32}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </Icon>
                  <p style={{ margin: "12px 0 4px", fontWeight: 600 }}>
                    {uploading ? "Uploading..." : "Drag & drop or click to upload"}
                  </p>
                  <p className="muted" style={{ margin: 0, fontSize: "13px" }}>
                    Supports .csv, .xlsx
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
              </div>

              {/* Upload Errors */}
              {uploadErrors.length > 0 && (
                <div
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.35)",
                    borderRadius: "10px",
                    padding: "12px 16px",
                    marginBottom: "20px",
                    maxHeight: "200px",
                    overflowY: "auto",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <Icon size={16}>
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </Icon>
                    <span style={{ fontWeight: 600, color: "#ef4444" }}>Upload errors</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px" }}>
                    {uploadErrors.map((error, i) => (
                      <li key={i} style={{ marginBottom: "4px" }}>
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Format Help Button */}
              <button
                className="btn btn-ghost"
                onClick={() => setShowFormatHelp(!showFormatHelp)}
                style={{
                  width: "100%",
                  justifyContent: "center",
                  padding: "10px",
                  fontSize: "13px",
                }}
              >
                <Icon size={16}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </Icon>
                {showFormatHelp ? "Hide" : "View"} file format requirements
              </button>

              {/* In-Modal Format Help */}
              {showFormatHelp && (
                <div
                  style={{
                    marginTop: "16px",
                    padding: "16px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "10px",
                  }}
                >
                  <h4 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 600 }}>
                    Required / optional columns
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "16px" }}>
                    {[
                      { name: "ticker", desc: "Symbol (e.g., AAPL, MSFT)" },
                      { name: "quantity", desc: "Number of shares" },
                      { name: "portfolio", desc: "Optional portfolio ID" },
                      { name: "cost_basis", desc: "Optional cost per share" },
                      { name: "as_of", desc: "Optional date (YYYY-MM-DD)" },
                    ].map((col) => (
                      <div
                        key={col.name}
                        style={{
                          background: "rgba(255,255,255,0.02)",
                          border: "1px solid rgba(255,255,255,0.05)",
                          padding: "8px",
                          borderRadius: "8px",
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: "13px", color: "#4f8cff" }}>
                          {col.name}
                        </div>
                        <div className="muted" style={{ fontSize: "12px", marginTop: "2px" }}>
                          {col.desc}
                        </div>
                      </div>
                    ))}
                  </div>

                  <h4 style={{ margin: "16px 0 8px", fontSize: "14px", fontWeight: 600 }}>
                    Example CSV
                  </h4>
                  <pre
                    style={{
                      background: "rgba(0,0,0,0.3)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      padding: "12px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      overflowX: "auto",
                      margin: "0 0 12px",
                    }}
                  >
{`ticker,quantity,portfolio,cost_basis,as_of
AAPL,150,core,132.50,2024-12-31
MSFT,80,core,310.10,2024-12-31
QQQ,-50,hedge,320.00,2024-12-31`}
                  </pre>

                  <button
                    className="btn btn-ghost"
                    onClick={downloadSampleCSV}
                    style={{ width: "100%", fontSize: "13px" }}
                  >
                    <Icon size={16}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </Icon>
                    Download sample CSV
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Manual Entry Tab */}
          {activeTab === "manual" && (
            <div>
              <div style={{ marginBottom: "12px" }}>
                <label className="label-sm">Enter positions manually</label>
              </div>

              {/* Editable Table */}
              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "10px",
                  overflow: "hidden",
                  maxHeight: "400px",
                  overflowY: "auto",
                }}
              >
                <table style={{ width: "100%", fontSize: "13px" }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "10px 12px", background: "rgba(255,255,255,0.04)" }}>
                        Ticker
                      </th>
                      <th style={{ padding: "10px 12px", background: "rgba(255,255,255,0.04)" }}>
                        Quantity
                      </th>
                      <th style={{ padding: "10px 12px", background: "rgba(255,255,255,0.04)" }}>
                        Cost Basis
                      </th>
                      <th style={{ padding: "10px 12px", background: "rgba(255,255,255,0.04)" }}>
                        Currency
                      </th>
                      <th style={{ padding: "10px 12px", background: "rgba(255,255,255,0.04)", width: "50px" }}>

                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualRows.map((row, index) => (
                      <tr key={index}>
                        <td style={{ padding: "8px" }}>
                          <input
                            type="text"
                            value={row.ticker}
                            onChange={(e) =>
                              updateManualRow(index, "ticker", e.target.value.toUpperCase())
                            }
                            placeholder="AAPL"
                            style={{
                              padding: "6px 8px",
                              fontSize: "13px",
                              border: manualErrors[`${index}-ticker`]
                                ? "1px solid rgba(239,68,68,0.5)"
                                : "1px solid rgba(255,255,255,0.1)",
                            }}
                          />
                        </td>
                        <td style={{ padding: "8px" }}>
                          <input
                            type="number"
                            value={row.quantity}
                            onChange={(e) => updateManualRow(index, "quantity", e.target.value)}
                            placeholder="100"
                            style={{
                              padding: "6px 8px",
                              fontSize: "13px",
                              border: manualErrors[`${index}-quantity`]
                                ? "1px solid rgba(239,68,68,0.5)"
                                : "1px solid rgba(255,255,255,0.1)",
                            }}
                          />
                        </td>
                        <td style={{ padding: "8px" }}>
                          <input
                            type="number"
                            step="0.01"
                            value={row.costBasis}
                            onChange={(e) => updateManualRow(index, "costBasis", e.target.value)}
                            placeholder="150.00"
                            style={{
                              padding: "6px 8px",
                              fontSize: "13px",
                              border: manualErrors[`${index}-costBasis`]
                                ? "1px solid rgba(239,68,68,0.5)"
                                : "1px solid rgba(255,255,255,0.1)",
                            }}
                          />
                        </td>
                        <td style={{ padding: "8px" }}>
                          <select
                            value={row.currency}
                            onChange={(e) => updateManualRow(index, "currency", e.target.value)}
                            style={{
                              padding: "6px 8px",
                              fontSize: "13px",
                            }}
                          >
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="GBP">GBP</option>
                          </select>
                        </td>
                        <td style={{ padding: "8px", textAlign: "center" }}>
                          {manualRows.length > 1 && (
                            <button
                              onClick={() => removeManualRow(index)}
                              style={{
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                color: "rgba(239,68,68,0.8)",
                                padding: "4px",
                              }}
                              title="Remove row"
                            >
                              <Icon size={16}>
                                <path d="M18 6L6 18" />
                                <path d="M6 6l12 12" />
                              </Icon>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add Row Button */}
              <button
                className="btn btn-ghost"
                onClick={addManualRow}
                style={{
                  marginTop: "12px",
                  width: "100%",
                  justifyContent: "center",
                  fontSize: "13px",
                }}
              >
                <Icon size={16}>
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </Icon>
                Add row
              </button>

              {/* Manual Entry Errors */}
              {Object.keys(manualErrors).length > 0 && (
                <div
                  style={{
                    marginTop: "16px",
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.35)",
                    borderRadius: "10px",
                    padding: "12px 16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Icon size={16}>
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </Icon>
                    <span style={{ fontWeight: 600, color: "#ef4444", fontSize: "13px" }}>
                      Please fix the highlighted errors
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <div
          style={{
            padding: "16px 28px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: "10px 16px" }}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={activeTab === "manual" ? handleManualImport : undefined}
            disabled={activeTab === "manual" && !hasValidInput()}
            style={{
              padding: "10px 20px",
              opacity: activeTab === "manual" && !hasValidInput() ? 0.5 : 1,
              cursor:
                activeTab === "manual" && !hasValidInput() ? "not-allowed" : "pointer",
            }}
          >
            Import portfolio
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportPositionsModal;
