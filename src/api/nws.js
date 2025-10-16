import { BaseClient } from './base-client.js';
import logger from '../logger.js';

/**
 * National Weather Service API Client
 * For weather alerts and forecasts
 * API Documentation: https://www.weather.gov/documentation/services-web-api
 */
export class NWSClient extends BaseClient {
  constructor() {
    super('https://api.weather.gov');
    // NWS API doesn't require authentication but requires User-Agent
  }

  /**
   * Check if client is available
   */
  isAvailable() {
    return true; // Always available, no auth required
  }

  /**
   * Get active weather alerts for a point
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @returns {Promise<Array>} Array of active alerts
   */
  async getAlerts(latitude, longitude) {
    logger.info('Fetching alerts from NWS', { latitude, longitude });

    try {
      const data = await this.request({
        url: '/alerts/active',
        method: 'GET',
        params: {
          point: `${latitude},${longitude}`
        }
      });

      if (!data.features || data.features.length === 0) {
        return [];
      }

      return data.features.map(alert => ({
        event: alert.properties.event,
        severity: alert.properties.severity,
        certainty: alert.properties.certainty,
        urgency: alert.properties.urgency,
        headline: alert.properties.headline,
        description: alert.properties.description,
        instruction: alert.properties.instruction,
        onset: alert.properties.onset,
        expires: alert.properties.expires,
        areaDesc: alert.properties.areaDesc
      }));
    } catch (error) {
      logger.warn('Failed to fetch NWS alerts', { error: error.message });
      return [];
    }
  }

  /**
   * Get forecast for a point
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @returns {Promise<Object>} Forecast data
   */
  async getForecast(latitude, longitude) {
    logger.info('Fetching forecast from NWS', { latitude, longitude });

    try {
      // First, get the forecast grid point
      const pointData = await this.request({
        url: `/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`,
        method: 'GET'
      });

      const forecastUrl = pointData.properties.forecast;

      // Then, get the actual forecast
      const forecastData = await this.request({
        url: forecastUrl.replace('https://api.weather.gov', ''),
        method: 'GET'
      });

      if (!forecastData.properties || !forecastData.properties.periods) {
        return null;
      }

      return {
        updated: forecastData.properties.updated,
        periods: forecastData.properties.periods.map(period => ({
          number: period.number,
          name: period.name,
          startTime: period.startTime,
          endTime: period.endTime,
          isDaytime: period.isDaytime,
          temperature: period.temperature,
          temperatureUnit: period.temperatureUnit,
          windSpeed: period.windSpeed,
          windDirection: period.windDirection,
          shortForecast: period.shortForecast,
          detailedForecast: period.detailedForecast,
          probabilityOfPrecipitation: period.probabilityOfPrecipitation?.value || null
        }))
      };
    } catch (error) {
      logger.warn('Failed to fetch NWS forecast', { error: error.message });
      return null;
    }
  }

  /**
   * Check if there are active Red Flag Warnings
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @returns {Promise<boolean>} True if Red Flag Warning is active
   */
  async hasRedFlagWarning(latitude, longitude) {
    const alerts = await this.getAlerts(latitude, longitude);
    return alerts.some(alert =>
      alert.event === 'Red Flag Warning' ||
      alert.event === 'Fire Weather Watch'
    );
  }
}

export default NWSClient;
