/**
 * Unit tests for fire weather calculations
 */

import {
  calculateFosbergFFWI,
  calculateHainesIndex,
  calculateChandlerBurningIndex,
  isRedFlagConditions,
  calculateFireDangerClass
} from '../../../src/utils/calculations.js';

describe('Fosberg Fire Weather Index', () => {
  test('calculates FFWI for typical conditions', () => {
    const ffwi = calculateFosbergFFWI(85, 20, 15);
    expect(ffwi).toBeGreaterThan(0);
    expect(ffwi).toBeLessThan(200);
  });

  test('calculates FFWI for extreme conditions', () => {
    const ffwi = calculateFosbergFFWI(95, 10, 35);
    expect(ffwi).toBeGreaterThan(50);
  });

  test('handles low humidity', () => {
    const ffwi = calculateFosbergFFWI(90, 5, 20);
    expect(ffwi).toBeGreaterThan(0);
  });

  test('returns null for invalid inputs', () => {
    expect(calculateFosbergFFWI(null, 20, 15)).toBeNull();
    expect(calculateFosbergFFWI(85, null, 15)).toBeNull();
    expect(calculateFosbergFFWI(85, 20, null)).toBeNull();
  });
});

describe('Haines Index', () => {
  test('calculates Haines Index for typical conditions', () => {
    const haines = calculateHainesIndex(85, 25, 5000);
    expect(haines).toBeGreaterThanOrEqual(2);
    expect(haines).toBeLessThanOrEqual(6);
  });

  test('higher temperatures increase stability component', () => {
    const low = calculateHainesIndex(70, 40, 5000);
    const high = calculateHainesIndex(95, 40, 5000);
    expect(high).toBeGreaterThanOrEqual(low);
  });

  test('lower humidity increases moisture component', () => {
    const high = calculateHainesIndex(80, 50, 5000);
    const low = calculateHainesIndex(80, 15, 5000);
    expect(low).toBeGreaterThan(high);
  });

  test('returns null for invalid inputs', () => {
    expect(calculateHainesIndex(null, 25, 5000)).toBeNull();
    expect(calculateHainesIndex(85, null, 5000)).toBeNull();
  });
});

describe('Chandler Burning Index', () => {
  test('calculates CBI for typical conditions', () => {
    const cbi = calculateChandlerBurningIndex(85, 20, 8);
    expect(cbi).toBeGreaterThanOrEqual(0);
  });

  test('extreme conditions produce high CBI', () => {
    const cbi = calculateChandlerBurningIndex(100, 8, 3);
    expect(cbi).toBeGreaterThan(70);
  });

  test('uses EMC when fuel moisture not provided', () => {
    const cbi = calculateChandlerBurningIndex(85, 20);
    expect(cbi).toBeGreaterThanOrEqual(0);
  });

  test('returns null for invalid inputs', () => {
    expect(calculateChandlerBurningIndex(null, 20)).toBeNull();
    expect(calculateChandlerBurningIndex(85, null)).toBeNull();
  });
});

describe('Red Flag Conditions', () => {
  test('detects Red Flag conditions (strict)', () => {
    expect(isRedFlagConditions(12, 30, true)).toBe(true);
    expect(isRedFlagConditions(18, 20, true)).toBe(false);
  });

  test('detects Red Flag conditions (relaxed)', () => {
    expect(isRedFlagConditions(12, 30, false)).toBe(true);
    expect(isRedFlagConditions(18, 22, false)).toBe(true);
    expect(isRedFlagConditions(25, 15, false)).toBe(false);
  });

  test('handles invalid inputs', () => {
    expect(isRedFlagConditions(null, 30)).toBe(false);
    expect(isRedFlagConditions(15, null)).toBe(false);
  });
});

describe('Fire Danger Classification', () => {
  test('classifies low fire danger', () => {
    const classification = calculateFireDangerClass({
      temperature: 65,
      relativeHumidity: 60,
      windSpeed: 5
    });
    expect(classification).toBe('Low');
  });

  test('classifies moderate fire danger', () => {
    const classification = calculateFireDangerClass({
      temperature: 75,
      relativeHumidity: 35,
      windSpeed: 10
    });
    expect(['Moderate', 'Low']).toContain(classification);
  });

  test('classifies high fire danger', () => {
    const classification = calculateFireDangerClass({
      temperature: 85,
      relativeHumidity: 20,
      windSpeed: 18
    });
    expect(['High', 'Moderate', 'Very High']).toContain(classification);
  });

  test('classifies extreme fire danger', () => {
    const classification = calculateFireDangerClass({
      temperature: 95,
      relativeHumidity: 8,
      windSpeed: 30
    });
    expect(classification).toBe('Extreme');
  });

  test('uses fuel moisture when provided', () => {
    const classification = calculateFireDangerClass({
      temperature: 85,
      relativeHumidity: 20,
      windSpeed: 15,
      fuelMoisture: 3
    });
    expect(['High', 'Very High', 'Extreme']).toContain(classification);
  });
});
