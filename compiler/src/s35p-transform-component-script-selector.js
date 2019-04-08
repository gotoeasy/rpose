const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const csjs = require('@gotoeasy/csjs');
const File = require('@gotoeasy/file');
const hash = require('@gotoeasy/hash');
const acorn = require('acorn');
const walk = require("acorn-walk")
const astring = require('astring');
const tokenizer = require('css-selector-tokenizer');

bus.on('编译插件', function(){
    
    // ---------------------------------------------------------------
    // 转换后脚本actions、methods中，含有类选择器时，做相应的类名哈希处理
    // 
    // getElementsByClassName('classname')
    // querySelector('div > .classname')
    // querySelectorAll('div > .classname')
    // $$('div > .classname')
    // 
    // 【注】
    // 方法名一致、且第一参数为字面量时才转换
    // 若希望被转换但又没按此规则书写，将不被转换而导致不符预期
    // ---------------------------------------------------------------
    return postobject.plugin(/**/__filename/**/, function(root, context){

        let oCsslibPkgs = context.result.oCsslibPkgs;
        let script = context.script;
        let reg = /(\.getElementsByClassName\s*\(|\.querySelector\s*\(|\.querySelectorAll\s*\(|\$\$\s*\()/;

        if ( script.actions && reg.test(script.actions) ) {
            script.actions = transformJsSelector(script.actions, context.input.file);
        }
        if ( script.methods && reg.test(script.methods) ) {
            script.methods = transformJsSelector(script.methods, context.input.file);
        }


        function transformJsSelector(code, srcFile){

            let ast, changed;
            try{
                ast = acorn.parse(code, {ecmaVersion: 10, sourceType: 'module', locations: false} );
            }catch(e){
                throw new Err('syntax error', e);  // 通常是代码有语法错误
            }

            walk.simple(ast, {
                CallExpression(node) {

                    // 第一参数不是字符串时，无可修改，忽略
                    if ( !node.arguments || node.arguments[0].type !== 'Literal' ) {
                        return;
                    }

                    // 非特定函数名时，忽略
                    let fnName = node.callee.name || node.callee.property.name;
                    if ( !/^(getElementsByClassName|querySelector|querySelectorAll|\$\$)$/.test(fnName) ) {
                        return;
                    }

                    if ( fnName === 'getElementsByClassName' ) {
                        node.arguments[0].value = bus.at('哈希样式类名', srcFile, getClassPkg(node.arguments[0].value));             // 参数是一个不含点号的类名，直接哈希替换
                    }else{
                        node.arguments[0].value = transformSelector(node.arguments[0].value, srcFile);     // 参数是选择器，解析后替换
                    }

                    node.arguments[0].raw = `'${node.arguments[0].value}'`;                                             // 输出字符串
                    changed = true;
                }

            });

            return changed ? astring.generate(ast) : code;
        }


        function transformSelector(selector, srcFile){

            selector = selector.replace(/@/g, '鬱')
            let ast = tokenizer.parse(selector);
            let nodes = ast.nodes || [];
            nodes.forEach(node => {
                if ( node.type === 'selector' ) {
                    (node.nodes || []).forEach(nd => {
                        if ( nd.type === 'class' ) {
                            nd.name = bus.at('哈希样式类名', srcFile, getClassPkg(nd.name) );
                        }
                    });
                }
            });

            let rs = tokenizer.stringify(ast);
            return rs.replace(/鬱/g, '@');
        }

        function getClassPkg(cls){
            let ary = cls.trim().split('鬱');
            if ( ary.length > 1 ){
                let asname = ary[1];
                if ( !oCsslibPkgs[asname] ) {
                    // js代码中类选择器指定的csslib未定义导致找不到
                    throw new Error('csslib not found: ' + ary[0] + '@' + ary[1] + '\nfile: ' + context.input.file);  // TODO 友好定位提示
                }
                return ary[0] + '@' + asname;  // 哈希还是使用'@'
            }

            return ary[0];
        }

    });

}());

