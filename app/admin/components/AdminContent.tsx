'use client';

import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

interface AdminContentProps {
  children: ReactNode;
}

export function AdminContent({ children }: AdminContentProps) {
  const pathname = usePathname();

  // Don't apply admin-main styles on login page
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return <main className="admin-main">{children}</main>;
}

