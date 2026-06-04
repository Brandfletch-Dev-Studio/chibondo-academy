import React from 'react';
import { Bell, Menu, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Link } from 'react-router-dom';
import MobileSidebar from './MobileSidebar';

export default function TopBar({ user, notificationCount = 0 }) {
  return (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur-md flex items-center px-4 lg:px-6 sticky top-0 z-30">
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
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
          <GraduationCap className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-display font-bold text-sm tracking-wide hidden sm:block">Chibondo Academy</span>
      </div>

      {/* Right: Actions */}
      <div className="flex-1 flex items-center justify-end gap-2">
        <Link to="/notifications">
          <Button variant="ghost" size="icon" className="relative h-8 w-8">
            <Bell className="w-4 h-4" />
            {notificationCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent text-accent-foreground text-[10px] rounded-full flex items-center justify-center font-bold">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </Button>
        </Link>
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
          {user?.full_name?.[0] || 'U'}
        </div>
      </div>
    </header>
  );
}