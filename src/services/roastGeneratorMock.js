class RoastGeneratorMock {
  generateRoast(text, toxicityScore) {
    const roasts = [
      "Wow, such creativity! Did you copy that from a cereal box?",
      "I've seen more intelligence in a broken calculator.",
      "That comment has the energy of a deflated balloon.",
      "Congratulations! You've achieved peak mediocrity.",
      "I'm impressed by your ability to say so little with so many words.",
      "That's cute. Did your participation trophy help you write that?",
      "Your comment is like a broken pencil... pointless.",
      "I'd explain why that's wrong, but I don't have that many crayons."
    ];
    
    const randomIndex = Math.floor(Math.random() * roasts.length);
    return roasts[randomIndex];
  }
}

module.exports = RoastGeneratorMock;