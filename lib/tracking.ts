import { supabase, BehaviorEvent, BehaviorEventType } from './supabase';

// Session ID storage key
const SESSION_ID_KEY = 'fluxor_session_id';

// Get current session ID (returns empty string if none set)
function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(SESSION_ID_KEY) || '';
}

// Generate a new UUID session ID (call this to simulate a new user)
export function generateNewSession(): string {
  if (typeof window === 'undefined') return '';
  const sessionId = crypto.randomUUID();
  localStorage.setItem(SESSION_ID_KEY, sessionId);
  console.log('🆕 New user session:', sessionId);
  return sessionId;
}

// Ensure we have a session ID (generate if missing)
export function ensureSessionId(): string {
  if (typeof window === 'undefined') return '';
  let sessionId = getSessionId();
  if (!sessionId) {
    sessionId = generateNewSession();
  }
  return sessionId;
}

// Get current session ID (exported for components)
export function getCurrentSessionId(): string {
  return getSessionId();
}

// Get page variant from URL
function getPageVariant(): string {
  if (typeof window === 'undefined') return '';
  const path = window.location.pathname;
  // Main page is the checkout
  if (path === '/' || path === '') return 'checkout';
  return path.replace(/^\//, '') || 'checkout';
}

// Track a behavior event
export async function trackEvent(
  eventType: BehaviorEventType,
  additionalData?: Partial<BehaviorEvent>
): Promise<void> {
  if (typeof window === 'undefined') return;
  
  // Skip tracking if Supabase is not configured
  if (!supabase) return;

  // Ensure we have a session ID before tracking
  const sessionId = ensureSessionId();
  if (!sessionId) return;

  const event: BehaviorEvent = {
    session_id: sessionId,
    event_type: eventType,
    page_url: window.location.href,
    page_variant: getPageVariant(),
    user_agent: navigator.userAgent,
    screen_width: window.innerWidth,
    screen_height: window.innerHeight,
    timestamp: new Date().toISOString(), // Precise timestamp with milliseconds
    ...additionalData,
  };

  try {
    const { error } = await supabase
      .from('behavior_events')
      .insert([event]);

    if (error) {
      console.error('Error tracking event:', error);
    }
  } catch (err) {
    console.error('Failed to track event:', err);
  }
}

// Rage click detection
let clickHistory: { time: number; x: number; y: number; element: string }[] = [];
const RAGE_CLICK_THRESHOLD = 3; // Number of clicks
const RAGE_CLICK_WINDOW = 2000; // Time window in ms
const RAGE_CLICK_RADIUS = 100; // Pixel radius for "same area"

function detectRageClick(e: MouseEvent, elementKey: string): boolean {
  const now = Date.now();
  
  // Add current click to history
  clickHistory.push({ time: now, x: e.clientX, y: e.clientY, element: elementKey });
  
  // Remove old clicks outside the time window
  clickHistory = clickHistory.filter(click => now - click.time < RAGE_CLICK_WINDOW);
  
  // Check for rage click pattern: multiple rapid clicks in same area
  if (clickHistory.length >= RAGE_CLICK_THRESHOLD) {
    const recentClicks = clickHistory.slice(-RAGE_CLICK_THRESHOLD);
    const firstClick = recentClicks[0];
    const allInSameArea = recentClicks.every(click => {
      const distance = Math.sqrt(
        Math.pow(click.x - firstClick.x, 2) + Math.pow(click.y - firstClick.y, 2)
      );
      return distance < RAGE_CLICK_RADIUS;
    });
    
    if (allInSameArea) {
      return true;
    }
  }
  
  return false;
}

// Track click events
export function trackClick(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  const elementKey = target.id || target.className || target.tagName;
  
  // Check for rage click
  const isRageClick = detectRageClick(e, elementKey);
  
  if (isRageClick) {
    trackEvent('rage_click', {
      element_id: target.id || undefined,
      element_class: target.className || undefined,
      element_text: target.textContent?.slice(0, 100) || undefined,
      x_position: e.clientX,
      y_position: e.clientY,
      metadata: {
        tagName: target.tagName,
        clickCount: clickHistory.length,
      },
    });
    // Reset after detecting rage click
    clickHistory = [];
  }
  
  trackEvent('click', {
    element_id: target.id || undefined,
    element_class: target.className || undefined,
    element_text: target.textContent?.slice(0, 100) || undefined,
    x_position: e.clientX,
    y_position: e.clientY,
    metadata: {
      tagName: target.tagName,
    },
  });
}

// Track scroll depth
let maxScrollDepth = 0;
export function trackScroll(): void {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const scrollPercent = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;

  // Only track if we've scrolled deeper
  if (scrollPercent > maxScrollDepth) {
    maxScrollDepth = scrollPercent;
    
    // Track at 25%, 50%, 75%, 90%, 100% thresholds
    if ([25, 50, 75, 90, 100].includes(scrollPercent)) {
      trackEvent('scroll', {
        scroll_depth: scrollPercent,
      });
    }
  }
}

// Track page view
export function trackPageView(): void {
  maxScrollDepth = 0; // Reset scroll depth for new page
  trackEvent('page_view');
}

// Track page leave with time spent
let pageLoadTime = Date.now();
export function trackPageLeave(): void {
  const timeOnPage = Math.round((Date.now() - pageLoadTime) / 1000);
  
  trackEvent('page_leave', {
    time_on_page: timeOnPage,
    scroll_depth: maxScrollDepth,
  });
}

// Reset page load time (call on navigation)
export function resetPageLoadTime(): void {
  pageLoadTime = Date.now();
  maxScrollDepth = 0;
}

// Track form interactions
export function trackFormFocus(fieldName: string): void {
  trackEvent('form_focus', {
    element_id: fieldName,
    metadata: { field: fieldName },
  });
}

export function trackFormBlur(fieldName: string, hasValue: boolean): void {
  trackEvent('form_blur', {
    element_id: fieldName,
    metadata: { field: fieldName, hasValue },
  });
}

// Track button hover (for important CTAs)
export function trackButtonHover(buttonId: string, buttonText: string): void {
  trackEvent('button_hover', {
    element_id: buttonId,
    element_text: buttonText,
  });
}

// Track cart actions
export function trackAddToCart(productId: number, productName: string, price: number): void {
  trackEvent('add_to_cart', {
    metadata: { productId, productName, price },
  });
}

export function trackRemoveFromCart(productId: number, productName: string): void {
  trackEvent('remove_from_cart', {
    metadata: { productId, productName },
  });
}

// Track checkout funnel
export function trackCheckoutStart(): void {
  trackEvent('checkout_start');
}

export function trackCheckoutComplete(orderTotal: number): void {
  trackEvent('checkout_complete', {
    metadata: { orderTotal },
  });
}

// Track element hover (for important elements)
let hoverTimeout: NodeJS.Timeout | null = null;
let lastHoveredElement: string | null = null;

export function trackElementHover(element: HTMLElement, duration: number = 500): void {
  const elementKey = element.id || element.className || element.tagName;
  
  // Debounce to only track meaningful hovers (> duration ms)
  if (hoverTimeout) clearTimeout(hoverTimeout);
  
  hoverTimeout = setTimeout(() => {
    if (elementKey !== lastHoveredElement) {
      lastHoveredElement = elementKey;
      trackEvent('element_hover', {
        element_id: element.id || undefined,
        element_class: element.className || undefined,
        element_text: element.textContent?.slice(0, 100) || undefined,
        metadata: {
          tagName: element.tagName,
          hoverDuration: duration,
        },
      });
    }
  }, duration);
}

export function clearHoverTracking(): void {
  if (hoverTimeout) clearTimeout(hoverTimeout);
  lastHoveredElement = null;
}

// Track text selection
export function trackTextSelection(): void {
  const selection = window.getSelection();
  const selectedText = selection?.toString().trim();
  
  if (selectedText && selectedText.length > 0) {
    // Get the parent element of the selection
    const range = selection?.getRangeAt(0);
    const container = range?.commonAncestorContainer;
    const parentElement = container?.nodeType === Node.TEXT_NODE 
      ? container.parentElement 
      : container as HTMLElement;
    
    trackEvent('text_select', {
      element_id: parentElement?.id || undefined,
      element_class: parentElement?.className || undefined,
      element_text: selectedText.slice(0, 200),
      metadata: {
        selectionLength: selectedText.length,
        tagName: parentElement?.tagName,
      },
    });
  }
}

// Track mouse movement patterns (sampled)
let lastMousePosition = { x: 0, y: 0, time: 0 };
let mouseIdleTime = 0;
const MOUSE_SAMPLE_INTERVAL = 1000; // Sample every 1 second

export function trackMouseMove(e: MouseEvent): void {
  const now = Date.now();
  
  // Only sample periodically to avoid flooding
  if (now - lastMousePosition.time < MOUSE_SAMPLE_INTERVAL) return;
  
  const distance = Math.sqrt(
    Math.pow(e.clientX - lastMousePosition.x, 2) + 
    Math.pow(e.clientY - lastMousePosition.y, 2)
  );
  
  // Track if mouse has moved significantly or been idle
  if (distance < 5 && lastMousePosition.time > 0) {
    mouseIdleTime += now - lastMousePosition.time;
  } else {
    mouseIdleTime = 0;
  }
  
  lastMousePosition = { x: e.clientX, y: e.clientY, time: now };
  
  // Only log significant idle periods (user hesitating)
  if (mouseIdleTime > 3000) {
    trackEvent('mouse_move', {
      x_position: e.clientX,
      y_position: e.clientY,
      metadata: {
        idleTime: mouseIdleTime,
        pattern: 'hesitation',
      },
    });
    mouseIdleTime = 0;
  }
}
