import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import AdminApp from '../../admin/src/App.jsx';
import './styles.css';

registerSW({ immediate: true });
const RootApp = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/') ? AdminApp : App;
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><BrowserRouter><RootApp /></BrowserRouter></React.StrictMode>
);
