import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import * as amplitude from '@amplitude/analytics-browser';
import { sessionReplayPlugin } from '@amplitude/plugin-session-replay-browser';

amplitude.add(sessionReplayPlugin({ sampleRate: 1 }));
amplitude.init('d6b0c5838f2848aeb5f090043e673d4e', { autocapture: true, serverZone: 'EU' });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
