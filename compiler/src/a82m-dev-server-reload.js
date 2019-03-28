const bus = require('@gotoeasy/bus');
const File = require('@gotoeasy/file');
const hash = require('@gotoeasy/hash');
const fs = require('fs');
const url = require('url');
const path = require('path');
const http = require('http');
const opn = require('opn');

// -----------------------------------------------------------------------
// 某日，browser-sync启动及刷新竟然要数分钟
// 原因或是众所周知的网络问题，或是不得而知的版本依赖问题
// 总之，无心花精力细查解决它，不得已先来个简陋实现，毕竟需求非常简单
//
// 此服务器只在watch模式下才开启
//
// 1）以dist目录为根目录建立服务器，处理响应文件请求
// 2）服务器添加文件是否变更的查询接口
// 3）html文件请求做特殊处理，注入客户端脚本，脚本中包含页面id和哈希码
// 4）客户端脚本每隔1秒请求服务器查询当前页是否有变更，有改变则刷新
// 5）服务器启动后，间隔一秒看有无请求，没有才打开浏览器访问，避免开一堆窗口
// -----------------------------------------------------------------------
bus.on('热刷新服务器', function (hasQuery){

    return function(){
        let env = bus.at('编译环境');
        if ( !env.watch ) return;

        createHttpServer(env.path.build_dist, 3700);
    }

    // 查询
    function queryHandle(req, res, oUrl){
        hasQuery = true;
        let env = bus.at('编译环境');
        let htmlpage = oUrl.query.split('&')[0].split('=')[1];
        let srcFile = File.resolve(env.path.src, htmlpage.substring(0, htmlpage.length-5) + '.rpose');

        let hashcode = '';
        let context = bus.at('组件编译缓存', srcFile);
        if ( context ) {
            hashcode = context.result.hashcode || '';
            if ( !hashcode ) {
                let fileHtml = bus.at('页面目标HTML文件名', srcFile);
                let fileCss = bus.at('页面目标CSS文件名', srcFile);
                let fileJs = bus.at('页面目标JS文件名', srcFile);
                hashcode = hash(File.read(fileHtml) + File.read(fileCss) + File.read(fileJs));  // 确保有值返回避免两次刷新
            }
        }

        res.writeHead(200);
        res.end(hashcode);                                                                      // 文件找不到或未成功编译时，返回空白串
    }

    // html注入脚本
    function htmlHandle(req, res, oUrl, htmlfile){

        let env = bus.at('编译环境');
        let srcFile = File.resolve(env.path.src, htmlfile.substring(env.path.build_dist.length+1, htmlfile.length-5) + '.rpose');
        let context = bus.at('组件编译缓存', srcFile);
        let hashcode = context ? (context.result.hashcode || '') : null;
        if ( !hashcode ) {
            let fileHtml = bus.at('页面目标HTML文件名', srcFile);
            let fileCss = bus.at('页面目标CSS文件名', srcFile);
            let fileJs = bus.at('页面目标JS文件名', srcFile);
            hashcode = hash(File.read(fileHtml) + File.read(fileCss) + File.read(fileJs));      // 确保有值返回避免两次刷新
        }
        let htmlpage = htmlfile.substring(env.path.build_dist.length+1);

        let script = `
        <script>
            function refresh() {
                let url = '/query?page=${htmlpage}&t=' + new Date().getTime();
                ajaxAsync(url, function(rs){
                    if ( rs !== '${hashcode}' ) {
                        location.reload();
                    }else{
                        setTimeout(refresh, 1000);
                    }
                }, function(err){
                    setTimeout(refresh, 1000);
                });
            }

            function ajaxAsync(url, fnCallback, fnError) {
                var xhr = new XMLHttpRequest();
                xhr.onreadystatechange = function (xxx, eee) {
                    if (xhr.readyState === 4 && xhr.status === 200) {
                        fnCallback(xhr.responseText);
                    }
                };
                xhr.onerror = fnError;
                xhr.open("GET", url, true);
                xhr.send();
            }

            setTimeout(refresh, 3000);
        </script>`;

    //console.log('200 ' + req.url);
        let html = File.read(htmlfile).replace(/<head>/i, '<head>' + script);                   // 极简实现，注入脚本，定时轮询服务端
        res.writeHead(200, {'Content-Type': 'text/html;charset=UFT8'});
        res.end(html);
    }


    // 创建服务器
    function createHttpServer(www, port){

        let server = http.createServer(function (req, res) {
            let oUrl = url.parse(req.url);

           if ( /^\/query$/i.test(oUrl.pathname) ) {
                queryHandle(req, res, oUrl);                                                    // 查询页面哈希码
                return;
            }

            let reqfile = path.join(www, oUrl.pathname);
            if ( File.existsDir(reqfile) ) {
                reqfile = File.resolve(reqfile, 'index.html');                                  // 默认访问目录下的index.html
            }

            if ( /\.html$/i.test(reqfile) ) {
                if ( File.existsFile(reqfile) ) {
                    htmlHandle(req, res, oUrl, reqfile);                                        // html文件存在时，拦截注入脚本后返回
                }else{
                    res.writeHead(404);
                    res.end('404 Not Found');                                                   // 文件找不到
                }
                return;
            }


            if ( File.existsFile(reqfile) ) {
                if ( /\.css$/i.test(reqfile) ) {
                    res.writeHead(200, {'Content-Type': 'text/css;charset=UFT8'});              // 避免浏览器控制台警告
                }else{
                    res.writeHead(200);
                }
                fs.createReadStream(reqfile).pipe(res);                                         // 非html文件，直接输出文件流
            }else{
                if ( /favicon\.ico$/i.test(reqfile) ) {
                    res.writeHead(200);                                                         // 避免浏览器控制台警告
                    res.end(null);
                }else{
                    res.writeHead(404);
                    res.end('404 Not Found');                                                   // 文件找不到
                }
            }

        });

        server.listen(port);
        let hostUrl = 'http://localhost:' + port;
        console.info('server ready ...... http://127.0.0.1:' + port);

        setTimeout(() => {
            !hasQuery && opn(hostUrl);                                                          // 等1秒钟还是没有请求的话，新开浏览器
        }, 1000);
    }


}());

