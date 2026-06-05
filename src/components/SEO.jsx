import { useEffect } from 'react';

/**
 * SEO Component - Dynamically updates document meta tags for SEO
 * @param {Object} props
 * @param {string} props.title - Page title (will be appended with ' | Chibondo Academy')
 * @param {string} props.description - Meta description for search engines
 * @param {string} props.canonical - Canonical URL for the page
 * @param {string} props.ogImage - Open Graph image URL for social sharing
 * @param {string} props.ogType - Open Graph type (website, article, etc.)
 * @param {Array} props.schema - JSON-LD structured data
 */
export default function SEO({ 
  title, 
  description, 
  canonical, 
  ogImage = 'https://media.base44.com/images/public/6a212896f8e71114ad51c36f/3fd7d6af7_FB_IMG_1780187860438.jpg',
  ogType = 'website',
  schema 
}) {
  const siteName = 'Chibondo Academy';
  const fullTitle = title ? `${title} | ${siteName}` : siteName;

  useEffect(() => {
    // Set document title
    document.title = fullTitle;

    // Helper to create/update meta tag
    const setMetaTag = (name, content, isProperty = false) => {
      const attribute = isProperty ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attribute}="${name}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attribute, name);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    // Basic meta tags
    setMetaTag('description', description);
    setMetaTag('viewport', 'width=device-width, initial-scale=1.0');

    // Open Graph tags for social sharing
    setMetaTag('og:title', fullTitle, true);
    setMetaTag('og:description', description, true);
    setMetaTag('og:type', ogType, true);
    setMetaTag('og:image', ogImage, true);
    setMetaTag('og:site_name', siteName, true);
    setMetaTag('og:locale', 'en_US', true);

    // Twitter Card tags
    setMetaTag('twitter:card', 'summary_large_image');
    setMetaTag('twitter:title', fullTitle);
    setMetaTag('twitter:description', description);
    setMetaTag('twitter:image', ogImage);

    // Canonical URL
    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.setAttribute('href', canonical);
    }

    // JSON-LD Structured Data
    if (schema) {
      let script = document.querySelector('script[type="application/ld+json"]');
      if (!script) {
        script = document.createElement('script');
        script.setAttribute('type', 'application/ld+json');
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(schema);
    }

    // Cleanup function to remove JSON-LD on unmount (optional)
    return () => {
      if (schema) {
        const script = document.querySelector('script[type="application/ld+json"]');
        if (script) {
          script.textContent = '';
        }
      }
    };
  }, [fullTitle, description, canonical, ogImage, ogType, schema]);

  return null; // This component doesn't render anything visible
}