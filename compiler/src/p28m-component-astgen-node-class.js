const bus = require('@gotoeasy/bus');
const Err = require('@gotoeasy/err');

bus.on('astgen-node-class', function(){

    // 标签类属性生成json属性值形式代码
    // "abc def {bar:!bar}" => {class:{abc:1, def:1, bar:!bar}}
    // 修改类名
    return function (tagNode, context){
        if ( !tagNode.nodes ) return '';

        // 查找Class属性节点
        let classNode;
        for ( let i=0,nd; nd=tagNode.nodes[i++]; ) {
            if ( nd.type === 'Class' ) {
                classNode = nd;
                break;  // 找到
            }
        }
        if ( !classNode || !classNode.object.value ) return '';             // 没有类属性节点或没有类属性值，返回空白

        // 生成
        return parseClassesToObjectString(classNode, context);
    }

}());

function parseClassesToObjectString(classNode, context){

    let oPrjContext = bus.at("项目配置处理", context.input.file);
    let oAllCsslibs = Object.assign({}, oPrjContext.result.oCsslibs, context.result.oCsslibs, context.result.oAtCsslibs);

    let classes = classNode.object.classes;
    let rs = [];
    for ( let i=0,oCls,ary,clspkg,clas,expr,csslib; oCls=classes[i++]; ) {
        ary = oCls.Name.value.split('@');
        if ( ary.length > 1 ) {
            // 别名库样式，把别名改成真实库名 (无别名样式也都已自动添加别名)
            csslib = oAllCsslibs[ary[1]];
            if ( !csslib ) {
                // 理应检查过，不该发生
                throw new Err('csslib not found: ' + ary[1], {file: context.input.file, text: context.input.text, start: oCls.Name.start, end: oCls.Name.end });
            }
            clspkg = ary[0] + '@' + csslib.pkg;
        }else {
            // 普通无别名样式类
            clspkg = oCls.Name.value;
        }

        clas = bus.at('哈希样式类名', context.input.file, clspkg);
        expr = oCls.Expr.value;

        rs.push(`'${clas}': (${expr})`);    // 'class' : (expr)
    }

    return '{' + rs.join(',') + '}';
}
