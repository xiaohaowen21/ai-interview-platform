import ConfirmDialog from './ConfirmDialog';

export interface DeleteItem {
  id: number;
  name?: string;
  title?: string;
  filename?: string;
  [key: string]: any;
}

export interface DeleteConfirmDialogProps {
  open: boolean;
  item: DeleteItem | null;
  itemType: string; // 如 "知识库"、"对话"、"简历"、"面试记录"
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  customMessage?: React.ReactNode; // 可选的自定义消息内容
}

/**
 * 通用的删除确认对话框组件
 * 简化删除确认对话框的使用
 */
export default function DeleteConfirmDialog({
  open,
  item,
  itemType,
  loading = false,
  onConfirm,
  onCancel,
  customMessage,
}: DeleteConfirmDialogProps) {
  // 获取项目名称（支持 name、title、filename、sessionId 等字段）
  const getItemName = () => {
    if (!item) return '';
    return item.name || item.title || item.filename || item.sessionId || (item.id ? `ID: ${item.id}` : '');
  };

  // 生成默认消息
  const defaultMessage = item
    ? `确定要删除${itemType}"${getItemName()}"吗？删除后无法恢复。`
    : '';

  return (
    <ConfirmDialog
      open={open}
      title={`删除${itemType}`}
      message={customMessage || defaultMessage}
      confirmText="确定删除"
      cancelText="取消"
      confirmVariant="danger"
      loading={loading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

