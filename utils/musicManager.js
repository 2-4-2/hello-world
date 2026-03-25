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

    const result = await ytSearch(query);
    const video = result.videos?.[0];

    if (!video) {
      throw new Error('Arama sonucu bulunamadı.');
    }

    return {
      title: video.title,
      url: video.url,
      duration: video.timestamp ?? 'Bilinmiyor',
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

    const nextTrack = this.queue.shift();

    if (!nextTrack) {
      this.logger.debug(`Queue finished [${this.guildId}]`);
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
      await this.notify('❌ Şarkı oynatılamadı, sıradaki parçaya geçiliyor.');
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
    this.audioPlayer.stop(true);
    this.destroy();
  }

  pause() {
    if (this.audioPlayer.state.status !== AudioPlayerStatus.Playing) {
      throw new Error('Aktif çalma bulunmuyor.');
    }
    this.audioPlayer.pause();
  }

  resume() {
    if (!this.audioPlayer.unpause()) {
      throw new Error('Devam ettirilecek duraklatılmış parça yok.');
    }
  }

  getQueueText() {
    const playing = this.currentTrack
      ? `🎵 Şu an: **${this.currentTrack.title}**\n`
      : '🎵 Şu an çalan parça yok.\n';

    const queued = this.queue
      .slice(0, 10)
      .map((track, index) => `${index + 1}. ${track.title} (${track.duration})`)
      .join('\n');

    return `${playing}${queued ? `\n📜 Sıradakiler:\n${queued}` : '\n📜 Sırada parça yok.'}`;
  }

  destroy() {
    try {
      this.connection?.destroy();
    } catch (error) {
      this.logger.warn(`Destroy connection failed [${this.guildId}]`, error);
    }
    this.connection = null;
    this.voiceChannelId = null;
    this.voiceAdapterCreator = null;
    this.reconnectAttempts = 0;
  }
}

class MusicManager {
  constructor(logger, defaultVolume) {
    this.logger = logger;
    this.defaultVolume = defaultVolume;
    this.subscriptions = new Map();
  }

  get(guildId) {
    return this.subscriptions.get(guildId);
  }

  getOrCreate(guildId) {
    if (!this.subscriptions.has(guildId)) {
      this.subscriptions.set(
        guildId,
        new GuildMusicSubscription(guildId, this.logger, this.defaultVolume),
      );
    }
    return this.subscriptions.get(guildId);
  }

  cleanup(guildId) {
    const subscription = this.subscriptions.get(guildId);
    if (!subscription) return;
    subscription.destroy();
    this.subscriptions.delete(guildId);
  }
}

module.exports = { MusicManager };
