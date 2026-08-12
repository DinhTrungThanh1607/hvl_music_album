/* ============================================
   HVL Music Player - App Initialization
   Wires all modules together
   ============================================ */

class HVLApp {
  constructor() {
    this.db = new MusicDB();
    this.player = new AudioPlayer();
    this.importer = null;
    this.playlistManager = null;
    this.ui = new UIController();
    this.lyricsDisplay = null;
    this.allSongs = [];
    this.currentPlaylistView = null; // null = all songs, id = specific playlist
  }

  async init() {
    try {
      // Initialize database
      await this.db.init();
      this.importer = new MusicImporter(this.db);
      this.playlistManager = new PlaylistManager(this.db);

      // Initialize UI
      this.ui.init();

      // Initialize lyrics display
      const lyricsScrollEl = document.getElementById('lyricsScroll');
      if (lyricsScrollEl) {
        this.lyricsDisplay = new LyricsDisplay(lyricsScrollEl);
        this.lyricsDisplay.onSeek((time) => {
          this.player.seek(time);
        });
      }

      // Bind events
      this._bindPlayerEvents();
      this._bindUIEvents();
      this._bindImportEvents();
      this._bindPlaylistEvents();

      // Load initial data
      await this.refreshLibrary();
      await this.refreshPlaylists();

      // Register service worker
      this._registerServiceWorker();

      console.log('HVL Music Player initialized');
    } catch (err) {
      console.error('Failed to initialize app:', err);
      this.ui.showToast('Lỗi khởi tạo app', 'error');
    }
  }

  // --- Player Events ---

  _bindPlayerEvents() {
    this.player.on('songchange', async (song) => {
      this.ui.updateFullPlayer(song, false);
      this.ui.updateMiniPlayer(song, false, 0);
      this.ui.showMiniPlayer();
      this.ui.highlightCurrentSong(song.id);

      // Update lyrics view song info
      const lyricsTitle = document.getElementById('lyricsSongTitle');
      const lyricsArtist = document.getElementById('lyricsSongArtist');
      if (lyricsTitle) lyricsTitle.textContent = song.title;
      if (lyricsArtist) lyricsArtist.textContent = song.artist;

      // Load cover art
      const coverURL = await this.db.getSongCoverURL(song.id);
      this._updateCoverArt(coverURL);

      // Load lyrics
      const lyricsContent = await this.db.getSongLyrics(song.id);
      if (this.lyricsDisplay) {
        const parsed = LyricsParser.parse(lyricsContent);
        this.lyricsDisplay.setLyrics(parsed);
      }
    });

    this.player.on('play', (song) => {
      this.ui.updateFullPlayer(song, true);
      this.ui.updateMiniPlayer(song, true, this.player.progress);

      // Update lyrics play button
      const lyricsPlayBtn = document.getElementById('lyricsPlayBtn');
      if (lyricsPlayBtn) {
        lyricsPlayBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
      }
    });

    this.player.on('pause', (song) => {
      this.ui.updateFullPlayer(song, false);
      this.ui.updateMiniPlayer(song, false, this.player.progress);

      const lyricsPlayBtn = document.getElementById('lyricsPlayBtn');
      if (lyricsPlayBtn) {
        lyricsPlayBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
      }
    });

    this.player.on('timeupdate', ({ currentTime, duration }) => {
      this.ui.updateProgress(currentTime, duration);
      this.ui.updateMiniPlayer(this.player.currentSong, this.player.isPlaying, this.player.progress);

      // Update lyrics
      if (this.lyricsDisplay) {
        this.lyricsDisplay.update(currentTime);
      }
    });

    this.player.on('ended', async () => {
      await this.player.next(this.db);
    });

    this.player.on('mediaprev', async () => {
      await this.player.prev(this.db);
    });

    this.player.on('medianext', async () => {
      await this.player.next(this.db);
    });

    this.player.on('error', ({ error }) => {
      this.ui.showToast('Không thể phát bài hát này', 'error');
      console.error('Player error:', error);
    });

    this.player.on('shufflechange', (enabled) => {
      this.ui.updateShuffleBtn(enabled);
    });

    this.player.on('repeatchange', (mode) => {
      this.ui.updateRepeatBtn(mode);
    });
  }

  // --- UI Events ---

  _bindUIEvents() {
    // Mini player click -> open full player
    const miniPlayer = document.getElementById('miniPlayer');
    if (miniPlayer) {
      miniPlayer.addEventListener('click', (e) => {
        if (e.target.closest('.mini-player-controls')) return;
        this.ui.openFullPlayer();
      });
    }

    // Mini player controls
    document.getElementById('miniPlayerPlayBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.player.togglePlay();
    });

    document.getElementById('miniPlayerNextBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.player.next(this.db);
    });

    // Full player controls
    document.getElementById('btnCollapsePlayer')?.addEventListener('click', () => {
      this.ui.closeFullPlayer();
    });

    document.getElementById('fullPlayerPlayBtn')?.addEventListener('click', () => {
      this.player.togglePlay();
    });

    document.getElementById('prevBtn')?.addEventListener('click', () => {
      this.player.prev(this.db);
    });

    document.getElementById('nextBtn')?.addEventListener('click', () => {
      this.player.next(this.db);
    });

    document.getElementById('shuffleBtn')?.addEventListener('click', () => {
      this.player.toggleShuffle();
    });

    document.getElementById('repeatBtn')?.addEventListener('click', () => {
      this.player.cycleRepeat();
    });

    // Progress bar seeking
    const progressContainer = document.getElementById('progressBarContainer');
    if (progressContainer) {
      this._setupProgressSeek(progressContainer);
    }

    // Lyrics progress bar seeking
    const lyricsProgressContainer = document.getElementById('lyricsProgressContainer');
    if (lyricsProgressContainer) {
      this._setupProgressSeek(lyricsProgressContainer);
    }

    // Volume
    const volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => {
        this.player.setVolume(parseFloat(e.target.value));
      });
    }

    // Lyrics button
    document.getElementById('lyricsBtn')?.addEventListener('click', () => {
      this.ui.openLyricsView();
    });

    document.getElementById('btnCloseLyrics')?.addEventListener('click', () => {
      this.ui.closeLyricsView();
    });

    // Lyrics view controls
    document.getElementById('lyricsPlayBtn')?.addEventListener('click', () => {
      this.player.togglePlay();
    });

    document.getElementById('lyricsPrevBtn')?.addEventListener('click', () => {
      this.player.prev(this.db);
    });

    document.getElementById('lyricsNextBtn')?.addEventListener('click', () => {
      this.player.next(this.db);
    });

    // Full player more btn
    document.getElementById('fullPlayerMoreBtn')?.addEventListener('click', () => {
      if (this.player.currentSong) {
        this.ui.openContextMenu(this.player.currentSong.id, this.player.currentSong.title);
      }
    });

    // Search
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      let debounce = null;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          this._filterSongs(searchInput.value);
        }, 200);
      });
    }

    // Context menu items
    document.getElementById('ctxAddToPlaylist')?.addEventListener('click', () => {
      this.ui.closeContextMenu();
      this._showAddToPlaylistModal();
    });

    document.getElementById('ctxAddLyrics')?.addEventListener('click', () => {
      this.ui.closeContextMenu();
      this._importLyricsForSong();
    });

    document.getElementById('ctxDelete')?.addEventListener('click', () => {
      this.ui.closeContextMenu();
      this._deleteCurrentContextSong();
    });
  }

  _setupProgressSeek(container) {
    let isDragging = false;

    const seek = (e) => {
      const rect = container.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      const percent = Math.max(0, Math.min(1, x / rect.width));
      this.player.seekPercent(percent);
    };

    container.addEventListener('mousedown', (e) => {
      isDragging = true;
      container.classList.add('dragging');
      seek(e);
    });

    container.addEventListener('touchstart', (e) => {
      isDragging = true;
      container.classList.add('dragging');
      seek(e);
    }, { passive: true });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) seek(e);
    });

    document.addEventListener('touchmove', (e) => {
      if (isDragging) seek(e);
    }, { passive: true });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      container.classList.remove('dragging');
    });

    document.addEventListener('touchend', () => {
      isDragging = false;
      container.classList.remove('dragging');
    });
  }

  // --- Import Events ---

  _bindImportEvents() {
    const importBtn = document.getElementById('importBtn');
    const importModal = document.getElementById('importModal');
    const importClose = document.getElementById('importClose');
    const dropZone = document.getElementById('importDropZone');
    const fileInput = document.getElementById('fileInput');

    importBtn?.addEventListener('click', () => {
      this.ui.openModal('importModal');
    });

    importClose?.addEventListener('click', () => {
      this.ui.closeModal('importModal');
    });

    // Drop zone
    if (dropZone) {
      dropZone.addEventListener('click', () => {
        fileInput?.click();
      });

      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          this._handleImport(files);
        }
      });
    }

    fileInput?.addEventListener('change', (e) => {
      const files = e.target.files;
      if (files.length > 0) {
        this._handleImport(files);
      }
      // Reset input
      e.target.value = '';
    });
  }

  async _handleImport(files) {
    const progressBar = document.getElementById('importProgressFill');
    const progressText = document.getElementById('importProgressText');
    const progressSection = document.getElementById('importProgress');

    if (progressSection) progressSection.classList.remove('hidden');

    const results = await this.importer.importFiles(files, (current, total, name) => {
      const percent = (current / total) * 100;
      if (progressBar) progressBar.style.width = `${percent}%`;
      if (progressText) progressText.textContent = `Đang import ${current}/${total}: ${name}`;
    });

    if (progressText) {
      progressText.textContent = `Hoàn tất: ${results.success} bài thành công, ${results.failed} thất bại`;
    }

    // Refresh library
    await this.refreshLibrary();

    this.ui.showToast(`Đã thêm ${results.success} bài hát`, 'success');

    // Hide progress after delay
    setTimeout(() => {
      if (progressSection) progressSection.classList.add('hidden');
      if (progressBar) progressBar.style.width = '0%';
      this.ui.closeModal('importModal');
    }, 2000);
  }

  // --- Playlist Events ---

  _bindPlaylistEvents() {
    const createBtn = document.getElementById('createPlaylistBtn');
    const createInput = document.getElementById('createPlaylistInput');

    createBtn?.addEventListener('click', async () => {
      const name = createInput?.value;
      if (name && name.trim()) {
        await this.playlistManager.create(name);
        createInput.value = '';
        await this.refreshPlaylists();
        this.ui.showToast(`Đã tạo playlist "${name}"`, 'success');
      }
    });

    createInput?.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        createBtn?.click();
      }
    });

    // Back button from playlist detail
    document.getElementById('playlistBackBtn')?.addEventListener('click', () => {
      this._showPlaylistList();
    });

    // Play all in playlist
    document.getElementById('playlistPlayAllBtn')?.addEventListener('click', () => {
      this._playAllInCurrentPlaylist();
    });

    // Delete playlist
    document.getElementById('playlistDeleteBtn')?.addEventListener('click', async () => {
      if (this.currentPlaylistView && confirm('Xóa playlist này?')) {
        await this.playlistManager.delete(this.currentPlaylistView);
        this.currentPlaylistView = null;
        this._showPlaylistList();
        await this.refreshPlaylists();
        this.ui.showToast('Đã xóa playlist', 'success');
      }
    });
  }

  // --- Data Refresh ---

  async refreshLibrary() {
    this.allSongs = await this.db.getAllSongs();
    const songList = document.getElementById('songList');
    const songCount = document.getElementById('songCount');

    if (songCount) {
      songCount.textContent = `${this.allSongs.length} bài hát`;
    }

    this.ui.renderSongList(
      songList,
      this.allSongs,
      this.player.currentSong?.id,
      (songId) => this._playSongFromLibrary(songId),
      (songId, title) => this.ui.openContextMenu(songId, title)
    );
  }

  async refreshPlaylists() {
    const playlists = await this.playlistManager.getAll();
    const playlistList = document.getElementById('playlistList');
    if (!playlistList) return;

    // Always show "All Songs" first
    let html = `
      <li class="playlist-item" data-id="all">
        <div class="playlist-icon all-songs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM21 16c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"/>
          </svg>
        </div>
        <div class="playlist-info">
          <div class="playlist-name">Tất cả bài hát</div>
          <div class="playlist-count">${this.allSongs.length} bài</div>
        </div>
        <div class="playlist-arrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        </div>
      </li>
    `;

    playlists.forEach(pl => {
      html += `
        <li class="playlist-item" data-id="${pl.id}">
          <div class="playlist-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2z"/>
              <path d="M12 8v8m-3-5l3-3 3 3"/>
            </svg>
          </div>
          <div class="playlist-info">
            <div class="playlist-name">${this.ui._escapeHtml(pl.name)}</div>
            <div class="playlist-count">${pl.songIds.length} bài</div>
          </div>
          <div class="playlist-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
          </div>
        </li>
      `;
    });

    playlistList.innerHTML = html;

    // Bind clicks
    playlistList.querySelectorAll('.playlist-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        if (id === 'all') {
          this._showPlaylistDetail('all', 'Tất cả bài hát');
        } else {
          const pl = playlists.find(p => p.id === parseInt(id));
          if (pl) this._showPlaylistDetail(pl.id, pl.name);
        }
      });
    });
  }

  // --- Play from Library ---

  async _playSongFromLibrary(songId) {
    // Load all songs as queue
    const songIds = this.allSongs.map(s => s.id);
    this.player.loadQueue(songIds, songIds.indexOf(songId));
    await this.player.playSong(songId, this.db);
  }

  // --- Song Filtering ---

  _filterSongs(query) {
    const q = query.toLowerCase().trim();
    const filtered = q
      ? this.allSongs.filter(s =>
          s.title.toLowerCase().includes(q) ||
          s.artist.toLowerCase().includes(q)
        )
      : this.allSongs;

    const songList = document.getElementById('songList');
    this.ui.renderSongList(
      songList,
      filtered,
      this.player.currentSong?.id,
      (songId) => this._playSongFromLibrary(songId),
      (songId, title) => this.ui.openContextMenu(songId, title)
    );
  }

  // --- Cover Art ---

  _updateCoverArt(coverURL) {
    const fullArt = document.getElementById('fullPlayerArtImage');
    const fullBg = document.getElementById('fullPlayerBgImage');
    const miniArt = document.getElementById('miniPlayerArtImage');
    const lyricsBg = document.getElementById('lyricsBgImage');

    const defaultPlaceholder = null;

    if (coverURL) {
      if (fullArt) { fullArt.src = coverURL; fullArt.style.display = 'block'; }
      if (fullBg) { fullBg.src = coverURL; fullBg.style.display = 'block'; }
      if (miniArt) { miniArt.src = coverURL; miniArt.style.display = 'block'; }
      if (lyricsBg) { lyricsBg.src = coverURL; lyricsBg.style.display = 'block'; }
    } else {
      if (fullArt) fullArt.style.display = 'none';
      if (fullBg) fullBg.style.display = 'none';
      if (miniArt) miniArt.style.display = 'none';
      if (lyricsBg) lyricsBg.style.display = 'none';
    }
  }

  // --- Playlist Detail ---

  async _showPlaylistDetail(playlistId, name) {
    this.currentPlaylistView = playlistId;

    document.getElementById('playlistMainView').classList.add('hidden');
    document.getElementById('playlistDetail').classList.remove('hidden');
    document.getElementById('playlistDetailTitle').textContent = name;

    // Show/hide delete button (can't delete "All Songs")
    const deleteBtn = document.getElementById('playlistDeleteBtn');
    if (deleteBtn) {
      deleteBtn.classList.toggle('hidden', playlistId === 'all');
    }

    let songs;
    if (playlistId === 'all') {
      songs = this.allSongs;
    } else {
      songs = await this.playlistManager.getPlaylistSongs(playlistId, this.allSongs);
    }

    const detailSongList = document.getElementById('playlistDetailSongList');
    this.ui.renderSongList(
      detailSongList,
      songs,
      this.player.currentSong?.id,
      async (songId) => {
        const songIds = songs.map(s => s.id);
        this.player.loadQueue(songIds, songIds.indexOf(songId));
        await this.player.playSong(songId, this.db);
      },
      (songId, title) => this.ui.openContextMenu(songId, title)
    );
  }

  _showPlaylistList() {
    this.currentPlaylistView = null;
    document.getElementById('playlistMainView').classList.remove('hidden');
    document.getElementById('playlistDetail').classList.add('hidden');
  }

  async _playAllInCurrentPlaylist() {
    let songs;
    if (this.currentPlaylistView === 'all') {
      songs = this.allSongs;
    } else if (this.currentPlaylistView) {
      songs = await this.playlistManager.getPlaylistSongs(this.currentPlaylistView, this.allSongs);
    }

    if (songs && songs.length > 0) {
      const songIds = songs.map(s => s.id);
      this.player.loadQueue(songIds, 0);
      await this.player.playSong(songIds[0], this.db);
    }
  }

  // --- Context Menu Actions ---

  async _showAddToPlaylistModal() {
    const overlay = document.getElementById('contextMenuOverlay');
    const songId = parseInt(overlay.dataset.songId);

    const playlists = await this.playlistManager.getAll();
    if (playlists.length === 0) {
      this.ui.showToast('Hãy tạo playlist trước', 'error');
      return;
    }

    // Quick select: show first playlist or ask
    const playlistName = prompt('Chọn playlist (nhập tên):\n' + playlists.map(p => `- ${p.name}`).join('\n'));
    if (!playlistName) return;

    const match = playlists.find(p => p.name.toLowerCase() === playlistName.toLowerCase());
    if (match) {
      await this.playlistManager.addSong(match.id, songId);
      this.ui.showToast(`Đã thêm vào "${match.name}"`, 'success');
    } else {
      this.ui.showToast('Không tìm thấy playlist', 'error');
    }
  }

  async _importLyricsForSong() {
    const overlay = document.getElementById('contextMenuOverlay');
    const songId = parseInt(overlay.dataset.songId);

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.lrc';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        await this.importer.importLyricsForSong(songId, file);
        this.ui.showToast('Đã thêm lời bài hát', 'success');

        // Refresh if current song
        if (this.player.currentSong?.id === songId) {
          const lyrics = await this.db.getSongLyrics(songId);
          if (this.lyricsDisplay) {
            this.lyricsDisplay.setLyrics(LyricsParser.parse(lyrics));
          }
        }

        await this.refreshLibrary();
      }
    };
    input.click();
  }

  async _deleteCurrentContextSong() {
    const overlay = document.getElementById('contextMenuOverlay');
    const songId = parseInt(overlay.dataset.songId);

    if (confirm('Xóa bài hát này?')) {
      await this.db.deleteSong(songId);
      await this.refreshLibrary();
      await this.refreshPlaylists();
      this.ui.showToast('Đã xóa bài hát', 'success');
    }
  }

  // --- Service Worker ---

  _registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('Service Worker registered:', reg.scope))
        .catch(err => console.warn('Service Worker registration failed:', err));
    }
  }
}

// --- Initialize on DOM ready ---
document.addEventListener('DOMContentLoaded', () => {
  const app = new HVLApp();
  app.init();
  window.hvlApp = app; // For debugging
});
