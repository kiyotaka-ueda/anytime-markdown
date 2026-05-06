import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * React.lazy の戻り値に preload() を付与するヘルパー。
 *
 * preload() を呼ぶと、Component が初めてレンダリングされる前に chunk fetch が開始される。
 * Tab の onMouseEnter / onFocus / idle callback で呼ぶことで、
 * クリック時点で既に chunk が読み込み済 (or 読み込み中) の状態にできる。
 *
 * @example
 * const AnalyticsPanel = lazyWithPreload(() =>
 *     import('./AnalyticsPanel').then((m) => ({ default: m.AnalyticsPanel })),
 * );
 *
 * // Tab hover で preload
 * <Tab onMouseEnter={() => AnalyticsPanel.preload()} />
 */
export type PreloadableComponent<T extends ComponentType<any>> =
    LazyExoticComponent<T> & {
        readonly preload: () => Promise<{ default: T }>;
    };

export function lazyWithPreload<T extends ComponentType<any>>(
    loader: () => Promise<{ default: T }>,
): PreloadableComponent<T> {
    const Component = lazy(loader) as PreloadableComponent<T>;
    (Component as { preload: () => Promise<{ default: T }> }).preload = loader;
    return Component;
}
