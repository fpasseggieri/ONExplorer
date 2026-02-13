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
  // Internal API settings
  const [internalSettings, setInternalSettings] = useState({
    baseUrl: localStorage.getItem('baseUrl') || ''
  });

  // External servers
  const [servers, setServers] = useState(() => {
    const savedServers = localStorage.getItem('externalServers');
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

  // Save internal settings
  const handleInternalSave = () => {
    try {
      localStorage.setItem('baseUrl', internalSettings.baseUrl.trim());
      setError(null);
      // Navigate to home page after saving settings
      window.location.href = '/';
    } catch (err) {
      setError('Failed to save settings: ' + err.message);
    }
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

      localStorage.setItem('externalServers', JSON.stringify(updatedServers));
      setServers(updatedServers);
      handleCloseDialog();
    } catch (err) {
      setDialogError('Failed to save server: ' + err.message);
    }
  };

  const handleDeleteServer = (index) => {
    const updatedServers = servers.filter((_, i) => i !== index);
    localStorage.setItem('externalServers', JSON.stringify(updatedServers));
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
      </Box>

      {/* Internal API Settings */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 3 }}>Internal API Settings</Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          Authentication is managed via Keycloak sign-in (Authorization Code + PKCE). Only the API base URL is configured here.
        </Alert>
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
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          <Button 
            variant="contained" 
            onClick={handleInternalSave}
          >
            Save Internal Settings
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
