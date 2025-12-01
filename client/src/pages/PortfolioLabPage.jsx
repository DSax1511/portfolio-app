import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';
import './PortfolioLabPage.css';

const PortfolioLabPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Portfolio optimization state
  const [portfolioData, setPortfolioData] = useState(null);
  const [optParams, setOptParams] = useState({
    method: 'min_variance',
    use_shrinkage: true,
    risk_aversion: 2.0,
  });

  // Load initial portfolio data
  useEffect(() => {
    loadPortfolioData();
  }, []);

  const loadPortfolioData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Call backend for portfolio lab data
      const response = await fetch('/api/portfolio-lab/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'JNJ'],
          method: optParams.method,
          use_shrinkage: optParams.use_shrinkage,
          risk_aversion: optParams.risk_aversion,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setPortfolioData(data);
    } catch (err) {
      setError(err.message || 'Failed to load portfolio data');
    } finally {
      setLoading(false);
    }
  };

  const handleOptimizationChange = (field, value) => {
    const updated = { ...optParams, [field]: value };
    setOptParams(updated);
  };

  const handleRunOptimization = () => {
    loadPortfolioData();
  };

  // Transform data for charts
  const weightsData = portfolioData?.weights
    ? Object.entries(portfolioData.weights).map(([ticker, weight]) => ({
        name: ticker,
        value: Math.round(weight * 100),
      }))
    : [];

  const efficientFrontierData = portfolioData?.efficient_frontier
    ? portfolioData.efficient_frontier.map(point => ({
        volatility: (point.volatility * 100).toFixed(2),
        return: (point.return * 100).toFixed(2),
        sharpe: point.sharpe,
      }))
    : [];

  const famaFrenchData = portfolioData?.fama_french_attribution
    ? [
        { factor: 'Market', contribution: portfolioData.fama_french_attribution.market * 100 },
        { factor: 'Size (SMB)', contribution: portfolioData.fama_french_attribution.smb * 100 },
        { factor: 'Value (HML)', contribution: portfolioData.fama_french_attribution.hml * 100 },
        { factor: 'Profitability (RMW)', contribution: portfolioData.fama_french_attribution.rmw * 100 },
        { factor: 'Investment (CMA)', contribution: portfolioData.fama_french_attribution.cma * 100 },
      ]
    : [];

  return (
    <div className="portfolio-lab">
      <div className="page-header">
        <h1>📊 Portfolio Lab</h1>
        <p>Advanced portfolio optimization with mathematical rigor</p>
      </div>

      {/* Control Panel */}
      <div className="control-panel">
        <div className="control-group">
          <label>Optimization Method</label>
          <select 
            value={optParams.method}
            onChange={(e) => handleOptimizationChange('method', e.target.value)}
          >
            <option value="min_variance">Minimum Variance (Ledoit-Wolf)</option>
            <option value="max_sharpe">Maximum Sharpe Ratio</option>
            <option value="risk_parity">Risk Parity</option>
            <option value="equal_weight">Equal Weight</option>
          </select>
        </div>

        <div className="control-group">
          <label>Use Shrinkage Estimation</label>
          <input 
            type="checkbox"
            checked={optParams.use_shrinkage}
            onChange={(e) => handleOptimizationChange('use_shrinkage', e.target.checked)}
          />
          <span className="tooltip">Ledoit-Wolf shrinkage for ill-conditioned covariance matrices</span>
        </div>

        <div className="control-group">
          <label>Risk Aversion ({optParams.risk_aversion.toFixed(1)})</label>
          <input 
            type="range"
            min="0.5"
            max="5"
            step="0.1"
            value={optParams.risk_aversion}
            onChange={(e) => handleOptimizationChange('risk_aversion', parseFloat(e.target.value))}
          />
        </div>

        <button 
          className="btn-primary"
          onClick={handleRunOptimization}
          disabled={loading}
        >
          {loading ? 'Optimizing...' : 'Run Optimization'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`tab ${activeTab === 'efficient_frontier' ? 'active' : ''}`}
          onClick={() => setActiveTab('efficient_frontier')}
        >
          Efficient Frontier
        </button>
        <button 
          className={`tab ${activeTab === 'fama_french' ? 'active' : ''}`}
          onClick={() => setActiveTab('fama_french')}
        >
          Fama-French Attribution
        </button>
        <button 
          className={`tab ${activeTab === 'metrics' ? 'active' : ''}`}
          onClick={() => setActiveTab('metrics')}
        >
          Performance Metrics
        </button>
      </div>

      {/* Content */}
      <div className="content">
        {/* Overview Tab */}
        {activeTab === 'overview' && portfolioData && (
          <div className="tab-content">
            <div className="grid-2">
              <div className="card">
                <h3>Optimal Weights</h3>
                {weightsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={weightsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => `${value}%`} />
                      <Bar dataKey="value" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="no-data">No data available</p>
                )}
              </div>

              <div className="card">
                <h3>Portfolio Metrics</h3>
                <div className="metrics-grid">
                  <div className="metric">
                    <span className="label">Expected Return</span>
                    <span className="value">
                      {portfolioData?.expected_return 
                        ? `${(portfolioData.expected_return * 100).toFixed(2)}%` 
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="metric">
                    <span className="label">Volatility</span>
                    <span className="value">
                      {portfolioData?.volatility 
                        ? `${(portfolioData.volatility * 100).toFixed(2)}%` 
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="metric">
                    <span className="label">Sharpe Ratio</span>
                    <span className="value">
                      {portfolioData?.sharpe_ratio 
                        ? portfolioData.sharpe_ratio.toFixed(2)
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="metric">
                    <span className="label">Max Drawdown</span>
                    <span className="value negative">
                      {portfolioData?.max_drawdown 
                        ? `${(portfolioData.max_drawdown * 100).toFixed(2)}%` 
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3>Mathematical Details</h3>
              <div className="details-grid">
                <div className="detail-item">
                  <strong>Method:</strong>
                  <p>{optParams.method === 'min_variance' ? 'Minimum Variance with Ledoit-Wolf Shrinkage' : optParams.method}</p>
                </div>
                <div className="detail-item">
                  <strong>Covariance Estimation:</strong>
                  <p>
                    {optParams.use_shrinkage 
                      ? 'Ledoit-Wolf shrinkage for condition ratio < 10N' 
                      : 'Sample covariance'}
                  </p>
                </div>
                <div className="detail-item">
                  <strong>Risk Aversion:</strong>
                  <p>λ = {optParams.risk_aversion}</p>
                </div>
                <div className="detail-item">
                  <strong>Constraints:</strong>
                  <p>Long-only, fully invested, corner portfolio</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Efficient Frontier Tab */}
        {activeTab === 'efficient_frontier' && efficientFrontierData.length > 0 && (
          <div className="tab-content">
            <div className="card">
              <h3>Mean-Variance Efficient Frontier</h3>
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="volatility" 
                    name="Volatility (%)"
                    type="number"
                  />
                  <YAxis 
                    dataKey="return" 
                    name="Expected Return (%)"
                    type="number"
                  />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    formatter={(value, name) => {
                      if (name === 'Sharpe') return value.toFixed(2);
                      return `${value}%`;
                    }}
                  />
                  <Scatter 
                    name="Portfolio Points"
                    data={efficientFrontierData}
                    fill="#8884d8"
                  />
                </ScatterChart>
              </ResponsiveContainer>
              <p className="description">
                The efficient frontier shows the optimal risk-return tradeoff. 
                Each point represents a portfolio on the curve computed via quadratic programming.
              </p>
            </div>
          </div>
        )}

        {/* Fama-French Tab */}
        {activeTab === 'fama_french' && famaFrenchData.length > 0 && (
          <div className="tab-content">
            <div className="card">
              <h3>Fama-French 5-Factor Attribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={famaFrenchData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="factor" />
                  <YAxis />
                  <Tooltip formatter={(value) => `${value.toFixed(2)}%`} />
                  <Bar dataKey="contribution" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
              <div className="details-grid">
                <div className="detail-item">
                  <strong>Market (MKT):</strong>
                  <p>Exposure to the overall market risk factor</p>
                </div>
                <div className="detail-item">
                  <strong>Size (SMB):</strong>
                  <p>Small Minus Big - small cap premium</p>
                </div>
                <div className="detail-item">
                  <strong>Value (HML):</strong>
                  <p>High Minus Low - value premium</p>
                </div>
                <div className="detail-item">
                  <strong>Profitability (RMW):</strong>
                  <p>Robust Minus Weak - profitability factor</p>
                </div>
                <div className="detail-item">
                  <strong>Investment (CMA):</strong>
                  <p>Conservative Minus Aggressive - investment factor</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Metrics Tab */}
        {activeTab === 'metrics' && portfolioData && (
          <div className="tab-content">
            <div className="grid-2">
              <div className="card">
                <h3>Risk Metrics</h3>
                <ul className="metrics-list">
                  <li>
                    <span>Value at Risk (95%)</span>
                    <span>{portfolioData?.var_95 ? `${(portfolioData.var_95 * 100).toFixed(2)}%` : 'N/A'}</span>
                  </li>
                  <li>
                    <span>Conditional VaR (95%)</span>
                    <span>{portfolioData?.cvar_95 ? `${(portfolioData.cvar_95 * 100).toFixed(2)}%` : 'N/A'}</span>
                  </li>
                  <li>
                    <span>Beta</span>
                    <span>{portfolioData?.beta ? portfolioData.beta.toFixed(2) : 'N/A'}</span>
                  </li>
                  <li>
                    <span>Correlation to Market</span>
                    <span>{portfolioData?.correlation ? portfolioData.correlation.toFixed(3) : 'N/A'}</span>
                  </li>
                </ul>
              </div>

              <div className="card">
                <h3>Return Metrics</h3>
                <ul className="metrics-list">
                  <li>
                    <span>CAGR</span>
                    <span>{portfolioData?.cagr ? `${(portfolioData.cagr * 100).toFixed(2)}%` : 'N/A'}</span>
                  </li>
                  <li>
                    <span>Sortino Ratio</span>
                    <span>{portfolioData?.sortino ? portfolioData.sortino.toFixed(2) : 'N/A'}</span>
                  </li>
                  <li>
                    <span>Information Ratio</span>
                    <span>{portfolioData?.info_ratio ? portfolioData.info_ratio.toFixed(2) : 'N/A'}</span>
                  </li>
                  <li>
                    <span>Calmar Ratio</span>
                    <span>{portfolioData?.calmar ? portfolioData.calmar.toFixed(2) : 'N/A'}</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="card">
              <h3>Key Insights</h3>
              <ul className="insights-list">
                <li>✓ Portfolio optimized using quadratic programming (CVXPY)</li>
                <li>✓ Covariance matrix estimated with Ledoit-Wolf shrinkage</li>
                <li>✓ Risk factors decomposed via Fama-French 5-factor model</li>
                <li>✓ Efficient frontier computed via corner portfolio algorithm</li>
                <li>✓ Long-only constraints with fully invested condition</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {!portfolioData && !loading && !error && (
        <div className="empty-state">
          <p>Click "Run Optimization" to generate portfolio allocation</p>
        </div>
      )}
    </div>
  );
};

export default PortfolioLabPage;
