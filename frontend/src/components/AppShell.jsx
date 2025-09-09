import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function AppShell() {
  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar - Fixed position */}
      <div className="fixed top-0 left-0 right-0 z-40">
        <TopBar />
      </div>
      
      <div className="pt-16">
        {/* Sidebar */}
        <Sidebar />
        
        {/* Main Content */}
        <main className="ml-20 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}