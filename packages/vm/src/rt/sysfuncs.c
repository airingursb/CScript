#include <stdio.h>
#include <time.h> 

//打印一个整数
void println(int n){
    printf("%d\n",n);
}

//获得时钟时间
int tick(){
    return clock();
}
