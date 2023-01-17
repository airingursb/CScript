/**
 * 1.递归下降的方法做词法分析；
 * 2.语义分析中的引用消解（找到函数的定义）；
 * 3.通过遍历AST的方法，执行程序。
 * 4.新增词法分析；
 * 5.升级语法分析为LL算法，因此需要知道如何使用First和Follow集合。
 *
 * 目前词法规则是比较精简的，比如不考虑Unicode。
 * Identifier: [a-zA-Z_][a-zA-Z0-9_]* ;
 */

/////////////////////////////////////////////////////////////////////////
// 词法分析

// Token的类型
enum TokenKind {
  Keyword,
  Identifier,
  StringLiteral,
  Separator,
  Operator,
  EOF,
}

// 代表一个Token的数据结构
interface Token {
  kind: TokenKind;
  text: string;
}

/**
 * 一个字符串流。其操作为：
 * peek(): 预读下一个字符，但不移动指针；
 * next(): 读取下一个字符，并且移动指针；
 * eof(): 判断是否已经到了结尾。
 */
class CharStream {
  data: string;
  pos: number = 0;
  line: number = 1;
  col: number = 0;

  constructor(data: string) {
    this.data = data;
  }

  peek(): string {
    return this.data.charAt(this.pos);
  }

  next(): string {
    let ch = this.data.charAt(this.pos++);
    if (ch == '\n') {
      this.line++;
      this.col = 0;
    } else {
      this.col++;
    }
    return ch;
  }

  eof(): boolean {
    return this.peek() == '';
  }
}

/**
 * 词法分析器。
 * 词法分析器的接口像是一个流，词法解析是按需进行的。
 * 支持下面两个操作：
 * next(): 返回当前的Token，并移向下一个Token。
 * peek(): 返回当前的Token，但不移动当前位置。
 */
class Tokenizer {
  stream: CharStream;
  nextToken: Token = { kind: TokenKind.EOF, text: '' };

  constructor(stream: CharStream) {
    this.stream = stream;
  }

  next(): Token {
    // 在第一次的时候，先parse一个Token
    if (this.nextToken.kind == TokenKind.EOF && !this.stream.eof()) {
      this.nextToken = this.getAToken();
    }
    let lastToken = this.nextToken;

    // 往前走一个Token
    this.nextToken = this.getAToken();
    return lastToken;
  }

  peek(): Token {
    if (this.nextToken.kind == TokenKind.EOF && !this.stream.eof()) {
      this.nextToken = this.getAToken();
    }
    return this.nextToken;
  }

  // 从字符串流中获取一个新Token。
  private getAToken(): Token {
    this.skipWhiteSpaces();
    if (this.stream.eof()) {
      return { kind: TokenKind.EOF, text: '' };
    } else {
      let ch: string = this.stream.peek();
      if (this.isLetter(ch) || this.isDigit(ch)) {
        return this.parseIdentifer();
      } else if (ch == '"') {
        return this.parseStringLiteral();
      } else if (ch == '(' || ch == ')' || ch == '{' || ch == '}' || ch == ';' || ch == ',') {
        this.stream.next();
        return { kind: TokenKind.Separator, text: ch };
      } else if (ch == '/') {
        this.stream.next();
        let ch1 = this.stream.peek();
        if (ch1 == '*') {
          this.skipMultipleLineComments();
          return this.getAToken();
        } else if (ch1 == '/') {
          this.skipSingleLineComment();
          return this.getAToken();
        } else if (ch1 == '=') {
          this.stream.next();
          return { kind: TokenKind.Operator, text: '/=' };
        } else {
          return { kind: TokenKind.Operator, text: '/' };
        }
      } else if (ch == '+') {
        this.stream.next();
        let ch1 = this.stream.peek();
        if (ch1 == '+') {
          this.stream.next();
          return { kind: TokenKind.Operator, text: '++' };
        } else if (ch1 == '=') {
          this.stream.next();
          return { kind: TokenKind.Operator, text: '+=' };
        } else {
          return { kind: TokenKind.Operator, text: '+' };
        }
      } else if (ch == '-') {
        this.stream.next();
        let ch1 = this.stream.peek();
        if (ch1 == '-') {
          this.stream.next();
          return { kind: TokenKind.Operator, text: '--' };
        } else if (ch1 == '=') {
          this.stream.next();
          return { kind: TokenKind.Operator, text: '-=' };
        } else {
          return { kind: TokenKind.Operator, text: '-' };
        }
      } else if (ch == '*') {
        this.stream.next();
        let ch1 = this.stream.peek();
        if (ch1 == '=') {
          this.stream.next();
          return { kind: TokenKind.Operator, text: '*=' };
        } else {
          return { kind: TokenKind.Operator, text: '*' };
        }
      } else {
        // 暂时去掉不能识别的字符
        console.log("Unrecognized pattern meeting ': " + ch + "', at" + this.stream.line + ' col: ' + this.stream.col);
        this.stream.next();
        return this.getAToken();
      }
    }
  }

  /**
   * 跳过单行注释
   */
  private skipSingleLineComment() {
    // 跳过第二个/，第一个之前已经跳过去了。
    this.stream.next();

    // 往后一直找到回车或者eof
    while (this.stream.peek() != '\n' && !this.stream.eof()) {
      this.stream.next();
    }
  }

  /**
   * 跳过多行注释
   */
  private skipMultipleLineComments() {
    // 跳过*，/之前已经跳过去了。
    this.stream.next();

    if (!this.stream.eof()) {
      let ch1 = this.stream.next();
      // 往后一直找到回车或者eof
      while (!this.stream.eof()) {
        let ch2 = this.stream.next();
        if (ch1 == '*' && ch2 == '/') {
          return;
        }
        ch1 = ch2;
      }
    }

    // 如果没有匹配上，报错。
    console.log(
      "Failed to find matching */ for multiple line comments at ': " + this.stream.line + ' col: ' + this.stream.col,
    );
  }

  /**
   * 跳过空白字符
   */
  private skipWhiteSpaces() {
    while (this.isWhiteSpace(this.stream.peek())) {
      this.stream.next();
    }
  }

  /**
   * 字符串字面量。
   * 目前只支持双引号，并且不支持转义。
   */
  private parseStringLiteral(): Token {
    let token: Token = { kind: TokenKind.StringLiteral, text: '' };

    // 第一个字符不用判断，因为在调用者那里已经判断过了
    this.stream.next();

    while (!this.stream.eof() && this.stream.peek() != '"') {
      token.text += this.stream.next();
    }

    if (this.stream.peek() == '"') {
      // 消化掉字符换末尾的引号
      this.stream.next();
    } else {
      console.log('Expecting an " at line: ' + this.stream.line + ' col: ' + this.stream.col);
    }

    return token;
  }

  /**
   * 解析标识符。从标识符中还要挑出关键字。
   */
  private parseIdentifer(): Token {
    let token: Token = { kind: TokenKind.Identifier, text: '' };

    // 第一个字符不用判断，因为在调用者那里已经判断过了
    token.text += this.stream.next();

    // 读入后序字符
    while (!this.stream.eof() && this.isLetterDigitOrUnderScore(this.stream.peek())) {
      token.text += this.stream.next();
    }

    // 识别出关键字
    if (token.text == 'function') {
      token.kind = TokenKind.Keyword;
    }

    return token;
  }

  private isLetterDigitOrUnderScore(ch: string): boolean {
    return (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch == '_';
  }

  private isLetter(ch: string): boolean {
    return (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z');
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  private isWhiteSpace(ch: string): boolean {
    return ch == ' ' || ch == '\n' || ch == '\t';
  }
}

/////////////////////////////////////////////////////////////////////////
// 语法分析
// 包括了AST的数据结构和递归下降的语法解析程序

/**
 * 基类
 */
abstract class AstNode {
  //打印对象信息，prefix是前面填充的字符串，通常用于缩进显示
  public abstract dump(prefix: string): void;
}

/**
 * 语句
 * 其子类包括函数声明和函数调用
 */
abstract class Statement extends AstNode {}

/**
 * 程序节点，也是AST的根节点
 */
class Prog extends AstNode {
  stmts: Statement[] = []; // 程序中可以包含多个语句
  constructor(stmts: Statement[]) {
    super();
    this.stmts = stmts;
  }

  public dump(prefix: string): void {
    console.log(prefix + 'Prog');
    this.stmts.forEach((x) => x.dump(prefix + '\t'));
  }
}

/**
 * 函数声明节点
 */
class FunctionDecl extends Statement {
  name: string; //函数名称
  body: FunctionBody; //函数体
  constructor(name: string, body: FunctionBody) {
    super();
    this.name = name;
    this.body = body;
  }

  public dump(prefix: string): void {
    console.log(prefix + 'FunctionDecl ' + this.name);
    this.body.dump(prefix + '\t');
  }
}

/**
 * 函数体
 */
class FunctionBody extends AstNode {
  stmts: FunctionCall[];

  constructor(stmts: FunctionCall[]) {
    super();
    this.stmts = stmts;
  }

  public dump(prefix: string): void {
    console.log(prefix + 'FunctionBody');
    this.stmts.forEach((x) => x.dump(prefix + '\t'));
  }
}

/**
 * 函数调用
 */
class FunctionCall extends Statement {
  name: string;
  parameters: string[];
  definition: FunctionDecl | null = null; //指向函数的声明
  constructor(name: string, parameters: string[]) {
    super();
    this.name = name;
    this.parameters = parameters;
  }

  public dump(prefix: string): void {
    console.log(prefix + 'FunctionCall ' + this.name + (this.definition != null ? ', resolved' : ', not resolved'));
    this.parameters.forEach((x) => console.log(prefix + '\t' + 'Parameter: ' + x));
  }
}

class Parser {
  tokenizer: Tokenizer;

  constructor(tokenizer: Tokenizer) {
    this.tokenizer = tokenizer;
  }

  /**
   * 解析Prog
   * 语法规则：
   * prog = (functionDecl | functionCall)* ;
   */
  parseProg(): Prog {
    let stmts: Statement[] = [];
    let stmt: Statement | null = null;
    let token = this.tokenizer.peek();

    while (token.kind != TokenKind.EOF) {
      if (token.kind == TokenKind.Keyword && token.text == 'function') {
        stmt = this.parseFunctionDecl();
      } else if (token.kind == TokenKind.Identifier) {
        stmt = this.parseFunctionCall();
      }

      if (stmt != null) {
        stmts.push(stmt);
        console.log('success');
      } else {
        //console.log("Unrecognized token: ");
        // console.log(token);
      }
      token = this.tokenizer.peek();
    }
    return new Prog(stmts);
  }

  /**
   * 解析函数声明
   * 语法规则：
   * functionDecl: "function" Identifier "(" ")"  functionBody;
   * 返回值：
   * null-意味着解析过程出错。
   */
  parseFunctionDecl(): FunctionDecl | null {
    console.log('in FunctionDecl');
    // 跳过关键字'function'
    this.tokenizer.next();

    let t = this.tokenizer.next();
    if (t.kind == TokenKind.Identifier) {
      // 读取()
      let t1 = this.tokenizer.next();
      if (t1.text == '(') {
        let t2 = this.tokenizer.next();
        if (t2.text == ')') {
          let functionBody = this.parseFunctionBody();
          if (functionBody != null) {
            //如果解析成功，从这里返回
            return new FunctionDecl(t.text, functionBody);
          } else {
            console.log('Error parsing FunctionBody in FunctionDecl');
            return null;
          }
        } else {
          console.log("Expecting ')' in FunctionDecl, while we got a " + t.text);
          return null;
        }
      } else {
        console.log("Expecting '(' in FunctionDecl, while we got a " + t.text);
        return null;
      }
    } else {
      console.log('Expecting a function name, while we got a ' + t.text);
      return null;
    }

    return null;
  }

  /**
   * 解析函数体
   * 语法规则：
   * functionBody : '{' functionCall* '}' ;
   */
  parseFunctionBody(): FunctionBody | null {
    let stmts: FunctionCall[] = [];
    let t: Token = this.tokenizer.next();
    if (t.text == '{') {
      while (this.tokenizer.peek().kind == TokenKind.Identifier) {
        let functionCall = this.parseFunctionCall();
        if (functionCall != null) {
          stmts.push(functionCall);
        } else {
          console.log('Error parsing a FunctionCall in FunctionBody.');
          return null;
        }
      }
      t = this.tokenizer.next();
      if (t.text == '}') {
        return new FunctionBody(stmts);
      } else {
        console.log("Expecting '}' in FunctionBody, while we got a " + t.text);
        return null;
      }
    } else {
      console.log("Expecting '{' in FunctionBody, while we got a " + t.text);
      return null;
    }
    return null;
  }

  /**
   * 解析函数调用
   * 语法规则：
   * functionCall : Identifier '(' parameterList? ')' ;
   * parameterList : StringLiteral (',' StringLiteral)* ;
   */
  parseFunctionCall(): FunctionCall | null {
    let params: string[] = [];
    let t: Token = this.tokenizer.next();
    if (t.kind == TokenKind.Identifier) {
      let t1: Token = this.tokenizer.next();
      if (t1.text == '(') {
        let t2: Token = this.tokenizer.next();
        //循环，读出所有参数
        while (t2.text != ')') {
          if (t2.kind == TokenKind.StringLiteral) {
            params.push(t2.text);
          } else {
            console.log('Expecting parameter in FunctionCall, while we got a ' + t2.text);
            return null;
          }
          t2 = this.tokenizer.next();
          if (t2.text != ')') {
            if (t2.text == ',') {
              t2 = this.tokenizer.next();
            } else {
              console.log('Expecting a comma in FunctionCall, while we got a ' + t2.text);
              return null;
            }
          }
        }
        //消化掉一个分号：;
        t2 = this.tokenizer.next();
        if (t2.text == ';') {
          return new FunctionCall(t.text, params);
        } else {
          console.log('Expecting a semicolon in FunctionCall, while we got a ' + t2.text);
          return null;
        }
      }
    }

    return null;
  }
}

/**
 * 对 AST 做遍历的 Visitor。
 * 这是一个基类，定义了缺省的遍历方式。子类可以覆盖某些方法，修改遍历方式。
 */
abstract class AstVisitor {
  visitProg(prog: Prog): any {
    let retVal: any;
    for (let x of prog.stmts) {
      if (typeof (x as FunctionDecl).body === 'object') {
        retVal = this.visitFunctionDecl(x as FunctionDecl);
      } else {
        retVal = this.visitFunctionCall(x as FunctionCall);
      }
    }
    return retVal;
  }

  visitFunctionDecl(functionDecl: FunctionDecl): any {
    return this.visitFunctionBody(functionDecl.body);
  }

  visitFunctionBody(functionBody: FunctionBody): any {
    let retVal: any;
    for (let x of functionBody.stmts) {
      retVal = this.visitFunctionCall(x);
    }
    return retVal;
  }

  visitFunctionCall(functionCall: FunctionCall): any {
    return undefined;
  }
}

/////////////////////////////////////////////////////////////////////////
// 语义分析
// 对函数调用做引用消解，也就是找到函数的声明。

/**
 * 遍历 AST。如果发现函数调用，就去找它的定义。
 */
class RefResolver extends AstVisitor {
  prog: Prog | null = null;

  visitProg(prog: Prog): any {
    this.prog = prog;
    for (let x of prog.stmts) {
      let functionCall = x as FunctionCall;
      if (typeof functionCall.parameters === 'object') {
        this.resolveFunctionCall(prog, functionCall);
      } else {
        this.visitFunctionDecl(x as FunctionDecl);
      }
    }
  }

  visitFunctionBody(functionBody: FunctionBody): any {
    if (this.prog != null) {
      for (let x of functionBody.stmts) {
        return this.resolveFunctionCall(this.prog, x);
      }
    }
  }

  private resolveFunctionCall(prog: Prog, functionCall: FunctionCall) {
    let functionDecl = this.findFunctionDecl(prog, functionCall.name);
    if (functionDecl != null) {
      functionCall.definition = functionDecl;
    } else {
      if (functionCall.name != 'println') {
        // 系统内置函数不用报错
        console.log('Error: cannot find definition of function ' + functionCall.name);
      }
    }
  }

  private findFunctionDecl(prog: Prog, name: string): FunctionDecl | null {
    for (let x of prog?.stmts) {
      let functionDecl = x as FunctionDecl;
      if (typeof functionDecl.body === 'object' && functionDecl.name == name) {
        return functionDecl;
      }
    }
    return null;
  }
}

/////////////////////////////////////////////////////////////////////////
// 解释器

/**
 * 遍历 AST，执行函数调用。
 */
class Intepretor extends AstVisitor {
  visitProg(prog: Prog): any {
    let retVal: any;
    for (let x of prog.stmts) {
      let functionCall = x as FunctionCall;
      if (typeof functionCall.parameters === 'object') {
        retVal = this.runFunction(functionCall);
      }
    }
    return retVal;
  }

  visitFunctionBody(functionBody: FunctionBody): any {
    let retVal: any;
    for (let x of functionBody.stmts) {
      retVal = this.runFunction(x);
    }
  }

  private runFunction(functionCall: FunctionCall) {
    if (functionCall.name == 'println') {
      //内置函数
      if (functionCall.parameters.length > 0) {
        console.log(functionCall.parameters[0]);
      } else {
        console.log();
      }
      return 0;
    } else {
      //找到函数定义，继续遍历函数体
      if (functionCall.definition != null) {
        this.visitFunctionBody(functionCall.definition.body);
      }
    }
  }
}

/////////////////////////////////////////////////////////////////////////
// 主程序

function compileAndRun(program: string) {
  // 源代码
  console.log('源代码:');
  console.log(program);

  // 词法分析
  console.log('\n词法分析结果:');
  let tokenizer = new Tokenizer(new CharStream(program));
  while (tokenizer.peek().kind != TokenKind.EOF) {
    console.log(tokenizer.next());
  }
  tokenizer = new Tokenizer(new CharStream(program)); //重置tokenizer,回到开头。

  // 语法分析
  let prog: Prog = new Parser(tokenizer).parseProg();
  console.log('\n语法分析后的AST:');
  prog.dump('');

  // 语义分析
  new RefResolver().visitProg(prog);
  console.log('\n语法分析后的AST，注意自定义函数的调用已被消解:');
  prog.dump('');

  // 运行程序
  console.log('\n运行当前的程序:');
  let retVal = new Intepretor().visitProg(prog);
  console.log('程序返回值：' + retVal);
}

// 处理命令行参数，从文件里读取源代码
import * as process from 'process';

// 要求命令行的第三个参数，一定是一个文件名。
if (process.argv.length < 3) {
  console.log('Usage: node ' + process.argv[1] + ' FILENAME');
  process.exit(1);
}

// 读取源代码
// @ts-ignore
let fs = require('fs');
let filename = process.argv[2];

fs.readFile(filename, 'utf8', function (err: any, data: string) {
  if (err) throw err;
  compileAndRun(data);
});
