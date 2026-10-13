import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter' });

export const metadata = {
  title: 'Milan Azərbaycanlıları 🇦🇿',
  description: 'Milanda yaşayan azərbaycanlılar üçün tez-tez verilən suallar',
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='12 0 36 30'><rect x='0' width='60' height='10' fill='%2300B5E2'/><rect y='10' width='60' height='10' fill='%23EF3340'/><rect y='20' width='60' height='10' fill='%23509E2F'/><circle cx='28.5' cy='15' r='4.5' fill='white'/><circle cx='29.6' cy='15' r='3.75' fill='%23EF3340'/><polygon fill='white' points='33.60,13.00 33.93,14.21 35.01,13.59 34.39,14.67 35.60,15.00 34.39,15.33 35.01,16.41 33.93,15.79 33.60,17.00 33.27,15.79 32.19,16.41 32.81,15.33 31.60,15.00 32.81,14.67 32.19,13.59 33.27,14.21'/></svg>" },
};

export const viewport = { themeColor: [{ media: '(prefers-color-scheme: dark)', color: '#09090b' }, { color: '#fafafa' }] };

// set theme before paint so there is no flash
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="az" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-zinc-50 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
