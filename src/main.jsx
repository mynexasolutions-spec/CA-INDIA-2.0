import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './auth/AuthContext.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import AdminSelectEnhancer from './components/AdminSelectEnhancer.jsx';
import DatePickerEnhancer from './components/DatePickerEnhancer.jsx';
import './index.css';
import './admin-select.css';
import './datepicker.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <AdminSelectEnhancer />
          <DatePickerEnhancer />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
