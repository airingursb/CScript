#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h> 

#include "types.h"
#include "symbol.h"
#include "vm.h"

#include "../rt/string.h"
#include "../rt/number.h"

///////////////////////////////////////////////////////////////
//栈机
int execute(BCModule* bcModule){
    //找到入口函数
    if (bcModule->_main == NULL){
        printf("Can not find main function.");
        return -1;
    }
    
    //当前在执行的函数
    FunctionSymbol* functionSym = bcModule->_main;

    //创建栈桢
    StackFrame* frame = createStackFrame(functionSym);

    //当前运行的代码
    unsigned char* code = NULL;
    if (functionSym->byteCode != NULL){
        code = functionSym->byteCode;
    }
    else{
        printf("Can not find code for 'main'.");
        return -1;
    }

    //当前代码的位置
    int codeIndex = 0;

    //一直执行代码，直到遇到return语句
    unsigned char opCode = code[codeIndex];

    //临时变量
    unsigned char byte1 = 0;
    unsigned char byte2 = 0;
    VM_NUMBER vleft = 0;
    VM_NUMBER vright = 0;
    int tempCodeIndex = 0;

    int varIndex;
    int offset;
    int constIndex;
    // int retValue;
    long retValue;

    StackFrame* lastFrame;

    while(1){
        switch (opCode){
            case iconst_0:
                pushToOpStack(frame,0);
                opCode = code[++codeIndex];
                continue;
            case iconst_1:
                pushToOpStack(frame,1);
                opCode = code[++codeIndex];
                continue;
            case iconst_2:
                pushToOpStack(frame,2);
                opCode = code[++codeIndex];
                continue;
            case iconst_3:
                pushToOpStack(frame,3);
                opCode = code[++codeIndex];
                continue;
            case iconst_4:
                pushToOpStack(frame,4);
                opCode = code[++codeIndex];
                continue;
            case iconst_5:
                pushToOpStack(frame,5);
                opCode = code[++codeIndex];
                continue;
            case bipush:  //取出1个字节
                pushToOpStack(frame,code[++codeIndex]); 
                opCode = code[++codeIndex];
                continue;
            case sipush:  //取出2个字节
                byte1 = code[++codeIndex];
                byte2 = code[++codeIndex];
                pushToOpStack(frame,byte1<<8|byte2); 
                opCode = code[++codeIndex];
                continue;
            case ldc:   //从常量池加载
                constIndex = code[++codeIndex];   
                NumberConst * numberConst = (NumberConst *)bcModule->consts[constIndex];
                pushToOpStack(frame,numberConst->value); 
                opCode = code[++codeIndex];
                continue;
            // case sldc:   //从常量池加载字符串
            //     constIndex = code[++codeIndex];   
            //     StringConst * stringConst = (StringConst *)bcModule->consts[constIndex];
            //     pushToOpStack(frame,(VM_NUMBER)string_create_by_str(stringConst->value)); 
            //     opCode = code[++codeIndex];
            //     continue;
            case iload:
                pushToOpStack(frame,frame->localVars[code[++codeIndex]]);
                opCode = code[++codeIndex];
                continue;
            case iload_0:
                pushToOpStack(frame,frame->localVars[0]);
                opCode = code[++codeIndex];
                continue;
            case iload_1:
                pushToOpStack(frame,frame->localVars[1]);
                opCode = code[++codeIndex];
                continue;
            case iload_2:
                pushToOpStack(frame,frame->localVars[2]);
                opCode = code[++codeIndex];
                continue;
            case iload_3:
                pushToOpStack(frame,frame->localVars[3]);
                opCode = code[++codeIndex];
                continue;
            case istore:
                frame->localVars[code[++codeIndex]] = popFromOpStack(frame);
                opCode = code[++codeIndex];
                continue;
            case istore_0:
                frame->localVars[0] = popFromOpStack(frame);
                opCode = code[++codeIndex];
                continue;
            case istore_1:
                frame->localVars[1] = popFromOpStack(frame);
                opCode = code[++codeIndex];
                continue;
            case istore_2:
                frame->localVars[2] = popFromOpStack(frame);
                opCode = code[++codeIndex];
                continue;
            case istore_3:
                frame->localVars[3] = popFromOpStack(frame);
                opCode = code[++codeIndex];
                continue;
            case iadd:
                pushToOpStack(frame,popFromOpStack(frame) + popFromOpStack(frame));
                opCode = code[++codeIndex];
                continue;
            // case sadd:
            //     vright = popFromOpStack(frame);
            //     vleft = popFromOpStack(frame);
            //     PlayString * str = string_concat((PlayString *) vleft, (PlayString *) vright);
            //     pushToOpStack(frame,(VM_NUMBER)str);
            //     opCode = code[++codeIndex];
            //     continue;
            case isub:
                vright = popFromOpStack(frame);
                vleft = popFromOpStack(frame);
                pushToOpStack(frame,vleft - vright);
                opCode = code[++codeIndex];
                continue;
            case imul:
                pushToOpStack(frame,popFromOpStack(frame) * popFromOpStack(frame));
                opCode = code[++codeIndex];
                continue;
            case idiv:
                vright = popFromOpStack(frame);
                vleft = popFromOpStack(frame);
                pushToOpStack(frame,vleft / vright);
                opCode = code[++codeIndex];
                continue;
            case iinc:
                varIndex = code[++codeIndex];
                offset = code[++codeIndex]; 
                frame->localVars[varIndex] = frame->localVars[varIndex]+offset;
                opCode = code[++codeIndex];
                continue;
            case ireturn:
            case _return:
                //确定返回值
                if(opCode == ireturn){
                    retValue = popFromOpStack(frame);
                }

                //弹出栈桢，返回到上一级函数，继续执行
                lastFrame = frame;
                frame = frame->prev;
                deleteStackFrame(lastFrame);

                if (frame == NULL){ //主程序返回，结束运行
                    return 0;
                }
                else{ //返回到上一级调用者
                    //设置返回值到上一级栈桢
                    if(opCode == ireturn){
                        pushToOpStack(frame,retValue);
                    }    
                    //设置新的code、codeIndex和oPCode
                    if (frame->byteCode !=NULL){
                        //切换到调用者的代码
                        code = frame->byteCode;
                        //设置指令指针为返回地址，也就是调用该函数的下一条指令
                        codeIndex = frame->returnIndex;
                        opCode = code[codeIndex];
                        continue;
                    }
                    else{
                        printf("Can not find code for function '%s'.", ((Symbol*)functionSym)->name);
                        return -1;
                    }
                }
                continue;
            case invokestatic:
                //从常量池找到被调用的函数
                byte1 = code[++codeIndex];
                byte2 = code[++codeIndex];
                FunctionConst* functionConst = (FunctionConst*)bcModule->consts[byte1<<8|byte2];
                functionSym = functionConst->functionSym;

                //对于内置函数特殊处理
                if(strcmp(((Symbol*)functionSym)->name,"println")==0){
                    //取出一个参数
                    VM_NUMBER param = popFromOpStack(frame);
                    opCode = code[++codeIndex];
                    // printf("%s\n", ((PlayString*)param)->data);
                    printf("%d\n", param);   //打印显示
                }
                else if(strcmp(((Symbol*)functionSym)->name,"tick")==0){
                    opCode = code[++codeIndex];
                    VM_NUMBER tick = clock();
                    // printf("tick: %d\n",tick);
                    pushToOpStack(frame,tick);
                }
                // else if(strcmp(((Symbol*)functionSym)->name,"integer_to_string")==0){
                //     opCode = code[++codeIndex];
                //     VM_NUMBER numValue = popFromOpStack(frame);
                //     PlayString * pstr = integer_to_string((int)numValue);
                //     pushToOpStack(frame,(VM_NUMBER)pstr);
                // }
                else{
                    //设置返回值地址，为函数调用的下一条指令
                    frame->returnIndex = codeIndex + 1;

                    //创建新的栈桢
                    lastFrame = frame;
                    frame = createStackFrame(functionSym);
                    frame->prev = lastFrame;

                    //传递参数
                    int paramCount = ((FunctionType*)((Symbol*)functionSym)->theType)->numParams;
                    for(int i = paramCount -1; i>= 0; i--){
                        frame->localVars[i] = popFromOpStack(lastFrame);
                    }

                    //设置新的code、codeIndex和oPCode
                    if (frame->byteCode !=NULL){
                        //切换到被调用函数的代码
                        code = frame->byteCode;
                        //代码指针归零
                        codeIndex = 0;
                        opCode = code[codeIndex];
                        continue;
                    }
                    else{
                        printf("Can not find code for function '%s'.", ((Symbol*)functionSym)->name);
                        return -1;
                    }
                }
                continue;
            case ifeq:
                byte1 = code[++codeIndex];
                byte2 = code[++codeIndex];
                if(popFromOpStack(frame) == 0){
                    codeIndex = byte1<<8|byte2;
                    opCode = code[codeIndex];
                }
                else{
                    opCode = code[++codeIndex];
                }
                continue; 
            case ifne:
                byte1 = code[++codeIndex];
                byte2 = code[++codeIndex];
                if(popFromOpStack(frame) != 0){
                    codeIndex = byte1<<8|byte2;
                    opCode = code[codeIndex];
                }
                else{
                    opCode = code[++codeIndex];
                }
                continue; 
            case if_icmplt:
                byte1 = code[++codeIndex];
                byte2 = code[++codeIndex];
                vright = popFromOpStack(frame);
                vleft = popFromOpStack(frame);
                if(vleft < vright){
                    codeIndex = byte1<<8|byte2;
                    opCode = code[codeIndex];
                }
                else{
                    opCode = code[++codeIndex];
                }
                continue; 
            case if_icmpge:
                byte1 = code[++codeIndex];
                byte2 = code[++codeIndex];
                vright = popFromOpStack(frame);
                vleft = popFromOpStack(frame);
                if(vleft >= vright){
                    codeIndex = byte1<<8|byte2;
                    opCode = code[codeIndex];
                }
                else{
                    opCode = code[++codeIndex];
                }
                continue; 
            case if_icmpgt:
                byte1 = code[++codeIndex];
                byte2 = code[++codeIndex];
                vright = popFromOpStack(frame);
                vleft = popFromOpStack(frame);
                if(vleft > vright){
                    codeIndex = byte1<<8|byte2;
                    opCode = code[codeIndex];
                }
                else{
                    opCode = code[++codeIndex];
                }
                continue; 
            case if_icmple:
                byte1 = code[++codeIndex];
                byte2 = code[++codeIndex];
                vright = popFromOpStack(frame);
                vleft = popFromOpStack(frame);
                if(vleft <= vright){
                    codeIndex = byte1<<8|byte2;
                    opCode = code[codeIndex];
                }
                else{
                    opCode = code[++codeIndex];
                }
                continue; 
            case _goto:
                byte1 = code[++codeIndex];
                byte2 = code[++codeIndex];
                codeIndex = byte1<<8|byte2;
                opCode = code[codeIndex];
                continue;    

            default:
                printf("Unknown op code: %x.", opCode);
                return -2;
        }
    }

}


OprandStack* createOprandStack(int maxOpStackSize){
    OprandStack* stack = (OprandStack*)malloc(sizeof(OprandStack));
    stack->top = -1;  //空栈时为-1
    stack->data = (VM_NUMBER *)malloc(maxOpStackSize*sizeof(VM_NUMBER));
    return stack;
}

void deleteOprandStack(OprandStack* stack){
    free(stack->data);
    free(stack);
}

void* allocFromArena(size_t size);
void returnToArena();

StackFrame * createStackFrame(FunctionSymbol* functionSym){
    StackFrame * frame;
#ifdef USE_ARENA
    //一次性获得一个栈桢所需的整块内存，并调整相关数据结构中的指针
    frame = (StackFrame*)allocFromArena(functionSym->frameSize);
    frame->localVars = (VM_NUMBER*)(frame + sizeof(StackFrame));
    frame->oprandStack = (OprandStack*)(frame->localVars + functionSym->numVars*sizeof(VM_NUMBER));
    frame->oprandStack->data = (VM_NUMBER*)(frame->oprandStack + sizeof(OprandStack));
    
#else
    //常规的内存分配方式，会分成4小块内存，做4次malloc调用
    frame = (StackFrame *)malloc(sizeof(StackFrame));
    if (functionSym->numVars == 0){
        frame->localVars=NULL;
    }
    else{
        frame->localVars = (VM_NUMBER*)malloc((functionSym->numVars)*sizeof(VM_NUMBER));
    }
    frame->oprandStack = createOprandStack(functionSym->opStackSize);
       
#endif

    frame->byteCode = functionSym->byteCode;
    frame->returnIndex = 0;
    frame->prev = NULL;
    return frame;
}

void deleteStackFrame(StackFrame* frame){
#ifdef USE_ARENA
    returnToArena();
#else
    if (frame->localVars)
        free(frame->localVars);
    deleteOprandStack(frame->oprandStack);
    free(frame);
#endif    
}

void pushToOpStack(StackFrame* frame, VM_NUMBER value){
    frame->oprandStack->data[++(frame->oprandStack->top)] = value;
    // if (frame->oprandStack->top < frame->functionSym->opStackSize){
    //     frame->oprandStack->data[++(frame->oprandStack->top)] = value;
    // }
    // else{
    //     printf("Error in pushToOpStack, not enough opstack space.\n");
    // }
}

VM_NUMBER popFromOpStack(StackFrame* frame){
    return frame->oprandStack->data[(frame->oprandStack->top)--];
    // if (frame->oprandStack->top >=0){
    //     return frame->oprandStack->data[(frame->oprandStack->top)--];
    // }
    // else{
    //     printf("Error in popFromOpStack, nothing to pop.\n");
    //     return 0;
    // }
}

///////////////////////////////////////////////////////////////////////
//类型处理

void dumpSimpleType(Type * t){
    SimpleType* simpleType = (SimpleType*)t;
    printf("SimpleType: %s, %d upperTypes:[", t->name, simpleType->numUpperTypes);
    if (simpleType->upperTypes != NULL){
        for (int i = 0; i < simpleType->numUpperTypes; i++){
            printf("%s, ", simpleType->upperTypes[i]->name);
        }
    }
    printf("]\n");
}

SimpleType * createSimpleType(char* typeName, int numUpperTypes, Type** upperTypes){
    SimpleType* simpleType = (SimpleType*)malloc(sizeof(SimpleType));
    simpleType->numUpperTypes = numUpperTypes;
    simpleType->upperTypes=upperTypes;

    Type* t = (Type*)simpleType;
    t->name = typeName;
    t->kind = SimpleT;
    t->dump = dumpSimpleType;
    return simpleType;
}

void deleteSimpleType(SimpleType* simpleType){
    if(!simpleType->upperTypes){
        free(simpleType->upperTypes);
    }
    free(simpleType);
}

void dumpFunctionType(Type * t){
    FunctionType* functionType = (FunctionType*)t;
    printf("FunctionType: %s, returnType: %s, %d paramTypes:[", t->name, functionType->returnType->name, functionType->numParams);
    if (functionType->paramTypes != NULL){
        for (int i = 0; i < functionType->numParams; i++){
            printf("%s, ", functionType->paramTypes[i]->name);
        }
    }
    printf("]\n");
}

FunctionType * createFunctionType(char* typeName, Type* returnType, int numParams, Type** paramTypes){
    FunctionType* functionType = (FunctionType*)malloc(sizeof(FunctionType));
    functionType->numParams = numParams;
    functionType->paramTypes= paramTypes;
    
    Type* t = (Type*)functionType;
    t->name = typeName;
    t->kind = FunctionT;
    t->dump = dumpFunctionType;
    return functionType;
}

void deleteFunctionType(FunctionType* functionType){
    if(!functionType->paramTypes){
        free(functionType->paramTypes);
    }
    free(functionType);
}

void dumpUnionType(Type * t){
    UnionType* unionType = (UnionType*)t;
    printf("UnionType: %s, %d types:[", t->name, unionType->numTypes);
    if (unionType->types != NULL){
        for (int i = 0; i < unionType->numTypes; i++){
            printf("%s, ", unionType->types[i]->name);
        }
    }
    printf("]\n");
}

UnionType * createUnionType(char* typeName, int numTypes, Type** types){
    UnionType* unionType = (UnionType*)malloc(sizeof(UnionType));
    unionType->numTypes = numTypes;
    unionType->types=types;

    Type* t = (Type*)unionType;
    t->name = typeName;
    t->kind = SimpleT;
    t->dump = dumpUnionType;
    return unionType;
}

void deleteUnionType(UnionType* unionType){
    if(!unionType->types){
        free(unionType->types);
    }
    free(unionType);
}

void initSysTypes(SysTypes* pst){
    pst->Any = createSimpleType("any", 0,NULL);

    Type** upperTypes = (Type**)malloc(sizeof(SimpleType*));
    upperTypes[0] = (Type*)pst->Any;
    pst->String = createSimpleType("string", 1, upperTypes);

    upperTypes = (Type**)malloc(sizeof(SimpleType*));
    upperTypes[0] = (Type*)pst->Any;
    pst->Number = createSimpleType("number", 1, upperTypes);

    upperTypes = (Type**)malloc(sizeof(SimpleType));
    upperTypes[0] = (Type*)pst->Any;
    pst->Boolean = createSimpleType("boolean", 1, upperTypes);

    pst->Null = createSimpleType("null", 0, NULL);
    pst->Undefined = createSimpleType("undefined", 0, NULL);
    pst->Void = createSimpleType("void", 0, NULL);

    upperTypes = (Type**)malloc(sizeof(SimpleType*));
    upperTypes[0] = (Type*)pst->Number;
    pst->Integer = createSimpleType("integer", 1, upperTypes);

    upperTypes = (Type**)malloc(sizeof(SimpleType*));
    upperTypes[0] = (Type*)pst->Number;
    pst->Decimal = createSimpleType("decimal", 1, upperTypes);
}

//全局静态变量
static SysTypes sysTypes;

///////////////////////////////////////////////////////////////////
//Symbol

VarSymbol* createVarSymbol(char* varName, Type* varType){
    VarSymbol * varSymbol = (VarSymbol*)malloc(sizeof(VarSymbol));
    ((Symbol*)varSymbol)->name = varName;
    ((Symbol*)varSymbol)->kind = VariableSym;
    ((Symbol*)varSymbol)->theType = varType;
    return varSymbol;
}

void deleteVarSymbol(VarSymbol* varSymbol){
    free(varSymbol);
}

void dumpVarSymbol(VarSymbol* varSymbol){
    Symbol* sym = (Symbol*)varSymbol;
    printf("VarSymbol: %s, type: %s\n", sym->name, sym->theType->name);
}

FunctionSymbol* createFunctionSymbol(char* functionName, FunctionType* functionType,
                 int numVars, VarSymbol** vars, int opStackSize, 
                 int numByteCodes, unsigned char* byteCode){
    FunctionSymbol* functionSym = (FunctionSymbol*)malloc(sizeof(FunctionSymbol));
    Symbol* sym = (Symbol*)functionSym;
    sym->name = functionName;
    sym->theType = (Type*)functionType;
    sym->kind = FunctionSym;
    functionSym->numVars = numVars;
    functionSym->vars = vars;
    functionSym->opStackSize = opStackSize;
    functionSym->numByteCodes = numByteCodes;
    functionSym->byteCode = byteCode;

    #ifdef USE_ARENA
    functionSym->frameSize = sizeof(StackFrame) + sizeof(VM_NUMBER)* functionSym->numVars + sizeof(OprandStack) + sizeof(VM_NUMBER)* functionSym->opStackSize;
    #endif

    return functionSym;
}

void deleteFunctionSymbol(FunctionSymbol* functionSym){
    free(functionSym->vars);
    free(functionSym->byteCode);
    free(functionSym);
}

void dumpFunctionSymbol(FunctionSymbol* functionSym){
    Symbol* sym = (Symbol*)functionSym;
    printf("FunctionSymbol: %s, type: %s, numVars: %d, opStackSize: %d.\n", 
        sym->name, sym->theType->name, functionSym->numVars, functionSym->opStackSize);
    if (functionSym->vars != NULL){
        printf("  Local Vars:\n  ");
        for (int i = 0; i < functionSym->numVars; i++){
            printf("  ");
            dumpVarSymbol(functionSym->vars[i]);
        }
    }
    if (functionSym->byteCode !=NULL){
        printf("  Byte Code:\n  ");
        for (int i = 0; i < functionSym->numByteCodes; i++){
            printf("%x ", functionSym->byteCode[i]);
        }
        printf("\n");
    }
}

/////////////////////////////////////////////////////////////////
//BCModule

NumberConst* createNumberConst(int value){
    NumberConst* numberConst = (NumberConst*)malloc(sizeof(NumberConst));
    ((Const*)numberConst)->kind = NumberC;
    numberConst->value = value;
    return numberConst;
}

void deleteNumberConst(NumberConst* numberConst){
    if (numberConst != NULL)
        free(numberConst);
}

StringConst* createStringConst(char* value){
    StringConst* stringConst = (StringConst*)malloc(sizeof(StringConst));
    ((Const*)stringConst)->kind = StringC;
    stringConst->value = value;
    return stringConst;
}

void deleteStringConst(StringConst* stringConst){
    if (stringConst != NULL){
        if (stringConst->value != NULL)
            free(stringConst->value);
        
        free(stringConst);
    }
}

FunctionConst* createFunctionConst(FunctionSymbol * functionSym){
    FunctionConst* functionConst = (FunctionConst*)malloc(sizeof(FunctionConst));
    ((Const*)functionConst)->kind = FunctionC;
    functionConst->functionSym = functionSym;
    return functionConst;
}

void deleteFunctionConst(FunctionConst* functionConst){
    if (functionConst != NULL){
        if (functionConst->functionSym!=NULL)
            deleteFunctionSymbol(functionConst->functionSym);

        free(functionConst);
    }
}

BCModule * createBCModule(int numConsts, Const ** consts, FunctionSymbol * _main, int numTypes, Type** types){
    BCModule* bcModule = (BCModule*)malloc(sizeof(BCModule));
    bcModule->numConsts = numConsts;
    bcModule->consts = consts;
    bcModule->_main = _main;
    bcModule->numTypes = numTypes;
    bcModule->types = types;
    return bcModule;
}

void deleteBCModule(BCModule * bcModule){
    if (bcModule != NULL){
        if (bcModule->consts != NULL){
            for (int i = 0; i < bcModule->numConsts; i++){
                if (bcModule->consts[i]!=NULL){
                    free(bcModule->consts[i]);
                }
            }
            free(bcModule->consts);
        }
        if (bcModule->types != NULL){
            for (int i = 0; i< bcModule->numTypes; i++){
                if(bcModule->types[i]!=NULL){
                    free(bcModule->types[i]);
                }
            }
            free(bcModule->types); 
        }
        free(bcModule);
    }
}

void dumpBCModule(BCModule * bcModule){
    printf("类型信息：\n");
    for (int i = 0; i< bcModule->numTypes; i++){
        printf("%d. ",i+1);
        Type * t = bcModule->types[i];
        t->dump(t);
    }

    printf("常量信息：\n");
    for (int i = 0; i< bcModule->numConsts; i++){
        if (bcModule->consts[i]->kind == NumberC){
            NumberConst * numberConst = (NumberConst *)bcModule->consts[i];
            printf("%d. Number: %d\n", i+1, numberConst->value);
        }
        else if (bcModule->consts[i]->kind == StringC){
            StringConst * stringConst = (StringConst *)bcModule->consts[i];
            printf("%d. String: %s\n", i+1, stringConst->value);
        }
        else if (bcModule->consts[i]->kind == FunctionC){
            FunctionConst * functionConst = (FunctionConst *)bcModule->consts[i];
            printf("%d. Function:\n",i+1);
            dumpFunctionSymbol(functionConst->functionSym);
        }
        else{
            printf("Unsupported const kind: %d.\n", bcModule->consts[i]->kind);
        }
    }
}

////////////////////////////////////////////////////////////////////////
//读取字节码

//从字节码中读取一个字符串
char* readString(unsigned char* bc, int* index){
    int len = bc[(*index)++];
    char* str = (char*)malloc((len+1)*sizeof(char));
    for (int i = 0; i< len; i++){
        str[i] = bc[(*index)++];
    }
    str[len]=0;
    // printf("readString: %s\n",str);
    return str;
}

//存放临时的类型信息的结构，此时类型间的引用关系尚未建立
typedef struct _SimpleTypeInfo{
    int numUpperTypes;
    char** upperTypes;
}SimpleTypeInfo;

SimpleTypeInfo * createSimpleTypeInfo(int numUpperTypes, char** upperTypes){
    SimpleTypeInfo * typeInfo = (SimpleTypeInfo *)malloc(sizeof(SimpleTypeInfo));
    typeInfo->upperTypes = upperTypes;
    typeInfo->numUpperTypes = numUpperTypes;
    return typeInfo;
}

void deleteSimpleTypeInfo(SimpleTypeInfo * typeInfo){
    free(typeInfo->upperTypes);
    free(typeInfo);
}

typedef struct _FunctionTypeInfo{
    char* returnType;
    int numParams;
    char** paramTypes;
}FunctionTypeInfo;

FunctionTypeInfo * createFuntionTypeInfo(char* returnType, int numParams, char** paramTypes){
    FunctionTypeInfo * typeInfo = (FunctionTypeInfo *)malloc(sizeof(FunctionTypeInfo));
    typeInfo->returnType = returnType;
    typeInfo->numParams = numParams;
    typeInfo->paramTypes = paramTypes;
    return typeInfo;
}

void deleteFunctionTypeInfo(FunctionTypeInfo * typeInfo){
    free(typeInfo->paramTypes);
    free(typeInfo);
}

typedef struct _UnionTypeInfo{
    int numTypes;
    char** types;
}UnionTypeInfo;

UnionTypeInfo* createUnionTypeInfo(int numTypes, char** unionTypes){
    UnionTypeInfo * typeInfo = (UnionTypeInfo *)malloc(sizeof(UnionTypeInfo));
    typeInfo->types = unionTypes;
    typeInfo->numTypes = numTypes;
    return typeInfo;
}

void deleteUnionTypeInfo(UnionTypeInfo * typeInfo){
    free(typeInfo->types);
    free(typeInfo);
}

//从字节码中读取一个SimpleType
void readSimpleType(unsigned char* bc, int* index, int typeIndex, char** typeNames, Type** types, void** typeInfos){
    char* typeName = readString(bc, index);
    int numUpperTypes = bc[(*index)++];
    char** upperTypes = (char**)malloc(numUpperTypes*sizeof(char*));
    for (int i = 0; i < numUpperTypes; i++){
        upperTypes[i] = readString(bc, index);
    }

    SimpleType* simpleType = createSimpleType(typeName, numUpperTypes, NULL);
    typeNames[typeIndex] = typeName;
    types[typeIndex] = (Type*)simpleType;

    SimpleTypeInfo * typeInfo = createSimpleTypeInfo(numUpperTypes, upperTypes);
    typeInfos[typeIndex-SYS_TYPES] = typeInfo;
}


//从字节码中读取一个FunctionType
void readFunctionType(unsigned char* bc, int* index, int typeIndex, char** typeNames, Type** types, void** typeInfos){
    char* typeName = readString(bc, index);
    char* returnType = readString(bc, index);
    int numParams = bc[(*index)++];
    char** paramTypes = (char**)malloc(numParams*sizeof(char*));
    for (int i = 0; i < numParams; i++){
        paramTypes[i] = readString(bc, index);
    }

    FunctionType* functionType = createFunctionType(typeName, NULL, numParams, NULL);   
    typeNames[typeIndex] = typeName;
    types[typeIndex] = (Type*)functionType;

    FunctionTypeInfo * typeInfo = createFuntionTypeInfo(returnType, numParams, paramTypes);
    typeInfos[typeIndex-SYS_TYPES] = typeInfo;
}

//从字节码中读取一个UnionType
void readUnionType(unsigned char* bc, int* index, int typeIndex, char** typeNames, Type** types, void** typeInfos){
    char* typeName = readString(bc, index);
    int numTypes = bc[(*index)++];
    char** unionTypes = (char**)malloc(numTypes*sizeof(char*));
    for (int i = 0; i < numTypes; i++){
        unionTypes[i] = readString(bc, index);
    }

    UnionType* unionType = createUnionType(typeName, numTypes, NULL);
    typeNames[typeIndex] = typeName;
    types[typeIndex] = (Type*)unionType;

    UnionTypeInfo * typeInfo = createUnionTypeInfo(numTypes, unionTypes);
    typeInfos[typeIndex-SYS_TYPES] = typeInfo;
}

//查找名称为typeName的Type
Type* getType(char* typeName, int numTypes, char** typeNames, Type** types){
    for (int i = 0; i< numTypes; i++){
        if (strcmp(typeName, typeNames[i]) == 0){
            return types[i];
        }
    }
    
    return NULL;
}

/**
 * 生成类型，并建立类型之间正确的引用关系。
 * 完成任务后，释放掉所有的TypeInfo数据所占的内存。
 */
void buildTypes(int numTypes, char** typeNames, Type** types, void** typeInfos){
    for (int i = 0; i< numTypes-SYS_TYPES; i++){
        Type* t = types[i+SYS_TYPES];
        if (t->kind == SimpleT){
            SimpleType* simpleType = (SimpleType*)t;
            SimpleTypeInfo* typeInfo = (SimpleTypeInfo*)typeInfos[i];
            simpleType->upperTypes = (Type**)malloc(typeInfo->numUpperTypes*sizeof(Type*));
            for (int j = 0; j < typeInfo->numUpperTypes; j++){
                simpleType->upperTypes[j] = getType(typeInfo->upperTypes[j], numTypes+SYS_TYPES, typeNames, types);
            }
            deleteSimpleTypeInfo(typeInfo);
        }
        else if (t->kind == FunctionT){
            FunctionType* funtionType = (FunctionType*) t;
            FunctionTypeInfo* typeInfo = (FunctionTypeInfo*)typeInfos[i];
            funtionType->returnType = getType(typeInfo->returnType, numTypes+SYS_TYPES, typeNames, types);
            funtionType->paramTypes = (Type**)malloc(typeInfo->numParams*sizeof(Type*));
            for (int j = 0; j < typeInfo->numParams; j++){
                funtionType->paramTypes[j] = getType(typeInfo->paramTypes[j], numTypes+SYS_TYPES, typeNames, types);
            }
            deleteFunctionTypeInfo(typeInfo);
        }
        else if (t->kind == UnionT){
            UnionType* unionType = (UnionType*)t;
            UnionTypeInfo* typeInfo = (UnionTypeInfo*)typeInfos[i];
            unionType->types = (Type**)malloc(typeInfo->numTypes*sizeof(Type*));
            for (int j = 0; j < typeInfo->numTypes; j++){
                unionType->types[j] = getType(typeInfo->types[j], numTypes+SYS_TYPES, typeNames, types);
            }
            deleteUnionTypeInfo(typeInfo);
        }
        else{
            printf("Unsupported type when building types.");
        }
    }

    //释放内存
    free(typeInfos);
}

//从字节码中读取一个VarSymbol
VarSymbol* readVarSymbol(unsigned char* bc, int* index, int numTypes, char** typeNames, Type** types){
    //变量名称
    char* varName = readString(bc, index);

    //类型名称
    char* typeName = readString(bc, index);
    Type* varType = getType(typeName, numTypes, typeNames, types);

    VarSymbol * varSymbol = createVarSymbol(varName, varType);

    free(typeName); //释放内存
    
    return varSymbol;
}

//从字节码中读取一个FunctionSymbol
FunctionSymbol* readFunctionSymbol(unsigned char* bc, int* index, int numTypes, 
                                   char** typeNames, Type** types){
    //函数名称
    char* functionName = readString(bc, index);

    //读取类型名称
    char* typeName = readString(bc, index);
    FunctionType* functionType = (FunctionType*)getType(typeName, numTypes, typeNames, types);
    
    //操作数栈的大小
    int opStackSize = bc[(*index)++];

    //todo 调试用
    opStackSize = 20;

    //变量个数
    int numVars = bc[(*index)++];

    //读取变量
    VarSymbol** vars = (VarSymbol**)malloc(numVars * sizeof(VarSymbol*));
    for (int i = 0; i < numVars; i++){
        vars[i] = readVarSymbol(bc, index, numTypes, typeNames, types);
    }

    //读取函数体的字节码
    int numByteCodes = bc[(*index)++];
    unsigned char* byteCode;
    if (numByteCodes == 0){  //系统函数
        byteCode = NULL;
    }
    else{
        byteCode = (unsigned char*)malloc(numByteCodes*sizeof(unsigned char));
        memcpy(byteCode,bc + *index,numByteCodes*sizeof(unsigned char));
        (*index) += numByteCodes;
    }

    //创建函数符号
    FunctionSymbol* functionSym = createFunctionSymbol(functionName, functionType,
                 numVars, vars, opStackSize, numByteCodes,  byteCode);

    free(typeName); //注意释放内存

    return functionSym;
}

//添加系统内置类型
void addSystemTypes(char** typeNames, Type** types){
    int index = 0;
    typeNames[index] = "any";
    types[index++] = (Type *)sysTypes.Any;

    typeNames[index] = "number";
    types[index++] = (Type *)sysTypes.Number;

    typeNames[index] = "string";
    types[index++] = (Type *)sysTypes.String;

    typeNames[index] = "boolean";
    types[index++] = (Type *)sysTypes.Boolean;
   
    typeNames[index] = "null";
    types[index++] = (Type *)sysTypes.Null;

    typeNames[index] = "undefined";
    types[index++] = (Type *)sysTypes.Undefined;

    typeNames[index] = "integer";
    types[index++] = (Type *)sysTypes.Integer;

    typeNames[index] = "decimal";
    types[index++] = (Type *)sysTypes.Decimal;

    typeNames[index] = "void";
    types[index++] = (Type *)sysTypes.Void;
}

//添加系统内置函数
void addSystemFunctions(Const** consts){
    //1.println函数
    Type** paramTypes = (Type**)malloc(sizeof(Type*));
    paramTypes[0] = (Type*)sysTypes.Integer;
    FunctionType * functionType =  createFunctionType("@println", (Type*)sysTypes.Void, 1, paramTypes);
    VarSymbol ** vars = (VarSymbol**)malloc(sizeof(VarSymbol*));
    vars[0] = createVarSymbol("a", (Type*)sysTypes.Integer);
    FunctionSymbol* println = createFunctionSymbol("println", functionType, 1, vars, 10, 0, NULL);

    //加入常数区
    FunctionConst* functionConst = createFunctionConst(println);
    consts[0] = (Const*)functionConst;

    //2.tick函数
    functionType =  createFunctionType("@tick", (Type*)sysTypes.Integer, 0, NULL);
    FunctionSymbol* tick = createFunctionSymbol("tick", functionType, 0, NULL, 10, 0, NULL);

    //加入常数区
    functionConst = createFunctionConst(tick);
    consts[1] = (Const*)functionConst;

    //3.integer_to_string函数
    paramTypes = (Type**)malloc(sizeof(Type*));
    paramTypes[0] = (Type*)sysTypes.Integer;
    functionType =  createFunctionType("@integer_to_string", (Type*)sysTypes.String, 1, paramTypes);
    vars = (VarSymbol**)malloc(sizeof(VarSymbol*));
    vars[0] = createVarSymbol("num", (Type*)sysTypes.Integer);
    FunctionSymbol* integer_to_string = createFunctionSymbol("integer_to_string", functionType, 1, vars, 10, 0, NULL);

    //加入常数区
    functionConst = createFunctionConst(integer_to_string);
    consts[2] = (Const*)functionConst;

}

//从字节码中读取一个BCModule
BCModule* readBCModule(unsigned char* bc, size_t size){
    //当前读取的位置
    int bcIndex = 0;
    int *index = &bcIndex;

    //读取类型
    char* str = readString(bc, index); //读取”types“字符串
    // printf("%s\n",strTypes);

    int numTypes = bc[(*index)++];
    char** typeNames = (char**)malloc((numTypes+ SYS_TYPES)*sizeof(char*));
    Type** types = (Type**)malloc((numTypes+ SYS_TYPES)*sizeof(Type*));
    void** typeInfos = (void**)malloc(numTypes*sizeof(void*));

    //添加系统内置类型
    initSysTypes(&sysTypes);
    addSystemTypes(typeNames, types);

    for (int i = 0; i < numTypes; i++){
        int typeKind = bc[(*index)++];
        switch(typeKind){
            case 1:
                readSimpleType(bc, index, i+SYS_TYPES, typeNames, types, typeInfos);
                break;
            case 2:
                readFunctionType(bc, index, i+SYS_TYPES, typeNames, types, typeInfos);
                break;
            case 3:
                readUnionType(bc, index, i+SYS_TYPES, typeNames, types, typeInfos);
                break;
            default:
                printf("Unsupported type kind: %d\n",typeKind);        
        }
    }
    buildTypes(numTypes+SYS_TYPES, typeNames, types, typeInfos);  //创建类型引用关系，并释放TypeInfo占的内存
    
    //2.读取常量
    free(str); //注意释放内存
    str = readString(bc, index);
    int numConsts = bc[(*index)++];   
    Const** consts = (Const**)malloc((numConsts + SYS_FUNS)*sizeof(Const*));
    addSystemFunctions(consts);
    FunctionSymbol* _main;  //入口函数
    for (int i = 0; i< numConsts; i++){
        int constType = bc[(*index)++];
        if (constType == 1){
            NumberConst* numberConst = createNumberConst(bc[(*index)++]);
            consts[i+SYS_FUNS] = (Const*)numberConst;
        }
        else if (constType == 2){
            char * strValue = readString(bc, index);
            StringConst* stringConst = createStringConst(strValue);
            consts[i+SYS_FUNS] = (Const*)stringConst;
        }
        else if (constType == 3){
            FunctionSymbol* functionSym = readFunctionSymbol(bc, index, numTypes+SYS_TYPES, typeNames, types);
            FunctionConst* functionConst = createFunctionConst(functionSym);
            consts[i+SYS_FUNS] = (Const*)functionConst;
            if (strcmp(((Symbol*)functionSym)->name,"main") == 0){
                _main = functionSym;
            }
        }
        else{
            printf("Unsupported const type: %d", constType); 
        }
    }

    free(str);  //释放内存

    return createBCModule(numConsts+SYS_FUNS, consts, _main, numTypes+SYS_TYPES, types);
}

///////////////////////////////////////////////////////////////
//基于Arena的内存管理机制
//模拟了一个内存栈的机制，连续内存管理。
//由于栈桢都是伸缩式的申请内存的，所以该Arena实现得比较简单，不会出现内存碎片。

typedef struct _ArenaBlock{
    size_t size;     //当前这块Arena的大小，从ArenaBlock结构体的底部算起
    size_t offset;   //下一块自由内存的起始地址偏移量，从ArenaBlock结构体的底部算起
}ArenaBlock;

typedef struct _Arena{
    ArenaBlock ** blocks; 
    int numBlocks;
    int pos;  //指向当前所使用的block的下标
}Arena;

static Arena arena; //静态变量，让编译器更容易计算其中的数据字段的地址。

//添加Arena，每次添加一块
void addArenaBlock(int blockSize){
    ArenaBlock ** newBlocks = (ArenaBlock**)malloc((arena.numBlocks+1)*sizeof(ArenaBlock*));
    memcpy(newBlocks, arena.blocks, arena.numBlocks*sizeof(ArenaBlock*));
    free(arena.blocks);

    arena.numBlocks++;
    arena.blocks=newBlocks;

    // printf("arena.numBlocks:%d", arena.numBlocks);

    //申请一整块内存
    ArenaBlock* block = (ArenaBlock*)malloc(sizeof(ArenaBlock) + blockSize*sizeof(unsigned char));
    arena.blocks[arena.numBlocks-1] = block;
    block->offset = 0;
    block->size = blockSize;
}

void initArena(){
    arena.numBlocks = 0;
    addArenaBlock(ARENA_BLOCK_SIZE);
    arena.pos = 0;
}

//从Arena中申请内存
//size:内存块的大小
void* allocFromArena(size_t size){
    void* mem;
    if (arena.blocks[arena.pos]->offset + size + sizeof(size_t)  > arena.blocks[arena.pos]->size){
        //需要使用一个新的Arena
        if (arena.pos < arena.numBlocks-1){  //复用已有的内存块
            arena.pos ++;
        }
        else{//申请一块新的Block
            addArenaBlock(ARENA_BLOCK_SIZE);
        }
    }

    ArenaBlock* block = arena.blocks[arena.pos];

    //offset当前的位置的地址，就是新申请内存的地址
    mem = (void*)(block + sizeof(ArenaBlock) + block->offset); 
    
    //移动offset
    size_t lastOffset = block->offset;
    block->offset += size;
    size_t * top = (size_t*)(block + sizeof(ArenaBlock) + block->offset);
    //写入之前的offset的值
    *top = lastOffset;   
    //再往后移一位
    block->offset+=sizeof(size_t);
    
    return mem;
}

//把内存归还arena
void returnToArena(){
    ArenaBlock* block = arena.blocks[arena.pos];
    //从当前顶部位置往后一个位置，存着上一个offset的位置
    size_t* prevOffset = (size_t*)(block + sizeof(Arena) + block->offset - sizeof(size_t));
    block->offset = *prevOffset;
    if (block->offset == 0){
        arena.pos--; //把当前块设置为前一个块
    }
}


//释放Arena所占的内存。
void deleteArena(){
    for (int i = 0; i< arena.numBlocks; i++){
        free(arena.blocks[i]);
    }
    free(arena.blocks);
}


///////////////////////////////////////////////////////////////
//主程序

/**
 * 把文件内容读入一整块内存中。
 * char** pdata : 返回数据的内存地址
 * 返回值：内存块的大小。
 * */
#define MAX_BUFFER_LEN 1024

int readBCFile(char* fileName, unsigned char** pdata){
    //打开文件
    FILE * file = fopen(fileName,"r");
    if (file == NULL){
        printf("%s, %s",fileName," does not exit/n");
        fclose(file);
        return 0;
    }

    int rc;
    unsigned char buf[MAX_BUFFER_LEN];
    unsigned char* data = NULL;
    size_t totalSize = 0;
    while( (rc = fread(buf,sizeof(unsigned char), MAX_BUFFER_LEN,file)) != 0 ){
        //把文件内容合并到一整块内存中
        size_t oldSize = totalSize;
        totalSize += rc;
        unsigned char* oldData = data;
        data = (unsigned char*)malloc(totalSize*sizeof(unsigned char));
        if (oldData != NULL){
            memcpy(data,oldData,oldSize);
            free(oldData);
        }
        memcpy(data+oldSize,buf,rc);
    }

    fclose(file);

    *pdata = data;    //返回数据的内存地址
    return totalSize;
}

int main(int argc, char** argv){
    if (argc <= 1){
        printf("Need a bycode file name.");
        return 0;
    }

    //读取文件内容
    unsigned char * data;
    int totalSize = readBCFile(argv[1], &data);

    if(totalSize == 0) return 0;
    

    //打印调试信息：字节码文件内容
    printf("字节码文件的内容:\n");
    for (int i = 0; i< totalSize; i++){
        printf("%x ", data[i]);
    }
    printf("\n");

    //生成BCModule
    BCModule* bcModule = readBCModule(data, totalSize);
    free(data);  //释放内存

    //初始化Arena机制
    initArena();

    //显示BCModule的内容
    printf("\n显示BCModule：\n");
    dumpBCModule(bcModule);

    //运行字节码
    printf("运行字节码:\n");
    clock_t begintime = clock();
    
    //运行BCModule
    execute(bcModule);

    clock_t endtime = clock();
    
    // printf("\n耗时：%lu\n", endtime-begintime);
    printf("耗时：%f 秒\n", (double)(endtime - begintime) / CLOCKS_PER_SEC);

    //删除掉Arena
    deleteArena();

    //释放内存
    deleteBCModule(bcModule);

    return 0;
}

