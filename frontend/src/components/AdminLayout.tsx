import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ImagePlus, LogOut, Settings2, Shield, UserCog, Users } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ADMIN_SECTIONS, parseAdminSection, type AdminSection } from '../constants/adminSections';
import { getCurrentUser, logoutUser } from '../utils/auth';

const ADMIN_QUOTES = [
  '把复杂留给系统，把清晰留给管理。',
  '流程越统一，协作越稳定。',
  '配置越克制，后台越可靠。',
  '权限清楚，排查才会高效。',
];

function getSectionIcon(section: AdminSection) {
  switch (section) {
    case 'system':
      return <Settings2 className="h-5 w-5" />;
    case 'avatars':
      return <ImagePlus className="h-5 w-5" />;
    case 'password':
      return <Shield className="h-5 w-5" />;
    case 'users':
      return <Users className="h-5 w-5" />;
    default:
      return <Settings2 className="h-5 w-5" />;
  }
}

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [quoteIndex, setQuoteIndex] = useState(0);

  const activeSection = parseAdminSection(location.hash);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setQuoteIndex((current) => (current + 1) % ADMIN_QUOTES.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, []);

  const handleLogout = () => {
    logoutUser();
    navigate('/auth', { replace: true });
  };

  const handleSectionChange = (section: AdminSection) => {
    navigate({ pathname: '/admin', hash: `#${section}` });
  };

  return (
    <div className="h-screen overflow-hidden bg-[#f4f1ea] text-slate-900">
      <div className="mx-auto flex h-full max-w-[1880px] gap-5 px-4 py-4 md:px-6">
        <aside className="hidden h-[calc(100vh-2rem)] w-[320px] shrink-0 overflow-hidden rounded-[28px] border border-[#e5ddd2] bg-white p-5 shadow-[0_20px_60px_rgba(90,73,56,0.08)] lg:flex lg:flex-col">
          <div className="flex items-center gap-3 border-b border-[#eee5da] pb-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2d2b29] text-white">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-bold">智能面试管理后台</p>
              <p className="text-xs text-slate-500">管理员控制台</p>
            </div>
          </div>

          <div className="mt-5 rounded-[24px] bg-[linear-gradient(180deg,#2d2b29_0%,#45413d_100%)] p-5 text-white">
            <div className="min-h-[172px]">
              <AnimatePresence mode="wait">
                <motion.p
                  key={quoteIndex}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.3 }}
                  className="text-[28px] font-semibold leading-[2.4rem]"
                >
                  {ADMIN_QUOTES[quoteIndex]}
                </motion.p>
              </AnimatePresence>
            </div>
            <div className="mt-4 flex gap-2">
              {ADMIN_QUOTES.map((_, index) => (
                <span key={index} className={`h-1.5 rounded-full transition-all ${index === quoteIndex ? 'w-8 bg-white' : 'w-3 bg-white/30'}`} />
              ))}
            </div>
          </div>

          <div className="mt-5 min-h-0 space-y-2">
            {ADMIN_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => handleSectionChange(section.id)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  activeSection === section.id
                    ? 'border-[#2d2b29] bg-[#2d2b29] text-white'
                    : 'border-[#ebe2d8] bg-white text-slate-700 hover:border-[#d7cdc0] hover:bg-[#faf7f2]'
                }`}
              >
                <div className="flex items-center gap-3">
                  {getSectionIcon(section.id)}
                  <div>
                    <p className="text-sm font-semibold">{section.title}</p>
                    <p className={`text-xs ${activeSection === section.id ? 'text-white/70' : 'text-slate-500'}`}>
                      {section.subtitle}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-[#ebe2d8] bg-white px-4 py-4 text-slate-700">
            <div className="flex items-center gap-3">
              <UserCog className="h-5 w-5 text-slate-600" />
              <div>
                <p className="text-sm font-semibold">{currentUser?.username ?? 'admin'}</p>
                <p className="text-xs text-slate-500">当前管理员</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-auto flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2d2b29] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#1f1d1b]"
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto pr-1 lg:h-[calc(100vh-2rem)]">
          <div className="mb-4 rounded-[24px] border border-[#e5ddd2] bg-white p-4 shadow-sm lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-bold">智能面试管理后台</p>
                <p className="text-xs text-slate-500">{currentUser?.username ?? 'admin'}</p>
              </div>
              <button type="button" onClick={handleLogout} className="rounded-xl bg-[#2d2b29] px-3 py-2 text-sm text-white">退出登录</button>
            </div>
            <div className="mt-4 rounded-[20px] bg-[linear-gradient(180deg,#2d2b29_0%,#45413d_100%)] p-4 text-white">
              <AnimatePresence mode="wait">
                <motion.p
                  key={quoteIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="text-lg font-semibold leading-8"
                >
                  {ADMIN_QUOTES[quoteIndex]}
                </motion.p>
              </AnimatePresence>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {ADMIN_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => handleSectionChange(section.id)}
                  className={`whitespace-nowrap rounded-2xl px-3 py-2 text-sm font-medium ${
                    activeSection === section.id
                      ? 'bg-[#2d2b29] text-white'
                      : 'bg-[#f4efe7] text-slate-700'
                  }`}
                >
                  {section.title}
                </button>
              ))}
            </div>
          </div>

          <motion.div key={location.pathname + location.hash} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}>
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
