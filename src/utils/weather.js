/**
 * Weather-related utility functions
 */

import { estimate10HourFuelMoisture } from './calculations.js';

/**
 * Estimate probability of rain based on current conditions
 * Note: RAWS doesn't provide forecasts, so this is a rough estimation
 * based on current humidity and recent precipitation
 *
 * @param {number} relativeHumidity - Current relative humidity (0-100)
 * @param {number} recentPrecip - Recent precipitation in inches (optional)
 * @param {number} temperature - Current temperature in Fahrenheit
 * @returns {number} Estimated probability (0-100)
 */
export function estimateProbabilityOfRain(relativeHumidity, recentPrecip = 0, temperature = null) {
  let probability = 0;

  // High humidity increases rain probability
  if (relativeHumidity >= 90) {
    probability += 60;
  } else if (relativeHumidity >= 80) {
    probability += 40;
  } else if (relativeHumidity >= 70) {
    probability += 20;
  } else if (relativeHumidity >= 60) {
    probability += 10;
  }

  // Recent precipitation suggests continued likelihood
  if (recentPrecip > 0.1) {
    probability += 20;
  } else if (recentPrecip > 0.01) {
    probability += 10;
  }

  // Temperature affects precipitation type/likelihood
  if (temperature !== null) {
    if (temperature < 32) {
      // Below freezing - may be snow
      probability = Math.max(0, probability - 10);
    }
  }

  return Math.min(100, probability);
}

/**
 * Estimate wind gust from average wind speed
 * Gusts are typically 1.3-1.5x the average wind speed
 *
 * @param {number} windSpeed - Average wind speed in mph
 * @returns {number} Estimated gust speed in mph
 */
export function estimateWindGust(windSpeed) {
  if (windSpeed == null || windSpeed === 0) {
    return 0;
  }

  // Use 1.5x multiplier for estimation
  return Math.round(windSpeed * 1.5);
}

/**
 * Detect extreme weather changes from historical data
 * Returns array of detected changes
 *
 * @param {Array} timeSeries - Array of observations with timestamps
 * @returns {Array} Array of detected extreme changes
 */
export function detectExtremeChanges(timeSeries) {
  if (!timeSeries || timeSeries.length < 2) {
    return [];
  }

  const changes = [];

  // Sort by time
  const sorted = [...timeSeries].sort((a, b) =>
    new Date(a.timestamp) - new Date(b.timestamp)
  );

  // Check for wind increases > 15 mph in 3 hours
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    const timeDiff = (new Date(next.timestamp) - new Date(current.timestamp)) / (1000 * 60 * 60); // hours

    if (timeDiff <= 3 && timeDiff > 0) {
      // Wind speed increase
      if (next.windSpeed - current.windSpeed > 15) {
        changes.push({
          type: 'wind_increase',
          value: next.windSpeed - current.windSpeed,
          time: next.timestamp,
          description: `Wind increased by ${Math.round(next.windSpeed - current.windSpeed)} mph in ${Math.round(timeDiff * 60)} minutes`
        });
      }

      // Humidity drop
      if (current.humidity - next.humidity > 20) {
        changes.push({
          type: 'humidity_drop',
          value: current.humidity - next.humidity,
          time: next.timestamp,
          description: `Humidity dropped ${Math.round(current.humidity - next.humidity)}% in ${Math.round(timeDiff * 60)} minutes`
        });
      }

      // Temperature spike
      if (next.temperature - current.temperature > 20) {
        changes.push({
          type: 'temperature_spike',
          value: next.temperature - current.temperature,
          time: next.timestamp,
          description: `Temperature increased ${Math.round(next.temperature - current.temperature)}°F in ${Math.round(timeDiff * 60)} minutes`
        });
      }
    }
  }

  return changes;
}

/**
 * Calculate dewpoint from temperature and relative humidity
 *
 * @param {number} temperature - Temperature in Fahrenheit
 * @param {number} relativeHumidity - Relative humidity (0-100)
 * @returns {number} Dewpoint in Fahrenheit
 */
export function calculateDewpoint(temperature, relativeHumidity) {
  // Convert to Celsius for calculation
  const tempC = (temperature - 32) * 5 / 9;
  const rh = relativeHumidity / 100;

  // Magnus formula
  const a = 17.27;
  const b = 237.7;

  const alpha = ((a * tempC) / (b + tempC)) + Math.log(rh);
  const dewpointC = (b * alpha) / (a - alpha);

  // Convert back to Fahrenheit
  return (dewpointC * 9 / 5) + 32;
}

/**
 * Calculate heat index (apparent temperature)
 *
 * @param {number} temperature - Temperature in Fahrenheit
 * @param {number} relativeHumidity - Relative humidity (0-100)
 * @returns {number} Heat index in Fahrenheit
 */
export function calculateHeatIndex(temperature, relativeHumidity) {
  // Heat index only applies when temp >= 80°F
  if (temperature < 80) {
    return temperature;
  }

  const T = temperature;
  const RH = relativeHumidity;

  // Rothfusz regression
  let HI = -42.379 +
           2.04901523 * T +
           10.14333127 * RH -
           0.22475541 * T * RH -
           6.83783e-3 * T * T -
           5.481717e-2 * RH * RH +
           1.22874e-3 * T * T * RH +
           8.5282e-4 * T * RH * RH -
           1.99e-6 * T * T * RH * RH;

  // Adjustments
  if (RH < 13 && T >= 80 && T <= 112) {
    HI -= ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
  } else if (RH > 85 && T >= 80 && T <= 87) {
    HI += ((RH - 85) / 10) * ((87 - T) / 5);
  }

  return Math.round(HI);
}

/**
 * Determine fire weather severity based on multiple factors
 *
 * @param {Object} conditions - Weather conditions
 * @returns {Object} Severity assessment
 */
export function assessFireWeatherSeverity(conditions) {
  const {
    temperature,
    relativeHumidity,
    windSpeed,
    windGust,
    fuelMoisture
  } = conditions;

  const factors = [];
  let severity = 'Low';
  let score = 0;

  // Temperature factor
  if (temperature >= 100) {
    factors.push('Extreme temperature');
    score += 3;
  } else if (temperature >= 90) {
    factors.push('High temperature');
    score += 2;
  } else if (temperature >= 80) {
    factors.push('Elevated temperature');
    score += 1;
  }

  // Humidity factor
  if (relativeHumidity <= 10) {
    factors.push('Critically low humidity');
    score += 4;
  } else if (relativeHumidity <= 15) {
    factors.push('Very low humidity');
    score += 3;
  } else if (relativeHumidity <= 25) {
    factors.push('Low humidity');
    score += 2;
  } else if (relativeHumidity <= 35) {
    factors.push('Below average humidity');
    score += 1;
  }

  // Wind factor
  const maxWind = windGust || windSpeed;
  if (maxWind >= 40) {
    factors.push('Dangerous winds');
    score += 4;
  } else if (maxWind >= 30) {
    factors.push('Very high winds');
    score += 3;
  } else if (maxWind >= 20) {
    factors.push('High winds');
    score += 2;
  } else if (maxWind >= 15) {
    factors.push('Elevated winds');
    score += 1;
  }

  // Fuel moisture factor
  if (fuelMoisture != null) {
    if (fuelMoisture <= 5) {
      factors.push('Critically dry fuels');
      score += 3;
    } else if (fuelMoisture <= 8) {
      factors.push('Very dry fuels');
      score += 2;
    } else if (fuelMoisture <= 10) {
      factors.push('Dry fuels');
      score += 1;
    }
  }

  // Determine severity
  if (score >= 10) {
    severity = 'Extreme';
  } else if (score >= 7) {
    severity = 'Very High';
  } else if (score >= 5) {
    severity = 'High';
  } else if (score >= 3) {
    severity = 'Moderate';
  }

  return {
    severity,
    score,
    factors
  };
}

/**
 * Format weather observation for display
 *
 * @param {Object} observation - Raw observation data
 * @returns {string} Formatted string
 */
export function formatObservation(observation) {
  const parts = [];

  if (observation.temperature != null) {
    parts.push(`${Math.round(observation.temperature)}°F`);
  }

  if (observation.relativeHumidity != null) {
    parts.push(`${Math.round(observation.relativeHumidity)}% RH`);
  }

  if (observation.windSpeed != null) {
    const wind = `Wind ${Math.round(observation.windSpeed)} mph`;
    if (observation.windDirection != null) {
      parts.push(`${wind} ${observation.windDirection}`);
    } else {
      parts.push(wind);
    }
  }

  if (observation.windGust != null && observation.windGust > observation.windSpeed) {
    parts.push(`Gusts ${Math.round(observation.windGust)} mph`);
  }

  return parts.join(', ');
}
