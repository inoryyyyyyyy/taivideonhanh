import { useEffect } from 'react';

interface SeoHeadProps {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  schemas?: object[];
}

/**
 * SeoHead – Dynamically injects SEO meta tags and JSON-LD Schema into <head>.
 * Works without react-helmet by manipulating document.head directly.
 */
export default function SeoHead({ title, description, canonical, ogImage, schemas }: SeoHeadProps) {
  useEffect(() => {
    // Title
    document.title = title;

    // Helper: upsert a <meta> tag
    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    // Standard meta
    setMeta('name', 'description', description);
    setMeta('name', 'robots', 'index, follow');

    // Open Graph
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:url', canonical);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    if (ogImage) {
      setMeta('property', 'og:image', ogImage);
      setMeta('property', 'og:image:width', '1200');
      setMeta('property', 'og:image:height', '630');
    }

    // Twitter Card
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:url', canonical);
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    if (ogImage) setMeta('name', 'twitter:image', ogImage);

    // Canonical link
    let linkEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!linkEl) {
      linkEl = document.createElement('link');
      linkEl.setAttribute('rel', 'canonical');
      document.head.appendChild(linkEl);
    }
    linkEl.setAttribute('href', canonical);

    // JSON-LD Schema(s)
    // Remove previous schemas injected by this component
    document.querySelectorAll('script[data-seo-head]').forEach(el => el.remove());
    if (schemas && schemas.length > 0) {
      schemas.forEach((schema, i) => {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.setAttribute('data-seo-head', `schema-${i}`);
        script.textContent = JSON.stringify(schema);
        document.head.appendChild(script);
      });
    }

    // Cleanup on unmount
    return () => {
      document.querySelectorAll('script[data-seo-head]').forEach(el => el.remove());
    };
  }, [title, description, canonical, ogImage, schemas]);

  return null;
}
