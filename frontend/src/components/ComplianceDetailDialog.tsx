import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '@mui/material';
import type { ComplianceRef } from '../lib/types';

// ════════════════════════════════════════════════════════════════════
// ComplianceDetailDialog
// ════════════════════════════════════════════════════════════════════
// Shows the description text for a compliance reference chip
// (e.g. NIST CSF subcategory definition, FERPA/SOX note text).

interface ComplianceDetailDialogProps {
  chip: ComplianceRef | null;
  onClose: () => void;
}

export default function ComplianceDetailDialog({ chip, onClose }: ComplianceDetailDialogProps) {
  const isOpen = chip != null && chip.action === 'dialog';

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
      {chip && (
        <>
          <DialogTitle>{chip.tag} {chip.code}</DialogTitle>
          <DialogContent dividers>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {chip.description || chip.tooltip || 'No description available.'}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Close</Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
