export const USER_ROLE_STORAGE_KEY = 'userRole';
export const DEFAULT_ROLE = 'SHIPPER';

const ROLE_STORAGE_PREFIX = 'role';
const LEGACY_MIGRATION_KEY = 'roleStorage:legacyMigrated';

const ROLE_SCOPED_KEYS = [
  'baseUrl',
  'externalServers',
  'externalSubscriptions',
  'externalLogisticsObjects',
  'notifications',
  'subscriptionsNewTrackedRequests',
  'envOverride:REACT_APP_KEYCLOAK_URL',
  'envOverride:REACT_APP_KEYCLOAK_REALM',
  'envOverride:REACT_APP_KEYCLOAK_CLIENT_ID'
];

const hasBrowserStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

export const getCurrentRole = () => {
  if (!hasBrowserStorage()) {
    return DEFAULT_ROLE;
  }

  try {
    return window.localStorage.getItem(USER_ROLE_STORAGE_KEY) || DEFAULT_ROLE;
  } catch {
    return DEFAULT_ROLE;
  }
};

export const setCurrentRole = (role) => {
  if (!hasBrowserStorage()) {
    return;
  }

  const normalizedRole = String(role || DEFAULT_ROLE).trim() || DEFAULT_ROLE;

  try {
    window.localStorage.setItem(USER_ROLE_STORAGE_KEY, normalizedRole);
  } catch (error) {
    console.error('Failed to persist selected role:', error);
  }
};

export const getRoleStorageKey = (key, role = getCurrentRole()) => {
  const normalizedRole = String(role || DEFAULT_ROLE).trim() || DEFAULT_ROLE;
  return `${ROLE_STORAGE_PREFIX}:${normalizedRole}:${key}`;
};

export const getRoleStorageItem = (key) => {
  if (!hasBrowserStorage()) {
    return null;
  }

  try {
    return window.localStorage.getItem(getRoleStorageKey(key));
  } catch {
    return null;
  }
};

export const setRoleStorageItem = (key, value) => {
  if (!hasBrowserStorage()) {
    return;
  }

  try {
    const storageKey = getRoleStorageKey(key);

    if (value === undefined || value === null) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, String(value));
  } catch (error) {
    console.error(`Failed to persist role storage key ${key}:`, error);
  }
};

export const removeRoleStorageItem = (key) => {
  setRoleStorageItem(key, null);
};

export const migrateLegacyRoleStorage = () => {
  if (!hasBrowserStorage()) {
    return;
  }

  try {
    if (window.localStorage.getItem(LEGACY_MIGRATION_KEY)) {
      return;
    }

    const role = getCurrentRole();

    ROLE_SCOPED_KEYS.forEach((key) => {
      const legacyValue = window.localStorage.getItem(key);
      if (legacyValue === null) {
        return;
      }

      const scopedKey = getRoleStorageKey(key, role);
      if (window.localStorage.getItem(scopedKey) === null) {
        window.localStorage.setItem(scopedKey, legacyValue);
      }

      window.localStorage.removeItem(key);
    });

    window.localStorage.setItem(LEGACY_MIGRATION_KEY, JSON.stringify({
      role,
      migratedAt: new Date().toISOString()
    }));
  } catch (error) {
    console.error('Failed to migrate legacy role storage:', error);
  }
};
