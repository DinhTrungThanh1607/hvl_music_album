/* ============================================
   HVL Music Player - Firebase Cloud Sync
   Upload/download nhạc giữa các thiết bị
   ============================================ */

// ╔══════════════════════════════════════════════╗
// ║  CẤU HÌNH FIREBASE - THAY THẾ BẰNG CỦA BẠN  ║
// ║  Lấy từ: Firebase Console → Project Settings ║
// ╚══════════════════════════════════════════════╝
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

class CloudSync {
  constructor() {
    this.firestore = null;
    this.storage = null;
    this.initialized = false;
    this.syncing = false;
    this.listeners = {};
  }

  // --- Event System ---
  on(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }

  _emit(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(cb => cb(data));
  }

  // --- Initialize ---
  init() {
    if (FIREBASE_CONFIG.apiKey === "YOUR_API_KEY") {
      console.warn('⚠️ Firebase chưa được cấu hình. Cloud sync bị tắt.');
      console.warn('Hãy sửa FIREBASE_CONFIG trong js/cloud.js');
      return false;
    }

    try {
      firebase.initializeApp(FIREBASE_CONFIG);
      this.firestore = firebase.firestore();
      this.storage = firebase.storage();
      this.initialized = true;
      console.log('✅ Firebase Cloud Sync initialized');
      return true;
    } catch (err) {
      console.error('Firebase init error:', err);
      return false;
    }
  }

  // --- Upload Song ---
  async uploadSong(audioArrayBuffer, audioType, filename, metadata, lyricsContent) {
    if (!this.initialized) return null;

    const cloudId = this._generateId();

    try {
      this._emit('uploadstart', { cloudId, title: metadata.title });

      // 1. Upload audio to Storage
      const audioBlob = new Blob([audioArrayBuffer], { type: audioType });
      const audioRef = this.storage.ref(`songs/${cloudId}/audio`);
      const uploadTask = audioRef.put(audioBlob);

      // Track upload progress
      await new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
          (snapshot) => {
            const progress = snapshot.bytesTransferred / snapshot.totalBytes;
            this._emit('uploadprogress', { cloudId, progress, title: metadata.title });
          },
          (error) => reject(error),
          () => resolve()
        );
      });

      // 2. Upload lyrics if available
      let hasLyrics = false;
      if (lyricsContent) {
        const lrcBlob = new Blob([lyricsContent], { type: 'text/plain' });
        const lrcRef = this.storage.ref(`songs/${cloudId}/lyrics.lrc`);
        await lrcRef.put(lrcBlob);
        hasLyrics = true;
      }

      // 3. Save metadata to Firestore
      await this.firestore.collection('songs').doc(cloudId).set({
        title: metadata.title,
        artist: metadata.artist,
        duration: metadata.duration || 0,
        filename: filename,
        audioType: audioType,
        hasLyrics: hasLyrics,
        uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      this._emit('uploadcomplete', { cloudId, title: metadata.title });
      return cloudId;

    } catch (err) {
      console.error('Upload failed:', err);
      this._emit('uploaderror', { cloudId, error: err });
      return null;
    }
  }

  // --- Get Cloud Song List ---
  async getCloudSongs() {
    if (!this.initialized) return [];

    try {
      const snapshot = await this.firestore.collection('songs').get();
      return snapshot.docs.map(doc => ({
        cloudId: doc.id,
        title: doc.data().title || 'Unknown',
        artist: doc.data().artist || 'Unknown',
        duration: doc.data().duration || 0,
        filename: doc.data().filename || '',
        audioType: doc.data().audioType || 'audio/mpeg',
        hasLyrics: doc.data().hasLyrics || false,
        uploadedAt: doc.data().uploadedAt
      }));
    } catch (err) {
      console.error('Failed to get cloud songs:', err);
      return [];
    }
  }

  // --- Download Audio ---
  async downloadAudio(cloudId) {
    if (!this.initialized) return null;

    try {
      this._emit('downloadstart', { cloudId });

      // Get the download URL
      const audioRef = this.storage.ref(`songs/${cloudId}/audio`);
      const url = await audioRef.getDownloadURL();

      // Fetch with progress tracking
      const response = await fetch(url);
      const reader = response.body.getReader();
      const contentLength = parseInt(response.headers.get('Content-Length')) || 0;

      let receivedBytes = 0;
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedBytes += value.length;

        if (contentLength > 0) {
          const progress = receivedBytes / contentLength;
          this._emit('downloadprogress', { cloudId, progress });
        }
      }

      // Combine chunks into ArrayBuffer
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      // Get audio type from Firestore
      const doc = await this.firestore.collection('songs').doc(cloudId).get();
      const audioType = doc.exists ? doc.data().audioType : 'audio/mpeg';

      this._emit('downloadcomplete', { cloudId });

      return {
        audioBuffer: result.buffer,
        audioType: audioType
      };

    } catch (err) {
      console.error('Download failed:', err);
      this._emit('downloaderror', { cloudId, error: err });
      return null;
    }
  }

  // --- Download Lyrics ---
  async downloadLyrics(cloudId) {
    if (!this.initialized) return null;

    try {
      const lrcRef = this.storage.ref(`songs/${cloudId}/lyrics.lrc`);
      const url = await lrcRef.getDownloadURL();
      const response = await fetch(url);
      return await response.text();
    } catch (err) {
      // No lyrics file exists
      return null;
    }
  }

  // --- Delete Song from Cloud ---
  async deleteSong(cloudId) {
    if (!this.initialized) return;

    try {
      // Delete storage files
      try {
        await this.storage.ref(`songs/${cloudId}/audio`).delete();
      } catch (e) { /* ignore if not found */ }

      try {
        await this.storage.ref(`songs/${cloudId}/lyrics.lrc`).delete();
      } catch (e) { /* ignore */ }

      // Delete Firestore document
      await this.firestore.collection('songs').doc(cloudId).delete();

    } catch (err) {
      console.error('Cloud delete failed:', err);
    }
  }

  // --- Playlist Sync ---
  async syncPlaylistsToCloud(playlists) {
    if (!this.initialized) return;

    try {
      const batch = this.firestore.batch();

      for (const pl of playlists) {
        const ref = this.firestore.collection('playlists').doc(String(pl.id));
        batch.set(ref, {
          name: pl.name,
          songCloudIds: pl.songCloudIds || [],
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      await batch.commit();
    } catch (err) {
      console.error('Playlist sync failed:', err);
    }
  }

  async getCloudPlaylists() {
    if (!this.initialized) return [];

    try {
      const snapshot = await this.firestore.collection('playlists').get();
      return snapshot.docs.map(doc => ({
        cloudId: doc.id,
        ...doc.data()
      }));
    } catch (err) {
      console.error('Failed to get cloud playlists:', err);
      return [];
    }
  }

  // --- Helper ---
  _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }
}

// Export globally
window.CloudSync = CloudSync;
