class PerspectiveMock {
  async analyzeToxicity(text) {
    return {
      score: 0.85,
      text: text
    };
  }
}

module.exports = PerspectiveMock;
