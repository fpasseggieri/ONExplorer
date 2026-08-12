import { getBaseEnv, getEnv, hasEnvOverride, setEnvOverride } from './env';
import { ensureCurrentEnvironment } from './environments';
import { getRoleStorageItem, migrateLegacyRoleStorage, setRoleStorageItem } from './roleStorage';

const getDefaultBaseUrl = () => {
  const value = getEnv('REACT_APP_DEFAULT_BASE_URL');
  return typeof value === 'string' ? value.trim() : '';
};

const normalizeUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

const isLocalHostname = (hostname) => ['localhost', '127.0.0.1', '::1'].includes(String(hostname || '').toLowerCase());

const shouldMigrateLegacyKeycloakUrlOverride = (overrideUrl, configuredUrl) => {
  const normalizedOverrideUrl = normalizeUrl(overrideUrl);
  const normalizedConfiguredUrl = normalizeUrl(configuredUrl);

  if (!normalizedOverrideUrl || !normalizedConfiguredUrl || normalizedOverrideUrl === normalizedConfiguredUrl) {
    return false;
  }

  try {
    const override = new URL(normalizedOverrideUrl);
    const configured = new URL(normalizedConfiguredUrl);

    return (
      isLocalHostname(override.hostname) &&
      isLocalHostname(configured.hostname) &&
      override.protocol === configured.protocol &&
      override.hostname === configured.hostname &&
      override.port === '8080' &&
      configured.port &&
      configured.port !== override.port &&
      override.pathname === configured.pathname
    );
  } catch {
    return normalizedOverrideUrl === 'http://localhost:8080' && normalizedConfiguredUrl !== normalizedOverrideUrl;
  }
};

const syncLegacyKeycloakOverride = () => {
  if (!hasEnvOverride('REACT_APP_KEYCLOAK_URL')) {
    return;
  }

  const configuredKeycloakUrl = getBaseEnv('REACT_APP_KEYCLOAK_URL');
  const currentKeycloakUrlOverride = getEnv('REACT_APP_KEYCLOAK_URL');

  if (shouldMigrateLegacyKeycloakUrlOverride(currentKeycloakUrlOverride, configuredKeycloakUrl)) {
    setEnvOverride('REACT_APP_KEYCLOAK_URL', configuredKeycloakUrl);
  }
};

export const initializeRuntimeSettings = () => {
  try {
    migrateLegacyRoleStorage();
    ensureCurrentEnvironment();

    const defaultBaseUrl = getDefaultBaseUrl();
    const currentBaseUrl = getRoleStorageItem('baseUrl');

    if (defaultBaseUrl && !currentBaseUrl) {
      setRoleStorageItem('baseUrl', defaultBaseUrl);
    }

    syncLegacyKeycloakOverride();
  } catch (error) {
    console.error('Failed to initialize runtime settings:', error);
  }
};
