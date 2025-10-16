# Fire Weather Domain Knowledge

> **Purpose:** This document provides essential fire weather concepts, thresholds, and calculations used in the RAWS MCP server.

## Table of Contents

1. [Fire Weather Fundamentals](#fire-weather-fundamentals)
2. [Critical Thresholds](#critical-thresholds)
3. [Fire Weather Indices](#fire-weather-indices)
4. [RAWS Stations and Fire Management](#raws-stations-and-fire-management)
5. [Fire Weather Parameters](#fire-weather-parameters)
6. [Red Flag Warning Criteria](#red-flag-warning-criteria)
7. [Implementation Guidelines](#implementation-guidelines)
8. [References](#references)

## Fire Weather Fundamentals

### What is Fire Weather?

Fire weather refers to atmospheric conditions that influence wildfire ignition, behavior, and spread. Key factors include:

- **Temperature**: Higher temperatures increase fire intensity and spread rates
- **Relative Humidity**: Low humidity desiccates fuels and increases flammability
- **Wind**: Drives fire spread, supplies oxygen, and can cause rapid fire growth
- **Fuel Moisture**: The water content in vegetation affects ignitability
- **Atmospheric Stability**: Affects smoke dispersion and potential for extreme fire behavior

### Fire Behavior Triangle

Wildfire behavior depends on three factors:

```
        Weather
           /\
          /  \
         /    \
        /______\
     Fuels    Topography
```

**Weather** (what RAWS measures):
- Temperature, humidity, wind speed/direction
- Precipitation patterns
- Atmospheric pressure

**Fuels** (partially measured by RAWS):
- Fuel moisture content (10-hour, 100-hour, 1000-hour)
- Vegetation type and density
- Fuel loading

**Topography** (affects local weather):
- Slope angle and aspect
- Elevation
- Terrain features (canyons, ridges)

## Critical Thresholds

### Red Flag Conditions

**Critical Fire Weather** - Conditions that significantly increase wildfire danger:

| Parameter | Critical Threshold | Notes |
|-----------|-------------------|-------|
| Relative Humidity | < 15% | Fuels become critically dry |
| Wind Speed | > 25 mph | Rapid fire spread potential |
| Wind Gusts | > 35 mph | Extreme fire behavior likely |
| Temperature | > 90°F | Increases fuel desiccation |
| Fuel Moisture (10-hr) | < 10% | Very dry fuels, high ignition risk |

**Red Flag Warning Criteria** (National Weather Service):
- Relative humidity ≤ 15% **AND**
- Sustained winds ≥ 25 mph **OR** gusts ≥ 35 mph

### Fuel Moisture Thresholds

**10-Hour Fuel Moisture** (fine dead fuels):
- < 3% - Extremely dry, explosive fire behavior
- 3-6% - Very dry, high fire danger
- 6-10% - Dry, elevated fire danger
- 10-15% - Moderate fire danger
- > 15% - Lower fire danger

**100-Hour Fuel Moisture** (medium dead fuels):
- < 6% - Very dry, sustained intense fire
- 6-12% - Dry, active fire behavior
- > 12% - Reduced fire intensity

**1000-Hour Fuel Moisture** (large dead fuels):
- < 10% - Drought conditions, deep-burning fires
- 10-20% - Seasonal average
- > 20% - Wet conditions, reduced fire activity

### Temperature and Humidity Combinations

**Extreme Fire Weather Combinations**:
- 95°F + 10% RH = Extremely dangerous
- 85°F + 15% RH + 30 mph winds = Red Flag conditions
- 100°F + 8% RH = Critical fire weather

### Wind Speed Impact

| Wind Speed (mph) | Fire Spread Rate | Fire Behavior |
|-----------------|------------------|---------------|
| 0-5 | Slow | Creeping, smoldering |
| 5-15 | Moderate | Active surface fire |
| 15-25 | Fast | Running surface fire |
| 25-40 | Very Fast | Crown fire potential |
| > 40 | Extreme | Extreme fire behavior, spotting |

**Wind Direction Changes**:
- Sudden shifts can cause fires to "blow up"
- Particularly dangerous if wind shifts to blow fire toward firefighters or structures

## Fire Weather Indices

### 1. Haines Index

**Purpose**: Measures atmospheric stability and dryness aloft, indicating potential for extreme fire behavior.

**Range**: 2-6 (low to high potential)

**Components**:
1. **Stability Component**: Temperature difference between surface and upper atmosphere
2. **Moisture Component**: Dew point depression at lower elevation

**Interpretation**:
- **2-3**: Low potential for extreme fire behavior
- **4**: Moderate potential
- **5-6**: High potential for extreme fire behavior, erratic winds, rapid fire growth

**Implementation Considerations**:
- Requires upper-air data (not available from RAWS alone)
- May need to integrate with NWS sounding data
- Three variants based on elevation: Low (< 3,000 ft), Mid (3,000-7,500 ft), High (> 7,500 ft)

**Formula** (simplified for mid-elevation):
```
Stability Term (A): Based on temperature difference 850mb to 700mb
  A = 1 if difference < 6°C
  A = 2 if 6-10°C
  A = 3 if > 10°C

Moisture Term (B): Based on 850mb dew point depression
  B = 1 if depression < 6°C
  B = 2 if 6-9°C
  B = 3 if > 9°C

Haines Index = A + B (range 2-6)
```

### 2. Fosberg Fire Weather Index (FFWI)

**Purpose**: Combines temperature, humidity, and wind speed into a single fire danger rating.

**Range**: 0-100+ (higher = greater fire danger)

**Formula**:
```javascript
function calculateFosberg(tempF, relativeHumidity, windSpeedMph) {
  // Convert temperature to reference equilibrium moisture content
  const emc = calculateEMC(tempF, relativeHumidity);

  // Moisture damping coefficient
  const eta = 1 - 2 * (emc / 30) + 1.5 * Math.pow(emc / 30, 2) - 0.5 * Math.pow(emc / 30, 3);

  // Wind factor
  const u = Math.sqrt(1 + Math.pow(windSpeedMph, 2));

  // Fosberg Index
  const ffwi = eta * u;

  return Math.round(ffwi);
}

function calculateEMC(tempF, rh) {
  // Equilibrium Moisture Content
  // Simplified approximation
  return 10 - 0.25 * (tempF - 77) + rh * 0.05;
}
```

**Interpretation**:
- **0-20**: Low fire danger
- **20-40**: Moderate fire danger
- **40-60**: High fire danger
- **60-80**: Very high fire danger
- **> 80**: Extreme fire danger

**Reference**: Fosberg, M.A. (1978). *Weather in wildland fire management: the fire weather index*. USDA Forest Service.

### 3. Chandler Burning Index (CBI)

**Purpose**: Comprehensive fire danger rating incorporating fuel moisture.

**Range**: 0-100+

**Components**:
- Temperature
- Relative humidity
- Wind speed
- Fuel moisture (10-hour and 100-hour)

**Formula**:
```javascript
function calculateChandler(tempF, rh, windSpeedMph, fuelMoisture10h, fuelMoisture100h) {
  // Drying factor
  const df = (110 - tempF) * (110 - rh) / 10000;

  // Wind factor
  const wf = Math.pow(windSpeedMph, 1.5);

  // Fuel factor (weighted combination of fuel moisture classes)
  const ff = (33 - fuelMoisture10h) + (33 - fuelMoisture100h) * 0.5;

  // Chandler Burning Index
  const cbi = df * wf * ff / 10;

  return Math.round(cbi);
}
```

**Interpretation**:
- **0-25**: Low burning conditions
- **25-50**: Moderate burning conditions
- **50-75**: High burning conditions
- **75-100**: Very high burning conditions
- **> 100**: Extreme burning conditions

**Advantage**: RAWS stations often have fuel moisture sensors, making CBI calculation feasible.

### 4. National Fire Danger Rating System (NFDRS) Components

**Key NFDRS Outputs** (calculated from RAWS observations):

**Spread Component (SC)**:
- Rate at which fire spreads through fuel
- Based on wind speed, fuel moisture, slope

**Energy Release Component (ERC)**:
- Potential energy released per unit area
- Based on fuel load and fuel moisture
- Good indicator of fire intensity

**Burning Index (BI)**:
- Flame length estimate
- Combines spread and energy release

**Ignition Component (IC)**:
- Probability that a firebrand will cause an ignition

**Implementation**: Full NFDRS calculations are complex and require calibration to local fuel models. Consider using simplified versions or integrating with NWS NFDRS outputs.

## RAWS Stations and Fire Management

### Purpose of RAWS Networks

RAWS (Remote Automatic Weather Stations) are strategically placed to:
- Monitor fire weather in wildfire-prone areas
- Provide real-time data for fire behavior prediction
- Support fire management decisions (suppression, prescribed burns)
- Validate forecast models
- Track long-term climate trends

### RAWS Station Characteristics

**Typical Locations**:
- Ridge tops and mountain peaks (exposure to winds)
- Remote wilderness areas
- Historical fire-prone regions
- Strategic locations for fire management agencies

**Update Frequency**:
- Most stations: 15-20 minutes
- Some stations: Hourly
- Critical stations: 10 minutes or less

**Data Transmission**:
- Satellite (GOES, Iridium)
- Cellular networks
- Radio links

**Managing Agencies**:
- USDA Forest Service
- Bureau of Land Management (BLM)
- National Park Service
- State forestry departments

### Station ID Formats

**Synoptic API Format**:
- Standard: `C5725`, `CLKC1`, `AZTH`
- With prefix: `RAWS:C5725`

**Normalization**: Always strip "RAWS:" prefix before API calls.

## Fire Weather Parameters

### Temperature

**Role in Fire Behavior**:
- Warms and dries fuels
- Increases rate of fire spread
- Affects atmospheric instability

**Critical Values**:
- > 90°F: Elevated fire danger
- > 100°F: High fire danger
- > 110°F: Extreme fire danger (combined with low RH)

**Diurnal Pattern**:
- Peak fire danger: 2-6 PM (hottest, driest)
- Reduced danger: Night and early morning (cooler, higher RH)

### Relative Humidity

**Role in Fire Behavior**:
- Directly affects fuel moisture content
- Influences ignition probability
- Affects fire intensity

**Critical Values**:
- < 10%: Extremely dry, explosive fire behavior
- 10-15%: Very dry, Red Flag conditions
- 15-25%: Dry, elevated fire danger
- 25-40%: Moderate conditions
- > 40%: Reduced fire danger

**Recovery Period**: Time for humidity to exceed 30% overnight is critical for firefighter safety and fire suppression effectiveness.

### Wind

**Role in Fire Behavior**:
- Primary driver of fire spread
- Supplies oxygen to fire
- Causes spotting (ember transport)
- Affects flame angle and intensity

**Critical Factors**:
- **Speed**: Higher speeds = faster spread
- **Gusts**: Can cause sudden fire runs
- **Direction**: Changes can endanger firefighters
- **Turbulence**: Associated with unstable conditions

**Wind and Slope Interaction**:
- Upslope + upwind: Extreme fire spread rates
- Fire spread rate doubles for every 10° slope increase
- Wind and slope effects are multiplicative, not additive

### Precipitation

**Role in Fire Behavior**:
- Increases fuel moisture
- Can suppress or extinguish fires
- Affects long-term fuel moisture trends

**Critical Values**:
- < 0.1" in 24h: Minimal fire danger impact
- 0.1-0.25" in 24h: Some moisture increase
- 0.25-0.5" in 24h: Moderate moisture increase
- > 0.5" in 24h: Significant fire danger reduction

**Dry Lightning**: Thunderstorms without significant precipitation can ignite fires while bringing high winds.

### Fuel Moisture

**Types**:
1. **Live Fuel Moisture**: Water content in living vegetation (seasonal)
2. **Dead Fuel Moisture**: Water content in dead vegetation (responds to weather)

**Dead Fuel Moisture Classes** (by timelag):
- **1-hour**: Fine fuels (grass, leaves) - equilibrate in 1 hour
- **10-hour**: Small branches (0-0.25" diameter) - equilibrate in 10 hours
- **100-hour**: Medium branches (0.25-1" diameter) - equilibrate in 100 hours
- **1000-hour**: Large logs (1-3" diameter) - equilibrate in 1000 hours

**Measurement**:
- Direct: Fuel moisture sticks at RAWS stations
- Calculated: Based on temperature, RH, and rainfall history

## Red Flag Warning Criteria

### National Weather Service Criteria

**Red Flag Warning** (issued when conditions are occurring or imminent):
- RH ≤ 15% **AND**
- Sustained winds ≥ 25 mph **OR** gusts ≥ 35 mph
- Timing: 10 AM - 8 PM local time (peak fire danger hours)

**Fire Weather Watch** (issued when conditions are possible in 12-72 hours):
- Same thresholds as Red Flag Warning
- Issued earlier for planning purposes

**Extreme Fire Behavior** (additional criteria for higher alert):
- Haines Index 5-6
- Fosberg Index > 60
- Wind gusts > 50 mph
- RH < 10%

### Regional Variations

**Western US**:
- RH ≤ 15%, winds ≥ 25 mph (standard)
- Some areas: RH ≤ 12% for higher thresholds

**Great Plains**:
- RH ≤ 20%, winds ≥ 30 mph (adjusted for grasslands)

**Southeast US**:
- RH ≤ 25%, winds ≥ 15 mph (different fuel types)

### Implementing Red Flag Detection

```javascript
function detectRedFlagConditions(observations) {
  const rh = observations.relative_humidity;
  const windSpeed = observations.wind_speed;
  const windGust = observations.wind_gust || windSpeed * 1.5;

  const warnings = [];

  // Red Flag Warning
  if (rh <= 15 && (windSpeed >= 25 || windGust >= 35)) {
    warnings.push({
      level: 'Red Flag',
      description: `Critical fire weather: RH ${rh}%, winds ${windSpeed} mph, gusts ${windGust} mph`,
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 6 * 3600 * 1000).toISOString() // +6 hours
    });
  }
  // Fire Weather Watch
  else if (rh <= 20 && windSpeed >= 20) {
    warnings.push({
      level: 'Watch',
      description: `Elevated fire weather: RH ${rh}%, winds ${windSpeed} mph`,
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 6 * 3600 * 1000).toISOString()
    });
  }

  return warnings;
}
```

## Implementation Guidelines

### Data Quality Considerations

**Missing Data**:
- Wind gust: Estimate as 1.5x sustained wind speed
- Fuel moisture: Use climatological averages or calculated values
- Precipitation: Assume 0 if not reported

**Data Validation**:
- Temperature: -40°F to 130°F (valid range)
- RH: 0-100%
- Wind speed: 0-150 mph (gusts can exceed sustained winds significantly)
- Wind direction: 0-360° (convert to cardinal directions)

**Quality Flags**:
- Check station status (ACTIVE vs. INACTIVE)
- Flag data older than 3 hours
- Note sensor malfunctions in RAWS metadata

### Unit Conversions

**Temperature**:
- Fahrenheit to Celsius: `C = (F - 32) * 5/9`
- Celsius to Fahrenheit: `F = C * 9/5 + 32`

**Wind Speed**:
- mph to m/s: `m/s = mph * 0.44704`
- mph to km/h: `km/h = mph * 1.60934`

**Wind Direction**:
```javascript
function degreesToCardinal(degrees) {
  const directions = [
    'N', 'NNE', 'NE', 'ENE',
    'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW',
    'W', 'WNW', 'NW', 'NNW'
  ];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}
```

### Calculation Best Practices

1. **Always include units**: Temperature in °F or °C, wind in mph or m/s
2. **Document formulas**: Cite authoritative sources (NWCG, USFS)
3. **Validate inputs**: Check for reasonable ranges before calculation
4. **Handle edge cases**: Missing wind gusts, inactive stations, null values
5. **Provide confidence levels**: Note when indices are estimated vs. directly calculated
6. **Include timestamps**: All fire weather data is time-sensitive

### Integration with NWS

**When to use NWS API**:
- Official Red Flag Warnings (more authoritative than threshold detection)
- Weather forecasts (RAWS provides observations only)
- Fire weather zones
- Upper-air data for Haines Index

**RAWS Advantages**:
- Higher spatial resolution (more stations than NWS)
- Fire-specific locations
- Real-time, frequent updates
- Fuel moisture sensors

## References

### Authoritative Sources

**National Wildfire Coordinating Group (NWCG)**:
- [NFDRS - National Fire Danger Rating System (PMS 437)](https://www.nwcg.gov/publications/pms437)
- [Fire Behavior Field Reference Guide (PMS 437)](https://www.nwcg.gov/publications/pms437)

**USDA Forest Service**:
- [Fosberg Fire Weather Index](https://www.fs.usda.gov/research/treesearch/4442)
- [Fire Behavior Calculations](https://www.firelab.org/)

**National Weather Service**:
- [Fire Weather Services](https://www.weather.gov/fire/)
- [Red Flag Warning Criteria by NWS Office](https://www.weather.gov/media/publications/fire_weather_criteria.pdf)

**Academic References**:
- Fosberg, M.A. (1978). *Weather in wildland fire management: the fire weather index*. USDA Forest Service Research Paper RM-204.
- Chandler, C., et al. (1983). *Fire in Forestry, Volume 1*. Wiley.
- Rothermel, R.C. (1972). *A mathematical model for predicting fire spread in wildland fuels*. USDA Forest Service Research Paper INT-115.

### Online Resources

- [Synoptic Data - RAWS Variables](https://synopticdata.com/mesonet-api-variables)
- [MesoWest RAWS Network](https://mesowest.utah.edu/)
- [WRCC RAWS USA Archive](https://raws.dri.edu/)
- [NOAA Storm Prediction Center - Fire Weather](https://www.spc.noaa.gov/products/fire_wx/)

### Fire Behavior Modeling

- [BehavePlus Fire Modeling System](https://www.frames.gov/behaveplus/)
- [FARSITE Fire Area Simulator](https://www.firelab.org/project/farsite)
- [FlamMap Fire Mapping](https://www.firelab.org/project/flammap)

## Appendix: Quick Reference Tables

### Fire Danger Classes

| Class | RH | Wind Speed | Temp | Fuel Moisture |
|-------|----|-----------:|-----:|--------------:|
| Low | > 40% | < 10 mph | < 70°F | > 15% |
| Moderate | 25-40% | 10-15 mph | 70-85°F | 10-15% |
| High | 15-25% | 15-25 mph | 85-95°F | 6-10% |
| Very High | 10-15% | 25-40 mph | 95-105°F | 3-6% |
| Extreme | < 10% | > 40 mph | > 105°F | < 3% |

### Fire Weather Index Ranges

| Index | Low | Moderate | High | Very High | Extreme |
|-------|-----|----------|------|-----------|---------|
| Fosberg | 0-20 | 20-40 | 40-60 | 60-80 | > 80 |
| Haines | 2-3 | 4 | 5-6 | - | - |
| Chandler | 0-25 | 25-50 | 50-75 | 75-100 | > 100 |
| NFDRS ERC | 0-20 | 20-40 | 40-60 | 60-80 | > 80 |

### Typical RAWS Station Variables

| Variable | Sensor Type | Accuracy | Update Frequency |
|----------|-------------|----------|------------------|
| Air Temperature | Thermistor | ±0.5°F | 15-20 min |
| Relative Humidity | Capacitive | ±2% | 15-20 min |
| Wind Speed | Anemometer | ±0.5 mph | 15-20 min |
| Wind Direction | Vane | ±5° | 15-20 min |
| Precipitation | Tipping bucket | ±0.01" | 15-20 min |
| Fuel Moisture | Resistive | ±2% | 15-20 min |
| Solar Radiation | Pyranometer | ±5% | 15-20 min |
| Barometric Pressure | Capacitive | ±0.1 mb | 15-20 min |
