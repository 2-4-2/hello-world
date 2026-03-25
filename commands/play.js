const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cal')
    .setDescription('YouTube linki veya isim ile şarkı çalar.')
    .addStringOption((option) =>
      option
        .setName('sorgu')
        .setDescription('YouTube URL veya şarkı adı')
        .setRequired(true),
    ),

  async execute(interaction) {
    try {
      const query = interaction.options.getString('sorgu', true);
      const memberChannel = interaction.member?.voice?.channel;

      if (!memberChannel) {
        await interaction.reply({
          content: '❌ Önce bir ses kanalına katılmalısın.',
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply();

      const subscription = interaction.client.musicManager.getOrCreate(interaction.guildId);
      const track = await subscription.enqueue(
        query,
        interaction.user.tag,
        interaction.channel,
        memberChannel,
      );

      await interaction.editReply(
        `✅ Sıraya eklendi: **${track.title}** (${track.duration})\nİsteyen: ${interaction.user}`,
      );
    } catch (error) {
      interaction.client.logger.error('Komut /cal çalıştırılamadı', error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply('❌ Şarkı eklenirken hata oluştu.').catch(() => null);
      } else {
        await interaction
          .reply({ content: '❌ Şarkı eklenirken hata oluştu.', ephemeral: true })
          .catch(() => null);
      }
    }
  },
};
