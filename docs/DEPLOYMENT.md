# Deployment Guide

> **Purpose:** Production deployment strategies, configuration, and best practices for RAWS MCP server.

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [Environment Configuration](#environment-configuration)
3. [Deployment Methods](#deployment-methods)
4. [Production Considerations](#production-considerations)
5. [Monitoring and Logging](#monitoring-and-logging)
6. [Security](#security)
7. [Performance Optimization](#performance-optimization)
8. [Backup and Recovery](#backup-and-recovery)
9. [Troubleshooting](#troubleshooting)

## Deployment Overview

### Deployment Scenarios

The RAWS MCP server can be deployed in several configurations:

1. **Standalone MCP Server** - Run as a standalone server for Claude Desktop or other MCP clients
2. **Integrated with fire-behavior** - Bundled with fire-behavior application
3. **Microservice** - Part of a larger wildfire management system
4. **Serverless** - Deploy as serverless functions (AWS Lambda, Google Cloud Functions)

### Architecture for Production

```
                    Load Balancer
                          |
          +---------------+---------------+
          |               |               |
     MCP Server 1    MCP Server 2    MCP Server 3
          |               |               |
          +---------------+---------------+
                          |
                    Redis Cache
                          |
          +---------------+---------------+
          |               |               |
     Synoptic API    MesoWest API    NWS API
```

**Key Components**:
- **Load Balancer**: Distribute requests across multiple server instances
- **Redis Cache**: Shared cache for all server instances
- **Multiple Servers**: Horizontal scaling for high availability
- **External APIs**: RAWS data sources

## Environment Configuration

### Production Environment Variables

```bash
# .env.production

# Required: Data Source API Tokens
SYNOPTIC_API_TOKEN=your_production_token_here
MESOWEST_API_TOKEN=your_production_token_here

# Server Configuration
NODE_ENV=production
LOG_LEVEL=info                    # error, warn, info (not debug in prod)
PORT=3000                          # If using HTTP server mode

# Caching Configuration
CACHE_TYPE=redis                   # redis or memory
REDIS_URL=redis://localhost:6379
CACHE_TTL_SECONDS=300             # 5 minutes for observations
CACHE_MAX_SIZE=1000               # Max cached items (memory cache only)
CACHE_CLEANUP_INTERVAL=600        # Cleanup every 10 minutes

# Rate Limiting
MAX_REQUESTS_PER_MINUTE=100
API_RATE_LIMIT_BUFFER=0.8         # Use 80% of API limit

# Feature Flags
ENABLE_NWS_INTEGRATION=true
ENABLE_FIRE_INDICES=true
ENABLE_METRICS=true
ENABLE_HEALTH_CHECKS=true

# Security
API_KEY_REQUIRED=false             # Set true if adding API key auth
CORS_ORIGIN=https://your-app.com   # For HTTP mode
ALLOWED_HOSTS=localhost,your-app.com

# Monitoring
SENTRY_DSN=https://your-sentry-dsn  # Error tracking
NEW_RELIC_LICENSE_KEY=your_key      # Performance monitoring
DATADOG_API_KEY=your_key            # Application monitoring

# Logging
LOG_FORMAT=json                     # json or text
LOG_FILE=/var/log/raws-mcp/app.log
ERROR_LOG_FILE=/var/log/raws-mcp/error.log
```

### Configuration Management

**Use environment-specific files**:
```bash
.env.development    # Local development
.env.staging        # Staging environment
.env.production     # Production environment
```

**Load configuration**:
```javascript
// src/config.js
import dotenv from 'dotenv';
import path from 'path';

// Load environment-specific config
const envFile = `.env.${process.env.NODE_ENV || 'development'}`;
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

export default {
  nodeEnv: process.env.NODE_ENV || 'development',

  // API tokens
  synopticToken: process.env.SYNOPTIC_API_TOKEN,
  mesowestToken: process.env.MESOWEST_API_TOKEN,

  // Server
  port: parseInt(process.env.PORT || '3000'),
  logLevel: process.env.LOG_LEVEL || 'info',

  // Cache
  cache: {
    type: process.env.CACHE_TYPE || 'memory',
    redisUrl: process.env.REDIS_URL,
    ttl: parseInt(process.env.CACHE_TTL_SECONDS || '300'),
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000'),
    cleanupInterval: parseInt(process.env.CACHE_CLEANUP_INTERVAL || '600')
  },

  // Features
  features: {
    nwsIntegration: process.env.ENABLE_NWS_INTEGRATION === 'true',
    fireIndices: process.env.ENABLE_FIRE_INDICES === 'true',
    metrics: process.env.ENABLE_METRICS === 'true',
    healthChecks: process.env.ENABLE_HEALTH_CHECKS === 'true'
  },

  // Security
  security: {
    apiKeyRequired: process.env.API_KEY_REQUIRED === 'true',
    corsOrigin: process.env.CORS_ORIGIN,
    allowedHosts: (process.env.ALLOWED_HOSTS || '').split(',')
  },

  // Monitoring
  monitoring: {
    sentryDsn: process.env.SENTRY_DSN,
    newRelicKey: process.env.NEW_RELIC_LICENSE_KEY,
    datadogKey: process.env.DATADOG_API_KEY
  }
};
```

## Deployment Methods

### 1. PM2 (Recommended for VPS/Dedicated Server)

**Install PM2**:
```bash
npm install -g pm2
```

**Create PM2 ecosystem file**:
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'raws-mcp',
    script: './src/index.js',
    instances: 'max',           // Use all available CPUs
    exec_mode: 'cluster',       // Cluster mode for load balancing
    env_production: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info'
    },
    env_staging: {
      NODE_ENV: 'staging',
      LOG_LEVEL: 'debug'
    },
    error_file: '/var/log/raws-mcp/error.log',
    out_file: '/var/log/raws-mcp/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '500M',  // Restart if memory exceeds 500MB
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

**Deploy with PM2**:
```bash
# Start
pm2 start ecosystem.config.js --env production

# Monitor
pm2 monit

# View logs
pm2 logs raws-mcp

# Restart
pm2 restart raws-mcp

# Stop
pm2 stop raws-mcp

# Auto-start on system boot
pm2 startup
pm2 save
```

### 2. Docker

**Create Dockerfile**:
```dockerfile
# Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --production

# Copy application code
COPY src ./src

# Create log directory
RUN mkdir -p /var/log/raws-mcp

# Set environment
ENV NODE_ENV=production
ENV LOG_LEVEL=info

# Expose port (if using HTTP mode)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "src/index.js"]
```

**Create docker-compose.yml**:
```yaml
# docker-compose.yml
version: '3.8'

services:
  raws-mcp:
    build: .
    container_name: raws-mcp
    restart: unless-stopped
    env_file:
      - .env.production
    volumes:
      - ./logs:/var/log/raws-mcp
    ports:
      - "3000:3000"
    depends_on:
      - redis
    networks:
      - raws-network

  redis:
    image: redis:7-alpine
    container_name: raws-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - raws-network

volumes:
  redis-data:

networks:
  raws-network:
    driver: bridge
```

**Deploy with Docker**:
```bash
# Build image
docker build -t raws-mcp:latest .

# Run with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f raws-mcp

# Stop
docker-compose down

# Update
docker-compose pull
docker-compose up -d
```

### 3. Systemd (Linux Service)

**Create systemd service file**:
```ini
# /etc/systemd/system/raws-mcp.service
[Unit]
Description=RAWS MCP Server
After=network.target

[Service]
Type=simple
User=raws
Group=raws
WorkingDirectory=/opt/raws-mcp
Environment="NODE_ENV=production"
EnvironmentFile=/opt/raws-mcp/.env.production
ExecStart=/usr/bin/node /opt/raws-mcp/src/index.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=raws-mcp

[Install]
WantedBy=multi-user.target
```

**Deploy with systemd**:
```bash
# Create user
sudo useradd -r -s /bin/false raws

# Copy application
sudo mkdir -p /opt/raws-mcp
sudo cp -r . /opt/raws-mcp/
sudo chown -R raws:raws /opt/raws-mcp

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable raws-mcp
sudo systemctl start raws-mcp

# Check status
sudo systemctl status raws-mcp

# View logs
sudo journalctl -u raws-mcp -f

# Restart
sudo systemctl restart raws-mcp
```

### 4. Cloud Platforms

#### AWS (Elastic Beanstalk)

```bash
# Install EB CLI
pip install awsebcli

# Initialize
eb init -p node.js-18 raws-mcp

# Create environment
eb create raws-mcp-prod --envvars SYNOPTIC_API_TOKEN=your_token

# Deploy
eb deploy

# Check status
eb status

# View logs
eb logs
```

#### Google Cloud (Cloud Run)

```bash
# Build and push container
gcloud builds submit --tag gcr.io/YOUR_PROJECT/raws-mcp

# Deploy
gcloud run deploy raws-mcp \
  --image gcr.io/YOUR_PROJECT/raws-mcp \
  --platform managed \
  --region us-central1 \
  --set-env-vars SYNOPTIC_API_TOKEN=your_token

# View logs
gcloud run logs read raws-mcp
```

#### Heroku

```bash
# Login to Heroku
heroku login

# Create app
heroku create raws-mcp

# Set environment variables
heroku config:set SYNOPTIC_API_TOKEN=your_token

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

## Production Considerations

### High Availability

**Load Balancing**:
```nginx
# nginx.conf
upstream raws_mcp {
  least_conn;  # Load balancing method
  server 127.0.0.1:3001;
  server 127.0.0.1:3002;
  server 127.0.0.1:3003;
}

server {
  listen 80;
  server_name api.your-domain.com;

  location / {
    proxy_pass http://raws_mcp;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;

    # Timeouts
    proxy_connect_timeout 10s;
    proxy_send_timeout 30s;
    proxy_read_timeout 30s;
  }
}
```

**Health Checks**:
```javascript
// src/health.js
export async function healthCheck() {
  const checks = {
    server: 'healthy',
    cache: 'unknown',
    externalApis: {}
  };

  try {
    // Check cache
    await cache.get('health-check');
    checks.cache = 'healthy';
  } catch (error) {
    checks.cache = 'unhealthy';
  }

  // Check external APIs
  try {
    const synoptic = await testSynopticAPI();
    checks.externalApis.synoptic = synoptic ? 'healthy' : 'unhealthy';
  } catch (error) {
    checks.externalApis.synoptic = 'unhealthy';
  }

  const allHealthy = Object.values(checks).every(v =>
    typeof v === 'string' ? v === 'healthy' : Object.values(v).every(x => x === 'healthy')
  );

  return {
    status: allHealthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  };
}
```

### Caching Strategy

**Redis Configuration** (production):
```javascript
// src/api/cache-redis.js
import Redis from 'ioredis';
import config from '../config.js';

const redis = new Redis(config.cache.redisUrl, {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3
});

redis.on('error', (error) => {
  logger.error('Redis connection error', { error });
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

export class RedisCache {
  async get(key) {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key, value, ttl) {
    await redis.setex(key, ttl, JSON.stringify(value));
  }

  async del(key) {
    await redis.del(key);
  }

  async clear() {
    await redis.flushdb();
  }
}
```

**Cache TTL Strategy**:
- Current observations: 5 minutes (RAWS updates every 15-60 min)
- Station metadata: 1 hour (rarely changes)
- Historical data: 24 hours (archival, doesn't change)
- NWS alerts: 5 minutes (time-sensitive)
- Fire indices: 10 minutes (calculated from cached observations)

### Rate Limiting

**Implement rate limiting**:
```javascript
// src/utils/rate-limiter.js
import config from '../config.js';

class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  async checkLimit() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds`);
    }

    this.requests.push(now);
  }
}

// Global rate limiters
export const synopticLimiter = new RateLimiter(
  Math.floor(5000 / 1440 * config.apiRateLimitBuffer),  // 5000/day with buffer
  60 * 1000  // 1 minute window
);
```

## Monitoring and Logging

### Structured Logging

**Winston configuration for production**:
```javascript
// src/logger.js
import winston from 'winston';
import config from './config.js';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  config.logFormat === 'json' ? winston.format.json() : winston.format.simple()
);

const logger = winston.createLogger({
  level: config.logLevel,
  format: logFormat,
  defaultMeta: { service: 'raws-mcp' },
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // File output (errors)
    new winston.transports.File({
      filename: config.errorLogFile || 'logs/error.log',
      level: 'error',
      maxsize: 10485760,  // 10MB
      maxFiles: 5
    }),
    // File output (all logs)
    new winston.transports.File({
      filename: config.logFile || 'logs/combined.log',
      maxsize: 10485760,
      maxFiles: 10
    })
  ]
});

export default logger;
```

### Metrics Collection

**Track key metrics**:
```javascript
// src/utils/metrics.js
import logger from '../logger.js';

class Metrics {
  constructor() {
    this.counters = {};
    this.timers = {};
  }

  increment(metric, value = 1) {
    this.counters[metric] = (this.counters[metric] || 0) + value;
  }

  timing(metric, duration) {
    if (!this.timers[metric]) {
      this.timers[metric] = [];
    }
    this.timers[metric].push(duration);
  }

  async report() {
    logger.info('Metrics report', {
      counters: this.counters,
      timers: this.getTimerStats()
    });

    // Reset counters
    this.counters = {};
    this.timers = {};
  }

  getTimerStats() {
    const stats = {};
    for (const [metric, values] of Object.entries(this.timers)) {
      stats[metric] = {
        count: values.length,
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values)
      };
    }
    return stats;
  }
}

export const metrics = new Metrics();

// Report metrics every 60 seconds
setInterval(() => metrics.report(), 60000);
```

### Error Tracking with Sentry

```javascript
// src/monitoring/sentry.js
import * as Sentry from '@sentry/node';
import config from '../config.js';

if (config.monitoring.sentryDsn) {
  Sentry.init({
    dsn: config.monitoring.sentryDsn,
    environment: config.nodeEnv,
    tracesSampleRate: config.nodeEnv === 'production' ? 0.1 : 1.0
  });
}

export function captureException(error, context) {
  Sentry.captureException(error, { extra: context });
}
```

## Security

### API Key Authentication

**Implement API key middleware**:
```javascript
// src/middleware/auth.js
import config from '../config.js';

export function requireApiKey(req, res, next) {
  if (!config.security.apiKeyRequired) {
    return next();
  }

  const apiKey = req.headers['x-api-key'];
  if (!apiKey || !isValidApiKey(apiKey)) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }

  next();
}

function isValidApiKey(key) {
  // Implement key validation (check against database, hash comparison, etc.)
  const validKeys = process.env.API_KEYS?.split(',') || [];
  return validKeys.includes(key);
}
```

### Environment Variable Security

**Never commit sensitive data**:
```bash
# .gitignore
.env
.env.production
.env.staging
.env.local
config/secrets.json
```

**Use secrets management**:
```bash
# AWS Secrets Manager
aws secretsmanager get-secret-value --secret-id raws-mcp/production

# Google Secret Manager
gcloud secrets versions access latest --secret="raws-mcp-config"

# HashiCorp Vault
vault kv get secret/raws-mcp/production
```

### HTTPS/TLS

**Always use HTTPS in production**:
```javascript
// If running HTTP server mode
import https from 'https';
import fs from 'fs';

const options = {
  key: fs.readFileSync('/path/to/private-key.pem'),
  cert: fs.readFileSync('/path/to/certificate.pem')
};

https.createServer(options, app).listen(443);
```

Or use reverse proxy (nginx, Caddy) to terminate TLS.

## Performance Optimization

### Connection Pooling

```javascript
// src/api/base-client.js
import axios from 'axios';
import http from 'http';
import https from 'https';

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000
});

export const apiClient = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 30000
});
```

### Memory Management

```javascript
// Monitor memory usage
setInterval(() => {
  const used = process.memoryUsage();
  logger.debug('Memory usage', {
    rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
    external: `${Math.round(used.external / 1024 / 1024)}MB`
  });
}, 60000);
```

## Backup and Recovery

### Data Backup

**Redis backup**:
```bash
# Create Redis backup
redis-cli --rdb /backup/dump.rdb

# Schedule daily backups
0 2 * * * redis-cli --rdb /backup/dump-$(date +\%Y\%m\%d).rdb
```

**Configuration backup**:
```bash
# Backup scripts
#!/bin/bash
tar -czf /backup/raws-mcp-config-$(date +%Y%m%d).tar.gz \
  .env.production \
  ecosystem.config.js \
  nginx.conf
```

### Disaster Recovery

**Recovery procedures**:
1. Restore configuration files
2. Restore Redis data
3. Verify API tokens are valid
4. Start services
5. Run health checks
6. Monitor logs for errors

## Troubleshooting

### Common Production Issues

**High memory usage**:
```bash
# Check process memory
ps aux | grep node

# Increase max memory (if needed)
NODE_OPTIONS="--max-old-space-size=4096" node src/index.js
```

**API rate limits**:
```bash
# Check current usage
grep "Rate limit" logs/combined.log | wc -l

# Increase cache TTL to reduce API calls
# In .env.production:
CACHE_TTL_SECONDS=600  # 10 minutes
```

**Redis connection issues**:
```bash
# Test Redis connection
redis-cli ping

# Check Redis logs
tail -f /var/log/redis/redis-server.log
```

### Performance Debugging

```bash
# Enable Node.js profiling
node --prof src/index.js

# Analyze profile
node --prof-process isolate-*.log > profile.txt
```

## Deployment Checklist

Before deploying to production:

- [ ] Environment variables configured
- [ ] API tokens valid and secured
- [ ] Redis cache configured (if using)
- [ ] Logging configured (file + console)
- [ ] Error tracking enabled (Sentry, etc.)
- [ ] Health checks implemented
- [ ] Rate limiting configured
- [ ] HTTPS/TLS enabled
- [ ] Firewall rules configured
- [ ] Backup strategy in place
- [ ] Monitoring alerts configured
- [ ] Load testing completed
- [ ] Documentation updated
- [ ] Rollback plan prepared

## References

- [Node.js Production Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Redis Best Practices](https://redis.io/docs/manual/admin/)
- [Nginx Documentation](https://nginx.org/en/docs/)
