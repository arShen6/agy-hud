#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { hud } from '../src/main.mjs';
import { collectGit, readConfig, readInput } from './collector.mjs';
import { install, uninstall, configure, doctor } from './install.mjs';
const entry = fileURLToPath(import.meta.url), command = process.argv[2] || 'render';
try {
  if (command === 'render') {
    const timer = setTimeout(() => { process.stdout.write('AGY HUD: input timeout\n'); process.exit(0); }, 3500);
    const payload = await readInput(); clearTimeout(timer);
    let config;
    try { config = readConfig(); } catch { config = { color: false }; }
    console.log(hud(payload, config, collectGit(payload, config)));
  } else if (command === 'setup') {
    console.log(`AGY HUD installed: ${install(entry)}\nRestart agy once. Run /agy-hud for help.`);
  } else if (command === 'uninstall') {
    uninstall(); console.log('Previous status line restored. Restart agy.');
  } else if (command === 'doctor') {
    console.log(JSON.stringify(doctor(entry), null, 2));
  } else if (command === 'configure') {
    const language = process.argv[3];
    if (language !== 'en') throw new Error('The HUD uses English. Use: configure en');
    configure({ language }); console.log(`Language: ${language}`);
  } else if (command === 'preview') {
    console.log('DEMO — not your live quota\n');
    console.log(hud({ model: { display_name: 'Gemini 4 Argon', effort: 'high' }, cwd: '/demo/agy-hud',
      context_window: { used_percentage: 24 }, vcs: { branch: 'main', dirty: false }, plan_tier: 'Google AI Pro',
      terminal_width: 100, agent_state: 'working', quota: {
        'gemini-5h': { remaining_fraction: 0.82, reset_in_seconds: 5400 },
        'gemini-weekly': { remaining_fraction: 0.64, reset_in_seconds: 190800 },
        '3p-5h': { remaining_fraction: 0.18, reset_in_seconds: 2400 },
        '3p-weekly': { remaining_fraction: 0.43, reset_in_seconds: 280800 },
        'gemini-argon-wtu-weekly': { remaining_fraction: 0.76, reset_in_seconds: 190800 },
      }, subagents: [{ name: 'review', status: 'running' }], task_count: 1 }, readConfig()));
  } else if (command === 'version') console.log('0.1.3');
  else throw new Error('Commands: setup, render, preview, doctor, configure en, uninstall, version');
} catch (e) {
  if (command === 'render') { console.log('AGY HUD: data unavailable'); process.exit(0); }
  console.error(`AGY HUD: ${e.message}`); process.exitCode = 1;
}
