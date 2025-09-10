import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function AppShell() {
  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="ml-16 pl-8 pr-16 py-8 sm:pl-12 sm:pr-20 sm:py-12 md:pl-16 md:pr-24 md:py-16 lg:pl-24 lg:pr-32 lg:py-16 xl:pl-32 xl:pr-40">
        <Outlet />
      </main>
    </div>
  );
}