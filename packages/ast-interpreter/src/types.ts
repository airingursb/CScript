/**
 * 类型体系
 */

export abstract class Type {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * 当前类型是否小于等于type2
   * @param type2
   */
  abstract LE(type2: Type): boolean;

  /**
   * visitor模式
   * 可以用于生成字节码等。
   */
  abstract accept(visitor: TypeVisitor): any;

  /**
   * 类型中是否包含void。
   */
  abstract hasVoid(): boolean;

  abstract toString(): string;

  /**
   * type1与type2的上界
   * @param type1
   * @param type2
   */
  static getUpperBound(type1: Type, type2: Type): Type {
    if (type1 == SysTypes.Any || type2 == SysTypes.Any) {
      return SysTypes.Any;
    } else {
      if (type1.LE(type2)) {
        return type2;
      } else if (type2.LE(type1)) {
        return type1;
      } else {
        return new UnionType([type1, type2]);
      }
    }
  }

  static isSimpleType(t: Type) {
    return typeof (t as SimpleType).upperTypes == 'object';
  }

  static isUnionType(t: Type) {
    return typeof (t as UnionType).types == 'object';
  }

  static isFunctionType(t: Type) {
    return typeof (t as FunctionType).returnType == 'object';
  }
}

/**
 * 简单的类型，可以有一到多个父类型
 */
//todo: 需要检查循环引用
export class SimpleType extends Type {
  upperTypes: Type[];

  constructor(name: string, upperTypes: SimpleType[] = []) {
    super(name);
    this.upperTypes = upperTypes;
  }

  hasVoid(): boolean {
    if (this === SysTypes.Void) {
      return true;
    } else {
      for (let t of this.upperTypes) {
        if (t.hasVoid()) {
          return true;
        }
      }
      return false;
    }
  }

  toString(): string {
    let upperTypeNames: string = '[';
    for (let ut of this.upperTypes) {
      upperTypeNames += ut.name + ', ';
    }
    upperTypeNames += ']';
    return 'SimpleType {name: ' + this.name + ', upperTypes: ' + upperTypeNames + '}';
  }

  /**
   * 当前类型是否小于等于type2
   * @param type2
   */
  LE(type2: Type): boolean {
    if (type2 == SysTypes.Any) {
      return true;
    } else if (this == SysTypes.Any) {
      return false;
    } else if (this === type2) {
      return true;
    } else if (Type.isSimpleType(type2)) {
      let t = type2 as SimpleType;
      if (this.upperTypes.indexOf(t) != -1) {
        return true;
      } else {
        //看看所有的父类型中，有没有一个是type2的子类型
        for (let upperType of this.upperTypes) {
          if (upperType.LE(type2)) {
            return true;
          }
        }
        return false;
      }
    } else if (Type.isUnionType(type2)) {
      let t = type2 as UnionType;
      if (t.types.indexOf(this) != -1) {
        return true;
      } else {
        //是联合类型中其中一个类型的子类型就行
        for (let t2 of t.types) {
          if (this.LE(t2)) {
            return true;
          }
        }
        return false;
      }
    } else {
      return false;
    }
  }

  /**
   * visitor模式
   */
  accept(visitor: TypeVisitor): any {
    return visitor.visitSimpleType(this);
  }
}

//todo: 需要检查循环引用
export class FunctionType extends Type {
  returnType: Type;
  paramTypes: Type[];
  static index: number = 0; //序号，用于给函数类型命名
  constructor(returnType: Type = SysTypes.Void, paramTypes: Type[] = [], name: string | undefined = undefined) {
    super('@function'); //用一个非法字符@，避免与已有的符号名称冲突
    this.returnType = returnType;
    this.paramTypes = paramTypes;
    if (typeof name == 'string') {
      this.name = name;
    } else {
      this.name = '@function' + FunctionType.index++;
    }
  }

  hasVoid(): boolean {
    return this.returnType.hasVoid();
  }

  toString(): string {
    let paramTypeNames: string = '[';
    for (let ut of this.paramTypes) {
      paramTypeNames += ut.name + ', ';
    }
    paramTypeNames += ']';
    return (
      'FunctionType {name: ' +
      this.name +
      ', returnType: ' +
      this.returnType.name +
      ', paramTypes: ' +
      paramTypeNames +
      '}'
    );
  }

  /**
   * 当前类型是否小于等于type2
   * @param type2
   */
  LE(type2: Type): boolean {
    if (type2 == SysTypes.Any) {
      return true;
    } else if (this == type2) {
      return true;
    } else if (Type.isUnionType(type2)) {
      let t = type2 as UnionType;
      if (t.types.indexOf(this) != -1) {
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  /**
   * visitor模式
   */
  accept(visitor: TypeVisitor): any {
    return visitor.visitFunctionType(this);
  }
}

//todo: 需要检查循环引用
export class UnionType extends Type {
  types: Type[];

  static index: number = 0; //序号，用于给UnionType命名

  /**
   * TODO：该构造方法有个问题，如果types中的类型是互相有子类型关系，应该合并。
   * @param types
   */
  constructor(types: Type[], name: string | undefined = undefined) {
    super('@union');
    this.types = types;

    if (typeof name == 'string') {
      this.name = name;
    } else {
      this.name = '@union' + UnionType.index++;
    }
  }

  hasVoid(): boolean {
    for (let t of this.types) {
      if (t.hasVoid()) {
        return true;
      }
    }
    return false;
  }

  toString(): string {
    let typeNames: string = '[';
    for (let ut of this.types) {
      typeNames += ut.name + ', ';
    }
    typeNames += ']';
    return 'UnionType {name: ' + this.name + ', types: ' + typeNames + '}';
  }

  /**
   * 当前类型是否小于等于type2
   * @param type2
   */
  LE(type2: Type): boolean {
    if (type2 == SysTypes.Any) {
      return true;
    } else if (Type.isUnionType(type2)) {
      for (let t1 of this.types) {
        let found = false;
        for (let t2 of (type2 as UnionType).types) {
          if (t1.LE(t2)) {
            found = true;
            break;
          }
        }
        if (!found) {
          return false;
        }
      }
      return true;
    } else {
      return false;
    }
  }

  /**
   * visitor模式
   */
  accept(visitor: TypeVisitor): any {
    visitor.visitUnionType(this);
  }
}

/**
 * 内置类型
 */
export class SysTypes {
  // 所有类型的父类型
  static Any = new SimpleType('any', []);

  // 基础类型
  static String = new SimpleType('string', [SysTypes.Any]);
  static Number = new SimpleType('number', [SysTypes.Any]);
  static Boolean = new SimpleType('boolean', [SysTypes.Any]);

  // 所有类型的子类型
  static Null = new SimpleType('null');
  static Undefined = new SimpleType('undefined');

  // 函数没有任何返回值的情况
  // 如果作为变量的类型，则智能赋值为null和undefined
  static Void = new SimpleType('void');

  // 两个 Number 的子类型
  static Integer = new SimpleType('integer', [SysTypes.Number]);
  static Decimal = new SimpleType('decimal', [SysTypes.Number]);

  static isSysType(t: Type) {
    return (
      t === SysTypes.Any ||
      t === SysTypes.String ||
      t === SysTypes.Number ||
      t === SysTypes.Boolean ||
      t === SysTypes.Null ||
      t === SysTypes.Undefined ||
      t === SysTypes.Void ||
      t === SysTypes.Integer ||
      t === SysTypes.Decimal
    );
  }
}

/**
 * visitor
 */
export abstract class TypeVisitor {
  visit(t: Type): any {
    return t.accept(this);
  }

  abstract visitSimpleType(t: SimpleType): any;

  abstract visitFunctionType(t: FunctionType): any;

  abstract visitUnionType(t: UnionType): any;
}
