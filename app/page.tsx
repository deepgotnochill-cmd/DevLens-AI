import Script from 'next/script';
export default function Dashboard() {
  return <main className="min-h-screen" id="devlens" data-api={process.env.NEXT_PUBLIC_API_URL || ''}><noscript>Enable JavaScript to analyze a repository.</noscript><Script src="/dashboard.js" type="module" strategy="afterInteractive" /></main>;
}
