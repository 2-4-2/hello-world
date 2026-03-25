require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, REST, Routes } = require('discord.js');
const { createLogger } = require('./utils/logger');
const { MusicManager } = require('./utils/musicManager');
const config = require('./config.json');

const token = (process.env.DISCORD_TOKEN || config.token || '').trim().replace(/^Bot\s+/i, '');
const clientId = (process.env.CLIENT_ID || config.clientId || '').trim();
const guildId = (process.env.GUILD_ID || config.guildId || '').trim();
const logLevel = (process.env.LOG_LEVEL || config.logLevel || 'info').trim();
const volume = Number(process.env.DEFAULT_VOLUME || config.defaultVolume || 0.5);
const registerCommands = !['false', '0', 'no', 'off'].includes(String(process.env.REGISTER_COMMANDS || 'true').toLowerCase());
const loginTimeoutSeconds = Number(process.env.LOGIN_TIMEOUT_SECONDS || 25);

const logger = createLogger(logLevel);
if (!token) throw new Error('DISCORD_TOKEN zorunlu.');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
client.commands = new Collection();
client.logger = logger;
client.musicManager = new MusicManager(logger, volume);

const commands = [];
for (const file of fs.readdirSync(path.join(__dirname, 'commands')).filter((f) => f.endsWith('.js'))) {
