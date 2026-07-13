import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error',
  plugins: [
    base44({
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ],
  build: {
    // Increase chunk size warning threshold
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Manual chunk splitting — vendor libs into separate cacheable chunks
        manualChunks(id) {
          // React core — tiny, always needed
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/scheduler/')) {
            return 'react-core';
          }
          // Router
          if (id.includes('node_modules/react-router')) {
            return 'router';
          }
          // Radix UI components
          if (id.includes('node_modules/@radix-ui/')) {
            return 'radix-ui';
          }
          // Supabase client
          if (id.includes('node_modules/@supabase/')) {
            return 'supabase';
          }
          // TanStack Query
          if (id.includes('node_modules/@tanstack/')) {
            return 'query';
          }
          // Stripe
          if (id.includes('node_modules/@stripe/')) {
            return 'stripe';
          }
          // Lucide icons
          if (id.includes('node_modules/lucide-react')) {
            return 'icons';
          }
          // Other large node_modules
          if (id.includes('node_modules/')) {
            return 'vendor';
          }
        }
      }
    }
  }
});
