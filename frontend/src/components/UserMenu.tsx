// ════════════════════════════════════════════════════════════════════
// UserMenu — displays authenticated user identity + sign-out action
// ════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { Avatar, Box, IconButton, Menu, MenuItem, Typography } from '@mui/material';
import { isMsalConfigured } from '../lib/authConfig';

export default function UserMenu() {
  const { instance } = useMsal();
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);

  const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0] ?? null;

  if (!isMsalConfigured || !account) {
    return null;
  }

  const displayName = account.name || account.username || 'User';
  const initials = displayName
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  function handleOpen(event: React.MouseEvent<HTMLElement>): void {
    setAnchorElement(event.currentTarget);
  }

  function handleClose(): void {
    setAnchorElement(null);
  }

  function handleSignOut(): void {
    handleClose();
    instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
      <Typography variant="body2" color="inherit" sx={{ mr: 1, opacity: 0.9, display: { xs: 'none', sm: 'block' } }}>
        {displayName}
      </Typography>
      <IconButton size="small" onClick={handleOpen} sx={{ color: 'inherit' }}>
        <Avatar sx={{ width: 32, height: 32, fontSize: '0.875rem', bgcolor: 'rgba(255,255,255,0.2)' }}>
          {initials}
        </Avatar>
      </IconButton>
      <Menu anchorEl={anchorElement} open={Boolean(anchorElement)} onClose={handleClose}>
        <MenuItem disabled>
          <Typography variant="body2" color="text.secondary">{account.username}</Typography>
        </MenuItem>
        <MenuItem onClick={handleSignOut}>Sign out</MenuItem>
      </Menu>
    </Box>
  );
}
