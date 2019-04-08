const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 检查 @csslib
    // 排除别名冲突 （不做建库处理）
    return postobject.plugin(/**/__filename/**/, function(root, context){

        let oCsslib = context.result.oCsslib;

        let oNameSet = new Set();

        root.walk( '@csslib', (node, object) => {

            if ( bus.at('是否表达式', object.value) ) {
                // 属性 @csslib 不能使用表达式
                throw new Err('@csslib unsupport the expression', {file: context.input.file, text: context.input.text, start: object.loc.start.pos, end: object.loc.end.pos});
            }

            let tmpAry = object.value.split('=');
            let libname = tmpAry.length > 1 ? tmpAry[0].trim() : '*';   // 支持简写，如@csslib="pkg:**.min.css"，等同@csslib="*=pkg:**.min.css"
            if ( !libname ) {
                // 漏写别名时报错，如@csslib="=pkg:**.min.css"
                throw new Err('use * as empty csslib name. etc. * = ' + tmpAry[1], { file: context.input.file, text: context.input.text, start: object.loc.start.pos, end: object.loc.end.pos });
            }

            if ( oCsslib[libname] ) {
                // 有别名冲突时报错（组件内@csslib的别名，不能和项目及组件的[csslib]有别名重复）
                throw new Err('duplicate csslib name: ' + libname, { file: context.input.file, text: context.input.text, start: object.loc.start.pos, end: object.loc.end.pos });
            }

            if ( oNameSet.has(libname) ) {
                // 有别名冲突时报错（同一组件内，view中的@csslib不能有别名重复）
                throw new Err('duplicate csslib name: ' + libname, { file: context.input.file, text: context.input.text, start: object.loc.start.pos, end: object.loc.end.pos });
            }
            oNameSet.add(libname);
        });


    });

}());

