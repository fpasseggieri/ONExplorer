import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Box, CssBaseline, CircularProgress, Alert, Button } from '@mui/material';
import Sidebar from './components/Sidebar';
import Database from './pages/Database';
import LogisticsObjectView from './pages/LogisticsObjectView';
import CreateLogisticsObject from './pages/CreateLogisticsObject';
import Notifications from './pages/Notifications';
import Subscriptions from './pages/Subscriptions';
import SubscriptionRequestView from './pages/SubscriptionRequestView';
import Changes from './pages/Changes';
import ChangeRequestView from './pages/ChangeRequestView';
import Settings from './pages/Settings';
import Dashboard from './pages/Dashboard';
import { initAuth } from './auth/keycloak';
import { initializeRuntimeSettings } from './utils/runtimeSettings';

function App() {
  const runtimeSettingsInitialized = React.useRef(false);
  if (!runtimeSettingsInitialized.current) {
    initializeRuntimeSettings();
    runtimeSettingsInitialized.current = true;
  }
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [authInitializing, setAuthInitializing] = React.useState(true);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [authWarning, setAuthWarning] = React.useState(null);

  // Calculate the server port based on the React app's port
  const getServerPort = () => {
    const clientPort = window.location.port || '3000';
    return parseInt(clientPort) + 1;
  };

  useEffect(() => {
    let eventSource;
    let mounted = true;

    const bootstrap = async () => {
      try {
        const authenticated = await initAuth();
        if (!mounted) return;
        setIsAuthenticated(Boolean(authenticated));
        setAuthWarning(null);

        if (!authenticated) {
          return;
        }

        const serverPort = getServerPort();
        const host = window.location.hostname || 'localhost';
        const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
        eventSource = new EventSource(`${protocol}//${host}:${serverPort}/notifyServer`);
        
        eventSource.onmessage = (event) => {
          try {
            if (event.data.startsWith('Connected')) {
              console.log('SSE Connection established');
              return;
            }
            
            const jsonData = JSON.parse(event.data);
            const graphData = jsonData['@graph'] || [jsonData];
            
            const notificationObject = graphData.find(item => 
              item['@id'] && item['@id'].includes('/notifications/')
            );

            if (notificationObject) {
              const logisticsObjectId = notificationObject.hasLogisticsObject['@id'].split('/').pop();
              
              const eventType = notificationObject.hasEventType['@id'].split('#').pop();
              const validEventTypes = [
                'LOGISTICS_OBJECT_CREATED',
                'LOGISTICS_OBJECT_UPDATED',
                'LOGISTICS_EVENT_RECEIVED',
                'CHANGE_REQUEST_PENDING',
                'CHANGE_REQUEST_ACCEPTED',
                'CHANGE_REQUEST_REJECTED',
                'CHANGE_REQUEST_FAILED',
                'CHANGE_REQUEST_REVOKED',
                'ACCESS_DELEGATION_REQUEST_PENDING',
                'ACCESS_DELEGATION_REQUEST_ACCEPTED',
                'ACCESS_DELEGATION_REQUEST_REJECTED',
                'ACCESS_DELEGATION_REQUEST_FAILED',
                'ACCESS_DELEGATION_REQUEST_REVOKED',
                'SUBSCRIPTION_REQUEST_PENDING',
                'SUBSCRIPTION_REQUEST_ACCEPTED',
                'SUBSCRIPTION_REQUEST_REJECTED',
                'SUBSCRIPTION_REQUEST_FAILED',
                'SUBSCRIPTION_REQUEST_REVOKED'
              ];
              
              if (!validEventTypes.includes(eventType)) {
                console.warn('Unknown event type:', eventType);
                return;
              }

              const processedNotification = {
                id: notificationObject['@id'],
                eventType: eventType,
                logisticsObject: notificationObject.hasLogisticsObject['@id'],
                logisticsObjectType: notificationObject.hasLogisticsObjectType['@value'],
                timestamp: new Date().toISOString(),
                title: `Logistics Object ${logisticsObjectId}`
              };
              
              const storedNotifications = JSON.parse(localStorage.getItem('notifications') || '[]');
              if (!storedNotifications.some(n => n.id === processedNotification.id)) {
                const updatedNotifications = [...storedNotifications, processedNotification];
                localStorage.setItem('notifications', JSON.stringify(updatedNotifications));
                console.log('Processed notification:', processedNotification);
              }
            }
          } catch (error) {
            console.error('Error processing message:', error);
            console.error('Raw event data:', event.data);
          }
        };
        
        eventSource.onerror = (error) => {
          console.error('EventSource failed:', error);
        };
      } catch (error) {
        console.error('Authentication init failed:', error);
        if (mounted) {
          setIsAuthenticated(false);
          setAuthWarning('Keycloak is currently unavailable. You can continue in guest mode and sign in when the server is back online.');
        }
      } finally {
        if (mounted) {
          setAuthInitializing(false);
        }
      }
    };

    bootstrap();
    
    return () => {
      mounted = false;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  if (authInitializing) {
    return (
      <Box sx={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Router>
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <CssBaseline />
        <Sidebar 
          open={sidebarOpen} 
          toggleDrawer={toggleSidebar}
          isAuthenticated={isAuthenticated}
        />
        <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
          {authWarning && (
            <Alert
              severity="warning"
              sx={{ mb: 2 }}
              action={
                <Button color="inherit" size="small" onClick={() => window.location.reload()}>
                  Retry
                </Button>
              }
            >
              {authWarning}
            </Alert>
          )}
          <Routes>
            <Route path="/settings" element={<Settings />} />
            <Route path="/" element={<Database isAuthenticated={isAuthenticated} />} />
            <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/" replace />} />
            <Route path="/logistics-objects/create" element={isAuthenticated ? <CreateLogisticsObject /> : <Navigate to="/" replace />} />
            <Route path="/notifications" element={isAuthenticated ? <Notifications /> : <Navigate to="/" replace />} />
            <Route path="/subscriptions" element={isAuthenticated ? <Subscriptions /> : <Navigate to="/" replace />} />
            <Route path="/subscription-requests/:serverPort/:tenant/action-requests/:id" element={isAuthenticated ? <SubscriptionRequestView /> : <Navigate to="/" replace />} />
            <Route path="/changes" element={isAuthenticated ? <Changes /> : <Navigate to="/" replace />} />
            <Route path="/logistics-objects/:id" element={isAuthenticated ? <LogisticsObjectView /> : <Navigate to="/" replace />} />
            <Route path="/subscription-requests/:id" element={isAuthenticated ? <SubscriptionRequestView /> : <Navigate to="/" replace />} />
            <Route path="/external-subscription-requests/:serverId/:id" element={isAuthenticated ? <SubscriptionRequestView /> : <Navigate to="/" replace />} />
            <Route path="/changes-request/:id" element={isAuthenticated ? <ChangeRequestView /> : <Navigate to="/" replace />} />
          </Routes>
        </Box>
      </Box>
    </Router>
  );
}

export default App;
