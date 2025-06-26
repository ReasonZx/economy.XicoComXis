# Financial Portfolio Manager

A modern, interactive portfolio tracking application with live price data and advanced visualizations.

## Features

- 🚀 **Live Price Data**: Real-time cryptocurrency and stock prices
- 📊 **Interactive Treemap**: D3.js-powered portfolio visualization with drill-down capabilities
- 💼 **Multi-Asset Support**: Stocks, cryptocurrencies, bonds, and cash
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🔄 **Smart Data Fetching**: Automatic fallback to mock data when APIs are unavailable
- 💾 **Local Storage**: Positions saved locally in your browser

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd economy.XicoComXis
   ```

2. **Configure API Keys** (Optional - for live data)
   ```bash
   cp config.example.js config.js
   # Edit config.js with your API keys
   ```
   See [API_CONFIGURATION.md](./API_CONFIGURATION.md) for detailed setup instructions.

3. **Open in Browser**
   ```bash
   # Open index.html in your web browser
   # Or serve with a local web server for best results
   ```

## Data Sources

- **Cryptocurrency**: CoinGecko API (free, no key required)
- **Stocks**: Alpha Vantage API (requires free API key)
- **Bonds & Cash**: Mock data for demonstration

## Configuration

The app works without any configuration, using fallback data. For live price updates:

1. Get free API keys from [Alpha Vantage](https://www.alphavantage.co/support/#api-key)
2. Copy `config.example.js` to `config.js`
3. Add your API keys to the config file

See [API_CONFIGURATION.md](./API_CONFIGURATION.md) for complete setup instructions.

## Privacy & Security

- All data is stored locally in your browser
- Portfolio values are normalized to base 100€ for privacy
- API keys are kept in a local config file (not committed to git)
- No personal financial data is transmitted or stored remotely

## Technologies Used

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Visualization**: D3.js for interactive treemap
- **APIs**: CoinGecko, Alpha Vantage
- **Storage**: Browser LocalStorage
- **Styling**: Custom CSS with modern design patterns

## Contributing

This is an open-source project. Contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).