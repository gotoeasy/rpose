const bus = require('@gotoeasy/bus');

module.exports = bus.on('视图编译选项', function (options={}, init){

    // 模板开始结束符
    options.CodeBlockStart = '{%';
    options.CodeBlockEnd = '%}';
    options.ExpressionStart = '{';
    options.ExpressionEnd = '}';

    // 词素类型
    options.TypeHtmlComment = 'HtmlComment';
    options.TypeCodeBlock = 'JsCode';
    options.TypeExpression = 'Expression';
    options.TypeTagOpen = 'TagOpen';
    options.TypeTagClose = 'TagClose';
    options.TypeTagSelfClose = 'TagSelfClose';
    options.TypeAttributeName = 'AttributeName';
    options.TypeAttributeValue = 'AttributeValue';
    options.TypeEqual = '=';
    options.TypeText = 'Text';
  //  options.TypeCData = 'CData'; // AS Text
    
    return function(opts){

        if ( !init && opts ) {
            init = true; // 选项配置仅允许初始化一次

            // 代码块
            options.CodeBlockStart = opts.CodeBlockStart || options.CodeBlockStart;
            options.CodeBlockEnd = opts.CodeBlockEnd || options.CodeBlockEnd;
            // 表达式
            options.ExpressionStart = opts.ExpressionStart || options.ExpressionStart;
            options.ExpressionEnd = opts.ExpressionEnd || options.ExpressionEnd;

            // 词素类型
            options.TypeHtmlComment = opts.TypeHtmlComment || options.TypeHtmlComment;
            options.TypeCodeBlock = opts.TypeCodeBlock || options.TypeCodeBlock;
            options.TypeExpression = opts.TypeExpression || options.TypeExpression;
            options.TypeTagOpen = opts.TypeTagOpen || options.TypeTagOpen;
            options.TypeTagClose = opts.TypeTagClose || options.TypeTagClose;
            options.TypeTagSelfClose = opts.TypeTagSelfClose || options.TypeTagSelfClose;
            options.TypeAttributeName = opts.TypeAttributeName || options.TypeAttributeName;
            options.TypeAttributeValue = opts.TypeAttributeValue || options.TypeAttributeValue;
            options.TypeEqual = opts.TypeEqual || options.TypeEqual;
            options.TypeText = opts.TypeText || options.TypeText;
        }

        return options;
    }

}());
