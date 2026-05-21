'use client';

import React from 'react';
import Link from 'next/link';

interface NavItem {
  href: string;
  label: string;
  icon?: React.ReactNode;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

interface CommandPaletteProps {
  onClose: () => void;
  navSections: NavSection[];
}

export function CommandPalette({ onClose, navSections }: CommandPaletteProps) {
  return (
    <div style={{ display: 'none' }}>
      {/* Placeholder component */}
    </div>
  );
}
