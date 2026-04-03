import Keycloak from 'keycloak-js';
import { getEnv } from '../utils/env';

let initialized = false;
let keycloak;
let initPromise;
let configSignature = '';
const KEYCLOAK_PROBE_TIMEOUT_MS = 1500;

const getRequiredEnv = (name) => {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const getCurrentConfig = () => ({
  url: getRequiredEnv('REACT_APP_KEYCLOAK_URL'),
  realm: getRequiredEnv('REACT_APP_KEYCLOAK_REALM'),
  clientId: getRequiredEnv('REACT_APP_KEYCLOAK_CLIENT_ID')
});

const getConfigSignature = (config) => JSON.stringify(config);

export const resetAuthClient = () => {
  initialized = false;
  initPromise = null;
  keycloak = undefined;
  configSignature = '';
};

const getAuthClientOrThrow = () => {
  const config = getCurrentConfig();
  const nextSignature = getConfigSignature(config);

  if (!keycloak || configSignature !== nextSignature) {
    initialized = false;
    initPromise = null;
    keycloak = new Keycloak(config);
    configSignature = nextSignature;
  }

  return keycloak;
};

const probeKeycloakAvailability = async () => {
  const url = getRequiredEnv('REACT_APP_KEYCLOAK_URL');
  const realm = getRequiredEnv('REACT_APP_KEYCLOAK_REALM');
  const probeUrl = `${url.replace(/\/+$/, '')}/realms/${realm}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, KEYCLOAK_PROBE_TIMEOUT_MS);

  try {
    await fetch(probeUrl, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

export const initAuth = async () => {
  const authClient = getAuthClientOrThrow();

  if (initialized) {
    return authClient.authenticated;
  }

  if (!initPromise) {
    initPromise = (async () => {
      const keycloakReachable = await probeKeycloakAvailability();
      if (!keycloakReachable) {
        return false;
      }

      const authenticated = await authClient.init({
        onLoad: 'check-sso',
        pkceMethod: 'S256',
        checkLoginIframe: false
      });

      initialized = true;
      return authenticated;
    })().finally(() => {
      initPromise = null;
    });
  }

  return initPromise;
};

export const getAccessToken = async () => {
  const authClient = getAuthClientOrThrow();

  if (!initialized) {
    const keycloakReachable = await probeKeycloakAvailability();
    if (!keycloakReachable) {
      return null;
    }

    await authClient.init({
      onLoad: 'check-sso',
      pkceMethod: 'S256',
      checkLoginIframe: false
    });
    initialized = true;
  }

  if (!authClient.authenticated) {
    return null;
  }

  await authClient.updateToken(30);
  return authClient.token;
};

export const login = async () => {
  const authClient = getAuthClientOrThrow();

  if (!initialized) {
    const keycloakReachable = await probeKeycloakAvailability();
    if (!keycloakReachable) {
      throw new Error('Keycloak is not reachable');
    }

    await authClient.init({
      onLoad: 'check-sso',
      pkceMethod: 'S256',
      checkLoginIframe: false
    });
    initialized = true;
  }

  return authClient.login();
};
export const logout = () => getAuthClientOrThrow().logout({ redirectUri: window.location.origin });
export const getAuthClient = () => getAuthClientOrThrow();
