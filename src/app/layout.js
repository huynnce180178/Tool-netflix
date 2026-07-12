// src/app/layout.js
import './globals.css';

export const metadata = {
  title: 'Netflix Cookie Manager & NFToken Generator',
  description: 'Manage Netflix cookies and generate NFToken auto-login links easily.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
