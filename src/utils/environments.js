import { DEFAULT_ROLE, getCurrentRole, setCurrentRole } from './roleStorage';

export const ENVIRONMENTS_STORAGE_KEY = 'environments';
export const ENVIRONMENTS_CHANGED_EVENT = 'onexplorer:environments-changed';

export const ENVIRONMENT_ICON_KEYS = [
  'truck',
  'business',
  'flight',
  'post',
  'customs',
  'warehouse',
  'inventory',
  'globe',
  'store',
  'ship',
  'train',
  'delivery'
];

export const ENVIRONMENT_COLOR_OPTIONS = [
  '#2e7d32',
  '#0288d1',
  '#d32f2f',
  '#f57c00',
  '#7b1fa2',
  '#00897b',
  '#3949ab',
  '#455a64',
  '#6d4c41',
  '#ad1457'
];

export const DEFAULT_ENVIRONMENTS = [
  {
    id: 'SHIPPER',
    label: 'Shipper',
    color: '#2e7d32',
    icon: 'truck'
  },
  {
    id: 'FORWARDER',
    label: 'Forwarder',
    color: '#0288d1',
    icon: 'business'
  },
  {
    id: 'AIRLINE',
    label: 'Airline',
    color: '#d32f2f',
    icon: 'flight'
  },
  {
    id: 'POST',
    label: 'Post',
    color: '#f57c00',
    icon: 'post'
  },
  {
    id: 'CUSTOM',
    label: 'Custom',
    color: '#7b1fa2',
    icon: 'customs'
  },
  {
    id: 'CDMP_C',
    label: 'cdmp-c',
    color: '#00897b',
    icon: 'customs'
  },
  {
    id: 'CDMP_F',
    label: 'cdmp-f',
    color: '#3949ab',
    icon: 'business'
  }
];

const hasBrowserStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

export const isValidEnvironmentColor = (value) => /^#[0-9a-fA-F]{6}$/.test(String(value || '').trim());

export const normalizeEnvironmentId = (value) => {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || DEFAULT_ROLE;
};

export const normalizeEnvironment = (environment, fallback = {}) => {
  const label = String(environment?.label || fallback.label || '').trim();
  const id = normalizeEnvironmentId(environment?.id || label || fallback.id);
  const color = isValidEnvironmentColor(environment?.color)
    ? String(environment.color).trim()
    : (isValidEnvironmentColor(fallback.color) ? fallback.color : '#0288d1');
  const icon = ENVIRONMENT_ICON_KEYS.includes(environment?.icon)
    ? environment.icon
    : (ENVIRONMENT_ICON_KEYS.includes(fallback.icon) ? fallback.icon : 'business');

  return {
    id,
    label: label || id,
    color,
    icon
  };
};

export const createEnvironmentId = (label, environments = []) => {
  const baseId = normalizeEnvironmentId(label);
  const existingIds = new Set(environments.map((environment) => environment.id));

  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  let nextId = `${baseId}_${suffix}`;
  while (existingIds.has(nextId)) {
    suffix += 1;
    nextId = `${baseId}_${suffix}`;
  }

  return nextId;
};

const getDefaultEnvironments = () => DEFAULT_ENVIRONMENTS.map((environment) => ({ ...environment }));

export const getEnvironments = () => {
  if (!hasBrowserStorage()) {
    return getDefaultEnvironments();
  }

  try {
    const savedEnvironments = window.localStorage.getItem(ENVIRONMENTS_STORAGE_KEY);
    if (!savedEnvironments) {
      return getDefaultEnvironments();
    }

    const parsed = JSON.parse(savedEnvironments);
    if (!Array.isArray(parsed)) {
      return getDefaultEnvironments();
    }

    const seenIds = new Set();
    const environments = parsed
      .map((environment) => normalizeEnvironment(environment))
      .filter((environment) => {
        if (seenIds.has(environment.id)) {
          return false;
        }
        seenIds.add(environment.id);
        return true;
      });

    return environments.length ? environments : getDefaultEnvironments();
  } catch {
    return getDefaultEnvironments();
  }
};

const dispatchEnvironmentsChanged = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(ENVIRONMENTS_CHANGED_EVENT));
};

export const saveEnvironments = (environments) => {
  if (!hasBrowserStorage()) {
    return;
  }

  const normalizedEnvironments = (Array.isArray(environments) ? environments : [])
    .map((environment) => normalizeEnvironment(environment))
    .filter(Boolean);

  if (!normalizedEnvironments.length) {
    return;
  }

  try {
    window.localStorage.setItem(ENVIRONMENTS_STORAGE_KEY, JSON.stringify(normalizedEnvironments));
    dispatchEnvironmentsChanged();
  } catch (error) {
    console.error('Failed to persist environments:', error);
  }
};

export const getEnvironmentById = (id, environments = getEnvironments()) => (
  environments.find((environment) => environment.id === id) || null
);

export const getCurrentEnvironment = () => {
  const environments = getEnvironments();
  const selectedEnvironment = getEnvironmentById(getCurrentRole(), environments);
  return selectedEnvironment || environments[0] || normalizeEnvironment(DEFAULT_ENVIRONMENTS[0]);
};

export const ensureCurrentEnvironment = () => {
  const environment = getCurrentEnvironment();

  if (environment.id !== getCurrentRole()) {
    setCurrentRole(environment.id);
  }

  return environment;
};
