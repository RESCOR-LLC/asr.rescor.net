import React, { useMemo, useState } from 'react';
import {
  Alert,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Typography
} from '@mui/material';
import { mockThreats } from '../../data/mockThreats.js';
import { validateThreatFilter } from '../../domain/validateThreatFilter.js';
import { formatProbabilityAsPercent } from '../../domain/probabilityFormat.js';

function compareValues(left, right, direction) {
  if (left < right) {
    return direction === 'asc' ? -1 : 1;
  }
  if (left > right) {
    return direction === 'asc' ? 1 : -1;
  }
  return 0;
}

/**
 * Replacement for legacy DataTables threat grid.
 *
 * This is intentionally implemented with React + MUI primitives
 * (search, sort, pagination) to remove jQuery/DataTables dependencies.
 */
export function ThreatRegistryTable() {
  const [filter, setFilter] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [orderBy, setOrderBy] = useState('probability');
  const [orderDirection, setOrderDirection] = useState('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const filteredRows = useMemo(() => {
    try {
      const normalizedFilter = validateThreatFilter(filter);
      setErrorMessage('');

      const filterNeedle = normalizedFilter.toLowerCase();

      const rows = mockThreats.filter((row) => {
        if (!filterNeedle) {
          return true;
        }

        return (
          row.id.toLowerCase().includes(filterNeedle) ||
          row.name.toLowerCase().includes(filterNeedle)
        );
      });

      rows.sort((a, b) => compareValues(a[orderBy], b[orderBy], orderDirection));
      return rows;
    } catch (error) {
      setErrorMessage(error.message || 'Invalid threat filter');
      return [...mockThreats].sort((a, b) => compareValues(a[orderBy], b[orderBy], orderDirection));
    }
  }, [filter, orderBy, orderDirection]);

  const pagedRows = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, page, rowsPerPage]);

  const handleSort = (column) => {
    if (orderBy === column) {
      setOrderDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setOrderBy(column);
    setOrderDirection('asc');
  };

  const handleFilterChange = (event) => {
    setFilter(event.target.value);
    setPage(0);
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(Number(event.target.value));
    setPage(0);
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Threat Registry (React/MUI Replacement)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Replaces legacy DataTables behavior with native React state + MUI table controls.
        </Typography>

        <TextField
          label="Search threats"
          value={filter}
          onChange={handleFilterChange}
          size="small"
          fullWidth
          sx={{ mb: 2 }}
          placeholder="Filter by id or threat description"
        />

        {errorMessage ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {errorMessage}
          </Alert>
        ) : null}

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Threat Description</TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={orderBy === 'probability'}
                    direction={orderDirection}
                    onClick={() => handleSort('probability')}
                  >
                    Probability
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={orderBy === 'impact'}
                    direction={orderDirection}
                    onClick={() => handleSort('impact')}
                  >
                    Impact
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pagedRows.map((row) => (
                <TableRow hover key={row.id}>
                  <TableCell>{row.id}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell align="right">{formatProbabilityAsPercent(row.probability)}</TableCell>
                  <TableCell align="right">{formatProbabilityAsPercent(row.impact)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={filteredRows.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[5, 10, 25]}
        />
      </CardContent>
    </Card>
  );
}
