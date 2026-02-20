import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Card,
  CardContent,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import { generateLinkedRiskRows } from '../../domain/riskGraph.js';
import { formatProbabilityAsPercent } from '../../domain/probabilityFormat.js';

export function LinkedRiskTable({ graph }) {
  const rows = useMemo(() => generateLinkedRiskRows(graph), [graph]);

  return (
    <Card>
      <CardContent>
        <Stack spacing={1.25}>
          <Typography variant="h6">Linked Risk Table (Constrained Combinations)</Typography>
          <Typography variant="body2" color="text.secondary">
            Uses explicit A↔T↔V links plus control applicability to compute row-level residual SLE/DLE. This avoids full Cartesian risk generation.
          </Typography>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Asset</TableCell>
                  <TableCell>Threat</TableCell>
                  <TableCell>Vulnerability</TableCell>
                  <TableCell align="right">A</TableCell>
                  <TableCell align="right">T</TableCell>
                  <TableCell align="right">V</TableCell>
                  <TableCell align="right">C</TableCell>
                  <TableCell align="right">DLE</TableCell>
                  <TableCell align="right">SLE</TableCell>
                  <TableCell>Controls</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No linked rows. Add at least one compatible Asset↔Threat↔Vulnerability path.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((row) => (
                  <TableRow key={`${row.assetId}/${row.threatId}/${row.vulnerabilityId}`} hover>
                    <TableCell>{row.assetName}</TableCell>
                    <TableCell>{row.threatName}</TableCell>
                    <TableCell>{row.vulnerabilityName}</TableCell>
                    <TableCell align="right">{formatProbabilityAsPercent(row.A)}</TableCell>
                    <TableCell align="right">{formatProbabilityAsPercent(row.T)}</TableCell>
                    <TableCell align="right">{formatProbabilityAsPercent(row.V)}</TableCell>
                    <TableCell align="right">{formatProbabilityAsPercent(row.C)}</TableCell>
                    <TableCell align="right">{row.DLE.toFixed(6)}</TableCell>
                    <TableCell align="right">{row.SLE.toFixed(6)}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                        {row.controls.length === 0 ? (
                          <Chip label="None" size="small" variant="outlined" />
                        ) : (
                          row.controls.map((controlName) => (
                            <Chip key={controlName} label={controlName} size="small" variant="outlined" />
                          ))
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </CardContent>
    </Card>
  );
}

LinkedRiskTable.propTypes = {
  graph: PropTypes.shape({
    assets: PropTypes.array.isRequired,
    threats: PropTypes.array.isRequired,
    vulnerabilities: PropTypes.array.isRequired,
    controls: PropTypes.array.isRequired,
    links: PropTypes.shape({
      assetThreat: PropTypes.array.isRequired,
      assetVulnerability: PropTypes.array.isRequired,
      threatVulnerability: PropTypes.array.isRequired
    }).isRequired
  }).isRequired
};
