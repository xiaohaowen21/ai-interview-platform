import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock3, FileSearch, ShieldCheck, Sparkles } from 'lucide-react';
import { resumeApi } from '../api/resume';
import { getErrorMessage } from '../api/request';
import AuroraBackdrop from '../components/AuroraBackdrop';
import FileUploadCard from '../components/FileUploadCard';
import { useI18n } from '../i18n/I18nContext';

interface UploadPageProps {
  onUploadComplete: (resumeId: number) => void;
}

export default function UploadPage({ onUploadComplete }: UploadPageProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const { locale, t } = useI18n();

  const copy = locale === 'zh'
    ? {
        progressTitle: '上传后会自动推进',
        progressSubtitle: '无需手动切换页面，系统会依次完成分析、出题与记录归档。',
        cards: [
          {
            title: '快速解析',
            description: '上传成功后立即进入解析队列，通常数十秒内产出首轮结果。',
            icon: Clock3,
          },
          {
            title: '智能分析',
            description: '从经历、能力、匹配度多维评估，自动生成结构化建议。',
            icon: FileSearch,
          },
          {
            title: '安全存储',
            description: '简历文件与分析记录分层保存，便于回溯与后续复盘。',
            icon: ShieldCheck,
          },
        ],
        flowTitle: '推荐流程',
        stepLabel: '步骤',
        flowSteps: [
          '上传简历并等待系统生成首轮分析',
          '进入历史简历查看结果并启动笔试/语音面试',
          '在面试记录中查看评分、复盘要点与改进建议',
        ],
      }
    : {
        progressTitle: 'Automatically continues after upload',
        progressSubtitle: 'No manual switching needed. The system runs analysis, question generation and record archiving.',
        cards: [
          {
            title: 'Fast Parsing',
            description: 'After upload, resume enters the queue immediately and usually returns first result in tens of seconds.',
            icon: Clock3,
          },
          {
            title: 'AI Analysis',
            description: 'Evaluates experience, capabilities and job fit, then outputs structured suggestions.',
            icon: FileSearch,
          },
          {
            title: 'Secure Storage',
            description: 'Resume files and analysis records are stored in layers for later review.',
            icon: ShieldCheck,
          },
        ],
        flowTitle: 'Recommended Flow',
        stepLabel: 'Step',
        flowSteps: [
          'Upload a resume and wait for first-round analysis.',
          'Open resume history and start written or oral interview.',
          'Review score, replay points and improvement suggestions.',
        ],
      };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError('');

    try {
      const data = await resumeApi.uploadAndAnalyze(file);

      // 异步模式：只检查上传是否成功（storage 信息）
      if (!data.storage || !data.storage.resumeId) {
        throw new Error(t('upload.uploadFailed'));
      }

      // 上传成功，跳转到简历库（分析在后台进行）
      onUploadComplete(data.storage.resumeId);
    } catch (err) {
      setError(getErrorMessage(err));
      setUploading(false);
    }
  };

  return (
    <AuroraBackdrop
      className="relative isolate min-h-[calc(100vh-4rem)] rounded-[40px] px-5 pb-32 pt-6 md:px-7 lg:px-8"
      radialGradient={false}
    >
      <div className="absolute inset-0 rounded-[40px] border border-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)]" />

      <div className="relative z-10 space-y-12 md:space-y-14">
        <FileUploadCard
          title={t('upload.title')}
          subtitle={t('upload.subtitle')}
          accept=".pdf,.doc,.docx,.txt"
          formatHint={t('upload.formatHint')}
          maxSizeHint={t('upload.maxSizeHint')}
          uploading={uploading}
          uploadButtonText={t('upload.startUpload')}
          selectButtonText={t('upload.selectFile')}
          error={error}
          onUpload={handleUpload}
        />

        <motion.section
          className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {copy.cards.map((item) => (
            <div
              key={item.title}
              className="rounded-3xl border border-white/65 bg-white/78 p-6 shadow-[0_16px_42px_rgba(15,23,42,0.09)] backdrop-blur-xl dark:border-slate-700 dark:bg-slate-800/90"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                <item.icon className="h-5 w-5" />
              </div>
              <p className="text-base font-semibold text-slate-900 dark:text-white">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.description}</p>
            </div>
          ))}
        </motion.section>

        <motion.section
          className="mx-auto max-w-5xl rounded-3xl border border-white/65 bg-white/78 p-7 shadow-[0_16px_42px_rgba(15,23,42,0.09)] backdrop-blur-xl dark:border-slate-700 dark:bg-slate-800/90"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{copy.progressTitle}</h3>
          </div>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">{copy.progressSubtitle}</p>

          <div className="grid gap-3 md:grid-cols-3">
            {copy.flowSteps.map((step, index) => (
              <div
                key={`${copy.flowTitle}-${index}`}
                className="rounded-2xl border border-slate-200/90 bg-slate-50/88 px-4 py-3 text-sm text-slate-700 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
              >
                <p className="inline-flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  {copy.stepLabel} {index + 1}
                </p>
                <p className="mt-2 leading-6 text-slate-600 dark:text-slate-300">{step}</p>
              </div>
            ))}
          </div>
        </motion.section>
      </div>
    </AuroraBackdrop>
  );
}
