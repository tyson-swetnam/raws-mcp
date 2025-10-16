# RAWS MCP Server - Setup Guide

Complete setup instructions for configuring and running the RAWS MCP server.

## Prerequisites

- **Node.js:** Version 18.0.0 or higher
- **npm:** Comes with Node.js
- **API Token:** At least one token from Synoptic Data or MesoWest (see below)

## Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/tyson-swetnam/raws-mcp.git
cd raws-mcp

# Install dependencies
npm install
```

### 2. Configure API Tokens

```bash
# Copy the environment template
cp .env.example .env

# Edit .env with your API tokens
nano .env
# or
open -e .env
```

**IMPORTANT:** You must configure at least one valid API token. The server will not start without proper authentication.

### 3. Obtain API Tokens

#### Option 1: Synoptic Data API (Recommended)

**Free Tier:** 5,000 requests/day, 2,000+ RAWS stations

1. **Register:** Visit https://synopticdata.com/
2. **Create Account:**
   - Click "Sign Up"
   - Complete registration with email verification
3. **Access API Settings:**
   - Log in to your account
   - Navigate to "My Account" → "API Settings" or "API Keys"
4. **Generate Token:**
   - Click "Create New Token" or "Generate API Key"
   - Copy your API token (long alphanumeric string)
5. **Add to .env:**
   ```bash
   SYNOPTIC_API_TOKEN=abc123def456ghi789jkl...
   ```

#### Option 2: MesoWest API (Backup/Failover)

1. **Register:** Visit https://mesowest.utah.edu/
2. **Create Account:** Complete registration form
3. **Request API Access:**
   - Navigate to account settings
   - Request API access (may require approval/waiting period)
4. **Get Token:** Once approved, copy your API token
5. **Add to .env:**
   ```bash
   MESOWEST_API_TOKEN=xyz789abc456def123...
   ```

### 4. Start the Server

```bash
# Production mode
npm start

# Development mode (auto-reload on changes)
npm run dev
```

If configured correctly, you should see:
```
[info] Client manager initialized { availableClients: [ 'synoptic' ] }
[info] MCP server listening on stdio
```

## Configuration Options

### Environment Variables

Full `.env` configuration options:

```env
# ============================================================
# API TOKENS (Required: At least one)
# ============================================================
SYNOPTIC_API_TOKEN=your_synoptic_token_here
MESOWEST_API_TOKEN=your_mesowest_token_here

# ============================================================
# Server Configuration (Optional)
# ============================================================
LOG_LEVEL=info                  # error, warn, info, debug
CACHE_TTL_SECONDS=300          # Cache lifetime in seconds (5 min default)

# ============================================================
# Cache Settings (Optional)
# ============================================================
CACHE_MAX_SIZE=1000            # Maximum number of cached entries
CACHE_CLEANUP_INTERVAL=600     # Cleanup interval in seconds

# ============================================================
# Rate Limiting (Optional)
# ============================================================
MAX_REQUESTS_PER_MINUTE=100    # Maximum API requests per minute

# ============================================================
# Feature Flags (Optional)
# ============================================================
ENABLE_NWS_INTEGRATION=true    # Enable NWS alerts/forecasts
ENABLE_FIRE_INDICES=true       # Enable fire weather calculations
```

### Failover Configuration

For production use, configure **both** API tokens for automatic failover:

```env
SYNOPTIC_API_TOKEN=your_synoptic_token
MESOWEST_API_TOKEN=your_mesowest_token
```

The server will automatically failover: Synoptic → MesoWest if:
- Primary source returns errors
- Rate limits are exceeded
- Network connectivity issues

## Integrate with Claude Desktop

Add the RAWS MCP server to Claude Desktop for interactive use.

### Configuration File Locations

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

### Add Server Configuration

Edit `claude_desktop_config.json`:

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

**IMPORTANT:**
- Use the **absolute path** to `src/index.js`, not a relative path
- Replace `/absolute/path/to/raws-mcp` with your actual installation directory

**Example paths:**
- macOS/Linux: `/Users/username/projects/raws-mcp/src/index.js`
- Windows: `C:\\Users\\username\\projects\\raws-mcp\\src\\index.js`

### Restart Claude Desktop

1. Quit Claude Desktop completely
2. Relaunch the application
3. The RAWS tools should now be available

### Verify Integration

In Claude Desktop, try asking:
- "What are the current weather conditions at RAWS station C5725?"
- "Find RAWS stations near Boulder, Colorado"
- "Show me the fire weather indices for Monument Creek RAWS"

## Testing

### Run Test Suite

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run with coverage report
npm run test:coverage
```

### Manual Testing

Test individual endpoints:

```javascript
// Use Claude Desktop or test directly via MCP protocol

// 1. Search for stations
{
  "tool": "search_raws_stations",
  "arguments": {
    "latitude": 40.0150,
    "longitude": -105.2705,
    "radius_miles": 50,
    "limit": 5
  }
}

// 2. Get current weather
{
  "tool": "get_raws_current",
  "arguments": {
    "station_id": "C5725",
    "format": "wildfire_schema"
  }
}

// 3. Get historical data
{
  "tool": "get_raws_historical",
  "arguments": {
    "station_id": "C5725",
    "start_time": "2025-10-15T00:00:00Z",
    "end_time": "2025-10-16T00:00:00Z"
  }
}

// 4. Calculate fire indices
{
  "tool": "calculate_fire_indices",
  "arguments": {
    "station_id": "C5725",
    "indices": ["haines", "fosberg", "chandler"]
  }
}
```

## Troubleshooting

### Authentication Errors (HTTP 401)

**Symptom:** Endpoints return "401 Unauthorized" or "authentication failed"

**Solutions:**

1. **Verify .env file exists:**
   ```bash
   ls -la .env
   ```

2. **Check tokens are configured:**
   ```bash
   grep "API_TOKEN" .env
   ```

3. **Ensure tokens are not placeholders:**
   ```bash
   # ❌ Wrong (placeholder):
   SYNOPTIC_API_TOKEN=your_synoptic_token_here

   # ✓ Correct (actual token):
   SYNOPTIC_API_TOKEN=abc123def456...
   ```

4. **Verify token validity:**
   - Log in to Synoptic/MesoWest
   - Check token status in account settings
   - Regenerate if necessary

5. **Restart server after updating .env**

### Server Won't Start

**Error: "No API clients are available"**

- Cause: Missing or invalid API tokens
- Solution: Follow authentication troubleshooting above

**Error: "Configuration error: At least one API token must be configured"**

- Cause: Both `SYNOPTIC_API_TOKEN` and `MESOWEST_API_TOKEN` are missing
- Solution: Add at least one valid token to `.env`

**Port conflicts:**

- RAWS MCP uses stdio transport (no ports)
- Check logs for other errors: `npm start 2>&1 | tee server.log`

### No Data Returned

**Invalid Station ID:**
- Use correct format: "C5725" not "RAWS:C5725"
- Use `search_raws_stations` to find valid IDs

**API Rate Limits:**
- Synoptic free tier: 5,000 requests/day
- Check if limit exceeded
- Configure `MESOWEST_API_TOKEN` for failover

**Station Offline:**
- Some stations temporarily offline
- Try nearby station
- Check status: https://raws.dri.edu/

### Cache Issues

**Stale data:**
- Default cache: 5 minutes for current observations
- Modify `CACHE_TTL_SECONDS` in `.env`
- Restart server to clear cache

**Cache too large:**
- Set `CACHE_MAX_SIZE` in `.env`
- Reduce `CACHE_TTL_SECONDS` for faster cleanup

## Code Quality

### Linting

```bash
# Check code style
npm run lint

# Auto-fix issues
npm run lint:fix
```

### Testing Best Practices

- Write unit tests for new features
- Update integration tests for API changes
- Run full test suite before commits
- Maintain test coverage > 80%

## Development Workflow

### Local Development

```bash
# Start with auto-reload
npm run dev

# Make changes to src/
# Server automatically restarts
```

### Adding New Features

1. Update tool definitions in `src/tools/`
2. Add API client methods if needed
3. Update schema transformations
4. Write tests in `tests/`
5. Update documentation
6. Run linter and tests

### Debugging

Enable debug logging:

```env
# In .env
LOG_LEVEL=debug
```

View detailed logs:
```bash
npm start 2>&1 | tee debug.log
```

## Production Deployment

### Security

- **Never commit `.env` to version control**
- Store API tokens in secure environment variables
- Use environment-specific `.env` files
- Rotate API tokens periodically

### Performance

- Enable caching: `CACHE_TTL_SECONDS=300`
- Configure both API tokens for failover
- Monitor rate limits and usage
- Set appropriate `MAX_REQUESTS_PER_MINUTE`

### Monitoring

- Check logs regularly for errors
- Monitor API usage against rate limits
- Track cache hit rates
- Alert on failover events

## Support

### Getting Help

- **Issues:** https://github.com/tyson-swetnam/raws-mcp/issues
- **Documentation:** `/docs/` directory
- **Examples:** Common RAWS stations in README

### Reporting Bugs

When reporting issues, include:
1. Error messages and stack traces
2. `.env` configuration (without tokens!)
3. Steps to reproduce
4. Node.js version: `node --version`
5. npm version: `npm --version`

## Additional Resources

- **Synoptic API Docs:** https://docs.synopticdata.com/
- **MesoWest API:** https://mesowest.utah.edu/
- **RAWS Network:** https://raws.dri.edu/
- **MCP Protocol:** https://github.com/anthropics/model-context-protocol
- **Fire Behavior Integration:** See `docs/fire_behavior_integration.md`
