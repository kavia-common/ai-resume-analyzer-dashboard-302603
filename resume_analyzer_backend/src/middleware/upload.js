'use strict';

const multer = require('multer');
const { ApiError } = require('../utils/apiError');
const config = require('../config');

/**
 * Multer configuration:
 * - Uses memory storage so we can parse file buffer directly (no disk writes).
 * - Validates file size and MIME type.
 */
const storage = multer.memoryStorage();

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
]);

function fileFilter(req, file, cb) {
  if (!allowedMimeTypes.has(file.mimetype)) {
    return cb(
      new ApiError(400, 'Invalid file type. Only PDF and DOCX are supported.', {
        received: file.mimetype,
        allowed: Array.from(allowedMimeTypes),
      })
    );
  }
  return cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.MAX_UPLOAD_MB * 1024 * 1024,
  },
});

module.exports = { upload };
