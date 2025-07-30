#!/usr/bin/env node

const fs = require('fs');

// Get environment variables and trim any whitespace/newlines
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
const API_KEY = (process.env.API_KEY || '').trim();
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();

console.log('Environment variables loaded for Vercel:');
console.log('OPENAI_API_KEY:', OPENAI_API_KEY ? `${OPENAI_API_KEY.substring(0, 10)}...` : 'NOT SET');
console.log('API_KEY:', API_KEY ? `${API_KEY.substring(0, 10)}...` : 'NOT SET');
console.log('SUPABASE_URL:', SUPABASE_URL || 'NOT SET');
console.log('SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? `${SUPABASE_ANON_KEY.substring(0, 20)}...` : 'NOT SET');

// Use esbuild API directly to avoid shell escaping issues
async function build() {
  const esbuild = require('esbuild');
  
  console.log('Building with esbuild API...');
  
  await esbuild.build({
    entryPoints: ['index.tsx'],
    bundle: true,
    outfile: 'dist/index.js',
    format: 'iife',
    loader: { '.tsx': 'tsx' },
    define: {
      'process.env.OPENAI_API_KEY': JSON.stringify(OPENAI_API_KEY),
      'process.env.API_KEY': JSON.stringify(API_KEY),
      'process.env.SUPABASE_URL': JSON.stringify(SUPABASE_URL),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(SUPABASE_ANON_KEY)
    }
  });
}

// Run the build
build().then(() => {
  console.log('Creating public directory...');
  if (!fs.existsSync('public')) {
    fs.mkdirSync('public');
  }

  console.log('Copying files...');
  fs.copyFileSync('index.html', 'public/index.html');
  fs.copyFileSync('index.css', 'public/index.css');

  // Copy dist directory
  if (!fs.existsSync('public/dist')) {
    fs.mkdirSync('public/dist');
  }
  fs.copyFileSync('dist/index.js', 'public/dist/index.js');

  console.log('Build completed successfully!');
}).catch(console.error);