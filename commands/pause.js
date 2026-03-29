const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('beklet').setDescription('Çalan müziği duraklatır.'),

  async execute(interaction) {
    try {
      const subscription = interaction.client.musicManager.get(interaction.guildId);
      if (!subscription) {
        await interaction.reply({ content: '❌ Aktif müzik oturumu yok.', ephemeral: true });
        return;
      }

      subscription.pause();
      await interaction.reply('⏸️ Müzik duraklatıldı.');
    } catch (error) {
      interaction.client.logger.error('Komut /beklet çalıştırılamadı', error);
      await interaction.reply({ content: `❌ ${error.message}`, ephemeral: true }).catch(() => null);
    }
  },
};
