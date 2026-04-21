import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Alert,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { getExternalAccessToken } from '../utils/externalAuth';
import { getEnv, setEnvOverride, clearEnvOverride, getBaseEnv, hasEnvOverride } from '../utils/env';
import { resetAuthClient } from '../auth/keycloak';
import { getCurrentRole, getRoleStorageItem, setRoleStorageItem } from '../utils/roleStorage';

const isLocalHostname = (hostname) => ['localhost', '127.0.0.1', '::1'].includes(String(hostname || '').toLowerCase());

const normalizeServer = (server) => {
  const name = (server?.name || '').trim();
  const baseUrl = (server?.baseUrl || '').trim();
  const fallbackId = `server-${encodeURIComponent(name || baseUrl || 'external')}`;

  return {
    id: (server?.id || fallbackId).toString(),
    name,
    baseUrl,
  oauthTokenEndpoint: (server?.oauthTokenEndpoint || '').trim(),
  oauthClientId: (server?.oauthClientId || '').trim(),
  oauthClientSecret: (server?.oauthClientSecret || '').trim(),
  // Keep legacy static token support if already configured.
  token: (server?.token || '').trim()
  };
};

const Settings = () => {
  const currentRole = getCurrentRole();
  // Internal API settings
  const [internalSettings, setInternalSettings] = useState({
    baseUrl: getRoleStorageItem('baseUrl') || '',
    keycloakUrl: getEnv('REACT_APP_KEYCLOAK_URL'),
    keycloakRealm: getEnv('REACT_APP_KEYCLOAK_REALM'),
    keycloakClientId: getEnv('REACT_APP_KEYCLOAK_CLIENT_ID')
  });
  const keycloakOverridesActive =
    hasEnvOverride('REACT_APP_KEYCLOAK_URL') ||
    hasEnvOverride('REACT_APP_KEYCLOAK_REALM') ||
    hasEnvOverride('REACT_APP_KEYCLOAK_CLIENT_ID');

  // External servers
  const [servers, setServers] = useState(() => {
    const savedServers = getRoleStorageItem('externalServers');
    if (!savedServers) {
      return [];
    }
    try {
      const parsed = JSON.parse(savedServers);
      return Array.isArray(parsed) ? parsed.map(normalizeServer) : [];
    } catch {
      return [];
    }
  });

  // Dialog states
  const [openDialog, setOpenDialog] = useState(false);
  const [editingServer, setEditingServer] = useState(null);
  const [newServer, setNewServer] = useState({
    name: '',
    baseUrl: '',
    oauthTokenEndpoint: '',
    oauthClientId: '',
    oauthClientSecret: '',
    token: '',
    id: ''
  });

  // Error states
  const [error, setError] = useState(null);
  const [dialogError, setDialogError] = useState(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testingKeycloakConfig, setTestingKeycloakConfig] = useState(false);
  const [keycloakTestResult, setKeycloakTestResult] = useState(null);

  // Save internal settings
  const handleInternalSave = () => {
    try {
      setRoleStorageItem('baseUrl', internalSettings.baseUrl.trim());
      setEnvOverride('REACT_APP_KEYCLOAK_URL', internalSettings.keycloakUrl);
      setEnvOverride('REACT_APP_KEYCLOAK_REALM', internalSettings.keycloakRealm);
      setEnvOverride('REACT_APP_KEYCLOAK_CLIENT_ID', internalSettings.keycloakClientId);
      resetAuthClient();
      setError(null);

      window.location.href = '/';
    } catch (err) {
      setError('Failed to save settings: ' + err.message);
    }
  };

  const handleTestKeycloakConfig = async () => {
    const keycloakUrl = internalSettings.keycloakUrl.trim();
    const keycloakRealm = internalSettings.keycloakRealm.trim();
    const keycloakClientId = internalSettings.keycloakClientId.trim();

    if (!keycloakUrl || !keycloakRealm || !keycloakClientId) {
      setKeycloakTestResult({
        severity: 'error',
        message: 'Keycloak URL, Realm, and Client ID are all required to test sign-in configuration.'
      });
      return;
    }

    try {
      setTestingKeycloakConfig(true);
      setKeycloakTestResult(null);

      const parsedKeycloakUrl = new URL(keycloakUrl);
      const appUrl = new URL(window.location.origin);
      const warnings = [];

      if (!isLocalHostname(appUrl.hostname) && isLocalHostname(parsedKeycloakUrl.hostname)) {
        warnings.push('This site is not running on localhost, but the Keycloak URL points to localhost. Remote users will not be able to reach that IdP URL from their browser.');
      }

      const discoveryUrl = `${keycloakUrl.replace(/\/+$/, '')}/realms/${encodeURIComponent(keycloakRealm)}/.well-known/openid-configuration`;
      const discoveryResponse = await fetch(discoveryUrl, {
        method: 'GET',
        cache: 'no-store'
      });

      if (!discoveryResponse.ok) {
        throw new Error(`Discovery endpoint returned ${discoveryResponse.status}`);
      }

      const discovery = await discoveryResponse.json();
      if (!discovery.authorization_endpoint || !discovery.token_endpoint || !discovery.issuer) {
        throw new Error('Discovery document is incomplete');
      }

      warnings.push('Client ID format looks syntactically valid, but browser-side testing cannot fully prove the client exists without a real authorization redirect.');

      setKeycloakTestResult({
        severity: warnings.length > 1 ? 'warning' : 'success',
        message: warnings.length
          ? `Keycloak discovery is reachable. ${warnings.join(' ')}`
          : 'Keycloak discovery is reachable and the realm configuration looks valid.'
      });
    } catch (err) {
      setKeycloakTestResult({
        severity: 'error',
        message: `Keycloak test failed: ${err.message}`
      });
    } finally {
      setTestingKeycloakConfig(false);
    }
  };

  const handleResetAuthOverrides = () => {
    clearEnvOverride('REACT_APP_KEYCLOAK_URL');
    clearEnvOverride('REACT_APP_KEYCLOAK_REALM');
    clearEnvOverride('REACT_APP_KEYCLOAK_CLIENT_ID');
    resetAuthClient();
    setInternalSettings((prev) => ({
      ...prev,
      keycloakUrl: getBaseEnv('REACT_APP_KEYCLOAK_URL'),
      keycloakRealm: getBaseEnv('REACT_APP_KEYCLOAK_REALM'),
      keycloakClientId: getBaseEnv('REACT_APP_KEYCLOAK_CLIENT_ID')
    }));
    setError(null);
    setKeycloakTestResult(null);
  };

  // Save external servers
  const handleServerSave = () => {
    if (!newServer.name || !newServer.baseUrl || !newServer.oauthTokenEndpoint || !newServer.oauthClientId || !newServer.oauthClientSecret) {
      setDialogError('All OAuth fields are required');
      return;
    }

    try {
      const serverToSave = normalizeServer({
        ...newServer,
        id: editingServer !== null ? newServer.id : Date.now().toString()
      });

      let updatedServers;
      if (editingServer !== null) {
        updatedServers = servers.map((server, index) =>
          index === editingServer ? serverToSave : server
        );
      } else {
        updatedServers = [...servers, serverToSave];
      }

      setRoleStorageItem('externalServers', JSON.stringify(updatedServers));
      setServers(updatedServers);
      handleCloseDialog();
    } catch (err) {
      setDialogError('Failed to save server: ' + err.message);
    }
  };

  const handleDeleteServer = (index) => {
    const updatedServers = servers.filter((_, i) => i !== index);
    setRoleStorageItem('externalServers', JSON.stringify(updatedServers));
    setServers(updatedServers);
  };

  const handleTestConnection = async () => {
    if (!newServer.name || !newServer.baseUrl || !newServer.oauthTokenEndpoint || !newServer.oauthClientId || !newServer.oauthClientSecret) {
      setDialogError('Fill all OAuth fields before testing');
      setTestResult(null);
      return;
    }

    try {
      setTestingConnection(true);
      setDialogError(null);
      setTestResult(null);

      const token = await getExternalAccessToken({
        ...newServer,
        id: newServer.id || `test-${Date.now()}`
      });

      if (!token) {
        throw new Error('No access token returned');
      }

      setTestResult({
        type: 'success',
        message: 'Connection successful: access token generated.'
      });
    } catch (err) {
      setTestResult({
        type: 'error',
        message: `Connection failed: ${err.message}`
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleEditServer = (index) => {
    setEditingServer(index);
    setNewServer(normalizeServer(servers[index]));
    setDialogError(null);
    setTestResult(null);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingServer(null);
    setNewServer({
      name: '',
      baseUrl: '',
      oauthTokenEndpoint: '',
      oauthClientId: '',
      oauthClientSecret: '',
      token: '',
      id: ''
    });
    setDialogError(null);
    setTestResult(null);
  };

  return (
    <Box sx={{ maxWidth: 1200, margin: '0 auto', p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: 2,
          mb: 3
        }}>
          <SettingsIcon sx={{ fontSize: 40, color: '#1976d2' }} />
          <Typography variant="h4" sx={{ fontWeight: 600, color: '#1976d2' }}>
            Settings
          </Typography>
        </Box>
        <Divider />
        <Alert severity="info" sx={{ mt: 2 }}>
          Editing settings for role: {currentRole}
        </Alert>
      </Box>

      {/* Internal API Settings */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 3 }}>Internal API Settings</Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          Authentication is managed via Keycloak sign-in (Authorization Code + PKCE). These values override the container runtime configuration only in this browser.
        </Alert>
        {keycloakOverridesActive && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Local Keycloak overrides are active. If sign-in is broken, reset the overrides to fall back to the deployed runtime configuration.
          </Alert>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Base URL"
            value={internalSettings.baseUrl}
            onChange={(e) => setInternalSettings(prev => ({
              ...prev,
              baseUrl: e.target.value
            }))}
            fullWidth
            helperText="The base URL of your ONE Record server"
          />
          <TextField
            label="Keycloak URL"
            value={internalSettings.keycloakUrl}
            onChange={(e) => setInternalSettings(prev => ({
              ...prev,
              keycloakUrl: e.target.value
            }))}
            fullWidth
            helperText="Public Keycloak URL used by the browser for sign-in"
          />
          <TextField
            label="Keycloak Realm"
            value={internalSettings.keycloakRealm}
            onChange={(e) => setInternalSettings(prev => ({
              ...prev,
              keycloakRealm: e.target.value
            }))}
            fullWidth
          />
          <TextField
            label="Keycloak Client ID"
            value={internalSettings.keycloakClientId}
            onChange={(e) => setInternalSettings(prev => ({
              ...prev,
              keycloakClientId: e.target.value
            }))}
            fullWidth
          />
          {keycloakTestResult && (
            <Alert severity={keycloakTestResult.severity} sx={{ mt: 1 }}>
              {keycloakTestResult.message}
            </Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          <Button
            variant="outlined"
            onClick={handleTestKeycloakConfig}
            disabled={testingKeycloakConfig}
          >
            {testingKeycloakConfig ? 'Testing Keycloak...' : 'Test Keycloak Config'}
          </Button>
          <Button 
            variant="contained" 
            onClick={handleInternalSave}
          >
            Save Internal Settings
          </Button>
          <Button
            variant="outlined"
            onClick={handleResetAuthOverrides}
          >
            Reset Keycloak Overrides
          </Button>
        </Box>
      </Paper>

      {/* External Servers */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          mb: 3 
        }}>
          <Typography variant="h6">External Servers</Typography>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={() => {
              setDialogError(null);
              setTestResult(null);
              setOpenDialog(true);
            }}
          >
            Add Server
          </Button>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Base URL</TableCell>
                <TableCell>Token Endpoint</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {servers.map((server, index) => (
                <TableRow key={index}>
                  <TableCell>{server.name}</TableCell>
                  <TableCell>{server.baseUrl}</TableCell>
                  <TableCell>{server.oauthTokenEndpoint || '-'}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="Edit">
                        <IconButton onClick={() => handleEditServer(index)}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton 
                          color="error"
                          onClick={() => handleDeleteServer(index)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {servers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    <Typography color="textSecondary">
                      No external servers configured
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add/Edit Server Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingServer !== null ? 'Edit Server' : 'Add New Server'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {dialogError && (
              <Alert severity="error">
                {dialogError}
              </Alert>
            )}
            {testResult && (
              <Alert severity={testResult.type}>
                {testResult.message}
              </Alert>
            )}
            <Alert severity="info">
              Configure OAuth client credentials. The app will generate JWT access tokens using the client credentials flow.
            </Alert>
            <TextField
              label="Server Name"
              value={newServer.name}
              onChange={(e) => setNewServer(prev => ({
                ...prev,
                name: e.target.value
              }))}
              fullWidth
              required
            />
            <TextField
              label="Base URL"
              value={newServer.baseUrl}
              onChange={(e) => setNewServer(prev => ({
                ...prev,
                baseUrl: e.target.value
              }))}
              fullWidth
              required
            />
            <TextField
              label="OAuth Token Endpoint"
              value={newServer.oauthTokenEndpoint}
              onChange={(e) => setNewServer(prev => ({
                ...prev,
                oauthTokenEndpoint: e.target.value
              }))}
              fullWidth
              required
              helperText="Example: https://auth.partner.com/realms/onerecord/protocol/openid-connect/token"
            />
            <TextField
              label="OAuth Client ID"
              value={newServer.oauthClientId}
              onChange={(e) => setNewServer(prev => ({
                ...prev,
                oauthClientId: e.target.value
              }))}
              fullWidth
              required
            />
            <TextField
              label="OAuth Client Secret"
              value={newServer.oauthClientSecret}
              onChange={(e) => setNewServer(prev => ({
                ...prev,
                oauthClientSecret: e.target.value
              }))}
              fullWidth
              type="password"
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleTestConnection}
            disabled={testingConnection || !newServer.name || !newServer.baseUrl || !newServer.oauthTokenEndpoint || !newServer.oauthClientId || !newServer.oauthClientSecret}
          >
            {testingConnection ? 'Testing...' : 'Test Connection'}
          </Button>
          <Button 
            variant="contained"
            onClick={handleServerSave}
            disabled={testingConnection || !newServer.name || !newServer.baseUrl || !newServer.oauthTokenEndpoint || !newServer.oauthClientId || !newServer.oauthClientSecret}
          >
            {editingServer !== null ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Settings;
