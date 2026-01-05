'use strict';

const { ApiError } = require('../utils/apiError');
const { extractTextFromFile } = require('../services/textExtraction');

/**
 * Upload controller for /upload.
 * Handles single file upload, extracts text, and returns strict JSON.
 */
class UploadController {
  async upload(req, res) {
    // Multer puts the file at req.file
    const file = req.file;
    if (!file) {
      throw new ApiError(400, 'Missing file. Send as multipart/form-data field named "file".');
    }

    const text = await extractTextFromFile(file);

    return res.status(200).json({
      text,
      metadata: {
        filename: file.originalname,
        size: file.size,
        type: file.mimetype,
      },
    });
  }
}

module.exports = new UploadController();
