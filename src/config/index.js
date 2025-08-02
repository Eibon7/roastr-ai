// Configuration management for Roastr.ai

const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-3.5-turbo',
  },
  perspective: {
    apiKey: process.env.PERSPECTIVE_API_KEY || '',
  },
  toxicity: {
    threshold: 0.7, // Toxicity threshold (0-1)
  },
};

module.exports = config;