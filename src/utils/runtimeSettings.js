import { getEnv } from './env';

const getDefaultBaseUrl = () => {
  const value = getEnv('REACT_APP_DEFAULT_BASE_URL');
  return typeof value === 'string' ? value.trim() : '';
};

const shouldEnforceDefaultBaseUrl = () => {
  const value = getEnv('REACT_APP_ENFORCE_DEFAULT_BASE_URL');
  return String(value || '').toLowerCase() === 'true';
};

export const initializeRuntimeSettings = () => {
  try {
    const defaultBaseUrl = getDefaultBaseUrl();
    const currentBaseUrl = localStorage.getItem('baseUrl');
    const enforceDefaultBaseUrl = shouldEnforceDefaultBaseUrl();

    if (defaultBaseUrl && (!currentBaseUrl || (enforceDefaultBaseUrl && currentBaseUrl !== defaultBaseUrl))) {
      localStorage.setItem('baseUrl', defaultBaseUrl);
    }
  } catch (error) {
    console.error('Failed to initialize runtime settings:', error);
  }
};
