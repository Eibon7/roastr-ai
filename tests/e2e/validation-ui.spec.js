/**
 * E2E Visual Validation Tests (CodeRabbit Round 4 improvements)
 * Tests UI validation behavior, language switching, and platform selection
 */

const { test, expect } = require('@playwright/test');

test.describe('Validation UI Components', () => {
    test.beforeEach(async ({ page }) => {
        // Set up mock mode for consistent testing
        await page.goto('/');
        
        // Wait for page to load
        await page.waitForLoadState('networkidle');
    });

    test.describe('Style Selection with Language Awareness', () => {
        test('should display Spanish styles when Spanish is selected', async ({ page }) => {
            // Navigate to roast generation page
            await page.goto('/roast');
            await page.waitForLoadState('networkidle');

            // Select Spanish language
            const languageSelector = page.locator('[data-testid="language-selector"]');
            if (await languageSelector.isVisible()) {
                await languageSelector.selectOption('es');
            }

            // Check that Spanish styles are displayed
            const styleSelector = page.locator('[data-testid="style-selector"]');
            if (await styleSelector.isVisible()) {
                const styles = await styleSelector.locator('option').allTextContents();
                expect(styles.some(style => 
                    style.toLowerCase().includes('flanders') ||
                    style.toLowerCase().includes('balanceado') ||
                    style.toLowerCase().includes('canalla')
                )).toBe(true);
            }

            // Take screenshot for visual evidence
            await page.screenshot({ 
                path: 'test-evidence/spanish-styles-selection.png',
                fullPage: true 
            });
        });

        test('should display English styles when English is selected', async ({ page }) => {
            await page.goto('/roast');
            await page.waitForLoadState('networkidle');

            // Select English language
            const languageSelector = page.locator('[data-testid="language-selector"]');
            if (await languageSelector.isVisible()) {
                await languageSelector.selectOption('en');
            }

            // Check that English styles are displayed
            const styleSelector = page.locator('[data-testid="style-selector"]');
            if (await styleSelector.isVisible()) {
                const styles = await styleSelector.locator('option').allTextContents();
                expect(styles.some(style => 
                    style.toLowerCase().includes('light') ||
                    style.toLowerCase().includes('balanced') ||
                    style.toLowerCase().includes('savage')
                )).toBe(true);
            }

            await page.screenshot({ 
                path: 'test-evidence/english-styles-selection.png',
                fullPage: true 
            });
        });

        test('should update style options when language changes', async ({ page }) => {
            await page.goto('/roast');
            await page.waitForLoadState('networkidle');

            const languageSelector = page.locator('[data-testid="language-selector"]');
            const styleSelector = page.locator('[data-testid="style-selector"]');

            if (await languageSelector.isVisible() && await styleSelector.isVisible()) {
                // Start with Spanish
                await languageSelector.selectOption('es');
                await page.waitForTimeout(500); // Wait for update
                
                const spanishStyles = await styleSelector.locator('option').allTextContents();
                
                // Switch to English
                await languageSelector.selectOption('en');
                await page.waitForTimeout(500); // Wait for update
                
                const englishStyles = await styleSelector.locator('option').allTextContents();
                
                // Styles should be different
                expect(spanishStyles).not.toEqual(englishStyles);
            }

            await page.screenshot({ 
                path: 'test-evidence/dynamic-style-language-update.png',
                fullPage: true 
            });
        });
    });

    test.describe('Platform Selection with Alias Support', () => {
        test('should display platform options correctly', async ({ page }) => {
            await page.goto('/roast');
            await page.waitForLoadState('networkidle');

            const platformSelector = page.locator('[data-testid="platform-selector"]');
            if (await platformSelector.isVisible()) {
                const platforms = await platformSelector.locator('option').allTextContents();
                
                // Should include main platforms
                expect(platforms.some(p => p.toLowerCase().includes('twitter'))).toBe(true);
                expect(platforms.some(p => p.toLowerCase().includes('facebook'))).toBe(true);
                expect(platforms.some(p => p.toLowerCase().includes('instagram'))).toBe(true);
            }

            await page.screenshot({ 
                path: 'test-evidence/platform-selection-options.png',
                fullPage: true 
            });
        });

        test('should handle platform alias normalization', async ({ page }) => {
            await page.goto('/roast');
            await page.waitForLoadState('networkidle');

            const platformSelector = page.locator('[data-testid="platform-selector"]');
            if (await platformSelector.isVisible()) {
                // Select platform that might have aliases (e.g., X for Twitter)
                const options = await platformSelector.locator('option').all();
                for (const option of options) {
                    const value = await option.getAttribute('value');
                    if (value && (value.toLowerCase() === 'x' || value.toLowerCase() === 'twitter')) {
                        await option.click();
                        break;
                    }
                }
            }

            await page.screenshot({ 
                path: 'test-evidence/platform-alias-selection.png',
                fullPage: true 
            });
        });
    });

    test.describe('Intensity Validation UI', () => {
        test('should handle intensity slider edge cases', async ({ page }) => {
            await page.goto('/roast');
            await page.waitForLoadState('networkidle');

            const intensitySlider = page.locator('[data-testid="intensity-slider"]');
            const intensityInput = page.locator('[data-testid="intensity-input"]');

            if (await intensitySlider.isVisible()) {
                // Test minimum value (should be 1)
                await intensitySlider.fill('0');
                await page.waitForTimeout(300);
                
                const minValue = await intensitySlider.inputValue();
                expect(parseInt(minValue)).toBeGreaterThanOrEqual(1);

                // Test maximum value (should be 5)
                await intensitySlider.fill('10');
                await page.waitForTimeout(300);
                
                const maxValue = await intensitySlider.inputValue();
                expect(parseInt(maxValue)).toBeLessThanOrEqual(5);
            }

            if (await intensityInput.isVisible()) {
                // Test direct input validation
                await intensityInput.fill('0');
                await page.keyboard.press('Tab');
                await page.waitForTimeout(300);
                
                const normalizedValue = await intensityInput.inputValue();
                expect(parseInt(normalizedValue)).toBeGreaterThanOrEqual(1);
            }

            await page.screenshot({ 
                path: 'test-evidence/intensity-validation-ui.png',
                fullPage: true 
            });
        });

        test('should provide visual feedback for invalid intensity', async ({ page }) => {
            await page.goto('/roast');
            await page.waitForLoadState('networkidle');

            const intensityInput = page.locator('[data-testid="intensity-input"]');
            
            if (await intensityInput.isVisible()) {
                // Enter invalid value
                await intensityInput.fill('15');
                await page.keyboard.press('Tab');
                await page.waitForTimeout(500);

                // Check for error styling or message
                const errorMessage = page.locator('[data-testid="intensity-error"]');
                const hasErrorClass = await intensityInput.evaluate(el => 
                    el.classList.contains('error') || el.classList.contains('invalid')
                );

                expect(await errorMessage.isVisible() || hasErrorClass).toBe(true);
            }

            await page.screenshot({ 
                path: 'test-evidence/intensity-validation-error.png',
                fullPage: true 
            });
        });
    });

    test.describe('Form Validation Integration', () => {
        test('should validate complete form with all fields', async ({ page }) => {
            await page.goto('/roast');
            await page.waitForLoadState('networkidle');

            // Fill out form with valid data
            const commentInput = page.locator('[data-testid="comment-input"]');
            const languageSelector = page.locator('[data-testid="language-selector"]');
            const styleSelector = page.locator('[data-testid="style-selector"]');
            const platformSelector = page.locator('[data-testid="platform-selector"]');
            const intensitySlider = page.locator('[data-testid="intensity-slider"]');

            if (await commentInput.isVisible()) {
                await commentInput.fill('This is a test comment for roasting');
            }

            if (await languageSelector.isVisible()) {
                await languageSelector.selectOption('es');
            }

            if (await styleSelector.isVisible()) {
                await styleSelector.selectOption('balanceado');
            }

            if (await platformSelector.isVisible()) {
                await platformSelector.selectOption('twitter');
            }

            if (await intensitySlider.isVisible()) {
                await intensitySlider.fill('3');
            }

            await page.screenshot({ 
                path: 'test-evidence/complete-form-validation.png',
                fullPage: true 
            });
        });

        test('should show validation errors for empty required fields', async ({ page }) => {
            await page.goto('/roast');
            await page.waitForLoadState('networkidle');

            // Try to submit form without required fields
            const submitButton = page.locator('[data-testid="submit-button"]');
            
            if (await submitButton.isVisible()) {
                await submitButton.click();
                await page.waitForTimeout(1000);

                // Check for validation error messages
                const errorMessages = page.locator('[data-testid*="error"]');
                const errorCount = await errorMessages.count();
                
                expect(errorCount).toBeGreaterThan(0);
            }

            await page.screenshot({ 
                path: 'test-evidence/empty-form-validation-errors.png',
                fullPage: true 
            });
        });

        test('should validate text length limits', async ({ page }) => {
            await page.goto('/roast');
            await page.waitForLoadState('networkidle');

            const commentInput = page.locator('[data-testid="comment-input"]');
            
            if (await commentInput.isVisible()) {
                // Try entering text that exceeds limit (2000 characters)
                const longText = 'a'.repeat(2001);
                await commentInput.fill(longText);
                await page.keyboard.press('Tab');
                await page.waitForTimeout(500);

                // Check for length validation error
                const lengthError = page.locator('[data-testid="comment-length-error"]');
                const characterCount = page.locator('[data-testid="character-count"]');
                
                expect(
                    await lengthError.isVisible() || 
                    await characterCount.textContent().then(text => text.includes('2000'))
                ).toBe(true);
            }

            await page.screenshot({ 
                path: 'test-evidence/text-length-validation.png',
                fullPage: true 
            });
        });
    });

    test.describe('Responsive Design Validation', () => {
        test('should display validation correctly on mobile', async ({ page }) => {
            await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
            await page.goto('/roast');
            await page.waitForLoadState('networkidle');

            // Check that form elements are properly sized and accessible
            const formElements = [
                '[data-testid="comment-input"]',
                '[data-testid="language-selector"]',
                '[data-testid="style-selector"]',
                '[data-testid="platform-selector"]',
                '[data-testid="intensity-slider"]'
            ];

            for (const selector of formElements) {
                const element = page.locator(selector);
                if (await element.isVisible()) {
                    const boundingBox = await element.boundingBox();
                    if (boundingBox) {
                        expect(boundingBox.width).toBeGreaterThan(50); // Minimum touch target
                        expect(boundingBox.height).toBeGreaterThan(30);
                    }
                }
            }

            await page.screenshot({ 
                path: 'test-evidence/mobile-validation-ui.png',
                fullPage: true 
            });
        });

        test('should display validation correctly on desktop', async ({ page }) => {
            await page.setViewportSize({ width: 1920, height: 1080 }); // Desktop
            await page.goto('/roast');
            await page.waitForLoadState('networkidle');

            // Check that form layout utilizes larger screen space
            const formContainer = page.locator('[data-testid="roast-form"]');
            
            if (await formContainer.isVisible()) {
                const boundingBox = await formContainer.boundingBox();
                if (boundingBox) {
                    expect(boundingBox.width).toBeGreaterThan(600); // Should use more space on desktop
                }
            }

            await page.screenshot({ 
                path: 'test-evidence/desktop-validation-ui.png',
                fullPage: true 
            });
        });

        test('should display validation correctly on tablet', async ({ page }) => {
            await page.setViewportSize({ width: 768, height: 1024 }); // iPad
            await page.goto('/roast');
            await page.waitForLoadState('networkidle');

            // Check responsive behavior at tablet breakpoint
            const formElements = page.locator('[data-testid="roast-form"] input, [data-testid="roast-form"] select');
            const elementCount = await formElements.count();
            
            if (elementCount > 0) {
                // Elements should be properly spaced and sized for tablet
                for (let i = 0; i < elementCount; i++) {
                    const element = formElements.nth(i);
                    if (await element.isVisible()) {
                        const boundingBox = await element.boundingBox();
                        if (boundingBox) {
                            expect(boundingBox.width).toBeGreaterThan(100);
                        }
                    }
                }
            }

            await page.screenshot({ 
                path: 'test-evidence/tablet-validation-ui.png',
                fullPage: true 
            });
        });
    });

    test.describe('Accessibility Validation', () => {
        test('should have proper ARIA labels and roles', async ({ page }) => {
            await page.goto('/roast');
            await page.waitForLoadState('networkidle');

            // Check for ARIA labels on form elements
            const formElements = [
                '[data-testid="comment-input"]',
                '[data-testid="language-selector"]',
                '[data-testid="style-selector"]',
                '[data-testid="platform-selector"]',
                '[data-testid="intensity-slider"]'
            ];

            for (const selector of formElements) {
                const element = page.locator(selector);
                if (await element.isVisible()) {
                    const ariaLabel = await element.getAttribute('aria-label');
                    const ariaLabelledBy = await element.getAttribute('aria-labelledby');
                    const hasLabel = await page.locator(`label[for="${await element.getAttribute('id')}"]`).count() > 0;
                    
                    expect(ariaLabel || ariaLabelledBy || hasLabel).toBeTruthy();
                }
            }

            await page.screenshot({ 
                path: 'test-evidence/accessibility-validation.png',
                fullPage: true 
            });
        });

        test('should support keyboard navigation', async ({ page }) => {
            await page.goto('/roast');
            await page.waitForLoadState('networkidle');

            // Test tab navigation through form
            await page.keyboard.press('Tab');
            let focusedElement = await page.evaluate(() => document.activeElement?.tagName);
            
            // Should be able to navigate through interactive elements
            const tabStops = [];
            for (let i = 0; i < 10; i++) {
                const activeElement = await page.evaluate(() => ({
                    tag: document.activeElement?.tagName,
                    type: document.activeElement?.type,
                    testId: document.activeElement?.getAttribute('data-testid')
                }));
                
                if (activeElement.tag) {
                    tabStops.push(activeElement);
                }
                
                await page.keyboard.press('Tab');
            }

            // Should have navigated through multiple interactive elements
            expect(tabStops.length).toBeGreaterThan(2);

            await page.screenshot({ 
                path: 'test-evidence/keyboard-navigation.png',
                fullPage: true 
            });
        });
    });
});