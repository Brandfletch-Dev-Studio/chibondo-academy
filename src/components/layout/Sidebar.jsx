import React, { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, BookOpen, GraduationCap, FileText, BarChart3, TrendingUp,
  Users, Settings, Bell, CreditCard, MessageSquare,
  ChevronLeft, ChevronRight, LogOut, Library, ClipboardList,
  Trophy, PenTool, LayoutDashboard, Gift
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const studentNav = [
  { label: 'Dashboard', icon: Home, path: '/dashboard' },
  { label: 'My Subjects', icon: BookOpen, path: '/subjects' },
  { label: 'Revision Hub', icon: Library, path: '/revision' },
  { label: 'My Quizzes', icon: ClipboardList, path: '/my-quizzes' },
  { label: 'Assignments', icon: FileText, path: '/my-assignments' },
  { label: 'Discussions', icon: MessageSquare, path: '/discussions' },
  { label: 'Progress', icon: BarChart3, path: '/progress' },
  { label: 'Analytics', icon: TrendingUp, path: '/progress/analytics' },
  { label: 'School Fees', icon: CreditCard, path: '/subscription' },
  { label: 'Settings', icon: Settings, path: '/settings' },
];

const teacherNav = [
  { label: 'Dashboard',      icon: LayoutDashboard, path: '/teacher' },
  { label: 'My Courses',     icon: BookOpen,        path: '/teacher/courses' },
  { label: 'Quiz Builder',   icon: ClipboardList,   path: '/teacher/quizzes' },
  { label: 'Grading',        icon: PenTool,         path: '/teacher/grading' },
  { label: 'Student Progress', icon: TrendingUp,    path: '/teacher/progress' },
  { label: 'Notifications',  icon: Bell,            path: '/teacher/notifications' },
  { label: 'Settings',       icon: Settings,        path: '/teacher/settings' },
];

const adminNav = [
  { label: 'Dashboard',      icon: LayoutDashboard, path: '/admin' },
  { label: 'Courses',        icon: BookOpen,        path: '/admin/curriculum' },
  { label: 'Fees',           icon: CreditCard,      path: '/admin/subscriptions' },
  { label: 'Students',       icon: Users,           path: '/admin/users' },
  { label: 'Tutors',         icon: GraduationCap,   path: '/admin/teachers' },
  { label: 'Affiliates',     icon: Gift,            path: '/admin/affiliates' },
  { label: 'Notifications',  icon: Bell,            path: '/admin/notifications' },
  { label: 'Settings',       icon: Settings,        path: '/admin/settings' },
];

export default function Sidebar({ user, collapsed, onToggle, onNavigate }) {
  const location = useLocation();
  const role = user?.role === 'admin' ? 'admin' : user?.role === 'teacher' ? 'teacher' : 'student';
  const navItems = role === 'admin' ? adminNav : role === 'teacher' ? teacherNav : studentNav;

  return (
    <TooltipProvider delayDuration={0}>
      <aside className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground z-40 flex flex-col border-r border-sidebar-border",
        "transition-[width] duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}>
        {/* Logo */}
        <div className={cn(
          "flex items-center border-b border-sidebar-border flex-shrink-0 h-16",
          collapsed ? "justify-center px-3" : "px-4"
        )}>
          {collapsed ? (
            <img
              src="https://media.base44.com/images/public/6a212896f8e71114ad51c36f/3fd7d6af7_FB_IMG_1780187860438.jpg"
              alt="Chibondo Academy"
              className="w-9 h-9 rounded-lg object-cover"
            />
          ) : (
            <img
              src="https://media.base44.com/images/public/6a212896f8e71114ad51c36f/7b5f37ed3_Screenshot_20260604-091622.jpg"
              alt="Chibondo Academy"
              className="h-10 w-full object-contain object-left"
            />
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto overflow-x-hidden space-y-0.5">
          {navItems.map((item, idx) => {
            // Section header
            if (item.section) {
              if (collapsed) return null;
              return (
                <p key={`section-${idx}`} className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/30 first:pt-1">
                  {item.section}
                </p>
              );
            }

            // Exact match OR prefix match — but /admin must NOT match /admin/users etc.
            // Use exact match for paths that are exact-only roots like /admin, /teacher, /dashboard
            const exactOnlyPaths = ['/admin', '/teacher', '/dashboard', '/'];
            const isActive = location.pathname === item.path ||
              (!exactOnlyPaths.includes(item.path) && item.path.length > 1 && location.pathname.startsWith(item.path + '/'));

            const linkEl = (
              <Link
                key={item.path}
                to={item.path}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative",
                  collapsed && "justify-center px-2",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <item.icon className={cn(
                  "flex-shrink-0 transition-colors",
                  collapsed ? "w-5 h-5" : "w-4 h-4",
                  isActive ? "text-sidebar-primary-foreground" : "text-sidebar-primary group-hover:text-sidebar-foreground"
                )} />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {isActive && !collapsed && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary-foreground opacity-70" />
                )}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">{item.label}</TooltipContent>
                </Tooltip>
              );
            }
            return linkEl;
          })}
        </nav>

        {/* Footer: User + Sign Out + Collapse */}
        <div className="border-t border-sidebar-border p-2 flex-shrink-0 space-y-1">
          {/* User info */}
          {!collapsed && (
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-sidebar-accent/50">
              <div className="w-7 h-7 rounded-full bg-sidebar-primary flex items-center justify-center text-[11px] font-bold text-sidebar-primary-foreground flex-shrink-0">
                {user?.full_name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate text-sidebar-foreground">{user?.full_name || 'User'}</p>
                <p className="text-[10px] text-sidebar-foreground/50 capitalize">{role}</p>
              </div>
            </div>
          )}

          {/* Sign Out */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => base44.auth.logout()}
                  className="w-full flex items-center justify-center p-2.5 rounded-xl text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign Out</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={() => base44.auth.logout()}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          )}

          {/* Collapse Toggle — desktop only */}
          <button
            onClick={onToggle}
            className="hidden lg:flex w-full items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            {collapsed
              ? <ChevronRight className="w-4 h-4" />
              : <><ChevronLeft className="w-4 h-4" /><span>Collapse</span></>
            }
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}