/**
 * selectiveDropSim.js
 * 
 * Coordinator for Selective Repeat ARQ Simulator ("SELECTIVE DROP"):
 * - Pre-game Visual Tutorial (4 slides, diagrams + minimal text)
 * - Left Zone: Physical Receiver Buffer Rack with capacity meter & ordered slots
 * - Center/Right Zone: Expanded Main Receiver Grid (12 columns x 18 rows)
 * - Persistent buffer state during retransmission
 * - Numerical sequential buffer release one packet at a time (450ms interval)
 * - Top-right 00 / 30 PACKETS progress counter
 * - Minimal clean gameplay interface without terminal or clutter
 */

import { ProtocolEngine, DIFFICULTY_PRESETS, FRAME_STATE, GROUP_STATE } from './protocolEngine.js';
import { GamePhysics } from './gamePhysics.js';

export const GAME_STATE = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  WON: 'WON',
  LOST: 'LOST'
};

export class SelectiveDropSim {
  constructor() {
    this.container = document.getElementById('simulation');
    if (!this.container) return;

    this.canvas = document.getElementById('simCanvas');
    this.canvasWrap = document.getElementById('simCanvasContainer');

    // Start Screen Elements
    this.startScreen = document.getElementById('simStartScreen');
    this.startBtn = document.getElementById('simStartBtn');

    // Pre-game Visual Tutorial Elements
    this.tutorialOverlay = document.getElementById('simTutorialOverlay');
    this.tutNextBtn = document.getElementById('tutNextBtn');
    this.tutSkipBtn = document.getElementById('tutSkipBtn');
    this.tutStepTag = document.getElementById('tutStepTag');
    this.tutDots = document.querySelectorAll('.tut-dot');
    this.tutSlides = document.querySelectorAll('.tut-slide');
    this.currentTutSlide = 0;

    // Pause Screen Elements
    this.pauseOverlay = document.getElementById('simPauseOverlay');
    this.resumeBtn = document.getElementById('simResumeBtn');
    this.pauseRestartBtn = document.getElementById('simPauseRestartBtn');

    // Top HUD Badges
    this.targetCountDisplay = document.getElementById('simTargetCount');
    this.groupLabel = document.getElementById('simGroupLabel');
    this.playPauseBtn = document.getElementById('simPlayPauseBtn');
    this.restartBtn = document.getElementById('simRestartBtn');

    // Dedicated Side Recovery Panel
    this.sideRecoveryPanel = document.getElementById('simSideRecoveryPanel');

    // On-Screen Touch / Mouse Control Buttons
    this.ctrlLeft = document.getElementById('ctrlLeft');
    this.ctrlRight = document.getElementById('ctrlRight');
    this.ctrlRotate = document.getElementById('ctrlRotate');
    this.ctrlSoftDrop = document.getElementById('ctrlSoftDrop');
    this.ctrlHardDrop = document.getElementById('ctrlHardDrop');

    // Minimal Result Screen (WIN / LOSE)
    this.resultModal = document.getElementById('simResultModal');
    this.resultCard = document.getElementById('simResultCard');
    this.resultTitle = document.getElementById('simModalTitle');
    this.resultRating = document.getElementById('simResultRating');
    this.resultScore = document.getElementById('simResultScore');
    this.resultGaugeArc = document.getElementById('simResultGaugeArc');
    this.resultMetrics = document.getElementById('simResultMetrics');
    this.modalRetryBtn = document.getElementById('simModalRetryBtn');
    this.modalCloseBtn = document.getElementById('simModalCloseBtn');

    // Simulator Configuration & State
    this.targetPackets = 30;

    this.gameState = GAME_STATE.MENU;
    this.isGameRunning = false;
    this.isPaused = false;
    this.isFocused = false;
    this.rafId = null;
    this.lastTimestamp = performance.now();
    this.dispatchTimers = [];

    // Active frame awaiting action
    this.activeActionSeq = null;

    // Sub-engines
    this.protocol = new ProtocolEngine();
    this.physics = new GamePhysics(this.canvas, {
      onGroupLanded: (groupId) => this.handleGroupLanded(groupId),
      onRecoveryDocked: (seq) => this.handleRecoveryDocked(seq),
      onRecoveryMissed: (seq) => this.handleRecoveryMissed(seq)
    });

    this.bindProtocolCallbacks();
  }

  init() {
    if (!this.container || !this.canvas) return;

    this.initStartScreen();
    this.initTutorial();
    this.initControls();
    this.initKeyboard();
    this.initModalActions();

    this.physics.reset();
    this.physics.render();
  }

  /* ========================================================================
     START SCREEN INITIALIZATION
     ======================================================================== */
  initStartScreen() {
    this.startBtn?.addEventListener('click', () => {
      this.showTutorial();
    });
  }

  /* ========================================================================
     PRE-GAME VISUAL TUTORIAL ONBOARDING
     ======================================================================== */
  initTutorial() {
    this.tutNextBtn?.addEventListener('click', () => {
      this.nextTutorialSlide();
    });

    this.tutSkipBtn?.addEventListener('click', () => {
      this.finishTutorialAndStart();
    });

    this.tutDots?.forEach((dot, idx) => {
      dot.addEventListener('click', () => {
        this.currentTutSlide = idx;
        this.updateTutorialSlide();
      });
    });
  }

  showTutorial() {
    if (this.startScreen) {
      this.startScreen.style.opacity = '0';
      this.startScreen.style.pointerEvents = 'none';
      setTimeout(() => {
        this.startScreen.style.display = 'none';
      }, 300);
    }

    if (this.tutorialOverlay) {
      this.tutorialOverlay.style.display = 'flex';
      this.tutorialOverlay.style.opacity = '1';
      this.currentTutSlide = 0;
      this.updateTutorialSlide();
    } else {
      this.startActualSimulation();
    }
  }

  updateTutorialSlide() {
    this.tutSlides = document.querySelectorAll('.tut-slide');
    this.tutDots = document.querySelectorAll('.tut-dot');

    this.tutSlides.forEach((slide, idx) => {
      slide.classList.toggle('active', idx === this.currentTutSlide);
    });

    this.tutDots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === this.currentTutSlide);
    });

    if (this.tutStepTag) {
      this.tutStepTag.textContent = `0${this.currentTutSlide + 1} / 04`;
    }

    if (this.tutNextBtn) {
      if (this.currentTutSlide === 3) {
        this.tutNextBtn.innerHTML = '<span>START SIMULATION ▶</span>';
      } else {
        this.tutNextBtn.innerHTML = '<span>NEXT →</span>';
      }
    }
  }

  nextTutorialSlide() {
    if (this.currentTutSlide < 3) {
      this.currentTutSlide++;
      this.updateTutorialSlide();
    } else {
      this.finishTutorialAndStart();
    }
  }

  finishTutorialAndStart() {
    if (this.tutorialOverlay) {
      this.tutorialOverlay.style.opacity = '0';
      setTimeout(() => {
        this.tutorialOverlay.style.display = 'none';
      }, 300);
    }
    this.startActualSimulation();
  }

  /* ========================================================================
     ACTIVE SIMULATION LIFECYCLE
     ======================================================================== */
  startActualSimulation() {
    this.gameState = GAME_STATE.PLAYING;
    this.isGameRunning = true;
    this.isPaused = false;
    this.activeActionSeq = null;
    this.clearAllTimers();
    this.hideResultModal();

    if (this.pauseOverlay) this.pauseOverlay.style.display = 'none';
    if (this.startScreen) this.startScreen.style.display = 'none';

    // Initialize sub-engines with targetPackets: 30, windowSize: 6, bufferCapacity: 8
    this.protocol.init('NORMAL', {
      targetPackets: 30,
      windowSize: 6,
      bufferCapacity: 8
    });

    this.physics.reset();
    this.physics.bufferCapacity = this.protocol.bufferCapacity;

    this.updateHUD();

    this.lastTimestamp = performance.now();
    this.startLoop();

    // Dispatch initial group (Group 01: COLUMN_6 with P01..P06 vertical stack)
    this.dispatchNextGroup();
  }

  clearAllTimers() {
    this.dispatchTimers.forEach(t => clearTimeout(t));
    this.dispatchTimers = [];
  }

  dispatchNextGroup() {
    if (this.gameState !== GAME_STATE.PLAYING || this.protocol.isComplete) return;

    if (this.physics.currentGroup || this.physics.currentRecoveryPacket) return;

    // SAFE RECOVERY: Pause new group dispatch while recovery is required or releasing
    if (this.protocol.activeMissingSeq || this.protocol.isReleasingBuffer) {
      return;
    }

    const group = this.protocol.getNextGroupToTransmit();
    if (group) {
      this.physics.spawnGroup(group);
      this.updateHUD();
    }
  }

  /* ========================================================================
     PROTOCOL CALLBACKS & EVENT LOGIC
     ======================================================================== */
  bindProtocolCallbacks() {
    this.protocol.setCallbacks({
      onStateChange: () => {
        this.updateHUD();
      },

      onAck: (seq) => {
        this.updateHUD();
      },

      onPacketDelivered: (seq, delivered, total) => {
        this.updateHUD();
        // Microinteraction pulse on score indicator
        if (this.targetCountDisplay) {
          this.targetCountDisplay.classList.remove('count-pulse');
          void this.targetCountDisplay.offsetWidth;
          this.targetCountDisplay.classList.add('count-pulse');
        }
      },

      onSinglePacketReleased: (seq, remainingBuffer) => {
        // Physical sequential buffer release: packet leaves rack smoothly into delivery
        this.physics.animateSinglePacketReleased(seq, remainingBuffer);
        this.updateHUD();
      },

      onGroupComplete: (groupId) => {
        this.updateHUD();
        setTimeout(() => {
          this.dispatchNextGroup();
        }, 550);
      },

      onWindowSlide: (start, end) => {
        this.updateHUD();
      },

      onCorrupted: (seq, groupId) => {
        this.activeActionSeq = seq;
        this.updateHUD();
      },

      onLost: (seq, groupId) => {
        this.activeActionSeq = seq;
        this.updateHUD();
      },

      onPacketsBuffered: (seqList) => {
        // Physical animation: slide out-of-order packets LEFT into buffer rack
        this.physics.animatePacketsToBuffer(seqList, this.protocol.bufferedPackets);
        this.updateHUD();
      },

      onPacketsReleased: (releasedList) => {
        // Handled via onSinglePacketReleased sequentially
      },

      onBufferOverflow: (count, cap) => {
        this.handleBufferOverflow();
      },

      onRecoveryMissed: (seq, wrongCount) => {
        this.updateHUD();
      },

      onComplete: (scoreData) => {
        this.handleSimulationComplete(scoreData);
      }
    });
  }

  handleGroupLanded(groupId) {
    if (this.gameState !== GAME_STATE.PLAYING) return;

    this.protocol.handleGroupLanded(groupId);
    this.updateHUD();

    if (this.gameState !== GAME_STATE.PLAYING) return;

    // Check if group landed with a corrupted or missing packet requiring automatic recovery
    const missing = this.protocol.getMissingPackets();
    if (missing && missing.length > 0) {
      const corruptItem = missing.find(p => p.status === FRAME_STATE.CORRUPTED);
      if (corruptItem) {
        // Automatic corruption handling:
        // 1. Brief pause so the player sees the red CRC ERROR highlight
        // 2. Automatically remove corrupted cell from grid, converting it to a recovery socket
        // 3. Automatically transition corrupted packet to MISSING state in protocol
        // 4. Automatically buffer out-of-order packets above it
        // 5. Expose dedicated retransmission panel
        const timer = setTimeout(() => {
          if (this.gameState !== GAME_STATE.PLAYING) return;
          this.physics.removeCorruptedCellBySeq(corruptItem.seq);
          this.protocol.removeCorruptedPacket(corruptItem.seq);
          this.activeActionSeq = corruptItem.seq;
          this.updateHUD();
          this.updateSideRecoveryPanel();
        }, 380);
        this.dispatchTimers.push(timer);
      } else {
        this.activeActionSeq = missing[0].seq;
        this.updateSideRecoveryPanel();
      }
    }
  }

  handleRetransmit(seq) {
    if (this.gameState !== GAME_STATE.PLAYING || !seq) return;

    // 13. PREVENT DUPLICATE RETRANSMISSIONS: If recovery packet is already active, ignore
    if (this.physics.currentRecoveryPacket && !this.physics.currentRecoveryPacket.isMissed) {
      return;
    }

    // Ensure corrupted cell is converted to socket
    this.physics.removeCorruptedCellBySeq(seq);
    this.protocol.removeCorruptedPacket(seq);

    // 1. Create recovery object via protocol
    const recPkt = this.protocol.retransmitPacket(seq);
    if (!recPkt) {
      this.updateHUD();
      return;
    }

    // 2. Register & spawn R03 in active game physics
    this.physics.spawnRecoveryPacket(recPkt);

    // 3. Verify R03 is active in the game engine
    if (!this.physics.currentRecoveryPacket) {
      console.warn('RECOVERY PACKET CREATION FAILED');
      const pkt = this.protocol.packets.get(seq);
      if (pkt) pkt.status = FRAME_STATE.MISSING;
      this.updateHUD();
      return;
    }

    // 4. Object is confirmed active! Update HUD & button to IN TRANSIT
    this.updateHUD();
  }

  handleRecoveryDocked(seq) {
    if (this.gameState !== GAME_STATE.PLAYING) return;
    this.activeActionSeq = null;

    // Notify protocol that missing frame has been recovered
    this.protocol.handleRecoveryPacketDocked(seq);
    this.updateHUD();
  }

  handleRecoveryMissed(seq) {
    if (this.gameState !== GAME_STATE.PLAYING) return;
    this.protocol.handleRecoveryPacketMissed(seq);
    this.updateHUD();
  }

  handleBufferOverflow() {
    if (this.gameState === GAME_STATE.WON || this.gameState === GAME_STATE.LOST) return;
    this.gameState = GAME_STATE.LOST;
    this.isGameRunning = false;
    this.clearAllTimers();

    if (this.sideRecoveryPanel) {
      this.sideRecoveryPanel.classList.add('is-hidden');
    }

    // Freeze board and render once to hold current frozen board state
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.physics.render();

    // Brief delay to allow full buffer state to register visually, then show LOSE SCREEN
    const timer = setTimeout(() => {
      const scoreData = this.protocol.calculateScore();
      scoreData.isSuccess = false;
      this.showResultScreen(scoreData);
    }, 400);
    this.dispatchTimers.push(timer);
  }

  /* ========================================================================
     60FPS GAME LOOP
     ======================================================================== */
  startLoop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);

    const loop = (timestamp) => {
      if (this.gameState !== GAME_STATE.PLAYING && this.gameState !== GAME_STATE.PAUSED) {
        this.physics.render();
        return;
      }

      if (!this.lastTimestamp) this.lastTimestamp = timestamp;
      const rawDt = (timestamp - this.lastTimestamp) / 1000;
      const dt = Math.max(0.001, Math.min(rawDt, 0.05));
      this.lastTimestamp = timestamp;

      if (this.gameState === GAME_STATE.PLAYING) {
        // Automatic natural difficulty progression
        const speedMult = 1.0 + (this.protocol.currentGroupIndex * 0.12);
        this.physics.update(dt, speedMult);
      }

      this.physics.render();

      if (this.gameState === GAME_STATE.PLAYING || this.gameState === GAME_STATE.PAUSED) {
        this.rafId = requestAnimationFrame(loop);
      }
    };

    this.rafId = requestAnimationFrame(loop);
  }

  /* ========================================================================
     CONTROLS: KEYBOARD, TOUCH & BUTTONS, PAUSE & RESUME
     ======================================================================== */
  initControls() {
    this.playPauseBtn?.addEventListener('click', () => this.togglePause());
    this.restartBtn?.addEventListener('click', () => this.confirmRestart());
    this.resumeBtn?.addEventListener('click', () => this.togglePause(false));
    this.pauseRestartBtn?.addEventListener('click', () => {
      this.togglePause(false);
      this.resetSimulation();
    });

    this.ctrlLeft?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.gameState === GAME_STATE.PLAYING) this.physics.moveLeft();
    });

    this.ctrlRight?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.gameState === GAME_STATE.PLAYING) this.physics.moveRight();
    });

    this.ctrlRotate?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.gameState === GAME_STATE.PLAYING) this.physics.rotate();
    });

    this.ctrlSoftDrop?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.gameState === GAME_STATE.PLAYING) this.physics.softDrop();
    });

    this.ctrlHardDrop?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.gameState === GAME_STATE.PLAYING) this.physics.hardDrop();
    });

    this.canvasWrap?.addEventListener('click', () => {
      this.isFocused = true;
      this.canvasWrap?.classList.add('sim-focused');
    });

    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        this.isFocused = false;
        this.canvasWrap?.classList.remove('sim-focused');
      }
    });

    this.canvas?.addEventListener('click', () => {
      this.isFocused = true;
      this.canvasWrap?.focus();
    });
  }

  initKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.gameState === GAME_STATE.PLAYING || this.gameState === GAME_STATE.PAUSED) {
          e.preventDefault();
          this.togglePause();
        }
        return;
      }

      if (this.gameState !== GAME_STATE.PLAYING) return;

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        this.physics.moveLeft();
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        this.physics.moveRight();
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        this.physics.rotate();
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        this.physics.softDrop();
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        // If recovery button is visible and waiting for retransmit, Space triggers retransmit!
        if (!this.physics.currentGroup && !this.physics.currentRecoveryPacket) {
          const missing = this.protocol.getMissingPackets();
          const target = missing.find(p => !p.inFlight);
          if (target) {
            this.handleRetransmit(target.seq);
            return;
          }
        }
        this.physics.hardDrop();
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        const missing = this.protocol.getMissingPackets();
        const target = missing.find(p => !p.inFlight);
        if (target) {
          e.preventDefault();
          this.handleRetransmit(target.seq);
        }
      }
    });
  }

  togglePause(explicitState = null) {
    if (this.gameState !== GAME_STATE.PLAYING && this.gameState !== GAME_STATE.PAUSED) return;

    this.isPaused = explicitState !== null ? explicitState : !this.isPaused;
    this.gameState = this.isPaused ? GAME_STATE.PAUSED : GAME_STATE.PLAYING;

    if (this.pauseOverlay) {
      this.pauseOverlay.style.display = this.isPaused ? 'flex' : 'none';
    }

    if (this.playPauseBtn) {
      this.playPauseBtn.innerHTML = this.isPaused ? '<span>▶ Resume</span>' : '<span>⏸ Pause</span>';
    }

    if (!this.isPaused) {
      this.lastTimestamp = performance.now();
    }
  }

  confirmRestart() {
    this.resetSimulation();
  }

  resetSimulation() {
    this.returnToMenu();
  }

  returnToMenu() {
    this.clearAllTimers();
    this.gameState = GAME_STATE.MENU;
    this.isGameRunning = false;
    this.isPaused = false;
    this.activeActionSeq = null;

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.pauseOverlay) this.pauseOverlay.style.display = 'none';
    this.hideResultModal();
    if (this.tutorialOverlay) this.tutorialOverlay.style.display = 'none';
    if (this.sideRecoveryPanel) {
      this.sideRecoveryPanel.classList.add('is-hidden');
      this.sideRecoveryPanel.innerHTML = '';
    }

    if (this.startScreen) {
      this.startScreen.style.display = 'flex';
      this.startScreen.style.opacity = '1';
      this.startScreen.style.pointerEvents = 'all';
    }

    this.protocol.init('NORMAL', {
      targetPackets: 30,
      windowSize: 6,
      bufferCapacity: 8
    });

    this.physics.reset();
    this.physics.render();

    this.updateHUD();
  }

  /* ========================================================================
     DOM UI UPDATERS: HUD & COMPACT SIDE RECOVERY PANEL
     ======================================================================== */
  updateHUD() {
    const snap = this.protocol.getTelemetrySnapshot();
    this.physics.expectedSeq = snap.expectedSeq;

    const delivered = String(snap.delivered).padStart(2, '0');
    const target = String(snap.target).padStart(2, '0');
    if (this.targetCountDisplay) {
      this.targetCountDisplay.textContent = `${delivered} / ${target}`;
    }

    if (this.groupLabel) {
      const expStr = String(snap.expectedSeq).padStart(2, '0');
      this.groupLabel.textContent = `EXPECTED P${expStr}`;
    }

    this.updateSideRecoveryPanel();
  }

  /**
   * Minimal, focused side recovery panel immediately beside main game grid.
   * Renders only when an unresolved packet exists.
   */
  updateSideRecoveryPanel() {
    if (!this.sideRecoveryPanel) return;

    if (!this.isGameRunning) {
      this.sideRecoveryPanel.classList.add('is-hidden');
      this.sideRecoveryPanel.innerHTML = '';
      return;
    }

    const missingPackets = this.protocol.getMissingPackets();
    if (!missingPackets || missingPackets.length === 0) {
      this.sideRecoveryPanel.classList.add('is-hidden');
      this.sideRecoveryPanel.innerHTML = '';
      this.activeActionSeq = null;
      return;
    }

    this.sideRecoveryPanel.classList.remove('is-hidden');
    const hasInFlight = missingPackets.some(p => p.inFlight);
    const wrongCount = this.protocol.stats.wrongRecoveries || 0;
    const wrongRecoveryHtml = wrongCount > 0 ? `
      <div class="rec-wrong-line">
        <span class="rec-wrong-tag">WRONG RECOVERY</span>
        <span class="rec-wrong-val">${wrongCount}</span>
      </div>
    ` : '';

    if (missingPackets.length === 1) {
      const p = missingPackets[0];
      const padSeq = String(p.seq).padStart(2, '0');
      this.activeActionSeq = p.seq;

      const isTransit = p.inFlight;
      const statusLabel = isTransit ? 'IN TRANSIT' : 'MISSING';
      const statusClass = isTransit ? 'status-transit' : 'status-missing';

      this.sideRecoveryPanel.innerHTML = `
        <div class="recovery-box">
          <div class="recovery-header">
            <span class="rec-dot"></span>
            <span class="rec-title">RECOVERY</span>
          </div>

          <div class="recovery-content-single">
            <div class="rec-field">
              <span class="rec-sub">EXPECTED</span>
              <span class="rec-seq ${isTransit ? '' : 'red-pulse'}">P${padSeq}</span>
            </div>

            <div class="rec-status-line ${statusClass}">
              <span class="rec-status-dot"></span>
              <span class="rec-status-lbl">${statusLabel}</span>
            </div>
            ${wrongRecoveryHtml}

            <button type="button" class="sim-retx-action-btn ${isTransit ? 'btn-in-transit' : ''}" 
                    data-seq="${p.seq}" ${isTransit ? 'disabled' : ''}>
              ${isTransit ? 'IN TRANSIT' : `RETRANSMIT P${padSeq}`}
            </button>
          </div>
        </div>
      `;
    } else {
      // Multiple missing packets (e.g. P03 and P07)
      this.activeActionSeq = missingPackets[0].seq;
      const itemsHtml = missingPackets.map(p => {
        const padSeq = String(p.seq).padStart(2, '0');
        const isTransit = p.inFlight;
        const statusLabel = isTransit ? 'IN TRANSIT' : 'MISSING';
        const statusClass = isTransit ? 'status-transit' : 'status-missing';
        const disabled = hasInFlight && !isTransit;

        return `
          <div class="rec-multi-item ${statusClass}">
            <div class="rec-multi-info">
              <span class="rec-multi-seq ${isTransit ? '' : 'red-pulse'}">P${padSeq}</span>
              <span class="rec-multi-status">${statusLabel}</span>
            </div>
            <button type="button" class="sim-retx-action-btn ${isTransit ? 'btn-in-transit' : ''}" 
                    data-seq="${p.seq}" ${isTransit || disabled ? 'disabled' : ''}>
              ${isTransit ? 'IN TRANSIT' : `RETRANSMIT P${padSeq}`}
            </button>
          </div>
        `;
      }).join('');

      this.sideRecoveryPanel.innerHTML = `
        <div class="recovery-box">
          <div class="recovery-header">
            <span class="rec-dot"></span>
            <span class="rec-title">RECOVERY</span>
          </div>
          <div class="recovery-multi-list">
            ${wrongRecoveryHtml}
            ${itemsHtml}
          </div>
        </div>
      `;
    }

    // Attach click listeners to all retransmit buttons in panel
    const buttons = this.sideRecoveryPanel.querySelectorAll('.sim-retx-action-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const seq = parseInt(btn.dataset.seq, 10);
        if (seq && !btn.disabled) {
          this.handleRetransmit(seq);
        }
      });
    });
  }

  /* ========================================================================
     MINIMAL RESULT SCREEN (WIN / LOSE)
     ======================================================================== */
  handleSimulationComplete(scoreData) {
    if (this.gameState === GAME_STATE.WON || this.gameState === GAME_STATE.LOST) return;

    const isWin = scoreData.isSuccess;
    this.gameState = isWin ? GAME_STATE.WON : GAME_STATE.LOST;
    this.isGameRunning = false;
    this.clearAllTimers();

    if (this.sideRecoveryPanel) {
      this.sideRecoveryPanel.classList.add('is-hidden');
    }

    // Freeze board and render once to hold current frozen board state
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.physics.render();

    // Win animation: brief delay so final 30 / 30 counter animation completes (~400ms)
    const delay = isWin ? 400 : 350;
    const timer = setTimeout(() => {
      this.showResultScreen(scoreData);
    }, delay);
    this.dispatchTimers.push(timer);
  }

  showResultScreen(scoreData) {
    const isWin = this.gameState === GAME_STATE.WON;

    if (this.resultTitle) {
      this.resultTitle.textContent = isWin ? 'TRANSMISSION COMPLETE' : 'BUFFER OVERFLOW';
    }

    if (this.resultRating) {
      const delivered = scoreData.delivered !== undefined ? scoreData.delivered : (isWin ? 30 : 0);
      const total = scoreData.totalTarget || 30;
      this.resultRating.textContent = `${delivered} / ${total}`;
      this.resultRating.className = `res-progress-pill ${isWin ? 'pill-win' : 'pill-lose'}`;
    }

    if (this.modalRetryBtn) {
      this.modalRetryBtn.textContent = isWin ? 'PLAY AGAIN' : 'TRY AGAIN';
    }

    if (this.resultCard) {
      this.resultCard.className = `sim-minimal-result-card ${isWin ? 'win-theme' : 'lose-theme'}`;
    }

    const accentArc = document.getElementById('simResultGaugeAccent');
    if (accentArc) {
      accentArc.style.opacity = isWin ? '0.35' : '0';
    }

    // Dynamic metrics grid strictly per user instructions
    // WIN: RETRANSMISSIONS, EFFICIENCY, TIME
    // LOSE: BUFFER, RETRANSMISSIONS
    if (this.resultMetrics) {
      if (isWin) {
        this.resultMetrics.innerHTML = `
          <div class="res-metric-cell">
            <span class="rm-label">RETRANSMISSIONS</span>
            <strong class="rm-val gold-txt">${scoreData.retransmissions}</strong>
          </div>
          <div class="res-metric-cell">
            <span class="rm-label">EFFICIENCY</span>
            <strong class="rm-val">${scoreData.efficiency}%</strong>
          </div>
          <div class="res-metric-cell">
            <span class="rm-label">TIME</span>
            <strong class="rm-val">${scoreData.timeFormatted}</strong>
          </div>
        `;
      } else {
        this.resultMetrics.innerHTML = `
          <div class="res-metric-cell">
            <span class="rm-label">BUFFER</span>
            <strong class="rm-val red-txt">8 / 8</strong>
          </div>
          <div class="res-metric-cell">
            <span class="rm-label">RETRANSMISSIONS</span>
            <strong class="rm-val">${scoreData.retransmissions}</strong>
          </div>
        `;
      }
    }

    // Temporarily disable buttons until gauge/metrics transition is underway
    if (this.modalRetryBtn) {
      this.modalRetryBtn.disabled = true;
      this.modalRetryBtn.style.pointerEvents = 'none';
      this.modalRetryBtn.style.opacity = '0.6';
    }
    if (this.modalCloseBtn) {
      this.modalCloseBtn.disabled = true;
      this.modalCloseBtn.style.pointerEvents = 'none';
      this.modalCloseBtn.style.opacity = '0.6';
    }

    if (this.resultModal) {
      this.resultModal.style.display = 'flex';
      void this.resultModal.offsetWidth;
      this.resultModal.classList.add('active', 'modal-open');
    }

    this.animateScoreGauge(scoreData.score);

    // Re-enable buttons after animation completes (~750ms)
    setTimeout(() => {
      if (this.modalRetryBtn) {
        this.modalRetryBtn.disabled = false;
        this.modalRetryBtn.style.pointerEvents = 'all';
        this.modalRetryBtn.style.opacity = '1';
      }
      if (this.modalCloseBtn) {
        this.modalCloseBtn.disabled = false;
        this.modalCloseBtn.style.pointerEvents = 'all';
        this.modalCloseBtn.style.opacity = '1';
      }
    }, 750);
  }

  hideResultModal() {
    if (this.resultModal) {
      this.resultModal.classList.remove('active', 'modal-open');
      setTimeout(() => {
        if (!this.resultModal.classList.contains('active') && !this.resultModal.classList.contains('modal-open')) {
          this.resultModal.style.display = 'none';
        }
      }, 350);
    }
  }

  animateScoreGauge(targetScore) {
    if (!this.resultGaugeArc) return;

    // Radius 90 semicircle arc length = PI * 90 ≈ 282.74
    const totalArcLength = this.resultGaugeArc.getTotalLength ? this.resultGaugeArc.getTotalLength() : 282.74;
    const startOffset = totalArcLength;
    const endOffset = totalArcLength * (1 - (Math.max(0, Math.min(100, targetScore)) / 100));

    this.resultGaugeArc.style.strokeDasharray = String(totalArcLength);
    this.resultGaugeArc.style.strokeDashoffset = String(startOffset);

    setTimeout(() => {
      if (!this.resultGaugeArc) return;
      this.resultGaugeArc.style.transition = 'stroke-dashoffset 0.85s cubic-bezier(0.16, 1, 0.3, 1)';
      this.resultGaugeArc.style.strokeDashoffset = String(endOffset);
    }, 40);

    let current = 0;
    const duration = 800;
    const startTs = performance.now();

    const countStep = (now) => {
      const progress = Math.min((now - startTs) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      current = Math.round(eased * targetScore);

      if (this.resultScore) {
        this.resultScore.textContent = current;
      }

      if (progress < 1 && (this.gameState === GAME_STATE.WON || this.gameState === GAME_STATE.LOST)) {
        requestAnimationFrame(countStep);
      }
    };

    requestAnimationFrame(countStep);
  }

  initModalActions() {
    this.modalRetryBtn?.addEventListener('click', () => {
      this.hideResultModal();
      this.startActualSimulation(); // Seamless restart without page reload!
    });

    this.modalCloseBtn?.addEventListener('click', () => {
      this.hideResultModal();
      this.returnToMenu(); // Return to initial menu cleanly!
    });
  }
}
