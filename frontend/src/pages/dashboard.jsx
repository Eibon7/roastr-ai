import React from 'react';
import { WIDGETS, DEFAULT_LAYOUT, WIDGET_CONFIGS } from '../components/widgets';

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor your roast bot performance and system health
          </p>
        </div>
      </div>

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {DEFAULT_LAYOUT.map((widgetKey) => {
          const WidgetComponent = WIDGETS[widgetKey];
          const config = WIDGET_CONFIGS[widgetKey];
          
          if (!WidgetComponent) {
            console.warn(`Widget '${widgetKey}' not found`);
            return null;
          }

          return (
            <div key={widgetKey} className={config?.gridCols || 'md:col-span-1'}>
              <WidgetComponent />
            </div>
          );
        })}
      </div>
    </div>
  );
}