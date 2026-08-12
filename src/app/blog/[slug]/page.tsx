import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPublishedPostBySlugSafe,
  getPublishedSlugsSafe,
} from "@/lib/blog-posts";
import { BUSINESS_ID, SITE_URL, breadcrumbJsonLd } from "@/lib/site";
import type { BlogPostRecord } from "@/lib/blog";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 60;

/**
 * Prerender the posts that exist at build time. `dynamicParams` stays at its
 * default of `true`, so a post published after the build still renders on
 * first request rather than 404ing until the next deploy.
 *
 * The `…Safe` read is what keeps this from failing the build: CI runs with a
 * deliberately unreachable MONGODB_URI, and an uncaught throw here is a red
 * build that the other four gates all report green.
 */
export async function generateStaticParams() {
  const slugs = await getPublishedSlugsSafe("blog generateStaticParams");
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlugSafe("blog metadata", slug);

  // A bare `{}` would leave an unknown slug inheriting the root title on a
  // 404, which is what the service-area pages had to fix.
  if (!post) return { title: "Post Not Found", robots: { index: false } };

  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt || "";

  return {
    title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/blog/${post.slug}`,
      images: [
        post.coverImagePath
          ? `${SITE_URL}${post.coverImagePath}`
          : `${SITE_URL}/og-image.jpg`,
      ],
      type: "article",
      publishedTime: post.publishedAt
        ? new Date(post.publishedAt).toISOString()
        : undefined,
      modifiedTime: new Date(post.updatedAt).toISOString(),
    },
  };
}

/**
 * `publisher` points at the shared LocalBusiness `@id` rather than describing
 * a second organisation, so these pages reinforce one entity instead of
 * competing with it — the same choice the service-area `Service` nodes make.
 */
function buildArticleJsonLd(post: BlogPostRecord) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.seoDescription || post.excerpt || undefined,
    image: post.coverImagePath
      ? `${SITE_URL}${post.coverImagePath}`
      : `${SITE_URL}/og-image.jpg`,
    datePublished: post.publishedAt
      ? new Date(post.publishedAt).toISOString()
      : undefined,
    dateModified: new Date(post.updatedAt).toISOString(),
    author: { "@type": "Organization", name: post.author || "SATX Ritas" },
    publisher: { "@id": BUSINESS_ID },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/blog/${post.slug}`,
    },
  };
}

function formatDate(value?: Date | string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPublishedPostBySlugSafe("blog post page", slug);

  // Covers an unknown slug and a draft alike — `getPublishedPostBySlug`
  // filters on status at the query, so a draft is unreachable even by someone
  // who guesses the URL.
  if (!post) notFound();

  const breadcrumbs = breadcrumbJsonLd([
    { name: "Blog", path: "/blog" },
    { name: post.title, path: `/blog/${post.slug}` },
  ]);

  return (
    <main className="min-h-screen bg-light dark:bg-charcoal">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildArticleJsonLd(post)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />

      <article className="max-w-3xl mx-auto px-4 py-16">
        <nav className="mb-8 text-sm">
          <Link
            href="/blog"
            className="text-margarita dark:text-margarita-dark hover:underline"
          >
            ← All posts
          </Link>
        </nav>

        <h1 className="text-4xl font-bold text-charcoal dark:text-white">
          {post.title}
        </h1>

        {post.publishedAt && (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            <time dateTime={new Date(post.publishedAt).toISOString()}>
              {formatDate(post.publishedAt)}
            </time>
          </p>
        )}

        {post.coverImagePath && (
          <div className="relative aspect-16/9 mt-8 rounded-lg overflow-hidden">
            <Image
              src={post.coverImagePath}
              alt={post.coverImageAlt ?? ""}
              fill
              sizes="(min-width: 768px) 768px, 100vw"
              priority
              className="object-cover"
            />
          </div>
        )}

        {/*
          The body is HTML the admin authored. The CSP carries
          `script-src 'unsafe-inline'` for the GTM and JSON-LD bootstrap, so
          the boundary keeping this safe is that only the authenticated admin
          can reach /api/admin/blog — not any sanitisation on this side. See
          `hasDangerousHtml` in src/lib/blog.ts.
        */}
        <div
          className="blog-body max-w-none mt-10 text-charcoal dark:text-gray-200"
          dangerouslySetInnerHTML={{ __html: post.body }}
        />

        <footer className="mt-16 border-t border-gray-200 dark:border-gray-700 pt-8">
          <Link
            href="/order"
            className="inline-block bg-teal hover:bg-teal/90 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Check availability for your date
          </Link>
        </footer>
      </article>
    </main>
  );
}
