const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');
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

        let style = context.style;
        style.csslibset = style.csslibset || new Set();
        let oCsslib = context.result.oCsslib;
        let oCsslibPkgs = context.result.oCsslibPkgs;
        let script = context.script;
        let reg = /(\.getElementsByClassName\s*\(|\.toggleClass\s*\(|\.querySelector\s*\(|\.querySelectorAll\s*\(|\$\s*\(|addClass\(|removeClass\(|classList)/;

        let classnames = script.classnames = script.classnames || [];                   // 脚本代码中用到的样式类
        if ( script.actions && reg.test(script.actions) ) {
            script.actions = transformJsSelector(script.actions, context.input.file);
        }
        if ( script.methods && reg.test(script.methods) ) {
            script.methods = transformJsSelector(script.methods, context.input.file);
        }

        // 脚本中用到的类，检查样式库是否存在，检查类名是否存在
        if ( classnames.length ) {
            // 查库取样式，把样式库匿名改成真实库名
            for ( let i=0,clspkg,clsname,asname,ary; clspkg=classnames[i++]; ) {
                ary = clspkg.split('@');
                clsname = '.' + ary[0];                         // 类名
                asname = ary.length > 1 ? ary[1] : '*';         // 库别名

                if ( asname !== '*' ) {
                    // 别名样式类，按需引用别名库
                    let csslib = oCsslib[asname];
                    if ( !csslib ) {
                        // 指定别名的样式库不存在
                        throw new Error('csslib not found: ' + asname + '\nfile: ' + context.input.file);  // TODO 友好定位提示
                    }
                    
                    if ( !csslib.has(clsname) ) {
                        // 指定样式库中找不到指定的样式类，无名库的话可以是纯js控制用，非无名库就是要引用样式，不存在就得报错
                        throw new Error('css class not found: '+ clspkg + '\nfile: ' + context.input.file);  // TODO 友好定位提示
                    }
                }

            }
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

                    // 为避免误修改，不对类似 el.className = 'foo'; 的赋值语句进行转换

                    // 第一参数不是字符串时，无可修改，忽略
                    if ( !node.arguments || !node.arguments[0] || node.arguments[0].type !== 'Literal' ) {
                        return;
                    }

                    let fnName, classname;
                    if ( node.callee.type === 'Identifier' ) {
                        // 直接函数调用
                        fnName = node.callee.name;
                        if ( fnName === '$$' || fnName === '$' ) {
                            node.arguments[0].value = transformSelector(node.arguments[0].value, srcFile);                              // $$('div > .foo'), $('div > .bar')
                        }else{
                            return;
                        }

                    }else if ( node.callee.type === 'MemberExpression' ) {
                        // 对象成员函数调用
                        fnName = node.callee.property.name;
                        if ( fnName === 'getElementsByClassName' || fnName === 'toggleClass' ) {                                        // document.getElementsByClassName('foo'), $$el.toggleClass('foo')
                            classname = getClassPkg(node.arguments[0].value);
                            node.arguments[0].value = bus.at('哈希样式类名', srcFile, classname);
                            classnames.push(classname);                                                                                 // 脚本中用到的类，存起来查样式库使用
                        }else if (fnName === 'querySelector' || fnName === 'querySelectorAll'){                                         // document.querySelector('div > .foo'), document.querySelectorAll('div > .bar')
                            node.arguments[0].value = transformSelector(node.arguments[0].value, srcFile);
                        }else if (fnName === 'addClass' || fnName === 'removeClass'){                       // $$el.addClass('foo bar'), $$el.removeClass('foo bar')
                            let rs = [], classname, ary = node.arguments[0].value.trim().split(/\s+/);
                            ary.forEach( cls => {
                                classname = getClassPkg(cls);
                                rs.push( bus.at('哈希样式类名', srcFile, classname ));
                                classnames.push(classname);                                                                             // 脚本中用到的类，存起来查样式库使用
                            });
                            node.arguments[0].value = rs.join(' ');
                        }else if (fnName === 'add' || fnName === 'remove'){                                                             // el.classList.add('foo'), el.classList.remove('bar')
                            if ( node.callee.object.type === 'MemberExpression' && node.callee.object.property.name === 'classList' ) {
                                classname = getClassPkg(node.arguments[0].value);
                                node.arguments[0].value = bus.at('哈希样式类名', srcFile, classname);
                                classnames.push(classname);                                                                             // 脚本中用到的类，存起来查样式库使用
                            }else{
                                return;
                            }
                        }else{
                            return;
                        }

                    }else{
                        return;
                    }

                    node.arguments[0].raw = `'${node.arguments[0].value}'`;                                                             // 输出字符串
                    changed = true;
                }

            });

            return changed ? astring.generate(ast) : code;
        }


        function transformSelector(selector, srcFile){

            selector = selector.replace(/@/g, '鬱');
            let ast = tokenizer.parse(selector);
            let classname, nodes = ast.nodes || [];
            nodes.forEach(node => {
                if ( node.type === 'selector' ) {
                    (node.nodes || []).forEach(nd => {
                        if ( nd.type === 'class' ) {
                            classname = getClassPkg(nd.name);
                            nd.name = bus.at('哈希样式类名', srcFile, classname );
                            classnames.push(classname);                             // 脚本中用到的类，存起来查样式库使用
                        }
                    });
                }
            });

            let rs = tokenizer.stringify(ast);
            return rs.replace(/鬱/g, '@');
        }

        // 检查样式库是否存在
        function getClassPkg(cls){
            let ary = cls.trim().split(/鬱|@/);
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

