
#ifndef PLAYSCRIPT_SYMBOL
#define PLAYSCRIPT_SYMBOL

#include "playvm.h"
#include "types.h"

typedef enum _SymKind{VariableSym, FunctionSym, ClassSym, InterfaceSym, ParameterSym, ProgSym} SymKind;

typedef struct _Symbol{
    char* name;     //符号名称
    Type* theType;  //类型
    SymKind kind;   //符号种类
} Symbol;

typedef struct _VarSymbol{
    Symbol symbol;
} VarSymbol;

typedef struct _FunctionSymbol{
    Symbol symbol;        //基类数据
    int numVars;          //本地变量数量
    VarSymbol ** vars;    //本地变量信息
    int opStackSize;      //操作数栈大小
    int numByteCodes;     //字节码数量
    unsigned char* byteCode; //字节码指令
   
    #ifdef USE_ARENA
    size_t frameSize;     //栈桢的大小
    #endif
} FunctionSymbol;

#endif