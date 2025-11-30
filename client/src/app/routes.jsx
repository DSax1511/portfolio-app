export const navSections = [
  {
    id: "home",
    items: [{ id: "home", path: "/home", label: "Home" }],
  },
  {
    id: "portfolio",
    heading: "Portfolio Management",
    items: [
      { id: "pm-overview", path: "/pm/overview", label: "Overview" },
      { id: "pm-allocation", path: "/pm/allocation", label: "Allocation" },
      { id: "pm-backtests", path: "/pm/backtests", label: "Backtests" },
      { id: "pm-risk", path: "/pm/risk", label: "Risk" },
    ],
  },
  {
    id: "quant",
    heading: "Quant Lab",
    items: [
      { id: "quant-strategy", path: "/quant/strategy-builder", label: "Strategy Builder" },
      { id: "quant-backtest", path: "/quant/backtest-engine", label: "Backtest Engine" },
      { id: "quant-micro", path: "/quant/microstructure", label: "Microstructure" },
      { id: "quant-regimes", path: "/quant/regimes", label: "Regimes" },
      { id: "quant-exec", path: "/quant/execution-simulator", label: "Execution Simulator" },
    ],
  },
  {
    id: "research",
    heading: "Research",
    items: [
      { id: "research-home", path: "/research", label: "Research Home" },
      { id: "research-notes", path: "/research/notes", label: "Research Notes" },
    ],
  },
  {
    id: "footer",
    items: [
      { id: "about", path: "/about", label: "About" },
      { id: "contact", path: "/contact", label: "Contact" },
    ],
  },
];

// Flat list for conveniences like route maps.
export const routes = navSections.flatMap((section) => section.items);
