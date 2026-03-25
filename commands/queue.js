const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('kuyruk').setDescription('Sıradaki şarkıları gösterir.'),

  async execute(interaction) {
    try {
      const subscription = interaction.client.musicManager.get(interaction.guildId);
      if (!subscription) {
        await interaction.reply({ content: '❌ Aktif müzik oturumu yok.', ephemeral: true });
        return;
      }

      await interaction.reply(subscription.getQueueText());
    } catch (error) {
      interaction.client.logger.error('Komut /kuyruk çalıştırılamadı', error);
      await interaction.reply({ content: '❌ Kuyruk görüntülenemedi.', ephemeral: true }).catch(() => null);
    }
  },
};
