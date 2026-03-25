module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    client.logger.info(`Bot hazır: ${client.user.tag}`);
    await client.user.setPresence({
      status: 'online',
      activities: [{ name: '/cal ile müzik', type: 2 }],
    });
  },
};
