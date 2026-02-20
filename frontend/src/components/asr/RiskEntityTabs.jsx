import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Card,
  CardContent,
  TextField,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import {
  formatProbabilityAsPercent,
  percentInputToNormalizedProbability,
  probabilityToPercentInput
} from '../../domain/probabilityFormat.js';

function NameCell({ value, onChange }) {
  return (
    <TextField
      variant="standard"
      fullWidth
      value={value}
      onChange={(event) => onChange(event.target.value)}
      inputProps={{ 'aria-label': 'name' }}
    />
  );
}

function PercentCell({ value, onChange }) {
  const [draft, setDraft] = useState(probabilityToPercentInput(value));

  const parsed = Number(draft);
  const isNumeric = Number.isFinite(parsed);
  const isOutOfRange = isNumeric && (parsed < 0 || parsed > 100);
  const hasError = draft.trim().length > 0 && (!isNumeric || isOutOfRange);

  return (
    <TextField
      variant="standard"
      type="number"
      value={draft}
      onChange={(event) => {
        const nextDraft = event.target.value;
        setDraft(nextDraft);

        const next = percentInputToNormalizedProbability(nextDraft);
        if (Number.isFinite(next)) {
          onChange(next);
        }
      }}
      onBlur={() => {
        setDraft(probabilityToPercentInput(value));
      }}
      error={hasError}
      helperText={hasError ? 'Use 0..100' : ' '}
      inputProps={{
        min: 0,
        max: 100,
        step: 0.01,
        'aria-label': 'percent'
      }}
      sx={{ width: 110 }}
    />
  );
}

function updateRowById(rows, id, patch) {
  return rows.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

function AssetTable({ assets, onChange }) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Name</TableCell>
            <TableCell align="right">Asset Share</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {assets.map((item) => (
            <TableRow key={item.id} hover>
              <TableCell>{item.id}</TableCell>
              <TableCell>
                <NameCell
                  value={item.name}
                  onChange={(name) => onChange(updateRowById(assets, item.id, { name }))}
                />
              </TableCell>
              <TableCell align="right">
                <PercentCell
                  value={item.assetShare}
                  onChange={(assetShare) => onChange(updateRowById(assets, item.id, { assetShare }))}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function ThreatTable({ threats, onChange }) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Name</TableCell>
            <TableCell align="right">Probability</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {threats.map((item) => (
            <TableRow key={item.id} hover>
              <TableCell>{item.id}</TableCell>
              <TableCell>
                <NameCell
                  value={item.name}
                  onChange={(name) => onChange(updateRowById(threats, item.id, { name }))}
                />
              </TableCell>
              <TableCell align="right">
                <PercentCell
                  value={item.probability}
                  onChange={(probability) => onChange(updateRowById(threats, item.id, { probability }))}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function VulnerabilityTable({ vulnerabilities, onChange }) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Name</TableCell>
            <TableCell align="right">Severity</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {vulnerabilities.map((item) => (
            <TableRow key={item.id} hover>
              <TableCell>{item.id}</TableCell>
              <TableCell>
                <NameCell
                  value={item.name}
                  onChange={(name) => onChange(updateRowById(vulnerabilities, item.id, { name }))}
                />
              </TableCell>
              <TableCell align="right">
                <PercentCell
                  value={item.severity}
                  onChange={(severity) => onChange(updateRowById(vulnerabilities, item.id, { severity }))}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function ControlsTable({ controls, onChange }) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Name</TableCell>
            <TableCell align="right">Implemented</TableCell>
            <TableCell align="right">Correction</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {controls.map((item) => (
            <TableRow key={item.id} hover>
              <TableCell>{item.id}</TableCell>
              <TableCell>
                <NameCell
                  value={item.name}
                  onChange={(name) => onChange(updateRowById(controls, item.id, { name }))}
                />
              </TableCell>
              <TableCell align="right">
                <PercentCell
                  value={item.implemented}
                  onChange={(implemented) => onChange(updateRowById(controls, item.id, { implemented }))}
                />
              </TableCell>
              <TableCell align="right">
                <PercentCell
                  value={item.correction}
                  onChange={(correction) => onChange(updateRowById(controls, item.id, { correction }))}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function RiskEntityTabs({ graph, onChangeGraph }) {
  const [tab, setTab] = useState(0);

  const handleAssetsChange = (assets) => {
    onChangeGraph({ ...graph, assets });
  };

  const handleThreatsChange = (threats) => {
    onChangeGraph({ ...graph, threats });
  };

  const handleVulnerabilitiesChange = (vulnerabilities) => {
    onChangeGraph({ ...graph, vulnerabilities });
  };

  const handleControlsChange = (controls) => {
    onChangeGraph({ ...graph, controls });
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Risk Entities</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
          Edit names and percentage values directly. Probability-style values use 0..100 inputs with two-decimal precision.
        </Typography>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" allowScrollButtonsMobile>
          <Tab label="Assets" />
          <Tab label="Threats" />
          <Tab label="Vulnerabilities" />
          <Tab label="Controls" />
        </Tabs>

        {tab === 0 ? <AssetTable assets={graph.assets} onChange={handleAssetsChange} /> : null}
        {tab === 1 ? <ThreatTable threats={graph.threats} onChange={handleThreatsChange} /> : null}
        {tab === 2 ? <VulnerabilityTable vulnerabilities={graph.vulnerabilities} onChange={handleVulnerabilitiesChange} /> : null}
        {tab === 3 ? <ControlsTable controls={graph.controls} onChange={handleControlsChange} /> : null}
      </CardContent>
    </Card>
  );
}

RiskEntityTabs.propTypes = {
  graph: PropTypes.shape({
    assets: PropTypes.array.isRequired,
    threats: PropTypes.array.isRequired,
    vulnerabilities: PropTypes.array.isRequired,
    controls: PropTypes.array.isRequired
  }).isRequired,
  onChangeGraph: PropTypes.func.isRequired
};
