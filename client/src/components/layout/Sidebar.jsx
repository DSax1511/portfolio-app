import { NavLink } from "react-router-dom";
import { routes } from "../../app/routes";

const Sidebar = () => {
  return (
    <aside className="sidebar">
      <h4>Navigation</h4>
      <div className="nav-links">
        {routes.map((tab) => (
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
    </aside>
  );
};

export default Sidebar;
