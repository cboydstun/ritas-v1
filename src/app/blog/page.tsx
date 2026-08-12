import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getPublishedPostsSafe } from "@/lib/blog-posts";
import { SITE_URL, breadcrumbJsonLd } from "@/lib/site";

// Posts are edited at runtime through /admin/blog, so this page must not be
// frozen into the build the way /long-term-lease once froze its lease tiers.
export const revalidate = 60;

export const metadata: Metadata = {
  alternates: { canonical: "/blog" },
  title: "Margarita Machine Rental Tips & Party Ideas | SATX Ritas",
  description:
    "Frozen drink machine rental advice for San Antonio parties, weddings and events — planning tips, flavour guides and how our delivery works.",
  openGraph: {
    title: "Margarita Machine Rental Tips & Party Ideas",
    description:
      "Frozen drink machine rental advice for San Antonio parties, weddings and events.",
    url: `${SITE_URL}/blog`,
    images: [`${SITE_URL}/og-image.jpg`],
    type: "website",
  },
};

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

export default async function BlogIndexPage() {
  const posts = await getPublishedPostsSafe("/blog");
  const breadcrumbs = breadcrumbJsonLd([{ name: "Blog", path: "/blog" }]);

  return (
    <main className="min-h-screen bg-light dark:bg-charcoal">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />

      <div className="max-w-5xl mx-auto px-4 py-16">
        <header className="mb-12">
          <h1 className="text-4xl font-bold text-charcoal dark:text-white">
            The SATX Ritas Blog
          </h1>
          <p className="mt-3 text-lg text-gray-600 dark:text-gray-300">
            Party planning, frozen drink flavours and how margarita machine
            rental actually works in San Antonio.
          </p>
        </header>

        {/* An empty list is also what a failed database read looks like, and
            both should read as "nothing to show" rather than a broken page. */}
        {posts.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-300">
            No posts yet — check back soon.
          </p>
        ) : (
          <ul className="grid gap-8 md:grid-cols-2">
            {posts.map((post) => (
              <li
                key={post.slug}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden"
              >
                <Link href={`/blog/${post.slug}`} className="block">
                  {post.coverImagePath && (
                    <div className="relative aspect-16/9">
                      <Image
                        src={post.coverImagePath}
                        alt={post.coverImageAlt ?? ""}
                        fill
                        sizes="(min-width: 768px) 50vw, 100vw"
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="p-6">
                    <h2 className="text-xl font-semibold text-charcoal dark:text-white">
                      {post.title}
                    </h2>
                    {post.publishedAt && (
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(post.publishedAt)}
                      </p>
                    )}
                    {post.excerpt && (
                      <p className="mt-3 text-gray-600 dark:text-gray-300">
                        {post.excerpt}
                      </p>
                    )}
                    <span className="mt-4 inline-block font-medium text-margarita dark:text-margarita-dark">
                      Read more
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
