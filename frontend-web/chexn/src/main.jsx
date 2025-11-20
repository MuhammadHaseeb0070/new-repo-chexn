import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import './index.css'
import App from './App.jsx'
import { STRIPE_PUBLIC_KEY, firebaseConfig } from './config.js'

const stripePromise = loadStripe(STRIPE_PUBLIC_KEY);

// Send Firebase config to service worker when it's ready
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then((registration) => {
    if (registration.active) {
      registration.active.postMessage({
        type: 'FIREBASE_CONFIG',
        config: firebaseConfig
      });
    }
  });
  
  // Also listen for when a new service worker becomes active
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    navigator.serviceWorker.controller?.postMessage({
      type: 'FIREBASE_CONFIG',
      config: firebaseConfig
    });
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Elements stripe={stripePromise}>
      <App />
    </Elements>
  </StrictMode>,
)
