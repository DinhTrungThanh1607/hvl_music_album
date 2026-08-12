/* ============================================
   HVL Music Player - LRC Lyrics Parser & Display
   Parses .lrc files and syncs with playback
   ============================================ */

class LyricsParser {
  /**
   * Parse LRC content into an array of { time, text } objects
   * @param {string} lrcContent - Raw LRC file content
   * @returns {Array<{time: number, text: string}>}
   */
  static parse(lrcContent) {
    if (!lrcContent) return [];

    const lines = lrcContent.split('\n');
    const lyrics = [];

    for (const line of lines) {
      // Match time tags: [mm:ss.xx] or [mm:ss.xxx]
      const timeRegex = /\[(\d{1,3}):(\d{2})\.(\d{2,3})\]/g;
      let match;
      const times = [];

      while ((match = timeRegex.exec(line)) !== null) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const ms = match[3].length === 2
          ? parseInt(match[3], 10) * 10
          : parseInt(match[3], 10);
        const time = minutes * 60 + seconds + ms / 1000;
        times.push(time);
      }

      // Get text content (after all time tags)
      const text = line.replace(/\[\d{1,3}:\d{2}\.\d{2,3}\]/g, '').trim();

      // Skip empty lines or metadata tags like [ti:], [ar:], etc.
      if (text && times.length > 0) {
        for (const time of times) {
          lyrics.push({ time, text });
        }
      }
    }

    // Sort by time
    lyrics.sort((a, b) => a.time - b.time);

    return lyrics;
  }
}

class LyricsDisplay {
  constructor(container) {
    this.container = container;
    this.lyrics = [];
    this.currentIndex = -1;
    this.onSeekCallback = null;
    this.autoScrollEnabled = true;
    this.userScrollTimeout = null;
  }

  /**
   * Set lyrics data and render
   * @param {Array<{time: number, text: string}>} lyrics
   */
  setLyrics(lyrics) {
    this.lyrics = lyrics;
    this.currentIndex = -1;
    this.render();
  }

  /**
   * Render lyrics lines into the container
   */
  render() {
    if (!this.container) return;

    if (!this.lyrics || this.lyrics.length === 0) {
      this.container.innerHTML = `
        <div class="lyrics-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM21 16c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"/>
          </svg>
          <p>Không có lời bài hát</p>
        </div>
      `;
      return;
    }

    // Add spacer at top and bottom for scrolling
    let html = '<div class="lyrics-spacer" style="height: 40vh"></div>';

    this.lyrics.forEach((lyric, index) => {
      html += `<div class="lyric-line upcoming" data-index="${index}" data-time="${lyric.time}">${lyric.text}</div>`;
    });

    html += '<div class="lyrics-spacer" style="height: 40vh"></div>';

    this.container.innerHTML = html;

    // Add click handlers for seek
    this.container.querySelectorAll('.lyric-line').forEach(el => {
      el.addEventListener('click', () => {
        const time = parseFloat(el.dataset.time);
        if (this.onSeekCallback) {
          this.onSeekCallback(time);
        }
      });
    });

    // Detect user scroll to temporarily disable auto-scroll
    this.container.addEventListener('scroll', () => {
      if (this.userScrollTimeout) {
        clearTimeout(this.userScrollTimeout);
      }
      this.autoScrollEnabled = false;
      this.userScrollTimeout = setTimeout(() => {
        this.autoScrollEnabled = true;
      }, 3000); // Re-enable after 3s of no scroll
    }, { passive: true });
  }

  /**
   * Update highlight based on current playback time
   * @param {number} currentTime - Current playback position in seconds
   */
  update(currentTime) {
    if (!this.lyrics || this.lyrics.length === 0) return;

    // Find current lyric index
    let newIndex = -1;
    for (let i = this.lyrics.length - 1; i >= 0; i--) {
      if (currentTime >= this.lyrics[i].time) {
        newIndex = i;
        break;
      }
    }

    if (newIndex === this.currentIndex) return;
    this.currentIndex = newIndex;

    // Update classes
    const lines = this.container.querySelectorAll('.lyric-line');
    lines.forEach((line, i) => {
      line.classList.remove('active', 'past', 'upcoming');
      if (i === this.currentIndex) {
        line.classList.add('active');
      } else if (i < this.currentIndex) {
        line.classList.add('past');
      } else {
        line.classList.add('upcoming');
      }
    });

    // Auto-scroll to active line
    if (this.autoScrollEnabled && this.currentIndex >= 0) {
      const activeLine = lines[this.currentIndex];
      if (activeLine) {
        const containerRect = this.container.getBoundingClientRect();
        const lineRect = activeLine.getBoundingClientRect();
        const targetScroll = activeLine.offsetTop - containerRect.height / 2 + lineRect.height / 2;

        this.container.scrollTo({
          top: targetScroll,
          behavior: 'smooth'
        });
      }
    }
  }

  /**
   * Register seek callback
   * @param {Function} callback - Called with time in seconds when user clicks a lyric line
   */
  onSeek(callback) {
    this.onSeekCallback = callback;
  }

  /**
   * Reset display
   */
  reset() {
    this.lyrics = [];
    this.currentIndex = -1;
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  /**
   * Get current line text
   */
  getCurrentLine() {
    if (this.currentIndex >= 0 && this.currentIndex < this.lyrics.length) {
      return this.lyrics[this.currentIndex].text;
    }
    return '';
  }
}

// Export globally
window.LyricsParser = LyricsParser;
window.LyricsDisplay = LyricsDisplay;
