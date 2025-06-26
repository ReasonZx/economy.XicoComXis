// Portfolio Management System
// API Configuration - Keys loaded from external config
const API_CONFIG = {
    ALPHA_VANTAGE_KEY: '',                             // Will be loaded from config.js
    FMP_KEY: '',                                       // Will be loaded from config.js
    RATE_LIMIT_DELAY: 200                             // Milliseconds between API calls
};

// Load API keys from external config
function loadAPIKeys() {
    if (typeof window.API_KEYS !== 'undefined') {
        API_CONFIG.ALPHA_VANTAGE_KEY = window.API_KEYS.ALPHA_VANTAGE_KEY;
        API_CONFIG.FMP_KEY = window.API_KEYS.FMP_KEY;
        console.log('API keys loaded from config.js');
    } else {
        console.warn('config.js not found. Using fallback data only.');
        console.log('To enable live data, copy config.example.js to config.js and add your API keys.');
    }
}

class PortfolioManager {
    constructor() {
        // Load API keys from external config
        loadAPIKeys();
        
        this.positions = this.loadPositions();
        this.currentTab = 'all';
        this.isLoading = false;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadInitialData();
        this.updateLastUpdateTime();
    }

    setupEventListeners() {
        // Add position form
        document.getElementById('addPositionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addPosition();
        });

        // Tab buttons
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => {
                this.switchTab(button.dataset.tab);
            });
        });

        // Add resize handler for treemap
        window.addEventListener('resize', () => {
            if (this.treemapSvg) {
                // Debounce resize events
                clearTimeout(this.resizeTimeout);
                this.resizeTimeout = setTimeout(() => {
                    this.resizeTreemap();
                }, 250);
            }
        });
    }

    loadInitialData() {
        // Load sample data if no positions exist
        if (this.positions.length === 0) {
            this.positions = this.getSamplePositions();
            this.savePositions();
        }
        
        this.fetchData();
    }

    getSamplePositions() {
        return [
            {
                id: 'btc-1',
                symbol: 'BTC',
                name: 'Bitcoin',
                type: 'crypto',
                entryPrice: 30000,
                multiplier: 2.5,
                notes: 'Long-term hold'
            },
            {
                id: 'eth-1',
                symbol: 'ETH',
                name: 'Ethereum',
                type: 'crypto',
                entryPrice: 2000,
                multiplier: 5.0,
                notes: 'DeFi exposure'
            },
            {
                id: 'aapl-1',
                symbol: 'AAPL',
                name: 'Apple Inc.',
                type: 'stock',
                entryPrice: 150,
                multiplier: 3.0,
                notes: 'Tech dividend play'
            },
            {
                id: 'msft-1',
                symbol: 'MSFT',
                name: 'Microsoft Corp.',
                type: 'stock', 
                entryPrice: 300,
                multiplier: 2.0,
                notes: 'Cloud growth'
            },
            {
                id: 'bond-1',
                symbol: 'US10Y',
                name: 'US 10-Year Treasury',
                type: 'bond',
                entryPrice: 95.50,
                multiplier: 10.0,
                notes: 'Safe haven'
            },
            {
                id: 'cash-1',
                symbol: 'USD',
                name: 'US Dollar Cash',
                type: 'cash',
                entryPrice: 1.0,
                multiplier: 15.0,
                notes: 'Emergency fund'
            }
        ];
    }

    async fetchData() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading();

        try {
            // Fetch current prices for all positions
            await this.updatePositionPrices();
            
            // Update UI
            this.updateOverview();
            this.renderPositions();
            this.updateLastUpdateTime();
            
        } catch (error) {
            console.error('Error fetching data:', error);
            this.showError('Failed to fetch data. Please try again.');
            this.updateDataSourceIndicator(false);
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }

    async updatePositionPrices() {
        const cryptoSymbols = this.positions
            .filter(p => p.type === 'crypto')
            .map(p => this.getCoinGeckoId(p.symbol));
        
        const stockSymbols = this.positions
            .filter(p => p.type === 'stock')
            .map(p => p.symbol);

        let usingLiveData = true;

        // Fetch crypto prices
        if (cryptoSymbols.length > 0) {
            try {
                const cryptoPrices = await this.fetchCryptoPrices(cryptoSymbols);
                this.updateCryptoPrices(cryptoPrices);
            } catch (error) {
                console.warn('Failed to fetch crypto prices:', error);
                usingLiveData = false;
            }
        }

        // Fetch stock prices from real API
        if (stockSymbols.length > 0) {
            try {
                const stockPrices = await this.fetchRealStockPrices(stockSymbols);
                this.updateStockPrices(stockPrices);
            } catch (error) {
                console.warn('Failed to fetch stock prices, using fallback:', error);
                // Fallback to mock data if API fails
                const stockPrices = this.getMockStockPrices(stockSymbols);
                this.updateStockPrices(stockPrices);
                usingLiveData = false;
            }
        }

        // Update bond and cash prices (static for demo)
        this.updateBondPrices();
        this.updateCashPrices();

        // Update data source indicator
        this.updateDataSourceIndicator(usingLiveData);
    }

    async fetchCryptoPrices(symbols) {
        const symbolString = symbols.join(',');
        console.log('Fetching crypto prices for:', symbolString);
        
        const response = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${symbolString}&vs_currencies=usd&include_24hr_change=true`
        );
        
        if (!response.ok) {
            console.error('CoinGecko API Error:', response.status, response.statusText);
            throw new Error(`Failed to fetch crypto prices: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Crypto price data received:', data);
        return data;
    }

    async fetchRealStockPrices(symbols) {
        // Alpha Vantage API configuration
        const API_KEY = API_CONFIG.ALPHA_VANTAGE_KEY;
        const BASE_URL = 'https://www.alphavantage.co/query';
        
        console.log('Fetching real stock prices for:', symbols);
        
        // If no API key is set, throw error to use fallback
        if (!API_KEY || API_KEY === 'YOUR_ALPHA_VANTAGE_API_KEY' || API_KEY === '') {
            console.warn('Alpha Vantage API key not configured. Using fallback data.');
            throw new Error('Alpha Vantage API key not configured');
        }
        
        const results = {};
        
        // Fetch prices for each symbol (Alpha Vantage free tier allows 5 calls per minute)
        for (const symbol of symbols) {
            try {
                const response = await fetch(
                    `${BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`
                );
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                
                // Check for API limit error
                if (data['Note'] && data['Note'].includes('API call frequency')) {
                    console.warn('Alpha Vantage API rate limit hit');
                    throw new Error('API rate limit exceeded');
                }
                
                // Parse Alpha Vantage response
                const quote = data['Global Quote'];
                if (quote && quote['05. price']) {
                    const currentPrice = parseFloat(quote['05. price']);
                    const previousClose = parseFloat(quote['08. previous close']);
                    const change = currentPrice - previousClose;
                    const changePercent = (change / previousClose) * 100;
                    
                    results[symbol] = {
                        price: currentPrice,
                        change: changePercent,
                        previousClose: previousClose
                    };
                    
                    console.log(`✓ ${symbol}: $${currentPrice.toFixed(2)} (${changePercent.toFixed(2)}%)`);
                } else {
                    console.warn(`No data found for ${symbol}`);
                    results[symbol] = this.getFallbackStockPrice(symbol);
                }
                
                // Rate limiting: wait between requests
                if (symbols.indexOf(symbol) < symbols.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, API_CONFIG.RATE_LIMIT_DELAY));
                }
                
            } catch (error) {
                console.error(`Error fetching ${symbol}:`, error.message);
                results[symbol] = this.getFallbackStockPrice(symbol);
            }
        }
        
        return results;
    }

    getFallbackStockPrice(symbol) {
        // Fallback stock prices if API fails
        const fallbackPrices = {
            'AAPL': { price: 225.80, change: 1.8 },
            'MSFT': { price: 425.60, change: 0.9 },
            'GOOGL': { price: 165.40, change: -0.6 },
            'TSLA': { price: 245.30, change: 2.4 },
            'NVDA': { price: 890.25, change: 3.2 },
            'AMZN': { price: 185.75, change: 1.1 },
            'META': { price: 520.90, change: -1.2 }
        };
        
        return fallbackPrices[symbol] || {
            price: Math.random() * 200 + 50,
            change: (Math.random() - 0.5) * 10
        };
    }

    updateCryptoPrices(prices) {
        this.positions.forEach(position => {
            if (position.type === 'crypto') {
                const coinGeckoId = this.getCoinGeckoId(position.symbol);
                const priceData = prices[coinGeckoId];
                if (priceData) {
                    position.currentPrice = priceData.usd;
                    position.change24h = priceData.usd_24h_change || 0;
                }
            }
        });
    }

    updateStockPrices(prices) {
        this.positions.forEach(position => {
            if (position.type === 'stock') {
                const priceData = prices[position.symbol];
                if (priceData) {
                    position.currentPrice = priceData.price;
                    position.change24h = priceData.change;
                }
            }
        });
    }

    updateBondPrices() {
        this.positions.forEach(position => {
            if (position.type === 'bond') {
                // Mock bond price movement
                position.currentPrice = position.entryPrice + (Math.random() - 0.5) * 2;
                position.change24h = (Math.random() - 0.5) * 1;
            }
        });
    }

    updateCashPrices() {
        this.positions.forEach(position => {
            if (position.type === 'cash') {
                position.currentPrice = position.entryPrice; // Cash is stable
                position.change24h = 0;
            }
        });
    }

    updateOverview() {
        let totalValue = 0;
        let totalCost = 0;
        let cryptoValue = 0;
        let stockValue = 0;
        let bondsValue = 0;
        let cashValue = 0;

        let bestPerformer = null;
        let bestPerformance = -Infinity;

        // Prepare data for treemap
        const categoryData = {
            crypto: { name: 'Cryptocurrency', value: 0, count: 0, positions: [], color: '#f59e0b', icon: '₿' },
            stock: { name: 'Stocks', value: 0, count: 0, positions: [], color: '#3b82f6', icon: '📈' },
            bond: { name: 'Bonds', value: 0, count: 0, positions: [], color: '#10b981', icon: '🏛️' },
            cash: { name: 'Cash', value: 0, count: 0, positions: [], color: '#6b7280', icon: '💵' }
        };

        this.positions.forEach(position => {
            const currentValue = (position.currentPrice || position.entryPrice) * position.multiplier;
            const costBasis = position.entryPrice * position.multiplier;
            const pnl = currentValue - costBasis;
            const pnlPercent = (pnl / costBasis) * 100;

            totalValue += currentValue;
            totalCost += costBasis;

            // Track best performer
            if (pnlPercent > bestPerformance && position.type !== 'cash') {
                bestPerformance = pnlPercent;
                bestPerformer = position;
            }

            // Add to category data
            if (categoryData[position.type]) {
                categoryData[position.type].value += currentValue;
                categoryData[position.type].count += 1;
                categoryData[position.type].positions.push({
                    ...position,
                    currentValue,
                    pnl,
                    pnlPercent
                });
            }
        });

        const totalPnl = totalValue - totalCost;
        const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

        // Update summary stats
        this.updateSummaryStats(totalValue, totalPnl, totalPnlPercent, bestPerformer, bestPerformance);

        // Update treemap
        this.updateTreemap(categoryData, totalValue);
    }

    updateSummaryStats(totalValue, totalPnl, totalPnlPercent, bestPerformer, bestPerformance) {
        // Update total value
        const totalValueEl = document.getElementById('totalValue');
        const totalChangeEl = document.getElementById('totalChange');
        
        if (totalValueEl) {
            totalValueEl.textContent = `${totalValue.toFixed(2)}€`;
        }
        
        if (totalChangeEl) {
            const sign = totalPnl >= 0 ? '+' : '';
            totalChangeEl.textContent = `${sign}${totalPnl.toFixed(2)}€ (${totalPnlPercent.toFixed(2)}%)`;
            totalChangeEl.className = `summary-change ${totalPnl >= 0 ? 'change-positive' : 'change-negative'}`;
        }

        // Update best performer
        const bestPerformerEl = document.getElementById('bestPerformer');
        const bestPerformerChangeEl = document.getElementById('bestPerformerChange');
        
        if (bestPerformer && bestPerformerEl && bestPerformerChangeEl) {
            bestPerformerEl.textContent = `${bestPerformer.symbol}`;
            bestPerformerChangeEl.textContent = `+${bestPerformance.toFixed(2)}%`;
            bestPerformerChangeEl.className = 'summary-change change-positive';
        }
    }

    updateTreemap(categoryData, totalValue) {
        // Initialize treemap if not already done
        if (!this.treemapSvg) {
            this.initTreemap();
        }

        // Prepare data for D3 treemap
        const treemapData = {
            name: 'Portfolio',
            children: Object.keys(categoryData).map(key => ({
                name: categoryData[key].name,
                value: categoryData[key].value,
                count: categoryData[key].count,
                color: categoryData[key].color,
                icon: categoryData[key].icon,
                type: key,
                positions: categoryData[key].positions,
                percentage: totalValue > 0 ? (categoryData[key].value / totalValue * 100) : 0
            })).filter(d => d.value > 0) // Only show categories with value
        };

        this.renderTreemap(treemapData);
    }

    initTreemap() {
        const container = document.getElementById('treemap');
        container.innerHTML = ''; // Clear any existing content

        // Set up dimensions
        this.treemapWidth = container.offsetWidth - 32; // Account for padding
        this.treemapHeight = 500;
        
        // Create SVG
        this.treemapSvg = d3.select('#treemap')
            .append('svg')
            .attr('width', this.treemapWidth)
            .attr('height', this.treemapHeight);

        // Create tooltip
        this.tooltip = d3.select('body')
            .append('div')
            .attr('class', 'treemap-tooltip');

        // Set up treemap layout
        this.treemapLayout = d3.treemap()
            .size([this.treemapWidth, this.treemapHeight])
            .padding(2)
            .round(true);

        // Track current view state
        this.currentView = 'categories';
        this.currentCategory = null;

        // Add event listeners for controls
        document.getElementById('treemapBack').addEventListener('click', () => {
            this.showCategoryView();
        });

        document.getElementById('treemapReset').addEventListener('click', () => {
            this.showCategoryView();
        });
    }

    renderTreemap(data) {
        if (!this.treemapSvg) return;

        // Create hierarchy and calculate layout
        const root = d3.hierarchy(data)
            .sum(d => d.value)
            .sort((a, b) => b.value - a.value);

        this.treemapLayout(root);

        // Clear previous content
        this.treemapSvg.selectAll('*').remove();

        // Create groups for each node
        const nodes = this.treemapSvg.selectAll('.treemap-node')
            .data(root.leaves())
            .enter()
            .append('g')
            .attr('class', 'treemap-node')
            .attr('transform', d => `translate(${d.x0},${d.y0})`);

        // Add rectangles
        nodes.append('rect')
            .attr('width', d => d.x1 - d.x0)
            .attr('height', d => d.y1 - d.y0)
            .attr('fill', d => d.data.color)
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1)
            .on('click', (event, d) => {
                if (this.currentView === 'categories' && d.data.positions && d.data.positions.length > 0) {
                    this.showPositionsView(d.data);
                }
            })
            .on('mouseover', (event, d) => {
                this.showTooltip(event, d);
            })
            .on('mouseout', () => {
                this.hideTooltip();
            });

        // Add text labels
        nodes.each(function(d) {
            const node = d3.select(this);
            const width = d.x1 - d.x0;
            const height = d.y1 - d.y0;
            
            // Only add text if rectangle is large enough
            if (width > 60 && height > 40) {
                const textGroup = node.append('g')
                    .attr('class', 'treemap-text-group');

                // Add icon
                textGroup.append('text')
                    .attr('class', 'treemap-text')
                    .attr('x', width / 2)
                    .attr('y', height / 2 - 10)
                    .attr('text-anchor', 'middle')
                    .attr('font-size', '20px')
                    .text(d.data.icon);

                // Add name
                textGroup.append('text')
                    .attr('class', 'treemap-text')
                    .attr('x', width / 2)
                    .attr('y', height / 2 + 8)
                    .attr('text-anchor', 'middle')
                    .attr('font-size', width > 120 ? '14px' : '12px')
                    .text(d.data.name);

                // Add value
                textGroup.append('text')
                    .attr('class', 'treemap-value')
                    .attr('x', width / 2)
                    .attr('y', height / 2 + 24)
                    .attr('text-anchor', 'middle')
                    .text(`${d.data.value.toFixed(0)}€ (${d.data.percentage.toFixed(1)}%)`);
            }
        });
    }

    showPositionsView(categoryData) {
        this.currentView = 'positions';
        this.currentCategory = categoryData;

        // Update title and show back button
        document.getElementById('treemapTitle').textContent = `${categoryData.name} Holdings`;
        document.getElementById('treemapBack').style.display = 'flex';

        // Prepare positions data for treemap
        const positionsData = {
            name: categoryData.name,
            children: categoryData.positions.map(position => ({
                name: position.symbol,
                value: position.currentValue,
                fullName: position.name,
                pnl: position.pnl,
                pnlPercent: position.pnlPercent,
                currentPrice: position.currentPrice || position.entryPrice,
                entryPrice: position.entryPrice,
                multiplier: position.multiplier,
                color: this.getPerformanceColor(position.pnlPercent)
            }))
        };

        this.renderTreemap(positionsData);
    }

    showCategoryView() {
        this.currentView = 'categories';
        this.currentCategory = null;

        // Update title and hide back button
        document.getElementById('treemapTitle').textContent = 'Portfolio Allocation';
        document.getElementById('treemapBack').style.display = 'none';

        // Re-render with category data
        this.updateOverview();
    }

    getPerformanceColor(pnlPercent) {
        if (pnlPercent > 5) return '#22c55e';      // Strong positive (green)
        if (pnlPercent > 0) return '#84cc16';      // Positive (light green)
        if (pnlPercent > -5) return '#f59e0b';     // Slight negative (yellow)
        return '#ef4444';                          // Negative (red)
    }

    showTooltip(event, d) {
        const tooltip = this.tooltip;
        
        let content = '';
        if (this.currentView === 'categories') {
            content = `
                <strong>${d.data.name}</strong><br>
                Value: ${d.data.value.toFixed(2)}€<br>
                Percentage: ${d.data.percentage.toFixed(1)}%<br>
                Positions: ${d.data.count}
            `;
        } else {
            const sign = d.data.pnl >= 0 ? '+' : '';
            content = `
                <strong>${d.data.name}</strong><br>
                ${d.data.fullName}<br>
                Current: $${d.data.currentPrice.toFixed(2)}<br>
                Value: ${d.data.value.toFixed(2)}€<br>
                P&L: ${sign}${d.data.pnl.toFixed(2)}€ (${sign}${d.data.pnlPercent.toFixed(2)}%)
            `;
        }

        tooltip.html(content)
            .style('opacity', 1)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
    }

    hideTooltip() {
        this.tooltip.style('opacity', 0);
    }

    renderPositions() {
        const container = document.getElementById('positionsContainer');
        const filteredPositions = this.currentTab === 'all' 
            ? this.positions 
            : this.positions.filter(p => {
                if (this.currentTab === 'stocks') return p.type === 'stock';
                if (this.currentTab === 'crypto') return p.type === 'crypto';
                if (this.currentTab === 'bonds') return p.type === 'bond';
                if (this.currentTab === 'cash') return p.type === 'cash';
                return true;
            });

        container.innerHTML = filteredPositions.map(position => 
            this.createPositionCard(position)
        ).join('');

        // Add event listeners for position actions
        this.attachPositionEventListeners();
    }

    createPositionCard(position) {
        const currentPrice = position.currentPrice || position.entryPrice;
        const currentValue = currentPrice * position.multiplier;
        const costBasis = position.entryPrice * position.multiplier;
        const pnl = currentValue - costBasis;
        const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
        const pnlClass = pnl >= 0 ? 'change-positive' : 'change-negative';
        const pnlSign = pnl >= 0 ? '+' : '';

        const typeLabels = {
            'crypto': 'Crypto',
            'stock': 'Stock',
            'bond': 'Bond',
            'cash': 'Cash'
        };

        return `
            <div class="position-card" data-id="${position.id}">
                <div class="position-header">
                    <div class="position-info">
                        <h3>${position.symbol}</h3>
                        <span class="position-type">${typeLabels[position.type]}</span>
                    </div>
                    <div class="position-actions">
                        <button class="action-btn edit-btn" title="Edit Position">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete-btn" title="Delete Position">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                <div class="position-values">
                    <div class="value-item">
                        <div class="value-label">Current Price</div>
                        <div class="value-amount">$${currentPrice.toFixed(2)}</div>
                    </div>
                    <div class="value-item">
                        <div class="value-label">Position Value</div>
                        <div class="value-amount">${currentValue.toFixed(2)}€</div>
                    </div>
                    <div class="value-item">
                        <div class="value-label">Entry Price</div>
                        <div class="value-amount">$${position.entryPrice.toFixed(2)}</div>
                    </div>
                    <div class="value-item">
                        <div class="value-label">Multiplier</div>
                        <div class="value-amount">${position.multiplier}x</div>
                    </div>
                </div>
                
                <div class="position-pnl">
                    <span class="pnl-absolute ${pnlClass}">${pnlSign}${pnl.toFixed(2)}€</span>
                    <span class="pnl-percentage ${pnlClass}">${pnlSign}${pnlPercent.toFixed(2)}%</span>
                </div>
                
                ${position.notes ? `<div class="position-notes">${position.notes}</div>` : ''}
            </div>
        `;
    }

    attachPositionEventListeners() {
        // Delete buttons
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const positionId = btn.closest('.position-card').dataset.id;
                this.deletePosition(positionId);
            });
        });

        // Edit buttons (placeholder for future implementation)
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const positionId = btn.closest('.position-card').dataset.id;
                this.editPosition(positionId);
            });
        });
    }

    addPosition() {
        const form = document.getElementById('addPositionForm');
        const formData = new FormData(form);
        
        const position = {
            id: `${formData.get('symbol')}-${Date.now()}`,
            symbol: formData.get('symbol').toUpperCase(),
            name: formData.get('symbol').toUpperCase(), // Could be enhanced with name lookup
            type: formData.get('assetType'),
            entryPrice: parseFloat(formData.get('entryPrice')),
            multiplier: parseFloat(formData.get('multiplier')),
            notes: formData.get('notes') || ''
        };

        this.positions.push(position);
        this.savePositions();
        this.fetchData();
        
        form.reset();
        this.showSuccess('Position added successfully!');
    }

    deletePosition(positionId) {
        if (confirm('Are you sure you want to delete this position?')) {
            this.positions = this.positions.filter(p => p.id !== positionId);
            this.savePositions();
            this.fetchData();
            this.showSuccess('Position deleted successfully!');
        }
    }

    editPosition(positionId) {
        // Placeholder for edit functionality
        alert('Edit functionality coming soon!');
    }

    switchTab(tab) {
        this.currentTab = tab;
        
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        
        this.renderPositions();
    }

    updateLastUpdateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        document.getElementById('lastUpdate').textContent = timeString;
    }

    showLoading() {
        document.getElementById('loadingOverlay').classList.add('active');
    }

    hideLoading() {
        document.getElementById('loadingOverlay').classList.remove('active');
    }

    showSuccess(message) {
        // Simple alert for now - could be enhanced with toast notifications
        alert(message);
    }

    showError(message) {
        alert(message);
    }

    loadPositions() {
        const saved = localStorage.getItem('portfolio-positions');
        return saved ? JSON.parse(saved) : [];
    }

    savePositions() {
        localStorage.setItem('portfolio-positions', JSON.stringify(this.positions));
    }

    getCoinGeckoId(symbol) {
        // Map common crypto symbols to CoinGecko IDs
        const symbolMap = {
            'BTC': 'bitcoin',
            'ETH': 'ethereum',
            'ADA': 'cardano',
            'DOT': 'polkadot',
            'SOL': 'solana',
            'MATIC': 'polygon',
            'AVAX': 'avalanche-2',
            'LINK': 'chainlink',
            'UNI': 'uniswap',
            'ATOM': 'cosmos'
        };
        
        return symbolMap[symbol.toUpperCase()] || symbol.toLowerCase();
    }

    updateDataSourceIndicator(isLiveData = true, source = 'live') {
        const indicator = document.getElementById('dataSource');
        if (!indicator) return;
        
        // Remove existing classes
        indicator.classList.remove('live', 'fallback', 'error');
        
        if (isLiveData) {
            indicator.classList.add('live');
            indicator.innerHTML = '<i class="fas fa-wifi"></i><span>Live Data</span>';
        } else {
            indicator.classList.add('fallback');
            indicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Fallback Data</span>';
        }
    }

    resizeTreemap() {
        if (!this.treemapSvg) return;

        const container = document.getElementById('treemap');
        const newWidth = container.offsetWidth - 32;
        const newHeight = 500;

        if (newWidth !== this.treemapWidth || newHeight !== this.treemapHeight) {
            this.treemapWidth = newWidth;
            this.treemapHeight = newHeight;

            // Update SVG dimensions
            this.treemapSvg
                .attr('width', this.treemapWidth)
                .attr('height', this.treemapHeight);

            // Update treemap layout
            this.treemapLayout.size([this.treemapWidth, this.treemapHeight]);

            // Re-render current view
            if (this.currentView === 'categories') {
                this.updateOverview();
            } else {
                this.showPositionsView(this.currentCategory);
            }
        }
    }
}

// Initialize the portfolio manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.portfolioManager = new PortfolioManager();
    loadAPIKeys(); // Load API keys from config
});

// Smooth scrolling for navigation links (reuse from main script)
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Navbar background change on scroll (reuse from main script)
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.style.background = 'rgba(255, 255, 255, 0.98)';
        navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
    } else {
        navbar.style.background = 'rgba(255, 255, 255, 0.95)';
        navbar.style.boxShadow = 'none';
    }
});

// Export for potential future use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PortfolioManager;
}
