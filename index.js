require('dotenv').config();


if (typeof globalThis.File === 'undefined') {
if (typeof globalThis.File === 'undefined') {
  globalThis.File = class File extends Blob {
  globalThis.File = class File extends Blob {
    constructor(parts = [], name = 'file', options = {}) {
    constructor(parts = [], name = 'file', options = {}) {
      super(parts, options);
      super(parts, options);
      this.name = name;
      this.name = name;
      this.lastModified = options.lastModified || Date.now();
      this.lastModified = options.lastModified || Date.now();
    }
    }
  };
  };
}
}


const fs = require('node:fs');
const fs = require('node:fs');
const path = require('node:path');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, REST, Routes } = require('discord.js');
const { Client, Collection, Events, GatewayIntentBits, REST, Routes } = require('discord.js');
const { createLogger } = require('./utils/logger');
const { createLogger } = require('./utils/logger');
const { MusicManager } = require('./utils/musicManager');
const { MusicManager } = require('./utils/musicManager');
const config = require('./config.json');
const config = require('./config.json');


const token = (process.env.DISCORD_TOKEN || config.token || '').trim().replace(/^Bot\s+/i, '');
const token = (process.env.DISCORD_TOKEN || config.token || '').trim().replace(/^Bot\s+/i, '');
const clientId = (process.env.CLIENT_ID || config.clientId || '').trim();
const clientId = (process.env.CLIENT_ID || config.clientId || '').trim();
const guildId = (process.env.GUILD_ID || config.guildId || '').trim();
const guildId = (process.env.GUILD_ID || config.guildId || '').trim();
const logLevel = (process.env.LOG_LEVEL || config.logLevel || 'info').trim();
const logLevel = (process.env.LOG_LEVEL || config.logLevel || 'info').trim();
const volume = Number(process.env.DEFAULT_VOLUME || config.defaultVolume || 0.5);
const volume = Number(process.env.DEFAULT_VOLUME || config.defaultVolume || 0.5);
const registerCommands = !['false', '0', 'no', 'off'].includes(String(process.env.REGISTER_COMMANDS || 'true').toLowerCase());
const registerCommands = !['false', '0', 'no', 'off'].includes(String(process.env.REGISTER_COMMANDS || 'true').toLowerCase());
const loginTimeoutSeconds = Number(process.env.LOGIN_TIMEOUT_SECONDS || 25);


const logger = createLogger(logLevel);
const logger = createLogger(logLevel);
if (!token) throw new Error('DISCORD_TOKEN zorunlu.');
if (!token) throw new Error('DISCORD_TOKEN zorunlu.');


const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
client.commands = new Collection();
client.commands = new Collection();
client.logger = logger;
client.logger = logger;
client.musicManager = new MusicManager(logger, volume);
client.musicManager = new MusicManager(logger, volume);


const commands = [];
const commands = [];
for (const file of fs.readdirSync(path.join(__dirname, 'commands')).filter((f) => f.endsWith('.js'))) {
for (const file of fs.readdirSync(path.join(__dirname, 'commands')).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(__dirname, 'commands', file));
  const command = require(path.join(__dirname, 'commands', file));
  if (command?.data && command?.execute) {
  if (command?.data && command?.execute) {
    client.commands.set(command.data.name, command);
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
    commands.push(command.data.toJSON());
  }
  }
}
}


for (const file of fs.readdirSync(path.join(__dirname, 'events')).filter((f) => f.endsWith('.js'))) {
for (const file of fs.readdirSync(path.join(__dirname, 'events')).filter((f) => f.endsWith('.js'))) {
  const event = require(path.join(__dirname, 'events', file));
  const event = require(path.join(__dirname, 'events', file));
  if (event.once) client.once(event.name, (...args) => event.execute(...args));
  if (event.once) client.once(event.name, (...args) => event.execute(...args));
  else client.on(event.name, (...args) => event.execute(...args));
  else client.on(event.name, (...args) => event.execute(...args));
}
}


client.on(Events.Error, (err) => logger.error('Discord client error', err));
client.on(Events.Error, (err) => logger.error('Discord client error', err));
process.on('uncaughtException', (err) => logger.error('uncaughtException', err));
process.on('uncaughtException', (err) => logger.error('uncaughtException', err));
process.on('unhandledRejection', (err) => logger.error('unhandledRejection', err));
process.on('unhandledRejection', (err) => logger.error('unhandledRejection', err));


async function registerSlashCommands() {
async function registerSlashCommands() {
  if (!registerCommands) return logger.warn('REGISTER_COMMANDS=false, komut kaydı atlandı.');
  if (!registerCommands) return logger.warn('REGISTER_COMMANDS=false, komut kaydı atlandı.');
  if (!/^\d{17,20}$/.test(clientId)) return logger.warn('CLIENT_ID eksik/geçersiz, komut kaydı atlandı.');
  if (!/^\d{17,20}$/.test(clientId)) return logger.warn('CLIENT_ID eksik/geçersiz, komut kaydı atlandı.');


  const rest = new REST({ version: '10' }).setToken(token);
  const rest = new REST({ version: '10' }).setToken(token);
  if (guildId) {
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    return logger.info(`Guild komutları yüklendi (${guildId}).`);
    return logger.info(`Guild komutları yüklendi (${guildId}).`);
  }
  }
  await rest.put(Routes.applicationCommands(clientId), { body: commands });
  await rest.put(Routes.applicationCommands(clientId), { body: commands });
  logger.info('Global komutlar yüklendi.');
  logger.info('Global komutlar yüklendi.');
}
}


async function boot() {
async function boot() {
  while (!client.isReady()) {
  while (!client.isReady()) {
    try {
    try {
      logger.info('Discord login deneniyor...');
      logger.info(`Discord login deneniyor... (timeout: ${loginTimeoutSeconds}s)`);
      await client.login(token);
      await Promise.race([
        client.login(token),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Discord login timeout')), loginTimeoutSeconds * 1000)),
      ]);
    } catch (err) {
    } catch (err) {
      logger.error('Login başarısız, 15sn sonra tekrar deneniyor.', err);
      logger.error('Login başarısız, 15sn sonra tekrar deneniyor.', err);
      try { client.destroy(); } catch (_) {}
      await new Promise((r) => setTimeout(r, 15000));
      await new Promise((r) => setTimeout(r, 15000));
    }
    }
  }
  }


  try {
  try {
    await registerSlashCommands();
    await registerSlashCommands();
  } catch (err) {
  } catch (err) {
    logger.error('Komut kaydı başarısız, bot çalışmaya devam edecek.', err);
    logger.error('Komut kaydı başarısız, bot çalışmaya devam edecek.', err);
  }
  }
}
}


void boot();
void boot();
