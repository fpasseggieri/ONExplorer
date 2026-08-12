import React from 'react';
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip
} from '@mui/material';
import {
  Computer as ComputerIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon
} from '@mui/icons-material';
import { useAppThemeMode } from '../theme/AppThemeProvider';

const ThemeModeToggle = () => {
  const { modePreference, setModePreference } = useAppThemeMode();

  return (
    <Box
      sx={(theme) => ({
        position: 'fixed',
        top: { xs: 8, sm: 12 },
        right: { xs: 8, sm: 16 },
        zIndex: theme.zIndex.drawer + 2,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: 2,
        overflow: 'hidden'
      })}
    >
      <ToggleButtonGroup
        exclusive
        size="small"
        value={modePreference}
        onChange={(event, value) => {
          if (value) {
            setModePreference(value);
          }
        }}
        aria-label="Appearance mode"
      >
        <ToggleButton value="system" aria-label="Use system appearance" sx={{ width: 40, height: 36, p: 0 }}>
          <Tooltip title="System">
            <ComputerIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="light" aria-label="Use light appearance" sx={{ width: 40, height: 36, p: 0 }}>
          <Tooltip title="Light">
            <LightModeIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="dark" aria-label="Use dark appearance" sx={{ width: 40, height: 36, p: 0 }}>
          <Tooltip title="Dark">
            <DarkModeIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
};

export default ThemeModeToggle;
