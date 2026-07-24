const fs = require('fs');
const path = require('path');

const schema = fs.readFileSync(path.resolve(__dirname, '../../database/schema.sql'), 'utf8');
const required = ['users', 'products', 'password_reset_tokens', 'sessions', 'schema_migrations'];
const missing = required.filter((table) => !new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`, 'i').test(schema));
const selectsDatabase = /\b(?:CREATE DATABASE|USE)\b/i.test(schema);
if (selectsDatabase || !/^CREATE TABLE IF NOT EXISTS users\b/i.test(schema.trimStart()) || missing.length) {
  console.error(JSON.stringify({ type: 'schema_validation', status: 'failed', missing, selectsDatabase }));
  process.exitCode = 1;
} else console.log(JSON.stringify({ type: 'schema_validation', status: 'ok', tables: required.length }));
