/**
 * cameraDepth.js
 * 
 * Manages responsive canvas sizing and aspect ratio preservation.
 * Uses exact "contain" geometry to ensure 100% of the image is visible
 * with no cropping and no digital zoom.
 */

export class CameraDepthController {
  constructor(canvasElement) {
    this.canvas = canvasElement;

    // Source asset dimensions (1280x720 16:9)
    this.sourceWidth = 1280;
    this.sourceHeight = 720;
    this.sourceAspect = 1280 / 720;

    // Viewport metrics
    this.viewportWidth = window.innerWidth;
    this.viewportHeight = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.initEvents();
    this.handleResize();
  }

  initEvents() {
    window.addEventListener('resize', () => this.handleResize(), { passive: true });
  }

  handleResize() {
    this.viewportWidth = window.innerWidth;
    this.viewportHeight = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Canvas internal pixel buffer
    this.canvas.width = Math.round(this.viewportWidth * this.dpr);
    this.canvas.height = Math.round(this.viewportHeight * this.dpr);

    // Canvas CSS display dimensions
    this.canvas.style.width = `${this.viewportWidth}px`;
    this.canvas.style.height = `${this.viewportHeight}px`;
  }

  /**
   * Computes exact aspect-ratio preserving contain transformation.
   * Completely avoids digital zoom or cropping.
   */
  computeDrawTransform() {
    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;
    const canvasAspect = canvasW / canvasH;

    // Strict aspect-ratio preserving "contain" calculation
    let renderW, renderH;
    if (canvasAspect > this.sourceAspect) {
      // Screen is wider than 16:9 -> fit to height, center horizontally
      renderH = canvasH;
      renderW = canvasH * this.sourceAspect;
    } else {
      // Screen is taller than 16:9 -> fit to width, center vertically
      renderW = canvasW;
      renderH = canvasW / this.sourceAspect;
    }

    // Perfectly centered within the viewport
    const drawX = Math.round((canvasW - renderW) / 2);
    const drawY = Math.round((canvasH - renderH) / 2);

    return {
      drawX,
      drawY,
      renderW: Math.round(renderW),
      renderH: Math.round(renderH),
      canvasW,
      canvasH,
      dpr: this.dpr
    };
  }
}
