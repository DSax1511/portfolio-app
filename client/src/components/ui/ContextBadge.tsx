import { type FC } from "react";

export type ContextBadgeVariant = "live" | "paper" | "backtest";

const variantStyles: Record<ContextBadgeVariant, string> = {
  live: "badge-live",
  paper: "badge-paper",
  backtest: "badge-backtest",
};

interface ContextBadgeProps {
  variant: ContextBadgeVariant;
  label?: string;
}

const ContextBadge: FC<ContextBadgeProps> = ({ variant, label }) => {
  const display = label ?? variant.toUpperCase();
  return <span className={`context-badge ${variantStyles[variant]}`}>{display}</span>;
};

export default ContextBadge;
