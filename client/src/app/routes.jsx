export const navSections = [
  {
    id: "home",
    items: [{ id: "home", path: "/home", label: "Home" }],
  },
  {
    id: "portfolio",
    heading: "Portfolio Management",
    items: [
      { id: "pm-dashboard", path: "/pm/dashboard", label: "Portfolio Dashboard" },
      { id: "pm-allocation", path: "/pm/allocation-rebalance", label: "Allocation & Rebalance" },
      { id: "pm-historical", path: "/pm/historical-analysis", label: "Historical Analysis" },
      { id: "pm-risk", path: "/pm/risk-diagnostics", label: "Risk & Diagnostics" },
      { id: "pm-tax-harvest", path: "/pm/tax-harvest", label: "Tax Harvest" },
    ],
  },
  {
    id: "quant",
    heading: "Quant Lab",
    items: [
      { id: "quant-strategy", path: "/quant/strategy-research", label: "Strategy Research" },
      { id: "quant-market", path: "/quant/market-structure", label: "Market Structure" },
      { id: "quant-regimes", path: "/quant/regimes", label: "Regimes" },
      { id: "quant-exec", path: "/quant/execution-lab", label: "Execution Lab" },
    ],
  },
  {
    id: "platform",
    heading: "Platform & Docs",
    items: [
      { id: "math-engine", path: "/math-engine", label: "Mathematical Engine" },
      { id: "about", path: "/about", label: "About" },
      { id: "contact", path: "/contact", label: "Contact" },
    ],
  },
];

// Flat list for conveniences like route maps.
export const routes = navSections.flatMap((section) => section.items);
