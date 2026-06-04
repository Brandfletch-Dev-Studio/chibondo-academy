import React from 'react';
import { BookOpen, Clock, Trophy, Flame } from 'lucide-react';

const stats = [
  { label: 'Enrolled Subjects', icon: BookOpen, key: 'enrolled', color: 'bg-primary/10 text-primary' },
  { label: 'Learning Hours', icon: Clock, key: 'hours', color: 'bg-accent/10 text-accent' },
  { label: 'Completed Lessons', icon: Trophy, key: 'completed', color: 'bg-success/10 text-success' },
  { label: 'Study Streak', icon: Flame, key: 'streak', color: 'bg-destructive/10 text-destructive' },
];

export default function StatsGrid({ data }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
      {stats.map((stat) => (
        <div key={stat.key} className="bg-card rounded-xl p-4 border border-border">
          <div className={`w-9 h-9 rounded-lg ${stat.color} flex items-center justify-center mb-3`}>
            <stat.icon className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold font-display">{data?.[stat.key] || 0}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}