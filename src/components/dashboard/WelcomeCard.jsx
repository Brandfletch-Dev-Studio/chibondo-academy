import React from 'react';
import { Button } from '@/components/ui/button';
import { Flame, PlayCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function WelcomeCard({ user }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.full_name?.split(' ')[0] || 'Student';

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground p-6 lg:p-8">
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-1/3 w-32 h-32 bg-accent/20 rounded-full translate-y-1/2" />
      <div className="relative z-10">
        <p className="text-sm opacity-80">{greeting}</p>
        <h2 className="text-2xl lg:text-3xl font-display font-bold mt-1">{firstName}! 👋</h2>
        <p className="text-sm opacity-80 mt-2 max-w-md">
          Keep up the great work! Continue your learning journey today.
        </p>
        <div className="flex items-center gap-4 mt-5">
          <Link to="/subjects">
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground font-medium">
              <PlayCircle className="w-4 h-4 mr-2" />
              Continue Learning
            </Button>
          </Link>
          {(user?.study_streak || 0) > 0 && (
            <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2">
              <Flame className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium">{user.study_streak} day streak</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}