const { AudioPlayerStatus, NoSubscriberBehavior, VoiceConnectionStatus, createAudioPlayer, createAudioResource, entersState, joinVoiceChannel } = require('@discordjs/voice');
const play = require('play-dl');

class GuildMusicSubscription {
  constructor(guildId, logger, volume = 0.5) {
    this.guildId = guildId; this.logger = logger; this.volume = Number.isFinite(volume) ? volume : 0.5;
    this.connection = null; this.queue = []; this.currentTrack = null; this.textChannel = null;
    this.voiceChannelId = null; this.voiceAdapterCreator = null; this.reconnectAttempts = 0; this.isReconnecting = false;
    this.audioPlayer = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
    this.audioPlayer.on(AudioPlayerStatus.Idle, () => { this.currentTrack = null; void this.processQueue(); });
    this.audioPlayer.on('error', (error) => { this.logger.error(`Audio player error [${this.guildId}]`, error); this.currentTrack = null; void this.processQueue(); });
  }

  async connect(vc) {
    this.voiceChannelId = vc.id; this.voiceAdapterCreator = vc.guild.voiceAdapterCreator;
    if (this.connection) return this.connection;
    this.connection = joinVoiceChannel({ channelId: vc.id, guildId: vc.guild.id, adapterCreator: vc.guild.voiceAdapterCreator, selfDeaf: true, selfMute: false });
    this.connection.subscribe(this.audioPlayer);
    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      if (this.isReconnecting) return; this.isReconnecting = true;
      try { await Promise.race([entersState(this.connection, VoiceConnectionStatus.Signalling, 5000), entersState(this.connection, VoiceConnectionStatus.Connecting, 5000)]); }
      catch { await this.reconnect(); } finally { this.isReconnecting = false; }
    });
    try { await entersState(this.connection, VoiceConnectionStatus.Ready, 20000); this.reconnectAttempts = 0; return this.connection; }
    catch (e) { this.destroy(); throw new Error('Ses kanalına bağlanılamadı. Lütfen tekrar deneyin.'); }
  }

  async reconnect() {
    if (!this.voiceChannelId || !this.voiceAdapterCreator) return;
    if (this.reconnectAttempts >= 5) return this.destroy();
    this.reconnectAttempts += 1; this.connection?.destroy();
    this.connection = joinVoiceChannel({ channelId: this.voiceChannelId, guildId: this.guildId, adapterCreator: this.voiceAdapterCreator, selfDeaf: true, selfMute: false });
    this.connection.subscribe(this.audioPlayer);
    try { await entersState(this.connection, VoiceConnectionStatus.Ready, 20000); this.reconnectAttempts = 0; }
    catch { await this.reconnect(); }
  }

  async searchTrack(query) {
    if (play.yt_validate(query) === 'video') {
      const v = await play.video_basic_info(query);
      return { title: v.video_details.title, url: v.video_details.url, duration: v.video_details.durationRaw ?? 'Bilinmiyor', requestedBy: null };
    }

    const v = (await play.search(query, { limit: 1, source: { youtube: 'video' } }))?.[0];
    if (!v) throw new Error('Arama sonucu bulunamadı. Başka bir şarkı adı veya doğrudan YouTube linki dene.');
    return { title: v.title, url: v.url, duration: v.durationRaw ?? 'Bilinmiyor', requestedBy: null };
  }

  async enqueue(query, requestedBy, tc, vc) {
    this.textChannel = tc; await this.connect(vc);
    const track = await this.searchTrack(query); track.requestedBy = requestedBy; this.queue.push(track);
    if (!this.currentTrack) await this.processQueue();
    return track;
  }

  async processQueue() {
    if (this.audioPlayer.state.status !== AudioPlayerStatus.Idle && this.currentTrack) return;
    const next = this.queue.shift(); if (!next) return;
    try {
      const stream = await play.stream(next.url, { discordPlayerCompatibility: true, quality: 2 });
      const res = createAudioResource(stream.stream, { inputType: stream.type, inlineVolume: true });
      if (res.volume) res.volume.setVolume(this.volume);
      this.currentTrack = next; this.audioPlayer.play(res);
      await this.notify(`🎶 Şimdi çalıyor: **${next.title}** (${next.duration})`);
    } catch (e) {
      await this.notify(`❌ Şarkı oynatılamadı (${e?.message || 'bilinmeyen hata'}), sıradaki parçaya geçiliyor.`);
      this.currentTrack = null; await this.processQueue();
    }
