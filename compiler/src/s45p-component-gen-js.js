const bus = require('@gotoeasy/bus');
const csjs = require('@gotoeasy/csjs');
const File = require('@gotoeasy/file');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    return postobject.plugin(/**/__filename/**/, function(root, context){
        let env = bus.at('编译环境');
        let result = context.result;
        let script = context.script;

        // 模板函数
        let fnTmpl = bus.at('编译模板JS');

        // 模板数据
        let $data = {};
        $data.COMPONENT_NAME = bus.at('组件类名', context.input.file);
        $data.options = context.doc.options || '{}';
        $data.state = context.doc.state || '{}';
        if ( context.doc.api ) {
            $data.optionkeys = context.doc.api.optionkeys;
            $data.statekeys = context.doc.api.statekeys;
        }
      //  $data.actions = script.actions;
        $data.methods = script.methods;
        $data.Method = script.Method;
        script.bindfns && script.bindfns.length && ($data.bindfns = script.bindfns);        // 有则设之
        $data.vnodeTemplate = script.vnodeTemplate;

        $data['@merge'] = result.merge;                                                     // 是否有@merge

        // 生成组件JS源码
        result.componentJs = fnTmpl($data);
        result.componentJs = checkAndInitVars(result.componentJs, context);

        // 非release模式时输出源码便于确认
        if ( !env.release ) {
            let fileJs = bus.at('组件目标临时JS文件名', context.input.file);
            File.write(fileJs, csjs.formatJs(result.componentJs) );
        }

    });

}());

// 检查是否有变量缩写，有则补足，用以支持{$state.abcd}简写为{abcd}
function checkAndInitVars(src, context){
    let optionkeys = context.doc.api.optionkeys || [];
    let statekeys = context.doc.api.statekeys || [];
    let scopes;
    try{
        scopes = bus.at('查找未定义变量', src);
        if ( !scopes.length ) return src; // 正常，直接返回
    }catch(e){
        throw Err.cat('source syntax error', '\n-----------------', src, '\n-----------------', 'file='+ context.input.file, e); // 多数表达式中有语法错误导致
    }

    // 函数内部添加变量声明赋值后返回
    let vars = [];
    for ( let i=0, name; name=scopes[i++]; ) {

        let inc$opts = optionkeys.includes(name);
        let inc$state = statekeys.includes(name);

        // TODO 优化提示定位
        if ( !inc$opts && !inc$state ) {
            let msg = 'template variable undefined: ' + name;
            msg += '\n  file: ' + context.input.file;
            throw new Err(msg);                                                     // 变量不在$state或$options的属性范围内
        }
        if ( inc$opts && inc$state ) {
            let msg = 'template variable uncertainty: ' + name;
            msg += '\n  file: ' + context.input.file;
            throw new Err(msg);                                                     // 变量同时存在于$state和$options，无法自动识别来源，需指定
        }

        if ( inc$state ) {
            vars.push(`let ${name} = $state.${name};`)
        }else if ( inc$opts ) {
            vars.push(`let ${name} = $options.${name};`)
        }
    }

    return src.replace(/(\n\s*vnodeTemplate\s*\(\s*\$state\s*,\s*\$options\s*\)\s*{\r?\n)/, '$1' + vars.join('\n'));
}
