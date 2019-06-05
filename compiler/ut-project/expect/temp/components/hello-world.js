// --------------------------------------------------------------------------------------
// 组件 HelloWorld
// 注:应通过rpose.newComponentProxy方法创建组件代理对象后使用，而不是直接创建
// --------------------------------------------------------------------------------------
class HelloWorld {
    // 简化的使用一个私有属性存放内部数据
    #private = {
        // 可更新的state属性，未定义则不支持外部更新state
        statekeys: ["name", "$SLOT"],

        // 组件默认选项值
        options: {},
        // 组件默认数据状态值
        state: {}
    };

    // 构造方法
    constructor(options = {}) {
        rpose.extend(this.#private.state, options, this.#private.statekeys); // 保存数据（按克隆方式复制以避免外部修改影响）

        this.render = this.render.bind(this);
    }

    // 取得组件对象的数据状态副本
    getState() {
        return rpose.extend({}, this.#private.state, this.#private.statekeys); // 取得克隆的数据状态副本以避免外部修改影响
    }
    setState(state) {
        rpose.extend(this.#private.state, state, this.#private.statekeys); // 先保存数据（按克隆方式复制以避免外部修改影响）
        this.render(state); // 再渲染视图
    }

    // 默认渲染方法
    render(state) {
        let el,
            $$el,
            vnode,
            $this = this,
            $private = this.#private;

        // 首次渲染
        if (!$private.rendered) {
            vnode = $this.vnodeTemplate($private.state, $private.options); // 生成节点信息数据用于组件渲染
            el = rpose.createDom(vnode, $this);
            if (el && el.nodeType == 1) {
                $$(el).addClass($this.$COMPONENT_ID);
            }
            $private.rendered = true;
            return el;
        }

        // 再次渲染
        $$el = $$("." + $this.$COMPONENT_ID);
        if ($$el.length) {
            vnode = $this.vnodeTemplate($private.state, $private.options); // 生成新的虚拟节点数据
            rpose.diffRender($this, vnode); // 差异渲染
            return $$el[0];
        } else {
            console.warn("dom node missing"); // 组件根节点丢失无法再次渲染
        }
    }

    // 虚拟节点数据
    vnodeTemplate($state, $options) {
        let name = $state.name;
        return {
            t: "div",
            r: 1,
            k: 2,
            c: [
                {
                    s: "hello " + name + "!",
                    k: 1
                }
            ]
        };
    }
}
