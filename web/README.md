# xAI Ads - Web Frontend

Next.js frontend for the xAI Ads user embedding generator.

## Setup

### 1. Install Dependencies

```bash
cd web
npm install
```

### 2. Configure Environment

Edit `.env.local` to point to your backend API:

```env
# Local development
NEXT_PUBLIC_API_URL=http://localhost:8000

# Production (update to your Fly.io URL)
NEXT_PUBLIC_API_URL=https://your-app.fly.dev
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment to Vercel

### 1. Push to GitHub

Make sure your code is pushed to a GitHub repository.

### 2. Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Set the **Root Directory** to `web`
4. Add environment variable:
   - `NEXT_PUBLIC_API_URL` = `https://your-fastapi-app.fly.dev`

### 3. Deploy

Vercel will automatically build and deploy on every push.

## Architecture

```
┌─────────────────┐         ┌─────────────────┐
│   Vercel        │         │   Fly.io        │
│   (Frontend)    │ ──────► │   (Backend)     │
│   Next.js       │   API   │   FastAPI       │
└─────────────────┘         └─────────────────┘
                                    │
                                    ▼
                            ┌─────────────────┐
                            │   X API         │
                            │   (Twitter)     │
                            └─────────────────┘
```

## Features

- Clean, modern UI with Tailwind CSS
- Real-time loading states
- Error handling
- Displays user info, emotion profile, activity metrics
- Collapsible raw embedding vector view
- Responsive design (mobile-friendly)

## Backend Setup

Make sure the FastAPI backend is running:

```bash
# Set X API bearer token
$env:X_BEARER_TOKEN = "your_token"

# Run backend
cd ../api
python main.py
```

Or deploy to Fly.io - see `api/README.md` for instructions.
