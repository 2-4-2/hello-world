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

const BOT_TOKEN = normalizeToken(process.env.DISCORD_TOKEN || config.token);
const CLIENT_ID = cleanValue(process.env.CLIENT_ID || config.clientId);
const GUILD_ID = cleanValue(process.env.GUILD_ID || config.guildId);
const DEFAULT_VOLUME = Number(process.env.DEFAULT_VOLUME || config.defaultVolume || 0.5);
const LOG_LEVEL = cleanValue(process.env.LOG_LEVEL || config.logLevel || 'info');
const REGISTER_COMMANDS = parseBoolean(process.env.REGISTER_COMMANDS, true);
const LOGIN_RETRY_SECONDS = Number(process.env.LOGIN_RETRY_SECONDS || 15);
const HEALTHCHECK_SECONDS = Number(process.env.HEALTHCHECK_SECONDS || 30);

const logger = createLogger(LOG_LEVEL);

if (!BOT_TOKEN) {
  throw new Error('DISCORD_TOKEN zorunludur. .env veya config.json ayarlayın.');
}
if (CLIENT_ID && !/^\d{17,20}$/.test(CLIENT_ID)) {
  logger.warn('CLIENT_ID geçersiz görünüyor. Slash komut kaydı atlanacak.');
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
client.commands = new Collection();
client.logger = logger;
client.musicManager = new MusicManager(logger, DEFAULT_VOLUME);

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));
const commandsData = [];
for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (!command.data || !command.execute) {
    logger.warn(`Geçersiz komut atlandı: ${file}`);
    continue;
  }
  client.commands.set(command.data.name, command);
  commandsData.push(command.data.toJSON());
}

function logAuthTroubleshooting() {
  logger.error('Discord API kimlik doğrulama hatası.');
  logger.error('1) DISCORD_TOKEN doğru mu?');
  logger.error('2) CLIENT_ID uygulama ile eşleşiyor mu?');
  logger.error('3) Railway ENV içinde boşluk/tırnak var mı?');
}

async function registerSlashCommands() {
  if (!REGISTER_COMMANDS) {
    logger.warn('REGISTER_COMMANDS=false olduğu için komut kaydı atlandı.');
    return;
  }
  if (!CLIENT_ID || !/^\d{17,20}$/.test(CLIENT_ID)) {
    logger.warn('CLIENT_ID eksik/geçersiz. Bot online olacak, slash komut kaydı atlandı.');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
  if (GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commandsData });
    logger.info(`Guild slash komutları yüklendi (${GUILD_ID}).`);
    return;
  }
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commandsData });
  logger.info('Global slash komutları yüklendi.');
}

for (const file of fs.readdirSync(path.join(__dirname, 'events')).filter((f) => f.endsWith('.js'))) {
  const event = require(path.join(__dirname, 'events', file));
  if (event.once) client.once(event.name, (...args) => event.execute(...args));
  else client.on(event.name, (...args) => event.execute(...args));
}

client.on(Events.ShardDisconnect, (event, shardId) => logger.warn(`Shard bağlantısı koptu: ${shardId}`, event));
client.on(Events.ShardReconnecting, (shardId) => logger.warn(`Shard yeniden bağlanıyor: ${shardId}`));
client.on(Events.ShardResume, (id) => logger.info(`Shard yeniden aktif: ${id}`));
client.on(Events.Error, (error) => logger.error('Discord client hatası', error));

process.on('uncaughtException', (error) => logger.error('uncaughtException', error));
process.on('unhandledRejection', (reason) => logger.error('unhandledRejection', reason));
