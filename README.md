# RAWS MCP Server

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](package.json)
[![Status](https://img.shields.io/badge/status-planning-yellow)](docs/implementation_plan.md)

A Model Context Protocol (MCP) server that provides access to Remote Automatic Weather Station (RAWS) data for wildfire management and weather monitoring applications.

> **Note:** This project is currently in the planning and documentation phase. The implementation (`src/` directory) has not been created yet. See [Implementation Plan](docs/implementation_plan.md) for development roadmap.

## Overview

This MCP server integrates with RAWS data sources to provide real-time and historical weather data critical for wildfire behavior prediction, fire management decisions, and emergency response. The server formats data to align with the wildfire information schema used by the [fire-behavior](https://github.com/EliSchillinger/fire-behavior) application.

### What is RAWS?

Remote Automatic Weather Stations (RAWS) are automated weather stations strategically located across wildfire-prone regions. They collect data on:
- Temperature
- Humidity
- Wind speed and direction
- Precipitation
- Fuel moisture
- Solar radiation

RAWS data is maintained by agencies including:
- Bureau of Land Management (BLM)
- US Forest Service (USFS)
- National Weather Service (NWS)
- State forestry departments

## Features

- Fetch current weather conditions from RAWS stations
- Retrieve historical weather data for trend analysis
- Search for stations by location (lat/lon, city, county)
- Calculate fire weather indices (e.g., Haines Index, NFDRS components)
- Format data to match wildfire_prompt_template.json schema
- Support for multiple data sources (Synoptic API, MesoWest, WRCC)

## How It Works

The RAWS MCP server acts as a bridge between Claude (or other MCP clients) and multiple RAWS data sources:

1. **Location Query**: You ask Claude about weather conditions at a specific location
2. **Station Search**: The server finds the nearest RAWS station(s) to your location
3. **Data Retrieval**: Real-time weather observations are fetched from Synoptic Data API or other sources
4. **Schema Transformation**: Raw RAWS data is transformed into the standardized wildfire information schema
5. **Fire Weather Analysis**: Optional fire weather indices (Haines, Fosberg, etc.) are calculated
6. **Response**: Formatted data is returned to Claude for analysis and presentation

## Installation

> **Prerequisites:** Node.js 18.0.0 or higher

```bash
# Clone the repository
git clone https://github.com/tyson-swetnam/raws-mcp.git
cd raws-mcp

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env and add your API tokens
```

## Configuration

### Required: API Tokens

Create a `.env` file with your API credentials:

```env
# Required: At least one data source API token
SYNOPTIC_API_TOKEN=your_token_here
MESOWEST_API_TOKEN=your_token_here

# Optional: Server configuration
LOG_LEVEL=info
CACHE_TTL_SECONDS=300

# Optional: Feature flags
ENABLE_NWS_INTEGRATION=true
ENABLE_FIRE_INDICES=true
```

**Getting API Tokens:**

- **Synoptic Data API**: Register at [synopticdata.com](https://synopticdata.com/) (Free tier: 5,000 requests/day)
- **MesoWest API**: Register at [mesowest.utah.edu](https://mesowest.utah.edu/)

### MCP Server Configuration

Add to your Claude Desktop configuration:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "raws": {
      "command": "node",
      "args": ["/absolute/path/to/raws-mcp/src/index.js"]
    }
  }
}
```

**Important:** Use the absolute path to `src/index.js`, not a relative path.

## Usage

### Starting the Server

```bash
# Start the MCP server
npm start

# Or start with auto-reload for development
npm run dev
```

### Example Queries

Once configured with Claude Desktop, you can ask:

- "What are the current weather conditions at RAWS station C5725?"
- "Find RAWS stations near Boulder, Colorado"
- "Show me the fire weather indices for Monument Creek RAWS"
- "Get the last 24 hours of weather data from CLKC1 station"

## Available Tools

### 1. get_raws_current
Get current weather conditions from a RAWS station.

**Parameters:**
- `station_id` (string, required): RAWS station identifier
- `format` (string, optional): Output format - "json" | "wildfire_schema"

**Example Request:**
```json
{
  "station_id": "C5725",
  "format": "wildfire_schema"
}
```

**Example Response:**
```json
{
  "location": "Monument Creek, Colorado",
  "as_of": "2025-08-29T14:00:00Z",
  "weather_risks": {
    "temperature": { "value": 88, "units": "F" },
    "humidity": { "percent": 18 },
    "wind": { "speed": 22, "gusts": 40, "direction": "NW" },
    "probability_of_rain": {
      "percent": 15,
      "time_window": "next 24h",
      "confidence": "medium"
    }
  },
  "data_sources": [
    {
      "name": "Monument Creek RAWS (C5725)",
      "type": "weather",
      "url": "https://raws.dri.edu/C5725"
    }
  ]
}
```

### 2. search_raws_stations
Find RAWS stations near a location.

**Parameters:**
- `latitude` (number, required): Latitude (-90 to 90)
- `longitude` (number, required): Longitude (-180 to 180)
- `radius_miles` (number, optional): Search radius in miles (default: 50)
- `limit` (number, optional): Max results (default: 10)

**Example Request:**
```json
{
  "latitude": 40.0150,
  "longitude": -105.2705,
  "radius_miles": 50,
  "limit": 5
}
```

### 3. get_raws_historical
Retrieve historical weather data from a station.

**Parameters:**
- `station_id` (string, required): RAWS station identifier
- `start_time` (string, required): ISO 8601 timestamp (e.g., "2025-08-29T00:00:00Z")
- `end_time` (string, required): ISO 8601 timestamp
- `variables` (array, optional): Specific variables to retrieve (default: all)

**Example Request:**
```json
{
  "station_id": "C5725",
  "start_time": "2025-08-29T00:00:00Z",
  "end_time": "2025-08-29T23:59:59Z",
  "variables": ["temperature", "humidity", "wind"]
}
```

### 4. calculate_fire_indices
Calculate fire weather indices from RAWS data.

**Parameters:**
- `station_id` (string, required): RAWS station identifier
- `indices` (array, optional): Specific indices to calculate (default: all)
  - `"haines"` - Haines Index (atmospheric stability and dryness)
  - `"fosberg"` - Fosberg Fire Weather Index (temp, humidity, wind)
  - `"chandler"` - Chandler Burning Index (includes fuel moisture)

**Example Request:**
```json
{
  "station_id": "C5725",
  "indices": ["haines", "fosberg"]
}
```

**Note:** Fire weather indices provide critical information for wildfire risk assessment. See [Fire Weather Formulas](docs/data_schema.md#fire-weather-indices) for calculation details.

## Data Schema

The server outputs data conforming to the fire-behavior `wildfire_prompt_template.json` schema. This ensures seamless integration with wildfire management applications.

**Key Features:**
- Temperature, humidity, and wind observations
- Estimated precipitation probability
- Red Flag Warning detection
- Extreme weather change alerts
- Fire weather indices
- Data source attribution

See [Data Schema Documentation](docs/data_schema.md) for complete mapping details and transformation logic.

## Data Sources

This MCP server connects to:

1. **Synoptic Data API** - Primary source for real-time RAWS data
   - Documentation: https://synopticdata.com/mesonet-api
   - Coverage: 2000+ RAWS stations

2. **MesoWest** - Weather station network data
   - Documentation: https://mesowest.utah.edu/
   - Historical and real-time data

3. **Western Regional Climate Center (WRCC)** - Archive data
   - Documentation: https://raws.dri.edu/
   - Long-term historical records

## Common RAWS Stations

Here are some example RAWS stations for testing and reference:

| Station ID | Name | Location | Elevation | Notes |
|------------|------|----------|-----------|-------|
| C5725 | Monument Creek | Colorado | 7,200 ft | Active, reliable data |
| CLKC1 | Clark Summit | California | 5,800 ft | Fire-prone area |
| CBRW1 | Carpenter Road | Washington | 4,200 ft | Pacific Northwest |
| AZTH | Thumb Butte | Arizona | 5,500 ft | Desert RAWS |

Use these station IDs when testing queries or exploring RAWS data.

## Troubleshooting

### Server Won't Start

**Check Node.js Version:**
```bash
node --version  # Should be 18.0.0 or higher
```

**Check Environment Variables:**
```bash
cat .env  # Verify API tokens are set
```

**Check for Port Conflicts:**
The MCP server uses stdio transport, so port conflicts shouldn't occur. If issues persist, check the logs.

### No Data Returned

**Invalid Station ID:**
- Verify the station ID is correct (e.g., "C5725" not "RAWS:C5725")
- Use `search_raws_stations` to find valid station IDs near your location

**API Rate Limits:**
- Synoptic free tier: 5,000 requests/day
- Check if you've exceeded your limit
- Wait for limit reset or upgrade to paid tier

**Station Inactive:**
- Some RAWS stations may be temporarily offline
- Try a different nearby station
- Check station status at [raws.dri.edu](https://raws.dri.edu/)

### Cache Issues

The server caches observations for 5-15 minutes to reduce API calls. If you need fresh data:

1. Wait for cache TTL to expire (default: 5 minutes)
2. Or modify `CACHE_TTL_SECONDS` in `.env`
3. Restart the server to clear cache

### Claude Desktop Integration Issues

**Server Not Appearing in Claude:**
1. Verify `claude_desktop_config.json` path is correct
2. Use absolute path to `src/index.js` (not relative)
3. Restart Claude Desktop after config changes
4. Check Claude Desktop logs for errors

**Tools Not Working:**
1. Verify the MCP server is running: `npm start`
2. Check that API tokens are configured in `.env`
3. Test with a known-good station ID like "C5725"

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Run in development mode with auto-reload
npm run dev
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed development guidelines.

## Project Structure

```
raws-mcp/
├── src/
│   ├── index.js           # MCP server entry point
│   ├── tools/             # MCP tool implementations
│   ├── api/               # API client modules
│   ├── schemas/           # Data validation schemas
│   └── utils/             # Helper functions
├── docs/
│   ├── architecture.md    # System architecture
│   ├── implementation_plan.md
│   ├── data_schema.md     # Schema mapping details
│   └── api_endpoints.md   # External API documentation
├── tests/
│   ├── unit/
│   └── integration/
├── .env.example
├── package.json
└── README.md
```

## Integration with fire-behavior

This MCP server is designed to work with the [fire-behavior](https://github.com/EliSchillinger/fire-behavior) application:

1. The fire-behavior backend calls RAWS MCP tools via the MCP protocol
2. RAWS data is formatted to match `wildfire_prompt_template.json`
3. The React frontend renders the weather data alongside wildfire status
4. Location queries automatically find the nearest RAWS station
5. Real-time weather conditions supplement wildfire incident information

See [Fire Behavior Integration Guide](docs/fire_behavior_integration.md) for detailed integration steps.

## Contributing

We welcome contributions! Whether it's bug fixes, new features, documentation improvements, or examples, your help is appreciated.

**Quick Start:**
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Run tests and linter (`npm test && npm run lint`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to your branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines on:
- Code style and conventions
- Testing requirements
- Adding new data sources
- Extending MCP tools
- Documentation standards

## License

Apache 2.0 - See LICENSE file for details

## Documentation

- [Architecture](docs/architecture.md) - System design and components
- [Data Schema](docs/data_schema.md) - Schema mapping and transformations
- [API Endpoints](docs/api_endpoints.md) - External API documentation
- [Implementation Plan](docs/implementation_plan.md) - Development roadmap
- [Fire Behavior Integration](docs/fire_behavior_integration.md) - Integration guide
- [CLAUDE.md](CLAUDE.md) - AI assistant guidance for this project

## Related Projects

- [fire-behavior](https://github.com/EliSchillinger/fire-behavior) - Wildfire information interface
- [Model Context Protocol](https://github.com/anthropics/model-context-protocol) - MCP specification
- [Synoptic Data](https://synopticdata.com/) - RAWS data provider
- [MesoWest](https://mesowest.utah.edu/) - Weather station network
- [WRCC RAWS](https://raws.dri.edu/) - Historical RAWS archive

## Acknowledgments

- **Data Sources**: USDA Forest Service, Bureau of Land Management, National Weather Service
- **Fire Weather Formulas**: National Wildfire Coordinating Group (NWCG)
- **Schema**: Based on fire-behavior application's `wildfire_prompt_template.json`

## Support

For issues or questions:
- Open an issue on [GitHub](https://github.com/tyson-swetnam/raws-mcp/issues)
- Check the [docs/](docs/) directory for detailed documentation
- Review [troubleshooting](#troubleshooting) section above

## Status

This project is currently in the **planning and documentation phase**. The core implementation is being developed. See the [Implementation Plan](docs/implementation_plan.md) for timeline and milestones.
