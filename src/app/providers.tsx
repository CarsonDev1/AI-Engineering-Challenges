'use client';

import { ConfigProvider, App as AntApp } from 'antd';
import { antdTheme } from '@/lib/ui/theme';

// Client boundary for AntD context: theme tokens + the App wrapper that powers the
// static `message`/`modal` APIs used across the admin UI.
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider theme={antdTheme}>
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  );
}
