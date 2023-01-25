/**
 * 符号表和作用域
 */

import { FunctionDecl } from './ast';
import { FunctionType, SysTypes, Type } from './types';

/////////////////////////////////////////////////////////////////////////
// 符号表
//

/**
 * 符号
 */
export abstract class Symbol {
  name: string;
  theType: Type = SysTypes.Any;
  kind: SymKind;

  protected constructor(name: string, theType: Type, kind: SymKind) {
    this.name = name;
    this.theType = theType;
    this.kind = kind;
  }

  /**
   * visitor模式
   * @param visitor
   * @param additional 额外需要传递给visitor的信息。
   */
  abstract accept(visitor: SymbolVisitor, additional: any): any;
}

export class FunctionSymbol extends Symbol {
  vars: VarSymbol[] = []; //本地变量的列表。参数也算本地变量。

  opStackSize: number = 10; //操作数栈的大小

  byteCode: number[] | null = null; //存放生成的字节码

  decl: FunctionDecl | null = null; //存放AST，作为代码来运行

  constructor(name: string, theType: FunctionType, vars: VarSymbol[] = []) {
    super(name, theType, SymKind.Function);
    this.theType = theType;
    this.vars = vars;
  }

  /**
   * visitor模式
   * @param visitor
   * @param additional 额外需要传递给 visitor 的信息。
   */
  accept(visitor: SymbolVisitor, additional: any = undefined): any {
    visitor.visitFunctionSymbol(this, additional);
  }

  //获取参数数量
  getNumParams(): number {
    return (this.theType as FunctionType).paramTypes.length;
  }
}

export class VarSymbol extends Symbol {
  constructor(name: string, theType: Type) {
    super(name, theType, SymKind.Variable);
    this.theType = theType;
  }

  /**
   * visitor模式
   * @param visitor
   * @param additional 额外需要传递给visitor的信息。
   */
  accept(visitor: SymbolVisitor, additional: any = undefined): any {
    visitor.visitVarSymbol(this, additional);
  }
}

/**
 * 符号类型
 */
export enum SymKind {
  Variable,
  Function,
  Class,
  Interface,
  Parameter,
  Prog,
}

/**
 * 左值。
 * 目前先只是指变量。
 */
// export class LeftValue{
//     leftValue_tag = 1234;  //魔法数字，用来做类型判断
//     variable:VarSymbol;
//     constructor(variable:VarSymbol){
//         this.variable = variable;
//     }

//     static isLeftValue(v:any):boolean{
//         return (typeof v == 'object' && typeof (v as LeftValue).variable == 'object' &&
//             typeof (v as LeftValue).leftValue_tag == 'number' && (v as LeftValue).leftValue_tag == 1234);
//     }
// }

/////////////////////////////////////////////////////////////////////////
//一些系统内置的符号
export let FUN_println = new FunctionSymbol('println', new FunctionType(SysTypes.Void, [SysTypes.String]), [
  new VarSymbol('a', SysTypes.String),
]);
export let FUN_tick = new FunctionSymbol('tick', new FunctionType(SysTypes.Integer, []), []);
export let FUN_integer_to_string = new FunctionSymbol(
  'integer_to_string',
  new FunctionType(SysTypes.String, [SysTypes.Integer]),
  [new VarSymbol('a', SysTypes.Integer)],
);

export let built_ins: Map<string, FunctionSymbol> = new Map([
  ['println', FUN_println],
  ['tick', FUN_tick],
  ['integer_to_string', FUN_integer_to_string],
  // ["string_concat", FUN_string_concat],
]);

let FUN_string_create_by_str = new FunctionSymbol(
  'string_create_by_str',
  new FunctionType(SysTypes.String, [SysTypes.String]),
  [new VarSymbol('a', SysTypes.String)],
);
let FUN_string_concat = new FunctionSymbol(
  'string_concat',
  new FunctionType(SysTypes.String, [SysTypes.String, SysTypes.String]),
  [new VarSymbol('str1', SysTypes.String), new VarSymbol('str2', SysTypes.String)],
);

export let intrinsics: Map<string, FunctionSymbol> = new Map([
  ['string_create_by_str', FUN_string_create_by_str],
  ['string_concat', FUN_string_concat],
]);

///////////////////////////////////////////////////////////////////////
//visitor
export abstract class SymbolVisitor {
  abstract visitVarSymbol(sym: VarSymbol, additional: any): any;

  abstract visitFunctionSymbol(sym: FunctionSymbol, additional: any): any;
}

export class SymbolDumper extends SymbolVisitor {
  visit(sym: Symbol, additional: any) {
    return sym.accept(this, additional);
  }

  /*
   * 输出VarSymbol的调试信息
   * @param sym
   * @param additional 前缀字符串
   */
  visitVarSymbol(sym: VarSymbol, additional: any): any {
    console.log(additional + sym.name + '{' + SymKind[sym.kind] + '}');
  }

  /**
   * 输出FunctionSymbol的调试信息
   * @param sym
   * @param additional 前缀字符串
   */
  visitFunctionSymbol(sym: FunctionSymbol, additional: any): any {
    console.log(additional + sym.name + '{' + SymKind[sym.kind] + ', local var count:' + sym.vars.length + '}');
    // 输出字节码
    if (sym.byteCode != null) {
      let str: string = '';
      for (let code of sym.byteCode) {
        str += code.toString(16) + ' ';
      }
      console.log(additional + '    bytecode: ' + str);
    }
  }
}
