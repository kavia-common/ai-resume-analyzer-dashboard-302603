#!/bin/bash
cd /home/kavia/workspace/code-generation/ai-resume-analyzer-dashboard-302603/resume_analyzer_backend
npm run lint
LINT_EXIT_CODE=$?
if [ $LINT_EXIT_CODE -ne 0 ]; then
  exit 1
fi

