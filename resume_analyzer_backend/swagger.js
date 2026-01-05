const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AI Resume Analyzer API',
      version: '1.0.0',
      description: 'Express backend API for uploading resumes (PDF/DOCX), extracting text, and analyzing resumes using Google Gemini.',
    },
    tags: [
      { name: 'Health', description: 'Service health and status' },
      { name: 'Resume', description: 'Resume upload, text extraction, and AI analysis' },
    ],
  },
  // Include every file under routes to keep docs in sync as we grow.
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;
