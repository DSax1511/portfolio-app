import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";

const defaultConfig = {
  symbol: "SPY",
  timeframe: "1D",
  start_date: "2020-01-01",
  end_date: new Date().toISOString().slice(0, 10),
  initial_capital: 100000,
  position_mode: "long_flat",
  sma_fast: 10,
  sma_slow: 30,
  rsi_period: 14,
  rsi_overbought: 70,
  rsi_oversold: 30,
  use_sma: true,
  use_rsi: false,
  slippage_bps: 0.5,
  commission_per_trade: 0,
  max_position_size: 1,
};

const StrategyBuilderPage = () => {
  const [config, setConfig] = useState(defaultConfig);
  const navigate = useNavigate();

  const handleChange = (field) => (e) => {
    const value = e.target.type === "number" ? Number(e.target.value) : e.target.value;
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleCheckbox = (field) => (e) => {
    setConfig((prev) => ({ ...prev, [field]: e.target.checked }));
  };

  const runBacktest = (e) => {
    e.preventDefault();
    navigate("/quant/backtest-engine", { state: { config } });
  };

  return (
    <PageShell
      title="Quant Lab – Strategy Builder"
      subtitle="Configure an execution-aware SMA/RSI strategy and send it to the backtest engine."
    >
      <Card title="Strategy configuration" subtitle="Define symbol, logic, and execution settings">
        <form className="analytics-form" onSubmit={runBacktest}>
          <div className="form-row">
            <label>
              Symbol
              <input value={config.symbol} onChange={handleChange("symbol")} />
            </label>
            <label>
              Timeframe
              <select value={config.timeframe} onChange={handleChange("timeframe")}>
                <option value="1D">Daily</option>
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>
              Start date
              <input type="date" value={config.start_date} onChange={handleChange("start_date")} />
            </label>
            <label>
              End date
              <input type="date" value={config.end_date} onChange={handleChange("end_date")} />
            </label>
          </div>
          <div className="form-row">
            <label>
              SMA fast
              <input type="number" min={1} value={config.sma_fast} onChange={handleChange("sma_fast")} />
            </label>
            <label>
              SMA slow
              <input type="number" min={2} value={config.sma_slow} onChange={handleChange("sma_slow")} />
            </label>
          </div>
          <div className="form-row">
            <label>
              RSI period
              <input type="number" min={2} value={config.rsi_period} onChange={handleChange("rsi_period")} />
            </label>
            <label>
              RSI overbought
              <input type="number" min={0} max={100} value={config.rsi_overbought} onChange={handleChange("rsi_overbought")} />
            </label>
            <label>
              RSI oversold
              <input type="number" min={0} max={100} value={config.rsi_oversold} onChange={handleChange("rsi_oversold")} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Position mode
              <select value={config.position_mode} onChange={handleChange("position_mode")}>
                <option value="long_only">Long only</option>
                <option value="long_flat">Long / Flat</option>
                <option value="long_short">Long / Short</option>
              </select>
            </label>
            <label>
              Max position size (fraction of equity)
              <input type="number" step="0.1" min={0} max={1} value={config.max_position_size} onChange={handleChange("max_position_size")} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Slippage (bps)
              <input type="number" step="0.1" value={config.slippage_bps} onChange={handleChange("slippage_bps")} />
            </label>
            <label>
              Commission per trade
              <input type="number" step="0.01" value={config.commission_per_trade} onChange={handleChange("commission_per_trade")} />
            </label>
          </div>
          <div className="form-row">
            <label>
              <input type="checkbox" checked={config.use_sma} onChange={handleCheckbox("use_sma")} /> Use SMA crossover
            </label>
            <label>
              <input type="checkbox" checked={config.use_rsi} onChange={handleCheckbox("use_rsi")} /> Apply RSI filter
            </label>
          </div>
          <button className="btn btn-primary" type="submit">
            Run Backtest
          </button>
        </form>
      </Card>
    </PageShell>
  );
};

export default StrategyBuilderPage;
