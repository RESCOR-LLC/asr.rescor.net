import React, { useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Checkbox,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';

function getPairKey(leftId, rightId) {
  return `${leftId}::${rightId}`;
}

function LinkMatrix({ title, description, leftItems, rightItems, linkPairs, onToggle }) {
  const linkSet = useMemo(() => {
    return new Set(linkPairs.map(({ leftId, rightId }) => getPairKey(leftId, rightId)));
  }, [linkPairs]);

  return (
    <Stack spacing={0.75}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{title}</Typography>
      <Typography variant="body2" color="text.secondary">{description}</Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell />
              {rightItems.map((item) => (
                <TableCell key={item.id} align="center">{item.name}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {leftItems.map((leftItem) => (
              <TableRow key={leftItem.id} hover>
                <TableCell sx={{ fontWeight: 500 }}>{leftItem.name}</TableCell>
                {rightItems.map((rightItem) => {
                  const key = getPairKey(leftItem.id, rightItem.id);
                  const checked = linkSet.has(key);

                  return (
                    <TableCell key={key} align="center">
                      <Checkbox
                        size="small"
                        checked={checked}
                        onChange={() => onToggle(leftItem.id, rightItem.id)}
                        inputProps={{ 'aria-label': `toggle ${leftItem.name} to ${rightItem.name}` }}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

LinkMatrix.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  leftItems: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string.isRequired, name: PropTypes.string.isRequired })).isRequired,
  rightItems: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string.isRequired, name: PropTypes.string.isRequired })).isRequired,
  linkPairs: PropTypes.arrayOf(PropTypes.shape({ leftId: PropTypes.string.isRequired, rightId: PropTypes.string.isRequired })).isRequired,
  onToggle: PropTypes.func.isRequired
};

function togglePair(links, leftKey, rightKey, leftId, rightId) {
  const nextLinks = links.filter((item) => !(item[leftKey] === leftId && item[rightKey] === rightId));
  const exists = nextLinks.length !== links.length;

  if (exists) {
    return nextLinks;
  }

  return [...links, { [leftKey]: leftId, [rightKey]: rightId }];
}

export function LinkEditor({
  graph,
  onChangeGraph,
  onExportGraph,
  onResetGraph,
  onImportGraphFile,
  statusMessage
}) {
  const fileInputRef = useRef(null);

  const assetThreatPairs = useMemo(
    () => graph.links.assetThreat.map((item) => ({ leftId: item.assetId, rightId: item.threatId })),
    [graph]
  );

  const assetVulnerabilityPairs = useMemo(
    () => graph.links.assetVulnerability.map((item) => ({ leftId: item.assetId, rightId: item.vulnerabilityId })),
    [graph]
  );

  const threatVulnerabilityPairs = useMemo(
    () => graph.links.threatVulnerability.map((item) => ({ leftId: item.threatId, rightId: item.vulnerabilityId })),
    [graph]
  );

  const updateLinks = (relationshipName, leftKey, rightKey, leftId, rightId) => {
    onChangeGraph({
      ...graph,
      links: {
        ...graph.links,
        [relationshipName]: togglePair(graph.links[relationshipName], leftKey, rightKey, leftId, rightId)
      }
    });
  };

  const handleChooseImportFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelection = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    await onImportGraphFile(file);
    event.target.value = '';
  };

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6">Link Editor</Typography>
          <Typography variant="body2" color="text.secondary">
            Edit relationship constraints used by linked risk generation. Changes immediately update the linked risk table.
          </Typography>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Button size="small" variant="outlined" onClick={handleChooseImportFile}>Import JSON</Button>
            <Button size="small" variant="outlined" onClick={onExportGraph}>Export JSON</Button>
            <Button size="small" variant="text" color="warning" onClick={onResetGraph}>Reset Defaults</Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileSelection}
              style={{ display: 'none' }}
            />
          </Stack>

          {statusMessage ? <Alert severity="info">{statusMessage}</Alert> : null}

          <Divider />

          <LinkMatrix
            title="Asset ↔ Threat"
            description="Defines which threats are relevant for each asset."
            leftItems={graph.assets}
            rightItems={graph.threats}
            linkPairs={assetThreatPairs}
            onToggle={(assetId, threatId) => updateLinks('assetThreat', 'assetId', 'threatId', assetId, threatId)}
          />

          <LinkMatrix
            title="Asset ↔ Vulnerability"
            description="Defines which vulnerabilities are present on each asset."
            leftItems={graph.assets}
            rightItems={graph.vulnerabilities}
            linkPairs={assetVulnerabilityPairs}
            onToggle={(assetId, vulnerabilityId) => updateLinks('assetVulnerability', 'assetId', 'vulnerabilityId', assetId, vulnerabilityId)}
          />

          <LinkMatrix
            title="Threat ↔ Vulnerability"
            description="Defines which vulnerabilities can be exploited by each threat."
            leftItems={graph.threats}
            rightItems={graph.vulnerabilities}
            linkPairs={threatVulnerabilityPairs}
            onToggle={(threatId, vulnerabilityId) => updateLinks('threatVulnerability', 'threatId', 'vulnerabilityId', threatId, vulnerabilityId)}
          />
        </Stack>
      </CardContent>
    </Card>
  );
}

LinkEditor.propTypes = {
  graph: PropTypes.shape({
    assets: PropTypes.array.isRequired,
    threats: PropTypes.array.isRequired,
    vulnerabilities: PropTypes.array.isRequired,
    links: PropTypes.shape({
      assetThreat: PropTypes.array.isRequired,
      assetVulnerability: PropTypes.array.isRequired,
      threatVulnerability: PropTypes.array.isRequired
    }).isRequired
  }).isRequired,
  onChangeGraph: PropTypes.func.isRequired,
  onExportGraph: PropTypes.func.isRequired,
  onResetGraph: PropTypes.func.isRequired,
  onImportGraphFile: PropTypes.func.isRequired,
  statusMessage: PropTypes.string
};
