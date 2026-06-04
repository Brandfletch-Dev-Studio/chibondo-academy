import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, BookOpen, GraduationCap, FileText, BarChart3, 
  Users, Settings, Bell, CreditCard, MessageSquare,
  ChevronLeft, ChevronRight, LogOut, Library, ClipboardList,
  Trophy, PenTool
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';

const studentNav = [
  { label: 'Dashboard', icon: Home, path: '/' },
  { label: 'My Subjects', icon: BookOpen, path: '/subjects' },
  { label: 'Revision Hub', icon: Library, path: '/revision' },
  { label: 'My Quizzes', icon: ClipboardList, path: '/my-quizzes' },
  { label: 'Assignments', icon: FileText, path: '/my-assignments' },
  { label: 'Discussions', icon: MessageSquare, path: '/discussions' },
  { label: 'Progress', icon: BarChart3, path: '/progress' },
  { label: 'Subscription', icon: CreditCard, path: '/subscription' },
];

const teacherNav = [
  { label: 'Dashboard', icon: Home, path: '/teacher' },
  { label: 'My Courses', icon: BookOpen, path: '/teacher/courses' },
  { label: 'Quiz Builder', icon: ClipboardList, path: '/teacher/quizzes' },
  { label: 'Grading', icon: PenTool, path: '/teacher/grading' },
];

const adminNav = [
  { label: 'Dashboard', icon: Home, path: '/admin' },
  { label: 'Users', icon: Users, path: '/admin/users' },
  { label: 'Academic', icon: GraduationCap, path: '/admin/academic' },
  { label: 'Subscriptions', icon: CreditCard, path: '/admin/subscriptions' },
  { label: 'Settings', icon: Settings, path: '/admin/settings' },
];

export default function Sidebar({ user, collapsed, onToggle }) {
  const location = useLocation();
  const role = user?.role || 'student';
  
  const navItems = role === 'admin' ? adminNav : role === 'teacher' ? teacherNav : studentNav;

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground z-40 transition-all duration-300 flex flex-col",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Logo */}
      <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
          <GraduationCap className="w-5 h-5 text-accent-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="font-display font-bold text-sm leading-tight">Chibondo</h1>
            <p className="text-[10px] opacity-70">Academy</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                isActive 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User & Collapse */}
      <div className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-bold">
              {user?.full_name?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user?.full_name || 'User'}</p>
              <p className="text-[10px] opacity-60 capitalize">{role}</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => base44.auth.logout()} 
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors flex-1"
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span>Sign Out</span>}
          </button>
          <button 
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors hidden lg:block"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
}