import React, { useMemo, useState } from 'react';
import {
  Alert,
  Card,
  CardContent,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { computeLossExpectancies } from '../../domain/lossExpectancy.js';
import { computeAssetShareA } from '../../domain/stormRsk.js';
import {
  formatProbabilityAsPercent,
  parsePercentListInput,
  percentInputToProbability,
  probabilityToPercentInput
} from '../../domain/probabilityFormat.js';

export function LossExpectancyCalculator() {
  const [assetValue, setAssetValue] = useState('10000');
  const [totalAssetValue, setTotalAssetValue] = useState('1000000');
  const [threatProbability, setThreatProbability] = useState(probabilityToPercentInput(0.22));
  const [vulnerabilitySeverity, setVulnerabilitySeverity] = useState(probabilityToPercentInput(0.48));
  const [controlEfficacy, setControlEfficacy] = useState(probabilityToPercentInput(0.35));
  const [controlEffectivesText, setControlEffectivesText] = useState(`${probabilityToPercentInput(0.30)}, ${probabilityToPercentInput(0.20)}`);

  const controlEffectives = useMemo(() => {
    return parsePercentListInput(controlEffectivesText);
  }, [controlEffectivesText]);

  const calculation = useMemo(() => {
    try {
      const hasTotalAssetValue = String(totalAssetValue).trim().length > 0;
      const resolvedA = hasTotalAssetValue
        ? computeAssetShareA({ assetValue, totalAssetValue })
        : Number(assetValue);

      const values = computeLossExpectancies({
        assetValue: resolvedA,
        threatProbability: percentInputToProbability(threatProbability),
        vulnerabilitySeverity: percentInputToProbability(vulnerabilitySeverity),
        controlEfficacy: percentInputToProbability(controlEfficacy),
        controlEffectives
      });

      return { values, error: null };
    } catch (error) {
      return {
        values: null,
        error: error.message || 'Unable to compute loss expectancy'
      };
    }
  }, [
    assetValue,
    totalAssetValue,
    threatProbability,
    vulnerabilitySeverity,
    controlEfficacy,
    controlEffectives
  ]);

  return (
    <Card>
      <CardContent>
        <Stack spacing={1.5}>
          <Typography variant="h6">Loss Expectancy Calculator</Typography>
          <Typography variant="body2" color="text.secondary">
            Formula baseline: SLE = A × 1 × V × (1 - C), DLE = A × T × V × (1 - C)
          </Typography>

          <Grid container spacing={1.5}>
            <Grid item xs={12} md={3}>
              <TextField
                label="Asset Value"
                fullWidth
                value={assetValue}
                onChange={(event) => setAssetValue(event.target.value)}
                helperText="Absolute value for the selected asset"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Total Asset Value"
                fullWidth
                value={totalAssetValue}
                onChange={(event) => setTotalAssetValue(event.target.value)}
                helperText="Portfolio total; A = asset/total"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="T (Threat Probability)"
                fullWidth
                value={threatProbability}
                onChange={(event) => setThreatProbability(event.target.value)}
                helperText="0..100 (%)"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="V (Vulnerability Severity)"
                fullWidth
                value={vulnerabilitySeverity}
                onChange={(event) => setVulnerabilitySeverity(event.target.value)}
                helperText="0..100 (%)"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="C (Control Efficacy)"
                fullWidth
                value={controlEfficacy}
                onChange={(event) => setControlEfficacy(event.target.value)}
                helperText="0..100 (%)"
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">
                Derived A (asset share): {calculation.values ? formatProbabilityAsPercent(calculation.values.A) : 'n/a'}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Control effectives (optional, comma-separated)"
                fullWidth
                value={controlEffectivesText}
                onChange={(event) => setControlEffectivesText(event.target.value)}
                helperText="When provided, C is derived using STORM/RSK diminishing returns (e.g. 30, 20, 10)."
              />
            </Grid>
          </Grid>

          <Divider />

          {calculation.error ? (
            <Alert severity="warning">{calculation.error}</Alert>
          ) : (
            <Grid container spacing={1.5}>
              <Grid item xs={12} md={6}>
                <Typography variant="caption" color="text.secondary">
                  Effective C: {formatProbabilityAsPercent(calculation.values.C)}
                </Typography>
                <br />
                <Typography variant="subtitle2" color="text.secondary">
                  SLE (Single Loss Expectancy)
                </Typography>
                <Typography variant="h6">
                  {calculation.values.SLE.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  DLE (Distributed Loss Expectancy)
                </Typography>
                <Typography variant="h6">
                  {calculation.values.DLE.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </Typography>
              </Grid>
            </Grid>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
