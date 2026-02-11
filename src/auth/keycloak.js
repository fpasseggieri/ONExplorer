import Keycloak from 'keycloak-js';
import { getEnv } from '../utils/env';

let initialized = false;
let keycloak;
let initPromise;

const getRequiredEnv = (name) => {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const getAuthClientOrThrow = () => {
  if (!keycloak) {
    keycloak = new Keycloak({
      url: getRequiredEnv('REACT_APP_KEYCLOAK_URL'),
      realm: getRequiredEnv('REACT_APP_KEYCLOAK_REALM'),
      clientId: getRequiredEnv('REACT_APP_KEYCLOAK_CLIENT_ID')
    });
  }

  return keycloak;
};

export const initAuth = async () => {
  const authClient = getAuthClientOrThrow();

  if (initialized) {
    return authClient.authenticated;
  }

  if (!initPromise) {
    initPromise = authClient.init({
      onLoad: 'login-required',
      pkceMethod: 'S256',
      checkLoginIframe: false
    }).then((authenticated) => {
      initialized = true;
      return authenticated;
    }).finally(() => {
      initPromise = null;
    });
  }

  return initPromise;
};

export const getAccessToken = async () => {
  const authClient = getAuthClientOrThrow();

  if (!initialized) {
    throw new Error('Authentication is not initialized');
  }

  if (!authClient.authenticated) {
    await authClient.login();
    return null;
  }

  await authClient.updateToken(30);
  return authClient.token;
};

export const login = () => getAuthClientOrThrow().login();
export const logout = () => getAuthClientOrThrow().logout({ redirectUri: window.location.origin });
export const getAuthClient = () => getAuthClientOrThrow();
