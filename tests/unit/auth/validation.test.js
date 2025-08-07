/**
 * Tests unitarios para validación de campos de autenticación
 */

// DOM mocks are handled by tests/setup.js

describe('Auth System Validation', () => {
    beforeEach(() => {
        // Clear localStorage before each test
        localStorage.clear();
        
        // Reset window.location
        window.location.href = '';
        window.location.search = '';
        
        // Clear any existing timers
        jest.clearAllTimers();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    describe('Email Validation', () => {
        function validateEmail(email) {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(email);
        }

        it('should validate correct email addresses', () => {
            const validEmails = [
                'test@example.com',
                'user.name@domain.co.uk',
                'email+tag@gmail.com',
                'firstname.lastname@company.org'
            ];

            validEmails.forEach(email => {
                expect(validateEmail(email)).toBe(true);
            });
        });

        it('should reject invalid email addresses', () => {
            const invalidEmails = [
                'invalid.email',
                '@domain.com',
                'email@',
                'email@domain',
                'email.domain.com',
                '',
                'spaces in@email.com',
                'multiple@@domain.com'
            ];

            invalidEmails.forEach(email => {
                expect(validateEmail(email)).toBe(false);
            });
        });
    });

    describe('Password Validation', () => {
        function validatePassword(password) {
            return password && password.length >= 6;
        }

        it('should validate passwords with 6 or more characters', () => {
            const validPasswords = [
                'password123',
                '123456',
                'mySecureP@ssw0rd!',
                'abcdef'
            ];

            validPasswords.forEach(password => {
                expect(validatePassword(password)).toBe(true);
            });
        });

        it('should reject passwords with less than 6 characters', () => {
            const invalidPasswords = [
                'pass',
                '12345',
                'abc',
                '',
                'a',
                '     '
            ];

            invalidPasswords.forEach(password => {
                expect(validatePassword(password)).toBe(false);
            });
        });

        it('should reject null or undefined passwords', () => {
            expect(validatePassword(null)).toBe(false);
            expect(validatePassword(undefined)).toBe(false);
        });
    });

    describe('Password Confirmation', () => {
        function validatePasswordMatch(password, confirmPassword) {
            return password === confirmPassword;
        }

        it('should validate matching passwords', () => {
            const testCases = [
                ['password123', 'password123'],
                ['mySecureP@ss', 'mySecureP@ss'],
                ['123456', '123456']
            ];

            testCases.forEach(([password, confirm]) => {
                expect(validatePasswordMatch(password, confirm)).toBe(true);
            });
        });

        it('should reject non-matching passwords', () => {
            const testCases = [
                ['password123', 'password124'],
                ['mySecureP@ss', 'mySecurePass'],
                ['123456', '654321'],
                ['password', ''],
                ['', 'password']
            ];

            testCases.forEach(([password, confirm]) => {
                expect(validatePasswordMatch(password, confirm)).toBe(false);
            });
        });
    });

    describe('Form Data Validation', () => {
        function validateLoginForm(email, password) {
            const errors = [];
            
            if (!email || !email.includes('@')) {
                errors.push('Email válido requerido');
            }
            
            if (!password || password.length < 6) {
                errors.push('Contraseña debe tener al menos 6 caracteres');
            }
            
            return {
                isValid: errors.length === 0,
                errors
            };
        }

        function validateRegistrationForm(email, password, confirmPassword, acceptTerms) {
            const errors = [];
            
            if (!email || !email.includes('@')) {
                errors.push('Email válido requerido');
            }
            
            if (!password || password.length < 6) {
                errors.push('Contraseña debe tener al menos 6 caracteres');
            }
            
            if (password !== confirmPassword) {
                errors.push('Las contraseñas no coinciden');
            }
            
            if (!acceptTerms) {
                errors.push('Debes aceptar los términos y condiciones');
            }
            
            return {
                isValid: errors.length === 0,
                errors
            };
        }

        describe('Login Form Validation', () => {
            it('should validate correct login data', () => {
                const result = validateLoginForm('test@example.com', 'password123');
                expect(result.isValid).toBe(true);
                expect(result.errors).toHaveLength(0);
            });

            it('should reject login with invalid email', () => {
                const result = validateLoginForm('invalid-email', 'password123');
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Email válido requerido');
            });

            it('should reject login with short password', () => {
                const result = validateLoginForm('test@example.com', '123');
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Contraseña debe tener al menos 6 caracteres');
            });

            it('should reject login with missing fields', () => {
                const result = validateLoginForm('', '');
                expect(result.isValid).toBe(false);
                expect(result.errors).toHaveLength(2);
            });
        });

        describe('Registration Form Validation', () => {
            it('should validate correct registration data', () => {
                const result = validateRegistrationForm(
                    'test@example.com', 
                    'password123', 
                    'password123', 
                    true
                );
                expect(result.isValid).toBe(true);
                expect(result.errors).toHaveLength(0);
            });

            it('should reject registration with mismatched passwords', () => {
                const result = validateRegistrationForm(
                    'test@example.com', 
                    'password123', 
                    'password124', 
                    true
                );
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Las contraseñas no coinciden');
            });

            it('should reject registration without accepting terms', () => {
                const result = validateRegistrationForm(
                    'test@example.com', 
                    'password123', 
                    'password123', 
                    false
                );
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Debes aceptar los términos y condiciones');
            });

            it('should reject registration with all invalid data', () => {
                const result = validateRegistrationForm('', '123', '456', false);
                expect(result.isValid).toBe(false);
                expect(result.errors).toHaveLength(4);
            });
        });
    });

    describe('Authentication State Management', () => {
        function isAuthenticated() {
            const token = localStorage.getItem('auth_token');
            const expiresAt = localStorage.getItem('token_expires_at');
            
            if (!token) return false;
            
            if (expiresAt) {
                const now = Date.now() / 1000;
                const expiry = parseInt(expiresAt);
                if (now >= expiry) {
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('refresh_token');
                    localStorage.removeItem('user_data');
                    localStorage.removeItem('token_expires_at');
                    return false;
                }
            }
            
            return true;
        }

        function saveAuthData(data) {
            localStorage.setItem('auth_token', data.access_token);
            localStorage.setItem('refresh_token', data.refresh_token);
            localStorage.setItem('user_data', JSON.stringify(data.user));
            
            if (data.expires_at) {
                localStorage.setItem('token_expires_at', data.expires_at);
            }
        }

        function clearAuthData() {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('user_data');
            localStorage.removeItem('token_expires_at');
        }

        it('should return false when no auth token exists', () => {
            expect(isAuthenticated()).toBe(false);
        });

        it('should return true when valid auth token exists', () => {
            localStorage.setItem('auth_token', 'valid-token');
            expect(isAuthenticated()).toBe(true);
        });

        it('should return false when token is expired', () => {
            const pastTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
            localStorage.setItem('auth_token', 'expired-token');
            localStorage.setItem('token_expires_at', pastTimestamp.toString());
            
            expect(isAuthenticated()).toBe(false);
            expect(localStorage.getItem('auth_token')).toBeNull();
        });

        it('should return true when token is not expired', () => {
            const futureTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
            localStorage.setItem('auth_token', 'valid-token');
            localStorage.setItem('token_expires_at', futureTimestamp.toString());
            
            expect(isAuthenticated()).toBe(true);
        });

        it('should save auth data correctly', () => {
            const authData = {
                access_token: 'test-access-token',
                refresh_token: 'test-refresh-token',
                expires_at: '1234567890',
                user: {
                    id: '123',
                    email: 'test@example.com',
                    is_admin: false
                }
            };

            saveAuthData(authData);

            expect(localStorage.getItem('auth_token')).toBe('test-access-token');
            expect(localStorage.getItem('refresh_token')).toBe('test-refresh-token');
            expect(localStorage.getItem('token_expires_at')).toBe('1234567890');
            expect(JSON.parse(localStorage.getItem('user_data'))).toEqual(authData.user);
        });

        it('should clear auth data correctly', () => {
            // Set some auth data first
            localStorage.setItem('auth_token', 'token');
            localStorage.setItem('refresh_token', 'refresh');
            localStorage.setItem('user_data', '{"id":"123"}');
            localStorage.setItem('token_expires_at', '1234567890');

            clearAuthData();

            expect(localStorage.getItem('auth_token')).toBeNull();
            expect(localStorage.getItem('refresh_token')).toBeNull();
            expect(localStorage.getItem('user_data')).toBeNull();
            expect(localStorage.getItem('token_expires_at')).toBeNull();
        });
    });
});