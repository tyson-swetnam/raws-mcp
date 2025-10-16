/**
 * Unit tests for units.js utilities
 */

import {
  fahrenheitToCelsius,
  celsiusToFahrenheit,
  mphToKmh,
  kmhToMph,
  degreesToCardinal,
  cardinalToDegrees,
  round
} from '../../../src/utils/units.js';

describe('Temperature Conversions', () => {
  test('converts Fahrenheit to Celsius correctly', () => {
    expect(fahrenheitToCelsius(32)).toBeCloseTo(0, 1);
    expect(fahrenheitToCelsius(212)).toBeCloseTo(100, 1);
    expect(fahrenheitToCelsius(98.6)).toBeCloseTo(37, 1);
  });

  test('converts Celsius to Fahrenheit correctly', () => {
    expect(celsiusToFahrenheit(0)).toBeCloseTo(32, 1);
    expect(celsiusToFahrenheit(100)).toBeCloseTo(212, 1);
    expect(celsiusToFahrenheit(37)).toBeCloseTo(98.6, 1);
  });
});

describe('Speed Conversions', () => {
  test('converts mph to kmh correctly', () => {
    expect(mphToKmh(10)).toBeCloseTo(16.09, 1);
    expect(mphToKmh(60)).toBeCloseTo(96.56, 1);
  });

  test('converts kmh to mph correctly', () => {
    expect(kmhToMph(16.09)).toBeCloseTo(10, 1);
    expect(kmhToMph(96.56)).toBeCloseTo(60, 1);
  });
});

describe('Wind Direction Conversions', () => {
  test('converts degrees to cardinal directions', () => {
    expect(degreesToCardinal(0)).toBe('N');
    expect(degreesToCardinal(45)).toBe('NE');
    expect(degreesToCardinal(90)).toBe('E');
    expect(degreesToCardinal(135)).toBe('SE');
    expect(degreesToCardinal(180)).toBe('S');
    expect(degreesToCardinal(225)).toBe('SW');
    expect(degreesToCardinal(270)).toBe('W');
    expect(degreesToCardinal(315)).toBe('NW');
    expect(degreesToCardinal(360)).toBe('N');
  });

  test('handles invalid degrees', () => {
    expect(degreesToCardinal(null)).toBe('Unknown');
    expect(degreesToCardinal(undefined)).toBe('Unknown');
    expect(degreesToCardinal(NaN)).toBe('Unknown');
  });

  test('normalizes degrees outside 0-360', () => {
    expect(degreesToCardinal(-45)).toBe('NW');
    expect(degreesToCardinal(405)).toBe('NE');
  });

  test('converts cardinal to degrees', () => {
    expect(cardinalToDegrees('N')).toBe(0);
    expect(cardinalToDegrees('NE')).toBe(45);
    expect(cardinalToDegrees('E')).toBe(90);
    expect(cardinalToDegrees('S')).toBe(180);
    expect(cardinalToDegrees('W')).toBe(270);
  });

  test('handles case-insensitive cardinal input', () => {
    expect(cardinalToDegrees('n')).toBe(0);
    expect(cardinalToDegrees('ne')).toBe(45);
  });

  test('returns null for invalid cardinal', () => {
    expect(cardinalToDegrees('INVALID')).toBeNull();
  });
});

describe('Rounding', () => {
  test('rounds to specified decimal places', () => {
    expect(round(3.14159, 0)).toBe(3);
    expect(round(3.14159, 2)).toBe(3.14);
    expect(round(3.14159, 4)).toBe(3.1416);
  });

  test('handles default rounding (0 decimals)', () => {
    expect(round(3.7)).toBe(4);
    expect(round(3.2)).toBe(3);
  });
});
