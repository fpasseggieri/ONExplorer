import React from 'react';
import { Alert, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { login } from '../auth/keycloak';

const ApiErrorAlert = ({ error, onRetry }) => {
  const navigate = useNavigate();

  const handleSettingsClick = () => {
    navigate('/settings');
  };

  const handleSignInClick = async () => {
    try {
      await login();
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  if (error?.status === 401) {
    return (
      <Alert 
        severity="error"
        action={
          <>
            <Button
              color="inherit"
              size="small"
              onClick={handleSignInClick}
            >
              Sign In
            </Button>
            <Button 
              color="inherit" 
              size="small" 
              onClick={handleSettingsClick}
            >
              Settings
            </Button>
          </>
        }
      >
        Authentication is required for this action. Sign in or verify your server configuration.
      </Alert>
    );
  }

  return (
    <Alert 
      severity="error"
      action={
        onRetry && (
          <Button 
            color="inherit" 
            size="small" 
            onClick={onRetry}
          >
            Retry
          </Button>
        )
      }
    >
      {error?.message || 'An error occurred'}
    </Alert>
  );
};

export default ApiErrorAlert;
