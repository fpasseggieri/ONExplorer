import { getRoleStorageItem, removeRoleStorageItem, setRoleStorageItem } from './roleStorage';

const getRuntimeEnv = () => {
  if (typeof window !== 'undefined' && window.__ENV__ && typeof window.__ENV__ === 'object') {
    return window.__ENV__;
  }

  return {};
};

const getOverrideKey = (name) => `envOverride:${name}`;

const getLocalOverride = (name, role) => {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    const value = getRoleStorageItem(getOverrideKey(name), role);
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
};

const getConfiguredEnv = (name) => {
  const runtimeValue = getRuntimeEnv()[name];
  if (typeof runtimeValue === 'string') {
    return runtimeValue;
  }
  if (runtimeValue !== undefined && runtimeValue !== null) {
    return String(runtimeValue);
  }

  const buildTimeValue = process.env[name];
  if (typeof buildTimeValue === 'string') {
    return buildTimeValue;
  }

  return '';
};

export const getEnv = (name, role) => {
  const localOverride = getLocalOverride(name, role);
  if (typeof localOverride === 'string' && localOverride.trim()) {
    return localOverride;
  }

  return getConfiguredEnv(name);
};

export const setEnvOverride = (name, value, role) => {
  if (typeof window === 'undefined') {
    return;
  }

  const normalized = typeof value === 'string' ? value.trim() : String(value || '').trim();

  try {
    if (normalized) {
      setRoleStorageItem(getOverrideKey(name), normalized, role);
      return;
    }

    removeRoleStorageItem(getOverrideKey(name), role);
  } catch (error) {
    console.error(`Failed to persist env override for ${name}:`, error);
  }
};

export const hasEnvOverride = (name, role) => {
  const value = getLocalOverride(name, role);
  return typeof value === 'string' && value.trim().length > 0;
};

export const clearEnvOverride = (name, role) => {
  setEnvOverride(name, '', role);
};

export const getBaseEnv = (name) => getConfiguredEnv(name);
