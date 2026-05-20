import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase,
  Download,
  FileText,
  GraduationCap,
  Plus,
  Save,
  Sparkles,
  Star,
  Trash2,
  User,
} from 'lucide-react';
import {
  resumeRewriteApi,
  type ResumeRewriteContent,
  type ResumeRewriteItem,
  type ResumeRewriteSectionItem,
  type ResumeRewriteStatus,
} from '../api/resumeRewrite';
import { formatDateTime } from '../utils/date';
import { getErrorMessage } from '../api/request';

interface ResumeRewritePanelProps {
  resumeId: number;
  filename: string;
}

function createEmptySectionItem(): ResumeRewriteSectionItem {
  return {
    title: '',
    subtitle: '',
    period: '',
    highlights: [],
  };
}

function createEmptyContent(): ResumeRewriteContent {
  return {
    profile: {
      fullName: '',
      phone: '',
      email: '',
      location: '',
      links: '',
    },
    targetPosition: '',
    professionalSummary: '',
    coreSkills: [],
    workExperiences: [],
    projectExperiences: [],
    educationExperiences: [],
    certifications: [],
    additionalInformation: [],
    optimizationHighlights: [],
  };
}

function linesToArray(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function arrayToLines(values?: string[]): string {
  return (values || []).join('\n');
}

function valueOrDash(value?: string | null): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '—';
}

function buildExportFilename(filename: string): string {
  const baseName = (filename || 'resume')
    .replace(/\.[^.]+$/, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim();

  return `优化简历_${baseName || 'resume'}.pdf`;
}

function getStatusMeta(status: ResumeRewriteStatus) {
  switch (status) {
    case 'COMPLETED':
      return {
        label: '已完成',
        className:
          'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300',
      };
    case 'PROCESSING':
      return {
        label: '生成中',
        className:
          'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300',
      };
    case 'FAILED':
      return {
        label: '失败',
        className:
          'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300',
      };
    default:
      return {
        label: '待处理',
        className:
          'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
      };
  }
}

export default function ResumeRewritePanel({ resumeId, filename }: ResumeRewritePanelProps) {
  const [rewrites, setRewrites] = useState<ResumeRewriteItem[]>([]);
  const [selectedRewriteId, setSelectedRewriteId] = useState<number | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [draft, setDraft] = useState<ResumeRewriteContent>(createEmptyContent());
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const applyRewrite = useCallback((rewrite: ResumeRewriteItem | null) => {
    if (!rewrite) {
      setSelectedRewriteId(null);
      setJobDescription('');
      setDraft(createEmptyContent());
      return;
    }

    setSelectedRewriteId(rewrite.id);
    setJobDescription(rewrite.jobDescription || '');
    setDraft(rewrite.content || createEmptyContent());
  }, []);

  const loadRewrites = useCallback(
    async (options?: { silent?: boolean; preferredId?: number }) => {
      if (!options?.silent) {
        setLoading(true);
      }

      try {
        setError(null);
        const data = await resumeRewriteApi.listByResume(resumeId);
        setRewrites(data);

        const nextId =
          options?.preferredId && data.some((item) => item.id === options.preferredId)
            ? options.preferredId
            : data[0]?.id ?? null;

        if (nextId) {
          const current = data.find((item) => item.id === nextId) ?? null;
          applyRewrite(current);
        } else {
          applyRewrite(null);
        }
      } catch (exception) {
        setError(getErrorMessage(exception));
      } finally {
        if (!options?.silent) {
          setLoading(false);
        }
      }
    },
    [applyRewrite, resumeId]
  );

  useEffect(() => {
    void loadRewrites();
  }, [loadRewrites]);

  const selectedRewrite = useMemo(
    () => rewrites.find((item) => item.id === selectedRewriteId) ?? null,
    [rewrites, selectedRewriteId]
  );

  const handleSelectRewrite = async (rewriteId: number) => {
    setLoadingDetail(true);
    setSuccessMessage(null);
    try {
      const detail = await resumeRewriteApi.getById(rewriteId);
      setRewrites((prev) => prev.map((item) => (item.id === detail.id ? detail : item)));
      applyRewrite(detail);
      setError(null);
    } catch (exception) {
      setError(getErrorMessage(exception));
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setSuccessMessage(null);
    try {
      const rewrite = await resumeRewriteApi.generate(resumeId, { jobDescription });
      setRewrites((prev) => [rewrite, ...prev.filter((item) => item.id !== rewrite.id)]);
      applyRewrite(rewrite);
      setError(null);
      setSuccessMessage('已生成新的优化版简历，可继续在线修改。');
    } catch (exception) {
      setError(getErrorMessage(exception));
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!selectedRewriteId) {
      setError('请先生成一版优化简历。');
      return;
    }

    setSaving(true);
    setSuccessMessage(null);
    try {
      const saved = await resumeRewriteApi.update(selectedRewriteId, {
        jobDescription,
        content: draft,
      });
      setRewrites((prev) => prev.map((item) => (item.id === saved.id ? saved : item)));
      applyRewrite(saved);
      setError(null);
      setSuccessMessage('优化版简历已保存。');
    } catch (exception) {
      setError(getErrorMessage(exception));
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (!selectedRewriteId) {
      setError('请先生成一版优化简历。');
      return;
    }

    setExporting(true);
    setSuccessMessage(null);
    try {
      const blob = await resumeRewriteApi.exportPdf(selectedRewriteId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = buildExportFilename(filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setError(null);
    } catch (exception) {
      setError(getErrorMessage(exception));
    } finally {
      setExporting(false);
    }
  };

  const updateProfileField = <K extends keyof ResumeRewriteContent['profile']>(
    key: K,
    value: ResumeRewriteContent['profile'][K]
  ) => {
    setDraft((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        [key]: value,
      },
    }));
  };

  const updateListField = (
    key:
      | 'coreSkills'
      | 'certifications'
      | 'additionalInformation'
      | 'optimizationHighlights',
    value: string
  ) => {
    setDraft((prev) => ({
      ...prev,
      [key]: linesToArray(value),
    }));
  };

  const updateSectionItems = (
    key: 'workExperiences' | 'projectExperiences' | 'educationExperiences',
    nextValue: ResumeRewriteSectionItem[]
  ) => {
    setDraft((prev) => ({
      ...prev,
      [key]: nextValue,
    }));
  };

  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center rounded-2xl bg-white dark:bg-slate-800">
        <motion.div
          className="h-12 w-12 rounded-full border-4 border-slate-200 border-t-primary-500 dark:border-slate-600"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 dark:bg-slate-800">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-slate-900 dark:text-white">
              <Sparkles className="h-5 w-5 text-primary-500" />
              <h3 className="text-lg font-semibold">简历优化</h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              基于当前简历和分析结果生成优化版，可继续在线修改并导出 PDF。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              <Sparkles className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
              {generating ? '生成中...' : rewrites.length > 0 ? '生成新版本' : '生成优化版'}
            </button>

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !selectedRewriteId}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Save className="h-4 w-4" />
              {saving ? '保存中...' : '保存修改'}
            </button>

            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={exporting || !selectedRewriteId}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Download className="h-4 w-4" />
              {exporting ? '导出中...' : '导出 PDF'}
            </button>
          </div>
        </div>

        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
          岗位描述 / 优化方向
        </label>
        <textarea
          value={jobDescription}
          onChange={(event) => setJobDescription(event.target.value)}
          rows={4}
          placeholder="可填写目标岗位、JD、关键词或你希望强化的方向；不填则按通用求职方向优化。"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-primary-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-primary-500"
        />

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300">
            {successMessage}
          </div>
        )}
      </div>

      {rewrites.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center dark:bg-slate-800">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-primary-500 dark:bg-primary-900/30">
            <FileText className="h-8 w-8" />
          </div>
          <h4 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">还没有优化版简历</h4>
          <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
            先填写岗位方向，再点击“生成优化版”，系统会基于当前简历给出可编辑版本。
          </p>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <Sparkles className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? '生成中...' : '立即生成'}
          </button>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[280px,minmax(0,1fr)]">
          <div className="rounded-2xl bg-white p-5 dark:bg-slate-800">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white">优化版本</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">共 {rewrites.length} 个版本</p>
              </div>
              {loadingDetail && (
                <motion.div
                  className="h-5 w-5 rounded-full border-2 border-slate-200 border-t-primary-500 dark:border-slate-600"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
              )}
            </div>

            <div className="space-y-3">
              {rewrites.map((item, index) => {
                const statusMeta = getStatusMeta(item.status);
                const isActive = item.id === selectedRewriteId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void handleSelectRewrite(item.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      isActive
                        ? 'border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/20'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700/70'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">版本 {rewrites.length - index}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                      {item.jobDescription || '通用优化方向'}
                    </p>
                    <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
                      更新时间：{formatDateTime(item.updatedAt)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <SectionCard
              icon={<FileText className="h-5 w-5" />}
              title="模板预览"
              description="实时预览导出样式，导出 PDF 将按同样版式生成。"
            >
              <ResumeTemplatePreview
                content={draft}
                sourceFilename={filename}
                jobDescription={jobDescription}
              />
            </SectionCard>

            {selectedRewrite?.errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                {selectedRewrite.errorMessage}
              </div>
            )}

            <SectionCard
              icon={<User className="h-5 w-5" />}
              title="基本信息"
              description="这里可以直接补齐联系方式、地址和链接。"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  label="姓名"
                  value={draft.profile.fullName}
                  onChange={(value) => updateProfileField('fullName', value)}
                />
                <TextField
                  label="电话"
                  value={draft.profile.phone}
                  onChange={(value) => updateProfileField('phone', value)}
                />
                <TextField
                  label="邮箱"
                  value={draft.profile.email}
                  onChange={(value) => updateProfileField('email', value)}
                />
                <TextField
                  label="所在城市"
                  value={draft.profile.location}
                  onChange={(value) => updateProfileField('location', value)}
                />
                <div className="md:col-span-2">
                  <TextField
                    label="个人链接"
                    value={draft.profile.links}
                    onChange={(value) => updateProfileField('links', value)}
                    placeholder="如：作品集 / GitHub / 领英 / 个人站"
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard
              icon={<Briefcase className="h-5 w-5" />}
              title="求职方向"
              description="用于明确简历投递目标和开头定位。"
            >
              <TextField
                label="目标岗位"
                value={draft.targetPosition}
                onChange={(value) => setDraft((prev) => ({ ...prev, targetPosition: value }))}
                placeholder="例如：产品经理 / Java 开发 / 运营专员"
              />
              <div className="mt-4">
                <TextareaField
                  label="个人简介"
                  value={draft.professionalSummary}
                  onChange={(value) => setDraft((prev) => ({ ...prev, professionalSummary: value }))}
                  rows={5}
                  placeholder="用 3-5 句话概括你的经历、优势和求职方向。"
                />
              </div>
            </SectionCard>

            <SectionCard
              icon={<Star className="h-5 w-5" />}
              title="能力与亮点"
              description="一行一个要点，适合技能、证书、补充说明和优化亮点。"
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <TextareaField
                  label="核心技能"
                  value={arrayToLines(draft.coreSkills)}
                  onChange={(value) => updateListField('coreSkills', value)}
                  rows={7}
                  placeholder="一行一个技能点"
                />
                <TextareaField
                  label="证书 / 资质"
                  value={arrayToLines(draft.certifications)}
                  onChange={(value) => updateListField('certifications', value)}
                  rows={7}
                  placeholder="一行一个证书"
                />
                <TextareaField
                  label="补充信息"
                  value={arrayToLines(draft.additionalInformation)}
                  onChange={(value) => updateListField('additionalInformation', value)}
                  rows={7}
                  placeholder="如语言能力、获奖、兴趣方向等"
                />
                <TextareaField
                  label="优化亮点"
                  value={arrayToLines(draft.optimizationHighlights)}
                  onChange={(value) => updateListField('optimizationHighlights', value)}
                  rows={7}
                  placeholder="总结这版简历重点强化了哪些亮点"
                />
              </div>
            </SectionCard>

            <EditableSectionCard
              icon={<Briefcase className="h-5 w-5" />}
              title="工作经历"
              description="支持新增、删除和逐段编辑。"
              items={draft.workExperiences}
              onChange={(items) => updateSectionItems('workExperiences', items)}
              addLabel="新增工作经历"
            />

            <EditableSectionCard
              icon={<FileText className="h-5 w-5" />}
              title="项目经历"
              description="适合写项目目标、职责、成果和量化结果。"
              items={draft.projectExperiences}
              onChange={(items) => updateSectionItems('projectExperiences', items)}
              addLabel="新增项目经历"
            />

            <EditableSectionCard
              icon={<GraduationCap className="h-5 w-5" />}
              title="教育经历"
              description="可填写学校、专业、时间和重点成果。"
              items={draft.educationExperiences}
              onChange={(items) => updateSectionItems('educationExperiences', items)}
              addLabel="新增教育经历"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      className="rounded-2xl bg-white p-6 dark:bg-slate-800"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-xl bg-primary-50 p-2 text-primary-500 dark:bg-primary-900/20 dark:text-primary-300">
          {icon}
        </div>
        <div>
          <h4 className="font-semibold text-slate-900 dark:text-white">{title}</h4>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
      {children}
    </motion.div>
  );
}

function EditableSectionCard({
  icon,
  title,
  description,
  items,
  onChange,
  addLabel,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  items: ResumeRewriteSectionItem[];
  onChange: (items: ResumeRewriteSectionItem[]) => void;
  addLabel: string;
}) {
  const updateItem = (index: number, nextItem: ResumeRewriteSectionItem) => {
    onChange(items.map((item, itemIndex) => (itemIndex === index ? nextItem : item)));
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <SectionCard icon={icon} title={title} description={description}>
      <div className="space-y-4">
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            暂无内容，可点击下方按钮新增。
          </div>
        )}

        {items.map((item, index) => (
          <div
            key={`${title}-${index}`}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {title} {index + 1}
              </span>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="h-4 w-4" />
                删除
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                label="标题"
                value={item.title}
                onChange={(value) => updateItem(index, { ...item, title: value })}
                placeholder="例如：高级产品经理 / XXX 项目"
              />
              <TextField
                label="副标题"
                value={item.subtitle}
                onChange={(value) => updateItem(index, { ...item, subtitle: value })}
                placeholder="例如：公司名称 / 项目背景 / 专业名称"
              />
              <div className="md:col-span-2">
                <TextField
                  label="时间"
                  value={item.period}
                  onChange={(value) => updateItem(index, { ...item, period: value })}
                  placeholder="例如：2022.06 - 2024.03"
                />
              </div>
              <div className="md:col-span-2">
                <TextareaField
                  label="要点描述"
                  value={arrayToLines(item.highlights)}
                  onChange={(value) => updateItem(index, { ...item, highlights: linesToArray(value) })}
                  rows={6}
                  placeholder="一行一个要点，建议写职责、动作、结果。"
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => onChange([...items, createEmptySectionItem()])}
          className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-primary-400 hover:text-primary-500 dark:border-slate-600 dark:text-slate-300 dark:hover:border-primary-500 dark:hover:text-primary-300"
        >
          <Plus className="h-4 w-4" />
          {addLabel}
        </button>
      </div>
    </SectionCard>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-primary-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-primary-500"
      />
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  rows,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-primary-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-primary-500"
      />
    </label>
  );
}

function ResumeTemplatePreview({
  content,
  sourceFilename,
  jobDescription,
}: {
  content: ResumeRewriteContent;
  sourceFilename: string;
  jobDescription: string;
}) {
  const displayName = valueOrDash(content.profile.fullName) === '—'
    ? '个人简历'
    : valueOrDash(content.profile.fullName);

  const firstEducation = content.educationExperiences[0];
  const mergedSkills = [
    ...content.coreSkills,
    ...content.certifications,
    ...content.additionalInformation,
  ].filter((item) => item && item.trim());

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="px-6 pb-4 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-3xl font-bold tracking-wide text-[#4f7285] sm:text-4xl">{displayName}</p>
            <p className="text-lg font-semibold tracking-wide text-[#4f7285]">Personal Resume</p>
          </div>
          <p className="pt-2 text-sm tracking-[0.3em] text-[#ba9350]">● ● ●</p>
        </div>
        <div className="mt-4 grid h-2 w-full grid-cols-[62%_38%] overflow-hidden rounded-full">
          <div className="bg-[#4f7285]" />
          <div className="bg-[#ba9350]" />
        </div>
      </div>

      <div className="space-y-4 px-6 pb-6">
        <PreviewSection title="基本信息">
          <div className="overflow-hidden rounded-xl border border-[#98acb8]">
            <div className="grid gap-0 md:grid-cols-[1fr_1fr_160px]">
              <div className="space-y-1 border-b border-[#98acb8] bg-[#f3f8fc] p-4 text-sm text-slate-700 md:border-b-0 md:border-r">
                <PreviewLine label="姓  名" value={content.profile.fullName} />
                <PreviewLine label="电  话" value={content.profile.phone} />
                <PreviewLine label="邮  箱" value={content.profile.email} />
                <PreviewLine label="住  址" value={content.profile.location} />
                <PreviewLine label="链  接" value={content.profile.links} />
              </div>
              <div className="space-y-1 border-b border-[#98acb8] bg-[#f3f8fc] p-4 text-sm text-slate-700 md:border-b-0 md:border-r">
                <PreviewLine label="求职方向" value={content.targetPosition} />
                <PreviewLine label="优化方向" value={jobDescription} />
                <PreviewLine label="原始文件" value={sourceFilename} />
                <PreviewLine
                  label="毕业院校"
                  value={firstEducation?.title || firstEducation?.subtitle || ''}
                />
              </div>
              <div className="flex flex-col items-center justify-center p-4 text-center">
                <p className="text-sm font-semibold text-[#4f7285]">PHOTO</p>
                <p className="mt-1 text-xs text-slate-500">建议上传正式证件照</p>
              </div>
            </div>
          </div>
        </PreviewSection>

        <PreviewSection title="教育背景">
          <PreviewTimeline items={content.educationExperiences} />
        </PreviewSection>

        <PreviewSection title="实习经历">
          <PreviewTimeline items={content.workExperiences} />
        </PreviewSection>

        <PreviewSection title="校园经历">
          <PreviewTimeline items={content.projectExperiences} />
        </PreviewSection>

        <PreviewSection title="技能证书">
          {mergedSkills.length > 0 ? (
            <div className="space-y-1 text-sm text-slate-700">
              {mergedSkills.map((item, index) => (
                <p key={`${item}-${index}`}>{item}</p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">暂无内容</p>
          )}
        </PreviewSection>

        <PreviewSection title="自我评价">
          <p className="text-sm leading-6 text-slate-700">
            {content.professionalSummary.trim() ||
              content.optimizationHighlights.join('；').trim() ||
              '暂无内容'}
          </p>
        </PreviewSection>
      </div>
    </div>
  );
}

function PreviewSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 grid grid-cols-[130px_1fr] items-center gap-0">
        <div className="bg-[#4f7285] px-3 py-1.5 text-sm font-semibold text-white">{title}</div>
        <div className="border-b border-[#98acb8]" />
      </div>
      {children}
    </div>
  );
}

function PreviewLine({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  return (
    <p className="leading-6">
      <span className="font-medium text-slate-900">{label}：</span>
      <span>{valueOrDash(value)}</span>
    </p>
  );
}

function PreviewTimeline({
  items,
}: {
  items: ResumeRewriteSectionItem[];
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">暂无内容</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={`${item.title}-${index}`} className="text-sm text-slate-700">
          <div className="grid grid-cols-[24%_44%_32%] items-center gap-2">
            <p className="font-semibold text-[#4f7285]">{valueOrDash(item.period)}</p>
            <p className="text-center font-semibold text-slate-900">{valueOrDash(item.title)}</p>
            <p className="text-right font-semibold text-slate-800">{valueOrDash(item.subtitle)}</p>
          </div>
          {item.highlights.length > 0 && (
            <div className="mt-1 space-y-1 pl-3">
              {item.highlights.map((highlight, highlightIndex) => (
                <p key={`${highlight}-${highlightIndex}`} className="leading-6">
                  - {highlight}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
