import React from 'react';
import { Flame, PlayCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function WelcomeCard({ user }) {
  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.full_name?.split(' ')[0] || 'there';

  // Returning = has any learning hours or streak
  const isReturning = (user?.total_learning_hours || 0) > 0 || (user?.study_streak || 0) > 0;
  const ctaLabel    = isReturning ? 'Continue Learning' : 'Start Learning';

  return (
    <div className="relative overflow-hidden rounded-2xl p-6 lg:p-8"
      style={{ background: 'linear-gradient(135deg, hsl(222 47% 14%) 0%, hsl(222 47% 19%) 60%, hsl(43 74% 30% / 0.35) 100%)' }}>
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-64 h-64 rounded-full -translate-y-1/2 translate-x-1/4"
        style={{ background: 'hsl(43 74% 52% / 0.07)' }} />
      <div className="absolute bottom-0 left-1/3 w-32 h-32 rounded-full translate-y-1/2"
        style={{ background: 'hsl(43 74% 52% / 0.1)' }} />

      <div className="relative z-10">
        <p className="text-sm" style={{ color: 'hsl(43 20% 65%)' }}>{greeting}</p>
        <h2 className="text-2xl lg:text-3xl font-display font-bold mt-1" style={{ color: 'hsl(43 20% 94%)' }}>
          {firstName}! 👋
        </h2>

        <div className="flex items-center gap-4 mt-5">
          <Link to="/subjects">
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95"
              style={{ background: 'hsl(43 74% 52%)', color: 'hsl(222 47% 11%)' }}>
              <PlayCircle className="w-4 h-4" />
              {ctaLabel}
            </button>
          </Link>
          {(user?.study_streak || 0) > 0 && (
            <div className="flex items-center gap-2 rounded-full px-4 py-2"
              style={{ background: 'hsl(43 74% 52% / 0.12)', border: '1px solid hsl(43 74% 52% / 0.25)' }}>
              <Flame className="w-4 h-4" style={{ color: 'hsl(43 74% 52%)' }} />
              <span className="text-sm font-medium" style={{ color: 'hsl(43 74% 66%)' }}>
                {user.study_streak} day streak
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
