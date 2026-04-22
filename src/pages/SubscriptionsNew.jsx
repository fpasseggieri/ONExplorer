import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  Check as CheckIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  RemoveCircleOutline as RevokeIcon,
  Send as SendIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiCall, externalApiCall, getLogisticsObjects } from '../utils/api';
import { validateSettings } from '../utils/settingsValidator';
import { getRoleStorageItem, setRoleStorageItem } from '../utils/roleStorage';

const API_NS = 'https://onerecord.iata.org/ns/api#';
const STORAGE_KEY = 'subscriptionsNewTrackedRequests';

const TOPIC_TYPES = [
  'LOGISTICS_OBJECT_IDENTIFIER',
  'LOGISTICS_OBJECT_TYPE'
];

const EVENT_TYPES = [
  'LOGISTICS_OBJECT_UPDATED',
  'LOGISTICS_OBJECT_CREATED',
  'LOGISTICS_EVENT_RECEIVED'
];

const JSON_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json'
};

const SUBSCRIPTION_REQUEST_EVENTS = new Set([
  'SUBSCRIPTION_REQUEST_PENDING',
  'SUBSCRIPTION_REQUEST_ACCEPTED',
  'SUBSCRIPTION_REQUEST_REJECTED',
  'SUBSCRIPTION_REQUEST_FAILED',
  'SUBSCRIPTION_REQUEST_REVOKED'
]);

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
  const parsed = first(value);
  if (parsed === undefined || parsed === null) return '';
  if (typeof parsed === 'string') return parsed;
  if (typeof parsed === 'object') return parsed['@id'] || '';
  return '';
};

const toValue = (value) => {
  const parsed = first(value);
  if (parsed === undefined || parsed === null) return '';
  if (typeof parsed === 'string') return parsed;
  if (typeof parsed === 'object') return parsed['@value'] || '';
  return String(parsed);
};

const cleanSegment = (value) => {
  if (!value) return '';
  const text = String(value);
  if (text.includes('#')) return text.split('#').pop();
  if (text.includes('/')) return text.split('/').filter(Boolean).pop() || '';
  if (text.includes(':')) return text.split(':').pop();
  return text;
};

const formatDate = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const SOURCE_NOTE_PATTERNS = [
  /^Discovered from /i
];

const isValidUrl = (value) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const readTrackedRequests = () => {
  try {
    const parsed = JSON.parse(getRoleStorageItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeTrackedRequests = (items) => {
  setRoleStorageItem(STORAGE_KEY, JSON.stringify(items));
};

const extractActionRequestId = (uri) => {
  if (!uri) return '';
  return uri.split('/').filter(Boolean).pop() || '';
};

const classifyTrackedMessages = (messages) => {
  const sourceNotes = [];
  const validationWarnings = [];

  (Array.isArray(messages) ? messages : []).forEach((message) => {
    if (!message) return;
    if (SOURCE_NOTE_PATTERNS.some((pattern) => pattern.test(message))) {
      sourceNotes.push(message);
      return;
    }
    validationWarnings.push(message);
  });

  return {
    sourceNotes: Array.from(new Set(sourceNotes)),
    validationWarnings: Array.from(new Set(validationWarnings))
  };
};

const buildSubscriptionPayload = ({
  topic,
  subscriber,
  topicType,
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
      '@id': `api:${topicType}`
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

const normalizeSubscriptionRequest = (item) => {
  const subscriptionNode = first(getApiField(item, 'hasSubscription'));
  const statusId = toId(getApiField(item, 'hasRequestStatus'));
  const requestedBy = toId(getApiField(item, 'isRequestedBy'));
  const requestedAt = toValue(getApiField(item, 'isRequestedAt'));
  const subscriptionRef = toId(subscriptionNode || getApiField(item, 'hasSubscription'));
  const subscriber = toId(getApiField(subscriptionNode, 'hasSubscriber'));
  const topic = toValue(getApiField(subscriptionNode, 'hasTopic'));
  const topicType = cleanSegment(toId(getApiField(subscriptionNode, 'hasTopicType')));

  return {
    id: cleanSegment(item['@id']),
    uri: item['@id'] || '',
    status: cleanSegment(statusId) || 'UNKNOWN',
    requestedBy: requestedBy || '-',
    requestTime: requestedAt || '',
    subscription: cleanSegment(subscriptionRef) || '-',
    subscriber: subscriber || requestedBy || '-',
    topic: topic || '-',
    topicType: topicType || '-'
  };
};

const normalizeTrackedRequest = (item) => {
  const classifiedLegacyWarnings = classifyTrackedMessages(item.warnings);

  return {
    id: item.id || extractActionRequestId(item.actionRequestUri),
    actionRequestUri: item.actionRequestUri || '',
    serverId: item.serverId || '',
    serverName: item.serverName || '',
    mode: item.mode || 'subscriber-initiated',
    scope: item.scope || 'external',
    counterpart: item.counterpart || '',
    topic: item.topic || '-',
    subscriber: item.subscriber || '-',
    topicType: item.topicType || '-',
    requestTime: item.requestTime || '',
    status: item.status || 'UNKNOWN',
    sourceNotes: Array.from(new Set([
      ...(Array.isArray(item.sourceNotes) ? item.sourceNotes : []),
      ...classifiedLegacyWarnings.sourceNotes
    ])),
    validationWarnings: Array.from(new Set([
      ...(Array.isArray(item.validationWarnings) ? item.validationWarnings : []),
      ...classifiedLegacyWarnings.validationWarnings
    ]))
  };
};

const normalizeLegacyExternalSubscriptionRecord = (item) => {
  const classifiedLegacyWarnings = classifyTrackedMessages(item.warnings);

  return {
    id: item.actionRequestId || item.subscriptionId || item.id || extractActionRequestId(item.actionRequestUri || item.uri),
    actionRequestUri: item.actionRequestUri || item.uri || '',
    serverId: item.serverId || '',
    serverName: item.server || item.serverName || '',
    mode: 'legacy-browser-tracked',
    scope: 'external',
    counterpart: item.server || item.serverName || '',
    topic: item.topic || '-',
    subscriber: item.subscriber || '-',
    topicType: item.topicType || '-',
    requestTime: item.requestTime || item.requestedAt || item.createdAt || '',
    status: item.status || 'UNKNOWN',
    sourceNotes: classifiedLegacyWarnings.sourceNotes,
    validationWarnings: classifiedLegacyWarnings.validationWarnings
  };
};

const buildTrackedKey = (item) => item.actionRequestUri || `${item.scope}:${item.id}`;

const mergeTrackedRequestPair = (left, right) => ({
  ...left,
  ...right,
  sourceNotes: Array.from(new Set([...(left.sourceNotes || []), ...(right.sourceNotes || [])])),
  validationWarnings: Array.from(new Set([...(left.validationWarnings || []), ...(right.validationWarnings || [])]))
});

const mergeTrackedRequestLists = (...lists) => {
  const merged = new Map();
  lists.flat().filter(Boolean).forEach((item) => {
    const normalized = normalizeTrackedRequest(item);
    const key = buildTrackedKey(normalized);
    const existing = merged.get(key);
    merged.set(key, existing ? mergeTrackedRequestPair(existing, normalized) : normalized);
  });
  return Array.from(merged.values());
};

const mapNotificationEventToRequestStatus = (eventType) => {
  if (!eventType) return 'UNKNOWN';
  return eventType.startsWith('SUBSCRIPTION_')
    ? eventType.replace('SUBSCRIPTION_', '')
    : eventType;
};

const resolveTrackedContext = (actionRequestUri, localBaseUrl, servers) => {
  if (localBaseUrl && actionRequestUri.startsWith(localBaseUrl)) {
    return {
      scope: 'local',
      serverId: '',
      serverName: 'Local server',
      counterpart: 'Local server'
    };
  }

  const matchedServer = servers.find((server) => actionRequestUri.startsWith(server.baseUrl));
  if (matchedServer) {
    return {
      scope: 'external',
      serverId: matchedServer.id,
      serverName: matchedServer.name,
      counterpart: matchedServer.name
    };
  }

  return {
    scope: 'external',
    serverId: '',
    serverName: '',
    counterpart: 'Unknown server'
  };
};

const getStatusColor = (status) => {
  switch (status) {
    case 'REQUEST_ACCEPTED':
      return 'success';
    case 'REQUEST_PENDING':
      return 'warning';
    case 'REQUEST_REJECTED':
      return 'error';
    case 'REQUEST_REVOKED':
      return 'default';
    default:
      return 'default';
  }
};

const validateCreatedResponse = (response) => {
  const warnings = [];
  const location = response.headers.get('Location') || response.headers.get('location') || '';
  const typeHeader = response.headers.get('Type') || response.headers.get('type') || '';

  if (!location) {
    throw new Error('The server did not return a Location header for the created SubscriptionRequest');
  }

  if (response.status !== 201) {
    warnings.push(`Expected HTTP 201 Created but received ${response.status}`);
  }

  if (!typeHeader) {
    warnings.push('Missing Type header. ONE Record expects api#SubscriptionRequest for created requests.');
  } else if (!typeHeader.includes('SubscriptionRequest')) {
    warnings.push(`Unexpected Type header: ${typeHeader}`);
  }

  return {
    location,
    warnings
  };
};

const validatePreviewSubscription = (payload, expectedTopic, expectedTopicType) => {
  const warnings = [];
  const returnedType = cleanSegment(toId(payload['@type']));
  const returnedTopic = toValue(getApiField(payload, 'hasTopic'));
  const returnedTopicType = cleanSegment(toId(getApiField(payload, 'hasTopicType')));
  const returnedSubscriber = toId(getApiField(payload, 'hasSubscriber'));

  if (returnedType !== 'Subscription') {
    warnings.push(`Expected api:Subscription but received ${returnedType || 'unknown type'}`);
  }

  if (!returnedSubscriber) {
    warnings.push('Returned subscription does not contain api:hasSubscriber');
  }

  if (returnedTopic !== expectedTopic) {
    warnings.push('Returned topic does not match the requested topic');
  }

  if (returnedTopicType !== expectedTopicType) {
    warnings.push('Returned topic type does not match the requested topic type');
  }

  return {
    warnings,
    normalized: {
      subscriber: returnedSubscriber || '-',
      topic: returnedTopic || '-',
      topicType: returnedTopicType || '-'
    }
  };
};

const SectionHeader = ({ title, subtitle, action }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2 }}>
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      {subtitle ? (
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      ) : null}
    </Box>
    {action}
  </Box>
);

const SubscriptionsNew = () => {
  const navigate = useNavigate();
  const [settingsValid, setSettingsValid] = useState(false);
  const [servers, setServers] = useState([]);
  const [loadingIncoming, setLoadingIncoming] = useState(false);
  const [loadingTracked, setLoadingTracked] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [trackedRequests, setTrackedRequests] = useState([]);
  const [pageError, setPageError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const [postForm, setPostForm] = useState({
    serverId: '',
    topicType: 'LOGISTICS_OBJECT_IDENTIFIER',
    topic: '',
    subscriber: '',
    description: '',
    expiresAt: '',
    sendLogisticsObjectBody: false,
    notifyRequestStatusChange: true,
    eventTypes: [...EVENT_TYPES]
  });
  const [postBusy, setPostBusy] = useState(false);
  const [postResult, setPostResult] = useState(null);
  const [postError, setPostError] = useState('');

  const [getForm, setGetForm] = useState({
    serverId: '',
    topicType: 'LOGISTICS_OBJECT_IDENTIFIER',
    topic: ''
  });
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewResult, setPreviewResult] = useState(null);
  const [createFromPreviewBusy, setCreateFromPreviewBusy] = useState(false);
  const [createFromPreviewError, setCreateFromPreviewError] = useState('');
  const [createFromPreviewResult, setCreateFromPreviewResult] = useState(null);

  const serversById = useMemo(() => {
    const map = new Map();
    servers.forEach((server) => {
      map.set(server.id, server);
    });
    return map;
  }, [servers]);
  const localBaseUrl = (getRoleStorageItem('baseUrl') || '').trim();

  const refreshIncomingRequests = useCallback(async () => {
    if (!settingsValid) {
      setIncomingRequests([]);
      return;
    }

    try {
      setLoadingIncoming(true);
      const response = await getLogisticsObjects(encodeURIComponent(`${API_NS}SubscriptionRequest`));
      const graph = response['@graph'] ? response['@graph'] : [response];
      const cleaned = graph
        .filter((item) => item && Object.keys(item).length > 0)
        .map(normalizeSubscriptionRequest)
        .sort((left, right) => new Date(right.requestTime) - new Date(left.requestTime));
      setIncomingRequests(cleaned);
    } catch (error) {
      setPageError(error.message || 'Failed to load incoming subscription requests');
    } finally {
      setLoadingIncoming(false);
    }
  }, [settingsValid]);

  const refreshTrackedRequests = useCallback(async () => {
    try {
      setLoadingTracked(true);
      const localItems = readTrackedRequests().map(normalizeTrackedRequest);
      const legacyItems = (() => {
        try {
          const parsed = JSON.parse(getRoleStorageItem('externalSubscriptions') || '[]');
          return Array.isArray(parsed) ? parsed.map(normalizeLegacyExternalSubscriptionRecord) : [];
        } catch {
          return [];
        }
      })();

      let discoveredLocalItems = [];
      let discoveredNotificationItems = [];

      if (settingsValid) {
        const [localRequestsResponse, receivedNotificationsResponse] = await Promise.all([
          getLogisticsObjects(encodeURIComponent(`${API_NS}SubscriptionRequest`)),
          apiCall('/logistics-objects/internal/_notifications/received?limit=200&offset=0', {
            method: 'GET',
            headers: JSON_HEADERS
          })
        ]);

        const localGraph = localRequestsResponse['@graph'] ? localRequestsResponse['@graph'] : [localRequestsResponse];
        discoveredLocalItems = localGraph
          .filter((item) => item && Object.keys(item).length > 0)
          .map(normalizeSubscriptionRequest)
          .filter((item) => localBaseUrl && item.requestedBy && item.requestedBy.startsWith(localBaseUrl))
          .map((item) => ({
            id: item.id,
            actionRequestUri: item.uri,
            serverId: '',
            serverName: 'Local server',
            mode: 'local-discovered',
            scope: 'local',
            counterpart: 'Local server',
            topic: item.topic,
            subscriber: item.subscriber,
            topicType: item.topicType,
            requestTime: item.requestTime,
            status: item.status,
            sourceNotes: ['Discovered from local SubscriptionRequest resources'],
            validationWarnings: []
          }));

        const receivedNotifications = Array.isArray(receivedNotificationsResponse?.items)
          ? receivedNotificationsResponse.items
          : [];
        discoveredNotificationItems = receivedNotifications
          .filter((item) => SUBSCRIPTION_REQUEST_EVENTS.has(item.eventType) && item.actionRequestIri)
          .map((item) => {
            const resolved = resolveTrackedContext(item.actionRequestIri, localBaseUrl, servers);
            return {
              id: extractActionRequestId(item.actionRequestIri),
              actionRequestUri: item.actionRequestIri,
              serverId: resolved.serverId,
              serverName: resolved.serverName,
              mode: 'notification-discovered',
              scope: resolved.scope,
              counterpart: resolved.counterpart,
              topic: '-',
              subscriber: '-',
              topicType: '-',
              requestTime: item.processedAt || '',
              status: mapNotificationEventToRequestStatus(item.eventType),
              sourceNotes: ['Discovered from received subscription notifications'],
              validationWarnings: []
            };
          });
      }

      const mergedItems = mergeTrackedRequestLists(
        localItems,
        legacyItems,
        discoveredLocalItems,
        discoveredNotificationItems
      );

      const hydrated = await Promise.all(mergedItems.map(async (item) => {
        try {
          const resolvedActionRequestUri = item.actionRequestUri || (
            item.scope === 'external' && item.serverId && serversById.get(item.serverId)
              ? `${serversById.get(item.serverId).baseUrl}/action-requests/${item.id}`
              : ''
          );
          const resolvedScope = item.scope === 'local' || (resolvedActionRequestUri && localBaseUrl && resolvedActionRequestUri.startsWith(localBaseUrl))
            ? 'local'
            : 'external';
          const response = resolvedScope === 'local'
            ? await apiCall(`/action-requests/${item.id}`, { method: 'GET' })
            : await externalApiCall(serversById.get(item.serverId)?.baseUrl || '', `/action-requests/${item.id}`, {
                method: 'GET',
                server: serversById.get(item.serverId)
              });
          const parsed = normalizeSubscriptionRequest(response);
          return {
            ...item,
            actionRequestUri: resolvedActionRequestUri || item.actionRequestUri,
            scope: resolvedScope,
            status: parsed.status || item.status,
            requestTime: parsed.requestTime || item.requestTime,
            requestedBy: parsed.requestedBy || item.requestedBy,
            subscriber: parsed.subscriber || item.subscriber,
            topic: parsed.topic || item.topic,
            topicType: parsed.topicType || item.topicType
          };
        } catch {
          return item;
        }
      }));

      hydrated.sort((left, right) => new Date(right.requestTime) - new Date(left.requestTime));
      setTrackedRequests(hydrated);
    } finally {
      setLoadingTracked(false);
    }
  }, [localBaseUrl, servers, serversById, settingsValid]);

  useEffect(() => {
    const { isValid } = validateSettings();
    setSettingsValid(isValid);
    try {
      const savedServers = JSON.parse(getRoleStorageItem('externalServers') || '[]');
      setServers(Array.isArray(savedServers) ? savedServers : []);
    } catch {
      setServers([]);
    }
  }, []);

  useEffect(() => {
    refreshIncomingRequests();
  }, [refreshIncomingRequests]);

  useEffect(() => {
    refreshTrackedRequests();
  }, [refreshTrackedRequests]);

  const persistTrackedRequest = useCallback((item) => {
    const current = readTrackedRequests().map(normalizeTrackedRequest);
    const filtered = current.filter((entry) => entry.actionRequestUri !== item.actionRequestUri);
    const updated = [normalizeTrackedRequest(item), ...filtered];
    writeTrackedRequests(updated);
    setTrackedRequests(updated);
  }, []);

  const togglePostEventType = (eventType) => {
    setPostForm((current) => {
      const next = current.eventTypes.includes(eventType)
        ? current.eventTypes.filter((entry) => entry !== eventType)
        : [...current.eventTypes, eventType];
      return {
        ...current,
        eventTypes: next
      };
    });
  };

  const handleCreateRemoteRequest = async () => {
    const selectedServer = serversById.get(postForm.serverId);
    if (!selectedServer) {
      setPostError('Select the remote publisher server');
      return;
    }

    if (!isValidUrl(postForm.topic) || !isValidUrl(postForm.subscriber)) {
      setPostError('Topic URI and Subscriber URI must be valid URLs');
      return;
    }

    if (postForm.eventTypes.length === 0) {
      setPostError('Select at least one subscription event type');
      return;
    }

    try {
      setPostBusy(true);
      setPostError('');
      setPostResult(null);

      const payload = buildSubscriptionPayload(postForm);
      const response = await externalApiCall(selectedServer.baseUrl, '/subscriptions', {
        method: 'POST',
        body: JSON.stringify(payload),
        server: selectedServer,
        returnFullResponse: true
      });
      const validation = validateCreatedResponse(response);
      const trackedItem = {
        id: extractActionRequestId(validation.location),
        actionRequestUri: validation.location,
        serverId: selectedServer.id,
        serverName: selectedServer.name,
        mode: 'subscriber-initiated',
        scope: 'external',
        counterpart: selectedServer.name,
        topic: postForm.topic,
        subscriber: postForm.subscriber,
        topicType: postForm.topicType,
        requestTime: new Date().toISOString(),
        status: 'UNKNOWN',
        sourceNotes: [],
        validationWarnings: validation.warnings
      };

      persistTrackedRequest(trackedItem);
      setPostResult({
        location: validation.location,
        warnings: validation.warnings
      });
      setPostForm((current) => ({
        ...current,
        topic: '',
        subscriber: '',
        description: '',
        expiresAt: '',
        sendLogisticsObjectBody: false,
        notifyRequestStatusChange: true,
        eventTypes: [...EVENT_TYPES]
      }));
      await refreshTrackedRequests();
    } catch (error) {
      setPostError(error.message || 'Failed to create remote subscription request');
    } finally {
      setPostBusy(false);
    }
  };

  const handlePreviewSubscriberInfo = async () => {
    const selectedServer = serversById.get(getForm.serverId);
    if (!selectedServer) {
      setPreviewError('Select the subscriber server');
      return;
    }

    if (!isValidUrl(getForm.topic)) {
      setPreviewError('Topic URI must be a valid URL');
      return;
    }

    try {
      setPreviewBusy(true);
      setPreviewError('');
      setPreviewResult(null);
      setCreateFromPreviewResult(null);
      setCreateFromPreviewError('');

      const query = new URLSearchParams({
        topicType: `api:${getForm.topicType}`,
        topic: getForm.topic
      });
      const payload = await externalApiCall(selectedServer.baseUrl, `/subscriptions?${query.toString()}`, {
        method: 'GET',
        server: selectedServer
      });
      const validation = validatePreviewSubscription(payload, getForm.topic, getForm.topicType);
      setPreviewResult({
        payload,
        normalized: validation.normalized,
        warnings: validation.warnings,
        serverId: selectedServer.id,
        serverName: selectedServer.name
      });
    } catch (error) {
      setPreviewError(error.message || 'Failed to fetch subscriber subscription information');
    } finally {
      setPreviewBusy(false);
    }
  };

  const handleCreateLocalFromPreview = async () => {
    if (!previewResult) {
      setCreateFromPreviewError('Fetch subscription information before creating a local request');
      return;
    }

    if (!settingsValid) {
      setCreateFromPreviewError('Local API settings are required to create the local publisher request');
      return;
    }

    try {
      setCreateFromPreviewBusy(true);
      setCreateFromPreviewError('');
      setCreateFromPreviewResult(null);

      const response = await apiCall('/subscriptions', {
        method: 'POST',
        body: JSON.stringify(previewResult.payload),
        returnFullResponse: true
      });
      const validation = validateCreatedResponse(response);
      const trackedItem = {
        id: extractActionRequestId(validation.location),
        actionRequestUri: validation.location,
        serverId: previewResult.serverId,
        serverName: previewResult.serverName,
        mode: 'publisher-initiated',
        scope: 'local',
        counterpart: previewResult.serverName,
        topic: previewResult.normalized.topic,
        subscriber: previewResult.normalized.subscriber,
        topicType: previewResult.normalized.topicType,
        requestTime: new Date().toISOString(),
        status: 'UNKNOWN',
        sourceNotes: [],
        validationWarnings: [...previewResult.warnings, ...validation.warnings]
      };

      persistTrackedRequest(trackedItem);
      setCreateFromPreviewResult({
        location: validation.location,
        warnings: [...previewResult.warnings, ...validation.warnings]
      });
      await refreshTrackedRequests();
      await refreshIncomingRequests();
    } catch (error) {
      setCreateFromPreviewError(error.message || 'Failed to create local request from subscriber information');
    } finally {
      setCreateFromPreviewBusy(false);
    }
  };

  const handleIncomingStatusUpdate = async (requestId, newStatus) => {
    try {
      setActionBusy(true);
      setPageError('');
      if (newStatus === 'REQUEST_REVOKED') {
        await apiCall(`/action-requests/${requestId}`, {
          method: 'DELETE'
        });
      } else {
        await apiCall(`/action-requests/${requestId}?status=${newStatus}`, {
          method: 'PATCH'
        });
      }
      await refreshIncomingRequests();
      await refreshTrackedRequests();
    } catch (error) {
      setPageError(error.message || 'Failed to update incoming subscription request');
    } finally {
      setActionBusy(false);
    }
  };

  const handleTrackedRevoke = async (request) => {
    try {
      setActionBusy(true);
      setPageError('');
      if (request.scope === 'local') {
        await apiCall(`/action-requests/${request.id}`, {
          method: 'DELETE'
        });
      } else {
        const server = serversById.get(request.serverId);
        if (!server) {
          throw new Error('External server configuration not found for this tracked request');
        }
        await externalApiCall(server.baseUrl, `/action-requests/${request.id}`, {
          method: 'DELETE',
          server
        });
      }
      await refreshTrackedRequests();
      await refreshIncomingRequests();
    } catch (error) {
      setPageError(error.message || 'Failed to revoke tracked subscription request');
    } finally {
      setActionBusy(false);
    }
  };

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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SendIcon sx={{ fontSize: 40 }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 600 }}>
                Subscription New
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.92 }}>
                Spec-oriented subscription workflows for ONE Record subscription requests.
              </Typography>
            </Box>
          </Box>
          <Button
            variant="contained"
            color="inherit"
            startIcon={<RefreshIcon />}
            onClick={async () => {
              await refreshIncomingRequests();
              await refreshTrackedRequests();
            }}
            disabled={loadingIncoming || loadingTracked || actionBusy}
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

      <Alert severity="info" sx={{ mb: 3 }}>
        This page keeps the existing subscriptions screen unchanged. It implements the two spec flows separately:
        remote POST /subscriptions and remote GET /subscriptions followed by local request creation.
      </Alert>

      {!settingsValid ? (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Local API settings are missing. You can still create remote subscription requests, but local request creation and incoming request management are disabled.
        </Alert>
      ) : null}

      {pageError ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {pageError}
        </Alert>
      ) : null}

      <Grid container spacing={3}>
        <Grid item xs={12} lg={6}>
          <Accordion disableGutters elevation={1} sx={{ borderRadius: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <SectionHeader
                title="Subscriber-Initiated Flow"
                subtitle="Create a remote SubscriptionRequest with POST /subscriptions on the selected publisher server."
              />
            </AccordionSummary>
            <AccordionDetails>
              {postResult ? (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Created remote request at {postResult.location}
                </Alert>
              ) : null}
              {postResult?.warnings?.length ? (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {postResult.warnings.join(' ')}
                </Alert>
              ) : null}
              {postError ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {postError}
                </Alert>
              ) : null}
              <Stack spacing={2}>
                <TextField
                  select
                  label="Publisher Server"
                  value={postForm.serverId}
                  onChange={(event) => setPostForm((current) => ({ ...current, serverId: event.target.value }))}
                  fullWidth
                  required
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
                  value={postForm.topicType}
                  onChange={(event) => setPostForm((current) => ({ ...current, topicType: event.target.value }))}
                  fullWidth
                >
                  {TOPIC_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Topic URI"
                  value={postForm.topic}
                  onChange={(event) => setPostForm((current) => ({ ...current, topic: event.target.value }))}
                  error={Boolean(postForm.topic) && !isValidUrl(postForm.topic)}
                  helperText="ONE Record topic URI"
                  fullWidth
                />
                <TextField
                  label="Subscriber URI"
                  value={postForm.subscriber}
                  onChange={(event) => setPostForm((current) => ({ ...current, subscriber: event.target.value }))}
                  error={Boolean(postForm.subscriber) && !isValidUrl(postForm.subscriber)}
                  helperText="IRI of the subscriber logistics agent"
                  fullWidth
                />
                <TextField
                  label="Description"
                  value={postForm.description}
                  onChange={(event) => setPostForm((current) => ({ ...current, description: event.target.value }))}
                  fullWidth
                />
                <TextField
                  label="Expires At"
                  type="datetime-local"
                  value={postForm.expiresAt}
                  onChange={(event) => setPostForm((current) => ({ ...current, expiresAt: event.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
                <FormControl component="fieldset" variant="standard">
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                    Included Event Types
                  </Typography>
                  <FormGroup>
                    {EVENT_TYPES.map((eventType) => (
                      <FormControlLabel
                        key={eventType}
                        control={
                          <Checkbox
                            checked={postForm.eventTypes.includes(eventType)}
                            onChange={() => togglePostEventType(eventType)}
                          />
                        }
                        label={eventType}
                      />
                    ))}
                  </FormGroup>
                </FormControl>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={postForm.notifyRequestStatusChange}
                      onChange={(event) => setPostForm((current) => ({
                        ...current,
                        notifyRequestStatusChange: event.target.checked
                      }))}
                    />
                  }
                  label="Notify request status changes"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={postForm.sendLogisticsObjectBody}
                      onChange={(event) => setPostForm((current) => ({
                        ...current,
                        sendLogisticsObjectBody: event.target.checked
                      }))}
                    />
                  }
                  label="Send logistics object body in notifications"
                />
                <Box>
                  <Button
                    variant="contained"
                    onClick={handleCreateRemoteRequest}
                    disabled={postBusy || servers.length === 0}
                    startIcon={postBusy ? <CircularProgress size={18} /> : <SendIcon />}
                  >
                    Create Remote Request
                  </Button>
                </Box>
              </Stack>
            </AccordionDetails>
          </Accordion>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Accordion disableGutters elevation={1} sx={{ borderRadius: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <SectionHeader
                title="Publisher-Initiated Flow"
                subtitle="Fetch subscriber subscription info with GET /subscriptions, validate it, then create a local request."
              />
            </AccordionSummary>
            <AccordionDetails>
              {previewError ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {previewError}
                </Alert>
              ) : null}
              {createFromPreviewError ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {createFromPreviewError}
                </Alert>
              ) : null}
              {createFromPreviewResult ? (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Created local request at {createFromPreviewResult.location}
                </Alert>
              ) : null}
              {createFromPreviewResult?.warnings?.length ? (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {createFromPreviewResult.warnings.join(' ')}
                </Alert>
              ) : null}
              <Stack spacing={2}>
                <TextField
                  select
                  label="Subscriber Server"
                  value={getForm.serverId}
                  onChange={(event) => setGetForm((current) => ({ ...current, serverId: event.target.value }))}
                  fullWidth
                  required
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
                  value={getForm.topicType}
                  onChange={(event) => setGetForm((current) => ({ ...current, topicType: event.target.value }))}
                  fullWidth
                >
                  {TOPIC_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Topic URI"
                  value={getForm.topic}
                  onChange={(event) => setGetForm((current) => ({ ...current, topic: event.target.value }))}
                  error={Boolean(getForm.topic) && !isValidUrl(getForm.topic)}
                  helperText="Topic used in GET /subscriptions"
                  fullWidth
                />
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    onClick={handlePreviewSubscriberInfo}
                    disabled={previewBusy || servers.length === 0}
                    startIcon={previewBusy ? <CircularProgress size={18} /> : <RefreshIcon />}
                  >
                    Fetch Subscriber Info
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handleCreateLocalFromPreview}
                    disabled={!previewResult || createFromPreviewBusy || !settingsValid}
                    startIcon={createFromPreviewBusy ? <CircularProgress size={18} /> : <SendIcon />}
                  >
                    Create Local Request
                  </Button>
                </Box>
              </Stack>

              {previewResult ? (
                <>
                  <Divider sx={{ my: 3 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                    Subscriber Response Preview
                  </Typography>
                  {previewResult.warnings.length ? (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      {previewResult.warnings.join(' ')}
                    </Alert>
                  ) : (
                    <Alert severity="success" sx={{ mb: 2 }}>
                      Returned Subscription matches the requested topic and topic type.
                    </Alert>
                  )}
                  <Stack spacing={1}>
                    <Typography variant="body2">
                      <strong>Subscriber:</strong> {previewResult.normalized.subscriber}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Topic:</strong> {previewResult.normalized.topic}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Topic Type:</strong> {previewResult.normalized.topicType}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Counterparty:</strong> {previewResult.serverName}
                    </Typography>
                  </Stack>
                </>
              ) : null}
            </AccordionDetails>
          </Accordion>
        </Grid>
      </Grid>

      <Paper sx={{ p: 3, mt: 3 }}>
        <SectionHeader
          title="Incoming Subscription Requests"
          subtitle="Local SubscriptionRequest resources projected from the internal API."
          action={
            <Button
              startIcon={<RefreshIcon />}
              onClick={refreshIncomingRequests}
              disabled={loadingIncoming || !settingsValid}
            >
              Refresh
            </Button>
          }
        />
        {!settingsValid ? (
          <Alert severity="warning">Local settings are required to manage incoming requests.</Alert>
        ) : loadingIncoming ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : incomingRequests.length === 0 ? (
          <Typography color="text.secondary">No incoming subscription requests found.</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Request ID</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Subscriber</TableCell>
                  <TableCell>Topic</TableCell>
                  <TableCell>Topic Type</TableCell>
                  <TableCell>Requested At</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {incomingRequests.map((request) => {
                  const isPending = request.status === 'REQUEST_PENDING';
                  const isAccepted = request.status === 'REQUEST_ACCEPTED';
                  return (
                    <TableRow key={request.id}>
                      <TableCell>{request.id}</TableCell>
                      <TableCell>
                        <Chip label={request.status} size="small" color={getStatusColor(request.status)} />
                      </TableCell>
                      <TableCell sx={{ wordBreak: 'break-all' }}>{request.subscriber}</TableCell>
                      <TableCell sx={{ wordBreak: 'break-all' }}>{request.topic}</TableCell>
                      <TableCell>{request.topicType}</TableCell>
                      <TableCell>{formatDate(request.requestTime)}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Tooltip title="View">
                            <IconButton onClick={() => navigate(`/subscription-requests/${request.id}`)}>
                              <VisibilityIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={isPending ? 'Accept' : 'Available only for pending requests'}>
                            <span>
                              <IconButton
                                color="success"
                                disabled={!isPending || actionBusy}
                                onClick={() => handleIncomingStatusUpdate(request.id, 'REQUEST_ACCEPTED')}
                              >
                                <CheckIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={isPending ? 'Reject' : 'Available only for pending requests'}>
                            <span>
                              <IconButton
                                color="error"
                                disabled={!isPending || actionBusy}
                                onClick={() => handleIncomingStatusUpdate(request.id, 'REQUEST_REJECTED')}
                              >
                                <CloseIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={isAccepted ? 'Revoke' : 'Available only for accepted requests'}>
                            <span>
                              <IconButton
                                color="warning"
                                disabled={!isAccepted || actionBusy}
                                onClick={() => handleIncomingStatusUpdate(request.id, 'REQUEST_REVOKED')}
                              >
                                <RevokeIcon />
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
        )}
      </Paper>

      <Paper sx={{ p: 3, mt: 3 }}>
        <SectionHeader
          title="Tracked Requests"
          subtitle="Requests created from this page plus requests discovered from local SubscriptionRequest resources, received notifications, and the legacy browser tracker."
          action={
            <Button
              startIcon={<RefreshIcon />}
              onClick={refreshTrackedRequests}
              disabled={loadingTracked}
            >
              Refresh
            </Button>
          }
        />
        {loadingTracked ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : trackedRequests.length === 0 ? (
          <Typography color="text.secondary">No tracked or discovered subscription requests found.</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Mode</TableCell>
                  <TableCell>Scope</TableCell>
                  <TableCell>Counterparty</TableCell>
                  <TableCell>Request ID</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Topic</TableCell>
                  <TableCell>Subscriber</TableCell>
                  <TableCell>Source Notes</TableCell>
                  <TableCell>Validation Warnings</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {trackedRequests.map((request) => (
                  <TableRow key={request.actionRequestUri || request.id}>
                    <TableCell>{request.mode}</TableCell>
                    <TableCell>{request.scope}</TableCell>
                    <TableCell>{request.counterpart || request.serverName || '-'}</TableCell>
                    <TableCell>{request.id}</TableCell>
                    <TableCell>
                      <Chip label={request.status} size="small" color={getStatusColor(request.status)} />
                    </TableCell>
                    <TableCell sx={{ wordBreak: 'break-all' }}>{request.topic}</TableCell>
                    <TableCell sx={{ wordBreak: 'break-all' }}>{request.subscriber}</TableCell>
                    <TableCell>
                      {request.sourceNotes.length ? (
                        <Tooltip title={request.sourceNotes.join(' ')}>
                          <Chip label={`${request.sourceNotes.length} note(s)`} size="small" color="info" />
                        </Tooltip>
                      ) : (
                        <Chip label="None" size="small" color="success" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>
                      {request.validationWarnings.length ? (
                        <Tooltip title={request.validationWarnings.join(' ')}>
                          <Chip label={`${request.validationWarnings.length} warning(s)`} size="small" color="warning" />
                        </Tooltip>
                      ) : (
                        <Chip label="None" size="small" color="success" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="View">
                          <IconButton
                            onClick={() => navigate(
                              request.scope === 'local'
                                ? `/subscription-requests/${request.id}`
                                : `/external-subscription-requests/${request.serverId}/${request.id}`
                            )}
                          >
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Revoke">
                          <span>
                            <IconButton
                              color="warning"
                              disabled={actionBusy || request.status === 'REQUEST_REVOKED'}
                              onClick={() => handleTrackedRevoke(request)}
                            >
                              <RevokeIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
};

export default SubscriptionsNew;
