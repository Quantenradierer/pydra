import { h } from '../dom.ts';

export interface Sheet {
  dialog: HTMLDialogElement;
  /** Where the content goes (scrolls). */
  body: HTMLElement;
  open(): void;
  close(): void;
}

/**
 * A bottom sheet (a native modal dialog): a title once, a close button, a scrolling body. Escape and a tap on the dimmed
 * area close it; the browser gives the focus back to the opener. The one panel pattern of the Robot Battler.
 */
export function createSheet(title: string, closeLabel: string, testId: string, onClose?: () => void): Sheet {
  const dialog = h('dialog', { class: 'robot-sheet', 'aria-label': title, 'data-testid': testId }) as HTMLDialogElement;
  const body = h('div', { class: 'robot-sheet-body' });
  const closeBtn = h('button', { type: 'button', class: 'robot-sheet-close', 'aria-label': closeLabel, title: closeLabel, 'data-testid': `${testId}-close`, onclick: () => dialog.close() }, '×');
  dialog.append(h('header', {}, h('h2', {}, title), closeBtn), body);
  dialog.addEventListener('click', (e) => e.target === dialog && dialog.close());
  if (onClose) dialog.addEventListener('close', onClose);
  return { dialog, body, open: () => dialog.showModal(), close: () => dialog.close() };
}
