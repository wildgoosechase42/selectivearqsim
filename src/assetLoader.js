/**
 * assetLoader.js
 * 
 * Non-blocking progressive image loader for the multi-stage cinematic zoom.
 */

export class AssetLoader {
  constructor() {
    this.images = {
      wide: new Image(),
      surface: new Image(),
      artery: new Image()
    };
    this.isInitialReady = false;
  }

  async loadFirstFrame() {
    return new Promise((resolve) => {
      this.images.wide.onload = () => {
        this.isInitialReady = true;
        resolve(this.images.wide);
      };
      this.images.wide.onerror = () => {
        console.warn('Failed to load wide heart asset');
        resolve(null);
      };
      this.images.wide.src = '/heart_wide.jpg';
    });
  }

  loadAllBackground(onProgress = () => {}) {
    this.images.surface.src = '/heart_surface.jpg';
    this.images.artery.src = '/artery_inside.jpg';
  }

  getStage(name) {
    if (this.images[name] && this.images[name].complete && this.images[name].naturalWidth > 0) {
      return this.images[name];
    }
    return null;
  }
}
