# Integrating RAWS MCP with fire-behavior Application

> **Status:** This integration guide will be relevant once the RAWS MCP implementation is complete. Use this as a reference for planning integration architecture.

This guide explains how to integrate the RAWS MCP server with the [fire-behavior](https://github.com/EliSchillinger/fire-behavior) application.

## Overview

The fire-behavior application uses a React frontend and Python backend to provide wildfire information briefings. This integration adds real-time RAWS weather data to the briefings.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    fire-behavior React App                       │
│                                                                  │
│  User requests wildfire info for location                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ POST /brief
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              fire-behavior Python Backend (FastAPI)              │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  1. Geocode location → lat/lon                           │  │
│  │  2. Call RAWS MCP: search_raws_stations(lat, lon)        │  │
│  │  3. Get nearest station                                  │  │
│  │  4. Call RAWS MCP: get_raws_current(station_id)          │  │
│  │  5. Merge with wildfire status, road conditions          │  │
│  │  6. Return unified response                              │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ MCP Protocol
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RAWS MCP Server                             │
│                                                                  │
│  Fetches real-time weather from RAWS stations                   │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. fire-behavior application set up and running
2. RAWS MCP server installed and configured
3. Claude Desktop (or MCP client) configured
4. Python 3.9+ with FastAPI
5. Node.js 18+ for RAWS MCP

## Step 1: Install RAWS MCP Server

```bash
# Clone RAWS MCP repository
cd /path/to/your/projects
git clone https://github.com/tyson-swetnam/raws-mcp.git
cd raws-mcp

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your API tokens
```

## Step 2: Register RAWS MCP with Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

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

On Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Restart Claude Desktop to load the MCP server.

## Step 3: Update fire-behavior Backend

### 3.1 Install MCP Client for Python

```bash
cd /path/to/fire-behavior
pip install mcp-client
```

Or add to `requirements.txt`:
```
mcp-client>=1.0.0
```

### 3.2 Create MCP Client Module

Create `fire-behavior/server/mcp_client.py`:

```python
import asyncio
import json
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

class RAWSMCPClient:
    """Client for communicating with RAWS MCP server"""

    def __init__(self, server_path: str):
        self.server_path = server_path
        self.session = None

    async def __aenter__(self):
        """Start MCP server and create session"""
        server_params = StdioServerParameters(
            command="node",
            args=[self.server_path],
        )

        self.stdio, self.writer = await stdio_client(server_params)
        self.session = ClientSession(self.stdio, self.writer)
        await self.session.__aenter__()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Clean up session"""
        if self.session:
            await self.session.__aexit__(exc_type, exc_val, exc_tb)

    async def search_stations(self, latitude: float, longitude: float,
                             radius_miles: int = 50) -> list:
        """Find RAWS stations near coordinates"""
        result = await self.session.call_tool(
            "search_raws_stations",
            arguments={
                "latitude": latitude,
                "longitude": longitude,
                "radius_miles": radius_miles,
                "limit": 5
            }
        )
        return json.loads(result.content[0].text)

    async def get_current(self, station_id: str) -> dict:
        """Get current weather from RAWS station"""
        result = await self.session.call_tool(
            "get_raws_current",
            arguments={
                "station_id": station_id,
                "format": "wildfire_schema"
            }
        )
        return json.loads(result.content[0].text)

    async def calculate_fire_indices(self, station_id: str) -> dict:
        """Calculate fire weather indices"""
        result = await self.session.call_tool(
            "calculate_fire_indices",
            arguments={
                "station_id": station_id,
                "indices": ["haines", "fosberg", "chandler"]
            }
        )
        return json.loads(result.content[0].text)
```

### 3.3 Update Backend API Endpoint

Modify `fire-behavior/server/main.py` (or create if it doesn't exist):

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import os
from mcp_client import RAWSMCPClient

app = FastAPI()

# Configuration
RAWS_MCP_PATH = os.getenv("RAWS_MCP_PATH", "/path/to/raws-mcp/src/index.js")

class BriefRequest(BaseModel):
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None

@app.post("/brief")
async def get_wildfire_brief(request: BriefRequest):
    """
    Get wildfire information brief for a location
    """
    # If no coordinates provided, geocode the location
    if not request.latitude or not request.longitude:
        coords = await geocode_location(request.location)
        lat, lon = coords["lat"], coords["lon"]
    else:
        lat, lon = request.latitude, request.longitude

    try:
        # Initialize RAWS MCP client
        async with RAWSMCPClient(RAWS_MCP_PATH) as raws_client:
            # Find nearest RAWS station
            stations = await raws_client.search_stations(lat, lon, radius_miles=50)

            if not stations or len(stations) == 0:
                raise HTTPException(
                    status_code=404,
                    detail="No RAWS stations found near location"
                )

            nearest_station = stations[0]
            station_id = nearest_station["station_id"]

            # Get current weather from nearest station
            weather_data = await raws_client.get_current(station_id)

            # Get fire weather indices
            fire_indices = await raws_client.calculate_fire_indices(station_id)

            # Fetch wildfire status (existing function)
            wildfire_status = await fetch_wildfire_status(request.location)

            # Fetch road conditions (existing function)
            road_conditions = await fetch_road_conditions(request.location)

            # Merge all data into unified response
            response = {
                "location": request.location,
                "as_of": weather_data.get("as_of"),
                "wildfire_status": wildfire_status,
                "weather_risks": weather_data.get("weather_risks"),
                "fire_indices": fire_indices,
                "road_conditions": road_conditions,
                "risk_assessment": calculate_risk_assessment(
                    wildfire_status,
                    weather_data,
                    fire_indices
                ),
                "data_sources": [
                    *weather_data.get("data_sources", []),
                    # Add other data sources
                ],
                "notes": weather_data.get("notes", "")
            }

            return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def geocode_location(location: str) -> dict:
    """Convert location string to coordinates"""
    # Implement using geocoding service
    # Example: Use OpenStreetMap Nominatim
    import httpx
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": location, "format": "json", "limit": 1}
        )
        data = response.json()
        if not data:
            raise HTTPException(status_code=404, detail="Location not found")
        return {"lat": float(data[0]["lat"]), "lon": float(data[0]["lon"])}


async def fetch_wildfire_status(location: str) -> dict:
    """Fetch wildfire status from InciWeb or other source"""
    # Implement based on existing fire-behavior logic
    return {
        "incident_id": "ABC123",
        "name": "Sample Fire",
        "status": "Active",
        "acres": 1200,
        "containment": "7%"
    }


async def fetch_road_conditions(location: str) -> dict:
    """Fetch road conditions"""
    # Implement based on existing fire-behavior logic
    return {
        "closures": [],
        "delays_minutes": 0,
        "visibility": "Good",
        "evac_info": "None"
    }


def calculate_risk_assessment(wildfire_status: dict,
                              weather_data: dict,
                              fire_indices: dict) -> dict:
    """Calculate overall risk based on multiple factors"""
    # Simple risk calculation
    risk_score = 0

    # Factor in wildfire status
    if wildfire_status.get("status") == "Active":
        risk_score += 30

    # Factor in weather
    weather = weather_data.get("weather_risks", {})
    if weather.get("humidity", {}).get("percent", 100) < 15:
        risk_score += 20
    if weather.get("wind", {}).get("speed", 0) > 25:
        risk_score += 20
    if len(weather.get("red_flag_warnings", [])) > 0:
        risk_score += 30

    # Factor in fire indices
    if fire_indices.get("fosberg", 0) > 50:
        risk_score += 20

    # Determine risk level
    if risk_score >= 80:
        level = "Extreme"
    elif risk_score >= 60:
        level = "High"
    elif risk_score >= 30:
        level = "Moderate"
    else:
        level = "Low"

    return {
        "overall_risk": level,
        "notes": f"Risk score: {risk_score}/100. Based on wildfire status, weather conditions, and fire weather indices."
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### 3.4 Update Environment Configuration

Add to `fire-behavior/.env`:
```bash
RAWS_MCP_PATH=/absolute/path/to/raws-mcp/src/index.js
```

## Step 4: Update fire-behavior Frontend

### 4.1 Update API Call

Modify `fire-behavior/src/App.jsx` to display new weather data:

```jsx
import React, { useState } from 'react';
import axios from 'axios';

function App() {
  const [location, setLocation] = useState('');
  const [briefData, setBriefData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchBrief = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('http://localhost:8000/brief', {
        location: location
      });
      setBriefData(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch briefing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <h1>Wildfire Information Briefing</h1>

      <div className="input-section">
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Enter location (e.g., Boulder, CO)"
        />
        <button onClick={fetchBrief} disabled={loading}>
          {loading ? 'Loading...' : 'Get Brief'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {briefData && (
        <div className="brief-content">
          <h2>{briefData.location}</h2>
          <p className="timestamp">As of: {new Date(briefData.as_of).toLocaleString()}</p>

          {/* Wildfire Status */}
          <section className="wildfire-status">
            <h3>Wildfire Status</h3>
            <div>
              <strong>Name:</strong> {briefData.wildfire_status.name}<br />
              <strong>Status:</strong> {briefData.wildfire_status.status}<br />
              <strong>Size:</strong> {briefData.wildfire_status.acres} acres<br />
              <strong>Containment:</strong> {briefData.wildfire_status.containment}
            </div>
          </section>

          {/* Weather Risks (from RAWS) */}
          <section className="weather-risks">
            <h3>Current Weather Conditions</h3>
            <div className="weather-grid">
              <div>
                <strong>Temperature:</strong>{' '}
                {briefData.weather_risks.temperature.value}°{briefData.weather_risks.temperature.units}
              </div>
              <div>
                <strong>Humidity:</strong> {briefData.weather_risks.humidity.percent}%
              </div>
              <div>
                <strong>Wind:</strong>{' '}
                {briefData.weather_risks.wind.speed} mph {briefData.weather_risks.wind.direction}
                {briefData.weather_risks.wind.gusts > briefData.weather_risks.wind.speed && (
                  <span> (gusts to {briefData.weather_risks.wind.gusts} mph)</span>
                )}
              </div>
              <div>
                <strong>Probability of Rain:</strong>{' '}
                {briefData.weather_risks.probability_of_rain.percent}%{' '}
                ({briefData.weather_risks.probability_of_rain.time_window})
              </div>
            </div>

            {/* Red Flag Warnings */}
            {briefData.weather_risks.red_flag_warnings?.length > 0 && (
              <div className="warnings">
                <h4>⚠️ Fire Weather Warnings</h4>
                {briefData.weather_risks.red_flag_warnings.map((warning, idx) => (
                  <div key={idx} className="warning-item">
                    <strong>{warning.level}</strong>: {warning.description}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Fire Weather Indices */}
          {briefData.fire_indices && (
            <section className="fire-indices">
              <h3>Fire Weather Indices</h3>
              <div>
                <strong>Fosberg Index:</strong> {briefData.fire_indices.fosberg || 'N/A'}<br />
                <strong>Haines Index:</strong> {briefData.fire_indices.haines || 'N/A'}<br />
                <strong>Chandler Burning Index:</strong> {briefData.fire_indices.chandler || 'N/A'}
              </div>
            </section>
          )}

          {/* Road Conditions */}
          <section className="road-conditions">
            <h3>Road Conditions</h3>
            <div>
              <strong>Closures:</strong> {briefData.road_conditions.closures.length}<br />
              <strong>Delays:</strong> {briefData.road_conditions.delays_minutes} minutes<br />
              <strong>Visibility:</strong> {briefData.road_conditions.visibility}
            </div>
          </section>

          {/* Risk Assessment */}
          <section className="risk-assessment">
            <h3>Overall Risk Assessment</h3>
            <div className={`risk-level risk-${briefData.risk_assessment.overall_risk.toLowerCase()}`}>
              {briefData.risk_assessment.overall_risk}
            </div>
            <p>{briefData.risk_assessment.notes}</p>
          </section>

          {/* Data Sources */}
          <section className="data-sources">
            <h4>Data Sources</h4>
            <ul>
              {briefData.data_sources.map((source, idx) => (
                <li key={idx}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer">
                    {source.name}
                  </a>{' '}
                  ({source.type})
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
```

## Step 5: Testing the Integration

### 5.1 Start RAWS MCP Server

```bash
cd /path/to/raws-mcp
npm start
```

Verify it's running by checking Claude Desktop can see the tools.

### 5.2 Start fire-behavior Backend

```bash
cd /path/to/fire-behavior/server
python main.py
```

### 5.3 Start fire-behavior Frontend

```bash
cd /path/to/fire-behavior
npm run dev
```

### 5.4 Test End-to-End

1. Open http://localhost:5173 in browser
2. Enter a location (e.g., "Boulder, CO")
3. Click "Get Brief"
4. Verify weather data appears from RAWS station

## Step 6: Error Handling

Add robust error handling:

```python
# In main.py
@app.post("/brief")
async def get_wildfire_brief(request: BriefRequest):
    try:
        async with RAWSMCPClient(RAWS_MCP_PATH) as raws_client:
            # ...
    except FileNotFoundError:
        # RAWS MCP server not found
        return fallback_weather_data(request.location)
    except asyncio.TimeoutError:
        # MCP server timeout
        return partial_response_without_weather()
    except Exception as e:
        logger.error(f"RAWS MCP error: {e}")
        # Continue with other data sources
        return response_without_raws_data()
```

## Step 7: Production Deployment

### 7.1 Deploy RAWS MCP Server

Option 1: Deploy alongside backend
```bash
# In fire-behavior/server/
cp -r /path/to/raws-mcp ./raws-mcp
npm install --prefix ./raws-mcp
```

Option 2: Run as separate service
```bash
# Use PM2 or systemd
pm2 start /path/to/raws-mcp/src/index.js --name raws-mcp
```

### 7.2 Configure Production Environment

```bash
# fire-behavior/.env.production
RAWS_MCP_PATH=/opt/raws-mcp/src/index.js
SYNOPTIC_API_TOKEN=your_production_token
```

### 7.3 Add Health Checks

```python
@app.get("/health")
async def health_check():
    status = {
        "api": "healthy",
        "raws_mcp": "unknown"
    }

    try:
        async with RAWSMCPClient(RAWS_MCP_PATH) as raws_client:
            # Test connection
            await raws_client.session.list_tools()
            status["raws_mcp"] = "healthy"
    except:
        status["raws_mcp"] = "unhealthy"

    return status
```

## Troubleshooting

### RAWS MCP Server Won't Start

```bash
# Check Node version
node --version  # Should be 18+

# Check for errors
node /path/to/raws-mcp/src/index.js

# Check environment
cat /path/to/raws-mcp/.env
```

### No Stations Found

- Check coordinates are correct
- Increase search radius
- Verify Synoptic API token is valid
- Check API rate limits

### MCP Connection Timeout

- Increase timeout in Python client
- Check server logs for errors
- Verify stdio communication is working

## Performance Optimization

### Caching

Cache RAWS data in backend:

```python
from functools import lru_cache
import time

@lru_cache(maxsize=100)
def get_cached_weather(station_id: str, timestamp: int):
    # timestamp in 5-minute buckets
    # Actual fetch happens here
    pass

# Use in endpoint:
current_time_bucket = int(time.time() / 300)  # 5-minute buckets
weather = get_cached_weather(station_id, current_time_bucket)
```

### Parallel Requests

Fetch multiple data sources in parallel:

```python
import asyncio

# Fetch all data sources concurrently
results = await asyncio.gather(
    raws_client.get_current(station_id),
    fetch_wildfire_status(location),
    fetch_road_conditions(location),
    return_exceptions=True
)
```

## Next Steps

1. Add more RAWS stations to search results
2. Display station locations on a map
3. Show historical weather trends
4. Add weather forecast integration (NWS)
5. Implement alert notifications for Red Flag Warnings

## References

- [fire-behavior repository](https://github.com/EliSchillinger/fire-behavior)
- [MCP Python SDK](https://github.com/anthropics/model-context-protocol-python)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [RAWS MCP Documentation](../README.md)
