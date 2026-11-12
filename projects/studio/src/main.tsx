import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { scenarios } from './content/scenarios';
import { validateScenario } from './engine/validate';
import './index.css';
import * as actions from './runtime/actions';
import { C } from './runtime/clock';
import { useStore } from './runtime/store';

if (import.meta.env.DEV) for (const sc of scenarios) {
  const errors = validateScenario(sc);
  if (errors.length) console.error(`[${sc.id}] escenario inválido`, errors);
}

// dev handle for scripted checks: __studio.actions.seek(ms)
if (import.meta.env.DEV) Object.assign(window, { __studio: { actions, C, store: useStore } });

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
