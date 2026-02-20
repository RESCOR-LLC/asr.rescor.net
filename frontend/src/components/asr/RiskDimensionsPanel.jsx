import React from 'react';
import { Alert, Card, CardContent, Grid, List, ListItem, ListItemText, Typography } from '@mui/material';

const dimensions = [
  {
    title: 'Asset Value (A)',
    detail: 'Business criticality and data valuation inputs.'
  },
  {
    title: 'Threat Assessment (T)',
    detail: 'Probability and impact by threat characteristics.'
  },
  {
    title: 'Vulnerability Assessment (V)',
    detail: 'Exposure and exploitability factors.'
  },
  {
    title: 'Control Assessment (C)',
    detail: 'Control efficacy and mitigation coverage.'
  }
];

export function RiskDimensionsPanel() {
  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          ASR Risk Model Focus
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          This workflow extends vulnerability severity with A/T/V/C dimensions and DLE/SLE aggregation paths from legacy STORM behavior.
        </Alert>
        <Grid container spacing={2}>
          {dimensions.map((item) => (
            <Grid item xs={12} md={6} key={item.title}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.detail}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
        <List dense sx={{ mt: 1 }}>
          <ListItem>
            <ListItemText primary="Legacy references: StackMap.js and STORM.js" secondary="Used as the behavioral baseline while extracting modern domain logic." />
          </ListItem>
          <ListItem>
            <ListItemText primary="Replication strategy" secondary="Temporary duplicated patterns are logged for later cross-project abstraction." />
          </ListItem>
        </List>
      </CardContent>
    </Card>
  );
}
