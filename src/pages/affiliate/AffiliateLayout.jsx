import React from 'react';
import { NavLink, Outlet, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  LayoutDashboard, Link2, Users, DollarSign,
  Wallet, Image, UserCog, Gift
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { label: 'Dashboard',           path: '/affiliate',             icon: LayoutDashboard },
  { label: 'Referral Links',      path: '/affiliate/links',       icon: Link2 },
  { label: 'Referrals',           path: '/affiliate/referrals',   icon: Users },
  { label: 'Commissions',         path: '/affiliate/commissions', icon: DollarSign },
  { label: 'Payouts',             path: '/affiliate/payouts',     icon: Wallet },
  { label: 'Marketing',           path: '/affiliate/materials',   icon: Image },
  { label: 'Profile & Payment',   path: '/affiliate/profile',     icon: UserCog },
];

export default function AffiliateLayout() {
  const outletCtx = useOutletContext();
  const { user, notifications } = outletCtx || {};

  const { data: settingsData = [] } = useQuery({
    queryKey: ['affiliateSettings'],
    queryFn: async () => {
      try {
        return await base44.entities.PlatformSettings.filter({ key: 'affiliate_commission' });
      } catch { return []; }
    },
    staleTime: 60_000,
  });
  const settings = settingsData[0]?.value || {};

  // Default commission: MWK 10,000 fixed per subscription
  const commissionAmount = settings.commission_amount ?? settings.fixed_amount ?? 10000;
  const minPayout        = settings.min_payout ?? 5000;
  const programEnabled   = settings.enabled !== false; // default enabled

  if (!programEnabled) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
          <Gift className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-display font-bold">Affiliate Program Paused</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          The affiliate program is currently disabled. Check back soon!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'hsl(43 74% 52% / 0.15)' }}>
          <Gift className="w-5 h-5" style={{ color: 'hsl(43 74% 52%)' }} />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold">Affiliate Program</h1>
          <p className="text-sm text-muted-foreground">Earn MWK {commissionAmount.toLocaleString()} per successful subscriber you refer</p>
        </div>
      </div>

      {/* Sub-navigation */}
      <nav className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
        <div className="flex gap-1 min-w-max lg:flex-wrap lg:min-w-0">
          {NAV.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/affiliate'}
              className={({ isActive }) => cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
                isActive
                  ? "font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
              style={({ isActive }) => isActive ? { background: 'hsl(43 74% 52%)', color: 'hsl(222 47% 11%)' } : {}}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Page content */}
      <div>
        <Outlet context={{ user, notifications, settings, settingsData, commissionAmount, minPayout }} />
      </div>
    </div>
  );
}
