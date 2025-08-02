# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a toxicity detection system for comment filtering and automatic moderation in the Roastr tool. The project is built with Node.js and integrates with OpenAI and Google's Perspective API for toxicity analysis.

## Development Commands

```bash
# Start the application
npm start

# Start in development mode with auto-reload
npm run dev

# Install dependencies
npm install

# Run tests (when implemented)
npm test
```

## Project Structure

```
src/
├── index.js           # Main entry point
├── config/
│   └── index.js       # Configuration management
├── services/
│   ├── openai.js      # OpenAI API integration
│   └── perspective.js # Perspective API integration
└── utils/
    └── logger.js      # Logging utility
```

## Environment Variables

Set these environment variables for API integrations:
- `OPENAI_API_KEY` - OpenAI API key for toxicity detection
- `PERSPECTIVE_API_KEY` - Google Perspective API key
- `NODE_ENV` - Set to 'production' to disable debug logging

## Architecture

- **Services Layer**: Handles external API communications (OpenAI, Perspective)
- **Config Layer**: Manages application configuration and environment variables
- **Utils Layer**: Shared utilities like logging
- **Main Entry**: `src/index.js` initializes the application