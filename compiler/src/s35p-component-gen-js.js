const bus = require('@gotoeasy/bus');
const csjs = require('@gotoeasy/csjs');
const File = require('@gotoeasy/file');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    return postobject.plugin(__filename, function(root, context){
        let env = bus.at('编译环境');
        let result = context.result;
        let script = context.script;
        let writer = context.writer;

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
        $data.actions = script.actions;
        $data.methods = script.methods;
        $data.updater = script.updater;
        $data.vnodeTemplate = script.vnodeTemplate;

        // 生成组件JS源码
        result.componentJs = fnTmpl($data);

        // 非release模式时输出源码便于确认
        if ( !env.release ) {
            let fileJs = env.path.build_temp + '/' + bus.at('组件目标文件名', context.input.file) + '.js';
            File.write(fileJs, csjs.formatJs(result.componentJs) );
        }

    });

}());
