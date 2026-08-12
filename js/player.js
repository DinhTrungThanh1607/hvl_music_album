/* ============================================
   HVL Music Player - Audio Player Engine
   HTML5 Audio wrapper with queue, shuffle, repeat
   ============================================ */

class AudioPlayer {
  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';

    this.queue = [];           // Array of song IDs
    this.currentIndex = -1;
    this.currentSong = null;   // Full song metadata
    this.currentAudioURL = null;

    this.isPlaying = false;
    this.shuffleEnabled = false;
    this.repeatMode = 'none';  // 'none', 'all', 'one'

    this.shuffledQueue = [];
    this.listeners = {};

    this._setupAudioEvents();
  }

  // --- Event System ---

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  _emit(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(cb => cb(data));
  }

  // --- Audio Event Bindings ---

  _setupAudioEvents() {
    this.audio.addEventListener('timeupdate', () => {
      this._emit('timeupdate', {
        currentTime: this.audio.currentTime,
        duration: this.audio.duration || 0
      });
    });

    this.audio.addEventListener('loadedmetadata', () => {
      this._emit('loaded', {
        duration: this.audio.duration
      });
    });

    this.audio.addEventListener('ended', () => {
      this._handleEnded();
    });

    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      this._emit('play', this.currentSong);
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this._emit('pause', this.currentSong);
    });

    this.audio.addEventListener('error', (e) => {
      console.error('Audio error:', e);
      this._emit('error', { error: e, song: this.currentSong });
    });

    this.audio.addEventListener('waiting', () => {
      this._emit('buffering', true);
    });

    this.audio.addEventListener('canplay', () => {
      this._emit('buffering', false);
    });
  }

  // --- Queue Management ---

  loadQueue(songIds, startIndex = 0) {
    this.queue = [...songIds];
    this.currentIndex = startIndex;
    if (this.shuffleEnabled) {
      this._generateShuffledQueue();
    }
  }

  _generateShuffledQueue() {
    this.shuffledQueue = [...this.queue];
    // Fisher-Yates shuffle
    for (let i = this.shuffledQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.shuffledQueue[i], this.shuffledQueue[j]] = [this.shuffledQueue[j], this.shuffledQueue[i]];
    }

    // Move current song to front if playing
    if (this.currentSong) {
      const currentId = this._getActiveQueue()[this.currentIndex];
      const idx = this.shuffledQueue.indexOf(currentId);
      if (idx > 0) {
        [this.shuffledQueue[0], this.shuffledQueue[idx]] = [this.shuffledQueue[idx], this.shuffledQueue[0]];
      }
      this.currentIndex = 0;
    }
  }

  _getActiveQueue() {
    return this.shuffleEnabled ? this.shuffledQueue : this.queue;
  }

  getCurrentSongId() {
    const queue = this._getActiveQueue();
    if (this.currentIndex >= 0 && this.currentIndex < queue.length) {
      return queue[this.currentIndex];
    }
    return null;
  }

  // --- Playback Control ---

  async playSong(songId, db) {
    try {
      // Clean up previous URL
      if (this.currentAudioURL) {
        URL.revokeObjectURL(this.currentAudioURL);
        this.currentAudioURL = null;
      }

      // Get song data
      const song = await db.getSong(songId);
      if (!song) {
        this._emit('error', { error: 'Song not found', song: null });
        return;
      }

      this.currentSong = {
        id: song.id,
        title: song.title,
        artist: song.artist,
        duration: song.duration,
        hasLyrics: !!song.lyricsContent,
        hasCover: !!song.coverBlob
      };

      // Create audio URL
      const audioBlob = new Blob([song.audioBlob], { type: song.audioType });
      this.currentAudioURL = URL.createObjectURL(audioBlob);
      this.audio.src = this.currentAudioURL;

      // Update index in queue
      const queue = this._getActiveQueue();
      const idx = queue.indexOf(songId);
      if (idx >= 0) {
        this.currentIndex = idx;
      }

      // Emit song change
      this._emit('songchange', this.currentSong);

      // Play
      await this.audio.play();

      // Setup Media Session
      this._updateMediaSession(song);

    } catch (err) {
      console.error('Error playing song:', err);
      this._emit('error', { error: err, song: this.currentSong });
    }
  }

  async play() {
    if (this.audio.src) {
      try {
        await this.audio.play();
      } catch (err) {
        console.error('Play error:', err);
      }
    }
  }

  pause() {
    this.audio.pause();
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  async next(db) {
    const queue = this._getActiveQueue();
    if (queue.length === 0) return;

    let nextIndex = this.currentIndex + 1;

    if (nextIndex >= queue.length) {
      if (this.repeatMode === 'all') {
        nextIndex = 0;
      } else {
        this.pause();
        this._emit('queueend');
        return;
      }
    }

    this.currentIndex = nextIndex;
    await this.playSong(queue[this.currentIndex], db);
  }

  async prev(db) {
    const queue = this._getActiveQueue();
    if (queue.length === 0) return;

    // If more than 3 seconds into the song, restart it
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }

    let prevIndex = this.currentIndex - 1;

    if (prevIndex < 0) {
      if (this.repeatMode === 'all') {
        prevIndex = queue.length - 1;
      } else {
        this.audio.currentTime = 0;
        return;
      }
    }

    this.currentIndex = prevIndex;
    await this.playSong(queue[this.currentIndex], db);
  }

  // --- Seek ---

  seek(time) {
    if (isFinite(time)) {
      this.audio.currentTime = time;
    }
  }

  seekPercent(percent) {
    if (this.audio.duration) {
      this.audio.currentTime = this.audio.duration * percent;
    }
  }

  // --- Volume ---

  setVolume(value) {
    this.audio.volume = Math.max(0, Math.min(1, value));
    this._emit('volumechange', this.audio.volume);
  }

  getVolume() {
    return this.audio.volume;
  }

  // --- Shuffle ---

  toggleShuffle() {
    this.shuffleEnabled = !this.shuffleEnabled;
    if (this.shuffleEnabled) {
      this._generateShuffledQueue();
    } else {
      // Find current song in original queue
      const currentId = this.getCurrentSongId();
      if (currentId !== null) {
        this.currentIndex = this.queue.indexOf(currentId);
      }
    }
    this._emit('shufflechange', this.shuffleEnabled);
    return this.shuffleEnabled;
  }

  // --- Repeat ---

  cycleRepeat() {
    const modes = ['none', 'all', 'one'];
    const currentIdx = modes.indexOf(this.repeatMode);
    this.repeatMode = modes[(currentIdx + 1) % modes.length];
    this._emit('repeatchange', this.repeatMode);
    return this.repeatMode;
  }

  // --- Handle Track End ---

  _handleEnded() {
    if (this.repeatMode === 'one') {
      this.audio.currentTime = 0;
      this.audio.play();
    } else {
      this._emit('ended', this.currentSong);
      // Auto next is handled by app.js
    }
  }

  // --- Media Session API ---

  _updateMediaSession(song) {
    if (!('mediaSession' in navigator)) return;

    const metadata = {
      title: song.title,
      artist: song.artist,
      album: 'HVL'
    };

    // Add artwork if available
    if (song.coverBlob) {
      const coverBlob = new Blob([song.coverBlob], { type: song.coverType });
      const coverUrl = URL.createObjectURL(coverBlob);
      metadata.artwork = [
        { src: coverUrl, sizes: '512x512', type: song.coverType }
      ];
    }

    navigator.mediaSession.metadata = new MediaMetadata(metadata);

    navigator.mediaSession.setActionHandler('play', () => this.play());
    navigator.mediaSession.setActionHandler('pause', () => this.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => this._emit('mediaprev'));
    navigator.mediaSession.setActionHandler('nexttrack', () => this._emit('medianext'));
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) {
        this.seek(details.seekTime);
      }
    });
  }

  // --- Getters ---

  get currentTime() {
    return this.audio.currentTime;
  }

  get duration() {
    return this.audio.duration || 0;
  }

  get progress() {
    if (!this.audio.duration) return 0;
    return this.audio.currentTime / this.audio.duration;
  }

  // --- Cleanup ---

  destroy() {
    this.audio.pause();
    this.audio.src = '';
    if (this.currentAudioURL) {
      URL.revokeObjectURL(this.currentAudioURL);
    }
  }
}

// Export globally
window.AudioPlayer = AudioPlayer;
