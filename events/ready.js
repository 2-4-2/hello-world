module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    client.logger.info(`Bot hazır: ${client.user.tag}`);
  },
};
