import React from 'react';
import { Flame, PlayCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function WelcomeCard({ user }) {
  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.full_name?.split(' ')[0] || 'there';

  // Returning = has any learning hours or a streak
  const isReturning = (user?.total_learning_hours || 0) > 0 || (user?.study_streak || 0) > 0;
  const ctaLabel    = isReturning ? 'Continue Learning' : 'Start Learning';

  return (
    <div className="relative overflow-hidden rounded-2xl bg-primary text-primary-foreground p-6 lg:p-8">
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-card/5 rounded-full -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-1/3 w-32 h-32 bg-accent/20 rounded-full translate-y-1/2" />

      <div className="relative z-10">
        <p className="text-sm text-primary-foreground/70">{greeting}</p>
        <h2 className="text-2xl lg:text-3xl font-display font-bold mt-1 text-primary-foreground">
          {firstName}! 👋
        </h2>

        <div className="flex items-center gap-4 mt-5">
          <Link to="/subjects">
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-accent text-accent-foreground transition-all hover:opacity-90 active:scale-95">
              <PlayCircle className="w-4 h-4" />
              {ctaLabel}
            </button>
          </Link>
          {(user?.study_streak || 0) > 0 && (
            <div className="flex items-center gap-2 bg-card/10 rounded-full px-4 py-2">
              <Flame className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-primary-foreground">
                {user.study_streak} day streak
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
