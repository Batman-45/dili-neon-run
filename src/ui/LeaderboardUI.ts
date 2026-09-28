import { LeaderboardManager } from '../game/leaderboard/LeaderboardManager';

/**
 * LeaderboardUI — manages DOM interactions for the Leaderboard modal
 * and the Game-Over high score entry prompt.
 *
 * Strictly adheres to DOM security:
 * - Player names and numbers are ALWAYS rendered using textContent.
 * - Zero innerHTML with dynamic user input.
 * - Zero execution in the animation frame / game loop.
 */
export class LeaderboardUI {
  private readonly manager: LeaderboardManager;

  // Leaderboard Screen Elements
  private readonly listEl: HTMLElement | null;
  private readonly emptyEl: HTMLElement | null;
  private readonly backBtn: HTMLElement | null;
  private readonly clearPromptBtn: HTMLElement | null;
  private readonly clearConfirmBox: HTMLElement | null;
  private readonly clearCancelBtn: HTMLElement | null;
  private readonly clearConfirmBtn: HTMLElement | null;

  // Game-Over High Score Prompt Elements
  private readonly entryPanel: HTMLElement | null;
  private readonly badgeEl: HTMLElement | null;
  private readonly nameInput: HTMLInputElement | null;
  private readonly submitBtn: HTMLButtonElement | null;
  private readonly feedbackEl: HTMLElement | null;

  private onBackCallback: (() => void) | null = null;
  private activeScore: number = 0;
  private activeDistance: number = 0;
  private activeOnSavedCallback: ((rank: number) => void) | null = null;
  private hasSavedThisSession: boolean = false;

  constructor(manager: LeaderboardManager) {
    this.manager = manager;

    // Leaderboard screen elements
    this.listEl          = document.getElementById('leaderboard-entries-list');
    this.emptyEl         = document.getElementById('leaderboard-empty-state');
    this.backBtn         = document.getElementById('btn-leaderboard-back');
    this.clearPromptBtn  = document.getElementById('btn-leaderboard-clear-prompt');
    this.clearConfirmBox = document.getElementById('leaderboard-clear-confirm');
    this.clearCancelBtn  = document.getElementById('btn-clear-cancel');
    this.clearConfirmBtn = document.getElementById('btn-clear-confirm');

    // Game-over entry prompt elements
    this.entryPanel = document.getElementById('gameover-leaderboard-entry');
    this.badgeEl    = this.entryPanel?.querySelector('.leaderboard-entry-badge') ?? null;
    this.nameInput  = document.getElementById('leaderboard-player-input') as HTMLInputElement | null;
    this.submitBtn  = document.getElementById('btn-submit-score') as HTMLButtonElement | null;
    this.feedbackEl = document.getElementById('leaderboard-entry-feedback');

    this.initEventListeners();
  }

  private initEventListeners(): void {
    // Back button
    this.backBtn?.addEventListener('click', () => {
      this.closeClearConfirm();
      this.onBackCallback?.();
    });

    // Clear confirmation toggle
    this.clearPromptBtn?.addEventListener('click', () => {
      this.clearConfirmBox?.classList.remove('hidden');
    });

    this.clearCancelBtn?.addEventListener('click', () => {
      this.closeClearConfirm();
    });

    this.clearConfirmBtn?.addEventListener('click', () => {
      this.manager.clearLeaderboard();
      this.closeClearConfirm();
      this.renderEntriesList();
    });

    // Game-Over submission
    this.submitBtn?.addEventListener('click', () => {
      this.handleSubmitScore();
    });

    this.nameInput?.addEventListener('input', () => {
      if (this.feedbackEl && this.feedbackEl.classList.contains('error')) {
        this.feedbackEl.classList.add('hidden');
        this.feedbackEl.textContent = '';
      }
    });

    this.nameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleSubmitScore();
      }
    });
  }

  private closeClearConfirm(): void {
    this.clearConfirmBox?.classList.add('hidden');
  }

  // =============================================
  // LEADERBOARD SCREEN
  // =============================================

  /**
   * Opens the leaderboard modal and renders the current Top 10 entries safely.
   */
  public openLeaderboard(onBack: () => void): void {
    this.onBackCallback = onBack;
    this.closeClearConfirm();
    this.renderEntriesList();
  }

  /**
   * Safely renders the top 10 entries into the list DOM without innerHTML.
   */
  public renderEntriesList(): void {
    const list = this.listEl;
    if (!list || !this.emptyEl) return;

    // Clear existing children
    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }

    const entries = this.manager.getEntries();

    if (entries.length === 0) {
      this.emptyEl.classList.remove('hidden');
      return;
    }

    this.emptyEl.classList.add('hidden');

    entries.forEach((entry, index) => {
      const rank = index + 1;
      const row = document.createElement('div');
      row.className = 'leaderboard-row';
      if (rank === 1) row.classList.add('rank-first');
      else if (rank === 2) row.classList.add('rank-second');
      else if (rank === 3) row.classList.add('rank-third');

      // Rank column
      const rankCol = document.createElement('span');
      rankCol.className = 'col-rank';
      rankCol.textContent = `#${rank}`;
      row.appendChild(rankCol);

      // Player name column (SECURE: textContent strictly prevents XSS)
      const nameCol = document.createElement('span');
      nameCol.className = 'col-name';
      nameCol.textContent = entry.playerName;
      row.appendChild(nameCol);

      // Score column
      const scoreCol = document.createElement('span');
      scoreCol.className = 'col-score';
      scoreCol.textContent = entry.score.toLocaleString();
      row.appendChild(scoreCol);

      // Distance column
      const distCol = document.createElement('span');
      distCol.className = 'col-dist';
      distCol.textContent = `${entry.distance}m`;
      row.appendChild(distCol);

      list.appendChild(row);
    });
  }

  // =============================================
  // GAME-OVER HIGH SCORE PROMPT
  // =============================================

  /**
   * Checks whether the run's final score qualifies for the Top 10.
   * If qualified, reveals the callsign entry form on the Game Over screen.
   * If not qualified, leaves the existing Game Over screen untouched.
   */
  public checkAndPromptHighScore(
    score: number,
    distance: number,
    onSaved?: (rank: number) => void
  ): boolean {
    this.activeScore = score;
    this.activeDistance = distance;
    this.activeOnSavedCallback = onSaved ?? null;
    this.hasSavedThisSession = false;

    const qualifies = this.manager.isHighScore(score, distance);

    if (!qualifies || !this.entryPanel) {
      this.hideHighScorePrompt();
      return false;
    }

    const rank = this.manager.getRank(score, distance);

    // Reset prompt UI
    this.entryPanel.classList.remove('hidden');
    if (this.badgeEl) {
      this.badgeEl.textContent = rank > 0
        ? `🏆 TOP 10 QUALIFIED! [RANK #${rank}]`
        : '🏆 TOP 10 QUALIFIED!';
    }

    if (this.nameInput) {
      this.nameInput.disabled = false;
      this.nameInput.value = '';
      this.nameInput.placeholder = 'Enter callsign';
    }

    if (this.submitBtn) {
      this.submitBtn.disabled = false;
      this.submitBtn.textContent = 'SAVE';
    }

    if (this.feedbackEl) {
      this.feedbackEl.className = 'leaderboard-entry-feedback';
      this.feedbackEl.classList.add('hidden');
      this.feedbackEl.textContent = '';
    }

    // Gentle focus after Game Over modal fades in
    setTimeout(() => {
      this.nameInput?.focus();
    }, 450);

    return true;
  }

  private handleSubmitScore(): void {
    if (this.hasSavedThisSession || !this.entryPanel) return;

    const rawName = this.nameInput?.value ?? '';
    const cleanName = this.manager.sanitizeName(rawName);

    // Reject empty nickname / whitespace only
    if (cleanName.length === 0) {
      if (this.feedbackEl) {
        this.feedbackEl.className = 'leaderboard-entry-feedback error';
        this.feedbackEl.classList.remove('hidden');
        this.feedbackEl.textContent = 'Enter a callsign.';
      }
      this.nameInput?.focus();
      return;
    }

    const result = this.manager.addEntry({
      playerName: cleanName,
      score: this.activeScore,
      distance: this.activeDistance,
      timestamp: Date.now(),
    });

    this.hasSavedThisSession = true;

    // Lock input & update button
    if (this.nameInput) {
      this.nameInput.value = cleanName;
      this.nameInput.disabled = true;
    }

    if (this.submitBtn) {
      this.submitBtn.disabled = true;
      this.submitBtn.textContent = 'SAVED ✓';
    }

    // Display celebratory feedback text safely
    if (this.feedbackEl) {
      this.feedbackEl.className = 'leaderboard-entry-feedback';
      this.feedbackEl.classList.remove('hidden');
      this.feedbackEl.textContent = `🎉 Callsign registered! You're #${result.rank} on the Leaderboard!`;
    }

    this.activeOnSavedCallback?.(result.rank);
  }

  /**
   * Resets and hides the high score prompt (called on new run restart).
   */
  public hideHighScorePrompt(): void {
    this.hasSavedThisSession = false;
    this.activeScore = 0;
    this.activeDistance = 0;
    this.activeOnSavedCallback = null;

    if (this.entryPanel) {
      this.entryPanel.classList.add('hidden');
    }
    if (this.feedbackEl) {
      this.feedbackEl.classList.add('hidden');
      this.feedbackEl.textContent = '';
    }
  }
}
