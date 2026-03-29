module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
      await interaction
        .reply({ content: '❌ Komut bulunamadı.', ephemeral: true })
        .catch(() => null);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      interaction.client.logger.error('Interaction execution error', error);
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply('❌ Komut işlenirken hata oluştu.').catch(() => null);
      } else {
        await interaction
          .reply({ content: '❌ Komut işlenirken hata oluştu.', ephemeral: true })
          .catch(() => null);
      }
    }
  },
};
