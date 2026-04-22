import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Alert,
  Divider,
  Chip,
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
  Tooltip,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import EnvironmentIcon, { ENVIRONMENT_ICON_OPTIONS, getEnvironmentIconLabel } from '../components/EnvironmentIcon';
import { getExternalAccessToken } from '../utils/externalAuth';
import { getEnv, setEnvOverride, clearEnvOverride, getBaseEnv, hasEnvOverride } from '../utils/env';
import { resetAuthClient } from '../auth/keycloak';
import { getRoleStorageItem, setCurrentRole, setRoleStorageItem } from '../utils/roleStorage';
import {
  ENVIRONMENT_COLOR_OPTIONS,
  createEnvironmentId,
  getCurrentEnvironment,
  getEnvironments,
  isValidEnvironmentColor,
  normalizeEnvironment,
  saveEnvironments
} from '../utils/environments';

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

const getInternalSettingsForEnvironment = (environmentId) => ({
  baseUrl: getRoleStorageItem('baseUrl', environmentId) || '',
  keycloakUrl: getEnv('REACT_APP_KEYCLOAK_URL', environmentId),
  keycloakRealm: getEnv('REACT_APP_KEYCLOAK_REALM', environmentId),
  keycloakClientId: getEnv('REACT_APP_KEYCLOAK_CLIENT_ID', environmentId)
});

const getExternalServersForEnvironment = (environmentId) => {
  const savedServers = getRoleStorageItem('externalServers', environmentId);
  if (!savedServers) {
    return [];
  }

  try {
    const parsed = JSON.parse(savedServers);
    return Array.isArray(parsed) ? parsed.map(normalizeServer) : [];
  } catch {
    return [];
  }
};

const Settings = () => {
  const [environments, setEnvironments] = useState(() => getEnvironments());
  const [currentEnvironment, setCurrentEnvironment] = useState(() => getCurrentEnvironment());
  // Internal API settings
  const [internalSettings, setInternalSettings] = useState(() => (
    getInternalSettingsForEnvironment(currentEnvironment.id)
  ));
  const keycloakOverridesActive =
    hasEnvOverride('REACT_APP_KEYCLOAK_URL', currentEnvironment.id) ||
    hasEnvOverride('REACT_APP_KEYCLOAK_REALM', currentEnvironment.id) ||
    hasEnvOverride('REACT_APP_KEYCLOAK_CLIENT_ID', currentEnvironment.id);

  // External servers
  const [servers, setServers] = useState(() => getExternalServersForEnvironment(currentEnvironment.id));

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
  const [environmentDialogOpen, setEnvironmentDialogOpen] = useState(false);
  const [editingEnvironmentId, setEditingEnvironmentId] = useState(null);
  const [environmentForm, setEnvironmentForm] = useState({
    label: '',
    color: ENVIRONMENT_COLOR_OPTIONS[0],
    icon: 'business'
  });
  const [environmentsExpanded, setEnvironmentsExpanded] = useState(false);

  // Error states
  const [error, setError] = useState(null);
  const [dialogError, setDialogError] = useState(null);
  const [environmentError, setEnvironmentError] = useState(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testingKeycloakConfig, setTestingKeycloakConfig] = useState(false);
  const [keycloakTestResult, setKeycloakTestResult] = useState(null);

  const refreshEnvironmentState = () => {
    setEnvironments(getEnvironments());
    setCurrentEnvironment(getCurrentEnvironment());
  };

  const handleSelectEnvironmentSettings = (environmentId) => {
    const environment = environments.find((item) => item.id === environmentId);
    if (!environment) {
      return;
    }

    setCurrentRole(environment.id);
    setCurrentEnvironment(environment);
    setInternalSettings(getInternalSettingsForEnvironment(environment.id));
    setServers(getExternalServersForEnvironment(environment.id));
    resetAuthClient();
    setError(null);
    setDialogError(null);
    setTestResult(null);
    setKeycloakTestResult(null);
  };

  const handleOpenEnvironmentDialog = (environment = null) => {
    if (environment) {
      setEditingEnvironmentId(environment.id);
      setEnvironmentForm({
        label: environment.label,
        color: environment.color,
        icon: environment.icon
      });
    } else {
      setEditingEnvironmentId(null);
      setEnvironmentForm({
        label: '',
        color: ENVIRONMENT_COLOR_OPTIONS[0],
        icon: 'business'
      });
    }

    setEnvironmentError(null);
    setEnvironmentDialogOpen(true);
  };

  const handleCloseEnvironmentDialog = () => {
    setEnvironmentDialogOpen(false);
    setEditingEnvironmentId(null);
    setEnvironmentForm({
      label: '',
      color: ENVIRONMENT_COLOR_OPTIONS[0],
      icon: 'business'
    });
    setEnvironmentError(null);
  };

  const handleEnvironmentSave = () => {
    const label = environmentForm.label.trim();

    if (!label) {
      setEnvironmentError('Environment name is required');
      return;
    }

    if (!isValidEnvironmentColor(environmentForm.color)) {
      setEnvironmentError('Choose a valid color');
      return;
    }

    const environmentToSave = normalizeEnvironment({
      id: editingEnvironmentId || createEnvironmentId(label, environments),
      label,
      color: environmentForm.color,
      icon: environmentForm.icon
    });

    const updatedEnvironments = editingEnvironmentId
      ? environments.map((environment) => (
        environment.id === editingEnvironmentId ? environmentToSave : environment
      ))
      : [...environments, environmentToSave];

    saveEnvironments(updatedEnvironments);
    setEnvironments(updatedEnvironments);
    setCurrentEnvironment(getCurrentEnvironment());
    handleCloseEnvironmentDialog();
  };

  const handleDeleteEnvironment = (environmentId) => {
    if (environments.length <= 1) {
      setEnvironmentError('Keep at least one environment');
      return;
    }

    const updatedEnvironments = environments.filter((environment) => environment.id !== environmentId);
    saveEnvironments(updatedEnvironments);
    setEnvironments(updatedEnvironments);

    if (currentEnvironment.id === environmentId) {
      const nextEnvironment = updatedEnvironments[0];
      setCurrentRole(nextEnvironment.id);
      setCurrentEnvironment(nextEnvironment);
      setInternalSettings(getInternalSettingsForEnvironment(nextEnvironment.id));
      setServers(getExternalServersForEnvironment(nextEnvironment.id));
      resetAuthClient();
      return;
    }

    refreshEnvironmentState();
  };

  // Save internal settings
  const handleInternalSave = () => {
    try {
      setRoleStorageItem('baseUrl', internalSettings.baseUrl.trim(), currentEnvironment.id);
      setEnvOverride('REACT_APP_KEYCLOAK_URL', internalSettings.keycloakUrl, currentEnvironment.id);
      setEnvOverride('REACT_APP_KEYCLOAK_REALM', internalSettings.keycloakRealm, currentEnvironment.id);
      setEnvOverride('REACT_APP_KEYCLOAK_CLIENT_ID', internalSettings.keycloakClientId, currentEnvironment.id);
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
    clearEnvOverride('REACT_APP_KEYCLOAK_URL', currentEnvironment.id);
    clearEnvOverride('REACT_APP_KEYCLOAK_REALM', currentEnvironment.id);
    clearEnvOverride('REACT_APP_KEYCLOAK_CLIENT_ID', currentEnvironment.id);
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

      setRoleStorageItem('externalServers', JSON.stringify(updatedServers), currentEnvironment.id);
      setServers(updatedServers);
      handleCloseDialog();
    } catch (err) {
      setDialogError('Failed to save server: ' + err.message);
    }
  };

  const handleDeleteServer = (index) => {
    const updatedServers = servers.filter((_, i) => i !== index);
    setRoleStorageItem('externalServers', JSON.stringify(updatedServers), currentEnvironment.id);
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
          Editing settings for environment: {currentEnvironment.label}
        </Alert>
      </Box>

      {/* Environments */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: environmentsExpanded ? 3 : 0
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title={environmentsExpanded ? 'Collapse' : 'Expand'}>
              <IconButton
                size="small"
                aria-label={environmentsExpanded ? 'Collapse environments' : 'Expand environments'}
                aria-expanded={environmentsExpanded}
                onClick={() => setEnvironmentsExpanded((expanded) => !expanded)}
              >
                <ExpandMoreIcon
                  sx={{
                    transform: environmentsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease'
                  }}
                />
              </IconButton>
            </Tooltip>
            <Typography variant="h6">Environments</Typography>
          </Box>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={() => handleOpenEnvironmentDialog()}
          >
            Add Environment
          </Button>
        </Box>

        <Collapse in={environmentsExpanded} timeout="auto" unmountOnExit>
          {environmentError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {environmentError}
            </Alert>
          )}

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Color</TableCell>
                  <TableCell>Icon</TableCell>
                  <TableCell>Settings</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {environments.map((environment) => {
                  const selectedForSettings = currentEnvironment.id === environment.id;

                  return (
                    <TableRow
                      key={environment.id}
                      sx={{
                        backgroundColor: selectedForSettings ? 'action.selected' : 'inherit'
                      }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                          <Box
                            sx={{
                              width: 34,
                              height: 34,
                              borderRadius: 1,
                              backgroundColor: environment.color,
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <EnvironmentIcon icon={environment.icon} sx={{ fontSize: 21 }} />
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 600 }} noWrap>
                              {environment.label}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {environment.id}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box
                            sx={{
                              width: 28,
                              height: 28,
                              borderRadius: 1,
                              backgroundColor: environment.color,
                              border: '1px solid rgba(0,0,0,0.16)'
                            }}
                          />
                          <Typography variant="body2">{environment.color}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{getEnvironmentIconLabel(environment.icon)}</TableCell>
                      <TableCell>
                        {selectedForSettings ? (
                          <Chip label="Editing" color="primary" size="small" />
                        ) : (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleSelectEnvironmentSettings(environment.id)}
                          >
                            Select
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Tooltip title="Edit">
                            <IconButton onClick={() => handleOpenEnvironmentDialog(environment)}>
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={environments.length <= 1 ? 'Keep at least one environment' : 'Delete'}>
                            <span>
                              <IconButton
                                color="error"
                                disabled={environments.length <= 1}
                                onClick={() => handleDeleteEnvironment(environment.id)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Collapse>
      </Paper>

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

      {/* Add/Edit Environment Dialog */}
      <Dialog
        open={environmentDialogOpen}
        onClose={handleCloseEnvironmentDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingEnvironmentId ? 'Edit Environment' : 'Add Environment'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {environmentError && (
              <Alert severity="error">
                {environmentError}
              </Alert>
            )}
            <TextField
              label="Environment Name"
              value={environmentForm.label}
              onChange={(event) => setEnvironmentForm((prev) => ({
                ...prev,
                label: event.target.value
              }))}
              fullWidth
              required
            />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Color
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                {ENVIRONMENT_COLOR_OPTIONS.map((color) => {
                  const selected = environmentForm.color.toLowerCase() === color.toLowerCase();

                  return (
                    <Tooltip title={color} key={color}>
                      <IconButton
                        onClick={() => setEnvironmentForm((prev) => ({
                          ...prev,
                          color
                        }))}
                        sx={{
                          width: 38,
                          height: 38,
                          borderRadius: 1,
                          backgroundColor: color,
                          color: 'white',
                          border: selected ? '2px solid #212121' : '1px solid rgba(0,0,0,0.18)',
                          '&:hover': {
                            backgroundColor: color,
                            filter: 'brightness(0.9)'
                          }
                        }}
                      >
                        {selected && <CheckIcon sx={{ fontSize: 20 }} />}
                      </IconButton>
                    </Tooltip>
                  );
                })}
              </Box>
              <TextField
                label="Custom Color"
                type="color"
                value={isValidEnvironmentColor(environmentForm.color) ? environmentForm.color : ENVIRONMENT_COLOR_OPTIONS[0]}
                onChange={(event) => setEnvironmentForm((prev) => ({
                  ...prev,
                  color: event.target.value
                }))}
                fullWidth
              />
            </Box>
            <FormControl fullWidth required>
              <InputLabel id="environment-icon-label">Icon</InputLabel>
              <Select
                labelId="environment-icon-label"
                label="Icon"
                value={environmentForm.icon}
                onChange={(event) => setEnvironmentForm((prev) => ({
                  ...prev,
                  icon: event.target.value
                }))}
                renderValue={(value) => (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EnvironmentIcon icon={value} sx={{ fontSize: 20 }} />
                    <Typography>{getEnvironmentIconLabel(value)}</Typography>
                  </Box>
                )}
              >
                {ENVIRONMENT_ICON_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <ListItemIcon>
                      <EnvironmentIcon icon={option.value} sx={{ fontSize: 20 }} />
                    </ListItemIcon>
                    <ListItemText primary={option.label} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEnvironmentDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleEnvironmentSave}
            disabled={!environmentForm.label.trim() || !isValidEnvironmentColor(environmentForm.color)}
          >
            {editingEnvironmentId ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

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
