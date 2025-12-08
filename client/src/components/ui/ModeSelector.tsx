import { type FC, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MODE_TABS, useAppMode } from "../../state/appMode";

const ModeSelector: FC = () => {
  const { mode, setMode } = useAppMode();
  const navigate = useNavigate();

  const tabs = useMemo(() => MODE_TABS, []);

  const handleSelect = (tabId: typeof tabs[number]["id"], route: string) => {
    setMode(tabId);
    navigate(route);
  };

  return (
    <div className="mode-selector">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`mode-selector__tab ${mode === tab.id ? "active" : ""}`}
          type="button"
          onClick={() => handleSelect(tab.id, tab.route)}
        >
          <span className="mode-selector__label">{tab.label}</span>
          <span className="mode-selector__subtitle">{tab.description}</span>
        </button>
      ))}
    </div>
  );
};

export default ModeSelector;
