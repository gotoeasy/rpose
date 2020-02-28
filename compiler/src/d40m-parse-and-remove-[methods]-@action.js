const bus = require('@gotoeasy/bus');
const Err = require('@gotoeasy/err');
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const types = require('@babel/types');
const babel = require('@babel/core');

const oSetBuildIn = new Set(['$vnode', 'getRefElements', 'getRefElement', 'getRefComponents', 'getRefComponent', 'getRootElement']);

bus.on('解析检查METHODS块并删除装饰器', function (methodsCode, input={}, PosOffset=0){

    let js = "class C { #private={};       \n" + methodsCode + "\n}";                       // 前面加30位，后面添2位
    PosOffset = PosOffset - 30;                                                             // 减去前面加的10位偏移量

    // ---------------------------------------------------------
    // 解析为语法树，支持装饰器写法
    // ---------------------------------------------------------
    let ast;
    try{
        ast = parser.parse(js, {sourceType: "module",
                plugins: [
                    "decorators-legacy",                                                    // 支持装饰器
                    "classProperties",                                                      // 支持类变量
                    "classPrivateProperties",                                               // 支持类私有变量
                    "classPrivateMethods",                                                  // 支持类私有方法
                ]
            });
    }catch(e){
        let msg = e.message || '';
        let match = msg.match(/\((\d+):(\d+)\)$/);
        if ( match ) {
            msg = msg.substring(0, match.index);
            let pos = getLinePosStart(js, match[1]-1, match[2]-0, PosOffset);               // 行列号都从0开始，减0转为数字
            throw new Err(msg, e, {file: input.file, text: input.text, ...pos});
        }
        throw new Err(msg, e);
    }

    // ---------------------------------------------------------
    // 遍历语法树上的类方法，保存方法名、装饰器信息、最后删除装饰器
    // ---------------------------------------------------------
    let oClassMethod = {};
    let oClassProperty = {};
    let oClassPrivateProperty = {};
    let oClassPrivateMethod = {};
    let bindfns = [];

    traverse(ast, {

        // -----------------------------------
        // 遍历检查类属性
        ClassProperty(path){
            if ( path.node.value && path.node.value.type === 'FunctionExpression' ) {
                // 类属性值如果是函数，直接转换成箭头函数
                let value = types.arrowFunctionExpression(path.node.value.params, path.node.value.body);
                path.replaceWith( types.classProperty(path.node.key, value) );                                              // 转成箭头函数
                return;                                                                                                     // 及时返回下次还来
            }

            let oItem = {};
            let oKey = path.node.key;
            oItem.Name = {value: oKey.name, ...getPos(oKey, PosOffset)};                                                    // 方法名
            if ( oClassProperty[oItem.Name.value] ) {
                // 类变量重名
                throw new Err(`duplicate class property name (${oItem.Name.value})`, {...input, ...oItem.Name});
            }
            oClassProperty[oItem.Name.value] = oItem.Name;

            // 属性值如果是明显的方法，也按方法看待，便于事件调用及书写事件装饰器
            if ( path.node.value && path.node.value.type === 'ArrowFunctionExpression' ) {
                let oMethod = {};
                oMethod.Name = {...oItem.Name};                                                                             // 属性名作方法名

                if ( oClassMethod[oMethod.Name.value] ) {
                    // 方法名重名
                    throw new Err(`duplicate method name (${oMethod.Name.value})`, {...input, ...oMethod.Name});
                }
                if ( oSetBuildIn.has(oMethod.Name.value) ) {
                    // 不能重写内置方法
                    throw new Err(`unsupport overwrite method (${oMethod.Name.value})`, {...input, ...oMethod.Name});
                }
                oClassMethod[oMethod.Name.value] = oMethod;
                parseDecorators(path, oMethod, input, PosOffset);                                                           // 解析装饰器

                if ( path.node.value.type === 'FunctionExpression' ) {
                    path.replaceWith( types.arrowFunctionExpression(path.node.params, path.node.body) );                    // 转成箭头函数
                }
            }

            // 确保删除类属性上的全部装饰器
            delete path.node.decorators;
        },

        // -----------------------------------
        // 遍历检查私有类属性
        ClassPrivateProperty(path){
            let oItem = {};
            let oId = path.node.key.id;
            oItem.Name = {value: oId.name, ...getPos(oId, PosOffset)};                                                  // 方法名
            if ( oClassPrivateProperty[oItem.Name.value] ) {
                // 私有类变量重名
                throw new Err(`duplicate class private property name (#${oItem.Name.value})`, {...input, ...oItem.Name});
            }
            if ( !/^#private$/.test(oItem.Name.value) ) {
                oClassPrivateProperty[oItem.Name.value] = oItem.Name;                                                   // #private内置用
            }
        },

        // -----------------------------------
        // 遍历检查私有类方法
        ClassPrivateMethod(path){
            let oItem = {};
            let oId = path.node.key.id;
            oItem.Name = {value: '#'+oId.name, ...getPos(oId, PosOffset)};                                                  // 方法名
            oItem.Name.start = oItem.Name.start - 1;

            if ( oClassPrivateMethod[oItem.Name.value] ) {
                // 私有类方法重名
                throw new Err(`duplicate class private method name (${oItem.Name.value})`, {...input, ...oItem.Name});
            }
            oClassPrivateMethod[oItem.Name.value] = oItem.Name;
        },

        // -----------------------------------
        // 遍历检查类方法
        ClassMethod(path) {

            let oMethod = {};
            let oKey = path.node.key;
            oMethod.Name = {value: oKey.name, ...getPos(oKey, PosOffset)};                                                  // 方法名

            if ( oClassMethod[oMethod.Name.value] ) {
                // 方法名重名
                throw new Err(`duplicate class method name (${oMethod.Name.value})`, {...input, ...oMethod.Name});
            }
            if ( oSetBuildIn.has(oMethod.Name.value) ) {
                // 不能重写内置方法
                throw new Err(`unsupport overwrite class method (${oMethod.Name.value})`, {...input, ...oMethod.Name});
            }
            oClassMethod[oMethod.Name.value] = oMethod;
            bindfns.push(oMethod.Name.value);
            parseDecorators(path, oMethod, input, PosOffset);                                                               // 解析装饰器

        }
    });


    // ---------------------------------------------------------
    // 检查未定义变量，若有则报错
    bus.at('检查未定义变量', ast, input, PosOffset);

    // ---------------------------------------------------------
    // 生成删除装饰器后的代码
    let code = babel.transformFromAstSync(ast).code;
    code = code.substring(30, code.length - 2);

    return {Method: oClassMethod, bindfns, methods: code, ast};
});

function parseDecorators(path, oMethod, input, PosOffset){
    let decorators = path.node.decorators;
    if ( !decorators ) return;

    oMethod.decorators = [];                                                                                        // 装饰器对象数组

    decorators.forEach(decorator => {
        let oDecorator = {};
        oMethod.decorators.push(oDecorator);

        if ( decorator.expression.type === 'CallExpression' ) {
            // 函数调用式装饰器
            let oCallee = decorator.expression.callee;
            oDecorator.Name = {value: oCallee.name, ...getPos(oCallee, PosOffset)};                                 // 装饰器名

            if ( !/^action$/i.test(oDecorator.Name.value) ) {
                throw new Err(`unsupport decorator (@${oDecorator.Name.value})`, {...input, start: oDecorator.Name.start - 1, end: oDecorator.Name.end});
            }

            let i = 0;
            decorator.expression.arguments.forEach(oArg => {
                if ( i == 0 ) {
                    if ( oArg.type === 'StringLiteral' ) {
                        oDecorator.Event = {value: oArg.value, ...getPos(oArg, PosOffset)};                         // 事件名(正常的字符串字面量写法)
                        if ( !bus.at('是否HTML标准事件名', oDecorator.Event.value, true) ) {
                            // 无效的事件名，事件名支持简写省略on前缀
                            throw new Err(`invalid event name (${oDecorator.Event.value}), etc. onclick/click`, {...input, ...oDecorator.Event});
                        }
                    }else{
                        // TODO 第一参数支持对象形式写法
                        throw new Err(`support literal string only, etc. @action('click', 'button')`, {...input, ...getPos(oArg, PosOffset)});
                    }
                }else if ( i == 1 ) {
                    if ( oArg.type === 'StringLiteral' ) {
                        oDecorator.Selector = {value: oArg.value, ...getPos(oArg, PosOffset)};                      // 选择器(正常的字符串字面量写法)
                        if ( !oDecorator.Selector.value.trim() ) {
                            // 无效的事件名，事件名支持简写省略on前缀
                            throw new Err(`invalid selector (empty)`, {...input, ...oDecorator.Selector});
                        }
                    }else{
                        // TODO 第一参数支持对象形式写法
                        throw new Err(`support literal string only, etc. @action('click', 'button')`, {...input, ...getPos(oArg, PosOffset)});
                    }
                }else{
                    // TODO 参数
                }

                // oDecorator.Event.value = oDecorator.Event.value.toLowerCase();                                      // 统一转小写
                // !/^on/.test(oDecorator.Event.value) && (oDecorator.Event.value = 'on' + oDecorator.Event.value);    // 左边补足‘on’

                i++;
            });

            if ( !oDecorator.Selector ) {
                // 装饰器参数不对
                throw new Err(`invalid decorator arguments, etc. @action('click', 'button')`, {...input, ...getPos(decorator, PosOffset)});
            }

        }else{
            // 单纯名称的装饰器
            let msg;
            if ( !/^action$/i.test(decorator.expression.name) ) {
                // 装饰器名检查
                msg = `unsupport decorator "@${decorator.expression.name}"`;
            }else{
                // 参数遗漏
                msg = `missing decorator arguments, etc. @action('click', 'button')`;
            }
            throw new Err(msg, {...input, ...getPos(decorator, PosOffset)});
        }
    
    });

    // 删除装饰器
    delete path.node.decorators;
}

function getPos(oPos, offset){
    let start = oPos.start + offset;
    let end = oPos.end + offset;
    return {start, end};
}

// line: 0~n
// column: 0~n
function getLinePosStart(js, line, column, offset) {
    let lines = js.split('\n');
    let start = offset;
    for (let i = 0; i < line; i++) {
        start += lines[i].length + 1;
    }

    let end = start + lines[line].length;
    start += column;
    return {start, end};
}
