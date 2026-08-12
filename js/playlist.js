/* ============================================
   HVL Music Player - Playlist Manager
   CRUD operations for playlists
   ============================================ */

class PlaylistManager {
  constructor(db) {
    this.db = db;
    this.currentPlaylistId = null;
    this.onChangeCallback = null;
  }

  onChange(callback) {
    this.onChangeCallback = callback;
  }

  _notifyChange() {
    if (this.onChangeCallback) {
      this.onChangeCallback();
    }
  }

  async create(name) {
    if (!name || !name.trim()) return null;
    const id = await this.db.createPlaylist(name.trim());
    this._notifyChange();
    return id;
  }

  async getAll() {
    return await this.db.getAllPlaylists();
  }

  async get(id) {
    return await this.db.getPlaylist(id);
  }

  async rename(id, newName) {
    if (!newName || !newName.trim()) return;
    await this.db.updatePlaylist(id, { name: newName.trim() });
    this._notifyChange();
  }

  async delete(id) {
    await this.db.deletePlaylist(id);
    this._notifyChange();
  }

  async addSong(playlistId, songId) {
    await this.db.addSongToPlaylist(playlistId, songId);
    this._notifyChange();
  }

  async removeSong(playlistId, songId) {
    await this.db.removeSongFromPlaylist(playlistId, songId);
    this._notifyChange();
  }

  async getPlaylistSongs(playlistId, allSongs) {
    const playlist = await this.db.getPlaylist(playlistId);
    if (!playlist) return [];

    // Return songs in playlist order
    const songMap = new Map(allSongs.map(s => [s.id, s]));
    return playlist.songIds
      .filter(id => songMap.has(id))
      .map(id => songMap.get(id));
  }

  async reorder(playlistId, songIds) {
    await this.db.updatePlaylist(playlistId, { songIds });
    this._notifyChange();
  }
}

// Export globally
window.PlaylistManager = PlaylistManager;
