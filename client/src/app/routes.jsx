export const navSections = [
  {
    id: "portfolio",
    heading: "Portfolio Management",
    items: [
      { id: "dashboard", path: "/pm/dashboard", label: "Dashboard" },
      { id: "historical", path: "/pm/historical-analysis", label: "Historical Analysis" },
      { id: "analytics", path: "/pm/risk-diagnostics", label: "Analytics & Risk" },
      { id: "tax-harvest", path: "/pm/tax-harvest", label: "Tax Harvest" },
    ],
  },
  {
    id: "quant",
    heading: "Quant Lab",
    items: [
      { id: "strategy-research", path: "/quant/strategy-research", label: "Strategy Research" },
      { id: "regimes", path: "/quant/regimes", label: "Market Regimes" },
      { id: "execution", path: "/quant/execution-lab", label: "Execution Sim" },
      { id: "microstructure", path: "/quant/market-structure", label: "Market Structure" },
    ],
  },
  {
    id: "info",
    heading: "Info",
    items: [
      { id: "home", path: "/home", label: "Home" },
      { id: "about", path: "/about", label: "About" },
      { id: "math-engine", path: "/math-engine", label: "Math Engine" },
      { id: "contact", path: "/contact", label: "Contact" },
    ],
  },
];

// Flat list for conveniences like route maps.
export const routes = navSections.flatMap((section) => section.items);
