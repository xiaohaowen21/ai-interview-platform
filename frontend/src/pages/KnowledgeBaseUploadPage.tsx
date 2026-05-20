import { useEffect, useState } from 'react';
import { knowledgeBaseApi } from '../api/knowledgebase';
import type { UploadKnowledgeBaseResponse } from '../api/knowledgebase';
import FileUploadCard from '../components/FileUploadCard';
import { useI18n } from '../i18n/I18nContext';

interface KnowledgeBaseUploadPageProps {
  onUploadComplete: (result: UploadKnowledgeBaseResponse) => void;
  onBack: () => void;
}

export default function KnowledgeBaseUploadPage({ onUploadComplete, onBack }: KnowledgeBaseUploadPageProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const { t } = useI18n();

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await knowledgeBaseApi.getAllCategories();
        setCategories(data.filter(Boolean));
      } catch (err) {
        console.warn('加载知识库分类失败', err);
      }
    };
    void loadCategories();
  }, []);

  const handleUpload = async (file: File, name?: string, category?: string) => {
    setUploading(true);
    setError('');

    try {
      const data = await knowledgeBaseApi.uploadKnowledgeBase(file, name, category);
      onUploadComplete(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('knowledgeUpload.failed');
      setError(errorMessage);
      setUploading(false);
    }
  };

  return (
    <FileUploadCard
      title={t('knowledgeUpload.title')}
      subtitle={t('knowledgeUpload.subtitle')}
      accept=".pdf,.doc,.docx,.txt,.md"
      formatHint={t('knowledgeUpload.formatHint')}
      maxSizeHint={t('knowledgeUpload.maxSizeHint')}
      uploading={uploading}
      uploadButtonText={t('knowledgeUpload.uploadButton')}
      selectButtonText={t('knowledgeUpload.selectButton')}
      showNameInput
      nameLabel={t('knowledgeUpload.nameLabel')}
      namePlaceholder={t('knowledgeUpload.namePlaceholder')}
      showCategoryInput
      categoryLabel={t('knowledgeUpload.categoryLabel')}
      categoryPlaceholder={t('knowledgeUpload.categoryPlaceholder')}
      categoryOptions={categories}
      error={error}
      onUpload={handleUpload}
      onBack={onBack}
    />
  );
}
