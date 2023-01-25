

#ifndef PLAYSCRIPT_TYPE
#define PLAYSCRIPT_TYPE

///////////////////////////////////////////////////////////////////
//Type
typedef enum _TypeKind{SimpleT, UnionT, FunctionT} TypeKind;

typedef struct _Type{
    char* name;
    TypeKind kind;
    void (*dump)(struct _Type*);  //用于打印输出的函数
} Type;

typedef struct _SimpleType{
    Type t;
    int numUpperTypes;
    Type** upperTypes; 
}SimpleType;

typedef struct _FunctionType{
    Type t;
    Type* returnType;
    int numParams;
    Type** paramTypes;
}FunctionType;

typedef struct _UnionType{
    Type t;
    int numTypes;
    Type** types;
}UnionType;

typedef struct _SysTypes{
    SimpleType* Number;
    SimpleType* String;
    SimpleType* Boolean;
    SimpleType* Integer;
    SimpleType* Decimal;
    SimpleType* Null;
    SimpleType* Void;
    SimpleType* Undefined;
    SimpleType* Any;
}SysTypes;

#endif
