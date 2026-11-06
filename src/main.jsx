import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Overview from './components/Overview.jsx';
import { client } from './lib/ads';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {client.overview ? <Overview /> : <App />}
  </StrictMode>
);
