import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './AdvancedBacktestPage.css';

const AdvancedBacktestPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeStrategy, setActiveStrategy] = useState('pairs');
  const [backtest, setBacktest] = useState(null);
  
  const [params, setParams] = useState({
    pairs: {
      ticker1: 'AAPL',
      ticker2: 'MSFT',
      lookback: 60,
      entry_z: 2.0,
      exit_z: 0.5,
    },
    garch: {
      target_vol: 0.15,
      lookback: 252,
    },
    walkforward: {
      lookback_months: 12,
      reopt_months: 3,
      method: 'sharpe',
    },
    momentum: {
      lookback: 126,
      holding_period: 21,
      top_n: 3,
    },
  });

  const runBacktest = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const endpoint = {
        pairs: '/api/backtest/pairs-trading',
        garch: '/api/backtest/garch-vol-targeting',
        walkforward: '/api/backtest/walk-forward',
        momentum: '/api/backtest/momentum',
      }[activeStrategy];

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params[activeStrategy]),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setBacktest(data);
    } catch (err) {
      setError(err.message || 'Backtest failed');
    } finally {
      setLoading(false);
    }
  };

  const handleParamChange = (field, value) => {
    setParams({
      ...params,
      [activeStrategy]: {
        ...params[activeStrategy],
        [field]: isNaN(value) ? value : parseFloat(value),
      },
    });
  };

  // Transform data for charts
  const equityData = backtest?.timeseries
    ? backtest.timeseries.dates.map((date, idx) => ({
        date: new Date(date).toLocaleDateString(),
        equity: (backtest.timeseries.cumulative_returns?.[idx] || 1) * 100,
        benchmark: (backtest.timeseries.benchmark?.[idx] || 1) * 100,
      }))
    : [];

  const strategyMetrics = backtest?.summary ? [
    { metric: 'Total Return', value: `${(backtest.summary.total_return * 100).toFixed(2)}%` },
    { metric: 'Sharpe Ratio', value: backtest.summary.sharpe_ratio?.toFixed(2) || 'N/A' },
    { metric: 'Max Drawdown', value: `${(backtest.summary.max_drawdown * 100).toFixed(2)}%` },
    { metric: 'Volatility', value: `${(backtest.summary.volatility * 100).toFixed(2)}%` },
  ] : [];

  return (
    <div className="advanced-backtest">
      <div className="page-header">
        <h1>🚀 Advanced Backtesting</h1>
        <p>Production-grade quant strategies with transaction cost modeling</p>
      </div>

      {/* Strategy Selector */}
      <div className="strategy-selector">
        <button 
          className={`strategy-btn ${activeStrategy === 'pairs' ? 'active' : ''}`}
          onClick={() => { setActiveStrategy('pairs'); setBacktest(null); }}
        >
          Pairs Trading
        </button>
        <button 
          className={`strategy-btn ${activeStrategy === 'garch' ? 'active' : ''}`}
          onClick={() => { setActiveStrategy('garch'); setBacktest(null); }}
        >
          GARCH Vol Target
        </button>
        <button 
          className={`strategy-btn ${activeStrategy === 'walkforward' ? 'active' : ''}`}
          onClick={() => { setActiveStrategy('walkforward'); setBacktest(null); }}
        >
          Walk-Forward Opt
        </button>
        <button 
          className={`strategy-btn ${activeStrategy === 'momentum' ? 'active' : ''}`}
          onClick={() => { setActiveStrategy('momentum'); setBacktest(null); }}
        >
          Momentum Strategy
        </button>
      </div>

      {/* Control Panel */}
      <div className="control-panel">
        {activeStrategy === 'pairs' && (
          <>
            <div className="control-group">
              <label>Ticker 1</label>
              <input 
                type="text"
                value={params.pairs.ticker1}
                onChange={(e) => handleParamChange('ticker1', e.target.value)}
                placeholder="e.g., AAPL"
              />
            </div>
            <div className="control-group">
              <label>Ticker 2</label>
              <input 
                type="text"
                value={params.pairs.ticker2}
                onChange={(e) => handleParamChange('ticker2', e.target.value)}
                placeholder="e.g., MSFT"
              />
            </div>
            <div className="control-group">
              <label>Lookback (days): {params.pairs.lookback}</label>
              <input 
                type="range"
                min="30"
                max="120"
                value={params.pairs.lookback}
                onChange={(e) => handleParamChange('lookback', e.target.value)}
              />
            </div>
            <div className="control-group">
              <label>Entry Z-Score: {params.pairs.entry_z.toFixed(1)}</label>
              <input 
                type="range"
                min="1"
                max="4"
                step="0.1"
                value={params.pairs.entry_z}
                onChange={(e) => handleParamChange('entry_z', e.target.value)}
              />
            </div>
          </>
        )}

        {activeStrategy === 'garch' && (
          <>
            <div className="control-group">
              <label>Target Volatility: {(params.garch.target_vol * 100).toFixed(1)}%</label>
              <input 
                type="range"
                min="0.05"
                max="0.30"
                step="0.01"
                value={params.garch.target_vol}
                onChange={(e) => handleParamChange('target_vol', e.target.value)}
              />
            </div>
            <div className="control-group">
              <label>Lookback (days): {params.garch.lookback}</label>
              <input 
                type="range"
                min="100"
                max="500"
                step="50"
                value={params.garch.lookback}
                onChange={(e) => handleParamChange('lookback', e.target.value)}
              />
            </div>
          </>
        )}

        {activeStrategy === 'walkforward' && (
          <>
            <div className="control-group">
              <label>Lookback (months): {params.walkforward.lookback_months}</label>
              <input 
                type="range"
                min="6"
                max="36"
                step="3"
                value={params.walkforward.lookback_months}
                onChange={(e) => handleParamChange('lookback_months', e.target.value)}
              />
            </div>
            <div className="control-group">
              <label>Reoptimization (months): {params.walkforward.reopt_months}</label>
              <input 
                type="range"
                min="1"
                max="12"
                step="1"
                value={params.walkforward.reopt_months}
                onChange={(e) => handleParamChange('reopt_months', e.target.value)}
              />
            </div>
            <div className="control-group">
              <label>Method</label>
              <select 
                value={params.walkforward.method}
                onChange={(e) => handleParamChange('method', e.target.value)}
              >
                <option value="sharpe">Max Sharpe</option>
                <option value="min_vol">Min Volatility</option>
                <option value="equal">Equal Weight</option>
              </select>
            </div>
          </>
        )}

        {activeStrategy === 'momentum' && (
          <>
            <div className="control-group">
              <label>Lookback (days): {params.momentum.lookback}</label>
              <input 
                type="range"
                min="63"
                max="252"
                step="21"
                value={params.momentum.lookback}
                onChange={(e) => handleParamChange('lookback', e.target.value)}
              />
            </div>
            <div className="control-group">
              <label>Holding (days): {params.momentum.holding_period}</label>
              <input 
                type="range"
                min="5"
                max="63"
                step="5"
                value={params.momentum.holding_period}
                onChange={(e) => handleParamChange('holding_period', e.target.value)}
              />
            </div>
            <div className="control-group">
              <label>Top N: {params.momentum.top_n}</label>
              <input 
                type="range"
                min="1"
                max="10"
                step="1"
                value={params.momentum.top_n}
                onChange={(e) => handleParamChange('top_n', e.target.value)}
              />
            </div>
          </>
        )}

        <button 
          className="btn-primary"
          onClick={runBacktest}
          disabled={loading}
        >
          {loading ? 'Running...' : 'Run Backtest'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Results */}
      {backtest && (
        <div className="results">
          {/* Equity Curve */}
          <div className="card">
            <h3>Strategy Performance</h3>
            {equityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={equityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis />
                  <Tooltip formatter={(value) => `${value.toFixed(2)}%`} />
                  <Legend />
                  <Line 
                    type="monotone"
                    dataKey="equity"
                    stroke="#667eea"
                    name="Strategy"
                    isAnimationActive={false}
                    dot={false}
                  />
                  {backtest.timeseries.benchmark && (
                    <Line 
                      type="monotone"
                      dataKey="benchmark"
                      stroke="#999"
                      name="Benchmark"
                      isAnimationActive={false}
                      dot={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="no-data">No data available</p>
            )}
          </div>

          {/* Metrics Grid */}
          <div className="metrics-grid">
            {strategyMetrics.map((m) => (
              <div key={m.metric} className="metric-card">
                <span className="metric-label">{m.metric}</span>
                <span className="metric-value">{m.value}</span>
              </div>
            ))}
          </div>

          {/* Strategy-Specific Details */}
          {activeStrategy === 'pairs' && backtest.summary && (
            <div className="card">
              <h3>Pairs Trading Details</h3>
              <ul className="details-list">
                <li>
                  <strong>Cointegration P-Value:</strong>
                  <span>{backtest.summary.cointegration_pvalue?.toFixed(6) || 'N/A'}</span>
                </li>
                <li>
                  <strong>Is Cointegrated:</strong>
                  <span>{backtest.summary.is_cointegrated ? '✓ Yes' : '✗ No'}</span>
                </li>
                <li>
                  <strong>Hedge Ratio:</strong>
                  <span>{backtest.summary.hedge_ratio?.toFixed(3) || 'N/A'}</span>
                </li>
                <li>
                  <strong>Number of Trades:</strong>
                  <span>{backtest.summary.num_trades || 0}</span>
                </li>
              </ul>
            </div>
          )}

          {activeStrategy === 'garch' && backtest.garch_params && (
            <div className="card">
              <h3>GARCH(1,1) Parameters</h3>
              <ul className="details-list">
                <li>
                  <strong>ω (omega):</strong>
                  <span>{backtest.garch_params.omega?.toFixed(8) || 'N/A'}</span>
                </li>
                <li>
                  <strong>α (alpha):</strong>
                  <span>{backtest.garch_params.alpha?.toFixed(6) || 'N/A'}</span>
                </li>
                <li>
                  <strong>β (beta):</strong>
                  <span>{backtest.garch_params.beta?.toFixed(6) || 'N/A'}</span>
                </li>
                <li>
                  <strong>Average Leverage:</strong>
                  <span>{backtest.summary.avg_leverage?.toFixed(2) || 'N/A'}x</span>
                </li>
              </ul>
            </div>
          )}

          {activeStrategy === 'walkforward' && backtest.summary && (
            <div className="card">
              <h3>Walk-Forward Summary</h3>
              <ul className="details-list">
                <li>
                  <strong>In-Sample Sharpe:</strong>
                  <span>{backtest.summary.in_sample_sharpe?.toFixed(2) || 'N/A'}</span>
                </li>
                <li>
                  <strong>Out-of-Sample Sharpe:</strong>
                  <span>{backtest.summary.sharpe_ratio?.toFixed(2) || 'N/A'}</span>
                </li>
                <li>
                  <strong>Number of Rebalances:</strong>
                  <span>{backtest.summary.num_rebalances || 0}</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      )}

      {!backtest && !loading && (
        <div className="empty-state">
          <p>Select strategy parameters and click "Run Backtest"</p>
        </div>
      )}
    </div>
  );
};

export default AdvancedBacktestPage;
