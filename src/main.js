import { HeroScene } from './heroScene.js';
import { NavController } from './navController.js';
import { ScrollRevealController } from './scrollReveal.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import WorkPage from './WorkPage.jsx';

if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

window.addEventListener('beforeunload', () => {
  window.scrollTo(0, 0);
});

window.addEventListener('DOMContentLoaded', () => {
  window.scrollTo(0, 0);

  const hero = new HeroScene();
  hero.init().catch((err) => {
    console.error('Failed to initialize cardiac hero visualization:', err);
  });

  const stackMount = document.getElementById('curriculumStackRoot');
  if (stackMount) {
    const root = createRoot(stackMount);
    root.render(React.createElement(WorkPage));
  }

  const nav = new NavController();
  nav.init();

  const reveal = new ScrollRevealController();
  reveal.init();
});
