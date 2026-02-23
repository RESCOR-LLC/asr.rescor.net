import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Button,
  Card,
  CardContent,
  Grid,
  MenuItem,
  Slider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { computeThreatT } from '../../domain/stormRsk.js';
import { formatProbabilityAsPercent } from '../../domain/probabilityFormat.js';

const HISTORY_MARKS = [
  { value: 1, label: 'Improbable' },
  { value: 2, label: 'Remote' },
  { value: 3, label: 'Occasional' },
  { value: 4, label: 'Likely' },
  { value: 5, label: 'Continuous' }
];

const ACCESS_MARKS = [
  { value: 1, label: 'Outsider' },
  { value: 2, label: 'Insider' },
  { value: 3, label: 'Privileged' }
];

const MEANS_MARKS = [
  { value: 1, label: 'Individual' },
  { value: 2, label: 'Corporation' },
  { value: 3, label: 'Nation State' }
];

const THREAT_CATEGORIES = ['Human', 'Natural', 'Network', 'Technology', 'Physical', 'Other'];

function getThreatHam(threat) {
  return {
    history: Number.isInteger(threat.history) ? threat.history : 3,
    access: Number.isInteger(threat.access) ? threat.access : 1,
    means: Number.isInteger(threat.means) ? threat.means : 1
  };
}

function updateThreatById(threats, threatId, patch) {
  return threats.map((threat) => (threat.id === threatId ? { ...threat, ...patch } : threat));
}

function nextThreatId(threats) {
  const maxValue = threats.reduce((maxId, threat) => {
    const match = String(threat.id || '').match(/T-(\d+)/);
    if (!match) {
      return maxId;
    }

    return Math.max(maxId, Number(match[1]));
  }, 0);

  return `T-${String(maxValue + 1).padStart(3, '0')}`;
}

function deleteThreatReferences(graph, threatId) {
  const threats = graph.threats.filter((threat) => threat.id !== threatId);

  const links = {
    ...graph.links,
    assetThreat: graph.links.assetThreat.filter((link) => link.threatId !== threatId),
    threatVulnerability: graph.links.threatVulnerability.filter((link) => link.threatId !== threatId)
  };

  const controls = graph.controls.map((control) => ({
    ...control,
    appliesToThreatIds: Array.isArray(control.appliesToThreatIds)
      ? control.appliesToThreatIds.filter((id) => id !== threatId)
      : control.appliesToThreatIds,
    appliesToPairs: Array.isArray(control.appliesToPairs)
      ? control.appliesToPairs.filter((pair) => pair.threatId !== threatId)
      : control.appliesToPairs
  }));

  return {
    ...graph,
    threats,
    controls,
    links
  };
}

export function Ham533Workbench({ graph, onChangeGraph }) {
  const [selectedThreatId, setSelectedThreatId] = useState(() => graph.threats[0]?.id || null);

  useEffect(() => {
    if (!graph.threats.some((threat) => threat.id === selectedThreatId)) {
      setSelectedThreatId(graph.threats[0]?.id || null);
    }
  }, [graph.threats, selectedThreatId]);

  const selectedThreat = useMemo(
    () => graph.threats.find((threat) => threat.id === selectedThreatId) || graph.threats[0] || null,
    [graph.threats, selectedThreatId]
  );

  const selectedHam = selectedThreat ? getThreatHam(selectedThreat) : null;

  const handleHamChange = (field, value) => {
    if (!selectedThreat) {
      return;
    }

    const current = getThreatHam(selectedThreat);
    const next = {
      ...current,
      [field]: value
    };

    const calculated = computeThreatT(next);

    onChangeGraph({
      ...graph,
      threats: updateThreatById(graph.threats, selectedThreat.id, {
        ...next,
        probability: calculated.probability,
        impact: calculated.impact
      })
    });
  };

  const handleThreatMetadataChange = (patch) => {
    if (!selectedThreat) {
      return;
    }

    onChangeGraph({
      ...graph,
      threats: updateThreatById(graph.threats, selectedThreat.id, patch)
    });
  };

  const handleAddThreat = () => {
    const newThreat = {
      id: nextThreatId(graph.threats),
      name: 'New Threat',
      category: 'Other',
      history: 3,
      access: 1,
      means: 1,
      probability: computeThreatT({ history: 3, access: 1, means: 1 }).probability,
      impact: computeThreatT({ history: 3, access: 1, means: 1 }).impact
    };

    onChangeGraph({
      ...graph,
      threats: [...graph.threats, newThreat]
    });

    setSelectedThreatId(newThreat.id);
  };

  const handleDeleteSelectedThreat = () => {
    if (!selectedThreat) {
      return;
    }

    onChangeGraph(deleteThreatReferences(graph, selectedThreat.id));
  };

  return (
    <Card>
      <CardContent>
        <Stack spacing={1.5}>
          <Typography variant="h6">HAM533 Threat Workbench</Typography>
          <Typography variant="body2" color="text.secondary">
            Select a threat and adjust History (1..5), Access (1..3), and Means (1..3). Probability and Impact update live from HAM533.
          </Typography>

          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" onClick={handleAddThreat}>Add Threat</Button>
            <Button
              size="small"
              variant="outlined"
              color="warning"
              onClick={handleDeleteSelectedThreat}
              disabled={!selectedThreat}
            >
              Delete Selected
            </Button>
          </Stack>

          <Grid container spacing={2}>
            <Grid item xs={12} lg={7}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Threat</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell align="right">H</TableCell>
                      <TableCell align="right">A</TableCell>
                      <TableCell align="right">M</TableCell>
                      <TableCell align="right">Probability</TableCell>
                      <TableCell align="right">Impact</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {graph.threats.map((threat) => {
                      const ham = getThreatHam(threat);
                      const computed = computeThreatT(ham);
                      const isSelected = selectedThreat?.id === threat.id;

                      return (
                        <TableRow
                          key={threat.id}
                          hover
                          selected={isSelected}
                          onClick={() => setSelectedThreatId(threat.id)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell>{threat.name}</TableCell>
                          <TableCell>{threat.category || 'Other'}</TableCell>
                          <TableCell align="right">{ham.history}</TableCell>
                          <TableCell align="right">{ham.access}</TableCell>
                          <TableCell align="right">{ham.means}</TableCell>
                          <TableCell align="right">{formatProbabilityAsPercent(computed.probability)}</TableCell>
                          <TableCell align="right">{formatProbabilityAsPercent(computed.impact)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>

            <Grid item xs={12} lg={5}>
              {selectedThreat ? (
                <Stack spacing={2.25}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{selectedThreat.name}</Typography>

                  <TextField
                    size="small"
                    label="Description"
                    value={selectedThreat.name || ''}
                    onChange={(event) => handleThreatMetadataChange({ name: event.target.value })}
                  />

                  <TextField
                    size="small"
                    select
                    label="Category"
                    value={selectedThreat.category || 'Other'}
                    onChange={(event) => handleThreatMetadataChange({ category: event.target.value })}
                  >
                    {THREAT_CATEGORIES.map((category) => (
                      <MenuItem key={category} value={category}>{category}</MenuItem>
                    ))}
                  </TextField>

                  <Stack spacing={0.75}>
                    <Typography variant="caption" color="text.secondary">History</Typography>
                    <Slider
                      value={selectedHam.history}
                      min={1}
                      max={5}
                      step={1}
                      marks={HISTORY_MARKS}
                      onChange={(_, value) => handleHamChange('history', Number(value))}
                      valueLabelDisplay="auto"
                    />
                  </Stack>

                  <Stack spacing={0.75}>
                    <Typography variant="caption" color="text.secondary">Access</Typography>
                    <Slider
                      value={selectedHam.access}
                      min={1}
                      max={3}
                      step={1}
                      marks={ACCESS_MARKS}
                      onChange={(_, value) => handleHamChange('access', Number(value))}
                      valueLabelDisplay="auto"
                    />
                  </Stack>

                  <Stack spacing={0.75}>
                    <Typography variant="caption" color="text.secondary">Means</Typography>
                    <Slider
                      value={selectedHam.means}
                      min={1}
                      max={3}
                      step={1}
                      marks={MEANS_MARKS}
                      onChange={(_, value) => handleHamChange('means', Number(value))}
                      valueLabelDisplay="auto"
                    />
                  </Stack>
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">No threats available.</Typography>
              )}
            </Grid>
          </Grid>
        </Stack>
      </CardContent>
    </Card>
  );
}

Ham533Workbench.propTypes = {
  graph: PropTypes.shape({
    threats: PropTypes.array.isRequired
  }).isRequired,
  onChangeGraph: PropTypes.func.isRequired
};
