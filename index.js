require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { Collection, Events, GatewayIntentBits, REST, Routes, Client } = require('discord.js');

const config = require('./config.json');
const { createLogger } = require('./utils/logger');
const { MusicManager } = require('./utils/musicManager');

const BOT_TOKEN = process.env.DISCORD_TOKEN || config.token;
const CLIENT_ID = process.env.CLIENT_ID || config.clientId;
const GUILD_ID = process.env.GUILD_ID || config.guildId;
const DEFAULT_VOLUME = Number(process.env.DEFAULT_VOLUME || config.defaultVolume || 0.5);
const LOG_LEVEL = process.env.LOG_LEVEL || config.logLevel || 'info';

const logger = createLogger(LOG_LEVEL);

if (!BOT_TOKEN || !CLIENT_ID) {
  throw new Error('DISCORD_TOKEN ve CLIENT_ID zorunludur. .env veya config.json ayarlayın.');
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

client.commands = new Collection();
client.logger = logger;
client.musicManager = new MusicManager(logger, DEFAULT_VOLUME);

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

const commandsData = [];
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if (!command.data || !command.execute) {
    logger.warn(`Invalid command skipped: ${file}`);
    continue;
  }

  client.commands.set(command.data.name, command);
  commandsData.push(command.data.toJSON());
}

async function registerSlashCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
        body: commandsData,
      });
      logger.info(`Guild slash commands registered (${GUILD_ID}).`);
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), {
        body: commandsData,
      });
      logger.info('Global slash commands registered.');
    }
  } catch (error) {
    logger.error('Slash command registration failed', error);
    throw error;
  }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);

  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

client.on(Events.ShardDisconnect, (event, shardId) => {
  logger.warn(`Shard disconnected: ${shardId}`, event);
});

client.on(Events.ShardReconnecting, (shardId) => {
  logger.warn(`Shard reconnecting: ${shardId}`);
});

client.on(Events.Error, (error) => {
  logger.error('Discord client error', error);
});

process.on('uncaughtException', (error) => {
  logger.error('uncaughtException', error);
});

process.on('unhandledRejection', (reason) => {
  logger.error('unhandledRejection', reason);
});

(async () => {
  try {
    await registerSlashCommands();
    await client.login(BOT_TOKEN);
  } catch (error) {
    logger.error('Startup failed', error);
    process.exit(1);
  }
})();
