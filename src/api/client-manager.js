import SynopticClient from './synoptic.js';
import MesoWestClient from './mesowest.js';
import NWSClient from './nws.js';
import cache from './cache.js';
import logger from '../logger.js';
import config from '../config.js';

/**
 * Client Manager - Coordinates multiple data sources with failover
 * Strategy Pattern: Tries sources in order: Synoptic → MesoWest → WRCC
 */
export class ClientManager {
  constructor() {
    this.synopticClient = new SynopticClient();
    this.mesowestClient = new MesoWestClient();
    this.nwsClient = new NWSClient();

    // Determine available clients
    this.availableClients = [
      { name: 'synoptic', client: this.synopticClient },
      { name: 'mesowest', client: this.mesowestClient }
    ].filter(({ client }) => client.isAvailable());

    if (this.availableClients.length === 0) {
      throw new Error('No API clients are available. Please configure at least one API token.');
    }

    logger.info('Client manager initialized', {
      availableClients: this.availableClients.map(c => c.name)
    });
  }

  /**
   * Get current observation with failover
   * @param {string} stationId - RAWS station ID
   * @returns {Promise<Object>} Current observation data with source information
   */
  async getCurrentObservation(stationId) {
    const cacheKey = `current:${stationId}`;

    // Check cache first (5 minute TTL)
    const cached = cache.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached current observation', { stationId });
      return cached;
    }

    // Try each available client in order
    let lastError = null;
    for (const { name, client } of this.availableClients) {
      try {
        logger.debug('Attempting to fetch current observation', {
          stationId,
          source: name
        });

        const data = await client.getCurrentObservation(stationId);
        const result = {
          ...data,
          _meta: {
            source: name,
            cached: false,
            timestamp: new Date().toISOString()
          }
        };

        // Cache for 5 minutes (300000 ms)
        cache.set(cacheKey, result, 300000);

        logger.info('Successfully fetched current observation', {
          stationId,
          source: name
        });

        return result;
      } catch (error) {
        logger.warn('Failed to fetch from source', {
          stationId,
          source: name,
          error: error.message || error.code
        });
        lastError = error;
      }
    }

    // All clients failed
    throw lastError || new Error('All data sources failed');
  }

  /**
   * Search for stations with failover
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @param {number} radius - Search radius in miles
   * @param {number} limit - Maximum number of results
   * @returns {Promise<Array>} Array of station metadata
   */
  async searchStations(latitude, longitude, radius = 50, limit = 10) {
    const cacheKey = `search:${latitude}:${longitude}:${radius}:${limit}`;

    // Check cache first (1 hour TTL)
    const cached = cache.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached station search', { latitude, longitude });
      return cached;
    }

    // Try each available client in order
    let lastError = null;
    for (const { name, client } of this.availableClients) {
      try {
        logger.debug('Attempting to search stations', {
          latitude,
          longitude,
          radius,
          source: name
        });

        const stations = await client.searchStations(latitude, longitude, radius, limit);

        // Cache for 1 hour (3600000 ms)
        cache.set(cacheKey, stations, 3600000);

        logger.info('Successfully searched stations', {
          latitude,
          longitude,
          source: name,
          count: stations.length
        });

        return stations;
      } catch (error) {
        logger.warn('Failed to search from source', {
          latitude,
          longitude,
          source: name,
          error: error.message || error.code
        });
        lastError = error;
      }
    }

    // All clients failed
    throw lastError || new Error('All data sources failed');
  }

  /**
   * Get historical observations with failover
   * @param {string} stationId - RAWS station ID
   * @param {Date} startTime - Start time
   * @param {Date} endTime - End time
   * @param {Array<string>} variables - Specific variables to retrieve (optional)
   * @returns {Promise<Object>} Historical data with source information
   */
  async getHistoricalObservations(stationId, startTime, endTime, variables = null) {
    const cacheKey = `historical:${stationId}:${startTime.getTime()}:${endTime.getTime()}:${variables?.join(',')}`;

    // Check cache first (24 hour TTL for historical data)
    const cached = cache.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached historical data', { stationId });
      return cached;
    }

    // Try each available client in order
    let lastError = null;
    for (const { name, client } of this.availableClients) {
      try {
        logger.debug('Attempting to fetch historical data', {
          stationId,
          source: name,
          startTime,
          endTime
        });

        const data = await client.getHistoricalObservations(stationId, startTime, endTime, variables);
        const result = {
          ...data,
          _meta: {
            source: name,
            cached: false,
            timestamp: new Date().toISOString()
          }
        };

        // Cache for 24 hours (86400000 ms)
        cache.set(cacheKey, result, 86400000);

        logger.info('Successfully fetched historical data', {
          stationId,
          source: name
        });

        return result;
      } catch (error) {
        logger.warn('Failed to fetch historical from source', {
          stationId,
          source: name,
          error: error.message || error.code
        });
        lastError = error;
      }
    }

    // All clients failed
    throw lastError || new Error('All data sources failed');
  }

  /**
   * Get NWS alerts for a location
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @returns {Promise<Array>} Array of alerts
   */
  async getNWSAlerts(latitude, longitude) {
    if (!config.features.nwsIntegration) {
      return [];
    }

    const cacheKey = `nws:alerts:${latitude}:${longitude}`;

    // Check cache first (5 minute TTL)
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const alerts = await this.nwsClient.getAlerts(latitude, longitude);
      cache.set(cacheKey, alerts, 300000); // 5 minutes
      return alerts;
    } catch (error) {
      logger.warn('Failed to fetch NWS alerts', { error: error.message });
      return [];
    }
  }

  /**
   * Get NWS forecast for a location
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @returns {Promise<Object|null>} Forecast data
   */
  async getNWSForecast(latitude, longitude) {
    if (!config.features.nwsIntegration) {
      return null;
    }

    const cacheKey = `nws:forecast:${latitude}:${longitude}`;

    // Check cache first (1 hour TTL)
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const forecast = await this.nwsClient.getForecast(latitude, longitude);
      if (forecast) {
        cache.set(cacheKey, forecast, 3600000); // 1 hour
      }
      return forecast;
    } catch (error) {
      logger.warn('Failed to fetch NWS forecast', { error: error.message });
      return null;
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return cache.getStats();
  }

  /**
   * Clear all caches
   */
  clearCache() {
    cache.clear();
  }
}

// Create singleton instance
const clientManager = new ClientManager();

export default clientManager;
