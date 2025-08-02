// OpenAI service for toxicity detection
// This will handle communication with OpenAI API

class OpenAIService {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async analyzeToxicity(text) {
    // TODO: Implement OpenAI API call for toxicity detection
    throw new Error('Not implemented yet');
  }
}

module.exports = OpenAIService;