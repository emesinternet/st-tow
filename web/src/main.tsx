import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { preloadAppImages } from './lib/preloadImages';
import './styles/globals.css';

preloadAppImages();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
