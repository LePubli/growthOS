'use client';

import React from 'react';

interface NotificationsPopoverProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function NotificationsPopover({ isOpen, onClose }: NotificationsPopoverProps) {
  return (
    <div style={{ display: 'none' }}>
      {/* Placeholder component */}
    </div>
  );
}
