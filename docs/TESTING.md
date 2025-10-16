# Testing Guide

> **Purpose:** Comprehensive testing strategy and guidelines for the RAWS MCP server.

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Structure](#test-structure)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [Test Fixtures and Mocks](#test-fixtures-and-mocks)
6. [Testing with Live APIs](#testing-with-live-apis)
7. [Coverage Requirements](#coverage-requirements)
8. [Running Tests](#running-tests)
9. [Writing New Tests](#writing-new-tests)
10. [Continuous Integration](#continuous-integration)

## Testing Philosophy

### Goals

1. **Reliability**: Ensure RAWS data is accurately transformed and returned
2. **Robustness**: Handle API failures, missing data, and edge cases gracefully
3. **Performance**: Validate response times and caching effectiveness
4. **Maintainability**: Keep tests simple, focused, and easy to understand

### Testing Pyramid

```
         /\
        /  \       E2E Tests (Few)
       /____\      - Test complete workflows
      /      \     - May use live APIs
     /  Inte  \    - Slower, more brittle
    /  gration \
   /____________\  Integration Tests (Some)
  /              \ - Test component interactions
 /  Unit Tests   \ - Mock external dependencies
/__________________\ - Test business logic

Unit Tests (Many)
- Fast, isolated
- Test individual functions
- Mock all dependencies
```

### Test Types

**Unit Tests** (`tests/unit/`):
- Test individual functions in isolation
- Mock all external dependencies (APIs, file system, network)
- Fast execution (< 1 second total)
- High coverage target (> 90%)

**Integration Tests** (`tests/integration/`):
- Test interactions between modules
- Mock external APIs but test real internal interactions
- Moderate execution time (< 10 seconds total)
- Coverage target (> 70%)

**End-to-End Tests** (`tests/e2e/`):
- Test complete workflows with real or staging APIs
- Optional (not required for CI)
- Use carefully to avoid rate limits
- Manual execution recommended

## Test Structure

### Directory Organization

```
tests/
├── unit/
│   ├── api/
│   │   ├── synoptic.test.js
│   │   ├── mesowest.test.js
│   │   ├── cache.test.js
│   │   └── client-manager.test.js
│   ├── schemas/
│   │   ├── transformer.test.js
│   │   └── validators.test.js
│   ├── tools/
│   │   ├── get-current.test.js
│   │   ├── search-stations.test.js
│   │   ├── get-historical.test.js
│   │   └── fire-indices.test.js
│   └── utils/
│       ├── units.test.js
│       ├── calculations.test.js
│       └── weather.test.js
├── integration/
│   ├── mcp-server.test.js
│   ├── tool-handlers.test.js
│   └── data-flow.test.js
├── fixtures/
│   ├── synoptic-responses.json
│   ├── mesowest-responses.json
│   └── sample-stations.json
├── mocks/
│   ├── api-clients.js
│   └── mcp-server.js
└── e2e/
    └── live-api.test.js
```

### Test File Naming

- Test files: `*.test.js`
- Fixtures: `*.json` or `*-fixture.js`
- Mocks: `*-mock.js` or `mock-*.js`

## Unit Testing

### Example: Testing Unit Conversions

```javascript
// tests/unit/utils/units.test.js
import { degreesToCardinal, fahrenheitToCelsius, mphToKmh } from '../../../src/utils/units.js';

describe('units.js', () => {
  describe('degreesToCardinal', () => {
    it('should convert 0 degrees to N', () => {
      expect(degreesToCardinal(0)).toBe('N');
    });

    it('should convert 90 degrees to E', () => {
      expect(degreesToCardinal(90)).toBe('E');
    });

    it('should convert 180 degrees to S', () => {
      expect(degreesToCardinal(180)).toBe('S');
    });

    it('should convert 270 degrees to W', () => {
      expect(degreesToCardinal(270)).toBe('W');
    });

    it('should handle 45 degrees as NE', () => {
      expect(degreesToCardinal(45)).toBe('NE');
    });

    it('should handle 360 degrees as N', () => {
      expect(degreesToCardinal(360)).toBe('N');
    });

    it('should round to nearest cardinal direction', () => {
      expect(degreesToCardinal(355)).toBe('N');
      expect(degreesToCardinal(5)).toBe('N');
    });
  });

  describe('fahrenheitToCelsius', () => {
    it('should convert 32°F to 0°C', () => {
      expect(fahrenheitToCelsius(32)).toBe(0);
    });

    it('should convert 212°F to 100°C', () => {
      expect(fahrenheitToCelsius(212)).toBe(100);
    });

    it('should convert 98.6°F to 37°C', () => {
      expect(fahrenheitToCelsius(98.6)).toBeCloseTo(37, 1);
    });
  });

  describe('mphToKmh', () => {
    it('should convert 10 mph to ~16 km/h', () => {
      expect(mphToKmh(10)).toBeCloseTo(16.0934, 2);
    });

    it('should handle 0 mph', () => {
      expect(mphToKmh(0)).toBe(0);
    });
  });
});
```

### Example: Testing Fire Weather Calculations

```javascript
// tests/unit/utils/calculations.test.js
import { calculateFosberg, calculateChandler, detectRedFlagConditions } from '../../../src/utils/calculations.js';

describe('calculations.js', () => {
  describe('calculateFosberg', () => {
    it('should calculate Fosberg index for moderate conditions', () => {
      const result = calculateFosberg(75, 30, 10);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(100);
    });

    it('should return high index for critical fire weather', () => {
      const result = calculateFosberg(95, 10, 30);
      expect(result).toBeGreaterThan(50);
    });

    it('should handle low wind conditions', () => {
      const result = calculateFosberg(85, 20, 0);
      expect(result).toBeGreaterThan(0);
    });

    it('should validate input ranges', () => {
      expect(() => calculateFosberg(-50, 30, 10)).toThrow('Invalid temperature');
      expect(() => calculateFosberg(75, 150, 10)).toThrow('Invalid humidity');
      expect(() => calculateFosberg(75, 30, -5)).toThrow('Invalid wind speed');
    });
  });

  describe('detectRedFlagConditions', () => {
    it('should detect Red Flag conditions', () => {
      const observations = {
        relative_humidity: 12,
        wind_speed: 28,
        wind_gust: 40
      };

      const warnings = detectRedFlagConditions(observations);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].level).toBe('Red Flag');
    });

    it('should detect Fire Weather Watch', () => {
      const observations = {
        relative_humidity: 18,
        wind_speed: 22,
        wind_gust: 30
      };

      const warnings = detectRedFlagConditions(observations);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].level).toBe('Watch');
    });

    it('should return empty array for normal conditions', () => {
      const observations = {
        relative_humidity: 40,
        wind_speed: 10,
        wind_gust: 15
      };

      const warnings = detectRedFlagConditions(observations);
      expect(warnings).toHaveLength(0);
    });
  });
});
```

### Example: Testing Schema Transformation

```javascript
// tests/unit/schemas/transformer.test.js
import { transformToWildfireSchema } from '../../../src/schemas/transformer.js';
import synopticFixture from '../../fixtures/synoptic-responses.json';

describe('transformer.js', () => {
  describe('transformToWildfireSchema', () => {
    it('should transform Synoptic data to wildfire schema', () => {
      const rawsData = synopticFixture.stations.C5725;
      const stationInfo = { name: 'Monument Creek', state: 'CO', id: 'C5725' };

      const result = transformToWildfireSchema(rawsData, stationInfo);

      // Verify structure
      expect(result).toHaveProperty('location');
      expect(result).toHaveProperty('as_of');
      expect(result).toHaveProperty('weather_risks');
      expect(result).toHaveProperty('data_sources');

      // Verify weather_risks structure
      expect(result.weather_risks).toHaveProperty('temperature');
      expect(result.weather_risks).toHaveProperty('humidity');
      expect(result.weather_risks).toHaveProperty('wind');
      expect(result.weather_risks).toHaveProperty('probability_of_rain');

      // Verify temperature transformation
      expect(result.weather_risks.temperature.value).toBe(88); // Rounded from 88.2
      expect(result.weather_risks.temperature.units).toBe('F');

      // Verify humidity transformation
      expect(result.weather_risks.humidity.percent).toBe(19); // Rounded from 18.5

      // Verify wind transformation
      expect(result.weather_risks.wind.speed).toBe(22);
      expect(result.weather_risks.wind.gusts).toBe(39);
      expect(result.weather_risks.wind.direction).toBe('NW'); // From 310 degrees
    });

    it('should handle missing wind gust data', () => {
      const rawsData = {
        STATION: [{
          OBSERVATIONS: {
            air_temp_value_1: { value: [85.0] },
            relative_humidity_value_1: { value: [25.0] },
            wind_speed_value_1: { value: [15.0] },
            wind_direction_value_1: { value: [180] }
            // No wind_gust_value_1
          }
        }]
      };

      const stationInfo = { name: 'Test Station', state: 'CO', id: 'TEST' };
      const result = transformToWildfireSchema(rawsData, stationInfo);

      // Should estimate gusts as 1.5x wind speed
      expect(result.weather_risks.wind.gusts).toBe(23); // 15 * 1.5, rounded
    });

    it('should include data_sources', () => {
      const rawsData = synopticFixture.stations.C5725;
      const stationInfo = { name: 'Monument Creek', state: 'CO', id: 'C5725' };

      const result = transformToWildfireSchema(rawsData, stationInfo);

      expect(result.data_sources).toBeInstanceOf(Array);
      expect(result.data_sources.length).toBeGreaterThan(0);
      expect(result.data_sources[0]).toHaveProperty('name');
      expect(result.data_sources[0]).toHaveProperty('type', 'weather');
      expect(result.data_sources[0]).toHaveProperty('url');
    });
  });
});
```

### Example: Testing API Client with Mocks

```javascript
// tests/unit/api/synoptic.test.js
import { SynopticClient } from '../../../src/api/synoptic.js';
import axios from 'axios';

// Mock axios
jest.mock('axios');

describe('SynopticClient', () => {
  let client;

  beforeEach(() => {
    client = new SynopticClient('test-token');
    jest.clearAllMocks();
  });

  describe('getLatestObservations', () => {
    it('should fetch latest observations for a station', async () => {
      const mockResponse = {
        data: {
          STATION: [{
            STID: 'C5725',
            OBSERVATIONS: {
              air_temp_value_1: { value: [88.2] },
              relative_humidity_value_1: { value: [18.5] }
            }
          }]
        }
      };

      axios.get.mockResolvedValue(mockResponse);

      const result = await client.getLatestObservations('C5725');

      expect(axios.get).toHaveBeenCalledWith(
        'https://api.synopticdata.com/v2/stations/latest',
        expect.objectContaining({
          params: expect.objectContaining({
            token: 'test-token',
            stid: 'C5725'
          })
        })
      );

      expect(result).toEqual(mockResponse.data);
    });

    it('should handle API errors', async () => {
      axios.get.mockRejectedValue(new Error('Network error'));

      await expect(client.getLatestObservations('C5725')).rejects.toThrow('Network error');
    });

    it('should handle Synoptic API error responses', async () => {
      const mockResponse = {
        data: {
          ERROR: 'Invalid station ID'
        }
      };

      axios.get.mockResolvedValue(mockResponse);

      await expect(client.getLatestObservations('INVALID')).rejects.toThrow('Invalid station ID');
    });
  });

  describe('searchStations', () => {
    it('should search for stations by coordinates', async () => {
      const mockResponse = {
        data: {
          STATION: [
            { STID: 'C5725', NAME: 'Monument Creek', LATITUDE: '39.5432', LONGITUDE: '-105.2147' },
            { STID: 'C5726', NAME: 'Another Station', LATITUDE: '39.6', LONGITUDE: '-105.3' }
          ]
        }
      };

      axios.get.mockResolvedValue(mockResponse);

      const result = await client.searchStations(39.5432, -105.2147, 50);

      expect(axios.get).toHaveBeenCalledWith(
        'https://api.synopticdata.com/v2/stations/metadata',
        expect.objectContaining({
          params: expect.objectContaining({
            token: 'test-token',
            radius: '39.5432,-105.2147,50'
          })
        })
      );

      expect(result.STATION).toHaveLength(2);
    });
  });
});
```

## Integration Testing

### Example: Testing Tool Handlers

```javascript
// tests/integration/tools/get-current.test.js
import { getCurrentHandler } from '../../../src/tools/get-current.js';
import { SynopticClient } from '../../../src/api/synoptic.js';
import synopticFixture from '../../fixtures/synoptic-responses.json';

// Mock API client
jest.mock('../../../src/api/synoptic.js');

describe('get_raws_current tool (integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return formatted weather data in wildfire schema', async () => {
    // Mock API response
    SynopticClient.prototype.getLatestObservations.mockResolvedValue(
      synopticFixture.stations.C5725
    );

    const result = await getCurrentHandler({
      station_id: 'C5725',
      format: 'wildfire_schema'
    });

    // Verify response structure
    expect(result).toHaveProperty('location');
    expect(result).toHaveProperty('as_of');
    expect(result).toHaveProperty('weather_risks');
    expect(result.weather_risks).toHaveProperty('temperature');
    expect(result.weather_risks).toHaveProperty('humidity');
    expect(result.weather_risks).toHaveProperty('wind');
  });

  it('should handle station not found error', async () => {
    SynopticClient.prototype.getLatestObservations.mockRejectedValue(
      new Error('Station not found')
    );

    await expect(getCurrentHandler({ station_id: 'INVALID' }))
      .rejects.toThrow('Station not found');
  });

  it('should normalize station ID (strip RAWS: prefix)', async () => {
    SynopticClient.prototype.getLatestObservations.mockResolvedValue(
      synopticFixture.stations.C5725
    );

    await getCurrentHandler({ station_id: 'RAWS:C5725' });

    expect(SynopticClient.prototype.getLatestObservations).toHaveBeenCalledWith('C5725');
  });
});
```

### Example: Testing Cache Behavior

```javascript
// tests/integration/api/cache.test.js
import { Cache } from '../../../src/api/cache.js';

describe('Cache (integration)', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache();
  });

  afterEach(() => {
    cache.clear();
  });

  it('should cache and retrieve data', () => {
    const key = 'test-key';
    const data = { value: 'test-data' };

    cache.set(key, data, 60); // 60 second TTL

    const retrieved = cache.get(key);
    expect(retrieved).toEqual(data);
  });

  it('should return null for expired cache entries', async () => {
    const key = 'test-key';
    const data = { value: 'test-data' };

    cache.set(key, data, 1); // 1 second TTL

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 1100));

    const retrieved = cache.get(key);
    expect(retrieved).toBeNull();
  });

  it('should return null for non-existent keys', () => {
    const retrieved = cache.get('non-existent');
    expect(retrieved).toBeNull();
  });

  it('should clear all cache entries', () => {
    cache.set('key1', { value: '1' }, 60);
    cache.set('key2', { value: '2' }, 60);

    cache.clear();

    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key2')).toBeNull();
  });
});
```

## Test Fixtures and Mocks

### Creating Fixtures

**Synoptic API Response Fixture**:
```javascript
// tests/fixtures/synoptic-responses.json
{
  "stations": {
    "C5725": {
      "STATION": [{
        "STID": "C5725",
        "NAME": "Monument Creek",
        "LATITUDE": "39.5432",
        "LONGITUDE": "-105.2147",
        "ELEVATION": "7200",
        "OBSERVATIONS": {
          "date_time": ["2025-08-29T14:00:00Z"],
          "air_temp_value_1": { "value": [88.2] },
          "relative_humidity_value_1": { "value": [18.5] },
          "wind_speed_value_1": { "value": [22.3] },
          "wind_gust_value_1": { "value": [38.7] },
          "wind_direction_value_1": { "value": [310] },
          "precip_accum_value_1": { "value": [0.0] },
          "fuel_moisture_value_1": { "value": [6.2] }
        }
      }]
    },
    "CLKC1": {
      "STATION": [{
        "STID": "CLKC1",
        "NAME": "Clark Summit",
        "LATITUDE": "37.4567",
        "LONGITUDE": "-118.8901",
        "ELEVATION": "5800",
        "OBSERVATIONS": {
          "date_time": ["2025-08-29T14:00:00Z"],
          "air_temp_value_1": { "value": [92.1] },
          "relative_humidity_value_1": { "value": [11.2] },
          "wind_speed_value_1": { "value": [28.7] },
          "wind_gust_value_1": { "value": [45.2] },
          "wind_direction_value_1": { "value": [225] }
        }
      }]
    }
  }
}
```

### Creating Mocks

**Mock API Client**:
```javascript
// tests/mocks/api-clients.js
export class MockSynopticClient {
  constructor(apiToken) {
    this.apiToken = apiToken;
    this.responses = {};
  }

  mockResponse(method, stationId, response) {
    this.responses[`${method}:${stationId}`] = response;
  }

  async getLatestObservations(stationId) {
    const key = `getLatestObservations:${stationId}`;
    if (this.responses[key]) {
      return this.responses[key];
    }
    throw new Error(`No mock response for ${key}`);
  }

  async searchStations(lat, lon, radius) {
    const key = `searchStations:${lat},${lon},${radius}`;
    if (this.responses[key]) {
      return this.responses[key];
    }
    throw new Error(`No mock response for ${key}`);
  }
}
```

## Testing with Live APIs

### Test Stations

Use these stations for live API testing:

```javascript
// tests/e2e/live-api.test.js
import { SynopticClient } from '../../src/api/synoptic.js';

describe('Live API Tests', () => {
  // Skip in CI/CD
  const describeIfLive = process.env.RUN_LIVE_TESTS === 'true' ? describe : describe.skip;

  describeIfLive('Synoptic API (live)', () => {
    let client;

    beforeAll(() => {
      const apiToken = process.env.SYNOPTIC_API_TOKEN;
      if (!apiToken) {
        throw new Error('SYNOPTIC_API_TOKEN required for live tests');
      }
      client = new SynopticClient(apiToken);
    });

    it('should fetch data from Monument Creek RAWS (C5725)', async () => {
      const result = await client.getLatestObservations('C5725');

      expect(result.STATION).toBeDefined();
      expect(result.STATION[0].STID).toBe('C5725');
      expect(result.STATION[0].OBSERVATIONS).toBeDefined();
    }, 10000); // 10 second timeout

    it('should search for stations near Boulder, CO', async () => {
      const result = await client.searchStations(40.0150, -105.2705, 50);

      expect(result.STATION).toBeDefined();
      expect(result.STATION.length).toBeGreaterThan(0);
    }, 10000);
  });
});
```

### Running Live Tests

```bash
# Set environment variable and run
RUN_LIVE_TESTS=true npm test tests/e2e/

# Or with specific API token
SYNOPTIC_API_TOKEN=your_token RUN_LIVE_TESTS=true npm test tests/e2e/
```

## Coverage Requirements

### Target Coverage Levels

- **Overall**: > 80%
- **Unit tests**: > 90%
- **Integration tests**: > 70%
- **Critical paths**: 100% (transformers, calculations)

### Checking Coverage

```bash
# Run tests with coverage
npm run test:coverage

# View HTML report
open coverage/lcov-report/index.html
```

### Coverage Report Example

```
--------------------------|---------|----------|---------|---------|
File                      | % Stmts | % Branch | % Funcs | % Lines |
--------------------------|---------|----------|---------|---------|
All files                 |   85.23 |    78.45 |   92.11 |   86.34 |
 src/                     |     100 |      100 |     100 |     100 |
  index.js                |     100 |      100 |     100 |     100 |
 src/api/                 |   82.45 |    75.32 |   88.23 |   83.12 |
  synoptic.js             |   89.23 |    82.14 |   91.45 |   90.11 |
  cache.js                |     100 |      100 |     100 |     100 |
 src/schemas/             |   91.34 |    85.23 |   94.21 |   92.14 |
  transformer.js          |   95.23 |    89.14 |   98.32 |   96.11 |
 src/utils/               |   93.12 |    88.45 |   96.32 |   94.21 |
  units.js                |     100 |      100 |     100 |     100 |
  calculations.js         |   91.23 |    85.32 |   94.11 |   92.45 |
--------------------------|---------|----------|---------|---------|
```

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run with coverage
npm run test:coverage

# Run specific test file
npm test tests/unit/utils/units.test.js

# Run tests matching pattern
npm test -- --testNamePattern="degreesToCardinal"

# Run tests in watch mode
npm test -- --watch
```

### Test Options

```bash
# Verbose output
npm test -- --verbose

# Show test coverage for specific file
npm test -- --collectCoverageFrom=src/utils/units.js --coverage

# Run tests with specific timeout
npm test -- --testTimeout=10000

# Update snapshots
npm test -- --updateSnapshot
```

## Writing New Tests

### Test Structure Template

```javascript
// tests/unit/path/to/module.test.js
import { functionToTest } from '../../../src/path/to/module.js';

describe('module.js', () => {
  // Setup (optional)
  beforeEach(() => {
    // Runs before each test
  });

  afterEach(() => {
    // Runs after each test
  });

  describe('functionToTest', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test-input';

      // Act
      const result = functionToTest(input);

      // Assert
      expect(result).toBe('expected-output');
    });

    it('should handle edge case', () => {
      expect(() => functionToTest(null)).toThrow('Invalid input');
    });
  });
});
```

### Best Practices

1. **One assertion per test**: Focus on testing one thing at a time
2. **Descriptive test names**: Use "should" statements that explain expected behavior
3. **Arrange-Act-Assert**: Structure tests clearly
4. **Mock external dependencies**: Don't make real API calls in unit tests
5. **Test edge cases**: Null, undefined, empty, extreme values
6. **Clean up**: Reset mocks, clear caches in `afterEach()`

### Common Matchers

```javascript
// Equality
expect(value).toBe(expected);          // Strict equality (===)
expect(value).toEqual(expected);       // Deep equality
expect(value).not.toBe(unexpected);

// Numbers
expect(value).toBeGreaterThan(5);
expect(value).toBeLessThanOrEqual(10);
expect(value).toBeCloseTo(3.14, 2);    // Within 2 decimal places

// Strings
expect(string).toMatch(/regex/);
expect(string).toContain('substring');

// Arrays
expect(array).toContain(item);
expect(array).toHaveLength(3);

// Objects
expect(obj).toHaveProperty('key');
expect(obj).toHaveProperty('key', value);
expect(obj).toMatchObject({ key: value });

// Functions
expect(fn).toThrow();
expect(fn).toThrow(Error);
expect(fn).toThrow('error message');

// Promises
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow();

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeDefined();
expect(value).toBeNull();
```

## Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
    - uses: actions/checkout@v3

    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}

    - name: Install dependencies
      run: npm ci

    - name: Run linter
      run: npm run lint

    - name: Run unit tests
      run: npm run test:unit

    - name: Run integration tests
      run: npm run test:integration

    - name: Generate coverage report
      run: npm run test:coverage

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        files: ./coverage/lcov.info
        flags: unittests
        name: codecov-umbrella
```

### Pre-commit Hook

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npm run lint
npm test
```

## Troubleshooting Tests

### Common Issues

**Tests timeout**:
```bash
# Increase timeout
npm test -- --testTimeout=10000
```

**Mocks not working**:
```javascript
// Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});
```

**Coverage not accurate**:
```bash
# Clear coverage cache
rm -rf coverage/
npm run test:coverage
```

**Tests pass locally but fail in CI**:
- Check environment variables
- Ensure dependencies are installed with `npm ci`
- Verify Node.js version matches

### Debugging Tests

```javascript
// Use console.log (will show in test output)
console.log('Debug value:', value);

// Use debugger with Node inspector
// Run: node --inspect-brk node_modules/.bin/jest --runInBand
debugger;

// Run single test for faster debugging
npm test -- --testNamePattern="specific test name"
```

## References

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Jest Cheat Sheet](https://github.com/sapegin/jest-cheat-sheet)
- [Testing Best Practices](https://testingjavascript.com/)
- [Node.js Testing Guide](https://nodejs.org/en/docs/guides/testing/)
