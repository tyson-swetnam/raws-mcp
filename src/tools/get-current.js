/**
 * get_raws_current tool
 * Get current weather conditions from a RAWS station
 */

import clientManager from '../api/client-manager.js';
import { adaptRawsData } from '../schemas/adapters.js';
import { transformToWildfireSchema } from '../schemas/transformer.js';
import { isValidStationId, sanitizeStationId } from '../utils/validators.js';
import config from '../config.js';
import logger from '../logger.js';

/**
 * Tool definition for MCP
 */
export const toolDefinition = {
  name: 'get_raws_current',
  description: 'Get current weather conditions from a RAWS (Remote Automatic Weather Station). Returns data in wildfire management format including temperature, humidity, wind, and fire weather conditions.',
  inputSchema: {
    type: 'object',
    properties: {
      station_id: {
        type: 'string',
        description: 'RAWS station ID (e.g., "C5725", "CLKC1")'
      },
      include_fire_indices: {
        type: 'boolean',
        description: 'Include calculated fire weather indices (Fosberg FFWI, Haines, Chandler)',
        default: false
      }
    },
    required: ['station_id']
  }
};

/**
 * Tool handler
 * @param {Object} args - Tool arguments
 * @param {string} args.station_id - RAWS station ID
 * @param {boolean} args.include_fire_indices - Include fire indices
 * @returns {Promise<Object>} Current weather data in wildfire schema format
 */
export async function handler(args) {
  const { station_id, include_fire_indices = false } = args;

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

    logger.info('Fetching current observation', { stationId });

    // Get current observation from client manager (with failover)
    const rawStation = await clientManager.getCurrentObservation(stationId);

    // Adapt to common format
    const rawsData = adaptRawsData(rawStation, rawStation._meta?.source);

    // Get NWS alerts if enabled
    let nwsAlerts = [];
    if (config.features.nwsIntegration && rawsData.latitude && rawsData.longitude) {
      try {
        nwsAlerts = await clientManager.getNWSAlerts(rawsData.latitude, rawsData.longitude);
        logger.debug('Retrieved NWS alerts', {
          stationId,
          alertCount: nwsAlerts.length
        });
      } catch (error) {
        logger.warn('Failed to fetch NWS alerts', {
          stationId,
          error: error.message
        });
      }
    }

    // Transform to wildfire schema
    const wildfireData = transformToWildfireSchema(rawsData, { nwsAlerts });

    // Add fire indices if requested
    if (include_fire_indices && config.features.fireIndices) {
      wildfireData.fire_indices = await calculateFireIndices(rawsData);
    }

    logger.info('Successfully retrieved current observation', {
      stationId,
      source: rawsData.source
    });

    return {
      success: true,
      data: wildfireData,
      metadata: {
        station_id: stationId,
        observation_time: rawsData.timestamp,
        source: rawsData.source,
        elevation: rawsData.elevation,
        coordinates: {
          latitude: rawsData.latitude,
          longitude: rawsData.longitude
        }
      }
    };
  } catch (error) {
    logger.error('Failed to get current observation', {
      stationId: station_id,
      error: error.message
    });

    // Check for specific error types
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
        message: error.message || 'Failed to retrieve current observation',
        status: error.status || 500,
        details: { stationId: station_id }
      }
    };
  }
}

/**
 * Calculate fire weather indices
 * @private
 */
async function calculateFireIndices(rawsData) {
  const {
    calculateFosbergFFWI,
    calculateHainesIndex,
    calculateChandlerBurningIndex,
    calculateFireDangerClass
  } = await import('../utils/calculations.js');

  const { temperature, relativeHumidity, windSpeed, fuelMoisture, elevation } = rawsData;

  return {
    fosberg_ffwi: calculateFosbergFFWI(temperature, relativeHumidity, windSpeed),
    haines_index: calculateHainesIndex(temperature, relativeHumidity, elevation),
    chandler_burning_index: calculateChandlerBurningIndex(temperature, relativeHumidity, fuelMoisture),
    fire_danger_class: calculateFireDangerClass({
      temperature,
      relativeHumidity,
      windSpeed,
      fuelMoisture
    })
  };
}

export default {
  toolDefinition,
  handler
};
