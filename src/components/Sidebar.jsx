import React, { useState, useEffect } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  IconButton,
  Divider,
  Typography,
  Select,
  MenuItem,
  FormControl,
  Avatar,
  Button
} from '@mui/material';
import {
  Storage as DatabaseIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  Send as SendIcon,
  ChevronLeft as ChevronLeftIcon,
  Menu as MenuIcon,
  Add as AddIcon,
  LocalShipping,
  Flight,
  Business,
  LocalPostOffice,
  AccountBalance,
  Logout as LogoutIcon,
  Login as LoginIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import Logo from './Logo'; // Import the Logo component
import { validateSettings } from '../utils/settingsValidator';
import { getAuthClient, logout, login, resetAuthClient } from '../auth/keycloak';
import { getCurrentRole, setCurrentRole } from '../utils/roleStorage';

const THEMES = {
  SHIPPER: { 
    color: '#2e7d32', // Green
    icon: <LocalShipping />, 
    label: 'Shipper',
    menuItemStyle: {
      backgroundColor: '#2e7d32',
      color: 'white',
      '&:hover': {
        backgroundColor: '#1b5e20'
      }
    }
  },
  FORWARDER: { 
    color: '#0288d1', // Blue
    icon: <Business />, 
    label: 'Forwarder',
    menuItemStyle: {
      backgroundColor: '#0288d1',
      color: 'white',
      '&:hover': {
        backgroundColor: '#01579b'
      }
    }
  },
  AIRLINE: { 
    color: '#d32f2f', // Red
    icon: <Flight />, 
    label: 'Airline',
    menuItemStyle: {
      backgroundColor: '#d32f2f',
      color: 'white',
      '&:hover': {
        backgroundColor: '#c62828'
      }
    }
  },
  POST: { 
    color: '#f57c00', // Orange
    icon: <LocalPostOffice />, 
    label: 'Post',
    menuItemStyle: {
      backgroundColor: '#f57c00',
      color: 'white',
      '&:hover': {
        backgroundColor: '#e65100'
      }
    }
  },
  CUSTOM: { 
    color: '#7b1fa2', // Purple
    icon: <AccountBalance />, 
    label: 'Custom',
    menuItemStyle: {
      backgroundColor: '#7b1fa2',
      color: 'white',
      '&:hover': {
        backgroundColor: '#6a1b9a'
      }
    }
  },
  CDMP_C: { 
    color: '#00897b', // Teal
    icon: <AccountBalance />, 
    label: 'cdmp-c',
    menuItemStyle: {
      backgroundColor: '#00897b',
      color: 'white',
      '&:hover': {
        backgroundColor: '#00695c'
      }
    }
  },
  CDMP_F: { 
    color: '#3949ab', // Indigo
    icon: <Business />, 
    label: 'cdmp-f',
    menuItemStyle: {
      backgroundColor: '#3949ab',
      color: 'white',
      '&:hover': {
        backgroundColor: '#283593'
      }
    }
  }
};

const Sidebar = ({ open, toggleDrawer, isAuthenticated = true }) => {
  // Initialize theme from localStorage or default to 'SHIPPER'
  const [selectedTheme, setSelectedTheme] = useState(() => 
    getCurrentRole()
  );
  const [settingsValid, setSettingsValid] = useState(false);
  const [authDisplayName, setAuthDisplayName] = useState('User');
  const [authUsername, setAuthUsername] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const { isValid } = validateSettings();
    setSettingsValid(isValid);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setAuthDisplayName('Guest');
      setAuthUsername('');
      return undefined;
    }

    const refreshAuthInfo = () => {
      try {
        const authClient = getAuthClient();
        const parsed = authClient.tokenParsed || {};
        const displayName = parsed.name || parsed.preferred_username || parsed.email || 'User';
        const username = parsed.preferred_username || parsed.email || '';

        setAuthDisplayName(displayName);
        setAuthUsername(username);
      } catch {
        setAuthDisplayName('User');
        setAuthUsername('');
      }
    };

    refreshAuthInfo();
    const interval = setInterval(() => {
      refreshAuthInfo();
    }, 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);
  const userInitial = (authDisplayName || 'U').trim().charAt(0).toUpperCase();

  const handleThemeChange = (event) => {
    const newTheme = event.target.value;
    if (newTheme === selectedTheme) {
      return;
    }

    setSelectedTheme(newTheme);
    setCurrentRole(newTheme);
    resetAuthClient();
    window.location.reload();
  };

  const handleAuthAction = async () => {
    try {
      if (isAuthenticated) {
        await logout();
        return;
      }
      await login();
    } catch (error) {
      console.error('Authentication action failed:', error);
    }
  };

  const menuItems = [
    { text: 'Database', icon: <DatabaseIcon />, path: '/' },
    ...(settingsValid ? [
      { text: 'Create Object', icon: <AddIcon />, path: '/logistics-objects/create', requiresAuth: true },
      { text: 'Subscriptions', icon: <SendIcon />, path: '/subscriptions', requiresAuth: true },
      { text: 'Subscription New', icon: <SendIcon />, path: '/subscriptions-new', requiresAuth: true },
    ] : []),
    { text: 'Notifications', icon: <NotificationsIcon />, path: '/notifications', requiresAuth: true },
    { text: 'Notifications New', icon: <NotificationsIcon />, path: '/notifications-new', requiresAuth: true },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings' }
  ];

  return (
    <Drawer
      variant="permanent"
      open={open}
      sx={{
        width: open ? 240 : 64,
        transition: 'width 0.2s ease-in-out',
        '& .MuiDrawer-paper': {
          width: open ? 240 : 64,
          transition: 'width 0.2s ease-in-out',
          overflowX: 'hidden',
          backgroundColor: THEMES[selectedTheme].color,
          color: 'white',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: open ? 'space-between' : 'center',
          p: 2,
          minHeight: 64
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          flex: 1,
          justifyContent: open ? 'flex-start' : 'center'
        }}>
          {open && (
            <>
              <Logo size={32} color="white" />
              <Typography 
                variant="h6" 
                noWrap 
                sx={{ 
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                  color: 'white'
                }}
              >
                ONE Record
              </Typography>
            </>
          )}
        </Box>
        <IconButton 
          onClick={toggleDrawer}
          sx={{ 
            color: 'white',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.08)'
            }
          }}
        >
          {open ? <ChevronLeftIcon /> : <MenuIcon />}
        </IconButton>
      </Box>
      
      <Divider sx={{ backgroundColor: 'rgba(255, 255, 255, 0.12)' }} />
      
      {open && (
        <Box sx={{ p: 2 }}>
          <FormControl fullWidth size="small">
            <Select
              value={selectedTheme}
              onChange={handleThemeChange}
              sx={{
                color: 'white',
                '.MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(255, 255, 255, 0.23)',
                  borderRadius: '8px',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(255, 255, 255, 0.87)',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'white',
                  borderWidth: '2px',
                },
                '& .MuiSvgIcon-root': {
                  color: 'white',
                },
                '& .MuiSelect-select': {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  py: 1,
                }
              }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    mt: 1,
                    backgroundColor: '#424242',
                    backgroundImage: 'none',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 20px 0 rgba(0,0,0,0.2)',
                  }
                }
              }}
            >
              {Object.entries(THEMES).map(([key, value]) => (
                <MenuItem 
                  key={key} 
                  value={key} 
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    py: 1.5,
                    mx: 0.5,
                    my: 0.25,
                    borderRadius: '6px',
                    transition: 'all 0.2s ease',
                    ...value.menuItemStyle,
                    '&.Mui-selected': {
                      ...value.menuItemStyle,
                      '&:hover': {
                        ...value.menuItemStyle['&:hover']
                      }
                    }
                  }}
                >
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    color: 'inherit'
                  }}>
                    {React.cloneElement(value.icon, { 
                      sx: { fontSize: 20 } 
                    })}
                  </Box>
                  <Typography sx={{ 
                    fontWeight: 500,
                    color: 'inherit'
                  }}>
                    {value.label}
                  </Typography>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <List>
          {menuItems.map((item) => {
            const disabled = Boolean(item.requiresAuth && !isAuthenticated);
            return (
            <ListItem 
              key={item.text} 
              disablePadding 
              sx={{ display: 'block' }}
            >
              <ListItemButton
                disabled={disabled}
                sx={{
                  minHeight: 48,
                  justifyContent: open ? 'initial' : 'center',
                  px: 2.5,
                  backgroundColor: 
                    location.pathname === item.path 
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'transparent',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.12)'
                  }
                }}
                onClick={() => {
                  if (!disabled) {
                    navigate(item.path);
                  }
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: open ? 2 : 'auto',
                    justifyContent: 'center',
                    color: 'white'
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text} 
                  sx={{ 
                    opacity: open ? 1 : 0,
                    '& .MuiListItemText-primary': {
                      color: 'white',
                      fontWeight: location.pathname === item.path ? 600 : 400
                    }
                  }} 
                />
              </ListItemButton>
            </ListItem>
            );
          })}
        </List>
      </Box>

      <Divider sx={{ backgroundColor: 'rgba(255, 255, 255, 0.12)' }} />
      <Box sx={{ p: open ? 1.5 : 0.75 }}>
        {open ? (
          <Box
            sx={{
              borderRadius: 2,
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              p: 1.5
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.25 }}>
              <Avatar sx={{ width: 36, height: 36, bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}>
                {userInitial}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'white' }} noWrap>
                  {authDisplayName}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }} noWrap>
                  {!isAuthenticated ? 'Not authenticated' : (authUsername ? `Logged as ${authUsername}` : 'Logged in')}
                </Typography>
              </Box>
            </Box>
            <Button
              fullWidth
              variant="outlined"
              startIcon={isAuthenticated ? <LogoutIcon /> : <LoginIcon />}
              onClick={handleAuthAction}
              sx={{
                color: 'white',
                borderColor: 'rgba(255,255,255,0.35)',
                '&:hover': {
                  borderColor: 'rgba(255,255,255,0.6)',
                  backgroundColor: 'rgba(255,255,255,0.12)'
                }
              }}
            >
              {isAuthenticated ? 'Sign Out' : 'Sign In'}
            </Button>
          </Box>
        ) : (
          <IconButton
            onClick={handleAuthAction}
            sx={{
              width: '100%',
              color: 'white',
              borderRadius: 1.5,
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.12)'
              }
            }}
            title={isAuthenticated ? `Logged as ${authUsername || authDisplayName}` : 'Sign in'}
          >
            {isAuthenticated ? <LogoutIcon /> : <LoginIcon />}
          </IconButton>
        )}
      </Box>
    </Drawer>
  );
};

export default Sidebar;
