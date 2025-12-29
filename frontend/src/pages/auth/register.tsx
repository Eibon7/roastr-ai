import { RegisterForm } from '@/components/auth/register-form';

/**
 * RegisterPage
 *
 * User registration page with validation and error handling
 */
export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <RegisterForm />
    </div>
  );
}

