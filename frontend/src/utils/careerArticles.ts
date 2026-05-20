export interface CareerArticleItem {
  pageNumber: number;
  articleId: string;
  title: string;
  slug: string;
  fileName: string;
  url: string;
  author: string;
  publishedAt: string;
  category: string;
  summary: string;
  readCount: string;
}

export interface CareerArticleIndex {
  source: string;
  startPage: number;
  endPage: number;
  articleCount: number;
  items: CareerArticleItem[];
}

function resolvePublicPath(pathname: string) {
  return `${import.meta.env.BASE_URL}${pathname.replace(/^\/+/, '')}`;
}

export async function fetchCareerArticleIndex(): Promise<CareerArticleIndex> {
  const response = await fetch(resolvePublicPath('/content/jianliben/index.json'));
  if (!response.ok) {
    throw new Error(`Failed to load article index: ${response.status}`);
  }
  return (await response.json()) as CareerArticleIndex;
}

export async function fetchCareerArticleMarkdown(fileName: string): Promise<string> {
  const response = await fetch(resolvePublicPath(`/content/jianliben/articles/${encodeURIComponent(fileName)}`));
  if (!response.ok) {
    throw new Error(`Failed to load article markdown: ${response.status}`);
  }
  return response.text();
}

export function stripMarkdownFrontmatter(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();
}

export function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}
