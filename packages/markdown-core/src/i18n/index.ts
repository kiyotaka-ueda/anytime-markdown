import {
  spreadsheetViewerEnMessages,
  spreadsheetViewerJaMessages,
} from '@anytime-markdown/spreadsheet-viewer';

import enMessagesRaw from './en.json';
import jaMessagesRaw from './ja.json';

// spreadsheet 関連のビューアー専用キーを spreadsheet-viewer からマージし、
// markdown-core の呼び出し側が従来通り単一の messages オブジェクトで扱えるようにする。
const jaMessages = {
  ...jaMessagesRaw,
  ...spreadsheetViewerJaMessages,
};
const enMessages = {
  ...enMessagesRaw,
  ...spreadsheetViewerEnMessages,
};

export type MarkdownMessages = typeof jaMessages;

// ビルド時に en と ja の構造が一致することを保証する。
const _enAssertion: MarkdownMessages = enMessages;
void _enAssertion;

export { enMessages, jaMessages };
