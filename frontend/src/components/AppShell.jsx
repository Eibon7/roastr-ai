import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function AppShell() {
  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="ml-16 px-8 py-8 sm:px-12 sm:py-12 md:px-16 md:py-16 lg:px-24 lg:py-16 xl:px-32">
        <Outlet />
      </main>
    </div>
  );
}