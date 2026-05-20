import { ChangeEvent, DragEvent, useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, FileText, Loader2, Upload, X } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

export interface FileUploadCardProps {
  title: string;
  subtitle: string;
  accept: string;
  formatHint: string;
  maxSizeHint: string;
  uploading?: boolean;
  uploadButtonText?: string;
  selectButtonText?: string;
  showNameInput?: boolean;
  namePlaceholder?: string;
  nameLabel?: string;
  showCategoryInput?: boolean;
  categoryPlaceholder?: string;
  categoryLabel?: string;
  categoryOptions?: string[];
  error?: string;
  onFileSelect?: (file: File) => void;
  onUpload: (file: File, name?: string, category?: string) => void;
  onBack?: () => void;
}

export default function FileUploadCard({
  title,
  subtitle,
  accept,
  formatHint,
  maxSizeHint,
  uploading = false,
  uploadButtonText = '开始上传',
  selectButtonText = '选择文件',
  showNameInput = false,
  namePlaceholder = '留空则默认使用文件名',
  nameLabel = '名称（可选）',
  showCategoryInput = false,
  categoryPlaceholder = '如：技术、产品、运营',
  categoryLabel = '分类（可选）',
  categoryOptions,
  error,
  onFileSelect,
  onUpload,
  onBack,
}: FileUploadCardProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const { t } = useI18n();

  const pickFile = () => {
    document.getElementById('file-upload-input')?.click();
  };

  const setFile = useCallback((file: File) => {
    setSelectedFile(file);
    onFileSelect?.(file);
  }, [onFileSelect]);

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      setFile(files[0]);
    }
  }, [setFile]);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setFile(files[0]);
    }
  }, [setFile]);

  const handleUpload = () => {
    if (!selectedFile || uploading) {
      return;
    }
    onUpload(selectedFile, name.trim() || undefined, category.trim() || undefined);
  };

  const clearFile = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setSelectedFile(null);
    setName('');
    setCategory('');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <motion.div
      className="mx-auto max-w-4xl pt-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="mb-10 text-center">
        <motion.h1
          className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white md:text-5xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {title}
        </motion.h1>
        <motion.p
          className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-500 dark:text-slate-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {subtitle}
        </motion.p>
      </div>

      <motion.div
        className={`relative overflow-hidden rounded-[32px] border bg-white/90 p-10 shadow-sm backdrop-blur-sm transition-all duration-300 dark:bg-slate-800/90 ${
          dragOver
            ? 'scale-[1.01] border-slate-400 shadow-lg dark:border-slate-500'
            : 'border-slate-200 hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-700'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={pickFile}
      >
        <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.08)_1px,transparent_0)] [background-size:18px_18px] dark:opacity-20" />

        <input
          id="file-upload-input"
          type="file"
          className="hidden"
          accept={accept}
          onChange={handleFileChange}
          disabled={uploading}
        />

        <div className="relative text-center">
          <AnimatePresence mode="wait">
            {selectedFile ? (
              <motion.div
                key="selected"
                className="space-y-5"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
              >
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-slate-100 text-slate-700 shadow-inner dark:bg-slate-700 dark:text-slate-200">
                  <FileText className="h-10 w-10" />
                </div>

                <div className="mx-auto flex max-w-lg items-center gap-4 rounded-3xl border border-slate-200 bg-white/80 px-6 py-4 text-left shadow-sm dark:border-slate-600 dark:bg-slate-700/70">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-slate-900 dark:text-white">{selectedFile.name}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{formatFileSize(selectedFile.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={clearFile}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500 transition hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/60"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                className="space-y-5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className={`mx-auto flex h-24 w-24 items-center justify-center rounded-[30px] border text-slate-400 transition-all dark:text-slate-500 ${
                    dragOver
                      ? 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200'
                      : 'border-slate-200 bg-white/85 dark:border-slate-600 dark:bg-slate-700'
                  }`}
                  animate={{ y: dragOver ? -4 : 0 }}
                >
                  <Upload className="h-10 w-10" />
                </motion.div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{t('fileUploadCard.dragTip')}</h3>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {t('fileUploadCard.formatPrefix')} {formatHint} · {maxSizeHint}
                  </p>
                </div>
                <motion.button
                  type="button"
                  className="rounded-2xl bg-slate-900 px-8 py-3.5 font-semibold text-white transition-all hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={(event) => {
                    event.stopPropagation();
                    pickFile();
                  }}
                >
                  {selectButtonText}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {showNameInput && selectedFile && (
        <motion.div
          className="mt-6 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/90"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">{nameLabel}</label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={namePlaceholder}
            disabled={uploading}
            onClick={(event) => event.stopPropagation()}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:focus:border-slate-500 dark:focus:ring-slate-800"
          />
        </motion.div>
      )}

      {showCategoryInput && selectedFile && (
        <motion.div
          className="mt-6 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/90"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">{categoryLabel}</label>
          <input
            type="text"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder={categoryPlaceholder}
            disabled={uploading}
            onClick={(event) => event.stopPropagation()}
            list={categoryOptions && categoryOptions.length > 0 ? 'kb-category-options' : undefined}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:focus:border-slate-500 dark:focus:ring-slate-800"
          />
          {categoryOptions && categoryOptions.length > 0 && (
            <datalist id="kb-category-options">
              {categoryOptions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          )}
        </motion.div>
      )}

      <AnimatePresence>
        {error && (
          <motion.div
            className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-8 flex justify-center gap-4">
        {onBack && (
          <motion.button
            type="button"
            onClick={onBack}
            className="rounded-2xl border border-slate-200 px-6 py-3 text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {t('common.back')}
          </motion.button>
        )}
        {selectedFile && (
          <motion.button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            className="flex items-center gap-2 rounded-2xl bg-[#1f3b2f] px-8 py-3 font-semibold text-white transition-all hover:bg-[#172d24] disabled:cursor-not-allowed disabled:opacity-60"
            whileHover={{ scale: uploading ? 1 : 1.02 }}
            whileTap={{ scale: uploading ? 1 : 0.98 }}
          >
            {uploading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {t('common.processing')}
              </>
            ) : (
              uploadButtonText
            )}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
