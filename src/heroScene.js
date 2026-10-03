/**
 * heroScene.js
 * 
 * Top-level coordinator for the hero section experience.
 * Starts the render loop immediately to guarantee no black screen,
 * loads the initial frame instantly, and streams remaining frames in the background.
 */

import { AssetLoader } from './assetLoader.js';
import { ScrollController } from './scrollController.js';
import { HeartbeatSimulator } from './heartbeat.js';
import { TransitionLogic } from './transitionLogic.js';
import { CameraDepthController } from './cameraDepth.js';
import { HeroRenderer } from './heroRenderer.js';
import { BloodCellSystem } from './bloodCells.js';

export class HeroScene {
  constructor() {
    this.isRunning = false;
    this.animationFrameId = null;
  }

  async init() {
    // 1. Query DOM nodes
    const trackEl = document.querySelector('.hero-scroll-track');
    const canvasEl = document.querySelector('.hero-canvas');
    const preloaderEl = document.querySelector('.hero-preloader');
    const phase1El = document.getElementById('heroPhase1');
    const phase2El = document.getElementById('heroPhase2');

    if (!trackEl || !canvasEl) {
      console.error('Hero scene DOM elements missing.');
      return;
    }

    // 2. Instantiate core modules
    this.assetLoader = new AssetLoader(300, '/');
    this.scrollController = new ScrollController(trackEl);
    this.heartbeat = new HeartbeatSimulator(64);
    this.transitionLogic = new TransitionLogic(300);
    this.cameraDepth = new CameraDepthController(canvasEl);
    this.bloodCells = new BloodCellSystem();

    this.renderer = new HeroRenderer({
      canvas: canvasEl,
      assetLoader: this.assetLoader,
      scrollController: this.scrollController,
      heartbeat: this.heartbeat,
      transitionLogic: this.transitionLogic,
      cameraDepth: this.cameraDepth,
      bloodCells: this.bloodCells,
      phase1Element: phase1El,
      phase2Element: phase2El
    });

    // 3. Immediately load the very first frame to show content instantly (10-20ms)
    await this.assetLoader.loadFirstFrame();

    // 4. Initial draw and dismiss preloader immediately
    this.renderer.render(performance.now());
    if (preloaderEl) {
      preloaderEl.classList.add('loaded');
    }

    // 5. Start 60/120fps render loop immediately
    this.startLoop();

    // 6. Asynchronously stream remaining frames in background without blocking
    this.assetLoader.loadAllBackground((loaded, total) => {
      // Optional background progress tracking
    });

    // 7. Interactive cursor & pointer event tracking for blood cell fluid dynamics
    const onPointerMove = (e) => {
      const rect = canvasEl.getBoundingClientRect();
      const scaleX = canvasEl.width / (rect.width || window.innerWidth);
      const scaleY = canvasEl.height / (rect.height || window.innerHeight);
      const canvasX = (e.clientX - rect.left) * scaleX;
      const canvasY = (e.clientY - rect.top) * scaleY;

      this.bloodCells.setCursor(canvasX, canvasY);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('mousemove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerMove, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches[0]) {
        onPointerMove(e.touches[0]);
      }
    }, { passive: true });
    window.addEventListener('pointerleave', () => {
      this.bloodCells.clearCursor();
    });
    document.addEventListener('mouseleave', () => {
      this.bloodCells.clearCursor();
    });

    // 8. Page visibility handling
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stopLoop();
      } else {
        this.startLoop();
      }
    });
  }

  startLoop() {
    if (this.isRunning) return;
    this.isRunning = true;

    const loop = (time) => {
      if (!this.isRunning) return;

      this.scrollController.update(time);
      this.renderer.render(time);

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  stopLoop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
}
