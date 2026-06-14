import React, { useState, useEffect, useRef } from 'react';
import { calculateAllIndicatorsAndSignals } from '../utils/indicators';
import { calculateElliottWave } from '../utils/elliottWave';
import { Brain, TrendingUp, AlertTriangle, ShieldCheck, Sparkles, RefreshCw, Layers, Compass, BarChart } from 'lucide-react';
import './AIAnalyst.css';

// Stock profiles to give realistic institutional-grade contextual analysis
const STOCK_PROFILES = {
  'RELIANCE.NS': {
    name: 'Reliance Industries Ltd.',
    description: 'Conglomerate spanning energy, petrochemicals, retail, and digital services (Jio). As the heaviest weight in the Nifty 50, its swings strongly influence index direction.'
  },
  'TCS.NS': {
    name: 'Tata Consultancy Services',
    description: 'India\'s leading IT service exporter. IT spending patterns, currency fluctuations (USD/INR), and enterprise cloud adoption drive its market cycles.'
  },
  'HDFCBANK.NS': {
    name: 'HDFC Bank Ltd.',
    description: 'The largest private bank in India. Its financial health, loan growth, and net interest margins reflect India\'s consumer credit cycle.'
  },
  'INFY.NS': {
    name: 'Infosys Ltd.',
    description: 'Global IT consulting leader. Highly sensitive to North American tech budgets and global digital transformation trends.'
  },
  'ICICIBANK.NS': {
    name: 'ICICI Bank Ltd.',
    description: 'Premier private sector bank with a focus on retail loan books, tech integration, and strong asset quality.'
  },
  'BHARTIARTL.NS': {
    name: 'Bharti Airtel Ltd.',
    description: 'Telecommunications giant. Benefits from ARPU expansion, mobile data consumption growth, and 5G capital expenditure trends.'
  },
  'SBIN.NS': {
    name: 'State Bank of India',
    description: 'The largest public sector bank. Acts as a proxy for the Indian economy, core infrastructure lending, and corporate credit cycle.'
  },
  'LICI.NS': {
    name: 'Life Insurance Corporation of India',
    description: 'The dominant insurance monolith. A major domestic institutional investor whose portfolio valuation is tied to overall equity market health.'
  },
  'ITC.NS': {
    name: 'ITC Ltd.',
    description: 'Diversified giant leading in cigarettes, FMCG, hotels, and paperboards. Serves as a defensive stock with robust cash flows and high dividend yield.'
  },
  'LT.NS': {
    name: 'Larsen & Toubro Ltd.',
    description: 'Multinational conglomerate focused on engineering, procurement, construction (EPC), manufacturing, and technology. Driven by public infrastructure spending.'
  },
  'TATASTEEL.NS': {
    name: 'Tata Steel Ltd.',
    description: 'One of the world\'s most geographically diversified steel producers. Cycles are driven by global metal demand, commodity pricing, infrastructure initiatives, and automotive sectors.'
  },
  'SUNPHARMA.NS': {
    name: 'Sun Pharmaceutical Industries',
    description: 'India\'s largest specialty generic pharmaceutical company. Influenced by FDA approvals, global specialty drug demand, and healthcare spending.'
  },
  'AXISBANK.NS': {
    name: 'Axis Bank Ltd.',
    description: 'Major private retail and corporate bank. Rebounds are driven by corporate credit recovery and credit card market shares.'
  },
  'KOTAKBANK.NS': {
    name: 'Kotak Mahindra Bank Ltd.',
    description: 'High-quality private lender known for conservative credit policies, high capital adequacy, and premium customer base.'
  },
  'WIPRO.NS': {
    name: 'Wipro Ltd.',
    description: 'Major tech services company. Relies on IT consulting, digital engineering, and business process services.'
  },
  'HINDUNILVR.NS': {
    name: 'Hindustan Unilever Ltd.',
    description: 'India\'s leading FMCG giant. Heavily reliant on rural demand, raw material price inflation, and domestic consumption patterns.'
  },
  'AAPL': {
    name: 'Apple Inc.',
    description: 'Global consumer electronics giant. Sensitive to supply chain cycles, consumer spending, and hardware product releases.'
  },
  'MSFT': {
    name: 'Microsoft Corp.',
    description: 'Global software and cloud computing titan (Azure). Highly sensitive to enterprise IT spend, SaaS metrics, and AI integration trends.'
  },
  'GOOGL': {
    name: 'Alphabet Inc.',
    description: 'Search engine and digital advertising monopoly. Driven by global ad spends, cloud computing growth, and AI technology adoption.'
  },
  'TSLA': {
    name: 'Tesla Inc.',
    description: 'EV pioneer and clean energy company. High retail volume, highly volatile swing cycles, and sensitive to auto manufacturing capacity.'
  },
  'NVDA': {
    name: 'NVIDIA Corp.',
    description: 'Leader in GPU computing and artificial intelligence chips. Driven by datacenter infrastructure CAPEX and AI developer demands.'
  },
  'NFLX': {
    name: 'Netflix Inc.',
    description: 'World\'s leading streaming entertainment service. Sensitive to global subscriber additions, content spend efficiency, and ad-tier growth.'
  },
  'META': {
    name: 'Meta Platforms Inc.',
    description: 'Social technology and digital advertising giant. Sensitive to user engagement across Instagram/Facebook/WhatsApp and AI computing costs.'
  },
  'AMZN': {
    name: 'Amazon.com Inc.',
    description: 'E-commerce and cloud infrastructure (AWS) market leader. Highly responsive to retail sales and enterprise IT budgets.'
  },
  'BTC-USD': {
    name: 'Bitcoin',
    description: 'The premier cryptocurrency by market cap. Acts as a high-beta indicator of global market liquidity, inflation expectations, and risk appetite.'
  },
  'ETH-USD': {
    name: 'Ethereum',
    description: 'The leading smart-contract blockchain platform. Valuation cycles correlate to decentralized financial activity, staking rates, and Web3 traffic.'
  },
  'HDFCLIFE.NS': {
    name: 'HDFC Life Insurance Company Ltd.',
    description: 'Leading private life insurance provider. Driven by protection policies expansion, savings products margins, and equity market asset flows.'
  }
};

const AIAnalyst = ({ symbol, data }) => {
  const [report, setReport] = useState('');
  const [typedText, setTypedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentSection, setCurrentSection] = useState('summary'); // 'summary' or 'technical'
  const typingTimerRef = useRef(null);

  // 1. Run Indicators and Wave Calculations
  const analysis = React.useMemo(() => {
    if (!data || data.length < 20) return null;

    const enriched = calculateAllIndicatorsAndSignals(data);
    const wave = calculateElliottWave(enriched);
    const latest = enriched[enriched.length - 1];

    const currentPrice = parseFloat(latest.close);
    const rsi = latest.rsi ? parseFloat(latest.rsi) : null;
    const ewo = latest.ewo ? parseFloat(latest.ewo) : null;
    const signal = latest.wave_signal || 'neutral';
    const confidence = latest.confidence || 0;

    // Estimate key levels
    const isIndian = symbol.toUpperCase().endsWith('.NS') || symbol.toUpperCase().endsWith('.BO');
    const currency = isIndian ? '₹' : '$';

    const recentLow = latest.swingLow || (currentPrice * 0.96);
    const recentHigh = latest.swingHigh || (currentPrice * 1.04);

    const support = parseFloat(recentLow.toFixed(2));
    const resistance = parseFloat(recentHigh.toFixed(2));
    
    // Stop loss placed slightly below support
    const stopLoss = parseFloat((support * 0.985).toFixed(2));

    // Target depends on setup
    let target = parseFloat((currentPrice * 1.15).toFixed(2));
    if (signal === 't1_pre' || signal === 't2_cross' || signal === 't3_confirm') {
      const impulseSize = currentPrice - support;
      target = parseFloat((currentPrice + impulseSize * 1.618).toFixed(2));
    } else if (signal === 'w5_exhaustion') {
      target = parseFloat((currentPrice * 0.90).toFixed(2)); // Short target
    }

    return {
      currentPrice,
      rsi,
      ewo,
      signal,
      confidence,
      support,
      resistance,
      stopLoss,
      target,
      currency,
      wave,
      enriched
    };
  }, [symbol, data]);

  // 2. Generate detailed AI text report
  const generateReportText = () => {
    if (!analysis) return 'Awaiting stock metrics to perform core mathematical analysis...';

    const profile = STOCK_PROFILES[symbol] || {
      name: symbol,
      description: 'An active asset in our tracking dashboard. Its price moves based on regular supply and demand forces.'
    };

    const cur = analysis.currency;
    const price = analysis.currentPrice.toFixed(2);
    const rsiVal = analysis.rsi ? analysis.rsi.toFixed(1) : 'N/A';
    const ewoVal = analysis.ewo ? analysis.ewo.toFixed(4) : 'N/A';
    
    // Convert RSI to plain language
    let rsiExplanation = '';
    if (analysis.rsi) {
      if (analysis.rsi > 70) {
        rsiExplanation = `Currently at **${rsiVal}**, which is in the **Overbought** zone. Think of this like a speedometer showing that buyers are extremely excited and running at full speed. Because it is running hot, the stock might need to pull back or take a breather soon.`;
      } else if (analysis.rsi < 30) {
        rsiExplanation = `Currently at **${rsiVal}**, which is in the **Oversold** zone. This indicates that panic selling has pushed the price down very fast, and sellers are getting exhausted. This often hints that a relief bounce could be right around the corner.`;
      } else {
        rsiExplanation = `Currently at **${rsiVal}**, which is in the **Neutral** zone. This shows a healthy balance between buyers and sellers, with no extreme panic or over-excitement in the market.`;
      }
    } else {
      rsiExplanation = 'RSI metric is currently unavailable.';
    }

    // Convert EWO to plain language
    let ewoExplanation = '';
    if (analysis.ewo) {
      if (analysis.ewo >= 0) {
        ewoExplanation = `Currently at **${ewoVal}** (Positive). This measures the speed or momentum of the trend. A positive value means the upward momentum is growing—similar to a car accelerating cleanly on a highway.`;
      } else {
        ewoExplanation = `Currently at **${ewoVal}** (Negative). This means the downward pressure is stronger. Momentum is currently favoring the sellers, indicating caution is required for buyers.`;
      }
    } else {
      ewoExplanation = 'Momentum metric is currently unavailable.';
    }

    let waveDesc = '';
    if (analysis.wave) {
      waveDesc = `Our analysis maps a **${analysis.wave.type}** cycle. In plain terms, the stock is moving in structural waves, respecting key levels where buyers usually step in to support the price.`;
    } else {
      waveDesc = `The stock is currently building the base of a new market cycle. While it is not moving in a perfect textbook pattern, its short-term price levels are forming a healthy consolidation floor.`;
    }

    let signalAnalysis = '';
    let tradingImpact = '';
    let riskLevel = 'LOW';

    switch (analysis.signal) {
      case 't1_pre':
        riskLevel = 'MEDIUM (Early Entry)';
        signalAnalysis = `We see an **Early Setup Signal**. The price has dropped to a level where it has historically found cheap buying interest and has started to bounce back. Buyers are starting to slowly accumulate shares.`;
        tradingImpact = `
* 📈 **If the stock goes UP:** If the price climbs above **${cur}${analysis.resistance}**, it shows that buyers are successfully taking control. This breakout will likely attract more traders, pushing the price toward our target of **${cur}${analysis.target}**.
* 📉 **If the stock goes DOWN:** If the price slides below **${cur}${analysis.support}**, it means this setup has failed. Traders who bought early will likely sell to cut their losses. To protect your capital, a safety exit (stop-loss) is recommended at **${cur}${analysis.stopLoss}**.
        `.trim();
        break;

      case 't2_cross':
        riskLevel = 'LOW-MODERATE';
        signalAnalysis = `We see a **Strong Buying Momentum Signal**. Our oscillator shows that the upward speed of the price is now outpacing its previous average. This is a reliable sign that a fresh uptrend is starting to lock in.`;
        tradingImpact = `
* 📈 **If the stock goes UP:** A push above the resistance line at **${cur}${analysis.resistance}** will confirm the new trend. This will trigger automated buying programs and institutional funds to enter, driving the price up to our target of **${cur}${analysis.target}**.
* 📉 **If the stock goes DOWN:** If the price fails to hold and falls below **${cur}${analysis.support}**, it shows the momentum was a false alarm. Selling will likely speed up, making it crucial to exit at the safety level of **${cur}${analysis.stopLoss}**.
        `.trim();
        break;

      case 't3_confirm':
        riskLevel = 'MODERATE (Breakout Active)';
        signalAnalysis = `We see a **Confirmed Breakout Signal**. The price has successfully broken through its recent ceiling at **${cur}${analysis.resistance}** on strong volume. This is the strongest buy signal in our system, indicating that major institutions are actively buying the stock.`;
        tradingImpact = `
* 📈 **If the stock goes UP:** Since the ceiling is broken, there is very little resistance ahead. The price is expected to rise smoothly toward our target of **${cur}${analysis.target}** as breakout buyers rush in.
* 📉 **If the stock goes DOWN:** If the price falls back below the breakout point at **${cur}${analysis.resistance}**, it becomes a "failed breakout" or trap. Buyers who entered late will panic-sell, so keeping a strict safety exit at **${cur}${analysis.support}** is essential.
        `.trim();
        break;

      case 'w5_exhaustion':
        riskLevel = 'CRITICAL (High Reversal Risk)';
        signalAnalysis = `⚠️ **Warning: Buying Exhaustion detected!** Although the price is printing new highs, our speed meters (RSI and momentum) are showing lower peaks. This is a classic warning sign that retail buyers are buying due to FOMO (Fear Of Missing Out), while big institutional investors are quietly selling and exiting.`;
        tradingImpact = `
* 📈 **If the stock goes UP:** Any further upward movement is likely to be small and short-lived. The risk of buying at these highs is extremely elevated as big money is no longer supporting the rise.
* 📉 **If the stock goes DOWN:** If the price drops below **${cur}${analysis.support}**, it will confirm that the trend has turned downward. A rush of profit-taking will follow, which can trigger a rapid drop toward **${cur}${analysis.target}**.
        `.trim();
        break;

      case 'neutral':
      default:
        riskLevel = 'LOW';
        signalAnalysis = `The stock is currently in a **Consolidation Phase**. Think of it as a spring being compressed—the price is moving sideways between a floor of **${cur}${analysis.support}** and a ceiling of **${cur}${analysis.resistance}** as it builds energy for the next big move.`;
        tradingImpact = `
* 📈 **If the stock goes UP:** A daily close above the ceiling of **${cur}${analysis.resistance}** will break the sideways channel and signal that a new upward run has begun.
* 📉 **If the stock goes DOWN:** A slip below the floor of **${cur}${analysis.support}** indicates that sellers have won the tug-of-war, and the price will likely descend to search for a new, cheaper floor.
        `.trim();
        break;
    }

    return `
### AI ANALYST CARD: ${symbol} (${profile.name})
**Asset Class Overview:** ${profile.description}

---

### 1. Simple Market Trend Assessment
* **Current Status:** ${analysis.signal === 'neutral' ? '🟡 Consolidating (Sideways)' : analysis.signal === 'w5_exhaustion' ? '🔴 Warning: Trend Exhausting' : '🔵 Bullish Uptrend starting'}
* **Wave Pattern:** ${waveDesc}
* **Plain English Summary:** ${signalAnalysis}

---

### 2. How Price Up/Down Swings Affect Trading
* **Relative Strength (RSI):** ${rsiExplanation}
* **Trend Speed (Momentum):** ${ewoExplanation}

**What to expect next:**
${tradingImpact}

---

### 3. Safety & Profit Levels (Tactical Plan)
* **Recommended Approach:** ${analysis.signal === 'neutral' ? 'Wait for a clear breakout' : analysis.signal === 'w5_exhaustion' ? 'Lock in profits / Do not buy' : 'Accumulate / Buy'}
* **Current Price:** **${cur}${price}**
* **Safety Floor (Support):** **${cur}${analysis.support}** (Price is safe above this level)
* **Target (Where to take profit):** **${cur}${analysis.target}** (Our estimated target)
* **Safety Exit (Stop-Loss):** **${cur}${analysis.stopLoss}** (Exit here if the trade goes wrong to protect your money)
* **Risk Rating:** \`${riskLevel}\`
* **Scan Confidence:** **${Math.round(analysis.confidence * 100)}%**

---
*Disclaimer: Generated by Antigravity AI Trading Analyst. This is a mathematical analysis based on price action and is not direct financial advice. Always trade responsibly.*
    `.trim();
  };

  // 3. Trigger Report Generation on Symbol/Data changes
  useEffect(() => {
    const rawReport = generateReportText();
    setReport(rawReport);

    // Stop current typing if any
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
    }

    setTypedText('');
    setIsTyping(true);

    // Typewriter effect logic: type out words
    const words = rawReport.split(' ');
    let currentIndex = 0;
    let accumulatedText = '';

    typingTimerRef.current = setInterval(() => {
      if (currentIndex < words.length) {
        accumulatedText += (currentIndex === 0 ? '' : ' ') + words[currentIndex];
        setTypedText(accumulatedText);
        currentIndex++;
      } else {
        clearInterval(typingTimerRef.current);
        setIsTyping(false);
      }
    }, 12); // Fast typing pace

    return () => {
      if (typingTimerRef.current) {
        clearInterval(typingTimerRef.current);
      }
    };
  }, [symbol, data]);

  // Clean formatting of the typed text
  const renderFormattedText = (text) => {
    return text.split('\n').map((line, idx) => {
      let trimmed = line.trim();
      
      // Horizontal Rule
      if (trimmed === '---') {
        return <hr key={idx} className="analyst-divider" />;
      }
      
      // Headings
      if (trimmed.startsWith('###')) {
        return <h3 key={idx} className="analyst-h3">{trimmed.replace('###', '').trim()}</h3>;
      }
      
      // Bullet points
      if (trimmed.startsWith('*')) {
        // Parse bold text in bullet points
        const content = trimmed.replace('*', '').trim();
        return (
          <li key={idx} className="analyst-bullet">
            {parseBoldText(content)}
          </li>
        );
      }

      // Inline risk backticks
      if (trimmed.includes('`')) {
        return (
          <p key={idx} className="analyst-p">
            {parseBoldText(trimmed)}
          </p>
        );
      }

      if (trimmed === '') {
        return <div key={idx} style={{ height: '0.5rem' }} />;
      }

      return <p key={idx} className="analyst-p">{parseBoldText(line)}</p>;
    });
  };

  // Helper to parse double asterisks **bold** and backticks `code` in text
  const parseBoldText = (text) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="text-accent">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <span key={index} className="code-badge">{part.slice(1, -1)}</span>;
      }
      return part;
    });
  };

  const handleManualReanalyze = () => {
    // Re-trigger typing effect
    setIsTyping(true);
    setTypedText('');
    
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
    }

    const words = report.split(' ');
    let currentIndex = 0;
    let accumulatedText = '';

    typingTimerRef.current = setInterval(() => {
      if (currentIndex < words.length) {
        accumulatedText += (currentIndex === 0 ? '' : ' ') + words[currentIndex];
        setTypedText(accumulatedText);
        currentIndex++;
      } else {
        clearInterval(typingTimerRef.current);
        setIsTyping(false);
      }
    }, 12);
  };

  if (!analysis) return null;

  return (
    <div className="ai-analyst-container glass-panel animate-fade-in">
      <div className="analyst-header">
        <div className="title-section">
          <div className="bot-avatar">
            <Brain className="brain-icon" />
            <Sparkles className="sparkles-decor" />
          </div>
          <div>
            <h2>AI Trading Analyst Report</h2>
            <p className="analyst-status">
              {isTyping ? (
                <span className="typing-indicator-text">
                  <span className="pulse-dot-ai"></span> Analyzing Market Dynamics...
                </span>
              ) : (
                <span className="ready-indicator-text">
                  <ShieldCheck size={14} className="ready-icon" /> Analysis Completed
                </span>
              )}
            </p>
          </div>
        </div>
        
        <div className="analyst-actions">
          <button 
            className="action-btn-ai"
            onClick={handleManualReanalyze}
            disabled={isTyping}
            title="Re-run neural scan"
          >
            <RefreshCw size={14} className={isTyping ? 'spin-icon' : ''} />
            Re-Analyze
          </button>
        </div>
      </div>

      <div className="analyst-body">
        {/* Quick parameters grid */}
        <div className="metrics-grid">
          <div className="metric-card-ai">
            <Layers size={18} className="m-icon" />
            <div className="m-info">
              <span className="m-label">Setup Signal</span>
              <span className={`m-value signal-${analysis.signal}`}>
                {analysis.signal === 'neutral' && 'Neutral'}
                {analysis.signal === 't1_pre' && 'T1 Pre-Signal'}
                {analysis.signal === 't2_cross' && 'T2 Crossover'}
                {analysis.signal === 't3_confirm' && 'T3 Breakout'}
                {analysis.signal === 'w5_exhaustion' && 'W5 Exhaustion'}
              </span>
            </div>
          </div>

          <div className="metric-card-ai">
            <Compass size={18} className="m-icon" />
            <div className="m-info">
              <span className="m-label">Stop-Loss Target</span>
              <span className="m-value">{analysis.currency}{analysis.stopLoss}</span>
            </div>
          </div>

          <div className="metric-card-ai">
            <TrendingUp size={18} className="m-icon" />
            <div className="m-info">
              <span className="m-label">Profit Target</span>
              <span className="m-value text-accent">{analysis.currency}{analysis.target}</span>
            </div>
          </div>

          <div className="metric-card-ai">
            <BarChart size={18} className="m-icon" />
            <div className="m-info">
              <span className="m-label">Setup Confidence</span>
              <span className="m-value">{Math.round(analysis.confidence * 100)}%</span>
            </div>
          </div>
        </div>

        <div className="report-content-panel">
          <div className="text-scroll-area">
            {renderFormattedText(typedText)}
            {isTyping && <span className="typewriter-cursor">|</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAnalyst;
