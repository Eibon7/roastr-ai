import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

const Select = React.forwardRef(({ value, onValueChange, children, className, ...props }, ref) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="relative" ref={ref} {...props}>
      {React.Children.map(children, (child) => {
        if (child?.type === SelectTrigger) {
          return React.cloneElement(child, {
            onClick: () => setIsOpen(!isOpen),
            isOpen,
            className: cn(child.props.className, className)
          });
        }
        if (child?.type === SelectContent) {
          return React.cloneElement(child, {
            isOpen,
            onItemSelect: (itemValue) => {
              onValueChange(itemValue);
              setIsOpen(false);
            },
            onClose: () => setIsOpen(false),
            value
          });
        }
        return child;
      })}
    </div>
  );
});
Select.displayName = 'Select';

const SelectTrigger = React.forwardRef(
  ({ className, children, onClick, isOpen, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      onClick={onClick}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  )
);
SelectTrigger.displayName = 'SelectTrigger';

const SelectValue = ({ placeholder, value, children }) => {
  return <span className="truncate">{value || placeholder || children}</span>;
};
SelectValue.displayName = 'SelectValue';

const SelectContent = React.forwardRef(
  ({ className, children, isOpen, onItemSelect, onClose, value, ...props }, ref) => {
    React.useEffect(() => {
      const handleClickOutside = (event) => {
        if (ref?.current && !ref.current.contains(event.target)) {
          onClose?.();
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isOpen, onClose, ref]);

    if (!isOpen) return null;

    return (
      <div
        ref={ref}
        className={cn(
          'absolute top-full left-0 z-50 min-w-full mt-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95',
          className
        )}
        {...props}
      >
        <div className="max-h-60 overflow-auto p-1">
          {React.Children.map(children, (child) => {
            if (child?.type === SelectItem) {
              return React.cloneElement(child, {
                onSelect: onItemSelect,
                isSelected: child.props.value === value
              });
            }
            return child;
          })}
        </div>
      </div>
    );
  }
);
SelectContent.displayName = 'SelectContent';

const SelectItem = React.forwardRef(
  ({ className, children, value, onSelect, isSelected, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
        isSelected && 'bg-accent text-accent-foreground',
        className
      )}
      onClick={() => onSelect(value)}
      {...props}
    >
      {children}
    </div>
  )
);
SelectItem.displayName = 'SelectItem';

export { Select, SelectTrigger, SelectContent, SelectValue, SelectItem };
