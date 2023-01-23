/**
 * AST
 */

////////////////////////////////////////////////////////////////////////////////
// Parser
/**
 * AST基类
 */
export abstract class AstNode {
  // 打印对象信息，prefix 是前面填充的字符串，通常用于缩进显示
  public abstract dump(prefix: string): void;

  // visitor 模式中，用于接受 visitor 的访问
  public abstract accept(visitor: AstVisitor): any;
}

/**
 * 声明
 * 所有声明都会对应一个符号。
 */
export abstract class Decl {
  name: string;

  constructor(name: string) {
    this.name = name;
  }
}

/**
 * 函数声明节点
 */
export class FunctionDecl extends Decl {
  body: Block; //函数体
  constructor(name: string, body: Block) {
    super(name);
    this.body = body;
  }

  public accept(visitor: AstVisitor): any {
    return visitor.visitFunctionDecl(this);
  }

  public dump(prefix: string): void {
    console.log(prefix + 'FunctionDecl ' + this.name);
    this.body.dump(prefix + '    ');
  }
}

/**
 * 函数体
 */
export class Block extends AstNode {
  stmts: Statement[];

  constructor(stmts: Statement[]) {
    super();
    this.stmts = stmts;
  }

  public accept(visitor: AstVisitor): any {
    return visitor.visitBlock(this);
  }

  public dump(prefix: string): void {
    console.log(prefix + 'Block');
    this.stmts.forEach((x) => x.dump(prefix + '    '));
  }
}

/**
 * 程序节点，也是 AST 的根节点
 */
export class Prog extends Block {
  public accept(visitor: AstVisitor): any {
    return visitor.visitProg(this);
  }

  public dump(prefix: string): void {
    console.log(prefix + 'Prog');
    this.stmts.forEach((x) => x.dump(prefix + '    '));
  }
}

/**
 * 变量声明节点
 */
export class VariableDecl extends Decl {
  varType: string; // 变量类型
  init: Expression | null; // 变量初始化所使用的表达式
  constructor(name: string, varType: string, init: Expression | null) {
    super(name);
    this.varType = varType;
    this.init = init;
  }

  public accept(visitor: AstVisitor): any {
    return visitor.visitVariableDecl(this);
  }

  public dump(prefix: string): void {
    console.log(prefix + 'VariableDecl ' + this.name + ', type: ' + this.varType);
    if (this.init == null) {
      console.log(prefix + 'no initialization.');
    } else {
      this.init.dump(prefix + '    ');
    }
  }
}

/**
 * 语句
 * 其子类包括函数声明、表达式语句
 */
export abstract class Statement extends AstNode {}

/**
 * 语句
 * 其子类包括函数声明、表达式语句
 */
export abstract class Expression extends AstNode {}

/**
 * 二元表达式
 */
export class Binary extends Expression {
  op: string; // 运算符
  exp1: Expression; // 左边的表达式
  exp2: Expression; // 右边的表达式
  constructor(op: string, exp1: Expression, exp2: Expression) {
    super();
    this.op = op;
    this.exp1 = exp1;
    this.exp2 = exp2;
  }

  public accept(visitor: AstVisitor): any {
    return visitor.visitBinary(this);
  }

  public dump(prefix: string): void {
    console.log(prefix + 'Binary:' + this.op);
    this.exp1.dump(prefix + '    ');
    this.exp2.dump(prefix + '    ');
  }
}

/**
 * 表达式语句
 * 就是在表达式后面加个分号
 */
export class ExpressionStatement extends Statement {
  exp: Expression;

  constructor(exp: Expression) {
    super();
    this.exp = exp;
  }

  public accept(visitor: AstVisitor): any {
    return visitor.visitExpressionStatement(this);
  }

  public dump(prefix: string): void {
    console.log(prefix + 'ExpressionStatement');
    this.exp.dump(prefix + '    ');
  }
}

/**
 * 函数调用
 */
export class FunctionCall extends AstNode {
  name: string;
  parameters: Expression[];
  decl: FunctionDecl | null = null; //指向函数的声明
  constructor(name: string, parameters: Expression[]) {
    super();
    this.name = name;
    this.parameters = parameters;
  }

  public accept(visitor: AstVisitor): any {
    return visitor.visitFunctionCall(this);
  }

  public dump(prefix: string): void {
    console.log(prefix + 'FunctionCall ' + this.name + (this.decl != null ? ', resolved' : ', not resolved'));
    this.parameters.forEach((x) => x.dump(prefix + '    '));
  }
}

/**
 * 变量引用
 */
export class Variable extends Expression {
  name: string;
  decl: VariableDecl | null = null; // 指向变量声明
  constructor(name: string) {
    super();
    this.name = name;
  }

  public accept(visitor: AstVisitor): any {
    return visitor.visitVariable(this);
  }

  public dump(prefix: string): void {
    console.log(prefix + 'Variable: ' + this.name + (this.decl != null ? ', resolved' : ', not resolved'));
  }
}

/**
 * 字符串字面量
 */
export class StringLiteral extends Expression {
  value: string;

  constructor(value: string) {
    super();
    this.value = value;
  }

  public accept(visitor: AstVisitor): any {
    return visitor.visitStringLiteral(this);
  }

  public dump(prefix: string): void {
    console.log(prefix + this.value);
  }
}

/**
 * 整型字面量
 */
export class IntegerLiteral extends Expression {
  value: number;

  constructor(value: number) {
    super();
    this.value = value;
  }

  public accept(visitor: AstVisitor): any {
    return visitor.visitIntegerLiteral(this);
  }

  public dump(prefix: string): void {
    console.log(prefix + this.value);
  }
}

/**
 * 实数字面量
 */
export class DecimalLiteral extends Expression {
  value: number;

  constructor(value: number) {
    super();
    this.value = value;
  }

  public accept(visitor: AstVisitor): any {
    return visitor.visitDecimalLiteral(this);
  }

  public dump(prefix: string): void {
    console.log(prefix + this.value);
  }
}

/**
 * null字面量
 */
export class NullLiteral extends Expression {
  value: null = null;

  constructor() {
    super();
  }

  public accept(visitor: AstVisitor): any {
    return visitor.visitNullLiteral(this);
  }

  public dump(prefix: string): void {
    console.log(prefix + this.value);
  }
}

/**
 * Boolean字面量
 */
export class BooleanLiteral extends Expression {
  value: boolean;

  constructor(value: boolean) {
    super();
    this.value = value;
  }

  public accept(visitor: AstVisitor): any {
    return visitor.visitBooleanLiteral(this);
  }

  public dump(prefix: string): void {
    console.log(prefix + this.value);
  }
}

////////////////////////////////////////////////////////////////////////////////
// Visitor

/**
 * 对 AST 做遍历的 Visitor
 * 这是一个基类，定义了缺省的遍历方式。子类可以覆盖某些方法，修改遍历方式。
 */
export abstract class AstVisitor {
  // 对抽象类的访问。
  // 相应的具体类，会调用visitor合适的具体方法。
  visit(node: AstNode): any {
    return node.accept(this);
  }

  visitProg(prog: Prog): any {
    let retVal: any;
    for (let x of prog.stmts) {
      retVal = this.visit(x);
    }
    return retVal;
  }

  visitVariableDecl(variableDecl: VariableDecl): any {
    if (variableDecl.init != null) {
      return this.visit(variableDecl.init);
    }
  }

  visitFunctionDecl(functionDecl: FunctionDecl): any {
    return this.visitBlock(functionDecl.body);
  }

  visitBlock(Block: Block): any {
    let retVal: any;
    for (let x of Block.stmts) {
      retVal = this.visit(x);
    }
    return retVal;
  }

  visitExpressionStatement(stmt: ExpressionStatement): any {
    return this.visit(stmt.exp);
  }

  visitBinary(exp: Binary): any {
    this.visit(exp.exp1);
    this.visit(exp.exp2);
  }

  visitIntegerLiteral(exp: IntegerLiteral): any {
    return exp.value;
  }

  visitDecimalLiteral(exp: DecimalLiteral): any {
    return exp.value;
  }

  visitStringLiteral(exp: StringLiteral): any {
    return exp.value;
  }

  visitNullLiteral(exp: NullLiteral): any {
    return exp.value;
  }

  visitBooleanLiteral(exp: BooleanLiteral): any {
    return exp.value;
  }

  visitVariable(variable: Variable): any {
    return undefined;
  }

  visitFunctionCall(functionCall: FunctionCall): any {
    return undefined;
  }
}
