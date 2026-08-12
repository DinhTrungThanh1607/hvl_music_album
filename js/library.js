/* ============================================
   HVL Music Player - Music Library (IndexedDB)
   Handles storage, import, and retrieval
   ============================================ */

class MusicDB {
  constructor() {
    this.db = null;
    this.dbName = 'HVLMusicPlayer';
    this.dbVersion = 1;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Songs store
        if (!db.objectStoreNames.contains('songs')) {
          const songsStore = db.createObjectStore('songs', { keyPath: 'id', autoIncrement: true });
          songsStore.createIndex('title', 'title', { unique: false });
          songsStore.createIndex('artist', 'artist', { unique: false });
          songsStore.createIndex('addedAt', 'addedAt', { unique: false });
        }

        // Playlists store
        if (!db.objectStoreNames.contains('playlists')) {
          const playlistStore = db.createObjectStore('playlists', { keyPath: 'id', autoIncrement: true });
          playlistStore.createIndex('name', 'name', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  // --- Song Operations ---

  async addSong(songData) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('songs', 'readwrite');
      const store = tx.objectStore('songs');

      const song = {
        title: songData.title || 'Unknown Title',
        artist: songData.artist || 'Unknown Artist',
        filename: songData.filename,
        duration: songData.duration || 0,
        audioBlob: songData.audioBlob || null,
        audioType: songData.audioType,
        lyricsContent: songData.lyricsContent || null,
        coverBlob: songData.coverBlob || null,
        coverType: songData.coverType || null,
        cloudId: songData.cloudId || null,
        syncStatus: songData.syncStatus || 'local-only',
        addedAt: Date.now()
      };

      const request = store.add(song);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getSong(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('songs', 'readonly');
      const store = tx.objectStore('songs');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllSongs() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('songs', 'readonly');
      const store = tx.objectStore('songs');
      const request = store.getAll();
      request.onsuccess = () => {
        // Return songs without blobs for listing (lighter)
        const songs = request.result.map(s => ({
          id: s.id,
          title: s.title,
          artist: s.artist,
          filename: s.filename,
          duration: s.duration,
          hasLyrics: !!s.lyricsContent,
          hasCover: !!s.coverBlob,
          hasAudio: !!s.audioBlob,
          cloudId: s.cloudId || null,
          syncStatus: s.syncStatus || 'local-only',
          addedAt: s.addedAt
        }));
        resolve(songs);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async findByCloudId(cloudId) {
    const allSongs = await new Promise((resolve, reject) => {
      const tx = this.db.transaction('songs', 'readonly');
      const store = tx.objectStore('songs');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return allSongs.find(s => s.cloudId === cloudId) || null;
  }

  async getSongAudioURL(id) {
    const song = await this.getSong(id);
    if (!song || !song.audioBlob) return null;
    const blob = new Blob([song.audioBlob], { type: song.audioType });
    return URL.createObjectURL(blob);
  }

  async getSongCoverURL(id) {
    const song = await this.getSong(id);
    if (!song || !song.coverBlob) return null;
    const blob = new Blob([song.coverBlob], { type: song.coverType });
    return URL.createObjectURL(blob);
  }

  async getSongLyrics(id) {
    const song = await this.getSong(id);
    return song ? song.lyricsContent : null;
  }

  async deleteSong(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('songs', 'readwrite');
      const store = tx.objectStore('songs');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateSong(id, updates) {
    const song = await this.getSong(id);
    if (!song) return;

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('songs', 'readwrite');
      const store = tx.objectStore('songs');
      const updatedSong = { ...song, ...updates };
      const request = store.put(updatedSong);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSongCount() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('songs', 'readonly');
      const store = tx.objectStore('songs');
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // --- Playlist Operations ---

  async createPlaylist(name) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('playlists', 'readwrite');
      const store = tx.objectStore('playlists');

      const playlist = {
        name: name,
        songIds: [],
        createdAt: Date.now()
      };

      const request = store.add(playlist);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getPlaylist(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('playlists', 'readonly');
      const store = tx.objectStore('playlists');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllPlaylists() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('playlists', 'readonly');
      const store = tx.objectStore('playlists');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updatePlaylist(id, updates) {
    const playlist = await this.getPlaylist(id);
    if (!playlist) return;

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('playlists', 'readwrite');
      const store = tx.objectStore('playlists');
      const updated = { ...playlist, ...updates };
      const request = store.put(updated);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deletePlaylist(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('playlists', 'readwrite');
      const store = tx.objectStore('playlists');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async addSongToPlaylist(playlistId, songId) {
    const playlist = await this.getPlaylist(playlistId);
    if (!playlist) return;
    if (!playlist.songIds.includes(songId)) {
      playlist.songIds.push(songId);
      await this.updatePlaylist(playlistId, { songIds: playlist.songIds });
    }
  }

  async removeSongFromPlaylist(playlistId, songId) {
    const playlist = await this.getPlaylist(playlistId);
    if (!playlist) return;
    playlist.songIds = playlist.songIds.filter(id => id !== songId);
    await this.updatePlaylist(playlistId, { songIds: playlist.songIds });
  }
}

// --- File Import Helper ---

class MusicImporter {
  constructor(db) {
    this.db = db;
    this.supportedAudio = ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.flac', '.webm'];
    this.supportedLyrics = ['.lrc'];
  }

  parseFilename(filename) {
    // Remove extension
    let name = filename.replace(/\.[^.]+$/, '');

    // Try to parse "NN. Title (feat. Artist)" format
    const trackMatch = name.match(/^(\d+)\.\s*(.+)$/);
    if (trackMatch) {
      name = trackMatch[2];
    }

    // Extract featured artists
    const featMatch = name.match(/\(feat\.\s*(.+?)\)/i);
    let artist = 'HVL';
    if (featMatch) {
      artist = `HVL feat. ${featMatch[1]}`;
    }

    // Clean title (remove feat. part for display)
    let title = name;

    return { title, artist };
  }

  isAudioFile(filename) {
    const ext = '.' + filename.split('.').pop().toLowerCase();
    return this.supportedAudio.includes(ext);
  }

  isLyricsFile(filename) {
    const ext = '.' + filename.split('.').pop().toLowerCase();
    return this.supportedLyrics.includes(ext);
  }

  async getAudioDuration(blob) {
    return new Promise((resolve) => {
      const audio = new Audio();
      const url = URL.createObjectURL(blob);
      audio.preload = 'metadata';

      audio.onloadedmetadata = () => {
        resolve(audio.duration);
        URL.revokeObjectURL(url);
      };

      audio.onerror = () => {
        resolve(0);
        URL.revokeObjectURL(url);
      };

      audio.src = url;
    });
  }

  async importFiles(files, progressCallback) {
    const audioFiles = [];
    const lyricsMap = new Map();
    const results = { success: 0, failed: 0, total: 0 };

    // Separate audio and lyrics files
    for (const file of files) {
      if (this.isAudioFile(file.name)) {
        audioFiles.push(file);
      } else if (this.isLyricsFile(file.name)) {
        // Map lyrics by base name (without extension)
        const baseName = file.name.replace(/\.[^.]+$/, '');
        lyricsMap.set(baseName, file);
      }
    }

    results.total = audioFiles.length;

    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];
      try {
        const { title, artist } = this.parseFilename(file.name);
        const audioBuffer = await file.arrayBuffer();
        const duration = await this.getAudioDuration(new Blob([audioBuffer], { type: file.type }));

        // Check for matching lyrics file
        const baseName = file.name.replace(/\.[^.]+$/, '');
        let lyricsContent = null;
        if (lyricsMap.has(baseName)) {
          lyricsContent = await lyricsMap.get(baseName).text();
        }

        const songData = {
          title,
          artist,
          filename: file.name,
          duration,
          audioBlob: audioBuffer,
          audioType: file.type || 'audio/mpeg',
          lyricsContent,
          coverBlob: null,
          coverType: null
        };
        
        const id = await this.db.addSong(songData);
        songData.id = id;

        results.success++;
        
        if (progressCallback) {
          await progressCallback(i + 1, audioFiles.length, file.name, songData);
        }
      } catch (err) {
        console.error(`Failed to import ${file.name}:`, err);
        results.failed++;
        if (progressCallback) {
          await progressCallback(i + 1, audioFiles.length, file.name, null);
        }
      }
    }

    return results;
  }

  async importLyricsForSong(songId, lrcFile) {
    const content = await lrcFile.text();
    await this.db.updateSong(songId, { lyricsContent: content });
  }
}

// Export globally
window.MusicDB = MusicDB;
window.MusicImporter = MusicImporter;
