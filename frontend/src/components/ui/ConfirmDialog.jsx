import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default' // default, danger
}) {
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  const handleKeyDown = React.useCallback(
    (e) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    },
    [onCancel]
  );

  React.useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'unset';
      };
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [open, handleKeyDown]);

  const isDanger = variant === 'danger';

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <Card className="w-full max-w-md mx-auto shadow-xl">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {isDanger && <AlertTriangle className="h-5 w-5 text-red-500" />}
              <CardTitle className={isDanger ? 'text-red-900' : ''}>{title}</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={onCancel} className="h-6 w-6 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{message}</p>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onCancel}>
              {cancelText}
            </Button>
            <Button variant={isDanger ? 'destructive' : 'default'} onClick={onConfirm}>
              {confirmText}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ConfirmDialog;
