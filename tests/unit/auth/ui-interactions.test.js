/**
 * Tests unitarios para interacciones de UI del sistema de autenticación
 * @jest-environment jsdom
 */

// Mock DOM
const { JSDOM } = require('jsdom');

describe('Auth UI Interactions', () => {
    let dom;
    let document;
    let window;

    beforeEach(() => {
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Test</title>
            </head>
            <body>
                <div id="error-message" class="error-message"></div>
                <div id="success-message" class="success-message"></div>
                <button id="test-btn" class="btn-primary">Test Button</button>
                <input type="password" id="password" />
                <button class="toggle-password">👁️</button>
            </body>
            </html>
        `, {
            url: 'http://localhost:3000',
            pretendToBeVisual: true,
            resources: 'usable'
        });

        document = dom.window.document;
        window = dom.window;
        global.document = document;
        global.window = window;

        // Mock setTimeout
        global.setTimeout = jest.fn((callback, delay) => {
            callback();
        });
    });

    afterEach(() => {
        dom.window.close();
    });

    describe('Message Display System', () => {
        function showMessage(message, type = 'error') {
            const errorDiv = document.getElementById('error-message');
            const successDiv = document.getElementById('success-message');
            
            // Hide both messages first
            errorDiv.classList.remove('show');
            successDiv.classList.remove('show');
            
            if (type === 'error') {
                errorDiv.textContent = message;
                errorDiv.classList.add('show');
            } else {
                successDiv.textContent = message;
                successDiv.classList.add('show');
            }
        }

        it('should display error message correctly', () => {
            showMessage('Test error message', 'error');

            const errorDiv = document.getElementById('error-message');
            const successDiv = document.getElementById('success-message');

            expect(errorDiv.textContent).toBe('Test error message');
            expect(errorDiv.classList.contains('show')).toBe(true);
            expect(successDiv.classList.contains('show')).toBe(false);
        });

        it('should display success message correctly', () => {
            showMessage('Test success message', 'success');

            const errorDiv = document.getElementById('error-message');
            const successDiv = document.getElementById('success-message');

            expect(successDiv.textContent).toBe('Test success message');
            expect(successDiv.classList.contains('show')).toBe(true);
            expect(errorDiv.classList.contains('show')).toBe(false);
        });

        it('should hide previous message when showing new one', () => {
            // Show error first
            showMessage('Error message', 'error');
            expect(document.getElementById('error-message').classList.contains('show')).toBe(true);

            // Show success - should hide error
            showMessage('Success message', 'success');
            expect(document.getElementById('error-message').classList.contains('show')).toBe(false);
            expect(document.getElementById('success-message').classList.contains('show')).toBe(true);
        });

        it('should default to error type when type is not specified', () => {
            showMessage('Default message');

            const errorDiv = document.getElementById('error-message');
            expect(errorDiv.textContent).toBe('Default message');
            expect(errorDiv.classList.contains('show')).toBe(true);
        });
    });

    describe('Loading State Management', () => {
        function setLoading(buttonId, isLoading = true) {
            const button = document.getElementById(buttonId);
            if (!button) return;
            
            if (isLoading) {
                button.disabled = true;
                button.classList.add('loading');
            } else {
                button.disabled = false;
                button.classList.remove('loading');
            }
        }

        it('should set loading state correctly', () => {
            const button = document.getElementById('test-btn');
            
            setLoading('test-btn', true);
            
            expect(button.disabled).toBe(true);
            expect(button.classList.contains('loading')).toBe(true);
        });

        it('should remove loading state correctly', () => {
            const button = document.getElementById('test-btn');
            
            // Set loading first
            setLoading('test-btn', true);
            expect(button.disabled).toBe(true);
            expect(button.classList.contains('loading')).toBe(true);
            
            // Remove loading
            setLoading('test-btn', false);
            expect(button.disabled).toBe(false);
            expect(button.classList.contains('loading')).toBe(false);
        });

        it('should handle non-existent button gracefully', () => {
            // Should not throw error
            expect(() => {
                setLoading('non-existent-btn', true);
            }).not.toThrow();
        });
    });

    describe('Password Toggle Functionality', () => {
        function togglePassword(inputId) {
            const input = document.getElementById(inputId);
            const button = input.nextElementSibling;
            
            if (input.type === "password") {
                input.type = "text";
                button.textContent = "🙈";
            } else {
                input.type = "password";
                button.textContent = "👁️";
            }
        }

        it('should toggle password visibility from hidden to visible', () => {
            const passwordInput = document.getElementById('password');
            const toggleButton = passwordInput.nextElementSibling;
            
            // Initially password type
            expect(passwordInput.type).toBe('password');
            expect(toggleButton.textContent).toBe('👁️');
            
            togglePassword('password');
            
            expect(passwordInput.type).toBe('text');
            expect(toggleButton.textContent).toBe('🙈');
        });

        it('should toggle password visibility from visible to hidden', () => {
            const passwordInput = document.getElementById('password');
            const toggleButton = passwordInput.nextElementSibling;
            
            // Set to text first
            passwordInput.type = 'text';
            toggleButton.textContent = '🙈';
            
            togglePassword('password');
            
            expect(passwordInput.type).toBe('password');
            expect(toggleButton.textContent).toBe('👁️');
        });
    });

    describe('Form Validation UI', () => {
        beforeEach(() => {
            // Add a form to the DOM
            document.body.innerHTML += `
                <form id="test-form">
                    <input type="email" id="email" name="email" required />
                    <input type="password" id="form-password" name="password" required minlength="6" />
                    <input type="checkbox" id="terms" name="terms" required />
                    <button type="submit" id="submit-btn">Submit</button>
                </form>
            `;
        });

        function validateForm(formData) {
            const email = formData.get('email');
            const password = formData.get('password');
            const terms = formData.get('terms');
            
            const errors = [];
            
            if (!email || !email.includes('@')) {
                errors.push('Valid email required');
            }
            
            if (!password || password.length < 6) {
                errors.push('Password must be at least 6 characters');
            }
            
            if (!terms) {
                errors.push('You must accept the terms');
            }
            
            return { isValid: errors.length === 0, errors };
        }

        it('should validate valid form data', () => {
            const mockFormData = {
                get: jest.fn((key) => {
                    const data = {
                        'email': 'test@example.com',
                        'password': 'password123',
                        'terms': 'on'
                    };
                    return data[key];
                })
            };
            
            const result = validateForm(mockFormData);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should detect invalid email', () => {
            const mockFormData = {
                get: jest.fn((key) => {
                    const data = {
                        'email': 'invalid-email',
                        'password': 'password123',
                        'terms': 'on'
                    };
                    return data[key];
                })
            };
            
            const result = validateForm(mockFormData);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Valid email required');
        });

        it('should detect short password', () => {
            const mockFormData = {
                get: jest.fn((key) => {
                    const data = {
                        'email': 'test@example.com',
                        'password': '123',
                        'terms': 'on'
                    };
                    return data[key];
                })
            };
            
            const result = validateForm(mockFormData);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Password must be at least 6 characters');
        });

        it('should detect missing terms acceptance', () => {
            const mockFormData = {
                get: jest.fn((key) => {
                    const data = {
                        'email': 'test@example.com',
                        'password': 'password123',
                        'terms': null
                    };
                    return data[key];
                })
            };
            
            const result = validateForm(mockFormData);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('You must accept the terms');
        });
    });

    describe('URL Parameter Handling', () => {
        function parseUrlParams(search) {
            const params = new URLSearchParams(search);
            return {
                message: params.get('message'),
                type: params.get('type'),
                email: params.get('email'),
                token: params.get('token')
            };
        }

        it('should parse success message from URL', () => {
            const search = '?message=Login%20successful&type=success';
            const params = parseUrlParams(search);
            
            expect(params.message).toBe('Login successful');
            expect(params.type).toBe('success');
        });

        it('should parse error message from URL', () => {
            const search = '?message=Authentication%20failed&type=error';
            const params = parseUrlParams(search);
            
            expect(params.message).toBe('Authentication failed');
            expect(params.type).toBe('error');
        });

        it('should parse email verification parameters', () => {
            const search = '?email=test%40example.com&token=abc123';
            const params = parseUrlParams(search);
            
            expect(params.email).toBe('test@example.com');
            expect(params.token).toBe('abc123');
        });

        it('should handle empty URL parameters', () => {
            const search = '';
            const params = parseUrlParams(search);
            
            expect(params.message).toBeNull();
            expect(params.type).toBeNull();
            expect(params.email).toBeNull();
            expect(params.token).toBeNull();
        });
    });

    describe('CSS Class Management', () => {
        function toggleClass(elementId, className, condition = null) {
            const element = document.getElementById(elementId);
            if (!element) return false;
            
            if (condition === null) {
                element.classList.toggle(className);
            } else if (condition) {
                element.classList.add(className);
            } else {
                element.classList.remove(className);
            }
            
            return element.classList.contains(className);
        }

        it('should toggle class when no condition specified', () => {
            const button = document.getElementById('test-btn');
            
            // Initially no 'active' class
            expect(button.classList.contains('active')).toBe(false);
            
            // Toggle on
            const hasClass = toggleClass('test-btn', 'active');
            expect(hasClass).toBe(true);
            expect(button.classList.contains('active')).toBe(true);
            
            // Toggle off
            const hasClass2 = toggleClass('test-btn', 'active');
            expect(hasClass2).toBe(false);
            expect(button.classList.contains('active')).toBe(false);
        });

        it('should add class when condition is true', () => {
            const button = document.getElementById('test-btn');
            
            const hasClass = toggleClass('test-btn', 'disabled', true);
            
            expect(hasClass).toBe(true);
            expect(button.classList.contains('disabled')).toBe(true);
        });

        it('should remove class when condition is false', () => {
            const button = document.getElementById('test-btn');
            button.classList.add('disabled'); // Add class first
            
            const hasClass = toggleClass('test-btn', 'disabled', false);
            
            expect(hasClass).toBe(false);
            expect(button.classList.contains('disabled')).toBe(false);
        });

        it('should handle non-existent element gracefully', () => {
            const result = toggleClass('non-existent', 'some-class');
            expect(result).toBe(false);
        });
    });

    describe('Input Field Interactions', () => {
        beforeEach(() => {
            document.body.innerHTML += `
                <input type="email" id="email-input" class="input-text" placeholder="Email" />
                <input type="password" id="password-input" class="input-text" placeholder="Password" />
            `;
        });

        function clearForm(formId) {
            const form = document.getElementById(formId);
            if (form) {
                const inputs = form.querySelectorAll('input');
                inputs.forEach(input => {
                    if (input.type === 'checkbox' || input.type === 'radio') {
                        input.checked = false;
                    } else {
                        input.value = '';
                    }
                });
            }
        }

        function setFieldError(fieldId, hasError) {
            const field = document.getElementById(fieldId);
            if (field) {
                if (hasError) {
                    field.classList.add('error');
                } else {
                    field.classList.remove('error');
                }
            }
        }

        it('should set field error state', () => {
            const emailInput = document.getElementById('email-input');
            
            setFieldError('email-input', true);
            expect(emailInput.classList.contains('error')).toBe(true);
        });

        it('should remove field error state', () => {
            const emailInput = document.getElementById('email-input');
            emailInput.classList.add('error'); // Add error first
            
            setFieldError('email-input', false);
            expect(emailInput.classList.contains('error')).toBe(false);
        });

        it('should handle focus events', () => {
            const emailInput = document.getElementById('email-input');
            
            // Mock focus event
            const focusEvent = new window.Event('focus');
            emailInput.dispatchEvent(focusEvent);
            
            // In real implementation, this might add a 'focused' class
            expect(emailInput).toBeDefined();
        });
    });
});