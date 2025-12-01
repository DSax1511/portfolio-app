import React, { useState, useCallback, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Area, ReferenceLine
} from 'recharts';
import './AdvancedBacktestPage.css';

const AdvancedBacktestPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('walkforward');
  const [backtest, setBacktest] = useState(null);

  const [params, setParams] = useState({
    walkforward: {
      tickers: ['SPY', 'AGG', 'GLD'],
      start_date: '2022-01-01',
      end_date: '2024-12-31',
      train_window: 252,
      test_window: 63,
      monte_carlo_sims: 1000,
    },
    pairs: {
      asset1: 'AAPL',
      asset2: 'MSFT',
      start_date: '2022-01-01',
      end_date: '2024-12-31',
      lookback: 60,
      entry_zscore: 2.0,
      exit_zscore: 0.5,
      stop_loss_zscore: 3.0,
    },
    factors: {
      tickers: ['AAPL', 'JPM', 'XOM', 'PG'],
      weights: [0.25, 0.25, 0.25, 0.25],
      start_date: '2022-01-01',
      end_date: '2024-12-31',
    },
  });

  const runBacktest = async () => {
    try {
      setLoading(true);
      setError(null);

      const endpoints = {
        walkforward: '/api/backtests/walk-forward',
        pairs: '/api/strategies/pairs-trading',
        factors: '/api/analytics/factor-attribution-v2',
      };

      const payload = params[activeTab];
      const response = await fetch(endpoints[activeTab], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setBacktest(data);
    } catch (err) {
      setError(err.message || 'Analysis failed');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleParamChange = (field, value) => {
    setParams({
      ...params,
      [activeTab]: {
        ...params[activeTab],
        [field]: isNaN(value) ? value : isNaN(parseFloat(value)) ? value : parseFloat(value),
      },
    });
  };

  // Process walk-forward data
  const wfEquityData = useMemo(() => {
    if (!backtest?.walk_forward?.testing_performance) return [];
    return backtest.walk_forward.testing_performance.map((item, idx) => ({
      period: item.period?.substring(0, 7) || `Period ${idx}`,
      return: (item.return * 100).toFixed(2),
      sharpe: item.sharpe?.toFixed(2),
      vol: (item.vol * 100).toFixed(2),
    }));
  }, [backtest]);

  const wfMetrics = useMemo(() => {
    if (!backtest?.walk_forward) return {};
    const wf = backtest.walk_forward;
    return {
      oosReturn: (wf.out_of_sample_annual_return * 100).toFixed(2),
      oosSharpe: wf.out_of_sample_sharpe?.toFixed(2),
      oosVol: (wf.out_of_sample_volatility * 100).toFixed(2),
      maxDD: (wf.max_drawdown_oos * 100).toFixed(2),
      degradation: (wf.performance_degradation * 100).toFixed(1),
      overfitting: wf.overfitting_indicator,
    };
  }, [backtest]);

  const pairsMetrics = useMemo(() => {
    if (!backtest?.backtest) return {};
    const bt = backtest.backtest;
    return {
      annReturn: (bt.annual_return * 100)?.toFixed(2),
      sharpe: bt.sharpe_ratio?.toFixed(2),
      maxDD: (bt.max_drawdown * 100)?.toFixed(2),
      winRate: (bt.win_rate * 100)?.toFixed(1),
      numTrades: bt.num_trades,
    };
  }, [backtest]);

  const factorMetrics = useMemo(() => {
    if (!backtest?.attribution) return {};
    const attr = backtest.attribution;
    return {
      alpha: attr.alpha_annual_bps?.toFixed(0),
      alphaSig: attr.alpha_significant ? '✓' : '✗',
      marketBeta: attr.factor_betas?.market?.toFixed(2),
      systematic: backtest.risk_decomposition?.systematic_pct?.toFixed(1),
    };
  }, [backtest]);

  const drawdownData = useMemo(() => {
    if (!backtest?.drawdown_analysis?.underwater_chart) return [];
    return backtest.drawdown_analysis.underwater_chart.slice(-252).map((dd, idx) => ({
      day: idx,
      drawdown: (dd * 100).toFixed(2),
    }));
  }, [backtest]);

  const mcSimulations = useMemo(() => {
    if (!backtest?.monte_carlo_robustness?.sharpe_percentiles) return {};
    const mc = backtest.monte_carlo_robustness;
    return {
      meanReturn: (mc.mean_return * 100).toFixed(2),
      stdReturn: (mc.std_return * 100).toFixed(2),
      probPos: (mc.probability_positive * 100).toFixed(1),
      p5: mc.sharpe_percentiles?.['5th']?.toFixed(2),
      p50: mc.sharpe_percentiles?.['50th']?.toFixed(2),
      p95: mc.sharpe_percentiles?.['95th']?.toFixed(2),
    };
  }, [backtest]);

  return (
    <div className="advanced-backtest-v2">
      {/* Hero Section */}
      <div className="hero-section">
        <div className="hero-content">
          <h1>Advanced Backtesting Suite</h1>
          <p>Institutional-grade strategy analysis with walk-forward validation, pairs trading, and factor attribution</p>
          <div className="hero-badges">
            <span className="badge">📊 Walk-Forward</span>
            <span className="badge">🔗 Pairs Trading</span>
            <span className="badge">📈 Factor Analysis</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tabs-container">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'walkforward' ? 'active' : ''}`}
            onClick={() => { setActiveTab('walkforward'); setBacktest(null); }}
          >
            <span className="tab-icon">📊</span>
            <div className="tab-text">
              <div className="tab-label">Walk-Forward Validation</div>
              <div className="tab-hint">Out-of-sample testing</div>
            </div>
          </button>
          <button
            className={`tab ${activeTab === 'pairs' ? 'active' : ''}`}
            onClick={() => { setActiveTab('pairs'); setBacktest(null); }}
          >
            <span className="tab-icon">🔗</span>
            <div className="tab-text">
              <div className="tab-label">Pairs Trading</div>
              <div className="tab-hint">Cointegration arbitrage</div>
            </div>
          </button>
          <button
            className={`tab ${activeTab === 'factors' ? 'active' : ''}`}
            onClick={() => { setActiveTab('factors'); setBacktest(null); }}
          >
            <span className="tab-icon">📈</span>
            <div className="tab-text">
              <div className="tab-label">Factor Attribution</div>
              <div className="tab-hint">Fama-French 5-factor</div>
            </div>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="backtest-container">
        {/* Left Panel: Parameters */}
        <div className="params-panel">
          <div className="params-card">
            <h3>Strategy Parameters</h3>

            {activeTab === 'walkforward' && (
              <>
                <div className="param-group">
                  <label>Tickers</label>
                  <input
                    type="text"
                    value={params.walkforward.tickers.join(', ')}
                    onChange={(e) => handleParamChange('tickers', e.target.value.split(',').map(t => t.trim()))}
                    placeholder="SPY, AGG, GLD"
                  />
                </div>
                <div className="param-group">
                  <label>Training Window (days)</label>
                  <input
                    type="number"
                    value={params.walkforward.train_window}
                    onChange={(e) => handleParamChange('train_window', e.target.value)}
                    min="100"
                    max="1000"
                  />
                  <span className="hint">Typically 1 year (252 days)</span>
                </div>
                <div className="param-group">
                  <label>Testing Window (days)</label>
                  <input
                    type="number"
                    value={params.walkforward.test_window}
                    onChange={(e) => handleParamChange('test_window', e.target.value)}
                    min="20"
                    max="252"
                  />
                  <span className="hint">Typically 1 quarter (63 days)</span>
                </div>
                <div className="param-group">
                  <label>Monte Carlo Simulations</label>
                  <input
                    type="number"
                    value={params.walkforward.monte_carlo_sims}
                    onChange={(e) => handleParamChange('monte_carlo_sims', e.target.value)}
                    min="100"
                    max="5000"
                    step="100"
                  />
                </div>
              </>
            )}

            {activeTab === 'pairs' && (
              <>
                <div className="param-group">
                  <label>Asset 1</label>
                  <input
                    type="text"
                    value={params.pairs.asset1}
                    onChange={(e) => handleParamChange('asset1', e.target.value.toUpperCase())}
                    placeholder="AAPL"
                  />
                </div>
                <div className="param-group">
                  <label>Asset 2</label>
                  <input
                    type="text"
                    value={params.pairs.asset2}
                    onChange={(e) => handleParamChange('asset2', e.target.value.toUpperCase())}
                    placeholder="MSFT"
                  />
                </div>
                <div className="param-group">
                  <label>Entry Z-Score</label>
                  <input
                    type="number"
                    value={params.pairs.entry_zscore}
                    onChange={(e) => handleParamChange('entry_zscore', e.target.value)}
                    step="0.1"
                    min="1"
                    max="4"
                  />
                  <span className="hint">Entry at deviation from mean</span>
                </div>
                <div className="param-group">
                  <label>Exit Z-Score</label>
                  <input
                    type="number"
                    value={params.pairs.exit_zscore}
                    onChange={(e) => handleParamChange('exit_zscore', e.target.value)}
                    step="0.1"
                    min="0.1"
                    max="2"
                  />
                  <span className="hint">Exit when reverting to mean</span>
                </div>
              </>
            )}

            {activeTab === 'factors' && (
              <>
                <div className="param-group">
                  <label>Tickers</label>
                  <input
                    type="text"
                    value={params.factors.tickers.join(', ')}
                    onChange={(e) => handleParamChange('tickers', e.target.value.split(',').map(t => t.trim()))}
                    placeholder="AAPL, JPM, XOM, PG"
                  />
                </div>
                <div className="param-group">
                  <label>Weights</label>
                  <div className="weight-display">
                    {params.factors.weights.map((w, i) => (
                      <span key={i} className="weight-badge">{(w * 100).toFixed(0)}%</span>
                    ))}
                  </div>
                </div>
              </>
            )}

            <button
              className="run-btn"
              onClick={runBacktest}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner"></span> Analyzing...
                </>
              ) : (
                <>▶ Run Analysis</>
              )}
            </button>

            {error && (
              <div className="error-box">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Results */}
        <div className="results-panel">
          {!backtest ? (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <h3>Configure and Run Analysis</h3>
              <p>Adjust parameters on the left and click "Run Analysis" to see results</p>
            </div>
          ) : (
            <>
              {/* Walk-Forward Results */}
              {activeTab === 'walkforward' && backtest.walk_forward && (
                <div className="results-content">
                  {/* Key Metrics Grid */}
                  <div className="metrics-grid">
                    <div className="metric-card primary">
                      <div className="metric-label">Out-of-Sample Sharpe</div>
                      <div className="metric-value">{wfMetrics.oosSharpe}</div>
                      <div className="metric-insight">{wfMetrics.oosReturn}% annual return</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Volatility</div>
                      <div className="metric-value">{wfMetrics.oosVol}%</div>
                      <div className="metric-insight">Annualized</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Max Drawdown</div>
                      <div className="metric-value red">{wfMetrics.maxDD}%</div>
                      <div className="metric-insight">OOS period</div>
                    </div>
                    <div className={`metric-card ${wfMetrics.overfitting === 'low' ? 'success' : wfMetrics.overfitting === 'medium' ? 'warning' : 'danger'}`}>
                      <div className="metric-label">Overfitting</div>
                      <div className="metric-value">{wfMetrics.overfitting}</div>
                      <div className="metric-insight">Degradation: {wfMetrics.degradation}%</div>
                    </div>
                  </div>

                  {/* Testing vs Training Performance */}
                  <div className="chart-section">
                    <h4>Performance by Period</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={wfEquityData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="return" fill="#6366f1" name="Return %" />
                        <Bar dataKey="sharpe" fill="#10b981" name="Sharpe Ratio" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Drawdown Analysis */}
                  {backtest.drawdown_analysis && (
                    <div className="chart-section">
                      <h4>Underwater Plot (Max Drawdown: {backtest.drawdown_analysis.max_drawdown?.toFixed(2)}%)</h4>
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={drawdownData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="day" />
                          <YAxis />
                          <Tooltip />
                          <Area type="monotone" dataKey="drawdown" fill="#ef4444" stroke="#dc2626" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Monte Carlo Results */}
                  {backtest.monte_carlo_robustness && (
                    <div className="metrics-grid">
                      <div className="metric-card">
                        <div className="metric-label">MC Mean Return</div>
                        <div className="metric-value">{mcSimulations.meanReturn}%</div>
                      </div>
                      <div className="metric-card">
                        <div className="metric-label">MC Std Dev</div>
                        <div className="metric-value">{mcSimulations.stdReturn}%</div>
                      </div>
                      <div className="metric-card success">
                        <div className="metric-label">Prob. Positive</div>
                        <div className="metric-value">{mcSimulations.probPos}%</div>
                      </div>
                      <div className="metric-card">
                        <div className="metric-label">Sharpe 50th %ile</div>
                        <div className="metric-value">{mcSimulations.p50}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Pairs Trading Results */}
              {activeTab === 'pairs' && backtest.backtest && (
                <div className="results-content">
                  <div className="metrics-grid">
                    <div className="metric-card primary">
                      <div className="metric-label">Annual Return</div>
                      <div className="metric-value">{pairsMetrics.annReturn}%</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Sharpe Ratio</div>
                      <div className="metric-value">{pairsMetrics.sharpe}</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Max Drawdown</div>
                      <div className="metric-value red">{pairsMetrics.maxDD}%</div>
                    </div>
                    <div className="metric-card success">
                      <div className="metric-label">Win Rate</div>
                      <div className="metric-value">{pairsMetrics.winRate}%</div>
                      <div className="metric-insight">{pairsMetrics.numTrades} trades</div>
                    </div>
                  </div>

                  {backtest.cointegration?.pairs && (
                    <div className="info-box">
                      <h4>Cointegration Test Results</h4>
                      <div className="cointegration-result">
                        <div>✓ Cointegrated</div>
                        <div>Spread Z-Score: {backtest.cointegration.pairs[0]?.spread_zscore?.toFixed(2)}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Factor Attribution Results */}
              {activeTab === 'factors' && backtest.attribution && (
                <div className="results-content">
                  <div className="metrics-grid">
                    <div className="metric-card primary">
                      <div className="metric-label">Alpha (Annual)</div>
                      <div className="metric-value">{factorMetrics.alpha} bps</div>
                      <div className={`metric-insight ${factorMetrics.alphaSig === '✓' ? 'success' : 'warning'}`}>
                        Significant: {factorMetrics.alphaSig}
                      </div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Market Beta</div>
                      <div className="metric-value">{factorMetrics.marketBeta}</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Systematic Risk</div>
                      <div className="metric-value">{factorMetrics.systematic}%</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">R-Squared</div>
                      <div className="metric-value">{(backtest.attribution.r_squared * 100)?.toFixed(1)}%</div>
                    </div>
                  </div>

                  {backtest.attribution?.factor_betas && (
                    <div className="factor-loadings">
                      <h4>Factor Loadings</h4>
                      <div className="factor-grid">
                        {Object.entries(backtest.attribution.factor_betas).map(([factor, beta]) => (
                          <div key={factor} className="factor-item">
                            <span className="factor-name">{factor}</span>
                            <span className={`factor-value ${beta > 0 ? 'positive' : beta < 0 ? 'negative' : ''}`}>
                              {beta?.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="footer-info">
        <p>💡 Walk-Forward validation separates training and testing periods to prevent lookahead bias</p>
        <p>🔗 Pairs trading identifies stationary combinations for mean-reversion arbitrage</p>
        <p>📈 Factor attribution decomposes returns across systematic risk drivers</p>
      </div>
    </div>
  );
};

export default AdvancedBacktestPage;
