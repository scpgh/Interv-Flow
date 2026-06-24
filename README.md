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

## 📁 Project Structure

```
IntervFlow/
├── client/                     # React frontend (Vite)
│   ├── src/
│   │   ├── components/         # Shared components (Navbar, DashboardNavbar, Chatbot, etc.)
│   │   ├── pages/              # Route-level page components
│   │   │   ├── LandingPage.jsx
│   │   │   ├── SignIn.jsx / SignUp.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── PracticeSession.jsx
│   │   │   ├── PracticeFeedback.jsx
│   │   │   ├── ResumeAnalyzer.jsx
│   │   │   ├── Analytics.jsx
│   │   │   ├── Community.jsx
│   │   │   ├── Billing.jsx
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── AdminUserInspect.jsx
│   │   │   └── MaintenancePage.jsx
│   │   ├── App.jsx             # Router + maintenance gate
│   │   ├── firebase.js         # Firebase client config
│   │   └── index.css           # Global design tokens & utilities
│   └── package.json
│
└── server/                     # Express backend
    ├── config/
    │   └── db.js               # Firebase Admin SDK init
    ├── helpers/
    │   ├── dbHelpers.js        # Firestore CRUD + startup migration
    │   └── critiqueHelpers.js  # Groq/Gemini AI integration
    ├── middleware/
    │   └── auth.js             # JWT verification, maintenance mode, rate limiter
    ├── routes/
    │   ├── auth.js             # Login, Google OAuth, register
    │   ├── user.js             # User profile CRUD
    │   ├── interview.js        # Practice session endpoints
    │   ├── community.js        # Forum posts and upvotes
    │   ├── admin.js            # Admin-only management endpoints
    │   └── general.js          # Resume analysis, AI chatbot, status
    ├── websocket/
    │   └── wsHandler.js        # WebSocket server (real-time updates)
    ├── index.js                # Express app entry point
    ├── nodemon.json
    └── .env.example            # Environment variable template
```

---

## ⚙️ Getting Started

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

```bash
cd server
cp .env.example .env
```

Open `server/.env` and fill in your credentials:

```env
PORT=5000

# Firebase Admin SDK
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Groq AI (required)
GROQ_API_KEY=gsk_your_key_here

# Optional: up to 4 fallback keys for automatic rotation on rate-limit
# GROQ_API_KEY_2=gsk_...
```

Place your Firebase service account JSON file at `server/serviceAccountKey.json`.

> **Tip:** Download it from Firebase Console → Project Settings → Service Accounts → Generate new private key.

### 3. Configure the client

```bash
cd ../client
```

Create `client/.env`:

```env
VITE_API_URL=http://localhost:5000
VITE_FIREBASE_API_KEY=your_firebase_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 4. Install dependencies

```bash
# From root
cd server && npm install
cd ../client && npm install
```

### 5. Run the development servers

Open two terminals:

```bash
# Terminal 1 — Backend
cd server
npm run dev          # starts on http://localhost:5000

# Terminal 2 — Frontend
cd client
npm run dev          # starts on http://localhost:5173
```

---

## 🔐 Authentication & Roles

| Role | Access |
|---|---|
| `USER` | All standard pages (Dashboard, Practice, Resume, Community, Billing) |
| `ADMIN` | All of the above + Admin Control Panel, user management, audit logs |

Admin access is controlled via Firebase Custom Claims, synchronized automatically on login. The admin email is configured in the server-side `adminEmails` constant in `server/routes/auth.js`.

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
