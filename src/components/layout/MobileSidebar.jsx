import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, BookOpen, GraduationCap, FileText, BarChart3, 
  Users, Settings, CreditCard, MessageSquare, Library,
  ClipboardList, PenTool, LogOut
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
  { label: 'Quizzes', icon: ClipboardList, path: '/teacher/quizzes' },
  { label: 'Assignments', icon: PenTool, path: '/teacher/assignments' },
  { label: 'Students', icon: Users, path: '/teacher/students' },
  { label: 'Analytics', icon: BarChart3, path: '/teacher/analytics' },
];

const adminNav = [
  { label: 'Dashboard', icon: Home, path: '/admin' },
  { label: 'Users', icon: Users, path: '/admin/users' },
  { label: 'Academic', icon: GraduationCap, path: '/admin/academic' },
  { label: 'Content', icon: BookOpen, path: '/admin/content' },
  { label: 'Subscriptions', icon: CreditCard, path: '/admin/subscriptions' },
  { label: 'Payments', icon: CreditCard, path: '/admin/payments' },
  { label: 'Analytics', icon: BarChart3, path: '/admin/analytics' },
  { label: 'Settings', icon: Settings, path: '/admin/settings' },
];

export default function MobileSidebar({ user }) {
  const location = useLocation();
  const role = user?.role || 'student';
  const navItems = role === 'admin' ? adminNav : role === 'teacher' ? teacherNav : studentNav;

  return (
    <div className="h-full bg-sidebar text-sidebar-foreground flex flex-col">
      <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-accent-foreground" />
        </div>
        <div>
          <h1 className="font-display font-bold text-sm">Chibondo Academy</h1>
        </div>
      </div>
      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link key={item.path} to={item.path} className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
              isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
            )}>
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <button onClick={() => base44.auth.logout()} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground w-full">
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}