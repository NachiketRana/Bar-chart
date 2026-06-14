import React, { useState, useEffect } from 'react';
import StockTable from './components/StockTable';
import CandlestickChart from './components/CandlestickChart';
import AdvancedWaveChart from './components/AdvancedWaveChart';
import WaveScanner from './components/WaveScanner';
import AIAnalyst from './components/AIAnalyst';
import { BarChart3 } from 'lucide-react';
import './App.css';

function App() {
  const [stockData, setStockData] = useState([]);
  const [allStocksData, setAllStocksData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSymbol, setSelectedSymbol] = useState('RELIANCE.NS');
  const [intervalState, setIntervalState] = useState('1w');
  const [historyLimit, setHistoryLimit] = useState('5'); // '1', '2', '5', '10', '20', 'max'
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' or 'scanner'

  const availableSymbols = [
    // Indian Equities (Nifty 50)
    'RELIANCE.NS', 'VEDL.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS', 
    'BHARTIARTL.NS', 'SBIN.NS', 'LICI.NS', 'ITC.NS', 'LT.NS', 
    'TATASTEEL.NS', 'SUNPHARMA.NS', 'AXISBANK.NS', 'KOTAKBANK.NS', 
    'WIPRO.NS', 'HINDUNILVR.NS', 'ADANIENT.NS', 'ADANIPORTS.NS', 
    'ASIANPAINT.NS', 'BAJFINANCE.NS', 'BAJAJFINSV.NS', 'BPCL.NS', 
    'CIPLA.NS', 'COALINDIA.NS', 'DRREDDY.NS', 'EICHERMOT.NS', 
    'GRASIM.NS', 'HCLTECH.NS', 'HINDALCO.NS', 'JSWSTEEL.NS', 
    'MARUTI.NS', 'NESTLEIND.NS', 'NTPC.NS', 'ONGC.NS', 'POWERGRID.NS', 
    'TATACONSUM.NS', 'TECHM.NS', 'TITAN.NS', 'ULTRACEMCO.NS', 'BEL.NS', 'HDFCLIFE.NS',
    // US Equities
    'AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'NFLX', 'META', 'AMZN',
    // Cryptocurrencies
    'BTC-USD', 'ETH-USD'
  ];

  useEffect(() => {
    const fetchAllStocksData = async () => {
      try {
        setIsLoading(true);
        const dataMap = {};
        
        // Fetch data for all available symbols concurrently
        await Promise.all(
          availableSymbols.map(async (sym) => {
            let url = `http://localhost:5000/api/stocks/${sym}?interval=${intervalState}`;
            if (historyLimit !== 'max') {
              url += `&limitYears=${historyLimit}`;
            }
            const response = await fetch(url);
            if (response.ok) {
              const data = await response.json();
              dataMap[sym] = data;
            }
          })
        );

        setAllStocksData(dataMap);

        // Update active chart data
        if (dataMap[selectedSymbol]) {
          setStockData(dataMap[selectedSymbol]);
        }
        setError(null);
      } catch (err) {
        console.error("Failed to fetch stock data:", err);
        setError("Failed to connect to the backend server. Is it running on port 5000?");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllStocksData();
    
    // Refresh data every 30 seconds
    const intervalId = setInterval(fetchAllStocksData, 30000);
    return () => clearInterval(intervalId);
  }, [intervalState, selectedSymbol, historyLimit]);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-container">
          <div className="logo-icon-wrapper">
            <BarChart3 size={24} className="logo-icon" />
          </div>
          <h1>Market<span className="text-accent">Pulse</span></h1>
        </div>
        <p className="subtitle">Real-time OHLCV Data Analytics & Elliott Wave Scanner</p>
      </header>

      {/* Navigation Tabs */}
      <div className="tabs-navigation glass-panel">
        <button 
          className={`tab-nav-btn ${activeTab === 'dashboard' ? 'tab-nav-active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          📈 Standard Dashboard
        </button>
        <button 
          className={`tab-nav-btn ${activeTab === 'scanner' ? 'tab-nav-active' : ''}`}
          onClick={() => setActiveTab('scanner')}
        >
          🔍 Elliott Wave Scanner
        </button>
      </div>

      <main className="app-main">
        <div className="controls-container glass-panel" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <label htmlFor="symbol-select" style={{ fontWeight: 'bold' }}>Select Stock:</label>
          <select 
            id="symbol-select" 
            value={selectedSymbol} 
            onChange={(e) => setSelectedSymbol(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px', background: '#1c2128', color: '#c9d1d9', border: '1px solid #30363d' }}
          >
            {availableSymbols.map(sym => (
              <option key={sym} value={sym}>{sym}</option>
            ))}
          </select>

          <label htmlFor="history-select" style={{ fontWeight: 'bold', marginLeft: '1.5rem' }}>History Limit:</label>
          <select 
            id="history-select" 
            value={historyLimit} 
            onChange={(e) => setHistoryLimit(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px', background: '#1c2128', color: '#c9d1d9', border: '1px solid #30363d' }}
          >
            <option value="1">1 Year</option>
            <option value="2">2 Years</option>
            <option value="5">5 Years</option>
            <option value="10">10 Years</option>
            <option value="20">20 Years</option>
            <option value="max">Max History</option>
          </select>

          <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto', alignItems: 'center' }}>
            {['1h', '1d', '1w', '1m', '1y'].map(int => (
              <button 
                key={int}
                onClick={() => {
                  setIntervalState(int);
                }}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '4px',
                  background: intervalState === int ? '#388bfd' : '#21262d',
                  color: '#ffffff',
                  border: '1px solid #30363d',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {int.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'dashboard' ? (
          <>
            <CandlestickChart data={stockData} />
            <StockTable data={stockData} isLoading={isLoading} error={error} />
          </>
        ) : (
          <>
            {/* Elliott Wave Scanner Tab */}
            <WaveScanner 
              allStocksData={allStocksData} 
              selectedSymbol={selectedSymbol}
              onSelectSymbol={setSelectedSymbol}
            />
            {allStocksData[selectedSymbol] && (
              <AdvancedWaveChart data={allStocksData[selectedSymbol]} />
            )}
          </>
        )}

        {/* AI Trading Analyst Panel */}
        {stockData && stockData.length > 0 && (
          <AIAnalyst symbol={selectedSymbol} data={stockData} />
        )}
      </main>
      
      <footer className="app-footer">
        <p>Data provided by Postgres Database &bull; Connected to Node.js Backend</p>
      </footer>
    </div>
  );
}

export default App;
