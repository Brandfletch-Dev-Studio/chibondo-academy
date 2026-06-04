import React from 'react';
import { Bell, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Link } from 'react-router-dom';
import MobileSidebar from './MobileSidebar';

export default function TopBar({ user, notificationCount = 0 }) {
  return (
    <header className="h-14 border-b flex items-center px-4 lg:px-6 sticky top-0 z-30" style={{ background: 'hsl(222 47% 11%)', borderColor: 'hsl(222 40% 20%)' }}>
      {/* Left: Mobile menu */}
      <div className="flex-1 flex items-center">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <MobileSidebar user={user} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Center: Logo */}
      <div className="flex items-center">
        <img
          src="https://media.base44.com/images/public/6a212896f8e71114ad51c36f/7b5f37ed3_Screenshot_20260604-091622.jpg"
          alt="Chibondo Academy"
          className="h-9 w-auto object-contain"
        />
      </div>

      {/* Right: Actions */}
      <div className="flex-1 flex items-center justify-end gap-2">
        <Link to="/notifications">
          <Button variant="ghost" size="icon" className="relative h-8 w-8 text-sidebar-foreground hover:text-white hover:bg-sidebar-accent">
            <Bell className="w-4 h-4" />
            {notificationCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent text-accent-foreground text-[10px] rounded-full flex items-center justify-center font-bold">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </Button>
        </Link>
        <Link to="/admin/settings">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer hover:opacity-80 transition-opacity" style={{ background: 'hsl(43 74% 52%)', color: 'hsl(222 47% 11%)' }}>
            {user?.full_name?.[0] || 'U'}
          </div>
        </Link>
      </div>
    </header>
  );
}