import React from "react";

export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-background">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-8">
          <img
            src="https://nckjjfxlmmsnmnexcgzg.supabase.co/storage/v1/object/public/assets/logo_square.jpg"
            alt="The Chibondo Academy"
            className="w-20 h-20 rounded-2xl object-cover mx-auto shadow-md"
          />
          <h1 className="text-xl font-bold mt-3 text-gray-900">The Chibondo Academy</h1>
          {title && <p className="text-base font-semibold text-gray-700 mt-1">{title}</p>}
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl shadow-sm border border-gray-200 p-8">
          {children}
        </div>

        {footer && (
          <p className="text-center text-sm text-gray-500 mt-6">{footer}</p>
        )}
      </div>
    </div>
  );
}