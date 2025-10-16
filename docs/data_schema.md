# RAWS Data Schema and Mapping

> **Status:** This document describes the planned schema transformation approach. Implementation is in progress.

## Overview

This document describes how raw RAWS (Remote Automatic Weather Station) data will be transformed to conform to the `wildfire_prompt_template.json` schema used by the fire-behavior application.

## Source: wildfire_prompt_template.json

The target schema is defined in the fire-behavior repository at `prompts/wildfire_prompt_template.json`.

### Target Schema: weather_risks

The primary section we populate from RAWS data is `weather_risks`:

```json
{
  "weather_risks": {
    "probability_of_rain": {
      "percent": "number (0-100)",
      "time_window": "string (e.g., 'next 24h')",
      "confidence": "enum: high, medium, low"
    },
    "red_flag_warnings": [
      {
        "start_time": "string (ISO 8601)",
        "end_time": "string (ISO 8601)",
        "level": "enum: Watch, Red Flag, Extreme",
        "description": "string"
      }
    ],
    "extreme_changes": [
      {
        "parameter": "string (e.g., 'wind', 'humidity')",
        "change": "string (e.g., 'gusts to 40 mph')",
        "magnitude": "string",
        "time_frame": "string (e.g., 'next 6-12h')"
      }
    ],
    "temperature": {
      "value": "number",
      "units": "enum: F, C"
    },
    "humidity": {
      "percent": "number (0-100)"
    },
    "wind": {
      "speed": "number",
      "gusts": "number",
      "direction": "string"
    }
  },
  "data_sources": [
    {
      "name": "string",
      "type": "string",
      "url": "string"
    }
  ]
}
```

## RAWS Data Sources

### Synoptic Data API Response Format

When querying the Synoptic API for current conditions, the response structure is:

```json
{
  "STATION": [{
    "STID": "C5725",
    "NAME": "Monument Creek",
    "ELEVATION": "7200",
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
      },
      "precip_accum_value_1": {
        "value": [0.0]
      },
      "fuel_moisture_value_1": {
        "value": [6.2]
      }
    }
  }],
  "UNITS": {
    "temp": "Fahrenheit",
    "wind": "Miles per hour"
  }
}
```

### MesoWest API Response Format

Similar structure to Synoptic (they share the same parent organization).

## Data Mapping

### Direct Mappings

These fields map directly from RAWS to the wildfire schema:

| RAWS Field | Synoptic Variable | Target Schema Path | Transformation |
|------------|-------------------|-------------------|----------------|
| Temperature | `air_temp_value_1` | `weather_risks.temperature.value` | Round to integer |
| Humidity | `relative_humidity_value_1` | `weather_risks.humidity.percent` | Round to integer |
| Wind Speed | `wind_speed_value_1` | `weather_risks.wind.speed` | Round to integer |
| Wind Gust | `wind_gust_value_1` | `weather_risks.wind.gusts` | Round to integer |
| Wind Direction | `wind_direction_value_1` | `weather_risks.wind.direction` | Convert degrees to cardinal (see below) |

### Calculated/Derived Fields

#### 1. probability_of_rain

RAWS stations do not provide forecasts, so precipitation probability must be inferred or sourced elsewhere.

**Strategy**:
- **Recent Precipitation**: If recent precip > 0, set higher probability
- **Humidity Trend**: Rising humidity may indicate incoming moisture
- **Historical Patterns**: Use historical data for location/season
- **NWS Integration**: Optionally call NWS API for actual forecast

**Default Approach** (when no forecast available):
```javascript
function estimateRainProbability(rawsData) {
  const humidity = rawsData.relative_humidity_value_1.value[0];
  const recentPrecip = rawsData.precip_accum_value_1.value[0];

  let probability = 0;
  let confidence = "low";

  if (recentPrecip > 0) {
    probability = 40;
    confidence = "medium";
  } else if (humidity > 70) {
    probability = 30;
    confidence = "low";
  } else if (humidity > 50) {
    probability = 15;
    confidence = "low";
  } else {
    probability = 5;
    confidence = "low";
  }

  return {
    percent: probability,
    time_window: "next 24h",
    confidence: confidence
  };
}
```

**Note**: For production use, integrate with NWS forecast API or commercial weather service.

#### 2. red_flag_warnings

Red Flag Warnings are issued by the National Weather Service (NWS) based on:
- Low relative humidity (typically < 15%)
- High winds (typically > 25 mph)
- Dry fuels

**Data Source**: NWS API (https://api.weather.gov/)

**Approach**:
1. Use station coordinates to query NWS alerts
2. Filter for fire weather alerts (event types: "Red Flag Warning", "Fire Weather Watch")
3. Map to schema format

**Fallback**: If NWS API unavailable, use threshold detection:

```javascript
function detectRedFlagConditions(rawsData) {
  const humidity = rawsData.relative_humidity_value_1.value[0];
  const windSpeed = rawsData.wind_speed_value_1.value[0];
  const windGust = rawsData.wind_gust_value_1.value[0];

  const redFlagConditions = [];

  // Critical fire weather: RH < 15% AND winds > 25 mph
  if (humidity < 15 && (windSpeed > 25 || windGust > 35)) {
    redFlagConditions.push({
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 6 * 3600 * 1000).toISOString(), // +6 hours
      level: "Red Flag",
      description: `Critical fire weather: Low humidity (${humidity.toFixed(0)}%) and high winds (${windSpeed.toFixed(0)} mph)`
    });
  }
  // Elevated fire weather: RH < 25% AND winds > 15 mph
  else if (humidity < 25 && windSpeed > 15) {
    redFlagConditions.push({
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
      level: "Watch",
      description: `Elevated fire weather: Humidity ${humidity.toFixed(0)}%, winds ${windSpeed.toFixed(0)} mph`
    });
  }

  return redFlagConditions;
}
```

#### 3. extreme_changes

Detecting extreme changes requires historical/time-series data.

**Approach**:
1. Fetch last 6-12 hours of observations
2. Calculate rate of change for key parameters
3. Flag rapid changes

**Thresholds**:
- Wind: Increase > 15 mph in 3 hours
- Humidity: Drop > 20% in 6 hours
- Temperature: Change > 20°F in 6 hours

```javascript
function detectExtremeChanges(historicalData) {
  const extremeChanges = [];

  // Analyze wind trend (last 3 hours)
  const windChange = calculateWindChange(historicalData, 3);
  if (windChange > 15) {
    extremeChanges.push({
      parameter: "wind",
      change: `increased by ${windChange.toFixed(0)} mph`,
      magnitude: `${windChange.toFixed(0)} mph`,
      time_frame: "last 3h"
    });
  }

  // Analyze humidity trend (last 6 hours)
  const humidityChange = calculateHumidityChange(historicalData, 6);
  if (humidityChange < -20) {
    extremeChanges.push({
      parameter: "humidity",
      change: `dropped ${Math.abs(humidityChange).toFixed(0)}%`,
      magnitude: `${Math.abs(humidityChange).toFixed(0)}%`,
      time_frame: "last 6h"
    });
  }

  return extremeChanges;
}
```

### Utility Functions

#### Wind Direction: Degrees to Cardinal

```javascript
function degreesToCardinal(degrees) {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}
```

#### Unit Conversions

```javascript
function fahrenheitToCelsius(f) {
  return (f - 32) * 5 / 9;
}

function celsiusToFahrenheit(c) {
  return (c * 9 / 5) + 32;
}

function mphToKmh(mph) {
  return mph * 1.60934;
}

function kmhToMph(kmh) {
  return kmh / 1.60934;
}
```

## Complete Transformation Example

### Input: Synoptic API Response

```json
{
  "STATION": [{
    "STID": "C5725",
    "NAME": "Monument Creek RAWS",
    "LATITUDE": "39.5432",
    "LONGITUDE": "-105.2147",
    "ELEVATION": "7200",
    "OBSERVATIONS": {
      "date_time": ["2025-08-29T14:00:00Z"],
      "air_temp_value_1": { "value": [88.2] },
      "relative_humidity_value_1": { "value": [12.5] },
      "wind_speed_value_1": { "value": [28.3] },
      "wind_gust_value_1": { "value": [42.7] },
      "wind_direction_value_1": { "value": [310] },
      "precip_accum_value_1": { "value": [0.0] },
      "fuel_moisture_value_1": { "value": [4.2] }
    }
  }],
  "UNITS": {
    "temp": "Fahrenheit",
    "wind": "Miles per hour"
  }
}
```

### Output: wildfire_prompt_template.json Format

```json
{
  "location": "Monument Creek, Colorado",
  "as_of": "2025-08-29T14:00:00Z",
  "weather_risks": {
    "temperature": {
      "value": 88,
      "units": "F"
    },
    "humidity": {
      "percent": 13
    },
    "wind": {
      "speed": 28,
      "gusts": 43,
      "direction": "NW"
    },
    "probability_of_rain": {
      "percent": 5,
      "time_window": "next 24h",
      "confidence": "low"
    },
    "red_flag_warnings": [
      {
        "start_time": "2025-08-29T14:00:00Z",
        "end_time": "2025-08-29T20:00:00Z",
        "level": "Red Flag",
        "description": "Critical fire weather: Low humidity (13%) and high winds (28 mph, gusts to 43 mph)"
      }
    ],
    "extreme_changes": [
      {
        "parameter": "wind",
        "change": "gusts up to",
        "magnitude": "43 mph",
        "time_frame": "current"
      }
    ]
  },
  "data_sources": [
    {
      "name": "Monument Creek RAWS (C5725)",
      "type": "weather",
      "url": "https://raws.dri.edu/C5725"
    },
    {
      "name": "Synoptic Data API",
      "type": "weather",
      "url": "https://synopticdata.com/"
    }
  ],
  "notes": "Real-time observations from RAWS station. Red Flag conditions detected based on humidity and wind thresholds. Precipitation probability estimated from current conditions (no forecast available from RAWS)."
}
```

## Validation

### Schema Validation

Use JSON Schema or a library like `zod` to validate outputs:

```javascript
const wildfireSchema = z.object({
  weather_risks: z.object({
    temperature: z.object({
      value: z.number(),
      units: z.enum(['F', 'C'])
    }),
    humidity: z.object({
      percent: z.number().min(0).max(100)
    }),
    wind: z.object({
      speed: z.number(),
      gusts: z.number(),
      direction: z.string()
    }),
    probability_of_rain: z.object({
      percent: z.number().min(0).max(100),
      time_window: z.string(),
      confidence: z.enum(['high', 'medium', 'low'])
    }),
    red_flag_warnings: z.array(z.object({
      start_time: z.string(),
      end_time: z.string(),
      level: z.enum(['Watch', 'Red Flag', 'Extreme']),
      description: z.string()
    })),
    extreme_changes: z.array(z.object({
      parameter: z.string(),
      change: z.string(),
      magnitude: z.string(),
      time_frame: z.string()
    }))
  }),
  data_sources: z.array(z.object({
    name: z.string(),
    type: z.string(),
    url: z.string()
  })),
  notes: z.string().optional()
});
```

## Handling Missing Data

### Strategies

1. **Required fields**: Return error if missing critical data (temp, humidity, wind)
2. **Optional fields**: Omit or use null
3. **Calculated fields**: Mark confidence as "low" or include disclaimer

### Example: Missing Wind Gusts

```javascript
function transformWindData(rawsObs) {
  const windSpeed = rawsObs.wind_speed_value_1?.value?.[0];
  const windGust = rawsObs.wind_gust_value_1?.value?.[0];
  const windDir = rawsObs.wind_direction_value_1?.value?.[0];

  return {
    speed: Math.round(windSpeed) || 0,
    gusts: Math.round(windGust) || Math.round(windSpeed * 1.5) || 0, // Estimate gusts as 1.5x speed
    direction: windDir ? degreesToCardinal(windDir) : "Unknown"
  };
}
```

## Fire Weather Indices

In addition to raw observations, the RAWS MCP server can calculate fire weather indices:

### Haines Index

Measures atmospheric stability and dryness.

**Formula**:
```
Haines Index = Stability Component + Moisture Component
```

**Implementation** (requires upper-air data):
- May need to integrate with NWS sounding data
- Alternatively, use surface observations as proxy

### Fosberg Fire Weather Index (FFWI)

Combines temperature, humidity, and wind speed.

**Formula**:
```
FFWI = η × (1 + U²)
where:
  η = moisture damping coefficient (function of RH)
  U = wind speed
```

**Implementation**:
```javascript
function calculateFosberg(temp, humidity, windSpeed) {
  // Simplified Fosberg calculation
  const m = 1.0 - 2.0 * (humidity / 100) + 1.5 * Math.pow(humidity / 100, 2) - 0.5 * Math.pow(humidity / 100, 3);
  const u = Math.sqrt(1 + Math.pow(windSpeed, 2));
  const ffwi = m * u;
  return Math.round(ffwi);
}
```

### Chandler Burning Index (CBI)

More complex, requires fuel moisture data.

**RAWS Advantage**: Many RAWS stations include fuel moisture sensors.

## Recommendations

1. **Always include data_sources**: Provide transparency and traceability
2. **Add confidence indicators**: Especially for derived fields
3. **Include timestamps**: Use ISO 8601 format consistently
4. **Validate outputs**: Before returning, validate against schema
5. **Handle errors gracefully**: Return partial data with warnings if needed
6. **Cache appropriately**: RAWS data updates every 15-60 minutes; cache for 5-15 minutes (configurable via `CACHE_TTL_SECONDS`)

## Implementation Checklist

When implementing the schema transformation:

1. [ ] Implement transformation functions in `src/schemas/transformer.js`
2. [ ] Add unit tests with sample RAWS data fixtures
3. [ ] Integrate with MCP tool handlers
4. [ ] Test with real RAWS stations (C5725, CLKC1, etc.)
5. [ ] Add comprehensive logging for debugging transformations
6. [ ] Validate all outputs against wildfire schema
7. [ ] Handle edge cases (missing data, inactive stations)
8. [ ] Document any deviations from the schema

## References

- [wildfire_prompt_template.json](https://github.com/EliSchillinger/fire-behavior/blob/main/prompts/wildfire_prompt_template.json)
- [Synoptic API Variables](https://synopticdata.com/mesonet-api-variables)
- [NWS Fire Weather](https://www.weather.gov/fire/)
- [NFDRS - National Fire Danger Rating System](https://www.nwcg.gov/publications/pms437)
- [Fosberg Fire Weather Index Paper](https://www.fs.usda.gov/research/treesearch/4442)
