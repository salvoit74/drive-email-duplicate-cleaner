import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId="97567018283-qhsa8t5j1s1ae563p0ae632dmrruqgeh.apps.googleusercontent.com">
      <App />
    </GoogleOAuthProvider>
  </StrictMode>
);

