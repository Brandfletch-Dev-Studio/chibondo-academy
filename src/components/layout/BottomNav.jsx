import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, GraduationCap, Library, CreditCard, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Classes',   icon: BookOpen,      path: '/subjects' },
  { label: 'Tutors',    icon: GraduationCap, path: '/tutors' },
  { label: 'Library',   icon: Library,       path: '/library' },
  { label: 'Forums',    icon: MessageSquare, path: '/forums' },
  { label: 'Fees',      icon: CreditCard,    path: '/subscription' },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-sidebar border-t border-sidebar-border safe-area-pb">
      <div className="flex items-stretch h-16">
        {navItems.map(({ label, icon: Icon, path }) => {
          const isActive = location.pathname === path ||
            (path !== '/' && location.pathname.startsWith(path));
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors relative',
                isActive
                  ? 'text-accent'
                  : 'text-sidebar-foreground/50 hover:text-sidebar-foreground'
              )}
            >
              <Icon className={cn('w-5 h-5', isActive && 'text-accent')} />
              <span>{label}</span>
              {isActive && <span className="absolute bottom-0 w-8 h-0.5 bg-accent rounded-t-full" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
