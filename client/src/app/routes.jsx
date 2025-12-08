export const navSections = [
  {
    id: "portfolio",
    heading: "Portfolio Management",
    items: [
      { id: "dashboard", path: "/pm/dashboard", label: "Dashboard", modes: ["pm"] },
      { id: "historical", path: "/pm/historical-analysis", label: "Historical Diagnostics", modes: ["pm", "research"] },
      { id: "analytics", path: "/pm/risk-diagnostics", label: "Backtest Performance & Risk", modes: ["pm", "research"] },
      { id: "tax-harvest", path: "/pm/tax-harvest", label: "Tax Harvest", modes: ["pm"] },
    ],
  },
  {
    id: "quant",
    heading: "Quant Lab",
    items: [
      { id: "strategy-research", path: "/quant/strategy-research", label: "Strategy Research Diagnostics", modes: ["research"] },
      { id: "regimes", path: "/quant/regimes", label: "Market Regimes", modes: ["research"] },
      { id: "execution", path: "/quant/execution-lab", label: "Execution Sim", modes: ["execution"] },
      { id: "microstructure", path: "/quant/market-structure", label: "Market Structure", modes: ["execution"] },
    ],
  },
  {
    id: "info",
    heading: "Info",
    items: [
      { id: "about", path: "/about", label: "About" },
      { id: "math-engine", path: "/math-engine", label: "Math Engine" },
      { id: "employers", path: "/for-employers", label: "For Employers" },
      { id: "contact", path: "/contact", label: "Contact" },
    ],
  },
];

// Flat list for conveniences like route maps.
export const routes = navSections.flatMap((section) => section.items);
