import { useDeferredValue, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, FileText, Loader2, Search, Sparkles } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { fetchCareerArticleIndex, normalizeSearchValue, type CareerArticleIndex } from '../utils/careerArticles';

export default function CareerArticlesPage() {
  const { locale } = useI18n();
  const [index, setIndex] = useState<CareerArticleIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const deferredSearch = useDeferredValue(searchValue);

  const copy = locale === 'zh'
    ? {
        heroBadge: '内容模块',
        title: '求职攻略',
        searchPlaceholder: '搜索标题、分类或摘要',
        allCategories: '全部分类',
        articleCount: '篇文章',
        emptyTitle: '没有匹配到文章',
        emptyDesc: '换个关键词，或者切回全部分类再看看。',
        readMore: '查看文章',
        pagePrefix: '第',
        pageSuffix: '页',
        totalPrefix: '共',
      }
    : {
        heroBadge: 'Content Module',
        title: 'Career Guides',
        searchPlaceholder: 'Search titles, categories, or summaries',
        allCategories: 'All Categories',
        articleCount: 'articles',
        emptyTitle: 'No matching articles',
        emptyDesc: 'Try another keyword or switch back to all categories.',
        readMore: 'Open Article',
        pagePrefix: 'Page ',
        pageSuffix: '',
        totalPrefix: 'Total',
      };

  useEffect(() => {
    let cancelled = false;

    const loadIndex = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchCareerArticleIndex();
        if (!cancelled) {
          setIndex(data);
        }
      } catch (loadError) {
        console.error('Failed to load career articles index', loadError);
        if (!cancelled) {
          setError(locale === 'zh' ? '文章索引加载失败，请稍后再试。' : 'Failed to load the article index.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadIndex();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const normalizedSearch = normalizeSearchValue(deferredSearch);
  const pageNumbers = index
    ? Array.from({ length: index.endPage - index.startPage + 1 }, (_, position) => index.startPage + position)
    : [];
  const categories = index
    ? Array.from(new Set(index.items.map((item) => item.category).filter(Boolean)))
    : [];

  const filteredItems = index
    ? index.items.filter((item) => {
        if (selectedCategory !== 'all' && item.category !== selectedCategory) {
          return false;
        }
        if (!normalizedSearch) {
          return true;
        }
        const haystack = normalizeSearchValue(`${item.title}${item.category}${item.summary}`);
        return haystack.includes(normalizedSearch);
      })
    : [];
  const visibleItems = filteredItems.filter((item) => item.pageNumber === currentPage);
  const pagesWithResults = new Set(filteredItems.map((item) => item.pageNumber));
  const activePageNumbers = pageNumbers.filter((pageNumber) => pagesWithResults.has(pageNumber));
  const currentActivePageIndex = activePageNumbers.indexOf(currentPage);
  const previousPage = currentActivePageIndex > 0 ? activePageNumbers[currentActivePageIndex - 1] : undefined;
  const nextPage = currentActivePageIndex >= 0 ? activePageNumbers[currentActivePageIndex + 1] : undefined;
  const paginationItems = (() => {
    if (activePageNumbers.length <= 5) {
      return activePageNumbers;
    }

    if (currentActivePageIndex <= 2) {
      return [...activePageNumbers.slice(0, 5), 'ellipsis-right'] as const;
    }

    if (currentActivePageIndex >= activePageNumbers.length - 3) {
      return ['ellipsis-left', ...activePageNumbers.slice(-5)] as const;
    }

    return [
      activePageNumbers[0],
      'ellipsis-left',
      activePageNumbers[currentActivePageIndex - 1],
      activePageNumbers[currentActivePageIndex],
      activePageNumbers[currentActivePageIndex + 1],
      'ellipsis-right',
      activePageNumbers[activePageNumbers.length - 1],
    ] as const;
  })();

  useEffect(() => {
    if (!index || filteredItems.length === 0) {
      return;
    }

    if (!pagesWithResults.has(currentPage)) {
      setCurrentPage(filteredItems[0].pageNumber);
    }
  }, [currentPage, filteredItems, index, pagesWithResults]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-[36px] border border-amber-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.28),_transparent_42%),linear-gradient(135deg,_#fff7ed_0%,_#ffffff_48%,_#f0fdfa_100%)] p-8 shadow-sm dark:border-amber-900/30 dark:bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.16),_transparent_38%),linear-gradient(135deg,_rgba(15,23,42,0.96)_0%,_rgba(2,6,23,0.98)_100%)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/80 bg-white/70 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-amber-700 backdrop-blur dark:border-amber-700/60 dark:bg-slate-900/60 dark:text-amber-300">
              <Sparkles className="h-3.5 w-3.5" />
              {copy.heroBadge}
            </span>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-900 dark:text-white">{copy.title}</h1>
          </div>
        </div>
      </motion.section>

      <section className="rounded-[32px] border border-slate-200 bg-white/95 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/95">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder={copy.searchPlaceholder}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-amber-500"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {copy.allCategories}
            </button>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  selectedCategory === category
                    ? 'bg-amber-500 text-white'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-900/40'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-[32px] border border-slate-200 bg-white/95 shadow-sm dark:border-slate-700 dark:bg-slate-800/95">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      ) : error ? (
        <div className="rounded-[32px] border border-red-200 bg-red-50 px-6 py-8 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-[32px] border border-slate-200 bg-white/95 px-6 py-10 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800/95">
          <BookOpen className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
          <h2 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">{copy.emptyTitle}</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{copy.emptyDesc}</p>
        </div>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-900 dark:text-white">{visibleItems.length}</span> / {filteredItems.length} {copy.articleCount}
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {visibleItems.map((item, indexPosition) => (
              <motion.article
                key={`${item.articleId}-${item.fileName}`}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(indexPosition * 0.02, 0.25) }}
                className="group flex h-full flex-col rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/95 dark:hover:border-amber-700"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-900">{copy.pagePrefix}{item.pageNumber}{copy.pageSuffix}</span>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">{item.category}</span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">{item.publishedAt || '--'}</span>
                </div>

                <h2 className="mt-4 text-xl font-bold leading-8">
                  <Link
                    to={`/career-articles/${item.articleId}/${item.slug}`}
                    className="text-slate-900 transition hover:text-amber-600 dark:text-white dark:hover:text-amber-300"
                  >
                    {item.title}
                  </Link>
                </h2>

                <p className="mt-3 line-clamp-4 text-sm leading-7 text-slate-600 dark:text-slate-300">{item.summary}</p>

                <div className="mt-6 flex items-center justify-between gap-3 border-t border-dashed border-slate-200 pt-4 dark:border-slate-700">
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <FileText className="h-4 w-4" />
                    <span>{item.readCount || '--'}</span>
                  </div>

                  <Link
                    to={`/career-articles/${item.articleId}/${item.slug}`}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 transition hover:text-amber-600 dark:text-white dark:hover:text-amber-300"
                  >
                    {copy.readMore}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </motion.article>
            ))}
          </div>

          <div className="flex justify-center pt-6">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                disabled={!previousPage}
                onClick={() => previousPage && setCurrentPage(previousPage)}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                  previousPage
                    ? 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-amber-50 hover:text-amber-700 hover:ring-amber-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700'
                    : 'cursor-not-allowed bg-slate-100 text-slate-300 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-600 dark:ring-slate-800'
                }`}
              >
                上一页
              </button>

              {paginationItems.map((item) => {
                if (typeof item !== 'number') {
                  return (
                    <span
                      key={item}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700"
                    >
                      ...
                    </span>
                  );
                }

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCurrentPage(item)}
                    className={`h-11 w-11 rounded-full text-sm font-semibold transition ${
                      currentPage === item
                        ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                        : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-amber-50 hover:text-amber-700 hover:ring-amber-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}

              <button
                type="button"
                disabled={!nextPage}
                onClick={() => nextPage && setCurrentPage(nextPage)}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                  nextPage
                    ? 'bg-slate-900 text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200'
                    : 'cursor-not-allowed bg-slate-100 text-slate-300 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-600 dark:ring-slate-800'
                }`}
              >
                下一页
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
