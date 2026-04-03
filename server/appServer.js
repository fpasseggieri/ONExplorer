const crypto = require('crypto');
const express = require('express');
const path = require('path');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const buildDir = path.join(__dirname, '..', 'build');

app.set('trust proxy', true);

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', '*');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

app.use(express.json({
  limit: '10mb',
  type: ['application/json', 'application/ld+json', 'application/*+json'],
  strict: false
}));

app.use(express.urlencoded({
  extended: true,
  limit: '10mb'
}));

const clients = new Set();

const trimTrailingSlash = (value) => String(value || '').trim().replace(/\/+$/, '');

const getPublicAppUrl = (req) => {
  const configuredUrl = trimTrailingSlash(process.env.ONEXPLORER_PUBLIC_URL);
  if (configuredUrl) {
    return configuredUrl;
  }

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const protocol = forwardedProto || req.protocol || 'http';
  const host = forwardedHost || req.get('host') || `localhost:${PORT}`;

  return `${protocol}://${host}`;
};

const getRuntimeEnv = () => ({
  REACT_APP_KEYCLOAK_URL: String(process.env.REACT_APP_KEYCLOAK_URL || ''),
  REACT_APP_KEYCLOAK_REALM: String(process.env.REACT_APP_KEYCLOAK_REALM || ''),
  REACT_APP_KEYCLOAK_CLIENT_ID: String(process.env.REACT_APP_KEYCLOAK_CLIENT_ID || ''),
  REACT_APP_DEFAULT_BASE_URL: String(process.env.REACT_APP_DEFAULT_BASE_URL || ''),
  REACT_APP_ENFORCE_DEFAULT_BASE_URL: String(process.env.REACT_APP_ENFORCE_DEFAULT_BASE_URL || '')
});

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/env.js', (req, res) => {
  res.type('application/javascript');
  res.setHeader('Cache-Control', 'no-store');
  res.send(`window.__ENV__ = ${JSON.stringify(getRuntimeEnv())};`);
});

app.get('/notifyServer', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  res.write('data: Connected to event stream\n\n');

  const keepAlive = setInterval(() => {
    res.write(':\n\n');
  }, 30000);

  clients.add(res);

  req.on('close', () => {
    clients.delete(res);
    clearInterval(keepAlive);
    console.log('Client disconnected');
  });

  console.log('Client connected');
});

app.post('/notifications', (req, res) => {
  const message = req.body;

  if (!message) {
    return res.status(400).send('No message body');
  }

  clients.forEach((client) => {
    client.write(`data: ${JSON.stringify(message)}\n\n`);
  });

  console.log('Notification sent:', message);
  res.status(200).send('Notification sent');
});

app.get('/subscriptions', (req, res) => {
  const { topicType, topic } = req.query;
  const subscriptionId = crypto.randomUUID();

  res.json({
    '@context': {
      cargo: 'https://onerecord.iata.org/ns/cargo#',
      api: 'https://onerecord.iata.org/ns/api#'
    },
    '@id': `${getPublicAppUrl(req)}/subscriptions/${subscriptionId}`,
    '@type': 'api:Subscription',
    'api:hasContentType': 'application/ld+json',
    'api:hasSubscriber': {
      '@id': getPublicAppUrl(req)
    },
    'api:hasTopicType': {
      '@id': topicType
    },
    'api:includeSubscriptionEventType': [
      {
        '@id': 'api:LOGISTICS_OBJECT_UPDATED'
      },
      {
        '@id': 'api:LOGISTICS_OBJECT_CREATED'
      },
      {
        '@id': 'api:LOGISTICS_EVENT_RECEIVED'
      }
    ],
    'api:hasTopic': {
      '@type': 'http://www.w3.org/2001/XMLSchema#anyURI',
      '@value': topic
    }
  });
});

app.use(express.static(buildDir, { index: false }));

app.get('*', (req, res) => {
  res.sendFile(path.join(buildDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`ONExplorer server running on port ${PORT}`);
});

module.exports = app;
