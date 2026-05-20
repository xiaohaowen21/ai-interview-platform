import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, ExternalLink, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useI18n } from '../i18n/I18nContext';
import {
  fetchCareerArticleIndex,
  fetchCareerArticleMarkdown,
  stripMarkdownFrontmatter,
  type CareerArticleIndex,
  type CareerArticleItem,
} from '../utils/careerArticles';

export default function CareerArticleDetailPage() {
  const { articleId } = useParams();
  const { locale } = useI18n();
  const [index, setIndex] = useState<CareerArticleIndex | null>(null);
  const [article, setArticle] = useState<CareerArticleItem | null>(null);
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const copy = locale === 'zh'
    ? {
        backLabel: '返回文章列表',
        openSource: '打开原文',
        sourceLabel: '文章来源',
        previousLabel: '上一篇',
        nextLabel: '下一篇',
        articleMissing: '没有找到这篇文章。',
        loadFailed: '文章加载失败，请稍后再试。',
      }
    : {
        backLabel: 'Back to Articles',
        openSource: 'Open Source',
        sourceLabel: 'Source',
        previousLabel: 'Previous',
        nextLabel: 'Next',
        articleMissing: 'Article not found.',
        loadFailed: 'Failed to load the article.',
      };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [articleId]);

  useEffect(() => {
    let cancelled = false;

    const loadArticle = async () => {
      if (!articleId) {
        return;
      }

      setLoading(true);
      setError('');

      try {
        const nextIndex = await fetchCareerArticleIndex();
        const nextArticle = nextIndex.items.find((item) => item.articleId === articleId) ?? null;

        if (!nextArticle) {
          if (!cancelled) {
            setIndex(nextIndex);
            setArticle(null);
            setMarkdown('');
            setError(copy.articleMissing);
          }
          return;
        }

        const articleMarkdown = await fetchCareerArticleMarkdown(nextArticle.fileName);
        if (!cancelled) {
          setIndex(nextIndex);
          setArticle(nextArticle);
          setMarkdown(stripMarkdownFrontmatter(articleMarkdown));
        }
      } catch (loadError) {
        console.error('Failed to load career article detail', loadError);
        if (!cancelled) {
          setError(copy.loadFailed);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadArticle();

    return () => {
      cancelled = true;
    };
  }, [articleId, copy.articleMissing, copy.loadFailed]);

  if (!articleId) {
    return <Navigate to="/career-articles" replace />;
  }

  const currentIndex = article && index ? index.items.findIndex((item) => item.articleId === article.articleId) : -1;
  const previousArticle = currentIndex > 0 && index ? index.items[currentIndex - 1] : null;
  const nextArticle = currentIndex >= 0 && index && currentIndex < index.items.length - 1 ? index.items[currentIndex + 1] : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          to="/career-articles"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {copy.backLabel}
        </Link>
      </div>

      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-[32px] border border-slate-200 bg-white/95 shadow-sm dark:border-slate-700 dark:bg-slate-800/95">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      ) : error || !article ? (
        <div className="rounded-[32px] border border-red-200 bg-red-50 px-6 py-10 text-red-700 shadow-sm dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          {error || copy.articleMissing}
        </div>
      ) : (
        <>
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-[36px] border border-slate-200 bg-[radial-gradient(circle_at_top_right,_rgba(20,184,166,0.18),_transparent_32%),linear-gradient(135deg,_#ffffff_0%,_#f8fafc_48%,_#ecfeff_100%)] p-8 shadow-sm dark:border-slate-700 dark:bg-[radial-gradient(circle_at_top_right,_rgba(20,184,166,0.15),_transparent_30%),linear-gradient(135deg,_rgba(15,23,42,0.98)_0%,_rgba(2,6,23,0.98)_100%)]"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-900">{article.category}</span>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">{article.publishedAt || '--'}</span>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">{article.readCount || '--'}</span>
            </div>

            <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-900 dark:text-white">{article.title}</h1>
            <p className="mt-5 text-sm leading-7 text-slate-600 dark:text-slate-300">{article.summary}</p>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-dashed border-slate-200 pt-5 dark:border-slate-700">
              <div className="space-y-1 text-sm text-slate-500 dark:text-slate-400">
                <p>{copy.sourceLabel}</p>
                <p className="font-semibold text-slate-900 dark:text-white">{article.author}</p>
              </div>
              <a
                href={article.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                {copy.openSource}
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </motion.section>

          <motion.article
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="rounded-[36px] border border-slate-200 bg-white/95 p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800/95"
          >
            <div className="prose prose-slate max-w-none prose-headings:font-bold prose-h1:mb-4 prose-h2:mt-10 prose-h2:text-2xl prose-h3:mt-8 prose-h3:text-xl prose-p:text-slate-700 prose-p:leading-8 prose-li:leading-8 prose-strong:text-slate-900 prose-a:text-teal-700 dark:prose-invert dark:prose-p:text-slate-300 dark:prose-strong:text-white">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
            </div>
          </motion.article>

          {(previousArticle || nextArticle) ? (
            <section className="grid gap-4 md:grid-cols-2">
              {previousArticle ? (
                <Link
                  to={`/career-articles/${previousArticle.articleId}/${previousArticle.slug}`}
                  className="group rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-sm transition hover:border-amber-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/95 dark:hover:border-amber-700"
                >
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{copy.previousLabel}</p>
                  <h2 className="mt-3 text-lg font-bold text-slate-900 transition group-hover:text-amber-600 dark:text-white dark:group-hover:text-amber-300">{previousArticle.title}</h2>
                  <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                    <ArrowLeft className="h-4 w-4" />
                    {previousArticle.category}
                  </div>
                </Link>
              ) : <div />}

              {nextArticle ? (
                <Link
                  to={`/career-articles/${nextArticle.articleId}/${nextArticle.slug}`}
                  className="group rounded-[28px] border border-slate-200 bg-white/95 p-5 text-right shadow-sm transition hover:border-amber-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/95 dark:hover:border-amber-700"
                >
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{copy.nextLabel}</p>
                  <h2 className="mt-3 text-lg font-bold text-slate-900 transition group-hover:text-amber-600 dark:text-white dark:group-hover:text-amber-300">{nextArticle.title}</h2>
                  <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                    {nextArticle.category}
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              ) : <div />}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
