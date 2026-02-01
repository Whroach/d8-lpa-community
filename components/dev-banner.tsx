import React from 'react';

export function DevBanner() {
  const nodeEnv = process.env.NODE_ENV?.toLowerCase();
  
  if (nodeEnv !== 'development') {
    return null;
  }

  return (
    <div className="w-full bg-yellow-100 border-b-2 border-yellow-400 px-4 py-3 flex items-center justify-center">
      <div className="flex items-center gap-2 text-yellow-900">
        <span className="text-xl font-bold">⚠️</span>
        <span className="font-semibold">Development Mode</span>
        <span className="text-sm">- This is a development environment</span>
      </div>
    </div>
  );
}
