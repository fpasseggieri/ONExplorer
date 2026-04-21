import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Chip,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  Tooltip,
  Divider,
  MenuItem,
  Backdrop
} from '@mui/material';
import {
  Add as AddIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  RemoveCircleOutline as RevokeIcon,
  Refresh as RefreshIcon,
  Send as SendIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { getLogisticsObjects, apiCall, externalApiCall } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { validateSettings } from '../utils/settingsValidator';
import { getRoleStorageItem, setRoleStorageItem } from '../utils/roleStorage';

const TOPIC_TYPES = [
  'LOGISTICS_OBJECT_IDENTIFIER',
  'LOGISTICS_OBJECT_TYPE'
];

const TABLE_STYLES = {
  header: {
    variant: "h6",
    sx: { 
      mb: 2, 
      display: 'flex', 
      alignItems: 'center', 
      gap: 1,
      color: '#1976d2',
      fontWeight: 600 
    }
  },
  tableHead: {
    sx: { backgroundColor: '#f5f5f5' }
  },
  tableRow: {
    sx: { 
      '&:hover': { backgroundColor: '#f5f5f5' },
      backgroundColor: 'inherit'
    }
  }
};

const API_NS = 'https://onerecord.iata.org/ns/api#';

const getApiField = (obj, name) => {
  if (!obj) return undefined;
  const candidates = [`${API_NS}${name}`, `api:${name}`, name];
  for (const key of candidates) {
    if (obj[key] !== undefined) return obj[key];
  }
  return undefined;
};

const first = (value) => (Array.isArray(value) ? value[0] : value);

const toId = (value) => {
  const v = first(value);
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return v['@id'] || '';
  return '';
};

const toValue = (value) => {
  const v = first(value);
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return v['@value'] || '';
  return String(v);
};

const cleanSegment = (value) => {
  if (!value) return '';
  if (value.includes('#')) return value.split('#').pop();
  if (value.includes('/')) return value.split('/').pop();
  if (value.includes(':')) return value.split(':').pop();
  return value;
};

const formatRequest = (item) => {
  const subscriptionNode = first(getApiField(item, 'hasSubscription'));
  const statusId = toId(getApiField(item, 'hasRequestStatus'));
  const requestedBy = toId(getApiField(item, 'isRequestedBy'));
  const requestedAt = toValue(getApiField(item, 'isRequestedAt'));
  const subscriptionRef = toId(subscriptionNode || getApiField(item, 'hasSubscription'));
  const subscriptionSubscriber = toId(getApiField(subscriptionNode, 'hasSubscriber'));
  const topic = toValue(getApiField(subscriptionNode, 'hasTopic'));

  return {
    id: cleanSegment(item['@id']),
    status: cleanSegment(statusId) || 'UNKNOWN',
    subscriber: subscriptionSubscriber || requestedBy || '-',
    requestTime: requestedAt || '',
    subscription: cleanSegment(subscriptionRef) || '-',
    topic: topic || '-'
  };
};

const normalizeExternalSubscriptionRecord = (item) => {
  const actionRequestId = item.actionRequestId || item.subscriptionId || item.id || '';
  return {
    id: actionRequestId,
    actionRequestId,
    actionRequestUri: item.actionRequestUri || item.uri || '',
    server: item.server || '',
    serverId: item.serverId || '',
    topic: item.topic || '-',
    subscriber: item.subscriber || '-',
    topicType: item.topicType || '',
    requestTime: item.requestTime || item.requestedAt || item.createdAt || '',
    status: item.status || 'UNKNOWN',
    subscription: item.subscription || '-',
    statusSource: item.statusSource || 'local'
  };
};

const ActionButtons = ({ subscription, onStatusUpdate }) => {
  const navigate = useNavigate();
  const isPending = subscription.status === 'REQUEST_PENDING';
  const isAccepted = subscription.status === 'REQUEST_ACCEPTED';
  
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
      <Tooltip title="View Details">
        <IconButton
          color="primary"
          onClick={() => navigate(`/subscription-requests/${subscription.id}`)} // Fixed URL path
        >
          <VisibilityIcon />
          
        </IconButton>
      </Tooltip>
      
      <Tooltip title={isPending ? "Approve" : "Available only for pending requests"}>
        <span>
          <IconButton
            color="success"
            onClick={() => onStatusUpdate(subscription.id, 'REQUEST_ACCEPTED')}
            disabled={!isPending}
            sx={{
              '&.Mui-disabled': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                color: 'rgba(0, 0, 0, 0.26)'
              }
            }}
          >
            <CheckIcon />
          </IconButton>
        </span>
      </Tooltip>
      
      <Tooltip title={isPending ? "Reject" : "Available only for pending requests"}>
        <span>
          <IconButton
            color="error"
            onClick={() => onStatusUpdate(subscription.id, 'REQUEST_REJECTED')}
            disabled={!isPending}
            sx={{
              '&.Mui-disabled': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                color: 'rgba(0, 0, 0, 0.26)'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title={isAccepted ? "Revoke" : "Available only for accepted requests"}>
        <span>
          <IconButton
            color="warning"
            onClick={() => onStatusUpdate(subscription.id, 'REQUEST_REVOKED')}
            disabled={!isAccepted}
            sx={{
              '&.Mui-disabled': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                color: 'rgba(0, 0, 0, 0.26)'
              }
            }}
          >
            <RevokeIcon />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
};

const Subscriptions = () => {
  const navigate = useNavigate(); // Initialize navigate
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [newSubscription, setNewSubscription] = useState({
    topic: '',
    subscriber: '',
    topictype: 'LOGISTICS_OBJECT_IDENTIFIER',
    serverId: '' // Add server selection
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [servers, setServers] = useState([]);
  const [externalSubscriptions, setExternalSubscriptions] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [subscriptionToDelete, setSubscriptionToDelete] = useState(null);
  const [settingsValid, setSettingsValid] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [internalPage, setInternalPage] = useState(0);
  const [internalRowsPerPage, setInternalRowsPerPage] = useState(10);
  const [externalPage, setExternalPage] = useState(0);
  const [externalRowsPerPage, setExternalRowsPerPage] = useState(10);
  
  // Add this helper function inside the component
  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  useEffect(() => {
    const { isValid } = validateSettings();
    setSettingsValid(isValid);
  }, []);

  const persistExternalSubscriptions = useCallback((items) => {
    setRoleStorageItem('externalSubscriptions', JSON.stringify(items));
    setExternalSubscriptions(items);
  }, []);

  const fetchSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getLogisticsObjects('https%3A%2F%2Fonerecord.iata.org%2Fns%2Fapi%23SubscriptionRequest');
      
      const rawData = response['@graph'] ? response['@graph'] : [response];
      const cleanArray = rawData.filter(value => Object.keys(value).length !== 0);
      const cleanedData = cleanArray.map(formatRequest);

      const sortedSubscriptions = cleanedData.sort((a, b) => {
        return new Date(b.requestTime) - new Date(a.requestTime);
      });

      setSubscriptions(sortedSubscriptions);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (settingsValid) {
      fetchSubscriptions();
    }
  }, [settingsValid, fetchSubscriptions]);

  useEffect(() => {
    const loadServers = () => {
      const savedServers = JSON.parse(getRoleStorageItem('externalServers') || '[]');
      setServers(savedServers);
    };
    loadServers();
  }, []);

  const fetchExternalSubscriptions = useCallback(async () => {
    const saved = JSON.parse(getRoleStorageItem('externalSubscriptions') || '[]');
    const normalized = saved.map(normalizeExternalSubscriptionRecord);

    if (normalized.length === 0) {
      setExternalSubscriptions([]);
      return;
    }

    const hydrated = await Promise.all(normalized.map(async (item) => {
      const server = servers.find((entry) => entry.id === item.serverId);
      if (!server || !item.actionRequestId) {
        return item;
      }

      try {
        const response = await externalApiCall(server.baseUrl, `/action-requests/${item.actionRequestId}`, {
          method: 'GET',
          server
        });
        const parsed = formatRequest(response);
        return {
          ...item,
          status: parsed.status,
          requestTime: parsed.requestTime || item.requestTime,
          subscriber: parsed.subscriber || item.subscriber,
          subscription: parsed.subscription || item.subscription,
          topic: parsed.topic || item.topic,
          statusSource: 'remote'
        };
      } catch (err) {
        return {
          ...item,
          statusSource: 'local'
        };
      }
    }));

    const sorted = hydrated.sort((a, b) => new Date(b.requestTime) - new Date(a.requestTime));
    persistExternalSubscriptions(sorted);
  }, [persistExternalSubscriptions, servers]);

  useEffect(() => {
    fetchExternalSubscriptions();
  }, [fetchExternalSubscriptions]);

  useEffect(() => {
    setInternalPage(0);
    setExternalPage(0);
  }, [statusFilter]);

  useEffect(() => {
    const filteredCount = subscriptions.filter((subscription) => {
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'NOT_APPROVED') return subscription.status !== 'REQUEST_ACCEPTED';
      return subscription.status === statusFilter;
    }).length;
    const maxPage = Math.max(0, Math.ceil(filteredCount / internalRowsPerPage) - 1);
    if (internalPage > maxPage) {
      setInternalPage(maxPage);
    }
  }, [subscriptions, statusFilter, internalPage, internalRowsPerPage]);

  useEffect(() => {
    const filteredCount = externalSubscriptions.filter((subscription) => {
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'NOT_APPROVED') return subscription.status !== 'REQUEST_ACCEPTED';
      return subscription.status === statusFilter;
    }).length;
    const maxPage = Math.max(0, Math.ceil(filteredCount / externalRowsPerPage) - 1);
    if (externalPage > maxPage) {
      setExternalPage(maxPage);
    }
  }, [externalSubscriptions, statusFilter, externalPage, externalRowsPerPage]);

  const refreshAll = async () => {
    if (settingsValid) {
      await fetchSubscriptions();
    }
    await fetchExternalSubscriptions();
  };

  const matchesStatusFilter = (status) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'NOT_APPROVED') return status !== 'REQUEST_ACCEPTED';
    return status === statusFilter;
  };

  const filteredInternalSubscriptions = subscriptions.filter((subscription) => matchesStatusFilter(subscription.status));
  const filteredExternalSubscriptions = externalSubscriptions.filter((subscription) => matchesStatusFilter(subscription.status));

  const pagedInternalSubscriptions = filteredInternalSubscriptions.slice(
    internalPage * internalRowsPerPage,
    internalPage * internalRowsPerPage + internalRowsPerPage
  );

  const pagedExternalSubscriptions = filteredExternalSubscriptions.slice(
    externalPage * externalRowsPerPage,
    externalPage * externalRowsPerPage + externalRowsPerPage
  );

  const handleCreateSubscription = async () => {
    try {
        setSubmitting(true);
        setSubmitError(null);

        const selectedServer = servers.find(s => s.id === newSubscription.serverId);
        if (!selectedServer) {
            throw new Error('Please select a server');
        }

        
        const subscriptionPayload = {
            "@context": {
                "cargo": "https://onerecord.iata.org/ns/cargo#",
                "api": "https://onerecord.iata.org/ns/api#"
            },
            "@type": "api:Subscription",
            "api:hasContentType": "application/ld+json",
            "api:hasSubscriber": {
                "@id": newSubscription.subscriber
            },
            "api:hasTopicType": {
                "@id": `api:${newSubscription.topictype}`
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
                "@value": newSubscription.topic
            },
            "api:sendLogisticsObjectBody": false
        };

        // Use externalApiCall with the selected server's base URL
        const response = await externalApiCall(
            selectedServer.baseUrl,
            '/subscriptions',
            {
                method: 'POST',
                body: JSON.stringify(subscriptionPayload),
                server: selectedServer,
                returnFullResponse: true
            }
        );

        // Get subscription ID from Location header
        const locationHeader = response.headers.get('Location');
        if (locationHeader) {
            // Extract the subscription ID from the location header
            const actionRequestId = locationHeader.split('/').pop();
            
            const newExternalSub = {
                id: actionRequestId,
                server: selectedServer.name,
                serverId: selectedServer.id,
                topic: newSubscription.topic,
                subscriber: newSubscription.subscriber,
                topicType: newSubscription.topictype,
                requestTime: new Date().toISOString(),
                status: 'UNKNOWN',
                actionRequestId,
                actionRequestUri: locationHeader
            };

            const updatedSubs = [...externalSubscriptions, newExternalSub];
            persistExternalSubscriptions(updatedSubs);
            await fetchExternalSubscriptions();
        }

        // Reset form and close dialog
        setOpenDialog(false);
        setNewSubscription({
            topic: '',
            subscriber: '',
            topictype: 'LOGISTICS_OBJECT_IDENTIFIER',
            serverId: ''
        });

    } catch (err) {
        console.error('Subscription creation error:', err);
        setSubmitError(err.message || 'Failed to create subscription');
    } finally {
        setSubmitting(false);
    }
};

  const handleStatusUpdate = async (subscriptionId, newStatus) => {
    try {
      setActionLoading(true); // Block the screen

      if (newStatus === 'REQUEST_REVOKED') {
        await apiCall(`/action-requests/${subscriptionId}`, {
          method: 'DELETE'
        });
      } else {
        await apiCall(`/action-requests/${subscriptionId}?status=${newStatus}`, {
          method: 'PATCH'
        });
      }

      // Add a small delay to ensure the server has processed the update
      await new Promise(resolve => setTimeout(resolve, 500));

      // Refresh the table and wait for it to complete
      await fetchSubscriptions();
      
    } catch (err) {
      console.error(`Error updating subscription status: ${err.message}`);
      setError(`Failed to update status: ${err.message}`);
    } finally {
      // Small delay to ensure the UI has updated
      setTimeout(() => {
        setActionLoading(false); // Unblock the screen
      }, 300);
    }
  };

  const handleForgetExternalSubscription = (subscription) => {
    setSubscriptionToDelete(subscription);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (subscriptionToDelete) {
      const updatedSubs = externalSubscriptions.filter(
        sub => sub.id !== subscriptionToDelete.id
      );
      persistExternalSubscriptions(updatedSubs);
    }
    setDeleteDialogOpen(false);
    setSubscriptionToDelete(null);
  };

  const handleExternalStatusUpdate = async (subscription, newStatus) => {
    const server = servers.find((entry) => entry.id === subscription.serverId);
    if (!server) {
      setError('External server configuration not found for this request');
      return;
    }

    try {
      setActionLoading(true);
      if (newStatus === 'REQUEST_REVOKED') {
        await externalApiCall(server.baseUrl, `/action-requests/${subscription.actionRequestId}`, {
          method: 'DELETE',
          server
        });
      } else {
        await externalApiCall(server.baseUrl, `/action-requests/${subscription.actionRequestId}?status=${newStatus}`, {
          method: 'PATCH',
          server
        });
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchExternalSubscriptions();
    } catch (err) {
      console.error(`Error updating external request status: ${err.message}`);
      setError(`Failed to update external request status: ${err.message}`);
    } finally {
      setTimeout(() => {
        setActionLoading(false);
      }, 300);
    }
  };

  const renderExternalActionButtons = (subscription) => {
    const isAccepted = subscription.status === 'REQUEST_ACCEPTED';

    return (
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Tooltip title="View Details">
          <IconButton
            color="primary"
            onClick={() => navigate(`/external-subscription-requests/${subscription.serverId}/${subscription.actionRequestId}`)}
          >
            <VisibilityIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title={isAccepted ? 'Revoke' : 'Available only for accepted requests'}>
          <span>
            <IconButton
              color="warning"
              onClick={() => handleExternalStatusUpdate(subscription, 'REQUEST_REVOKED')}
              disabled={!isAccepted}
              sx={{
                '&.Mui-disabled': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  color: 'rgba(0, 0, 0, 0.26)'
                }
              }}
            >
              <RevokeIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Forget local record">
          <IconButton
            color="error"
            onClick={() => handleForgetExternalSubscription(subscription)}
          >
            <CloseIcon />
          </IconButton>
        </Tooltip>
      </Box>
    );
  };

  const ExternalSubscriptionsTable = () => (
    <>
      <Typography {...TABLE_STYLES.header} sx={{ mt: 4, display: 'flex', alignItems: 'center', gap: 1 }}>
        <SendIcon />
        Outbound Subscription Requests
      </Typography>
      {filteredExternalSubscriptions.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="textSecondary">
            No outbound subscription requests found
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow {...TABLE_STYLES.tableHead}>
                <TableCell>Server</TableCell>
                <TableCell>Request ID</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Topic</TableCell>
                <TableCell>Subscriber</TableCell>
                <TableCell>Requested At</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pagedExternalSubscriptions.map((sub) => (
                <TableRow 
                  key={sub.id}
                  {...TABLE_STYLES.tableRow}
                >
                  <TableCell>{sub.server}</TableCell>
                  <TableCell>{sub.actionRequestId}</TableCell>
	                  <TableCell>
	                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
	                      <span>{sub.status}</span>
	                      {sub.statusSource !== 'remote' && (
	                        <Chip
	                          label="Not refreshed"
	                          size="small"
	                          color="warning"
	                          variant="outlined"
	                        />
	                      )}
	                    </Box>
	                  </TableCell>
                  <TableCell>{sub.topic}</TableCell>
                  <TableCell>{sub.subscriber}</TableCell>
                  <TableCell>{sub.requestTime ? new Date(sub.requestTime).toLocaleString() : '-'}</TableCell>
                  <TableCell>{renderExternalActionButtons(sub)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={filteredExternalSubscriptions.length}
            page={externalPage}
            onPageChange={(_, newPage) => setExternalPage(newPage)}
            rowsPerPage={externalRowsPerPage}
            onRowsPerPageChange={(event) => {
              setExternalRowsPerPage(parseInt(event.target.value, 10));
              setExternalPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </TableContainer>
      )}
    </>
  );

  return (
    <Box sx={{ maxWidth: 1200, margin: '0 auto', p: 3 }}>
      {/* Add the Backdrop component */}
      <Backdrop
        sx={{ 
          color: '#fff', 
          zIndex: (theme) => theme.zIndex.drawer + 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}
        open={actionLoading}
      >
        <CircularProgress color="inherit" />
        <Typography>Processing request...</Typography>
      </Backdrop>

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          mb: 3
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SendIcon 
              sx={{ 
                fontSize: 40,
                color: '#1976d2'
              }} 
            />
            <Typography 
              variant="h4" 
              sx={{ 
                fontWeight: 600,
                color: '#1976d2'
              }}
            >
              Subscriptions
            </Typography>
          </Box>
          
	          <Box sx={{ display: 'flex', gap: 2 }}>
	            <TextField
	              select
	              size="small"
	              label="Status Filter"
	              value={statusFilter}
	              onChange={(e) => setStatusFilter(e.target.value)}
	              sx={{ minWidth: 180 }}
	            >
	              <MenuItem value="ALL">All</MenuItem>
	              <MenuItem value="REQUEST_ACCEPTED">Approved</MenuItem>
	              <MenuItem value="NOT_APPROVED">Not Approved</MenuItem>
	              <MenuItem value="REQUEST_REVOKED">Revoked</MenuItem>
	              <MenuItem value="REQUEST_PENDING">Pending</MenuItem>
	              <MenuItem value="REQUEST_REJECTED">Rejected</MenuItem>
	              <MenuItem value="UNKNOWN">Unknown</MenuItem>
	            </TextField>
	            <Button
	              startIcon={<RefreshIcon />}
	              onClick={refreshAll}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenDialog(true)}
            >
              New Subscription
            </Button>
          </Box>
        </Box>
        <Divider />
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={refreshAll}
            >
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* Internal Subscriptions Table */}
      <Typography {...TABLE_STYLES.header}>
        <SendIcon />
        Incoming Subscription Requests
      </Typography>

      {!settingsValid ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="textSecondary">
            Please configure API settings to view incoming subscription requests
          </Typography>
        </Paper>
      ) : loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : filteredInternalSubscriptions.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="textSecondary">
            No incoming subscription requests found
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow {...TABLE_STYLES.tableHead}>
                <TableCell>Request ID</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Subscriber</TableCell>
                <TableCell>Subscription Ref</TableCell>
                <TableCell>Requested At</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pagedInternalSubscriptions.map((subscription) => (
                <TableRow
                  key={subscription.id}
                  {...TABLE_STYLES.tableRow}
                >
                  <TableCell>{subscription.id}</TableCell>
                  <TableCell>{subscription.status}</TableCell>
                  <TableCell>{subscription.subscriber}</TableCell>
                  <TableCell>{subscription.subscription}</TableCell>
                  <TableCell>
                    {subscription.requestTime ? new Date(subscription.requestTime).toLocaleString() : '-'}
                  </TableCell>
                  <TableCell>
                    <ActionButtons 
                      subscription={subscription}
                      onStatusUpdate={handleStatusUpdate}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={filteredInternalSubscriptions.length}
            page={internalPage}
            onPageChange={(_, newPage) => setInternalPage(newPage)}
            rowsPerPage={internalRowsPerPage}
            onRowsPerPageChange={(event) => {
              setInternalRowsPerPage(parseInt(event.target.value, 10));
              setInternalPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </TableContainer>
      )}

      {/* External Subscriptions Table */}
      <ExternalSubscriptionsTable />

      {/* New Subscription Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Subscription</DialogTitle>
        <DialogContent>
          {submitError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {submitError}
            </Alert>
          )}
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              select
              label="Server"
              value={newSubscription.serverId}
              onChange={(e) => setNewSubscription(prev => ({
                ...prev,
                serverId: e.target.value
              }))}
              fullWidth
              required
              helperText={servers.length === 0 ? 
                "No external servers configured. Please add servers in Settings." : 
                "Select the server to create the subscription on"
              }
              error={servers.length === 0}
            >
              {servers.map((server) => (
                <MenuItem key={server.id} value={server.id}>
                  {server.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Topic Type"
              value={newSubscription.topictype}
              onChange={(e) => setNewSubscription(prev => ({
                ...prev,
                topictype: e.target.value
              }))}
              fullWidth
              required
              helperText="Select the type of topic to subscribe to"
            >
              {TOPIC_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {type.replace(/_/g, ' ')}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Topic URI"
              fullWidth
              value={newSubscription.topic}
              onChange={(e) => setNewSubscription(prev => ({
                ...prev,
                topic: e.target.value
              }))}
              helperText="The URI of the logistics object to subscribe to (e.g., https://1r.example.com/logistics-objects/123)"
              error={newSubscription.topic && !isValidUrl(newSubscription.topic)}
              required
            />

            <TextField
              label="Subscriber URI"
              fullWidth
              value={newSubscription.subscriber}
              onChange={(e) => setNewSubscription(prev => ({
                ...prev,
                subscriber: e.target.value
              }))}
              helperText="The URI of the subscriber (e.g., https://1r.example.com/logistics-objects/456)"
              error={newSubscription.subscriber && !isValidUrl(newSubscription.subscriber)}
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setOpenDialog(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateSubscription}
            disabled={submitting || !isValidUrl(newSubscription.topic) || !isValidUrl(newSubscription.subscriber)}
            startIcon={submitting ? <CircularProgress size={20} /> : null}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add this Dialog component at the end */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Forget Outbound Request Record</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 2 }}>
            This only forgets the outbound request in this browser.
            It does not revoke the remote subscription request on the external server.
          </Alert>
          <Typography sx={{ mt: 2 }}>
            Are you sure you want to forget this local record?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={confirmDelete} 
            color="error" 
            variant="contained"
          >
            Forget Local Record
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Subscriptions;
