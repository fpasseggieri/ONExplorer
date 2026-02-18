import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { apiCall } from '../utils/api';

const formatDate = (value) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const NotificationsNew = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSubscriptions, setActiveSubscriptions] = useState([]);
  const [outboundNotifications, setOutboundNotifications] = useState([]);
  const [receivedNotifications, setReceivedNotifications] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      };

      const [subscriptionsData, outboundData, receivedData] = await Promise.all([
        apiCall('/logistics-objects/internal/_subscriptions?status=ACTIVE&limit=50&offset=0', { method: 'GET', headers }),
        apiCall('/logistics-objects/internal/_notifications?limit=50&offset=0', { method: 'GET', headers }),
        apiCall('/logistics-objects/internal/_notifications/received?limit=50&offset=0', { method: 'GET', headers })
      ]);

      setActiveSubscriptions(Array.isArray(subscriptionsData?.items) ? subscriptionsData.items : []);
      setOutboundNotifications(Array.isArray(outboundData?.items) ? outboundData.items : []);
      setReceivedNotifications(Array.isArray(receivedData?.items) ? receivedData.items : []);
    } catch (err) {
      setError(err.message || 'Failed to load notifications dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <Box sx={{ maxWidth: 1400, margin: '0 auto', p: 3 }}>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          backgroundColor: 'primary.main',
          color: 'white',
          borderRadius: 2
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <NotificationsIcon sx={{ fontSize: 40 }} />
            <Typography variant="h4" sx={{ fontWeight: 500 }}>
              Notifications (New Internal Endpoints)
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="inherit"
            startIcon={<RefreshIcon />}
            onClick={fetchData}
            disabled={loading}
            sx={{
              color: 'primary.main',
              bgcolor: 'white',
              '&:hover': { bgcolor: 'grey.100' }
            }}
          >
            Refresh
          </Button>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Paper sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Chip label={`Active subscriptions: ${activeSubscriptions.length}`} color="primary" />
              <Chip label={`Outbound notifications: ${outboundNotifications.length}`} color="info" />
              <Chip label={`Received notifications: ${receivedNotifications.length}`} color="success" />
            </Box>
          </Paper>

          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Outbound Notifications
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Event Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Aggregate IRI</TableCell>
                    <TableCell>Callback URL</TableCell>
                    <TableCell>Attempts</TableCell>
                    <TableCell>Last Response</TableCell>
                    <TableCell>Created At</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {outboundNotifications.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>No outbound notifications found</TableCell>
                    </TableRow>
                  ) : (
                    outboundNotifications.map((item) => (
                      <TableRow key={item.id || item.idempotencyKey}>
                        <TableCell>{item.eventType || '-'}</TableCell>
                        <TableCell>{item.status || '-'}</TableCell>
                        <TableCell sx={{ wordBreak: 'break-all' }}>{item.aggregateIri || '-'}</TableCell>
                        <TableCell sx={{ wordBreak: 'break-all' }}>{item.callbackUrl || '-'}</TableCell>
                        <TableCell>{item.attempts ?? '-'}</TableCell>
                        <TableCell>{item.lastResponseCode ?? '-'}</TableCell>
                        <TableCell>{formatDate(item.createdAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Received Notifications
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Event Type</TableCell>
                    <TableCell>Logistics Object IRI</TableCell>
                    <TableCell>Action Request IRI</TableCell>
                    <TableCell>Processed At</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {receivedNotifications.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4}>No received notifications found</TableCell>
                    </TableRow>
                  ) : (
                    receivedNotifications.map((item) => (
                      <TableRow key={item.id || item.idempotencyKey}>
                        <TableCell>{item.eventType || '-'}</TableCell>
                        <TableCell sx={{ wordBreak: 'break-all' }}>{item.logisticsObjectIri || '-'}</TableCell>
                        <TableCell sx={{ wordBreak: 'break-all' }}>{item.actionRequestIri || '-'}</TableCell>
                        <TableCell>{formatDate(item.processedAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Divider sx={{ my: 3 }} />

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Active Subscriptions
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Status</TableCell>
                    <TableCell>Topic Type</TableCell>
                    <TableCell>Topic</TableCell>
                    <TableCell>Subscriber</TableCell>
                    <TableCell>Callback URL</TableCell>
                    <TableCell>Created At</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activeSubscriptions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>No active subscriptions found</TableCell>
                    </TableRow>
                  ) : (
                    activeSubscriptions.map((item) => (
                      <TableRow key={item.iri || `${item.topic}-${item.callbackUrl}`}>
                        <TableCell>{item.status || '-'}</TableCell>
                        <TableCell>{item.topicType || '-'}</TableCell>
                        <TableCell sx={{ wordBreak: 'break-all' }}>{item.topic || '-'}</TableCell>
                        <TableCell sx={{ wordBreak: 'break-all' }}>{item.subscriberIri || '-'}</TableCell>
                        <TableCell sx={{ wordBreak: 'break-all' }}>{item.callbackUrl || '-'}</TableCell>
                        <TableCell>{formatDate(item.createdAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}
    </Box>
  );
};

export default NotificationsNew;
