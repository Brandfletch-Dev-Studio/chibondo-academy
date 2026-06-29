import React from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';

/**
 * RoleGuard - reads the current user from cache and redirects if role not allowed.
 * allowed: array of 'admin' | 'teacher' | 'student'
 */
export default function RoleGuard({ allowed, children }) {
  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => db.auth.me(),
    staleTime: Infinity,
  });

  if (isLoading) return null;

  const role = user?.role === 'admin' ? 'admin' : user?.role === 'teacher' ? 'teacher' : 'student';

  if (!allowed.includes(role)) {
    if (role === 'admin') return <Navigate to="/admin" replace />;
    if (role === 'teacher') return <Navigate to="/teacher" replace />;
    return <Navigate to="/" replace />;
  }

  return children;
}