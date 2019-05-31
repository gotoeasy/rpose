const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
//const Err = require('@gotoeasy/err');

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

        let oPrjContext = bus.at("项目配置处理", context.input.file);
        let oPrjCsslibs = oPrjContext.result.oCsslibs;                                                  // 项目[csslib]配置的样式库 (asname：lib)
        let oCsslibs = context.result.oCsslibs;                                                         // 组件[csslib]配置的样式库 (asname：lib)
        let oAtCsslibs = context.result.oAtCsslibs = context.result.oAtCsslibs || {};                   // 组件@csslib配置的样式库 (asname：lib)

        let script = context.script;
        let reg = /(\.getElementsByClassName\s*\(|\.toggleClass\s*\(|\.querySelector\s*\(|\.querySelectorAll\s*\(|\$\s*\(|addClass\(|removeClass\(|classList)/;

        let classnames = script.classnames = script.classnames || [];                                   // 脚本代码中用到的样式类，存起来后续继续处理

        if ( script.methods && reg.test(script.methods) ) {
            // TODO 用babel编辑修改
            //script.methods = transformJsSelector(script.methods, context.input.file, classnames, oAtCsslibs, oCsslibs, oPrjCsslibs);
        }

        // 脚本中用到的类，检查样式库是否存在，检查类名是否存在
        if ( classnames.length ) {
            // 查库取样式，把样式库别名改成真实库名
            for ( let i=0,clspkg,clsname,asname,ary,csslib; clspkg=classnames[i++]; ) {
                ary = clspkg.split('@');
                clsname = '.' + ary[0];                         // 类名
                asname = ary.length > 1 ? ary[1] : '*';         // 库别名

                if ( asname !== '*' ) {
                    // 别名样式类，按需引用别名库
                    csslib = oAtCsslibs[asname] || oCsslibs[asname] || oPrjCsslibs[asname];
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

    });

}());

/*
function transformJsSelector(code, srcFile, classnames, oAtCsslibs, oCsslibs, oPrjCsslibs){

    let ast, changed;
    try{
        ast = acorn.parse(code, {ecmaVersion: 10, sourceType: 'module', locations: false} );        // TODO 自动紧跟新标准版本
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

            let fnName, classname, pkgcls;
            if ( node.callee.type === 'Identifier' ) {
                // 直接函数调用
                fnName = node.callee.name;
                if ( fnName === '$$' || fnName === '$' ) {
                    node.arguments[0].value = transformSelector(node.arguments[0].value, srcFile, classnames, oAtCsslibs, oCsslibs, oPrjCsslibs);                              // $$('div > .foo'), $('div > .bar')
                }else{
                    return;
                }

            }else if ( node.callee.type === 'MemberExpression' ) {
                // 对象成员函数调用
                fnName = node.callee.property.name;
                if ( fnName === 'getElementsByClassName' || fnName === 'toggleClass' ) {                                        // document.getElementsByClassName('foo'), $$el.toggleClass('foo')
                    classname = node.arguments[0].value;
                    pkgcls = getClassPkg(classname, srcFile, oAtCsslibs, oCsslibs, oPrjCsslibs);
                    node.arguments[0].value = bus.at('哈希样式类名', srcFile, pkgcls);
                    classnames.push(classname);                                                                                 // 脚本中用到的类，存起来查样式库使用
                }else if (fnName === 'querySelector' || fnName === 'querySelectorAll'){                                         // document.querySelector('div > .foo'), document.querySelectorAll('div > .bar')
                    node.arguments[0].value = transformSelector(node.arguments[0].value, srcFile, classnames, oAtCsslibs, oCsslibs, oPrjCsslibs);
                }else if (fnName === 'addClass' || fnName === 'removeClass'){                                                   // $$el.addClass('foo bar'), $$el.removeClass('foo bar')
                    let rs = [], ary = node.arguments[0].value.trim().split(/\s+/);
                    ary.forEach( cls => {
                        pkgcls = getClassPkg(cls, srcFile, oAtCsslibs, oCsslibs, oPrjCsslibs);
                        rs.push( bus.at('哈希样式类名', srcFile, pkgcls ));
                        classnames.push(cls);                                                                                   // 脚本中用到的类，存起来查样式库使用
                    });
                    node.arguments[0].value = rs.join(' ');
                }else if (fnName === 'add' || fnName === 'remove'){                                                             // el.classList.add('foo'), el.classList.remove('bar')
                    if ( node.callee.object.type === 'MemberExpression' && node.callee.object.property.name === 'classList' ) {
                        classname = node.arguments[0].value;
                        pkgcls = getClassPkg(classname, srcFile, oAtCsslibs, oCsslibs, oPrjCsslibs);
                        node.arguments[0].value = bus.at('哈希样式类名', srcFile, pkgcls);
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

function transformSelector(selector, srcFile, classnames, oAtCsslibs, oCsslibs, oPrjCsslibs){

    selector = selector.replace(/@/g, '鬱');
    let ast = tokenizer.parse(selector);
    let classname, pkgcls, nodes = ast.nodes || [];
    nodes.forEach(node => {
        if ( node.type === 'selector' ) {
            (node.nodes || []).forEach(nd => {
                if ( nd.type === 'class' ) {
                    classname = nd.name;
                    pkgcls = getClassPkg(classname, srcFile, oAtCsslibs, oCsslibs, oPrjCsslibs);
                    nd.name = bus.at('哈希样式类名', srcFile, pkgcls );
                    classnames.push(classname);                             // 脚本中用到的类，存起来查样式库使用
                }
            });
        }
    });

    let rs = tokenizer.stringify(ast);
    return rs.replace(/鬱/g, '@');
}

// 替换js代码中的样式库别名为实际库名，检查样式库是否存在
function getClassPkg(cls, srcFile, oAtCsslibs, oCsslibs, oPrjCsslibs){
    let ary = cls.trim().split(/鬱|@/);
    if ( ary.length > 1 ){
        let asname = ary[1];
        let csslib = oAtCsslibs[asname] || oCsslibs[asname] || oPrjCsslibs[asname];                             // 找出别名对应的实际库名
        if ( !csslib ) {
            throw new Error('csslib not found: ' + ary[0] + '@' + ary[1] + '\nfile: ' + srcFile);               // js代码中类选择器指定的csslib未定义导致找不到 TODO 友好定位提示
        }
        return ary[0] + '@' + csslib.pkg;                                                                       // 最终按实际别名对应的实际库名进行哈希
    }else{
        let nonameCsslib = oAtCsslibs['*'] || oCsslibs['*'] || oPrjCsslibs['*'];
        if ( nonameCsslib && nonameCsslib.has('.' + ary[0]) ) {
            return ary[0] + '@' + nonameCsslib.pkg;                                                             // 无名库，也按实际别名对应的实际库名进行哈希
        }
    }

    return ary[0];
}
*/
