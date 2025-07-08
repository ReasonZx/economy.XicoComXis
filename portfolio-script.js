// Portfolio Management System
// API Configuration - Backend service URL
const API_CONFIG = {
    BACKEND_URL: 'https://economy-xicocomxis-625962358893.herokuapp.com', // Replace with your Heroku app URL
    FALLBACK_TIMEOUT: 5000,                           // 5 seconds timeout for backend
    RATE_LIMIT_DELAY: 200                             // Milliseconds between API calls (fallback only)
};

// User Configuration - Loaded from user-config.js
const USER_CONFIG = {
    USERNAME: 'demo_user',        // Default - will be overridden by user-config.js
    DISPLAY_NAME: 'Demo User'     // Default - will be overridden by user-config.js
};

// European number formatting utility
function formatNumber(number, decimals = 2) {
    if (typeof number !== 'number' || isNaN(number)) {
        return '0,00';
    }
    
    // Round to specified decimal places
    const rounded = Math.round(number * Math.pow(10, decimals)) / Math.pow(10, decimals);
    
    // Convert to string with specified decimals
    const fixed = rounded.toFixed(decimals);
    
    // Split into integer and decimal parts
    const [integerPart, decimalPart] = fixed.split('.');
    
    // Add dots for thousands separator
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    // Return with comma as decimal separator
    return decimalPart ? `${formattedInteger},${decimalPart}` : formattedInteger;
}

// Format currency with euro symbol
function formatCurrency(number, decimals = 2) {
    return `${formatNumber(number, decimals)}€`;
}

// Format percentage
function formatPercentage(number, decimals = 2) {
    return `${formatNumber(number, decimals)}%`;
}

// Load backend URL from external config if available
function loadAPIConfig() {
    if (typeof window.API_CONFIG !== 'undefined') {
        API_CONFIG.BACKEND_URL = window.API_CONFIG.BACKEND_URL || API_CONFIG.BACKEND_URL;
        console.log('Backend URL loaded from config.js:', API_CONFIG.BACKEND_URL);
    } else {
        console.log('Using default backend URL:', API_CONFIG.BACKEND_URL);
    }
}

// Load user configuration from external file if available
function loadUserConfig() {
    if (typeof window.USER_CONFIG !== 'undefined') {
        USER_CONFIG.USERNAME = window.USER_CONFIG.USERNAME || USER_CONFIG.USERNAME;
        USER_CONFIG.DISPLAY_NAME = window.USER_CONFIG.DISPLAY_NAME || USER_CONFIG.DISPLAY_NAME;
        console.log('User config loaded:', USER_CONFIG.USERNAME);
    } else {
        console.log('Using default user config:', USER_CONFIG.USERNAME);
    }
}

// Simple Password Protection for Modifications
class PortfolioAuth {
    constructor() {
        this.authToken = null;
        this.tokenExpiry = null;
        this.isUnlocked = false;
        this.startUIUpdater();
    }

    isTokenValid() {
        return this.authToken && this.tokenExpiry && Date.now() < this.tokenExpiry;
    }

    async checkAccess() {
        if (this.isTokenValid()) {
            return true;
        }
        
        return await this.requestPassword();
    }

    async requestPassword() {
        return new Promise((resolve) => {
            const modal = this.createPasswordModal(resolve);
            document.body.appendChild(modal);
        });
    }
    
    createPasswordModal(callback) {
        const modal = document.createElement('div');
        modal.className = 'password-modal';
        modal.innerHTML = `
            <div class="password-modal-content">
                <h3><i class="fas fa-lock"></i> Authentication Required</h3>
                <p>Enter your password to modify portfolio positions:</p>
                <div class="password-input-group">
                    <input type="password" id="portfolioPassword" placeholder="Password" autocomplete="off">
                    <button type="button" id="passwordShow" class="password-toggle">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
                <div class="password-modal-actions">
                    <button type="button" id="passwordCancel" class="btn btn-secondary">Cancel</button>
                    <button type="button" id="passwordSubmit" class="btn btn-primary">Confirm</button>
                </div>
                <div id="passwordError" class="password-error" style="display: none;"></div>
            </div>
        `;
        
        const passwordInput = modal.querySelector('#portfolioPassword');
        const submitBtn = modal.querySelector('#passwordSubmit');
        const cancelBtn = modal.querySelector('#passwordCancel');
        const showBtn = modal.querySelector('#passwordShow');
        const errorDiv = modal.querySelector('#passwordError');
        
        const attemptAuth = async () => {
            const password = passwordInput.value;
            if (!password) {
                errorDiv.textContent = 'Please enter your password';
                errorDiv.style.display = 'block';
                return;
            }

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';

            try {
                const response = await fetch(`${API_CONFIG.BACKEND_URL}/api/user/${USER_CONFIG.USERNAME}/verify-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });

                const result = await response.json();

                if (response.ok) {
                    this.authToken = result.token;
                    this.tokenExpiry = Date.now() + 280000; // 4.5 minutes (token is valid for 5)
                    this.isUnlocked = true;
                    modal.remove();
                    this.updateUIState();
                    callback(true);
                } else {
                    errorDiv.textContent = result.error || 'Invalid password';
                    errorDiv.style.display = 'block';
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Confirm';
                }
            } catch (error) {
                console.error('Authentication error:', error);
                errorDiv.textContent = 'Authentication service unavailable';
                errorDiv.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Confirm';
            }
        };

        // Event listeners
        submitBtn.addEventListener('click', attemptAuth);
        cancelBtn.addEventListener('click', () => {
            modal.remove();
            callback(false);
        });

        showBtn.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            showBtn.innerHTML = isPassword ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
        });

        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                attemptAuth();
            }
        });

        // Focus password input
        setTimeout(() => passwordInput.focus(), 100);
        
        return modal;
    }

    lock() {
        this.authToken = null;
        this.tokenExpiry = null;
        this.isUnlocked = false;
        this.updateUIState();
    }

    updateUIState() {
        const lockIndicator = document.getElementById('lockIndicator');
        if (lockIndicator) {
            const timeLeft = this.tokenExpiry ? Math.max(0, Math.ceil((this.tokenExpiry - Date.now()) / 1000)) : 0;
            
            if (this.isTokenValid()) {
                lockIndicator.innerHTML = `<i class="fas fa-unlock"></i><span>Unlocked (${Math.ceil(timeLeft / 60)}m)</span>`;
                lockIndicator.className = 'lock-indicator clickable unlocked';
            } else {
                lockIndicator.innerHTML = '<i class="fas fa-lock"></i><span>Locked</span>';
                lockIndicator.className = 'lock-indicator clickable locked';
            }
        }
    }

    isProtectionEnabled() {
        return true; // Always enabled for multi-user system
    }

    // Auto-update UI state every minute
    startUIUpdater() {
        setInterval(() => {
            if (this.isUnlocked) {
                this.updateUIState();
                if (!this.isTokenValid()) {
                    this.isUnlocked = false;
                }
            }
        }, 60000); // Update every minute
    }
}

class PortfolioManager {
    constructor() {
        // Load configurations
        loadAPIConfig();
        loadUserConfig();
        
        this.portfolios = [];
        this.currentTab = 'all';
        this.isLoading = false;
        
        this.auth = new PortfolioAuth(); // Initialize portfolio protection
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadInitialData();
        this.updateLastUpdateTime();
        
        // Initialize UI state based on auth
        setTimeout(() => {
            this.auth.updateUIState();
        }, 100);
    }

    setupEventListeners() {
        // Add position form
        document.getElementById('addPositionForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const hasAccess = await this.auth.checkAccess();
            if (hasAccess) {
                this.addPosition();
            }
        });

        // Lock indicator click
        document.getElementById('lockIndicator').addEventListener('click', async () => {
            if (this.auth.isProtectionEnabled()) {
                if (!this.auth.isUnlocked) {
                    const hasAccess = await this.auth.checkAccess();
                    // UI will be updated automatically by the auth system
                } else {
                    // If already unlocked, clicking locks it again
                    this.auth.lock();
                }
            }
        });

        // Auto-calculate shares when entry price or investment amount changes
        const entryPriceInput = document.getElementById('entryPrice');
        const investmentAmountInput = document.getElementById('investmentAmount');
        const calculatedSharesInput = document.getElementById('calculatedShares');
        const assetTypeInput = document.getElementById('assetType');
        const symbolInput = document.getElementById('symbol');

        const calculateShares = () => {
            const entryPrice = parseFloat(entryPriceInput.value);
            const investmentAmount = parseFloat(investmentAmountInput.value);
            
            if (entryPrice > 0 && investmentAmount > 0) {
                const shares = investmentAmount / entryPrice;
                calculatedSharesInput.value = shares.toFixed(6);
            } else {
                calculatedSharesInput.value = '';
            }
        };

        // Handle asset type changes for Cash Equivalents and P2P/Private credit
        const handleAssetTypeChange = () => {
            const selectedType = assetTypeInput.value;
            const symbolHelp = document.getElementById('symbolHelp');
            const entryPriceHelp = document.getElementById('entryPriceHelp');
            
            if (selectedType === 'bond' || selectedType === 'p2p') { // Cash Equivalents or P2P/Private credit
                // Disable and auto-fill symbol and entry price
                symbolInput.disabled = true;
                entryPriceInput.disabled = true;
                
                if (selectedType === 'bond') {
                    symbolInput.value = 'CASH-EQUIV';
                    entryPriceInput.value = '1.00';
                } else if (selectedType === 'p2p') {
                    symbolInput.value = 'P2P-PRIV-CREDIT';
                    entryPriceInput.value = '1.00';
                }
                
                // Add visual indication that fields are auto-filled
                symbolInput.style.backgroundColor = '#f5f5f5';
                entryPriceInput.style.backgroundColor = '#f5f5f5';
                symbolInput.style.color = '#666';
                entryPriceInput.style.color = '#666';
                
                // Show help text
                if (symbolHelp) symbolHelp.style.display = 'block';
                if (entryPriceHelp) entryPriceHelp.style.display = 'block';
                
                // Recalculate shares with the fixed entry price
                calculateShares();
            } else {
                // Enable fields for other asset types
                symbolInput.disabled = false;
                entryPriceInput.disabled = false;
                symbolInput.value = '';
                entryPriceInput.value = '';
                
                // Remove visual indication
                symbolInput.style.backgroundColor = '';
                entryPriceInput.style.backgroundColor = '';
                symbolInput.style.color = '';
                entryPriceInput.style.color = '';
                
                // Hide help text
                if (symbolHelp) symbolHelp.style.display = 'none';
                if (entryPriceHelp) entryPriceHelp.style.display = 'none';
                
                // Clear calculated shares
                calculatedSharesInput.value = '';
            }
        };

        entryPriceInput.addEventListener('input', calculateShares);
        investmentAmountInput.addEventListener('input', calculateShares);
        assetTypeInput.addEventListener('change', handleAssetTypeChange);

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

    async loadInitialData() {
        try {
            await this.loadUserPortfolios();
            this.fetchData();
        } catch (error) {
            console.error('Failed to load initial data:', error);
            // Fallback to empty state
            this.portfolios = [];
            this.updateDisplay();
        }
    }

    async loadUserPortfolios() {
        try {
            console.log(`Loading portfolios for user: ${USER_CONFIG.USERNAME}`);
            
            const response = await fetch(`${API_CONFIG.BACKEND_URL}/api/user/${USER_CONFIG.USERNAME}/portfolios`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    console.warn('User not found - please create user account first');
                    throw new Error('User not found. Please create your user account first.');
                }
                throw new Error(`Failed to load portfolios: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('📊 Backend response:', data); // Debug log
            
            this.portfolios = data.portfolios || [];
            console.log('📊 Loaded portfolios:', this.portfolios); // Debug log
            console.log('📊 Total positions across all portfolios:', this.getTotalPositions()); // Debug log
            
            // Update user display name if provided
            if (data.user?.displayName) {
                document.title = `Financial Portfolio - ${data.user.displayName}`;
            }
            
            console.log(`Loaded ${this.portfolios.length} portfolios with ${this.getTotalPositions()} total positions`);
            
            return this.portfolios;
            
        } catch (error) {
            console.error('Error loading user portfolios:', error);
            throw error;
        }
    }

    getTotalPositions() {
        return this.portfolios.reduce((total, portfolio) => total + (portfolio.positions?.length || 0), 0);
    }

    // Get all positions from all portfolios for compatibility with existing UI
    get positions() {
        const allPositions = this.portfolios.flatMap(portfolio => 
            (portfolio.positions || []).map(position => ({
                ...position,
                portfolioId: portfolio.id,
                portfolioName: portfolio.name
            }))
        );
        console.log('📊 Flattened positions array:', allPositions); // Debug log
        return allPositions;
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
                symbol: 'USD-EQUIV',
                name: 'USD Cash Equivalent',
                type: 'bond',
                entryPrice: 100.00,
                multiplier: 8.0,
                notes: 'High-yield savings'
            },
            {
                id: 'p2p-1',
                symbol: 'P2P-EUR',
                name: 'P2P/Private credit Portfolio',
                type: 'p2p',
                entryPrice: 100.00,
                multiplier: 5.0,
                notes: 'Diversified P2P loans'
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
        let usingLiveData = true;
        let dataSource = 'backend';

        try {
            // Try to fetch from Heroku backend first
            console.log('🔄 Fetching prices from backend service...');
            const backendData = await this.fetchFromBackend();
            
            if (backendData && this.isBackendDataValid(backendData)) {
                console.log('✅ Using backend price data');
                this.applyBackendPrices(backendData);
                this.updateDataSourceIndicator(true, 'backend');
                return;
            } else {
                console.warn('⚠️ Backend data invalid or stale, falling back to direct API calls');
                usingLiveData = false;
            }
        } catch (error) {
            console.warn('❌ Backend fetch failed, falling back to direct API calls:', error.message);
            usingLiveData = false;
        }

        // Fallback to cached file (if running local price fetcher)
        try {
            console.log('🔄 Trying cached prices fallback...');
            const cachedPrices = await this.loadCachedPrices();
            
            if (cachedPrices && this.isCacheValid(cachedPrices)) {
                console.log('📦 Using cached price data');
                this.applyCachedPrices(cachedPrices);
                this.updateDataSourceIndicator(true, 'cached');
                return;
            }
        } catch (error) {
            console.warn('❌ Cached prices fallback failed:', error);
        }

        // Final fallback to direct API calls (if backend and cache both fail)
        console.log('🔄 Using direct API fallback...');
        await this.fetchDirectAPIs();
        this.updateDataSourceIndicator(usingLiveData, 'fallback');
    }

    async fetchDirectAPIs() {
        const cryptoSymbols = this.positions
            .filter(p => p.type === 'crypto')
            .map(p => p.symbol);
        
        const stockSymbols = this.positions
            .filter(p => p.type === 'stock')
            .map(p => p.symbol);

        // Fetch crypto prices
        if (cryptoSymbols.length > 0) {
            try {
                const cryptoPrices = await this.fetchCryptoPrices(cryptoSymbols.map(s => this.getCoinGeckoId(s)));
                this.updateCryptoPrices(cryptoPrices);
            } catch (error) {
                console.warn('Failed to fetch crypto prices:', error);
            }
        }

        // Fetch stock prices with multiple fallbacks
        if (stockSymbols.length > 0) {
            try {
                // Try FMP first, then Alpha Vantage, then mock data
                let stockPrices;
                try {
                    stockPrices = await this.fetchFMPStockPrices(stockSymbols);
                } catch (fmpError) {
                    console.warn('FMP failed, trying Alpha Vantage:', fmpError.message);
                    try {
                        stockPrices = await this.fetchRealStockPrices(stockSymbols);
                    } catch (alphaError) {
                        console.warn('Alpha Vantage failed, using mock data:', alphaError.message);
                        stockPrices = this.getMockStockPrices(stockSymbols);
                    }
                }
                this.updateStockPrices(stockPrices);
            } catch (error) {
                console.warn('All stock price sources failed:', error);
            }
        }

        // Update bond and cash prices (static for demo)
        this.updateBondPrices();
        this.updateCashPrices();
        this.updateP2PPrices();
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
        
        // Check if we should skip API calls due to known rate limiting
        const rateLimit = localStorage.getItem('alphaVantageRateLimit');
        const inRateLimit = rateLimit && Date.now() - parseInt(rateLimit) < 24 * 60 * 60 * 1000;
        if (inRateLimit) {
            console.warn('Alpha Vantage API rate limited (24h cooldown). Using fallback data.');
            throw new Error('API rate limited - using fallback data');
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
                
                // Debug: Log the actual API response
                console.log(`Alpha Vantage API response for ${symbol}:`, data);
                
                // Check for API limit error or informational messages
                if (data['Note'] && data['Note'].includes('API call frequency')) {
                    console.warn('Alpha Vantage API rate limit hit');
                    throw new Error('API rate limit exceeded');
                }
                
                // Check for informational messages (like rate limit info)
                if (data['Information']) {
                    console.warn(`Alpha Vantage API info for ${symbol}:`, data['Information']);
                    if (data['Information'].includes('API rate limit') || 
                        data['Information'].includes('25 requests') ||
                        data['Information'].includes('standard API rate limit')) {
                        console.warn('Daily API rate limit reached. Storing rate limit timestamp.');
                        // Store rate limit timestamp to avoid further API calls for 24h
                        localStorage.setItem('alphaVantageRateLimit', Date.now().toString());
                        throw new Error('API rate limit reached');
                    }
                }
                
                // Check for API error messages
                if (data['Error Message']) {
                    console.error(`Alpha Vantage API error for ${symbol}:`, data['Error Message']);
                    throw new Error(`API error: ${data['Error Message']}`);
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
                    
                    console.log(`✓ ${symbol}: $${formatNumber(currentPrice)} (${formatPercentage(changePercent)})`);
                } else {
                    console.warn(`No 'Global Quote' data found for ${symbol}. Available keys:`, Object.keys(data));
                    console.warn(`Response might be rate-limited or invalid. Using fallback data.`);
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

    async fetchFMPStockPrices(symbols) {
        const API_KEY = API_CONFIG.FMP_KEY;
        const BASE_URL = 'https://financialmodelingprep.com/api/v3/quote';
        
        console.log('Fetching stock prices from Financial Modeling Prep for:', symbols);
        
        if (!API_KEY || API_KEY === 'YOUR_FMP_API_KEY' || API_KEY === '') {
            console.warn('FMP API key not configured. Using fallback data.');
            throw new Error('FMP API key not configured');
        }
        
        const results = {};
        
        // FMP allows batch requests, but let's do individual calls for better error handling
        for (const symbol of symbols) {
            try {
                const response = await fetch(`${BASE_URL}/${symbol}?apikey=${API_KEY}`);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data && data.length > 0) {
                    const quote = data[0];
                    results[symbol] = {
                        price: quote.price,
                        change: quote.changesPercentage,
                        previousClose: quote.previousClose,
                        marketCap: quote.marketCap,
                        volume: quote.volume
                    };
                    
                    console.log(`✓ FMP ${symbol}: $${formatNumber(quote.price)} (${formatPercentage(quote.changesPercentage)})`);
                } else {
                    console.warn(`No FMP data found for ${symbol}`);
                    results[symbol] = this.getFallbackStockPrice(symbol);
                }
                
                // Rate limiting: wait between requests
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`Error fetching FMP ${symbol}:`, error.message);
                results[symbol] = this.getFallbackStockPrice(symbol);
            }
        }
        
        return results;
    }

    async loadCachedPrices() {
        try {
            const response = await fetch('./cached-prices.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.warn('Could not load cached prices:', error.message);
            return null;
        }
    }

    isCacheValid(cachedPrices) {
        if (!cachedPrices || !cachedPrices.lastUpdated) {
            return false;
        }
        
        const lastUpdated = new Date(cachedPrices.lastUpdated);
        const now = new Date();
        const ageInHours = (now - lastUpdated) / (1000 * 60 * 60);
        
        // Cache is valid for 2 hours (gives 1 hour buffer)
        return ageInHours < 2;
    }

    applyCachedPrices(cachedPrices) {
        // Apply cached stock prices
        this.positions.forEach(position => {
            if (position.type === 'stock' && cachedPrices.stocks[position.symbol]) {
                const priceData = cachedPrices.stocks[position.symbol];
                if (priceData.price !== null && priceData.price !== undefined) {
                    position.currentPrice = priceData.price;
                    position.change24h = priceData.change;
                    position.unavailable = false;
                } else {
                    position.currentPrice = null;
                    position.change24h = null;
                    position.unavailable = true;
                }
            } else if (position.type === 'crypto' && cachedPrices.crypto[position.symbol]) {
                const priceData = cachedPrices.crypto[position.symbol];
                if (priceData.price !== null && priceData.price !== undefined) {
                    position.currentPrice = priceData.price;
                    position.change24h = priceData.change;
                    position.unavailable = false;
                } else {
                    position.currentPrice = null;
                    position.change24h = null;
                    position.unavailable = true;
                }
            } else if (position.type === 'bond' && cachedPrices.bonds && cachedPrices.bonds[position.symbol]) {
                const priceData = cachedPrices.bonds[position.symbol];
                if (priceData.price !== null && priceData.price !== undefined) {
                    position.currentPrice = priceData.price;
                    position.change24h = priceData.change;
                    position.unavailable = false;
                } else {
                    position.currentPrice = null;
                    position.change24h = null;
                    position.unavailable = true;
                }
            } else if (position.type === 'cash' && cachedPrices.cash && cachedPrices.cash[position.symbol]) {
                const priceData = cachedPrices.cash[position.symbol];
                if (priceData.price !== null && priceData.price !== undefined) {
                    position.currentPrice = priceData.price;
                    position.change24h = priceData.change;
                    position.unavailable = false;
                } else {
                    position.currentPrice = null;
                    position.change24h = null;
                    position.unavailable = true;
                }
            } else if (position.type === 'p2p' && cachedPrices.p2p && cachedPrices.p2p[position.symbol]) {
                const priceData = cachedPrices.p2p[position.symbol];
                if (priceData.price !== null && priceData.price !== undefined) {
                    position.currentPrice = priceData.price;
                    position.change24h = priceData.change;
                    position.unavailable = false;
                } else {
                    position.currentPrice = null;
                    position.change24h = null;
                    position.unavailable = true;
                }
            }
        });
    }

    updateCryptoPrices(prices) {
        this.positions.forEach(position => {
            if (position.type === 'crypto') {
                const coinGeckoId = this.getCoinGeckoId(position.symbol);
                const priceData = prices[coinGeckoId];
                if (priceData) {
                    if (priceData.usd !== null && priceData.usd !== undefined) {
                        position.currentPrice = priceData.usd;
                        position.change24h = priceData.usd_24h_change || 0;
                        position.unavailable = false;
                    } else {
                        position.currentPrice = null;
                        position.change24h = null;
                        position.unavailable = true;
                    }
                }
            }
        });
    }

    updateStockPrices(prices) {
        this.positions.forEach(position => {
            if (position.type === 'stock') {
                const priceData = prices[position.symbol];
                if (priceData) {
                    if (priceData.price !== null && priceData.price !== undefined) {
                        position.currentPrice = priceData.price;
                        position.change24h = priceData.change;
                        position.unavailable = false;
                    } else {
                        position.currentPrice = null;
                        position.change24h = null;
                        position.unavailable = true;
                    }
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

    updateP2PPrices() {
        this.positions.forEach(position => {
            if (position.type === 'p2p') {
                // Mock P2P/Private credit price movement with small variations
                position.currentPrice = position.entryPrice + (Math.random() - 0.5) * 1;
                position.change24h = (Math.random() - 0.5) * 0.5;
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
            crypto: { name: 'Cryptocurrency', value: 0, count: 0, positions: [], color: '#fde68a', icon: '₿' },
            stock: { name: 'Stocks / ETFs', value: 0, count: 0, positions: [], color: '#bfdbfe', icon: '📈' },
            bond: { name: 'Cash Equivalents', value: 0, count: 0, positions: [], color: '#bbf7d0', icon: '🏛️' },
            p2p: { name: 'P2P / Credit', value: 0, count: 0, positions: [], color: '#ddd6fe', icon: '🤝' },
            cash: { name: 'Cash', value: 0, count: 0, positions: [], color: '#d1d5db', icon: '💵' }
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
            totalValueEl.textContent = formatCurrency(totalValue);
        }
        
        if (totalChangeEl) {
            const sign = totalPnl >= 0 ? '+' : '';
            totalChangeEl.textContent = `${sign}${formatCurrency(totalPnl)} (${sign}${formatPercentage(totalPnlPercent)})`;
            totalChangeEl.className = `summary-change ${totalPnl >= 0 ? 'change-positive' : 'change-negative'}`;
        }

        // Update best performer
        const bestPerformerEl = document.getElementById('bestPerformer');
        const bestPerformerChangeEl = document.getElementById('bestPerformerChange');
        
        if (bestPerformer && bestPerformerEl && bestPerformerChangeEl) {
            bestPerformerEl.textContent = `${bestPerformer.symbol}`;
            bestPerformerChangeEl.textContent = `+${formatPercentage(bestPerformance)}`;
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
        const currentView = this.currentView; // Store reference to avoid context issues
        nodes.each(function(d) {
            const node = d3.select(this);
            const width = d.x1 - d.x0;
            const height = d.y1 - d.y0;
            
            // Only add text if rectangle is large enough
            if (width > 60 && height > 40) {
                const textGroup = node.append('g')
                    .attr('class', 'treemap-text-group');

                // Add icon only for categories view
                if (currentView === 'categories') {
                    textGroup.append('text')
                        .attr('class', 'treemap-text')
                        .attr('x', width / 2)
                        .attr('y', height / 2 - 10)
                        .attr('text-anchor', 'middle')
                        .attr('font-size', '20px')
                        .text(d.data.icon);
                }

                // Add name
                textGroup.append('text')
                    .attr('class', 'treemap-text')
                    .attr('x', width / 2)
                    .attr('y', currentView === 'categories' ? height / 2 + 8 : height / 2 - 2)
                    .attr('text-anchor', 'middle')
                    .attr('font-size', width > 120 ? '14px' : '12px')
                    .text(d.data.name);

                // Add value - use the percentage that was calculated correctly for each view
                textGroup.append('text')
                    .attr('class', 'treemap-value')
                    .attr('x', width / 2)
                    .attr('y', currentView === 'categories' ? height / 2 + 24 : height / 2 + 16)
                    .attr('text-anchor', 'middle')
                    .text(`${formatCurrency(d.data.value, 0)} (${formatPercentage(d.data.percentage, 1)})`);
            }
        });
    }

    showPositionsView(categoryData) {
        this.currentView = 'positions';
        this.currentCategory = categoryData;

        // Update title and show back button
        document.getElementById('treemapTitle').textContent = `${categoryData.name} Holdings`;
        document.getElementById('treemapBack').style.display = 'flex';

        // Calculate total value for this category to get proper percentages
        const categoryTotal = categoryData.positions.reduce((total, pos) => total + pos.currentValue, 0);

        // Create a color palette for individual positions within a category
        const positionColors = [
            '#fecaca', '#fed7aa', '#fde68a', '#d9f99d', '#bbf7d0', 
            '#a7f3d0', '#bfdbfe', '#c7d2fe', '#ddd6fe', '#f3e8ff',
            '#fce7f3', '#fed7e2', '#fecdd3', '#e2e8f0', '#f1f5f9'
        ];

        // Prepare positions data for treemap
        const positionsData = {
            name: categoryData.name,
            children: categoryData.positions.map((position, index) => ({
                name: position.symbol,
                value: position.currentValue,
                fullName: position.name,
                pnl: position.pnl,
                pnlPercent: position.pnlPercent,
                currentPrice: position.currentPrice || position.entryPrice,
                entryPrice: position.entryPrice,
                multiplier: position.multiplier,
                percentage: categoryTotal > 0 ? (position.currentValue / categoryTotal * 100) : 0,
                color: positionColors[index % positionColors.length] // Cycle through colors
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
                Value: ${formatCurrency(d.data.value)}<br>
                Percentage: ${formatPercentage(d.data.percentage, 1)}<br>
                Positions: ${d.data.count}
            `;
        } else {
            const sign = d.data.pnl >= 0 ? '+' : '';
            content = `
                <strong>${d.data.name}</strong><br>
                ${d.data.fullName}<br>
                Current: $${formatNumber(d.data.currentPrice)}<br>
                Value: ${formatCurrency(d.data.value)}<br>
                Category %: ${formatPercentage(d.data.percentage, 1)}<br>
                P&L: ${sign}${formatCurrency(d.data.pnl)} (${sign}${formatPercentage(d.data.pnlPercent)})
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
        console.log('📊 Rendering positions - total available:', this.positions.length); // Debug log
        console.log('📊 Current tab filter:', this.currentTab); // Debug log
        
        const filteredPositions = this.currentTab === 'all' 
            ? this.positions 
            : this.positions.filter(p => {
                if (this.currentTab === 'stocks') return p.type === 'stock';
                if (this.currentTab === 'crypto') return p.type === 'crypto';
                if (this.currentTab === 'bonds') return p.type === 'bond' || p.type === 'cash'; // Both bond and cash are Cash Equivalents
                if (this.currentTab === 'p2p') return p.type === 'p2p';
                return true;
            });

        console.log('📊 Filtered positions for rendering:', filteredPositions.length); // Debug log

        container.innerHTML = filteredPositions.map(position => 
            this.createPositionCard(position)
        ).join('');

        // Add event listeners for position actions
        this.attachPositionEventListeners();
    }

    createPositionCard(position) {
        // Handle unavailable current price - use entry price as fallback
        const currentPrice = (position.currentPrice !== null && position.currentPrice !== undefined) 
            ? position.currentPrice 
            : position.entryPrice;
        
        const isPriceUnavailable = position.unavailable === true || 
            (position.currentPrice === null || position.currentPrice === undefined);
        
        const currentValue = currentPrice * position.multiplier;
        const costBasis = position.entryPrice * position.multiplier;
        const pnl = currentValue - costBasis;
        const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
        const pnlClass = pnl >= 0 ? 'change-positive' : 'change-negative';
        const pnlSign = pnl >= 0 ? '+' : '';

        const typeLabels = {
            'crypto': 'Crypto',
            'stock': 'Stocks/ETFs',
            'bond': 'Cash Equivalents',
            'cash': 'Cash',
            'p2p': 'P2P/Private credit'
        };

        // Determine price source and status
        const priceSource = this.getPriceSourceInfo(position);

        // Format price display based on availability
        const priceDisplay = isPriceUnavailable 
            ? '<span class="price-unavailable">N/A</span>' 
            : `$${formatNumber(currentPrice)}`;

        return `
            <div class="position-card" data-id="${position.id}" data-portfolio-id="${position.portfolioId || this.portfolios[0]?.id}">
                <div class="position-header">
                    <div class="position-info">
                        <div class="symbol-with-indicator">
                            <h3>${position.symbol}</h3>
                            <span class="price-indicator ${priceSource.class}" title="${priceSource.tooltip}">
                                <i class="${priceSource.icon}"></i>
                            </span>
                        </div>
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
                        <div class="value-amount">${priceDisplay}</div>
                    </div>
                    <div class="value-item">
                        <div class="value-label">Position Value (Normalized)</div>
                        <div class="value-amount">${formatCurrency(currentValue)}</div>
                    </div>
                    <div class="value-item">
                        <div class="value-label">Entry Price</div>
                        <div class="value-amount">$${formatNumber(position.entryPrice)}</div>
                    </div>
                    <div class="value-item">
                        <div class="value-label">Portfolio Weight</div>
                        <div class="value-amount">${position.multiplier.toFixed(3)}x</div>
                    </div>
                </div>
                
                <div class="position-pnl">
                    <span class="pnl-absolute ${pnlClass}">${pnlSign}${formatCurrency(pnl)}</span>
                    <span class="pnl-percentage ${pnlClass}">${pnlSign}${formatPercentage(pnlPercent)}</span>
                </div>
                
                ${position.notes ? `<div class="position-notes">${position.notes}</div>` : ''}
            </div>
        `;
    }

    attachPositionEventListeners() {
        // Delete buttons
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const hasAccess = await this.auth.checkAccess();
                if (hasAccess) {
                    const positionCard = btn.closest('.position-card');
                    const positionId = positionCard.dataset.id;
                    const portfolioId = positionCard.dataset.portfolioId;
                    
                    if (confirm(`Are you sure you want to delete this position?`)) {
                        await this.deletePosition(positionId, portfolioId);
                    }
                }
            });
        });

        // Edit buttons (placeholder for future implementation)
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const hasAccess = await this.auth.checkAccess();
                if (hasAccess) {
                    const positionId = btn.closest('.position-card').dataset.id;
                    this.editPosition(positionId);
                }
            });
        });
    }

    async addPosition() {
        const form = document.getElementById('addPositionForm');
        const formData = new FormData(form);
        
        // Hide any previous errors
        this.hideFormError();
        
        // Get form values with validation
        const symbol = formData.get('symbol');
        const assetType = formData.get('assetType');
        const entryPrice = formData.get('entryPrice');
        const investmentAmount = formData.get('investmentAmount');
        const notes = formData.get('notes');
        
        // For Cash Equivalents and P2P/Private credit, ensure defaults are set if fields are empty
        const isAutoFillType = (assetType === 'bond' || assetType === 'p2p');
        const finalSymbol = isAutoFillType ? 
            (assetType === 'bond' ? 'CASH-EQUIV' : 'P2P-PRIV-CREDIT') : 
            (symbol || '');
        const finalEntryPrice = isAutoFillType ? '1.00' : (entryPrice || '');
        
        console.log('Form data:', { symbol, assetType, entryPrice, investmentAmount, finalSymbol, finalEntryPrice }); // Debug
        
        // Validate required fields
        if (!assetType) {
            this.showFormError('Please select an asset type.');
            return;
        }
        
        if (!isAutoFillType && (!finalSymbol || !finalSymbol.trim())) {
            this.showFormError('Please enter a symbol/ticker.');
            return;
        }
        
        if (!isAutoFillType && (!finalEntryPrice || isNaN(parseFloat(finalEntryPrice)))) {
            this.showFormError('Please enter a valid entry price.');
            return;
        }
        
        if (!investmentAmount || isNaN(parseFloat(investmentAmount))) {
            this.showFormError('Please enter a valid investment amount.');
            return;
        }

        // For Cash Equivalents and P2P/Private credit, we don't need to validate the symbol
        const skipSymbolValidation = isAutoFillType;

        // Calculate shares/units from investment amount and entry price
        const shares = parseFloat(investmentAmount) / parseFloat(finalEntryPrice);
        
        // Use the first portfolio (or create one if none exists)
        if (this.portfolios.length === 0) {
            this.showFormError('No portfolio found. Please create a portfolio first.');
            return;
        }

        const portfolioId = this.portfolios[0].id;

        try {
            this.showLoading();

            // Validate and register the symbol with the backend (skip for Cash Equivalents)
            if (!skipSymbolValidation) {
                const symbolValidation = await this.registerSymbolWithBackend(finalSymbol.trim().toUpperCase(), assetType);
                
                if (!symbolValidation.success) {
                    this.hideLoading();
                    // Show enhanced error message with HTML support for links
                    this.showFormError(symbolValidation.message, symbolValidation.isHtml);
                    return;
                }
            }

            // Send the position with real investment amount - backend will handle normalization
            const response = await fetch(`${API_CONFIG.BACKEND_URL}/api/user/${USER_CONFIG.USERNAME}/portfolios/${portfolioId}/positions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    symbol: finalSymbol.trim().toUpperCase(),
                    name: finalSymbol.trim().toUpperCase(),
                    type: assetType,
                    entryPrice: parseFloat(finalEntryPrice),
                    investmentAmount: parseFloat(investmentAmount), // Send real amount
                    shares: shares, // Calculated shares
                    notes: notes || '',
                    token: this.auth.authToken
                })
            });

            const result = await response.json();
            this.hideLoading();

            if (response.ok) {
                // Reload portfolios to get updated data
                await this.loadUserPortfolios();
                this.fetchData();
                
                form.reset();
                this.hideFormError();
                this.showSuccess(`Position added successfully! ${result.position.symbol} added to portfolio.`);
            } else {
                this.showFormError(result.error || 'Failed to add position');
            }

        } catch (error) {
            this.hideLoading();
            console.error('Error adding position:', error);
            this.showFormError('Failed to add position. Please check your connection and try again.');
        }
    }

    async registerSymbolWithBackend(symbol, type) {
        try {
            console.log(`📡 Registering symbol ${symbol} (${type}) with backend...`);
            
            const response = await fetch(`${API_CONFIG.BACKEND_URL}/api/symbols/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ symbol, type })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                console.log(`✅ Symbol validated and registered:`, result.message);
                return { success: true, message: result.message };
            } else {
                // Handle validation errors and create enhanced message with links
                console.warn(`⚠️ Symbol validation failed for ${symbol}:`, result.error);
                
                // Create enhanced error message with clickable links
                let enhancedMessage = result.message || `Symbol ${symbol} not found in data sources`;
                
                if (result.searchUrl) {
                    // Convert URL text to clickable links while preserving the URL text
                    if (type === 'crypto') {
                        enhancedMessage = enhancedMessage.replace(
                            'https://www.coingecko.com/',
                            '<a href="https://www.coingecko.com/" target="_blank" rel="noopener noreferrer">https://www.coingecko.com/</a>'
                        );
                    } else {
                        enhancedMessage = enhancedMessage.replace(
                            'https://finance.yahoo.com/lookup/',
                            '<a href="https://finance.yahoo.com/lookup/" target="_blank" rel="noopener noreferrer">https://finance.yahoo.com/lookup/</a>'
                        );
                    }
                }
                
                return { 
                    success: false, 
                    error: result.error,
                    message: enhancedMessage,
                    isHtml: !!result.searchUrl  // Flag to indicate HTML content
                };
            }
        } catch (error) {
            console.warn(`⚠️ Could not validate symbol ${symbol} with backend:`, error.message);
            
            // Create user-friendly network error message
            const networkErrorMessage = `Could not connect to validation service. You can still add "${symbol}" to your portfolio, but it won't be validated. ` +
                `To verify symbols manually, visit: ` +
                (type === 'crypto' ? 
                    '<a href="https://www.coingecko.com/" target="_blank" rel="noopener noreferrer">https://www.coingecko.com/</a>' :
                    '<a href="https://finance.yahoo.com/lookup/" target="_blank" rel="noopener noreferrer">https://finance.yahoo.com/lookup/</a>'
                );
                
            return { 
                success: false, 
                error: 'Network error',
                message: networkErrorMessage,
                isHtml: true
            };
        }
    }

    async registerExistingSymbols() {
        console.log('📡 Registering existing position symbols with backend...');
        const uniqueSymbols = new Map();
        
        // Collect unique symbols by type
        this.positions.forEach(position => {
            const key = `${position.symbol}-${position.type}`;
            if (!uniqueSymbols.has(key)) {
                uniqueSymbols.set(key, { symbol: position.symbol, type: position.type });
            }
        });
        
        // Register each unique symbol
        for (const { symbol, type } of uniqueSymbols.values()) {
            await this.registerSymbolWithBackend(symbol, type);
            // Small delay to avoid overwhelming the backend
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log(`✅ Registered ${uniqueSymbols.size} symbols with backend`);
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
        // Try to show error in form first, fallback to alert
        const formError = document.getElementById('formErrorMessage');
        const formErrorText = document.getElementById('formErrorText');
        
        if (formError && formErrorText) {
            formErrorText.textContent = message;
            formError.style.display = 'flex';
            
            // Auto-hide after 8 seconds
            setTimeout(() => {
                formError.style.display = 'none';
            }, 8000);
        } else {
            alert(message);
        }
    }

    showFormError(message, isHtml = false) {
        const formError = document.getElementById('formErrorMessage');
        const formErrorText = document.getElementById('formErrorText');
        
        if (formError && formErrorText) {
            if (isHtml) {
                formErrorText.innerHTML = message;
            } else {
                formErrorText.textContent = message;
            }
            formError.style.display = 'flex';
            
            // Auto-hide after 10 seconds (longer for messages with links)
            setTimeout(() => {
                formError.style.display = 'none';
            }, 10000);
        }
    }

    hideFormError() {
        const formError = document.getElementById('formErrorMessage');
        if (formError) {
            formError.style.display = 'none';
        }
    }

    // Position deletion method
    async deletePosition(positionId, portfolioId) {
        try {
            const response = await fetch(`${API_CONFIG.BACKEND_URL}/api/user/${USER_CONFIG.USERNAME}/portfolios/${portfolioId}/positions/${positionId}/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token: this.auth.authToken
                })
            });

            const result = await response.json();

            if (response.ok) {
                // Reload portfolios to get updated data
                await this.loadUserPortfolios();
                this.fetchData();
                this.showSuccess('Position deleted successfully!');
            } else {
                this.showFormError(result.error || 'Failed to delete position');
            }

        } catch (error) {
            console.error('Error deleting position:', error);
            this.showFormError('Failed to delete position. Please check your connection and try again.');
        }
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

    updateDataSourceIndicator(isLiveData = true, source = 'backend') {
        const indicator = document.getElementById('dataSource');
        if (!indicator) return;
        
        // Remove existing classes
        indicator.classList.remove('live', 'fallback', 'error', 'cached', 'backend');
        
        switch (source) {
            case 'backend':
                indicator.classList.add('backend');
                indicator.innerHTML = '<i class="fas fa-server"></i><span>Backend Service</span>';
                break;
            case 'cached':
                indicator.classList.add('cached');
                indicator.innerHTML = '<i class="fas fa-database"></i><span>Cached Data</span>';
                break;
            case 'live':
                indicator.classList.add('live');
                indicator.innerHTML = '<i class="fas fa-wifi"></i><span>Live API</span>';
                break;
            case 'fallback':
            default:
                if (isLiveData) {
                    indicator.classList.add('live');
                    indicator.innerHTML = '<i class="fas fa-wifi"></i><span>Live API</span>';
                } else {
                    indicator.classList.add('fallback');
                    indicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Fallback Data</span>';
                }
                break;
        }
    }

    // Method to clear rate limit (useful for testing or when upgrading API plan)
    clearRateLimit() {
        localStorage.removeItem('alphaVantageRateLimit');
        console.log('Alpha Vantage rate limit cleared. You can try fetching live data again.');
        this.fetchData(); // Refresh data
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

    async fetchFromBackend() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.FALLBACK_TIMEOUT);
            
            const response = await fetch(`${API_CONFIG.BACKEND_URL}/api/prices`, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Backend response received:', {
                lastUpdated: data.lastUpdated,
                stockCount: Object.keys(data.stocks || {}).length,
                cryptoCount: Object.keys(data.crypto || {}).length,
                cacheAge: data.cacheAge
            });
            
            return data;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Backend request timeout');
            }
            throw error;
        }
    }

    isBackendDataValid(backendData) {
        if (!backendData || !backendData.lastUpdated) {
            return false;
        }
        
        const lastUpdated = new Date(backendData.lastUpdated);
        const now = new Date();
        const ageInHours = (now - lastUpdated) / (1000 * 60 * 60);
        
        // Backend data is valid for 3 hours (gives buffer for Heroku dyno sleep)
        return ageInHours < 3;
    }

    applyBackendPrices(backendData) {
        // Apply backend stock and crypto prices
        this.positions.forEach(position => {
            if (position.type === 'stock' && backendData.stocks[position.symbol]) {
                const priceData = backendData.stocks[position.symbol];
                position.currentPrice = priceData.price;
                position.change24h = priceData.change;
                position.fallback = priceData.fallback || false;
                position.priceSource = priceData.source || 'backend';
                position.priceAge = this.calculatePriceAge(priceData.timestamp);
            } else if (position.type === 'crypto' && backendData.crypto[position.symbol]) {
                const priceData = backendData.crypto[position.symbol];
                position.currentPrice = priceData.price;
                position.change24h = priceData.change;
                position.fallback = priceData.fallback || false;
                position.priceSource = 'backend';
                position.priceAge = this.calculatePriceAge(priceData.timestamp);
            } else if (position.type === 'bond' && backendData.bonds && backendData.bonds[position.symbol]) {
                const priceData = backendData.bonds[position.symbol];
                position.currentPrice = priceData.price;
                position.change24h = priceData.change;
                position.fallback = false;
                position.priceSource = 'backend';
                position.priceAge = this.calculatePriceAge(priceData.timestamp);
            } else if (position.type === 'cash' && backendData.cash && backendData.cash[position.symbol]) {
                const priceData = backendData.cash[position.symbol];
                position.currentPrice = priceData.price;
                position.change24h = priceData.change;
                position.fallback = false;
                position.priceSource = 'backend';
                position.priceAge = this.calculatePriceAge(priceData.timestamp);
            } else if (position.type === 'p2p' && backendData.p2p && backendData.p2p[position.symbol]) {
                const priceData = backendData.p2p[position.symbol];
                position.currentPrice = priceData.price;
                position.change24h = priceData.change;
                position.fallback = false;
                position.priceSource = 'backend';
                position.priceAge = this.calculatePriceAge(priceData.timestamp);
            } else {
                // Mark as no data available from backend
                position.fallback = true;
                position.priceSource = 'entry';
                position.currentPrice = position.entryPrice;
            }
        });
    }

    calculatePriceAge(timestamp) {
        if (!timestamp) return null;
        
        const now = new Date();
        const priceTime = new Date(timestamp);
        const ageInHours = (now - priceTime) / (1000 * 60 * 60);
        
        return ageInHours;
    }

    getFallbackStockPrice(symbol) {
        console.log(`❌ No price data available for ${symbol} - will use entry price or show as unavailable`);
        
        return {
            price: null,
            change: null,
            unavailable: true,
            timestamp: new Date().toISOString()
        };
    }

    getMockStockPrices(symbols) {
        console.log('📋 Using mock stock prices for symbols:', symbols);
        const results = {};
        
        symbols.forEach(symbol => {
            results[symbol] = this.getFallbackStockPrice(symbol);
        });
        
        return results;
    }

    getPriceSourceInfo(position) {
        // Check if price was successfully fetched or using fallback/entry price
        const hasCurrentPrice = position.currentPrice && position.currentPrice !== position.entryPrice;
        const isPriceUnavailable = position.unavailable === true || 
            (position.currentPrice === null || position.currentPrice === undefined);
        const isFallbackData = position.fallback === true;
        const isStale = position.priceAge && position.priceAge > 3; // Hours
        
        // Determine source based on position type and data availability
        if (position.type === 'cash') {
            return {
                class: 'price-source-static',
                icon: 'fas fa-equals',
                text: 'Static Price',
                tooltip: 'Static Price - Cash equivalent with fixed value'
            };
        }
        
        if (position.type === 'p2p' || position.type === 'bond') {
            return {
                class: 'price-source-estimated',
                icon: 'fas fa-calculator',
                text: 'Estimated Price',
                tooltip: 'Estimated Price - Manually calculated or estimated value'
            };
        }
        
        if (isPriceUnavailable) {
            return {
                class: 'price-source-unavailable',
                icon: 'fas fa-question-circle',
                text: 'Price Unavailable',
                tooltip: 'Price Unavailable - No current price data available, using entry price for calculations'
            };
        }
        
        if (!hasCurrentPrice) {
            return {
                class: 'price-source-entry',
                icon: 'fas fa-exclamation-triangle',
                text: 'Using Entry Price',
                tooltip: 'Using Entry Price - Live price unavailable, showing entry price'
            };
        }
        
        if (isFallbackData) {
            return {
                class: 'price-source-fallback',
                icon: 'fas fa-database',
                text: 'Fallback Data',
                tooltip: 'Fallback Data - Using cached or fallback price data'
            };
        }
        
        if (isStale) {
            return {
                class: 'price-source-stale',
                icon: 'fas fa-clock',
                text: 'Stale Price Data',
                tooltip: 'Stale Data - Price data is older than 3 hours'
            };
        }
        
        // Live/fresh data
        return {
            class: 'price-source-live',
            icon: 'fas fa-wifi',
            text: 'Live Price',
            tooltip: 'Live Price - Real-time data from API'
        };
    }
}

// Initialize the portfolio manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.portfolioManager = new PortfolioManager();
    loadAPIConfig(); // Load backend configuration
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
