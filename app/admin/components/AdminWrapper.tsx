'use client';

import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

interface AdminWrapperProps {
  children: ReactNode;
  className: string;
}

export function AdminWrapper({ children, className }: AdminWrapperProps) {
  const pathname = usePathname();

  // Don't apply admin-root styles on login page
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return <div className={className}>{children}</div>;
}

