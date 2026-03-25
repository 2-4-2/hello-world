const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('devam').setDescription('Duraklatılmış müziği devam ettirir.'),

  async execute(interaction) {
    try {
      const subscription = interaction.client.musicManager.get(interaction.guildId);
      if (!subscription) {
        await interaction.reply({ content: '❌ Aktif müzik oturumu yok.', ephemeral: true });
        return;
      }

      subscription.resume();
      await interaction.reply('▶️ Müzik devam ediyor.');
    } catch (error) {
      interaction.client.logger.error('Komut /devam çalıştırılamadı', error);
      await interaction.reply({ content: `❌ ${error.message}`, ephemeral: true }).catch(() => null);
    }
  },
};
