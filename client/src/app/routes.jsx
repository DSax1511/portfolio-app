export const navSections = [
  {
    id: "core",
    heading: "Saxton PI",
    items: [
      { id: "home", path: "/home", label: "Home" },
      { id: "dashboard", path: "/pm/dashboard", label: "Portfolio Dashboard" },
      { id: "portfolio-overview", path: "/overview", label: "Portfolio Overview" },
      { id: "analytics", path: "/pm/risk-diagnostics", label: "Analytics" },
      { id: "strategy-research", path: "/quant/strategy-research", label: "Strategy Research" },
      { id: "tax-harvest", path: "/pm/tax-harvest", label: "Tax Harvest" },
    ],
  },
  {
    id: "connect",
    heading: "Connect",
    items: [
      { id: "about", path: "/about", label: "About" },
      { id: "contact", path: "/contact", label: "Contact" },
    ],
  },
];

// Flat list for conveniences like route maps.
export const routes = navSections.flatMap((section) => section.items);
