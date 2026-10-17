import React from 'react';
import { createRoot } from 'react-dom/client';
// Base styles first, so page and component styles can override them.
import './styles/tokens.css';
import './styles/global.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
