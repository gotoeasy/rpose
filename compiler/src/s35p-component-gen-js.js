const bus = require('@gotoeasy/bus');
const csjs = require('@gotoeasy/csjs');
const File = require('@gotoeasy/file');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');
const acornGlobals = require('acorn-globals');

const JS_VARS = '$$,require,window,location,clearInterval,setInterval,assignOptions,rpose,$SLOT,Object,Map,Set,WeakMap,WeakSet,Date,Math,Array,String,Number,JSON,Error,Function,arguments,Boolean,Promise,Proxy,Reflect,RegExp,alert,console,window,document'.split(',');

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
        result.componentJs = checkAndInitVars(result.componentJs, context);

        // 非release模式时输出源码便于确认
        if ( !env.release ) {
            let fileJs = env.path.build_temp + '/' + bus.at('组件目标文件名', context.input.file) + '.js';
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
		scopes = acornGlobals(src);
		if ( !scopes.length ) return src; // 正常，直接返回
	}catch(e){
		throw Err.cat('source syntax error', '\n-----------------', src, '\n-----------------', 'file='+ context.input.file, e); // 多数表达式中有语法错误导致
	}

	// 函数内部添加变量声明赋值后返回
	let vars = [];
	for ( let i=0, v; i<scopes.length; i++ ) {
		v = scopes[i];

		let inc$opts = optionkeys.includes(v.name);
		let inc$state = statekeys.includes(v.name);
		let incJsVars = JS_VARS.includes(v.name);

        // TODO 优化提示定位
		if ( !inc$opts && !inc$state && !incJsVars) {
			let msg = 'template variable undefined: ' + v.name;
			msg += '\n  file: ' + context.input.file;
			throw new Err(msg);		// 变量不在$state或$options的属性范围内
		}
		if ( inc$opts && inc$state ) {
			let msg = 'template variable uncertainty: ' + v.name;
			msg += '\n  file: ' + context.input.file;
			throw new Err(msg);		// 变量同时存在于$state和$options，无法自动识别来源，需指定
		}

		if ( inc$state ) {
			vars.push(`let ${v.name} = $state.${v.name};`)
		}else if ( inc$opts ) {
			vars.push(`let ${v.name} = $options.${v.name};`)
		}
	}

    return src.replace(/(\n.+?prototype\.nodeTemplate\s*=\s*function\s+.+?\r?\n)/, '$1' + vars.join('\n'));
}
