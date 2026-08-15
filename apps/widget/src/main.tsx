import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WidgetRoot } from './app';
import './styles.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Widget root element is missing');
}

createRoot(root).render(
  <StrictMode>
    <WidgetRoot />
  </StrictMode>,
);
