import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import authService from '../../services/authService';
import usePostLoginRedirect from '../../hooks/usePostLoginRedirect';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '../../components/ui/card';
import { Label } from '../../components/ui/label';

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Use the post-login redirect hook
  usePostLoginRedirect();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (error) {
      setError(null);
      setShowRecovery(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setShowRecovery(false);

    try {
      const username = formData.username.trim();
      const result = await authService.signIn(username, formData.password);

      if (result.success) {
        // Success - navigation will be handled by useEffect when auth state changes
      } else {
        setError(result.message);
        setShowRecovery(true);
      }
    } catch (error) {
      setError(error.message || 'An unexpected error occurred. Please try again.');
      setShowRecovery(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecoveryEmail = async () => {
    if (!formData.username) {
      setError('Please enter your email address first');
      return;
    }

    setRecoveryLoading(true);

    try {
      const result = await authService.sendRecoveryEmail(formData.username);

      if (result.success) {
        setRecoverySuccess(true);
        setError(null);
        setShowRecovery(false);
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError(error.message || 'Failed to send recovery email. Please try again.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  if (recoverySuccess) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-green-100 dark:bg-green-800">
              <svg
                className="h-8 w-8 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
              Check your email
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
              We've sent a recovery link to <strong>{formData.username}</strong>
            </p>
            <div className="mt-6">
              <button
                onClick={() => setRecoverySuccess(false)}
                className="text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300 text-sm font-medium"
              >
                ← Back to login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo */}
        <div className="text-center">
          <h2 className="text-center text-4xl font-bold text-red-600">Roastr.AI</h2>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Sign in to your account</CardTitle>
            <CardDescription>Enter your credentials to access Roastr.AI</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Username field */}
              <div className="space-y-2">
                <Label htmlFor="username">Email</Label>
                <Input
                  id="username"
                  name="username"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                />
              </div>

              {/* Password field */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                />
              </div>

              {/* Keep me logged in checkbox */}
              <div className="flex items-center">
                <input
                  id="keep-logged-in"
                  name="keep-logged-in"
                  type="checkbox"
                  checked={keepLoggedIn}
                  onChange={(e) => setKeepLoggedIn(e.target.checked)}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <Label htmlFor="keep-logged-in" className="ml-2">
                  Keep me logged in
                </Label>
              </div>

              {/* Error message */}
              {error && (
                <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                        {error}
                      </h3>
                      {showRecovery && (
                        <div className="mt-2">
                          <Button
                            type="button"
                            onClick={handleRecoveryEmail}
                            disabled={recoveryLoading}
                            variant="ghost"
                            size="sm"
                            className="text-sm text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300"
                          >
                            {recoveryLoading ? 'Sending...' : 'Send recovery email'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Submit button */}
              <div>
                <Button type="submit" disabled={isLoading} className="w-full" variant="default">
                  {isLoading ? (
                    <div className="flex items-center">
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Signing in...
                    </div>
                  ) : (
                    'Log in'
                  )}
                </Button>
              </div>

              {/* Navigation link */}
              <div className="text-center">
                <Link
                  to="/register"
                  className="text-sm font-medium text-blue-600 hover:text-blue-500"
                >
                  I don't have an account
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
