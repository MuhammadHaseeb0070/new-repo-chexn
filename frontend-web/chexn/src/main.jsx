import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import './index.css'
import App from './App.jsx'
import { STRIPE_PUBLIC_KEY } from './config.js'

const stripePromise = loadStripe(STRIPE_PUBLIC_KEY);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Elements stripe={stripePromise}>
      <App />
    </Elements>
  </StrictMode>,
)
