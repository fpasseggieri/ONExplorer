const http = require('http');
const https = require('https');

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);
const LOCAL_TLS_HOSTNAMES = new Set([
  ...LOCAL_HOSTNAMES,
  'host.docker.internal'
]);

const isEnabledFlag = (value) =>
  ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());

const shouldRetryWithBasicAuth = (status, responseText) => {
  if (![400, 401].includes(status)) return false;

  const normalizedText = String(responseText || '').toLowerCase();
  return [
    'invalid_client',
    'unauthorized_client',
    'unsupported_client_authentication',
    'client authentication'
  ].some((message) => normalizedText.includes(message));
};

const createTokenRequestOptions = (clientId, clientSecret, authMode) => {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded'
  };
  const body = new URLSearchParams({ grant_type: 'client_credentials' });

  if (authMode === 'basic') {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64')}`;
  } else {
    body.set('client_id', clientId);
    body.set('client_secret', clientSecret);
  }

  return { method: 'POST', headers, body: body.toString() };
};

const getEndpointCandidates = (parsedEndpoint) => {
  const candidates = [parsedEndpoint.toString()];
  const hostname = parsedEndpoint.hostname.toLowerCase();
  if (!LOCAL_HOSTNAMES.has(hostname)) return candidates;

  const dockerAlias = String(
    process.env.ONEXPLORER_LOCALHOST_ALIAS || 'host.docker.internal'
  ).trim();
  if (!dockerAlias || LOCAL_HOSTNAMES.has(dockerAlias.toLowerCase())) return candidates;

  const fallbackEndpoint = new URL(parsedEndpoint.toString());
  fallbackEndpoint.hostname = dockerAlias;
  candidates.push(fallbackEndpoint.toString());
  return candidates;
};

const getErrorCode = (error) => String(error?.code || error?.cause?.code || '').trim();

const isSelfSignedTlsError = (error) => {
  const code = getErrorCode(error);
  const message = `${error?.message || ''} ${error?.cause?.message || ''}`.toLowerCase();
  return [
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'SELF_SIGNED_CERT_IN_CHAIN',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
  ].includes(code) || message.includes('self-signed certificate') || message.includes('unable to verify');
};

const canRetryWithInsecureLocalTls = (endpoint) => {
  if (!isEnabledFlag(process.env.ONEXPLORER_ALLOW_INSECURE_LOCALHOST_TLS)) return false;

  try {
    const parsed = new URL(endpoint);
    return parsed.protocol === 'https:' && LOCAL_TLS_HOSTNAMES.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
};

const getContentType = (headers = {}) => {
  const contentType = headers['content-type'];
  return (Array.isArray(contentType) ? contentType[0] : contentType) || 'application/json';
};

const requestTokenEndpoint = (endpoint, requestOptions, tlsOptions = {}) =>
  new Promise((resolve, reject) => {
    let parsedEndpoint;
    try {
      parsedEndpoint = new URL(endpoint);
    } catch (error) {
      reject(error);
      return;
    }

    const isHttps = parsedEndpoint.protocol === 'https:';
    const requestFn = isHttps ? https.request : http.request;
    const request = requestFn(
      {
        protocol: parsedEndpoint.protocol,
        hostname: parsedEndpoint.hostname,
        port: parsedEndpoint.port || (isHttps ? 443 : 80),
        path: `${parsedEndpoint.pathname}${parsedEndpoint.search}`,
        method: requestOptions.method,
        headers: requestOptions.headers,
        timeout: 15000,
        ...tlsOptions
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => {
          const status = Number(response.statusCode) || 500;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            text: body,
            contentType: getContentType(response.headers)
          });
        });
      }
    );

    request.on('timeout', () => request.destroy(new Error('Request timeout')));
    request.on('error', reject);
    request.write(requestOptions.body);
    request.end();
  });

const formatNetworkError = (error) => [
  error?.message,
  error?.cause?.message,
  error?.cause?.code
].filter(Boolean).map(String).join(' | ');

const handleExternalOAuthToken = async (req, res) => {
  const tokenEndpoint = String(req.body?.tokenEndpoint || '').trim();
  const clientId = String(req.body?.clientId || '').trim();
  const clientSecret = String(req.body?.clientSecret || '').trim();

  if (!tokenEndpoint || !clientId || !clientSecret) {
    return res.status(400).json({
      error: 'INVALID_OAUTH_REQUEST',
      message: 'Token endpoint, client ID, and client secret are required.'
    });
  }

  let parsedEndpoint;
  try {
    parsedEndpoint = new URL(tokenEndpoint);
  } catch {
    return res.status(400).json({
      error: 'INVALID_TOKEN_ENDPOINT',
      message: 'OAuth token endpoint must be a valid URL.'
    });
  }

  if (!['https:', 'http:'].includes(parsedEndpoint.protocol)) {
    return res.status(400).json({
      error: 'INVALID_TOKEN_ENDPOINT',
      message: 'OAuth token endpoint must use HTTP or HTTPS.'
    });
  }

  const endpointCandidates = getEndpointCandidates(parsedEndpoint);
  let lastNetworkError = null;

  for (const endpoint of endpointCandidates) {
    for (const authMode of ['body', 'basic']) {
      try {
        const requestOptions = createTokenRequestOptions(clientId, clientSecret, authMode);
        let insecureLocalTlsUsed = false;
        let tokenResponse;

        try {
          tokenResponse = await requestTokenEndpoint(endpoint, requestOptions);
        } catch (error) {
          if (!isSelfSignedTlsError(error) || !canRetryWithInsecureLocalTls(endpoint)) throw error;
          tokenResponse = await requestTokenEndpoint(endpoint, requestOptions, { rejectUnauthorized: false });
          insecureLocalTlsUsed = true;
        }

        if (
          authMode === 'body' &&
          !tokenResponse.ok &&
          shouldRetryWithBasicAuth(tokenResponse.status, tokenResponse.text)
        ) {
          continue;
        }

        res.status(tokenResponse.status);
        res.type(tokenResponse.contentType);
        res.setHeader('Cache-Control', 'no-store');
        if (insecureLocalTlsUsed) {
          res.setHeader('X-ONExplorer-Insecure-Local-TLS', 'true');
        }
        return res.send(tokenResponse.text);
      } catch (error) {
        lastNetworkError = error;
        break;
      }
    }
  }

  const localhostHint = LOCAL_HOSTNAMES.has(parsedEndpoint.hostname.toLowerCase())
    ? ' If ONExplorer runs in Docker, localhost points to the container. Use a host reachable from the container (for example host.docker.internal) or set ONEXPLORER_LOCALHOST_ALIAS.'
    : '';
  const tlsHint = isSelfSignedTlsError(lastNetworkError)
    ? ' Self-signed TLS certificate detected. Use a trusted certificate, switch to HTTP in dev, or set ONEXPLORER_ALLOW_INSECURE_LOCALHOST_TLS=true (local development only).'
    : '';
  const errorDetails = lastNetworkError ? ` ${formatNetworkError(lastNetworkError)}` : '';

  return res.status(502).json({
    error: 'TOKEN_ENDPOINT_UNREACHABLE',
    message: `Unable to reach OAuth token endpoint.${localhostHint}${tlsHint}${errorDetails}`,
    attemptedEndpoints: endpointCandidates
  });
};

module.exports = { handleExternalOAuthToken };
