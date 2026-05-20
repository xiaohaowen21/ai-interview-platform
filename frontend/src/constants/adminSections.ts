export type AdminSection = 'system' | 'avatars' | 'password' | 'users';

export const DEFAULT_ADMIN_SECTION: AdminSection = 'system';

export const ADMIN_SECTIONS: Array<{
  id: AdminSection;
  title: string;
  subtitle: string;
}> = [
  { id: 'system', title: '系统配置', subtitle: '接口、模型与首页资源' },
  { id: 'avatars', title: '面试官头像', subtitle: '四位面试官展示图' },
  { id: 'password', title: '管理员密码', subtitle: '修改当前管理员密码' },
  { id: 'users', title: '用户管理', subtitle: '用户状态、角色与密码' },
];

export function parseAdminSection(hash: string | null | undefined): AdminSection {
  const normalized = (hash ?? '').replace(/^#/, '');
  const matched = ADMIN_SECTIONS.find((item) => item.id === normalized);
  return matched?.id ?? DEFAULT_ADMIN_SECTION;
}
