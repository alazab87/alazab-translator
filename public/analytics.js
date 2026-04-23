// Vercel Web Analytics
// This script loads and initializes Vercel Web Analytics
// The analytics package will automatically track page views
import { inject } from 'https://cdn.jsdelivr.net/npm/@vercel/analytics@2.0.1/+esm';

// Initialize analytics with auto mode (production on Vercel, development locally)
inject({ mode: 'auto' });
