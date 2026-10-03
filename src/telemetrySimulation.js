/**
 * telemetrySimulation.js
 * 
 * Interactive system architecture & packet telemetry simulation for Section 05 (AI Use Case).
 * Visualizes the AI Urine Test Strip Reader point-of-care pipeline:
 * URINE TEST STRIP -> RASPBERRY PI (EDGE) -> 12 STRUCTURED PACKETS -> HOSPITAL DATABASE / CLOUD
 * Demonstrates Selective ARQ recovering a corrupted analyte packet with zero retransmission overhead.
 */

export class TelemetrySimulation {
  constructor() {
    this.container = document.getElementById('telemetrySimContainer');
    this.streamTriggerBtn = document.getElementById('telemetryStreamBtn');
    this.packetsGrid = document.getElementById('telemetryPacketsGrid');
    this.statusBadge = document.getElementById('telemetryStatusBadge');
    this.bandwidthMeter = document.getElementById('telemetryBandwidthMeter');

    this.isRunning = false;
    this.timer = null;

    // 12 structured medical telemetry packets (abstract compliant labels)
    this.packetFields = [
      { id: 1, label: 'PATIENT ID', type: 'Header', val: 'PT-9428-A' },
      { id: 2, label: 'TIMESTAMP', type: 'Header', val: '2026-10-02T21:14Z' },
      { id: 3, label: 'ANALYTE 01', type: 'Concentration', val: 'LEU: 25 Leu/µL' },
      { id: 4, label: 'ANALYTE 02', type: 'Concentration', val: 'NIT: NEGATIVE' },
      { id: 5, label: 'ANALYTE 03', type: 'Concentration', val: 'URO: 0.2 mg/dL', willFail: true },
      { id: 6, label: 'ANALYTE 04', type: 'Concentration', val: 'PRO: 15 mg/dL' },
      { id: 7, label: 'ANALYTE 05', type: 'Concentration', val: 'pH: 6.5' },
      { id: 8, label: 'ANALYTE 06', type: 'Concentration', val: 'BLD: NEGATIVE' },
      { id: 9, label: 'ANALYTE 07', type: 'Concentration', val: 'S.G.: 1.015' },
      { id: 10, label: 'ANALYTE 08', type: 'Concentration', val: 'KET: NEGATIVE' },
      { id: 11, label: 'ANALYTE 09', type: 'Concentration', val: 'BIL: NEGATIVE' },
      { id: 12, label: 'ANALYTE 10', type: 'Concentration', val: 'GLU: NORMAL' }
    ];
  }

  init() {
    if (!this.container) return;
    this.renderInitialState();

    if (this.streamTriggerBtn) {
      this.streamTriggerBtn.addEventListener('click', () => {
        if (!this.isRunning) {
          this.runSimulation();
        }
      });
    }

    // Auto-trigger on viewport entry
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !this.isRunning) {
          this.runSimulation();
        }
      });
    }, { threshold: 0.25 });

    observer.observe(this.container);
  }

  renderInitialState() {
    if (this.statusBadge) {
      this.statusBadge.innerHTML = '<span class="status-indicator ready"></span> EDGE LINK IDLE';
    }
    if (this.bandwidthMeter) {
      this.bandwidthMeter.textContent = '100% Efficiency';
    }

    if (this.packetsGrid) {
      this.packetsGrid.innerHTML = this.packetFields.map((p) => `
        <div class="telemetry-packet-card" id="pkt_${p.id}">
          <div class="pkt-top">
            <span class="pkt-num">#${p.id < 10 ? '0' + p.id : p.id}</span>
            <span class="pkt-status-tag tag-ready">STANDBY</span>
          </div>
          <strong class="pkt-name">${p.label}</strong>
          <span class="pkt-val">${p.val}</span>
        </div>
      `).join('');
    }
  }

  runSimulation() {
    this.isRunning = true;
    if (this.streamTriggerBtn) {
      this.streamTriggerBtn.disabled = true;
      this.streamTriggerBtn.textContent = 'Transmitting Telemetry...';
    }

    // Phase 1: Transmitting all 12 packets
    if (this.statusBadge) {
      this.statusBadge.innerHTML = '<span class="status-indicator active"></span> STREAMING TO HOSPITAL CLOUD';
    }

    this.packetFields.forEach((p, idx) => {
      setTimeout(() => {
        const el = document.getElementById(`pkt_${p.id}`);
        if (!el) return;

        if (p.willFail) {
          // Packet 5 encounters simulated channel noise
          el.className = 'telemetry-packet-card pkt-lost';
          el.querySelector('.pkt-status-tag').className = 'pkt-status-tag tag-lost';
          el.querySelector('.pkt-status-tag').textContent = 'CORRUPTED';
        } else {
          // Received
          el.className = 'telemetry-packet-card pkt-buffered';
          el.querySelector('.pkt-status-tag').className = 'pkt-status-tag tag-buffered';
          el.querySelector('.pkt-status-tag').textContent = 'BUFFERED';
        }
      }, idx * 120);
    });

    // Phase 2: Detect lost packet 05 and selective retransmit
    setTimeout(() => {
      if (this.statusBadge) {
        this.statusBadge.innerHTML = '<span class="status-indicator alert"></span> RETRANSMITTING PKT #05 ONLY';
      }
      if (this.bandwidthMeter) {
        this.bandwidthMeter.textContent = '91.7% Bandwidth Saved';
      }

      const p5 = document.getElementById('pkt_5');
      if (p5) {
        p5.className = 'telemetry-packet-card pkt-retransmitting';
        p5.querySelector('.pkt-status-tag').className = 'pkt-status-tag tag-retrans';
        p5.querySelector('.pkt-status-tag').textContent = 'RETRANSMITTING';
      }
    }, 1800);

    // Phase 3: Corrupted packet recovered, full report validated
    setTimeout(() => {
      const p5 = document.getElementById('pkt_5');
      if (p5) {
        p5.className = 'telemetry-packet-card pkt-delivered';
        p5.querySelector('.pkt-status-tag').className = 'pkt-status-tag tag-verified';
        p5.querySelector('.pkt-status-tag').textContent = 'VERIFIED';
      }

      // Mark all delivered
      this.packetFields.forEach((p) => {
        const el = document.getElementById(`pkt_${p.id}`);
        if (el) {
          el.className = 'telemetry-packet-card pkt-delivered';
          el.querySelector('.pkt-status-tag').className = 'pkt-status-tag tag-verified';
          el.querySelector('.pkt-status-tag').textContent = 'VERIFIED';
        }
      });

      if (this.statusBadge) {
        this.statusBadge.innerHTML = '<span class="status-indicator success"></span> REPORT COMPLETE (12/12) • 0 BYTES REDUNDANCY';
      }

      this.isRunning = false;
      if (this.streamTriggerBtn) {
        this.streamTriggerBtn.disabled = false;
        this.streamTriggerBtn.textContent = 'Replay Telemetry Stream';
      }
    }, 3200);
  }
}
