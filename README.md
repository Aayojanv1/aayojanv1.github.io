# AayojanAI 🍛

**Your celebration, perfectly served.** AI-powered party catering platform for Newtown, Kolkata.

## Architecture

```
├── frontend/     → React landing page (Vite)    → GitHub Pages
├── app/          → Flutter chatbot (MoodMunch)  → GitHub Pages /app
├── backend/      → FastAPI + Gemini SDK         → Render.com
└── .github/      → CI/CD workflows
```

## Live URLs

| Component | URL |
|---|---|
| Landing Page | https://gouravchat.github.io/aayojan/ |
| Flutter App | https://gouravchat.github.io/aayojan/app/ |
| Backend API | _(deploy to Render)_ |

## Local Development

### Frontend (React)
```bash
cd frontend
npm install
npm run dev          # → http://localhost:5173
```

### Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # Add your GEMINI_API_KEY
uvicorn main:app --reload  # → http://localhost:8000
```

### Flutter App
```bash
cd app
flutter pub get
flutter run -d chrome --dart-define=GEMINI_API_KEY=your_key
```

## Tech Stack

- **Frontend**: React + Vite (dark theme, Playfair Display/DM Sans)
- **App**: Flutter (web, Android, iOS from single codebase)
- **Backend**: Python FastAPI + Google Gemini 2.5-flash
- **AI Workflows**: Menu generation, pricing, caterer ranking
- **Deployment**: GitHub Pages (static) + Render (API)
