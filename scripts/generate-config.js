/**
 * generate-config.js
 * Runs as the Vercel build command. Writes js/config.js from env vars so the
 * real Supabase URL/key/passcode never has to live in the (public) git repo.
 */
const fs = require('fs');
const path = require('path');

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'APP_PASSCODE'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing required env var(s): ${missing.join(', ')}`);
  console.error('Set these in Vercel: Project Settings → Environment Variables.');
  process.exit(1);
}

const content = `/**
 * config.js — generated at build time from environment variables, do not edit directly.
 */
const SUPABASE_URL = ${JSON.stringify(process.env.SUPABASE_URL)};
const SUPABASE_ANON_KEY = ${JSON.stringify(process.env.SUPABASE_ANON_KEY)};
const APP_PASSCODE = ${JSON.stringify(process.env.APP_PASSCODE)};
`;

fs.writeFileSync(path.join(__dirname, '..', 'js', 'config.js'), content);
console.log('Wrote js/config.js from environment variables.');
