import React, { useEffect } from "react";
import { CaseStudyFlipStack } from "@/components/ui/case-study-flip-stack";
import { TheorySimulation } from "./theorySimulation.js";
import { QuizEngine, PRETEST_QUESTIONS, POSTTEST_QUESTIONS } from "./quizEngine.js";
import { SelectiveDropSim } from "./simulator/selectiveDropSim.js";

export default function WorkPage() {
  useEffect(() => {
    const theorySim = new TheorySimulation();
    theorySim.init();

    const pretest = new QuizEngine("pretest", "pretestContainer", PRETEST_QUESTIONS);
    pretest.init();

    const dropSim = new SelectiveDropSim();
    dropSim.init();
    window.dropSim = dropSim;

    const posttest = new QuizEngine("posttest", "posttestContainer", POSTTEST_QUESTIONS);
    posttest.init();

    return () => {
      if (dropSim && dropSim.rafId) {
        cancelAnimationFrame(dropSim.rafId);
      }
    };
  }, []);

  const items = [
    {
      id: "aimBlockContainer",
      number: "01",
      eyebrow: "OBJECTIVE",
      title: "Aim",
      badge: "MODULE 01 / 06",
      background: "#141414",
      foreground: "#f5f5f5",
      content: (
        <div className="aim-card-centered">
          <div className="aim-glow-ring"></div>
          <span className="aim-kicker">MODULE 01 — CORE OBJECTIVE</span>
          <h2 className="aim-hero-title">Aim</h2>
          <p className="aim-hero-statement" id="aimHeading">To understand Selective ARQ</p>
        </div>
      ),
    },
    {
      id: "theoryBlockContainer",
      number: "02",
      eyebrow: "FOUNDATIONAL THEORY",
      title: "Theory",
      badge: "MODULE 02 / 06",
      background: "#1a1415",
      foreground: "#f5f5f5",
      content: (
        <div className="vlab-section-box h-full">
          <div className="card-theory-2col">
            <div className="card-panel-box p-4 rounded-xl border border-white/10 bg-white/[0.03]">
              <div>
                <span className="card-kicker">02 / FOUNDATIONAL THEORY</span>
                <h2 className="card-heading-title">Selective Repeat ARQ</h2>
                <p className="card-description-text">
                  Selective Repeat ARQ (Automatic Repeat reQuest) is an error-control protocol used in the Data Link Layer. It allows the sender to send multiple frames before waiting for acknowledgments. If any frame is lost or corrupted, only that particular frame is retransmitted.
                </p>

                <div className="theory-keypoint">
                  <span className="key-point-label text-[10px] font-mono text-[#d4af35] font-bold block mb-0.5">KEY PRINCIPLE</span>
                  <blockquote className="key-point-quote text-[11px] text-white/90 italic">
                    Selective Repeat ARQ retransmits only the specific frames that are lost or corrupted, while correctly received frames are stored and kept.
                  </blockquote>
                </div>
              </div>

              <div className="theory-eval-grid">
                <div className="theory-eval-card adv">
                  <h4>Advantages</h4>
                  <ul>
                    <li>Only lost/corrupted frame resent</li>
                    <li>Saves network bandwidth</li>
                    <li>More efficient than Go-Back-N</li>
                  </ul>
                </div>
                <div className="theory-eval-card dis">
                  <h4>Disadvantages</h4>
                  <ul>
                    <li>More complex implementation</li>
                    <li>Requires receiver memory buffer</li>
                    <li>Maintains state per frame</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="card-panel-box gap-2">
              <div className="interactive-sim-box" id="theorySimContainer">
                <div className="sim-header">
                  <div className="sim-endpoints">
                    <span className="endpoint-node sender">SENDER</span>
                    <span className="sim-channel-label">TRANSMISSION CHANNEL</span>
                    <span className="endpoint-node receiver">RECEIVER</span>
                  </div>
                  <div className="sim-controls">
                    <button type="button" className="sim-btn primary-sim-btn" id="theorySimPlayBtn">
                      <span>Play Simulation</span>
                    </button>
                    <button type="button" className="sim-btn" id="theorySimStepBtn">
                      <span>Next Step</span>
                    </button>
                    <button type="button" className="sim-btn reset-sim-btn" id="theorySimResetBtn">
                      <span>Reset</span>
                    </button>
                  </div>
                </div>

                <div className="sim-stage">
                  <div className="channel-track-line"></div>
                  <div className="sim-frames-wrap" id="theorySimFrames"></div>
                </div>

                <div className="sim-footer">
                  <div className="sim-step-text" id="theorySimStepText"></div>
                  <div className="sim-buffer-panel">
                    <span className="buffer-label">RECEIVER BUFFER</span>
                    <div className="buffer-tags" id="theoryReceiverBuffer">
                      <span className="buffer-empty">Buffer empty</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-white/10 bg-black/40">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-white/60 uppercase">Working Frame Scenario:</span>
                  <span className="text-[10px] font-mono text-[#c81e1e] font-semibold">Frame 3 Corrupted</span>
                </div>
                <div className="frame-ascii-grid mb-1" aria-label="Five frame transmission status">
                  <div className="ascii-col">
                    <span className="ascii-num">1</span>
                    <span className="ascii-status status-success">✓</span>
                  </div>
                  <div className="ascii-col">
                    <span className="ascii-num">2</span>
                    <span className="ascii-status status-success">✓</span>
                  </div>
                  <div className="ascii-col">
                    <span className="ascii-num">3</span>
                    <span className="ascii-status status-fail">✗</span>
                  </div>
                  <div className="ascii-col">
                    <span className="ascii-num">4</span>
                    <span className="ascii-status status-success">✓</span>
                  </div>
                  <div className="ascii-col">
                    <span className="ascii-num">5</span>
                    <span className="ascii-status status-success">✓</span>
                  </div>
                </div>
                <p className="text-[10.5px] text-white/70 leading-snug">
                  Frame 3 is lost/corrupted while Frames 1, 2, 4, 5 are kept in receiver buffer until Frame 3 is retransmitted and ordered delivery completes.
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "pretestBlockContainer",
      number: "03",
      eyebrow: "DIAGNOSTIC PRETEST",
      title: "Pretest",
      badge: "MODULE 03 / 06",
      background: "#1a1814",
      foreground: "#f5f5f5",
      content: (
        <div className="vlab-section-box h-full quiz-fullscreen-wrap">
          <div className="quiz-container quiz-container-full" id="pretestContainer"></div>
        </div>
      ),
    },
    {
      id: "simulationBlockContainer",
      number: "04",
      eyebrow: "INTERACTIVE SIMULATION",
      title: "Selective Drop",
      badge: "MODULE 04 / 06",
      background: "#1d1215",
      foreground: "#f5f5f5",
      content: (
        <div className="vlab-section-box h-full" id="simulation">
          <div className="sim-fullscreen-layout">
            <div className="sim-viewport-wrapper" id="simViewportWrapper">
              <div className="sim-start-overlay" id="simStartScreen" style={{ display: "none" }}>
                <div className="sim-start-card">
                  <span className="sim-start-kicker">NETWORK LAB / SELECTIVE REPEAT ARQ</span>
                  <h3 className="sim-start-title">SELECTIVE DROP</h3>
                  <p className="sim-start-subtitle">Selective Repeat ARQ Simulator</p>
                  <div className="sim-target-mini-pill">30 PACKETS</div>

                  <div className="sim-start-params">
                    <div className="sim-param-group">
                      <label className="sim-param-label">WINDOW SIZE (N)</label>
                      <div className="sim-difficulty-selector" id="startWindowPicker">
                        <button type="button" className="sim-diff-btn" data-winsize="4">4</button>
                        <button type="button" className="sim-diff-btn active" data-winsize="6">6</button>
                        <button type="button" className="sim-diff-btn" data-winsize="8">8</button>
                        <button type="button" className="sim-diff-btn" data-winsize="10">10</button>
                      </div>
                    </div>

                    <div className="sim-param-group">
                      <label className="sim-param-label">DIFFICULTY</label>
                      <div className="sim-difficulty-selector" id="startDifficultyPicker">
                        <button type="button" className="sim-diff-btn active" data-level="EASY">EASY</button>
                        <button type="button" className="sim-diff-btn" data-level="NORMAL">NORMAL</button>
                        <button type="button" className="sim-diff-btn" data-level="HARD">HARD</button>
                        <button type="button" className="sim-diff-btn" data-level="CHAOS">CHAOS</button>
                      </div>
                    </div>
                  </div>

                  <div className="sim-advanced-section">
                    <button type="button" className="sim-advanced-toggle" id="simAdvancedToggle">
                      <span>⚙ Advanced Settings</span>
                      <span className="toggle-arrow" id="advArrow">▼</span>
                    </button>
                    <div className="sim-advanced-drawer" id="simAdvancedDrawer" style={{ display: "none" }}>
                      <div className="sim-slider-row">
                        <span className="slider-lbl">Window Size (4, 6, 8, 10):</span>
                        <input type="range" id="advWindowSize" min="4" max="10" step="2" defaultValue="6" className="sim-slider" />
                        <span className="slider-val" id="advWindowSizeDisplay">6</span>
                      </div>
                      <div className="sim-slider-row">
                        <span className="slider-lbl">Packet Loss Rate:</span>
                        <input type="range" id="advLossRate" min="0" max="35" defaultValue="8" className="sim-slider" />
                        <span className="slider-val" id="advLossRateDisplay">8%</span>
                      </div>
                      <div className="sim-slider-row">
                        <span className="slider-lbl">Corruption Rate:</span>
                        <input type="range" id="advCorruptRate" min="0" max="35" defaultValue="12" className="sim-slider" />
                        <span className="slider-val" id="advCorruptRateDisplay">12%</span>
                      </div>
                      <div className="sim-slider-row">
                        <span className="slider-lbl">Block Fall Speed:</span>
                        <input type="range" id="advFallSpeed" min="8" max="22" defaultValue="12" className="sim-slider" />
                        <span className="slider-val" id="advFallSpeedDisplay">1.2x</span>
                      </div>
                    </div>
                  </div>

                  <div className="sim-start-actions">
                    <button type="button" className="sim-btn primary-sim-btn start-sim-cta" id="simStartBtn">
                      <span>▶ START SIMULATION</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="sim-tutorial-overlay" id="simTutorialOverlay">
                <div className="sim-tutorial-card">
                  <div className="tut-header">
                    <div className="tut-indicators">
                      <span className="tut-dot active" data-slide="0"></span>
                      <span className="tut-dot" data-slide="1"></span>
                      <span className="tut-dot" data-slide="2"></span>
                      <span className="tut-dot" data-slide="3"></span>
                    </div>
                    <span className="tut-step-tag" id="tutStepTag">01 / 04</span>
                  </div>

                  <div className="tut-slides-container">
                    <div className="tut-slide active" data-slide-index="0">
                      <h4 className="tut-slide-title">TRANSMISSION GROUP</h4>
                      <div className="tut-diagram-frame">
                        <div className="diagram-group-box">
                          <div className="tut-pkt-cell">P01</div>
                          <div className="tut-pkt-cell">P02</div>
                          <div className="tut-pkt-cell">P03</div>
                          <div className="tut-pkt-cell">P04</div>
                        </div>
                        <div className="tut-flow-arrow">↓</div>
                      </div>
                      <p className="tut-caption">One group contains multiple packets.</p>
                    </div>

                    <div className="tut-slide" data-slide-index="1">
                      <h4 className="tut-slide-title">SINGLE CORRUPTION</h4>
                      <div className="tut-diagram-frame">
                        <div className="diagram-group-box">
                          <div className="tut-pkt-cell">P01</div>
                          <div className="tut-pkt-cell">P02</div>
                          <div className="tut-pkt-cell tut-pkt-corrupt">⚠ P03</div>
                          <div className="tut-pkt-cell">P04</div>
                        </div>
                        <div className="tut-socket-preview">
                          <span className="socket-tag">[ P03 MISSING ]</span>
                        </div>
                      </div>
                      <p className="tut-caption">Only one packet can fail.</p>
                    </div>

                    <div className="tut-slide" data-slide-index="2">
                      <h4 className="tut-slide-title">RECEIVER BUFFER</h4>
                      <div className="tut-diagram-frame buffer-diagram-frame">
                        <div className="tut-diag-buffer">
                          <span className="tut-box-lbl">BUFFER</span>
                          <div className="tut-pkt-buffered">P04</div>
                          <div className="tut-pkt-buffered">P05</div>
                        </div>
                        <div className="tut-arrow-left">←</div>
                        <div className="tut-diag-receiver">
                          <span className="tut-box-lbl">MAIN RECEIVER</span>
                          <div className="tut-rcv-row"><span className="tut-delivered">P01 ✓</span> <span className="tut-delivered">P02 ✓</span></div>
                          <div className="tut-missing-row"><span className="tut-missing-cell">P03 ✕</span></div>
                        </div>
                      </div>
                      <p className="tut-caption">Later packets wait in the buffer.</p>
                    </div>

                    <div className="tut-slide" data-slide-index="3">
                      <h4 className="tut-slide-title">SELECTIVE RETRANSMISSION</h4>
                      <div className="tut-diagram-frame retrans-diagram-frame">
                        <div className="tut-retrans-flow">
                          <div className="tut-retrans-item"><span className="tut-pkt-recovery">R03 ↓</span></div>
                          <div className="tut-retrans-socket">P03 RECOVERED ✓</div>
                          <div className="tut-release-stream">
                            <span className="tut-release-label">ORDERED RELEASE:</span>
                            <span className="tut-release-chip">P04 →</span>
                            <span className="tut-release-chip">P05 →</span>
                          </div>
                        </div>
                      </div>
                      <p className="tut-caption">Only the missing packet is retransmitted.</p>
                    </div>
                  </div>

                  <div className="tut-footer">
                    <button type="button" className="tut-btn-text" id="tutSkipBtn">Skip Tutorial</button>
                    <button type="button" className="sim-btn primary-sim-btn tut-btn-next" id="tutNextBtn">
                      <span>NEXT →</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="sim-pause-overlay" id="simPauseOverlay" style={{ display: "none" }}>
                <div className="sim-pause-card">
                  <span className="pause-tag">SIMULATION PAUSED</span>
                  <h3 className="pause-title">GAME SUSPENDED</h3>
                  <p className="pause-desc">Transmission paused. Press ESC or click Resume to continue.</p>
                  <div className="pause-actions">
                    <button type="button" className="sim-btn primary-sim-btn" id="simResumeBtn">▶ Resume</button>
                    <button type="button" className="sim-btn" id="simPauseRestartBtn">↺ Restart</button>
                  </div>
                </div>
              </div>

              <div className="sim-stage-layout sim-stage-layout-expanded">
                <div className="sim-arena-column">
                  <div className="sim-arena-topbar">
                    <div className="topbar-left">
                      <div className="sim-title-group">
                        <span className="sim-brand-main">SELECTIVE DROP</span>
                        <span className="sim-brand-sub" id="simGroupLabel">EXPECTED P01</span>
                      </div>
                    </div>
                    <div className="topbar-right">
                      <div className="sim-target-progress-badge" id="simProgressContainer">
                        <span className="prog-val" id="simTargetCount">00 / 30</span>
                        <span className="prog-lbl">PACKETS</span>
                      </div>
                      <div className="topbar-actions">
                        <button type="button" className="sim-btn small-btn" id="simHowToPlayBtn" aria-label="View Instructions">
                          <span>ℹ Instructions</span>
                        </button>
                        <button type="button" className="sim-btn small-btn" id="simPlayPauseBtn" aria-label="Pause or Resume Simulation">
                          <span>⏸ Pause</span>
                        </button>
                        <button type="button" className="sim-btn small-btn" id="simRestartBtn" aria-label="Restart Current Simulation">
                          <span>↺ Restart</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="sim-arena-body">
                    <div className="sim-canvas-card sim-canvas-card-expanded" id="simCanvasContainer" tabIndex={0} aria-label="Selective Repeat ARQ receiver buffer simulator. Buffer on left, main receiver center.">
                      <div className="canvas-inner-wrapper">
                        <canvas className="sim-interactive-canvas" id="simCanvas" width="460" height="510"></canvas>
                      </div>

                      <div className="sim-game-controls" aria-label="Transmission group controls">
                        <div className="ctrl-btn-group">
                          <button type="button" className="sim-ctrl-btn" id="ctrlLeft" aria-label="Move Left">◀ LEFT</button>
                          <button type="button" className="sim-ctrl-btn ctrl-rotate-btn" id="ctrlRotate" aria-label="Rotate">⟳ ROTATE</button>
                          <button type="button" className="sim-ctrl-btn" id="ctrlRight" aria-label="Move Right">RIGHT ▶</button>
                        </div>
                        <div className="ctrl-btn-group">
                          <button type="button" className="sim-ctrl-btn ctrl-drop-btn" id="ctrlSoftDrop" aria-label="Soft Drop">▼ SOFT DROP</button>
                          <button type="button" className="sim-ctrl-btn ctrl-hard-drop-btn" id="ctrlHardDrop" aria-label="Hard Drop">⤓ HARD DROP</button>
                        </div>
                      </div>

                      <div className="sim-controls-guide" aria-label="Keyboard controls">
                        <div className="guide-keys">
                          <span><kbd className="key-chip">◀</kbd> <kbd className="key-chip">▶</kbd> <span className="guide-txt">Move</span></span>
                          <span><kbd className="key-chip">▲</kbd> <span className="guide-txt">Rotate</span></span>
                          <span><kbd className="key-chip">▼</kbd> <span className="guide-txt">Drop</span></span>
                          <span><kbd className="key-chip">SPACE</kbd> <span className="guide-txt">Hard Drop</span></span>
                          <span><kbd className="key-chip danger">R</kbd> <span className="guide-txt">Retransmit</span></span>
                        </div>
                      </div>
                    </div>

                    <aside className="sim-side-recovery-panel is-hidden" id="simSideRecoveryPanel" aria-label="Selective Retransmission Control"></aside>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "posttestBlockContainer",
      number: "05",
      eyebrow: "EVALUATION POSTTEST",
      title: "Posttest",
      badge: "MODULE 05 / 06",
      background: "#13171e",
      foreground: "#f5f5f5",
      content: (
        <div className="vlab-section-box h-full quiz-fullscreen-wrap">
          <div className="quiz-container quiz-container-full" id="posttestContainer"></div>
        </div>
      ),
    },
    {
      id: "aiUseCaseBlockContainer",
      number: "06",
      eyebrow: "CLINICAL APPLICATION",
      title: "AI Use Case",
      badge: "MODULE 06 / 06",
      background: "#121b16",
      foreground: "#f5f5f5",
      content: (
        <div className="ai-usecase-centered" id="aiUseCase">
          <div className="ai-usecase-glow"></div>
          <span className="ai-usecase-kicker">MODULE 06 — CLINICAL APPLICATION</span>
          <h2 className="ai-usecase-heading" id="aiHeading">AI Use Case</h2>
          <h3 className="ai-usecase-subheading">Point-of-Care Urine Strip Edge Telemetry</h3>
          <p className="ai-usecase-paragraph">
            Selective ARQ can be used in this AI-based urine test strip reader to ensure reliable transmission of patient test results from the Raspberry Pi edge device to the hospital database or cloud. Since the system sends structured data containing patient ID, timestamp, and the concentrations of all 10 analytes, Selective ARQ can retransmit only the specific data packets that are lost or corrupted instead of retransmitting the entire report. This reduces unnecessary network traffic and improves communication efficiency while maintaining the integrity of sensitive medical data. It is especially useful for the proposed multi-site point-of-care deployment, where secure and reliable telemetry is required between the edge device, hospital systems, and cloud infrastructure.
          </p>
        </div>
      ),
    },
  ];

  return (
    <CaseStudyFlipStack
      items={items}
      className="vlab-flip-stack-section"
    />
  );
}
