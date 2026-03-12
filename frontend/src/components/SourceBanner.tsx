import {
  FormControl,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';
import type { SourceConfig, SourceChoice } from '../lib/types';

// ════════════════════════════════════════════════════════════════════
// SourceBanner
// ════════════════════════════════════════════════════════════════════
// Transcendental question — selects the application source axis.

interface SourceBannerProps {
  source: SourceConfig;
  selectedSource: string | null;
  onSourceChange: (choice: SourceChoice) => void;
  disabled: boolean;
}

export default function SourceBanner({
  source,
  selectedSource,
  onSourceChange,
  disabled,
}: SourceBannerProps) {
  const sorted = [...source.choices].sort(
    (first, second) => first.sortOrder - second.sortOrder,
  );

  function handleChange(_event: React.ChangeEvent<HTMLInputElement>, value: string): void {
    const match = sorted.find((choice) => choice.source === value);
    if (match) {
      onSourceChange(match);
    }
  }

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        mb: 3,
        borderLeft: 4,
        borderColor: 'secondary.main',
        backgroundColor: 'grey.50',
      }}
    >
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        {source.text}
      </Typography>
      <FormControl component="fieldset" disabled={disabled}>
        <RadioGroup
          row
          value={selectedSource ?? ''}
          onChange={handleChange}
        >
          {sorted.map((choice) => (
            <FormControlLabel
              key={choice.source}
              value={choice.source}
              control={<Radio size="small" />}
              label={choice.text}
            />
          ))}
        </RadioGroup>
      </FormControl>
    </Paper>
  );
}
