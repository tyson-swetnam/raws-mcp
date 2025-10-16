/**
 * Jest setup file
 * Runs before all tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce logging noise in tests
process.env.SYNOPTIC_API_TOKEN = 'test_token';
process.env.CACHE_TTL_SECONDS = '60';
process.env.ENABLE_NWS_INTEGRATION = 'false';
process.env.ENABLE_FIRE_INDICES = 'true';

// Global test timeout
jest.setTimeout(10000);
