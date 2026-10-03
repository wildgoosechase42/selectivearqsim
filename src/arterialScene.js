/**
 * arterialScene.js
 * 
 * Simulates hemodynamics and vascular atmosphere inside the arterial lumen.
 * Implements blood pressure wall compliance, laminar flow micro-drift, 
 * and deep vascular plasma scattering.
 */

export class ArterialSceneSimulator {
  constructor() {
    this.startTime = performance.now();
  }

  /**
   * Computes the hemodynamic state inside the vascular system.
   * 
   * @param {number} currentTime - Timestamp in milliseconds
   * @param {number} progress - Scroll progress [0.0, 1.0]
   * @param {number} velocity - Scroll velocity
   */
  getArterialState(currentTime, progress, velocity = 0) {
    if (progress < 0.60) {
      return {
        isActive: false,
        pulseScale: 1.0,
        driftX: 0,
        driftY: 0,
        plasmaGlow: 0
      };
    }

    // Normalized weight of the arterial phase (ramps in from 0.60 to 0.75, full 1.0 above 0.75)
    const arterialWeight = Math.min(1.0, (progress - 0.60) / 0.15);
    const elapsedSeconds = (currentTime - this.startTime) / 1000;

    // Arterial pressure wave (pulsatile blood flow ~72 bpm = ~0.833s period)
    const wavePhase = (elapsedSeconds % 0.833) / 0.833;
    const systolicSurge = Math.exp(-Math.pow((wavePhase - 0.15) / 0.08, 2));

    // Vessel wall compliance: subtle elastic dilation responding to blood pressure wave
    const wallCompliance = 1.0 + (0.012 * systolicSurge * arterialWeight);

    // Subtle laminar drift: erythrocytes gently floating in suspended bloodstream
    // Even when scrolling has stopped, the bloodstream feels alive and flowing
    const driftX = Math.sin(elapsedSeconds * 1.2) * 2.5 * arterialWeight;
    const driftY = Math.cos(elapsedSeconds * 0.9) * 2.0 * arterialWeight;

    // Plasma scattering warmth inside the vessel
    const plasmaGlow = 0.12 * arterialWeight * (1.0 + 0.15 * systolicSurge);

    return {
      isActive: true,
      arterialWeight,
      pulseScale: wallCompliance,
      driftX,
      driftY,
      plasmaGlow
    };
  }
}
