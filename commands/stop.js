const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('durdur')
    .setDescription('Müziği durdurur, sırayı temizler ve kanaldan çıkar.'),

  async execute(interaction) {
    try {
      const subscription = interaction.client.musicManager.get(interaction.guildId);
      if (!subscription) {
        await interaction.reply({ content: '❌ Aktif müzik oturumu yok.', ephemeral: true });
        return;
      }

      subscription.stop();
      interaction.client.musicManager.cleanup(interaction.guildId);
      await interaction.reply('⏹️ Müzik durduruldu ve sıra temizlendi.');
    } catch (error) {
      interaction.client.logger.error('Komut /durdur çalıştırılamadı', error);
      await interaction.reply({ content: '❌ Durdurma işlemi başarısız.', ephemeral: true }).catch(() => null);
    }
  },
};
