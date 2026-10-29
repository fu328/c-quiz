import type { Question } from '../types';

const base = Date.now();

function q(
  index: number,
  data: Omit<Question, 'id' | 'createdAt' | 'updatedAt' | 'tags'> & { tags?: string[] },
): Question {
  return {
    id: `sample_${index}`,
    createdAt: base + index,
    updatedAt: base + index,
    tags: data.tags ?? [],
    ...data,
  };
}

export function sampleQuestions(): Question[] {
  return [
    q(0, {
      type: 'single',
      stem: '下列哪一个是合法的 C 语言标识符？',
      options: [
        { key: 'A', text: '2var' },
        { key: 'B', text: '_var' },
        { key: 'C', text: 'var-2' },
        { key: 'D', text: 'int' },
      ],
      answer: ['B'],
      explanation:
        '标识符只能由字母、数字和下划线组成，且不能以数字开头，因此 2var 和 var-2 非法；int 是关键字，也不能作为标识符。',
      tags: ['基础语法'],
    }),
    q(1, {
      type: 'single',
      stem: '关于 sizeof 运算符，下列说法正确的是？',
      options: [
        { key: 'A', text: 'sizeof 是库函数，在程序运行时求值' },
        { key: 'B', text: 'sizeof 是运算符，结果类型为 size_t' },
        { key: 'C', text: 'sizeof 只能作用于变量，不能作用于类型' },
        { key: 'D', text: 'sizeof(char) 的结果一定是 2' },
      ],
      answer: ['B'],
      explanation:
        'sizeof 是编译期运算符，结果类型为 size_t，既可以作用于变量也可以作用于类型，sizeof(char) 恒为 1。',
      tags: ['运算符'],
    }),
    q(2, {
      type: 'single',
      stem: `以下程序的输出结果是？
\`\`\`c
#include <stdio.h>
int main(void) {
    int a[5] = {1, 2, 3};
    printf("%d\\n", a[3]);
    return 0;
}
\`\`\``,
      options: [
        { key: 'A', text: '0' },
        { key: 'B', text: '1' },
        { key: 'C', text: '3' },
        { key: 'D', text: '随机值' },
      ],
      answer: ['A'],
      explanation:
        '部分初始化的数组，剩余元素会被自动初始化为 0，因此 a[3] 和 a[4] 都是 0。',
      tags: ['数组'],
    }),
    q(3, {
      type: 'multiple',
      stem: '下列关于指针的说法，正确的有？',
      options: [
        { key: 'A', text: '指针变量中存放的是内存地址' },
        { key: 'B', text: '数组名在大多数表达式中会转换为指向首元素的指针' },
        { key: 'C', text: '指针变量的大小一定是 4 字节' },
        { key: 'D', text: 'void * 可以与任意对象类型的指针相互赋值' },
      ],
      answer: ['A', 'B', 'D'],
      explanation:
        '指针的大小取决于平台：32 位通常 4 字节，64 位通常 8 字节，因此 C 错误；void * 可以与任意对象类型的指针相互赋值。',
      tags: ['指针'],
    }),
    q(4, {
      type: 'judge',
      stem: '在 C 语言中，数组的下标从 0 开始，最后一个元素的下标是数组长度减 1。',
      options: [],
      answer: ['对'],
      explanation: 'C 数组下标范围是 0 ~ n-1，访问 a[n] 属于越界。',
      tags: ['数组'],
    }),
    q(5, {
      type: 'judge',
      stem: '函数内部定义的 static 局部变量，每次调用该函数时都会重新初始化。',
      options: [],
      answer: ['错'],
      explanation:
        'static 局部变量存储在静态区，只初始化一次，函数返回后其值仍然保留，下次调用时继续使用上一次的值。',
      tags: ['函数', '存储类别'],
    }),
    q(6, {
      type: 'fill',
      stem: 'C 语言中用于动态分配内存的标准库函数是 ____（写出一个即可，不带参数）。',
      options: [],
      answer: ['malloc'],
      explanation: 'malloc 按字节申请内存，返回 void *，失败时返回 NULL；配套使用 free 释放。',
      tags: ['内存管理'],
    }),
    q(7, {
      type: 'single',
      stem: '以下 for 循环的循环体共执行多少次？\n`for (int i = 0; i < 10; i += 2)`',
      options: [
        { key: 'A', text: '4 次' },
        { key: 'B', text: '5 次' },
        { key: 'C', text: '6 次' },
        { key: 'D', text: '10 次' },
      ],
      answer: ['B'],
      explanation: 'i 取值为 0、2、4、6、8，共 5 次。',
      tags: ['控制流'],
    }),
    q(8, {
      type: 'single',
      stem: '字符串字面量 "hello" 在内存中占用的字节数是？',
      options: [
        { key: 'A', text: '5' },
        { key: 'B', text: '6' },
        { key: 'C', text: '7' },
        { key: 'D', text: '由编译器决定' },
      ],
      answer: ['B'],
      explanation: '字符串末尾还有一个隐藏的结束符 \'\\0\'，因此占用 5 + 1 = 6 个字节。',
      tags: ['字符串'],
    }),
    q(9, {
      type: 'single',
      stem: '使用 printf 函数需要包含的头文件是？',
      options: [
        { key: 'A', text: '<stdlib.h>' },
        { key: 'B', text: '<string.h>' },
        { key: 'C', text: '<stdio.h>' },
        { key: 'D', text: '<math.h>' },
      ],
      answer: ['C'],
      explanation: 'printf / scanf 等标准输入输出函数声明在 stdio.h 中。',
      tags: ['标准库'],
    }),
    q(10, {
      type: 'single',
      stem: '若 `int a[5]; int *p = a;`，则表达式 `*(p + 3)` 等价于？',
      options: [
        { key: 'A', text: 'a[3]' },
        { key: 'B', text: 'a[4]' },
        { key: 'C', text: '&a[3]' },
        { key: 'D', text: 'a + 3' },
      ],
      answer: ['A'],
      explanation: '指针加 3 后解引用，访问的是从首元素偏移 3 个 int 的位置，即 a[3]。',
      tags: ['指针', '数组'],
    }),
    q(11, {
      type: 'multiple',
      stem: '下列哪些是 C 语言的关键字？',
      options: [
        { key: 'A', text: 'static' },
        { key: 'B', text: 'main' },
        { key: 'C', text: 'sizeof' },
        { key: 'D', text: 'typedef' },
      ],
      answer: ['A', 'C', 'D'],
      explanation: 'main 只是程序入口的函数名，不是关键字。',
      tags: ['基础语法'],
    }),
    q(12, {
      type: 'single',
      stem: '以下程序的输出结果是？',
      code: `#include <stdio.h>

int main(void) {
    int sum = 0;
    for (int i = 1; i <= 5; i++) {
        if (i % 2 == 0) {
            continue;
        }
        sum += i;
    }
    printf("%d\\n", sum);
    return 0;
}`,
      options: [
        { key: 'A', text: '6' },
        { key: 'B', text: '9' },
        { key: 'C', text: '15' },
        { key: 'D', text: '编译错误' },
      ],
      answer: ['B'],
      explanation: '偶数会被 continue 跳过，实际累加的是 1 + 3 + 5 = 9。',
      tags: ['程序阅读'],
    }),
    q(13, {
      type: 'coding',
      stem: '编写函数 int max_of(int a[], int n)，返回数组中的最大值；若 n <= 0 返回 0。',
      code: `#include <stdio.h>

int max_of(int a[], int n) {
    // 在这里实现
}

int main(void) {
    int a[] = {3, 9, 2};
    printf("%d\\n", max_of(a, 3));
    return 0;
}`,
      options: [],
      answer: [],
      referenceCode: `#include <stdio.h>

int max_of(int a[], int n) {
    if (n <= 0) {
        return 0;
    }
    int max = a[0];
    for (int i = 1; i < n; i++) {
        if (a[i] > max) {
            max = a[i];
        }
    }
    return max;
}

int main(void) {
    int a[] = {3, 9, 2};
    printf("%d\\n", max_of(a, 3));
    return 0;
}`,
      explanation: '先处理 n <= 0 的边界，再用首元素初始化最大值，遍历其余元素更新。',
      tags: ['编程题'],
    }),
  ];
}
