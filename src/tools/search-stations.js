/**
 * search_raws_stations tool
 * Find RAWS stations near a location
 */

import clientManager from '../api/client-manager.js';
import {
  isValidLatitude,
  isValidLongitude,
  isValidRadius
} from '../utils/validators.js';
import logger from '../logger.js';

/**
 * Tool definition for MCP
 */
export const toolDefinition = {
  name: 'search_raws_stations',
  description: 'Find RAWS (Remote Automatic Weather Station) stations near a location. Returns station metadata including ID, name, location, and elevation.',
  inputSchema: {
    type: 'object',
    properties: {
      latitude: {
        type: 'number',
        description: 'Latitude (-90 to 90)'
      },
      longitude: {
        type: 'number',
        description: 'Longitude (-180 to 180)'
      },
      radius: {
        type: 'number',
        description: 'Search radius in miles (default: 50, max: 500)',
        default: 50
      },
      limit: {
        type: 'number',
        description: 'Maximum number of stations to return (default: 10, max: 50)',
        default: 10
      }
    },
    required: ['latitude', 'longitude']
  }
};

/**
 * Tool handler
 * @param {Object} args - Tool arguments
 * @param {number} args.latitude - Latitude
 * @param {number} args.longitude - Longitude
 * @param {number} args.radius - Search radius in miles
 * @param {number} args.limit - Maximum number of results
 * @returns {Promise<Object>} Array of station metadata
 */
export async function handler(args) {
  const {
    latitude,
    longitude,
    radius = 50,
    limit = 10
  } = args;

  try {
    // Validate inputs
    if (!isValidLatitude(latitude)) {
      return {
        success: false,
        error: {
          code: 'INVALID_LATITUDE',
          message: `Invalid latitude: ${latitude}. Must be between -90 and 90.`,
          status: 400,
          details: { latitude }
        }
      };
    }

    if (!isValidLongitude(longitude)) {
      return {
        success: false,
        error: {
          code: 'INVALID_LONGITUDE',
          message: `Invalid longitude: ${longitude}. Must be between -180 and 180.`,
          status: 400,
          details: { longitude }
        }
      };
    }

    if (!isValidRadius(radius)) {
      return {
        success: false,
        error: {
          code: 'INVALID_RADIUS',
          message: `Invalid radius: ${radius}. Must be between 1 and 500 miles.`,
          status: 400,
          details: { radius }
        }
      };
    }

    // Enforce limits
    const searchLimit = Math.min(Math.max(1, limit), 50);
    const searchRadius = Math.min(radius, 500);

    logger.info('Searching for stations', {
      latitude,
      longitude,
      radius: searchRadius,
      limit: searchLimit
    });

    // Search stations using client manager (with failover)
    const stations = await clientManager.searchStations(
      latitude,
      longitude,
      searchRadius,
      searchLimit
    );

    // Calculate distances and sort by distance
    const stationsWithDistance = stations.map(station => {
      const distance = calculateDistance(
        latitude,
        longitude,
        station.latitude,
        station.longitude
      );

      return {
        ...station,
        distance_miles: Math.round(distance * 10) / 10
      };
    }).sort((a, b) => a.distance_miles - b.distance_miles);

    logger.info('Successfully found stations', {
      latitude,
      longitude,
      count: stationsWithDistance.length
    });

    return {
      success: true,
      data: {
        stations: stationsWithDistance,
        search_location: {
          latitude,
          longitude
        },
        search_radius_miles: searchRadius
      },
      metadata: {
        count: stationsWithDistance.length,
        search_time: new Date().toISOString()
      }
    };
  } catch (error) {
    logger.error('Failed to search stations', {
      latitude,
      longitude,
      error: error.message
    });

    return {
      success: false,
      error: {
        code: error.code || 'SEARCH_FAILED',
        message: error.message || 'Failed to search for stations',
        status: error.status || 500,
        details: { latitude, longitude, radius }
      }
    };
  }
}

/**
 * Calculate distance between two points using Haversine formula
 * @private
 * @returns {number} Distance in miles
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 * @private
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

export default {
  toolDefinition,
  handler
};
