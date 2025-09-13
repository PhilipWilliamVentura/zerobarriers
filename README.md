# Zero Barriers – Real-Time ASL Video Translator

## 🚀 Overview

**Zero Barriers** is a full-stack web app that empowers real-time communication using **American Sign Language (ASL)**. Speak naturally into your webcam, and watch your avatar translate your speech into ASL live!

Our app is more than just a translator:

- **Live Video Translation:** Speak and see your words instantly transformed into sign language via a responsive avatar.
- **User Dashboard:** Secure authentication and a personalized dashboard powered by Supabase Auth.
- **Session History:** Automatically saves your recent sessions for easy reference.
- **Intelligent RAG Chatbot:** Ask questions about your past sessions — powered by Retrieval-Augmented Generation (RAG).
- **Future Features:** Upcoming improvements include a **video diffusion model** for higher-quality avatars and an advanced RAG chatbot with smarter context understanding.

---

## 🎯 Key Features

### 1. Secure Authentication
- Powered by [Supabase Auth](https://supabase.com/docs/guides/auth)
- Email/password sign-in and secure user sessions
- Personalized dashboards for each user

### 2. Real-Time ASL Translation
- Webcam integration for live video
- Speech-to-avatar conversion to ASL
- Interactive and engaging for users learning or communicating with ASL

### 3. Session Management
- Start a new session with a single click
- Track and view your last 5 sessions directly in your dashboard
- Each session includes timestamps and metadata

### 4. RAG Chatbot Integration
- Ask questions about your previous sessions
- The RAG bot uses session transcripts to provide context-aware answers
- Future improvements will enhance the AI’s comprehension and interactivity

### 5. Future Vision
- Implement a **video diffusion model** for realistic avatars
- Upgrade the RAG bot to handle complex conversational queries intelligently

---

## 🖥️ Demo Screenshots

**Dashboard:**  
![Dashboard](https://via.placeholder.com/600x300?text=Dashboard+Mockup)  

**Live Session:**  
![Live Session](https://via.placeholder.com/600x300?text=Live+ASL+Avatar)  

**RAG Chatbot:**  
![RAG Chat](https://via.placeholder.com/600x300?text=RAG+Chatbot)  

---

## ⚡ Tech Stack

- **Frontend:** Vite, React, Tailwind CSS, Lucide Icons
- **Backend:** Supabase (Auth + Postgres)
- **Real-Time Video:** WebRTC, MediaStream API
- **RAG Bot:** LangChain + FAISS (currently simple retrieval)
- **Deployment:** Vercel / Netlify (frontend), Supabase backend

---

## 📦 Getting Started

### 1. Clone the Repo
```bash
git clone https://github.com/yourusername/zero-barriers.git
cd zero-barriers
