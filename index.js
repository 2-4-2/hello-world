require('dotenv').config();

if (typeof globalThis.File === 'undefined') {
  globalThis.File = class File extends Blob {
    constructor(parts = [], name = 'file', options = {}) {
      super(parts, options);
      this.name = name;
      this.lastModified = options.lastModified || Date.now();
    }
  };
}

const fs = require('node:fs');
const path = require('node:path');
const { Collection, Events, GatewayIntentBits, REST, Routes, Client } = require('discord.js');

const config = require('./config.json');
const { createLogger } = require('./utils/logger');
const { MusicManager } = require('./utils/musicManager');

function cleanValue(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim().replace(/^['"]|['"]$/g, '');
}

function normalizeToken(rawToken) {
  return cleanValue(rawToken).replace(/^Bot\s+/i, '');
}

function parseBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}
