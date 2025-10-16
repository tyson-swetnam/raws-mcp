# RAWS MCP Server Implementation Plan

> **Current Status:** Planning and Documentation Phase (Phase 0)
> **Last Updated:** October 2025

## Overview

This document outlines the implementation plan for the RAWS (Remote Automatic Weather Station) MCP server. The server will provide real-time and historical weather data from RAWS stations across the United States, formatted for integration with the fire-behavior application.

**Project Status:**
- ✅ Phase 0: Planning and Documentation - **COMPLETE**
- ⏳ Phase 1: Core MCP Server Setup - **IN PROGRESS**
- ⏳ Phase 2-7: Implementation phases pending

## Objectives

1. Create an MCP server that exposes RAWS weather data through standardized tools
2. Format data to conform to the wildfire_prompt_template.json schema
3. Support multiple RAWS data sources (Synoptic, MesoWest, WRCC)
4. Enable location-based station search and data retrieval
5. Calculate fire weather indices from RAWS observations

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Claude / MCP Client                     │
└─────────────────────┬───────────────────────────────────────┘
                      │ MCP Protocol
┌─────────────────────▼───────────────────────────────────────┐
│                    RAWS MCP Server                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Tool Handler │  │ Schema       │  │ Validators   │      │
│  │              │  │ Transformer  │  │              │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         └──────────────────┴──────────────────┘              │
│                           │                                  │
│  ┌────────────────────────▼─────────────────────────┐       │
│  │            API Client Manager                     │       │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐ │       │
│  │  │  Synoptic  │  │  MesoWest  │  │   WRCC     │ │       │
│  │  │   Client   │  │   Client   │  │  Client    │ │       │
│  │  └────────────┘  └────────────┘  └────────────┘ │       │
│  └───────────────────────────────────────────────────┘       │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTPS
┌─────────────────────▼───────────────────────────────────────┐
│              External RAWS Data Sources                      │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────┐      │
│  │ Synoptic   │  │ MesoWest   │  │ WRCC RAWS USA    │      │
│  │ Data API   │  │ API        │  │ Archive          │      │
│  └────────────┘  └────────────┘  └──────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Runtime**: Node.js (v18+)
- **MCP SDK**: @modelcontextprotocol/sdk
- **HTTP Client**: axios or node-fetch
- **Schema Validation**: zod or ajv
- **Testing**: jest
- **Development**: TypeScript (optional) or JavaScript with JSDoc

## Implementation Phases

### Phase 1: Core MCP Server Setup

**Goal**: Create the basic MCP server infrastructure

**Tasks**:
- [ ] Initialize Node.js project with package.json
- [ ] Install MCP SDK and dependencies
- [ ] Create MCP server entry point (src/index.js)
- [ ] Implement server initialization and lifecycle
- [ ] Set up environment variable configuration
- [ ] Create basic error handling framework
- [ ] Add logging infrastructure

**Deliverables**:
- Running MCP server that can be registered with Claude Desktop
- Basic health check/status tool
- Configuration from environment variables

**Files**:
```
src/
├── index.js              # MCP server entry point
├── config.js             # Configuration loader
└── logger.js             # Logging utility
```

### Phase 2: API Client Implementation

**Goal**: Build clients for external RAWS data sources

**Tasks**:
- [ ] Implement Synoptic Data API client
  - [ ] Authentication (token-based)
  - [ ] Station metadata endpoint
  - [ ] Current observations endpoint
  - [ ] Time series data endpoint
  - [ ] Error handling and retries
- [ ] Implement MesoWest API client (similar structure)
- [ ] Implement WRCC scraper/parser (if API unavailable)
- [ ] Create unified API interface for all clients
- [ ] Add response caching (5-minute TTL for current data)
- [ ] Implement rate limiting protection

**Deliverables**:
- API client modules that fetch raw RAWS data
- Unit tests for each client
- Mock data for testing

**Files**:
```
src/api/
├── base-client.js        # Base HTTP client with retries
├── synoptic.js           # Synoptic Data API client
├── mesowest.js           # MesoWest API client
├── wrcc.js               # WRCC client
└── cache.js              # Simple in-memory cache
```

**API Endpoints Used**:

Synoptic Data API:
- `https://api.synopticdata.com/v2/stations/metadata` - Station search
- `https://api.synopticdata.com/v2/stations/latest` - Current observations
- `https://api.synopticdata.com/v2/stations/timeseries` - Historical data

### Phase 3: Schema Transformation

**Goal**: Transform raw RAWS data to wildfire_prompt_template.json format

**Tasks**:
- [ ] Create schema definitions based on wildfire_prompt_template.json
- [ ] Implement transformer for weather_risks section
  - [ ] Map temperature, humidity, wind
  - [ ] Calculate/estimate probability_of_rain
  - [ ] Detect extreme changes (wind gusts, humidity drops)
- [ ] Implement data_sources metadata builder
- [ ] Add unit conversion utilities (F/C, mph/km/h)
- [ ] Validate output against wildfire schema
- [ ] Handle missing/null data gracefully

**Deliverables**:
- Schema transformation modules
- Unit tests with sample RAWS data
- Validation against wildfire_prompt_template schema

**Files**:
```
src/schemas/
├── wildfire-schema.js    # Schema definitions from template
├── raws-schema.js        # Raw RAWS data schema
└── transformer.js        # Transform RAWS → wildfire format

src/utils/
├── units.js              # Unit conversions
├── calculations.js       # Fire weather calculations
└── validators.js         # Schema validators
```

### Phase 4: MCP Tool Implementation

**Goal**: Implement the four core MCP tools

**Tasks**:
- [ ] Implement `get_raws_current` tool
  - [ ] Parameter validation
  - [ ] Fetch from API
  - [ ] Transform to wildfire schema
  - [ ] Return formatted response
- [ ] Implement `search_raws_stations` tool
  - [ ] Geographic search (lat/lon + radius)
  - [ ] Return station metadata list
- [ ] Implement `get_raws_historical` tool
  - [ ] Time range validation
  - [ ] Fetch time series data
  - [ ] Aggregate/summarize as needed
- [ ] Implement `calculate_fire_indices` tool
  - [ ] Haines Index calculation
  - [ ] Fosberg Fire Weather Index
  - [ ] Chandler Burning Index
  - [ ] Include formulas and references

**Deliverables**:
- Four working MCP tools
- Integration tests for each tool
- Error handling for all edge cases

**Files**:
```
src/tools/
├── index.js              # Tool registry
├── get-current.js        # get_raws_current
├── search-stations.js    # search_raws_stations
├── get-historical.js     # get_raws_historical
└── fire-indices.js       # calculate_fire_indices
```

**Tool Specifications**:

#### Tool 1: get_raws_current
```json
{
  "name": "get_raws_current",
  "description": "Get current weather conditions from a RAWS station",
  "inputSchema": {
    "type": "object",
    "properties": {
      "station_id": {
        "type": "string",
        "description": "RAWS station identifier (e.g., 'C5725', 'RAWS:C5725')"
      },
      "format": {
        "type": "string",
        "enum": ["json", "wildfire_schema"],
        "description": "Output format",
        "default": "wildfire_schema"
      }
    },
    "required": ["station_id"]
  }
}
```

#### Tool 2: search_raws_stations
```json
{
  "name": "search_raws_stations",
  "description": "Find RAWS stations near a location",
  "inputSchema": {
    "type": "object",
    "properties": {
      "latitude": {
        "type": "number",
        "description": "Latitude (-90 to 90)"
      },
      "longitude": {
        "type": "number",
        "description": "Longitude (-180 to 180)"
      },
      "radius_miles": {
        "type": "number",
        "description": "Search radius in miles",
        "default": 50
      },
      "limit": {
        "type": "number",
        "description": "Maximum number of results",
        "default": 10
      }
    },
    "required": ["latitude", "longitude"]
  }
}
```

#### Tool 3: get_raws_historical
```json
{
  "name": "get_raws_historical",
  "description": "Retrieve historical weather data from a RAWS station",
  "inputSchema": {
    "type": "object",
    "properties": {
      "station_id": {
        "type": "string",
        "description": "RAWS station identifier"
      },
      "start_time": {
        "type": "string",
        "description": "Start timestamp (ISO 8601)",
        "format": "date-time"
      },
      "end_time": {
        "type": "string",
        "description": "End timestamp (ISO 8601)",
        "format": "date-time"
      },
      "variables": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["temperature", "humidity", "wind", "precipitation", "solar_radiation"]
        },
        "description": "Specific variables to retrieve (default: all)"
      }
    },
    "required": ["station_id", "start_time", "end_time"]
  }
}
```

#### Tool 4: calculate_fire_indices
```json
{
  "name": "calculate_fire_indices",
  "description": "Calculate fire weather indices from RAWS data",
  "inputSchema": {
    "type": "object",
    "properties": {
      "station_id": {
        "type": "string",
        "description": "RAWS station identifier"
      },
      "indices": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["haines", "fosberg", "chandler"]
        },
        "description": "Indices to calculate (default: all)"
      },
      "timestamp": {
        "type": "string",
        "description": "Timestamp for calculation (default: latest)",
        "format": "date-time"
      }
    },
    "required": ["station_id"]
  }
}
```

### Phase 5: Testing and Validation

**Goal**: Comprehensive testing and quality assurance

**Tasks**:
- [ ] Write unit tests for all modules (>80% coverage)
- [ ] Create integration tests with mock APIs
- [ ] Test against real RAWS stations
- [ ] Validate output schemas
- [ ] Performance testing (response times)
- [ ] Error scenario testing
- [ ] Documentation review

**Deliverables**:
- Complete test suite
- Test coverage report
- Performance benchmarks

**Files**:
```
tests/
├── unit/
│   ├── api-clients.test.js
│   ├── transformers.test.js
│   └── tools.test.js
├── integration/
│   └── mcp-tools.test.js
├── fixtures/
│   └── sample-raws-data.json
└── mocks/
    └── api-responses.js
```

### Phase 6: Documentation and Examples

**Goal**: Provide clear documentation for users and developers

**Tasks**:
- [ ] Complete README.md with usage examples
- [ ] Document each MCP tool with examples
- [ ] Create architecture.md with diagrams
- [ ] Write data_schema.md with mapping details
- [ ] Document API endpoints and data sources
- [ ] Add troubleshooting guide
- [ ] Create example integration with fire-behavior

**Deliverables**:
- Complete documentation in docs/
- Example code snippets
- Integration guide

### Phase 7: Integration with fire-behavior

**Goal**: Connect RAWS MCP server to fire-behavior application

**Tasks**:
- [ ] Update fire-behavior backend to call RAWS MCP tools
- [ ] Modify fetch_weather() to use RAWS data
- [ ] Add location → station mapping logic
- [ ] Update frontend to display RAWS data sources
- [ ] Test end-to-end data flow
- [ ] Add fallback mechanisms if RAWS unavailable

**Deliverables**:
- Working integration between fire-behavior and RAWS MCP
- Updated fire-behavior documentation

**Integration Points**:

In fire-behavior `server/` (Python backend):
```python
# Example pseudo-code
async def fetch_weather(location):
    # 1. Get coordinates from location
    coords = geocode(location)

    # 2. Call RAWS MCP to find nearest station
    stations = await mcp_call("search_raws_stations", {
        "latitude": coords.lat,
        "longitude": coords.lon,
        "radius_miles": 50,
        "limit": 1
    })

    # 3. Get current weather from that station
    weather = await mcp_call("get_raws_current", {
        "station_id": stations[0].id,
        "format": "wildfire_schema"
    })

    return weather
```

## Data Sources

### Synoptic Data API

**Endpoints**:
- Metadata: `https://api.synopticdata.com/v2/stations/metadata`
- Latest: `https://api.synopticdata.com/v2/stations/latest`
- Time series: `https://api.synopticdata.com/v2/stations/timeseries`

**Authentication**: Token-based (free tier: 5000 requests/day)

**RAWS Network Identifier**: `network=1` or `network=2` (depending on agency)

**Example Request**:
```
https://api.synopticdata.com/v2/stations/latest?
  token=YOUR_TOKEN
  &stid=C5725
  &vars=air_temp,relative_humidity,wind_speed,wind_direction
  &units=english
```

### MesoWest API

Similar to Synoptic (MesoWest is the parent organization)

**Base URL**: `https://api.mesowest.net/v2/`

### Western Regional Climate Center (WRCC)

**RAWS USA**: https://raws.dri.edu/

- Web interface with historical archives
- May require web scraping if no API
- Alternative: Use FTP access to raw data files

## Risk Assessment and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| API rate limits | High | Implement caching, use multiple sources |
| API downtime | High | Fallback to alternate data sources |
| Invalid station IDs | Medium | Validate station IDs, provide search tool |
| Missing data | Medium | Handle nulls gracefully, provide defaults |
| Schema changes | Low | Version schema, add validators |

## Timeline

- **Phase 1**: 2-3 days
- **Phase 2**: 3-4 days
- **Phase 3**: 2-3 days
- **Phase 4**: 3-4 days
- **Phase 5**: 2-3 days
- **Phase 6**: 1-2 days
- **Phase 7**: 2-3 days

**Total**: ~15-20 days (assuming full-time development)

## Success Criteria

1. MCP server successfully registers with Claude Desktop
2. All four tools return valid, schema-compliant data
3. Successfully retrieves data from at least one RAWS source
4. Test coverage > 80%
5. Documentation complete and clear
6. fire-behavior successfully integrates RAWS data

## Next Steps

1. Review and approve implementation plan
2. Set up development environment
3. Begin Phase 1 implementation
4. Obtain API credentials for Synoptic/MesoWest
5. Identify test RAWS stations for development

## References

- [MCP SDK Documentation](https://github.com/anthropics/model-context-protocol)
- [Synoptic Data API Docs](https://synopticdata.com/mesonet-api)
- [MesoWest](https://mesowest.utah.edu/)
- [WRCC RAWS](https://raws.dri.edu/)
- [fire-behavior repository](https://github.com/EliSchillinger/fire-behavior)
- [wildfire_prompt_template.json](../fire-behavior/prompts/wildfire_prompt_template.json)
