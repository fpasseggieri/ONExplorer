import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Import useNavigate
import {
  Box,
  CircularProgress,
  Alert,
  Chip,
  Card,
  CardContent,
  Link,
  Tooltip,
  Typography,
  Button
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Send as SendIcon,
  AccessTime as AccessTimeIcon,
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  Topic as TopicIcon,
  Category as CategoryIcon,
  AccountCircle as AccountCircleIcon
} from '@mui/icons-material';
import { apiCall, externalApiCall } from '../utils/api';
import { getExternalServerById } from '../utils/externalAuth';
import jsonld from 'jsonld';
import { Link as RouterLink } from 'react-router-dom'; // Import RouterLink if used
import { getRoleStorageItem } from '../utils/roleStorage';

const API_NS = 'https://onerecord.iata.org/ns/api#';

const getApiField = (obj, name) => {
  if (!obj) return undefined;
  const candidates = [name, `api:${name}`, `${API_NS}${name}`];
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
  const text = String(value);
  if (text.includes('#')) return text.split('#').pop();
  if (text.includes('/')) return text.split('/').filter(Boolean).pop() || '';
  if (text.includes(':')) return text.split(':').pop();
  return text;
};

const SubscriptionRequestView = () => {
  const { id, serverId } = useParams();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Frame for JSON-LD processing
  const frame = useMemo(() => ({
    "@context": {
      "@vocab": "https://onerecord.iata.org/ns/api#",
      "cargo": "https://onerecord.iata.org/ns/cargo#"
    },
    "@type": "SubscriptionRequest"
  }), []);

  // Clean subscription data function
  const cleanSubscriptionData = useCallback((rawData) => {
    if (!rawData) return null;
    const subscriptionNode = first(getApiField(rawData, 'hasSubscription'));

    return {
      id: cleanSegment(rawData['@id']) || id,
      type: cleanSegment(toId(rawData['@type'])) || '',
      status: cleanSegment(toId(getApiField(rawData, 'hasRequestStatus'))) || 'UNKNOWN',
      requestedBy: toId(getApiField(rawData, 'isRequestedBy')) || '',
      requestTime: toValue(getApiField(rawData, 'isRequestedAt')) || '',
      subscription: {
        id: cleanSegment(toId(subscriptionNode)) || '',
        subscriber: toId(getApiField(subscriptionNode, 'hasSubscriber')) || '',
        topic: toValue(getApiField(subscriptionNode, 'hasTopic')) || '',
        topicType: cleanSegment(toId(getApiField(subscriptionNode, 'hasTopicType'))) || ''
      }
    };
  }, [id]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Fetching subscription request:', { id, serverId }); // Debug log
        setLoading(true);
        let response;
        
        if (serverId) {
          // External server request
          const selectedServer = getExternalServerById(serverId);
          if (!selectedServer) {
            throw new Error('Server not found');
          }
          console.log('External server request:', selectedServer.baseUrl); // Debug log
          response = await externalApiCall(selectedServer.baseUrl, `/action-requests/${id}`, {
            method: 'GET',
            server: selectedServer
          });
        } else {
          // Internal server request
          console.log('Internal server request for ID:', id); // Debug log
          response = await apiCall(`/action-requests/${id}`, {
            method: 'GET'
          });
        }

        console.log('Raw API response:', response); // Debug log

        // Frame the response data
        const framed = await jsonld.frame(response, frame);
        console.log('Framed data:', framed); // Debug log
        
        // Clean the subscription data
        const cleanedData = cleanSubscriptionData(framed);
        console.log('Cleaned data:', cleanedData); // Debug log
        
        if (!cleanedData) {
          throw new Error('Failed to process subscription data');
        }

        setSubscription(cleanedData);
        setError(null);
      } catch (err) {
        console.error('Error in fetchData:', err); // Detailed error logging
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (id) { // Only fetch if we have an ID
      fetchData();
    } else {
      console.error('No subscription ID provided'); // Debug log
      setError('No subscription ID provided');
      setLoading(false);
    }
  }, [id, serverId, frame, cleanSubscriptionData]);

  const handleBack = () => {
    navigate('/subscriptions');
  };

  // Add helper function to format status chip
  const getStatusChipProps = (status) => {
    const statusConfig = {
      'REQUEST_ACCEPTED': { color: 'success', label: 'Accepted' },
      'REQUEST_REJECTED': { color: 'error', label: 'Rejected' },
      'REQUEST_PENDING': { color: 'warning', label: 'Pending' },
      'UNKNOWN': { color: 'default', label: 'Unknown' }
    };
    return statusConfig[status] || statusConfig['UNKNOWN'];
  };

  // Add helper function to format subscriber link
  const formatSubscriberLink = (url) => {
    const apiBaseUrl = getRoleStorageItem('baseUrl') || '';
    const isInternal = url.startsWith(apiBaseUrl);
    const displayId = url.split('/').pop();

    return isInternal ? (
      <RouterLink 
        to={`/logistics-objects/${displayId}`}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '4px',
          color: '#1976d2',
          textDecoration: 'none' 
        }}
      >
        <AccountCircleIcon fontSize="small" />
        {displayId}
      </RouterLink>
    ) : (
      <Link 
        href={url}
        target="_blank"
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
      >
        <AccountCircleIcon fontSize="small" />
        {displayId}
      </Link>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, margin: '0 auto', p: 3 }}>
      {/* Header with improved styling */}
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          sx={{ mb: 2 }}
        >
          Back to Subscriptions
        </Button>
        
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2, 
          mb: 2,
          backgroundColor: 'primary.main',
          color: 'white',
          p: 3,
          borderRadius: 2,
          boxShadow: 2
        }}>
          <SendIcon sx={{ fontSize: 40 }} />
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
              Subscription Request Details
            </Typography>
            <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
              ID: {subscription?.id}
            </Typography>
          </Box>
        </Box>
      </Box>

      {subscription && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Status Card */}
          <Card>
            <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Chip 
                label={getStatusChipProps(subscription.status).label}
                color={getStatusChipProps(subscription.status).color}
                sx={{ fontWeight: 'bold' }}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AccessTimeIcon color="action" />
                <Typography>
                  {new Date(subscription.requestTime).toLocaleString()}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonIcon color="action" />
                <Typography>
                  {subscription.requestedBy.split('/').pop()}
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Subscription Details Card */}
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <NotificationsIcon color="primary" />
                Subscription Details
              </Typography>
              
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3 }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom>Subscription ID</Typography>
                  <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {subscription.subscription.id}
                  </Typography>
                </Box>
                
                <Box>
                  <Typography color="textSecondary" gutterBottom>Subscriber</Typography>
                  {formatSubscriberLink(subscription.subscription.subscriber)}
                </Box>
                
                <Box>
                  <Typography color="textSecondary" gutterBottom>Topic</Typography>
                  <Tooltip title={subscription.subscription.topic}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <TopicIcon fontSize="small" color="primary" />
                      <Typography noWrap>
                        {subscription.subscription.topic}
                      </Typography>
                    </Box>
                  </Tooltip>
                </Box>
                
                <Box>
                  <Typography color="textSecondary" gutterBottom>Topic Type</Typography>
                  <Chip 
                    icon={<CategoryIcon />}
                    label={subscription.subscription.topicType}
                    color="primary"
                    variant="outlined"
                    size="small"
                  />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
};

export default SubscriptionRequestView;
