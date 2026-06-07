import React, { useState } from 'react';
import { Bell, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

function UserAvatar({ user, size = 8 }) {
  const [err, setErr] = useState(false);
  const role = user?.role === 'admin' ? 'admin' : user?.role === 'teacher' ? 'teacher' : 'student';
  const initial = user?.full_name?.[0]?.toUpperCase() || 'U';
  const settingsPath = role === 'admin' ? '/admin/settings' : role === 'teacher' ? '/teacher/settings' : '/settings';

  const avatarUrl = user?.avatar_url;

  return (
    <Link to={settingsPath}>
      {avatarUrl && !err ? (
        <img
          src={avatarUrl}
          alt={user?.full_name || 'Profile'}
          onError={() => setErr(true)}
          className={`w-${size} h-${size} rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity border-2`}
          style={{ borderColor: 'hsl(43 74% 52% / 0.4)' }}
        />
      ) : (
        <div
          className={`w-${size} h-${size} rounded-full flex items-center justify-center text-xs font-bold cursor-pointer hover:opacity-80 transition-opacity`}
          style={{ background: 'hsl(43 74% 52%)', color: 'hsl(222 47% 11%)' }}
        >
          {initial}
        </div>
      )}
    </Link>
  );
}

export default function TopBar({ user, notificationCount = 0, onMenuClick }) {
  return (
    <header className="h-14 border-b flex items-center px-4 lg:px-6 sticky top-0 z-30" style={{ background: 'hsl(222 47% 11%)', borderColor: 'hsl(222 40% 20%)' }}>
      {/* Left: Mobile menu */}
      <div className="flex-1 flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden text-sidebar-foreground hover:text-white hover:bg-sidebar-accent"
          onClick={onMenuClick}
        >
          <Menu className="w-5 h-5" />
        </Button>
      </div>

      {/* Center: Logo */}
      <div className="flex items-center">
        <img
          src="https://media.base44.com/images/public/6a212896f8e71114ad51c36f/7b5f37ed3_Screenshot_20260604-091622.jpg"
          alt="Chibondo Academy"
          className="h-9 w-auto object-contain"
        />
      </div>

      {/* Right: Notifications + avatar */}
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
        <UserAvatar user={user} size={8} />
      </div>
    </header>
  );
}
