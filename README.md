# Gemini Chat Full-Stack Starter

A minimal full-stack project that pairs a Node.js/Express backend with a Vite + React frontend to create a Gemini-powered chat experience reminiscent of ChatGPT. The backend keeps your Gemini API key secure while the frontend delivers a polished conversation UI.

## Features
- **Express API** that proxies chat requests to Google's Gemini `gemini-pro` model.
- **React UI** designed to mirror a modern chat assistant interface.
- **Environment-ready**: just provide your Gemini API key and run `npm install` in each app.
- **Configurable origins** so you can deploy frontend and backend separately.

## Project Structure
```
backend/
  ├─ src/index.js         # Express server and Gemini proxy endpoint
  ├─ package.json         # Backend dependencies and scripts
  └─ .env.example         # Sample environment configuration
frontend/
  ├─ src/App.jsx          # Main chat UI logic
  ├─ src/styles.css       # Styling for the chat interface
  ├─ package.json         # Frontend dependencies and scripts
  └─ vite.config.js       # Vite dev server with API proxy
```

## Prerequisites
- Node.js 18 or newer (for native `fetch`).
- A Google AI Studio API key for Gemini.

## Getting Started
1. **Install dependencies**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Configure environment variables**
   - Copy `backend/.env.example` to `backend/.env` and set `GEMINI_API_KEY`.
   - Optionally adjust `CLIENT_ORIGIN` (comma-separated list) or `PORT`.
   - If your frontend will call the backend from a different origin in production, set `VITE_API_BASE_URL` in `frontend/.env` (e.g. `https://your-backend.example.com`).

3. **Run the backend**
   ```bash
   cd backend
   npm run dev
   # server listens on http://localhost:5001 by default
   ```

4. **Run the frontend**
   ```bash
   cd frontend
   npm run dev
   # Vite serves the UI on http://localhost:5173 and proxies /api to the backend
   ```

5. **Start chatting**
   - Open `http://localhost:5173` in your browser.
   - Send a message and the backend will forward the conversation to Gemini.

## Deployment Notes
- For production builds, run `npm run build` inside `frontend`; host the `dist/` folder on your preferred static host and point it at your backend via `VITE_API_BASE_URL`.
- Keep the backend behind server-side authentication if you need to protect your API key or enforce usage limits.
- Make sure to monitor Gemini usage quotas and apply caching/rate limiting if you expect high traffic.

## Extending the Starter
- Swap in a database to persist conversation history per user.
- Add authentication (OAuth, Clerk, etc.) before allowing access to the chat endpoint.
- Implement response streaming via the Gemini streaming API for a more real-time feel.

Happy building!
