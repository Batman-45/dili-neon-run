import type { LaneIndex } from '../game/character/DiliCharacter';
import type { PowerUpType } from '../game/collectibles/CollectibleTypes';

/**
 * HUD — manages all DOM overlays for Dili: Neon Run.
 * Phase 5: FPS removed, speed removed, state badge removed from top bar.
 * Manages: gameplay HUD, near-miss toast, and populates result values for the
 * game-over screen (shown/hidden via GameStateManager → main.ts).
 */
export class HUD {
  // Gameplay HUD metrics
  private distanceEl: HTMLElement | null;
  private scoreEl: HTMLElement | null;
  private bitsEl: HTMLElement | null;
  private comboEl: HTMLElement | null;

  // Lane indicator
  private laneNodes: NodeListOf<HTMLElement>;

  // Dash gauge
  private dashStatusEl: HTMLElement | null;
  private dashFillEl: HTMLElement | null;

  // Active Power-Up badge
  private powerUpBadgeEl: HTMLElement | null;
  private powerUpIconEl: HTMLElement | null;
  private powerUpNameEl: HTMLElement | null;
  private powerUpFillEl: HTMLElement | null;

  // Near-miss banner
  private nearMissBanner: HTMLElement | null;
  private nearMissComboTag: HTMLElement | null;
  private nearMissTimeoutId: number = 0;

  // Start screen
  private startBestScoreEl: HTMLElement | null;

  // Game-Over result fields
  private resScoreEl: HTMLElement | null;
  private resBitsEl: HTMLElement | null;
  private resDistanceEl: HTMLElement | null;
  private resNearMissesEl: HTMLElement | null;
  private resMaxComboEl: HTMLElement | null;
  private resBestEl: HTMLElement | null;
  private newBestBadgeEl: HTMLElement | null;

  // Mute icon elements (synced between start/pause screens)
  private startMuteIconEl: HTMLElement | null;
  private pauseMuteIconEl: HTMLElement | null;

  // HUD overlay root
  private hudOverlayEl: HTMLElement | null;

  constructor() {
    this.distanceEl = document.getElementById('hud-distance');
    this.scoreEl    = document.getElementById('hud-score');
    this.bitsEl     = document.getElementById('hud-bits');
    this.comboEl    = document.getElementById('hud-combo');

    this.laneNodes    = document.querySelectorAll('.lane-node');
    this.dashStatusEl = document.getElementById('hud-dash-status');
    this.dashFillEl   = document.getElementById('hud-dash-fill');

    this.powerUpBadgeEl = document.getElementById('hud-powerup-badge');
    this.powerUpIconEl  = document.getElementById('hud-powerup-icon');
    this.powerUpNameEl  = document.getElementById('hud-powerup-name');
    this.powerUpFillEl  = document.getElementById('hud-powerup-fill');

    this.nearMissBanner    = document.getElementById('near-miss-banner');
    this.nearMissComboTag  = document.getElementById('near-miss-combo-tag');

    this.startBestScoreEl = document.getElementById('start-best-score');

    this.resScoreEl    = document.getElementById('res-score');
    this.resBitsEl     = document.getElementById('res-bits');
    this.resDistanceEl = document.getElementById('res-distance');
    this.resNearMissesEl = document.getElementById('res-near-misses');
    this.resMaxComboEl = document.getElementById('res-max-combo');
    this.resBestEl     = document.getElementById('res-best');
    this.newBestBadgeEl = document.getElementById('new-best-badge');

    this.startMuteIconEl = document.getElementById('start-mute-icon');
    this.pauseMuteIconEl = document.getElementById('pause-mute-icon');

    this.hudOverlayEl = document.getElementById('hud-overlay');
  }

  // =============================================
  // GAMEPLAY HUD UPDATES
  // =============================================

  public updateDistance(meters: number): void {
    if (this.distanceEl) {
      this.distanceEl.innerHTML = `${Math.floor(meters)} <span class="metric-unit">m</span>`;
    }
  }

  public updateScore(score: number): void {
    if (this.scoreEl) {
      this.scoreEl.textContent = Math.floor(score).toLocaleString();
    }
  }

  public updateBits(bits: number): void {
    if (this.bitsEl) {
      this.bitsEl.textContent = `${bits}`;
    }
  }

  public updateCombo(combo: number): void {
    if (this.comboEl) {
      this.comboEl.textContent = `${combo.toFixed(1)}x`;
      if (combo > 1) {
        this.comboEl.style.color = '#ff007f';
        this.comboEl.style.textShadow = '0 0 10px rgba(255, 0, 127, 0.6)';
      } else {
        this.comboEl.style.color = '#fff';
        this.comboEl.style.textShadow = 'none';
      }
    }
  }

  public updateLane(activeLane: LaneIndex): void {
    this.laneNodes.forEach((node) => {
      const laneAttr = parseInt(node.getAttribute('data-lane') || '0', 10);
      if (laneAttr === activeLane) {
        node.classList.add('active');
      } else {
        node.classList.remove('active');
      }
    });
  }

  public updateDashGauge(cooldownNorm: number, isDashing: boolean, canDash: boolean): void {
    if (!this.dashStatusEl || !this.dashFillEl) return;

    if (isDashing) {
      this.dashStatusEl.textContent = 'DASHING';
      this.dashStatusEl.className = 'dash-status active';
      this.dashFillEl.className = 'dash-bar-fill active';
      this.dashFillEl.style.width = '100%';
    } else if (canDash) {
      this.dashStatusEl.textContent = 'READY';
      this.dashStatusEl.className = 'dash-status ready';
      this.dashFillEl.className = 'dash-bar-fill';
      this.dashFillEl.style.width = '100%';
    } else {
      this.dashStatusEl.textContent = 'RECHARGE';
      this.dashStatusEl.className = 'dash-status cooldown';
      this.dashFillEl.className = 'dash-bar-fill cooldown';
      const rechargePercent = Math.round((1 - cooldownNorm) * 100);
      this.dashFillEl.style.width = `${rechargePercent}%`;
    }
  }

  public updatePowerUp(
    info: {
      type: PowerUpType;
      label: string;
      remaining: number;
      total: number;
      colorCss: string;
    } | null
  ): void {
    if (!this.powerUpBadgeEl || !this.powerUpIconEl || !this.powerUpNameEl || !this.powerUpFillEl) {
      return;
    }

    if (!info) {
      this.powerUpBadgeEl.classList.add('hidden');
      return;
    }

    this.powerUpBadgeEl.classList.remove('hidden');
    this.powerUpBadgeEl.style.borderColor = info.colorCss;
    this.powerUpBadgeEl.style.boxShadow = `0 0 16px ${info.colorCss}66`;

    this.powerUpNameEl.textContent = `${info.label} (${info.remaining.toFixed(1)}s)`;
    this.powerUpFillEl.style.background = info.colorCss;

    const percent = Math.max(0, Math.min(100, (info.remaining / info.total) * 100));
    this.powerUpFillEl.style.width = `${percent}%`;

    const iconMap: Record<string, string> = {
      SHIELD: '🛡️',
      MAGNET: '🧲',
      BOOST: '⚡',
      MULTIPLIER: '✨',
    };
    this.powerUpIconEl.textContent = iconMap[info.type] ?? '⚡';
  }

  // =============================================
  // NEAR-MISS TOAST
  // =============================================

  public showNearMiss(comboMultiplier: number): void {
    if (!this.nearMissBanner) return;

    if (this.nearMissComboTag) {
      this.nearMissComboTag.textContent = `+${150 * comboMultiplier} [${comboMultiplier}x]`;
    }

    this.nearMissBanner.classList.add('show');

    if (this.nearMissTimeoutId) {
      clearTimeout(this.nearMissTimeoutId);
    }

    this.nearMissTimeoutId = window.setTimeout(() => {
      this.nearMissBanner?.classList.remove('show');
      this.nearMissTimeoutId = 0;
    }, 750);
  }

  // =============================================
  // HUD VISIBILITY
  // =============================================

  /** Show the gameplay HUD overlay. */
  public showHUD(): void {
    this.hudOverlayEl?.classList.remove('hud-hidden');
  }

  /** Hide the gameplay HUD overlay (used on start/pause/gameover screens). */
  public hideHUD(): void {
    this.hudOverlayEl?.classList.add('hud-hidden');
  }

  // =============================================
  // START SCREEN
  // =============================================

  /** Display the personal best on the start screen. */
  public setStartPersonalBest(score: number): void {
    if (this.startBestScoreEl) {
      this.startBestScoreEl.textContent = score > 0
        ? Math.floor(score).toLocaleString()
        : '---';
    }
  }

  // =============================================
  // GAME-OVER / RESULTS POPULATION
  // =============================================

  /**
   * Populate the game-over results card values and show the new-best badge
   * if a new personal best was achieved. The screen itself is shown by main.ts
   * via GameStateManager.
   */
  public populateGameOver(
    score: number,
    bits: number,
    distance: number,
    nearMisses: number,
    maxCombo: number,
    bestScore: number,
    isNewBest: boolean
  ): void {
    if (this.resScoreEl)     this.resScoreEl.textContent    = Math.floor(score).toLocaleString();
    if (this.resBitsEl)      this.resBitsEl.textContent     = `${bits}`;
    if (this.resDistanceEl)  this.resDistanceEl.textContent = `${Math.floor(distance)} m`;
    if (this.resNearMissesEl) this.resNearMissesEl.textContent = `${nearMisses}`;
    if (this.resMaxComboEl)  this.resMaxComboEl.textContent = `${maxCombo.toFixed(1)}x`;
    if (this.resBestEl)      this.resBestEl.textContent     = Math.floor(bestScore).toLocaleString();

    if (this.newBestBadgeEl) {
      if (isNewBest) {
        this.newBestBadgeEl.classList.remove('hidden');
      } else {
        this.newBestBadgeEl.classList.add('hidden');
      }
    }
  }

  // =============================================
  // MUTE ICON SYNC
  // =============================================

  /** Keep sound toggle icons in sync across all screens. */
  public syncMuteIcons(isMuted: boolean): void {
    const icon = isMuted ? '🔇' : '🔊';
    if (this.startMuteIconEl) this.startMuteIconEl.textContent = icon;
    if (this.pauseMuteIconEl) this.pauseMuteIconEl.textContent = icon;
  }

  // =============================================
  // RESET (called on restart)
  // =============================================

  public resetHUD(): void {
    this.updateScore(0);
    this.updateBits(0);
    this.updateCombo(1.0);
    this.updateDistance(0);
    this.updateLane(0);
    this.updatePowerUp(null);
    this.updateDashGauge(0, false, true);
  }
}
