from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from .data import fetch_price_history
from . import commentary


def _equity_from_returns(rets: pd.Series) -> pd.Series:
  return (1 + rets).cumprod()


def _drawdown_series(rets: pd.Series) -> pd.DataFrame:
  equity = _equity_from_returns(rets)
  running_max = equity.cummax()
  dd = equity / running_max - 1
  return pd.DataFrame({"date": [d.strftime("%Y-%m-%d") for d in dd.index], "drawdown": dd.values})


def _top_drawdowns(drawdowns: pd.DataFrame, top_n: int = 5) -> List[Dict[str, Any]]:
  if drawdowns.empty:
    return []
  min_depth = drawdowns["drawdown"].min()
  trough_idx = drawdowns["drawdown"].idxmin()
  start_idx = drawdowns.loc[:trough_idx, "drawdown"].idxmax()
  recovery_mask = drawdowns.loc[trough_idx:, "drawdown"] >= 0
  recovery_idx = recovery_mask.idxmax() if recovery_mask.any() else None
  window = {
    "startDate": drawdowns.loc[start_idx, "date"] if start_idx is not None else None,
    "troughDate": drawdowns.loc[trough_idx, "date"] if trough_idx is not None else None,
    "recoveryDate": drawdowns.loc[recovery_idx, "date"] if recovery_idx is not None else None,
    "depth": float(min_depth),
  }
  return [window][:top_n]


def _monthly_returns(rets: pd.Series) -> List[Dict[str, Any]]:
  if rets.empty:
    return []
  monthly = rets.resample("M").apply(lambda x: (1 + x).prod() - 1)
  rows = []
  for ts, val in monthly.items():
    rows.append({"year": ts.year, "month": ts.month, "returnPct": float(val)})
  return rows


def _rolling_stats(port: pd.Series, bench: Optional[pd.Series], window: int = 60) -> List[Dict[str, Any]]:
  if port.empty:
    return []
  aligned = pd.concat([port, bench] if bench is not None else [port], axis=1).dropna()
  port_aligned = aligned.iloc[:, 0]
  bench_aligned = aligned.iloc[:, 1] if bench is not None and aligned.shape[1] > 1 else None
  rows = []
  for i in range(window, len(port_aligned) + 1):
    slice_port = port_aligned.iloc[i - window : i]
    slice_bench = bench_aligned.iloc[i - window : i] if bench_aligned is not None else None
    vol = float(slice_port.std() * math.sqrt(252))
    sharpe = float((slice_port.mean() * 252) / vol) if vol else 0.0
    beta = None
    if slice_bench is not None:
      cov = float(np.cov(slice_port, slice_bench)[0][1])
      var_bench = float(np.var(slice_bench))
      beta = float(cov / var_bench) if var_bench else None
    rows.append(
      {
        "date": slice_port.index[-1].strftime("%Y-%m-%d"),
        "vol": vol,
        "sharpe": sharpe,
        "beta": beta,
      }
    )
  return rows


def _summary(port: pd.Series, bench: Optional[pd.Series]) -> Dict[str, float]:
  if port.empty:
    return {}
  periods = 252
  total_return = float((1 + port).prod() - 1)
  cagr = float((1 + total_return) ** (periods / len(port)) - 1) if len(port) else 0.0
  vol = float(port.std() * math.sqrt(periods))
  downside = float(port[port < 0].std() * math.sqrt(periods)) if not port.empty else 0.0
  sharpe = cagr / vol if vol else 0.0
  sortino = cagr / downside if downside else 0.0
  equity = _equity_from_returns(port)
  max_dd = float((equity / equity.cummax() - 1).min()) if not equity.empty else 0.0
  hit_rate = float((port > 0).sum() / len(port)) if len(port) else 0.0
  beta = alpha = tracking_error = None
  benchmark_cagr = 0.0
  if bench is not None and not bench.empty:
    aligned = pd.concat([port, bench], axis=1, join="inner").dropna()
    if not aligned.empty:
      b = aligned.iloc[:, 1]
      p = aligned.iloc[:, 0]
      X = np.column_stack([np.ones(len(b)), b.values])
      betas, _, _, _ = np.linalg.lstsq(X, p.values, rcond=None)
      alpha = float(betas[0] * periods)
      beta = float(betas[1])
      active = p - b
      tracking_error = float(active.std() * math.sqrt(periods)) if active.std() != 0 else 0.0
      benchmark_cagr = float((1 + b).prod() ** (periods / len(b)) - 1)
  return {
    "total_return": total_return,
    "cagr": cagr,
    "annualized_volatility": vol,
    "sharpe_ratio": sharpe,
    "sortino_ratio": sortino,
    "max_drawdown": max_dd,
    "hit_rate": hit_rate,
    "benchmark_cagr": benchmark_cagr,
    "beta": beta if beta is not None else 0.0,
    "alpha": alpha if alpha is not None else 0.0,
    "tracking_error": tracking_error if tracking_error is not None else 0.0,
  }


def _period_stats(monthly_rows: List[Dict[str, Any]]) -> Dict[str, Any]:
  if not monthly_rows:
    return {}
  rets = pd.Series({f"{r['year']}-{r['month']:02d}": r["returnPct"] for r in monthly_rows})
  return {
    "hit_rate_monthly": float((rets > 0).mean()),
    "best_period": rets.idxmax(),
    "best_period_return": float(rets.max()),
    "worst_period": rets.idxmin(),
    "worst_period_return": float(rets.min()),
    "average_period_return": float(rets.mean()),
  }


def _factor_model(port_returns: pd.Series, bench_returns: Optional[pd.Series], asset_returns: pd.DataFrame) -> Dict[str, Any]:
  if port_returns.empty:
    return {"factors": [], "r2": 0.0, "residual_vol": 0.0}
  factors: List[Tuple[str, pd.Series]] = []
  if bench_returns is not None:
    factors.append(("Market", bench_returns.reindex(port_returns.index).ffill().bfill()))
  # Use first two principal components as style proxies
  if asset_returns.shape[1] >= 2:
    X = asset_returns.reindex(port_returns.index).dropna()
    if len(X) >= 5:
      X_centered = X - X.mean()
      cov = np.cov(X_centered.T)
      eigvals, eigvecs = np.linalg.eigh(cov)
      idx = eigvals.argsort()[::-1]
      eigvecs = eigvecs[:, idx]
      for i in range(min(2, eigvecs.shape[1])):
        weights = eigvecs[:, i]
        series = X_centered.values @ weights
        factors.append((f"Style {i+1}", pd.Series(series, index=X_centered.index)))
  if not factors:
    return {"factors": [], "r2": 0.0, "residual_vol": float(port_returns.std())}

  X_mat = np.column_stack([f[1].reindex(port_returns.index).fillna(0).values for f in factors])
  y = port_returns.values
  betas, _, _, _ = np.linalg.lstsq(X_mat, y, rcond=None)
  fitted = X_mat @ betas
  residuals = y - fitted
  var_port = float(np.var(y))
  r2 = 1 - np.var(residuals) / var_port if var_port else 0.0
  factor_payload = []
  for (name, series), beta in zip(factors, betas):
    var_f = float(np.var(series))
    contrib = (beta ** 2) * var_f / var_port if var_port else 0.0
    factor_payload.append(
      {"factor": name, "beta": float(beta), "variance_contribution": float(contrib)}
    )
  return {
    "factors": factor_payload,
    "r2": float(r2),
    "residual_vol": float(np.std(residuals)),
  }


def _correlation_matrix(asset_returns: pd.DataFrame) -> List[Dict[str, Any]]:
  if asset_returns.empty:
    return []
  corr = asset_returns.corr()
  rows = []
  for i, a in enumerate(corr.index):
    for j, b in enumerate(corr.columns):
      rows.append({"a": a, "b": b, "value": float(corr.iloc[i, j])})
  return rows


def _var_cvar(port_returns: pd.Series) -> Dict[str, float]:
  if port_returns.empty:
    return {}
  mu = float(port_returns.mean())
  sigma = float(port_returns.std())
  z95 = 1.65
  z99 = 2.33
  var95 = -(mu + z95 * sigma)
  var99 = -(mu + z99 * sigma)
  hist95 = -float(np.quantile(port_returns, 0.05))
  hist99 = -float(np.quantile(port_returns, 0.01))
  tail95 = port_returns[port_returns <= np.quantile(port_returns, 0.05)]
  cvar95 = -float(tail95.mean()) if not tail95.empty else 0.0
  return {
    "var_95": var95,
    "var_99": var99,
    "var_95_hist": hist95,
    "var_99_hist": hist99,
    "cvar_95": cvar95,
  }


def _risk_attribution(asset_returns: pd.DataFrame, weights: np.ndarray, sectors: Optional[List[str]] = None) -> Dict[str, Any]:
  if asset_returns.empty:
    return {"by_ticker": [], "by_sector": []}
  cov = asset_returns.cov().values
  port_var = float(weights.T @ cov @ weights)
  marginal = cov @ weights
  contrib = weights * marginal
  by_ticker = []
  for t, w, c in zip(asset_returns.columns, weights, contrib):
    by_ticker.append({"ticker": t, "weight_pct": float(w), "contribution_pct": float(c / port_var) if port_var else 0.0})
  sector_labels = sectors or asset_returns.columns.tolist()
  sector_map: Dict[str, List[int]] = {}
  for idx, s in enumerate(sector_labels):
    sector_map.setdefault(s, []).append(idx)
  by_sector = []
  for sector, idxs in sector_map.items():
    w_sector = weights[idxs].sum()
    contrib_sector = sum(contrib[i] for i in idxs)
    by_sector.append(
      {
        "sector": sector,
        "weight_pct": float(w_sector),
        "contribution_pct": float(contrib_sector / port_var) if port_var else 0.0,
      }
    )
  by_sector.sort(key=lambda x: x["contribution_pct"], reverse=True)
  by_ticker.sort(key=lambda x: x["contribution_pct"], reverse=True)
  return {"by_ticker": by_ticker, "by_sector": by_sector}


def _return_distribution(port_returns: pd.Series, bins: int = 21) -> Dict[str, Any]:
  if port_returns.empty:
    return {"histogram": [], "skew": 0.0, "kurtosis": 0.0, "worst_1d": 0.0, "worst_5d": 0.0}
  hist, edges = np.histogram(port_returns, bins=bins)
  histogram = [{"bin_start": float(edges[i]), "bin_end": float(edges[i + 1]), "count": int(hist[i])} for i in range(len(hist))]
  skew = float(port_returns.skew())
  kurt = float(port_returns.kurtosis())
  rolling_5 = port_returns.rolling(5).apply(lambda x: (1 + x).prod() - 1)
  return {
    "histogram": histogram,
    "skew": skew,
    "kurtosis": kurt,
    "worst_1d": float(port_returns.min()),
    "worst_5d": float(rolling_5.min()) if not rolling_5.empty else 0.0,
  }


def _build_payload(port_returns: pd.Series, bench_returns: Optional[pd.Series], params: Dict[str, Any], asset_returns: Optional[pd.DataFrame] = None, weights: Optional[np.ndarray] = None, sectors: Optional[List[str]] = None) -> Dict[str, Any]:
  bench_aligned = None
  if bench_returns is not None:
    bench_aligned = bench_returns.reindex(port_returns.index).ffill().bfill()
  summary = _summary(port_returns, bench_aligned)
  equity = _equity_from_returns(port_returns)
  bench_equity = _equity_from_returns(bench_aligned) if bench_aligned is not None else None
  drawdowns = _drawdown_series(port_returns)
  factors = _factor_model(port_returns, bench_aligned, asset_returns or pd.DataFrame())
  corr = _correlation_matrix(asset_returns or pd.DataFrame())
  var_metrics = _var_cvar(port_returns)
  attribution = _risk_attribution(asset_returns or pd.DataFrame(), weights if weights is not None else np.array([]), sectors)
  distribution = _return_distribution(port_returns)
  monthly_rows = _monthly_returns(port_returns)
  return {
    "params": params,
    "summary": summary,
    "equity_curve": {"dates": [d.strftime("%Y-%m-%d") for d in equity.index], "equity": [float(v) for v in equity.values]},
    "benchmark_curve": bench_equity
    and {"dates": [d.strftime("%Y-%m-%d") for d in bench_equity.index], "equity": [float(v) for v in bench_equity.values]},
    "relative_curve": bench_equity
    and {
      "dates": [d.strftime("%Y-%m-%d") for d in equity.index],
      "relative": [float(p - b) for p, b in zip(equity.values, bench_equity.values)],
    },
    "returns": [float(r) for r in port_returns],
    "benchmark_returns": [float(r) for r in bench_aligned] if bench_aligned is not None else None,
    "drawdown_series": drawdowns.to_dict(orient="records"),
    "top_drawdowns": _top_drawdowns(drawdowns),
    "monthly_returns": monthly_rows,
    "period_stats": _period_stats(monthly_rows),
    "rolling_stats": _rolling_stats(port_returns, bench_aligned),
    "scenarios": [
      {"label": "Mild correction", "shockPct": -0.05, "pnlPct": -0.05, "maxDrawdownUnderShock": summary["max_drawdown"] - 0.05},
      {"label": "Standard pullback", "shockPct": -0.1, "pnlPct": -0.1, "maxDrawdownUnderShock": summary["max_drawdown"] - 0.1},
      {"label": "Severe shock", "shockPct": -0.2, "pnlPct": -0.2, "maxDrawdownUnderShock": summary["max_drawdown"] - 0.2},
    ],
    "factor_risk": factors,
    "correlations": corr,
    "var": var_metrics,
    "risk_attribution": attribution,
    "return_distribution": distribution,
    "commentary": commentary.build_commentary(
      port_returns,
      bench_aligned,
      summary,
      drawdowns=drawdowns.set_index("date")["drawdown"] if not drawdowns.empty else None,
      rolling_vol=None,
      rolling_sharpe=None,
      weights=weights.tolist() if weights is not None else None,
      tickers=list(asset_returns.columns) if asset_returns is not None else None,
      scenarios=[
        {"label": "Mild correction", "pnlPct": -0.05},
        {"label": "Standard pullback", "pnlPct": -0.1},
        {"label": "Severe shock", "pnlPct": -0.2},
      ],
    ),
  }


def portfolio_analytics(tickers: List[str], quantities: List[float], prices: List[float], benchmark: Optional[str], start: Optional[str], end: Optional[str], sectors: Optional[List[str]] = None) -> Dict[str, Any]:
  price_hist = fetch_price_history(tickers, start, end)
  current_values = np.array(quantities) * np.array(prices)
  total_value = current_values.sum() or 1.0
  weights = current_values / total_value
  returns_df = price_hist.pct_change().dropna()
  port_returns = returns_df.mul(weights, axis=1).sum(axis=1)
  bench_returns = None
  if benchmark:
    bench_prices = fetch_price_history([benchmark], start, end)
    bench_returns = bench_prices.pct_change().dropna().iloc[:, 0]
  return _build_payload(
    port_returns,
    bench_returns,
    {"tickers": tickers, "benchmark": benchmark, "start_date": start, "end_date": end},
    returns_df,
    weights,
    sectors,
  )


def backtest_analytics(tickers: List[str], weights: Optional[List[float]], benchmark: Optional[str], start: Optional[str], end: Optional[str], rebalance_freq: Optional[str]) -> Dict[str, Any]:
  price_hist = fetch_price_history(tickers, start, end)
  weight_arr = np.array(weights) if weights is not None else np.full(len(tickers), 1 / len(tickers))
  weight_arr = weight_arr / weight_arr.sum()
  returns_df = price_hist.pct_change().dropna()
  # simple rebalance: equal weights each period
  port_returns = returns_df.mul(weight_arr, axis=1).sum(axis=1)
  bench_returns = None
  if benchmark:
    bench_prices = fetch_price_history([benchmark], start, end)
    bench_returns = bench_prices.pct_change().dropna().iloc[:, 0]
  return _build_payload(
    port_returns,
    bench_returns,
    {"tickers": tickers, "weights": weight_arr.tolist(), "benchmark": benchmark, "start_date": start, "end_date": end, "rebalance_freq": rebalance_freq or "none"},
    returns_df,
    weight_arr,
    None,
  )
