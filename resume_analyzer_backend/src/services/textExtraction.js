'use strict';

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { ApiError } = require('../utils/apiError');

/**
 * Extract text from a PDF buffer.
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
async function extractTextFromPdf(buffer) {
  try {
    const result = await pdfParse(buffer);
    return (result.text || '').trim();
  } catch (err) {
    throw new ApiError(400, 'Failed to extract text from PDF.', { reason: err.message });
  }
}

/**
 * Extract text from a DOCX buffer.
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
async function extractTextFromDocx(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return (result.value || '').trim();
  } catch (err) {
    throw new ApiError(400, 'Failed to extract text from DOCX.', { reason: err.message });
  }
}

/**
 * PUBLIC_INTERFACE
 * Extract plain text from an uploaded resume file (PDF/DOCX).
 * @param {{ mimetype: string, buffer: Buffer }} file
 * @returns {Promise<string>}
 */
async function extractTextFromFile(file) {
  /** This is a public function. */
  if (!file || !file.buffer || !file.mimetype) {
    throw new ApiError(400, 'Missing file data.');
  }

  if (file.mimetype === 'application/pdf') {
    return extractTextFromPdf(file.buffer);
  }

  if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractTextFromDocx(file.buffer);
  }

  // This should be impossible due to multer fileFilter, but we keep it defensive.
  throw new ApiError(400, 'Unsupported file type.', { mimetype: file.mimetype });
}

module.exports = { extractTextFromFile };
