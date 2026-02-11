const getRuntimeEnv = () => {
  if (typeof window !== 'undefined' && window.__ENV__ && typeof window.__ENV__ === 'object') {
    return window.__ENV__;
  }

  return {};
};

export const getEnv = (name) => {
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
