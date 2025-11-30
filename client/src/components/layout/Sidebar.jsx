import { NavLink } from "react-router-dom";
import { navSections } from "../../app/routes";

const Sidebar = () => {
  return (
    <aside className="sidebar">
      <h4>Navigation</h4>
      {navSections.map((section) => (
        <div key={section.id} className="nav-section">
          {section.heading && <div className="nav-section-label">{section.heading}</div>}
          <div className="nav-links">
            {section.items.map((tab) => (
              <NavLink
                key={tab.id}
                to={tab.path}
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </aside>
  );
};

export default Sidebar;
