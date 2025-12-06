import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en" suppressHydrationWarning>
      <Head>
        <link rel="icon" type="image/png" href="https://i.postimg.cc/FY5shL9w/chat.png" />
        <link rel="apple-touch-icon" href="https://i.postimg.cc/FY5shL9w/chat.png" />
        <meta name="description" content="TopicsFlow - Reddit-style discussion platform with chat rooms and passwordless authentication" />
        <meta name="keywords" content="chat, discussion, forum, topics, reddit, social, community" />
        <meta name="author" content="TopicsFlow" />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://topicsflow.com/" />
        <meta property="og:title" content="TopicsFlow - Reddit-style Discussion Platform" />
        <meta property="og:description" content="Join TopicsFlow for Reddit-style discussions, chat rooms, and passwordless authentication" />
        {/* TODO: Replace with 16:9 banner image (e.g., /banner.png) - currently using main logo as placeholder */}
        <meta property="og:image" content="https://i.postimg.cc/FY5shL9w/chat.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="TopicsFlow Logo" />
        <meta property="og:site_name" content="TopicsFlow" />
        <meta property="og:locale" content="en_US" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://topicsflow.com/" />
        <meta name="twitter:title" content="TopicsFlow - Reddit-style Discussion Platform" />
        <meta name="twitter:description" content="Join TopicsFlow for Reddit-style discussions, chat rooms, and passwordless authentication" />
        {/* TODO: Replace with 16:9 banner image (e.g., /banner.png) - currently using main logo as placeholder */}
        <meta name="twitter:image" content="https://i.postimg.cc/FY5shL9w/chat.png" />
        <meta name="twitter:image:alt" content="TopicsFlow Logo" />
        
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
