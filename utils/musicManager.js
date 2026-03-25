const {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
} = require('@discordjs/voice');
const play = require('play-dl');
const ytSearch = require('yt-search');

class GuildMusicSubscription {
  constructor(guildId, logger, volume = 0.5) {
    this.guildId = guildId;
    this.logger = logger;
    this.volume = Number.isFinite(volume) ? volume : 0.5;
    this.connection = null;
    this.audioPlayer = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause,
      },
    });
    this.queue = [];
    this.currentTrack = null;
    this.textChannel = null;
    this.voiceChannelId = null;
    this.voiceAdapterCreator = null;
    this.reconnectAttempts = 0;
    this.isReconnecting = false;

    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      this.currentTrack = null;
      void this.processQueue();
    });

    this.audioPlayer.on('error', (error) => {
      this.logger.error(`Audio player error [${this.guildId}]`, error);
      this.currentTrack = null;
      void this.processQueue();
    });
  }

  async connect(voiceChannel) {
    this.voiceChannelId = voiceChannel.id;
    this.voiceChannelId = voiceChannel.id;
    this.voiceAdapterCreator = voiceChannel.guild.voiceAdapterCreator;

    if (this.connection) {
      return this.connection;
    }

    this.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false,
    });

    this.connection.subscribe(this.audioPlayer);
    this.connection.on('stateChange', (_, newState) => {
      this.logger.debug(`Voice state changed [${this.guildId}] -> ${newState.status}`);
    });

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      if (this.isReconnecting) return;
      this.isReconnecting = true;
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5000),
        ]);
        this.logger.warn(`Voice reconnect in progress [${this.guildId}]`);
      } catch {
        await this.reconnect();
      } finally {
        this.isReconnecting = false;
      }
    });

    try {
      await entersState(this.connection, VoiceConnectionStatus.Ready, 20000);
      this.reconnectAttempts = 0;
      this.logger.info(`Voice connection ready [${this.guildId}]`);
      return this.connection;
    } catch (error) {
      this.logger.error(`Voice connection failed [${this.guildId}]`, error);
      this.destroy();
      throw new Error('Ses kanalına bağlanılamadı. Lütfen tekrar deneyin.');
    }
  }

  async reconnect() {
    if (!this.voiceChannelId || !this.voiceAdapterCreator) return;
    if (this.reconnectAttempts >= 5) {
      this.logger.error(`Reconnect limit reached [${this.guildId}], destroying connection.`);
      this.destroy();
      return;
    }

    this.reconnectAttempts += 1;
    this.logger.warn(`Reconnect attempt ${this.reconnectAttempts} [${this.guildId}]`);

    this.connection?.destroy();
    this.connection = joinVoiceChannel({
      channelId: this.voiceChannelId,
      guildId: this.guildId,
      adapterCreator: this.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false,
    });

    this.connection.subscribe(this.audioPlayer);

    try {
      await entersState(this.connection, VoiceConnectionStatus.Ready, 20000);
      this.logger.info(`Reconnected successfully [${this.guildId}]`);
      this.reconnectAttempts = 0;
    } catch (error) {
      this.logger.error(`Reconnect failed [${this.guildId}]`, error);
      await this.reconnect();
    }
  }

  async searchTrack(query) {
    if (play.yt_validate(query) === 'video') {
      const video = await play.video_basic_info(query);
      return {
        title: video.video_details.title,
        url: video.video_details.url,
        duration: video.video_details.durationRaw ?? 'Bilinmiyor',
        requestedBy: null,
      };
    }

    try {
      const result = await ytSearch(query);
      const video = result.videos?.[0];

      if (video) {
        return {
