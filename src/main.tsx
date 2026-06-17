import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress ResizeObserver "loop limit exceeded" and "loop completed with undelivered notifications" globally
const IGNORE_RESIZE_OBSERVER_TERMS = [
  'resizeobserver',
  'resize observer',
  'loop completed with undelivered notifications',
  'loop limit exceeded'
];

window.addEventListener('error', (event) => {
  if (event && event.message) {
    const lowerMsg = event.message.toLowerCase();
    if (IGNORE_RESIZE_OBSERVER_TERMS.some(term => lowerMsg.includes(term))) {
      event.stopImmediatePropagation();
      event.stopPropagation();
      console.warn('[ResizeObserver Suppressor] Stopped global error transmission:', event.message);
    }
  }
}, true); // capture=true executes before other listeners/framework boundaries

// Patch the ResizeObserver constructor directly to defer layout updates in requestAnimationFrame.
// This is an industry-standard solution for eliminating ResizeObserver loop warnings safely.
const OriginalResizeObserver = window.ResizeObserver;
if (OriginalResizeObserver) {
  window.ResizeObserver = class PatchedResizeObserver extends OriginalResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      super((entries, observer) => {
        window.requestAnimationFrame(() => {
          try {
            callback(entries, observer);
          } catch (err: any) {
            const errStr = String(err?.message || '');
            if (IGNORE_RESIZE_OBSERVER_TERMS.some(term => errStr.toLowerCase().includes(term))) {
              console.warn('[ResizeObserver Suppressor] Suppressed loop exception inside callback:', errStr);
            } else {
              throw err;
            }
          }
        });
      });
    }
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register service worker for PWA support on mobile and desktop
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.error('SW registration failed:', error);
      });
  });
}

