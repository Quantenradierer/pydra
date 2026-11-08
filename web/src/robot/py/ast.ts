/** The syntax tree of the teaching subset. Every node keeps its line and column (1-based line, 0-based column). */
export interface Loc {
  line: number;
  col: number;
}

export type Expr = Loc &
  (
    | { kind: 'int'; value: number }
    | { kind: 'float'; value: number }
    | { kind: 'str'; value: string }
    | { kind: 'fstr'; parts: (string | { expr: Expr; conv?: 'r' | 's'; spec: string })[] }
    | { kind: 'const'; value: boolean | null }
    | { kind: 'name'; name: string }
    | { kind: 'list'; items: Expr[] }
    | { kind: 'tuple'; items: Expr[] }
    | { kind: 'dict'; entries: [Expr, Expr][] }
    | { kind: 'unary'; op: '-' | '+' | 'not'; operand: Expr }
    | { kind: 'binary'; op: '+' | '-' | '*' | '/' | '//' | '%' | '**'; left: Expr; right: Expr }
    | { kind: 'bool'; op: 'and' | 'or'; left: Expr; right: Expr }
    | { kind: 'compare'; first: Expr; rest: { op: CompareOp; right: Expr }[] }
    | { kind: 'ifexp'; test: Expr; body: Expr; orelse: Expr }
    | { kind: 'call'; func: Expr; args: Expr[]; kwargs: { name: string; value: Expr }[] }
    | { kind: 'attr'; obj: Expr; name: string }
    | { kind: 'index'; obj: Expr; index: Expr }
    | { kind: 'slice'; obj: Expr; lower?: Expr; upper?: Expr; step?: Expr }
  );

export type CompareOp = '==' | '!=' | '<' | '>' | '<=' | '>=' | 'in' | 'not in' | 'is' | 'is not';

export type Target = Loc & ({ kind: 'name'; name: string } | { kind: 'index'; obj: Expr; index: Expr } | { kind: 'tuple'; items: Target[] });

export interface Param {
  name: string;
  default?: Expr;
}

export type Stmt = Loc &
  (
    | { kind: 'expr'; expr: Expr }
    | { kind: 'assign'; targets: Target[]; value: Expr }
    | { kind: 'augassign'; target: Target; op: '+' | '-' | '*' | '/' | '//' | '%' | '**'; value: Expr }
    | { kind: 'if'; test: Expr; body: Stmt[]; orelse: Stmt[] }
    | { kind: 'while'; test: Expr; body: Stmt[] }
    | { kind: 'for'; target: Target; iter: Expr; body: Stmt[] }
    | { kind: 'break' }
    | { kind: 'continue' }
    | { kind: 'pass' }
    | { kind: 'def'; name: string; params: Param[]; body: Stmt[] }
    | { kind: 'return'; value?: Expr }
    | { kind: 'global'; names: string[] }
  );
