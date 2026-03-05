import React from 'react';
import { Alert, Button, Card, CardActions, CardContent, Stack, Typography } from '@mui/material';

export function LegacyAsrBridge() {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Legacy Baseline Bridge
        </Typography>
        <Stack spacing={1.5}>
          <Typography variant="body2">
            The current legacy implementation remains in <strong>legacy/asrRisk.html</strong> and is the reference for parity while React components are rebuilt.
          </Typography>
          <Alert severity="warning">
            Keep legacy behavior as source-of-truth until equivalent React flows exist and tests validate A/T/V/C + DLE/SLE calculations.
          </Alert>
        </Stack>
      </CardContent>
      <CardActions>
        <Button
          variant="outlined"
          component="a"
          href="../legacy/asrRisk.html"
          target="_blank"
          rel="noreferrer"
        >
          Open Legacy ASR
        </Button>
      </CardActions>
    </Card>
  );
}
