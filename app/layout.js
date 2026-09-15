import { Space_Grotesk, Inter } from 'next/font/google';
import './globals.css';

const displayFont = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
});

const bodyFont = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
});

export const metadata = {
  title: 'Y-Price — prémiový cenový srovnávač',
  description:
    'Y-Price porovnává ceny tenisek, streetwearu, luxusního zboží a sběratelských ' +
    'předmětů napříč ověřenými e-shopy — žádné bazary, žádné padělky.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="cs" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body className="bg-base text-neutral-100 font-body min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
