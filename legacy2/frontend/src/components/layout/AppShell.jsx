import React from 'react';
import PropTypes from 'prop-types';
import { AppBar, Box, Chip, Toolbar, Typography } from '@mui/material';
import IconButton from '@mui/material/IconButton';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';

export function AppShell({ children, mode, onToggleMode }) {
  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar sx={{ gap: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Application Security Review
          </Typography>
          <Chip label="ASR" size="small" color="primary" />
          <Chip label="Adjunct to Testing Center" size="small" variant="outlined" />
          <IconButton
            color="inherit"
            onClick={onToggleMode}
            aria-label="toggle dark mode"
            size="large"
          >
            {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
        </Toolbar>
      </AppBar>
      {children}
    </Box>
  );
}

AppShell.propTypes = {
  children: PropTypes.node.isRequired,
  mode: PropTypes.oneOf(['light', 'dark']).isRequired,
  onToggleMode: PropTypes.func.isRequired
};
