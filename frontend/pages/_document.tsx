import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" type="image/png" href="https://i.postimg.cc/52jHqBD9/chat.png" />
        <meta name="description" content="ChatHub - Secure chat application with passwordless authentication" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
