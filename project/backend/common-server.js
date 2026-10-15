const { spawn } = require('child_process');
const crypto = require('crypto');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const services = [
  {
    name: 'Triage Relay',
    directory: path.join(projectRoot, 'traige relay', 'backend'),
    port: process.env.TRIAGE_PORT || '4000'
  },
  {
    name: 'Hospital Relay',
    directory: path.join(projectRoot, 'hospital side relay', 'backend'),
    port: process.env.HOSPITAL_PORT || '4100'
  }
];

if (services[0].port === services[1].port) {
  throw new Error('TRIAGE_PORT and HOSPITAL_PORT must use different values.');
}

// Shared secret that lets the two servers trust each other (never shown in a browser).
// Set RELAY_SHARED_SECRET yourself for a fixed value; otherwise a new one is made on every start.
const relaySecret = process.env.RELAY_SHARED_SECRET || crypto.randomBytes(24).toString('hex');
const linkEnv = {
  RELAY_SHARED_SECRET: relaySecret,
  TRIAGE_URL: `http://localhost:${services[0].port}`,
  HOSPITAL_RELAY_URL: `http://localhost:${services[1].port}`
};

let shuttingDown = false;
const children = new Set();

function stopChildren(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }

  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) child.kill('SIGKILL');
    }
    process.exit(exitCode);
  }, 5000).unref();
}

function startService(service) {
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: service.directory,
    env: { ...process.env, ...linkEnv, PORT: service.port },
    stdio: 'inherit'
  });

  children.add(child);
  child.on('error', error => {
    console.error(`[Common Backend] Unable to start ${service.name}: ${error.message}`);
    stopChildren(1);
  });
  child.on('exit', (code, signal) => {
    children.delete(child);
    if (!shuttingDown) {
      const reason = signal ? `signal ${signal}` : `exit code ${code}`;
      console.error(`[Common Backend] ${service.name} stopped unexpectedly (${reason}).`);
      stopChildren(code || 1);
    }
  });
}

console.log('[Common Backend] Starting both relay services...');
console.log('[Common Backend] Servers are linked: Triage Relay forwards pre-alerts to Hospital Relay.');
console.log(`[Common Backend] Triage Relay:   http://localhost:${services[0].port}`);
console.log(`[Common Backend] Hospital Relay: http://localhost:${services[1].port}`);

for (const service of services) startService(service);

process.on('SIGINT', () => stopChildren(0));
process.on('SIGTERM', () => stopChildren(0));
