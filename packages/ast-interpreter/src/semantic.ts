/**
 * 语义分析功能
 *
 * 当前特性：
 * 1. 树状的符号表
 * 2. 简单的引用消解：没有考虑声明的先后顺序，也没有考虑闭包
 * 3. 简单的作用域
 */

// @ts-ignore
import { assert } from 'console';

import {
  AstNode,
  AstVisitor,
  Binary,
  Block,
  FunctionCall,
  FunctionDecl,
  Prog,
  Unary,
  Variable,
  VariableDecl,
} from './ast';
import { CompilerError } from './error';
import { Op, Operators } from './scanner';
import { Scope } from './scope';
import { built_ins, FunctionSymbol, SymKind, VarSymbol } from './symbol';
import { FunctionType, SysTypes, Type } from './types';

export class SemanticAnalyer {
  passes: SemanticAstVisitor[] = [
    new Enter(),
    new RefResolver(),
    new TypeChecker(),
    new TypeConverter(),
    new LeftValueAttributor(),
  ];

  errors: CompilerError[] = []; // 语义错误
  warnings: CompilerError[] = []; // 语义报警信息

  execute(prog: Prog): void {
    this.errors = [];
    this.warnings = [];
    for (let pass of this.passes) {
      pass.visitProg(prog);
      this.errors = this.errors.concat(pass.errors);
      this.warnings = this.warnings.concat(pass.warnings);
    }
  }
}

export class SemanticError extends CompilerError {
  node: AstNode;

  constructor(msg: string, node: AstNode, isWarning = false) {
    super(msg, node.beginPos, /* node.endPos, */ isWarning);
    this.node = node;
  }
}

abstract class SemanticAstVisitor extends AstVisitor {
  errors: CompilerError[] = []; // 语义错误
  warnings: CompilerError[] = []; // 语义报警信息

  addError(msg: string, node: AstNode) {
    this.errors.push(new SemanticError(msg, node));
    console.log('@' + node.beginPos.toString() + ' : ' + msg);
  }

  addWarning(msg: string, node: AstNode) {
    this.warnings.push(new SemanticError(msg, node, true));
    console.log('@' + node.beginPos.toString() + ' : ' + msg);
  }
}

/////////////////////////////////////////////////////////////////////////
// 建立符号表
//

/**
 * 把符号加入符号表。
 */
class Enter extends SemanticAstVisitor {
  scope: Scope | null = null; //当前所属的scope
  functionSym: FunctionSymbol | null = null;

  /**
   * 返回最顶级的Scope对象
   * @param prog
   */
  visitProg(prog: Prog) {
    let sym = new FunctionSymbol('main', new FunctionType(SysTypes.Integer, []));
    prog.sym = sym;
    this.functionSym = sym;

    return super.visitProg(prog);
  }

  /**
   * 把函数声明加入符号表
   * @param functionDecl
   */
  visitFunctionDecl(functionDecl: FunctionDecl): any {
    let currentScope = this.scope as Scope;

    // 创建函数的 symbol
    let paramTypes: Type[] = [];
    if (functionDecl.callSignature.paramList != null) {
      for (let p of functionDecl.callSignature.paramList.params) {
        paramTypes.push(p.theType);
      }
    }
    let sym = new FunctionSymbol(functionDecl.name, new FunctionType(functionDecl.callSignature.theType, paramTypes));
    sym.decl = functionDecl;
    functionDecl.sym = sym;

    // 把函数加入当前 scope
    if (currentScope.hasSymbol(functionDecl.name)) {
      this.addError('Dumplicate symbol: ' + functionDecl.name, functionDecl);
    } else {
      currentScope.enter(functionDecl.name, sym);
    }

    // 修改当前的函数符号
    let lastFunctionSym = this.functionSym;
    this.functionSym = sym;

    // 创建新的Scope，用来存放参数
    let oldScope = currentScope;
    this.scope = new Scope(oldScope);
    functionDecl.scope = this.scope;

    // 遍历子节点
    super.visitFunctionDecl(functionDecl);

    // 恢复当前函数
    this.functionSym = lastFunctionSym;

    // 恢复原来的Scope
    this.scope = oldScope;
  }

  /**
   * 遇到块的时候，就建立一级新的作用域。
   * 支持块作用域
   * @param block
   */
  visitBlock(block: Block): any {
    //创建下一级scope
    let oldScope = this.scope;
    this.scope = new Scope(this.scope);
    block.scope = this.scope;

    //调用父类的方法，遍历所有的语句
    super.visitBlock(block);

    //重新设置当前的Scope
    this.scope = oldScope;
  }

  /**
   * 把变量声明加入符号表
   * @param variableDecl
   */
  visitVariableDecl(variableDecl: VariableDecl): any {
    let currentScope = this.scope as Scope;
    if (currentScope.hasSymbol(variableDecl.name)) {
      this.addError('Dumplicate symbol: ' + variableDecl.name, variableDecl);
    }
    // 把变量加入当前的符号表
    let sym = new VarSymbol(variableDecl.name, variableDecl.theType);
    variableDecl.sym = sym;
    currentScope.enter(variableDecl.name, sym);

    // 把本地变量也加入函数符号中，可用于后面生成代码
    this.functionSym?.vars.push(sym);
  }
}

/////////////////////////////////////////////////////////////////////////
// 引用消解
// 1.函数引用消解
// 2.变量应用消解

/**
 * 引用消解
 * 遍历AST。如果发现函数调用和变量引用，就去找它的定义。
 */
class RefResolver extends SemanticAstVisitor {
  scope: Scope | null = null; //当前的Scope

  //每个Scope已经声明了的变量的列表
  declaredVarsMap: Map<Scope, Map<string, VarSymbol>> = new Map();

  visitFunctionDecl(functionDecl: FunctionDecl): any {
    //1.修改scope
    let oldScope = this.scope;
    this.scope = functionDecl.scope as Scope;
    assert(this.scope != null, 'Scope不可为null');

    //为已声明的变量设置一个存储区域
    this.declaredVarsMap.set(this.scope, new Map());

    //2.遍历下级节点
    super.visitFunctionDecl(functionDecl);

    //3.重新设置scope
    this.scope = oldScope;
  }

  /**
   * 修改当前的Scope
   * @param block
   */
  visitBlock(block: Block): any {
    //1.修改scope
    let oldScope = this.scope;
    this.scope = block.scope as Scope;
    assert(this.scope != null, 'Scope不可为null');

    //为已声明的变量设置一个存储区域
    this.declaredVarsMap.set(this.scope, new Map());

    //2.遍历下级节点
    super.visitBlock(block);

    //3.重新设置scope
    this.scope = oldScope;
  }

  /**
   * 做函数的消解。
   * 函数不需要声明在前，使用在后。
   * @param functionCall
   */
  visitFunctionCall(functionCall: FunctionCall): any {
    let currentScope = this.scope as Scope;
    // console.log("in semantic.visitFunctionCall: " + functionCall.name);
    if (built_ins.has(functionCall.name)) {
      //系统内置函数
      functionCall.sym = built_ins.get(functionCall.name) as FunctionSymbol;
    } else {
      functionCall.sym = currentScope.getSymbolCascade(functionCall.name) as FunctionSymbol | null;
    }

    // console.log(functionCall.sym);

    //调用下级，主要是参数。
    super.visitFunctionCall(functionCall);
  }

  /**
   * 标记变量是否已被声明
   * @param variableDecl
   */
  visitVariableDecl(variableDecl: VariableDecl): any {
    let currentScope = this.scope as Scope;
    let declaredSyms = this.declaredVarsMap.get(currentScope) as Map<string, VarSymbol>;
    let sym = currentScope.getSymbol(variableDecl.name);
    if (sym != null) {
      //TODO 需要检查sym是否是变量
      declaredSyms.set(variableDecl.name, sym as VarSymbol);
    }

    //处理初始化的部分
    super.visitVariableDecl(variableDecl);
  }

  /**
   * 变量引用消解
   * 变量必须声明在前，使用在后。
   * @param variable
   */
  visitVariable(variable: Variable): any {
    let currentScope = this.scope as Scope;
    variable.sym = this.findVariableCascade(currentScope, variable);
  }

  /**
   * 逐级查找某个符号是不是在声明前就使用了。
   * @param scope
   * @param name
   * @param kind
   */
  private findVariableCascade(scope: Scope, variable: Variable): VarSymbol | null {
    let declaredSyms = this.declaredVarsMap.get(scope) as Map<string, VarSymbol>;
    let symInScope = scope.getSymbol(variable.name);
    if (symInScope != null) {
      if (declaredSyms.has(variable.name)) {
        return declaredSyms.get(variable.name) as VarSymbol; //找到了，成功返回。
      } else {
        if (symInScope.kind == SymKind.Variable) {
          this.addError("Variable: '" + variable.name + "' is used before declaration.", variable);
        } else {
          this.addError(
            "We expect a variable of name: '" + variable.name + "', but find a " + SymKind[symInScope.kind] + '.',
            variable,
          );
        }
      }
    } else {
      if (scope.enclosingScope != null) {
        return this.findVariableCascade(scope.enclosingScope, variable);
      } else {
        this.addError("Cannot find a variable of name: '" + variable.name + "'", variable);
      }
    }
    return null;
  }
}

/////////////////////////////////////////////////////////////////////////
// 属性分析
// 1.类型计算和检查
//

class LeftValueAttributor extends SemanticAstVisitor {
  parentOperator: Op | null = null;

  /**
   * 检查赋值符号和.符号左边是否是左值
   * @param binary
   */
  visitBinary(binary: Binary): any {
    if (Operators.isAssignOp(binary.op) || binary.op == Op.Dot) {
      let lastParentOperator = this.parentOperator;
      this.parentOperator = binary.op;

      //检查左子节点
      this.visit(binary.exp1);
      if (!binary.exp1.isLeftValue) {
        this.addError('Left child of operator ' + Op[binary.op] + ' need a left value', binary.exp1);
      }

      //恢复原来的状态信息
      this.parentOperator = lastParentOperator;

      //继续遍历右子节点
      this.visit(binary.exp2);
    } else {
      super.visitBinary(binary);
    }
  }

  visitUnary(u: Unary): any {
    //要求必须是个左值
    if (u.op == Op.Inc || u.op == Op.Dec) {
      let lastParentOperator = this.parentOperator;
      this.parentOperator = u.op;

      this.visit(u.exp);
      if (!u.exp.isLeftValue) {
        this.addError('Unary operator ' + Op[u.op] + 'can only be applied to a left value', u);
      }

      //恢复原来的状态信息
      this.parentOperator = lastParentOperator;
    } else {
      super.visitUnary(u);
    }
  }

  /**
   * 变量都可以作为左值，除非其类型是void
   * @param v
   */
  visitVariable(v: Variable): any {
    if (this.parentOperator != null) {
      let t = v.theType as Type;
      if (!t.hasVoid()) {
        v.isLeftValue = true;
      }
    }
  }

  /**
   * 但函数调用是在.符号左边，并且返回值不为void的时候，可以作为左值
   * @param functionCall
   */
  visitFunctionCall(functionCall: FunctionCall): any {
    if (this.parentOperator == Op.Dot) {
      let functionType = functionCall.theType as FunctionType;
      if (!functionType.returnType.hasVoid()) {
        functionCall.isLeftValue = true;
      }
    }
  }
}

/**
 * 类型检查
 */
class TypeChecker extends SemanticAstVisitor {
  visitVariableDecl(variableDecl: VariableDecl): any {
    super.visitVariableDecl(variableDecl);

    if (variableDecl.init != null) {
      let t1 = variableDecl.theType as Type;
      let t2 = variableDecl.init.theType as Type;
      if (!t2.LE(t1)) {
        this.addError("Operator '=' can not be applied to '" + t1.name + "' and '" + t2.name + "'.", variableDecl);
      }

      //类型推断：对于any类型，变成=号右边的具体类型
      if (t1 === SysTypes.Any) {
        variableDecl.theType = t2; //TODO：此处要调整
        // variableDecl.inferredType = t2;
        //重点是把类型记入符号中，这样相应的变量声明就会获得准确的类型
        //由于肯定是声明在前，使用在后，所以变量引用的类型是准确的。
        (variableDecl.sym as VarSymbol).theType = t2;
      }
    }
  }

  visitBinary(bi: Binary): any {
    super.visitBinary(bi);

    let t1 = bi.exp1.theType as Type;
    let t2 = bi.exp2.theType as Type;
    if (Operators.isAssignOp(bi.op)) {
      bi.theType = t1;
      if (!t2.LE(t1)) {
        //检查类型匹配
        this.addError(
          "Operator '" + Op[bi.op] + "' can not be applied to '" + t1.name + "' and '" + t2.name + "'.",
          bi,
        );
      }
    } else if (bi.op == Op.Plus) {
      //有一边是string，或者两边都是number才行。
      if (t1 == SysTypes.String || t2 == SysTypes.String) {
        bi.theType = SysTypes.String;
      } else if (t1.LE(SysTypes.Number) && t2.LE(SysTypes.Number)) {
        bi.theType = Type.getUpperBound(t1, t2);
      } else {
        this.addError(
          "Operator '" + Op[bi.op] + "' can not be applied to '" + t1.name + "' and '" + t2.name + "'.",
          bi,
        );
      }
    } else if (Operators.isArithmeticOp(bi.op)) {
      if (t1.LE(SysTypes.Number) && t2.LE(SysTypes.Number)) {
        bi.theType = Type.getUpperBound(t1, t2);
      } else {
        this.addError(
          "Operator '" + Op[bi.op] + "' can not be applied to '" + t1.name + "' and '" + t2.name + "'.",
          bi,
        );
      }
    } else if (Operators.isRelationOp(bi.op)) {
      if (t1.LE(SysTypes.Number) && t2.LE(SysTypes.Number)) {
        bi.theType = SysTypes.Boolean;
      } else {
        this.addError(
          "Operator '" + Op[bi.op] + "' can not be applied to '" + t1.name + "' and '" + t2.name + "'.",
          bi,
        );
      }
    } else if (Operators.isLogicalOp(bi.op)) {
      if (t1.LE(SysTypes.Boolean) && t2.LE(SysTypes.Boolean)) {
        bi.theType = SysTypes.Boolean;
      } else {
        this.addError(
          "Operator '" + Op[bi.op] + "' can not be applied to '" + t1.name + "' and '" + t2.name + "'.",
          bi,
        );
      }
    } else {
      this.addError('Unsupported binary operator: ' + Op[bi.op], bi);
    }
  }

  visitUnary(u: Unary): any {
    super.visitUnary(u);

    let t = u.exp.theType as Type;
    //要求必须是个左值
    if (u.op == Op.Inc || u.op == Op.Dec) {
      if (t.LE(SysTypes.Number)) {
        u.theType = t;
      } else {
        this.addError('Unary operator ' + Op[u.op] + "can not be applied to '" + t.name + "'.", u);
      }
    } else if (u.op == Op.Minus || u.op == Op.Plus) {
      if (t.LE(SysTypes.Number)) {
        u.theType = t;
      } else {
        this.addError('Unary operator ' + Op[u.op] + "can not be applied to '" + t.name + "'.", u);
      }
    } else if (u.op == Op.Not) {
      if (t.LE(SysTypes.Boolean)) {
        u.theType = t;
      } else {
        this.addError('Unary operator ' + Op[u.op] + "can not be applied to '" + t.name + "'.", u);
      }
    } else {
      this.addError('Unsupported unary operator: ' + Op[u.op] + " applied to '" + t.name + "'.", u);
    }
  }

  /**
   * 用符号的类型（也就是变量声明的类型），来标注本节点
   * @param v
   */
  visitVariable(v: Variable): any {
    if (v.sym != null) {
      v.theType = v.sym.theType;
    }
  }

  visitFunctionCall(functionCall: FunctionCall): any {
    if (functionCall.sym != null) {
      let functionType = functionCall.sym.theType as FunctionType;

      //注意：不使用函数类型，而是使用返回值的类型
      functionCall.theType = functionType.returnType;

      //检查参数数量
      if (functionCall.arguments.length != functionType.paramTypes.length) {
        this.addError(
          'FunctionCall of ' +
            functionCall.name +
            ' has ' +
            functionCall.arguments.length +
            ' arguments, while expecting ' +
            functionType.paramTypes.length +
            '.',
          functionCall,
        );
      }

      //检查注意检查参数的类型
      for (let i = 0; i < functionCall.arguments.length; i++) {
        this.visit(functionCall.arguments[i]);
        if (i < functionType.paramTypes.length) {
          let t1 = functionCall.arguments[i].theType as Type;
          let t2 = functionType.paramTypes[i] as Type;
          if (!t1.LE(t2) && t2 !== SysTypes.String) {
            this.addError(
              'Argument ' +
                i +
                ' of FunctionCall ' +
                functionCall.name +
                'is of Type ' +
                t1.name +
                ', while expecting ' +
                t2.name,
              functionCall,
            );
          }
        }
      }
    }
  }
}

/**
 * 类型转换
 * 添加必要的AST节点，来完成转换
 * 目前特性：其他类型转换成字符串
 */
class TypeConverter extends SemanticAstVisitor {
  visitBinary(bi: Binary): any {
    super.visitBinary(bi);

    let t1 = bi.exp1.theType as Type;
    let t2 = bi.exp2.theType as Type;

    if (Operators.isAssignOp(bi.op)) {
      if (t1 === SysTypes.String && t2 !== SysTypes.String) {
        if (t2 === SysTypes.Integer) {
          let exp = new FunctionCall(bi.exp2.beginPos, bi.exp2.endPos, 'integer_to_string', [bi.exp2]);
          exp.sym = built_ins.get('integer_to_string') as FunctionSymbol;
          bi.exp2 = exp;
        }
      }
    } else if (bi.op == Op.Plus) {
      //有一边是string，或者两边都是number才行。
      if (t1 === SysTypes.String || t2 === SysTypes.String) {
        if (t1 === SysTypes.Integer || t1 === SysTypes.Number) {
          let exp = new FunctionCall(bi.exp1.beginPos, bi.exp1.endPos, 'integer_to_string', [bi.exp1]);
          exp.sym = built_ins.get('integer_to_string') as FunctionSymbol;
          bi.exp1 = exp;
        }
        if (t2 === SysTypes.Integer || t2 === SysTypes.Number) {
          let exp = new FunctionCall(bi.exp2.beginPos, bi.exp2.endPos, 'integer_to_string', [bi.exp2]);
          exp.sym = built_ins.get('integer_to_string') as FunctionSymbol;
          bi.exp2 = exp;
        }
      }
    }
  }

  visitFunctionCall(functionCall: FunctionCall): any {
    if (functionCall.sym != null) {
      let functionType = functionCall.sym.theType as FunctionType;

      //看看参数有没有可以转换的。
      for (let i = 0; i < functionCall.arguments.length; i++) {
        this.visit(functionCall.arguments[i]);
        if (i < functionType.paramTypes.length) {
          let t1 = functionCall.arguments[i].theType as Type;
          let t2 = functionType.paramTypes[i] as Type;
          if ((t1 === SysTypes.Integer || t1 === SysTypes.Number) && t2 === SysTypes.String) {
            let exp = new FunctionCall(
              functionCall.arguments[i].beginPos,
              functionCall.arguments[i].endPos,
              'integer_to_string',
              [functionCall.arguments[i]],
            );
            exp.sym = built_ins.get('integer_to_string') as FunctionSymbol;
            functionCall.arguments[i] = exp;
          }
        }
      }
    }
  }
}

/**
 * 常量折叠
 */
class ConstFolder extends SemanticAstVisitor {
  visitBinary(bi: Binary): any {
    let v1 = bi.exp1.constValue;
    let v2 = bi.exp2.constValue;
    if (Operators.isAssignOp(bi.op)) {
      if (typeof v2 != 'undefined') {
        if (bi.op == Op.Assign) {
          //暂时只支持=号
          bi.exp1.constValue = v1;
          bi.constValue = v1;
        } else {
          this.addError('Unsupported operator: ' + Op[bi.op] + 'in ConstFolder', bi);
        }
      }
    } else if (typeof v1 != 'undefined' && typeof v2 != 'undefined') {
      let v: any;
      switch (bi.op) {
        case Op.Plus: //'+'
          v = v1 + v2;
          break;
        case Op.Minus: //'-'
          v = v1 - v2;
          break;
        case Op.Multiply: //'*'
          v = v1 * v2;
          break;
        case Op.Divide: //'/'
          v = v1 / v2;
          break;
        case Op.Modulus: //'%'
          v = v1 % v2;
          break;
        case Op.G: //'>'
          v = v1 > v2;
          break;
        case Op.GE: //'>='
          v = v1 >= v2;
          break;
        case Op.L: //'<'
          v = v1 < v2;
          break;
        case Op.LE: //'<='
          v = v1 <= v2;
          break;
        case Op.EQ: //'=='
          v = v1 == v2;
          break;
        case Op.NE: //'!='
          v = v1 != v2;
          break;
        case Op.And: //'&&'
          v = v1 && v2;
          break;
        case Op.Or: //'||'
          v = v1 || v2;
          break;
        default:
          this.addError('Unsupported binary operator: ' + Op[bi.op] + 'in ConstFolder', bi);
      }
      bi.op = v;
    }
  }

  visitUnary(u: Unary): any {
    let v1 = u.exp.constValue;
    if (typeof v1 != 'undefined') {
      if (u.op == Op.Inc) {
        if (u.isPrefix) {
          u.exp.constValue += 1;
          u.constValue = u.exp.constValue;
        } else {
          u.constValue = v1;
          u.exp.constValue += 1;
        }
      } else if (u.op == Op.Dec) {
        if (u.isPrefix) {
          u.exp.constValue -= 1;
          u.constValue = u.exp.constValue;
        } else {
          u.constValue = v1;
          u.exp.constValue -= 1;
        }
      } else if (u.op == Op.Plus) {
        u.constValue = v1;
      } else if (u.op == Op.Minus) {
        u.constValue = -v1;
      } else if (u.op == Op.Not) {
        u.constValue = !v1;
      } else {
        this.addError('Unsupported unary operator: ' + Op[u.op] + 'in ConstFolder', u);
      }
    }
  }
}
