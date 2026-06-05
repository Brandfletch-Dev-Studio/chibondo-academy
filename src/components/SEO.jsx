import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function SEO({ title, description, image, type = 'website', article }) {
  const location = useLocation();
  const canonicalUrl = `${window.location.origin}${location.pathname}`;
  
  const siteName = 'The Chibondo Academy';
  const defaultImage = 'https://media.base44.com/images/public/6a212896f8e71114ad51c36f/3fd7d6af7_FB_IMG_1780187860438.jpg';
  const ogImage = image || defaultImage;

  useEffect(() => {
    // Document title
    document.title = title ? `${title} | ${siteName}` : siteName;

    // Meta description
    updateMeta('description', description || 'The Chibondo Academy - Quality online secondary education for MSCE students in Malawi');
    
    // Canonical URL
    updateMeta('canonical', canonicalUrl, 'rel');
    
    // Open Graph
    updateMeta('og:title', title ? `${title} | ${siteName}` : siteName);
    updateMeta('og:description', description || 'Quality online secondary education for MSCE students');
    updateMeta('og:type', type);
    updateMeta('og:url', canonicalUrl);
    updateMeta('og:image', ogImage);
    updateMeta('og:site_name', siteName);
    
    // Twitter Card
    updateMeta('twitter:card', 'summary_large_image');
    updateMeta('twitter:title', title ? `${title} | ${siteName}` : siteName);
    updateMeta('twitter:description', description || 'Quality online secondary education');
    updateMeta('twitter:image', ogImage);

    // Article-specific meta
    if (type === 'article' && article) {
      if (article.publishedTime) updateMeta('article:published_time', article.publishedTime);
      if (article.modifiedTime) updateMeta('article:modified_time', article.modifiedTime);
      if (article.author) updateMeta('article:author', article.author);
      if (article.section) updateMeta('article:section', article.section);
    }

    // JSON-LD Structured Data
    updateStructuredData({ title, description, type, article, canonicalUrl, ogImage });

    return () => {
      // Cleanup on unmount
      cleanupMeta();
    };
  }, [title, description, image, type, article, canonicalUrl, ogImage]);

  return null;
}

function updateMeta(name, content, attr = 'name') {
  if (!content) return;
  
  let meta = document.querySelector(`meta[${attr}="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attr, name);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

function updateStructuredData({ title, description, type, article, canonicalUrl, ogImage }) {
  let script = document.getElementById('structured-data');
  
  let structuredData = {};
  
  if (type === 'article' || type === 'course') {
    structuredData = {
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: title,
      description: description,
      url: canonicalUrl,
      image: ogImage,
      provider: {
        '@type': 'Organization',
        name: 'The Chibondo Academy',
        sameAs: window.location.origin
      },
      ...(article?.author && { author: { '@type': 'Person', name: article.author } }),
      ...(article?.publishedTime && { datePublished: article.publishedTime }),
      ...(article?.modifiedTime && { dateModified: article.modifiedTime })
    };
  } else {
    structuredData = {
      '@context': 'https://schema.org',
      '@type': 'EducationalOrganization',
      name: 'The Chibondo Academy',
      url: window.location.origin,
      logo: ogImage,
      description: 'Quality online secondary education for MSCE students in Malawi'
    };
  }

  if (!script) {
    script = document.createElement('script');
    script.id = 'structured-data';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(structuredData);
}

function cleanupMeta() {
  const metasToRemove = [
    'description', 'canonical', 'og:title', 'og:description', 'og:type', 
    'og:url', 'og:image', 'og:site_name', 'twitter:card', 'twitter:title', 
    'twitter:description', 'twitter:image', 'article:published_time', 
    'article:modified_time', 'article:author', 'article:section'
  ];
  
  metasToRemove.forEach(name => {
    const meta = document.querySelector(`meta[name="${name}"]`);
    if (meta && meta.getAttribute('data-dynamic') !== 'false') {
      meta.remove();
    }
  });
  
  const script = document.getElementById('structured-data');
  if (script) script.remove();
}