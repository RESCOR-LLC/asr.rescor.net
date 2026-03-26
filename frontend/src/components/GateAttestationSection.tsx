import { useCallback, useEffect, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import GavelIcon from '@mui/icons-material/Gavel';
import SaveIcon from '@mui/icons-material/Save';
import {
  answerGate,
  clearGate,
  fetchGateAnswers,
} from '../lib/apiClient';
import type { GateWithAnswer } from '../lib/types';

// ════════════════════════════════════════════════════════════════════
// GateAttestationSection
// ════════════════════════════════════════════════════════════════════
// Collapsible section shown above domain questions in the Assessment
// tab. Allows functional-authority attestations that pre-fill
// downstream answers.

const FUNCTION_COLORS: Record<string, string> = {
  LEGAL: '#7B1FA2',
  SEPG: '#1565C0',
  EA: '#00695C',
  SAE: '#E65100',
  ERM: '#4E342E',
};

interface GateAttestationSectionProps {
  reviewId: string;
  disabled: boolean;
  onPreFill: () => void;
}

export default function GateAttestationSection({
  reviewId,
  disabled,
  onPreFill,
}: GateAttestationSectionProps) {
  const [gates, setGates] = useState<GateWithAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local choice state per gate (before save)
  const [localChoices, setLocalChoices] = useState<Record<string, number | null>>({});
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [savingGate, setSavingGate] = useState<string | null>(null);

  const loadGates = useCallback(async () => {
    try {
      const data = await fetchGateAnswers(reviewId);
      setGates(data);
      return data;
    } catch (thrownError) {
      setError((thrownError as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [reviewId]);

  // Seed local state from server on initial load only
  useEffect(() => {
    loadGates().then((data) => {
      if (!data) return;
      const choices: Record<string, number | null> = {};
      const notes: Record<string, string> = {};
      for (const gate of data) {
        choices[gate.gateId] = gate.answer?.choiceIndex ?? null;
        notes[gate.gateId] = gate.answer?.evidenceNotes ?? '';
      }
      setLocalChoices(choices);
      setLocalNotes(notes);
    });
  }, [loadGates]);

  async function handleSaveGate(gateId: string): Promise<void> {
    const choiceIndex = localChoices[gateId];
    if (choiceIndex == null) return;

    setSavingGate(gateId);
    try {
      await answerGate(reviewId, gateId, choiceIndex, localNotes[gateId] || '');
      await loadGates(); // refreshes server state without touching localChoices
      onPreFill();
    } catch (thrownError) {
      setError((thrownError as Error).message);
    } finally {
      setSavingGate(null);
    }
  }

  async function handleClearGate(gateId: string): Promise<void> {
    setSavingGate(gateId);
    try {
      await clearGate(reviewId, gateId);
      setLocalChoices((previous) => ({ ...previous, [gateId]: null }));
      setLocalNotes((previous) => ({ ...previous, [gateId]: '' }));
      await loadGates(); // refreshes server state without touching localChoices
      onPreFill();
    } catch (thrownError) {
      setError((thrownError as Error).message);
    } finally {
      setSavingGate(null);
    }
  }

  if (loading || gates.length === 0) return null;

  const answeredCount = gates.filter((gate) => gate.answer !== null).length;

  return (
    <Accordion
      expanded={expanded}
      onChange={(_event, isExpanded) => setExpanded(isExpanded)}
      sx={{ mb: 2 }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ width: '100%' }}>
          <GavelIcon fontSize="small" color="primary" />
          <Typography fontWeight={600}>Preliminary Attestations</Typography>
          <Chip
            label={`${answeredCount}/${gates.length}`}
            size="small"
            color={answeredCount === gates.length ? 'success' : 'default'}
          />
          <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto !important', mr: 1 }}>
            Functional-authority attestations pre-fill downstream questions
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        {error && (
          <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {gates.map((gate) => {
          const isAnswered = gate.answer !== null;
          const localChoice = localChoices[gate.gateId];
          const isSaving = savingGate === gate.gateId;
          const isDirty = localChoice !== (gate.answer?.choiceIndex ?? null)
            || (localNotes[gate.gateId] || '') !== (gate.answer?.evidenceNotes ?? '');
          const functionColor = FUNCTION_COLORS[gate.function] || '#546E7A';

          return (
            <Card key={gate.gateId} variant="outlined" sx={{ mb: 1.5 }}>
              <CardContent sx={{ pb: '12px !important' }}>
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                  <Chip
                    label={gate.function}
                    size="small"
                    sx={{ mr: 1, bgcolor: functionColor, color: '#fff', fontWeight: 600, fontSize: '0.7rem' }}
                  />
                  <Typography variant="body2" sx={{ flex: 1 }} fontWeight={500}>
                    {gate.text}
                  </Typography>
                  {isAnswered && (
                    <Chip
                      label={`Answered: ${gate.choices[gate.answer!.choiceIndex]}`}
                      size="small"
                      color="success"
                      variant="outlined"
                      sx={{ ml: 1, flexShrink: 0 }}
                    />
                  )}
                </Box>

                {/* Choices */}
                <RadioGroup
                  value={localChoice != null ? String(localChoice) : ''}
                  onChange={(_event, value) =>
                    setLocalChoices((previous) => ({ ...previous, [gate.gateId]: parseInt(value, 10) }))
                  }
                >
                  {gate.choices.map((choice, index) => (
                    <FormControlLabel
                      key={index}
                      value={String(index)}
                      disabled={disabled || isSaving}
                      control={<Radio size="small" sx={{ py: 0.25 }} />}
                      label={<Typography variant="body2">{choice}</Typography>}
                      sx={{ mx: 0, ml: 4 }}
                    />
                  ))}
                </RadioGroup>

                {/* Evidence notes */}
                <TextField
                  size="small"
                  placeholder="Evidence notes (optional)"
                  value={localNotes[gate.gateId] || ''}
                  onChange={(event) =>
                    setLocalNotes((previous) => ({ ...previous, [gate.gateId]: event.target.value }))
                  }
                  disabled={disabled || isSaving}
                  fullWidth
                  multiline
                  maxRows={3}
                  sx={{ mt: 1, ml: 4, width: 'calc(100% - 32px)' }}
                  slotProps={{ input: { sx: { fontSize: '0.8rem' } } }}
                />

                {/* Action buttons */}
                {!disabled && (
                  <Stack direction="row" spacing={1} sx={{ mt: 1, ml: 4 }}>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<SaveIcon />}
                      onClick={() => handleSaveGate(gate.gateId)}
                      disabled={localChoice == null || isSaving || !isDirty}
                    >
                      {isAnswered ? 'Update' : 'Save & Pre-fill'}
                    </Button>
                    {isAnswered && (
                      <Tooltip title="Clear attestation and undo pre-filled answers">
                        <Button
                          size="small"
                          color="warning"
                          startIcon={<ClearIcon />}
                          onClick={() => handleClearGate(gate.gateId)}
                          disabled={isSaving}
                        >
                          Clear
                        </Button>
                      </Tooltip>
                    )}
                  </Stack>
                )}

                {/* Respondent info */}
                {isAnswered && gate.answer!.respondedBy && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, ml: 4 }}>
                    Attested by {gate.answer!.respondedBy}
                    {gate.answer!.respondedAt ? ` on ${new Date(gate.answer!.respondedAt).toLocaleDateString()}` : ''}
                  </Typography>
                )}
              </CardContent>
            </Card>
          );
        })}
      </AccordionDetails>
    </Accordion>
  );
}
