# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RAWS MCP Server is a Model Context Protocol (MCP) server that provides access to Remote Automatic Weather Station (RAWS) data for wildfire management applications. It bridges Claude/LLM applications with multiple RAWS data sources, transforming raw weather observations into a standardized format compatible with the fire-behavior application's wildfire information schema.

## Commands

### Development
```bash
npm start                    # Start the MCP server
npm run dev                  # Start with auto-reload (--watch)
```

### Testing
```bash
npm test                     # Run all tests with experimental VM modules
npm run test:unit            # Run unit tests only
npm run test:integration     # Run integration tests only
npm run test:coverage        # Run tests with coverage report
```

### Code Quality
```bash
npm run lint                 # Check code style
npm run lint:fix             # Fix linting issues automatically
```

## Architecture

### High-Level Structure

The server follows a layered architecture:

1. **MCP Layer** (`src/index.js`, `src/tools/index.js`)
   - Implements MCP protocol via stdio transport
   - Handles server lifecycle and tool registration
   - Provides global error handling

2. **Business Logic Layer** (`src/tools/`, `src/schemas/`, `src/utils/`)
   - Implements tool handlers for 4 core MCP tools
   - Transforms RAWS data to wildfire_prompt_template.json format
   - Calculates fire weather indices (Haines, Fosberg, Chandler)

3. **Data Access Layer** (`src/api/cache.js`, `src/api/client-manager.js`)
   - Manages caching with TTL (5-15 min for current observations)
   - Coordinates multiple data sources with failover
   - Implements retry logic and circuit breakers

4. **External API Clients** (`src/api/synoptic.js`, `src/api/mesowest.js`, `src/api/wrcc.js`, `src/api/nws.js`)
   - Synoptic Data API (primary RAWS source)
   - MesoWest API (backup/failover)
   - WRCC RAWS USA (historical archives)
   - NWS API (alerts and forecasts)

### Core MCP Tools

**1. get_raws_current** - Get current weather conditions from a RAWS station
- Returns data in wildfire_prompt_template.json format
- Includes temperature, humidity, wind, derived fire weather conditions

**2. search_raws_stations** - Find RAWS stations near a location
- Search by lat/lon with configurable radius
- Returns station metadata (ID, name, location, elevation)

**3. get_raws_historical** - Retrieve historical weather data
- Time-series data for trend analysis
- Supports filtering by specific variables

**4. calculate_fire_indices** - Calculate fire weather indices
- Haines Index (atmospheric stability and dryness)
- Fosberg Fire Weather Index (temp, humidity, wind combined)
- Chandler Burning Index (includes fuel moisture)

### Data Flow Pattern

```
MCP Request → Tool Handler → API Client Manager → External API (with cache check)
                ↓
      Schema Transformation → Validation → MCP Response
```

- Always check cache before API calls (5-15 min TTL for observations)
- Use Strategy Pattern for data source failover (Synoptic → MesoWest → WRCC)
- Transform all responses to wildfire_prompt_template.json schema

## Key Design Patterns

### Factory Pattern (API Clients)
Multiple data sources with similar interfaces are created through `createApiClient()` factory in `src/api/client-factory.js`.

### Strategy Pattern (Data Source Failover)
`ClientManager` tries sources in order: Synoptic → MesoWest → WRCC, falling back on failures.

### Adapter Pattern (Schema Transformation)
Raw API responses are adapted to common format via adapters in `src/schemas/adapters.js` before final transformation to wildfire schema.

## Critical Implementation Details

### Schema Transformation (wildfire_prompt_template.json)

The most complex part of this project is transforming RAWS data to match the wildfire_prompt_template.json schema:

**Direct Mappings:**
- temperature: `air_temp_value_1` → `weather_risks.temperature.value` (rounded)
- humidity: `relative_humidity_value_1` → `weather_risks.humidity.percent`
- wind: `wind_speed_value_1`, `wind_gust_value_1`, `wind_direction_value_1` → `weather_risks.wind.*`

**Calculated/Derived Fields:**
- `probability_of_rain`: Estimated from current humidity/recent precip (RAWS doesn't provide forecasts) OR integrated with NWS forecast API
- `red_flag_warnings`: Either from NWS API alerts OR threshold detection (RH < 15% AND wind > 25 mph = Red Flag)
- `extreme_changes`: Requires historical data analysis (wind increases > 15 mph in 3h, humidity drops > 20% in 6h)

**Wind Direction Conversion:**
Convert degrees to 16-point cardinal directions (N, NNE, NE, ENE, etc.) via `degreesToCardinal()` utility.

**Missing Data Handling:**
- Wind gusts: Estimate as 1.5x wind speed if unavailable
- Direction: Return "Unknown" if missing
- Critical fields (temp, humidity, wind speed): Return error if missing

### Caching Strategy

Different TTLs based on data volatility:
- Current observations: 5 minutes (RAWS updates every 15-60 min)
- Station metadata: 1 hour (rarely changes)
- Historical data: 24 hours (archival, doesn't change)
- NWS alerts: 5 minutes (time-sensitive)

Implement in `src/api/cache.js` using in-memory Map with timestamp tracking (or Redis for production).

### Fire Weather Calculations

**Fosberg Fire Weather Index:**
```javascript
FFWI = η × √(1 + U²)
where:
  η = moisture damping coefficient (function of RH)
  U = wind speed
```

**Critical Fire Weather Thresholds:**
- RH < 15% + winds > 25 mph = Red Flag conditions
- 10-hour fuel moisture < 10% = critically dry fuels
- Haines Index 5-6 = high potential for extreme fire behavior

Implement formulas in `src/utils/calculations.js` with proper validation and references to authoritative sources.

### Error Handling

Three error types:
1. **User Errors**: Invalid station ID, bad parameters (validate early)
2. **API Errors**: Rate limits (429 → exponential backoff), network failures (retry), invalid responses
3. **System Errors**: Configuration issues, internal bugs

Return standardized error format:
```javascript
{
  error: {
    code: 'INVALID_STATION',
    message: 'Station C9999 not found',
    details: { stationId: 'C9999', availableStations: [...] }
  }
}
```

### API Integration Specifics

**Synoptic Data API:**
- Base URL: `https://api.synopticdata.com/v2/`
- Auth: Token as query parameter
- RAWS networks: `network=1` or `network=2`
- Rate limit: 5,000 requests/day (free tier)
- Variables use `_value_1` suffix for latest, `_set_1` for time series

**Station ID Format:**
- Synoptic: "C5725" (with or without "RAWS:" prefix)
- Normalize by stripping prefix if present

**NWS API Integration:**
- Two-step forecast: `/points/{lat},{lon}` → get forecast URL → call forecast URL
- Alerts: `/alerts/active?point={lat},{lon}` for fire weather warnings
- No auth required, but implement backoff for rate limiting

## File Organization Philosophy

```
src/
├── index.js              # MCP server initialization, tool registration
├── config.js             # Environment variable loader (dotenv)
├── logger.js             # Winston logger setup
├── tools/
│   ├── index.js          # Tool registration and routing
│   ├── get-current.js    # Individual tool implementations
│   ├── search-stations.js
│   ├── get-historical.js
│   └── fire-indices.js
├── api/
│   ├── base-client.js    # Base HTTP client with retries, timeouts
│   ├── client-factory.js # Factory for creating API clients
│   ├── client-manager.js # Coordinates multiple sources, failover
│   ├── cache.js          # In-memory cache with TTL
│   ├── synoptic.js       # Synoptic-specific client
│   ├── mesowest.js       # MesoWest-specific client
│   ├── wrcc.js           # WRCC client
│   └── nws.js            # NWS API client
├── schemas/
│   ├── wildfire-schema.js   # Zod schema for wildfire_prompt_template
│   ├── raws-schema.js       # Zod schema for RAWS API responses
│   ├── transformer.js       # RAWS → wildfire transformation
│   └── adapters.js          # Source-specific adapters
└── utils/
    ├── units.js             # Unit conversions (F/C, mph/kmh, deg→cardinal)
    ├── calculations.js      # Fire weather index calculations
    ├── weather.js           # Weather utilities (rain estimation, etc.)
    └── validators.js        # Input validation helpers
```

## Integration with fire-behavior

The raws-mcp server is designed to integrate with the fire-behavior application:

1. fire-behavior backend calls RAWS MCP tools via MCP protocol
2. Location → coordinates → `search_raws_stations` → nearest station
3. Station ID → `get_raws_current` → weather data in wildfire schema
4. React frontend renders weather data alongside wildfire status

Output must conform exactly to wildfire_prompt_template.json structure for seamless integration.

## Configuration

Environment variables (`.env`):
```bash
# Required: Data source API tokens
SYNOPTIC_API_TOKEN=your_token_here
MESOWEST_API_TOKEN=your_token_here

# Optional: Server configuration
LOG_LEVEL=info                    # error, warn, info, debug
CACHE_TTL_SECONDS=300            # Default cache TTL

# Optional: Feature flags
ENABLE_NWS_INTEGRATION=true      # Use NWS for alerts/forecasts
ENABLE_FIRE_INDICES=true         # Calculate fire indices
```

## Testing Strategy

**Unit Tests** (`tests/unit/`):
- Test individual functions in isolation
- Mock all external API calls
- Focus on: transformations, calculations, utilities

**Integration Tests** (`tests/integration/`):
- Test tool handlers with mock API responses
- Verify cache behavior
- Test failover mechanisms

**Fixtures** (`tests/fixtures/`):
- Sample RAWS API responses for consistent testing
- Include edge cases: missing data, inactive stations

**Test Stations:**
- C5725 (Monument Creek, CO) - reliable, active
- CLKC1 (Clark Summit, CA) - fire-prone area
- Use `limit: 1` in requests when testing against real APIs

## Important Conventions

### Response Format
All tool handlers return standardized format:
```javascript
// Success
{ success: true, data: {...}, metadata: {...} }

// Error
{ success: false, error: { code, message, status, details } }
```

### Zod Validation
- Define input schemas with Zod for all tools
- Validate early, fail fast
- Provide clear error messages for validation failures

### Async/Await
- Use async/await throughout (no raw promises or callbacks)
- Always wrap in try/catch blocks
- Never leave promises unhandled

### Logging
Use Winston logger with structured logs:
```javascript
logger.debug('Cache hit', { key: cacheKey });
logger.info('Fetching from API', { source: 'synoptic', station: stationId });
logger.warn('API fallback triggered', { reason: error.message });
logger.error('Tool handler failed', { tool: 'get_raws_current', error });
```

### Fire Weather Domain Knowledge

When working with fire weather data:
- RH (relative humidity) < 15% is critical threshold
- 10-hour fuel moisture < 10% indicates very dry fuels
- Wind speeds > 20-25 mph significantly increase fire spread
- Haines Index ranges 2-6 (low to high atmospheric instability)
- Always include data_sources in output for transparency

## Known Limitations

1. **RAWS doesn't provide forecasts**: Must estimate `probability_of_rain` or integrate NWS API
2. **Fuel moisture data**: Not available at all stations
3. **Update frequency**: RAWS stations typically update every 15-60 minutes
4. **Haines Index calculation**: Requires upper-air data; may need NWS sounding integration
5. **Rate limits**: Synoptic free tier limited to 5,000 requests/day

## References

- [MCP SDK](https://github.com/anthropics/model-context-protocol)
- [Synoptic Data API](https://synopticdata.com/mesonet-api)
- [wildfire_prompt_template.json](https://github.com/EliSchillinger/fire-behavior/blob/main/prompts/wildfire_prompt_template.json)
- [NFDRS - National Fire Danger Rating System](https://www.nwcg.gov/publications/pms437)
- [Fosberg Fire Weather Index](https://www.fs.usda.gov/research/treesearch/4442)
