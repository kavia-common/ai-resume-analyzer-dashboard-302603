# Resume Analyzer Backend (Express)

Backend API for:
- Uploading a resume file (PDF/DOCX) and extracting plain text
- Analyzing resume text for a target job role using Google Gemini

## Endpoints
- `POST /upload` (multipart/form-data, field name: `file`)
- `POST /analyze` (JSON body: `{ "text": "...", "jobRole": "..." }`)
- `GET /` health check
- `GET /docs` Swagger UI

## Environment variables
Create a `.env` file in this folder (do not commit secrets). Use `.env.example` as a template:

- `PORT` (default `3001`)
- `CORS_ORIGIN` (default `http://localhost:3000`)
- `MAX_UPLOAD_MB` (default `10`)
- `GEMINI_API_KEY` (**required for** `/analyze`)

## Run locally
```bash
npm install
npm run dev
```

Then open:
- Swagger UI: `http://localhost:3001/docs`
