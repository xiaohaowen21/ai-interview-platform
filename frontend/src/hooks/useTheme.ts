import {useEffect, useState} from 'react';

type Theme = 'light' | 'dark';

export function useTheme() {
    const [theme, setTheme] = useState<Theme>(() => {
        try {
            const stored = window.localStorage.getItem('theme') as Theme | null;
            if (stored === 'light' || stored === 'dark') {
                return stored;
            }
        } catch {
            return 'light';
        }
        if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    });

    // 同步到 document 和 localStorage
    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        try {
            window.localStorage.setItem('theme', theme);
        } catch {
            return;
        }
    }, [theme]);

    // 切换主题
    const toggleTheme = () => {
        setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
    };

    return {theme, toggleTheme};
}
