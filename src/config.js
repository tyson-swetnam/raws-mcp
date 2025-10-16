import dotenv from 'dotenv';

dotenv.config();

const config = {
  synopticToken: process.env.SYNOPTIC_API_TOKEN,
  mesowestToken: process.env.MESOWEST_API_TOKEN,
  logLevel: process.env.LOG_LEVEL || 'info',
  cacheTTL: parseInt(process.env.CACHE_TTL_SECONDS || '300', 10),
  cacheMaxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000', 10),
  cacheCleanupInterval: parseInt(process.env.CACHE_CLEANUP_INTERVAL || '600', 10),
  maxRequestsPerMinute: parseInt(process.env.MAX_REQUESTS_PER_MINUTE || '100', 10),
  features: {
    nwsIntegration: process.env.ENABLE_NWS_INTEGRATION !== 'false',
    fireIndices: process.env.ENABLE_FIRE_INDICES !== 'false'
  }
};

// Validation: At least one API token must be provided
if (!config.synopticToken && !config.mesowestToken) {
  throw new Error(
    'Configuration error: At least one API token (SYNOPTIC_API_TOKEN or MESOWEST_API_TOKEN) must be configured. ' +
    'Please check your .env file or environment variables.'
  );
}

export default config;
