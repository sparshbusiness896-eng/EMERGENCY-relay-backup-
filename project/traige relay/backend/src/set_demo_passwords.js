/**
 * Triage Relay: Set Demo Passwords Script
 * Hashes DEMO_PASSWORD from .env and updates the demo accounts in PostgreSQL.
 */

const { pool, query } = require('./db');
let argon2;
try {
  argon2 = require('argon2');
} catch (e) {
  argon2 = null;
}

async function setDemoPasswords() {
  const demoPassword = process.env.DEMO_PASSWORD;
  if (!demoPassword || demoPassword.trim() === '') {
    console.error('Error: DEMO_PASSWORD is not set in .env file.');
    process.exit(1);
  }

  if (!argon2) {
    console.error('Error: argon2 is not available.');
    process.exit(1);
  }

  console.log('Generating Argon2id hash for DEMO_PASSWORD...');
  const passwordHash = await argon2.hash(demoPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4
  });

  const demoUserIds = [
    'usr_paramedic_1',
    'usr_er_1',
    'usr_admin_1',
    'usr_dispatcher_1',
    'usr_sysadmin_1'
  ];

  console.log(`Updating ${demoUserIds.length} demo user accounts in PostgreSQL...`);

  for (const userId of demoUserIds) {
    const res = await query(
      `UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, email, role, full_name`,
      [passwordHash, userId]
    );

    if (res.rows.length > 0) {
      const u = res.rows[0];
      console.log(`  ✓ Updated password for: ${u.email} (${u.role})`);
    } else {
      console.warn(`  ⚠ Warning: User ID ${userId} not found in database.`);
    }
  }

  console.log('\nAll demo user passwords successfully updated in PostgreSQL database.');
}

if (require.main === module) {
  setDemoPasswords()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Failed to set demo passwords:', err.message);
      pool.end();
      process.exit(1);
    });
}

module.exports = { setDemoPasswords };
