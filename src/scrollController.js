/**
 * scrollController.js
 * 
 * Responsive scroll physics engine with auto-transition capability.
 * One wheel scroll triggers the full cinematic deep zoom.
 */

export class ScrollController {
  constructor(trackElement) {
    this.trackElement = trackElement;
    this.rawProgress = 0;
    this.smoothProgress = 0;
    this.velocity = 0;
    this.lastTime = performance.now();
    
    // Snappy, highly responsive damping
    this.dampingFactor = 22.0;
    this.isAutoScrolling = false;
    this.targetScroll = null;
    this.autoScrollRafId = null;

    this.onUpdateCallbacks = [];
    this.init();
  }

  init() {
    this.updateRawProgress();
    this.smoothProgress = this.rawProgress;

    // Listen for wheel events to trigger the auto-transition
    window.addEventListener('wheel', (e) => this.handleGesture(e, e.deltaY), { passive: false });
    
    // Listen for touch swipe events
    let touchStartY = 0;
    window.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    
    window.addEventListener('touchmove', (e) => {
      const touchEndY = e.touches[0].clientY;
      const deltaY = touchStartY - touchEndY;
      if (Math.abs(deltaY) > 10) {
        this.handleGesture(e, deltaY);
      }
    }, { passive: false });

    // Listen for keyboard navigation keys (ArrowDown/Up, PageDown/Up, Space, Enter, J/K)
    window.addEventListener('keydown', (e) => this.handleKeyDown(e), { passive: false });

    window.addEventListener('scroll', () => {
      if (!this.isAutoScrolling) {
        this.updateRawProgress();
      }
    }, { passive: true });
    
    window.addEventListener('resize', () => {
      if (!this.isAutoScrolling) {
        this.updateRawProgress();
      }
    }, { passive: true });
  }

  handleGesture(e, deltaY) {
    if (!this.trackElement) return;

    const trackHeight = this.trackElement.offsetHeight;
    const viewportHeight = window.innerHeight;
    const maxScroll = trackHeight - viewportHeight;
    const currentScroll = window.scrollY;

    // If within hero track and scrolling down
    if (deltaY > 0 && currentScroll < maxScroll - 10) {
      if (this.isAutoScrolling && this.targetScroll === maxScroll) return;
      e.preventDefault();
      const remainingFraction = Math.max(0.15, (maxScroll - currentScroll) / maxScroll);
      this.triggerAutoScroll(maxScroll, Math.max(450, Math.round(1400 * remainingFraction)));
    }
    // If scrolling up and not already at top
    else if (deltaY < 0 && currentScroll > 10 && currentScroll <= maxScroll + 20) {
      if (this.isAutoScrolling && this.targetScroll === 0) return;
      e.preventDefault();
      const remainingFraction = Math.max(0.15, currentScroll / maxScroll);
      this.triggerAutoScroll(0, Math.max(350, Math.round(1000 * remainingFraction)));
    }
  }

  handleKeyDown(e) {
    // Avoid hijacking keystrokes if focused in form fields
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
      return;
    }

    const key = e.key;
    const code = e.code;

    const isForwardKey = (
      key === 'ArrowDown' || 
      key === 'Down' ||
      key === 'PageDown' ||
      (key === ' ' && !e.shiftKey) ||
      key === 'Enter' ||
      code === 'KeyJ' ||
      key === 'j' ||
      key === 'J' ||
      key === 'ArrowRight' ||
      key === 'End'
    );

    const isBackwardKey = (
      key === 'ArrowUp' || 
      key === 'Up' ||
      key === 'PageUp' ||
      (key === ' ' && e.shiftKey) ||
      code === 'KeyK' ||
      key === 'k' ||
      key === 'K' ||
      key === 'ArrowLeft' ||
      key === 'Home'
    );

    if (!isForwardKey && !isBackwardKey) return;
    if (!this.trackElement) return;

    const trackHeight = this.trackElement.offsetHeight;
    const viewportHeight = window.innerHeight;
    const maxScroll = trackHeight - viewportHeight;
    const currentScroll = window.scrollY;

    // Only handle keyboard transitions when within or near the hero track
    if (currentScroll > maxScroll + 50 && isForwardKey) {
      return; // Allow normal browser scrolling in subsequent content
    }

    if (isForwardKey) {
      if (currentScroll < maxScroll - 5) {
        e.preventDefault();
        const remainingFraction = Math.max(0.15, (maxScroll - currentScroll) / maxScroll);
        this.triggerAutoScroll(maxScroll, Math.max(450, Math.round(1400 * remainingFraction)));
      }
    } else if (isBackwardKey) {
      if (currentScroll > 5 && currentScroll <= maxScroll + 50) {
        e.preventDefault();
        const remainingFraction = Math.max(0.15, currentScroll / maxScroll);
        this.triggerAutoScroll(0, Math.max(350, Math.round(1000 * remainingFraction)));
      }
    }
  }

  triggerAutoScroll(targetScroll, duration) {
    if (this.autoScrollRafId) {
      cancelAnimationFrame(this.autoScrollRafId);
      this.autoScrollRafId = null;
    }

    this.isAutoScrolling = true;
    this.targetScroll = targetScroll;
    const startScroll = window.scrollY;
    const startTime = performance.now();

    const animateScroll = (currentTime) => {
      const elapsed = currentTime - startTime;
      let progress = elapsed / duration;
      
      if (progress >= 1.0) {
        progress = 1.0;
        this.isAutoScrolling = false;
        this.targetScroll = null;
        this.autoScrollRafId = null;
      } else {
        // Snappy, high-energy easeInOutCubic curve
        progress = progress < 0.5 
          ? 4 * progress * progress * progress 
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      }

      const current = startScroll + (targetScroll - startScroll) * progress;
      window.scrollTo(0, current);
      this.updateRawProgress(); // Force raw progress update to keep sync

      if (this.isAutoScrolling) {
        this.autoScrollRafId = requestAnimationFrame(animateScroll);
      }
    };

    this.autoScrollRafId = requestAnimationFrame(animateScroll);
  }

  updateRawProgress() {
    if (!this.trackElement) return;

    const rect = this.trackElement.getBoundingClientRect();
    const trackHeight = this.trackElement.offsetHeight;
    const viewportHeight = window.innerHeight;
    const maxScroll = trackHeight - viewportHeight;

    if (maxScroll <= 0) {
      this.rawProgress = 0;
      return;
    }

    const scrolled = Math.max(0, -rect.top);
    this.rawProgress = Math.max(0, Math.min(1.0, scrolled / maxScroll));
  }

  update(currentTime) {
    const dt = Math.min(0.05, Math.max(0.001, (currentTime - this.lastTime) / 1000));
    this.lastTime = currentTime;

    const decay = 1.0 - Math.exp(-this.dampingFactor * dt);
    const prevSmooth = this.smoothProgress;

    this.smoothProgress += (this.rawProgress - prevSmooth) * decay;

    if (Math.abs(this.smoothProgress - this.rawProgress) < 0.0002) {
      this.smoothProgress = this.rawProgress;
    }

    this.velocity = (this.smoothProgress - prevSmooth) / dt;

    for (let i = 0; i < this.onUpdateCallbacks.length; i++) {
      this.onUpdateCallbacks[i](this.smoothProgress, this.velocity, this.rawProgress);
    }
  }

  onUpdate(callback) {
    this.onUpdateCallbacks.push(callback);
  }

  getProgress() {
    return this.smoothProgress;
  }

  getVelocity() {
    return this.velocity;
  }
}
