# Quick Start Guide

> **Get up and running with RAWS MCP in 5 minutes**

This guide will help you install, configure, and test the RAWS MCP server quickly.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18.0.0 or higher** - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Synoptic Data API token** (free) - [Register here](https://synopticdata.com/)
- **Claude Desktop** (optional, for MCP integration) - [Download here](https://claude.ai/download)

Check your Node.js version:
```bash
node --version
# Should output v18.0.0 or higher
```

## Step 1: Install (2 minutes)

### Clone the Repository

```bash
# Clone from GitHub
git clone https://github.com/tyson-swetnam/raws-mcp.git
cd raws-mcp

# Or download and extract ZIP
# Then: cd raws-mcp
```

### Install Dependencies

```bash
npm install
```

Expected output:
```
added 45 packages, and audited 46 packages in 3s
```

## Step 2: Configure (1 minute)

### Get Your API Token

1. Go to [synopticdata.com](https://synopticdata.com/)
2. Click "Sign Up" (it's free)
3. After logging in, go to "My Account" → "API Tokens"
4. Click "Create New Token"
5. Copy your token (looks like: `abc123def456...`)

### Create Configuration File

```bash
# Copy the example environment file
cp .env.example .env

# Edit the file
nano .env  # or use any text editor
```

Add your API token:
```env
# Required: At least one data source API token
SYNOPTIC_API_TOKEN=your_token_here

# Optional: Server configuration
LOG_LEVEL=info
CACHE_TTL_SECONDS=300

# Optional: Feature flags
ENABLE_NWS_INTEGRATION=true
ENABLE_FIRE_INDICES=true
```

Save and close the file (`Ctrl+X`, then `Y`, then `Enter` in nano).

## Step 3: Test the Server (1 minute)

### Start the Server

```bash
npm start
```

Expected output:
```
RAWS MCP Server started
Listening for MCP requests on stdio
```

**Keep this terminal open** - the server is now running.

### Test with a Simple Query

Open a **new terminal** window and test the server:

```bash
# Test that the server is responding
# (This will be replaced with actual MCP client testing in production)
echo '{"method":"tools/list"}' | npm start
```

If you see tool definitions in the output, the server is working!

## Step 4: Try It with Claude Desktop (1 minute)

### Configure Claude Desktop

1. **Locate your config file**:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

2. **Edit the file** (create if it doesn't exist):

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

**Important**: Replace `/absolute/path/to/raws-mcp` with your actual path:
- Example (macOS): `/Users/yourname/projects/raws-mcp`
- Example (Windows): `C:\Users\yourname\projects\raws-mcp`

3. **Restart Claude Desktop** - The MCP server will auto-start when Claude opens

### Test with Claude

Open Claude Desktop and try these queries:

**Query 1: Get current weather**
```
What are the current weather conditions at RAWS station C5725?
```

**Query 2: Search for stations**
```
Find RAWS weather stations near Boulder, Colorado (40.0150°N, 105.2705°W)
```

**Query 3: Calculate fire weather indices**
```
Calculate fire weather indices for RAWS station C5725
```

**Expected Response**: Claude will use the RAWS MCP tools to fetch real-time weather data and present it in a readable format.

## Example: Complete Workflow

Here's a realistic example of using RAWS MCP for wildfire weather monitoring:

### Scenario: Check fire weather near a wildfire

**You ask Claude**:
```
I'm concerned about a wildfire near Estes Park, Colorado. What are the current fire weather conditions there?
```

**Claude will**:
1. Use `search_raws_stations` to find nearby RAWS stations
2. Use `get_raws_current` to fetch current conditions
3. Use `calculate_fire_indices` to assess fire danger
4. Present the results in an easy-to-understand format

**Example Response**:
```
Based on RAWS station C5725 (Monument Creek), located approximately 15 miles from Estes Park:

🌡️ Current Conditions (as of 2:00 PM MDT):
• Temperature: 88°F
• Humidity: 18%
• Wind: NW at 22 mph, gusts to 39 mph

⚠️ Fire Weather Status:
• Fosberg Fire Weather Index: 58 (High)
• Conditions: Elevated fire danger
• Red Flag Warning: No active warnings, but conditions are dry

📊 Trend:
• Humidity is below normal for this time of day
• Winds are moderate but gusty
• No precipitation in the last 24 hours

💡 Recommendation:
Monitor conditions closely. While not in Red Flag criteria, the combination
of low humidity and gusty winds creates elevated fire danger.
```

## Common Test Stations

Use these station IDs for testing:

| Station ID | Name | Location | Notes |
|------------|------|----------|-------|
| **C5725** | Monument Creek | Colorado | Reliable, active station |
| **CLKC1** | Clark Summit | California | Fire-prone area |
| **CBRW1** | Carpenter Road | Washington | Pacific Northwest |
| **AZTH** | Thumb Butte | Arizona | Desert RAWS |

### Test Query Examples

```
Get current conditions at C5725
Find stations near 39.5432°N, 105.2147°W
Show me historical data for CLKC1 for the last 24 hours
Calculate Fosberg index for station AZTH
```

## Troubleshooting

### Server won't start

**Error**: `Cannot find module '@modelcontextprotocol/sdk'`
```bash
# Solution: Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

**Error**: `Invalid API token`
```bash
# Solution: Check your .env file
cat .env
# Verify SYNOPTIC_API_TOKEN is set correctly
```

### No data returned

**Issue**: Station returns no data

**Solutions**:
1. **Check station ID**: Ensure it's correct (e.g., `C5725` not `C57225`)
2. **Try a different station**: Some stations may be temporarily offline
   ```
   Try station C5725 (known to be reliable)
   ```
3. **Check API rate limits**: Free tier = 5,000 requests/day
   ```bash
   # Check your usage at synopticdata.com account page
   ```

### Claude Desktop integration issues

**Issue**: Tools not appearing in Claude

**Solutions**:
1. **Check config path**: Ensure absolute path is correct
   ```bash
   # macOS: Find absolute path
   cd /path/to/raws-mcp
   pwd
   # Copy this path to claude_desktop_config.json
   ```

2. **Restart Claude Desktop**: Completely quit and reopen

3. **Check server logs**: Look for errors in terminal where server is running

4. **Verify Node.js path**:
   ```bash
   which node
   # Use this path in config if "node" doesn't work
   ```

### API rate limit exceeded

**Error**: `429 Too Many Requests`

**Solution**:
- Wait for limit to reset (daily)
- Or enable caching to reduce requests:
  ```env
  CACHE_TTL_SECONDS=600  # Cache for 10 minutes
  ```

## Next Steps

Now that you have RAWS MCP running, explore these resources:

### Learn More
- **[README.md](../README.md)** - Full documentation
- **[FIRE_WEATHER.md](FIRE_WEATHER.md)** - Understanding fire weather indices
- **[API Documentation](api_endpoints.md)** - External API details

### Extend Functionality
- **[CONTRIBUTING.md](../CONTRIBUTING.md)** - Add new features
- **[TESTING.md](TESTING.md)** - Write tests

### Integration
- **[Fire Behavior Integration](fire_behavior_integration.md)** - Connect to fire-behavior app
- **[Architecture](architecture.md)** - Understand system design

## Usage Tips

### Best Practices

1. **Cache appropriately**: RAWS data updates every 15-60 minutes
   - Default cache: 5 minutes (good for most uses)
   - For real-time monitoring: 2-3 minutes
   - For historical analysis: 15-30 minutes

2. **Use specific station IDs**: More reliable than searching every time
   - First search for stations near your area
   - Save the station IDs you care about
   - Request data directly by ID

3. **Monitor API usage**: Free tier = 5,000 requests/day
   - ~208 requests/hour = safe
   - Use caching to stay well under limit

4. **Check data timestamps**: Ensure data is recent
   - RAWS should update every 15-20 minutes
   - Data older than 1 hour may indicate station issues

### Example Workflow

```
1. Morning: Search for stations near area of interest
2. Save station IDs (e.g., C5725, C5726)
3. Throughout day: Check current conditions by ID
4. Afternoon: Calculate fire indices when conditions are critical
5. Evening: Review historical data for trend analysis
```

## Getting Help

### Resources

- **Documentation**: Check `docs/` directory
- **Issues**: [GitHub Issues](https://github.com/tyson-swetnam/raws-mcp/issues)
- **Examples**: See `tests/fixtures/` for sample data

### Community

- **Discussions**: [GitHub Discussions](https://github.com/tyson-swetnam/raws-mcp/discussions)
- **Fire-behavior integration**: [fire-behavior repo](https://github.com/EliSchillinger/fire-behavior)

## Summary

You've successfully:
- ✅ Installed RAWS MCP server
- ✅ Configured API access
- ✅ Tested the server
- ✅ Integrated with Claude Desktop (optional)

**Total time**: ~5 minutes

**Next**: Try the test queries above or explore the full documentation!
