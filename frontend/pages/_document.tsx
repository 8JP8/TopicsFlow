import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en" suppressHydrationWarning>
      <Head>
        <link rel="icon" type="image/png" sizes="48x48" href="/icons/icon-48x48.png" />
        <link rel="icon" type="image/png" sizes="72x72" href="/icons/icon-72x72.png" />
        <link rel="icon" type="image/png" sizes="96x96" href="/icons/icon-96x96.png" />
        <link rel="icon" type="image/png" sizes="128x128" href="/icons/icon-128x128.png" />
        <link rel="icon" type="image/png" sizes="144x144" href="/icons/icon-144x144.png" />
        <link rel="icon" type="image/png" sizes="152x152" href="/icons/icon-152x152.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="384x384" href="/icons/icon-384x384.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512x512.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180x180.png" />
        <link rel="apple-touch-icon" sizes="1024x1024" href="/icons/icon-1024x1024.png" />
        <meta name="description" content="TopicsFlow - Reddit-style discussion platform with chat rooms and passwordless authentication" />
        <meta name="keywords" content="chat, discussion, forum, topics, reddit, social, community" />
        <meta name="author" content="TopicsFlow" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://topicsflow.me/" />
        <meta property="og:title" content="TopicsFlow - Reddit-style Discussion Platform" />
        <meta property="og:description" content="Join TopicsFlow for Reddit-style discussions, chat rooms, and passwordless authentication" />
        <meta property="og:image" content="https://topicsflow.me/icons/banner.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="TopicsFlow - Where conversations flow naturally" />
        <meta property="og:site_name" content="TopicsFlow" />
        <meta property="og:locale" content="en_US" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://topicsflow.me/" />
        <meta name="twitter:title" content="TopicsFlow - Reddit-style Discussion Platform" />
        <meta name="twitter:description" content="Join TopicsFlow for Reddit-style discussions, chat rooms, and passwordless authentication" />
        <meta name="twitter:image" content="https://topicsflow.me/icons/banner.png" />
        <meta name="twitter:image:alt" content="TopicsFlow - Where conversations flow naturally" />

        {/* WhatsApp */}
        <meta property="og:image:type" content="image/png" />

        {/* Discord */}
        <meta name="theme-color" content="#1976d2" />
        <meta name="msapplication-TileColor" content="#1976d2" />

        {/* PWA */}
        <meta name="application-name" content="TopicsFlow" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="TopicsFlow" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <link rel="manifest" href="/manifest.json" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('preferredTheme') || 
                              (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                }
              })();
            `,
          }}
        />
      </Head>
      <body suppressHydrationWarning>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
