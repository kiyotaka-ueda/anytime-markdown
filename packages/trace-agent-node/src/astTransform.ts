import * as parser from '@babel/parser';
import _traverse from '@babel/traverse';
import * as t from '@babel/types';
import _generate from '@babel/generator';

// ESM/CJS 互換
const traverse = (_traverse as unknown as { default?: typeof _traverse }).default ?? _traverse;
const generate = (_generate as unknown as { default?: typeof _generate }).default ?? _generate;

const PREAMBLE = `const { __traceEnter, __traceExit, __traceThrow } = require('@anytime-markdown/trace-agent-node/runtime');\n`;

export function instrumentCode(code: string, filename: string): string {
    if (!code.trim()) return PREAMBLE;
    const isTs = /\.[cm]?tsx?$/.test(filename);
    const ast = parser.parse(code, {
        sourceType: 'unambiguous',
        plugins: isTs ? ['typescript', 'jsx'] : ['jsx'],
        errorRecovery: true,
    });

    traverse(ast, {
        FunctionDeclaration(path) {
            wrapFunctionBody(path.node.body, path.node.id?.name ?? '(anonymous)', filename, path.node.params as t.Node[], path.node.loc);
        },
        FunctionExpression(path) {
            wrapFunctionBody(path.node.body, path.node.id?.name ?? '(anonymous)', filename, path.node.params as t.Node[], path.node.loc);
        },
        ObjectMethod(path) {
            wrapFunctionBody(path.node.body, t.isIdentifier(path.node.key) ? path.node.key.name : '(method)', filename, path.node.params as t.Node[], path.node.loc);
        },
        ArrowFunctionExpression(path) {
            if (!t.isBlockStatement(path.node.body)) {
                const ret = t.returnStatement(path.node.body as t.Expression);
                path.node.body = t.blockStatement([ret]);
            }
            wrapFunctionBody(path.node.body as t.BlockStatement, '(arrow)', filename, path.node.params as t.Node[], path.node.loc);
        },
    });

    const output = generate(ast, { retainLines: false }, code);
    return PREAMBLE + output.code;
}

function wrapFunctionBody(
    body: t.BlockStatement,
    fnName: string,
    filename: string,
    // Babel's FunctionDeclaration/FunctionExpression use (Pattern | TSParameterProperty)[]
    // ObjectMethod uses (Pattern | RestElement | TSParameterProperty)[]
    // Cast to common base for uniform handling
    params: ReadonlyArray<t.Node>,
    loc: t.SourceLocation | null | undefined,
): void {
    const line = loc?.start.line ?? 0;
    const paramNames = params.map(p => {
        if (t.isIdentifier(p)) return t.identifier(p.name);
        if (t.isAssignmentPattern(p) && t.isIdentifier(p.left)) return t.identifier(p.left.name);
        if (t.isRestElement(p) && t.isIdentifier(p.argument)) return t.identifier(p.argument.name);
        if (t.isTSParameterProperty(p) && t.isIdentifier(p.parameter)) return t.identifier(p.parameter.name);
        return t.identifier('_');
    });

    // const __tid = __traceEnter(filename, fnName, [params...], 0, line);
    const tidDecl = t.variableDeclaration('const', [
        t.variableDeclarator(
            t.identifier('__tid'),
            t.callExpression(t.identifier('__traceEnter'), [
                t.stringLiteral(filename),
                t.stringLiteral(fnName),
                t.arrayExpression(paramNames),
                t.numericLiteral(0),
                t.numericLiteral(line),
            ])
        ),
    ]);

    // Wrap returns in body
    wrapReturnsInBlock(body);

    // try { ...body... } catch(__e) { __traceThrow(__tid, __e); throw __e; }
    const catchBlock = t.blockStatement([
        t.expressionStatement(
            t.callExpression(t.identifier('__traceThrow'), [
                t.identifier('__tid'),
                t.identifier('__e'),
            ])
        ),
        t.throwStatement(t.identifier('__e')),
    ]);

    const tryStmt = t.tryStatement(t.blockStatement([...body.body]), t.catchClause(t.identifier('__e'), catchBlock));
    body.body = [tidDecl, tryStmt];
}

function wrapReturnsInBlock(node: t.Node): void {
    if (!t.isBlockStatement(node)) {
        if (t.isIfStatement(node)) {
            wrapReturnsInBlock(node.consequent);
            if (node.alternate) wrapReturnsInBlock(node.alternate);
        }
        return;
    }
    const stmts = node.body;
    for (let i = 0; i < stmts.length; i++) {
        const stmt = stmts[i];
        if (t.isReturnStatement(stmt)) {
            const retVal = stmt.argument ?? t.identifier('undefined');
            const tmpDecl = t.variableDeclaration('const', [
                t.variableDeclarator(t.identifier('__ret'), retVal),
            ]);
            const exitCall = t.expressionStatement(
                t.callExpression(t.identifier('__traceExit'), [
                    t.identifier('__tid'),
                    t.identifier('__ret'),
                ])
            );
            stmts.splice(i, 1, tmpDecl, exitCall, t.returnStatement(t.identifier('__ret')));
            i += 2;
        } else {
            wrapReturnsInBlock(stmt);
        }
    }
    // implicit return: add __traceExit at end if last stmt is not return
    const last = stmts[stmts.length - 1];
    if (!last || !t.isReturnStatement(last)) {
        stmts.push(
            t.expressionStatement(
                t.callExpression(t.identifier('__traceExit'), [
                    t.identifier('__tid'),
                    t.identifier('undefined'),
                ])
            )
        );
    }
}
