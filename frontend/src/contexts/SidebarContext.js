import React, { createContext, useContext, useState, useEffect } from 'react';

const SidebarContext = createContext();

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

export const SidebarProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 1024); // Use lg breakpoint (1024px)
      if (window.innerWidth >= 1024) {
        setIsOpen(false);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const closeSidebar = () => {
    setIsOpen(false);
  };

  // Sidebar is visible when:
  // - Desktop (not mobile) OR
  // - Mobile and open
  const isSidebarVisible = !isMobile || isOpen;

  const value = {
    isOpen,
    isMobile,
    isSidebarVisible,
    toggleSidebar,
    closeSidebar
  };

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
};
