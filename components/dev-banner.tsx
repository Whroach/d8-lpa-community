"use client"

import React, { useEffect, useRef } from 'react';

export function DevBanner() {
  const ref = useRef<HTMLDivElement>(null);
  const isDev = process.env.NODE_ENV?.toLowerCase() === 'development';

  // Full-height screens (Messages) subtract this, so they fit under the
  // banner in development just as they fit without it in production.
  useEffect(() => {
    const banner = ref.current;
    if (!banner) return;
    const publish = () => document.documentElement.style.setProperty('--dev-banner-h', `${banner.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(banner);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--dev-banner-h');
    };
  }, []);

  if (!isDev) {
    return null;
  }

  return (
    <div ref={ref} className="w-full bg-yellow-100 border-b-2 border-yellow-400 px-4 py-3 flex items-center justify-center">
      <div className="flex items-center gap-2 text-yellow-900">
        <span className="text-xl font-bold">⚠️</span>
        <span className="font-semibold">Development Mode</span>
        <span className="text-sm">- This is a development environment</span>
      </div>
    </div>
  );
}
