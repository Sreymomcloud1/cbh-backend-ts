// seed.ts — Run: ts-node seed.ts
// Hashes passwords at runtime and upserts all demo users.
// Safe to run multiple times.

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const USERS = [
  { id: 'a0000001-0000-0000-0000-000000000001', email: 'startup@demo.com',         pw: 'demo1234', role: 'startup',  name: 'Sophea Mao',     phone: '+855 12 345 678' },
  { id: 'a0000001-0000-0000-0000-000000000002', email: 'ratanak@angkorfoods.com',   pw: 'demo1234', role: 'startup',  name: 'Ratanak Sok',    phone: '+855 17 654 321' },
  { id: 'a0000001-0000-0000-0000-000000000003', email: 'chanda@edukhmer.io',        pw: 'demo1234', role: 'startup',  name: 'Chanda Heng',    phone: '+855 98 111 222' },
  { id: 'a0000001-0000-0000-0000-000000000004', email: 'veasna@finpay.com.kh',      pw: 'demo1234', role: 'startup',  name: 'Veasna Keo',     phone: '+855 11 999 888' },
  { id: 'a0000001-0000-0000-0000-000000000005', email: 'sokha@mekonghealth.kh',     pw: 'demo1234', role: 'startup',  name: 'Sokha Ean',      phone: '+855 23 445 566' },
  { id: 'a0000001-0000-0000-0000-000000000006', email: 'monyrath@khmerharvest.com', pw: 'demo1234', role: 'startup',  name: 'Monyrath Chhun', phone: '+855 77 321 654' },
  { id: 'b0000001-0000-0000-0000-000000000001', email: 'customer@demo.com',         pw: 'demo1234', role: 'customer', name: 'James Wong',     phone: null },
  { id: 'c0000001-0000-0000-0000-000000000001', email: 'admin@cbh.com',             pw: 'admin123', role: 'admin',    name: 'CBH Admin',      phone: null },
];

async function seed() {
  const client = await pool.connect();
  try {
    console.log('\nSeeding users with fresh bcrypt hashes…\n');
    for (const u of USERS) {
      const hash = await bcrypt.hash(u.pw, 10);
      await client.query(
        `INSERT INTO users (id, email, password_hash, role, name, phone, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,true)
         ON CONFLICT (email) DO UPDATE SET
           password_hash = EXCLUDED.password_hash,
           is_active = true,
           name = EXCLUDED.name`,
        [u.id, u.email, hash, u.role, u.name, u.phone]
      );
      console.log(`  ✓  ${u.role.padEnd(8)}  ${u.email.padEnd(35)}  (password: ${u.pw})`);
    }

    // Verify passwords
    console.log('\nVerifying…\n');
    let allPass = true;
    for (const { email, pw } of [
      { email: 'startup@demo.com',  pw: 'demo1234' },
      { email: 'customer@demo.com', pw: 'demo1234' },
      { email: 'admin@cbh.com',     pw: 'admin123' },
    ]) {
      const { rows } = await client.query<{ password_hash: string }>(
        'SELECT password_hash FROM users WHERE email = $1', [email]
      );
      const ok = rows[0] && await bcrypt.compare(pw, rows[0].password_hash);
      console.log(`  ${ok ? '✓ PASS' : '✗ FAIL'}  ${email} / ${pw}`);
      if (!ok) allPass = false;
    }

    if (!allPass) { console.error('\n✗ Some verifications FAILED.\n'); process.exit(1); }

    console.log('\n✓ Seed complete!\n');
    console.log('────────────────────────────────────────────────');
    console.log('  startup@demo.com   / demo1234');
    console.log('  customer@demo.com  / demo1234');
    console.log('  admin@cbh.com      / admin123');
    console.log('────────────────────────────────────────────────\n');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => { console.error('Seed error:', err.message); process.exit(1); });
