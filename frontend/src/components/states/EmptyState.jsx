import React from 'react';
import { Button } from '../ui/button';

export function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <div className="text-center py-12 px-6 border border-dashed border-slate-200 rounded-2xl bg-white dark:bg-slate-900 dark:border-slate-700">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{description}</p>
      {actionLabel && (
        <Button className="mt-4 px-4 py-2" variant="ghost" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
