#!/usr/bin/env node
'use strict';

require('dotenv').config();

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { initWorkshopAuth, createWorkshopUser } = require('./services/workshop-auth');

const email = process.env.WORKSHOP_EMAIL;
const password = process.env.WORKSHOP_PASSWORD;
const username = process.env.WORKSHOP_USERNAME || email;
const displayName = process.env.WORKSHOP_DISPLAY_NAME || username;
const role = process.env.WORKSHOP_ROLE || 'detailer';

if (!email || !password) {
  console.error(
    'Set WORKSHOP_EMAIL and WORKSHOP_PASSWORD before creating a workshop account.'
  );
  process.exit(1);
}

const db = new sqlite3.Database(
  path.join(__dirname, 'data', 'database.db')
);

initWorkshopAuth(db);

setTimeout(async () => {
  try {
    const id = await createWorkshopUser(db, {
      email,
      password,
      username,
      displayName,
      role
    });

    console.log('Workshop account created/updated successfully.');
    console.log(`ID: ${id || 'existing account'}`);
    console.log(`Email: ${email}`);
    console.log(`Username: ${username}`);
    console.log(`Role: ${role}`);
  } catch (error) {
    console.error('Unable to create workshop account:', error.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}, 250);
