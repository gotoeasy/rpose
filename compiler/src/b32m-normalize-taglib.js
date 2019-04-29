const bus = require('@gotoeasy/bus');

// 解析单个taglib定义，转换为对象形式方便读取
bus.on('normalize-taglib', function(){

    return function normalizeTaglib(taglib, offset=0){

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
            // 无效的taglib格式
            return null;
        }

        return { line: offset, astag, pkg, tag, taglib: astag+'='+pkg+':'+tag };
    }


}());




