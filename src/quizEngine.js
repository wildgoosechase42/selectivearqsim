/**
 * quizEngine.js
 * 
 * Interactive quiz engine for Section 03 (Pretest) and Section 04 (Posttest).
 * Powers one-question-at-a-time navigation, client-side score evaluation,
 * local storage persistence, and the animated speedometer gauge result modal.
 */

export const PRETEST_QUESTIONS = [
  {
    id: 1,
    question: "In which layer of the OSI network architecture is Selective Repeat ARQ primarily implemented?",
    options: [
      "Physical Layer",
      "Data Link Layer",
      "Network Layer",
      "Transport Layer"
    ],
    answer: 1,
    explanation: "Selective Repeat ARQ is an error-control protocol primarily implemented in the Data Link Layer (and also utilized in Transport Layer protocols like TCP)."
  },
  {
    id: 2,
    question: "When a frame is lost or corrupted during transmission in Selective Repeat ARQ, what action does the sender take?",
    options: [
      "The sender retransmits the entire transmission window from the beginning",
      "Only that specific lost or corrupted frame is retransmitted",
      "All subsequent frames are automatically aborted and deleted",
      "The sender permanently terminates the communication channel"
    ],
    answer: 1,
    explanation: "Selective Repeat isolates errors by retransmitting only the specific lost or corrupted frame, avoiding Go-Back-N's bulk retransmissions."
  },
  {
    id: 3,
    question: "Suppose frames 1, 2, 3, 4, and 5 are sent and Frame 3 is lost. How does the receiver handle Frames 4 and 5?",
    options: [
      "It discards Frames 4 and 5 immediately because they arrived out of order",
      "It delivers Frames 4 and 5 to the upper layer immediately out of order",
      "It stores Frames 4 and 5 temporarily in memory instead of discarding them",
      "It re-requests all 5 frames from the sender"
    ],
    answer: 2,
    explanation: "The receiver stores out-of-order Frames 4 and 5 in its buffer instead of discarding them, awaiting the retransmission of Frame 3."
  },
  {
    id: 4,
    question: "Which mechanisms does Selective Repeat use to track frames that have been sent and received?",
    options: [
      "Parity check bits and static stop flags",
      "Sequence numbers, acknowledgments, and a sliding window",
      "Routing tables and hop count metrics",
      "Cryptographic token exchange only"
    ],
    answer: 1,
    explanation: "Selective Repeat uses sequence numbers, acknowledgments (ACKs/NAKs), and a sliding window to manage in-flight and received frames."
  },
  {
    id: 5,
    question: "Compared to Go-Back-N, what makes Selective Repeat ARQ more efficient when transmission errors occur?",
    options: [
      "It eliminates the need for sequence numbering entirely",
      "It requires zero memory at the receiver side",
      "It reduces unnecessary retransmissions by retransmitting only the lost or corrupted frame",
      "It completely prevents frames from colliding on the physical wire"
    ],
    answer: 2,
    explanation: "By retransmitting only lost frames, Selective Repeat saves substantial network bandwidth compared to Go-Back-N."
  }
];

export const POSTTEST_QUESTIONS = [
  {
    id: 1,
    question: "What does the acronym 'ARQ' stand for in error-control protocols?",
    options: [
      "Adaptive Routing Query",
      "Automatic Repeat reQuest",
      "Asynchronous Rate Queue",
      "Advanced Retransmission Quantity"
    ],
    answer: 1,
    explanation: "ARQ stands for Automatic Repeat reQuest, a foundational error-control strategy using ACKs and timeouts."
  },
  {
    id: 2,
    question: "What operational capability allows Selective Repeat ARQ to achieve high throughput before waiting for acknowledgments?",
    options: [
      "It allows the sender to send multiple frames before waiting for acknowledgments",
      "It disables error checking across the entire data stream",
      "It discards all acknowledgments from the receiver",
      "It restricts transmission to one frame per minute"
    ],
    answer: 0,
    explanation: "A sliding window allows pipelining multiple frames into the channel without waiting for individual ACKs, maximizing throughput."
  },
  {
    id: 3,
    question: "In the working example with 5 frames (1, 2, 3, 4, 5) where Frame 3 fails, which frame is retransmitted by the sender?",
    options: [
      "All 5 frames are retransmitted from scratch",
      "Frames 3, 4, and 5 are retransmitted",
      "Only Frame 3 is retransmitted",
      "Frames 4 and 5 only"
    ],
    answer: 2,
    explanation: "Because Frames 1, 2, 4, and 5 are successfully acknowledged or buffered, only Frame 3 needs retransmission."
  },
  {
    id: 4,
    question: "Why does the receiver require additional memory buffer in Selective Repeat ARQ?",
    options: [
      "To store intermediate cryptographic keys",
      "To store out-of-order frames temporarily until missing frames arrive",
      "To cache the operating system kernel image",
      "To log every packet header in permanent disk storage"
    ],
    answer: 1,
    explanation: "The receiver requires buffer memory to hold out-of-order frames until missing predecessor frames arrive to restore sequence order."
  },
  {
    id: 5,
    question: "What is the defining Key Point of Selective Repeat ARQ?",
    options: [
      "It retransmits all frames starting from the oldest unacknowledged sequence number",
      "It retransmits only the specific frames that are lost or corrupted, while correctly received frames are stored and kept",
      "It eliminates the need for sequence numbering at the Data Link Layer",
      "It discards out-of-order frames to keep receiver memory minimal"
    ],
    answer: 1,
    explanation: "Selective Repeat retransmits only corrupted/lost frames while keeping correctly received frames in memory."
  }
];

export class QuizEngine {
  constructor(type, containerId, questions) {
    this.type = type; // 'pretest' or 'posttest'
    this.container = document.getElementById(containerId);
    this.questions = questions;
    this.currentIndex = 0;
    this.selectedAnswers = new Array(questions.length).fill(null);
    this.isSubmitted = false;

    // Speedometer modal elements
    this.modal = document.getElementById('speedometerModal');
    this.modalTitle = document.getElementById('modalQuizTitle');
    this.modalScore = document.getElementById('modalScoreText');
    this.modalPct = document.getElementById('modalPctValue');
    this.gaugeNeedle = document.getElementById('gaugeNeedle');
    this.gaugeProgressArc = document.getElementById('gaugeProgressArc');
    this.comparisonBlock = document.getElementById('modalComparisonBlock');
    this.retakeBtn = document.getElementById('modalRetakeBtn');
    this.closeBtn = document.getElementById('modalCloseBtn');
  }

  init() {
    if (!this.container) return;
    this.loadSavedState();
    this.renderQuestion();
    this.initModalEvents();
  }

  loadSavedState() {
    try {
      const saved = localStorage.getItem(`vlab_${this.type}_data`);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.answers && data.answers.length === this.questions.length) {
          this.selectedAnswers = data.answers;
          this.isSubmitted = !!data.isSubmitted;
        }
      }
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }

  saveState() {
    try {
      const score = this.calculateScore();
      const pct = Math.round((score / this.questions.length) * 100);
      localStorage.setItem(`vlab_${this.type}_data`, JSON.stringify({
        answers: this.selectedAnswers,
        isSubmitted: this.isSubmitted,
        score,
        pct
      }));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }

  renderQuestion() {
    const q = this.questions[this.currentIndex];
    const total = this.questions.length;
    const answeredCount = this.selectedAnswers.filter((a) => a !== null).length;
    const userSelected = this.selectedAnswers[this.currentIndex];
    const isAnswered = userSelected !== null;
    const isUserCorrect = isAnswered && userSelected === q.answer;

    this.container.innerHTML = `
      <div class="quiz-card">
        <!-- Progress Header -->
        <div class="quiz-header">
          <div class="quiz-step-info">
            <span class="quiz-step-tag">QUESTION 0${this.currentIndex + 1} OF 0${total}</span>
            <span class="quiz-completion-tag">${answeredCount} / ${total} Answered</span>
          </div>
          <div class="quiz-progress-track">
            <div class="quiz-progress-fill" style="width: ${((this.currentIndex + 1) / total) * 100}%"></div>
          </div>
        </div>

        <!-- Question Prompt -->
        <h3 class="quiz-question-text">${q.question}</h3>

        <!-- Options List -->
        <div class="quiz-options-list" role="radiogroup" aria-label="Answer options">
          ${q.options.map((opt, i) => {
            let optionClasses = 'quiz-option-btn';
            let feedbackTag = '';

            if (isAnswered) {
              if (i === userSelected) {
                if (i === q.answer) {
                  optionClasses += ' is-correct selected';
                  feedbackTag = '<span class="option-feedback-tag correct">✓ Correct</span>';
                } else {
                  optionClasses += ' is-incorrect selected';
                  feedbackTag = '<span class="option-feedback-tag incorrect">✕ Incorrect</span>';
                }
              } else if (i === q.answer) {
                optionClasses += ' is-correct-target';
                feedbackTag = '<span class="option-feedback-tag target">Correct Answer</span>';
              } else {
                optionClasses += ' is-dimmed';
              }
            }

            return `
              <button 
                type="button"
                class="${optionClasses}" 
                data-index="${i}"
                role="radio"
                ${isAnswered ? 'disabled' : ''}
                aria-checked="${userSelected === i ? 'true' : 'false'}"
              >
                <span class="option-marker">${String.fromCharCode(65 + i)}</span>
                <span class="option-text">${opt}</span>
                ${feedbackTag ? feedbackTag : '<span class="option-indicator"></span>'}
              </button>
            `;
          }).join('')}
        </div>

        <!-- Immediate Right/Wrong Feedback Banner -->
        ${isAnswered ? `
          <div class="quiz-feedback-banner ${isUserCorrect ? 'feedback-correct' : 'feedback-incorrect'}" role="alert">
            <div class="feedback-badge">${isUserCorrect ? '✓' : '✕'}</div>
            <div class="feedback-content">
              <strong class="feedback-title">${isUserCorrect ? 'Correct!' : 'Incorrect'}</strong>
              <p class="feedback-text">${q.explanation || (isUserCorrect ? 'Well done! You identified the correct concept.' : `The correct answer is Option ${String.fromCharCode(65 + q.answer)}: "${q.options[q.answer]}".`)}</p>
            </div>
          </div>
        ` : ''}

        <!-- Controls Footer -->
        <div class="quiz-footer">
          <button 
            type="button" 
            class="quiz-nav-btn prev-btn" 
            id="${this.type}_prev"
            ${this.currentIndex === 0 ? 'disabled' : ''}
          >
            ← Previous
          </button>

          <div class="quiz-dots">
            ${this.questions.map((quest, i) => {
              const ans = this.selectedAnswers[i];
              let statusClass = '';
              if (ans !== null) {
                statusClass = ans === quest.answer ? 'answered-correct' : 'answered-incorrect';
              }
              return `
                <button 
                  type="button" 
                  class="quiz-dot ${i === this.currentIndex ? 'active' : ''} ${statusClass}"
                  data-jump="${i}"
                  aria-label="Go to question ${i + 1}"
                ></button>
              `;
            }).join('')}
          </div>

          ${this.currentIndex === total - 1 ? `
            <button 
              type="button" 
              class="quiz-nav-btn submit-btn" 
              id="${this.type}_submit"
            >
              Submit ${this.type === 'pretest' ? 'Pretest' : 'Posttest'} →
            </button>
          ` : `
            <button 
              type="button" 
              class="quiz-nav-btn next-btn" 
              id="${this.type}_next"
            >
              Next →
            </button>
          `}
        </div>
      </div>
    `;

    this.bindQuestionEvents();
  }

  bindQuestionEvents() {
    // Option selection
    const optionBtns = this.container.querySelectorAll('.quiz-option-btn');
    optionBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.selectedAnswers[this.currentIndex] !== null) return;
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        this.selectedAnswers[this.currentIndex] = idx;
        this.saveState();
        this.renderQuestion();
      });
    });

    // Next / Previous
    const prevBtn = this.container.querySelector(`#${this.type}_prev`);
    const nextBtn = this.container.querySelector(`#${this.type}_next`);
    const submitBtn = this.container.querySelector(`#${this.type}_submit`);

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.currentIndex > 0) {
          this.currentIndex--;
          this.renderQuestion();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (this.currentIndex < this.questions.length - 1) {
          this.currentIndex++;
          this.renderQuestion();
        }
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        this.submitQuiz();
      });
    }

    // Dot jump
    const dots = this.container.querySelectorAll('.quiz-dot');
    dots.forEach((dot) => {
      dot.addEventListener('click', () => {
        const jumpIdx = parseInt(dot.getAttribute('data-jump'), 10);
        this.currentIndex = jumpIdx;
        this.renderQuestion();
      });
    });
  }

  calculateScore() {
    let score = 0;
    for (let i = 0; i < this.questions.length; i++) {
      if (this.selectedAnswers[i] === this.questions[i].answer) {
        score++;
      }
    }
    return score;
  }

  submitQuiz() {
    this.isSubmitted = true;
    this.saveState();

    const score = this.calculateScore();
    const total = this.questions.length;
    const percentage = Math.round((score / total) * 100);

    this.showSpeedometerModal(score, total, percentage);
  }

  showSpeedometerModal(score, total, percentage) {
    if (!this.modal) return;

    if (this.modalTitle) {
      this.modalTitle.textContent = this.type === 'pretest' ? 'Pretest Evaluation' : 'Posttest Evaluation';
    }

    if (this.modalScore) {
      this.modalScore.textContent = `${score} / ${total} Correct`;
    }

    // Comparison for posttest
    if (this.comparisonBlock) {
      if (this.type === 'posttest') {
        const pretestRaw = localStorage.getItem('vlab_pretest_data');
        let pretestPct = null;
        if (pretestRaw) {
          try {
            const parsed = JSON.parse(pretestRaw);
            if (typeof parsed.pct === 'number') {
              pretestPct = parsed.pct;
            }
          } catch (e) {}
        }

        this.comparisonBlock.style.display = 'block';
        if (pretestPct !== null) {
          const delta = percentage - pretestPct;
          const deltaSign = delta > 0 ? `+${delta}%` : `${delta}%`;
          this.comparisonBlock.innerHTML = `
            <div class="comparison-card">
              <div class="comp-col">
                <span class="comp-label">PRETEST</span>
                <span class="comp-val">${pretestPct}%</span>
              </div>
              <div class="comp-col">
                <span class="comp-label">POSTTEST</span>
                <span class="comp-val active">${percentage}%</span>
              </div>
              <div class="comp-col">
                <span class="comp-label">DIFFERENCE</span>
                <span class="comp-val delta ${delta >= 0 ? 'pos' : 'neg'}">${deltaSign}</span>
              </div>
            </div>
          `;
        } else {
          this.comparisonBlock.innerHTML = `
            <div class="comparison-note">
              Complete the Pretest in Section 03 to unlock comparative performance telemetry.
            </div>
          `;
        }
      } else {
        this.comparisonBlock.style.display = 'none';
      }
    }

    // Reset gauge visual
    if (this.gaugeNeedle) {
      this.gaugeNeedle.style.transform = 'rotate(-90deg)';
    }
    if (this.gaugeProgressArc) {
      // Arc circumference for r=100 is Math.PI * 100 = ~314.15
      this.gaugeProgressArc.style.strokeDashoffset = '314.15';
    }
    if (this.modalPct) {
      this.modalPct.textContent = '0%';
    }

    this.modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Smoothly animate the needle, arc, and number into place
    requestAnimationFrame(() => {
      setTimeout(() => {
        // Needle sweeps from -90deg (0%) to +90deg (100%)
        const targetDeg = -90 + (percentage / 100) * 180;
        if (this.gaugeNeedle) {
          this.gaugeNeedle.style.transform = `rotate(${targetDeg}deg)`;
        }

        // Arc offset: 314.15 (0%) down to 0 (100%)
        const targetOffset = 314.15 - (percentage / 100) * 314.15;
        if (this.gaugeProgressArc) {
          this.gaugeProgressArc.style.strokeDashoffset = `${targetOffset}`;
        }

        // Animate counter
        const startTime = performance.now();
        const duration = 1200;
        const animateCounter = (now) => {
          const elapsed = now - startTime;
          const prog = Math.min(1.0, elapsed / duration);
          const currentVal = Math.round(prog * percentage);
          if (this.modalPct) {
            this.modalPct.textContent = `${currentVal}%`;
          }
          if (prog < 1.0) {
            requestAnimationFrame(animateCounter);
          }
        };
        requestAnimationFrame(animateCounter);
      }, 50);
    });
  }

  initModalEvents() {
    if (this.closeBtn) {
      this.closeBtn.onclick = () => this.closeModal();
    }

    if (this.retakeBtn) {
      this.retakeBtn.onclick = () => {
        this.closeModal();
        this.retakeQuiz();
      };
    }

    // Backdrop click
    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.closeModal();
        }
      });
    }

    // Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal && this.modal.classList.contains('active')) {
        this.closeModal();
      }
    });
  }

  closeModal() {
    if (this.modal) {
      this.modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  retakeQuiz() {
    this.selectedAnswers = new Array(this.questions.length).fill(null);
    this.currentIndex = 0;
    this.isSubmitted = false;
    this.saveState();
    this.renderQuestion();
  }
}
