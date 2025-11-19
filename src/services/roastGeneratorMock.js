/**
 * Mock roast generator for development and testing
 * Provides realistic roast responses without calling external APIs
 */

const { logger } = require('../utils/logger');

class RoastGeneratorMock {
    constructor() {
        this.roastTemplates = {
            sarcastic: [
                "Oh wow, {text}? That's absolutely groundbreaking. I'm sure nobody has ever thought of that before.",
                "Congratulations on {text}! You've truly mastered the art of stating the obvious.",
                "Let me guess, {text}? How refreshingly original of you.",
                "{text}? Well, aren't you just a regular Einstein.",
                "I'm genuinely impressed by {text}. Said no one ever."
            ],
            witty: [
                "So {text}? That's like bringing a spoon to a knife fight.",
                "{text}? I've seen more creativity in a tax form.",
                "Ah yes, {text}. Because that's exactly what the world was missing.",
                "{text}? That's cute. Do you have any actual ideas?",
                "Let me process {text}... Error 404: Logic not found."
            ],
            clever: [
                "{text}? That's like trying to solve a Rubik's cube with your feet.",
                "I see you went with {text}. Bold strategy, Cotton. Let's see if it pays off.",
                "{text}? That's the kind of thinking that got us pineapple on pizza.",
                "So {text}? I admire your commitment to mediocrity.",
                "{text}? That's like using a chocolate teapot - technically possible, but why?"
            ],
            playful: [
                "Aww, {text}? That's adorable! Like a puppy trying to do calculus.",
                "{text}? Bless your heart, you're really trying, aren't you?",
                "Oh sweetie, {text}? That's... that's something alright!",
                "{text}? Well, someone's feeling ambitious today!",
                "Look at you with {text}! Participation trophy incoming!"
            ],
            savage: [
                "{text}? That's the worst idea since someone thought 'let's make a sequel to The Matrix.'",
                "I've heard better ideas from a Magic 8-Ball having an existential crisis than {text}.",
                "{text}? That's like asking a fish for dating advice.",
                "Congratulations, {text} just broke my faith in humanity.",
                "{text}? I didn't know it was possible to be wrong in so many dimensions."
            ]
        };

        this.intensityModifiers = {
            1: { prefix: "Gently speaking, ", suffix: " (but hey, we've all been there!)" },
            2: { prefix: "Well, ", suffix: " Just saying." },
            3: { prefix: "", suffix: "" },
            4: { prefix: "Listen here, ", suffix: " And that's the tea." },
            5: { prefix: "Buckle up buttercup, ", suffix: " Mic drop." }
        };

        // Issue #868: humorTypeModifiers removed (humor_type eliminated)
        this.humorTypeModifiers = {
            // Deprecated - will be removed
            playful: " *giggles*",
            observational: " *takes notes for comedy special*"
        };

        logger.info('🎭 Mock roast generator initialized');
    }

    /**
     * Generate a mock roast
     */
    async generateRoast(text, toxicityScore = 0.1, tone = 'sarcastic', config = {}) {
        // Simulate API delay
        await this.simulateDelay();

        const selectedTone = this.validateTone(tone);
        // Issue #868: intensity_level removed (redundante con tone)

        // Get base roast template
        const templates = this.roastTemplates[selectedTone];
        const template = templates[Math.floor(Math.random() * templates.length)];

        // Replace placeholder with sanitized text
        const sanitizedText = this.sanitizeText(text);
        let roast = template.replace('{text}', `"${sanitizedText}"`);

        // Issue #868: intensity modifiers removed (redundante con tone)

        // Issue #868: humor type modifier removed

        // Add some randomness based on toxicity score
        if (toxicityScore > 0.5) {
            roast += " (Wow, someone's feeling spicy today!)";
        }

        logger.info('Mock roast generated', {
            tone: selectedTone,
            // intensity removed (Issue #868)
            // humorType removed (Issue #868)
            toxicityScore,
            textLength: text.length,
            roastLength: roast.length
        });

        return {
            roast,
            metadata: {
                tone: selectedTone,
                // intensity removed (Issue #868)
                // humorType removed (Issue #868)
                toxicityScore,
                mock: true,
                generatedAt: new Date().toISOString()
            }
        };
    }

    /**
     * Generate roast with custom prompt (for compatibility)
     */
    async generateRoastWithPrompt(text, customPrompt) {
        // Extract tone from prompt if possible
        let tone = 'sarcastic';
        if (customPrompt.includes('witty')) tone = 'witty';
        else if (customPrompt.includes('clever')) tone = 'clever';
        else if (customPrompt.includes('playful')) tone = 'playful';
        else if (customPrompt.includes('savage')) tone = 'savage';

        return this.generateRoast(text, 0.1, tone);
    }

    /**
     * Validate and normalize tone
     */
    validateTone(tone) {
        const validTones = Object.keys(this.roastTemplates);
        return validTones.includes(tone) ? tone : 'sarcastic';
    }

    /**
     * Sanitize text for safe inclusion in roast
     */
    sanitizeText(text) {
        if (!text || typeof text !== 'string') {
            return 'that thing you said';
        }

        // Truncate long text
        let sanitized = text.length > 50 ? text.substring(0, 47) + '...' : text;

        // Remove potentially problematic characters
        sanitized = sanitized.replace(/[<>]/g, '');

        // If text is too short or just whitespace, use generic placeholder
        if (sanitized.trim().length < 3) {
            return 'that brilliant observation';
        }

        return sanitized.trim();
    }

    /**
     * Simulate realistic API delay
     */
    async simulateDelay() {
        // Random delay between 200-800ms to simulate real API
        const delay = Math.random() * 600 + 200;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Get available tones
     */
    getAvailableTones() {
        return Object.keys(this.roastTemplates);
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            type: 'mock',
            ready: true,
            availableTones: this.getAvailableTones(),
            templateCount: Object.values(this.roastTemplates).reduce((sum, templates) => sum + templates.length, 0)
        };
    }

    /**
     * Estimate token count for text (Issue #483)
     * Simple estimation: ~4 characters per token
     */
    estimateTokens(text) {
        if (!text || typeof text !== 'string') {
            return 0;
        }
        return Math.ceil(text.length / 4);
    }
}

module.exports = RoastGeneratorMock;