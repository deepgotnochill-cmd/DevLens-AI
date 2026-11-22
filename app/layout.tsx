import './globals.css';
import type { ReactNode } from 'react';
export const metadata = {title: 'DevLens AI · Repository intelligence', description: 'Explore GitHub repository activity, source structure and evidence-backed insights. Made by Deep Datta Chaudhury.'};
export default function Layout({children}: {children: ReactNode}) {
  return <html lang="en"><head><link rel="stylesheet" href="/dashboard.css" /></head><body className="min-h-screen antialiased">{children}</body></html>;
}
