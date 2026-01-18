"use client";

import { useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import {
  trackClick,
  trackScroll,
  trackPageView,
  trackPageLeave,
  resetPageLoadTime,
  trackTextSelection,
  trackMouseMove,
  trackElementHover,
  clearHoverTracking,
} from '@/lib/tracking';

// Debounce utility
function debounce<T extends (...args: Parameters<T>) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export default function TrackingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Debounced scroll handler
  const debouncedScrollHandler = useCallback(
    debounce(() => trackScroll(), 200),
    []
  );

  // Click handler
  const handleClick = useCallback((e: MouseEvent) => {
    trackClick(e);
  }, []);

  // Page visibility change handler (for page leave)
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'hidden') {
      trackPageLeave();
    }
  }, []);

  // Before unload handler
  const handleBeforeUnload = useCallback(() => {
    trackPageLeave();
  }, []);

  // Text selection handler (debounced)
  const handleSelectionChange = useCallback(
    debounce(() => trackTextSelection(), 500),
    []
  );

  // Mouse move handler (already sampled in trackMouseMove)
  const handleMouseMove = useCallback((e: MouseEvent) => {
    trackMouseMove(e);
  }, []);

  // Hover handler for important elements
  const handleMouseOver = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    // Track hovers on buttons, links, inputs, and elements with data-track attribute
    if (
      target.tagName === 'BUTTON' ||
      target.tagName === 'A' ||
      target.tagName === 'INPUT' ||
      target.tagName === 'SELECT' ||
      target.hasAttribute('data-track-hover')
    ) {
      trackElementHover(target, 500);
    }
  }, []);

  const handleMouseOut = useCallback(() => {
    clearHoverTracking();
  }, []);

  // Set up event listeners
  useEffect(() => {
    // Track initial page view
    trackPageView();

    // Add event listeners
    document.addEventListener('click', handleClick);
    window.addEventListener('scroll', debouncedScrollHandler, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseover', handleMouseOver, { passive: true });
    document.addEventListener('mouseout', handleMouseOut, { passive: true });

    return () => {
      document.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', debouncedScrollHandler);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
    };
  }, [handleClick, debouncedScrollHandler, handleVisibilityChange, handleBeforeUnload, handleSelectionChange, handleMouseMove, handleMouseOver, handleMouseOut]);

  // Track page navigation
  useEffect(() => {
    resetPageLoadTime();
    trackPageView();
  }, [pathname]);

  return <>{children}</>;
}
