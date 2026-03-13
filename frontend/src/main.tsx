import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { MsalProvider } from '@azure/msal-react';
import { theme } from './theme/theme';
import { msalInstance } from './lib/authConfig';
import App from './App';

msalInstance.initialize().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <MsalProvider instance={msalInstance}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <App />
          </ThemeProvider>
        </MsalProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
});
