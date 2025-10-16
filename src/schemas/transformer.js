/**
 * Transform RAWS data to wildfire_prompt_template.json format
 */

import { degreesToCardinal, round } from '../utils/units.js';
import {
  isRedFlagConditions,
  estimate10HourFuelMoisture
} from '../utils/calculations.js';
import {
  estimateProbabilityOfRain,
  estimateWindGust,
  detectExtremeChanges
} from '../utils/weather.js';
import wildfireSchema from './wildfire-schema.js';
import logger from '../logger.js';

/**
 * Transform RAWS observation data to wildfire schema
 * @param {Object} rawsData - Normalized RAWS observation data
 * @param {Object} options - Transformation options
 * @param {Array} options.nwsAlerts - NWS alerts (optional)
 * @param {Array} options.historicalData - Historical observations for detecting changes (optional)
 * @returns {Object} Data in wildfire_prompt_template.json format
 */
export function transformToWildfireSchema(rawsData, options = {}) {
  const { nwsAlerts = [], historicalData = [] } = options;

  // Validate required fields
  validateRequiredFields(rawsData);

  try {
    // Build the wildfire schema object
    const wildfire = {
      location: buildLocationString(rawsData),
      as_of: rawsData.timestamp || new Date().toISOString(),
      weather_risks: {
        temperature: transformTemperature(rawsData.temperature),
        humidity: transformHumidity(rawsData.relativeHumidity),
        wind: transformWind(rawsData),
        probability_of_rain: transformRainProbability(rawsData),
        red_flag_warnings: transformRedFlagWarnings(rawsData, nwsAlerts),
        extreme_changes: transformExtremeChanges(rawsData, historicalData)
      },
      data_sources: buildDataSources(rawsData),
      notes: buildNotes(rawsData, nwsAlerts, historicalData)
    };

    // Validate against schema
    const validated = wildfireSchema.parse(wildfire);

    logger.debug('Successfully transformed RAWS data to wildfire schema', {
      stationId: rawsData.stationId
    });

    return validated;
  } catch (error) {
    logger.error('Failed to transform RAWS data', {
      stationId: rawsData.stationId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Validate that required fields are present
 * @private
 */
function validateRequiredFields(rawsData) {
  const required = ['temperature', 'relativeHumidity', 'windSpeed'];
  const missing = required.filter(field => rawsData[field] == null);

  if (missing.length > 0) {
    throw new Error(
      `Missing required fields: ${missing.join(', ')}. ` +
      `Cannot transform incomplete RAWS data for station ${rawsData.stationId}`
    );
  }
}

/**
 * Build location string from station data
 * @private
 */
function buildLocationString(rawsData) {
  let location = rawsData.stationName || rawsData.stationId;

  if (rawsData.state) {
    location += `, ${rawsData.state}`;
  }

  return location;
}

/**
 * Transform temperature data
 * @private
 */
function transformTemperature(temperature) {
  return {
    value: round(temperature, 0),
    units: 'F'
  };
}

/**
 * Transform humidity data
 * @private
 */
function transformHumidity(humidity) {
  return {
    percent: round(humidity, 0)
  };
}

/**
 * Transform wind data
 * @private
 */
function transformWind(rawsData) {
  const { windSpeed, windGust, windDirection } = rawsData;

  // Estimate gust if not available (1.5x wind speed)
  const gusts = windGust != null
    ? round(windGust, 0)
    : estimateWindGust(windSpeed);

  // Convert degrees to cardinal direction
  const direction = windDirection != null
    ? degreesToCardinal(windDirection)
    : 'Unknown';

  return {
    speed: round(windSpeed, 0),
    gusts,
    direction
  };
}

/**
 * Transform rain probability (estimated from current conditions)
 * @private
 */
function transformRainProbability(rawsData) {
  const { relativeHumidity, precipAccum, temperature } = rawsData;

  const probability = estimateProbabilityOfRain(
    relativeHumidity,
    precipAccum || 0,
    temperature
  );

  return {
    percent: probability,
    time_window: 'next 24h',
    confidence: precipAccum > 0 ? 'medium' : 'low'
  };
}

/**
 * Transform Red Flag Warnings
 * Combines NWS alerts with threshold detection
 * @private
 */
function transformRedFlagWarnings(rawsData, nwsAlerts = []) {
  const warnings = [];

  // Add NWS alerts if available
  for (const alert of nwsAlerts) {
    if (alert.event === 'Red Flag Warning' || alert.event === 'Fire Weather Watch') {
      warnings.push({
        start_time: alert.onset || new Date().toISOString(),
        end_time: alert.expires || new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
        level: alert.event === 'Red Flag Warning' ? 'Red Flag' : 'Watch',
        description: alert.headline || alert.description
      });
    }
  }

  // If no NWS alerts, detect based on thresholds
  if (warnings.length === 0) {
    const { relativeHumidity, windSpeed, windGust } = rawsData;

    // Check for Red Flag conditions
    if (isRedFlagConditions(relativeHumidity, Math.max(windSpeed, windGust || 0))) {
      const now = new Date();
      const sixHoursLater = new Date(now.getTime() + 6 * 3600 * 1000);

      warnings.push({
        start_time: now.toISOString(),
        end_time: sixHoursLater.toISOString(),
        level: 'Red Flag',
        description: `Critical fire weather: Low humidity (${round(relativeHumidity, 0)}%) and high winds (${round(windSpeed, 0)} mph${windGust ? `, gusts to ${round(windGust, 0)} mph` : ''})`
      });
    }
    // Check for Watch conditions (less severe)
    else if (relativeHumidity < 25 && windSpeed > 15) {
      const now = new Date();
      const sixHoursLater = new Date(now.getTime() + 6 * 3600 * 1000);

      warnings.push({
        start_time: now.toISOString(),
        end_time: sixHoursLater.toISOString(),
        level: 'Watch',
        description: `Elevated fire weather: Humidity ${round(relativeHumidity, 0)}%, winds ${round(windSpeed, 0)} mph`
      });
    }
  }

  return warnings;
}

/**
 * Transform extreme weather changes
 * Requires historical data to detect changes
 * @private
 */
function transformExtremeChanges(rawsData, historicalData = []) {
  const changes = [];

  // If we have historical data, detect changes
  if (historicalData.length > 0) {
    const detected = detectExtremeChanges(historicalData);
    changes.push(...detected);
  }

  // Always note significant current conditions
  const { windSpeed, windGust, relativeHumidity, fuelMoisture } = rawsData;

  // High gusts are notable even without historical context
  if (windGust && windGust > 40) {
    changes.push({
      parameter: 'wind',
      change: 'gusts up to',
      magnitude: `${round(windGust, 0)} mph`,
      time_frame: 'current'
    });
  }

  // Critically low humidity
  if (relativeHumidity < 10) {
    changes.push({
      parameter: 'humidity',
      change: 'critically low at',
      magnitude: `${round(relativeHumidity, 0)}%`,
      time_frame: 'current'
    });
  }

  // Very dry fuels
  if (fuelMoisture != null && fuelMoisture < 8) {
    changes.push({
      parameter: 'fuel_moisture',
      change: 'very dry fuels at',
      magnitude: `${round(fuelMoisture, 1)}%`,
      time_frame: 'current'
    });
  }

  return changes;
}

/**
 * Build data sources array
 * @private
 */
function buildDataSources(rawsData) {
  const sources = [
    {
      name: `${rawsData.stationName} RAWS (${rawsData.stationId})`,
      type: 'weather',
      url: `https://raws.dri.edu/${rawsData.stationId}`
    }
  ];

  // Add API source
  if (rawsData.source) {
    const sourceMap = {
      synoptic: {
        name: 'Synoptic Data API',
        type: 'weather',
        url: 'https://synopticdata.com/'
      },
      mesowest: {
        name: 'MesoWest API',
        type: 'weather',
        url: 'https://mesowest.utah.edu/'
      }
    };

    if (sourceMap[rawsData.source]) {
      sources.push(sourceMap[rawsData.source]);
    }
  }

  return sources;
}

/**
 * Build notes string with relevant context
 * @private
 */
function buildNotes(rawsData, nwsAlerts, historicalData) {
  const notes = [];

  notes.push('Real-time observations from RAWS station.');

  // Note about Red Flag detection
  const hasNWSAlerts = nwsAlerts.length > 0;
  if (hasNWSAlerts) {
    notes.push('Red Flag warnings from National Weather Service.');
  } else if (isRedFlagConditions(rawsData.relativeHumidity, rawsData.windSpeed)) {
    notes.push('Red Flag conditions detected based on humidity and wind thresholds.');
  }

  // Note about precipitation probability
  if (rawsData.precipAccum > 0) {
    notes.push(`Recent precipitation: ${round(rawsData.precipAccum, 2)} inches.`);
  } else {
    notes.push('Precipitation probability estimated from current conditions (no forecast available from RAWS).');
  }

  // Note about extreme changes
  if (historicalData.length > 0) {
    notes.push('Extreme weather changes analyzed from recent observations.');
  }

  // Note about fuel moisture
  if (rawsData.fuelMoisture != null) {
    notes.push(`10-hour fuel moisture: ${round(rawsData.fuelMoisture, 1)}%.`);
  } else {
    const estimated = estimate10HourFuelMoisture(
      rawsData.temperature,
      rawsData.relativeHumidity
    );
    notes.push(`Estimated 10-hour fuel moisture: ${round(estimated, 1)}% (calculated from temperature and humidity).`);
  }

  return notes.join(' ');
}

export default {
  transformToWildfireSchema
};
