/**
 * get_raws_historical tool
 * Retrieve historical weather data from a RAWS station
 */

import clientManager from '../api/client-manager.js';
import { extractTimeSeries } from '../schemas/adapters.js';
import {
  isValidStationId,
  sanitizeStationId,
  validateDateRange,
  parseDate
} from '../utils/validators.js';
import logger from '../logger.js';

/**
 * Tool definition for MCP
 */
export const toolDefinition = {
  name: 'get_raws_historical',
  description: 'Retrieve historical weather data from a RAWS station for trend analysis. Returns time-series data for specified variables.',
  inputSchema: {
    type: 'object',
    properties: {
      station_id: {
        type: 'string',
        description: 'RAWS station ID (e.g., "C5725", "CLKC1")'
      },
      start_time: {
        type: 'string',
        description: 'Start time (ISO 8601 format, e.g., "2025-08-29T00:00:00Z")'
      },
      end_time: {
        type: 'string',
        description: 'End time (ISO 8601 format, e.g., "2025-08-29T23:59:59Z")'
      },
      variables: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: 'Specific variables to retrieve (optional). Options: air_temp, relative_humidity, wind_speed, wind_gust, wind_direction, precip_accum, fuel_moisture',
        default: null
      }
    },
    required: ['station_id', 'start_time', 'end_time']
  }
};

/**
 * Tool handler
 * @param {Object} args - Tool arguments
 * @param {string} args.station_id - RAWS station ID
 * @param {string} args.start_time - Start time (ISO 8601)
 * @param {string} args.end_time - End time (ISO 8601)
 * @param {Array<string>} args.variables - Specific variables (optional)
 * @returns {Promise<Object>} Historical time-series data
 */
export async function handler(args) {
  const {
    station_id,
    start_time,
    end_time,
    variables = null
  } = args;

  try {
    // Validate and sanitize station ID
    const stationId = sanitizeStationId(station_id);
    if (!isValidStationId(stationId)) {
      return {
        success: false,
        error: {
          code: 'INVALID_STATION_ID',
          message: `Invalid station ID: ${station_id}. Must be 4-6 alphanumeric characters.`,
          status: 400,
          details: { stationId: station_id }
        }
      };
    }

    // Parse and validate dates
    const startDate = parseDate(start_time);
    const endDate = parseDate(end_time);

    if (!startDate) {
      return {
        success: false,
        error: {
          code: 'INVALID_START_TIME',
          message: `Invalid start time: ${start_time}. Must be ISO 8601 format.`,
          status: 400,
          details: { start_time }
        }
      };
    }

    if (!endDate) {
      return {
        success: false,
        error: {
          code: 'INVALID_END_TIME',
          message: `Invalid end time: ${end_time}. Must be ISO 8601 format.`,
          status: 400,
          details: { end_time }
        }
      };
    }

    const dateValidation = validateDateRange(startDate, endDate);
    if (!dateValidation.valid) {
      return {
        success: false,
        error: {
          code: 'INVALID_DATE_RANGE',
          message: dateValidation.error,
          status: 400,
          details: { start_time, end_time }
        }
      };
    }

    // Map variable names to API format
    const apiVariables = variables ? mapVariablesToApi(variables) : null;

    logger.info('Fetching historical data', {
      stationId,
      startDate,
      endDate,
      variables: apiVariables
    });

    // Get historical observations from client manager
    const rawStation = await clientManager.getHistoricalObservations(
      stationId,
      startDate,
      endDate,
      apiVariables
    );

    // Extract time series
    const timeSeries = extractTimeSeries(rawStation);

    if (timeSeries.length === 0) {
      return {
        success: false,
        error: {
          code: 'NO_DATA',
          message: `No historical data found for station ${stationId} in the specified time range.`,
          status: 404,
          details: { stationId, start_time, end_time }
        }
      };
    }

    logger.info('Successfully retrieved historical data', {
      stationId,
      dataPoints: timeSeries.length
    });

    return {
      success: true,
      data: {
        station_id: stationId,
        station_name: rawStation.NAME,
        time_series: timeSeries,
        start_time: start_time,
        end_time: end_time
      },
      metadata: {
        data_points: timeSeries.length,
        source: rawStation._meta?.source,
        elevation: parseFloat(rawStation.ELEVATION),
        coordinates: {
          latitude: parseFloat(rawStation.LATITUDE),
          longitude: parseFloat(rawStation.LONGITUDE)
        }
      }
    };
  } catch (error) {
    logger.error('Failed to get historical data', {
      stationId: station_id,
      error: error.message
    });

    if (error.code === 'STATION_NOT_FOUND') {
      return {
        success: false,
        error: {
          code: 'STATION_NOT_FOUND',
          message: `Station ${station_id} not found. Please verify the station ID is correct.`,
          status: 404,
          details: { stationId: station_id }
        }
      };
    }

    return {
      success: false,
      error: {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message || 'Failed to retrieve historical data',
        status: error.status || 500,
        details: { stationId: station_id }
      }
    };
  }
}

/**
 * Map user-friendly variable names to API format
 * @private
 */
function mapVariablesToApi(variables) {
  const mapping = {
    'air_temp': 'air_temp_value_1',
    'relative_humidity': 'relative_humidity_value_1',
    'wind_speed': 'wind_speed_value_1',
    'wind_gust': 'wind_gust_value_1',
    'wind_direction': 'wind_direction_value_1',
    'precip_accum': 'precip_accum_value_1',
    'fuel_moisture': 'fuel_moisture_value_1'
  };

  return variables
    .map(v => mapping[v] || v)
    .filter(v => v); // Remove nulls
}

export default {
  toolDefinition,
  handler
};
