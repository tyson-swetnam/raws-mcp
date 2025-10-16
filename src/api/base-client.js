import axios from 'axios';
import logger from '../logger.js';

/**
 * Base HTTP client with retry logic and exponential backoff
 */
export class BaseClient {
  constructor(baseURL, headers = {}) {
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'User-Agent': 'RAWS-MCP-Server/1.0',
        ...headers
      }
    });
  }

  /**
   * Make an HTTP request with automatic retry on failures
   * @param {Object} config - Axios request configuration
   * @param {number} maxRetries - Maximum number of retry attempts
   * @returns {Promise<any>} Response data
   */
  async request(config, maxRetries = 3) {
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        logger.debug('Making HTTP request', {
          url: config.url,
          method: config.method || 'GET',
          attempt: attempt + 1
        });

        const response = await this.client.request(config);

        logger.debug('HTTP request successful', {
          url: config.url,
          status: response.status
        });

        return response.data;
      } catch (error) {
        lastError = error;
        const isLastAttempt = attempt === maxRetries - 1;

        // Determine if we should retry
        const shouldRetry = this._shouldRetry(error);

        if (isLastAttempt || !shouldRetry) {
          logger.error('Request failed', {
            url: config.url,
            method: config.method,
            error: error.message,
            status: error.response?.status,
            attempt: attempt + 1
          });
          throw this._normalizeError(error);
        }

        // Calculate delay based on error type
        const delay = this._getRetryDelay(error, attempt);

        logger.warn('Request failed, retrying', {
          url: config.url,
          attempt: attempt + 1,
          delay,
          reason: error.response?.status || error.code
        });

        await this._sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Determine if an error should trigger a retry
   * @private
   */
  _shouldRetry(error) {
    // Retry on rate limits
    if (error.response?.status === 429) {
      return true;
    }

    // Retry on server errors (5xx)
    if (error.response?.status >= 500) {
      return true;
    }

    // Retry on network errors
    if (error.code === 'ECONNABORTED' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNRESET') {
      return true;
    }

    // Don't retry client errors (4xx except 429)
    return false;
  }

  /**
   * Calculate retry delay based on error type and attempt number
   * @private
   */
  _getRetryDelay(error, attempt) {
    // Rate limited - exponential backoff
    if (error.response?.status === 429) {
      // Check for Retry-After header
      const retryAfter = error.response.headers['retry-after'];
      if (retryAfter) {
        return parseInt(retryAfter, 10) * 1000;
      }
      return Math.pow(2, attempt) * 1000;
    }

    // Server error - exponential backoff
    if (error.response?.status >= 500) {
      return Math.pow(2, attempt) * 1000;
    }

    // Network error - fixed delay
    return 1000;
  }

  /**
   * Normalize errors to a consistent format
   * @private
   */
  _normalizeError(error) {
    if (error.response) {
      // HTTP error response
      return {
        code: `HTTP_${error.response.status}`,
        message: error.response.data?.message || error.message,
        status: error.response.status,
        details: error.response.data
      };
    } else if (error.code) {
      // Network or timeout error
      return {
        code: error.code,
        message: error.message,
        status: 0,
        details: { type: 'network_error' }
      };
    } else {
      // Unknown error
      return {
        code: 'UNKNOWN_ERROR',
        message: error.message,
        status: 0,
        details: {}
      };
    }
  }

  /**
   * Sleep for specified milliseconds
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default BaseClient;
