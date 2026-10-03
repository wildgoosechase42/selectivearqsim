/**
 * protocolEngine.js
 * 
 * Selective Repeat ARQ State Machine with Real Receiver Buffer Mechanics:
 * - Numerical & Physical Consistency: Earlier sequence numbers occupy lower receiver positions,
 *   later sequence numbers occupy higher receiver positions (bottom-up assignment).
 * - Authoritative Expected Sequence Number (expectedSeq):
 *   Packets with seq > expectedSeq that arrive when an earlier frame is missing are BUFFERED.
 * - Finite Buffer Capacity (default: 8 packets) with BUFFER OVERFLOW failure condition.
 * - Cascading Ordered Release: When missing frame arrives, buffer automatically releases
 *   subsequent contiguous packets in numerical order (P03 -> P04 -> P05) and advances expectedSeq.
 * - Supports Holes: If P06 is also missing, P07 stays buffered while P04 & P05 release.
 * - Dynamic Sliding Window tracking in HUD.
 */

export const FRAME_STATE = {
  UNSENT: 'UNSENT',
  IN_TRANSIT: 'IN_TRANSIT',
  RECEIVED: 'RECEIVED',
  BUFFERED: 'BUFFERED',
  CORRUPTED: 'CORRUPTED',
  MISSING: 'MISSING',
  RECOVERING: 'RECOVERING',
  DELIVERED: 'DELIVERED'
};

export const GROUP_STATE = {
  UNSENT: 'UNSENT',
  IN_TRANSIT: 'IN_TRANSIT',
  LOCKED: 'LOCKED',
  RECOVERY_REQUIRED: 'RECOVERY_REQUIRED',
  COMPLETE: 'COMPLETE'
};

export const DIFFICULTY_PRESETS = {
  EASY: {
    key: 'EASY',
    name: 'EASY',
    description: 'Controlled error events, slow speed. Perfect for learning receiver buffer mechanics.',
    fallSpeed: 1.0,
    bufferCapacity: 8,
    targetPackets: 30
  },
  NORMAL: {
    key: 'NORMAL',
    name: 'NORMAL',
    description: 'Moderate speed with realistic CRC errors and buffer queue pressure.',
    fallSpeed: 1.3,
    bufferCapacity: 8,
    targetPackets: 30
  },
  HARD: {
    key: 'HARD',
    name: 'HARD',
    description: 'Fast blocks, tighter buffer capacity (6 packets), and multiple missing frames.',
    fallSpeed: 1.6,
    bufferCapacity: 6,
    targetPackets: 30
  },
  CHAOS: {
    key: 'CHAOS',
    name: 'CHAOS',
    description: 'Intense buffer queue management with rapid arrivals and multiple holes.',
    fallSpeed: 1.9,
    bufferCapacity: 6,
    targetPackets: 30
  }
};

/**
 * Curated Transmission Group Templates
 * Geometry is assigned bottom-up so lower rows have earlier sequence numbers!
 */
export const GROUP_TEMPLATES = {
  COLUMN_6: {
    type: 'COLUMN_6',
    rows: 6,
    cols: 1,
    cellCount: 6,
    matrix: [
      [1], // top (P06)
      [1], // (P05)
      [1], // (P04)
      [1], // (P03)
      [1], // (P02)
      [1]  // bottom (P01)
    ]
  },
  COLUMN_5: {
    type: 'COLUMN_5',
    rows: 5,
    cols: 1,
    cellCount: 5,
    matrix: [
      [1],
      [1],
      [1],
      [1],
      [1]
    ]
  },
  SQUARE_3X3: {
    type: 'SQUARE_3X3',
    rows: 3,
    cols: 3,
    cellCount: 9,
    matrix: [
      [1, 1, 1], // top (P13 P14 P15)
      [1, 1, 1], // mid (P10 P11 P12)
      [1, 1, 1]  // btm (P07 P08 P09)
    ]
  },
  RECT_2X4: {
    type: 'RECT_2X4',
    rows: 2,
    cols: 4,
    cellCount: 8,
    matrix: [
      [1, 1, 1, 1], // top (P20 P21 P22 P23)
      [1, 1, 1, 1]  // btm (P16 P17 P18 P19)
    ]
  },
  L_SHAPE_7: {
    type: 'L_SHAPE_7',
    rows: 3,
    cols: 3,
    cellCount: 7,
    matrix: [
      [1, 1, 0], // top (P29 P30)
      [1, 1, 0], // mid (P27 P28)
      [1, 1, 1]  // btm (P24 P25 P26)
    ]
  },
  RECT_3X3: {
    type: 'RECT_3X3',
    rows: 3,
    cols: 3,
    cellCount: 9,
    matrix: [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1]
    ]
  },
  RECT_4X2: {
    type: 'RECT_4X2',
    rows: 4,
    cols: 2,
    cellCount: 8,
    matrix: [
      [1, 1],
      [1, 1],
      [1, 1],
      [1, 1]
    ]
  }
};

export class ProtocolEngine {
  constructor(difficultyKey = 'EASY', customOptions = {}) {
    this.callbacks = {
      onStateChange: () => {},
      onAck: () => {},
      onPacketDelivered: () => {},
      onWindowSlide: () => {},
      onGroupComplete: () => {},
      onCorrupted: () => {},
      onLost: () => {},
      onPacketsBuffered: () => {},
      onPacketsReleased: () => {},
      onSinglePacketReleased: () => {},
      onBufferOverflow: () => {},
      onRecoveryMissed: () => {},
      onComplete: () => {}
    };

    this.init(difficultyKey, customOptions);
  }

  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  init(difficultyKey = 'EASY', customOptions = {}) {
    const preset = DIFFICULTY_PRESETS[difficultyKey] || DIFFICULTY_PRESETS.EASY;
    this.config = {
      ...preset,
      ...customOptions
    };

    this.totalTargetPackets = this.config.targetPackets || 30;
    this.totalTarget = this.totalTargetPackets;
    this.bufferCapacity = this.config.bufferCapacity || 8;

    // Clear any pending release timers
    this.clearReleaseTimer();

    // Expected Sequence Number: the lowest unacknowledged sequence number
    this.expectedSeq = 1;

    // Receiver Buffer: array of persistent packet objects: { sequenceNumber, seq, status, bufferPosition }
    this.bufferedPackets = [];
    this.isReleasingBuffer = false;

    // Sliding window boundaries (packet sequence numbers: [expectedSeq .. expectedSeq + windowSize - 1])
    this.windowSize = this.config.windowSize || 6;
    this.windowStart = 1;
    this.windowEnd = 1 + this.windowSize - 1;

    // Group & Packet Registries
    this.groups = new Map();
    this.packets = new Map();
    this.groupOrder = [];
    this.currentGroupIndex = 0;

    // Build the curated transmission group stream with bottom-up numbering
    this.buildTransmissionGroupStream();

    // Statistics & Laboratory Telemetry
    this.stats = {
      totalTransmissions: 0,
      delivered: 0,
      lost: 0,
      corrupted: 0,
      corruptedRemoved: 0,
      retransmissions: 0,
      wrongRecoveries: 0,
      successfulRecoveries: 0,
      unnecessaryRetries: 0,
      bufferedCount: 0,
      maxBufferUsage: 0,
      bufferOverflows: 0,
      completedGroups: 0,
      startTime: null,
      endTime: null
    };

    this.isComplete = false;
    this.isOverflowed = false;
    this.activeMissingSeq = null; // currently missing sequence number blocking delivery
  }

  clearReleaseTimer() {
    if (this.releaseTimer) {
      clearTimeout(this.releaseTimer);
      this.releaseTimer = null;
    }
    this.isReleasingBuffer = false;
  }

  /**
   * Pre-constructs the sequence of transmission groups up to totalTargetPackets (30 packets).
   * NUMERICAL CONSISTENCY: Earlier sequence numbers occupy lower rows, later sequence numbers occupy upper rows.
   */
  buildTransmissionGroupStream() {
    let currentSeq = 1;
    let groupId = 1;

    // Progression reaching exactly 30 packets:
    // Group 1: COLUMN_6 (P01..P06, P06 top, P01 bottom; P03 corrupted, P04..P06 buffer left)
    // Group 2: SQUARE_3X3 (P07..P15, 9 packets)
    // Group 3: RECT_2X4 (P16..P23, 8 packets)
    // Group 4: L_SHAPE_7 (P24..P30, 7 packets)
    const templates = [
      GROUP_TEMPLATES.COLUMN_6, // 6 packets: P01–P06
      GROUP_TEMPLATES.SQUARE_3X3, // 9 packets: P07–P15
      GROUP_TEMPLATES.RECT_2X4,   // 8 packets: P16–P23
      GROUP_TEMPLATES.L_SHAPE_7   // 7 packets: P24–P30
    ];

    for (let t = 0; t < templates.length && currentSeq <= this.totalTargetPackets; t++) {
      const template = templates[t];
      const cellMatrix = Array.from({ length: template.rows }, () => Array(template.cols).fill(null));
      const groupPackets = [];

      // Assign sequence numbers BOTTOM-UP so earlier packets are in lower rows!
      for (let r = template.rows - 1; r >= 0; r--) {
        for (let c = 0; c < template.cols; c++) {
          if (template.matrix[r][c] === 1) {
            const seq = currentSeq++;
            const packet = {
              seq,
              groupId,
              localR: r,
              localC: c,
              status: FRAME_STATE.UNSENT,
              isCorrupted: false,
              isLost: false,
              retransmissionCount: 0
            };

            this.packets.set(seq, packet);
            groupPackets.push(seq);
            cellMatrix[r][c] = {
              seq,
              isCorrupted: false,
              isLost: false,
              status: FRAME_STATE.UNSENT
            };
          }
        }
      }

      // Sort groupPackets ascending
      groupPackets.sort((a, b) => a - b);

      const group = {
        id: groupId,
        name: `GROUP ${String(groupId).padStart(2, '0')}`,
        templateType: template.type,
        rows: template.rows,
        cols: template.cols,
        cellCount: groupPackets.length,
        packets: groupPackets,
        matrix: cellMatrix,
        status: GROUP_STATE.UNSENT,
        startSeq: groupPackets[0],
        endSeq: groupPackets[groupPackets.length - 1],
        hasErrors: false
      };

      this.groups.set(groupId, group);
      this.groupOrder.push(groupId);
      groupId++;
    }

    this.windowStart = 1;
    this.windowEnd = Math.min(this.totalTargetPackets, 1 + this.windowSize - 1);
  }

  updateWindowBounds() {
    this.windowStart = this.expectedSeq;
    this.windowEnd = Math.min(this.totalTargetPackets, this.expectedSeq + this.windowSize - 1);
    this.callbacks.onWindowSlide(this.windowStart, this.windowEnd);
  }

  /**
   * Emits the next transmission group
   */
  getNextGroupToTransmit() {
    if (this.isComplete || this.isOverflowed) return null;

    if (!this.stats.startTime) {
      this.stats.startTime = performance.now();
    }

    if (this.currentGroupIndex >= this.groupOrder.length) return null;

    const groupId = this.groupOrder[this.currentGroupIndex];
    const group = this.groups.get(groupId);
    if (!group || group.status !== GROUP_STATE.UNSENT) return null;

    group.status = GROUP_STATE.IN_TRANSIT;
    this.currentGroupIndex++;

    group.packets.forEach(seq => {
      const p = this.packets.get(seq);
      if (p) {
        p.status = FRAME_STATE.IN_TRANSIT;
        this.stats.totalTransmissions++;
      }
    });

    // Configure errors: Group 01 deterministic P03 corruption!
    this.configureGroupErrors(group);

    return group;
  }

  configureGroupErrors(group) {
    if (group.id === 1) {
      // EXACT ACCEPTANCE TEST: Group 01 (P01..P05 vertical), P03 is corrupted!
      const p3 = this.packets.get(3);
      if (p3) {
        p3.isCorrupted = true;
      }
    } else if (group.id === 2) {
      // Group 02: P10 experiences packet loss
      const p10 = this.packets.get(10);
      if (p10) {
        p10.isLost = true;
      }
    } else {
      // Groups 03 and 04 deliver cleanly to conclude 30-packet simulation
    }

    // Sync to matrix
    for (let r = 0; r < group.rows; r++) {
      for (let c = 0; c < group.cols; c++) {
        const cell = group.matrix[r][c];
        if (cell) {
          const p = this.packets.get(cell.seq);
          if (p) {
            cell.isCorrupted = p.isCorrupted;
            cell.isLost = p.isLost;
          }
        }
      }
    }
  }

  /**
   * Called when a group locks into the receiver grid
   * Evaluates packet delivery vs out-of-order buffering
   */
  handleGroupLanded(groupId) {
    const group = this.groups.get(groupId);
    if (!group) return;

    group.status = GROUP_STATE.LOCKED;
    const packetsToBuffer = [];
    let hasCorrupted = false;

    // Check each packet in numerical order
    for (const seq of group.packets) {
      const p = this.packets.get(seq);
      if (!p) continue;

      if (p.isCorrupted) {
        p.status = FRAME_STATE.CORRUPTED;
        this.stats.corrupted++;
        hasCorrupted = true;
        this.activeMissingSeq = seq;
        this.callbacks.onCorrupted(seq, groupId);
      } else if (p.isLost) {
        p.status = FRAME_STATE.MISSING;
        this.stats.lost++;
        this.activeMissingSeq = seq;
        this.callbacks.onLost(seq, groupId);
      } else {
        // Valid packet arrived!
        const maxWindowSeq = Math.max(this.expectedSeq + this.windowSize - 1, group ? group.endSeq : this.expectedSeq + 8);

        if (seq >= this.expectedSeq && seq <= maxWindowSeq) {
          if (seq === this.expectedSeq && !this.activeMissingSeq) {
            // Delivered in order!
            p.status = FRAME_STATE.DELIVERED;
            this.stats.delivered++;
            this.expectedSeq++;
            this.updateWindowBounds();
            this.callbacks.onAck(seq);
            this.callbacks.onPacketDelivered(seq, this.stats.delivered, this.totalTargetPackets);
            if (this.stats.delivered >= this.totalTargetPackets) {
              this.completeSimulation();
              return;
            }
          } else {
            // OUT-OF-ORDER PACKET within active window!
            // Must be moved to the RECEIVER BUFFER!
            p.status = FRAME_STATE.BUFFERED;
            packetsToBuffer.push(seq);
          }
        } else if (seq < this.expectedSeq) {
          // Duplicate / already delivered
          p.status = FRAME_STATE.DELIVERED;
          this.callbacks.onAck(seq);
        } else {
          // Outside active window! The receiver should never buffer packets outside the active window.
        }
      }
    }

    // Buffer out-of-order packets
    if (packetsToBuffer.length > 0) {
      this.bufferPackets(packetsToBuffer);
      if (this.isOverflowed) return;
    }

    if (hasCorrupted || this.activeMissingSeq) {
      group.status = GROUP_STATE.RECOVERY_REQUIRED;
      group.hasErrors = true;
    } else {
      // Check if entire group is satisfied
      this.checkGroupCompletion(group);
    }

    this.callbacks.onStateChange();
  }

  /**
   * Moves out-of-order packets into the receiver buffer as persistent packet objects
   */
  bufferPackets(seqList) {
    let overflowOccurred = false;
    for (const seq of seqList) {
      if (!this.bufferedPackets.some(p => (p.seq !== undefined ? p.seq : p) === seq)) {
        if (this.bufferedPackets.length >= this.bufferCapacity) {
          overflowOccurred = true;
          break;
        }

        this.bufferedPackets.push({
          sequenceNumber: seq,
          seq: seq,
          status: FRAME_STATE.BUFFERED,
          bufferPosition: this.bufferedPackets.length
        });
        this.stats.bufferedCount++;
      }
    }

    // Maintain strict numerical order in the buffer rack
    this.bufferedPackets.sort((a, b) => (a.seq !== undefined ? a.seq : a) - (b.seq !== undefined ? b.seq : b));
    this.bufferedPackets.forEach((p, idx) => { p.bufferPosition = idx; });
    this.stats.maxBufferUsage = Math.max(this.stats.maxBufferUsage, this.bufferedPackets.length);

    // Check finite capacity (lose condition: BUFFER OVERFLOW)
    if (overflowOccurred || this.bufferedPackets.length > this.bufferCapacity) {
      this.isOverflowed = true;
      this.isComplete = true;
      this.stats.bufferOverflows++;
      this.stats.endTime = performance.now();
      this.callbacks.onBufferOverflow(this.bufferedPackets.length, this.bufferCapacity);
      return;
    }

    this.callbacks.onPacketsBuffered([...seqList], [...this.bufferedPackets]);
  }

  /**
   * Helper to retrieve all currently unresolved (corrupted, missing, recovering) packets
   */
  getMissingPackets() {
    const list = [];
    for (const [seq, packet] of this.packets.entries()) {
      if (packet.status === FRAME_STATE.CORRUPTED || packet.status === FRAME_STATE.MISSING || packet.status === FRAME_STATE.RECOVERING) {
        list.push({
          seq,
          status: packet.status,
          inFlight: packet.status === FRAME_STATE.RECOVERING,
          groupId: packet.groupId
        });
      }
    }
    list.sort((a, b) => a.seq - b.seq);
    return list;
  }

  /**
   * Removes a corrupted packet, clearing the cell for recovery socket
   */
  removeCorruptedPacket(seq) {
    const packet = this.packets.get(seq);
    if (!packet || packet.status !== FRAME_STATE.CORRUPTED) return false;

    packet.status = FRAME_STATE.MISSING;
    packet.isCorrupted = false;
    this.activeMissingSeq = seq;
    this.stats.corruptedRemoved++;

    // When the corrupted packet is removed, any later valid packets physically above it
    // that haven't been buffered yet must now buffer left!
    const group = this.groups.get(packet.groupId);
    if (group) {
      const laterSeqs = group.packets.filter(s => s > seq && this.packets.get(s)?.status === FRAME_STATE.RECEIVED);
      if (laterSeqs.length > 0) {
        laterSeqs.forEach(s => {
          const p = this.packets.get(s);
          if (p) p.status = FRAME_STATE.BUFFERED;
        });
        this.bufferPackets(laterSeqs);
      }
    }

    this.callbacks.onStateChange();
    return true;
  }

  /**
   * Emits small recovery packet R{seq}
   * CRITICAL: Retransmission modifies ONLY the missing packet.
   * Buffered packets remain persistent in the buffer!
   */
  retransmitPacket(seq) {
    const packet = this.packets.get(seq);
    if (!packet) return null;

    if (packet.status === FRAME_STATE.DELIVERED) {
      this.stats.unnecessaryRetries++;
      this.callbacks.onStateChange();
      return null;
    }

    packet.retransmissionCount++;
    packet.status = FRAME_STATE.RECOVERING;
    this.stats.retransmissions++;
    this.stats.totalTransmissions++;

    return {
      seq,
      groupId: packet.groupId,
      label: `R${String(seq).padStart(2, '0')}`,
      attempt: packet.retransmissionCount
    };
  }

  /**
   * Called when small recovery packet R{seq} docks into the missing socket.
   * Restores P{seq} and triggers SEQUENTIAL STAGGERED BUFFER RELEASE!
   */
  handleRecoveryPacketSnapped(seq) {
    const packet = this.packets.get(seq);
    if (!packet) return false;

    packet.status = FRAME_STATE.DELIVERED;
    packet.isCorrupted = false;
    packet.isLost = false;
    this.stats.delivered++;
    this.stats.successfulRecoveries = (this.stats.successfulRecoveries || 0) + 1;
    this.activeMissingSeq = null;

    this.callbacks.onAck(seq);
    this.callbacks.onPacketDelivered(seq, this.stats.delivered, this.totalTargetPackets);

    // If this recovered packet satisfies the expectedSeq, trigger sequential release!
    if (seq === this.expectedSeq) {
      this.expectedSeq++;
      this.updateWindowBounds();
      if (this.stats.delivered >= this.totalTargetPackets) {
        this.completeSimulation();
        return true;
      }
      this.startSequentialBufferRelease();
    } else {
      if (this.stats.delivered >= this.totalTargetPackets) {
        this.completeSimulation();
        return true;
      }
      const group = this.groups.get(packet.groupId);
      if (group) {
        this.checkGroupCompletion(group);
      }
      this.callbacks.onStateChange();
    }

    return true;
  }

  handleRecoveryPacketDocked(seq) {
    return this.handleRecoveryPacketSnapped(seq);
  }

  /**
   * Called when small recovery packet R{seq} misses the target slot
   */
  handleRecoveryPacketMissed(seq) {
    this.stats.wrongRecoveries = (this.stats.wrongRecoveries || 0) + 1;
    const packet = this.packets.get(seq);
    if (packet) {
      packet.status = FRAME_STATE.MISSING;
    }
    this.activeMissingSeq = seq;
    this.callbacks.onRecoveryMissed?.(seq, this.stats.wrongRecoveries);
    this.callbacks.onStateChange();
  }

  /**
   * SEQUENTIAL ORDERED BUFFER RELEASE:
   * Releases contiguous buffered packets in numerical order starting from expectedSeq.
   * Releases one packet at a time with visual delay (450ms) so the user sees each packet leave the rack!
   * Stops when a sequence number is missing (hole scenario).
   */
  startSequentialBufferRelease() {
    if (this.isReleasingBuffer) return;
    this.isReleasingBuffer = true;

    const releaseStep = () => {
      if (this.bufferedPackets.length === 0) {
        this.isReleasingBuffer = false;
        this.updateWindowBounds();
        this.checkAllGroupCompletions();
        this.callbacks.onStateChange();
        return;
      }

      const nextObj = this.bufferedPackets[0];
      const nextSeq = nextObj.seq !== undefined ? nextObj.seq : nextObj.sequenceNumber;

      if (nextSeq === this.expectedSeq) {
        // Remove only this single packet from the buffer!
        this.bufferedPackets.shift();
        this.bufferedPackets.forEach((p, idx) => { p.bufferPosition = idx; });

        const p = this.packets.get(nextSeq);
        if (p) {
          p.status = FRAME_STATE.DELIVERED;
          this.stats.delivered++;
        }

        this.expectedSeq++;
        this.updateWindowBounds();
        this.callbacks.onAck(nextSeq);
        this.callbacks.onPacketDelivered(nextSeq, this.stats.delivered, this.totalTargetPackets);
        this.callbacks.onSinglePacketReleased(nextSeq, [...this.bufferedPackets]);
        this.callbacks.onStateChange();

        // Check if 30 / 30 win condition reached!
        if (this.stats.delivered >= this.totalTargetPackets) {
          this.isReleasingBuffer = false;
          this.completeSimulation();
          return;
        }

        if (this.bufferedPackets.length === 0) {
          this.isReleasingBuffer = false;
          this.updateWindowBounds();
          this.checkAllGroupCompletions();
          this.callbacks.onStateChange();
          return;
        }

        // Stagger next release by 450ms so user clearly sees return animation, snap, and delivery
        this.releaseTimer = setTimeout(releaseStep, 450);
      } else {
        // A hole exists! Stop releasing.
        this.activeMissingSeq = this.expectedSeq;
        this.isReleasingBuffer = false;
        this.updateWindowBounds();
        this.checkAllGroupCompletions();
        this.callbacks.onStateChange();
      }
    };

    // Begin release 350ms after docking
    this.releaseTimer = setTimeout(releaseStep, 350);
  }

  checkAllGroupCompletions() {
    this.groups.forEach(group => {
      if (group.status !== GROUP_STATE.COMPLETE && group.status !== GROUP_STATE.UNSENT) {
        this.checkGroupCompletion(group);
      }
    });
  }

  /**
   * Checks if all packets in group are delivered
   */
  checkGroupCompletion(group) {
    if (!group) return;
    const allDelivered = group.packets.every(s => {
      const p = this.packets.get(s);
      return p && p.status === FRAME_STATE.DELIVERED;
    });

    if (allDelivered) {
      group.status = GROUP_STATE.COMPLETE;
      group.hasErrors = false;
      this.stats.completedGroups++;
      this.callbacks.onGroupComplete(group.id);
      this.advanceSlidingWindow();
    }
  }

  advanceSlidingWindow() {
    if (this.stats.delivered >= this.totalTargetPackets || this.currentGroupIndex >= this.groupOrder.length) {
      this.completeSimulation();
      return;
    }

    const nextGroupId = this.groupOrder[this.currentGroupIndex];
    const nextGroup = this.groups.get(nextGroupId);

    if (nextGroup) {
      this.windowStart = nextGroup.startSeq;
      this.windowEnd = nextGroup.endSeq;
      this.callbacks.onWindowSlide(this.windowStart, this.windowEnd);
    }
  }

  completeSimulation() {
    if (this.isComplete) return;
    this.isComplete = true;
    this.stats.endTime = performance.now();
    this.callbacks.onComplete(this.calculateScore());
  }

  calculateScore() {
    const elapsedMs = (this.stats.endTime || performance.now()) - (this.stats.startTime || performance.now());
    const elapsedSec = Math.max(1, Math.round(elapsedMs / 1000));

    const totalTarget = this.totalTargetPackets; // 30
    const delivered = this.stats.delivered;

    // Delivery ratio points: up to 70 pts
    const deliveryRatio = Math.min(70, Math.round((delivered / totalTarget) * 70));

    // Penalize unnecessary retransmissions, buffer overflows, and wrong recovery drops
    const unnecessary = this.stats.unnecessaryRetries || 0;
    const overflows = this.stats.bufferOverflows || 0;
    const wrongRec = this.stats.wrongRecoveries || 0;
    const successRec = this.stats.successfulRecoveries || 0;

    // Successful manual recovery bonus
    const recoveryBonus = Math.min(10, successRec * 4);

    // Efficiency: useful packets delivered relative to total transmission attempts
    const totalTrans = Math.max(delivered, this.stats.totalTransmissions);
    const efficiency = totalTrans > 0
      ? Math.max(10, Math.min(100, Math.round((delivered / totalTrans) * 100)))
      : 100;

    // Efficiency bonus up to 25 pts
    const efficiencyPts = Math.round((efficiency / 100) * 25);

    // Speed bonus up to 5 pts for finishing in reasonable time
    const speedBonus = delivered >= totalTarget ? Math.max(0, Math.min(5, Math.floor((150 - elapsedSec) / 20))) : 0;

    // Deterministic Penalties
    const penalties = (overflows * 25) + (unnecessary * 8) + (wrongRec * 10);

    const isWin = delivered >= totalTarget && !this.isOverflowed;
    let score = Math.max(10, Math.min(100, deliveryRatio + efficiencyPts + speedBonus + recoveryBonus - penalties));

    if (isWin) {
      if (unnecessary === 0 && overflows === 0 && wrongRec === 0) {
        score = Math.max(90, Math.min(100, score));
      }
    } else {
      score = Math.min(65, score);
    }

    const min = Math.floor(elapsedSec / 60);
    const sec = elapsedSec % 60;
    const timeFormatted = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

    return {
      score,
      isSuccess: isWin,
      delivered,
      totalTarget,
      corrupted: this.stats.corrupted,
      lost: this.stats.lost,
      retransmissions: this.stats.retransmissions,
      wrongRecoveries: this.stats.wrongRecoveries || 0,
      successfulRecoveries: this.stats.successfulRecoveries || 0,
      buffered: this.stats.bufferedCount,
      bufferCapacity: this.bufferCapacity,
      maxBufferUsage: this.stats.maxBufferUsage,
      bufferOverflows: overflows,
      unnecessaryRetries: unnecessary,
      efficiency,
      timeFormatted,
      elapsedSeconds: elapsedSec
    };
  }

  getTelemetrySnapshot() {
    const elapsedMs = this.stats.startTime ? performance.now() - this.stats.startTime : 0;
    const elapsedSec = Math.floor(elapsedMs / 1000);
    const min = Math.floor(elapsedSec / 60);
    const sec = elapsedSec % 60;
    const timeFormatted = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

    const efficiency = this.stats.totalTransmissions > 0
      ? Math.min(100, Math.round((Math.max(1, this.stats.delivered) / this.stats.totalTransmissions) * 100))
      : 100;

    const currentGroup = this.groups.get(this.groupOrder[Math.max(0, this.currentGroupIndex - 1)]) || this.groups.get(1);

    return {
      groupId: currentGroup ? currentGroup.name : 'GROUP 01',
      groupIndex: this.currentGroupIndex,
      totalGroups: this.groupOrder.length,
      delivered: this.stats.delivered,
      target: this.totalTargetPackets,
      expectedSeq: this.expectedSeq,
      windowStart: this.windowStart,
      windowEnd: this.windowEnd,
      bufferCount: this.bufferedPackets.length,
      bufferCapacity: this.bufferCapacity,
      bufferedPackets: [...this.bufferedPackets],
      lost: this.stats.lost,
      corrupted: this.stats.corrupted,
      retransmissions: this.stats.retransmissions,
      wrongRecoveries: this.stats.wrongRecoveries || 0,
      successfulRecoveries: this.stats.successfulRecoveries || 0,
      unnecessaryRetries: this.stats.unnecessaryRetries,
      bufferOverflows: this.stats.bufferOverflows,
      efficiency,
      timeFormatted,
      activeMissingSeq: this.activeMissingSeq
    };
  }
}
