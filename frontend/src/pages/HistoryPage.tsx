import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Download, FileText, Search, Trash2, User } from 'lucide-react';
import { historyApi, type ResumeDetail, type ResumeListItem } from '../api/history';
import DeleteConfirmDialog from '../components/DeleteConfirmDialog';
import { useI18n } from '../i18n/I18nContext';
import { formatDateOnly } from '../utils/date';
import { setLastViewedResumeId } from '../utils/resumeNavigation';
import { getScoreProgressColor } from '../utils/score';

interface HistoryPageProps {
  onSelectResume: (id: number) => void;
}

interface ResumePreviewInfo {
  candidateName: string;
  phone: string;
  email: string;
  targetRole: string;
  education: string;
  summary: string;
  highlights: string[];
  contentPreview: string[];
}

function extractKeywordsFromText(text: string): string[] {
  const cleaned = text.replace(/[\r\n]/g, ' ');
  const words = cleaned
    .split(/[，。；、,.!?/|()\[\]【】“”"'《》\s-]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2 && word.length <= 12);
  const unique = Array.from(new Set(words));
  return unique.slice(0, 4);
}

function buildPreviewInfo(detail: ResumeDetail): ResumePreviewInfo {
  const resumeText = detail.resumeText || '';
  const lines = resumeText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const analysis = detail.analyses?.[0];
  const filenameTitle = detail.filename.replace(/\.[^.]+$/, '');
  const candidateName = lines.find((line) => line.length >= 2 && line.length <= 16) || filenameTitle;

  const emailMatch = resumeText.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  const phoneMatch = resumeText.match(/(?:\+?86[-\s]?)?(1[3-9]\d{9})/);
  const roleLine =
    lines.find((line) =>
      /(工程师|开发|产品|运营|测试|算法|数据|设计|经理|销售|市场|顾问|财务|行政|教师|护士|医生)/.test(line),
    ) || '';
  const educationLine =
    lines.find((line) => /(本科|大专|硕士|博士|研究生|MBA|学士|college|university)/i.test(line)) || '';

  const summary =
    analysis?.summary?.trim() ||
    lines.slice(0, 5).join(' ').slice(0, 180) ||
    '暂无内容摘要';

  const highlights =
    (analysis?.strengths || []).filter((item) => typeof item === 'string' && item.trim().length > 0).slice(0, 4) ||
    [];
  const fallbackHighlights = extractKeywordsFromText(lines.join(' '));

  return {
    candidateName,
    phone: phoneMatch?.[1] || '-',
    email: emailMatch?.[0] || '-',
    targetRole: roleLine || '待识别',
    education: educationLine || '待识别',
    summary,
    highlights: highlights.length > 0 ? highlights : fallbackHighlights,
    contentPreview: lines.slice(0, 12),
  };
}

export default function HistoryPage({ onSelectResume }: HistoryPageProps) {
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; filename: string } | null>(null);
  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null);
  const [previewMap, setPreviewMap] = useState<Record<number, ResumePreviewInfo>>({});
  const [loadingPreviewIds, setLoadingPreviewIds] = useState<number[]>([]);
  const { locale, t } = useI18n();
  const isZh = locale === 'zh';

  const loadResumes = async () => {
    setLoading(true);
    try {
      const data = await historyApi.getResumes();
      setResumes(data);
      setSelectedResumeId((prev) => {
        if (prev && data.some((item) => item.id === prev)) {
          return prev;
        }
        return data[0]?.id ?? null;
      });
    } catch (error) {
      console.error('加载简历历史失败', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadResumes();
  }, []);

  const filteredResumes = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) {
      return resumes;
    }
    return resumes.filter((resume) => resume.filename.toLowerCase().includes(keyword));
  }, [resumes, searchTerm]);

  useEffect(() => {
    if (filteredResumes.length === 0) {
      setSelectedResumeId(null);
      return;
    }
    if (!selectedResumeId || !filteredResumes.some((item) => item.id === selectedResumeId)) {
      setSelectedResumeId(filteredResumes[0].id);
    }
  }, [filteredResumes, selectedResumeId]);

  const selectedResume = useMemo(
    () => filteredResumes.find((resume) => resume.id === selectedResumeId) ?? null,
    [filteredResumes, selectedResumeId],
  );
  const selectedPreview = selectedResume ? previewMap[selectedResume.id] : null;
  const selectedPreviewLoading =
    selectedResume !== null && loadingPreviewIds.includes(selectedResume.id);

  const loadResumePreview = useCallback(
    async (resumeId: number) => {
      if (previewMap[resumeId] || loadingPreviewIds.includes(resumeId)) {
        return;
      }

      setLoadingPreviewIds((prev) => (prev.includes(resumeId) ? prev : [...prev, resumeId]));
      try {
        const detail = await historyApi.getResumeDetail(resumeId);
        setPreviewMap((prev) => ({ ...prev, [resumeId]: buildPreviewInfo(detail) }));
      } catch (error) {
        console.error('加载简历预览失败', error);
      } finally {
        setLoadingPreviewIds((prev) => prev.filter((id) => id !== resumeId));
      }
    },
    [loadingPreviewIds, previewMap],
  );

  useEffect(() => {
    if (!selectedResumeId) {
      return;
    }
    void loadResumePreview(selectedResumeId);
  }, [loadResumePreview, selectedResumeId]);

  useEffect(() => {
    if (!selectedResumeId) {
      return;
    }
    setLastViewedResumeId(selectedResumeId);
  }, [selectedResumeId]);

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) {
      return;
    }
    setDeletingId(deleteConfirm.id);
    try {
      await historyApi.deleteResume(deleteConfirm.id);
      setDeleteConfirm(null);
      await loadResumes();
    } catch (error) {
      alert(error instanceof Error ? error.message : t('history.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <motion.div className="w-full min-h-[800px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('history.title')}</h1>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={t('history.searchPlaceholder')}
            className="w-56 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <motion.aside
          className="lg:col-span-1"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm h-full min-h-[700px] dark:border-slate-700 dark:bg-slate-800">
            <div className="p-6">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    {selectedResume ? selectedResume.filename : (isZh ? '暂无简历' : 'No Resume')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isZh ? '悬停右侧列表即可切换预览' : 'Hover rows to switch preview'}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{isZh ? '候选人信息' : 'Candidate'}</p>
                  <p className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                    {selectedPreview?.candidateName || (selectedPreviewLoading ? (isZh ? '正在读取...' : 'Loading...') : '-')}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-300">
                    <div>
                      <p className="text-slate-400 dark:text-slate-500">{isZh ? '手机号' : 'Phone'}</p>
                      <p className="mt-0.5">{selectedPreview?.phone || '-'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 dark:text-slate-500">{isZh ? '邮箱' : 'Email'}</p>
                      <p className="mt-0.5 truncate">{selectedPreview?.email || '-'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 dark:text-slate-500">{isZh ? '岗位方向' : 'Role'}</p>
                      <p className="mt-0.5 truncate">{selectedPreview?.targetRole || '-'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 dark:text-slate-500">{isZh ? '学历信息' : 'Education'}</p>
                      <p className="mt-0.5 truncate">{selectedPreview?.education || '-'}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {isZh ? '上传时间' : 'Uploaded At'}
                  </h4>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {selectedResume ? formatDateOnly(selectedResume.uploadedAt) : '-'}
                  </p>
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {isZh ? '综合评分' : 'Overall Score'}
                  </h4>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                      <div
                        className={`h-full rounded-full ${getScoreProgressColor(selectedResume?.latestScore ?? 0)}`}
                        style={{ width: `${Math.max(0, Math.min(100, selectedResume?.latestScore ?? 0))}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {selectedResume?.latestScore ?? '-'}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {isZh ? '简历关键词' : 'Keywords'}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {(selectedPreview?.highlights || []).length > 0 ? (
                      (selectedPreview?.highlights || []).map((item) => (
                        <span
                          key={item}
                          className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-200"
                        >
                          {item}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {selectedPreviewLoading ? (isZh ? '正在提取...' : 'Extracting...') : '-'}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {isZh ? '简历摘要' : 'Summary'}
                  </h4>
                  <p className="max-h-[120px] overflow-y-auto rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                    {selectedPreview?.summary || (selectedPreviewLoading ? (isZh ? '正在解析简历内容...' : 'Parsing resume...') : '-')}
                  </p>
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {isZh ? '简历内容预览' : 'Resume Preview'}
                  </h4>
                  <div className="max-h-[220px] space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
                    {(selectedPreview?.contentPreview || []).length > 0 ? (
                      (selectedPreview?.contentPreview || []).map((line, index) => (
                        <p key={`${index}-${line}`} className="border-b border-dashed border-slate-100 pb-2 last:border-b-0 last:pb-0 dark:border-slate-800">
                          {line}
                        </p>
                      ))
                    ) : (
                      <p className="text-slate-400 dark:text-slate-500">
                        {selectedPreviewLoading ? (isZh ? '正在载入正文内容...' : 'Loading content...') : '-'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                disabled={!selectedResume}
                onClick={() => selectedResume && onSelectResume(selectedResume.id)}
              >
                {isZh ? '进入详情' : 'Open Details'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.aside>

        <motion.section
          className="lg:col-span-3"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm h-full min-h-[700px] dark:border-slate-700 dark:bg-slate-800">
            <div className="border-b border-slate-200 p-4 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {isZh ? '简历列表' : 'Resume List'}
                </h3>
                <button type="button" className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <Download className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="py-10 text-center">
                  <motion.div
                    className="mx-auto mb-4 h-8 w-8 rounded-full border-[2px] border-slate-200 border-t-slate-500"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                  <p className="text-slate-500 dark:text-slate-400">{t('common.loading')}</p>
                </div>
              ) : filteredResumes.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500">
                    <FileText className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 font-semibold text-slate-700 dark:text-slate-300">{t('history.emptyTitle')}</h3>
                  <p className="text-slate-500 dark:text-slate-400">{t('history.emptyDesc')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-dashed border-black bg-slate-50 dark:border-slate-300 dark:bg-slate-900">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('history.resumeName')}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('history.uploadedAt')}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('history.score')}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('history.status')}</th>
                        <th className="w-20 px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {filteredResumes.map((resume, index) => {
                          const selected = selectedResumeId === resume.id;
                          return (
                            <motion.tr
                              key={resume.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.03 }}
                              onMouseEnter={() => {
                                setSelectedResumeId(resume.id);
                                void loadResumePreview(resume.id);
                              }}
                              onClick={() => onSelectResume(resume.id)}
                              className={`cursor-pointer border-b border-dashed border-black hover:bg-slate-50 dark:border-slate-300 dark:hover:bg-slate-700 ${selected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                            >
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                    <FileText className="h-4 w-4" />
                                  </div>
                                  <span className="font-medium text-slate-900 dark:text-white">{resume.filename}</span>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-slate-500 dark:text-slate-400">{formatDateOnly(resume.uploadedAt)}</td>
                              <td className="px-4 py-4">
                                {resume.latestScore !== undefined ? (
                                  <div className="flex items-center gap-2">
                                    <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                                      <div className={`h-full rounded-full ${getScoreProgressColor(resume.latestScore)}`} style={{ width: `${resume.latestScore}%` }} />
                                    </div>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{resume.latestScore}</span>
                                  </div>
                                ) : (
                                  <span className="text-sm text-slate-400 dark:text-slate-500">-</span>
                                )}
                              </td>
                              <td className="px-4 py-4">
                                <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${resume.interviewCount > 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>
                                  {resume.interviewCount > 0 ? t('history.completed') : t('history.pending')}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <button
                                  type="button"
                                  title={t('history.deleteTitle')}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setDeleteConfirm({ id: resume.id, filename: resume.filename });
                                  }}
                                  disabled={deletingId === resume.id}
                                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950/40"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </motion.section>
      </div>

      <DeleteConfirmDialog
        open={deleteConfirm !== null}
        item={deleteConfirm}
        itemType={t('history.deleteTitle')}
        loading={deletingId !== null}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
      />
    </motion.div>
  );
}
