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
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
        this.logger.warn(`Voice reconnect in progress [${this.guildId}]`);
      } catch {
        await this.reconnect();
      } finally {
        this.isReconnecting = false;
      }
    });

    try {
      await entersState(this.connection, VoiceConnectionStatus.Ready, 20_000);
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
      await entersState(this.connection, VoiceConnectionStatus.Ready, 20_000);
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
          title: video.title,
          url: video.url,
          duration: video.timestamp ?? 'Bilinmiyor',
          requestedBy: null,
        };
      }
    } catch (error) {
      this.logger.warn(`yt-search başarısız, play-dl araması deneniyor [${this.guildId}]`, error);
    }

    const fallback = await play.search(query, { limit: 1, source: { youtube: 'video' } });
    const video = fallback?.[0];

    if (!video) {
      throw new Error('Arama sonucu bulunamadı. Başka bir şarkı adı veya doğrudan YouTube linki dene.');
    }

    return {
      title: video.title,
      url: video.url,
      duration: video.durationRaw ?? 'Bilinmiyor',
      requestedBy: null,
    };
  }

  async enqueue(query, requestedBy, textChannel, voiceChannel) {
    this.textChannel = textChannel;
    await this.connect(voiceChannel);

    const track = await this.searchTrack(query);
    track.requestedBy = requestedBy;

    this.queue.push(track);
    this.logger.info(`Track queued [${this.guildId}] ${track.title}`);

    if (!this.currentTrack) {
      await this.processQueue();
    }

    return track;
  }

  async processQueue() {
    if (this.audioPlayer.state.status !== AudioPlayerStatus.Idle && this.currentTrack) {
      return;
    }
@@ -177,51 +193,51 @@ class GuildMusicSubscription {
      return;
    }

    try {
      const stream = await play.stream(nextTrack.url, {
        discordPlayerCompatibility: true,
        quality: 2,
      });

      const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: true,
      });

      if (resource.volume) {
        resource.volume.setVolume(this.volume);
      }

      this.currentTrack = nextTrack;
      this.audioPlayer.play(resource);

      await this.notify(`🎶 Şimdi çalıyor: **${nextTrack.title}** (${nextTrack.duration})`);
      this.logger.info(`Now playing [${this.guildId}] ${nextTrack.title}`);
    } catch (error) {
      this.logger.error(`Track play failed [${this.guildId}]`, error);
      await this.notify(`❌ Şarkı oynatılamadı (${error?.message || 'bilinmeyen hata'}), sıradaki parçaya geçiliyor.`);
      this.currentTrack = null;
      await this.processQueue();
    }
  }

  async notify(message) {
    if (!this.textChannel) return;
    try {
      await this.textChannel.send(message);
    } catch (error) {
      this.logger.warn(`Message send failed [${this.guildId}]`, error);
    }
  }

  skip() {
    if (!this.currentTrack) {
      throw new Error('Şu an çalan parça yok.');
    }
    this.audioPlayer.stop(true);
    return this.currentTrack;
  }

  stop() {
    this.queue.length = 0;
    this.currentTrack = null;
