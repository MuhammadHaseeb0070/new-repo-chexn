import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// Plugin to inject env vars into service worker during build
const serviceWorkerPlugin = () => {
  return {
    name: 'inject-sw-env',
    closeBundle() {
      // After build, modify the SW file in dist folder
      const distSwPath = join(process.cwd(), 'dist', 'firebase-messaging-sw.js')
      try {
        let swContent = readFileSync(distSwPath, 'utf-8')
        
        // Replace placeholders with env vars
        const firebaseConfig = {
          apiKey: process.env.VITE_FIREBASE_API_KEY || '',
          authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
          projectId: process.env.VITE_FIREBASE_PROJECT_ID || '',
          storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
          messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
          appId: process.env.VITE_FIREBASE_APP_ID || '',
          measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || '',
        }
        
        // Replace the firebaseConfig object in the SW file
        const configRegex = /let firebaseConfig = \{[\s\S]*?\};/
        const newConfig = `let firebaseConfig = ${JSON.stringify(firebaseConfig, null, 2)};`
        swContent = swContent.replace(configRegex, newConfig)
        
        // Write back to dist
        writeFileSync(distSwPath, swContent)
      } catch (error) {
        // File might not exist yet, that's okay
        console.warn('Could not update service worker with env vars:', error.message)
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serviceWorkerPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
      },
    },
  },
})
