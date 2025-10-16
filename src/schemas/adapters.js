/**
 * Source-specific adapters for RAWS data
 * Extracts values from API-specific response formats
 */

/**
 * Extract observation value from Synoptic/MesoWest format
 * @param {Object} observation - Observation object with value array
 * @param {number} index - Index in value array (default: 0 for latest)
 * @returns {number|null} Extracted value or null
 */
function extractValue(observation, index = 0) {
  if (!observation || !observation.value || !Array.isArray(observation.value)) {
    return null;
  }
  const value = observation.value[index];
  return (value !== null && value !== undefined && !isNaN(value)) ? value : null;
}

/**
 * Adapt Synoptic Data API response to common format
 * @param {Object} station - STATION object from Synoptic API
 * @returns {Object} Normalized observation data
 */
export function adaptSynopticData(station) {
  if (!station || !station.OBSERVATIONS) {
    throw new Error('Invalid Synoptic station data');
  }

  const obs = station.OBSERVATIONS;

  return {
    stationId: station.STID,
    stationName: station.NAME,
    latitude: parseFloat(station.LATITUDE),
    longitude: parseFloat(station.LONGITUDE),
    elevation: parseFloat(station.ELEVATION),
    state: station.STATE,
    timezone: station.TIMEZONE,
    timestamp: obs.date_time?.[0] || new Date().toISOString(),
    temperature: extractValue(obs.air_temp_value_1),
    relativeHumidity: extractValue(obs.relative_humidity_value_1),
    windSpeed: extractValue(obs.wind_speed_value_1),
    windGust: extractValue(obs.wind_gust_value_1),
    windDirection: extractValue(obs.wind_direction_value_1),
    precipAccum: extractValue(obs.precip_accum_value_1),
    fuelMoisture: extractValue(obs.fuel_moisture_value_1),
    solarRadiation: extractValue(obs.solar_radiation_value_1),
    pressure: extractValue(obs.pressure_value_1),
    source: 'synoptic'
  };
}

/**
 * Adapt MesoWest API response to common format
 * @param {Object} station - STATION object from MesoWest API
 * @returns {Object} Normalized observation data
 */
export function adaptMesoWestData(station) {
  // MesoWest uses the same format as Synoptic (same parent organization)
  const adapted = adaptSynopticData(station);
  adapted.source = 'mesowest';
  return adapted;
}

/**
 * Adapt generic RAWS data to common format
 * Detects source and uses appropriate adapter
 * @param {Object} station - STATION object from any RAWS API
 * @param {string} source - Source identifier (optional, will auto-detect)
 * @returns {Object} Normalized observation data
 */
export function adaptRawsData(station, source = null) {
  if (!station) {
    throw new Error('Invalid station data');
  }

  // Auto-detect source if not provided
  if (!source) {
    // Both Synoptic and MesoWest use similar structure
    // Default to Synoptic adapter
    source = 'synoptic';
  }

  switch (source.toLowerCase()) {
    case 'synoptic':
      return adaptSynopticData(station);
    case 'mesowest':
      return adaptMesoWestData(station);
    default:
      return adaptSynopticData(station);
  }
}

/**
 * Extract time series data from historical observations
 * @param {Object} station - STATION object with time series
 * @returns {Array} Array of observations with timestamps
 */
export function extractTimeSeries(station) {
  if (!station || !station.OBSERVATIONS) {
    return [];
  }

  const obs = station.OBSERVATIONS;
  const timestamps = obs.date_time || [];

  if (timestamps.length === 0) {
    return [];
  }

  const series = [];

  for (let i = 0; i < timestamps.length; i++) {
    series.push({
      timestamp: timestamps[i],
      temperature: extractValue(obs.air_temp_value_1, i),
      relativeHumidity: extractValue(obs.relative_humidity_value_1, i),
      windSpeed: extractValue(obs.wind_speed_value_1, i),
      windGust: extractValue(obs.wind_gust_value_1, i),
      windDirection: extractValue(obs.wind_direction_value_1, i),
      precipAccum: extractValue(obs.precip_accum_value_1, i),
      fuelMoisture: extractValue(obs.fuel_moisture_value_1, i)
    });
  }

  return series;
}

export default {
  adaptSynopticData,
  adaptMesoWestData,
  adaptRawsData,
  extractTimeSeries
};
