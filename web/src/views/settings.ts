import type { App, Screen } from '../app.ts';
import { h } from '../dom.ts';
import { LANGS } from '../i18n.ts';
import { subpageHeader } from './header.ts';

const LANGUAGE_NAMES = { de: 'Deutsch', en: 'English' } as const;

export function settingsScreen(app: App): Screen {
  const { t } = app;
  const { storage, install } = app.services;

  const languages = h(
    'div',
    { class: 'segmented', role: 'group', 'aria-labelledby': 'language-heading' },
    ...LANGS.map((lang) =>
      h(
        'button',
        { 'data-lang': lang, lang, 'aria-pressed': String(app.lang === lang), onclick: () => app.setLanguage(lang) },
        LANGUAGE_NAMES[lang],
      ),
    ),
  );

  const status = h('p', { class: 'status', role: 'status' });
  const dialog = h(
    'dialog',
    { class: 'confirm', 'aria-labelledby': 'reset-question' },
    h('p', { id: 'reset-question' }, t('settings.resetConfirm')),
    h(
      'div',
      { class: 'actions' },
      h('button', { onclick: () => dialog.close() }, t('settings.resetNo')),
      h(
        'button',
        {
          class: 'danger',
          'data-testid': 'confirm-reset',
          onclick: () => {
            storage.resetProgress();
            dialog.close();
            status.textContent = t('settings.resetDone');
          },
        },
        t('settings.resetYes'),
      ),
    ),
  );

  const installSection = h(
    'section',
    { 'aria-labelledby': 'install-heading' },
    h('h2', { id: 'install-heading' }, t('settings.install')),
    h('p', {}, t('settings.installHint')),
    h('button', { class: 'primary', onclick: () => void install.prompt() }, t('settings.install')),
  );
  const showInstall = () => (installSection.hidden = !install.available);
  showInstall();

  const root = h(
    'main',
    { class: 'screen settings' },
    subpageHeader(app, t('settings.title')),
    h('section', {}, h('h2', { id: 'language-heading' }, t('settings.language')), languages),
    h(
      'section',
      {},
      h('h2', {}, t('settings.progress')),
      h('button', { class: 'danger', onclick: () => dialog.showModal() }, t('settings.reset')),
      status,
    ),
    installSection,
    dialog,
  );
  return { root, dispose: install.subscribe(showInstall) };
}
