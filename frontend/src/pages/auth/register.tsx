import { RegisterForm } from '@/components/auth/register-form';
import { AuthLayout } from '@/components/layout/auth-layout';

/**
 * RegisterPage
 *
 * User registration page with validation and error handling.
 * Uses AuthLayout for consistent theming and layout.
 */
export default function RegisterPage() {
  return (
    <AuthLayout 
      title="Roastr.ai" 
      description="Crea tu cuenta para empezar"
    >
      <RegisterForm />
    </AuthLayout>
  );
}
