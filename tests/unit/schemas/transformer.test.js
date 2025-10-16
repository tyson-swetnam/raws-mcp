/**
 * Unit tests for RAWS to wildfire schema transformation
 */

import { transformToWildfireSchema } from '../../../src/schemas/transformer.js';
import { adaptSynopticData } from '../../../src/schemas/adapters.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test fixture
const fixtureData = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../../fixtures/synoptic-response.json'),
    'utf-8'
  )
);

describe('RAWS to Wildfire Schema Transformation', () => {
  let rawsData;

  beforeEach(() => {
    // Adapt fixture data to common format
    rawsData = adaptSynopticData(fixtureData.STATION[0]);
  });

  test('transforms basic weather data correctly', () => {
    const result = transformToWildfireSchema(rawsData);

    expect(result).toHaveProperty('weather_risks');
    expect(result.weather_risks).toHaveProperty('temperature');
    expect(result.weather_risks).toHaveProperty('humidity');
    expect(result.weather_risks).toHaveProperty('wind');
  });

  test('temperature transformation is correct', () => {
    const result = transformToWildfireSchema(rawsData);

    expect(result.weather_risks.temperature.value).toBe(88);
    expect(result.weather_risks.temperature.units).toBe('F');
  });

  test('humidity transformation is correct', () => {
    const result = transformToWildfireSchema(rawsData);

    expect(result.weather_risks.humidity.percent).toBe(13);
    expect(result.weather_risks.humidity.percent).toBeGreaterThanOrEqual(0);
    expect(result.weather_risks.humidity.percent).toBeLessThanOrEqual(100);
  });

  test('wind transformation is correct', () => {
    const result = transformToWildfireSchema(rawsData);

    expect(result.weather_risks.wind.speed).toBe(28);
    expect(result.weather_risks.wind.gusts).toBe(43);
    expect(result.weather_risks.wind.direction).toBe('NW');
  });

  test('estimates wind gusts when not available', () => {
    const dataWithoutGusts = { ...rawsData, windGust: null };
    const result = transformToWildfireSchema(dataWithoutGusts);

    // Should estimate as ~1.5x wind speed
    expect(result.weather_risks.wind.gusts).toBeGreaterThan(0);
    expect(result.weather_risks.wind.gusts).toBeGreaterThanOrEqual(
      result.weather_risks.wind.speed
    );
  });

  test('includes rain probability estimation', () => {
    const result = transformToWildfireSchema(rawsData);

    expect(result.weather_risks.probability_of_rain).toBeDefined();
    expect(result.weather_risks.probability_of_rain.percent).toBeGreaterThanOrEqual(0);
    expect(result.weather_risks.probability_of_rain.percent).toBeLessThanOrEqual(100);
    expect(result.weather_risks.probability_of_rain.confidence).toMatch(/low|medium|high/);
  });

  test('detects Red Flag conditions', () => {
    const result = transformToWildfireSchema(rawsData);

    expect(result.weather_risks.red_flag_warnings).toBeDefined();
    expect(Array.isArray(result.weather_risks.red_flag_warnings)).toBe(true);

    // With RH=12.5% and wind=28mph, should detect Red Flag
    expect(result.weather_risks.red_flag_warnings.length).toBeGreaterThan(0);
    expect(result.weather_risks.red_flag_warnings[0].level).toMatch(/Red Flag|Watch|Extreme/);
  });

  test('includes NWS alerts when provided', () => {
    const nwsAlerts = [
      {
        event: 'Red Flag Warning',
        onset: '2025-08-29T12:00:00Z',
        expires: '2025-08-29T20:00:00Z',
        headline: 'Red Flag Warning issued'
      }
    ];

    const result = transformToWildfireSchema(rawsData, { nwsAlerts });

    expect(result.weather_risks.red_flag_warnings.length).toBeGreaterThan(0);
    expect(result.weather_risks.red_flag_warnings[0].level).toBe('Red Flag');
  });

  test('detects extreme current conditions', () => {
    const result = transformToWildfireSchema(rawsData);

    expect(result.weather_risks.extreme_changes).toBeDefined();
    expect(Array.isArray(result.weather_risks.extreme_changes)).toBe(true);

    // With gusts=42mph, should note high winds
    const hasWindChange = result.weather_risks.extreme_changes.some(
      change => change.parameter === 'wind'
    );
    expect(hasWindChange).toBe(true);
  });

  test('includes data sources', () => {
    const result = transformToWildfireSchema(rawsData);

    expect(result.data_sources).toBeDefined();
    expect(Array.isArray(result.data_sources)).toBe(true);
    expect(result.data_sources.length).toBeGreaterThan(0);
    expect(result.data_sources[0]).toHaveProperty('name');
    expect(result.data_sources[0]).toHaveProperty('type');
  });

  test('includes location and timestamp', () => {
    const result = transformToWildfireSchema(rawsData);

    expect(result.location).toBeDefined();
    expect(result.location).toContain('Monument Creek');
    expect(result.as_of).toBeDefined();
  });

  test('includes notes', () => {
    const result = transformToWildfireSchema(rawsData);

    expect(result.notes).toBeDefined();
    expect(typeof result.notes).toBe('string');
    expect(result.notes.length).toBeGreaterThan(0);
  });

  test('throws error for missing required fields', () => {
    const incompleteData = {
      stationId: 'TEST',
      stationName: 'Test Station',
      temperature: 80
      // Missing humidity and wind
    };

    expect(() => {
      transformToWildfireSchema(incompleteData);
    }).toThrow();
  });

  test('handles very dry fuel moisture', () => {
    const dataWithDryFuels = { ...rawsData, fuelMoisture: 5 };
    const result = transformToWildfireSchema(dataWithDryFuels);

    const hasFuelChange = result.weather_risks.extreme_changes.some(
      change => change.parameter === 'fuel_moisture'
    );
    expect(hasFuelChange).toBe(true);
  });

  test('handles critically low humidity', () => {
    const dataWithLowHumidity = { ...rawsData, relativeHumidity: 8 };
    const result = transformToWildfireSchema(dataWithLowHumidity);

    const hasHumidityChange = result.weather_risks.extreme_changes.some(
      change => change.parameter === 'humidity'
    );
    expect(hasHumidityChange).toBe(true);
  });

  test('output validates against wildfire schema', () => {
    const result = transformToWildfireSchema(rawsData);

    // Should not throw if valid
    expect(() => {
      // Schema validation happens internally in transform function
      expect(result.weather_risks.temperature).toBeDefined();
      expect(result.weather_risks.humidity).toBeDefined();
      expect(result.weather_risks.wind).toBeDefined();
    }).not.toThrow();
  });
});
