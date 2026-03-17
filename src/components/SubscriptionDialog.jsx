import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress
} from '@mui/material';
import { apiCall } from '../utils/api';
import { getExternalAccessToken } from '../utils/externalAuth';

const decodeJwtPayload = (token) => {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
};

const SubscriptionDialog = ({ open, onClose, objectId }) => {
  const [selectedServer, setSelectedServer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const servers = JSON.parse(localStorage.getItem('externalServers') || '[]');

  const handleSubmit = async () => {
    if (!selectedServer) return;

    try {
      setLoading(true);
      setError(null);
      const serverConfig = servers.find(s => s.baseUrl === selectedServer);
      if (!serverConfig) {
        throw new Error('Selected server configuration not found');
      }

      const externalToken = await getExternalAccessToken(serverConfig);
      const tokenPayload = decodeJwtPayload(externalToken);
      const subscriberUri =
        tokenPayload?.logistics_agent_uri ||
        `${serverConfig.baseUrl}/logistics-objects/_data-holder`;

      const subscriptionPayload = {
        "@context": {
          "cargo": "https://onerecord.iata.org/ns/cargo#",
          "api": "https://onerecord.iata.org/ns/api#"
        },
        "@type": "api:Subscription",
        "api:hasContentType": "application/ld+json",
        "api:hasSubscriber": {
          "@id": subscriberUri
        },
        "api:hasTopicType": {
          "@id": "api:LOGISTICS_OBJECT_IDENTIFIER"
        },
        "api:includeSubscriptionEventType": [
          {
            "@id": "api:LOGISTICS_OBJECT_UPDATED"
          },
          {
            "@id": "api:LOGISTICS_OBJECT_CREATED"
          },
          {
            "@id": "api:LOGISTICS_EVENT_RECEIVED"
          }
        ],
        "api:hasTopic": {
          "@type": "http://www.w3.org/2001/XMLSchema#anyURI",
          "@value": objectId
        },
        "api:sendLogisticsObjectBody": false
      };

      const internalResponse = await apiCall(
        '/subscriptions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/ld+json'
          },
          body: JSON.stringify(subscriptionPayload)
        }
      );

      console.log('Subscription created:', internalResponse);
      onClose(true);
    } catch (err) {
      console.error('Subscription error:', err);
      setError(err.message || 'Failed to create subscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => onClose(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Subscribe to Logistics Object</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel>Select Server</InputLabel>
          <Select
            value={selectedServer}
            onChange={(e) => setSelectedServer(e.target.value)}
            label="Select Server"
          >
            {servers.map((server) => (
              <MenuItem key={server.baseUrl} value={server.baseUrl}>
                {server.name || server.baseUrl}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)}>Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={!selectedServer || loading}
        >
          {loading ? <CircularProgress size={24} /> : 'Subscribe'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SubscriptionDialog; 
