const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    return postobject.plugin(__filename, function(root, context){

        const OPTS = bus.at('视图编译选项');

        // TODO 用选项常量
        root.walk( /^(Text|Expression)$/, (node, object) => {

            // 合并连续的文本节点
            let ary = [node];
            let nAfter = node.after();
            while ( nAfter && (nAfter.type === OPTS.TypeText || nAfter.type === OPTS.TypeExpression) ) {
                ary.push(nAfter);
                nAfter = nAfter.after();
            }

            if ( ary.length < 2 ) return;

            let aryRs = [], tmp;
            ary.forEach(nd => {
                if ( nd.type === OPTS.TypeText ) {
                    aryRs.push('"' + lineString(nd.object.value) + '"');
                }else {
                    aryRs.push( nd.object.value.replace(/^\s*\{/, '(').replace(/\}\s*$/, ')') );
                }
            });

            let value = OPTS.ExpressionStart + aryRs.join(' + ') + OPTS.ExpressionEnd;
            let start = ary[0].object.loc.start;
            let end = ary[ary.length-1].object.loc.end;
            let loc = {start, end};
            let tNode = this.createNode({type: OPTS.TypeExpression, value, loc});
            node.before(tNode);
            ary.forEach(nd => nd.remove());
        });

    });

}());


function lineString(str, quote = '"') {
    if ( str == null ) {
        return str;
    }

    let rs = str.replace(/\\/g, '\\\\').replace(/\r/g, '\\r').replace(/\n/g, '\\n')
//    let rs = str.replace(/\r/g, '\\r').replace(/\n/g, '\\n')
    if ( quote == '"' ) {
        rs = rs.replace(/"/g, '\\"');
    }else if ( quote == "'" ) {
        rs = rs.replace(/'/g, "\\'");
    }
    return rs;
}

