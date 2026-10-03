/**
 * heartbeat.js
 * 
 * Physiological cardiac cycle simulator.
 * Produces organic systolic/diastolic pulses with realistic micro-scale, 
 * subtle positional apex shift, and chromatic blood-perfusion warmth.
 */

export class HeartbeatSimulator {
  constructor(bpm = 64) {
    this.bpm = bpm;
    this.cycleDuration = 60 / bpm; // ~0.9375 seconds per cardiac cycle
    this.startTime = performance.now();
  }

  /**
   * Calculates the physiological Wiggers pulse curve at a given timestamp.
   * Returns a normalized pulse value [0.0, 1.0] representing myocardial tension.
   */
  getCardiacCurve(elapsedSeconds) {
    const phase = (elapsedSeconds % this.cycleDuration) / this.cycleDuration; // 0 to 1

    // Primary ventricular systole (sharp contraction peak at phase ~0.12)
    const primarySystole = Math.exp(-Math.pow((phase - 0.12) / 0.065, 2));

    // Secondary dicrotic wave (aortic valve closure rebound at phase ~0.28)
    const dicroticRebound = 0.32 * Math.exp(-Math.pow((phase - 0.28) / 0.055, 2));

    return Math.max(0, primarySystole + dicroticRebound);
  }

  /**
   * Computes the complete organic transformation for the current frame.
   * @param {number} currentTime - Current timestamp in milliseconds
   * @param {number} scrollProgress - Normalized scroll progress [0.0, 1.0]
   * @param {number} scrollVelocity - Smoothed scrolling speed
   */
  getHeartState(currentTime, scrollProgress = 0, scrollVelocity = 0) {
    const elapsedSeconds = (currentTime - this.startTime) / 1000;
    const rawPulse = this.getCardiacCurve(elapsedSeconds);

    // Heartbeat is active during Phase 1 (Heart) and tapers off as the camera enters the vessel
    // Phase 1 = 0.0 to 0.55; entering transition begins around 0.55
    let progressWeight = 1.0;
    if (scrollProgress > 0.50) {
      // Smoothly fade heartbeat out between 0.50 and 0.65 as we enter the vessel
      progressWeight = Math.max(0, 1.0 - (scrollProgress - 0.50) / 0.15);
    }

    // Velocity damping: high-speed scrolling slightly dampens the micro-pulse to prioritize travel motion
    const velocityDamping = Math.max(0.4, 1.0 - Math.min(1.0, Math.abs(scrollVelocity) * 15));
    const effectiveWeight = progressWeight * velocityDamping;

    // Organic micro-scale: subtle 1.6% tissue expansion (never a cartoon 1.2x)
    const scale = 1.0 + (0.016 * rawPulse * effectiveWeight);

    // Subtle anatomical apex movement (apical rotation and slight vertical shift)
    const translateY = -1.2 * rawPulse * effectiveWeight;
    const rotateRad = 0.0025 * rawPulse * effectiveWeight;

    // Subtle perfusion lighting modulation (blood surge during systole)
    const brightness = 1.0 + (0.035 * rawPulse * effectiveWeight);
    const contrast = 1.0 + (0.02 * rawPulse * effectiveWeight);

    return {
      pulse: rawPulse,
      weight: effectiveWeight,
      scale,
      translateY,
      rotateRad,
      brightness,
      contrast
    };
  }
}
