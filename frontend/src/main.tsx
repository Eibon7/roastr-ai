import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Initialize Amplitude Analytics (client-side only)
import { initializeAmplitude } from './lib/analytics-identity';

// Initialize Amplitude before rendering the app
initializeAmplitude();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
