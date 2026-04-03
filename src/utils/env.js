const getRuntimeEnv = () => {
  if (typeof window !== 'undefined' && window.__ENV__ && typeof window.__ENV__ === 'object') {
    return window.__ENV__;
  }

  return {};
};

const getOverrideKey = (name) => `envOverride:${name}`;

const getLocalOverride = (name) => {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    const value = window.localStorage.getItem(getOverrideKey(name));
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

export const getEnv = (name) => {
  const localOverride = getLocalOverride(name);
  if (typeof localOverride === 'string' && localOverride.trim()) {
    return localOverride;
  }

  return getConfiguredEnv(name);
};

export const setEnvOverride = (name, value) => {
  if (typeof window === 'undefined') {
    return;
  }

  const normalized = typeof value === 'string' ? value.trim() : String(value || '').trim();

  try {
    if (normalized) {
      window.localStorage.setItem(getOverrideKey(name), normalized);
      return;
    }

    window.localStorage.removeItem(getOverrideKey(name));
  } catch (error) {
    console.error(`Failed to persist env override for ${name}:`, error);
  }
};

export const hasEnvOverride = (name) => {
  const value = getLocalOverride(name);
  return typeof value === 'string' && value.trim().length > 0;
};

export const clearEnvOverride = (name) => {
  setEnvOverride(name, '');
};

export const getBaseEnv = (name) => getConfiguredEnv(name);
