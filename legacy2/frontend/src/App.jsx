import React, { useEffect, useMemo, useState } from 'react';
import { CssBaseline, Container, Stack } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { createAsrTheme } from './theme/createAsrTheme.js';
import { AppShell } from './components/layout/AppShell.jsx';
import { RiskDimensionsPanel } from './components/asr/RiskDimensionsPanel.jsx';
import { Ham533Workbench } from './components/asr/Ham533Workbench.jsx';
import { LossExpectancyCalculator } from './components/asr/LossExpectancyCalculator.jsx';
import { RiskEntityTabs } from './components/asr/RiskEntityTabs.jsx';
import { LinkedRiskTable } from './components/asr/LinkedRiskTable.jsx';
import { LinkEditor } from './components/asr/LinkEditor.jsx';
import { LegacyAsrBridge } from './components/legacy/LegacyAsrBridge.jsx';
import { mockRiskGraph } from './data/mockRiskGraph.js';
import {
  cloneDefaultGraph,
  parseGraphJson,
  loadGraphFromStorage,
  saveGraphToStorage,
  serializeGraph
} from './domain/graphPersistence.js';
import { getGraphFromApi, putGraphToApi } from './services/graphApiClient.js';

export default function App() {
  const [mode, setMode] = useState('light');
  const [graph, setGraph] = useState(() => cloneDefaultGraph(mockRiskGraph));
  const [graphStatusMessage, setGraphStatusMessage] = useState('');
  const [graphLoaded, setGraphLoaded] = useState(false);

  const theme = useMemo(() => createAsrTheme(mode), [mode]);

  const handleToggleMode = () => {
    setMode((currentMode) => (currentMode === 'light' ? 'dark' : 'light'));
  };

  const handleExportGraph = () => {
    const json = serializeGraph(graph);
    const blob = new Blob([json], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `asr-risk-graph-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
    setGraphStatusMessage('Graph exported to JSON.');
  };

  const handleResetGraph = () => {
    setGraph(cloneDefaultGraph(mockRiskGraph));
    setGraphStatusMessage('Graph reset to defaults.');
  };

  const handleImportGraphFile = async (file) => {
    try {
      const text = await file.text();
      const parsed = parseGraphJson(text);
      setGraph(parsed);
      setGraphStatusMessage('Graph imported successfully.');
    } catch {
      setGraphStatusMessage('Import failed: invalid graph JSON structure.');
    }
  };

  useEffect(() => {
    async function loadInitialGraph() {
      const storage = typeof window === 'undefined' ? undefined : window.localStorage;
      const apiResult = await getGraphFromApi();

      if (apiResult.ok && apiResult.graph) {
        setGraph(apiResult.graph);
        setGraphStatusMessage('Graph loaded from API.');
        setGraphLoaded(true);
        return;
      }

      const loaded = loadGraphFromStorage(mockRiskGraph, storage);
      setGraph(loaded.graph);
      if (loaded.warning) {
        setGraphStatusMessage(loaded.warning);
      } else if (apiResult.notFound) {
        setGraphStatusMessage('API has no graph yet; using local/default graph.');
      } else {
        setGraphStatusMessage('API unavailable; using local/default graph.');
      }
      setGraphLoaded(true);
    }

    loadInitialGraph();
  }, []);

  useEffect(() => {
    if (!graphLoaded) {
      return;
    }

    const storage = typeof window === 'undefined' ? undefined : window.localStorage;

    async function persistGraph() {
      const apiSaved = await putGraphToApi(graph);

      if (!apiSaved) {
        saveGraphToStorage(graph, storage);
      }
    }

    persistGraph();
  }, [graph, graphLoaded]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppShell mode={mode} onToggleMode={handleToggleMode}>
        <Container maxWidth="lg" sx={{ py: 3 }}>
          <Stack spacing={2.5}>
            <RiskDimensionsPanel />
            <Ham533Workbench graph={graph} onChangeGraph={setGraph} />
            <LossExpectancyCalculator />
            <RiskEntityTabs graph={graph} onChangeGraph={setGraph} />
            <LinkEditor
              graph={graph}
              onChangeGraph={setGraph}
              onExportGraph={handleExportGraph}
              onResetGraph={handleResetGraph}
              onImportGraphFile={handleImportGraphFile}
              statusMessage={graphStatusMessage}
            />
            <LinkedRiskTable graph={graph} />
            <LegacyAsrBridge />
          </Stack>
        </Container>
      </AppShell>
    </ThemeProvider>
  );
}
