/**
 * bloodCells.js
 * 
 * High-fidelity 3D particle system simulating photorealistic erythrocytes (red blood cells)
 * flowing through an arterial lumen with Poiseuille laminar flow, systolic heart pumping,
 * 3D tumbling, depth-sorted perspective rendering, and smooth cursor obstacle avoidance.
 */

export class BloodCellSystem {
  constructor() {
    this.sprites = [];
    this.spritesLoaded = false;
    this.loadSprites();

    // Weighted distribution: 30% angled, 25% top, 30% angled2, 15% side profile
    this.spriteDistribution = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3];

    // Interactive cursor state
    this.cursor = {
      x: -9999,
      y: -9999,
      active: false,
      lastActiveTime: 0
    };

    this.numCells = 95;
    this.cells = [];
    for (let i = 0; i < this.numCells; i++) {
      this.cells.push(this.createCell(true));
    }
    this.lastTime = 0;
  }

  loadSprites() {
    const urls = [
      '/rbc_angled.png',
      '/rbc_top.png',
      '/rbc_angled2.png',
      '/rbc_side.png'
    ];

    let loadedCount = 0;
    this.sprites = urls.map((url) => {
      const img = new Image();
      img.onload = () => {
        loadedCount++;
        if (loadedCount === urls.length) {
          this.spritesLoaded = true;
        }
      };
      img.src = url;
      return img;
    });
  }

  setCursor(canvasX, canvasY) {
    this.cursor.x = canvasX;
    this.cursor.y = canvasY;
    this.cursor.active = true;
    this.cursor.lastActiveTime = performance.now();
  }

  clearCursor() {
    this.cursor.active = false;
    this.cursor.x = -9999;
    this.cursor.y = -9999;
  }

  createCell(initial = false) {
    const angle = Math.random() * Math.PI * 2;
    const r = 0.05 + Math.sqrt(Math.random()) * 0.55;
    const laminarVelocityFactor = 1.35 - 0.70 * (r * r);
    const spriteIdx = this.spriteDistribution[Math.floor(Math.random() * this.spriteDistribution.length)];
    const rotSpeed = (Math.random() - 0.5) * 0.75;
    const pitchSpeed = (Math.random() - 0.5) * 1.1;

    return {
      r,
      polarAngle: angle,
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r * 0.82,
      z: initial ? 0.08 + Math.random() * 2.2 : 2.1 + Math.random() * 0.4,
      
      // Lateral avoidance offset (deflection away from cursor)
      avoidX: 0,
      avoidY: 0,
      avoidVx: 0,
      avoidVy: 0,
      
      // Forward flow speed and physics
      speed: (0.35 + Math.random() * 0.28) * laminarVelocityFactor,
      baseSize: 34 + Math.random() * 22,
      
      // Visual identity
      spriteIdx,
      flipX: Math.random() > 0.5 ? 1 : -1,
      flipY: Math.random() > 0.5 ? 1 : -1,
      
      // 3D tumbling dynamics
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: rotSpeed,
      pitch: Math.random() * Math.PI * 2,
      pitchSpeed: pitchSpeed,
      
      opacity: 0.90 + Math.random() * 0.10
    };
  }

  update(currentTime, velocity, heartState = null, canvasW = 1280, canvasH = 720) {
    if (this.lastTime === 0) {
      this.lastTime = currentTime;
      return;
    }
    
    const dt = Math.min(0.05, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;

    // Check if cursor is active
    const cursorActive = this.cursor.active && this.cursor.x > -1000;

    // Fixed camera vanishing point: perfectly preserves the tunnel perspective
    const vX = canvasW * 0.5;
    const vY = canvasH * 0.49;

    // Systolic surge acceleration during heartbeat
    const systolicSurge = heartState && heartState.pulse ? heartState.pulse * 0.65 : 0;
    
    // Constant uninterrupted forward flow down the artery
    const forwardSpeed = dt * (0.75 + systolicSurge + Math.abs(velocity) * 12.0);
    
    // Avoidance radius around the cursor (generous, visible field of influence)
    const avoidRadius = Math.max(150, Math.min(canvasW, canvasH) * 0.24);
    const avoidRadiusSq = avoidRadius * avoidRadius;

    for (let i = 0; i < this.numCells; i++) {
      const cell = this.cells[i];
      // Cells ALWAYS advance forward along Z down the artery
      cell.z -= cell.speed * forwardSpeed;
      
      // 3D tumbling & rotation
      cell.rotation += cell.rotationSpeed * dt;
      cell.pitch += cell.pitchSpeed * dt;
      
      // Gentle laminar helical swirl around arterial centerline
      cell.polarAngle += (0.12 / (cell.r + 0.2)) * dt;
      cell.x = Math.cos(cell.polarAngle) * cell.r;
      cell.y = Math.sin(cell.polarAngle) * cell.r * 0.82;

      // ==========================================
      // CURSOR OBSTACLE AVOIDANCE
      // ==========================================
      const perspective = 1.0 / (cell.z + 0.12);
      const screenX = vX + (cell.x + cell.avoidX) * canvasW * 0.50 * perspective;
      const screenY = vY + (cell.y + cell.avoidY) * canvasH * 0.50 * perspective;

      let targetAvoidX = 0;
      let targetAvoidY = 0;

      if (cursorActive) {
        let dx = screenX - this.cursor.x;
        let dy = screenY - this.cursor.y;
        let dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 1.0) {
          dx = (Math.random() - 0.5) || 1.0;
          dy = (Math.random() - 0.5) || 1.0;
          dist = Math.sqrt(dx * dx + dy * dy);
        }

        if (dist < avoidRadius) {
          const proximity = 1.0 - (dist / avoidRadius);
          // Smooth cubic smoothstep for natural fluid deflection
          const smoothP = proximity * proximity * (3.0 - 2.0 * proximity);
          const depthWeight = Math.min(1.8, 1.0 / (cell.z + 0.25));
          const maxPush = 0.22; // Clearly visible deflection (~100-160px on screen)

          targetAvoidX = (dx / dist) * smoothP * maxPush * depthWeight;
          targetAvoidY = (dy / dist) * smoothP * maxPush * depthWeight * 0.82;

          // Agitate tumbling slightly when deflecting around obstacle
          cell.rotationSpeed += (Math.random() - 0.5) * smoothP * 0.4;
        }
      }

      // Smooth lerp: fast responsive deflection, smooth spring recovery
      const lerpSpeed = (targetAvoidX !== 0 || targetAvoidY !== 0) ? 9.0 : 4.0;
      cell.avoidX += (targetAvoidX - cell.avoidX) * Math.min(1.0, dt * lerpSpeed);
      cell.avoidY += (targetAvoidY - cell.avoidY) * Math.min(1.0, dt * lerpSpeed);

      // Enforce strict arterial lumen boundary: cells NEVER exit through the artery wall
      const posX = cell.x + cell.avoidX;
      const posY = (cell.y + cell.avoidY) / 0.82;
      const currentRadius = Math.sqrt(posX * posX + posY * posY);
      const maxLumenRadius = 0.65;
      if (currentRadius > maxLumenRadius) {
        const clampRatio = maxLumenRadius / currentRadius;
        cell.avoidX = posX * clampRatio - cell.x;
        cell.avoidY = (posY * clampRatio * 0.82) - cell.y;
      }

      // Recycle cell to back of tunnel when passing camera
      if (cell.z < 0.04) {
        Object.assign(cell, this.createCell(false));
      }
    }
  }

  draw(ctx, canvasW, canvasH, arteryAlpha) {
    if (arteryAlpha <= 0.01) return;
    
    // Sort cells by Z descending (painters algorithm: back to front)
    const sorted = [...this.cells].sort((a, b) => b.z - a.z);
    
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Fixed central vanishing point of the arterial tunnel
    const vX = canvasW * 0.5;
    const vY = canvasH * 0.49;
    
    // Perspective focal length
    const focalLength = 1.0;
    
    for (let i = 0; i < sorted.length; i++) {
      const cell = sorted[i];
      
      // Perspective projection
      const perspective = focalLength / (cell.z + 0.12);
      
      // 3D to 2D screen coordinates with lateral avoidance
      const drawX = vX + (cell.x + cell.avoidX) * canvasW * 0.50 * perspective;
      const drawY = vY + (cell.y + cell.avoidY) * canvasH * 0.50 * perspective;
      
      const drawSize = cell.baseSize * perspective;
      
      // Skip if off-screen
      if (drawSize < 1.5 || drawX < -drawSize || drawX > canvasW + drawSize || drawY < -drawSize || drawY > canvasH + drawSize) {
        continue;
      }
      
      // Depth-based opacity & atmospheric attenuation
      let depthAlpha = 1.0;
      if (cell.z > 1.6) {
        depthAlpha = Math.max(0, (2.3 - cell.z) / 0.7);
      } else if (cell.z < 0.14) {
        depthAlpha = Math.max(0, (cell.z - 0.04) / 0.10);
      }
      
      const finalAlpha = arteryAlpha * cell.opacity * depthAlpha;
      if (finalAlpha <= 0.01) continue;
      
      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.rotate(cell.rotation);
      
      // 3D tumbling foreshortening: squashing along pitch axis (except for side dumbbell profile)
      let squashY = 1.0;
      if (cell.spriteIdx !== 3) {
        const cosPitch = Math.cos(cell.pitch);
        squashY = 0.62 + 0.38 * Math.abs(cosPitch);
      }
      ctx.scale(cell.flipX, cell.flipY * squashY);
      
      ctx.globalAlpha = finalAlpha;
      
      const sprite = this.sprites[cell.spriteIdx];
      if (this.spritesLoaded && sprite && sprite.complete && sprite.naturalWidth > 0) {
        // Soft organic subsurface glow for prominent midground cells
        if (drawSize > 35 && cell.z < 1.2) {
          ctx.shadowColor = 'rgba(235, 30, 45, 0.22)';
          ctx.shadowBlur = drawSize * 0.12;
        }
        
        ctx.drawImage(
          sprite,
          -drawSize / 2,
          -drawSize / 2,
          drawSize,
          drawSize
        );
      } else {
        // High quality procedural biconcave disc fallback while sprites finish loading
        const grad = ctx.createRadialGradient(0, 0, drawSize * 0.15, 0, 0, drawSize * 0.5);
        grad.addColorStop(0, 'rgba(110, 8, 15, 0.7)');
        grad.addColorStop(0.65, 'rgba(215, 30, 42, 0.95)');
        grad.addColorStop(0.9, 'rgba(170, 16, 24, 0.9)');
        grad.addColorStop(1, 'rgba(90, 5, 10, 0.4)');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, 0, drawSize * 0.5, drawSize * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.restore();
    }
    
    ctx.restore();
  }
}



