/**
 * theorySimulation.js
 * 
 * Interactive frame transmission simulation for Section 02 (Aim + Theory).
 * Demonstrates the 5-frame Selective Repeat ARQ protocol working:
 * Frames 1, 2, 3 (lost), 4 (buffered), 5 (buffered) -> Retransmit Frame 3 -> Sequence Reassembly.
 */

export class TheorySimulation {
  constructor() {
    this.container = document.getElementById('theorySimContainer');
    this.stepTextEl = document.getElementById('theorySimStepText');
    this.playBtn = document.getElementById('theorySimPlayBtn');
    this.stepBtn = document.getElementById('theorySimStepBtn');
    this.resetBtn = document.getElementById('theorySimResetBtn');
    this.framesContainer = document.getElementById('theorySimFrames');
    this.receiverBufferEl = document.getElementById('theoryReceiverBuffer');

    this.currentStep = 0;
    this.isPlaying = false;
    this.timer = null;

    this.steps = [
      {
        id: 0,
        title: "Ready for Transmission",
        description: "Sender prepares frames 1 through 5 in its sliding window buffer.",
        frames: [
          { num: 1, status: 'ready', pos: 'sender' },
          { num: 2, status: 'ready', pos: 'sender' },
          { num: 3, status: 'ready', pos: 'sender' },
          { num: 4, status: 'ready', pos: 'sender' },
          { num: 5, status: 'ready', pos: 'sender' }
        ],
        receiverBuffer: []
      },
      {
        id: 1,
        title: "Frames 1 & 2 Received",
        description: "Frames 1 and 2 traverse the channel and are acknowledged correctly by the receiver.",
        frames: [
          { num: 1, status: 'received', pos: 'receiver' },
          { num: 2, status: 'received', pos: 'receiver' },
          { num: 3, status: 'transit', pos: 'channel' },
          { num: 4, status: 'ready', pos: 'sender' },
          { num: 5, status: 'ready', pos: 'sender' }
        ],
        receiverBuffer: [1, 2]
      },
      {
        id: 2,
        title: "Frame 3 Lost / Corrupted",
        description: "Frame 3 encounters noise or channel failure and is lost. Frames 1 & 2 are delivered to upper layer.",
        frames: [
          { num: 1, status: 'delivered', pos: 'receiver' },
          { num: 2, status: 'delivered', pos: 'receiver' },
          { num: 3, status: 'lost', pos: 'channel' },
          { num: 4, status: 'transit', pos: 'channel' },
          { num: 5, status: 'transit', pos: 'channel' }
        ],
        receiverBuffer: []
      },
      {
        id: 3,
        title: "Frames 4 & 5 Buffered at Receiver",
        description: "Instead of discarding out-of-order frames 4 and 5, the receiver stores them temporarily in memory.",
        frames: [
          { num: 1, status: 'delivered', pos: 'receiver' },
          { num: 2, status: 'delivered', pos: 'receiver' },
          { num: 3, status: 'lost', pos: 'channel' },
          { num: 4, status: 'buffered', pos: 'receiver' },
          { num: 5, status: 'buffered', pos: 'receiver' }
        ],
        receiverBuffer: [4, 5]
      },
      {
        id: 4,
        title: "Selective Retransmission: Only Frame 3",
        description: "Sender timer expires or NAK received. Only Frame 3 is retransmitted, conserving network bandwidth.",
        frames: [
          { num: 1, status: 'delivered', pos: 'receiver' },
          { num: 2, status: 'delivered', pos: 'receiver' },
          { num: 3, status: 'retransmitting', pos: 'channel' },
          { num: 4, status: 'buffered', pos: 'receiver' },
          { num: 5, status: 'buffered', pos: 'receiver' }
        ],
        receiverBuffer: [4, 5]
      },
      {
        id: 5,
        title: "Reordering & Delivery to Upper Layer",
        description: "Frame 3 arrives safely. Receiver arranges frames [1, 2, 3, 4, 5] in exact order and delivers to upper layer.",
        frames: [
          { num: 1, status: 'delivered', pos: 'receiver' },
          { num: 2, status: 'delivered', pos: 'receiver' },
          { num: 3, status: 'delivered', pos: 'receiver' },
          { num: 4, status: 'delivered', pos: 'receiver' },
          { num: 5, status: 'delivered', pos: 'receiver' }
        ],
        receiverBuffer: [1, 2, 3, 4, 5]
      }
    ];
  }

  init() {
    if (!this.container) return;

    this.renderStep(0);

    if (this.playBtn) {
      this.playBtn.addEventListener('click', () => this.togglePlay());
    }
    if (this.stepBtn) {
      this.stepBtn.addEventListener('click', () => this.stepForward());
    }
    if (this.resetBtn) {
      this.resetBtn.addEventListener('click', () => this.reset());
    }

    // Auto-start when scrolled into view
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && this.currentStep === 0 && !this.isPlaying) {
          this.play();
        }
      });
    }, { threshold: 0.3 });

    observer.observe(this.container);
  }

  renderStep(index) {
    this.currentStep = index;
    const step = this.steps[index];

    if (this.stepTextEl) {
      this.stepTextEl.innerHTML = `
        <span class="step-badge">STEP 0${index + 1} / 06</span>
        <strong class="step-title">${step.title}</strong>
        <p class="step-desc">${step.description}</p>
      `;
    }

    if (this.framesContainer) {
      this.framesContainer.innerHTML = '';
      step.frames.forEach((f) => {
        const frameEl = document.createElement('div');
        frameEl.className = `sim-frame-node pos-${f.pos} status-${f.status}`;
        frameEl.innerHTML = `
          <span class="frame-label">F${f.num}</span>
          <span class="frame-indicator">${this.getStatusIcon(f.status)}</span>
        `;
        this.framesContainer.appendChild(frameEl);
      });
    }

    if (this.receiverBufferEl) {
      if (step.receiverBuffer.length === 0) {
        this.receiverBufferEl.innerHTML = '<span class="buffer-empty">Buffer empty</span>';
      } else {
        this.receiverBufferEl.innerHTML = step.receiverBuffer
          .map((n) => `<span class="buffer-tag ${n === 3 ? 'retransmitted' : n > 3 && index < 5 ? 'buffered' : 'delivered'}">Frame ${n}</span>`)
          .join('');
      }
    }

    // Update play button text if reached end
    if (index === this.steps.length - 1) {
      this.pause();
      if (this.playBtn) this.playBtn.innerHTML = '<span>Replay</span>';
    } else {
      if (this.playBtn && !this.isPlaying) this.playBtn.innerHTML = '<span>Play Simulation</span>';
    }
  }

  getStatusIcon(status) {
    switch (status) {
      case 'ready': return '•';
      case 'transit': return '→';
      case 'lost': return '✗';
      case 'buffered': return '⊞';
      case 'retransmitting': return '⟳';
      case 'received':
      case 'delivered': return '✓';
      default: return '•';
    }
  }

  stepForward() {
    this.pause();
    const nextStep = (this.currentStep + 1) % this.steps.length;
    this.renderStep(nextStep);
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      if (this.currentStep === this.steps.length - 1) {
        this.renderStep(0);
      }
      this.play();
    }
  }

  play() {
    this.isPlaying = true;
    if (this.playBtn) this.playBtn.innerHTML = '<span>Pause</span>';
    
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.currentStep < this.steps.length - 1) {
        this.renderStep(this.currentStep + 1);
      } else {
        this.pause();
      }
    }, 2400);
  }

  pause() {
    this.isPlaying = false;
    clearInterval(this.timer);
    if (this.playBtn) this.playBtn.innerHTML = '<span>Play Simulation</span>';
  }

  reset() {
    this.pause();
    this.renderStep(0);
  }
}
