import numpy as np
import pandas as pd
from typing import Any, Dict, List, Optional


def _bucket_risk(vol: float, sharpe: float, max_dd: float) -> str:
    if vol < 0.08 and sharpe >= 1.5 and max_dd > -0.15:
        return "conservative"
    if vol < 0.15 and sharpe >= 1.0 and max_dd > -0.25:
        return "balanced"
    if vol < 0.25 and sharpe >= 0.7:
        return "assertive"
    return "high beta / high risk"


def _regime_performance(port: pd.Series, bench: pd.Series) -> Dict[str, float]:
    rolling_spy = bench.rolling(60).std()
    vol_threshold = rolling_spy.median()
    high_vol = rolling_spy > vol_threshold
    port_up = port[bench > 0].mean() if not port[bench > 0].empty else np.nan
    port_down = port[bench <= 0].mean() if not port[bench <= 0].empty else np.nan
    port_high_vol = port[high_vol].mean() if not port[high_vol].empty else np.nan
    port_low_vol = port[~high_vol].mean() if not port[~high_vol].empty else np.nan
    return {
        "up": float(port_up) if pd.notna(port_up) else None,
        "down": float(port_down) if pd.notna(port_down) else None,
        "high_vol": float(port_high_vol) if pd.notna(port_high_vol) else None,
        "low_vol": float(port_low_vol) if pd.notna(port_low_vol) else None,
    }


def _factor_tilts(port: pd.Series, factor_returns: Dict[str, pd.Series]) -> List[str]:
    tilts: List[str] = []
    for label, series in factor_returns.items():
        aligned = port.reindex(series.index).dropna()
        factor = series.reindex(aligned.index).dropna()
        if aligned.empty or factor.empty:
            continue
        corr = aligned.corr(factor)
        if corr > 0.4:
            tilts.append(f"Positive tilt vs {label} (corr {corr:.2f})")
        elif corr < -0.3:
            tilts.append(f"Negative tilt vs {label} (corr {corr:.2f})")
    return tilts


def _concentration(weights: List[float], tickers: List[str]) -> str:
    w = np.array(weights)
    if w.sum() == 0:
        return "Weights unavailable."
    w = w / w.sum()
    top_order = np.argsort(-w)
    top3 = w[top_order[:3]].sum()
    hhi = (w ** 2).sum()
    if hhi > 0.25:
        label = "Concentrated"
    elif hhi > 0.15:
        label = "Moderate concentration"
    else:
        label = "Diversified"
    return f"{label}; top 3 weights ≈ {(top3*100):.1f}%, HHI {hhi:.3f}."


def build_commentary(
    portfolio_returns: pd.Series,
    benchmark_returns: Optional[pd.Series],
    stats: Dict[str, float],
    drawdowns: Optional[pd.Series] = None,
    rolling_vol: Optional[pd.Series] = None,
    rolling_sharpe: Optional[pd.Series] = None,
    weights: Optional[List[float]] = None,
    tickers: Optional[List[str]] = None,
    scenarios: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    bench = benchmark_returns if benchmark_returns is not None else pd.Series(dtype=float)
    rel = None
    if not bench.empty:
        bench = bench.reindex(portfolio_returns.index).ffill().bfill()
        rel = (1 + portfolio_returns).prod() - (1 + bench).prod()
    ann_vol = stats.get("annualized_volatility") or 0.0
    sharpe = stats.get("sharpe_ratio") or 0.0
    max_dd = stats.get("max_drawdown") or 0.0
    risk_bucket = _bucket_risk(ann_vol, sharpe, max_dd)

    headline = f"Sharpe {sharpe:.2f}, vol {ann_vol*100:.1f}%, max DD {max_dd*100:.1f}% -> {risk_bucket} profile."

    rel_text = "Benchmark data unavailable."
    if rel is not None:
        rel_dir = "outperformed" if rel > 0 else "lagged"
        rel_text = f"Total {rel_dir} SPY by {(rel*100):.1f}% over the sample."

    regimes: Dict[str, float] = {}
    if not bench.empty:
        regimes = _regime_performance(portfolio_returns, bench)
    regime_text = "Regime behavior not enough data."
    if regimes:
        up = regimes.get("up")
        down = regimes.get("down")
        hv = regimes.get("high_vol")
        lv = regimes.get("low_vol")
        parts: List[str] = []
        if up is not None and down is not None:
            parts.append(f"Up-market avg {up*100:.2f}% vs down-market {down*100:.2f}%.")
        if hv is not None and lv is not None:
            parts.append(f"Performs better in {'low' if lv > hv else 'high'}-vol regimes.")
        if parts:
            regime_text = " ".join(parts)

    factor_text = ""
    if not bench.empty:
        factor_texts = _factor_tilts(portfolio_returns, {"SPY": bench})
        factor_text = " ".join(factor_texts) or "No pronounced style tilt detected."
    concentration_text = _concentration(weights or [], tickers or []) if weights else "Weights unavailable."

    draw_text = ""
    if drawdowns is not None and not drawdowns.empty:
        avg_dd = drawdowns.mean()
        draw_text = f"Average drawdown {avg_dd*100:.1f}% with max {max_dd*100:.1f}%."

    stress_text = ""
    if scenarios:
        worst = min(scenarios, key=lambda s: s.get("pnlPct", 0) or 0)
        stress_text = f"Worst preset shock: {worst.get('label','') or worst.get('shockPct')} → {(worst.get('pnlPct') or 0)*100:.1f}% P&L."

    return {
        "headline": headline,
        "risk_profile": f"Sharpe {sharpe:.2f}, vol {ann_vol*100:.1f}%, max DD {max_dd*100:.1f}% -> {risk_bucket}.",
        "relative_performance": rel_text,
        "regime_behavior": regime_text,
        "factor_profile": factor_text,
        "concentration": concentration_text,
        "drawdown_profile": draw_text,
        "stress_summary": stress_text,
    }
