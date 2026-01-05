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
- `CORS_ALLOWED_ORIGINS` (comma-separated list of allowed origins, default includes `http://localhost:3000` and the preview domain)
- `CORS_ALLOW_ALL` (optional, set to `true` to temporarily allow all origins, methods, and headers)
- `MAX_UPLOAD_MB` (default `10`)
- `GEMINI_API_KEY` (**required for** `/analyze`)
- `GEMINI_MODEL` (optional, default `gemini-2.0-flash`) — model name used for `/analyze` calls

### CORS Configuration
The backend supports multiple allowed origins through the `CORS_ALLOWED_ORIGINS` environment variable. This allows the API to be accessed from different frontend origins (e.g., local development, preview environments, production).

Example:
```env
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://preview.example.com:3000,https://app.example.com
```

**Temporary Permissive Mode:**
To unblock preflight issues during development or debugging, you can enable permissive CORS by setting:
```env
CORS_ALLOW_ALL=true
```
This enables `origin: true` (reflects request origin), allows all methods/headers, and enables credentials.

The backend will automatically respond with `Access-Control-Allow-Origin` set to the requesting origin if it matches the allow-list. OPTIONS preflight requests are handled automatically for all endpoints.

## Run locally
```bash
npm install
npm run dev
```

Then open:
- Swagger UI: `http://localhost:3001/docs`
