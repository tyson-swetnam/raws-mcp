# Contributing to RAWS MCP Server

Thank you for your interest in contributing to the RAWS MCP Server! This document provides guidelines and instructions for contributing.

> **Note:** The project is currently in the planning/early implementation phase. Core architecture documentation is in place, and we're beginning implementation. Early contributors have a great opportunity to shape the project!

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Workflow](#development-workflow)
3. [Code Standards](#code-standards)
4. [Testing](#testing)
5. [Documentation](#documentation)
6. [Pull Request Process](#pull-request-process)
7. [Adding Data Sources](#adding-data-sources)
8. [Extending Tools](#extending-tools)

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- API tokens for Synoptic/MesoWest (for testing)

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/tyson-swetnam/raws-mcp.git
   cd raws-mcp
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create environment file:
   ```bash
   cp .env.example .env
   ```

5. Add your API tokens to `.env`

6. Run tests to verify setup:
   ```bash
   npm test
   ```

## Development Workflow

### Branch Naming

Use descriptive branch names:
- `feature/add-fosberg-index` - New features
- `fix/station-search-bug` - Bug fixes
- `docs/update-api-guide` - Documentation updates
- `refactor/client-manager` - Code refactoring

### Commit Messages

Follow conventional commit format:
```
type(scope): short description

Longer description if needed

Fixes #123
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Adding or updating tests
- `refactor`: Code refactoring
- `chore`: Maintenance tasks

**Examples**:
```
feat(tools): add calculate_fire_indices tool

Implements Haines, Fosberg, and Chandler indices calculations
based on RAWS observations.

Closes #45
```

```
fix(api): handle missing wind gust data

Estimates wind gusts as 1.5x wind speed when gust data unavailable.

Fixes #67
```

## Code Standards

### JavaScript/Node.js Style

- Use ES6+ features (async/await, arrow functions, destructuring)
- Use 2-space indentation
- Use single quotes for strings
- Add trailing commas in multi-line objects/arrays
- Use descriptive variable names
- Add JSDoc comments for functions

**Example**:
```javascript
/**
 * Transform RAWS observations to wildfire schema
 * @param {Object} rawsData - Raw data from RAWS API
 * @param {Object} stationInfo - Station metadata
 * @returns {Object} Data in wildfire_prompt_template format
 */
export function transformToWildfireSchema(rawsData, stationInfo) {
  const obs = rawsData.STATION[0].OBSERVATIONS;

  return {
    location: `${stationInfo.name}, ${stationInfo.state}`,
    as_of: obs.date_time[0],
    weather_risks: {
      // ...
    }
  };
}
```

### File Organization

```
src/
├── index.js              # Entry point
├── config.js             # Configuration loader
├── logger.js             # Logging setup
├── tools/
│   ├── index.js          # Tool registration
│   ├── get-current.js    # Individual tool handlers
│   └── ...
├── api/
│   ├── base-client.js    # Base HTTP client
│   ├── synoptic.js       # API-specific clients
│   └── ...
├── schemas/
│   ├── transformer.js    # Data transformation
│   └── validators.js     # Schema validation
└── utils/
    ├── units.js          # Unit conversions
    ├── calculations.js   # Fire weather calculations
    └── weather.js        # Weather utilities
```

## Testing

### Writing Tests

All new features must include tests:

**Unit Test Example**:
```javascript
// tests/unit/utils/units.test.js
import { degreesToCardinal } from '../../../src/utils/units.js';

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
});
```

**Integration Test Example**:
```javascript
// tests/integration/tools/get-current.test.js
import { getCurrentHandler } from '../../../src/tools/get-current.js';

describe('get_raws_current tool', () => {
  it('should return formatted weather data', async () => {
    const result = await getCurrentHandler({
      station_id: 'C5725',
      format: 'wildfire_schema'
    });

    expect(result).toHaveProperty('weather_risks');
    expect(result.weather_risks).toHaveProperty('temperature');
    expect(result.weather_risks.temperature.units).toBe('F');
  });
});
```

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# With coverage
npm run test:coverage
```

### Test Coverage

Aim for >80% code coverage. Check coverage report after running tests:
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

## Documentation

### Code Documentation

- Add JSDoc comments to all exported functions
- Document parameters, return values, and errors
- Include usage examples for complex functions

### Documentation Files

Update relevant docs when making changes:

- `README.md` - User-facing documentation
- `docs/architecture.md` - System design
- `docs/api_endpoints.md` - External API details
- `docs/data_schema.md` - Schema mappings
- `docs/implementation_plan.md` - Implementation roadmap

## Pull Request Process

### Before Submitting

1. **Run tests**: Ensure all tests pass
   ```bash
   npm test
   ```

2. **Run linter**: Fix any linting errors
   ```bash
   npm run lint:fix
   ```

3. **Update documentation**: Document any new features or changes

4. **Add tests**: Include unit/integration tests for new code

5. **Test manually**: Run the MCP server locally and test your changes

### Submitting

1. Push your branch to your fork

2. Open a pull request to the `main` branch

3. Fill out the PR template with:
   - Description of changes
   - Related issues (use "Fixes #123")
   - Testing performed
   - Screenshots (if UI changes)

4. Request review from maintainers

5. Address review feedback

### PR Checklist

- [ ] Tests pass locally
- [ ] Linter passes
- [ ] Documentation updated
- [ ] Tests added for new features
- [ ] Commit messages follow conventions
- [ ] Branch is up to date with main

## Adding Data Sources

To add a new RAWS data source:

### 1. Create API Client

```javascript
// src/api/new-source.js
export class NewSourceClient {
  constructor(apiToken) {
    this.apiToken = apiToken;
    this.baseUrl = 'https://api.newsource.com';
  }

  async getLatestObservations(stationId) {
    // Implement API call
  }

  async searchStations(lat, lon, radius) {
    // Implement station search
  }
}
```

### 2. Add to Client Factory

```javascript
// src/api/client-factory.js
import { NewSourceClient } from './new-source.js';

export function createApiClient(source, config) {
  switch (source) {
    case 'synoptic':
      return new SynopticClient(config.synopticToken);
    case 'newsource':
      return new NewSourceClient(config.newsourceToken);
    // ...
  }
}
```

### 3. Update Configuration

```javascript
// .env
NEWSOURCE_API_TOKEN=your_token_here
```

### 4. Add Tests

```javascript
// tests/unit/api/new-source.test.js
describe('NewSourceClient', () => {
  it('should fetch latest observations', async () => {
    // Test implementation
  });
});
```

### 5. Document API

Add details to `docs/api_endpoints.md`:
- API endpoints
- Authentication
- Response format
- Rate limits

## Extending Tools

To add a new MCP tool:

### 1. Define Tool Schema

```javascript
// src/tools/new-tool.js
export const newToolSchema = {
  name: 'new_tool_name',
  description: 'What this tool does',
  inputSchema: {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: 'First parameter'
      }
    },
    required: ['param1']
  }
};
```

### 2. Implement Handler

```javascript
export async function newToolHandler(args) {
  // Validate inputs
  const { param1 } = args;

  // Fetch data
  const data = await fetchSomething(param1);

  // Transform to schema
  const result = transformData(data);

  // Return
  return result;
}
```

### 3. Register Tool

```javascript
// src/tools/index.js
import { newToolHandler, newToolSchema } from './new-tool.js';

export function registerTools(server) {
  server.setRequestHandler('tools/list', () => {
    return {
      tools: [
        // existing tools
        newToolSchema
      ]
    };
  });

  server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params;
    switch (name) {
      // existing cases
      case 'new_tool_name':
        return await newToolHandler(args);
    }
  });
}
```

### 4. Add Tests

```javascript
// tests/unit/tools/new-tool.test.js
describe('new_tool_name', () => {
  it('should handle valid input', async () => {
    const result = await newToolHandler({ param1: 'value' });
    expect(result).toBeDefined();
  });
});
```

### 5. Document Tool

Add to README.md under "Available Tools":
```markdown
### 5. new_tool_name
Description of what the tool does.

**Parameters:**
- `param1` (string, required): Description
```

## Code Review Guidelines

When reviewing PRs:

1. **Functionality**: Does it work as intended?
2. **Tests**: Are there adequate tests?
3. **Code Quality**: Is it readable and maintainable?
4. **Documentation**: Is it well documented?
5. **Performance**: Any performance implications?
6. **Security**: Any security concerns?

## Questions?

If you have questions:
- Check existing documentation in `docs/`
- Open an issue for discussion
- Reach out to maintainers

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.
