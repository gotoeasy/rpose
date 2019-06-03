const bus = require('@gotoeasy/bus');

// 模板
class ClsTemplate{
    constructor(tmpl='', argNm) {
        // 模板解析函数（代码数组，模板，前一句是否JS代码）
        let fnParse = function(ary, tmpl, isPreCode){
            let tmp, idx = tmpl.indexOf('<%');
            if ( idx < 0 ){
                // Text
                ary.push(fnText(ary, tmpl, isPreCode)); // 保存解析结果
            } else if ( idx == 0 ){
                if (tmpl.indexOf('<%=') == idx){
                    // Value
                    tmpl = tmpl.substring(3);
                    idx = tmpl.indexOf('%>');
                    tmp = tmpl.substring(0, idx);

                    ary.push(ary.pop() + "+" + tmp); // 保存解析结果
                    fnParse(ary, tmpl.substring(idx+2), false); // 剩余继续解析
                } else {
                    // Code
                    tmpl = tmpl.substring(2);
                    idx = tmpl.indexOf('%>');
                    tmp = tmpl.substring(0, idx);

                    isPreCode ? ary.push(tmp) : (ary.push(ary.pop() +';') && ary.push(tmp)); // 保存解析结果
                    fnParse(ary, tmpl.substring(idx+2), true); // 剩余继续解析
                }

            } else {
                // 取出左边Text
                tmp = tmpl.substring(0, idx);
                ary.push(fnText(ary, tmp, isPreCode)) // 保存解析结果
                fnParse(ary, tmpl.substring(idx), false); // 剩余继续解析
            }
        }
        // 字符串拼接转义函数
        let fnText = function(ary, txt, isPreCode){
            let str = txt.replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/'/g, "\\'");
            return isPreCode? ("s+='" + str + "'") : (ary.pop() + "+'" + str + "'");
        }

        // 创建动态函数toString，使用例子：new Template('Hello <%= data.name %>', 'data').toString({size:20}, {name:'world'})
        let aryBody = [];
        aryBody.push("let s=''")
        fnParse(aryBody, tmpl, true); // 代码数组=aryBody，模板=tmpl，前一句是否JS代码=true
        aryBody.push("return s");
        this.toString = argNm ? new Function(argNm, aryBody.join("\n") ) : new Function(aryBody.join("\n"));
    }
}

bus.on('编译模板JS', function(result){

    return function () {
        if ( !result ) {
            let tmpl = getSrcTemplate().replace(/\\/g, "\\\\");
            let clsTemplate = new ClsTemplate(tmpl, '$data');
            result = clsTemplate.toString;
        }

        return result;
    };

}());




function getSrcTemplate() {
    return `
// --------------------------------------------------------------------------------------
// 组件 <%= $data['COMPONENT_NAME'] %>
// 注:应通过rpose.newComponentProxy方法创建组件代理对象后使用，而不是直接创建
// --------------------------------------------------------------------------------------
class <%= $data['COMPONENT_NAME'] %> {

    // 简化的使用一个私有属性存放内部数据
    #private = {
        <% if ( $data['optionkeys'] ) {%>
        // 可通过标签配置的属性，未定义则不支持外部配置
        optionkeys: <%= JSON.stringify($data['optionkeys']) %>,
        <% }  if ( $data['statekeys'] ) { %>
        // 可更新的state属性，未定义则不支持外部更新state
        statekeys: <%= JSON.stringify($data['statekeys']) %>,
        <% } %>

        // 组件默认选项值
        options: <%= $data['options'] %>,
        // 组件默认数据状态值
        state: <%= $data['state'] %>,
    };

    <% if ( $data['optionkeys'] || $data['statekeys'] || $data['bindfns'] ){ %>
    // 构造方法
    constructor(options={}) {
        <% if ( $data['optionkeys'] ){ %>
        rpose.extend(this.#private.options, options, this.#private.optionkeys);     // 保存属性（按克隆方式复制以避免外部修改影响）
        <% } %>
        <% if ( $data['statekeys'] ){ %>
        rpose.extend(this.#private.state, options, this.#private.statekeys);        // 保存数据（按克隆方式复制以避免外部修改影响）
        <% } %>
        <% 
            let methods = $data['bindfns'] || [];                                   // 类中定义的待bind(this)的方法，属性方法已转换为箭头函数，不必处理
            !methods.includes('render') && methods.push('render');                  // 默认自带 render
            methods.sort();
            for ( let i=0,method; method=methods[i++]; ) {                          // 遍历方法做bind(this)
        %>
            this.<%=method%> = this.<%=method%>.bind(this);
        <% } %>
    }
    <% } %>

    // 取得组件对象的数据状态副本
    getState(){
        return rpose.extend({}, this.#private.state, this.#private.statekeys);      // 取得克隆的数据状态副本以避免外部修改影响
    }
    setState(state){
        rpose.extend(this.#private.state, state, this.#private.statekeys);          // 先保存数据（按克隆方式复制以避免外部修改影响）
        this.render(state);                                                         // 再渲染视图
    }

    
    <% if ( !($data['Method'] || {})['render'] ){ %>
    // 默认渲染方法
    render (state){
        let el, $$el, vnode, $this = this, $private = this.#private;

        // 首次渲染
        if ( !$private.rendered ){
            vnode = $this.vnodeTemplate($private.state, $private.options);          // 生成节点信息数据用于组件渲染
            el = rpose.createDom(vnode, $this);
            if ( el && el.nodeType == 1 ) {
                $$(el).addClass($this.$COMPONENT_ID);
            } 
            $private.rendered = true;
            return el;
        }

        // 再次渲染
        if ( typeof $this.$render === 'function' ){
            return $this.$render($private.state);                                     // 有定义方法‘$render’时调用其渲染视图（用于替代默认渲染逻辑提高性能）                                
        }

        $$el = $$('.' + $this.$COMPONENT_ID);
        if ( !$$el.length ){
            console.warn('dom node missing');                                        // 组件根节点丢失无法再次渲染
            return;
        }

        if ( !state ) {
            return;                                                                 // 没有新状态，不必处理
        }

        vnode = $this.vnodeTemplate($private.state, $private.options);              // 生成新的虚拟节点数据
        rpose.diffRender($this, vnode);                                                // 差异渲染

        return $$el[0];
    }
    <% } %>

    <% if ( $data['methods'] ){ %>
    // 自定义方法
    <%= $data['methods'] %>
    <% } %>

    // 虚拟节点数据
    <%= $data['vnodeTemplate'] %>
}
`;

}
