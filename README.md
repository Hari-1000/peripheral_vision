# Peripheral Vision Training App

Full-stack app: React + FastAPI + PostgreSQL + MediaPipe

---

## Prerequisites

- Node.js 18+
- Python 3.10+
- PostgreSQL running locally

---

## 1. PostgreSQL Setup

Create a database:
```sql
CREATE DATABASE peripheral_vision;
CREATE USER pvuser WITH PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE peripheral_vision TO pvuser;
```

---

## 2. Backend Setup (FastAPI)

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Create your .env file
copy .env.example .env
# Edit .env and fill in your DATABASE_URL and a SECRET_KEY

# Run the server
uvicorn main:app --reload
```

Backend runs at: http://localhost:8000
API docs at:     http://localhost:8000/docs

---

## 3. Frontend Setup (React)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: http://localhost:5173

---

## How it works

1. Sign up / log in
2. Dashboard shows Train and Test (Test is a placeholder)
3. Clicking Train opens the distance check — webcam detects your distance via MediaPipe Face Mesh
4. Once at the right distance (~60cm), proceed to the training arena
5. A colored light appears at center, then 4 corners light up — press Q/W/A/S to match
6. Eye tracking pauses the session if you look away
7. Results are saved to your account after each session

---

## Password Reset (dev mode)

Since there's no email server, the reset token is returned directly in the API response.
Go to /forgot-password, enter your email, copy the token, then use it at /reset-password.
