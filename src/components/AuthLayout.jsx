import React from "react";

export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gray-50">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-8">
          <img
            src="https://media.base44.com/images/public/6a212896f8e71114ad51c36f/3fd7d6af7_FB_IMG_1780187860438.jpg"
            alt="The Chibondo Academy"
            className="w-20 h-20 rounded-2xl object-cover mx-auto shadow-md"
          />
          <h1 className="text-xl font-bold mt-3 text-gray-900">The Chibondo Academy</h1>
          {title && <p className="text-base font-semibold text-gray-700 mt-1">{title}</p>}
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {children}
        </div>

        {footer && (
          <p className="text-center text-sm text-gray-500 mt-6">{footer}</p>
        )}
      </div>
    </div>
  );
}