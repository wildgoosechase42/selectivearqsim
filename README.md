# Selective Repeat ARQ — Interactive Scientific Virtual Lab

[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-14.0-black?logo=framer&logoColor=white)](https://www.framer.com/motion/)
[![Vercel](https://img.shields.io/badge/Vercel-Live_Demo-black?logo=vercel&logoColor=white)](https://selective-arq-simv1.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> An interactive, scientific Virtual Laboratory experiment for the **Data Link Layer (Computer Networks)** exploring **Selective Repeat Automatic Repeat reQuest (ARQ)** through cinematic scroll visualization, interactive 3D instructional card stacks, diagnostic evaluations, and a real-time gamified protocol simulator.

**Live Application:** [https://selective-arq-simv1.vercel.app](https://selective-arq-simv1.vercel.app)

---

## 🎯 Aim

> **Aim:** To understand the working principles, efficiency guarantees, and receiver-buffering mechanics of the **Selective Repeat ARQ** error-control protocol.

---

## 🔬 Scientific & Protocol Overview

Selective Repeat ARQ is a sliding window protocol implemented in the Data Link Layer and Transport Layer (e.g., TCP SACK) to provide reliable data transmission over unreliable channels.

### Key Working Principles
1. **Sliding Window Protocol:** The sender maintains a send window of size $N$ ($S_w$), and the receiver maintains an acceptance window of size $N$ ($R_w$).
2. **Independent Frame Buffering:** Unlike Go-Back-N, the receiver accepts and temporarily stores correctly received frames that arrive out of order, placing them into a receiver buffer.
3. **Selective Retransmission:** When a frame is corrupted or dropped in transit, the receiver sends a Negative Acknowledgment (NACK) or the sender times out specifically for that missing sequence number. Only the damaged frame is retransmitted.
4. **Ordered Delivery:** Once the missing frame is retransmitted and acknowledged, the receiver delivers all buffered in-sequence frames contiguously to the upper layer.

### Window Size Constraint
To prevent ambiguity between fresh frames and duplicate retransmissions:
$$S_w + R_w \le 2^m$$
For symmetric window sizes where $S_w = R_w = N$:
$$N \le 2^{m-1}$$
*(where $m$ is the bit-width of the frame sequence number)*.

### Advantages & Trade-Offs
- **Advantages:** Drastically saves network bandwidth compared to Go-Back-N; optimal channel throughput on high-loss or high-bandwidth-delay product links.
- **Trade-Offs:** Requires receiver buffer memory and individual timer tracking per unacknowledged frame.

---

## 📚 Curriculum Stack Modules

The core laboratory curriculum is delivered through a continuous **3D Case Study Flip Stack** powered by Framer Motion:

1. **Module 01 — Aim**: Core laboratory objective with theme-styled focal typography.
2. **Module 02 — Theory**: Comprehensive protocol comparison, principles, and interactive step-by-step frame transmission simulation.
3. **Module 03 — Diagnostic Pretest**: Formative 5-question pre-assessment testing baseline concepts before experimentation.
4. **Module 04 — Interactive Simulation (Selective Drop)**: Real-time falling-block protocol simulation featuring packet drops, corrupted frames, receiver buffer visualization, and dedicated retransmission recovery controls.
5. **Module 05 — Evaluation Posttest**: Comprehensive evaluation quiz with animated speedometer score gauge and diagnostic performance review.
6. **Module 06 — Clinical / AI Use Case**: Point-of-Care urine strip edge telemetry application illustrating how Selective ARQ guarantees reliable transmission of 10-analyte clinical patient records from a Raspberry Pi edge device to hospital databases and cloud systems.

---

## 🛠️ Technology Stack

| Technology | Role |
| :--- | :--- |
| **React 19** | Modular UI component architecture |
| **Framer Motion 14** | 3D Perspective Card Flip Stack & Smooth Spring Physics |
| **HTML5 Canvas** | Hardware-accelerated 2D arterial hero animation & simulation physics engine |
| **JavaScript (ES6+)** | Protocol state machines, sliding window timers, and quiz engines |
| **Vanilla CSS3** | Custom dark-mode glassmorphic design system and responsive layout tokens |
| **Vite 6** | Ultra-fast development server, HMR, and optimized production bundling |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- `npm` or `yarn`

### Installation
```bash
# Clone the repository
git clone https://github.com/wildgoosechase42/selectivearqsim.git

# Navigate into the project directory
cd selectivearqsim

# Install dependencies
npm install
```

### Development Server
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:3000`.

### Production Build
```bash
npm run build
npm run preview
```

---

## 🌐 Deployment to Vercel

This repository is ready for zero-configuration deployment on [Vercel](https://vercel.com/):

```bash
# Deploy with Vercel CLI
npx vercel --prod
```

Or import the repository directly on your Vercel Dashboard:
1. Link your GitHub account and import `wildgoosechase42/selectivearqsim`.
2. Build Command: `npm run build`
3. Output Directory: `dist`
4. Click **Deploy**.

---

## 👨‍💻 Developer Credits

- **Developer:** Vihaan Rao
- **Roll Number:** 16010425090
- **Laboratory:** Virtual Lab / Data Link Layer • Selective Repeat ARQ Experiment

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
