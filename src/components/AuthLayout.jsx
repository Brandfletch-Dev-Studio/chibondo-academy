import React from "react";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'hsl(222 47% 8%)' }}>
      <div className="w-full max-w-md">
        {/* Logo Banner */}
        <div className="text-center mb-8">
          <img
            src="https://media.base44.com/images/public/6a212896f8e71114ad51c36f/7b5f37ed3_Screenshot_20260604-091622.jpg"
            alt="Chibondo Academy"
            className="h-16 w-auto mx-auto object-contain"
          />
          {subtitle && <p className="mt-3 text-sm" style={{ color: 'hsl(43 74% 66%)' }}>{subtitle}</p>}
          {title && <h1 className="text-xl font-display mt-1 tracking-wider" style={{ color: 'hsl(43 30% 90%)' }}>{title}</h1>}
        </div>

        {/* Card */}
        <div className="rounded-2xl border p-8" style={{ background: 'hsl(222 40% 12%)', borderColor: 'hsl(222 35% 22%)' }}>
          {children}
        </div>

        {footer && (
          <p className="text-center text-sm mt-6" style={{ color: 'hsl(43 20% 65%)' }}>{footer}</p>
        )}
      </div>
    </div>
  );
}