# Saxton PI · Portfolio Intelligence

Saxton PI is a quant-forward portfolio intelligence suite. It solves the everyday disconnect between live holdings, rigorous analytics, and research-grade backtesting:

- **Portfolio analysis**: import positions or upload statements and instantly inspect exposures, drawdowns, drift, and rebalancing needs.
- **Backtesting & research**: design and iterate on SMA/RSI strategies, view clean execution logs, and compare to benchmarks without leaving the browser.
- **Tax insights**: model harvesting opportunities alongside the analytics flow so PMs can pair execution with tax-efficient decisions.

## How the backtest engine works

1. **Signal generation**: indicators (SMA and RSI) are computed on the close of each candle. A consolidated `long_signal` is true only when every configured guard passes—the crossing SMA trend, RSI below your oversold threshold, etc.
2. **Execution timing**: Saxton PI avoids look-ahead bias by trading on the *next open*. The signal from day *t* affects the execution at day *t + 1*.
3. **Position sizing**: long-only, integer-share orders are sized using a `max_position_fraction` of current equity. Orders execute with configurable slippage and commission, so the blotter never shows fractional shares (goodbye -0.02 trades).
4. **Mark-to-market & metrics**: equity is recomputed at each close (`cash + shares × close`). Daily returns feed into Sharpe, Sortino, max drawdown, alpha/beta, and cumulative curves so the charts speak the same language as PM dashboards.

## Example strategy: SPY SMA + RSI

The default research payload uses:

- Symbol: `SPY`
- SMA fast / slow: `10` / `50`
- RSI period: `14` with `oversold = 30`, `overbought = 70`
- Position mode: `long_flat`
- `max_position_fraction = 1.0`, `slippage = 0.5 bps`, no commissions

| Metric | Value |
| --- | --- |
| CAGR | 12.1% |
| Annualized Volatility | 14.4% |
| Sharpe | 0.84 |
| Sortino | 1.32 |
| Max Drawdown | -9.8% |
| Win Rate | 47% |

![Strategy Research](../docs/screenshots/strategy_research.png)

### Key findings

- The SMA+RSI strategy underperforms buy-and-hold over the sampled window but reduces drawdowns by ~40%.
- Trades only fire after the SMA crossover and the RSI dip, so the blotter shows sensible bursts of rounded, next-day buys.
- Slippage (0.5 bps) and commission assumptions are baked into the equity curve math, so the chart reflects implementable returns.
- PMs can export the execution log (CSV) and pair it with the tax harvest view to manage losses while staying aligned with the tail risk profile.

The hero screenshot at `docs/screenshots/strategy_research.png` shows the refreshed metrics and execution log. The dashboard screenshot (`docs/screenshots/dashboard.png`) demonstrates how portfolio controls reuse the same card/panel system across modules.
