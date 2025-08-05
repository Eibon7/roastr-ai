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

# Start API server
npm run start:api

# Use CLI tool
npm run roast "your message here"

# Run Twitter bot
npm run twitter

# Install dependencies
npm install

# Run tests (when implemented)
npm test
```

## Project Structure

```
src/
├── index.js           # Main entry point (Express server)
├── cli.js             # CLI tool for testing roasts
├── server.js          # Alternative server entry point
├── config/
│   └── index.js       # Configuration management
├── services/
│   ├── openai.js      # OpenAI API integration
│   ├── perspective.js # Perspective API integration
│   ├── perspectiveMock.js     # Mock toxicity detection
│   ├── roastGeneratorMock.js  # Mock roast generator
│   ├── roastGeneratorReal.js  # Real OpenAI roast generator
│   └── twitter.js     # Twitter/X bot integration
└── utils/
    └── logger.js      # Logging utility

public/
├── index.html         # Frontend web interface
├── script.js          # Frontend JavaScript
└── style.css          # Frontend styles

data/
└── processed_tweets.json  # Twitter bot state (auto-generated)
```

## Environment Variables

Set these environment variables for API integrations:

**Core API:**
- `OPENAI_API_KEY` - OpenAI API key for roast generation (required for Phase 1.5)
- `ROASTR_API_KEY` - Custom API key for /roast endpoint authentication
- `PERSPECTIVE_API_KEY` - Google Perspective API key (for future real toxicity detection)
- `NODE_ENV` - Set to 'production' to disable debug logging
- `DEBUG` - Set to 'true' to enable detailed logging

**Twitter Integration:**
- `TWITTER_BEARER_TOKEN` - Twitter Bearer Token for reading mentions (OAuth 2.0)
- `TWITTER_APP_KEY` - Twitter Consumer Key
- `TWITTER_APP_SECRET` - Twitter Consumer Secret  
- `TWITTER_ACCESS_TOKEN` - Twitter Access Token for posting
- `TWITTER_ACCESS_SECRET` - Twitter Access Token Secret
- `ROAST_API_URL` - URL of roast API (optional, defaults to production)

### Setting up OpenAI API for real roast generation:

1. Get an API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a `.env` file in the project root:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```
3. Run the CLI with real AI: `npm run roast "tu comentario aquí"`

If the OpenAI API fails, the CLI automatically falls back to the mock generator.

### Setting up Twitter Integration:

1. Create a Twitter Developer account at [developer.twitter.com](https://developer.twitter.com)
2. Create a new project and application
3. Configure app permissions to "Read and Write" 
4. Generate OAuth 1.0a tokens (for posting) and Bearer Token (for reading)
5. Add all credentials to `.env` file
6. Run `npm run twitter` to start the bot

## Architecture

- **API Layer**: Express server (`src/index.js`) with REST endpoints
- **Services Layer**: Handles external API communications (OpenAI, Perspective, Twitter)
- **Bot Layer**: Twitter integration (`src/services/twitter.js`) for automated responses
- **CLI Layer**: Command-line tool (`src/cli.js`) for testing
- **Frontend**: Simple web interface (`public/`) for manual testing
- **Config Layer**: Environment-based configuration management
- **Utils Layer**: Shared utilities like logging

## Twitter Bot Features

- **Mention Monitoring**: Automatically detects mentions to your Twitter account
- **Toxicity Filtering**: Uses stub (always true) with skeleton for Perspective API
- **Roast Generation**: Calls your deployed API to generate responses
- **Duplicate Prevention**: Tracks processed tweets in `data/processed_tweets.json`
- **Rate Limiting**: Adds delays between responses to respect API limits
- **Error Handling**: Graceful failure handling and detailed logging