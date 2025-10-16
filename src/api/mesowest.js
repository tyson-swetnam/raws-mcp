import { BaseClient } from './base-client.js';
import config from '../config.js';
import logger from '../logger.js';

/**
 * MesoWest API Client
 * Backup/failover RAWS data source
 * API Documentation: https://mesowest.utah.edu/
 */
export class MesoWestClient extends BaseClient {
  constructor() {
    super('https://api.mesowest.net/v2');
    this.token = config.mesowestToken;

    if (!this.token) {
      logger.warn('MesoWest API token not configured');
    }
  }

  /**
   * Check if client is available (has valid token)
   */
  isAvailable() {
    return Boolean(this.token);
  }

  /**
   * Get current observations for a station
   * @param {string} stationId - RAWS station ID
   * @returns {Promise<Object>} Station observation data
   */
  async getCurrentObservation(stationId) {
    if (!this.isAvailable()) {
      throw new Error('MesoWest API token not configured');
    }

    const normalizedId = this._normalizeStationId(stationId);

    logger.info('Fetching current observation from MesoWest', {
      stationId: normalizedId
    });

    const data = await this.request({
      url: '/stations/latest',
      method: 'GET',
      params: {
        token: this.token,
        stid: normalizedId,
        units: 'english',
        obtimezone: 'UTC'
      }
    });

    if (!data.STATION || data.STATION.length === 0) {
      throw {
        code: 'STATION_NOT_FOUND',
        message: `Station ${stationId} not found`,
        status: 404,
        details: { stationId }
      };
    }

    return data.STATION[0];
  }

  /**
   * Search for stations near a location
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @param {number} radius - Search radius in miles
   * @param {number} limit - Maximum number of results
   * @returns {Promise<Array>} Array of station metadata
   */
  async searchStations(latitude, longitude, radius = 50, limit = 10) {
    if (!this.isAvailable()) {
      throw new Error('MesoWest API token not configured');
    }

    logger.info('Searching stations from MesoWest', {
      latitude,
      longitude,
      radius,
      limit
    });

    const data = await this.request({
      url: '/stations/metadata',
      method: 'GET',
      params: {
        token: this.token,
        radius: `${latitude},${longitude},${radius}`,
        limit,
        network: '1,2', // RAWS networks
        status: 'active'
      }
    });

    if (!data.STATION || data.STATION.length === 0) {
      return [];
    }

    return data.STATION.map(station => this._normalizeStationMetadata(station));
  }

  /**
   * Get historical observations for a station
   * @param {string} stationId - RAWS station ID
   * @param {Date} startTime - Start time
   * @param {Date} endTime - End time
   * @param {Array<string>} variables - Specific variables to retrieve (optional)
   * @returns {Promise<Object>} Historical data
   */
  async getHistoricalObservations(stationId, startTime, endTime, variables = null) {
    if (!this.isAvailable()) {
      throw new Error('MesoWest API token not configured');
    }

    const normalizedId = this._normalizeStationId(stationId);

    logger.info('Fetching historical data from MesoWest', {
      stationId: normalizedId,
      startTime,
      endTime
    });

    const params = {
      token: this.token,
      stid: normalizedId,
      start: this._formatDate(startTime),
      end: this._formatDate(endTime),
      units: 'english',
      obtimezone: 'UTC'
    };

    if (variables && variables.length > 0) {
      params.vars = variables.join(',');
    }

    const data = await this.request({
      url: '/stations/timeseries',
      method: 'GET',
      params
    });

    if (!data.STATION || data.STATION.length === 0) {
      throw {
        code: 'STATION_NOT_FOUND',
        message: `Station ${stationId} not found`,
        status: 404,
        details: { stationId }
      };
    }

    return data.STATION[0];
  }

  /**
   * Normalize station ID (remove RAWS: prefix if present)
   * @private
   */
  _normalizeStationId(stationId) {
    return stationId.replace(/^RAWS:/, '');
  }

  /**
   * Format date for MesoWest API (YYYYMMDDHHmm)
   * @private
   */
  _formatDate(date) {
    const d = new Date(date);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const hour = String(d.getUTCHours()).padStart(2, '0');
    const minute = String(d.getUTCMinutes()).padStart(2, '0');
    return `${year}${month}${day}${hour}${minute}`;
  }

  /**
   * Normalize station metadata to common format
   * @private
   */
  _normalizeStationMetadata(station) {
    return {
      id: station.STID,
      name: station.NAME,
      latitude: parseFloat(station.LATITUDE),
      longitude: parseFloat(station.LONGITUDE),
      elevation: parseFloat(station.ELEVATION),
      state: station.STATE,
      timezone: station.TIMEZONE,
      status: station.STATUS,
      network: station.MNET_SHORTNAME
    };
  }
}

export default MesoWestClient;
