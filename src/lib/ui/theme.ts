import type { ThemeConfig } from 'antd';

// Maps Papaya's brand onto Ant Design tokens so AntD matches the company's look:
// clean white surfaces, ink text, papaya pink (#ED1B55) accent, gentle 8px radii,
// Plus Jakarta Sans (the CSS variable is set in layout.tsx).
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#ed1b55',
    colorInfo: '#ed1b55',
    colorLink: '#ed1b55',
    colorLinkHover: '#c8164a',
    colorTextBase: '#0a0a0a',
    colorBgBase: '#ffffff',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBgLayout: '#ffffff',
    colorBorder: '#d6d6db',
    colorBorderSecondary: '#e7e7ea',
    colorText: '#0a0a0a',
    colorTextSecondary: '#6b7280',
    colorTextTertiary: '#9ca3af',
    borderRadius: 8,
    borderRadiusLG: 12,
    controlHeight: 38,
    fontFamily: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif',
    fontSize: 14,
    wireframe: false,
  },
  components: {
    Button: { fontWeight: 600, primaryShadow: 'none', defaultShadow: 'none', controlHeight: 38 },
    Modal: { borderRadiusLG: 16, contentBg: '#ffffff', headerBg: '#ffffff' },
    Input: { activeShadow: '0 0 0 3px rgba(237, 27, 85, 0.12)' },
    InputNumber: { activeShadow: '0 0 0 3px rgba(237, 27, 85, 0.12)' },
    Tabs: { inkBarColor: '#ed1b55', itemSelectedColor: '#0a0a0a' },
    Segmented: { itemSelectedBg: '#ed1b55', itemSelectedColor: '#ffffff' },
    Tag: { borderRadiusSM: 6 },
    Table: { headerBg: '#f7f7f8', headerColor: '#6b7280', borderColor: '#e7e7ea' },
  },
};
