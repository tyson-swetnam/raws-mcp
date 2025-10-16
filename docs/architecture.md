# RAWS MCP Server Architecture

> **Status:** This document describes the planned architecture for the RAWS MCP Server. Implementation is in progress.

## System Overview

The RAWS MCP Server is a Model Context Protocol (MCP) server that provides access to Remote Automatic Weather Station (RAWS) data for wildfire management and weather monitoring applications. It acts as a bridge between Claude/LLM applications and multiple RAWS data sources, transforming raw weather observations into a standardized format compatible with the fire-behavior application's wildfire information schema.

## High-Level Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                        Claude / LLM Application                        │
│                     (e.g., Claude Desktop, fire-behavior)              │
└────────────────────────────────┬──────────────────────────────────────┘
                                 │
                                 │ MCP Protocol (stdio/HTTP)
                                 │
┌────────────────────────────────▼──────────────────────────────────────┐
│                          RAWS MCP Server                               │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                     MCP Layer                                 │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐             │    │
│  │  │ Server     │  │ Tool       │  │ Error      │             │    │
│  │  │ Lifecycle  │  │ Registry   │  │ Handler    │             │    │
│  │  └────────────┘  └────────────┘  └────────────┘             │    │
│  └──────────────────────┬────────────────────────────────────────┘    │
│                         │                                             │
│  ┌──────────────────────▼────────────────────────────────────────┐    │
│  │                   Business Logic Layer                        │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐             │    │
│  │  │ Tool       │  │ Schema     │  │ Fire       │             │    │
│  │  │ Handlers   │  │ Transform  │  │ Indices    │             │    │
│  │  └────────────┘  └────────────┘  └────────────┘             │    │
│  └──────────────────────┬────────────────────────────────────────┘    │
│                         │                                             │
│  ┌──────────────────────▼────────────────────────────────────────┐    │
│  │                   Data Access Layer                           │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐             │    │
│  │  │ Cache      │  │ API Client │  │ Validators │             │    │
│  │  │ Manager    │  │ Manager    │  │            │             │    │
│  │  └────────────┘  └──────┬─────┘  └────────────┘             │    │
│  └─────────────────────────┼────────────────────────────────────┘    │
│                            │                                          │
│  ┌─────────────────────────▼──────────────────────────────────────┐  │
│  │                  External API Clients                          │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌─────────┐ │  │
│  │  │ Synoptic   │  │ MesoWest   │  │ WRCC       │  │ NWS     │ │  │
│  │  │ Client     │  │ Client     │  │ Client     │  │ Client  │ │  │
│  │  └────────────┘  └────────────┘  └────────────┘  └─────────┘ │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬──────────────────────────────────────┘
                                 │
                                 │ HTTPS
                                 │
┌────────────────────────────────▼──────────────────────────────────────┐
│                       External Data Sources                            │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
│  │ Synoptic   │  │ MesoWest   │  │ WRCC       │  │ NWS        │     │
│  │ Data API   │  │ API        │  │ RAWS USA   │  │ API        │     │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘     │
└───────────────────────────────────────────────────────────────────────┘
```

## Layer Descriptions

### 1. MCP Layer

**Responsibilities**:
- Implement MCP protocol (stdio transport)
- Handle server lifecycle (initialization, shutdown)
- Register and expose MCP tools
- Marshal/unmarshal requests and responses
- Global error handling

**Components**:
- `Server Lifecycle`: Initialize SDK, start/stop server
- `Tool Registry`: Register available tools with schemas
- `Error Handler`: Convert exceptions to MCP error responses

**Key Files**:
- `src/index.js`: Main entry point, server initialization
- `src/tools/index.js`: Tool registration

### 2. Business Logic Layer

**Responsibilities**:
- Implement tool logic (get current, search, historical, indices)
- Transform data between RAWS and wildfire schemas
- Calculate fire weather indices
- Validate inputs and outputs
- Handle business-level errors

**Components**:
- `Tool Handlers`: Implement each of the 4 MCP tools
- `Schema Transform`: Map RAWS data to wildfire_prompt_template.json format
- `Fire Indices`: Calculate Haines, Fosberg, Chandler indices

**Key Files**:
- `src/tools/get-current.js`
- `src/tools/search-stations.js`
- `src/tools/get-historical.js`
- `src/tools/fire-indices.js`
- `src/schemas/transformer.js`
- `src/utils/calculations.js`

### 3. Data Access Layer

**Responsibilities**:
- Fetch data from external APIs
- Cache responses to reduce API calls
- Implement retry logic and circuit breakers
- Validate raw API responses
- Abstract differences between data sources

**Components**:
- `Cache Manager`: In-memory caching with TTL
- `API Client Manager`: Coordinate multiple clients, failover
- `Validators`: Validate raw API responses

**Key Files**:
- `src/api/base-client.js`: Base HTTP client with retries
- `src/api/cache.js`: Cache implementation
- `src/api/client-manager.js`: Multi-source coordinator

### 4. External API Clients

**Responsibilities**:
- Implement HTTP clients for each data source
- Handle authentication (API tokens)
- Format requests per API specifications
- Parse responses into common format
- Handle API-specific errors

**Components**:
- `Synoptic Client`: Primary RAWS data source
- `MesoWest Client`: Backup RAWS data source
- `WRCC Client`: Historical data access
- `NWS Client`: Alerts and forecasts

**Key Files**:
- `src/api/synoptic.js`
- `src/api/mesowest.js`
- `src/api/wrcc.js`
- `src/api/nws.js`

## Data Flow

### Example: get_raws_current Tool

```
┌─────────────┐
│ Claude asks │ "What are current conditions at station C5725?"
│ for current │
│ RAWS data   │
└──────┬──────┘
       │
       │ MCP Request
       ▼
┌──────────────────────┐
│ MCP Layer            │
│ - Parse request      │
│ - Validate stationId │
│ - Route to handler   │
└──────┬───────────────┘
       │
       │ Tool invocation
       ▼
┌────────────────────────────┐
│ Business Logic Layer       │
│ - Get station data         │
│ - Transform to schema      │
│ - Validate output          │
└──────┬─────────────────────┘
       │
       │ Data request
       ▼
┌────────────────────────────┐
│ Data Access Layer          │
│ - Check cache              │  ← Cache hit? Return cached data
│ - If miss, fetch from API  │
│ - Store in cache           │
└──────┬─────────────────────┘
       │
       │ API call (if cache miss)
       ▼
┌────────────────────────────┐
│ Synoptic Client            │
│ - Build request URL        │
│ - Add auth token           │
│ - Execute HTTP GET         │
│ - Parse JSON response      │
└──────┬─────────────────────┘
       │
       │ HTTPS GET
       ▼
┌────────────────────────────┐
│ Synoptic Data API          │
│ - Process request          │
│ - Query database           │
│ - Return observations      │
└──────┬─────────────────────┘
       │
       │ Response bubbles back up
       ▼
┌──────────────────────┐
│ MCP Layer            │
│ - Format response    │
│ - Return to Claude   │
└──────┬───────────────┘
       │
       │ MCP Response
       ▼
┌─────────────────────┐
│ Claude receives     │
│ formatted weather   │
│ data                │
└─────────────────────┘
```

## Component Details

### MCP Server Initialization

```javascript
// src/index.js
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools/index.js';
import config from './config.js';
import logger from './logger.js';

const server = new Server({
  name: 'raws-mcp-server',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

// Register all tools
registerTools(server);

// Error handling
server.onerror = (error) => {
  logger.error('Server error:', error);
};

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('RAWS MCP Server started');
}

main();
```

### Tool Registration

```javascript
// src/tools/index.js
import { getCurrentHandler } from './get-current.js';
import { searchStationsHandler } from './search-stations.js';
import { getHistoricalHandler } from './get-historical.js';
import { fireIndicesHandler } from './fire-indices.js';

export function registerTools(server) {
  // Register get_raws_current
  server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'get_raws_current':
        return await getCurrentHandler(args);
      case 'search_raws_stations':
        return await searchStationsHandler(args);
      case 'get_raws_historical':
        return await getHistoricalHandler(args);
      case 'calculate_fire_indices':
        return await fireIndicesHandler(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  // List available tools
  server.setRequestHandler('tools/list', () => {
    return {
      tools: [
        {
          name: 'get_raws_current',
          description: 'Get current weather conditions from a RAWS station',
          inputSchema: { /* ... */ }
        },
        // ... other tools
      ]
    };
  });
}
```

### API Client with Caching

```javascript
// src/api/synoptic.js
import axios from 'axios';
import { getCache, setCache } from './cache.js';
import logger from '../logger.js';

export class SynopticClient {
  constructor(apiToken) {
    this.apiToken = apiToken;
    this.baseUrl = 'https://api.synopticdata.com/v2';
  }

  async getLatestObservations(stationId) {
    const cacheKey = `synoptic:latest:${stationId}`;

    // Check cache
    const cached = getCache(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for ${cacheKey}`);
      return cached;
    }

    // Fetch from API
    logger.debug(`Fetching from Synoptic API: ${stationId}`);
    const url = `${this.baseUrl}/stations/latest`;
    const params = {
      token: this.apiToken,
      stid: stationId,
      vars: 'air_temp,relative_humidity,wind_speed,wind_gust,wind_direction',
      units: 'english',
      within: 60
    };

    const response = await axios.get(url, { params, timeout: 10000 });

    if (response.data.ERROR) {
      throw new Error(response.data.ERROR);
    }

    // Cache for 5 minutes
    setCache(cacheKey, response.data, 5 * 60);

    return response.data;
  }
}
```

### Schema Transformation

```javascript
// src/schemas/transformer.js
import { degreesToCardinal } from '../utils/units.js';
import { estimateRainProbability, detectRedFlagConditions } from '../utils/weather.js';

export function transformToWildfireSchema(rawsData, stationInfo) {
  const obs = rawsData.STATION[0].OBSERVATIONS;

  return {
    location: `${stationInfo.name}, ${stationInfo.state}`,
    as_of: obs.date_time[0],
    weather_risks: {
      temperature: {
        value: Math.round(obs.air_temp_value_1.value[0]),
        units: 'F'
      },
      humidity: {
        percent: Math.round(obs.relative_humidity_value_1.value[0])
      },
      wind: {
        speed: Math.round(obs.wind_speed_value_1.value[0]),
        gusts: Math.round(obs.wind_gust_value_1?.value[0] || obs.wind_speed_value_1.value[0] * 1.5),
        direction: degreesToCardinal(obs.wind_direction_value_1.value[0])
      },
      probability_of_rain: estimateRainProbability(obs),
      red_flag_warnings: detectRedFlagConditions(obs),
      extreme_changes: [] // Requires historical data
    },
    data_sources: [
      {
        name: `${stationInfo.name} RAWS (${stationInfo.id})`,
        type: 'weather',
        url: `https://raws.dri.edu/${stationInfo.id}`
      }
    ],
    notes: 'Real-time observations from RAWS station. Precipitation probability estimated from current conditions.'
  };
}
```

## Design Patterns

### 1. Factory Pattern (API Clients)

Multiple data sources with similar interfaces:

```javascript
// src/api/client-factory.js
export function createApiClient(source, config) {
  switch (source) {
    case 'synoptic':
      return new SynopticClient(config.synopticToken);
    case 'mesowest':
      return new MesoWestClient(config.mesowestToken);
    case 'wrcc':
      return new WRCCClient();
    default:
      throw new Error(`Unknown source: ${source}`);
  }
}
```

### 2. Strategy Pattern (Data Sources)

Use primary source, fall back to secondary:

```javascript
// src/api/client-manager.js
export class ClientManager {
  constructor(config) {
    this.clients = [
      createApiClient('synoptic', config),
      createApiClient('mesowest', config)
    ];
  }

  async getLatestObservations(stationId) {
    for (const client of this.clients) {
      try {
        return await client.getLatestObservations(stationId);
      } catch (error) {
        logger.warn(`Client failed, trying next: ${error.message}`);
      }
    }
    throw new Error('All data sources failed');
  }
}
```

### 3. Adapter Pattern (Schema Transformation)

Adapt different API responses to common format:

```javascript
// src/schemas/adapters.js
export class SynopticAdapter {
  adapt(response) {
    return {
      stationId: response.STATION[0].STID,
      temperature: response.STATION[0].OBSERVATIONS.air_temp_value_1.value[0],
      humidity: response.STATION[0].OBSERVATIONS.relative_humidity_value_1.value[0],
      // ...
    };
  }
}
```

## Configuration

### Environment Variables

```bash
# Data source API tokens
SYNOPTIC_API_TOKEN=your_token_here
MESOWEST_API_TOKEN=your_token_here

# Server configuration
LOG_LEVEL=info
CACHE_TTL_SECONDS=300

# Feature flags
ENABLE_NWS_INTEGRATION=true
ENABLE_FIRE_INDICES=true
```

### Loading Configuration

```javascript
// src/config.js
import dotenv from 'dotenv';

dotenv.config();

export default {
  synopticToken: process.env.SYNOPTIC_API_TOKEN,
  mesowestToken: process.env.MESOWEST_API_TOKEN,
  logLevel: process.env.LOG_LEVEL || 'info',
  cacheTTL: parseInt(process.env.CACHE_TTL_SECONDS) || 300,
  features: {
    nwsIntegration: process.env.ENABLE_NWS_INTEGRATION === 'true',
    fireIndices: process.env.ENABLE_FIRE_INDICES === 'true'
  }
};
```

## Error Handling

### Error Types

1. **User Errors**: Invalid station ID, bad parameters
2. **API Errors**: Rate limits, network failures, invalid responses
3. **System Errors**: Configuration issues, internal bugs

### Error Response Format

```javascript
// MCP error response
{
  error: {
    code: 'INVALID_STATION',
    message: 'Station C9999 not found',
    details: {
      stationId: 'C9999',
      availableStations: ['C5725', 'C5726']
    }
  }
}
```

### Retry Strategy

```javascript
async function fetchWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      if (error.response?.status === 429) {
        // Rate limited, exponential backoff
        await sleep(Math.pow(2, i) * 1000);
      } else if (error.code === 'ECONNABORTED') {
        // Timeout, retry
        await sleep(1000);
      } else {
        // Other error, don't retry
        throw error;
      }
    }
  }
}
```

## Logging

### Log Levels

- **ERROR**: Critical failures, unrecoverable errors
- **WARN**: Recoverable issues, fallbacks triggered
- **INFO**: Normal operations, tool invocations
- **DEBUG**: Detailed debugging information

### Log Format

```javascript
// src/logger.js
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

export default logger;
```

## Testing Strategy

### Unit Tests

Test individual components in isolation:
- API client methods
- Schema transformations
- Utility functions
- Fire index calculations

### Integration Tests

Test interactions between components:
- Tool handlers with mock API responses
- Cache behavior
- Fallback mechanisms

### End-to-End Tests

Test complete flows (may hit real APIs):
- Fetch current data from test station
- Search for stations near coordinates
- Calculate fire indices

## Performance Considerations

### Caching

- **Current observations**: 5-minute TTL
- **Station metadata**: 1-hour TTL (rarely changes)
- **Historical data**: 24-hour TTL (archival)

### Concurrency

- Handle multiple tool requests concurrently
- Use connection pooling for HTTP clients
- Implement request queue if needed

### Optimization

1. Batch station searches when possible
2. Request only needed variables from API
3. Use compression for large responses
4. Implement circuit breaker for failing sources

## Security

### API Key Management

- Store tokens in environment variables
- Never log tokens
- Rotate tokens periodically

### Input Validation

- Validate all user inputs
- Sanitize station IDs (alphanumeric only)
- Limit time ranges for historical queries

### Rate Limiting

- Track API usage internally
- Implement local rate limiting
- Provide backpressure to clients if needed

## Deployment

### Development

```bash
npm install
cp .env.example .env
# Edit .env with API tokens
node src/index.js
```

### Production

```bash
# Install dependencies
npm ci --production

# Run with PM2 or systemd
pm2 start src/index.js --name raws-mcp

# Monitor logs
pm2 logs raws-mcp
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY src ./src
CMD ["node", "src/index.js"]
```

## Monitoring

### Metrics to Track

- Request count per tool
- API call count per source
- Cache hit rate
- Error rate
- Response time (p50, p95, p99)

### Health Check

```javascript
// src/tools/health.js
export async function healthCheck() {
  return {
    status: 'healthy',
    version: '1.0.0',
    uptime: process.uptime(),
    sources: {
      synoptic: await testSynoptic(),
      mesowest: await testMesoWest()
    }
  };
}
```

## Future Enhancements

1. **WebSocket Support**: Real-time updates
2. **GraphQL API**: More flexible queries
3. **ML Integration**: Predictive fire indices
4. **Multi-Region Deployment**: Reduce latency
5. **Data Visualization**: Built-in charting
6. **Alert System**: Proactive notifications

## References

- [MCP Specification](https://github.com/anthropics/model-context-protocol)
- [MCP SDK Documentation](https://github.com/anthropics/model-context-protocol/tree/main/src/sdk)
- [wildfire_prompt_template.json](https://github.com/EliSchillinger/fire-behavior/blob/main/prompts/wildfire_prompt_template.json)
- [Synoptic Data API](https://synopticdata.com/mesonet-api)
