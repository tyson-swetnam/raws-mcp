# RAWS Data Source API Documentation

> **Status:** This document describes the external APIs that will be integrated. Implementation is in progress.

This document provides detailed information about the external APIs that will be used by the RAWS MCP server to fetch weather station data.

## Table of Contents

1. [Synoptic Data API](#synoptic-data-api)
2. [MesoWest API](#mesowest-api)
3. [WRCC RAWS USA](#wrcc-raws-usa)
4. [National Weather Service API](#national-weather-service-api)
5. [Rate Limits and Best Practices](#rate-limits-and-best-practices)

## Synoptic Data API

**Base URL**: `https://api.synopticdata.com/v2/`

**Documentation**: https://synopticdata.com/mesonet-api

**Authentication**: Token-based (included as query parameter)

**Free Tier**: 5,000 API calls per day

### Obtaining an API Token

1. Register at https://synopticdata.com/
2. Navigate to "My Account" → "API Tokens"
3. Create a new public token
4. Add to `.env` as `SYNOPTIC_API_TOKEN`

### Endpoints

#### 1. Station Metadata

Get information about RAWS stations.

**Endpoint**: `GET /stations/metadata`

**Parameters**:
- `token` (required): Your API token
- `stid` (optional): Station ID (e.g., "C5725")
- `state` (optional): US state abbreviation (e.g., "CO")
- `network` (optional): Network ID (1 or 2 for RAWS)
- `radius` (optional): Lat,lon,miles (e.g., "40.5,-105.2,50")
- `complete` (optional): Set to "1" for full metadata

**Example Request**:
```
https://api.synopticdata.com/v2/stations/metadata?
  token=YOUR_TOKEN
  &state=CO
  &network=1
  &network=2
```

**Example Response**:
```json
{
  "STATION": [
    {
      "STID": "C5725",
      "NAME": "Monument Creek",
      "LATITUDE": "39.5432",
      "LONGITUDE": "-105.2147",
      "ELEVATION": "7200",
      "STATE": "CO",
      "COUNTRY": "US",
      "MNET_ID": "2",
      "NETWORK": "RAWS",
      "NWSFIREZONE": "COZ241",
      "STATUS": "ACTIVE",
      "PERIOD_OF_RECORD": {
        "start": "2010-05-01T00:00:00Z",
        "end": "2025-08-29T14:00:00Z"
      }
    }
  ],
  "SUMMARY": {
    "NUMBER_OF_OBJECTS": 1
  }
}
```

#### 2. Latest Observations

Get the most recent observations from a station.

**Endpoint**: `GET /stations/latest`

**Parameters**:
- `token` (required): Your API token
- `stid` (required): Station ID or comma-separated list
- `vars` (optional): Comma-separated variable list (see Variables section)
- `units` (optional): "english" (default) or "metric"
- `within` (optional): Minutes back to search (default: 60)

**Example Request**:
```
https://api.synopticdata.com/v2/stations/latest?
  token=YOUR_TOKEN
  &stid=C5725
  &vars=air_temp,relative_humidity,wind_speed,wind_direction,wind_gust
  &units=english
```

**Example Response**:
```json
{
  "STATION": [
    {
      "STID": "C5725",
      "NAME": "Monument Creek",
      "LATITUDE": "39.5432",
      "LONGITUDE": "-105.2147",
      "OBSERVATIONS": {
        "date_time": ["2025-08-29T14:00:00Z"],
        "air_temp_value_1": {
          "date_time": ["2025-08-29T14:00:00Z"],
          "value": [88.2]
        },
        "relative_humidity_value_1": {
          "value": [18.5]
        },
        "wind_speed_value_1": {
          "value": [22.3]
        },
        "wind_gust_value_1": {
          "value": [38.7]
        },
        "wind_direction_value_1": {
          "value": [310]
        }
      }
    }
  ],
  "UNITS": {
    "temp": "Fahrenheit",
    "speed": "Miles per hour"
  }
}
```

#### 3. Time Series Data

Get historical observations over a time range.

**Endpoint**: `GET /stations/timeseries`

**Parameters**:
- `token` (required): Your API token
- `stid` (required): Station ID
- `start` (required): Start time (YYYYMMDDhhmm)
- `end` (required): End time (YYYYMMDDhhmm)
- `vars` (optional): Variables to retrieve
- `units` (optional): "english" or "metric"
- `obtimezone` (optional): "local" or "UTC" (default: UTC)

**Example Request**:
```
https://api.synopticdata.com/v2/stations/timeseries?
  token=YOUR_TOKEN
  &stid=C5725
  &start=202508290000
  &end=202508291400
  &vars=air_temp,relative_humidity,wind_speed
  &units=english
```

**Example Response**:
```json
{
  "STATION": [
    {
      "STID": "C5725",
      "OBSERVATIONS": {
        "date_time": [
          "2025-08-29T00:00:00Z",
          "2025-08-29T01:00:00Z",
          "2025-08-29T02:00:00Z"
        ],
        "air_temp_set_1": [62.3, 60.1, 58.7],
        "relative_humidity_set_1": [35.2, 38.7, 42.1],
        "wind_speed_set_1": [8.3, 6.7, 5.2]
      }
    }
  ]
}
```

#### 4. Geographic Search

Find stations within a radius of coordinates.

**Endpoint**: `GET /stations/metadata`

**Parameters**:
- `token` (required): Your API token
- `radius` (required): "lat,lon,miles" (e.g., "40.5,-105.2,50")
- `network` (optional): Filter by network (1,2 for RAWS)
- `limit` (optional): Max results (default: 10)

**Example Request**:
```
https://api.synopticdata.com/v2/stations/metadata?
  token=YOUR_TOKEN
  &radius=40.5,-105.2,50
  &network=1,2
  &limit=10
```

### Synoptic Variables

Common RAWS variables available via Synoptic API:

| Variable Name | Description | Units (English) | Units (Metric) |
|---------------|-------------|-----------------|----------------|
| `air_temp` | Air temperature | °F | °C |
| `relative_humidity` | Relative humidity | % | % |
| `wind_speed` | Wind speed | mph | m/s |
| `wind_gust` | Wind gust | mph | m/s |
| `wind_direction` | Wind direction | degrees | degrees |
| `precip_accum` | Precipitation accumulation | inches | mm |
| `solar_radiation` | Solar radiation | W/m² | W/m² |
| `fuel_moisture` | Fuel moisture | % | % |
| `fuel_temp` | Fuel temperature | °F | °C |
| `pressure` | Atmospheric pressure | mb | mb |
| `dew_point` | Dew point temperature | °F | °C |

**Note**: Variables are suffixed with `_value_1` or `_set_1` depending on endpoint.

### Error Handling

**Status Code**: Always 200 (errors in JSON response)

**Error Response**:
```json
{
  "ERROR": "Invalid API token",
  "ERROR_CODE": 401
}
```

**Common Error Codes**:
- `401`: Invalid or missing API token
- `400`: Bad request (invalid parameters)
- `404`: Station not found
- `429`: Rate limit exceeded

## MesoWest API

**Base URL**: `https://api.mesowest.net/v2/`

**Documentation**: https://mesowest.utah.edu/

MesoWest API is very similar to Synoptic Data API (they're part of the same organization). Endpoints and parameters are nearly identical.

**Key Differences**:
- Different base URL
- Separate API token required
- Some additional networks available

Configuration in `.env`:
```
MESOWEST_API_TOKEN=your_token_here
```

**Usage**: Can be used as a fallback if Synoptic API is unavailable.

## WRCC RAWS USA

**Website**: https://raws.dri.edu/

**Type**: Web-based archive, FTP access

**Coverage**: Historical RAWS data dating back decades

### Web Interface

The WRCC provides a web interface for manual data retrieval:

1. Navigate to https://raws.dri.edu/
2. Select state and station
3. Choose date range
4. Download CSV or view in browser

### FTP Access

**FTP Server**: `ftp://ftp.dri.edu/pub/`

**Directory Structure**:
```
/pub/
  /raws/
    /wims/         # WIMS (Weather Information Management System) data
    /fw21/         # FW21 format data
```

**File Format**: Fixed-width text files

### Scraping Strategy

If no API is available, implement a scraper:

1. Use HTTP requests to query the web interface
2. Parse HTML tables or CSV downloads
3. Cache results (WRCC data is archival, doesn't change)

**Example Scraping Endpoint**:
```
https://raws.dri.edu/cgi-bin/rawMAIN.pl?
  stn=XXXXX
  &startdate=20250829
  &enddate=20250829
```

**Note**: Always respect robots.txt and implement rate limiting.

## National Weather Service API

**Base URL**: `https://api.weather.gov/`

**Documentation**: https://www.weather.gov/documentation/services-web-api

**Authentication**: None required (public API)

**Rate Limit**: Unspecified, but implement backoff

### Use Cases

1. **Red Flag Warnings**: Fetch active fire weather alerts
2. **Forecast Data**: Get precipitation forecasts (not available from RAWS)
3. **Fire Weather Zones**: Map RAWS stations to fire weather zones

### Endpoints

#### 1. Alerts by Point

Get active weather alerts for a location.

**Endpoint**: `GET /alerts/active?point={lat},{lon}`

**Example Request**:
```
https://api.weather.gov/alerts/active?point=39.5432,-105.2147
```

**Example Response**:
```json
{
  "features": [
    {
      "properties": {
        "id": "...",
        "event": "Red Flag Warning",
        "headline": "Red Flag Warning issued August 29 at 2:00PM MDT...",
        "description": "Critical fire weather conditions...",
        "severity": "Severe",
        "urgency": "Expected",
        "onset": "2025-08-29T14:00:00-06:00",
        "expires": "2025-08-29T20:00:00-06:00",
        "affectedZones": ["https://api.weather.gov/zones/fire/COZ241"]
      }
    }
  ]
}
```

#### 2. Forecast by Coordinates

Get weather forecast for a location.

**Endpoint**:
1. First call `GET /points/{lat},{lon}` to get forecast URL
2. Then call the forecast URL returned

**Example**:
```bash
# Step 1: Get forecast URL
curl https://api.weather.gov/points/39.5432,-105.2147

# Response includes:
# "forecast": "https://api.weather.gov/gridpoints/BOU/52,73/forecast"

# Step 2: Get forecast
curl https://api.weather.gov/gridpoints/BOU/52,73/forecast
```

**Forecast Response** (excerpt):
```json
{
  "properties": {
    "periods": [
      {
        "number": 1,
        "name": "This Afternoon",
        "temperature": 88,
        "temperatureUnit": "F",
        "windSpeed": "20 to 30 mph",
        "windDirection": "NW",
        "shortForecast": "Sunny",
        "detailedForecast": "Sunny, with a high near 88...",
        "probabilityOfPrecipitation": {
          "value": 10
        }
      }
    ]
  }
}
```

#### 3. Fire Weather Zones

Get details about a fire weather zone.

**Endpoint**: `GET /zones/fire/{zoneId}`

**Example Request**:
```
https://api.weather.gov/zones/fire/COZ241
```

### Integration Strategy

1. Use RAWS stations for current observations
2. Use NWS API for:
   - Precipitation forecasts (probability_of_rain)
   - Active Red Flag Warnings
   - Fire weather zone information

## Rate Limits and Best Practices

### Rate Limiting

| API | Free Tier Limit | Recommended Strategy |
|-----|-----------------|----------------------|
| Synoptic | 5,000/day | Cache for 5-10 minutes |
| MesoWest | Similar | Use as fallback |
| NWS | Unspecified | Implement exponential backoff |
| WRCC | N/A (web scraping) | Cache heavily, 1 request/minute max |

### Caching Strategy

**In-Memory Cache** (for development):
```javascript
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}
```

**Redis Cache** (for production):
```javascript
const redis = require('redis');
const client = redis.createClient();

async function getCached(key) {
  const data = await client.get(key);
  return data ? JSON.parse(data) : null;
}

async function setCache(key, data, ttl = 300) {
  await client.setex(key, ttl, JSON.stringify(data));
}
```

### Error Handling

```javascript
async function fetchWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.json();
      }
      if (response.status === 429) {
        // Rate limited, wait and retry
        await sleep(Math.pow(2, i) * 1000);
        continue;
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * (i + 1));
    }
  }
}
```

### Best Practices

1. **Always cache**: RAWS data updates every 15-60 minutes
2. **Use ETags**: If supported by API
3. **Batch requests**: When fetching multiple stations
4. **Handle timeouts**: Set reasonable timeouts (10-30 seconds)
5. **Log API calls**: Track usage against rate limits
6. **Graceful degradation**: Return partial data if some sources fail
7. **User-Agent header**: Identify your application

**Example Headers**:
```javascript
const headers = {
  'User-Agent': 'RAWS-MCP-Server/1.0 (contact@example.com)',
  'Accept': 'application/json'
};
```

## Testing with Sample Stations

### Recommended Test Stations

| Station ID | Name | Location | Notes |
|------------|------|----------|-------|
| C5725 | Monument Creek | Colorado | Active, reliable data |
| CBRW1 | Carpenter Road | Washington | High-elevation |
| CLKC1 | Clark Summit | California | Fire-prone area |
| AZTH | Thumb Butte | Arizona | Desert RAWS |

### Test Scenarios

1. **Active Station**: C5725 (should return current data)
2. **Inactive Station**: Test error handling
3. **Missing Variables**: Station without fuel moisture
4. **Geographic Search**: Search near 40.5°N, -105.2°W

## Example Implementation

### Complete API Client

```javascript
const axios = require('axios');

class SynopticClient {
  constructor(apiToken) {
    this.apiToken = apiToken;
    this.baseUrl = 'https://api.synopticdata.com/v2';
  }

  async getLatestObservations(stationId) {
    const url = `${this.baseUrl}/stations/latest`;
    const params = {
      token: this.apiToken,
      stid: stationId,
      vars: 'air_temp,relative_humidity,wind_speed,wind_gust,wind_direction',
      units: 'english',
      within: 60
    };

    const response = await axios.get(url, { params });
    if (response.data.ERROR) {
      throw new Error(response.data.ERROR);
    }
    return response.data;
  }

  async searchStations(lat, lon, radiusMiles = 50) {
    const url = `${this.baseUrl}/stations/metadata`;
    const params = {
      token: this.apiToken,
      radius: `${lat},${lon},${radiusMiles}`,
      network: '1,2',
      limit: 10
    };

    const response = await axios.get(url, { params });
    return response.data;
  }

  async getTimeSeries(stationId, startTime, endTime) {
    const url = `${this.baseUrl}/stations/timeseries`;
    const params = {
      token: this.apiToken,
      stid: stationId,
      start: this.formatTime(startTime),
      end: this.formatTime(endTime),
      vars: 'air_temp,relative_humidity,wind_speed',
      units: 'english'
    };

    const response = await axios.get(url, { params });
    return response.data;
  }

  formatTime(date) {
    // Convert to YYYYMMDDhhmm
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    const minute = String(date.getUTCMinutes()).padStart(2, '0');
    return `${year}${month}${day}${hour}${minute}`;
  }
}

module.exports = SynopticClient;
```

## References

- [Synoptic Data API Documentation](https://synopticdata.com/mesonet-api)
- [MesoWest](https://mesowest.utah.edu/)
- [WRCC RAWS USA](https://raws.dri.edu/)
- [NWS API Documentation](https://www.weather.gov/documentation/services-web-api)
- [RAWS Station List (PDF)](https://www.ntc.blm.gov/krc/uploads/366/Station%20List.pdf)
