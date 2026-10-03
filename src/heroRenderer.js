/**
 * heroRenderer.js
 * 
 * High-performance canvas renderer.
 * Composites multiple high-resolution anatomical stages via continuous 2.5D scaling and fading,
 * ensuring no single image is zoomed past its useful resolution threshold.
 */

export class HeroRenderer {
  constructor({ canvas, assetLoader, scrollController, heartbeat, transitionLogic, cameraDepth, bloodCells, phase1Element, phase2Element }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    this.assetLoader = assetLoader;
    this.scrollController = scrollController;
    this.heartbeat = heartbeat;
    this.transitionLogic = transitionLogic;
    this.cameraDepth = cameraDepth;
    this.bloodCells = bloodCells;
    this.phase1El = phase1Element;
    this.phase2El = phase2Element;
  }

  render(currentTime) {
    const progress = this.scrollController.getProgress();
    const velocity = this.scrollController.getVelocity();

    const state = this.transitionLogic.getTransitionState(progress, velocity);
    const heartState = this.heartbeat.getHeartState(currentTime, progress, velocity);

    // Apply the pulse to the camera scale to simulate organic cinematic movement
    const pulseScale = 1.0 + (heartState.pulse * 0.015 * heartState.weight);

    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;
    
    this.ctx.fillStyle = '#040407';
    this.ctx.fillRect(0, 0, canvasW, canvasH);
    this.ctx.imageSmoothingQuality = 'high';

    const drawLayer = (imgName, alpha, scale) => {
      const img = this.assetLoader.getStage(imgName);
      if (!img || alpha <= 0.005) return;
      
      this.ctx.globalAlpha = alpha;
      
      const sourceAspect = img.naturalWidth / img.naturalHeight;
      const canvasAspect = canvasW / canvasH;
      
      let baseW, baseH;
      if (canvasAspect > sourceAspect) {
        baseH = canvasH;
        baseW = canvasH * sourceAspect;
      } else {
        baseW = canvasW;
        baseH = canvasW / sourceAspect;
      }
      
      const finalW = baseW * scale * pulseScale;
      const finalH = baseH * scale * pulseScale;
      
      // Keep focal point perfectly centered (assuming assets are focal-centered)
      const drawX = (canvasW - finalW) / 2;
      const drawY = (canvasH - finalH) / 2;
      
      this.ctx.drawImage(img, drawX, drawY, finalW, finalH);
    };

    // Draw stages with overlap support
    drawLayer('wide', state.wideAlpha, state.wideScale);
    drawLayer('surface', state.surfaceAlpha, state.surfaceScale);
    drawLayer('artery', state.arteryAlpha, state.arteryScale);

    // Update and draw flowing blood cells in the artery stage
    if (state.arteryAlpha > 0) {
      this.bloodCells.update(currentTime, velocity, heartState, canvasW, canvasH);
      this.bloodCells.draw(this.ctx, canvasW, canvasH, state.arteryAlpha);
    }

    this.ctx.globalAlpha = 1.0;

    // Subtle physiological tissue warmth
    if (progress < 0.50 && heartState.pulse > 0.05) {
      const warmth = heartState.pulse * 0.04 * heartState.weight;
      if (warmth > 0.005) {
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'screen';
        this.ctx.fillStyle = `rgba(180, 30, 40, ${warmth})`;
        this.ctx.fillRect(0, 0, canvasW, canvasH);
        this.ctx.restore();
      }
    }

    this.updateUI(state, progress);
  }

  updateUI(state, progress) {
    if (this.phase1El && this.phase2El) {
      const isMobile = window.innerWidth <= 768;

      // Phase 1: “Every Beat Carries a Signal.”
      // Anchored in the empty void on the left; fades out as zoom transitions into lumen
      if (progress < 0.18) {
        this.phase1El.style.opacity = '1';
        this.phase1El.style.transform = isMobile ? 'translateY(0)' : 'translateY(-50%)';
      } else if (progress < 0.38) {
        const t = (progress - 0.18) / 0.20;
        const opacity = Math.max(0, 1 - t);
        this.phase1El.style.opacity = `${opacity}`;
        this.phase1El.style.transform = isMobile 
          ? `translateY(${-t * 20}px)` 
          : `translateY(calc(-50% - ${t * 24}px))`;
      } else {
        this.phase1El.style.opacity = '0';
        this.phase1El.style.transform = isMobile ? 'translateY(-20px)' : 'translateY(calc(-50% - 24px))';
      }

      // Phase 2: “Every Lost Packet Finds Its Way Back.”
      // Fades in progressively across the scroll so the fade-in reaches 100% opacity precisely as smooth scroll completes (1.0)
      // Once complete (progress >= 1.0), it stays permanently visible at full opacity (does NOT disappear)
      const phase2Start = 0.35;
      if (progress <= phase2Start) {
        this.phase2El.style.opacity = '0';
        this.phase2El.style.transform = 'translate(-50%, calc(-50% + 30px))';
      } else {
        const t = Math.min(1.0, Math.max(0.0, (progress - phase2Start) / (1.0 - phase2Start)));
        this.phase2El.style.opacity = `${t}`;
        const offsetY = (1.0 - t) * 30;
        this.phase2El.style.transform = `translate(-50%, calc(-50% + ${offsetY}px))`;
      }
    }
  }
}
