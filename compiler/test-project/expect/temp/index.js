// ------------------------------------------------------------------------------------------------------
// 组件 Index
// 注:应通过rpose.newComponentProxy方法创建组件代理对象后使用，而不是直接调用方法或用new创建
// ------------------------------------------------------------------------------------------------------

// 属性接口定义
Index.prototype.$OPTION_KEYS = undefined; // 可通过标签配置的属性，未定义则不支持外部配置
Index.prototype.$STATE_KEYS = ["$SLOT"]; // 可更新的state属性，未定义则不支持外部更新state

// 组件函数
function Index(options = {}) {
    // 组件默认选项值
    this.$options = {};

    // 组件默认数据状态值
    this.$state = {};
    rpose.extend(this.$state, options, this.$STATE_KEYS); // 按属性接口克隆数据状态
}

/**
 * 节点模板函数
 */
Index.prototype.nodeTemplate = function nodeTemplate($state, $options, $actions, $this) {
    return {
        t: "bs-primary-button",
        r: 1,
        m: 1,
        k: 1
    };
};
