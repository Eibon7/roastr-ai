import * as React from "react";

const getButtonClasses = (variant = "default", size = "default", className = "") => {
  const baseClasses = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  
  const variantClasses = {
    default: "bg-primary text-primary-foreground hover:bg-accent",
    destructive: "bg-red-600 text-white hover:bg-red-700",
    outline: "border border-border bg-background hover:bg-accent hover:text-foreground",
    secondary: "bg-secondary text-secondary-foreground hover:bg-muted",
    ghost: "hover:bg-accent hover:text-foreground",
    link: "text-primary underline-offset-4 hover:underline",
  };
  
  const sizeClasses = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8", 
    icon: "h-10 w-10",
  };
  
  return `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;
};

const Button = React.forwardRef(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={getButtonClasses(variant, size, className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };