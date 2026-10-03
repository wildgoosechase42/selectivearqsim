/**
 * scrollReveal.js
 * 
 * Lightweight scroll reveal controller for smooth progressive content appearance.
 * Employs subtle translateY(16px) and opacity transitions with zero runtime CPU cost.
 */

export class ScrollRevealController {
  constructor() {
    this.revealElements = document.querySelectorAll('.reveal-on-scroll');
  }

  init() {
    if (!('IntersectionObserver' in window) || this.revealElements.length === 0) {
      // Fallback: show everything if no IntersectionObserver
      this.revealElements.forEach((el) => el.classList.add('revealed'));
      return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          obs.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.04,
      rootMargin: '0px 0px -20px 0px'
    });

    this.revealElements.forEach((el) => {
      observer.observe(el);
    });
  }
}
