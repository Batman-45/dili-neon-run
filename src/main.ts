import { Engine } from './core/Engine';
import { GameLoop } from './core/GameLoop';
import { GameStateManager, GameState } from './core/GameStateManager';
import { TrackManager } from './game/track/TrackManager';
import { CitySkyline } from './game/track/CitySkyline';
import { DiliCharacter, CharacterState } from './game/character/DiliCharacter';
import { HUD } from './ui/HUD';
import { InputManager } from './input/InputManager';
import { AudioManager } from './audio/AudioManager';
import { ObstacleManager } from './game/obstacles/ObstacleManager';
import { ComboSystem } from './game/systems/ComboSystem';
import { CollisionSystem } from './game/systems/CollisionSystem';
import { DifficultyCurve } from './game/systems/DifficultyCurve';
import { CollectibleManager } from './game/collectibles/CollectibleManager';
import { PowerUpSystem } from './game/systems/PowerUpSystem';
import { PowerUpType } from './game/collectibles/CollectibleTypes';

/**
 * Dili: Neon Run — Phase 5: Premium UI + Polish
 * Central bootstrap — wires all systems together under a centralized GameStateManager.
 */
function initGame(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Game canvas element not found!');

  // ============================================================
  // 1. CORE SYSTEMS
  // ============================================================
  const engine = new Engine({ canvas });
  const audio  = new AudioManager();
  const hud    = new HUD();
  const loop   = new GameLoop();

  // ============================================================
  // 2. GAME WORLD SYSTEMS
  // ============================================================
  const trackManager    = new TrackManager(engine.scene);
  const citySkyline     = new CitySkyline(engine.scene);
  const obstacleManager = new ObstacleManager(engine.scene);
  const comboSystem     = new ComboSystem();

  let isDashing = false;

  const powerUpSystem = new PowerUpSystem({
    onShieldActivated: () => {
      dili.setShieldVisible(true);
      audio.playShieldActivate();
    },
    onShieldBroken: () => {
      dili.setShieldVisible(false);
      audio.playShieldBreak();
    },
    onBoostActivated: (duration) => {
      audio.playBoostActivate();
      engine.kickFov(74, duration);
    },
    onBoostEnded: () => {},
  });

  const dili = new DiliCharacter(engine.scene, {
    onDashStart: (duration) => {
      isDashing = true;
      audio.playDash();
      engine.kickFov(70, duration);
    },
    onDashEnd: () => {
      isDashing = false;
    },
    onStateChange: () => {
      // State badge removed from Phase 5 HUD — nothing to update.
    },
  });

  const collectibleManager = new CollectibleManager(engine.scene, {
    onBitCollected: () => {
      comboSystem.onBitCollected();
      audio.playBitPickup();
      hud.updateBits(comboSystem.bitsCollected);
    },
    onPowerUpCollected: (type) => {
      powerUpSystem.activate(type);
      switch (type) {
        case PowerUpType.MAGNET:      audio.playMagnetActivate();     break;
        case PowerUpType.BOOST:       /* played via onBoostActivated */ break;
        case PowerUpType.MULTIPLIER:  audio.playMultiplierActivate(); break;
        default: break;
      }
    },
  });

  // ============================================================
  // 3. COLLISION SYSTEM (wires into GameStateManager crash)
  // ============================================================
  // Declared ahead of stateManager so the crash callback can reference it.
  let previousBestScore = comboSystem.personalBest;

  const collisionSystem = new CollisionSystem(
    dili,
    comboSystem,
    audio,
    engine,
    powerUpSystem,
    {
      onNearMiss: () => {
        hud.showNearMiss(comboSystem.comboMultiplier);
      },
      onCrash: () => {
        // Delegate to state manager — it will trigger showGameOverScreen below.
        stateManager.crash();
      },
    }
  );

  // ============================================================
  // 4. GAME STATE MANAGER
  // ============================================================
  const stateManager = new GameStateManager({

    onStartGame: () => {
      audio.stopAmbientLoop();
      runCountdown(() => {
        hud.showHUD();
        audio.startInGameBGM();
        loop.resume();
      });
    },

    onPause: () => {
      loop.pause();
      audio.playPause();
      audio.pauseInGameBGM();
      showScreen('screen-pause');
    },

    onResume: () => {
      loop.resume();
      audio.playMenuClick();
      audio.resumeInGameBGM();
      showScreen(null); // hide all overlays, show HUD
    },

    onRestart: () => {
      resetGameWorld();
      hud.showHUD();
      audio.startInGameBGM();
      loop.resume();
      showScreen(null);
    },

    onCrash: () => {
      loop.pause();
      audio.stopInGameBGM(0.3);

      const isNewBest = comboSystem.score > previousBestScore;
      previousBestScore = comboSystem.personalBest;

      hud.populateGameOver(
        comboSystem.score,
        comboSystem.bitsCollected,
        trackManager.distanceRun,
        comboSystem.nearMissCount,
        comboSystem.maxComboAchieved,
        comboSystem.personalBest,
        isNewBest
      );

      if (isNewBest) {
        audio.playNewBest();
      }

      hud.setStartPersonalBest(comboSystem.personalBest);

      // Small delay so the crash animation can play before the screen appears
      setTimeout(() => {
        showScreen('screen-gameover');
      }, 600);
    },

    onReturnToTitle: () => {
      resetGameWorld();
      hud.hideHUD();
      audio.stopInGameBGM(0.1);
      audio.startAmbientLoop();
      hud.setStartPersonalBest(comboSystem.personalBest);
      showScreen('screen-start');
    },
  });

  // ============================================================
  // 5. SCREEN MANAGEMENT HELPERS
  // ============================================================

  function showScreen(screenId: string | null): void {
    // Deactivate all game screens
    document.querySelectorAll<HTMLElement>('.game-screen').forEach(el => {
      el.classList.remove('active');
    });
    if (screenId) {
      document.getElementById(screenId)?.classList.add('active');
    }
  }

  // ============================================================
  // 6. COUNTDOWN HELPER (3-2-1 before run starts)
  // ============================================================

  function runCountdown(onComplete: () => void): void {
    const cdScreen  = document.getElementById('screen-countdown')!;
    const cdNumber  = document.getElementById('countdown-number')!;

    hud.hideHUD();
    showScreen('screen-countdown');

    let step = 3;

    function tick(): void {
      cdNumber.textContent = step === 0 ? 'GO!' : `${step}`;
      cdNumber.style.animation = 'none';
      // Force reflow to restart animation
      void cdNumber.offsetWidth;
      cdNumber.style.animation = 'countdown-pop 0.35s cubic-bezier(0.2, 1.5, 0.4, 1)';

      audio.playCountdownTone(step === 0 ? 1 : step);

      if (step === 0) {
        setTimeout(() => {
          cdScreen.classList.remove('active');
          onComplete();
        }, 400);
        return;
      }

      step--;
      setTimeout(tick, 700);
    }

    tick();
  }

  // ============================================================
  // 7. WORLD RESET
  // ============================================================

  function resetGameWorld(): void {
    dili.reset();
    obstacleManager.reset();
    collectibleManager.reset();
    powerUpSystem.reset();
    comboSystem.reset();
    trackManager.distanceRun = 0;
    trackManager.speed = 22;
    isDashing = false;
    hud.resetHUD();
  }

  // ============================================================
  // 8. INPUT SYSTEM
  // ============================================================

  // InputManager is kept alive purely for its side-effect (event listeners)
  void new InputManager({
    onLaneLeft: () => {
      if (!stateManager.isPlaying()) return;
      if (dili.getState() === CharacterState.CRASHED) return;
      const moved = dili.switchLane(-1);
      if (moved) hud.updateLane(dili.currentLane);
    },
    onLaneRight: () => {
      if (!stateManager.isPlaying()) return;
      if (dili.getState() === CharacterState.CRASHED) return;
      const moved = dili.switchLane(1);
      if (moved) hud.updateLane(dili.currentLane);
    },
    onJump: () => {
      if (!stateManager.isPlaying()) return;
      if (dili.getState() === CharacterState.CRASHED) return;
      const jumped = dili.jump();
      if (jumped) audio.playJump();
    },
    onSlide: () => {
      if (!stateManager.isPlaying()) return;
      if (dili.getState() === CharacterState.CRASHED) return;
      const slid = dili.slide();
      if (slid) audio.playSlide();
    },
    onDash: () => {
      if (!stateManager.isPlaying()) return;
      if (dili.getState() === CharacterState.CRASHED) return;
      dili.dash();
    },
  });

  // Keyboard: Escape / P toggles pause during gameplay
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
      const state = stateManager.getState();
      if (state === GameState.PLAYING || state === GameState.PAUSED) {
        stateManager.togglePause();
      }
    }
  });

  // Browser first-gesture audio unlock across touch, click and keydown
  const unlockAudioOnGesture = () => {
    audio.unlockAudio();
    window.removeEventListener('touchstart', unlockAudioOnGesture);
    window.removeEventListener('pointerdown', unlockAudioOnGesture);
    window.removeEventListener('click', unlockAudioOnGesture);
    window.removeEventListener('keydown', unlockAudioOnGesture);
  };
  window.addEventListener('touchstart', unlockAudioOnGesture, { passive: true, once: true });
  window.addEventListener('pointerdown', unlockAudioOnGesture, { passive: true, once: true });
  window.addEventListener('click', unlockAudioOnGesture, { once: true });
  window.addEventListener('keydown', unlockAudioOnGesture, { once: true });

  // Browser tab visibility lifecycle: auto-pause gameplay & suspend/restore audio cleanly
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (stateManager.isPlaying()) {
        stateManager.togglePause();
      }
      audio.suspendAudio();
    } else {
      audio.resumeAudio();
    }
  });

  // ============================================================
  // 9. BUTTON WIRING (all screens)
  // ============================================================

  // Start screen
  document.getElementById('btn-play')?.addEventListener('click', () => {
    audio.playMenuClick();
    stateManager.startGame();
  });

  document.getElementById('btn-start-mute')?.addEventListener('click', () => {
    const muted = audio.toggleMute();
    hud.syncMuteIcons(muted);
  });

  // Pause screen
  document.getElementById('btn-resume')?.addEventListener('click', () => {
    stateManager.resume();
  });

  document.getElementById('btn-pause-restart')?.addEventListener('click', () => {
    audio.playMenuClick();
    stateManager.restart();
  });

  document.getElementById('btn-title')?.addEventListener('click', () => {
    audio.playMenuBack();
    stateManager.returnToTitle();
  });

  document.getElementById('btn-pause-mute')?.addEventListener('click', () => {
    const muted = audio.toggleMute();
    hud.syncMuteIcons(muted);
  });

  // HUD pause button
  document.getElementById('btn-pause')?.addEventListener('click', () => {
    if (stateManager.getState() === GameState.PLAYING) {
      stateManager.togglePause();
    }
  });

  // Game Over screen
  document.getElementById('btn-restart')?.addEventListener('click', () => {
    audio.playMenuClick();
    stateManager.restart();
  });

  document.getElementById('btn-gameover-title')?.addEventListener('click', () => {
    audio.playMenuBack();
    stateManager.returnToTitle();
  });

  // ============================================================
  // 10. GAME LOOP
  // ============================================================

  loop.onUpdate((delta) => {
    const isCrashed = dili.getState() === CharacterState.CRASHED;

    if (!isCrashed && stateManager.isPlaying()) {
      // Difficulty curve
      const diff = DifficultyCurve.getSettings(trackManager.distanceRun);

      // Speed modifiers
      let speedMult = 1.0;
      if (isDashing)                       speedMult = 1.75;
      else if (powerUpSystem.isBoostActive()) speedMult = 1.45;

      const targetSpeed = diff.speed * speedMult;
      trackManager.speed += (targetSpeed - trackManager.speed) * Math.min(delta * 4, 1);
      const moveStep = trackManager.speed * delta;

      powerUpSystem.update(delta);
      comboSystem.powerUpMultiplier = powerUpSystem.isMultiplierActive() ? 2 : 1;

      trackManager.update(delta);
      citySkyline.update(delta, trackManager.speed);

      obstacleManager.update(delta, moveStep, trackManager.distanceRun);
      collectibleManager.update(delta, moveStep, dili.group.position, powerUpSystem.isMagnetActive());
      collectibleManager.checkCollisions(dili.boundingBox, dili.group.position);

      comboSystem.addDistanceScore(moveStep);
      comboSystem.update(delta);

      collisionSystem.check(obstacleManager.getActiveObstacles());
    }

    // Always update character physics (so crash animation plays while paused overlay fades in)
    dili.update(delta, isCrashed ? 0 : trackManager.speed);

    engine.update(delta, dili.group.position.x);

    // HUD updates only when gameplay is active
    if (stateManager.isPlaying()) {
      hud.updateDistance(trackManager.distanceRun);
      hud.updateScore(comboSystem.score);
      hud.updateBits(comboSystem.bitsCollected);
      hud.updateCombo(comboSystem.getEffectiveMultiplier());
      hud.updatePowerUp(powerUpSystem.getActivePowerUp());
      hud.updateDashGauge(
        dili.getDashCooldownNormalized(),
        dili.getState() === CharacterState.DASHING,
        dili.canDash()
      );
    }
  });

  loop.setRender(() => {
    engine.render();
  });

  // ============================================================
  // 11. INITIALISE — show start screen, start loop (paused)
  // ============================================================

  // Initialise HUD values silently
  hud.resetHUD();
  hud.hideHUD();
  hud.setStartPersonalBest(comboSystem.personalBest);
  hud.syncMuteIcons(audio.isSoundMuted());

  // The start screen is active (`.active` set in HTML), so just start the
  // loop in paused mode so Three.js renders the background scene.
  loop.start();
  loop.pause();

  // Start ambient drone for the title screen
  // (deferred 200ms to let browser settle audio graph)
  setTimeout(() => audio.startAmbientLoop(), 200);

  console.log('⚡ Dili: Neon Run — Phase 5: Premium UI + Polish active.');
}

window.addEventListener('DOMContentLoaded', initGame);
