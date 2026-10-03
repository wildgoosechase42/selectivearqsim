/**
 * gamePhysics.js
 * 
 * Hardware-Accelerated 2D Falling-Block Engine with Physical Receiver Buffer:
 * 1. LEFT ZONE: RECEIVER BUFFER RACK (104px width)
 *    - 8 physical persistent storage slots
 *    - Visible capacity meter (e.g. 3 / 8) and gold scientific styling
 *    - Compact horizontal packet cards: [ P04 | BUFFERED ]
 *    - Animates out-of-order packets sliding LEFT into the rack
 * 2. CENTER & RIGHT ZONE: EXPANDED MAIN RECEIVER GRID (12 columns x 18 rows)
 *    - Occupies ~70% of canvas width (312px x 468px)
 *    - Falling transmission groups with bottom-up numerical ordering
 *    - Clearly visible bottom floor boundary line with sequence alignment ticks
 *    - Steerable: Left, Right, Rotate (with wall-kicks), Soft Drop, Hard Drop
 *    - Deliberate recovery sockets accessible after upper packets buffer left
 *    - In-grid recovery drop: R{seq} descends directly in the socket column
 * 3. BUFFER -> MAIN GRID -> ORDERED DELIVERY SEQUENCE
 *    - Out-of-order packets retain their predetermined logical main grid destinations
 *    - Upon missing packet recovery:
 *      Target slot highlights on main grid -> packet lifts from buffer ->
 *      moves along return route -> snaps into main grid target -> delivers in order!
 */

function getPacketSeq(item) {
  if (item === null || item === undefined) return null;
  return typeof item === 'object' ? (item.seq !== undefined ? item.seq : item.sequenceNumber) : item;
}

export class GamePhysics {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = {
      onGroupLanded: () => {},
      onRecoveryDocked: () => {},
      onRecoveryMissed: () => {},
      ...callbacks
    };

    // Canvas Dimensions (Expanded & Centered)
    this.canvasWidth = 460;
    this.canvasHeight = 510;

    // Left Zone: Buffer Rack
    this.bufferX = 12;
    this.bufferY = 20;
    this.bufferWidth = 104;
    this.bufferHeight = 468;
    this.bufferSlotsCount = 8;
    this.bufferSlotHeight = 36;

    // Center/Right Zone: Main Receiver Grid (12 cols x 18 rows)
    this.mainCols = 12;
    this.mainRows = 18;
    this.cellSize = 26;
    this.gridX = 132;
    this.gridY = 20;
    this.gridWidth = this.mainCols * this.cellSize;   // 312px
    this.gridHeight = this.mainRows * this.cellSize; // 468px

    // Main Grid storage (18 rows x 12 cols)
    this.grid = Array.from({ length: this.mainRows }, () => Array(this.mainCols).fill(null));

    // Predetermined logical main grid destinations for buffered packets
    this.bufferedPacketTargets = new Map(); // seq -> { row, col, groupId }
    this.activeReleaseTarget = null;        // { seq, row, col, progress }

    // Active falling Transmission Group
    this.currentGroup = null;
    this.dropAccumulator = 0;
    this.baseDropInterval = 0.95;

    // Active Small Recovery Packet (1x1 R03) falling directly in grid
    this.currentRecoveryPacket = null;
    this.recoveryDropAccumulator = 0;

    // Buffered packets list in rack: array of persistent packet objects or sequence numbers
    this.bufferedPackets = [];
    this.bufferCapacity = 8;
    this.expectedSeq = 1;

    // Active physical sliding animations (packets moving to/from buffer)
    this.animatingPackets = [];

    // Upward ACKs, particles
    this.ackSignals = [];
    this.particles = [];
    this.selectedSeq = null;

    this.pulsePhase = 0;
    this.erythrocytes = Array.from({ length: 18 }, () => ({
      x: Math.random() * this.canvasWidth,
      y: Math.random() * this.canvasHeight,
      radius: 1.5 + Math.random() * 2,
      speed: 0.3 + Math.random() * 0.7,
      alpha: 0.12 + Math.random() * 0.2
    }));

    this.handleResize();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.handleResize(), { passive: true });
    }
  }

  handleResize() {
    if (!this.canvas) return;
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;

    this.canvasWidth = 460;
    this.canvasHeight = 510;

    this.canvas.width = Math.round(this.canvasWidth * dpr);
    this.canvas.height = Math.round(this.canvasHeight * dpr);

    if (this.ctx.resetTransform) this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);
  }

  /* ========================================================================
     TRANSMISSION GROUP SPAWNING & CONTROLS
     ======================================================================== */

  spawnGroup(groupData) {
    if (!groupData) return;

    const matrix = groupData.matrix.map(row => row.map(cell => (cell ? { ...cell } : null)));
    const startCol = Math.max(0, Math.floor((this.mainCols - groupData.cols) / 2));

    this.currentGroup = {
      id: groupData.id,
      name: groupData.name,
      rows: groupData.rows,
      cols: groupData.cols,
      matrix,
      col: startCol,
      row: 0,
      x: this.gridX + startCol * this.cellSize,
      y: this.gridY,
      velocityY: 52, // initial downward velocity in px/s (~2.0 grid cells/sec)
      baseSpeed: 52,
      gravity: 5,   // gentle continuous acceleration
      maxSpeed: 85,
      packets: [...groupData.packets]
    };

    this.dropAccumulator = 0;

    // Spawn subtle particle flash in center grid
    const spawnX = this.gridX + (startCol + groupData.cols / 2) * this.cellSize;
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: spawnX,
        y: this.gridY + 10,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 2,
        radius: 2,
        alpha: 0.9,
        color: '#d4af35',
        decay: 0.04
      });
    }
  }

  spawnRecoveryPacket(recoveryData) {
    if (!recoveryData) return;

    let targetRow = -1;
    let targetCol = -1;

    // Find socket coordinates in main grid
    for (let r = 0; r < this.mainRows; r++) {
      for (let c = 0; c < this.mainCols; c++) {
        const cell = this.grid[r][c];
        if (cell && cell.seq === recoveryData.seq) {
          targetRow = r;
          targetCol = c;
          break;
        }
      }
      if (targetRow !== -1) break;
    }

    if (targetCol === -1) {
      const saved = this.bufferedPacketTargets.get(recoveryData.seq);
      if (saved) {
        targetRow = saved.row;
        targetCol = saved.col;
      } else {
        targetCol = Math.floor(this.mainCols / 2);
        targetRow = this.mainRows - 1;
      }
    }

    // Pick random spawn column inside playable area [0, mainCols - 1]
    const validUnobstructedCols = [];
    for (let c = 0; c < this.mainCols; c++) {
      if (!this.isGridCellBlocked(0, c, recoveryData.seq)) {
        validUnobstructedCols.push(c);
      }
    }

    const availableCols = validUnobstructedCols.length > 0
      ? validUnobstructedCols
      : Array.from({ length: this.mainCols }, (_, i) => i);

    // Away from targetCol if possible (top-left, top-center, top-right)
    const candidateCols = availableCols.filter(c => Math.abs(c - targetCol) >= 2);
    const fallbackCols = availableCols.filter(c => c !== targetCol);
    const pool = candidateCols.length > 0 ? candidateCols : (fallbackCols.length > 0 ? fallbackCols : availableCols);
    const spawnCol = pool[Math.floor(Math.random() * pool.length)];

    const padSeq = String(recoveryData.seq).padStart(2, '0');
    const attempt = recoveryData.attempt || 1;
    const spawnX = this.gridX + spawnCol * this.cellSize;
    const spawnY = this.gridY + 2;

    // 1. Create a REAL, physically active recovery object
    this.currentRecoveryPacket = {
      id: `retransmission-${padSeq}-${attempt}`,
      sequenceNumber: recoveryData.seq,
      seq: recoveryData.seq,
      type: "RETRANSMISSION",
      label: `R${padSeq}`,
      subLabel: "RETX",
      target: `P${padSeq}`,
      targetSequence: recoveryData.seq,
      col: spawnCol,
      row: 0,
      x: spawnX,
      y: spawnY,
      velocityY: 52, // initial downward velocity in px/s (~2.0 grid cells/sec)
      baseSpeed: 52,
      gravity: 6,    // real continuous downward acceleration
      maxSpeed: 85,
      rotation: 0,
      rotationAngle: 0,
      status: "FALLING",
      targetCol,
      targetRow,
      isDocking: false,
      isMissed: false
    };

    this.recoveryDropAccumulator = 0;

    // Golden spawn particle effect
    for (let p = 0; p < 10; p++) {
      this.particles.push({
        x: spawnX + this.cellSize / 2,
        y: spawnY + this.cellSize / 2,
        vx: (Math.random() - 0.5) * 4,
        vy: -Math.random() * 2.5,
        radius: 2,
        alpha: 0.95,
        color: '#fde047',
        decay: 0.04
      });
    }
  }

  /* ========================================================================
     PLAYER STEERING
     ======================================================================== */

  moveLeft() {
    if (this.currentRecoveryPacket && !this.currentRecoveryPacket.isDocking && !this.currentRecoveryPacket.isMissed) {
      const pkt = this.currentRecoveryPacket;
      if (pkt.col > 0) {
        const nextCol = pkt.col - 1;
        const curRow = Math.max(0, Math.floor((pkt.y - this.gridY) / this.cellSize));
        const frac = (pkt.y - this.gridY) % this.cellSize;
        const checkNext = frac > 4;

        if (!this.isGridCellBlocked(curRow, nextCol, pkt.seq) &&
            (!checkNext || !this.isGridCellBlocked(curRow + 1, nextCol, pkt.seq))) {
          pkt.col = nextCol;
          pkt.x = this.gridX + nextCol * this.cellSize;
          this.checkRecoveryDocking();
          return true;
        }
      }
      return false;
    }

    if (!this.currentGroup) return false;
    const currentRow = Math.max(0, Math.floor((this.currentGroup.y - this.gridY) / this.cellSize));
    const frac = (this.currentGroup.y - this.gridY) % this.cellSize;
    const checkNext = frac > 2;

    const canMove = !this.checkGroupCollision(this.currentGroup.matrix, this.currentGroup.col - 1, currentRow) &&
                    (!checkNext || !this.checkGroupCollision(this.currentGroup.matrix, this.currentGroup.col - 1, currentRow + 1));

    if (canMove) {
      this.currentGroup.col--;
      this.currentGroup.x = this.gridX + this.currentGroup.col * this.cellSize;
      return true;
    }
    return false;
  }

  moveRight() {
    if (this.currentRecoveryPacket && !this.currentRecoveryPacket.isDocking && !this.currentRecoveryPacket.isMissed) {
      const pkt = this.currentRecoveryPacket;
      if (pkt.col < this.mainCols - 1) {
        const nextCol = pkt.col + 1;
        const curRow = Math.max(0, Math.floor((pkt.y - this.gridY) / this.cellSize));
        const frac = (pkt.y - this.gridY) % this.cellSize;
        const checkNext = frac > 4;

        if (!this.isGridCellBlocked(curRow, nextCol, pkt.seq) &&
            (!checkNext || !this.isGridCellBlocked(curRow + 1, nextCol, pkt.seq))) {
          pkt.col = nextCol;
          pkt.x = this.gridX + nextCol * this.cellSize;
          this.checkRecoveryDocking();
          return true;
        }
      }
      return false;
    }

    if (!this.currentGroup) return false;
    const currentRow = Math.max(0, Math.floor((this.currentGroup.y - this.gridY) / this.cellSize));
    const frac = (this.currentGroup.y - this.gridY) % this.cellSize;
    const checkNext = frac > 2;

    const canMove = !this.checkGroupCollision(this.currentGroup.matrix, this.currentGroup.col + 1, currentRow) &&
                    (!checkNext || !this.checkGroupCollision(this.currentGroup.matrix, this.currentGroup.col + 1, currentRow + 1));

    if (canMove) {
      this.currentGroup.col++;
      this.currentGroup.x = this.gridX + this.currentGroup.col * this.cellSize;
      return true;
    }
    return false;
  }

  rotate() {
    if (this.currentRecoveryPacket && !this.currentRecoveryPacket.isDocking && !this.currentRecoveryPacket.isMissed) {
      this.currentRecoveryPacket.rotationAngle = (this.currentRecoveryPacket.rotationAngle || 0) + Math.PI / 2;
      for (let i = 0; i < 4; i++) {
        this.particles.push({
          x: this.currentRecoveryPacket.x + this.cellSize / 2,
          y: this.currentRecoveryPacket.y + this.cellSize / 2,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          radius: 1.5,
          alpha: 0.8,
          color: '#d4af35',
          decay: 0.06
        });
      }
      return true;
    }

    if (!this.currentGroup) return false;

    const m = this.currentGroup.matrix;
    const oldRows = m.length;
    const oldCols = m[0].length;
    const rotated = Array.from({ length: oldCols }, () => Array(oldRows).fill(null));

    for (let r = 0; r < oldRows; r++) {
      for (let c = 0; c < oldCols; c++) {
        rotated[c][oldRows - 1 - r] = m[r][c];
      }
    }

    const currentRow = Math.max(0, Math.floor((this.currentGroup.y - this.gridY) / this.cellSize));
    const frac = (this.currentGroup.y - this.gridY) % this.cellSize;
    const checkNext = frac > 2;

    const kicks = [0, -1, 1, -2, 2];
    for (const offset of kicks) {
      const testCol = this.currentGroup.col + offset;
      const canRotate = !this.checkGroupCollision(rotated, testCol, currentRow) &&
                        (!checkNext || !this.checkGroupCollision(rotated, testCol, currentRow + 1));
      if (canRotate) {
        this.currentGroup.col = testCol;
        this.currentGroup.matrix = rotated;
        this.currentGroup.rows = oldCols;
        this.currentGroup.cols = oldRows;
        this.currentGroup.x = this.gridX + testCol * this.cellSize;

        // Ensure current Y does not exceed ghost row of rotated piece
        const ghostRow = this.getGhostRow();
        const maxAllowedY = this.gridY + ghostRow * this.cellSize;
        if (this.currentGroup.y > maxAllowedY) {
          this.currentGroup.y = maxAllowedY;
          this.currentGroup.row = ghostRow;
        }
        return true;
      }
    }
    return false;
  }

  softDrop() {
    if (this.currentRecoveryPacket && !this.currentRecoveryPacket.isDocking && !this.currentRecoveryPacket.isMissed) {
      this.stepRecoveryPacketDown(this.cellSize * 0.85);
      return true;
    }

    if (!this.currentGroup) return false;
    const ghostRow = this.getGhostRow();
    const targetMaxY = this.gridY + ghostRow * this.cellSize;

    // Advance falling group downwards
    this.currentGroup.y = Math.min(targetMaxY, this.currentGroup.y + this.cellSize * 0.85);
    this.currentGroup.row = Math.max(0, Math.floor((this.currentGroup.y - this.gridY) / this.cellSize));

    if (this.currentGroup.y >= targetMaxY) {
      this.currentGroup.y = targetMaxY;
      this.currentGroup.row = ghostRow;
      this.lockCurrentGroup();
      return false;
    }
    return true;
  }

  hardDrop() {
    if (this.currentRecoveryPacket && !this.currentRecoveryPacket.isDocking && !this.currentRecoveryPacket.isMissed) {
      const pkt = this.currentRecoveryPacket;
      const col = pkt.col;
      const targetCol = pkt.targetCol;
      const targetRow = pkt.targetRow;

      if (col === targetCol && targetRow !== -1) {
        // Slam straight down into socket in this column
        pkt.y = this.gridY + targetRow * this.cellSize;
        this.checkRecoveryDocking();
      } else {
        // Slam straight down to obstacle/floor in this column -> Miss!
        const landingY = this.getColumnLandingY(col, pkt.seq);
        pkt.y = landingY;
        this.triggerRecoveryMissed();
      }
      return;
    }

    if (!this.currentGroup) return;
    const ghostRow = this.getGhostRow();
    this.currentGroup.row = ghostRow;
    this.currentGroup.y = this.gridY + ghostRow * this.cellSize;
    this.lockCurrentGroup();
  }

  getGhostRow() {
    if (!this.currentGroup) return 0;
    const currentRow = Math.max(0, Math.floor((this.currentGroup.y - this.gridY) / this.cellSize));
    let r = currentRow;
    while (!this.checkGroupCollision(this.currentGroup.matrix, this.currentGroup.col, r + 1)) {
      r++;
    }
    return r;
  }

  checkGroupCollision(matrix, col, row) {
    const numRows = matrix.length;
    const numCols = matrix[0].length;

    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        if (matrix[r][c] !== null) {
          const boardC = col + c;
          const boardR = row + r;

          if (boardC < 0 || boardC >= this.mainCols) return true;
          if (boardR >= this.mainRows) return true;
          if (boardR >= 0 && this.grid[boardR][boardC] !== null && !this.grid[boardR][boardC].isTargetSlot) return true;
        }
      }
    }
    return false;
  }

  lockCurrentGroup() {
    const group = this.currentGroup;
    if (!group) return;

    const m = group.matrix;

    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        const cell = m[r][c];
        if (cell !== null) {
          const boardC = group.col + c;
          const boardR = group.row + r;

          if (boardR >= 0 && boardR < this.mainRows && boardC >= 0 && boardC < this.mainCols) {
            const isCorrupted = cell.isCorrupted || false;
            const isLost = cell.isLost || false;
            this.grid[boardR][boardC] = {
              groupId: group.id,
              seq: cell.seq,
              isCorrupted,
              isLost,
              isSocket: isCorrupted || isLost,
              isTargetSlot: false,
              status: isCorrupted ? 'CORRUPTED' : (isLost ? 'MISSING' : 'RECEIVED')
            };
          }
        }
      }
    }

    const lockedGroupId = group.id;
    this.currentGroup = null;

    this.callbacks.onGroupLanded(lockedGroupId);
  }

  /* ========================================================================
     PHYSICAL BUFFER TRANSFER & RETURN TO MAIN GRID ANIMATIONS
     ======================================================================== */

  /**
   * Animates out-of-order packets sliding LEFT from main grid into receiver buffer rack.
   * Remembers predetermined logical grid destination for later return.
   */
  animatePacketsToBuffer(seqList, bufferStateList) {
    this.bufferedPackets = [...bufferStateList];

    seqList.forEach(seq => {
      // Find packet in main grid
      for (let r = 0; r < this.mainRows; r++) {
        for (let c = 0; c < this.mainCols; c++) {
          const cell = this.grid[r][c];
          if (cell && cell.seq === seq) {
            // Store its exact logical destination on the main grid!
            this.bufferedPacketTargets.set(seq, {
              row: r,
              col: c,
              groupId: cell.groupId
            });

            // Find slot index in buffer rack
            let slotIndex = 0;
            for (let i = 0; i < this.bufferedPackets.length; i++) {
              if (getPacketSeq(this.bufferedPackets[i]) === seq) {
                slotIndex = i;
                break;
              }
            }

            const targetX = this.bufferX + 6;
            const targetY = this.bufferY + 42 + slotIndex * 50;

            const startX = this.gridX + c * this.cellSize;
            const startY = this.gridY + r * this.cellSize;

            // Retain reserved target placeholder on main grid
            this.grid[r][c] = {
              groupId: cell.groupId,
              seq: cell.seq,
              isTargetSlot: true,
              status: 'BUFFERED_AWAITING_RETURN'
            };

            // Launch smooth physical slide animation into buffer rack
            this.animatingPackets.push({
              seq,
              startX,
              startY,
              currentX: startX,
              currentY: startY,
              targetX,
              targetY,
              progress: 0,
              type: 'TO_BUFFER'
            });
            break;
          }
        }
      }
    });
  }

  /**
   * Animates ONE single packet released from buffer rack returning to its proper MAIN GRID position.
   * 1. Target slot highlights in gold on main grid
   * 2. Packet lifts slightly from buffer rack and glides across return route (400-600ms)
   * 3. Packet aligns and snaps into target position on main grid
   * 4. State becomes DELIVERED (white/neutral permanent block)
   */
  animateSinglePacketReleased(releasedSeq, remainingBufferList) {
    const seq = getPacketSeq(releasedSeq);

    // Find slot index of released packet before removing from rack
    let slotIndex = 0;
    for (let i = 0; i < this.bufferedPackets.length; i++) {
      if (getPacketSeq(this.bufferedPackets[i]) === seq) {
        slotIndex = i;
        break;
      }
    }

    const startX = this.bufferX + 6;
    const startY = this.bufferY + 42 + slotIndex * 50;

    // Look up predetermined logical destination on main grid
    const target = this.bufferedPacketTargets.get(seq);
    let targetRow = 0;
    let targetCol = 0;
    let groupId = 1;

    if (target) {
      targetRow = target.row;
      targetCol = target.col;
      groupId = target.groupId;
    } else {
      // Fallback search in grid
      for (let r = 0; r < this.mainRows; r++) {
        for (let c = 0; c < this.mainCols; c++) {
          if (this.grid[r][c] && this.grid[r][c].seq === seq) {
            targetRow = r;
            targetCol = c;
            groupId = this.grid[r][c].groupId || 1;
            break;
          }
        }
      }
    }

    const destX = this.gridX + targetCol * this.cellSize;
    const destY = this.gridY + targetRow * this.cellSize;

    // Highlight target slot on main grid
    this.activeReleaseTarget = {
      seq,
      row: targetRow,
      col: targetCol,
      progress: 0
    };

    // Launch return animation: BUFFER -> MAIN GRID TARGET
    this.animatingPackets.push({
      seq,
      startX,
      startY,
      currentX: startX,
      currentY: startY,
      targetX: destX,
      targetY: destY,
      targetRow,
      targetCol,
      groupId,
      progress: 0,
      type: 'RETURN_TO_GRID'
    });

    // Update rack with remaining persistent packets
    this.bufferedPackets = [...remainingBufferList];

    // Subtle gold burst at buffer release gate
    for (let p = 0; p < 8; p++) {
      this.particles.push({
        x: startX + 44,
        y: startY + 16,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 2.5,
        radius: 2,
        alpha: 1.0,
        color: '#d4af35',
        decay: 0.04
      });
    }
  }

  animatePacketsReleased(releasedSeqList, remainingBufferList) {
    this.bufferedPackets = [...remainingBufferList];
    releasedSeqList.forEach(seq => {
      this.animateSinglePacketReleased(seq, this.bufferedPackets);
    });
  }

  /**
   * Removes a corrupted cell, leaving a deliberate RECOVERY SOCKET
   */
  removeCorruptedCellBySeq(seq) {
    let removed = false;

    for (let r = 0; r < this.mainRows; r++) {
      for (let c = 0; c < this.mainCols; c++) {
        const cell = this.grid[r][c];
        if (cell && cell.seq === seq && cell.isCorrupted) {
          cell.isCorrupted = false;
          cell.isSocket = true;
          cell.status = 'MISSING';
          removed = true;

          // Red dissolution burst
          for (let p = 0; p < 8; p++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = 1.5 + Math.random() * 3;
            this.particles.push({
              x: this.gridX + c * this.cellSize + 12,
              y: this.gridY + r * this.cellSize + 12,
              vx: Math.cos(angle) * spd,
              vy: Math.sin(angle) * spd,
              radius: 2,
              alpha: 1.0,
              color: '#ff3b47',
              decay: 0.04
            });
          }
        }
      }
    }

    return removed;
  }

  isGridCellBlocked(r, c, targetSeq) {
    if (r < 0 || c < 0 || c >= this.mainCols) return true;
    if (r >= this.mainRows) return true;
    const cell = this.grid[r][c];
    if (!cell) return false;
    // Target socket is accessible to R{targetSeq}
    if (cell.isSocket && cell.seq === targetSeq) return false;
    // Reserved return slots for buffered packets are empty air
    if (cell.isTargetSlot) return false;
    return true;
  }

  getColumnLandingY(col, targetSeq) {
    for (let r = 0; r < this.mainRows; r++) {
      if (this.isGridCellBlocked(r, col, targetSeq)) {
        return Math.max(this.gridY, this.gridY + (r - 1) * this.cellSize);
      }
    }
    return this.gridY + (this.mainRows - 1) * this.cellSize;
  }

  stepRecoveryPacketDown(dy) {
    const pkt = this.currentRecoveryPacket;
    if (!pkt || pkt.isDocking || pkt.isMissed) return;

    const col = pkt.col;
    const targetCol = pkt.targetCol;
    const targetRow = pkt.targetRow;

    if (col === targetCol && targetRow !== -1) {
      const socketY = this.gridY + targetRow * this.cellSize;
      pkt.y += dy;
      if (pkt.y >= socketY) {
        pkt.y = socketY;
        this.checkRecoveryDocking();
      }
    } else {
      const landingY = this.getColumnLandingY(col, pkt.seq);
      pkt.y += dy;
      if (pkt.y >= landingY) {
        pkt.y = landingY;
        this.triggerRecoveryMissed();
      }
    }
  }

  triggerRecoveryMissed() {
    const pkt = this.currentRecoveryPacket;
    if (!pkt || pkt.isDocking || pkt.isMissed) return;

    pkt.isMissed = true;
    const seq = pkt.seq;

    // Error dissolution particles in crimson red (#c81e1e)
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 1.5 + Math.random() * 3.5;
      this.particles.push({
        x: pkt.x + this.cellSize / 2,
        y: pkt.y + this.cellSize / 2,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        radius: 2.5,
        alpha: 1.0,
        color: '#c81e1e',
        decay: 0.04
      });
    }

    // Upward floating error text
    this.ackSignals.push({
      seq,
      label: 'WRONG SLOT',
      isError: true,
      x: pkt.x + this.cellSize / 2,
      y: pkt.y,
      startY: pkt.y,
      targetY: pkt.y - 25,
      progress: 0
    });

    this.currentRecoveryPacket = null;
    this.callbacks.onRecoveryMissed?.(seq);
  }

  /**
   * Docking check: R{seq} docks ONLY when precisely aligned with target slot
   * (NO distant snapping, NO automatic placement)
   */
  checkRecoveryDocking() {
    const pkt = this.currentRecoveryPacket;
    if (!pkt || pkt.isDocking || pkt.isMissed || pkt.targetRow === -1) return;

    const socketX = this.gridX + pkt.targetCol * this.cellSize;
    const socketY = this.gridY + pkt.targetRow * this.cellSize;

    // Must be in exact target column and at socket Y
    const isAlignedCol = pkt.col === pkt.targetCol || Math.abs(pkt.x - socketX) < 4;
    const isAlignedY = Math.abs(pkt.y - socketY) <= 8;

    if (isAlignedCol && isAlignedY) {
      pkt.isDocking = true;
      pkt.x = socketX;
      pkt.y = socketY;

      const targetR = pkt.targetRow;
      const targetC = pkt.targetCol;
      const seq = pkt.seq;

      if (this.grid[targetR] && this.grid[targetR][targetC]) {
        this.grid[targetR][targetC].isSocket = false;
        this.grid[targetR][targetC].isCorrupted = false;
        this.grid[targetR][targetC].status = 'DELIVERED';
      }

      // Golden burst particles at docking socket
      for (let i = 0; i < 14; i++) {
        this.particles.push({
          x: socketX + 13,
          y: socketY + 13,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4,
          radius: 2.2,
          alpha: 1.0,
          color: '#fde047',
          decay: 0.035
        });
      }

      // Spawn upward ACK signal
      this.ackSignals.push({
        seq,
        x: socketX + 13,
        y: socketY + 13,
        startY: socketY + 13,
        targetY: this.gridY - 10,
        progress: 0
      });

      this.currentRecoveryPacket = null;
      this.callbacks.onRecoveryDocked(seq);
    }
  }

  /* ========================================================================
     PHYSICS 60FPS UPDATE LOOP
     ======================================================================== */
  update(deltaTime, speedMultiplier = 1.0) {
    this.pulsePhase += deltaTime * 2.5;

    // Update vascular erythrocytes
    for (const ery of this.erythrocytes) {
      ery.y += ery.speed * 30 * deltaTime;
      if (ery.y > this.canvasHeight) {
        ery.y = 0;
        ery.x = Math.random() * this.canvasWidth;
      }
    }

    // Step falling transmission group with true continuous time-based physics
    if (this.currentGroup) {
      const group = this.currentGroup;
      const ghostRow = this.getGhostRow();
      const targetMaxY = this.gridY + ghostRow * this.cellSize;

      // Apply continuous downward gravity acceleration
      group.velocityY = Math.min(group.maxSpeed || 85, (group.velocityY || 52) + (group.gravity || 5) * deltaTime);

      const effectiveSpeed = group.velocityY * speedMultiplier;
      group.y += effectiveSpeed * deltaTime;
      group.row = Math.max(0, Math.floor((group.y - this.gridY) / this.cellSize));

      // Land and lock upon reaching bottom boundary or stack obstacle
      if (group.y >= targetMaxY) {
        group.y = targetMaxY;
        group.row = ghostRow;
        this.lockCurrentGroup();
      }
    }

    // Step falling small recovery packet with true continuous physics & gravity
    if (this.currentRecoveryPacket && !this.currentRecoveryPacket.isDocking && !this.currentRecoveryPacket.isMissed) {
      const pkt = this.currentRecoveryPacket;

      // Apply downward continuous acceleration identical to falling groups
      pkt.velocityY = Math.min(pkt.maxSpeed || 85, (pkt.velocityY || 52) + (pkt.gravity || 6) * deltaTime);
      const effectiveSpeed = pkt.velocityY * speedMultiplier;
      const dy = effectiveSpeed * deltaTime;

      this.stepRecoveryPacketDown(dy);
    }

    // Step packet slide animations (to buffer or returning to grid)
    for (let i = this.animatingPackets.length - 1; i >= 0; i--) {
      const ap = this.animatingPackets[i];

      if (ap.type === 'RETURN_TO_GRID') {
        ap.progress += deltaTime * 1.85; // ~540ms smooth return transition
        const t = Math.min(1.0, ap.progress);
        const eased = 1 - Math.pow(1 - t, 3); // smooth cubic ease-out

        ap.currentX = ap.startX + (ap.targetX - ap.startX) * eased;
        ap.currentY = ap.startY + (ap.targetY - ap.startY) * eased;

        if (this.activeReleaseTarget && this.activeReleaseTarget.seq === ap.seq) {
          this.activeReleaseTarget.progress = t;
        }

        if (t >= 1.0) {
          // Packet snaps into target position on main grid!
          const r = ap.targetRow;
          const c = ap.targetCol;
          if (this.grid[r]) {
            this.grid[r][c] = {
              groupId: ap.groupId,
              seq: ap.seq,
              isCorrupted: false,
              isLost: false,
              isSocket: false,
              isTargetSlot: false,
              status: 'DELIVERED'
            };
          }

          // Golden burst particles at docking socket
          for (let p = 0; p < 12; p++) {
            this.particles.push({
              x: ap.targetX + this.cellSize / 2,
              y: ap.targetY + this.cellSize / 2,
              vx: (Math.random() - 0.5) * 4,
              vy: (Math.random() - 0.5) * 4,
              radius: 2.2,
              alpha: 1.0,
              color: '#fde047',
              decay: 0.035
            });
          }

          // Upward ACK signal shoots up
          this.ackSignals.push({
            seq: ap.seq,
            x: ap.targetX + this.cellSize / 2,
            y: ap.targetY + this.cellSize / 2,
            startY: ap.targetY + this.cellSize / 2,
            targetY: this.gridY - 10,
            progress: 0
          });

          if (this.activeReleaseTarget && this.activeReleaseTarget.seq === ap.seq) {
            this.activeReleaseTarget = null;
          }

          this.animatingPackets.splice(i, 1);
        }
      } else {
        // TO_BUFFER animation
        ap.progress += deltaTime * 2.5; // ~400ms smooth slide
        const t = Math.min(1.0, ap.progress);
        const eased = 1 - Math.pow(1 - t, 3);

        ap.currentX = ap.startX + (ap.targetX - ap.startX) * eased;
        ap.currentY = ap.startY + (ap.targetY - ap.startY) * eased;

        if (t >= 1.0) {
          this.animatingPackets.splice(i, 1);
        }
      }
    }

    // Update upward ACK signals
    for (let i = this.ackSignals.length - 1; i >= 0; i--) {
      const ack = this.ackSignals[i];
      ack.progress += deltaTime * 2.0;
      ack.y = ack.startY - ack.progress * (ack.startY - ack.targetY);
      if (ack.progress >= 1 || ack.y <= ack.targetY) {
        this.ackSignals.splice(i, 1);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * 60 * deltaTime;
      p.y += p.vy * 60 * deltaTime;
      p.alpha -= p.decay;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  /* ========================================================================
     CANVAS RENDERING: BUFFER (LEFT) & MAIN GRID (CENTER/RIGHT)
     ======================================================================== */
  render() {
    const ctx = this.ctx;
    const w = this.canvasWidth;
    const h = this.canvasHeight;

    ctx.clearRect(0, 0, w, h);

    // Deep charcoal background
    ctx.fillStyle = '#0b0b0e';
    ctx.fillRect(0, 0, w, h);

    // Background vascular particles
    for (const ery of this.erythrocytes) {
      ctx.fillStyle = 'rgba(200, 30, 30, 0.16)';
      ctx.beginPath();
      ctx.arc(ery.x, ery.y, ery.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // 1. Render Left Zone: Receiver Buffer Rack
    this.renderBufferRack(ctx);

    // 2. Render Center/Right Zone: Main Receiver Grid (12 cols x 18 rows)
    this.renderMainReceiverGrid(ctx);

    // 3. Render Active In-Grid Recovery Packet (R03)
    this.renderRecoveryPacket(ctx);

    // 4. Render Active Animations (Packets sliding to buffer or returning to grid)
    this.renderAnimatingPackets(ctx);

    // 5. Render Upward ACKs & Particles
    this.renderEffects(ctx);
  }

  /* ------------------------------------------------------------------------
     ZONE 1: RECEIVER BUFFER RACK (LEFT)
     ------------------------------------------------------------------------ */
  renderBufferRack(ctx) {
    const bx = this.bufferX;
    const by = this.bufferY;
    const bw = this.bufferWidth;
    const bh = this.bufferHeight;

    // Buffer container enclosure
    ctx.fillStyle = 'rgba(16, 16, 22, 0.95)';
    ctx.strokeStyle = 'rgba(212, 175, 53, 0.35)';
    ctx.lineWidth = 1.2;
    this.roundRect(ctx, bx, by, bw, bh, 6, true, true);

    // Header: BUFFER
    ctx.font = '700 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#d4af35';
    ctx.fillText('BUFFER', bx + bw / 2, by + 14);

    // Capacity Readout: e.g. 3 / 8
    const count = this.bufferedPackets.length;
    const cap = this.bufferCapacity;
    ctx.font = '700 8.5px "JetBrains Mono", monospace';
    ctx.fillStyle = count >= cap ? '#ff3b47' : '#fde047';
    ctx.fillText(`${count} / ${cap}`, bx + bw / 2, by + 26);

    // Capacity Visual Bar
    const barW = bw - 16;
    const barH = 3;
    const barX = bx + 8;
    const barY = by + 31;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = count >= cap ? '#ff3b47' : '#d4af35';
    ctx.fillRect(barX, barY, Math.min(barW, (count / cap) * barW), barH);

    // 8 Stacked Storage Slots
    for (let i = 0; i < this.bufferSlotsCount; i++) {
      const slotY = by + 42 + i * 50;
      const slotX = bx + 6;
      const slotW = bw - 12;
      const slotH = 40;

      const packetItem = this.bufferedPackets[i];
      const seq = getPacketSeq(packetItem);
      const isStillAnimatingIn = this.animatingPackets.some(ap => ap.seq === seq && ap.type === 'TO_BUFFER');

      if (seq !== null && seq !== undefined && !isStillAnimatingIn) {
        // BUFFERED PACKET CARD (Compact horizontal packet block with gold accent)
        ctx.fillStyle = '#1c180e';
        ctx.strokeStyle = '#d4af35';
        ctx.lineWidth = 1.4;
        this.roundRect(ctx, slotX, slotY, slotW, slotH, 4, true, true);

        // Gold vertical accent stripe on left edge
        ctx.fillStyle = '#d4af35';
        ctx.fillRect(slotX + 1, slotY + 2, 3.5, slotH - 4);

        // Text: P04 (large bold) / BUFFERED (sub-label)
        const padSeq = String(seq).padStart(2, '0');
        ctx.font = '700 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`P${padSeq}`, slotX + slotW / 2 + 1, slotY + 16);

        ctx.font = '700 7px "JetBrains Mono", monospace';
        ctx.fillStyle = '#d4af35';
        ctx.fillText('BUFFERED', slotX + slotW / 2 + 1, slotY + 29);
      } else {
        // Empty Rack Slot (faint dotted contour)
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        this.roundRect(ctx, slotX, slotY, slotW, slotH, 4, false, true);

        ctx.font = '600 7.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillText('—', slotX + slotW / 2, slotY + 23);
        ctx.restore();
      }
    }

    // Divider Line separating Buffer and Main Grid
    ctx.save();
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = 'rgba(212, 175, 53, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.gridX - 6, by);
    ctx.lineTo(this.gridX - 6, by + bh);
    ctx.stroke();
    ctx.restore();
  }

  /* ------------------------------------------------------------------------
     ZONE 2: MAIN RECEIVER GRID (CENTER/RIGHT)
     ------------------------------------------------------------------------ */
  renderMainReceiverGrid(ctx) {
    const gx = this.gridX;
    const gy = this.gridY;
    const gw = this.gridWidth;
    const gh = this.gridHeight;

    // Main grid enclosure
    ctx.fillStyle = 'rgba(14, 14, 19, 0.95)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    this.roundRect(ctx, gx, gy, gw, gh, 6, true, true);

    // Header: MAIN RECEIVER & EXPECTED FRAME
    const expStr = String(this.expectedSeq).padStart(2, '0');
    ctx.font = '700 8px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillText('MAIN RECEIVER (12×18)', gx + 4, gy - 6);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#fde047';
    ctx.fillText(`EXPECTED: P${expStr}`, gx + gw - 4, gy - 6);

    // Internal grid lines
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 1;

    for (let c = 1; c < this.mainCols; c++) {
      const x = gx + c * this.cellSize;
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x, gy + gh);
      ctx.stroke();
    }
    for (let r = 1; r < this.mainRows; r++) {
      const y = gy + r * this.cellSize;
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx + gw, y);
      ctx.stroke();
    }
    ctx.restore();

    // Render permanent locked grid cells and target return slots
    for (let r = 0; r < this.mainRows; r++) {
      for (let c = 0; c < this.mainCols; c++) {
        const cell = this.grid[r][c];
        if (cell) {
          const x = gx + c * this.cellSize;
          const y = gy + r * this.cellSize;

          if (cell.isSocket) {
            // Deliberate Recovery Socket
            this.renderRecoverySocket(ctx, x, y, this.cellSize, cell.seq);
          } else if (cell.isTargetSlot) {
            // Predetermined target slot awaiting return from buffer
            const isHighlight = this.activeReleaseTarget && this.activeReleaseTarget.seq === cell.seq;
            this.renderTargetSlot(ctx, x, y, this.cellSize, cell.seq, isHighlight);
          } else {
            const isDelivered = cell.status === 'DELIVERED';
            this.renderMiniCell(ctx, x, y, this.cellSize, cell.seq, cell.isCorrupted, false, isDelivered);
          }
        }
      }
    }

    // Ghost piece projection
    if (this.currentGroup) {
      const ghostRow = this.getGhostRow();
      const targetMaxY = this.gridY + ghostRow * this.cellSize;

      if (targetMaxY > this.currentGroup.y + 4) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);

        const m = this.currentGroup.matrix;
        for (let r = 0; r < m.length; r++) {
          for (let c = 0; c < m[r].length; c++) {
            if (m[r][c] !== null) {
              const x = gx + (this.currentGroup.col + c) * this.cellSize;
              const y = gy + (ghostRow + r) * this.cellSize;
              this.roundRect(ctx, x + 1, y + 1, this.cellSize - 2, this.cellSize - 2, 3, false, true);
            }
          }
        }
        ctx.restore();
      }
    }

    // Active falling transmission group
    if (this.currentGroup) {
      const group = this.currentGroup;
      const m = group.matrix;

      for (let r = 0; r < m.length; r++) {
        for (let c = 0; c < m[r].length; c++) {
          const cell = m[r][c];
          if (cell !== null) {
            const x = gx + (group.col + c) * this.cellSize;
            const y = group.y + r * this.cellSize;
            this.renderMiniCell(ctx, x, y, this.cellSize, cell.seq, cell.isCorrupted, true);
          }
        }
      }

      // Outer group contour
      const groupX = gx + group.col * this.cellSize;
      const groupY = group.y;
      const groupW = group.cols * this.cellSize;
      const groupH = group.rows * this.cellSize;

      ctx.save();
      ctx.strokeStyle = 'rgba(212, 175, 53, 0.4)';
      ctx.lineWidth = 1.2;
      this.roundRect(ctx, groupX - 1, groupY - 1, groupW + 2, groupH + 2, 4, false, true);

      ctx.font = '700 8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fde047';
      ctx.fillText(`${group.name}`, groupX + groupW / 2, groupY - 6);
      ctx.restore();
    }

    // Subtle target column beacon when recovery packet is active in flight
    if (this.currentRecoveryPacket && this.currentRecoveryPacket.targetCol !== -1) {
      const tc = this.currentRecoveryPacket.targetCol;
      const tX = gx + tc * this.cellSize;
      ctx.save();
      const pulse = (Math.sin(this.pulsePhase * 3) + 1) * 0.5;
      // Subtle column guideline
      ctx.strokeStyle = `rgba(212, 175, 53, ${0.1 + pulse * 0.12})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(tX + this.cellSize / 2, gy);
      ctx.lineTo(tX + this.cellSize / 2, gy + gh);
      ctx.stroke();

      // Subtle top arrow indicator
      ctx.font = '700 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(253, 224, 71, ${0.6 + pulse * 0.4})`;
      ctx.fillText('▼', tX + this.cellSize / 2, gy - 2);
      ctx.restore();
    }

    // Ghost piece projection for active recovery packet
    if (this.currentRecoveryPacket && !this.currentRecoveryPacket.isDocking && !this.currentRecoveryPacket.isMissed) {
      const pkt = this.currentRecoveryPacket;
      const targetY = (pkt.col === pkt.targetCol && pkt.targetRow !== -1)
        ? (this.gridY + pkt.targetRow * this.cellSize)
        : this.getColumnLandingY(pkt.col, pkt.seq);

      if (targetY > pkt.y + 4) {
        ctx.save();
        const pulse = (Math.sin(this.pulsePhase * 3) + 1) * 0.5;
        const isTarget = pkt.col === pkt.targetCol;
        ctx.strokeStyle = isTarget ? `rgba(253, 224, 71, ${0.4 + pulse * 0.3})` : 'rgba(239, 68, 68, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([2, 2]);
        this.roundRect(ctx, pkt.x + 1, targetY + 1, this.cellSize - 2, this.cellSize - 2, 4, false, true);
        ctx.restore();
      }
    }

    // CLEARLY VISIBLE BOTTOM BOUNDARY FLOOR
    const floorY = gy + gh;
    ctx.save();
    ctx.strokeStyle = '#c81e1e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(gx, floorY);
    ctx.lineTo(gx + gw, floorY);
    ctx.stroke();

    // Subtle glowing floor zone
    const grad = ctx.createLinearGradient(gx, floorY - 8, gx, floorY);
    grad.addColorStop(0, 'rgba(200, 30, 30, 0)');
    grad.addColorStop(1, 'rgba(200, 30, 30, 0.16)');
    ctx.fillStyle = grad;
    ctx.fillRect(gx, floorY - 8, gw, 8);

    // Sequence aligned tick marks for 12 columns
    ctx.strokeStyle = 'rgba(200, 30, 30, 0.6)';
    ctx.lineWidth = 1.5;
    for (let c = 0; c <= this.mainCols; c++) {
      const tx = gx + c * this.cellSize;
      ctx.beginPath();
      ctx.moveTo(tx, floorY - 3);
      ctx.lineTo(tx, floorY + 4);
      ctx.stroke();
    }

    // Floor boundary label
    ctx.font = '700 7.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillText('RECEIVER BUS // BOTTOM BOUNDARY', gx + gw / 2, floorY + 13);
    ctx.restore();
  }

  /* ------------------------------------------------------------------------
     ACTIVE IN-GRID RECOVERY PACKET (R03)
     ------------------------------------------------------------------------ */
  renderRecoveryPacket(ctx) {
    if (!this.currentRecoveryPacket) return;

    const pkt = this.currentRecoveryPacket;
    ctx.save();
    const cx = pkt.x + this.cellSize / 2;
    const cy = pkt.y + this.cellSize / 2;
    ctx.translate(cx, cy);
    if (pkt.rotationAngle) {
      ctx.rotate(pkt.rotationAngle);
    }
    const size = this.cellSize - 2;
    const half = size / 2;

    const pulse = (Math.sin(this.pulsePhase * 3) + 1) * 0.5;

    // Glowing drop shadow (gold & amber aura)
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 12 + pulse * 6;

    // Outer packet background: rich dark crimson with amber tint
    const bgGrad = ctx.createLinearGradient(-half, -half, half, half);
    bgGrad.addColorStop(0, '#2d080c');
    bgGrad.addColorStop(1, '#1a0508');
    ctx.fillStyle = bgGrad;

    // Outer border: bright gold
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2.0;
    this.roundRect(ctx, -half, -half, size, size, 4, true, true);
    ctx.shadowBlur = 0;

    // Inner red/gold accent outline
    ctx.strokeStyle = `rgba(239, 68, 68, ${0.7 + pulse * 0.3})`;
    ctx.lineWidth = 1.2;
    this.roundRect(ctx, -half + 2, -half + 2, size - 4, size - 4, 3, false, true);

    // Subtle pulsing golden inner core
    ctx.fillStyle = `rgba(212, 175, 53, ${0.18 + pulse * 0.22})`;
    ctx.fillRect(-half + 3, -half + 3, size - 6, size - 6);

    // Visual label: R03
    ctx.font = '800 8.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(pkt.label, 0, -3.5);

    // Sub-label: RETX in glowing amber
    ctx.font = '800 6px "JetBrains Mono", monospace';
    ctx.fillStyle = '#fde047';
    ctx.fillText(pkt.subLabel || 'RETX', 0, 5);

    ctx.restore();
  }

  /* ------------------------------------------------------------------------
     SLIDING PACKETS ANIMATION (Moving Left into Buffer or Returning to Grid)
     ------------------------------------------------------------------------ */
  renderAnimatingPackets(ctx) {
    for (const ap of this.animatingPackets) {
      ctx.save();
      const x = ap.currentX;
      const y = ap.currentY;
      const t = Math.min(1.0, ap.progress);

      if (ap.type === 'RETURN_TO_GRID') {
        // 1. Subtle glowing return route line between buffer rack and main grid target
        ctx.save();
        ctx.strokeStyle = 'rgba(212, 175, 53, 0.32)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(ap.startX + 40, ap.startY + 20);
        ctx.lineTo(ap.targetX + this.cellSize / 2, ap.targetY + this.cellSize / 2);
        ctx.stroke();
        ctx.restore();

        // 2. Returning packet: lifts slightly (scale 1.06), transitions from gold to crisp white/delivered state
        const baseSize = this.cellSize - 3;
        const liftScale = 1.0 + Math.sin(t * Math.PI) * 0.08;
        const drawSize = baseSize * liftScale;
        const offset = (drawSize - baseSize) / 2;

        const isDockingPhase = t > 0.75;
        ctx.fillStyle = isDockingPhase ? '#0f1813' : '#1c180e';
        ctx.strokeStyle = isDockingPhase ? '#ffffff' : '#d4af35';
        ctx.lineWidth = 1.8;
        ctx.shadowColor = isDockingPhase ? '#ffffff' : '#d4af35';
        ctx.shadowBlur = 10;
        this.roundRect(ctx, x - offset, y - offset, drawSize, drawSize, 4, true, true);
        ctx.shadowBlur = 0;

        ctx.font = '700 8.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isDockingPhase ? '#ffffff' : '#fde047';
        ctx.fillText(`P${String(ap.seq).padStart(2, '0')}`, x - offset + drawSize / 2, y - offset + drawSize / 2);
      } else {
        // TO_BUFFER animation
        ctx.fillStyle = '#1c180e';
        ctx.strokeStyle = '#d4af35';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#d4af35';
        ctx.shadowBlur = 6;
        this.roundRect(ctx, x, y, this.cellSize - 3, this.cellSize - 3, 3, true, true);
        ctx.shadowBlur = 0;

        ctx.font = '700 8.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fde047';
        ctx.fillText(`P${String(ap.seq).padStart(2, '0')}`, x + (this.cellSize - 3) / 2, y + (this.cellSize - 3) / 2);
      }
      ctx.restore();
    }
  }

  renderTargetSlot(ctx, x, y, size, seq, isHighlight = false) {
    ctx.save();
    const pad = 1.5;
    const cx = x + pad;
    const cy = y + pad;
    const cs = size - pad * 2;

    if (isHighlight) {
      // Active release target: subtle gold highlight & alignment brackets
      ctx.fillStyle = 'rgba(212, 175, 53, 0.2)';
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = '#d4af35';
      ctx.shadowBlur = 10;
      this.roundRect(ctx, cx, cy, cs, cs, 3, true, true);
      ctx.shadowBlur = 0;

      // Small corner alignment brackets
      const bLen = 4;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      // Top-left
      ctx.beginPath(); ctx.moveTo(cx, cy + bLen); ctx.lineTo(cx, cy); ctx.lineTo(cx + bLen, cy); ctx.stroke();
      // Top-right
      ctx.beginPath(); ctx.moveTo(cx + cs - bLen, cy); ctx.lineTo(cx + cs, cy); ctx.lineTo(cx + cs, cy + bLen); ctx.stroke();
      // Bottom-left
      ctx.beginPath(); ctx.moveTo(cx, cy + cs - bLen); ctx.lineTo(cx, cy + cs); ctx.lineTo(cx + bLen, cy + cs); ctx.stroke();
      // Bottom-right
      ctx.beginPath(); ctx.moveTo(cx + cs - bLen, cy + cs); ctx.lineTo(cx + cs, cy + cs); ctx.lineTo(cx + cs, cy + cs - bLen); ctx.stroke();

      ctx.font = '700 8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fde047';
      ctx.fillText(`P${String(seq).padStart(2, '0')}`, cx + cs / 2, cy + cs / 2);
    } else {
      // Reserved slot waiting for earlier recovery
      ctx.fillStyle = 'rgba(20, 18, 12, 0.5)';
      ctx.strokeStyle = 'rgba(212, 175, 53, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      this.roundRect(ctx, cx, cy, cs, cs, 3, true, true);

      ctx.font = '600 7.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(212, 175, 53, 0.45)';
      ctx.fillText(`P${String(seq).padStart(2, '0')}`, cx + cs / 2, cy + cs / 2);
    }

    ctx.restore();
  }

  renderMiniCell(ctx, x, y, size, seq, isCorrupted, isActive = false, isDelivered = false) {
    ctx.save();
    const pad = 1.5;
    const cx = x + pad;
    const cy = y + pad;
    const cs = size - pad * 2;

    if (isCorrupted) {
      ctx.fillStyle = '#22080a';
      ctx.strokeStyle = '#ff3b47';
      ctx.lineWidth = 1.6;
      ctx.shadowColor = '#ff3b47';
      ctx.shadowBlur = isActive ? 8 : 4;
      this.roundRect(ctx, cx, cy, cs, cs, 3, true, true);
      ctx.shadowBlur = 0;

      ctx.font = '700 8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ff8080';
      ctx.fillText(`⚠${String(seq).padStart(2, '0')}`, cx + cs / 2, cy + cs / 2 + 0.5);
    } else if (isDelivered) {
      // Clean, solid neutral/white delivered state on the MAIN RECEIVER GRID
      ctx.fillStyle = '#0f1813';
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.65)';
      ctx.lineWidth = 1.4;
      this.roundRect(ctx, cx, cy, cs, cs, 3, true, true);

      // Subtle delivered indicator tick
      ctx.fillStyle = 'rgba(74, 222, 128, 0.25)';
      ctx.fillRect(cx + 2, cy + 2, cs - 4, 2);

      ctx.font = '700 8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`P${String(seq).padStart(2, '0')}`, cx + cs / 2, cy + cs / 2 + 0.5);
    } else {
      ctx.fillStyle = '#101017';
      ctx.strokeStyle = isActive ? '#d4af35' : 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = isActive ? 1.4 : 1;

      if (isActive) {
        ctx.shadowColor = '#d4af35';
        ctx.shadowBlur = 4;
      }
      this.roundRect(ctx, cx, cy, cs, cs, 3, true, true);
      ctx.shadowBlur = 0;

      ctx.font = '700 8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.75)';
      ctx.fillText(`P${String(seq).padStart(2, '0')}`, cx + cs / 2, cy + cs / 2 + 0.5);
    }

    ctx.restore();
  }

  renderRecoverySocket(ctx, x, y, size, seq) {
    ctx.save();
    const pad = 2;
    const cx = x + pad;
    const cy = y + pad;
    const cs = size - pad * 2;

    const isCurrentTarget = this.currentRecoveryPacket && this.currentRecoveryPacket.seq === seq;

    if (isCurrentTarget) {
      const pulse = (Math.sin(this.pulsePhase * 4) + 1) * 0.5;
      // Glowing target socket with gold / amber accent
      ctx.fillStyle = `rgba(212, 175, 53, ${0.12 + pulse * 0.12})`;
      ctx.strokeStyle = `rgba(253, 224, 71, ${0.7 + pulse * 0.3})`;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([3, 2]);
      this.roundRect(ctx, cx, cy, cs, cs, 3, true, true);

      // Alignment corner brackets
      const bLen = 4;
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(cx, cy + bLen); ctx.lineTo(cx, cy); ctx.lineTo(cx + bLen, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + cs - bLen, cy); ctx.lineTo(cx + cs, cy); ctx.lineTo(cx + cs, cy + bLen); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy + cs - bLen); ctx.lineTo(cx, cy + cs); ctx.lineTo(cx + bLen, cy + cs); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + cs - bLen, cy + cs); ctx.lineTo(cx + cs, cy + cs); ctx.lineTo(cx + cs, cy + cs - bLen); ctx.stroke();

      ctx.font = '700 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fde047';
      ctx.fillText(`P${String(seq).padStart(2, '0')}`, cx + cs / 2, cy + cs / 2);
    } else {
      // Glowing hatched red socket
      ctx.fillStyle = 'rgba(255, 59, 71, 0.12)';
      ctx.strokeStyle = '#ff3b47';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);
      this.roundRect(ctx, cx, cy, cs, cs, 3, true, true);

      ctx.font = '700 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ff6b6b';
      ctx.fillText(`P${String(seq).padStart(2, '0')}?`, cx + cs / 2, cy + cs / 2);
    }

    ctx.restore();
  }

  renderEffects(ctx) {
    // Upward ACK / status signals
    for (const ack of this.ackSignals) {
      ctx.save();
      ctx.font = '700 8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      if (ack.isError) {
        ctx.fillStyle = 'rgba(255, 59, 71, 0.95)';
        ctx.fillText(ack.label || `WRONG SLOT ✖`, ack.x, ack.y);
      } else {
        ctx.fillStyle = 'rgba(74, 222, 128, 0.9)';
        ctx.fillText(ack.label || `ACK P${String(ack.seq).padStart(2, '0')} ↑`, ack.x, ack.y);
      }
      ctx.restore();
    }

    // Particles
    for (const p of this.particles) {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  handleClick(clientX, clientY) {
    // No manual packet selection mechanic per Requirement 4
    return null;
  }

  roundRect(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  reset() {
    this.grid = Array.from({ length: this.mainRows }, () => Array(this.mainCols).fill(null));
    this.bufferedPacketTargets.clear();
    this.activeReleaseTarget = null;
    this.currentGroup = null;
    this.currentRecoveryPacket = null;
    this.bufferedPackets = [];
    this.animatingPackets = [];
    this.ackSignals = [];
    this.particles = [];
    this.dropAccumulator = 0;
    this.recoveryDropAccumulator = 0;
  }
}
