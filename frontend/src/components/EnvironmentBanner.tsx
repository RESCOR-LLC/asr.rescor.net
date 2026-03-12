import {
  FormControl,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';
import type { EnvironmentConfig, EnvironmentChoice } from '../lib/types';

// ════════════════════════════════════════════════════════════════════
// EnvironmentBanner
// ════════════════════════════════════════════════════════════════════
// Transcendental question — selects the application environment axis.

interface EnvironmentBannerProps {
  environment: EnvironmentConfig;
  selectedEnvironment: string | null;
  onEnvironmentChange: (choice: EnvironmentChoice) => void;
  disabled: boolean;
}

export default function EnvironmentBanner({
  environment,
  selectedEnvironment,
  onEnvironmentChange,
  disabled,
}: EnvironmentBannerProps) {
  const sorted = [...environment.choices].sort(
    (first, second) => first.sortOrder - second.sortOrder,
  );

  function handleChange(_event: React.ChangeEvent<HTMLInputElement>, value: string): void {
    const match = sorted.find((choice) => choice.environment === value);
    if (match) {
      onEnvironmentChange(match);
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
        {environment.text}
      </Typography>
      <FormControl component="fieldset" disabled={disabled}>
        <RadioGroup
          row
          value={selectedEnvironment ?? ''}
          onChange={handleChange}
        >
          {sorted.map((choice) => (
            <FormControlLabel
              key={choice.environment}
              value={choice.environment}
              control={<Radio size="small" />}
              label={choice.text}
            />
          ))}
        </RadioGroup>
      </FormControl>
    </Paper>
  );
}
