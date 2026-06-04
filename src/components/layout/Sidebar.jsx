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
      {/* Logo / Brand */}
      <div className={`flex items-center border-b border-sidebar-border flex-shrink-0 ${collapsed ? 'justify-center p-3' : 'p-3'}`}>
        {collapsed ? (
          /* Square icon logo when collapsed */
          <img
            src="https://media.base44.com/images/public/6a212896f8e71114ad51c36f/3fd7d6af7_FB_IMG_1780187860438.jpg"
            alt="Chibondo Academy"
            className="w-10 h-10 rounded-lg object-cover"
          />
        ) : (
          /* Rectangle banner logo when expanded */
          <img
            src="https://media.base44.com/images/public/6a212896f8e71114ad51c36f/7b5f37ed3_Screenshot_20260604-091622.jpg"
            alt="Chibondo Academy"
            className="h-11 w-full object-contain object-left"
          />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== '/' && item.path.length > 1 && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                collapsed && "justify-center",
                isActive 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0 text-sidebar-primary" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User & Collapse */}
      <div className="border-t border-sidebar-border p-3 flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-bold flex-shrink-0">
              {user?.full_name?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user?.full_name || 'User'}</p>
              <p className="text-[10px] opacity-60 capitalize">{role}</p>
            </div>
          </div>
        )}
        <div className={`flex items-center ${collapsed ? 'flex-col gap-2' : 'gap-2'}`}>
          <button 
            onClick={() => base44.auth.logout()} 
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${collapsed ? 'w-full justify-center' : 'flex-1'}`}
            style={{ color: 'hsl(43 20% 70%)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'hsl(43 74% 66%)'; e.currentTarget.style.background = 'hsl(222 40% 18%)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'hsl(43 20% 70%)'; e.currentTarget.style.background = 'transparent'; }}
            title="Sign Out"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
          <button 
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors hidden lg:flex items-center justify-center"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
}