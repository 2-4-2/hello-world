const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('gec').setDescription('Çalan parçayı atlar.'),

  async execute(interaction) {
    try {
      const subscription = interaction.client.musicManager.get(interaction.guildId);
      if (!subscription) {
        await interaction.reply({ content: '❌ Aktif müzik oturumu yok.', ephemeral: true });
        return;
      }

      const skipped = subscription.skip();
      await interaction.reply(`⏭️ Atlandı: **${skipped.title}**`);
    } catch (error) {
      interaction.client.logger.error('Komut /gec çalıştırılamadı', error);
      await interaction.reply({ content: `❌ ${error.message}`, ephemeral: true }).catch(() => null);
    }
  },
};
