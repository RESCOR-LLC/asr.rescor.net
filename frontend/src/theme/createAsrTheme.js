import { createTheme } from '@mui/material/styles';

/**
 * REPLICATED (temporary): baseline theme adapted from
 * testingcenter.rescor.net/src/frontend/src/App.jsx.
 *
 * Track in docs/REPLICATION-LOG.md.
 */
export function createAsrTheme(mode = 'light') {
  const isDarkMode = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#1976d2'
      },
      secondary: {
        main: '#0097a7'
      },
      background: {
        default: isDarkMode ? '#121212' : '#f5f5f5',
        paper: isDarkMode ? '#1e1e1e' : '#ffffff'
      },
      text: {
        primary: isDarkMode ? '#f5f5f5' : '#111111',
        secondary: isDarkMode ? '#c9c9c9' : '#4f4f4f'
      }
    },
    typography: {
      fontFamily: 'Gotham, "Helvetica Neue", Helvetica, Arial, sans-serif',
      fontSize: 16,
      body1: {
        lineHeight: 'normal'
      }
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: isDarkMode ? '#121212' : '#f5f5f5',
            color: isDarkMode ? '#f5f5f5' : '#111111'
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none'
          }
        }
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            color: isDarkMode ? '#f2f2f2' : '#111111',
            borderColor: isDarkMode ? '#3b3b3b' : '#e0e0e0'
          }
        }
      }
    }
  });
}
