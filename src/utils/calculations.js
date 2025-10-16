/**
 * Fire weather calculations
 * References:
 * - NFDRS: https://www.nwcg.gov/publications/pms437
 * - Fosberg FFWI: https://www.fs.usda.gov/research/treesearch/4442
 * - Haines Index: https://www.weather.gov/source/zhu/ZHU_Training_Page/turbulence_stuff/haines/haines.htm
 */

/**
 * Calculate Fosberg Fire Weather Index (FFWI)
 * Combines temperature, relative humidity, and wind speed
 *
 * @param {number} temperature - Temperature in Fahrenheit
 * @param {number} relativeHumidity - Relative humidity (0-100%)
 * @param {number} windSpeed - Wind speed in mph
 * @returns {number} FFWI value (0-100+)
 */
export function calculateFosbergFFWI(temperature, relativeHumidity, windSpeed) {
  // Validate inputs
  if (temperature == null || relativeHumidity == null || windSpeed == null) {
    return null;
  }

  // Ensure values are in valid ranges
  relativeHumidity = Math.max(1, Math.min(100, relativeHumidity));
  windSpeed = Math.max(0, windSpeed);

  // Calculate equilibrium moisture content (EMC)
  const emc = calculateEquilibriumMoistureContent(temperature, relativeHumidity);

  // Calculate moisture damping coefficient (η)
  let eta;
  if (emc <= 10) {
    eta = 0.03229 + 0.281073 * emc - 0.000578 * emc * temperature;
  } else {
    eta = 2.22749 + 0.160107 * emc - 0.01478 * temperature;
  }

  // FFWI = η × √(1 + U²)
  // Where U is wind speed
  const ffwi = eta * Math.sqrt(1 + windSpeed * windSpeed);

  return Math.round(ffwi);
}

/**
 * Calculate Equilibrium Moisture Content (EMC)
 * Used in Fosberg FFWI calculation
 *
 * @param {number} temperature - Temperature in Fahrenheit
 * @param {number} relativeHumidity - Relative humidity (0-100%)
 * @returns {number} EMC percentage
 */
export function calculateEquilibriumMoistureContent(temperature, relativeHumidity) {
  // EMC calculation from NFDRS
  const rh = relativeHumidity / 100;

  if (rh >= 0.1 && rh <= 1.0) {
    const term1 = 0.942 * Math.pow(rh, 0.679);
    const term2 = (0.000499 * Math.exp(0.1 * rh)) + 0.18 * (21.1 - temperature) * (1 - Math.exp(-0.115 * rh));
    return term1 + term2;
  }

  return 0;
}

/**
 * Calculate Haines Index (atmospheric stability and dryness aloft)
 * Note: Requires upper-air data which may not be available from RAWS
 * This is a simplified estimation based on surface conditions
 *
 * Haines Index ranges:
 * 2-3: Low potential
 * 4: Moderate potential
 * 5-6: High potential for extreme fire behavior
 *
 * @param {number} temperature - Surface temperature in Fahrenheit
 * @param {number} relativeHumidity - Surface relative humidity (0-100%)
 * @param {number} elevation - Station elevation in feet
 * @returns {number|null} Haines Index (2-6) or null if cannot be calculated
 */
export function calculateHainesIndex(temperature, relativeHumidity, elevation) {
  // This is a simplified estimation
  // True Haines Index requires 850mb and 700mb temperature and dewpoint
  // We'll provide a rough approximation based on surface conditions

  if (temperature == null || relativeHumidity == null) {
    return null;
  }

  // Estimate stability component based on temperature
  let stabilityComponent;
  if (temperature >= 90) {
    stabilityComponent = 3;
  } else if (temperature >= 75) {
    stabilityComponent = 2;
  } else {
    stabilityComponent = 1;
  }

  // Estimate moisture component based on RH
  let moistureComponent;
  if (relativeHumidity <= 20) {
    moistureComponent = 3;
  } else if (relativeHumidity <= 40) {
    moistureComponent = 2;
  } else {
    moistureComponent = 1;
  }

  return stabilityComponent + moistureComponent;
}

/**
 * Calculate Chandler Burning Index (CBI)
 * Combines temperature, relative humidity, and fuel moisture
 *
 * CBI ranges:
 * 0-50: Low fire danger
 * 50-75: Moderate fire danger
 * 75-90: High fire danger
 * 90+: Extreme fire danger
 *
 * @param {number} temperature - Temperature in Fahrenheit
 * @param {number} relativeHumidity - Relative humidity (0-100%)
 * @param {number} fuelMoisture - 10-hour fuel moisture percentage (optional)
 * @returns {number} CBI value
 */
export function calculateChandlerBurningIndex(temperature, relativeHumidity, fuelMoisture = null) {
  if (temperature == null || relativeHumidity == null) {
    return null;
  }

  // If fuel moisture not provided, estimate from EMC
  if (fuelMoisture == null) {
    fuelMoisture = calculateEquilibriumMoistureContent(temperature, relativeHumidity);
  }

  // CBI formula
  // CBI = ((110 - 1.373 * RH) - 0.54 * (10.20 - T)) * (124 * 10^(-0.0142 * FM))
  const term1 = (110 - 1.373 * relativeHumidity) - 0.54 * (10.20 - (temperature - 32) * 5/9);
  const term2 = 124 * Math.pow(10, -0.0142 * fuelMoisture);
  const cbi = term1 * term2 / 60; // Scale factor

  return Math.max(0, Math.round(cbi));
}

/**
 * Estimate 10-hour fuel moisture from temperature and RH
 * 10-hour fuels are dead fuels with diameter of 0.25 to 1 inch
 *
 * @param {number} temperature - Temperature in Fahrenheit
 * @param {number} relativeHumidity - Relative humidity (0-100%)
 * @returns {number} Estimated fuel moisture percentage
 */
export function estimate10HourFuelMoisture(temperature, relativeHumidity) {
  // Use EMC as approximation for 10-hour fuel moisture
  return calculateEquilibriumMoistureContent(temperature, relativeHumidity);
}

/**
 * Check if conditions meet Red Flag Warning criteria
 * Criteria vary by region, but typically:
 * - RH < 15% AND wind > 25 mph
 * OR
 * - RH < 20% AND wind > 20 mph (in some regions)
 *
 * @param {number} relativeHumidity - Relative humidity (0-100%)
 * @param {number} windSpeed - Wind speed in mph
 * @param {boolean} strict - Use strict criteria (default: false)
 * @returns {boolean} True if conditions meet Red Flag criteria
 */
export function isRedFlagConditions(relativeHumidity, windSpeed, strict = false) {
  if (relativeHumidity == null || windSpeed == null) {
    return false;
  }

  if (strict) {
    // Strict criteria
    return relativeHumidity < 15 && windSpeed > 25;
  } else {
    // Relaxed criteria
    return (relativeHumidity < 15 && windSpeed > 25) ||
           (relativeHumidity < 20 && windSpeed > 20);
  }
}

/**
 * Calculate fire danger class based on multiple factors
 * Returns classification: Low, Moderate, High, Very High, Extreme
 *
 * @param {Object} conditions - Weather conditions
 * @param {number} conditions.temperature - Temperature in Fahrenheit
 * @param {number} conditions.relativeHumidity - Relative humidity (0-100%)
 * @param {number} conditions.windSpeed - Wind speed in mph
 * @param {number} conditions.fuelMoisture - 10-hour fuel moisture (optional)
 * @returns {string} Fire danger class
 */
export function calculateFireDangerClass(conditions) {
  const { temperature, relativeHumidity, windSpeed, fuelMoisture } = conditions;

  // Calculate indices
  const ffwi = calculateFosbergFFWI(temperature, relativeHumidity, windSpeed);
  const cbi = calculateChandlerBurningIndex(temperature, relativeHumidity, fuelMoisture);

  // Check for extreme conditions
  if (relativeHumidity < 10 || (fuelMoisture && fuelMoisture < 5)) {
    return 'Extreme';
  }

  if (isRedFlagConditions(relativeHumidity, windSpeed)) {
    return 'Extreme';
  }

  // Use CBI for classification
  if (cbi >= 90) {
    return 'Extreme';
  } else if (cbi >= 75) {
    return 'Very High';
  } else if (cbi >= 50) {
    return 'High';
  } else if (cbi >= 25) {
    return 'Moderate';
  } else {
    return 'Low';
  }
}

/**
 * Estimate probability of fire ignition based on conditions
 * Returns probability as percentage (0-100)
 *
 * @param {Object} conditions - Weather conditions
 * @returns {number} Ignition probability (0-100)
 */
export function estimateIgnitionProbability(conditions) {
  const { temperature, relativeHumidity, windSpeed } = conditions;

  let probability = 0;

  // Temperature factor (higher temp = higher probability)
  if (temperature >= 95) probability += 30;
  else if (temperature >= 85) probability += 20;
  else if (temperature >= 75) probability += 10;

  // Humidity factor (lower RH = higher probability)
  if (relativeHumidity <= 10) probability += 40;
  else if (relativeHumidity <= 20) probability += 30;
  else if (relativeHumidity <= 30) probability += 20;
  else if (relativeHumidity <= 40) probability += 10;

  // Wind factor (moderate wind increases probability)
  if (windSpeed >= 20) probability += 20;
  else if (windSpeed >= 10) probability += 10;
  else if (windSpeed >= 5) probability += 5;

  return Math.min(100, probability);
}
