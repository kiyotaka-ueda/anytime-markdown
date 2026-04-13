// packages/trail-core/src/analyzer/sourceFileFactory.ts
//
// web-app 側から trail-core の typescript インスタンスを使って SourceFile を
// 生成できるようにするファクトリ関数。
// モノレポ内で typescript が複数インストールされている場合に型の不一致を防ぐ。
import ts from 'typescript';

/**
 * trail-core の typescript インスタンスで SourceFile を生成する。
 * @param fileName ファイルパス（表示用）
 * @param content ファイル内容
 */
export function createSourceFile(fileName: string, content: string): ts.SourceFile {
  return ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true);
}

/**
 * SourceFile から指定名の FunctionDeclaration を検索する。
 * @param sf 対象 SourceFile
 * @param funcName 関数名
 */
export function findFunctionNode(
  sf: ts.SourceFile,
  funcName: string,
): ts.FunctionDeclaration | undefined {
  let result: ts.FunctionDeclaration | undefined;
  ts.forEachChild(sf, node => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === funcName) {
      result = node;
    }
  });
  return result;
}
