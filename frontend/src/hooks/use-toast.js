import { useContext } from 'react';
import { ToastContext } from '../contexts/ToastContext';

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    // Fallback if ToastContext is not available
    return {
      toast: ({ title, description, variant }) => {
        const message = `${title}${description ? `: ${description}` : ''}`;
        if (variant === 'destructive') {
          console.error(message);
          alert(message); // Fallback to browser alert
        } else {
          console.log(message);
        }
      }
    };
  }

  // Adapt the existing context API to our expected format
  return {
    toast: ({ title, description, variant = 'info' }) => {
      const message = `${title}${description ? `: ${description}` : ''}`;

      if (variant === 'destructive') {
        context.toast.error(message);
      } else {
        switch (variant) {
          case 'success':
            context.toast.success(message);
            break;
          case 'warning':
            context.toast.warning(message);
            break;
          default:
            context.toast.info(message);
        }
      }
    }
  };
}
