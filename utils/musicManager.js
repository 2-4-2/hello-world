const { AudioPlayerStatus, NoSubscriberBehavior, VoiceConnectionStatus, createAudioPlayer, createAudioResource, entersState, joinVoiceChannel } = require('@discordjs/voice');
const play = require('play-dl');
const ytSearch = require('yt-search');

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
    try {
      const r = await ytSearch(query); const v = r.videos?.[0];
      if (v) return { title: v.title, url: v.url, duration: v.timestamp ?? 'Bilinmiyor', requestedBy: null };
    } catch (e) { this.logger.warn(`yt-search başarısız, play-dl araması deneniyor [${this.guildId}]`, e); }
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
  }

  async notify(message) { if (!this.textChannel) return; try { await this.textChannel.send(message); } catch (_) {} }
  skip() { if (!this.currentTrack) throw new Error('Şu an çalan parça yok.'); this.audioPlayer.stop(true); return this.currentTrack; }
  stop() { this.queue.length = 0; this.currentTrack = null; this.audioPlayer.stop(true); this.destroy(); }
  pause() { if (this.audioPlayer.state.status !== AudioPlayerStatus.Playing) throw new Error('Aktif çalma bulunmuyor.'); this.audioPlayer.pause(); }
  resume() { if (!this.audioPlayer.unpause()) throw new Error('Devam ettirilecek duraklatılmış parça yok.'); }

  getQueueText() {
    const now = this.currentTrack ? `🎵 Şu an: **${this.currentTrack.title}**\n` : '🎵 Şu an çalan parça yok.\n';
    const queued = this.queue.slice(0, 10).map((t, i) => `${i + 1}. ${t.title} (${t.duration})`).join('\n');
    return `${now}${queued ? `\n📜 Sıradakiler:\n${queued}` : '\n📜 Sırada parça yok.'}`;
  }

  destroy() { try { this.connection?.destroy(); } catch (_) {} this.connection = null; this.voiceChannelId = null; this.voiceAdapterCreator = null; this.reconnectAttempts = 0; }
}

class MusicManager {
  constructor(logger, defaultVolume) { this.logger = logger; this.defaultVolume = defaultVolume; this.subscriptions = new Map(); }
  get(guildId) { return this.subscriptions.get(guildId); }
  getOrCreate(guildId) {
    if (!this.subscriptions.has(guildId)) this.subscriptions.set(guildId, new GuildMusicSubscription(guildId, this.logger, this.defaultVolume));
    return this.subscriptions.get(guildId);
  }
  cleanup(guildId) { const s = this.subscriptions.get(guildId); if (!s) return; s.destroy(); this.subscriptions.delete(guildId); }
}

module.exports = { MusicManager };
