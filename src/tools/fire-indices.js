/**
 * calculate_fire_indices tool
 * Calculate fire weather indices from weather conditions
 */

import {
  calculateFosbergFFWI,
  calculateHainesIndex,
  calculateChandlerBurningIndex,
  calculateFireDangerClass,
  isRedFlagConditions,
  estimateIgnitionProbability
} from '../utils/calculations.js';
import {
  isValidTemperature,
  isValidHumidity,
  isValidWindSpeed
} from '../utils/validators.js';
import config from '../config.js';
import logger from '../logger.js';

/**
 * Tool definition for MCP
 */
export const toolDefinition = {
  name: 'calculate_fire_indices',
  description: 'Calculate fire weather indices from weather conditions. Computes Fosberg FFWI, Haines Index, Chandler Burning Index, and fire danger classification.',
  inputSchema: {
    type: 'object',
    properties: {
      temperature: {
        type: 'number',
        description: 'Temperature in Fahrenheit'
      },
      relative_humidity: {
        type: 'number',
        description: 'Relative humidity (0-100%)'
      },
      wind_speed: {
        type: 'number',
        description: 'Wind speed in mph'
      },
      fuel_moisture: {
        type: 'number',
        description: '10-hour fuel moisture percentage (optional)',
        default: null
      },
      elevation: {
        type: 'number',
        description: 'Elevation in feet (optional, used for Haines Index)',
        default: 5000
      }
    },
    required: ['temperature', 'relative_humidity', 'wind_speed']
  }
};

/**
 * Tool handler
 * @param {Object} args - Tool arguments
 * @param {number} args.temperature - Temperature in Fahrenheit
 * @param {number} args.relative_humidity - Relative humidity (0-100%)
 * @param {number} args.wind_speed - Wind speed in mph
 * @param {number} args.fuel_moisture - 10-hour fuel moisture (optional)
 * @param {number} args.elevation - Elevation in feet (optional)
 * @returns {Promise<Object>} Calculated fire weather indices
 */
export async function handler(args) {
  const {
    temperature,
    relative_humidity,
    wind_speed,
    fuel_moisture = null,
    elevation = 5000
  } = args;

  try {
    // Check if fire indices are enabled
    if (!config.features.fireIndices) {
      return {
        success: false,
        error: {
          code: 'FEATURE_DISABLED',
          message: 'Fire indices calculation is disabled. Set ENABLE_FIRE_INDICES=true to enable.',
          status: 403
        }
      };
    }

    // Validate inputs
    if (!isValidTemperature(temperature)) {
      return {
        success: false,
        error: {
          code: 'INVALID_TEMPERATURE',
          message: `Invalid temperature: ${temperature}. Must be between -100 and 150°F.`,
          status: 400,
          details: { temperature }
        }
      };
    }

    if (!isValidHumidity(relative_humidity)) {
      return {
        success: false,
        error: {
          code: 'INVALID_HUMIDITY',
          message: `Invalid relative humidity: ${relative_humidity}. Must be between 0 and 100%.`,
          status: 400,
          details: { relative_humidity }
        }
      };
    }

    if (!isValidWindSpeed(wind_speed)) {
      return {
        success: false,
        error: {
          code: 'INVALID_WIND_SPEED',
          message: `Invalid wind speed: ${wind_speed}. Must be between 0 and 200 mph.`,
          status: 400,
          details: { wind_speed }
        }
      };
    }

    logger.info('Calculating fire indices', {
      temperature,
      relative_humidity,
      wind_speed,
      fuel_moisture,
      elevation
    });

    // Calculate all indices
    const fosbergFFWI = calculateFosbergFFWI(temperature, relative_humidity, wind_speed);
    const hainesIndex = calculateHainesIndex(temperature, relative_humidity, elevation);
    const chandlerBI = calculateChandlerBurningIndex(temperature, relative_humidity, fuel_moisture);

    const fireDangerClass = calculateFireDangerClass({
      temperature,
      relativeHumidity: relative_humidity,
      windSpeed: wind_speed,
      fuelMoisture: fuel_moisture
    });

    const redFlagConditions = isRedFlagConditions(relative_humidity, wind_speed);
    const ignitionProbability = estimateIgnitionProbability({
      temperature,
      relativeHumidity: relative_humidity,
      windSpeed: wind_speed
    });

    // Build detailed response
    const response = {
      indices: {
        fosberg_ffwi: {
          value: fosbergFFWI,
          description: 'Fosberg Fire Weather Index',
          interpretation: interpretFosberg(fosbergFFWI)
        },
        haines_index: {
          value: hainesIndex,
          description: 'Haines Index (atmospheric stability)',
          interpretation: interpretHaines(hainesIndex)
        },
        chandler_burning_index: {
          value: chandlerBI,
          description: 'Chandler Burning Index',
          interpretation: interpretChandler(chandlerBI)
        }
      },
      fire_danger: {
        class: fireDangerClass,
        red_flag_conditions: redFlagConditions,
        ignition_probability: ignitionProbability
      },
      conditions: {
        temperature,
        relative_humidity,
        wind_speed,
        fuel_moisture,
        elevation
      }
    };

    logger.info('Successfully calculated fire indices', {
      fireDangerClass,
      fosbergFFWI,
      hainesIndex,
      chandlerBI
    });

    return {
      success: true,
      data: response,
      metadata: {
        calculation_time: new Date().toISOString(),
        note: hainesIndex ? 'Haines Index is estimated from surface conditions' : null
      }
    };
  } catch (error) {
    logger.error('Failed to calculate fire indices', {
      error: error.message
    });

    return {
      success: false,
      error: {
        code: 'CALCULATION_FAILED',
        message: error.message || 'Failed to calculate fire indices',
        status: 500
      }
    };
  }
}

/**
 * Interpret Fosberg FFWI value
 * @private
 */
function interpretFosberg(value) {
  if (value === null) return 'Cannot calculate';
  if (value < 20) return 'Low fire danger';
  if (value < 40) return 'Moderate fire danger';
  if (value < 60) return 'High fire danger';
  if (value < 80) return 'Very high fire danger';
  return 'Extreme fire danger';
}

/**
 * Interpret Haines Index value
 * @private
 */
function interpretHaines(value) {
  if (value === null) return 'Cannot calculate';
  if (value <= 3) return 'Low potential for extreme fire behavior';
  if (value === 4) return 'Moderate potential for extreme fire behavior';
  return 'High potential for extreme fire behavior';
}

/**
 * Interpret Chandler Burning Index value
 * @private
 */
function interpretChandler(value) {
  if (value === null) return 'Cannot calculate';
  if (value < 50) return 'Low fire danger';
  if (value < 75) return 'Moderate fire danger';
  if (value < 90) return 'High fire danger';
  return 'Extreme fire danger';
}

export default {
  toolDefinition,
  handler
};
