/**
 * Input validation utilities
 */

/**
 * Validate station ID format
 * @param {string} stationId - Station ID to validate
 * @returns {boolean} True if valid
 */
export function isValidStationId(stationId) {
  if (!stationId || typeof stationId !== 'string') {
    return false;
  }

  // Remove optional RAWS: prefix
  const normalized = stationId.replace(/^RAWS:/, '');

  // Station IDs are typically 4-6 alphanumeric characters
  return /^[A-Z0-9]{4,6}$/i.test(normalized);
}

/**
 * Validate latitude
 * @param {number} latitude - Latitude to validate
 * @returns {boolean} True if valid
 */
export function isValidLatitude(latitude) {
  return typeof latitude === 'number' &&
         !isNaN(latitude) &&
         latitude >= -90 &&
         latitude <= 90;
}

/**
 * Validate longitude
 * @param {number} longitude - Longitude to validate
 * @returns {boolean} True if valid
 */
export function isValidLongitude(longitude) {
  return typeof longitude === 'number' &&
         !isNaN(longitude) &&
         longitude >= -180 &&
         longitude <= 180;
}

/**
 * Validate coordinates
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @returns {boolean} True if both valid
 */
export function isValidCoordinates(latitude, longitude) {
  return isValidLatitude(latitude) && isValidLongitude(longitude);
}

/**
 * Validate radius (in miles)
 * @param {number} radius - Radius to validate
 * @returns {boolean} True if valid
 */
export function isValidRadius(radius) {
  return typeof radius === 'number' &&
         !isNaN(radius) &&
         radius > 0 &&
         radius <= 500; // Max 500 miles
}

/**
 * Validate date range
 * @param {Date} startTime - Start time
 * @param {Date} endTime - End time
 * @returns {Object} Validation result with `valid` and `error` properties
 */
export function validateDateRange(startTime, endTime) {
  if (!(startTime instanceof Date) || isNaN(startTime.getTime())) {
    return {
      valid: false,
      error: 'Invalid start time'
    };
  }

  if (!(endTime instanceof Date) || isNaN(endTime.getTime())) {
    return {
      valid: false,
      error: 'Invalid end time'
    };
  }

  if (endTime <= startTime) {
    return {
      valid: false,
      error: 'End time must be after start time'
    };
  }

  const now = new Date();
  if (endTime > now) {
    return {
      valid: false,
      error: 'End time cannot be in the future'
    };
  }

  // Check if range is too large (max 1 year)
  const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
  if (endTime.getTime() - startTime.getTime() > maxRange) {
    return {
      valid: false,
      error: 'Date range cannot exceed 1 year'
    };
  }

  return { valid: true };
}

/**
 * Validate temperature (Fahrenheit)
 * @param {number} temperature - Temperature to validate
 * @returns {boolean} True if valid
 */
export function isValidTemperature(temperature) {
  return typeof temperature === 'number' &&
         !isNaN(temperature) &&
         temperature >= -100 &&
         temperature <= 150;
}

/**
 * Validate relative humidity
 * @param {number} humidity - Humidity to validate (0-100)
 * @returns {boolean} True if valid
 */
export function isValidHumidity(humidity) {
  return typeof humidity === 'number' &&
         !isNaN(humidity) &&
         humidity >= 0 &&
         humidity <= 100;
}

/**
 * Validate wind speed (mph)
 * @param {number} windSpeed - Wind speed to validate
 * @returns {boolean} True if valid
 */
export function isValidWindSpeed(windSpeed) {
  return typeof windSpeed === 'number' &&
         !isNaN(windSpeed) &&
         windSpeed >= 0 &&
         windSpeed <= 200; // Max reasonable wind speed
}

/**
 * Validate wind direction (degrees)
 * @param {number} windDirection - Wind direction to validate
 * @returns {boolean} True if valid
 */
export function isValidWindDirection(windDirection) {
  return typeof windDirection === 'number' &&
         !isNaN(windDirection) &&
         windDirection >= 0 &&
         windDirection < 360;
}

/**
 * Sanitize station ID (remove RAWS: prefix, uppercase)
 * @param {string} stationId - Station ID to sanitize
 * @returns {string} Sanitized station ID
 */
export function sanitizeStationId(stationId) {
  if (!stationId) return '';
  return stationId.replace(/^RAWS:/, '').toUpperCase().trim();
}

/**
 * Parse date from various formats
 * @param {string|Date} date - Date to parse
 * @returns {Date|null} Parsed date or null if invalid
 */
export function parseDate(date) {
  if (date instanceof Date) {
    return isNaN(date.getTime()) ? null : date;
  }

  if (typeof date === 'string') {
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

/**
 * Validate and normalize tool input
 * @param {Object} input - Input to validate
 * @param {Object} schema - Validation schema
 * @returns {Object} Result with `valid`, `data`, and `errors` properties
 */
export function validateInput(input, schema) {
  const errors = [];
  const data = {};

  for (const [key, rules] of Object.entries(schema)) {
    const value = input[key];

    // Check required fields
    if (rules.required && (value === undefined || value === null)) {
      errors.push(`${key} is required`);
      continue;
    }

    // Skip validation if not required and not provided
    if (!rules.required && (value === undefined || value === null)) {
      continue;
    }

    // Type validation
    if (rules.type && typeof value !== rules.type) {
      errors.push(`${key} must be of type ${rules.type}`);
      continue;
    }

    // Custom validator
    if (rules.validator && !rules.validator(value)) {
      errors.push(rules.message || `${key} is invalid`);
      continue;
    }

    // Add to validated data
    data[key] = rules.transform ? rules.transform(value) : value;
  }

  return {
    valid: errors.length === 0,
    data,
    errors
  };
}
