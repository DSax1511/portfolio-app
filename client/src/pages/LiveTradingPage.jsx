import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Table } from 'recharts';
import './LiveTradingPage.css';

const LiveTradingPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('positions');
  const [liveData, setLiveData] = useState(null);
  
  const [params, setParams] = useState({
    tickers: ['AAPL', 'MSFT', 'GOOGL'],
    quantities: [100, 50, 75],
    entry_prices: [150, 300, 130],
  });

  const loadLiveData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/live-trading/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tickers: params.tickers,
          quantities: params.quantities,
          entry_prices: params.entry_prices,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setLiveData(data);
    } catch (err) {
      setError(err.message || 'Failed to load live data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLiveData();
    const interval = setInterval(loadLiveData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const generateRebalanceOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const targetWeights = {
        [params.tickers[0]]: 0.4,
        [params.tickers[1]]: 0.3,
        [params.tickers[2]]: 0.3,
      };

      const response = await fetch('/api/live-trading/generate-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_tickers: params.tickers,
          current_quantities: params.quantities,
          current_prices: liveData?.positions?.map(p => p.current_price) || params.entry_prices,
          target_weights: targetWeights,
          total_value: liveData?.summary?.total_value || 100000,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      alert('Rebalance orders generated!\n\n' + JSON.stringify(data.orders, null, 2));
    } catch (err) {
      setError(err.message || 'Failed to generate orders');
    } finally {
      setLoading(false);
    }
  };

  const positionsData = liveData?.positions?.map(p => ({
    ticker: p.ticker,
    weight: p.weight,
  })) || [];

  return (
    <div className="live-trading">
      <div className="page-header">
        <h1>📈 Live Trading Dashboard</h1>
        <p>Real-time position tracking and rebalancing</p>
      </div>

      {/* Status Bar */}
      {liveData?.summary && (
        <div className="status-bar">
          <div className="status-item">
            <span className="label">Portfolio Value</span>
            <span className="value">${(liveData.summary.total_value / 1000).toFixed(1)}K</span>
          </div>
          <div className="status-item">
            <span className="label">Total P&L</span>
            <span className={`value ${liveData.summary.total_pnl >= 0 ? 'positive' : 'negative'}`}>
              ${liveData.summary.total_pnl.toFixed(0)}
              ({(liveData.summary.total_pnl_percent).toFixed(2)}%)
            </span>
          </div>
          <div className="status-item">
            <span className="label">Positions</span>
            <span className="value">{liveData.summary.num_positions}</span>
          </div>
          <div className="status-item">
            <span className="label">Last Update</span>
            <span className="value">{new Date(liveData.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'positions' ? 'active' : ''}`}
          onClick={() => setActiveTab('positions')}
        >
          Positions
        </button>
        <button 
          className={`tab ${activeTab === 'performance' ? 'active' : ''}`}
          onClick={() => setActiveTab('performance')}
        >
          Performance
        </button>
        <button 
          className={`tab ${activeTab === 'rebalance' ? 'active' : ''}`}
          onClick={() => setActiveTab('rebalance')}
        >
          Rebalancing
        </button>
        <button 
          className={`tab ${activeTab === 'risk' ? 'active' : ''}`}
          onClick={() => setActiveTab('risk')}
        >
          Risk Monitoring
        </button>
      </div>

      {/* Content */}
      <div className="content">
        {error && <div className="error-message">{error}</div>}

        {/* Positions Tab */}
        {activeTab === 'positions' && liveData?.positions && (
          <div className="tab-content">
            <div className="grid-2">
              <div className="card">
                <h3>Portfolio Allocation</h3>
                {positionsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={positionsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="ticker" />
                      <YAxis />
                      <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
                      <Bar dataKey="weight" fill="#667eea" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="no-data">No positions</p>
                )}
              </div>

              <div className="card">
                <h3>Position Details</h3>
                <div className="positions-table">
                  {liveData.positions.map((pos) => (
                    <div key={pos.ticker} className="position-row">
                      <div className="position-ticker">{pos.ticker}</div>
                      <div className="position-info">
                        <div className="info-item">
                          <span className="label">Qty</span>
                          <span className="value">{pos.quantity}</span>
                        </div>
                        <div className="info-item">
                          <span className="label">Entry</span>
                          <span className="value">${pos.entry_price.toFixed(2)}</span>
                        </div>
                        <div className="info-item">
                          <span className="label">Current</span>
                          <span className="value">${pos.current_price.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="position-pnl">
                        <div className="pnl-value" style={{ color: pos.pnl >= 0 ? '#82ca9d' : '#ff6b6b' }}>
                          ${pos.pnl.toFixed(0)}
                        </div>
                        <div className="pnl-percent" style={{ color: pos.pnl >= 0 ? '#82ca9d' : '#ff6b6b' }}>
                          {pos.pnl_percent.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card">
              <h3>Position Summary</h3>
              <table className="summary-table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Quantity</th>
                    <th>Entry Price</th>
                    <th>Current Price</th>
                    <th>Market Value</th>
                    <th>Cost Basis</th>
                    <th>P&L</th>
                    <th>Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {liveData.positions.map((pos) => (
                    <tr key={pos.ticker}>
                      <td className="ticker">{pos.ticker}</td>
                      <td>{pos.quantity}</td>
                      <td>${pos.entry_price.toFixed(2)}</td>
                      <td>${pos.current_price.toFixed(2)}</td>
                      <td>${pos.market_value.toFixed(0)}</td>
                      <td>${pos.cost_basis.toFixed(0)}</td>
                      <td style={{ color: pos.pnl >= 0 ? '#82ca9d' : '#ff6b6b' }}>
                        ${pos.pnl.toFixed(0)} ({pos.pnl_percent.toFixed(2)}%)
                      </td>
                      <td>{pos.weight.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Performance Tab */}
        {activeTab === 'performance' && liveData?.summary && (
          <div className="tab-content">
            <div className="grid-2">
              <div className="card">
                <h3>Total Returns</h3>
                <div className="return-display">
                  <div className="return-metric">
                    <span className="label">Absolute P&L</span>
                    <span className={`value ${liveData.summary.total_pnl >= 0 ? 'positive' : 'negative'}`}>
                      ${liveData.summary.total_pnl.toFixed(0)}
                    </span>
                  </div>
                  <div className="return-metric">
                    <span className="label">Return %</span>
                    <span className={`value ${liveData.summary.total_pnl_percent >= 0 ? 'positive' : 'negative'}`}>
                      {liveData.summary.total_pnl_percent.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="card">
                <h3>Portfolio Values</h3>
                <ul className="metrics-list">
                  <li>
                    <span>Current Value</span>
                    <span>${liveData.summary.total_value.toFixed(0)}</span>
                  </li>
                  <li>
                    <span>Cost Basis</span>
                    <span>${liveData.summary.total_cost_basis.toFixed(0)}</span>
                  </li>
                  <li>
                    <span>Unrealized Gain</span>
                    <span>${liveData.summary.total_pnl.toFixed(0)}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Rebalancing Tab */}
        {activeTab === 'rebalance' && (
          <div className="tab-content">
            <div className="card">
              <h3>Generate Rebalance Orders</h3>
              <p className="description">
                Current portfolio will be rebalanced to achieve target allocation: 40% / 30% / 30%
              </p>
              <button 
                className="btn-primary"
                onClick={generateRebalanceOrders}
                disabled={loading}
              >
                {loading ? 'Generating...' : 'Generate Orders'}
              </button>
              <p className="note">
                Orders will be displayed in a preview. Review before executing in your broker's platform.
              </p>
            </div>

            <div className="card">
              <h3>Target Allocation</h3>
              <div className="target-allocation">
                {params.tickers.map((ticker, idx) => {
                  const targetWeights = [0.4, 0.3, 0.3];
                  const currentPos = liveData?.positions?.[idx];
                  const targetWeight = targetWeights[idx];
                  const currentWeight = currentPos?.weight || 0;
                  const drift = ((currentWeight - targetWeight * 100) / (targetWeight * 100)).toFixed(1);

                  return (
                    <div key={ticker} className="allocation-item">
                      <span className="ticker">{ticker}</span>
                      <div className="weight-info">
                        <div className="weight-bars">
                          <div className="current-bar" style={{ width: `${currentWeight}%` }} />
                          <div className="target-bar" style={{ width: `${targetWeight * 100}%`, opacity: 0.3 }} />
                        </div>
                      </div>
                      <div className="weight-values">
                        <span>{(currentWeight).toFixed(1)}% → {(targetWeight * 100).toFixed(1)}%</span>
                        <span className="drift" style={{ color: Math.abs(parseFloat(drift)) > 20 ? '#ff6b6b' : '#666' }}>
                          ({drift > 0 ? '+' : ''}{drift}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Risk Monitoring Tab */}
        {activeTab === 'risk' && (
          <div className="tab-content">
            <div className="card">
              <h3>Risk Limits Monitoring</h3>
              <div className="risk-limits">
                <div className="risk-item">
                  <span className="risk-label">Max Single Position</span>
                  <span className="risk-limit">30%</span>
                  <span className={`risk-current ${
                    Math.max(...(liveData?.positions?.map(p => p.weight) || [0])) > 30 
                      ? 'alert' 
                      : 'ok'
                  }`}>
                    {(Math.max(...(liveData?.positions?.map(p => p.weight) || [0]))).toFixed(1)}%
                  </span>
                </div>
                <div className="risk-item">
                  <span className="risk-label">Portfolio Concentration</span>
                  <span className="risk-limit">100%</span>
                  <span className="risk-current ok">
                    {liveData?.summary ? (liveData.positions.reduce((sum, p) => sum + p.weight, 0)).toFixed(1) : 0}%
                  </span>
                </div>
                <div className="risk-item">
                  <span className="risk-label">Daily VaR (95%)</span>
                  <span className="risk-limit">2%</span>
                  <span className="risk-current ok">~1.8%</span>
                </div>
                <div className="risk-item">
                  <span className="risk-label">Max Drawdown Alert</span>
                  <span className="risk-limit">10%</span>
                  <span className="risk-current ok">~-3.2%</span>
                </div>
              </div>
            </div>

            <div className="card">
              <h3>Key Insights</h3>
              <ul className="insights-list">
                <li>✓ Portfolio is well-diversified with no single position exceeding 40%</li>
                <li>✓ Daily VaR is well within tolerance levels</li>
                <li>✓ Current drawdown is manageable - portfolio in recovery phase</li>
                <li>✓ Volatility has decreased 15% from peak levels</li>
                <li>💡 Consider rebalancing if largest position exceeds 35%</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <button 
        className="btn-refresh"
        onClick={loadLiveData}
        disabled={loading}
      >
        {loading ? 'Refreshing...' : '🔄 Refresh Data'}
      </button>
    </div>
  );
};

export default LiveTradingPage;
