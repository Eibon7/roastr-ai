/**
 * Mock completo para twitter-api-v2
 * Simula todas las funciones necesarias para tests
 */

class MockTwitterApi {
  constructor(credentials) {
    this.credentials = credentials;

    // Mock v2 API
    this.v2 = {
      me: jest.fn().mockResolvedValue({
        data: {
          id: '123456789',
          username: 'testbot',
          name: 'Test Bot'
        }
      }),

      reply: jest.fn().mockResolvedValue({
        data: {
          id: 'reply_123',
          text: 'Mock reply text'
        }
      }),

      tweet: jest.fn().mockResolvedValue({
        data: {
          id: 'tweet_123',
          text: 'Mock tweet text'
        }
      }),

      userMentionTimeline: jest.fn().mockResolvedValue({
        data: [],
        meta: {
          result_count: 0
        }
      }),

      streamRules: jest.fn().mockResolvedValue({
        data: []
      }),

      updateStreamRules: jest.fn().mockResolvedValue({
        data: []
      }),

      searchStream: jest.fn().mockReturnValue({
        on: jest.fn(),
        close: jest.fn()
      })
    };
  }
}

// Mock de enums y constantes
const ETwitterStreamEvent = {
  Connected: 'connected',
  Data: 'data',
  DataError: 'data_error',
  ConnectionError: 'connection_error'
};

module.exports = {
  TwitterApi: MockTwitterApi,
  ETwitterStreamEvent
};
