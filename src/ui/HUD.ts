import type { LaneIndex } from '../game/character/DiliCharacter';
import type { ActivePowerUpStatus } from '../game/collectibles/CollectibleTypes';

/**
 * HUD — manages all DOM overlays for Dili: Neon Run.
 * Phase 5: Premium UI + Polish + Subway Surfers clarity power-up feedback.
 */
export class HUD {
  // Gameplay HUD metrics
  private distanceEl: HTMLElement | null;
  private scoreEl: HTMLElement | null;
  private bitsEl: HTMLElement | null;
  private comboEl: HTMLElement | null;

  // Prominent Score Multiplier Badge (near score/combo)
  private multiplierBadgeEl: HTMLElement | null;
  private multiplierValEl: HTMLElement | null;

  // Lane indicator
  private laneNodes: NodeListOf<HTMLElement>;

  // Dash gauge
  private dashStatusEl: HTMLElement | null;
  private dashFillEl: HTMLElement | null;

  // Power-up pickup announcement banner (0.8-1.2s punch/scale)
  private pickupBannerEl: HTMLElement | null;
  private pickupIconEl: HTMLElement | null;
  private pickupTextEl: HTMLElement | null;
  private pickupTimeoutId: number = 0;

  // Hyper Boost full-screen speed-lines overlay
  private speedLinesOverlayEl: HTMLElement | null;

  // Active Power-Ups Stack container (Subway Surfers multi-boost indicator)
  private powerupContainerEl: HTMLElement | null;

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

  private distanceTextNode: Text | null = null;
  private lastDisplayedDistance: number = -1;
  private lastDisplayedScore: number = -1;
  private lastDisplayedBits: number = -1;
  private lastDisplayedCombo: number = -1;
  private lastDashStatus: string = '';
  private lastDashPercent: number = -1;

  constructor() {
    this.distanceEl = document.getElementById('hud-distance');
    this.scoreEl    = document.getElementById('hud-score');
    this.bitsEl     = document.getElementById('hud-bits');
    this.comboEl    = document.getElementById('hud-combo');

    this.multiplierBadgeEl = document.getElementById('hud-multiplier-badge');
    this.multiplierValEl   = document.getElementById('hud-multiplier-val');

    this.pickupBannerEl    = document.getElementById('powerup-pickup-banner');
    this.pickupIconEl      = document.getElementById('pickup-banner-icon');
    this.pickupTextEl      = document.getElementById('pickup-banner-text');

    this.speedLinesOverlayEl = document.getElementById('speed-lines-overlay');
    this.powerupContainerEl  = document.getElementById('hud-powerup-container');

    if (this.distanceEl) {
      this.distanceEl.textContent = '';
      this.distanceTextNode = document.createTextNode('0 ');
      const unitSpan = document.createElement('span');
      unitSpan.className = 'metric-unit';
      unitSpan.textContent = 'm';
      this.distanceEl.appendChild(this.distanceTextNode);
      this.distanceEl.appendChild(unitSpan);
    }

    this.laneNodes    = document.querySelectorAll('.lane-node');
    this.dashStatusEl = document.getElementById('hud-dash-status');
    this.dashFillEl   = document.getElementById('hud-dash-fill');

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
    const d = Math.floor(meters);
    if (d !== this.lastDisplayedDistance) {
      this.lastDisplayedDistance = d;
      if (this.distanceTextNode) {
        this.distanceTextNode.nodeValue = `${d} `;
      } else if (this.distanceEl) {
        this.distanceEl.innerHTML = `${d} <span class="metric-unit">m</span>`;
      }
    }
  }

  public updateScore(score: number): void {
    const s = Math.floor(score);
    if (s !== this.lastDisplayedScore) {
      this.lastDisplayedScore = s;
      if (this.scoreEl) {
        this.scoreEl.textContent = s.toLocaleString();
      }
    }
  }

  public updateBits(bits: number): void {
    if (bits !== this.lastDisplayedBits) {
      this.lastDisplayedBits = bits;
      if (this.bitsEl) {
        this.bitsEl.textContent = `${bits}`;
      }
    }
  }

  public updateCombo(combo: number): void {
    if (combo !== this.lastDisplayedCombo) {
      this.lastDisplayedCombo = combo;
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
      if (this.lastDashStatus !== 'DASHING') {
        this.lastDashStatus = 'DASHING';
        this.dashStatusEl.textContent = 'DASHING';
        this.dashStatusEl.className = 'dash-status active';
        this.dashFillEl.className = 'dash-bar-fill active';
        this.dashFillEl.style.width = '100%';
        this.lastDashPercent = 100;
      }
    } else if (canDash) {
      if (this.lastDashStatus !== 'READY') {
        this.lastDashStatus = 'READY';
        this.dashStatusEl.textContent = 'READY';
        this.dashStatusEl.className = 'dash-status ready';
        this.dashFillEl.className = 'dash-bar-fill';
        this.dashFillEl.style.width = '100%';
        this.lastDashPercent = 100;
      }
    } else {
      const rechargePercent = Math.round((1 - cooldownNorm) * 100);
      if (this.lastDashStatus !== 'RECHARGE') {
        this.lastDashStatus = 'RECHARGE';
        this.dashStatusEl.textContent = 'RECHARGE';
        this.dashStatusEl.className = 'dash-status cooldown';
        this.dashFillEl.className = 'dash-bar-fill cooldown';
      }
      if (rechargePercent !== this.lastDashPercent) {
        this.lastDashPercent = rechargePercent;
        this.dashFillEl.style.width = `${rechargePercent}%`;
      }
    }
  }

  // =============================================
  // SCORE MULTIPLIER BADGE (Near score/combo area)
  // =============================================

  public updateMultiplierBadge(multiplierValue: number, isPowerUpActive: boolean): void {
    if (!this.multiplierBadgeEl || !this.multiplierValEl) return;

    if (isPowerUpActive || multiplierValue > 1) {
      const displayVal = isPowerUpActive ? '2×' : `${multiplierValue.toFixed(0)}×`;
      this.multiplierValEl.textContent = displayVal;
      this.multiplierBadgeEl.classList.remove('hidden');
    } else {
      this.multiplierBadgeEl.classList.add('hidden');
    }
  }

  // =============================================
  // POWER-UP PICKUP ANNOUNCEMENT (0.8-1.2s Punch Toast)
  // =============================================

  public showPickupAnnouncement(announcement: string, icon: string, colorCss: string): void {
    if (!this.pickupBannerEl || !this.pickupTextEl) return;

    if (this.pickupIconEl) this.pickupIconEl.textContent = icon;
    this.pickupTextEl.textContent = announcement;
    this.pickupBannerEl.style.borderColor = colorCss;
    this.pickupBannerEl.style.boxShadow = `0 0 24px ${colorCss}99, inset 0 0 12px ${colorCss}44`;
    this.pickupBannerEl.style.color = colorCss;

    this.pickupBannerEl.classList.remove('hidden');
    this.pickupBannerEl.classList.remove('punch');
    // Force DOM reflow to restart keyframe punch animation
    void this.pickupBannerEl.offsetWidth;
    this.pickupBannerEl.classList.add('punch');

    if (this.pickupTimeoutId) {
      clearTimeout(this.pickupTimeoutId);
    }
    this.pickupTimeoutId = window.setTimeout(() => {
      this.pickupBannerEl?.classList.remove('punch');
      this.pickupBannerEl?.classList.add('hidden');
      this.pickupTimeoutId = 0;
    }, 1000);
  }

  // =============================================
  // HYPER BOOST SPEED-LINES OVERLAY
  // =============================================

  public setSpeedLinesActive(active: boolean): void {
    if (!this.speedLinesOverlayEl) return;
    if (active) {
      this.speedLinesOverlayEl.classList.remove('hidden');
    } else {
      this.speedLinesOverlayEl.classList.add('hidden');
    }
  }

  // =============================================
  // ACTIVE POWER-UP STACK (Subway Surfers Multi-Boost Indicator)
  // =============================================

  private currentActivePowerUpTypes: string = '';

  public updatePowerUps(activeList: ActivePowerUpStatus[]): void {
    if (!this.powerupContainerEl) return;

    if (!activeList || activeList.length === 0) {
      if (this.currentActivePowerUpTypes !== '') {
        this.currentActivePowerUpTypes = '';
        this.powerupContainerEl.innerHTML = '';
        this.powerupContainerEl.classList.add('hidden');
      }
      return;
    }

    this.powerupContainerEl.classList.remove('hidden');

    const typeKey = activeList.map(item => item.type).join(',');

    // Rebuild DOM rows only when the set of active power-ups changes
    if (this.currentActivePowerUpTypes !== typeKey) {
      this.currentActivePowerUpTypes = typeKey;
      this.powerupContainerEl.innerHTML = activeList.map((item) => `
        <div class="hud-powerup-row" id="powerup-row-${item.type}" style="--boost-color: ${item.colorCss}; border-color: ${item.colorCss}">
          <div class="hud-powerup-icon-badge" style="background: ${item.colorCss}22; text-shadow: 0 0 8px ${item.colorCss}">
            ${item.icon}
          </div>
          <div class="hud-powerup-body">
            <div class="hud-powerup-header">
              <span class="hud-powerup-name" style="color: ${item.colorCss}">${item.label}</span>
              <span class="hud-powerup-time" id="powerup-time-${item.type}"></span>
            </div>
            <div class="hud-powerup-track">
              <div class="hud-powerup-fill" id="powerup-fill-${item.type}" style="background: ${item.colorCss}; box-shadow: 0 0 10px ${item.colorCss}"></div>
            </div>
          </div>
        </div>
      `).join('');
    }

    // Smoothly update countdown values & fill widths every frame without destroying DOM
    for (const item of activeList) {
      const timeEl = document.getElementById(`powerup-time-${item.type}`);
      const fillEl = document.getElementById(`powerup-fill-${item.type}`);
      const percent = item.isShield
        ? 100
        : Math.max(0, Math.min(100, (item.remaining / item.total) * 100));
      const timeStr = item.isShield ? 'ACTIVE' : `${item.remaining.toFixed(1)}s`;

      if (timeEl && timeEl.textContent !== timeStr) {
        timeEl.textContent = timeStr;
      }
      if (fillEl) {
        fillEl.style.width = `${percent}%`;
      }
    }
  }

  public updatePowerUp(info: ActivePowerUpStatus | null): void {
    this.updatePowerUps(info ? [info] : []);
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
    this.lastDisplayedDistance = -1;
    this.lastDisplayedScore = -1;
    this.lastDisplayedBits = -1;
    this.lastDisplayedCombo = -1;
    this.lastDashStatus = '';
    this.lastDashPercent = -1;

    this.updateScore(0);
    this.updateBits(0);
    this.updateCombo(1.0);
    this.updateDistance(0);
    this.updateLane(0);
    this.updatePowerUps([]);
    this.updateMultiplierBadge(1, false);
    this.setSpeedLinesActive(false);
    if (this.pickupTimeoutId) {
      clearTimeout(this.pickupTimeoutId);
      this.pickupTimeoutId = 0;
    }
    this.pickupBannerEl?.classList.add('hidden');
    this.updateDashGauge(0, false, true);
  }
}
