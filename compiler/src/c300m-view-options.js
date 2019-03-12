const bus = require('@gotoeasy/bus');

module.exports = bus.on('视图编译选项', function (options={}, init){

    // 模板开始结束符
    options.CodeBlockStart = '{%';
    options.CodeBlockEnd = '%}';
    options.ExpressionStart = '{';
    options.ExpressionEnd = '}';
    options.ExpressionUnescapeStart = '{=';
    options.ExpressionUnescapeEnd = '}';

    // 词素类型
    options.TypeHtmlComment = 'HtmlComment';
    options.TypeCodeBlock = 'JsCode';
    options.TypeEscapeExpression = 'EscapeExpression';
    options.TypeUnescapeExpression = 'UnescapeExpression';
    options.TypeTagOpen = 'TagOpen';
    options.TypeTagClose = 'TagClose';
    options.TypeTagSelfClose = 'TagSelfClose';
    options.TypeAttributeName = 'AttributeName';
    options.TypeAttributeValue = 'AttributeValue';
    options.TypeEqual = '=';
    options.TypeText = 'Text';
    //options.TypeCData = 'CData'; // AS Text
    
    // 词素类型
    options.AutoCloseTags = 'br,hr,input,img,meta,link,area,base,col,command,embed,keygen,param,srouce,trace,wbr'.split(',');

    // 生成代码的函数名
    options.NameFnEscapeHtml = 'escapeHtml'; // 转义函数名

    return function(opts){

        if ( !init && opts ) {
            init = true; // 选项配置仅允许初始化一次

            // 代码块
            options.CodeBlockStart = opts.CodeBlockStart || options.CodeBlockStart;
            options.CodeBlockEnd = opts.CodeBlockEnd || options.CodeBlockEnd;
            // 转义表达式
            options.ExpressionStart = opts.ExpressionStart || options.ExpressionStart;
            options.ExpressionEnd = opts.ExpressionEnd || options.ExpressionEnd;
            // 无转义表达式
            options.ExpressionUnescapeStart = opts.ExpressionUnescapeStart || options.ExpressionUnescapeStart;
            options.ExpressionUnescapeEnd = opts.ExpressionUnescapeEnd || options.ExpressionUnescapeEnd;

            // 词素类型
            options.TypeHtmlComment = opts.TypeHtmlComment || options.TypeHtmlComment;
            options.TypeCodeBlock = opts.TypeCodeBlock || options.TypeCodeBlock;
            options.TypeEscapeExpression = opts.TypeEscapeExpression || options.TypeEscapeExpression;
            options.TypeUnescapeExpression = opts.TypeUnescapeExpression || options.TypeUnescapeExpression;
            options.TypeTagOpen = opts.TypeTagOpen || options.TypeTagOpen;
            options.TypeTagClose = opts.TypeTagClose || options.TypeTagClose;
            options.TypeTagSelfClose = opts.TypeTagSelfClose || options.TypeTagSelfClose;
            options.TypeAttributeName = opts.TypeAttributeName || options.TypeAttributeName;
            options.TypeAttributeValue = opts.TypeAttributeValue || options.TypeAttributeValue;
            options.TypeEqual = opts.TypeEqual || options.TypeEqual;
            options.TypeText = opts.TypeText || options.TypeText;

            // 自闭合标签
            if ( Array.isArray(opts.AutoCloseTags) || opts.AutoCloseTags instanceof Array  ) {
                opts.AutoCloseTags.forEach(nm => {
                    if ( !options.AutoCloseTags.includes(nm.trim().toLowerCase()) ) {
                        options.AutoCloseTags.push(nm.trim().toLowerCase());
                    }
                });
            }

            // 生成代码的函数名
            options.NameFnEscapeHtml = opts.NameFnEscapeHtml || options.NameFnEscapeHtml;

        }

        return options;
    }

}());
