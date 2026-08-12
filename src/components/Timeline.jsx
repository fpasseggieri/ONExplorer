import React from 'react';
import { Box } from '@mui/material';

export const Timeline = ({ children, sx, ...props }) => (
  <Box
    component="ul"
    sx={{ listStyle: 'none', m: 0, p: 0, ...sx }}
    {...props}
  >
    {children}
  </Box>
);

export const TimelineItem = ({ children, sx, ...props }) => (
  <Box
    component="li"
    sx={{
      display: 'grid',
      gridTemplateColumns: {
        xs: 'minmax(90px, 26%) 32px minmax(0, 1fr)',
        sm: 'minmax(140px, 24%) 40px minmax(0, 1fr)'
      },
      alignItems: 'stretch',
      minHeight: 72,
      '&:last-of-type .timeline-connector': { visibility: 'hidden' },
      ...sx
    }}
    {...props}
  >
    {children}
  </Box>
);

export const TimelineOppositeContent = ({ children, sx, ...props }) => (
  <Box sx={{ textAlign: 'right', py: 1.5, pr: 1.5, ...sx }} {...props}>
    {children}
  </Box>
);

export const TimelineSeparator = ({ children, sx, ...props }) => (
  <Box
    sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', ...sx }}
    {...props}
  >
    {children}
  </Box>
);

export const TimelineDot = ({ children, color = 'primary', sx, ...props }) => {
  const hasContent = React.Children.count(children) > 0;

  return (
    <Box
      sx={{
        width: hasContent ? 36 : 12,
        height: hasContent ? 36 : 12,
        mt: hasContent ? 0.75 : 1.5,
        borderRadius: '50%',
        bgcolor: (theme) => theme.palette[color]?.main || theme.palette.info.main,
        color: (theme) => theme.palette[color]?.contrastText || theme.palette.info.contrastText,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: 1,
        '& .MuiSvgIcon-root': { fontSize: 20 },
        ...sx
      }}
      {...props}
    >
      {children}
    </Box>
  );
};

export const TimelineConnector = ({ sx, ...props }) => (
  <Box
    className="timeline-connector"
    sx={{ width: 2, flex: 1, minHeight: 24, bgcolor: 'divider', ...sx }}
    {...props}
  />
);

export const TimelineContent = ({ children, sx, ...props }) => (
  <Box sx={{ minWidth: 0, py: 1.5, pl: 1.5, ...sx }} {...props}>
    {children}
  </Box>
);
