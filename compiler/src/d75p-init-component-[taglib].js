const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 处理 [taglib]
    // 和并组件[taglib]以及项目[taglib]成一个新副本存放于context.result.oTaglib
    // 名称重复时报错
    return postobject.plugin(__filename, function(root, context){

        let prj = bus.at('项目配置处理', context.input.file);
        let oTaglib = context.result.oTaglib = Object.assign({}, prj.oTaglib || {});        // 项目配置的[taglib]合并存放到组件范围缓存起来

        // 遍历树中的taglib节点，建库，处理完后删除该节点
        root.walk( 'RposeBlock', (node, object) => {

            if ( object.name.value !== 'taglib' ) return;
            if ( !object.text || !object.text.value || !object.text.value.trim() ) return;

            let oKv = bus.at('解析[taglib]', object.text.value, context, object.text.loc);

            // 与项目配置的重复性冲突检查
            for ( let k in oKv ) {
                if ( oTaglib[k] ) {
                    throw new Err('duplicate taglib name: ' + k, { file: context.input.file, text: context.input.text, line: object.text.loc.start.line, column: 1 });
                }
            }


            // 取出[taglib]中的有效行
            let mTaglib = new Map(), lines = object.text.value.trim().split('\n');
            for ( let i=0,oTaglib; i<lines.length; i++ ) {
                oTaglib = normalizeTaglib(lines[i], i);
                oTaglib && mTaglib.set(oTaglib.taglib, oTaglib);
            }

            // 循环注册别名
            let searchPkg = bus.at('文件所在模块', context.input.file);
            let oTaglibDef = bus.at('标签库定义', '', searchPkg);                          // 取已定义的标签库结果对象
            let regists = [];
            while ( (regists = registerTaglib(mTaglib, oTaglibDef, searchPkg)) ) {
                regists.forEach( v => mTaglib.delete(v.taglib) );
            }
            
            // 仍有别名未注册，提示错误
            if ( mTaglib.size ) {
                let keys = [...mTaglib.keys()];
                let oTaglib = mTaglib.get(keys[0]);
                throw new Err(`tag [${oTaglib.tag}] not found in package [${oTaglib.pkg}]` , { file: context.input.file, text: context.input.text, line: object.text.loc.start.line + oTaglib.line, column: 1 });
            }




            node.remove();
            return false;
        });

//console.info('-------rs----------', context.input.file, bus.at('标签库定义', '', context.input.file))
    });

}());


function registerTaglib(mTaglib, oTaglibDef, searchPkg){

    let regists = [];
    mTaglib.forEach(oTaglib => {
        if ( oTaglibDef[oTaglib.pkg+':'+oTaglib.tag] ) {
            if ( !oTaglibDef[searchPkg+':'+oTaglib.astag] ) {
                oTaglibDef[searchPkg+':'+oTaglib.astag] = oTaglibDef[oTaglib.pkg+':'+oTaglib.tag];
            }
            regists.push(oTaglib);
        }
    });
    return regists.length ? regists : null;
}

function normalizeTaglib(taglib, line){

    let astag, pkg, tag, match;
    if ( (match = taglib.match(/^\s*([\S]+)\s*=\s*([\S]+)\s*:\s*([\S]+)\s*$/)) ) {
        // c-btn=@scope/pkg:ui-button
        astag = match[1];                       // c-btn=@scope/pkg:ui-button => c-btn
        pkg = match[2];                         // c-btn=@scope/pkg:ui-button => @scope/pkg
        tag = match[3];                         // c-btn=@scope/pkg:ui-button => ui-button
    }else if ( (match = taglib.match(/^\s*([\S]+)\s*=\s*([\S]+)\s*$/)) ) {
        // ui-button=@scope/pkg
        astag = match[1];                       // ui-button=@scope/pkg => ui-button
        pkg = match[2];                         // ui-button=@scope/pkg => @scope/pkg
        tag = match[1];                         // ui-button=@scope/pkg => ui-button
    }else if ( (match = taglib.match(/^\s*([\S]+)\s*:\s*([\S]+)\s*$/)) ) {
        // @scope/pkg:ui-button
        astag = match[2];                       // @scope/pkg:ui-button => ui-button
        pkg = match[1];                         // @scope/pkg:ui-button => @scope/pkg
        tag = match[2];                         // @scope/pkg:ui-button => ui-button
    }else{
        // 不支持的格式
        return undefined;
    }

    return { line, astag, pkg, tag, taglib: astag+'='+pkg+':'+tag };
}

