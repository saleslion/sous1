#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

// Get environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const API_KEY = process.env.API_KEY || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

// Build command with proper JSON escaping
const buildCmd = [
  'npx esbuild index.tsx',
  '--bundle',
  '--outfile=dist/index.js',
  '--format=iife',
  '--loader:.tsx=ts',
  `--define:process.env.OPENAI_API_KEY=${JSON.stringify(OPENAI_API_KEY)}`,
  `--define:process.env.API_KEY=${JSON.stringify(API_KEY)}`,
  `--define:process.env.SUPABASE_URL=${JSON.stringify(SUPABASE_URL)}`,
  `--define:process.env.SUPABASE_ANON_KEY=${JSON.stringify(SUPABASE_ANON_KEY)}`
].join(' ');

console.log('Building with esbuild...');
execSync(buildCmd, { stdio: 'inherit' });

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