import React, { useState, useRef, useEffect } from "react";
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

const createDraftPosition = (overrides = {}) => ({
  ticker: "",
  quantity: "",
  costBasis: "",
  currency: "USD",
  portfolio: "",
  asOf: "",
  ...overrides,
});

const HEADER_FIELD_MAP = {
  ticker: "ticker",
  symbol: "ticker",
  quantity: "quantity",
  qty_quantity: "quantity",
  qty: "quantity",
  quantity_shares: "quantity",
  cost: "costBasis",
  cost_basis: "costBasis",
  costbasis: "costBasis",
  currency: "currency",
  curr: "currency",
  portfolio: "portfolio",
  account: "portfolio",
  as_of: "asOf",
  asof: "asOf",
  date: "asOf",
  trade_date: "asOf",
};

const normalizeHeader = (value = "") =>
  value
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/[^a-z0-9\s_]/g, "")
    .trim()
    .replace(/[\s-]+/g, "_");

const splitCsvLine = (line) => {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
};

const isDraftRowPopulated = (row) => {
  return Boolean(
    (row.ticker || "").trim() ||
      (row.quantity || "").toString().trim() ||
      (row.costBasis || "").toString().trim() ||
      (row.portfolio || "").trim() ||
      (row.asOf || "").trim()
  );
};

const parseCsvToDraftPositions = (text) => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length !== 0) {
    const [headerLine, ...dataLines] = lines;
    const headerCells = splitCsvLine(headerLine);
    const headerFields = headerCells.map((cell) => HEADER_FIELD_MAP[normalizeHeader(cell)] || null);

    if (!headerFields.includes("ticker")) {
      throw new Error("The file must include a ticker or symbol column.");
    }

    const parsed = [];

    dataLines.forEach((line) => {
      const values = splitCsvLine(line);
      const draft = createDraftPosition();

      values.forEach((value, index) => {
        const field = headerFields[index];
        const trimmed = (value || "").trim();
        if (!field || !trimmed) {
          return;
        }

        if (field === "ticker") {
          draft.ticker = trimmed.toUpperCase();
        } else if (field === "quantity") {
          draft.quantity = trimmed;
        } else if (field === "costBasis") {
          draft.costBasis = trimmed;
        } else if (field === "currency") {
          draft.currency = trimmed || "USD";
        } else if (field === "portfolio") {
          draft.portfolio = trimmed;
        } else if (field === "asOf") {
          draft.asOf = trimmed;
        }
      });

      if (isDraftRowPopulated(draft)) {
        parsed.push(draft);
      }
    });

    return parsed;
  }

  return [];
};

const escapeCsvValue = (value) => {
  const stringValue = value !== undefined && value !== null ? String(value) : "";
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const buildCsvFromDraftRows = (rows) => {
  const header = ["Symbol", "Qty (Quantity)", "Cost Basis", "Description"];
  const lines = rows.map((row) =>
    [
      escapeCsvValue(row.ticker),
      escapeCsvValue(row.quantity),
      escapeCsvValue(row.costBasis ?? ""),
      escapeCsvValue(row.portfolio ?? ""),
    ].join(",")
  );

  return [header.join(","), ...lines].join("\n");
};

const readFileAsText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result?.toString() || "");
    };
    reader.onerror = () => reject(new Error("Unable to read the file."));
    reader.readAsText(file);
  });

const getFileExtension = (fileName = "") => {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
};

const ImportPositionsModal = ({ isOpen, onClose, onImportSuccess }) => {
  const [activeTab, setActiveTab] = useState("file");
  const [draftPositions, setDraftPositions] = useState([createDraftPosition()]);
  const [manualErrors, setManualErrors] = useState({});
  const [uploadErrors, setUploadErrors] = useState([]);
  const [processingFile, setProcessingFile] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showFormatHelp, setShowFormatHelp] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setDraftPositions([createDraftPosition()]);
      setManualErrors({});
      setUploadErrors([]);
      setActiveTab("file");
      setDragActive(false);
      setProcessingFile(false);
      setImporting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = async (file) => {
    if (!file) return;

    const ext = getFileExtension(file.name);
    if (ext && ext !== "csv") {
      setUploadErrors([
        "Only CSV files are supported in this flow. Please export your workbook as CSV and retry.",
      ]);
      return;
    }

    setProcessingFile(true);
    setUploadErrors([]);

    try {
      const text = await readFileAsText(file);
      const parsed = parseCsvToDraftPositions(text);
      if (parsed.length === 0) {
        throw new Error("No recognizable rows found. Ensure the first row contains headers and subsequent rows contain data.");
      }
      setDraftPositions(parsed);
      setManualErrors({});
      setActiveTab("manual");
    } catch (err) {
      const message = err?.message || "Unable to parse the uploaded file.";
      setUploadErrors([message]);
    } finally {
      setProcessingFile(false);
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

  const addManualRow = () => {
    setDraftPositions((prev) => [...prev, createDraftPosition()]);
  };

  const updateDraftRow = (index, field, value) => {
    setDraftPositions((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
    const errorKey = `${index}-${field}`;
    setManualErrors((prev) => {
      if (!prev[errorKey]) return prev;
      const { [errorKey]: removed, ...rest } = prev;
      return rest;
    });
  };

  const removeManualRow = (index) => {
    setDraftPositions((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
    setManualErrors({});
  };

  const validateDraftPositions = (positions) => {
    const errors = {};
    const validRows = [];

    positions.forEach((row, index) => {
      const ticker = (row.ticker || "").trim().toUpperCase();
      const quantityRaw = row.quantity;
      const quantity = Number(quantityRaw);

      if (!ticker) {
        errors[`${index}-ticker`] = "Ticker required";
      }

      if (
        quantityRaw === "" ||
        quantityRaw === null ||
        quantityRaw === undefined ||
        Number.isNaN(quantity) ||
        quantity === 0
      ) {
        errors[`${index}-quantity`] = "Valid quantity required";
      }

      if (row.costBasis && Number.isNaN(Number(row.costBasis))) {
        errors[`${index}-costBasis`] = "Invalid cost basis";
      }

      if (!errors[`${index}-ticker`] && !errors[`${index}-quantity`]) {
        validRows.push({
          ticker,
          quantity,
          costBasis: row.costBasis ? Number(row.costBasis) : undefined,
          currency: row.currency || "USD",
          portfolio: row.portfolio || "",
          asOf: row.asOf || "",
        });
      }
    });

    return { valid: validRows.length > 0 && Object.keys(errors).length === 0, errors, validRows };
  };

  const handleImport = async () => {
    setUploadErrors([]);
    const { valid, errors, validRows } = validateDraftPositions(draftPositions);

    if (!valid) {
      setManualErrors(errors);
      setActiveTab("manual");
      if (validRows.length === 0) {
        setUploadErrors(["Provide at least one row with a ticker and quantity to import."]);
      }
      return;
    }

    setManualErrors({});
    setImporting(true);

    try {
      const csvPayload = buildCsvFromDraftRows(validRows);
      const formData = new FormData();
      const blob = new Blob([csvPayload], { type: "text/csv" });
      formData.append("file", blob, "positions.csv");
      const positions = await portfolioApi.uploadPositions(formData);

      const summary = {
        positionsCount: positions.length,
        uniqueTickers: new Set(positions.map((p) => p.ticker)).size,
        benchmark: "SPY",
      };

      onImportSuccess(summary, positions);
      onClose();
    } catch (err) {
      console.error("Import positions error:", err);
      const fallback = "Unable to import positions. Please try again.";
      const message = err?.message || fallback;
      setUploadErrors([message]);
      setActiveTab("manual");
    } finally {
      setImporting(false);
    }
  };

  const hasDraftInput = draftPositions.some(
    (row) => (row.ticker || "").trim() || (row.quantity || "").toString().trim()
  );

  const renderErrors = (title) => (
    <div
      style={{
        background: "rgba(239,68,68,0.08)",
        border: "1px solid rgba(239,68,68,0.35)",
        borderRadius: "10px",
        padding: "12px 16px",
        marginBottom: "20px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <Icon size={16}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </Icon>
        <span style={{ fontWeight: 600, color: "#ef4444" }}>{title}</span>
      </div>
      <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px" }}>
        {uploadErrors.map((error, index) => (
          <li key={index} style={{ marginBottom: "4px" }}>
            {error}
          </li>
        ))}
      </ul>
    </div>
  );

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

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px 28px",
          }}
        >
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
                    {processingFile ? "Processing file..." : "Drag & drop or click to upload"}
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

              {uploadErrors.length > 0 && renderErrors("Upload errors")}

              <button
                className="btn btn-ghost"
                onClick={() => setShowFormatHelp((prev) => !prev)}
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
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "8px",
                      marginBottom: "16px",
                    }}
                  >
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

          {activeTab === "manual" && (
            <div>
              <div style={{ marginBottom: "12px" }}>
                <label className="label-sm">Enter positions manually</label>
              </div>

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
                      <th
                        style={{
                          padding: "10px 12px",
                          background: "rgba(255,255,255,0.04)",
                          width: "50px",
                        }}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {draftPositions.map((row, index) => (
                      <tr key={index}>
                        <td style={{ padding: "8px" }}>
                          <input
                            type="text"
                            value={row.ticker}
                            onChange={(e) => updateDraftRow(index, "ticker", e.target.value.toUpperCase())}
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
                            onChange={(e) => updateDraftRow(index, "quantity", e.target.value)}
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
                            onChange={(e) => updateDraftRow(index, "costBasis", e.target.value)}
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
                            onChange={(e) => updateDraftRow(index, "currency", e.target.value)}
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
                          {draftPositions.length > 1 && (
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

              {uploadErrors.length > 0 && renderErrors("Import errors")}
            </div>
          )}
        </div>

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
            onClick={handleImport}
            disabled={!hasDraftInput || importing}
            style={{
              padding: "10px 20px",
              opacity: !hasDraftInput || importing ? 0.5 : 1,
              cursor: !hasDraftInput || importing ? "not-allowed" : "pointer",
            }}
          >
            {importing ? "Importing..." : "Import portfolio"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportPositionsModal;
