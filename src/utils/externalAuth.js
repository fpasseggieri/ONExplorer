import { getRoleStorageItem } from './roleStorage';

const TOKEN_REFRESH_BUFFER_SECONDS = 30;

const tokenCache = new Map();
const pendingRequests = new Map();

const trimValue = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeServer = (server) => {
  if (!server || typeof server !== 'object') {
    return null;
  }

  return {
    ...server,
    id: trimValue(server.id),
    name: trimValue(server.name),
    baseUrl: trimValue(server.baseUrl),
    oauthTokenEndpoint: trimValue(server.oauthTokenEndpoint),
    oauthClientId: trimValue(server.oauthClientId),
    oauthClientSecret: trimValue(server.oauthClientSecret),
    token: trimValue(server.token)
  };
};

const getServers = () => {
  const raw = getRoleStorageItem('externalServers');
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((server) => normalizeServer(server))
      .filter(Boolean);
  } catch {
    return [];
  }
};

export const getExternalServerById = (id) => {
  const normalizedId = trimValue(id);
  if (!normalizedId) return null;

  return getServers().find((server) => server.id === normalizedId) || null;
};

export const getExternalServerByBaseUrl = (baseUrl) => {
  const normalizedBaseUrl = trimValue(baseUrl);
  if (!normalizedBaseUrl) return null;

  return getServers().find((server) => server.baseUrl === normalizedBaseUrl) || null;
};

const getCacheKey = (server) => server.id || server.baseUrl;

const getTokenProxyUrl = () => {
  if (typeof window === 'undefined') {
    return '/external-oauth-token';
  }

  const currentUrl = new URL(window.location.href);
  const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(currentUrl.hostname);
  const currentPort = Number(currentUrl.port);

  if (process.env.NODE_ENV === 'development' && isLocalHost && currentPort) {
    currentUrl.port = String(currentPort + 1);
    currentUrl.pathname = '/external-oauth-token';
    currentUrl.search = '';
    currentUrl.hash = '';
    return currentUrl.toString();
  }

  return new URL('/external-oauth-token', window.location.origin).toString();
};

const getCachedToken = (cacheKey) => {
  const cached = tokenCache.get(cacheKey);
  if (!cached) {
    return '';
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (cached.expiresAt > nowSeconds + TOKEN_REFRESH_BUFFER_SECONDS) {
    return cached.token;
  }

  tokenCache.delete(cacheKey);
  return '';
};

const requestToken = async (server) => {
  let response;

  try {
    response = await fetch(getTokenProxyUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tokenEndpoint: server.oauthTokenEndpoint,
        clientId: server.oauthClientId,
        clientSecret: server.oauthClientSecret
      })
    });
  } catch (error) {
    throw new Error(`Failed to reach OAuth token proxy for ${server.name || server.baseUrl}: ${error.message}`);
  }

  if (!response.ok) {
    let message = '';
    try {
      const payload = await response.json();
      const attemptedEndpoints = Array.isArray(payload?.attemptedEndpoints)
        ? payload.attemptedEndpoints.filter(Boolean)
        : [];
      message = payload.message || payload.error || '';
      if (attemptedEndpoints.length > 0) {
        message = `${message} (attempted: ${attemptedEndpoints.join(', ')})`;
      }
    } catch {
      message = await response.text();
    }

    throw new Error(`Failed to fetch OAuth token for ${server.name || server.baseUrl}: ${response.status}${message ? ` - ${message}` : ''}`);
  }

  const payload = await response.json();
  const accessToken = trimValue(payload.access_token);
  const expiresIn = Number(payload.expires_in || 300);

  if (!accessToken) {
    throw new Error(`Token endpoint did not return access_token for ${server.name || server.baseUrl}`);
  }

  const cacheKey = getCacheKey(server);
  const nowSeconds = Math.floor(Date.now() / 1000);
  tokenCache.set(cacheKey, {
    token: accessToken,
    expiresAt: nowSeconds + Math.max(60, expiresIn)
  });

  return accessToken;
};

export const getExternalAccessToken = async (serverOrBaseUrl) => {
  let server = null;

  if (typeof serverOrBaseUrl === 'string') {
    server = getExternalServerByBaseUrl(serverOrBaseUrl);
  } else {
    server = normalizeServer(serverOrBaseUrl);
  }

  if (!server) {
    throw new Error('External server configuration not found');
  }

  // Backward compatibility for previously saved static token configuration.
  if (server.token && !server.oauthTokenEndpoint) {
    return server.token;
  }

  if (!server.oauthTokenEndpoint || !server.oauthClientId || !server.oauthClientSecret) {
    throw new Error(`Incomplete OAuth configuration for ${server.name || server.baseUrl}`);
  }

  const cacheKey = getCacheKey(server);
  const cachedToken = getCachedToken(cacheKey);
  if (cachedToken) {
    return cachedToken;
  }

  const pending = pendingRequests.get(cacheKey);
  if (pending) {
    return pending;
  }

  const request = requestToken(server).finally(() => {
    pendingRequests.delete(cacheKey);
  });
  pendingRequests.set(cacheKey, request);
  return request;
};
