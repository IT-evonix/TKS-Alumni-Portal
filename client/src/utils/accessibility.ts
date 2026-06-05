/**
 * Accessibility utilities for consistent ARIA labels and keyboard navigation
 */

/**
 * Generate ARIA label for form fields
 */
export function getFieldAriaLabel(
  label: string,
  required?: boolean,
  error?: string
): string {
  let ariaLabel = label;
  if (required) {
    ariaLabel += ', required';
  }
  if (error) {
    ariaLabel += `, error: ${error}`;
  }
  return ariaLabel;
}

/**
 * Generate ARIA describedby for form fields with help text or errors
 */
export function getFieldDescribedBy(
  fieldId: string,
  hasError: boolean,
  hasHelpText: boolean
): string | undefined {
  const ids: string[] = [];
  if (hasError) {
    ids.push(`${fieldId}-error`);
  }
  if (hasHelpText) {
    ids.push(`${fieldId}-help`);
  }
  return ids.length > 0 ? ids.join(' ') : undefined;
}

/**
 * Handle keyboard navigation for lists
 */
export function handleListKeyboardNavigation(
  e: React.KeyboardEvent,
  currentIndex: number,
  totalItems: number,
  onNavigate: (index: number) => void
) {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      if (currentIndex < totalItems - 1) {
        onNavigate(currentIndex + 1);
      }
      break;
    case 'ArrowUp':
      e.preventDefault();
      if (currentIndex > 0) {
        onNavigate(currentIndex - 1);
      }
      break;
    case 'Home':
      e.preventDefault();
      onNavigate(0);
      break;
    case 'End':
      e.preventDefault();
      onNavigate(totalItems - 1);
      break;
  }
}

/**
 * Handle keyboard navigation for modals/dialogs
 */
export function handleModalKeyboardNavigation(
  e: React.KeyboardEvent,
  onClose: () => void
) {
  if (e.key === 'Escape') {
    e.preventDefault();
    onClose();
  }
}

/**
 * Focus trap for modals
 */
export function createFocusTrap(
  containerRef: React.RefObject<HTMLElement>
): () => void {
  const handleTab = (e: KeyboardEvent) => {
    if (!containerRef.current) return;

    const focusableElements = containerRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (e.key === 'Tab') {
      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    }
  };

  document.addEventListener('keydown', handleTab);
  return () => document.removeEventListener('keydown', handleTab);
}

/**
 * Announce to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Get skip link attributes
 */
export function getSkipLinkProps(targetId: string) {
  return {
    href: `#${targetId}`,
    className: 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#008060] focus:text-white focus:rounded-md',
    onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      const target = document.getElementById(targetId);
      if (target) {
        target.focus();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };
}
