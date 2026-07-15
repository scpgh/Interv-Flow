<div align="center">

<img src="intervflow_logo.png" alt="IntervFlow Logo" width="96" height="96" />

# IntervFlow

**AI-Powered Interview Preparation Platform**

_Ace every interview with real-time AI mock sessions, ATS resume analysis, and performance analytics — all in one platform._

<br/>

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com)
[![Groq](https://img.shields.io/badge/Groq-LLaMA_3.3_70B-F55036?style=flat-square)](https://groq.com)
[![License](https://img.shields.io/badge/License-MIT-22C55E?style=flat-square)](LICENSE)

</div>

---

## ✨ Overview

IntervFlow is a full-stack AI interview preparation platform that helps candidates practice, improve, and track their interview readiness across multiple domains. It combines real-time voice-based mock interviews, deep ATS resume auditing, community discussion, and a live admin control panel — all backed by an LLM-powered critique engine.

---

## 🚀 Features

### 🎙️ AI Mock Interview Sessions
- Voice-based mock interviews powered by browser Web Speech API
- Real-time AI feedback after each answer
- Domain-aware questioning (SWE, Product, Finance, Consulting, and more)
- XP-based progression system with streak tracking

### 📄 ATS Resume Analyzer
- Upload PDF or DOCX resume (up to 5MB)
- Deep ATS audit: grammar, technical gaps, impact phrasing, formatting risks
- Realistic ATS score (20–92) calibrated against real recruiter standards
- 10 tailored general + 10 technical interview questions generated per submission
- AI resume Q&A chatbot for follow-up questions

### 📊 Analytics & Progress Tracking
- Session history with per-session scores
- XP and streak progression visualizations
- Domain-wise performance breakdown

### 👥 Community Forum
- Post questions, share tips, and upvote answers
- Domain-tagged threads with moderation support
- Real-time updates via WebSocket

### 💳 Billing & Plans
- Free and Pro subscription tiers
- Stripe-ready billing layout
- Plan comparison and upgrade flow

### 🛡️ Admin Control Panel
- Live system stats: total users, sessions, resumes analyzed
- Candidate account management (view, suspend, delete, role assignment)
- Impersonation mode for debugging user issues
- Forum moderation (post review, removal)
- Audit logging with cryptographic compliance trail
- Global system maintenance mode toggle (bypassed automatically for admins)
- Global XP multiplier adjustment

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 8, TailwindCSS 4, Framer Motion, React Router 7 |
| **Backend** | Node.js, Express 4 |
| **Auth** | Firebase Authentication (Email/Password + Google OAuth) |
| **Database** | Cloud Firestore (Firebase Admin SDK) with local JSON fallback |
| **AI Engine** | Groq API — LLaMA 3.3 70B Versatile (primary) with automatic key rotation |
| **AI Fallback** | Google Gemini API |
| **File Parsing** | `pdf-parse`, `mammoth` (DOCX) |
| **Real-time** | Native WebSocket (`ws`) |
| **Bundler** | Vite with `@vitejs/plugin-react` |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x
- A **Firebase** project with Firestore and Authentication enabled
- A **Groq** API key (free tier available at [console.groq.com](https://console.groq.com))

---

### 1. Clone the repository

```bash
git clone https://github.com/your-username/intervflow.git
cd intervflow
```

### 2. Configure the server

Navigate to the `server/` directory, copy the environmental template, and fill in your details based on the instructions inside `.env.example`:

```bash
cd server
cp .env.example .env
```

### 3. Configure the client

Navigate to the `client/` directory, create a `.env` file, and populate it with your Firebase Web configuration and target API endpoint:

```bash
cd ../client
```

Create a `.env` file in the `client/` directory containing:
- `VITE_API_URL` (typically `http://localhost:5000` for local runs)
- Your Firebase web app project credentials (such as `API_KEY`, `PROJECT_ID`, `APP_ID`, etc.)

### 4. Install dependencies

Install the standard node dependencies in both directories:

```bash
# From root
cd server && npm install
cd ../client && npm install
```

### 5. Run the development servers

You can run the backend either locally via Node or containerized via Docker:

#### Option A: Running locally with npm
Open two terminal sessions:

```bash
# Terminal 1 — Backend
cd server
npm run dev          # Starts on http://localhost:5000

# Terminal 2 — Frontend
cd client
npm run dev          # Starts on http://localhost:5173
```

#### Option B: Running the backend with Docker
To build and run the backend inside a Docker container:

```bash
cd server
docker compose up -d --build
```
This runs the containerized backend on `http://localhost:5000` and configures automatic data persistence on your local host system.

---

## 🔐 Authentication & Roles

| Role | Access |
|---|---|
| `USER` | All standard pages (Dashboard, Practice, Resume, Community, Billing) |
| `ADMIN` | All of the above + Admin Control Panel, user management, audit logs |

Admin access is controlled via Firebase Custom Claims, synchronized automatically on login. The allowed admin emails are configured via the server-side `ADMIN_EMAILS` environment variable in the `.env` file.

---

## 🌐 API Overview

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/status` | System health & maintenance status | Public |
| `POST` | `/api/auth/login` | Email/password login | Public |
| `POST` | `/api/auth/google` | Google OAuth login | Public |
| `POST` | `/api/auth/register` | User registration | Public |
| `GET` | `/api/user/profile` | Get authenticated user profile | JWT |
| `POST` | `/api/general/analyze-resume` | ATS resume analysis | JWT |
| `POST` | `/api/general/query-resume` | Resume Q&A chatbot | JWT |
| `POST` | `/api/general/chat` | General AI doubt chatbot | JWT |
| `POST` | `/api/interview/start` | Start a practice session | JWT |
| `POST` | `/api/interview/answer` | Submit answer, get AI feedback | JWT |
| `GET` | `/api/community/posts` | Fetch community posts | JWT |
| `POST` | `/api/community/posts` | Create a community post | JWT |
| `GET` | `/api/admin/stats` | System-wide statistics | Admin |
| `GET` | `/api/admin/users` | All user accounts | Admin |
| `PATCH` | `/api/admin/users/:email` | Update user role/status | Admin |
| `DELETE` | `/api/admin/users/:email` | Delete user account | Admin |

---

## 🛡️ Security

- **Firebase ID Token verification** on every protected route
- **Admin role** validated via JWT Custom Claims + Firestore DB fallback
- **Rate limiting** — 30 requests/minute per IP across all `/api` routes
- **Maintenance mode** — blocks all non-admin API traffic when enabled; status endpoint always remains public
- **`.env` and `serviceAccountKey.json`** are explicitly excluded from version control via `.gitignore`

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

Please ensure you **never commit** API keys, `.env` files, or `serviceAccountKey.json`.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

Built with ❤️ by the IntervFlow team

</div>
