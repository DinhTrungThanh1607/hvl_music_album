/* ============================================
   HVL Music Player - UI Controller
   Tabs, modals, toasts, DOM helpers
   ============================================ */

class UIController {
  constructor() {
    this.currentTab = 'library';
    this.toastContainer = null;
  }

  init() {
    this.toastContainer = document.getElementById('toastContainer');
    this._setupTabs();
  }

  // --- Tab Navigation ---

  _setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchTab(btn.dataset.tab);
      });
    });
  }

  switchTab(tabName) {
    this.currentTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab pages
    document.querySelectorAll('.tab-page').forEach(page => {
      page.classList.toggle('active', page.id === `tab-${tabName}`);
    });
  }

  // --- Modal ---

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      // Close on overlay click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal(modalId);
        }
      });
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
    }
  }

  // --- Context Menu ---

  openContextMenu(songId, songTitle) {
    const overlay = document.getElementById('contextMenuOverlay');
    const titleEl = overlay.querySelector('.context-menu-header .song-title');
    if (titleEl) titleEl.textContent = songTitle;
    overlay.dataset.songId = songId;
    overlay.classList.add('active');

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closeContextMenu();
      }
    }, { once: true });
  }

  closeContextMenu() {
    const overlay = document.getElementById('contextMenuOverlay');
    overlay.classList.remove('active');
  }

  // --- Toast Notifications ---

  showToast(message, type = 'info', duration = 3000) {
    if (!this.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // --- Full Player ---

  openFullPlayer() {
    document.getElementById('fullPlayer').classList.add('active');
  }

  closeFullPlayer() {
    document.getElementById('fullPlayer').classList.remove('active');
  }

  // --- Lyrics View ---

  openLyricsView() {
    document.getElementById('lyricsView').classList.add('active');
  }

  closeLyricsView() {
    document.getElementById('lyricsView').classList.remove('active');
  }

  // --- Mini Player ---

  showMiniPlayer() {
    document.getElementById('miniPlayer').classList.add('visible');
    // Adjust content padding
    document.querySelectorAll('.tab-page').forEach(page => {
      page.style.paddingBottom = `calc(${getComputedStyle(document.documentElement).getPropertyValue('--mini-player-height')} + ${getComputedStyle(document.documentElement).getPropertyValue('--tab-bar-height')} + ${getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom')} + var(--space-md))`;
    });
  }

  hideMiniPlayer() {
    document.getElementById('miniPlayer').classList.remove('visible');
  }

  // --- Song List Rendering ---

  renderSongList(container, songs, currentSongId, onPlay, onMore) {
    if (!container) return;

    if (songs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM21 16c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"/>
          </svg>
          <h3>Chưa có bài hát</h3>
          <p>Nhấn nút + để thêm nhạc vào thư viện</p>
        </div>
      `;
      return;
    }

    container.innerHTML = songs.map(song => `
      <li class="song-item ${song.id === currentSongId ? 'playing' : ''}" data-id="${song.id}">
        <div class="song-art">
          <div class="art-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM21 16c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"/>
            </svg>
          </div>
          <div class="song-playing-indicator">
            <span></span><span></span><span></span>
          </div>
        </div>
        <div class="song-info">
          <div class="song-title">${this._escapeHtml(song.title)}</div>
          <div class="song-artist">${this._escapeHtml(song.artist)}</div>
        </div>
        <span class="song-duration">${this._formatDuration(song.duration)}</span>
        <div class="song-actions">
          <button class="btn-icon btn-song-more" data-id="${song.id}" data-title="${this._escapeHtml(song.title)}" aria-label="Thêm tuỳ chọn">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="6" r="1.5"/>
              <circle cx="12" cy="12" r="1.5"/>
              <circle cx="12" cy="18" r="1.5"/>
            </svg>
          </button>
        </div>
      </li>
    `).join('');

    // Bind click events
    container.querySelectorAll('.song-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Don't trigger if clicking the more button
        if (e.target.closest('.btn-song-more')) return;
        const id = parseInt(item.dataset.id);
        if (onPlay) onPlay(id);
      });
    });

    container.querySelectorAll('.btn-song-more').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        const title = btn.dataset.title;
        if (onMore) onMore(id, title);
      });
    });
  }

  // --- Update Player UI ---

  updateMiniPlayer(song, isPlaying, progress) {
    const title = document.getElementById('miniPlayerTitle');
    const artist = document.getElementById('miniPlayerArtist');
    const progressFill = document.getElementById('miniPlayerProgressFill');
    const playBtn = document.getElementById('miniPlayerPlayBtn');

    if (title) title.textContent = song ? song.title : '';
    if (artist) artist.textContent = song ? song.artist : '';
    if (progressFill) progressFill.style.width = `${(progress || 0) * 100}%`;

    if (playBtn) {
      playBtn.innerHTML = isPlaying
        ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    }
  }

  updateFullPlayer(song, isPlaying) {
    const title = document.getElementById('fullPlayerTitle');
    const artist = document.getElementById('fullPlayerArtist');
    const playBtn = document.getElementById('fullPlayerPlayBtn');
    const artContainer = document.getElementById('fullPlayerArt');

    if (title) title.textContent = song ? song.title : '';
    if (artist) artist.textContent = song ? song.artist : '';

    if (playBtn) {
      playBtn.innerHTML = isPlaying
        ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    }

    if (artContainer) {
      artContainer.classList.toggle('playing', isPlaying);
      artContainer.classList.toggle('paused', !isPlaying);
    }
  }

  updateProgress(currentTime, duration) {
    const fill = document.getElementById('progressFill');
    const thumb = document.getElementById('progressThumb');
    const currentEl = document.getElementById('progressCurrent');
    const totalEl = document.getElementById('progressTotal');

    const percent = duration ? (currentTime / duration) * 100 : 0;

    if (fill) fill.style.width = `${percent}%`;
    if (currentEl) currentEl.textContent = this._formatTime(currentTime);
    if (totalEl) totalEl.textContent = this._formatTime(duration);

    // Also update lyrics view progress
    const lyricsFill = document.getElementById('lyricsProgressFill');
    if (lyricsFill) lyricsFill.style.width = `${percent}%`;
  }

  updateShuffleBtn(enabled) {
    const btn = document.getElementById('shuffleBtn');
    if (btn) btn.classList.toggle('active', enabled);
  }

  updateRepeatBtn(mode) {
    const btn = document.getElementById('repeatBtn');
    if (!btn) return;

    btn.classList.toggle('active', mode !== 'none');

    const svg = btn.querySelector('svg');
    if (mode === 'one') {
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 014-4h14"/>
        <path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 01-4 4H3"/>
        <text x="12" y="15" text-anchor="middle" font-size="8" fill="currentColor" stroke="none" font-weight="bold">1</text>
      </svg>`;
    } else {
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 014-4h14"/>
        <path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 01-4 4H3"/>
      </svg>`;
    }
  }

  // Highlight current song in list
  highlightCurrentSong(songId) {
    document.querySelectorAll('.song-item').forEach(item => {
      const isPlaying = parseInt(item.dataset.id) === songId;
      item.classList.toggle('playing', isPlaying);
    });
  }

  // --- Helpers ---

  _formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  _formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '';
    return this._formatTime(seconds);
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export globally
window.UIController = UIController;
