/**
 * OrchViz — Root Layout
 * Sets dark theme and monospace font for the entire app.
 */

import './globals.css';

export const metadata = {
  title: 'OrchViz',
  description: 'Real-time orchestration visualizer for MeowKit agent sessions',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body style={{ fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace" }}>
        {children}
      </body>
    </html>
  );
}
