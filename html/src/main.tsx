import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/main.css';

// 在 production 使用 BrowserRouter；開發用 HashRouter（避免伺服器 fallback 問題）
// Provide a minimal `process` declaration for the browser to avoid needing @types/node
declare const process: { env: { NODE_ENV?: string } };
const Router = (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') ? BrowserRouter : HashRouter;

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
const isProd = (typeof process !== 'undefined' && process.env.NODE_ENV === 'production');
root.render(
  <React.StrictMode>
    {isProd ? (
      <BrowserRouter>
        <App />
      </BrowserRouter>
    ) : (
      <HashRouter>
        <App />
      </HashRouter>
    )}
  </React.StrictMode>
);