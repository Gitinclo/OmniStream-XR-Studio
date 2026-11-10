/**
 * Firestore Security Rules Behavioral Execution Harness
 *
 * Provides a real behavioral execution engine for `firestore.rules` powered by:
 * 1. `@firebase/rules-unit-testing` (`initializeTestEnvironment`, `assertSucceeds`, `assertFails`)
 *    when `FIRESTORE_EMULATOR_HOST` is active, OR
 * 2. The authoritative ANTLR4 `FirebaseRulesParser` (`@firebase/eslint-plugin-security-rules/parser`),
 *    which parses `firestore.rules` into an AST and executes every `function`, `match`, and `allow`
 *    rule expression (`get`, `list`, `create`, `update`, `delete`) against real request contexts
 *    (`request.auth`, `request.resource.data`, `request.time`) and seeded Firestore documents
 *    (`resource.data`, `exists()`, `get()`, `diff().affectedKeys().hasOnly()`, etc.).
 */

import fs from 'node:fs';
import {
  assertFails as firebaseAssertFails,
  assertSucceeds as firebaseAssertSucceeds,
} from '@firebase/rules-unit-testing';
import { parseForESLint } from '@firebase/eslint-plugin-security-rules/parser';

export { firebaseAssertFails as assertFails, firebaseAssertSucceeds as assertSucceeds };

/**
 * Sentinel representing `serverTimestamp()` (`request.time` in Firestore Security Rules).
 */
export class ServerTimestampSentinel {
  readonly _isServerTimestampSentinel = true;
}

export function serverTimestamp(): ServerTimestampSentinel {
  return new ServerTimestampSentinel();
}

/**
 * Concrete Timestamp value inside the Firestore Rules evaluation runtime (`is timestamp`).
 */
export class RulesTimestamp {
  readonly _isRulesTimestamp = true;
  readonly epochMs: number;

  constructor(epochMs: number) {
    this.epochMs = epochMs;
  }

  static now(epochMs: number = 1_750_000_000_000): RulesTimestamp {
    return new RulesTimestamp(epochMs);
  }

  static fromMillis(epochMs: number): RulesTimestamp {
    return new RulesTimestamp(epochMs);
  }
}

export function customTimestamp(epochMs: number): RulesTimestamp {
  return new RulesTimestamp(epochMs);
}

/**
 * Represents a `rules.List` returned by `.keys()` or `.affectedKeys()` in Firestore Security Rules.
 */
export class RulesList {
  readonly items: unknown[];

  constructor(items: unknown[]) {
    this.items = [...items];
  }

  size(): number {
    return this.items.length;
  }

  hasAll(requiredItems: unknown[] | RulesList): boolean {
    const reqArr = requiredItems instanceof RulesList ? requiredItems.items : requiredItems;
    if (!Array.isArray(reqArr)) return false;
    return reqArr.every((item) => this.items.some((x) => rulesValuesEqual(x, item)));
  }

  hasOnly(allowedItems: unknown[] | RulesList): boolean {
    const allowArr = allowedItems instanceof RulesList ? allowedItems.items : allowedItems;
    if (!Array.isArray(allowArr)) return false;
    return this.items.every((item) => allowArr.some((x) => rulesValuesEqual(x, item)));
  }

  hasAny(candidateItems: unknown[] | RulesList): boolean {
    const candArr = candidateItems instanceof RulesList ? candidateItems.items : candidateItems;
    if (!Array.isArray(candArr)) return false;
    return this.items.some((item) => candArr.some((x) => rulesValuesEqual(x, item)));
  }

  includes(val: unknown): boolean {
    return this.items.some((x) => rulesValuesEqual(x, val));
  }
}

/**
 * Represents a `rules.MapDiff` returned by `mapA.diff(mapB)` in Firestore Security Rules.
 */
export class RulesMapDiff {
  private readonly changedKeys: string[];

  constructor(afterMap: Record<string, unknown>, beforeMap: Record<string, unknown>) {
    const allKeys = new Set<string>([
      ...Object.keys(afterMap || {}),
      ...Object.keys(beforeMap || {}),
    ]);
    const diff: string[] = [];
    for (const k of allKeys) {
      const hasAfter = Object.prototype.hasOwnProperty.call(afterMap, k);
      const hasBefore = Object.prototype.hasOwnProperty.call(beforeMap, k);
      if (!hasAfter || !hasBefore || !rulesValuesEqual(afterMap[k], beforeMap[k])) {
        diff.push(k);
      }
    }
    this.changedKeys = diff;
  }

  affectedKeys(): RulesList {
    return new RulesList(this.changedKeys);
  }

  addedKeys(): RulesList {
    return new RulesList(this.changedKeys);
  }

  changedKeysList(): RulesList {
    return new RulesList(this.changedKeys);
  }
}

export function rulesValuesEqual(a: unknown, b: unknown): boolean {
  if (a instanceof RulesTimestamp && b instanceof RulesTimestamp) {
    return a.epochMs === b.epochMs;
  }
  return a === b;
}

interface ParsedFunctionDecl {
  name: string;
  params: string[];
  returnExprNode: any;
}

type RuleOperation = 'get' | 'list' | 'create' | 'update' | 'delete';

interface ParsedPermissionDecl {
  operations: RuleOperation[];
  conditionExprNode: any;
}

interface ParsedMatchBlock {
  pathPattern: string; // e.g. "/videos/{videoId}" or "/{document=**}"
  permissions: ParsedPermissionDecl[];
  children: ParsedMatchBlock[];
}

class RulesNullPointerError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'RulesNullPointerError';
  }
}

/**
 * Compiles a `firestore.rules` source string using the official ANTLR4 `FirebaseRulesParser`
 * and evaluates security rule decisions against an in-memory document store.
 */
export class CompiledFirestoreRuleset {
  private readonly functions = new Map<string, ParsedFunctionDecl>();
  private readonly rootMatches: ParsedMatchBlock[] = [];

  constructor(rulesSource: string) {
    const parsed = parseForESLint(rulesSource) as any;
    const tree = parsed?.services?.tree;
    if (!tree) {
      throw new Error('Failed to parse firestore.rules into ANTLR4 AST.');
    }
    this.extractRuleset(tree);
  }

  private extractRuleset(rulesetNode: any): void {
    // Walk to the `match /databases/{database}/documents` block inside `service cloud.firestore`
    const walkService = (node: any) => {
      if (!node) return;
      const cname = node.constructor?.name;
      if (cname === 'MatchRuleDeclarationContext') {
        const pathDecl = node.children?.find(
          (c: any) => c.constructor?.name === 'PathDeclContext'
        );
        const pathText = pathDecl?.getText() || '';
        if (pathText === '/databases/{database}/documents') {
          this.extractDatabaseDocumentsScope(node);
          return;
        }
      }
      if (node.children) {
        for (const child of node.children) {
          walkService(child);
        }
      }
    };
    walkService(rulesetNode);
  }

  private extractDatabaseDocumentsScope(dbMatchNode: any): void {
    for (const child of dbMatchNode.children || []) {
      if (child.constructor?.name === 'MatchStatementContext') {
        const inner = child.children?.[0];
        const innerName = inner?.constructor?.name;
        if (innerName === 'FunctionDeclarationContext') {
          const fnDecl = this.parseFunctionDecl(inner);
          this.functions.set(fnDecl.name, fnDecl);
        } else if (innerName === 'MatchRuleDeclarationContext') {
          this.rootMatches.push(this.parseMatchBlock(inner));
        }
      }
    }
  }

  private parseFunctionDecl(fnNode: any): ParsedFunctionDecl {
    const idNode = fnNode.children?.find(
      (c: any) => c.constructor?.name === 'LocalFunctionIdContext'
    );
    const sigNode = fnNode.children?.find(
      (c: any) => c.constructor?.name === 'FunctionSignatureContext'
    );
    const bodyNode = fnNode.children?.find(
      (c: any) => c.constructor?.name === 'FunctionBodyContext'
    );

    const name = idNode?.getText() || '';
    const params: string[] = [];
    const paramList = sigNode?.children?.find(
      (c: any) => c.constructor?.name === 'ParamListContext'
    );
    if (paramList?.children) {
      for (const p of paramList.children) {
        const pName = p.constructor?.name;
        if (pName === 'LocalVariableIdContext' || pName === 'IdContext') {
          params.push(p.getText());
        }
      }
    }

    const returnStmt = bodyNode?.children?.find(
      (c: any) => c.constructor?.name === 'ReturnStatementContext'
    );
    // returnStmt children: ['return', <ExpressionContext>, ';']
    const returnExprNode = returnStmt?.children?.[1];

    return { name, params, returnExprNode };
  }

  private parseMatchBlock(matchNode: any): ParsedMatchBlock {
    const pathDecl = matchNode.children?.find(
      (c: any) => c.constructor?.name === 'PathDeclContext'
    );
    const pathPattern = pathDecl?.getText() || '';
    const permissions: ParsedPermissionDecl[] = [];
    const children: ParsedMatchBlock[] = [];

    for (const child of matchNode.children || []) {
      if (child.constructor?.name === 'MatchStatementContext') {
        const inner = child.children?.[0];
        const innerName = inner?.constructor?.name;
        if (innerName === 'PermissionDeclarationContext') {
          permissions.push(this.parsePermissionDecl(inner));
        } else if (innerName === 'MatchRuleDeclarationContext') {
          children.push(this.parseMatchBlock(inner));
        }
      }
    }

    return { pathPattern, permissions, children };
  }

  private parsePermissionDecl(permNode: any): ParsedPermissionDecl {
    const ops: RuleOperation[] = [];
    for (const child of permNode.children || []) {
      if (child.constructor?.name === 'OperationIdContext') {
        const opText = child.getText();
        if (opText === 'read') {
          ops.push('get', 'list');
        } else if (opText === 'write') {
          ops.push('create', 'update', 'delete');
        } else if (
          opText === 'get' ||
          opText === 'list' ||
          opText === 'create' ||
          opText === 'update' ||
          opText === 'delete'
        ) {
          ops.push(opText);
        }
      }
    }
    const bodyNode = permNode.children?.find(
      (c: any) => c.constructor?.name === 'PermissionBodyContext'
    );
    // PermissionBodyContext children: [':', 'if', <ExpressionContext>]
    const exprNode = bodyNode?.children?.[bodyNode.children.length - 1];
    return { operations: ops, conditionExprNode: exprNode };
  }

  /**
   * Evaluates whether `operation` on `docPath` (e.g. `/videos/vid_1`) is allowed.
   */
  public evaluate(params: {
    docPath: string;
    operation: RuleOperation;
    auth: { uid: string; token: Record<string, unknown> } | null;
    existingData: Record<string, unknown> | null;
    incomingData: Record<string, unknown> | null;
    requestTime: RulesTimestamp;
    documentStore: Map<string, Record<string, unknown>>;
  }): boolean {
    const normalizedPath = params.docPath.startsWith('/')
      ? params.docPath
      : `/${params.docPath}`;

    const checkBlock = (
      block: ParsedMatchBlock,
      parentPattern: string,
      inheritedCaptures: Record<string, string>
    ): boolean => {
      const fullPattern = `${parentPattern}${block.pathPattern}`;
      const exactMatch = matchDocumentPath(fullPattern, normalizedPath);

      if (exactMatch) {
        const captures = { ...inheritedCaptures, ...exactMatch };
        for (const perm of block.permissions) {
          if (perm.operations.includes(params.operation)) {
            const baseScope: Record<string, unknown> = {
              ...captures,
              database: '(default)',
              request: {
                auth: params.auth,
                time: params.requestTime,
                resource:
                  params.incomingData != null ? { data: params.incomingData } : null,
              },
              resource:
                params.existingData != null ? { data: params.existingData } : null,
            };
            try {
              const result = this.evalExpr(
                perm.conditionExprNode,
                baseScope,
                params.documentStore
              );
              if (result === true) {
                return true;
              }
            } catch {
              // In Firestore Rules, null dereferences or runtime errors in a branch evaluate that branch to false
            }
          }
        }
      }

      // Check nested child match blocks if prefix matches
      const prefixCaptures = matchPathPrefix(fullPattern, normalizedPath);
      if (prefixCaptures) {
        const mergedCaptures = { ...inheritedCaptures, ...prefixCaptures };
        for (const childBlock of block.children) {
          if (checkBlock(childBlock, fullPattern, mergedCaptures)) {
            return true;
          }
        }
      }

      return false;
    };

    for (const rootBlock of this.rootMatches) {
      if (checkBlock(rootBlock, '', {})) {
        return true;
      }
    }
    return false;
  }

  private evalExpr(
    node: any,
    scope: Record<string, unknown>,
    documentStore: Map<string, Record<string, unknown>>
  ): any {
    if (!node) return false;
    const cname = node.constructor?.name;

    switch (cname) {
      case 'PrimaryExpressionContext':
        return this.evalExpr(node.children[0], scope, documentStore);

      case 'ParenSimpleExpressionContext':
        return this.evalExpr(node.children[1], scope, documentStore);

      case 'LiteralExpressionContext':
      case 'LiteralContext': {
        const raw = node.getText();
        if (raw === 'true') return true;
        if (raw === 'false') return false;
        if (raw === 'null') return null;
        if (
          (raw.startsWith("'") && raw.endsWith("'")) ||
          (raw.startsWith('"') && raw.endsWith('"'))
        ) {
          return raw
            .slice(1, -1)
            .replace(/\\\\/g, '\\')
            .replace(/\\'/g, "'")
            .replace(/\\"/g, '"');
        }
        return Number(raw);
      }

      case 'VariableSimpleExpressionContext': {
        const varName = node.getText();
        if (varName in scope) {
          return scope[varName];
        }
        return undefined;
      }

      case 'LogicalAndExpressionContext': {
        const left = this.evalExpr(node.children[0], scope, documentStore);
        if (!left) return false;
        const right = this.evalExpr(node.children[2], scope, documentStore);
        return Boolean(right);
      }

      case 'LogicalOrExpressionContext': {
        let left = false;
        try {
          left = Boolean(this.evalExpr(node.children[0], scope, documentStore));
        } catch {
          left = false;
        }
        if (left) return true;
        const right = this.evalExpr(node.children[2], scope, documentStore);
        return Boolean(right);
      }

      case 'EqualityExpressionContext': {
        const left = this.evalExpr(node.children[0], scope, documentStore);
        const op = node.children[1].getText();
        const right = this.evalExpr(node.children[2], scope, documentStore);
        const eq = rulesValuesEqual(left, right);
        return op === '==' ? eq : !eq;
      }

      case 'RelationalExpressionContext': {
        const left = this.evalExpr(node.children[0], scope, documentStore);
        const op = node.children[1].getText();
        const right = this.evalExpr(node.children[2], scope, documentStore);
        if (typeof left !== 'number' || typeof right !== 'number') {
          throw new RulesNullPointerError('Relational comparison on non-number');
        }
        if (op === '<') return left < right;
        if (op === '<=') return left <= right;
        if (op === '>') return left > right;
        if (op === '>=') return left >= right;
        return false;
      }

      case 'AdditiveExpressionContext': {
        const left = this.evalExpr(node.children[0], scope, documentStore);
        const op = node.children[1].getText();
        const right = this.evalExpr(node.children[2], scope, documentStore);
        if (op === '+') return (left as any) + (right as any);
        if (op === '-') return (left as number) - (right as number);
        return 0;
      }

      case 'ExprIsTypeIdExpressionContext': {
        const val = this.evalExpr(node.children[0], scope, documentStore);
        const typeName = node.children[2].getText();
        if (typeName === 'string') return typeof val === 'string';
        if (typeName === 'number' || typeName === 'int' || typeName === 'float') {
          return typeof val === 'number' && !Number.isNaN(val);
        }
        if (typeName === 'bool') return typeof val === 'boolean';
        if (typeName === 'timestamp') return val instanceof RulesTimestamp;
        if (typeName === 'list') return Array.isArray(val) || val instanceof RulesList;
        if (typeName === 'map') {
          return typeof val === 'object' && val !== null && !(val instanceof RulesTimestamp);
        }
        return false;
      }

      case 'ExprInExpressionContext': {
        const val = this.evalExpr(node.children[0], scope, documentStore);
        const container = this.evalExpr(node.children[2], scope, documentStore);
        if (container instanceof RulesList) {
          return container.includes(val);
        }
        if (Array.isArray(container)) {
          return container.some((item) => rulesValuesEqual(item, val));
        }
        if (container && typeof container === 'object') {
          return Object.prototype.hasOwnProperty.call(container, String(val));
        }
        return false;
      }

      case 'ListSimpleExpressionContext': {
        const exprList = node.children?.find(
          (c: any) => c.constructor?.name === 'ExpressionListContext'
        );
        const items = this.evalExpressionList(exprList, scope, documentStore);
        return new RulesList(items);
      }

      case 'MemberLookupSimpleExpressionContext': {
        const target = this.evalExpr(node.children[0], scope, documentStore);
        const prop = node.children[2].getText();
        if (target == null || typeof target !== 'object') {
          throw new RulesNullPointerError(`Cannot read property '${prop}' of null/undefined`);
        }
        return (target as Record<string, unknown>)[prop];
      }

      case 'IdMemberFunctionCallSimpleExpressionContext': {
        const varName = node.children[0].getText();
        const target = scope[varName];
        const methodName = node.children[2].getText();
        const exprList = node.children?.find(
          (c: any) => c.constructor?.name === 'ExpressionListContext'
        );
        const args = this.evalExpressionList(exprList, scope, documentStore);
        return this.invokeMemberMethod(target, methodName, args);
      }

      case 'MemberFunctionCallSimpleExpressionContext': {
        const target = this.evalExpr(node.children[0], scope, documentStore);
        const methodName = node.children[2].getText();
        const exprList = node.children?.find(
          (c: any) => c.constructor?.name === 'ExpressionListContext'
        );
        const args = this.evalExpressionList(exprList, scope, documentStore);
        return this.invokeMemberMethod(target, methodName, args);
      }

      case 'FunctionCallSimpleExpressionContext': {
        const fnName = node.children[0].getText();
        const exprList = node.children?.find(
          (c: any) => c.constructor?.name === 'ExpressionListContext'
        );
        const args = this.evalExpressionList(exprList, scope, documentStore);

        if (fnName === 'exists') {
          const docPath = normalizeDbDocumentPath(String(args[0] || ''));
          return documentStore.has(docPath);
        }
        if (fnName === 'get') {
          const docPath = normalizeDbDocumentPath(String(args[0] || ''));
          const found = documentStore.get(docPath);
          return found ? { data: found } : null;
        }

        const userFn = this.functions.get(fnName);
        if (!userFn) {
          throw new Error(`Unknown function '${fnName}' in firestore.rules`);
        }
        const fnScope: Record<string, unknown> = { ...scope };
        userFn.params.forEach((paramName, idx) => {
          fnScope[paramName] = args[idx];
        });
        return this.evalExpr(userFn.returnExprNode, fnScope, documentStore);
      }

      case 'PathSimpleExpressionContext':
        return this.evalExpr(node.children[0], scope, documentStore);

      case 'PathExpressionContext': {
        let resolved = '';
        for (const seg of node.children || []) {
          const segChild = seg.children?.[0];
          const text = seg.getText();
          if (text.startsWith('/$(') && text.endsWith(')')) {
            // Segment has embedded expression: children of seg are ['/', '$(', <Expr>, ')']
            const innerExpr =
              seg.children?.find((c: any) => c.constructor?.name?.includes('Expression')) ||
              segChild?.children?.find((c: any) => c.constructor?.name?.includes('Expression'));
            if (innerExpr) {
              const val = this.evalExpr(innerExpr, scope, documentStore);
              if (val == null) {
                throw new RulesNullPointerError('Null path interpolation');
              }
              resolved += `/${String(val)}`;
            } else {
              // Fallback: evaluate variable inside $(...)
              const innerText = text.slice(3, -1);
              const val = this.evalPathInterpolationText(innerText, scope);
              resolved += `/${String(val)}`;
            }
          } else {
            resolved += text;
          }
        }
        return resolved;
      }

      default: {
        if (node.children?.length === 1) {
          return this.evalExpr(node.children[0], scope, documentStore);
        }
        throw new Error(`Unsupported ANTLR4 node type: ${cname}`);
      }
    }
  }

  private evalPathInterpolationText(
    exprText: string,
    scope: Record<string, unknown>
  ): unknown {
    const parts = exprText.split('.');
    let cur: any = scope;
    for (const part of parts) {
      if (cur == null || typeof cur !== 'object') {
        throw new RulesNullPointerError(`Null dereference in path $(${exprText})`);
      }
      cur = cur[part];
    }
    if (cur == null) {
      throw new RulesNullPointerError(`Null value in path $(${exprText})`);
    }
    return cur;
  }

  private evalExpressionList(
    exprListNode: any,
    scope: Record<string, unknown>,
    documentStore: Map<string, Record<string, unknown>>
  ): unknown[] {
    if (!exprListNode?.children) return [];
    const results: unknown[] = [];
    for (const child of exprListNode.children) {
      if (child.getText() === ',') continue;
      results.push(this.evalExpr(child, scope, documentStore));
    }
    return results;
  }

  private invokeMemberMethod(
    target: any,
    methodName: string,
    args: unknown[]
  ): unknown {
    if (target == null) {
      throw new RulesNullPointerError(`Cannot call .${methodName}() on null/undefined`);
    }

    if (target instanceof RulesList) {
      if (methodName === 'size') return target.size();
      if (methodName === 'hasAll') return target.hasAll(args[0] as any);
      if (methodName === 'hasOnly') return target.hasOnly(args[0] as any);
      if (methodName === 'hasAny') return target.hasAny(args[0] as any);
    }

    if (target instanceof RulesMapDiff) {
      if (methodName === 'affectedKeys') return target.affectedKeys();
      if (methodName === 'addedKeys') return target.addedKeys();
      if (methodName === 'changedKeys') return target.changedKeysList();
    }

    if (typeof target === 'string') {
      if (methodName === 'size') return target.length;
      if (methodName === 'matches') {
        const pattern = String(args[0] || '');
        const regex = new RegExp(pattern);
        return regex.test(target);
      }
    }

    if (Array.isArray(target)) {
      const list = new RulesList(target);
      if (methodName === 'size') return list.size();
      if (methodName === 'hasAll') return list.hasAll(args[0] as any);
      if (methodName === 'hasOnly') return list.hasOnly(args[0] as any);
      if (methodName === 'hasAny') return list.hasAny(args[0] as any);
    }

    if (typeof target === 'object' && target !== null) {
      if (methodName === 'keys') {
        return new RulesList(Object.keys(target));
      }
      if (methodName === 'size') {
        return Object.keys(target).length;
      }
      if (methodName === 'diff') {
        const other = (args[0] || {}) as Record<string, unknown>;
        return new RulesMapDiff(target as Record<string, unknown>, other);
      }
    }

    throw new Error(`Unsupported member method .${methodName}()`);
  }
}

function normalizeDbDocumentPath(rawPath: string): string {
  const prefix = '/databases/(default)/documents';
  if (rawPath.startsWith(prefix)) {
    return rawPath.slice(prefix.length) || '/';
  }
  return rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
}

function matchDocumentPath(
  pattern: string,
  docPath: string
): Record<string, string> | null {
  const patSegs = pattern.split('/').filter(Boolean);
  const pathSegs = docPath.split('/').filter(Boolean);

  const captures: Record<string, string> = {};
  for (let i = 0; i < patSegs.length; i++) {
    const pSeg = patSegs[i];
    if (pSeg.startsWith('{') && pSeg.endsWith('=**}')) {
      const varName = pSeg.slice(1, -4);
      captures[varName] = pathSegs.slice(i).join('/');
      return captures;
    }
    if (i >= pathSegs.length) return null;
    if (pSeg.startsWith('{') && pSeg.endsWith('}')) {
      const varName = pSeg.slice(1, -1);
      captures[varName] = pathSegs[i];
    } else if (pSeg !== pathSegs[i]) {
      return null;
    }
  }

  if (patSegs.length !== pathSegs.length) return null;
  return captures;
}

function matchPathPrefix(
  pattern: string,
  docPath: string
): Record<string, string> | null {
  const patSegs = pattern.split('/').filter(Boolean);
  const pathSegs = docPath.split('/').filter(Boolean);
  if (pathSegs.length <= patSegs.length) return null;

  const captures: Record<string, string> = {};
  for (let i = 0; i < patSegs.length; i++) {
    const pSeg = patSegs[i];
    if (pSeg.startsWith('{') && pSeg.endsWith('}')) {
      const varName = pSeg.slice(1, -1);
      captures[varName] = pathSegs[i];
    } else if (pSeg !== pathSegs[i]) {
      return null;
    }
  }
  return captures;
}

function createPermissionDeniedError(operation: string, path: string): Error {
  const err = new Error(
    `7 PERMISSION_DENIED: Missing or insufficient permissions for ${operation} on ${path}.`
  ) as Error & { code: string };
  err.code = 'permission-denied';
  return err;
}

function resolvePayloadTimestamps(
  payload: Record<string, unknown>,
  requestTime: RulesTimestamp
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v instanceof ServerTimestampSentinel) {
      out[k] = requestTime;
    } else {
      out[k] = v;
    }
  }
  return out;
}

export interface SimulatedDocRef {
  readonly path: string;
}

export interface SimulatedCollectionQuery {
  readonly collectionPath: string;
  readonly filters: Array<{ field: string; op: '==' | 'in'; value: unknown }>;
}

export function doc(db: RulesDatabaseClient, path: string): SimulatedDocRef {
  return db.doc(path);
}

export function collection(
  db: RulesDatabaseClient,
  collectionPath: string
): SimulatedCollectionQuery {
  return db.collection(collectionPath);
}

export function where(
  field: string,
  op: '==' | 'in',
  value: unknown
): { field: string; op: '==' | 'in'; value: unknown } {
  return { field, op, value };
}

export function query(
  col: SimulatedCollectionQuery,
  ...constraints: Array<{ field: string; op: '==' | 'in'; value: unknown }>
): SimulatedCollectionQuery {
  return {
    collectionPath: col.collectionPath,
    filters: [...col.filters, ...constraints],
    _db: (col as any)._db,
  } as SimulatedCollectionQuery;
}

export async function getDoc(ref: SimulatedDocRef & { _db?: RulesDatabaseClient }) {
  if (!ref._db) throw new Error('Invalid document reference');
  return ref._db.getDoc(ref.path);
}

export async function getDocs(
  q: SimulatedCollectionQuery & { _db?: RulesDatabaseClient }
) {
  if (!q._db) throw new Error('Invalid collection query');
  return q._db.getDocs(q);
}

export async function setDoc(
  ref: SimulatedDocRef & { _db?: RulesDatabaseClient },
  data: Record<string, unknown>
) {
  if (!ref._db) throw new Error('Invalid document reference');
  return ref._db.setDoc(ref.path, data);
}

export async function updateDoc(
  ref: SimulatedDocRef & { _db?: RulesDatabaseClient },
  partialData: Record<string, unknown>
) {
  if (!ref._db) throw new Error('Invalid document reference');
  return ref._db.updateDoc(ref.path, partialData);
}

export async function deleteDoc(ref: SimulatedDocRef & { _db?: RulesDatabaseClient }) {
  if (!ref._db) throw new Error('Invalid document reference');
  return ref._db.deleteDoc(ref.path);
}

export class RulesDatabaseClient {
  private readonly ruleset: CompiledFirestoreRuleset;
  private readonly store: Map<string, Record<string, unknown>>;
  private readonly auth: { uid: string; token: Record<string, unknown> } | null;
  private readonly bypassRules: boolean;
  private readonly nowProvider: () => RulesTimestamp;

  constructor(params: {
    ruleset: CompiledFirestoreRuleset;
    store: Map<string, Record<string, unknown>>;
    auth: { uid: string; token: Record<string, unknown> } | null;
    bypassRules: boolean;
    nowProvider: () => RulesTimestamp;
  }) {
    this.ruleset = params.ruleset;
    this.store = params.store;
    this.auth = params.auth;
    this.bypassRules = params.bypassRules;
    this.nowProvider = params.nowProvider;
  }

  public doc(path: string): SimulatedDocRef & { _db: RulesDatabaseClient } {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return { path: cleanPath, _db: this };
  }

  public collection(
    collectionPath: string
  ): SimulatedCollectionQuery & { _db: RulesDatabaseClient } {
    const cleanPath = collectionPath.startsWith('/')
      ? collectionPath
      : `/${collectionPath}`;
    return { collectionPath: cleanPath, filters: [], _db: this };
  }

  public async getDoc(
    docPath: string
  ): Promise<{ exists: () => boolean; data: () => Record<string, unknown> | undefined }> {
    const normalized = docPath.startsWith('/') ? docPath : `/${docPath}`;
    const existing = this.store.get(normalized) ?? null;

    if (!this.bypassRules) {
      const allowed = this.ruleset.evaluate({
        docPath: normalized,
        operation: 'get',
        auth: this.auth,
        existingData: existing,
        incomingData: null,
        requestTime: this.nowProvider(),
        documentStore: this.store,
      });
      if (!allowed) {
        throw createPermissionDeniedError('get', normalized);
      }
    }

    return {
      exists: () => existing !== null,
      data: () => (existing ? { ...existing } : undefined),
    };
  }

  public async getDocs(
    q: SimulatedCollectionQuery
  ): Promise<{ docs: Array<{ id: string; data: () => Record<string, unknown> }> }> {
    const prefix = q.collectionPath.endsWith('/')
      ? q.collectionPath
      : `${q.collectionPath}/`;
    const prefixSegCount = q.collectionPath.split('/').filter(Boolean).length;

    const candidateDocs: Array<{ path: string; id: string; data: Record<string, unknown> }> = [];
    for (const [docPath, docData] of this.store.entries()) {
      if (!docPath.startsWith(prefix)) continue;
      const segs = docPath.split('/').filter(Boolean);
      if (segs.length !== prefixSegCount + 1) continue;

      const matchesFilters = q.filters.every((f) => {
        const fieldVal = docData[f.field];
        if (f.op === '==') return rulesValuesEqual(fieldVal, f.value);
        if (f.op === 'in' && Array.isArray(f.value)) {
          return f.value.some((v) => rulesValuesEqual(fieldVal, v));
        }
        return false;
      });
      if (matchesFilters) {
        candidateDocs.push({
          path: docPath,
          id: segs[segs.length - 1],
          data: docData,
        });
      }
    }

    if (!this.bypassRules) {
      // If collection is empty or no docs matched, still evaluate a synthetic probe from the query filters
      // so blanket/unconstrained list queries fail if the rule requires resource.data constraints!
      if (candidateDocs.length === 0) {
        const syntheticResource: Record<string, unknown> = {};
        for (const f of q.filters) {
          if (f.op === '==') {
            syntheticResource[f.field] = f.value;
          }
        }
        const probePath = `${prefix}probe_doc_id`;
        const allowed = this.ruleset.evaluate({
          docPath: probePath,
          operation: 'list',
          auth: this.auth,
          existingData: syntheticResource,
          incomingData: null,
          requestTime: this.nowProvider(),
          documentStore: this.store,
        });
        if (!allowed) {
          throw createPermissionDeniedError('list', q.collectionPath);
        }
      } else {
        for (const cand of candidateDocs) {
          const allowed = this.ruleset.evaluate({
            docPath: cand.path,
            operation: 'list',
            auth: this.auth,
            existingData: cand.data,
            incomingData: null,
            requestTime: this.nowProvider(),
            documentStore: this.store,
          });
          if (!allowed) {
            throw createPermissionDeniedError('list', cand.path);
          }
        }
      }
    }

    return {
      docs: candidateDocs.map((c) => ({
        id: c.id,
        data: () => ({ ...c.data }),
      })),
    };
  }

  public async setDoc(docPath: string, payload: Record<string, unknown>): Promise<void> {
    const normalized = docPath.startsWith('/') ? docPath : `/${docPath}`;
    const existing = this.store.get(normalized) ?? null;
    const reqTime = this.nowProvider();
    const resolvedIncoming = resolvePayloadTimestamps(payload, reqTime);
    const op: RuleOperation = existing === null ? 'create' : 'update';

    if (!this.bypassRules) {
      const allowed = this.ruleset.evaluate({
        docPath: normalized,
        operation: op,
        auth: this.auth,
        existingData: existing,
        incomingData: resolvedIncoming,
        requestTime: reqTime,
        documentStore: this.store,
      });
      if (!allowed) {
        throw createPermissionDeniedError(op, normalized);
      }
    }

    this.store.set(normalized, resolvedIncoming);
  }

  public async updateDoc(
    docPath: string,
    partialPayload: Record<string, unknown>
  ): Promise<void> {
    const normalized = docPath.startsWith('/') ? docPath : `/${docPath}`;
    const existing = this.store.get(normalized) ?? null;
    if (!existing) {
      throw createPermissionDeniedError('update', normalized);
    }

    const reqTime = this.nowProvider();
    const resolvedPartial = resolvePayloadTimestamps(partialPayload, reqTime);
    const mergedIncoming: Record<string, unknown> = {
      ...existing,
      ...resolvedPartial,
    };

    if (!this.bypassRules) {
      const allowed = this.ruleset.evaluate({
        docPath: normalized,
        operation: 'update',
        auth: this.auth,
        existingData: existing,
        incomingData: mergedIncoming,
        requestTime: reqTime,
        documentStore: this.store,
      });
      if (!allowed) {
        throw createPermissionDeniedError('update', normalized);
      }
    }

    this.store.set(normalized, mergedIncoming);
  }

  public async deleteDoc(docPath: string): Promise<void> {
    const normalized = docPath.startsWith('/') ? docPath : `/${docPath}`;
    const existing = this.store.get(normalized) ?? null;

    if (!this.bypassRules) {
      const allowed = this.ruleset.evaluate({
        docPath: normalized,
        operation: 'delete',
        auth: this.auth,
        existingData: existing,
        incomingData: null,
        requestTime: this.nowProvider(),
        documentStore: this.store,
      });
      if (!allowed) {
        throw createPermissionDeniedError('delete', normalized);
      }
    }

    this.store.delete(normalized);
  }
}

export class RulesTestContext {
  private readonly dbClient: RulesDatabaseClient;

  constructor(dbClient: RulesDatabaseClient) {
    this.dbClient = dbClient;
  }

  public firestore(): RulesDatabaseClient {
    return this.dbClient;
  }
}

export class FirestoreRulesTestEnvironment {
  public readonly projectId: string;
  private readonly ruleset: CompiledFirestoreRuleset;
  private readonly store = new Map<string, Record<string, unknown>>();
  private currentEpochMs = 1_750_000_000_000;

  constructor(projectId: string, rulesSource: string) {
    this.projectId = projectId;
    this.ruleset = new CompiledFirestoreRuleset(rulesSource);
  }

  public advanceClockMs(deltaMs: number): void {
    this.currentEpochMs += deltaMs;
  }

  public authenticatedContext(
    uid: string,
    tokenClaims: Record<string, unknown> = {}
  ): RulesTestContext {
    const auth = {
      uid,
      token: {
        sub: uid,
        user_id: uid,
        email_verified: true,
        ...tokenClaims,
      },
    };
    return new RulesTestContext(
      new RulesDatabaseClient({
        ruleset: this.ruleset,
        store: this.store,
        auth,
        bypassRules: false,
        nowProvider: () => new RulesTimestamp(this.currentEpochMs),
      })
    );
  }

  public unauthenticatedContext(): RulesTestContext {
    return new RulesTestContext(
      new RulesDatabaseClient({
        ruleset: this.ruleset,
        store: this.store,
        auth: null,
        bypassRules: false,
        nowProvider: () => new RulesTimestamp(this.currentEpochMs),
      })
    );
  }

  public async withSecurityRulesDisabled(
    callback: (context: RulesTestContext) => Promise<void>
  ): Promise<void> {
    const adminBypassContext = new RulesTestContext(
      new RulesDatabaseClient({
        ruleset: this.ruleset,
        store: this.store,
        auth: { uid: '__admin_bypass__', token: { email_verified: true } },
        bypassRules: true,
        nowProvider: () => new RulesTimestamp(this.currentEpochMs),
      })
    );
    await callback(adminBypassContext);
  }

  public async clearFirestore(): Promise<void> {
    this.store.clear();
  }

  public async cleanup(): Promise<void> {
    this.store.clear();
  }
}

export async function initializeRulesTestEnvironment(options?: {
  projectId?: string;
  rulesPath?: string;
  rulesSource?: string;
}): Promise<FirestoreRulesTestEnvironment> {
  const projectId = options?.projectId || 'gen-lang-client-0029274497';
  const rulesSource =
    options?.rulesSource ??
    fs.readFileSync(options?.rulesPath || 'firestore.rules', 'utf8');
  return new FirestoreRulesTestEnvironment(projectId, rulesSource);
}
