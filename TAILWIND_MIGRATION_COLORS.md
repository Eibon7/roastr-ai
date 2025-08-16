# Tailwind CSS v4 Migration - Color Token Documentation

## Custom Color Tokens Used in Project

### Primary Color Palette (Purple/Magenta theme)
- `primary-50`: #fef7ff
- `primary-100`: #fdeeff  
- `primary-200`: #fadcff
- `primary-300`: #f5c2ff
- `primary-400`: #ed9bff
- `primary-500`: #e073ff
- `primary-600`: #ca4bff
- `primary-700`: #ac32dd
- `primary-800`: #8f2fb3
- `primary-900`: #762b92

### Custom Gray Scale
- `gray-50`: #f9fafb
- `gray-100`: #f3f4f6
- `gray-200`: #e5e7eb
- `gray-300`: #d1d5db
- `gray-400`: #9ca3af
- `gray-500`: #6b7280
- `gray-600`: #4b5563
- `gray-700`: #374151
- `gray-800`: #1f2937
- `gray-900`: #111827

## Most Used Color Classes

### Primary Colors
- Background: `bg-primary-50`, `bg-primary-100`, `bg-primary-600`, `bg-primary-900`
- Text: `text-primary-100` to `text-primary-900`
- Border: `border-primary-200`, `border-primary-300`, `border-primary-500`, `border-primary-600`, `border-primary-800`
- Hover states: `hover:bg-primary-*`, `hover:text-primary-*`, `hover:border-primary-*`
- Focus states: `focus:ring-primary-500`, `focus:border-primary-500`
- Dark mode: `dark:bg-primary-*`, `dark:text-primary-*`, `dark:border-primary-*`

### Gray Colors
- Background: `bg-gray-50` to `bg-gray-900`
- Text: `text-gray-400` to `text-gray-900`
- Border: `border-gray-200`, `border-gray-300`, `border-gray-600`, `border-gray-700`
- Dark mode variants

## Affected Files (15 total)

### Authentication & User Management
- `frontend/src/components/AuthForm.js`
- `frontend/src/components/MagicLinkForm.js`
- `frontend/src/pages/login.jsx`
- `frontend/src/pages/register.jsx`
- `frontend/src/pages/reset-password.jsx`
- `frontend/src/pages/auth-callback.jsx`

### Main Application
- `frontend/src/pages/AccountsPage.js`
- `frontend/src/pages/Settings.jsx`
- `frontend/src/pages/Logs.jsx`

### Admin Interface
- `frontend/src/pages/admin/AdminDashboard.jsx`
- `frontend/src/pages/admin/users.jsx`
- `frontend/src/pages/admin/UserDetail.jsx`

### Components
- `frontend/src/components/AccountCard.js`
- `frontend/src/components/AccountModal.js`
- `frontend/src/components/NetworkConnectModal.js`
- `frontend/src/components/ShieldInterceptedList.js`
- `frontend/src/components/widgets/ActivityFeedCard.jsx`

## Migration Notes for v4

1. **Color opacity classes** like `bg-primary-900/20` need special attention
2. **Dark mode variants** are extensively used across all components
3. **Focus and hover states** use custom colors throughout
4. **No semantic color tokens** found (e.g., `bg-destructive`, `text-muted-foreground`) - only direct color references