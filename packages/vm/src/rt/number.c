
#include <stdlib.h>
#include <stdio.h>
#include "number.h"

PlayString* integer_to_string(int num){
    //采用10进制情况下，整数的位数
    size_t numDigits = 1;
    int num2 = num;
    while (num2 >= 10){
        num2 /= 10;
        numDigits ++;
    }

    //创建string
    PlayString * pstr = string_create_by_length(numDigits);

    //数值转化成字符串
    // itoa(num, pstr->data, 10);  //据说这个方法不符合ansi标准
    sprintf(pstr->data, "%d", num);

    return pstr;
}

PlayString* decimal_to_string(){
    return NULL;
}

