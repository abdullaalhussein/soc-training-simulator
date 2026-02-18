import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SOC Training Simulator',
  description: 'A multi-role Security Operations Center training platform with realistic simulated logs for hands-on cybersecurity education.',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: 'SOC Training Simulator',
    description: 'A multi-role Security Operations Center training platform with realistic simulated logs for hands-on cybersecurity education.',
    type: 'website',
    siteName: 'SOC Training Simulator',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SOC Training Simulator',
    description: 'A multi-role Security Operations Center training platform with realistic simulated logs for hands-on cybersecurity education.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
