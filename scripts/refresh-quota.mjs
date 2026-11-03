#!/usr/bin/env node
import { join } from 'node:path';
import { dataDir, settingsFile, readJSON, readConfig, readInput } from './collector.mjs';
import { refreshQuota } from './quota-cache.mjs';

// Always allow Stop. A failed query must never inject a prompt or restart the agent.
const timer = setTimeout(() => { console.log('{}'); process.exit(0); }, 1500);
try {
  if (process.env.AGY_HUD_REFRESH_CHILD !== '1' && readConfig().quotaRefresh === 'turn-end') {
    const installed = readJSON(join(dataDir(), 'installation.json'), null);
    const settings = readJSON(settingsFile(), {});
    if (installed?.settingsFile === settingsFile() && installed?.command &&
      installed.command === settings.statusLine?.command && settings.statusLine.enabled !== false) {
      const input = await readInput();
      clearTimeout(timer);
      await refreshQuota(input);
    }
  }
} catch { /* Keep the user's turn usable even when local configuration is broken. */ }
clearTimeout(timer);
console.log('{}');
