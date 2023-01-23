/**
 * 作用域
 */

import { AstVisitor, Block, ForStatement, FunctionDecl } from './ast';
import { Symbol, SymbolDumper } from './symbol';

/**
 * 作用域
 * 用来限定标识符的可见性。
 */
export class Scope {
  // 以名称为key存储符号
  name2sym: Map<string, Symbol> = new Map();

  // 上级作用域
  enclosingScope: Scope | null; //顶级作用域的上一级是null

  constructor(enclosingScope: Scope | null) {
    this.enclosingScope = enclosingScope;
  }

  /**
   * 把符号记入符号表（作用域）
   * @param name
   * @param sym
   */
  enter(name: string, sym: Symbol): void {
    this.name2sym.set(name, sym);
  }

  /**
   * 查询是否有某名称的符号
   * @param name
   */
  hasSymbol(name: string): boolean {
    return this.name2sym.has(name);
  }

  /**
   * 根据名称查找符号。
   * @param name 符号名称。
   * @returns 根据名称查到的Symbol。如果没有查到，则返回null。
   */
  getSymbol(name: string): Symbol | null {
    let sym = this.name2sym.get(name);
    if (typeof sym == 'object') {
      return sym;
    } else {
      return null;
    }
  }

  /**
   * 级联查找某个符号。
   * 先从本作用域查找，查不到就去上一级作用域，依此类推。
   * @param name
   */
  getSymbolCascade(name: string): Symbol | null {
    let sym = this.getSymbol(name);

    if (sym != null) {
      return sym;
    } else if (this.enclosingScope != null) {
      return this.enclosingScope.getSymbolCascade(name);
    } else {
      return null;
    }
  }
}

/**
 * 打印 Scope 信息
 */
export class ScopeDumper extends AstVisitor {
  visitFunctionDecl(functionDecl: FunctionDecl, prefix: any): any {
    console.log(prefix + 'Scope of function: ' + functionDecl.name);

    // 显示本级 Scope
    if (functionDecl.scope != null) {
      this.dumpScope(functionDecl.scope, prefix);
    } else {
      console.log(prefix + '{null}');
    }

    // 继续遍历
    super.visitFunctionDecl(functionDecl, prefix + '    ');
  }

  visitBlock(block: Block, prefix: any): any {
    console.log(prefix + 'Scope of block');
    // 显示本级 Scope
    if (block.scope != null) {
      this.dumpScope(block.scope, prefix);
    } else {
      console.log(prefix + '{null}');
    }

    // 继续遍历
    super.visitBlock(block, prefix + '    ');
  }

  visitForStatement(stmt: ForStatement, prefix: any): any {
    console.log(prefix + 'Scope of for statement');
    // 显示本级 Scope
    if (stmt.scope != null) {
      this.dumpScope(stmt.scope, prefix);
    } else {
      console.log(prefix + '{null}');
    }

    // 继续遍历
    super.visitForStatement(stmt, prefix);
  }

  private dumpScope(scope: Scope, prefix: string) {
    if (scope.name2sym.size > 0) {
      // 遍历该作用域的符号
      let symbolDumper = new SymbolDumper();
      for (let sym of scope.name2sym.values()) {
        symbolDumper.visit(sym, prefix + '    ');
      }
    } else {
      console.log(prefix + '    {empty}');
    }
  }
}
