/**
 * transitionLogic.js
 * 
 * Maps normalized scroll progress [0.0, 1.0] across multiple high-resolution stages.
 * Seamlessly manages scale and crossfade opacity for a continuous 2.5D deep zoom.
 */

export class TransitionLogic {
  getTransitionState(progress, velocity = 0) {
    let phase = 'PHASE 1 — HUMAN HEART';
    
    let wideAlpha = 0;
    let wideScale = 1;
    let surfaceAlpha = 0;
    let surfaceScale = 1;
    let arteryAlpha = 0;
    let arteryScale = 1;

    // Stage 1: Wide shot zoom (progress 0.0 to 0.38)
    if (progress < 0.38) {
      const t = progress / 0.38;
      wideAlpha = 1.0;
      wideScale = 1.0 + (t * 2.2); // 1.0 to 3.2
    } 
    // Stage 2: Crossfade Wide -> Surface (progress 0.38 to 0.54)
    else if (progress < 0.54) {
      const t = (progress - 0.38) / 0.16; // 0 to 1
      wideAlpha = 1.0 - t;
      wideScale = 3.2 + (t * 1.6); // 3.2 to 4.8
      surfaceAlpha = t;
      surfaceScale = 1.0 + (t * 0.45); // 1.0 to 1.45 (strictly zooming in, never < 1.0!)
    } 
    // Stage 3: Surface deep macro zoom (progress 0.54 to 0.76)
    else if (progress < 0.76) {
      const t = (progress - 0.54) / 0.22;
      surfaceAlpha = 1.0;
      surfaceScale = 1.45 + (t * 1.05); // 1.45 to 2.50
    } 
    // Stage 4: Crossfade Surface -> Artery Entry (progress 0.76 to 0.88)
    else if (progress < 0.88) {
      phase = 'TRANSITION — VASCULAR ENTRY';
      const t = (progress - 0.76) / 0.12;
      surfaceAlpha = 1.0 - t;
      surfaceScale = 2.50 + (t * 1.2); // 2.50 to 3.70
      arteryAlpha = t;
      arteryScale = 1.0 + (t * 0.35); // 1.0 to 1.35 (strictly zooming in!)
    } 
    // Stage 5: Artery deep lumen flow (progress 0.88 to 1.0)
    else {
      phase = 'PHASE 2 — ARTERIAL NETWORK';
      const t = (progress - 0.88) / 0.12;
      arteryAlpha = 1.0;
      arteryScale = 1.35 + (t * 0.75); // 1.35 to 2.10
    }

    return {
      phase,
      progress,
      wideAlpha, wideScale,
      surfaceAlpha, surfaceScale,
      arteryAlpha, arteryScale
    };
  }
}

