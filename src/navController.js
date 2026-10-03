export class NavController {
  constructor() {
    this.navElement = document.getElementById('mainNav');
    this.navLogo = document.getElementById('navLogo');
    this.progressBar = document.getElementById('navProgressBar');
    this.navLinks = document.querySelectorAll('.nav-link');
    this.mobileToggle = document.getElementById('navMobileToggle');
    this.navMenu = document.getElementById('navMenu');
    this.heroTrack = document.getElementById('heroTrack');
    this.curriculumStack = document.getElementById('curriculumStack');
    this.conclusion = document.getElementById('conclusion');
    this.activeSectionId = 'heroTrack';
    this.isNavVisible = false;

    this.cardTargets = [0.03, 0.22, 0.42, 0.62, 0.82, 0.98];
    this.cardIds = [
      'aimBlockContainer',
      'theoryBlockContainer',
      'pretestBlockContainer',
      'simulationBlockContainer',
      'posttestBlockContainer',
      'aiUseCaseBlockContainer'
    ];
  }

  init() {
    this.initScrollProgress();
    this.initNavVisibility();
    this.initCardScrollTracking();
    this.initSmoothScroll();
    this.initLogoClick();
    this.initMobileMenu();
  }

  initNavVisibility() {
    const updateVisibility = () => {
      if (!this.heroTrack || !this.navElement) return;

      const trackHeight = this.heroTrack.offsetHeight;
      const maxHeroScroll = trackHeight - window.innerHeight;
      const currentScroll = window.scrollY || document.documentElement.scrollTop;

      if (currentScroll > maxHeroScroll + 10) {
        if (!this.isNavVisible) {
          this.isNavVisible = true;
          this.navElement.classList.add('nav-visible');
        }
      } else {
        if (this.isNavVisible) {
          this.isNavVisible = false;
          this.navElement.classList.remove('nav-visible');
          
          if (this.navMenu && this.navMenu.classList.contains('open')) {
            this.navMenu.classList.remove('open');
            if (this.mobileToggle) {
              this.mobileToggle.setAttribute('aria-expanded', 'false');
            }
          }
        }
      }
    };

    window.addEventListener('scroll', updateVisibility, { passive: true });
    window.addEventListener('resize', updateVisibility, { passive: true });
    updateVisibility();
  }

  initScrollProgress() {
    const updateProgress = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
      if (this.progressBar) {
        this.progressBar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
      }
    };

    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  }

  initCardScrollTracking() {
    const updateActiveSection = () => {
      const currentScroll = window.scrollY || document.documentElement.scrollTop;

      if (!this.curriculumStack) {
        return;
      }

      const stackTop = this.curriculumStack.offsetTop;
      const stackHeight = this.curriculumStack.offsetHeight;
      const scrollRange = stackHeight - window.innerHeight;

      if (currentScroll < stackTop - 120) {
        this.setActiveLink('heroTrack');
        return;
      }

      if (currentScroll >= stackTop + scrollRange + 80) {
        this.setActiveLink('conclusion');
        return;
      }

      const p = Math.max(0, Math.min(1, (currentScroll - stackTop) / Math.max(scrollRange, 1)));

      let activeId = this.cardIds[0];
      if (p < 0.15) {
        activeId = this.cardIds[0];
      } else if (p < 0.35) {
        activeId = this.cardIds[1];
      } else if (p < 0.55) {
        activeId = this.cardIds[2];
      } else if (p < 0.75) {
        activeId = this.cardIds[3];
      } else if (p < 0.92) {
        activeId = this.cardIds[4];
      } else {
        activeId = this.cardIds[5];
      }

      this.setActiveLink(activeId);
    };

    window.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('resize', updateActiveSection, { passive: true });
    updateActiveSection();
  }

  setActiveLink(sectionId) {
    if (!sectionId) return;
    this.activeSectionId = sectionId;

    this.navLinks.forEach((link) => {
      const targetId = link.getAttribute('href')?.replace('#', '');
      if (targetId === sectionId) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
      }
    });
  }

  initSmoothScroll() {
    this.navLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (!href || !href.startsWith('#')) return;

        e.preventDefault();
        const targetId = href.substring(1);
        const cardIndexAttr = link.getAttribute('data-card-index');

        if (cardIndexAttr !== null && this.curriculumStack) {
          const cardIndex = parseInt(cardIndexAttr, 10);
          if (!isNaN(cardIndex) && cardIndex >= 0 && cardIndex < this.cardTargets.length) {
            const stackTop = this.curriculumStack.offsetTop;
            const stackHeight = this.curriculumStack.offsetHeight;
            const scrollRange = stackHeight - window.innerHeight;
            const targetP = this.cardTargets[cardIndex];
            const targetY = stackTop + scrollRange * targetP;

            window.scrollTo({ top: targetY, behavior: 'smooth' });
            this.setActiveLink(targetId);
          }
        } else if (targetId === 'heroTrack') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          this.setActiveLink('heroTrack');
        } else {
          const targetEl = document.getElementById(targetId);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth' });
            this.setActiveLink(targetId);
          }
        }

        if (this.navMenu && this.navMenu.classList.contains('open')) {
          this.navMenu.classList.remove('open');
          if (this.mobileToggle) {
            this.mobileToggle.setAttribute('aria-expanded', 'false');
          }
        }
      });
    });
  }

  initLogoClick() {
    const logos = document.querySelectorAll('#navLogo, .hero-brand-logo');
    logos.forEach((logo) => {
      logo.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        this.setActiveLink('heroTrack');
      });
    });
  }

  initMobileMenu() {
    if (!this.mobileToggle || !this.navMenu) return;

    this.mobileToggle.addEventListener('click', () => {
      const isOpen = this.navMenu.classList.toggle('open');
      this.mobileToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }
}
