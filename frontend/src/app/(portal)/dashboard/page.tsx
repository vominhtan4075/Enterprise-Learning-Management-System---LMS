'use client';

import React from 'react';
import { useAuth } from '@/context/auth-context';
import { LearnerDashboardView } from '@/components/features/learner-dashboard-view';
import { StaffDashboardView } from '@/components/features/staff-dashboard-view';

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  if (user.role === 'EMPLOYEE') {
    return <LearnerDashboardView />;
  }

  return <StaffDashboardView />;
}
