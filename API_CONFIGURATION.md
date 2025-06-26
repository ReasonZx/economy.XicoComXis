# Portfolio API Configuration

This project uses external APIs to fetch live financial data. To enable live data features, you need to configure API keys.

## Setup Instructions

### 1. Create Configuration File

Copy the example configuration file and rename it:

```bash
cp config.example.js config.js
```

### 2. Get API Keys

#### Alpha Vantage (for Stock Prices)
1. Visit [Alpha Vantage](https://www.alphavantage.co/support/#api-key)
2. Sign up for a free account
3. Get your API key (free tier: 5 calls per minute, 500 calls per day)

#### Financial Modeling Prep (Alternative/Backup)
1. Visit [Financial Modeling Prep](https://financialmodelingprep.com/developer/docs)
2. Sign up for a free account
3. Get your API key

### 3. Configure API Keys

Edit `config.js` and replace the placeholder values:

```javascript
window.API_KEYS = {
    ALPHA_VANTAGE_KEY: 'your_actual_alpha_vantage_key_here',
    FMP_KEY: 'your_actual_fmp_key_here'
};
```

## Data Sources

- **Cryptocurrency**: CoinGecko API (no key required)
- **Stocks**: Alpha Vantage API (requires free API key)
- **Bonds**: Mock data for demonstration
- **Cash**: Static values

## Fallback Behavior

If API keys are not configured or APIs fail:
- Cryptocurrency: Falls back to mock data
- Stocks: Falls back to predefined sample prices
- The app will display a "Fallback Data" indicator

## Security Notes

- The `config.js` file is ignored by git to keep your API keys secure
- Never commit actual API keys to version control
- API keys are loaded client-side, so they're visible in the browser
- For production apps, consider using a backend proxy to hide API keys

## Rate Limiting

- Alpha Vantage free tier: 5 calls per minute, 500 calls per day
- The app includes rate limiting delays between requests
- Consider the limits when adding many stock positions

## Troubleshooting

### API Keys Not Loading
- Ensure `config.js` exists in the same directory as `index.html`
- Check browser console for error messages
- Verify the `config.js` file syntax is correct

### API Rate Limits
- Wait a few minutes before retrying if you hit rate limits
- Consider upgrading to a paid API plan for higher limits
- Remove and re-add positions to force a fresh data fetch

### CORS Issues
- APIs are accessed directly from the browser
- Some browsers may block cross-origin requests in local development
- Consider serving the app through a local web server instead of opening HTML files directly
