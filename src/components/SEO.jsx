import { useEffect } from 'react';

const DEFAULT_IMAGE = 'https://media.base44.com/images/public/6a212896f8e71114ad51c36f/3fd7d6af7_FB_IMG_1780187860438.jpg';
const SITE_NAME = 'Chibondo Academy';

/**
 * SEO Component — dynamically writes all <head> meta tags for SEO & social sharing.
 *
 * Basic:
 *   title         → <title> + og:title + twitter:title  (appends "| Chibondo Academy")
 *   description   → <meta description> + og:description + twitter:description
 *   canonical     → <link rel="canonical">
 *   ogImage       → og:image + twitter:image  (default = platform logo)
 *   ogType        → og:type  (default "website")
 *   keywords      → <meta keywords>
 *   schema        → <script type="application/ld+json">
 *
 * Per-content overrides (take priority over the base values above):
 *   ogTitle            → og:title  (does NOT append site name)
 *   ogDescription      → og:description
 *   ogImageOverride    → og:image
 *   twitterTitle       → twitter:title
 *   twitterDescription → twitter:description
 *   twitterImage       → twitter:image
 */
export default function SEO({
  title,
  description = '',
  canonical,
  ogImage = DEFAULT_IMAGE,
  ogType = 'website',
  schema,
  keywords,
  // Per-content overrides
  ogTitle,
  ogDescription,
  ogImageOverride,
  twitterTitle,
  twitterDescription,
  twitterImage,
}) {
  const fullTitle  = title ? `${title} | ${SITE_NAME}` : SITE_NAME;

  // Social sharing values — use override if provided, else fall back to base
  const finalOgTitle  = ogTitle        || fullTitle;
  const finalOgDesc   = ogDescription  || description;
  const finalOgImage  = ogImageOverride || ogImage;
  const finalTwTitle  = twitterTitle   || finalOgTitle;
  const finalTwDesc   = twitterDescription || finalOgDesc;
  const finalTwImage  = twitterImage   || finalOgImage;

  useEffect(() => {
    document.title = fullTitle;

    const setMeta = (name, content, isProperty = false) => {
      if (!content) return;
      const attr = isProperty ? 'property' : 'name';
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    // ── Basic ──
    setMeta('description', description);
    setMeta('viewport',    'width=device-width, initial-scale=1.0');
    setMeta('robots',      'index, follow');
    if (keywords) setMeta('keywords', keywords);

    // ── Open Graph ──
    setMeta('og:title',       finalOgTitle,  true);
    setMeta('og:description', finalOgDesc,   true);
    setMeta('og:type',        ogType,        true);
    setMeta('og:image',       finalOgImage,  true);
    setMeta('og:site_name',   SITE_NAME,     true);
    setMeta('og:locale',      'en_US',       true);
    if (canonical) setMeta('og:url', canonical, true);

    // ── Twitter Card ──
    setMeta('twitter:card',        'summary_large_image');
    setMeta('twitter:title',       finalTwTitle);
    setMeta('twitter:description', finalTwDesc);
    setMeta('twitter:image',       finalTwImage);

    // ── Canonical ──
    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.setAttribute('href', canonical);
    }

    // ── JSON-LD Structured Data ──
    if (schema) {
      let script = document.querySelector('script[type="application/ld+json"]');
      if (!script) {
        script = document.createElement('script');
        script.setAttribute('type', 'application/ld+json');
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(schema);
    }

    return () => {
      if (schema) {
        const s = document.querySelector('script[type="application/ld+json"]');
        if (s) s.textContent = '';
      }
    };
  }, [fullTitle, description, canonical, ogType, keywords,
      finalOgTitle, finalOgDesc, finalOgImage,
      finalTwTitle, finalTwDesc, finalTwImage, schema]);

  return null;
}
