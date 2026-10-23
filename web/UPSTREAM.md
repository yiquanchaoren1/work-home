# Bing House — upstream reuse

Upstream: https://github.com/shadcnstore/shadcn-dashboard-landing-template
Source: main ZIP downloaded 2026-10-23. Original MIT LICENSE, Vite/Next source and original manifest retained. No claim that every upstream page is a working feature of this preview.

## Active reuse in the richer preview

| Native source | Adaptation |
| --- | --- |
| components/layouts/base-layout.tsx, app-sidebar.tsx, nav-main.tsx | Native responsive sidebar/inset layout; real product routes and data source; mobile link closes drawer. |
| app/tasks/components/data-table.tsx + column-header, pagination, view-options; lib/data-table.ts | Actual TanStack v9 table, sorting/filtering/column visibility/pagination/selection. Columns map to work tasks; bulk actions save actual IDs. |
| app/calendar/components/calendar-main.tsx, calendar-sidebar.tsx | Native month grid/list/search/date picker; real task deadlines and daily summaries replace example meetings. |
| app/dashboard/components/section-cards.tsx, chart-area-interactive.tsx | Native metric cards, Recharts range controls/chart; real workspace counts and time fields replace sales fixtures. Dashboard composition is adapted. |
| components/theme-customizer/* and hooks/use-theme-manager.ts | Native palette presets, radius, color pickers, CSS import, sidebar layout controls. Add validated file persistence, paired light/dark values, safe import and save/close restoration. |
| app/settings/appearance/page.tsx | Native form/RHF/Zod, theme previews/select controls. Replaces console-only submit with file save for font/width/theme. |
| components/ui/*, router/root-layout.tsx | Native UI controls, cmdk search, route loading skeleton, responsive structure. Native Button links explicitly use nativeButton=false. |

## Product-specific code

App.tsx is the new hash-route entry. hub/workspace.tsx centralizes current data and background writes; hub/dialogs.tsx edits the same records from every route. hub/library/archives/links/settings/reader are product pages composed with native components. hub/task-card preserves the existing horizontal card workflow. The first hub/House.tsx is retained but is no longer the entry.

public/legacy contains copied, existing work-hub validation, private GitHub adapter, device-session encryption, background sync and Markdown functions. preview-backend.mjs is an independent copy of the original file backend, importing this preview's schema. Only optional task date/priority and UI settings are added. The original work-hub source/data is not edited.

Unused upstream ecommerce, chat, mail, authentication examples and marketing analytics are not registered as working routes. No fabricated user revenue/chat/calendar events are presented as real work. Demo fixture content is visibly distinct from production data.

Production uses the current UI at /work-home/. Only required shared data/storage/Markdown modules are shipped under legacy; the retired interface and /classic/ fallback are not published. Source history remains available. Browser tests use isolated fixtures and do not constitute real private-data or physical-phone acceptance.
