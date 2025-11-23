import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useSidebar } from '../contexts/SidebarContext';

export default function AppShell() {
  const { isSidebarVisible } = useSidebar();

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main
        className={`py-8 sm:py-12 md:py-16 lg:py-16 ${
          isSidebarVisible
            ? 'ml-16 pl-8 pr-4 sm:pl-12 sm:pr-6 md:pl-16 md:pr-8 lg:pl-24 lg:pr-12 xl:pl-32 xl:pr-16'
            : 'px-8 sm:px-12 md:px-16 lg:px-24 xl:px-32'
        }`}
      >
        <Outlet />
      </main>
    </div>
  );
}
