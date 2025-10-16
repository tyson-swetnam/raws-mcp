/**
 * Unit conversion utilities
 */

/**
 * Convert Fahrenheit to Celsius
 * @param {number} fahrenheit - Temperature in Fahrenheit
 * @returns {number} Temperature in Celsius
 */
export function fahrenheitToCelsius(fahrenheit) {
  return (fahrenheit - 32) * 5 / 9;
}

/**
 * Convert Celsius to Fahrenheit
 * @param {number} celsius - Temperature in Celsius
 * @returns {number} Temperature in Fahrenheit
 */
export function celsiusToFahrenheit(celsius) {
  return (celsius * 9 / 5) + 32;
}

/**
 * Convert miles per hour to kilometers per hour
 * @param {number} mph - Speed in miles per hour
 * @returns {number} Speed in kilometers per hour
 */
export function mphToKmh(mph) {
  return mph * 1.60934;
}

/**
 * Convert kilometers per hour to miles per hour
 * @param {number} kmh - Speed in kilometers per hour
 * @returns {number} Speed in miles per hour
 */
export function kmhToMph(kmh) {
  return kmh / 1.60934;
}

/**
 * Convert degrees to 16-point cardinal direction
 * @param {number} degrees - Wind direction in degrees (0-360)
 * @returns {string} Cardinal direction (N, NNE, NE, ENE, E, ESE, SE, SSE, S, SSW, SW, WSW, W, WNW, NW, NNW)
 */
export function degreesToCardinal(degrees) {
  if (degrees == null || isNaN(degrees)) {
    return 'Unknown';
  }

  // Normalize to 0-360
  degrees = degrees % 360;
  if (degrees < 0) degrees += 360;

  const directions = [
    'N', 'NNE', 'NE', 'ENE',
    'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW',
    'W', 'WNW', 'NW', 'NNW'
  ];

  // Each direction covers 22.5 degrees (360 / 16)
  // Add 11.25 to shift the boundaries so N is centered at 0/360
  const index = Math.round((degrees + 11.25) / 22.5) % 16;

  return directions[index];
}

/**
 * Convert cardinal direction to degrees (approximate center of range)
 * @param {string} cardinal - Cardinal direction
 * @returns {number|null} Degrees (0-360) or null if invalid
 */
export function cardinalToDegrees(cardinal) {
  const directions = {
    'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5,
    'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5,
    'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5,
    'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5
  };

  return directions[cardinal.toUpperCase()] ?? null;
}

/**
 * Convert meters to feet
 * @param {number} meters - Distance in meters
 * @returns {number} Distance in feet
 */
export function metersToFeet(meters) {
  return meters * 3.28084;
}

/**
 * Convert feet to meters
 * @param {number} feet - Distance in feet
 * @returns {number} Distance in meters
 */
export function feetToMeters(feet) {
  return feet / 3.28084;
}

/**
 * Convert inches to millimeters
 * @param {number} inches - Distance in inches
 * @returns {number} Distance in millimeters
 */
export function inchesToMillimeters(inches) {
  return inches * 25.4;
}

/**
 * Convert millimeters to inches
 * @param {number} millimeters - Distance in millimeters
 * @returns {number} Distance in inches
 */
export function millimetersToInches(millimeters) {
  return millimeters / 25.4;
}

/**
 * Round number to specified decimal places
 * @param {number} value - Number to round
 * @param {number} decimals - Number of decimal places
 * @returns {number} Rounded number
 */
export function round(value, decimals = 0) {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}
