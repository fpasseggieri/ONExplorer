export const validateSettings = () => {
  const baseUrl = localStorage.getItem('baseUrl');
  
  const errors = [];
  
  if (!baseUrl) {
    errors.push('API base URL is not configured');
  } else {
    try {
      new URL(baseUrl);
    } catch (e) {
      errors.push('Invalid API base URL format');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};
