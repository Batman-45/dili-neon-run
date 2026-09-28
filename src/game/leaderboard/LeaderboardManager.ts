/**
 * LeaderboardManager — Offline local Top-10 leaderboard for Dili: Neon Run.
 *
 * Persists player high scores in browser localStorage under the key 'dili-neon-run-leaderboard'.
 * Strictly offline, zero dependencies, defensive against corrupted storage or private browsing restrictions.
 */

export interface LeaderboardEntry {
  playerName: string;
  score: number;
  distance: number;
  timestamp: number;
}

export class LeaderboardManager {
  public static readonly STORAGE_KEY = 'dili-neon-run-leaderboard';
  public static readonly MAX_ENTRIES = 10;
  public static readonly MAX_NAME_LENGTH = 12;
  public static readonly DEFAULT_PLAYER_NAME = 'Dili Runner';

  private cachedEntries: LeaderboardEntry[] | null = null;

  constructor() {}

  /**
   * Sanitizes a player's entered nickname.
   * Strips control characters, trims whitespace, clamps to 12 chars max,
   * and falls back to a sensible default if empty.
   */
  public sanitizeName(rawName?: string | null): string {
    if (!rawName || typeof rawName !== 'string') {
      return '';
    }

    // Strip non-printable / control chars and tags
    const cleaned = rawName
      .replace(/[\u0000-\u001F\u007F-\u009F<>]/g, '')
      .trim();

    return cleaned.slice(0, LeaderboardManager.MAX_NAME_LENGTH);
  }

  /**
   * Loads and validates all leaderboard entries from localStorage.
   * Returns a sorted defensive copy (top 10).
   */
  public getEntries(): LeaderboardEntry[] {
    if (this.cachedEntries !== null) {
      return [...this.cachedEntries];
    }

    let parsed: unknown = null;
    try {
      const raw = localStorage.getItem(LeaderboardManager.STORAGE_KEY);
      if (raw) {
        parsed = JSON.parse(raw);
      }
    } catch {
      // In case of restricted/private storage or corrupted data, fail safely
      parsed = null;
    }

    const validated: LeaderboardEntry[] = [];

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (
          item &&
          typeof item === 'object' &&
          typeof (item as any).score === 'number' &&
          Number.isFinite((item as any).score) &&
          (item as any).score > 0
        ) {
          const name = this.sanitizeName((item as any).playerName) || LeaderboardManager.DEFAULT_PLAYER_NAME;
          const score = Math.floor((item as any).score);
          const distance = Math.max(0, Math.floor(Number((item as any).distance) || 0));
          const timestamp = Number.isFinite((item as any).timestamp)
            ? Number((item as any).timestamp)
            : Date.now();

          validated.push({
            playerName: name,
            score,
            distance,
            timestamp,
          });
        }
      }
    }

    this.sortEntries(validated);
    this.cachedEntries = validated.slice(0, LeaderboardManager.MAX_ENTRIES);
    return [...this.cachedEntries];
  }

  /**
   * Checks whether a given score and distance qualify to enter the Top 10.
   */
  public isHighScore(score: number, distance: number = 0): boolean {
    const s = Math.floor(score);
    if (s <= 0) return false;

    const entries = this.getEntries();
    if (entries.length < LeaderboardManager.MAX_ENTRIES) {
      return true;
    }

    const lowest = entries[entries.length - 1];
    if (s > lowest.score) return true;
    if (s === lowest.score && Math.floor(distance) > lowest.distance) return true;

    return false;
  }

  /**
   * Determines the 1-based rank (1 to 10) a score and distance would achieve,
   * or -1 if the score does not qualify.
   */
  public getRank(score: number, distance: number = 0): number {
    const s = Math.floor(score);
    const d = Math.floor(distance);
    if (!this.isHighScore(s, d)) return -1;

    const entries = this.getEntries();
    for (let i = 0; i < entries.length; i++) {
      if (s > entries[i].score) return i + 1;
      if (s === entries[i].score && d > entries[i].distance) return i + 1;
    }

    if (entries.length < LeaderboardManager.MAX_ENTRIES) {
      return entries.length + 1;
    }

    return -1;
  }

  /**
   * Adds a new entry into the leaderboard, sorts, trims to Top 10,
   * and persists back to localStorage.
   * Returns the achieved 1-based rank and updated entries.
   */
  public addEntry(entry: {
    playerName?: string;
    score: number;
    distance: number;
    timestamp?: number;
  }): { rank: number; entries: LeaderboardEntry[] } {
    const cleanName = this.sanitizeName(entry.playerName);
    if (!cleanName) {
      throw new Error('Callsign cannot be empty.');
    }

    const validatedEntry: LeaderboardEntry = {
      playerName: cleanName,
      score: Math.max(0, Math.floor(entry.score)),
      distance: Math.max(0, Math.floor(entry.distance)),
      timestamp: entry.timestamp ?? Date.now(),
    };

    const current = this.getEntries();
    current.push(validatedEntry);
    this.sortEntries(current);

    const top10 = current.slice(0, LeaderboardManager.MAX_ENTRIES);
    this.cachedEntries = top10;

    // Find rank of the newly added entry
    const rank = top10.indexOf(validatedEntry) + 1;

    this.saveToStorage(top10);
    return { rank, entries: [...top10] };
  }

  /**
   * Clears all local leaderboard entries.
   */
  public clearLeaderboard(): void {
    this.cachedEntries = [];
    try {
      localStorage.removeItem(LeaderboardManager.STORAGE_KEY);
    } catch {
      // Safe fallback
    }
  }

  private sortEntries(entries: LeaderboardEntry[]): void {
    entries.sort((a, b) => {
      // 1. Highest score first
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // 2. If scores are equal, highest distance first
      if (b.distance !== a.distance) {
        return b.distance - a.distance;
      }
      // 3. If both equal, earliest run first
      return a.timestamp - b.timestamp;
    });
  }

  private saveToStorage(entries: LeaderboardEntry[]): void {
    try {
      localStorage.setItem(LeaderboardManager.STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Safe fallback for quota or private mode restrictions
    }
  }
}
