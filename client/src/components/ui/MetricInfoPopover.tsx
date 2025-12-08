import { type FC, useEffect, useRef, useState } from "react";

interface MetricInfoPopoverProps {
  content?: string | null;
}

const MetricInfoPopover: FC<MetricInfoPopoverProps> = ({ content }) => {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!content) return null;

  return (
    <div className="metric-info-popover">
      <button
        type="button"
        className="metric-info-popover__trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Show metric methodology"
      >
        i
      </button>
      {open && (
        <div className="metric-info-popover__panel" ref={panelRef} role="dialog" aria-label="Metric methodology">
          <p>{content}</p>
        </div>
      )}
    </div>
  );
};

export default MetricInfoPopover;
