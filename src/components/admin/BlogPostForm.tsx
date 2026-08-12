"use client";

import { useEffect, useState } from "react";
import {
  BLOG_STATUSES,
  MAX_BODY_LENGTH,
  MAX_EXCERPT_LENGTH,
  MAX_TITLE_LENGTH,
  slugify,
  type BlogPostRecord,
} from "@/lib/blog";

interface BlogPostFormProps {
  post?: BlogPostRecord | null;
  onSuccess: () => void;
  onCancel: () => void;
}

interface FormState {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImagePath: string;
  coverImageAlt: string;
  tags: string;
  status: string;
  seoTitle: string;
  seoDescription: string;
}

const EMPTY: FormState = {
  slug: "",
  title: "",
  excerpt: "",
  body: "",
  coverImagePath: "",
  coverImageAlt: "",
  tags: "",
  status: "draft",
  seoTitle: "",
  seoDescription: "",
};

const inputClass =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal";

const labelClass =
  "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

export default function BlogPostForm({
  post,
  onSuccess,
  onCancel,
}: BlogPostFormProps) {
  const [formData, setFormData] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  // Once the admin types a slug by hand, the title must stop overwriting it.
  // Editing an existing post counts as hand-authored from the outset — a
  // published slug is a URL other people may already have linked to.
  const [slugLocked, setSlugLocked] = useState(false);

  useEffect(() => {
    if (!post) {
      setFormData(EMPTY);
      setSlugLocked(false);
      return;
    }

    setFormData({
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt ?? "",
      body: post.body ?? "",
      coverImagePath: post.coverImagePath ?? "",
      coverImageAlt: post.coverImageAlt ?? "",
      tags: (post.tags ?? []).join(", "),
      status: post.status,
      seoTitle: post.seoTitle ?? "",
      seoDescription: post.seoDescription ?? "",
    });
    setSlugLocked(true);
  }, [post]);

  const handleInputChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = event.target;

    setFormData((previous) => {
      if (name === "title" && !slugLocked) {
        return { ...previous, title: value, slug: slugify(value) };
      }
      return { ...previous, [name]: value };
    });
  };

  const handleSlugChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSlugLocked(true);
    setFormData((previous) => ({ ...previous, slug: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    // Named one by one, not spread: the server strips unknown fields anyway,
    // but sending only what the form owns keeps the two ends honest.
    const requestBody = {
      slug: formData.slug.trim(),
      title: formData.title.trim(),
      excerpt: formData.excerpt.trim(),
      body: formData.body,
      coverImagePath: formData.coverImagePath.trim(),
      coverImageAlt: formData.coverImageAlt.trim(),
      tags: formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      status: formData.status,
      seoTitle: formData.seoTitle.trim(),
      seoDescription: formData.seoDescription.trim(),
    };

    try {
      // Editing PUTs to the slug the post currently has; a changed `slug` in
      // the body is what moves it. The old URL stops resolving at that point.
      const url = post ? `/api/admin/blog/${post.slug}` : "/api/admin/blog";
      const method = post ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to save post");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save post");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 space-y-4"
    >
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        {post ? `Edit “${post.title}”` : "New Post"}
      </h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-sm">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="title">
            Title
          </label>
          <input
            id="title"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            maxLength={MAX_TITLE_LENGTH}
            required
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="slug">
            Slug
          </label>
          <input
            id="slug"
            name="slug"
            value={formData.slug}
            onChange={handleSlugChange}
            required
            className={`${inputClass} font-mono`}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {post
              ? "Changing this moves the post's public URL."
              : "Filled in from the title until you edit it."}
          </p>
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="excerpt">
          Excerpt
        </label>
        <textarea
          id="excerpt"
          name="excerpt"
          value={formData.excerpt}
          onChange={handleInputChange}
          maxLength={MAX_EXCERPT_LENGTH}
          rows={2}
          className={inputClass}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelClass} htmlFor="body">
            Body (HTML)
          </label>
          <button
            type="button"
            onClick={() => setShowPreview((value) => !value)}
            className="text-sm text-teal hover:underline"
          >
            {showPreview ? "Edit" : "Preview"}
          </button>
        </div>

        {showPreview ? (
          <div
            className="blog-body max-w-none rounded-lg border border-gray-300 dark:border-gray-600 p-4 min-h-[16rem] text-charcoal dark:text-gray-200"
            // Same content, same trust model as the public page: the admin
            // authored it and is the only one who can.
            dangerouslySetInnerHTML={{ __html: formData.body }}
          />
        ) : (
          <textarea
            id="body"
            name="body"
            value={formData.body}
            onChange={handleInputChange}
            maxLength={MAX_BODY_LENGTH}
            rows={16}
            required
            className={`${inputClass} font-mono text-sm`}
          />
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="coverImagePath">
            Cover image path
          </label>
          <input
            id="coverImagePath"
            name="coverImagePath"
            value={formData.coverImagePath}
            onChange={handleInputChange}
            placeholder="/images/blog/frozen-margarita.jpg"
            className={`${inputClass} font-mono`}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Site-relative only. Commit the file under <code>public/</code>.
          </p>
        </div>

        <div>
          <label className={labelClass} htmlFor="coverImageAlt">
            Cover image alt text
          </label>
          <input
            id="coverImageAlt"
            name="coverImageAlt"
            value={formData.coverImageAlt}
            onChange={handleInputChange}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="tags">
            Tags (comma separated)
          </label>
          <input
            id="tags"
            name="tags"
            value={formData.tags}
            onChange={handleInputChange}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="status">
            Status
          </label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleInputChange}
            className={inputClass}
          >
            {BLOG_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status === "published" ? "Published" : "Draft"}
              </option>
            ))}
          </select>
        </div>
      </div>

      <details className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
          SEO overrides
        </summary>
        <div className="mt-4 space-y-4">
          <div>
            <label className={labelClass} htmlFor="seoTitle">
              SEO title
            </label>
            <input
              id="seoTitle"
              name="seoTitle"
              value={formData.seoTitle}
              onChange={handleInputChange}
              maxLength={MAX_TITLE_LENGTH}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="seoDescription">
              SEO description
            </label>
            <textarea
              id="seoDescription"
              name="seoDescription"
              value={formData.seoDescription}
              onChange={handleInputChange}
              maxLength={MAX_EXCERPT_LENGTH}
              rows={2}
              className={inputClass}
            />
          </div>
        </div>
      </details>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="bg-teal hover:bg-teal/90 disabled:opacity-60 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          {submitting ? "Saving…" : post ? "Save changes" : "Create post"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
