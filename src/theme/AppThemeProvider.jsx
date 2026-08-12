import React, { createContext, useContext, useMemo, useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

const THEME_MODE_STORAGE_KEY = 'themeMode';
const THEME_MODE_OPTIONS = ['system', 'light', 'dark'];

const ThemeModeContext = createContext({
  modePreference: 'system',
  resolvedMode: 'light',
  setModePreference: () => {}
});

const normalizeModePreference = (value) => (
  THEME_MODE_OPTIONS.includes(value) ? value : 'system'
);

const getStoredModePreference = () => {
  if (typeof window === 'undefined') {
    return 'system';
  }

  try {
    return normalizeModePreference(window.localStorage.getItem(THEME_MODE_STORAGE_KEY));
  } catch {
    return 'system';
  }
};

const persistModePreference = (value) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, value);
  } catch (error) {
    console.error('Failed to persist theme mode:', error);
  }
};

const AppThemeProvider = ({ children }) => {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  const [modePreference, setModePreferenceState] = useState(() => getStoredModePreference());
  const resolvedMode = modePreference === 'system'
    ? (prefersDarkMode ? 'dark' : 'light')
    : modePreference;

  const setModePreference = (nextMode) => {
    const normalizedMode = normalizeModePreference(nextMode);
    setModePreferenceState(normalizedMode);
    persistModePreference(normalizedMode);
  };

  const theme = useMemo(() => createTheme({
    palette: {
      mode: resolvedMode,
      ...(resolvedMode === 'dark' ? {
        background: {
          default: '#101418',
          paper: '#171c22'
        }
      } : {})
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none'
          }
        }
      },
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            minHeight: '100vh'
          }
        }
      }
    }
  }), [resolvedMode]);

  const contextValue = useMemo(() => ({
    modePreference,
    resolvedMode,
    setModePreference
  }), [modePreference, resolvedMode]);

  return (
    <ThemeModeContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
};

export const useAppThemeMode = () => useContext(ThemeModeContext);

export default AppThemeProvider;
