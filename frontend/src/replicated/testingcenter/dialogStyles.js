/**
 * REPLICATED (temporary) from:
 * testingcenter.rescor.net/src/frontend/src/utils/dialogStyles.js
 *
 * NOTE: Keep synced intentionally until moved to a shared package.
 * Track status in ../../../../docs/REPLICATION-LOG.md.
 */

export const getDialogActionButtonSx = ({ isMobile = false } = {}) => ({
  fontWeight: 600,
  textTransform: 'none',
  minHeight: isMobile ? 34 : 36,
  '&.Mui-disabled': {
    color: 'rgba(255, 255, 255, 0.45)',
    borderColor: 'rgba(255, 255, 255, 0.25)'
  }
});

export const getDialogPaperSx = ({ isDarkMode = false } = {}) => ({
  backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
  color: isDarkMode ? '#ffffff' : '#000000'
});
