import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Divider,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Checkbox,
  FormControlLabel,
  IconButton,
  Tooltip,
  Switch,
  Stack,
  Link,
} from '@mui/material';

import {
    Timeline,
    TimelineItem,
    TimelineSeparator,
    TimelineConnector,
    TimelineContent,
    TimelineDot,
    TimelineOppositeContent
  } from '@mui/lab';
  
import {
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
  LocalShipping as LocalShippingIcon,
  Description as DescriptionIcon,
  Send as SendIcon,
  ContentCopy as ContentCopyIcon,
  Event as EventIcon,
  ExpandMore as ExpandMoreIcon,
  Code as CodeIcon,
  Info as InfoIcon,
  Group as GroupIcon,
  NotificationsActive as NotificationsActiveIcon
} from '@mui/icons-material';
import jsonld from 'jsonld';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import { requireAccessToken, createAuthRequiredError } from '../utils/api';
import { getExternalAccessToken, getExternalServerByBaseUrl } from '../utils/externalAuth';


// Update EVENT_TYPES constant with standardized codes
const EVENT_TYPES = [
  { code: 'FMA', name: 'Freight Management Acceptance', description: 'Acceptance of freight for management' },
  { code: 'RCS', name: 'Ready for Carriage Status', description: 'Shipment is ready for carriage' },
  { code: 'DEP', name: 'Flight Departure', description: 'Flight has departed' },
  { code: 'ARR', name: 'Arrived Flight', description: 'Flight has arrived' },
  { code: 'TFD', name: 'Transferred', description: 'Shipment has been transferred' },
  { code: 'NFD', name: 'Notification of Delivery', description: 'Delivery notification sent' },
  { code: 'AWD', name: 'Arrived and Waiting Delivery', description: 'Shipment arrived and awaiting delivery' },
  { code: 'DLV', name: 'Delivered', description: 'Shipment has been delivered' },
  { code: 'FOH', name: 'Freight On-Hand', description: 'Freight is on hand' },
  { code: 'RCT', name: 'Ready for Collection Time', description: 'Ready for collection' },
  { code: 'RCF', name: 'Received from Flight', description: 'Received from flight' },
  { code: 'CSF', name: 'Customs filing', description: 'Data ready for Customs filing'},
  { code: 'RFI', name: 'Request for information', description: 'Request for information'},
  { code: 'RFS', name: 'Request for screening', description: 'Request for screening'},
  { code: 'ASC', name: 'Assessment Completion', description: 'Assessment Completion'},
  { code: 'DNL', name: 'Do Not Load', description: 'Do Not Load'}
];

// Add EVENT_TIME_TYPES constant
const EVENT_TIME_TYPES = [
  { value: 'ACTUAL', label: 'Actual' },
  { value: 'ESTIMATED', label: 'Estimated' },
  { value: 'EXPECTED', label: 'Expected' },
  { value: 'PLANNED', label: 'Planned' },
  { value: 'REQUESTED', label: 'Requested' }
];

const SUBSCRIPTION_EVENT_TYPES = [
  'LOGISTICS_OBJECT_CREATED',
  'LOGISTICS_OBJECT_UPDATED',
  'LOGISTICS_EVENT_RECEIVED'
];

// Add this function before the component
const formatEventToJsonLd = (eventData, logisticsObjectId) => {
  const selectedEventType = EVENT_TYPES.find(type => type.code === eventData.type);

  return {
    "@context": {
      "cargo": "https://onerecord.iata.org/ns/cargo#"
    },
    "@type": "cargo:LogisticsEvent",
    "cargo:creationDate": {
      "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
      "@value": new Date().toISOString()
    },
    "cargo:eventDate": {
      "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
      "@value": eventData.timestamp
    },
    "cargo:eventCode": {
      "@type": "cargo:CodeListElement",
      "cargo:code": eventData.type,
      "cargo:codeListName": selectedEventType?.name || ''
    },
    "cargo:eventName": eventData.description,
    "cargo:eventTimeType": {
      "@id": `cargo:${eventData.timeType}`,
      "@type": "cargo:EventTimeType"
    },
    "cargo:partialEventIndicator": eventData.partialEventIndicator

  };
};

const API_NS = 'https://onerecord.iata.org/ns/api#';

const getField = (obj, name) => {
  if (!obj) return undefined;

  const candidates = [name, `api:${name}`, `${API_NS}${name}`];
  for (const candidate of candidates) {
    if (obj[candidate] !== undefined) {
      return obj[candidate];
    }
  }
  return undefined;
};

const toFirst = (value) => (Array.isArray(value) ? value[0] : value);

const unwrapScalar = (value) => {
  const first = toFirst(value);
  if (first === undefined || first === null) return undefined;
  if (typeof first === 'object') {
    if (first['@value'] !== undefined) return first['@value'];
    if (first['@id'] !== undefined) return first['@id'];
  }
  return first;
};

const unwrapId = (value) => {
  const first = toFirst(value);
  if (first === undefined || first === null) return undefined;
  if (typeof first === 'string') return first;
  if (typeof first === 'object') {
    return first['@id'] || first.id || first['@value'];
  }
  return undefined;
};

const normalizeToArray = (value) => {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
};

const typeIncludes = (value, typeName) => {
  const types = normalizeToArray(value);
  return types.some((t) => typeof t === 'string' && t.includes(typeName));
};

const getStatusLabel = (status) => {
  const normalized = normalizeRequestStatus(status);
  return normalized || 'UNKNOWN';
};

const normalizeRequestStatus = (status) => {
  if (!status) return 'UNKNOWN';

  const raw = typeof status === 'string'
    ? status
    : status['@id'] || status['@value'] || '';
  const label = raw.includes('#')
    ? raw.split('#').pop()
    : raw.includes(':')
      ? raw.split(':').pop()
      : raw;

  const upper = String(label).toUpperCase();
  if (upper.startsWith('REQUEST_STATUS_')) {
    return `REQUEST_${upper.replace('REQUEST_STATUS_', '')}`;
  }
  if (upper === 'PENDING') return 'REQUEST_PENDING';
  if (upper === 'ACCEPTED') return 'REQUEST_ACCEPTED';
  if (upper === 'REJECTED') return 'REQUEST_REJECTED';
  if (upper === 'FAILED') return 'REQUEST_FAILED';
  if (upper === 'REVOKED') return 'REQUEST_REVOKED';
  return upper;
};

const toAuditTrailTimestamp = (localDateTime) => {
  if (!localDateTime) return '';
  const date = new Date(localDateTime);
  if (Number.isNaN(date.getTime())) return '';

  const iso = date.toISOString();
  const [datePart, timePartWithMs] = iso.split('T');
  const timePart = timePartWithMs.split('.')[0];
  return `${datePart.replace(/-/g, '')}T${timePart.replace(/:/g, '')}Z`;
};

const normalizeApiEnumValue = (value) => {
  const raw = unwrapScalar(value) || unwrapId(value) || value;
  if (!raw) return '';
  const normalized = String(raw);
  if (normalized.includes('#')) return normalized.split('#').pop();
  if (normalized.includes(':')) return normalized.split(':').pop();
  return normalized;
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const formatBooleanLabel = (value) => {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '-';
};

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

const readConfiguredExternalServers = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem('externalServers') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const createInitialSubscriptionForm = (servers = []) => ({
  subscriberServerBaseUrl: servers.length === 1 ? servers[0].baseUrl : '',
  description: '',
  expiresAt: '',
  notifyRequestStatusChange: true,
  sendLogisticsObjectBody: false,
  eventTypes: [...SUBSCRIPTION_EVENT_TYPES]
});

const buildSubscriptionPayload = ({
  topic,
  subscriber,
  eventTypes,
  sendLogisticsObjectBody,
  notifyRequestStatusChange,
  description,
  expiresAt
}) => {
  const payload = {
    '@context': {
      cargo: 'https://onerecord.iata.org/ns/cargo#',
      api: API_NS
    },
    '@type': 'api:Subscription',
    'api:hasContentType': 'application/ld+json',
    'api:hasSubscriber': {
      '@id': subscriber
    },
    'api:hasTopicType': {
      '@id': 'api:LOGISTICS_OBJECT_IDENTIFIER'
    },
    'api:includeSubscriptionEventType': eventTypes.map((eventType) => ({
      '@id': `api:${eventType}`
    })),
    'api:hasTopic': {
      '@type': 'http://www.w3.org/2001/XMLSchema#anyURI',
      '@value': topic
    },
    'api:sendLogisticsObjectBody': Boolean(sendLogisticsObjectBody),
    'api:notifyRequestStatusChange': Boolean(notifyRequestStatusChange)
  };

  if (description.trim()) {
    payload['api:hasDescription'] = description.trim();
  }

  if (expiresAt) {
    payload['api:expiresAt'] = {
      '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
      '@value': new Date(expiresAt).toISOString()
    };
  }

  return payload;
};

const LogisticsObjectView = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openEventDialog, setOpenEventDialog] = useState(false);
  const [sendingEvent, setSendingEvent] = useState(false);
  const [eventData, setEventData] = useState({
    type: '',
    name: '',
    description: '',
    location: '',
    timestamp: new Date().toISOString(),
    timeType: 'ACTUAL',
    partialEventIndicator: false
  });
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [subscribers, setSubscribers] = useState([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(true);
  const [subscribersError, setSubscribersError] = useState(null);
  const [openSubscriptionDialog, setOpenSubscriptionDialog] = useState(false);
  const [creatingSubscription, setCreatingSubscription] = useState(false);
  const [createSubscriptionError, setCreateSubscriptionError] = useState(null);
  const configuredExternalServers = readConfiguredExternalServers();
  const [subscriptionForm, setSubscriptionForm] = useState(() => createInitialSubscriptionForm(configuredExternalServers));
  const [auditTrail, setAuditTrail] = useState(null);
  const [loadingAuditTrail, setLoadingAuditTrail] = useState(false);
  const [auditFilters, setAuditFilters] = useState({
    updatedFrom: '',
    updatedTo: '',
    status: ''
  });
  const [appliedAuditFilters, setAppliedAuditFilters] = useState({
    updatedFrom: '',
    updatedTo: '',
    status: ''
  });
  const [processingActions, setProcessingActions] = useState({});

  // Get server info from location state, with refresh-safe fallback
  const serverUrl = location.state?.serverUrl || localStorage.getItem('baseUrl');
  const token = location.state?.token;

  const getRequestToken = useCallback(async (targetBaseUrl = serverUrl) => {
    const internalBaseUrl = localStorage.getItem('baseUrl');

    // Backward compatibility for navigation state that still passes a token.
    if (token) {
      return token;
    }

    if (!targetBaseUrl || targetBaseUrl === internalBaseUrl) {
      return requireAccessToken();
    }

    const externalServer = getExternalServerByBaseUrl(targetBaseUrl);
    return getExternalAccessToken(externalServer || targetBaseUrl);
  }, [serverUrl, token]);

  // Add this to determine if the object is external
  const isExternalObject = serverUrl !== localStorage.getItem('baseUrl');
  const logisticsObjectId = id.includes('logistics-objects/')
    ? id.split('logistics-objects/')[1]
    : id;
  const logisticsObjectIri = serverUrl && logisticsObjectId
    ? `${serverUrl}/logistics-objects/${logisticsObjectId}`
    : '';

  const fetchObjectData = useCallback(async () => {
    try {
      setLoading(true);
      
      if (!serverUrl) {
        throw new Error('Server configuration not found');
      }
      const requestToken = await getRequestToken();
      if (!requestToken) {
        throw createAuthRequiredError();
      }

      const response = await fetch(`${serverUrl}/logistics-objects/${id}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/ld+json',
          'Authorization': `Bearer ${requestToken}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server response:', errorText);
        throw new Error(`Failed to fetch logistics object: ${response.statusText}`);
      }

      const jsonData = await response.json();

      if (!jsonData) {
        throw new Error('No data received from server');
      }

      // Add safety checks for JSON-LD framing
      const framedResponse = await jsonld.frame(jsonData, {
        "@context": {
          "@vocab": "https://onerecord.iata.org/ns/cargo#"
        },
        "@embed": "@always"
      });
      

      let processedData;
      if (framedResponse['@graph'] && framedResponse['@graph'].length > 0) {
        // Extract the ID portion from the request URL
        const idPart = id.includes('logistics-objects/') 
          ? id.split('logistics-objects/')[1]
          : id;

        // Find the main object with the matching ID
        processedData = framedResponse['@graph'].find(obj => 
          obj['@id'].includes(`/logistics-objects/${idPart}`)
        );

        if (!processedData) {
          throw new Error(`Logistics object with ID ${idPart} not found in framed data`);
        }
      } else if (framedResponse['@id']) {
        processedData = framedResponse;
      } else {
        throw new Error('Invalid data structure received');
      }

      
      if (!processedData) {
        throw new Error('Failed to process logistics object data');
      }

      setData(processedData);
      setError(null);
    } catch (err) {
      console.error('Error in fetchObjectData:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getRequestToken, id, serverUrl]);

  const fetchEvents = useCallback(async () => {
    try {
      setLoadingEvents(true);
      const requestToken = await getRequestToken();
      if (!requestToken) {
        throw createAuthRequiredError();
      }
      const response = await fetch(`${serverUrl}/logistics-objects/${id}/logistics-events`, {
        headers: {
          'Accept': 'application/ld+json',
          'Authorization': `Bearer ${requestToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }

      const jsonData = await response.json();

      // Frame the JSON-LD response
      const framedResponse = await jsonld.frame(jsonData, {
        "@context": {
          "@vocab": "https://onerecord.iata.org/ns/cargo#"
        },
        "@embed": "@always"
      });
      
      if (framedResponse['@graph']) {
        // Find the Collection object
        const collection = framedResponse['@graph'].find(item => 
          item['@type'] === 'https://onerecord.iata.org/ns/api#Collection'
        );

        if (collection) {
          // Process each event
          const hasItems = collection['https://onerecord.iata.org/ns/api#hasItem'];
          const eventRefs = Array.isArray(hasItems) ? hasItems : [hasItems];
          
          const processedEvents = eventRefs
            .filter(Boolean)
            .map(eventRef => {
              const eventId = eventRef['@id'];
              const eventData = framedResponse['@graph'].find(item => item['@id'] === eventId);
              const eventCode = framedResponse['@graph'].find(item => 
                item['@id'] === eventData?.eventCode?.['@id']
              );

              if (!eventData) return null;

              return {
                id: eventId.split('/').pop(),
                creationDate: eventData.creationDate?.['@value'],
                eventDate: eventData.eventDate?.['@value'],
                eventName: eventData.eventName,
                eventCode: eventCode?.code || '',
                codeListName: eventCode?.codeListName || '',
                timeType: eventData.eventTimeType?.['@id']?.split('#')?.pop() || '',
                partialEventIndicator: eventData.partialEventIndicator?.['@value'] === 'true'
              };
            })
            .filter(Boolean); // Remove any null events

          setEvents(processedEvents);
        }
      }
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoadingEvents(false);
    }
  }, [getRequestToken, id, serverUrl]);

  const fetchSubscribers = useCallback(async () => {
    if (!serverUrl || !logisticsObjectIri) {
      setSubscribers([]);
      setLoadingSubscribers(false);
      setSubscribersError(null);
      return;
    }

    try {
      setLoadingSubscribers(true);
      setSubscribersError(null);
      const requestToken = await getRequestToken();
      if (!requestToken) {
        throw createAuthRequiredError();
      }
      const pageSize = 200;
      let offset = 0;
      let hasMore = true;
      const collectedItems = [];

      while (hasMore) {
        const query = new URLSearchParams({
          status: 'ACTIVE',
          limit: String(pageSize),
          offset: String(offset)
        });

        const response = await fetch(`${serverUrl}/logistics-objects/internal/_subscriptions?${query.toString()}`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${requestToken}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch subscribers: ${response.statusText}`);
        }

        const payload = await response.json();
        const items = Array.isArray(payload?.items) ? payload.items : [];
        collectedItems.push(...items);
        hasMore = items.length === pageSize;
        offset += pageSize;
      }

      const seenKeys = new Set();
      const filteredSubscribers = collectedItems
        .filter((item) => normalizeApiEnumValue(item.topicType) === 'LOGISTICS_OBJECT_IDENTIFIER')
        .filter((item) => item.topic === logisticsObjectIri)
        .map((item) => {
          const eventTypes = normalizeToArray(item.includeSubscriptionEventTypes || item.eventTypes)
            .map((entry) => normalizeApiEnumValue(entry))
            .filter(Boolean);

          return {
            key: item.iri || `${item.subscriberIri || item.subscriber}-${item.callbackUrl || item.topic}`,
            subscriberIri: item.subscriberIri || item.subscriber || '-',
            callbackUrl: item.callbackUrl || '',
            status: item.status || '-',
            topic: item.topic || '-',
            topicType: normalizeApiEnumValue(item.topicType) || '-',
            createdAt: item.createdAt || '',
            expiresAt: item.expiresAt || '',
            contentTypes: normalizeToArray(item.contentTypes || item.hasContentType || item.contentType).filter(Boolean),
            includeSubscriptionEventTypes: eventTypes,
            sendLogisticsObjectBody: item.sendLogisticsObjectBody,
            notifyRequestStatusChange: item.notifyRequestStatusChange
          };
        })
        .filter((item) => {
          if (seenKeys.has(item.key)) return false;
          seenKeys.add(item.key);
          return true;
        })
        .sort((left, right) => {
          const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
          const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
          return rightTime - leftTime;
        });

      setSubscribers(filteredSubscribers);
    } catch (err) {
      console.error('Error fetching subscribers:', err);
      setSubscribers([]);
      setSubscribersError(err.message || 'Failed to load subscribers');
    } finally {
      setLoadingSubscribers(false);
    }
  }, [getRequestToken, logisticsObjectIri, serverUrl]);

  const handleOpenSubscriptionDialog = () => {
    setSubscriptionForm(createInitialSubscriptionForm(configuredExternalServers));
    setCreateSubscriptionError(null);
    setOpenSubscriptionDialog(true);
  };

  const handleCloseSubscriptionDialog = () => {
    if (creatingSubscription) {
      return;
    }
    setOpenSubscriptionDialog(false);
    setCreateSubscriptionError(null);
  };

  const toggleSubscriptionEventType = (eventType) => {
    setSubscriptionForm((current) => {
      const eventTypes = current.eventTypes.includes(eventType)
        ? current.eventTypes.filter((entry) => entry !== eventType)
        : [...current.eventTypes, eventType];

      return {
        ...current,
        eventTypes
      };
    });
  };

  const handleCreateSubscription = async () => {
    try {
      setCreatingSubscription(true);
      setCreateSubscriptionError(null);

      if (!subscriptionForm.subscriberServerBaseUrl) {
        throw new Error('Select the subscriber server');
      }

      if (subscriptionForm.eventTypes.length === 0) {
        throw new Error('Select at least one subscription event type');
      }

      const subscriberServer = getExternalServerByBaseUrl(subscriptionForm.subscriberServerBaseUrl);
      if (!subscriberServer) {
        throw new Error('Subscriber server configuration not found');
      }

      const subscriberToken = await getExternalAccessToken(subscriberServer);
      const subscriberTokenPayload = decodeJwtPayload(subscriberToken);
      const subscriberUri =
        subscriberTokenPayload?.logistics_agent_uri ||
        `${subscriberServer.baseUrl}/logistics-objects/_data-holder`;

      const payload = buildSubscriptionPayload({
        topic: logisticsObjectIri,
        subscriber: subscriberUri,
        eventTypes: subscriptionForm.eventTypes,
        sendLogisticsObjectBody: subscriptionForm.sendLogisticsObjectBody,
        notifyRequestStatusChange: subscriptionForm.notifyRequestStatusChange,
        description: subscriptionForm.description,
        expiresAt: subscriptionForm.expiresAt
      });

      const requestToken = await getRequestToken();
      if (!requestToken) {
        throw createAuthRequiredError();
      }
      const response = await fetch(`${serverUrl}/subscriptions`, {
        method: 'POST',
        headers: {
          Accept: 'application/ld+json; version=2.2.0',
          'Content-Type': 'application/ld+json; version=2.2.0',
          Authorization: `Bearer ${requestToken}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Failed to create subscription: ${response.statusText}`);
      }

      setOpenSubscriptionDialog(false);
      setSubscriptionForm(createInitialSubscriptionForm(configuredExternalServers));
      await fetchSubscribers();
    } catch (err) {
      console.error('Error creating subscription:', err);
      setCreateSubscriptionError(err.message || 'Failed to create subscription');
    } finally {
      setCreatingSubscription(false);
    }
  };

  const fetchAuditTrail = useCallback(async () => {
    try {
      setLoadingAuditTrail(true);
      const requestToken = await getRequestToken();
      if (!requestToken) {
        throw createAuthRequiredError();
      }
      const query = new URLSearchParams();
      const updatedFrom = toAuditTrailTimestamp(appliedAuditFilters.updatedFrom);
      const updatedTo = toAuditTrailTimestamp(appliedAuditFilters.updatedTo);

      if (updatedFrom) query.set('updated-from', updatedFrom);
      if (updatedTo) query.set('updated-to', updatedTo);
      if (appliedAuditFilters.status) query.set('status', appliedAuditFilters.status);

      const auditTrailUrl = `${serverUrl}/logistics-objects/${id}/audit-trail${query.toString() ? `?${query.toString()}` : ''}`;
      const response = await fetch(auditTrailUrl, {
        headers: {
          'Accept': 'application/ld+json',
          'Authorization': `Bearer ${requestToken}`
        }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch audit trail: ${response.statusText}`);
      }
      const data = await response.json();

      const latestRevision = String(
        unwrapScalar(getField(data, 'hasLatestRevision')) || '1'
      );

      const actionRequestRefs = [
        ...normalizeToArray(getField(data, 'hasActionRequest')),
        ...normalizeToArray(getField(data, 'hasChangeRequest'))
      ]
        .map((item) => unwrapId(item))
        .filter(Boolean);

      const uniqueRefs = [...new Set(actionRequestRefs)];

      const detailedResponses = await Promise.all(
        uniqueRefs.map(async (url) => {
          try {
            const actionRequestUrl = url.startsWith('http') ? url : `${serverUrl}${url.startsWith('/') ? '' : '/'}${url}`;
            const actionResponse = await fetch(actionRequestUrl, {
              headers: {
                'Accept': 'application/ld+json',
                'Authorization': `Bearer ${requestToken}`
              }
            });

            if (!actionResponse.ok) {
              return null;
            }

            return actionResponse.json();
          } catch {
            return null;
          }
        })
      );

      const resolvedItems = detailedResponses
        .filter(Boolean)
        .flatMap((item) => (Array.isArray(item?.['@graph']) ? item['@graph'] : [item]));

      setAuditTrail({
        raw: data,
        items: resolvedItems,
        latestRevision
      });
    } catch (error) {
      console.error('Error fetching audit trail:', error);
      setError(error.message || 'Failed to fetch audit trail');
    } finally {
      setLoadingAuditTrail(false);
    }
  }, [appliedAuditFilters.status, appliedAuditFilters.updatedFrom, appliedAuditFilters.updatedTo, getRequestToken, id, serverUrl]);

  useEffect(() => {
    if (!serverUrl) {
      setError('Server configuration not found');
      setLoading(false);
      return;
    }
    fetchObjectData();
    fetchEvents();
    fetchSubscribers();
  }, [fetchEvents, fetchObjectData, fetchSubscribers, serverUrl]);

  useEffect(() => {
    if (!serverUrl) {
      return;
    }
    fetchAuditTrail();
  }, [fetchAuditTrail, serverUrl]);

  const handleBack = () => {
    navigate('/');
  };

  // Refresh object details and related sections in place
  const handleRefresh = async () => {
    await Promise.all([fetchObjectData(), fetchEvents(), fetchSubscribers(), fetchAuditTrail()]);
  };

  const getActionRequestEndpoint = (requestUrl) => {
    if (!requestUrl || !requestUrl.includes('/action-requests/')) {
      return null;
    }

    if (requestUrl.startsWith('http')) {
      return requestUrl;
    }

    const requestId = requestUrl.split('/action-requests/')[1];
    if (!requestId) return null;
    return `${serverUrl}/action-requests/${requestId}`;
  };

  const updateRequestStatus = async (requestUrl, nextStatus) => {
    const endpoint = getActionRequestEndpoint(requestUrl);
    if (!endpoint) return;

    try {
      setProcessingActions((prev) => ({ ...prev, [requestUrl]: true }));
      const requestToken = await getRequestToken();
      if (!requestToken) {
        throw createAuthRequiredError();
      }
      const response = await fetch(`${endpoint}?status=${encodeURIComponent(nextStatus)}`, {
        method: 'PATCH',
        headers: {
          'Accept': 'application/ld+json',
          'Authorization': `Bearer ${requestToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to update request status: ${response.statusText}`);
      }

      await fetchAuditTrail();
      await fetchObjectData();
    } catch (err) {
      setError(err.message || 'Failed to update request status');
    } finally {
      setProcessingActions((prev) => ({ ...prev, [requestUrl]: false }));
    }
  };

  const revokeRequest = async (requestUrl) => {
    const endpoint = getActionRequestEndpoint(requestUrl);
    if (!endpoint) return;

    try {
      setProcessingActions((prev) => ({ ...prev, [requestUrl]: true }));
      const requestToken = await getRequestToken();
      if (!requestToken) {
        throw createAuthRequiredError();
      }
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/ld+json',
          'Authorization': `Bearer ${requestToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to revoke request: ${response.statusText}`);
      }

      await fetchAuditTrail();
      await fetchObjectData();
    } catch (err) {
      setError(err.message || 'Failed to revoke request');
    } finally {
      setProcessingActions((prev) => ({ ...prev, [requestUrl]: false }));
    }
  };

  const handleSendEvent = async () => {
    try {
      setSendingEvent(true);
      const requestToken = await getRequestToken();
      if (!requestToken) {
        throw createAuthRequiredError();
      }
      const eventJsonLd = formatEventToJsonLd(eventData, id);
      
      const response = await fetch(`${serverUrl}/logistics-objects/${id}/logistics-events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/ld+json',
          'Authorization': `Bearer ${requestToken}`
        },
        body: JSON.stringify(eventJsonLd)
      });

      if (!response.ok) {
        throw new Error('Failed to send event');
      }
      
      await fetchObjectData();
      await fetchEvents();
      setOpenEventDialog(false);
      setEventData({
        type: '',
        name: '',
        description: '',
        location: '',
        timestamp: new Date().toISOString(),
        timeType: 'ACTUAL',
        partialEventIndicator: false
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingEvent(false);
    }
  };

  const formatValue = (value, schema = null) => {
    if (value === null || value === undefined) {
      return <Typography color="text.secondary">-</Typography>;
    }

    // Handle primitive values with @value wrapper
    if (typeof value === 'object' && value['@value'] !== undefined) {
      return <Typography>{value['@value']}</Typography>;
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return (
        <Stack spacing={1}>
          {value.map((item, index) => (
            <Box key={index}>{formatValue(item)}</Box>
          ))}
        </Stack>
      );
    }

    // Handle objects
    if (typeof value === 'object') {
      // Handle reference objects (with only @id)
      if (Object.keys(value).length === 1 && value['@id']) {
        if (isLogisticsObjectLink(value['@id'])) {
          const externalServerUrl = new URL(value['@id']).origin;
          return (
            <Button
            onClick={() => {
              navigate(`/logistics-objects/${value['@id'].split('/').pop()}`, {
                replace: false,
                state: { 
                  serverUrl: externalServerUrl || serverUrl
                }
              });
              window.location.reload();
            }}
            startIcon={<LocalShippingIcon />}
            sx={{ textTransform: 'none' }}
          >
            View Logistics Object
          </Button>
          )
        }
        if (isExternalLink(value['@id'])) {
          return (
            <Link 
              component={RouterLink} 
              to={value['@id'].replace(serverUrl, '')}
              color="primary"
            >
              {value['@id'].split('/').pop()}
            </Link>
          );
        }
        return <Typography>{value['@id']}</Typography>;
      }

      // Handle complex objects (rest of the code remains the same)
      return (
        <Box sx={{ pl: 2, borderLeft: '2px solid #e0e0e0' }}>
          {Object.entries(value)
            .filter(([key]) => !key.startsWith('@'))
            .map(([key, val]) => (
              <Box key={key} sx={{ mb: 1 }}>
                <Typography 
                  variant="caption" 
                  color="text.secondary"
                  sx={{ display: 'block', mb: 0.5 }}
                >
                  {key.split('#').pop()?.replace(/([A-Z])/g, ' $1').trim() || key}:
                </Typography>
                {formatValue(val)}
              </Box>
            ))}
        </Box>
      );
    }

    // Handle boolean values
    if (typeof value === 'boolean') {
      return <Typography>{value ? 'Yes' : 'No'}</Typography>;
    }

    // Handle dates
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
      return <Typography>{new Date(value).toLocaleString()}</Typography>;
    }

    // Handle simple values (strings, numbers)
    return <Typography>{String(value)}</Typography>;
  };

  // Helper functions to handle logistics object links
  const isLogisticsObjectLink = (url) => {
    try {
      return url.includes('/logistics-objects/');
    } catch {
      return false;
    }
  };

  const isExternalLink = (url) => {
    try {
      return url.startsWith('http://') || url.startsWith('https://');
    } catch {
      return false;
    }
  };

  // Update the getEventColor function to match the actual event codes
  const getEventColor = (eventCode) => {
    const colorMap = {
      'FMA': 'info',     // Freight Management Acceptance
      'RCS': 'success',  // Ready for Carriage Status
      'DEP': 'primary',  // Flight Departure
      'ARR': 'primary',  // Arrived Flight
      'TFD': 'warning',  // Transferred
      'NFD': 'info',     // Notification of Delivery
      'AWD': 'warning',  // Arrived and Waiting Delivery
      'DLV': 'success',  // Delivered
      'FOH': 'info',     // Freight On-Hand
      'RCT': 'warning',  // Ready for Collection Time
      'RCF': 'primary'   // Received from Flight
    };
    return colorMap[eventCode] || 'grey';
  };

  const getStatusColor = (status) => {
    const statusLabel = getStatusLabel(status);
    const colors = {
      'REQUEST_ACCEPTED': 'success',
      'REQUEST_REJECTED': 'error',
      'REQUEST_FAILED': 'error',
      'REQUEST_PENDING': 'warning',
      'REQUEST_REVOKED': 'info'
    };
    return colors[statusLabel] || 'info';
  };

  const renderAuditTrail = () => {
    if (!auditTrail) return null;

    const items = Array.isArray(auditTrail.items)
      ? auditTrail.items
      : Array.isArray(auditTrail['@graph'])
        ? auditTrail['@graph']
        : Array.isArray(auditTrail)
          ? auditTrail
          : (auditTrail['@id'] ? [auditTrail] : []);
    const latestRevision = auditTrail.latestRevision || String(unwrapScalar(getField(auditTrail, 'hasLatestRevision')) || '1');

    const changeRequests = items
      .filter(item => {
        const type = item['@type'];
        return typeIncludes(type, 'ChangeRequest');
      })
      .sort((a, b) => {
        const timeA = new Date(unwrapScalar(getField(a, 'isRequestedAt')) || a.requestedAt || 0).getTime();
        const timeB = new Date(unwrapScalar(getField(b, 'isRequestedAt')) || b.requestedAt || 0).getTime();
        return timeB - timeA;
      });

    const fromDate = appliedAuditFilters.updatedFrom ? new Date(appliedAuditFilters.updatedFrom) : null;
    const toDate = appliedAuditFilters.updatedTo ? new Date(appliedAuditFilters.updatedTo) : null;
    const statusFilter = appliedAuditFilters.status
      ? normalizeRequestStatus(appliedAuditFilters.status)
      : '';

    const filteredChangeRequests = changeRequests.filter((request) => {
      const rawStatus = unwrapId(getField(request, 'hasRequestStatus')) || request.status || 'REQUEST_PENDING';
      const normalizedStatus = normalizeRequestStatus(rawStatus);
      const timestamp = unwrapScalar(getField(request, 'isRequestedAt')) || request.requestedAt || request.createdAt;
      const requestDate = timestamp ? new Date(timestamp) : null;

      if (statusFilter && normalizedStatus !== statusFilter) {
        return false;
      }

      if (fromDate && requestDate && requestDate < fromDate) {
        return false;
      }

      if (toDate && requestDate && requestDate > toDate) {
        return false;
      }

      return true;
    });

    const changes = items.filter(item => {
      const type = item['@type'];
      return typeIncludes(type, 'Change') && !typeIncludes(type, 'ChangeRequest');
    });

    return (
      <Accordion sx={{ mt: 2 }}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="audit-trail-content"
          id="audit-trail-header"
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EventIcon sx={{ color: '#1976d2' }} />
            <Typography sx={{ color: '#1976d2' }}>
              Audit Trail {filteredChangeRequests.length > 0 && `(${filteredChangeRequests.length})`}
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
            <TextField
              label="Updated From"
              type="datetime-local"
              size="small"
              value={auditFilters.updatedFrom}
              onChange={(e) => setAuditFilters((prev) => ({ ...prev, updatedFrom: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Updated To"
              type="datetime-local"
              size="small"
              value={auditFilters.updatedTo}
              onChange={(e) => setAuditFilters((prev) => ({ ...prev, updatedTo: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              select
              label="Status"
              size="small"
              sx={{ minWidth: 170 }}
              value={auditFilters.status}
              onChange={(e) => setAuditFilters((prev) => ({ ...prev, status: e.target.value }))}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="PENDING">Pending</MenuItem>
              <MenuItem value="ACCEPTED">Accepted</MenuItem>
              <MenuItem value="REJECTED">Rejected</MenuItem>
            </TextField>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setAppliedAuditFilters(auditFilters)}
              disabled={loadingAuditTrail}
            >
              Apply Filters
            </Button>
            <Button
              variant="text"
              size="small"
              onClick={() => {
                const reset = { updatedFrom: '', updatedTo: '', status: '' };
                setAuditFilters(reset);
                setAppliedAuditFilters(reset);
              }}
              disabled={loadingAuditTrail}
            >
              Reset
            </Button>
          </Box>
          {loadingAuditTrail ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : filteredChangeRequests.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography color="textSecondary">
                No change requests match the selected filters.
                Latest revision: {latestRevision}
              </Typography>
            </Box>
          ) : (
            <Timeline>
              {filteredChangeRequests.map((request) => {
                const changeId = unwrapId(getField(request, 'hasChange')) || request.changeId;
                const change = changes.find(c => c['@id'] === changeId);
                const requestUrl = request['@id'];

                const timestamp = unwrapScalar(getField(request, 'isRequestedAt')) || request.requestedAt || request.createdAt || Date.now();
                const statusId = normalizeRequestStatus(unwrapId(getField(request, 'hasRequestStatus')) || request.status || 'REQUEST_PENDING');
                const description = unwrapScalar(getField(change, 'hasDescription')) || change?.description || 'Change Request';
                const revision = String(unwrapScalar(getField(change, 'hasRevision')) || change?.revision || '1');
                const isPending = statusId === 'REQUEST_PENDING';
                const isProcessing = Boolean(processingActions[requestUrl]);
                
                return (
                  <TimelineItem key={request['@id']}>
                    <TimelineOppositeContent color="textSecondary">
                      {new Date(timestamp).toLocaleString()}
                    </TimelineOppositeContent>
                    <TimelineSeparator>
                      <TimelineDot color={getStatusColor(statusId)} />
                      <TimelineConnector />
                    </TimelineSeparator>
                    <TimelineContent>
                      <Paper elevation={3} sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Typography variant="h6" component="span">
                            {description}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="body2" color="textSecondary">
                            Revision: {revision}
                          </Typography>
                          <Chip 
                            label={getStatusLabel(statusId)}
                            color={getStatusColor(statusId)}
                            size="small"
                          />
                        </Box>
                        {renderChangeRequestLink(request['@id'])}
                        {isPending && (
                          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              disabled={isProcessing}
                              onClick={() => updateRequestStatus(requestUrl, 'REQUEST_ACCEPTED')}
                            >
                              Accept
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              color="error"
                              disabled={isProcessing}
                              onClick={() => updateRequestStatus(requestUrl, 'REQUEST_REJECTED')}
                            >
                              Reject
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={isProcessing}
                              onClick={() => revokeRequest(requestUrl)}
                            >
                              Revoke
                            </Button>
                          </Box>
                        )}
                      </Paper>
                    </TimelineContent>
                  </TimelineItem>
                );
              })}
            </Timeline>
          )}
        </AccordionDetails>
      </Accordion>
    );
  };

  const renderLogisticsEvents = () => {
    // Show loading state
    if (loadingEvents) {
      return (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        </Paper>
      );
    }

    // Always render the section, even with no events
    return (
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EventIcon color="primary" />
            Logistics Events {events.length > 0 && `(${events.length})`}
          </Typography>
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={() => setOpenEventDialog(true)}
            size="small"
          >
            Send Event
          </Button>
        </Box>

        {!events || events.length === 0 ? (
          <Box sx={{ 
            p: 3, 
            textAlign: 'center',
            bgcolor: 'background.paper',
            borderRadius: 1,
            border: '1px solid #e0e0e0'
          }}>
            <EventIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
            <Typography color="textSecondary">
              No logistics events have been recorded for this object yet.
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Click "Send Event" to record a new logistics event.
            </Typography>
          </Box>
        ) : (
          <Timeline>
            {events.map((event) => (
              <TimelineItem key={event.id}>
                <TimelineOppositeContent color="textSecondary">
                  <Typography variant="body2">
                    {new Date(event.eventDate).toLocaleString()}
                  </Typography>
                  <Typography variant="caption">
                    {event.timeType}
                  </Typography>
                </TimelineOppositeContent>
                <TimelineSeparator>
                  <TimelineDot color={getEventColor(event.eventCode)}>
                    <EventIcon />
                  </TimelineDot>
                  <TimelineConnector />
                </TimelineSeparator>
                <TimelineContent>
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="subtitle1" component="span">
                      {event.eventCode} - {event.codeListName}
                    </Typography>
                    {event.partialEventIndicator && (
                      <Chip 
                        label="Partial" 
                        size="small" 
                        color="warning" 
                        sx={{ ml: 1 }} 
                      />
                    )}
                  </Box>
                  <Typography>{event.eventName}</Typography>
                  <Typography variant="caption" color="textSecondary">
                    Created: {new Date(event.creationDate).toLocaleString()}
                  </Typography>
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        )}
      </Paper>
    );
  };

  const renderSubscribers = () => {
    const selectedSubscriberServer = configuredExternalServers.find(
      (server) => server.baseUrl === subscriptionForm.subscriberServerBaseUrl
    );
    const subscriberPreviewUri = selectedSubscriberServer
      ? `${selectedSubscriberServer.baseUrl}/logistics-objects/_data-holder`
      : '';

    if (loadingSubscribers) {
      return (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        </Paper>
      );
    }

    return (
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <GroupIcon color="primary" />
              Subscribers {subscribers.length > 0 && `(${subscribers.length})`}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Active subscription records for this Logistics Object where topic type is
              {' '}<strong>LOGISTICS_OBJECT_IDENTIFIER</strong>.
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            startIcon={<SendIcon />}
            onClick={handleOpenSubscriptionDialog}
            disabled={configuredExternalServers.length === 0}
          >
            Add Subscription
          </Button>
        </Box>

        {subscribersError && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {subscribersError}
          </Alert>
        )}

        {configuredExternalServers.length === 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Configure at least one external server in Settings to create a subscription for this Logistics Object.
          </Alert>
        )}

        {subscribers.length === 0 ? (
          <Box
            sx={{
              p: 3,
              textAlign: 'center',
              bgcolor: 'background.paper',
              borderRadius: 1,
              border: '1px solid #e0e0e0'
            }}
          >
            <GroupIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
            <Typography color="textSecondary">
              No active subscribers are registered for this Logistics Object.
            </Typography>
            <Typography variant="caption" color="textSecondary">
              ONE Record specific-object subscriptions use this object IRI as the topic.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            {subscribers.map((subscriber) => {
              const receivesEvents = subscriber.includeSubscriptionEventTypes.includes('LOGISTICS_EVENT_RECEIVED');

              return (
                <Paper
                  key={subscriber.key}
                  variant="outlined"
                  sx={{ p: 2.5, backgroundColor: '#f8f9fa' }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 1.5 }}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, wordBreak: 'break-all' }}>
                        {subscriber.subscriberIri}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Created: {formatDateTime(subscriber.createdAt)}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      <Chip label={subscriber.status} size="small" color="primary" variant="outlined" />
                      <Chip label={subscriber.topicType} size="small" variant="outlined" />
                      {receivesEvents && (
                        <Chip
                          icon={<NotificationsActiveIcon />}
                          label="Receives logistics events"
                          size="small"
                          color="success"
                        />
                      )}
                    </Stack>
                  </Box>

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="caption" color="text.secondary">Callback URL</Typography>
                      {subscriber.callbackUrl ? (
                        <Link href={subscriber.callbackUrl} target="_blank" rel="noreferrer" sx={{ display: 'block', wordBreak: 'break-all' }}>
                          {subscriber.callbackUrl}
                        </Link>
                      ) : (
                        <Typography variant="body2">-</Typography>
                      )}
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="caption" color="text.secondary">Topic</Typography>
                      <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                        {subscriber.topic}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="caption" color="text.secondary">Content Type</Typography>
                      <Typography variant="body2">
                        {subscriber.contentTypes.length > 0 ? subscriber.contentTypes.join(', ') : '-'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="caption" color="text.secondary">Expires At</Typography>
                      <Typography variant="body2">{formatDateTime(subscriber.expiresAt)}</Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="caption" color="text.secondary">Send Logistics Object Body</Typography>
                      <Typography variant="body2">{formatBooleanLabel(subscriber.sendLogisticsObjectBody)}</Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="caption" color="text.secondary">Notify Request Status Change</Typography>
                      <Typography variant="body2">{formatBooleanLabel(subscriber.notifyRequestStatusChange)}</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">Included Subscription Event Types</Typography>
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
                        {subscriber.includeSubscriptionEventTypes.length === 0 ? (
                          <Typography variant="body2">-</Typography>
                        ) : (
                          subscriber.includeSubscriptionEventTypes.map((eventType) => (
                            <Chip
                              key={`${subscriber.key}-${eventType}`}
                              label={eventType}
                              size="small"
                              variant={eventType === 'LOGISTICS_EVENT_RECEIVED' ? 'filled' : 'outlined'}
                              color={eventType === 'LOGISTICS_EVENT_RECEIVED' ? 'success' : 'default'}
                            />
                          ))
                        )}
                      </Stack>
                    </Grid>
                  </Grid>
                </Paper>
              );
            })}
          </Stack>
        )}

        <Dialog
          open={openSubscriptionDialog}
          onClose={handleCloseSubscriptionDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Add Subscription for Logistics Object</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              {createSubscriptionError && (
                <Alert severity="error">
                  {createSubscriptionError}
                </Alert>
              )}

              <TextField
                select
                label="Subscriber Server"
                value={subscriptionForm.subscriberServerBaseUrl}
                onChange={(event) => setSubscriptionForm((current) => ({
                  ...current,
                  subscriberServerBaseUrl: event.target.value
                }))}
                helperText="The selected server identifies the subscriber organization."
                fullWidth
                required
              >
                {configuredExternalServers.map((server) => (
                  <MenuItem key={server.baseUrl} value={server.baseUrl}>
                    {server.name || server.baseUrl}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Topic"
                value={logisticsObjectIri}
                fullWidth
                InputProps={{ readOnly: true }}
                helperText="Fixed to the current Logistics Object IRI"
              />

              <TextField
                label="Topic Type"
                value="LOGISTICS_OBJECT_IDENTIFIER"
                fullWidth
                InputProps={{ readOnly: true }}
              />

              <TextField
                label="Subscriber IRI Preview"
                value={subscriberPreviewUri}
                fullWidth
                InputProps={{ readOnly: true }}
                helperText="If the subscriber token exposes logistics_agent_uri, that value is used instead."
              />

              <TextField
                label="Description"
                value={subscriptionForm.description}
                onChange={(event) => setSubscriptionForm((current) => ({
                  ...current,
                  description: event.target.value
                }))}
                fullWidth
                multiline
                rows={2}
                helperText="Optional subscription description"
              />

              <TextField
                label="Expires At"
                type="datetime-local"
                value={subscriptionForm.expiresAt}
                onChange={(event) => setSubscriptionForm((current) => ({
                  ...current,
                  expiresAt: event.target.value
                }))}
                fullWidth
                InputLabelProps={{
                  shrink: true
                }}
                helperText="Optional expiration date and time"
              />

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Included Subscription Event Types
                </Typography>
                <Stack>
                  {SUBSCRIPTION_EVENT_TYPES.map((eventType) => (
                    <FormControlLabel
                      key={eventType}
                      control={(
                        <Checkbox
                          checked={subscriptionForm.eventTypes.includes(eventType)}
                          onChange={() => toggleSubscriptionEventType(eventType)}
                        />
                      )}
                      label={eventType}
                    />
                  ))}
                </Stack>
              </Box>

              <FormControlLabel
                control={(
                  <Switch
                    checked={subscriptionForm.notifyRequestStatusChange}
                    onChange={(event) => setSubscriptionForm((current) => ({
                      ...current,
                      notifyRequestStatusChange: event.target.checked
                    }))}
                  />
                )}
                label="Notify Request Status Change"
              />

              <FormControlLabel
                control={(
                  <Switch
                    checked={subscriptionForm.sendLogisticsObjectBody}
                    onChange={(event) => setSubscriptionForm((current) => ({
                      ...current,
                      sendLogisticsObjectBody: event.target.checked
                    }))}
                  />
                )}
                label="Send Logistics Object Body"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseSubscriptionDialog} disabled={creatingSubscription}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleCreateSubscription}
              disabled={creatingSubscription || configuredExternalServers.length === 0}
              startIcon={creatingSubscription ? <CircularProgress size={18} /> : <SendIcon />}
            >
              {creatingSubscription ? 'Creating...' : 'Create Subscription'}
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    );
  };

  const getServerDetailsForUrl = (url) => {
    if (!url) return null;
    
    // Get all configured servers
    const externalServers = JSON.parse(localStorage.getItem('externalServers') || '[]');
    const currentServer = {
      baseUrl: localStorage.getItem('baseUrl')
    };
    
    // Check if URL matches any configured server
    const urlOrigin = new URL(url).origin;
    
    if (urlOrigin === currentServer.baseUrl) {
      return currentServer;
    }
    
    const matchingServer = externalServers.find(server => url.startsWith(server.baseUrl));
    return matchingServer || null;
  };

  const renderChangeRequestLink = (url) => {
    const serverDetails = getServerDetailsForUrl(url);
    const changeRequestId = url.split('/action-requests/')[1];
    
    return (
      <Button
        component={RouterLink}
        to={`/changes-request/${changeRequestId}`}
        state={serverDetails ? {
          serverUrl: serverDetails.baseUrl
        } : undefined}
        startIcon={<DescriptionIcon />}
        sx={{ textTransform: 'none' }}
      >
        View Change Request
      </Button>
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
        <Alert 
          severity="error" 
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={handleRefresh}
            >
              Retry
            </Button>
          }
          sx={{ mb: 3 }}
        >
          {error}
        </Alert>
      </Box>
    );
  }

  if (!data || typeof data !== 'object') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          No valid data available for this logistics object
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, margin: '0 auto', p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          mb: 2 
        }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
          >
            Back to Database
          </Button>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
              disabled={loading || loadingEvents || loadingAuditTrail}
            >
              Refresh
            </Button>
            {isExternalObject && (
              <Chip
                label="External Object"
                color="warning"
                icon={<InfoIcon />}
                sx={{ ml: 1 }}
                title={`Server: ${serverUrl}`}
              />
            )}
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <LocalShippingIcon 
            sx={{ 
              fontSize: 40, 
              color: isExternalObject ? 'warning.main' : 'primary.main' 
            }} 
          />
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
              Logistics Object Details
            </Typography>
            {isExternalObject && (
              <Typography variant="caption" color="text.secondary">
                From external server: {serverUrl}
              </Typography>
            )}
          </Box>
        </Box>
        <Divider />
      </Box>


      {/* Dynamic Content View - Updated */}
	      <Paper sx={{ p: 3, mb: 3 }}>
	        <Box
	          sx={{
	            mb: 3,
	            p: 2,
	            backgroundColor: '#f8f9fa',
	            borderRadius: 2,
	            border: '1px solid #e0e0e0'
	          }}
	        >
	          <Typography variant="overline" color="text.secondary">
	            LO GUID
	          </Typography>
	          <Typography variant="h6" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
	            {logisticsObjectId}
	          </Typography>
	        </Box>

	        <Typography variant="h6" sx={{ 
	          mb: 3, 
	          display: 'flex', 
	          alignItems: 'center', 
          gap: 1,
          color: '#1976d2'
        }}>
          <DescriptionIcon />
          Object Properties
        </Typography>
        <Grid container spacing={3}>
          {Object.entries(data || {})
            .filter(([key]) => !key.startsWith('@'))
            .map(([key, value]) => {
              if (value === undefined || value === null) return null;
              
              return (
                <Grid item xs={12} md={6} key={key}>
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      p: 2.5, 
                      backgroundColor: '#f8f9fa',
                      borderRadius: 2,
                      height: '100%',
                      border: '1px solid #e0e0e0',
                      '&:hover': {
                        backgroundColor: '#f5f5f5',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                      }
                    }}
                  >
                    <Typography 
                      variant="subtitle2" 
                      color="primary"
                      sx={{ 
                        mb: 1.5,
                        fontWeight: 600,
                        textTransform: 'capitalize',
                        borderBottom: '2px solid #e3f2fd',
                        paddingBottom: 1
                      }}
                    >
                      {key.split('#').pop()?.replace(/([A-Z])/g, ' $1').trim() || key}
                    </Typography>
                    {formatValue(value)}
                  </Paper>
                </Grid>
              );
          })}
        </Grid>
      </Paper>

      {/* Subscribers Section */}
      {renderSubscribers()}

      {/* Logistics Events Section */}
      {renderLogisticsEvents()}

      {/* Audit Trail - Moved up */}
      {renderAuditTrail()}

      {/* Event Dialog */}
      <Dialog 
        open={openEventDialog} 
        onClose={() => !sendingEvent && setOpenEventDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Send Logistics Event</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              select
              label="Event Type"
              value={eventData.type}
              onChange={(e) => {
                const selectedType = EVENT_TYPES.find(type => type.code === e.target.value);
                setEventData(prev => ({ 
                  ...prev, 
                  type: e.target.value,
                  name: selectedType?.name || '',
                  description: selectedType?.description || ''
                }));
              }}
              fullWidth
              required
              helperText="Select the type of logistics event"
            >
              {EVENT_TYPES.map((type) => (
                <MenuItem key={type.code} value={type.code}>
                  <Box>
                    <Typography>
                      {type.code} - {type.name}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {type.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </TextField>
            
            <TextField
              select
              label="Time Type"
              value={eventData.timeType}
              onChange={(e) => setEventData(prev => ({ ...prev, timeType: e.target.value }))}
              fullWidth
              required
              helperText="Specify the nature of the event time"
            >
              {EVENT_TIME_TYPES.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </TextField>
            
            <TextField
              label="Description"
              value={eventData.description}
              onChange={(e) => setEventData(prev => ({ ...prev, description: e.target.value }))}
              multiline
              rows={3}
              fullWidth
              required
              helperText="Additional details about the event"
            />

            <TextField
              label="Location"
              value={eventData.location}
              onChange={(e) => setEventData(prev => ({ ...prev, location: e.target.value }))}
              fullWidth
              required
              helperText="Location where the event occurred"
            />

            <TextField
              label="Timestamp"
              type="datetime-local"
              value={eventData.timestamp.slice(0, 16)}
              onChange={(e) => setEventData(prev => ({ 
                ...prev, 
                timestamp: new Date(e.target.value).toISOString()
              }))}
              fullWidth
              required
              helperText="When the event occurred"
              InputLabelProps={{
                shrink: true,
              }}
            />

            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              bgcolor: 'background.paper',
              p: 1,
              borderRadius: 1
            }}>
              <Typography color="textSecondary">Partial Event</Typography>
              <Switch
                checked={eventData.partialEventIndicator}
                onChange={(e) => setEventData(prev => ({ 
                  ...prev, 
                  partialEventIndicator: e.target.checked 
                }))}
                inputProps={{ 'aria-label': 'partial event indicator' }}
              />
              <Typography variant="caption" color="textSecondary">
                Indicate if this is a partial event
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setOpenEventDialog(false)}
            disabled={sendingEvent}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSendEvent}
            disabled={sendingEvent || !eventData.type || !eventData.description || !eventData.location}
            startIcon={sendingEvent ? <CircularProgress size={20} /> : null}
          >
            {sendingEvent ? 'Sending...' : 'Send Event'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Raw JSON-LD Viewer */}
      <Accordion sx={{ mt: 2 }}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="raw-jsonld-content"
          id="raw-jsonld-header"
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CodeIcon sx={{ color: '#1976d2' }} />
            <Typography sx={{ color: '#1976d2' }}>Raw JSON-LD</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ position: 'relative' }}>
            <Paper
              sx={{
                p: 2,
                backgroundColor: '#272822',
                color: '#f8f8f2',
                fontFamily: 'monospace',
                overflow: 'auto',
                maxHeight: '500px'
              }}
            >
              <Tooltip title="Copy to clipboard">
                <IconButton
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(data, null, 2))}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'rgba(255,255,255,0.1)'
                    }
                  }}
                >
                  <ContentCopyIcon />
                </IconButton>
              </Tooltip>
              <pre style={{ margin: 0 }}>
                {JSON.stringify(data, null, 2)}
              </pre>
            </Paper>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default LogisticsObjectView;
