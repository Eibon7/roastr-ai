/**
 * Unit tests for Perspective Mock service
 * Tests the mock implementation that returns consistent toxicity scores
 */

const PerspectiveMock = require('../../../src/services/perspectiveMock');

describe('Perspective Mock Service Tests', () => {
    let perspectiveMock;

    beforeEach(() => {
        perspectiveMock = new PerspectiveMock();
    });

    describe('Constructor', () => {
        it('should initialize without parameters', () => {
            const mock = new PerspectiveMock();
            expect(mock).toBeInstanceOf(PerspectiveMock);
        });

        it('should be different from actual Perspective service', () => {
            expect(perspectiveMock).not.toHaveProperty('apiKey');
        });
    });

    describe('analyzeToxicity method', () => {
        it('should return consistent mock score for any text', async () => {
            const result = await perspectiveMock.analyzeToxicity('test text');
            
            expect(result).toEqual({
                score: 0.85,
                text: 'test text'
            });
        });

        it('should return the exact input text in response', async () => {
            const testTexts = [
                'Hello world',
                'This is toxic content',
                'Normal message',
                'Test with émojis 🔥',
                '',
                'Very long text that might be processed differently'
            ];

            for (const text of testTexts) {
                const result = await perspectiveMock.analyzeToxicity(text);
                expect(result.text).toBe(text);
                expect(result.score).toBe(0.85);
            }
        });

        it('should always return score of 0.85', async () => {
            const testCases = [
                'innocent text',
                'potentially harmful content',
                'neutral comment',
                'very toxic stuff',
                'borderline content'
            ];

            for (const text of testCases) {
                const result = await perspectiveMock.analyzeToxicity(text);
                expect(result.score).toBe(0.85);
            }
        });

        it('should handle edge case inputs', async () => {
            const edgeCases = [
                '',
                ' ',
                '\n\t',
                null,
                undefined,
                0,
                false,
                {},
                []
            ];

            for (const input of edgeCases) {
                const result = await perspectiveMock.analyzeToxicity(input);
                expect(result.score).toBe(0.85);
                expect(result.text).toBe(input);
            }
        });
    });

    describe('Response structure', () => {
        it('should return object with score and text properties', async () => {
            const result = await perspectiveMock.analyzeToxicity('test');
            
            expect(typeof result).toBe('object');
            expect(result).toHaveProperty('score');
            expect(result).toHaveProperty('text');
            expect(Object.keys(result)).toEqual(['score', 'text']);
        });

        it('should return score as number', async () => {
            const result = await perspectiveMock.analyzeToxicity('test');
            expect(typeof result.score).toBe('number');
        });

        it('should preserve text type and value', async () => {
            const stringResult = await perspectiveMock.analyzeToxicity('string');
            expect(typeof stringResult.text).toBe('string');
            expect(stringResult.text).toBe('string');

            const numberResult = await perspectiveMock.analyzeToxicity(123);
            expect(typeof numberResult.text).toBe('number');
            expect(numberResult.text).toBe(123);

            const objectResult = await perspectiveMock.analyzeToxicity({ key: 'value' });
            expect(typeof objectResult.text).toBe('object');
            expect(objectResult.text).toEqual({ key: 'value' });
        });
    });

    describe('Asynchronous behavior', () => {
        it('should return a Promise', () => {
            const result = perspectiveMock.analyzeToxicity('test');
            expect(result).toBeInstanceOf(Promise);
        });

        it('should resolve immediately', async () => {
            const startTime = Date.now();
            await perspectiveMock.analyzeToxicity('test');
            const endTime = Date.now();
            
            // Should resolve very quickly (under 50ms)
            expect(endTime - startTime).toBeLessThan(50);
        });

        it('should handle concurrent calls', async () => {
            const promises = [
                perspectiveMock.analyzeToxicity('text1'),
                perspectiveMock.analyzeToxicity('text2'),
                perspectiveMock.analyzeToxicity('text3'),
                perspectiveMock.analyzeToxicity('text4'),
                perspectiveMock.analyzeToxicity('text5')
            ];

            const results = await Promise.all(promises);
            
            expect(results).toHaveLength(5);
            results.forEach((result, index) => {
                expect(result.score).toBe(0.85);
                expect(result.text).toBe(`text${index + 1}`);
            });
        });
    });

    describe('Performance and reliability', () => {
        it('should handle rapid successive calls', async () => {
            const calls = [];
            for (let i = 0; i < 100; i++) {
                calls.push(perspectiveMock.analyzeToxicity(`test-${i}`));
            }

            const results = await Promise.all(calls);
            
            expect(results).toHaveLength(100);
            results.forEach((result, index) => {
                expect(result.score).toBe(0.85);
                expect(result.text).toBe(`test-${index}`);
            });
        });

        it('should not maintain state between calls', async () => {
            await perspectiveMock.analyzeToxicity('first call');
            const secondResult = await perspectiveMock.analyzeToxicity('second call');
            
            expect(secondResult.text).toBe('second call');
            expect(secondResult.score).toBe(0.85);
        });

        it('should handle very long text inputs', async () => {
            const longText = 'a'.repeat(10000);
            const result = await perspectiveMock.analyzeToxicity(longText);
            
            expect(result.text).toBe(longText);
            expect(result.score).toBe(0.85);
        });
    });

    describe('Multiple instance behavior', () => {
        it('should work consistently across different instances', async () => {
            const mock1 = new PerspectiveMock();
            const mock2 = new PerspectiveMock();
            const mock3 = new PerspectiveMock();

            const result1 = await mock1.analyzeToxicity('test');
            const result2 = await mock2.analyzeToxicity('test');
            const result3 = await mock3.analyzeToxicity('test');

            expect(result1).toEqual({ score: 0.85, text: 'test' });
            expect(result2).toEqual({ score: 0.85, text: 'test' });
            expect(result3).toEqual({ score: 0.85, text: 'test' });
        });

        it('should handle different inputs on different instances', async () => {
            const mock1 = new PerspectiveMock();
            const mock2 = new PerspectiveMock();

            const result1 = await mock1.analyzeToxicity('input1');
            const result2 = await mock2.analyzeToxicity('input2');

            expect(result1.text).toBe('input1');
            expect(result2.text).toBe('input2');
            expect(result1.score).toBe(0.85);
            expect(result2.score).toBe(0.85);
        });
    });

    describe('Error scenarios', () => {
        it('should not throw errors for any input', async () => {
            const problematicInputs = [
                null,
                undefined,
                {},
                [],
                function() {},
                Symbol('test'),
                new Date(),
                /regex/
            ];

            for (const input of problematicInputs) {
                await expect(perspectiveMock.analyzeToxicity(input))
                    .resolves
                    .toEqual({ score: 0.85, text: input });
            }
        });

        it('should handle circular references gracefully', async () => {
            const circularObj = { prop: 'value' };
            circularObj.self = circularObj;

            const result = await perspectiveMock.analyzeToxicity(circularObj);
            expect(result.score).toBe(0.85);
            expect(result.text).toBe(circularObj);
        });
    });

    describe('Mock service characteristics', () => {
        it('should be deterministic', async () => {
            const text = 'consistent test text';
            const results = [];
            
            for (let i = 0; i < 10; i++) {
                const result = await perspectiveMock.analyzeToxicity(text);
                results.push(result);
            }
            
            results.forEach(result => {
                expect(result).toEqual({ score: 0.85, text: text });
            });
        });

        it('should not require API key or configuration', () => {
            const mock = new PerspectiveMock();
            expect(mock).not.toHaveProperty('apiKey');
            expect(mock).not.toHaveProperty('config');
            expect(mock).not.toHaveProperty('baseUrl');
        });

        it('should simulate moderate toxicity score', async () => {
            // 0.85 is a high toxicity score in most systems (0-1 scale)
            const result = await perspectiveMock.analyzeToxicity('any text');
            expect(result.score).toBeGreaterThan(0.5); // Moderate to high
            expect(result.score).toBeLessThan(1.0); // But not maximum
        });
    });
});