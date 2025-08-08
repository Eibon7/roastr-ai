// Authentication JavaScript for Roastr.AI
// Handles login, registration, password reset, and magic link functionality

// API base URL
const API_BASE = '/api/auth';

// Utility functions
function showMessage(message, type = 'error') {
    const successEl = document.getElementById('success-message');
    const errorEl = document.getElementById('error-message');
    
    // Hide both first
    if (successEl) successEl.classList.add('hidden');
    if (errorEl) errorEl.classList.add('hidden');
    
    // Show appropriate message
    if (type === 'success' && successEl) {
        successEl.textContent = message;
        successEl.classList.remove('hidden');
    } else if (type === 'error' && errorEl) {
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        if (successEl) successEl.classList.add('hidden');
        if (errorEl) errorEl.classList.add('hidden');
    }, 10000);
}

function setLoading(buttonId, loading = true) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    
    if (loading) {
        button.disabled = true;
        button.innerHTML = '<span class="spinner"></span>' + button.textContent;
        button.classList.add('loading');
    } else {
        button.disabled = false;
        button.innerHTML = button.textContent.replace('<span class="spinner"></span>', '');
        button.classList.remove('loading');
    }
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePassword(password) {
    return password && password.length >= 6;
}

// API helper function
async function apiCall(endpoint, method = 'POST', data = null) {
    try {
        const config = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };
        
        if (data) {
            config.body = JSON.stringify(data);
        }
        
        const response = await fetch(`${API_BASE}${endpoint}`, config);
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || `HTTP ${response.status}`);
        }
        
        return result;
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

// Save auth data to localStorage
function saveAuthData(data) {
    localStorage.setItem('auth_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    localStorage.setItem('user_data', JSON.stringify(data.user));
    
    // Set expiration if provided
    if (data.expires_at) {
        localStorage.setItem('token_expires_at', data.expires_at);
    }
}

// Clear auth data
function clearAuthData() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('token_expires_at');
    localStorage.removeItem('pendingVerificationEmail');
}

// Check if user is authenticated
function isAuthenticated() {
    const token = localStorage.getItem('auth_token');
    const expiresAt = localStorage.getItem('token_expires_at');
    
    if (!token) return false;
    
    if (expiresAt) {
        const now = Date.now() / 1000;
        const expiry = parseInt(expiresAt);
        if (now >= expiry) {
            clearAuthData();
            return false;
        }
    }
    
    return true;
}

// Redirect to dashboard if already authenticated
function checkAuthRedirect() {
    if (isAuthenticated()) {
        const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
        if (userData.is_admin) {
            window.location.href = '/admin.html';
        } else {
            window.location.href = '/dashboard.html';
        }
    }
}

// Login page functions
function initLoginPage() {
    checkAuthRedirect();
    
    const loginForm = document.getElementById('login-form');
    const googleBtn = document.getElementById('google-login-btn');
    const magicLinkBtn = document.getElementById('magic-link-btn');
    const recoveryBtn = document.getElementById('recovery-btn');
    
    // Login form submission
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(loginForm);
        const email = formData.get('email');
        const password = formData.get('password');
        const keepLogged = formData.get('keepLogged') === 'on';
        
        // Validation
        if (!validateEmail(email)) {
            showMessage('Please enter a valid email address');
            return;
        }
        
        if (!validatePassword(password)) {
            showMessage('Password must be at least 6 characters long');
            return;
        }
        
        setLoading('login-btn', true);
        
        try {
            const result = await apiCall('/login', 'POST', {
                email,
                password,
                keepLogged
            });
            
            // Save authentication data
            saveAuthData(result.data);
            
            showMessage(result.message, 'success');
            
            // Redirect based on user role
            setTimeout(() => {
                if (result.data.user.is_admin) {
                    window.location.href = '/admin.html';
                } else {
                    window.location.href = '/dashboard.html';
                }
            }, 1000);
            
        } catch (error) {
            showMessage(error.message);
            
            // Show recovery section on login error
            const recoverySection = document.getElementById('recovery-section');
            if (recoverySection) {
                recoverySection.classList.remove('hidden');
            }
        } finally {
            setLoading('login-btn', false);
        }
    });
    
    // Google login
    googleBtn?.addEventListener('click', async () => {
        try {
            setLoading('google-login-btn', true);
            
            // Redirect to Google OAuth
            window.location.href = '/api/auth/google';
            
        } catch (error) {
            showMessage('Google authentication failed');
            setLoading('google-login-btn', false);
        }
    });
    
    // Magic link
    magicLinkBtn?.addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        
        if (!validateEmail(email)) {
            showMessage('Please enter a valid email address first');
            return;
        }
        
        setLoading('magic-link-btn', true);
        
        try {
            const result = await apiCall('/magic-link', 'POST', { email });
            showMessage(result.message, 'success');
        } catch (error) {
            showMessage(error.message);
        } finally {
            setLoading('magic-link-btn', false);
        }
    });
    
    // Recovery email
    recoveryBtn?.addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        
        if (!validateEmail(email)) {
            showMessage('Please enter a valid email address first');
            return;
        }
        
        try {
            const result = await apiCall('/reset-password', 'POST', { email });
            showMessage(result.message, 'success');
            
            // Hide recovery section
            const recoverySection = document.getElementById('recovery-section');
            if (recoverySection) {
                recoverySection.classList.add('hidden');
            }
        } catch (error) {
            showMessage(error.message);
        }
    });
}

// Register page functions
function initRegisterPage() {
    checkAuthRedirect();
    
    const registerForm = document.getElementById('register-form');
    const googleBtn = document.getElementById('google-register-btn');
    
    // Register form submission
    registerForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(registerForm);
        const email = formData.get('email');
        const password = formData.get('password');
        const confirmPassword = formData.get('confirmPassword');
        
        // Validation
        if (!validateEmail(email)) {
            showMessage('Please enter a valid email address');
            return;
        }
        
        if (!validatePassword(password)) {
            showMessage('Password must be at least 6 characters long');
            return;
        }
        
        if (password !== confirmPassword) {
            showMessage('Passwords do not match');
            return;
        }
        
        setLoading('register-btn', true);
        
        try {
            const result = await apiCall('/register', 'POST', {
                email,
                password
            });
            
            showMessage(result.message, 'success');
            
            // Store email for verification page
            localStorage.setItem('pendingVerificationEmail', email);
            
            // Redirect to verification page
            setTimeout(() => {
                window.location.href = `/email-verification.html?email=${encodeURIComponent(email)}`;
            }, 2000);
            
        } catch (error) {
            showMessage(error.message);
        } finally {
            setLoading('register-btn', false);
        }
    });
    
    // Google registration
    googleBtn?.addEventListener('click', async () => {
        try {
            // Redirect to Google OAuth (same as login)
            window.location.href = '/api/auth/google';
            
        } catch (error) {
            showMessage('Google authentication failed');
        }
    });
}

// Password reset page functions
function initPasswordResetPage() {
    const resetForm = document.getElementById('reset-form');
    
    // Get access token from URL
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('access_token');
    
    if (!accessToken) {
        showMessage('Invalid or missing reset token', 'error');
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 3000);
        return;
    }
    
    resetForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(resetForm);
        const password = formData.get('password');
        const confirmPassword = formData.get('confirmPassword');
        
        // Validation
        if (!validatePassword(password)) {
            showMessage('Password must be at least 6 characters long');
            return;
        }
        
        if (password !== confirmPassword) {
            showMessage('Passwords do not match');
            return;
        }
        
        setLoading('reset-btn', true);
        
        try {
            const result = await apiCall('/update-password', 'POST', {
                access_token: accessToken,
                password
            });
            
            showMessage(result.message, 'success');
            
            // Redirect to login
            setTimeout(() => {
                window.location.href = '/login.html?message=Password updated successfully. You can now log in.&type=success';
            }, 2000);
            
        } catch (error) {
            showMessage(error.message);
        } finally {
            setLoading('reset-btn', false);
        }
    });
}

// Logout function
async function logout() {
    const token = localStorage.getItem('auth_token');
    
    if (token) {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
        } catch (error) {
            console.error('Logout API call failed:', error);
        }
    }
    
    clearAuthData();
    window.location.href = '/login.html';
}

// Auto-refresh token before expiry
function setupTokenRefresh() {
    const refreshToken = localStorage.getItem('refresh_token');
    const expiresAt = localStorage.getItem('token_expires_at');
    
    if (!refreshToken || !expiresAt) return;
    
    const now = Date.now() / 1000;
    const expiry = parseInt(expiresAt);
    const refreshTime = expiry - 300; // Refresh 5 minutes before expiry
    
    if (now < refreshTime) {
        setTimeout(() => {
            refreshAuthToken();
        }, (refreshTime - now) * 1000);
    }
}

// Refresh authentication token
async function refreshAuthToken() {
    const refreshToken = localStorage.getItem('refresh_token');
    
    if (!refreshToken) {
        clearAuthData();
        window.location.href = '/login.html';
        return;
    }
    
    try {
        const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refresh_token: refreshToken })
        });
        
        if (response.ok) {
            const result = await response.json();
            saveAuthData(result.data);
            setupTokenRefresh(); // Setup next refresh
        } else {
            throw new Error('Token refresh failed');
        }
        
    } catch (error) {
        console.error('Token refresh failed:', error);
        clearAuthData();
        window.location.href = '/login.html';
    }
}

// Initialize token refresh on page load
if (isAuthenticated()) {
    setupTokenRefresh();
}

// Export functions for global use
window.logout = logout;
window.initLoginPage = initLoginPage;
window.initRegisterPage = initRegisterPage;
window.initPasswordResetPage = initPasswordResetPage;
window.showMessage = showMessage;