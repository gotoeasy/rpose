// ---------------------------
// 前端路由
// ---------------------------
const Router = ((BUS)=>{
    let historyApi = history && history.pushState;                                  // 判断是否不支持historyApi

    let routes = [];                                                                // 本页除notfound以外的全部路由，可能异步注册或按需注册
    let notfoundRoutes = [];                                                        // 404页
    let defaultRoutes = [];                                                         // 默认页
    let activeRoutes = [];                                                          // 当前活动路由

    let ignoreHashchange;                                                           // 是否忽略hashchange事件

    // 安装路由事件
    let fnLocationChange = e => BUS.at('router.locationchange', e);
    let eventname = historyApi ? 'popstate' : 'hashchange';
	window.addEventListener ? window.addEventListener(eventname, fnLocationChange, false) : window.attachEvent("on" + eventname, fnLocationChange);

    // 期初显示，window.onload时按指定路由显示
    BUS.on('window.onload', e => {
        let path = location.hash ? location.hash.substring(1) : '', useDefault = 1;
        route({path, useDefault}) && replace({path, state:{useDefault}});           // 地址+默认页，初期显示不支持参数，实际使用了默认页时修改地址避免唐突
    });

    // 路由地址变化时，显示指定路由
    let locationchange;
    if ( historyApi ) {
        locationchange = e => {
            let path = location.hash ? location.hash.substring(1) : '';
            let state = e.state;
            let useDefault = state ? state.useDefault : 0;
            useDefault ? route({path, useDefault}) : route({path, state});          // 地址+参数，无默认页
        };
    }else{
        locationchange = e => {
            if ( !ignoreHashchange ) {
                let hash = location.hash ? location.hash.substring(1) : '';
                let idx = hash.indexOf('?');
                if ( idx >= 0 ) {
                    let path = hash.substring(0, idx);
                    let key = hash.substring(idx+1);
                    let ctx = sessionStorage.getItem(key);
                    if ( ctx != null ) {
                        ctx = JSON.parse(ctx);
                        if ( ctx.path != path ) {
                            route({path: hash});                                    // 参数有误，直接切换路由（结果应该是404）
                        }else{
                            if ( ctx.state && ctx.state.useDefault ) {
                                route({path, useDefault: 1});                       // 默认页切换
                            }else{
                                route(ctx);                                         // 参数正确，正常切换路由
                            }
                        }
                    }else{
                        route({path: hash});                                        // 参数有误，直接切换路由（结果应该是404）
                    }
               }else{
                    route({path: hash});                                            // 无参数，直接切换路由
               }
            }
        };
    }
    BUS.on('router.locationchange', locationchange);

    // 路由注册
    let register = route => {
        if ( route.notfound ) {
            notfoundRoutes.push(route);                                             // 404页
        }else{
            route.path == null && (route.path = '');                                // 路径没填时默认为空串
            routes.push(route);                                                     // 指定页
        }
        route.default && defaultRoutes.push(route);                                 // 默认页
    };

    // 路由匹配器 （通配符*代表任意）
    let match = (pattern, path) => {
        return pattern.indexOf('*') < 0 ? (pattern == path) : patternToRegExp(pattern).test(path);
    };

    let patternToRegExp = pattern => {
        let reg = pattern.replace(/[\^\$\.\+\-\=\!\(\)\[\]\{\}\/\?]{1}/g, ch => ('\\' + ch) );        
        reg = reg.replace(/\*+/g, '.*');	// 单个或连续多个星号，代表任意字符
        return new RegExp('^' + reg + '$');
    }

    // 单纯路由跳转，历史记录无关，通常当地址变化时调用
    let route = (ctx) => {
        let useDefault;
        if ( routes.length ) {
            let nextRoutes = [];
            routes.forEach(rt => match(rt.path, ctx.path) && nextRoutes.push(rt));  // 找出匹配的待显示路由

            // 找不到路由时，如果指定使用默认路由且存在默认路由时，使用默认路由
            if ( !nextRoutes.length && ctx.useDefault && defaultRoutes.length ) {
                nextRoutes = defaultRoutes;                                         // 初期显示输入错误路由时，可指定默认路由，比如首页，避免404
                useDefault = 1;
            }

            if ( nextRoutes.length ) {
                // 正常找到
                notfoundRoutes.forEach(rt => rt.component.setState({active:0}));    // 隐藏404页
                activeRoutes.forEach(rt => rt.component.setState({active:0}));      // 隐藏当前页
                nextRoutes.forEach(rt => rt.component.route(ctx));                  // 显示指定页
                activeRoutes = nextRoutes;                                          // 保存活动路由
            }else{
                // 无效的地址
                activeRoutes.forEach(rt => rt.component.setState({active:0}));      // 隐藏当前页
                notfoundRoutes.forEach(rt => rt.component.route(ctx));              // 显示404页
            }
        }else{
            notfoundRoutes.forEach(rt => rt.component.route());                     // 如果有404页则显示，漏配置路由，或配置了路由但不能及时注册，总之很奇怪
        }

        BUS.at('router.onroute', ctx);
        return useDefault;
    };

    let push = (ctx) => {
        if ( historyApi ) {
            history.pushState(ctx.state, ctx.title, '#' + ctx.path);                // 路由地址不一致时，添加历史记录
        }else{
            ignoreHashchange = true;
            if ( ctx.state == null ) {
                location.hash = ctx.path;                                           // 无参数，直接添加历史记录
            }else{
                let jsonStr = JSON.stringify(ctx);
                let key = hashString(jsonStr);
                sessionStorage.setItem(key, jsonStr);
                location.hash = ctx.path + '?' + key                                // 有参数，拼接哈希参数后添加历史记录
            }
            setTimeout(()=>ignoreHashchange = false)
        }
    };

    let replace = (ctx) => {
        if ( historyApi ) {
            history.replaceState(ctx.state, ctx.title, '#' + ctx.path);             // 替换当前历史记录
        }else{
            if ( ctx.state == null ) {
                location.replace('#' + ctx.path);                                   // 无参数，直接替换当前历史记录
            }else{
                let jsonStr = JSON.stringify(ctx);
                let key = hashString(jsonStr);
                sessionStorage.setItem(key, jsonStr);
                location.replace('#' + ctx.path + '?' + key);                       // 有参数，拼接哈希参数后替换当前历史记录
            }
        }
    };

    let url = (url) => {
        location.href = url;                                                        // 页面跳转
    };

    // 添加历史 & 激活页面
    let page = ctx => {
        if ( /^http[s]?:/i.test(ctx.path) ) return url(ctx.path);                   // 以http[s]:开头时直接跳转页面
        push(ctx) > route(ctx);                                                     // 添加历史 & 激活页面
    }

    let hashString = str => {
        let rs = 53653, i = str.length;
        while ( i ) {
            rs = (rs * 33) ^ str.charCodeAt(--i);
        }
        return (rs >>> 0).toString(36);
    }

    return {register, page, route, push, replace, url};
})(BUS);
