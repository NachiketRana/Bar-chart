import React, { useState } from 'react';
import { format } from 'date-fns';
import { TrendingUp, TrendingDown, Clock, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import './StockTable.css';

const StockTable = ({ data, isLoading, error }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  if (isLoading) {
    return (
      <div className="table-status-container glass-panel">
        <div className="loader"></div>
        <p>Fetching market data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="table-status-container glass-panel error">
        <p>⚠️ {error}</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="table-status-container glass-panel">
        <p>No stock data available right now.</p>
      </div>
    );
  }

  // Format the price
  const formatPrice = (price, symbol) => {
    if (price === undefined || price === null) return 'N/A';
    const isIndian = symbol && (symbol.toUpperCase().endsWith('.NS') || symbol.toUpperCase().endsWith('.BO'));
    return new Intl.NumberFormat(isIndian ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: isIndian ? 'INR' : 'USD',
      minimumFractionDigits: 2
    }).format(price);
  };

  // Format large numbers (like volume)
  const formatVolume = (vol) => {
    if (vol === undefined || vol === null) return 'N/A';
    if (vol >= 1000000) return (vol / 1000000).toFixed(2) + 'M';
    if (vol >= 1000) return (vol / 1000).toFixed(2) + 'K';
    return vol.toString();
  };

  const totalPages = Math.ceil(data.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentData = data.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="table-wrapper glass-panel animate-fade-in">
      <div className="table-header">
        <h2>Live Market Feed</h2>
        <div className="table-badges">
          <span className="badge live"><Activity size={14} /> LIVE</span>
        </div>
      </div>
      
      <div className="table-responsive">
        <table className="stock-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Date / Time</th>
              <th>Open</th>
              <th>High</th>
              <th>Low</th>
              <th>Close</th>
              <th>Volume</th>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>
            {currentData.map((row, index) => {
              // Determine if it was a bullish or bearish period
              const isBullish = row.close >= row.open;
              
              // Handle potentially different column names gracefully
              const dt = row.datetime || row.time || row.date;
              const formattedDate = dt ? format(new Date(dt), 'MMM dd, yyyy HH:mm:ss') : 'N/A';
              
              return (
                <tr key={index} className="table-row-hover">
                  <td className="symbol-cell">
                    <span className="symbol-badge">{row.symbol}</span>
                  </td>
                  <td className="time-cell">
                    <Clock size={14} className="time-icon" />
                    {formattedDate}
                  </td>
                  <td>{formatPrice(row.open, row.symbol)}</td>
                  <td>{formatPrice(row.high, row.symbol)}</td>
                  <td>{formatPrice(row.low, row.symbol)}</td>
                  <td className={isBullish ? 'text-success' : 'text-danger'}>
                    {formatPrice(row.close, row.symbol)}
                  </td>
                  <td className="volume-cell">{formatVolume(row.volume)}</td>
                  <td>
                    {isBullish ? (
                      <TrendingUp size={18} className="trend-icon success" />
                    ) : (
                      <TrendingDown size={18} className="trend-icon danger" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {totalPages > 1 && (
        <div className="pagination-controls">
          <button 
            className="pagination-btn" 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft size={18} /> Prev
          </button>
          <span className="pagination-info">
            Page {currentPage} of {totalPages} <span className="total-items">({data.length} total)</span>
          </span>
          <button 
            className="pagination-btn" 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
};

export default StockTable;
