import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';
import './RiskLabPage.css';

const RiskLabPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('var-cvar');
  const [riskData, setRiskData] = useState(null);
  
  const [params, setParams] = useState({
    confidence: 0.95,
    method: 'historical',
    portfolio_value: 100000,
  });

  const runAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/risk-lab/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'JNJ'],
          confidence: params.confidence,
          method: params.method,
          portfolio_value: params.portfolio_value,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setRiskData(data);
    } catch (err) {
      setError(err.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const handleParamChange = (field, value) => {
    setParams({
      ...params,
      [field]: isNaN(value) ? value : parseFloat(value),
    });
  };

  // Transform data for charts
  const stressTestData = riskData?.stress_test?.scenarios?.map(s => ({
    scenario: s.scenario.replace(/_/g, ' '),
    loss: Math.abs(s.loss_percent * 100),
  })) || [];

  const drawdownData = riskData?.tail_risk?.drawdown_series?.dates?.map((date, idx) => ({
    date: new Date(date).toLocaleDateString(),
    drawdown: (riskData.tail_risk.drawdown_series.drawdown[idx] * 100),
  })) || [];

  const pcaLoadingsData = riskData?.pca?.loadings
    ? Object.entries(riskData.pca.loadings).map(([asset, values]) => ({
        asset,
        PC1: values.PC1,
        PC2: values.PC2,
        PC3: values.PC3,
      }))
    : [];

  return (
    <div className="risk-lab">
      <div className="page-header">
        <h1>⚠️ Risk Lab</h1>
        <p>Comprehensive risk measurement and stress testing</p>
      </div>

      {/* Control Panel */}
      <div className="control-panel">
        <div className="control-group">
          <label>Confidence Level: {(params.confidence * 100).toFixed(0)}%</label>
          <input 
            type="range"
            min="0.90"
            max="0.99"
            step="0.01"
            value={params.confidence}
            onChange={(e) => handleParamChange('confidence', e.target.value)}
          />
        </div>

        <div className="control-group">
          <label>VaR Method</label>
          <select 
            value={params.method}
            onChange={(e) => handleParamChange('method', e.target.value)}
          >
            <option value="historical">Historical</option>
            <option value="parametric">Parametric</option>
            <option value="cornish_fisher">Cornish-Fisher</option>
          </select>
        </div>

        <div className="control-group">
          <label>Portfolio Value ($)</label>
          <input 
            type="number"
            value={params.portfolio_value}
            onChange={(e) => handleParamChange('portfolio_value', e.target.value)}
            placeholder="Portfolio value"
          />
        </div>

        <button 
          className="btn-primary"
          onClick={runAnalysis}
          disabled={loading}
        >
          {loading ? 'Analyzing...' : 'Run Analysis'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'var-cvar' ? 'active' : ''}`}
          onClick={() => setActiveTab('var-cvar')}
        >
          VaR / CVaR
        </button>
        <button 
          className={`tab ${activeTab === 'stress' ? 'active' : ''}`}
          onClick={() => setActiveTab('stress')}
        >
          Stress Testing
        </button>
        <button 
          className={`tab ${activeTab === 'drawdown' ? 'active' : ''}`}
          onClick={() => setActiveTab('drawdown')}
        >
          Drawdown Analysis
        </button>
        <button 
          className={`tab ${activeTab === 'pca' ? 'active' : ''}`}
          onClick={() => setActiveTab('pca')}
        >
          PCA Decomposition
        </button>
      </div>

      {/* Content */}
      <div className="content">
        {/* VaR/CVaR Tab */}
        {activeTab === 'var-cvar' && riskData?.var_cvar && (
          <div className="tab-content">
            <div className="grid-2">
              <div className="card">
                <h3>Daily Risk Metrics</h3>
                <div className="metrics-grid">
                  <div className="metric">
                    <span className="label">VaR ({(riskData.var_cvar.confidence_level * 100).toFixed(0)}%)</span>
                    <span className="value">
                      {(riskData.var_cvar.var_daily * 100).toFixed(3)}%
                    </span>
                  </div>
                  <div className="metric">
                    <span className="label">CVaR ({(riskData.var_cvar.confidence_level * 100).toFixed(0)}%)</span>
                    <span className="value">
                      {(riskData.var_cvar.cvar_daily * 100).toFixed(3)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="card">
                <h3>Annualized Risk Metrics</h3>
                <div className="metrics-grid">
                  <div className="metric">
                    <span className="label">VaR (Annual)</span>
                    <span className="value">
                      {(riskData.var_cvar.var_annual * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="metric">
                    <span className="label">CVaR (Annual)</span>
                    <span className="value">
                      {(riskData.var_cvar.cvar_annual * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3>Distribution Diagnostics</h3>
              <ul className="metrics-list">
                <li>
                  <span>Mean Return</span>
                  <span>{(riskData.var_cvar.diagnostics.mean * 100).toFixed(3)}%</span>
                </li>
                <li>
                  <span>Volatility</span>
                  <span>{(riskData.var_cvar.diagnostics.std * 100).toFixed(3)}%</span>
                </li>
                <li>
                  <span>Skewness</span>
                  <span>{riskData.var_cvar.diagnostics.skew.toFixed(3)}</span>
                </li>
                <li>
                  <span>Excess Kurtosis</span>
                  <span>{riskData.var_cvar.diagnostics.kurtosis.toFixed(3)}</span>
                </li>
              </ul>
              <p className="note">
                VaR: Maximum expected loss at {(riskData.var_cvar.confidence_level * 100).toFixed(0)}% confidence
              </p>
              <p className="note">
                CVaR: Expected loss given that loss exceeds VaR (tail risk)
              </p>
            </div>
          </div>
        )}

        {/* Stress Testing Tab */}
        {activeTab === 'stress' && riskData?.stress_test && (
          <div className="tab-content">
            <div className="card">
              <h3>Historical Crisis Scenarios</h3>
              {stressTestData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stressTestData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="scenario" />
                    <YAxis />
                    <Tooltip formatter={(value) => `${value.toFixed(2)}%`} />
                    <Bar dataKey="loss" fill="#ff6b6b" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="no-data">No data available</p>
              )}
            </div>

            <div className="grid-2">
              <div className="card">
                <h3>Worst Case Scenario</h3>
                <ul className="metrics-list">
                  <li>
                    <span>Scenario</span>
                    <span>{riskData.stress_test.summary.worst_case_scenario.replace(/_/g, ' ')}</span>
                  </li>
                  <li>
                    <span>Loss</span>
                    <span className="negative">
                      {(riskData.stress_test.summary.worst_case_loss * 100).toFixed(2)}%
                    </span>
                  </li>
                  <li>
                    <span>Dollar Loss</span>
                    <span className="negative">
                      ${Math.abs(riskData.stress_test.scenarios[0].dollar_loss).toFixed(0)}
                    </span>
                  </li>
                </ul>
              </div>

              <div className="card">
                <h3>Summary Statistics</h3>
                <ul className="metrics-list">
                  <li>
                    <span>Current Portfolio Value</span>
                    <span>${riskData.stress_test.current_value.toFixed(0)}</span>
                  </li>
                  <li>
                    <span>Average Loss (All Scenarios)</span>
                    <span className="negative">
                      {(riskData.stress_test.summary.avg_scenario_loss * 100).toFixed(2)}%
                    </span>
                  </li>
                  <li>
                    <span>Number of Scenarios</span>
                    <span>{riskData.stress_test.scenarios.length}</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="card">
              <h3>Scenario Details</h3>
              <table className="scenario-table">
                <thead>
                  <tr>
                    <th>Scenario</th>
                    <th>Return Shock</th>
                    <th>Loss %</th>
                    <th>Shocked Vol</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {riskData.stress_test.scenarios.map((s) => (
                    <tr key={s.scenario}>
                      <td>{s.scenario.replace(/_/g, ' ')}</td>
                      <td>{(s.return_shock * 100).toFixed(1)}%</td>
                      <td className="negative">{(s.loss_percent * 100).toFixed(2)}%</td>
                      <td>{(s.shocked_volatility * 100).toFixed(1)}%</td>
                      <td>{s.duration_days} days</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Drawdown Tab */}
        {activeTab === 'drawdown' && riskData?.tail_risk && (
          <div className="tab-content">
            <div className="card">
              <h3>Drawdown Over Time</h3>
              {drawdownData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={drawdownData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis />
                    <Tooltip formatter={(value) => `${value.toFixed(2)}%`} />
                    <Line 
                      type="monotone"
                      dataKey="drawdown"
                      stroke="#ff6b6b"
                      isAnimationActive={false}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="no-data">No data available</p>
              )}
            </div>

            <div className="grid-2">
              <div className="card">
                <h3>Drawdown Metrics</h3>
                <ul className="metrics-list">
                  <li>
                    <span>Maximum Drawdown</span>
                    <span className="negative">
                      {(riskData.tail_risk.max_drawdown * 100).toFixed(2)}%
                    </span>
                  </li>
                  <li>
                    <span>Max DD Duration</span>
                    <span>{riskData.tail_risk.max_drawdown_duration_days} days</span>
                  </li>
                  <li>
                    <span>Avg DD Duration</span>
                    <span>{riskData.tail_risk.avg_drawdown_duration_days.toFixed(0)} days</span>
                  </li>
                  <li>
                    <span>Number of DD Periods</span>
                    <span>{riskData.tail_risk.num_drawdown_periods}</span>
                  </li>
                </ul>
              </div>

              <div className="card">
                <h3>Risk-Adjusted Returns</h3>
                <ul className="metrics-list">
                  <li>
                    <span>CAGR</span>
                    <span>{(riskData.tail_risk.cagr * 100).toFixed(2)}%</span>
                  </li>
                  <li>
                    <span>Calmar Ratio</span>
                    <span>{riskData.tail_risk.calmar_ratio.toFixed(2)}</span>
                  </li>
                  <li>
                    <span>Sortino Ratio</span>
                    <span>{riskData.tail_risk.sortino_ratio.toFixed(2)}</span>
                  </li>
                  <li>
                    <span>Omega Ratio</span>
                    <span>{riskData.tail_risk.omega_ratio.toFixed(2)}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* PCA Tab */}
        {activeTab === 'pca' && riskData?.pca && (
          <div className="tab-content">
            <div className="grid-2">
              <div className="card">
                <h3>Explained Variance</h3>
                <div className="variance-bars">
                  {riskData.pca.explained_variance.map((v, i) => (
                    <div key={i} className="variance-bar">
                      <div className="bar-label">PC{i + 1}</div>
                      <div className="bar-container">
                        <div 
                          className="bar-fill"
                          style={{ width: `${v * 100}%` }}
                        />
                      </div>
                      <div className="bar-value">{(v * 100).toFixed(1)}%</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3>Cumulative Variance</h3>
                <ul className="metrics-list">
                  {riskData.pca.cumulative_variance.map((v, i) => (
                    <li key={i}>
                      <span>First {i + 1} PC{i + 1 > 1 ? 's' : ''}</span>
                      <span>{(v * 100).toFixed(1)}%</span>
                    </li>
                  ))}
                  <li>
                    <span>Effective Factors</span>
                    <span>{riskData.pca.effective_factors.toFixed(2)}</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="card">
              <h3>Principal Component Loadings</h3>
              {pcaLoadingsData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={pcaLoadingsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="asset" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="PC1" fill="#667eea" />
                    <Bar dataKey="PC2" fill="#764ba2" />
                    <Bar dataKey="PC3" fill="#f5576c" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="no-data">No data available</p>
              )}
              <p className="note">
                PCA decomposes asset returns into uncorrelated factors. 
                Effective factors ~5 indicates high diversification within the portfolio.
              </p>
            </div>
          </div>
        )}
      </div>

      {!riskData && !loading && (
        <div className="empty-state">
          <p>Click "Run Analysis" to compute risk metrics</p>
        </div>
      )}
    </div>
  );
};

export default RiskLabPage;
