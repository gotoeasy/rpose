console.time("load");
/* ------- a00m-env ------- */
(() => {
    // ------- a00m-env start
    const File = require("@gotoeasy/file");
    const Btf = require("@gotoeasy/btf");
    const bus = require("@gotoeasy/bus");
    const util = require("@gotoeasy/util");
    const Err = require("@gotoeasy/err");
    const npm = require("@gotoeasy/npm");
    const path = require("path");

    // 从根目录的rpose.config.btf读取路径文件配置
    // 读不到则使用默认配置
    bus.on(
        "编译环境",
        (function(result) {
            return function(opts, nocache = false) {
                nocache && (result = null);
                if (result) return result;

                let packagefile = File.resolve(__dirname, "./package.json");
                !File.existsFile(packagefile) && (packagefile = File.resolve(__dirname, "../package.json"));
                let compilerVersion = JSON.parse(File.read(packagefile)).version;
                let defaultFile = File.path(packagefile) + "/default.rpose.config.btf";

                result = parseRposeConfigBtf("rpose.config.btf", defaultFile, opts); // 相对命令行目录

                result.clean = !!opts.clean;
                result.release = !!opts.release;
                result.debug = !!opts.debug;
                result.nocache = !!opts.nocache;
                result.build = !!opts.build;
                result.watch = !!opts.watch;

                result.compilerVersion = compilerVersion;
                if (result.path.cache) {
                    result.path.cache = File.resolve(result.path.cwd, result.path.cache); // 缓存目录
                }

                return result;
            };
        })()
    );

    function parseRposeConfigBtf(file, defaultFile, opts) {
        let cwd = opts.cwd || process.cwd();
        cwd = path.resolve(cwd).replace(/\\/g, "/");
        if (!File.existsDir(cwd)) {
            throw new Err("invalid path of cwd: " + opts.cwd);
        }

        let root = cwd;
        file = File.resolve(root, file);
        if (!File.exists(file)) file = defaultFile;

        let result = { path: {} };

        // 项目配置文件
        let btf = new Btf(file);
        let mapPath = btf.getMap("path");
        mapPath.forEach((v, k) => mapPath.set(k, v.split("//")[0].trim()));

        let mapImport = btf.getMap("taglib");
        let imports = {};
        mapImport.forEach((v, k) => (imports[k] = v.split("//")[0].trim()));
        result.imports = imports;

        // 目录
        result.path.cwd = cwd;
        result.path.root = root;
        result.path.src = root + "/src";

        result.path.build = getConfPath(root, mapPath, "build", "build");
        result.path.build_temp = result.path.build + "/temp";
        result.path.build_dist = result.path.build + "/dist";
        result.path.build_dist_images = mapPath.get("build_dist_images") || "images"; // 打包后的图片目录
        result.path.cache = mapPath.get("cache"); // 缓存大目录

        result.theme = btf.getText("theme") == null || !btf.getText("theme").trim() ? "@gotoeasy/theme" : btf.getText("theme").trim();
        result.prerender =
            btf.getText("prerender") == null || !btf.getText("prerender").trim() ? "@gotoeasy/pre-render" : btf.getText("prerender").trim();

        // 自动检查安装依赖包
        autoInstallLocalModules(result.theme, result.prerender);

        return result;
    }

    function getConfPath(root, map, key, defaultValue) {
        // TODO 检查配置目录的合法性
        if (!map.get(key)) {
            return (
                root +
                "/" +
                defaultValue
                    .split("/")
                    .filter(v => !!v)
                    .join("/")
            );
        }
        return (
            root +
            "/" +
            map
                .get(key)
                .split("/")
                .filter(v => !!v)
                .join("/")
        );
    }

    // TODO 提高性能
    function autoInstallLocalModules(...names) {
        let ignores = ["@gotoeasy/theme", "@gotoeasy/pre-render"];

        let node_modules = [
            ...require("find-node-modules")({ cwd: __dirname, relative: false }),
            ...require("find-node-modules")({ cwd: process.cwd(), relative: false })
        ];

        for (let i = 0, name; (name = names[i++]); ) {
            if (ignores.includes(name)) continue;

            let isInstalled = false;
            for (let j = 0, dir; (dir = node_modules[j++]); ) {
                if (File.isDirectoryExists(File.resolve(dir, name))) {
                    isInstalled = true;
                    continue;
                }
            }
            !isInstalled && npm.install(name);
        }
    }
    // ------- a00m-env end
})();

/* ------- a02m-clean ------- */
(() => {
    // ------- a02m-clean start
    const Err = require("@gotoeasy/err");
    const File = require("@gotoeasy/file");
    const bus = require("@gotoeasy/bus");

    bus.on(
        "clean",
        (function() {
            return () => {
                try {
                    let env = bus.at("编译环境");
                    if (env.clean) {
                        File.remove(env.path.build);
                        console.info("clean:", env.path.build);
                    }

                    File.mkdir(env.path.build_dist);
                } catch (e) {
                    throw Err.cat(" clean failed", e);
                }
            };
        })()
    );

    // ------- a02m-clean end
})();

/* ------- a10m-cache ------- */
(() => {
    // ------- a10m-cache start
    const bus = require("@gotoeasy/bus");
    const cache = require("@gotoeasy/cache");
    const csslibify = require("csslibify");

    (function(result = {}, oCache, resourcesPaths) {
        bus.on("清除全部编译缓存", function() {
            result = {};
            oCache = null;
            resourcesPaths = null;
        });

        bus.on("组件编译缓存", function(file, context) {
            if (context) {
                result[file] = context;
                return context;
            }

            if (context === undefined) {
                return result[file];
            }

            delete result[file];
        });

        bus.on("缓存", function() {
            if (!oCache) {
                let env = bus.at("编译环境");
                oCache = cache({ name: "rpose-compiler-" + env.compilerVersion, path: env.path.cache });
            }
            return oCache;
        });

        bus.on("缓存资源目录数组", function() {
            if (!resourcesPaths) {
                resourcesPaths = [bus.at("缓存").path + "/resources", csslibify().basePath]; // 编译器缓存及样式库缓存的resources目录的绝对路径
            }
            return resourcesPaths;
        });
    })();

    // ------- a10m-cache end
})();

/* ------- a20m-src-file-manager ------- */
(() => {
    // ------- a20m-src-file-manager start
    const bus = require("@gotoeasy/bus");
    const os = require("@gotoeasy/os");
    const hash = require("@gotoeasy/hash");
    const File = require("@gotoeasy/file");

    (function(oFiles, oTagFiles = {}) {
        function getSrcFileObject(file, tag) {
            let text = File.read(file);
            let hashcode = hash(text);
            return { file, text, hashcode, tag };
        }

        // 项目范围内，取标签相关的页面源文件
        function getRefPages(tag) {
            if (!tag) return [];

            let refFiles = [];
            for (let file in oFiles) {
                let context = bus.at("组件编译缓存", file);
                if (context) {
                    let allreferences = context.result.allreferences || [];
                    allreferences.includes(tag) && refFiles.push(file);
                }
            }

            return refFiles;
        }

        bus.on("标签项目源文件", function(tag) {
            let ary = oTagFiles[tag];
            if (ary && ary.length) {
                return ary[0];
            }
            // 找不到时无视错误，返回undefined
        });

        bus.on("源文件对象清单", function(nocache = false) {
            if (nocache) {
                oFiles = null;
                oTagFiles = {};
            }

            if (!oFiles) {
                oFiles = {};
                let env = bus.at("编译环境");
                let files = File.files(env.path.src, "**.rpose"); // 源文件目录
                files.forEach(file => {
                    let tag = getTagOfSrcFile(file);
                    if (tag) {
                        let ary = (oTagFiles[tag] = oTagFiles[tag] || []);
                        ary.push(file);
                        if (ary.length === 1) {
                            oFiles[file] = getSrcFileObject(file, tag);
                        }
                    } else {
                        console.error("[src-file-manager]", "ignore invalid source file ..........", file); // 无效文件出警告
                    }
                });

                for (let tag in oTagFiles) {
                    let ary = oTagFiles[tag];
                    if (ary.length > 1) {
                        console.error("[src-file-manager]", "duplicate tag name:", tag); // 同名文件出警告
                        console.error(ary);
                        for (let i = 1, file; (file = ary[i++]); ) {
                            console.error("  ignore ..........", file);
                        }
                    }
                }
            }

            return oFiles;
        });

        bus.on("源文件添加", function(oFile) {
            let tag = getTagOfSrcFile(oFile.file);
            if (!tag) {
                return console.error("[src-file-manager]", "invalid source file name ..........", oFile.file); // 无效文件出警告
            }

            let ary = (oTagFiles[tag] = oTagFiles[tag] || []);
            ary.push(oFile.file);
            if (ary.length > 1) {
                console.error("[src-file-manager]", "duplicate tag name:", tag);
                console.error(ary);
                console.error("  ignore ..........", oFile.file);
                return;
            }

            oFiles[oFile.file] = getSrcFileObject(oFile.file, tag); // 第一个有效
            return bus.at("全部编译");
        });

        bus.on("源文件修改", function(oFileIn) {
            let tag = getTagOfSrcFile(oFileIn.file);
            let refFiles = getRefPages(tag); // 关联页面文件
            let oFile = oFiles[oFileIn.file];
            if (!tag || !oFile) {
                // 无关文件的修改，保险起见清理下
                delete oFiles[oFileIn.file];
                return;
            }
            if (oFile.hashcode === oFileIn.hashcode) return; // 文件内容没变，忽略

            // 保存输入，删除关联编译缓存，重新编译
            oFiles[oFile.file] = Object.assign({}, oFileIn);
            refFiles.forEach(file => {
                bus.at("组件编译缓存", file, false); // 删除关联页面的编译缓存
                writeInfoPage(file, `rebuilding for component [${tag}] changed`);
            });
            bus.at("组件编译缓存", oFile.file, false); // 删除当前文件的编译缓存
            return bus.at("全部编译");
        });

        bus.on("源文件删除", function(file) {
            let tag = getTagOfSrcFile(file);
            let refFiles = getRefPages(tag); // 关联页面文件
            let oFile = oFiles[file];
            let ary = oTagFiles[tag];

            // 删除输入
            delete oFiles[file];
            if (ary) {
                let idx = ary.indexOf(file);
                if (idx > 0) {
                    return ary.splice(idx, 1); // 删除的是被忽视的文件
                } else if (idx === 0) {
                    ary.splice(idx, 1);
                    if (ary.length) {
                        oFiles[ary[0]] = getSrcFileObject(ary[0], tag); // 添加次文件对象
                        bus.at("组件编译缓存", ary[0], false); // 不应该的事，保险起见清除该编译缓存
                    } else {
                        delete oTagFiles[tag];
                    }
                }
            }

            if (!tag || !oFile) return; // 无关文件的删除

            // 删除关联编译缓存，重新编译
            refFiles.forEach(file => {
                bus.at("组件编译缓存", file, false); // 删除关联页面的编译缓存
                writeInfoPage(file, `rebuilding for component [${tag}] removed`);
            });
            bus.at("组件编译缓存", oFile.file, false); // 删除当前文件的编译缓存
            return bus.at("全部编译");
        });
    })();

    // 取标签名，无效者undefined
    function getTagOfSrcFile(file) {
        let name = File.name(file);
        if (/[^a-zA-Z0-9_\-]/.test(name) || !/^[a-zA-Z]/.test(name)) {
            return;
        }
        return name.toLowerCase();
    }

    function writeInfoPage(file, msg) {
        let fileHtml = bus.at("页面目标HTML文件名", file);
        let fileCss = bus.at("页面目标CSS文件名", file);
        let fileJs = bus.at("页面目标JS文件名", file);

        if (File.existsFile(fileHtml)) {
            File.write(fileHtml, syncHtml(msg)); // html文件存在，可能正被访问，要替换
            File.remove(fileCss);
            File.remove(fileJs);
        }
    }

    // 在watch模式下，文件改变时，生成的html文件不删除，便于浏览器同步提示信息
    function syncHtml(msg = "") {
        return `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body>Page build failed or src file removed<p/>
        <pre style="background:#333;color:#ddd;padding:10px;">${msg.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
    </body>`;
    }

    // ------- a20m-src-file-manager end
})();

/* ------- a22m-file-watcher ------- */
(() => {
    // ------- a22m-file-watcher start
    const bus = require("@gotoeasy/bus");
    const os = require("@gotoeasy/os");
    const File = require("@gotoeasy/file");
    const Err = require("@gotoeasy/err");
    const hash = require("@gotoeasy/hash");
    const chokidar = require("chokidar");

    bus.on(
        "文件监视",
        (function(oHash = {}, hashBrowserslistrc, hashRposeconfigbtf) {
            return function() {
                let env = bus.at("编译环境");
                if (!env.watch) {
                    return;
                }

                bus.at("热刷新服务器");

                // 监视文件变化
                let browserslistrc = env.path.root + "/.browserslistrc";
                let rposeconfigbtf = env.path.root + "/rpose.config.btf";
                let ready,
                    watcher = chokidar.watch(env.path.root, { ignored: [env.path.build + "/", env.path.root + "/node_modules/"] });
                watcher
                    .on("add", async file => {
                        if (ready) {
                            file = file.replace(/\\/g, "/");

                            if (file === browserslistrc) {
                                // 配置文件 .browserslistrc 添加
                                let hashBrowserslistrc = hash(File.read(browserslistrc));
                                console.info("add ......", file);
                                bus.at("browserslist", true) > (await bus.at("重新编译全部页面")); // 重新查询目标浏览器，然后重新编译全部页面
                            } else if (file === rposeconfigbtf) {
                                // 配置文件 rpose.config.btf 修改
                                let hashRposeconfigbtf = hash(File.read(rposeconfigbtf));
                                console.info("add ......", file);
                                await bus.at("全部重新编译");
                            } else if (file.startsWith(bus.at("编译环境").path.src + "/") && /\.rpose$/i.test(file)) {
                                // 源文件添加
                                if (isValidRposeFile(file)) {
                                    console.info("add ......", file);
                                    let text = File.read(file);
                                    let hashcode = hash(text);
                                    let oFile = { file, text, hashcode };
                                    oHash[file] = oFile;
                                    await busAt("源文件添加", oFile);
                                } else {
                                    console.info("ignored ...... add", file);
                                }
                            }
                        }
                    })
                    .on("change", async file => {
                        if (ready) {
                            file = file.replace(/\\/g, "/");

                            if (file === browserslistrc) {
                                // 配置文件 .browserslistrc 修改
                                let hashcode = hash(File.read(browserslistrc));
                                if (hashBrowserslistrc !== hashcode) {
                                    console.info("change ......", file);
                                    bus.at("browserslist", true) > (await bus.at("重新编译全部页面")); // 重新查询目标浏览器，然后重新编译全部页面
                                }
                            } else if (file === rposeconfigbtf) {
                                // 配置文件 rpose.config.btf 修改
                                let hashcode = hash(File.read(rposeconfigbtf));
                                if (hashRposeconfigbtf !== hashcode) {
                                    hashRposeconfigbtf = hashcode;
                                    console.info("change ......", file);
                                    await bus.at("全部重新编译");
                                }
                            } else if (file.startsWith(bus.at("编译环境").path.src + "/") && /\.rpose$/i.test(file)) {
                                // 源文件修改
                                if (isValidRposeFile(file)) {
                                    let text = File.read(file);
                                    let hashcode = hash(text);
                                    if (!oHash[file] || oHash[file].hashcode !== hashcode) {
                                        console.info("change ......", file);
                                        let oFile = { file, text, hashcode };
                                        oHash[file] = oFile;
                                        await busAt("源文件修改", oFile);
                                    }
                                } else {
                                    console.info("ignored ...... change", file);
                                }
                            }
                        }
                    })
                    .on("unlink", async file => {
                        if (ready) {
                            file = file.replace(/\\/g, "/");

                            if (file === browserslistrc) {
                                // 配置文件 .browserslistrc 删除
                                let hashBrowserslistrc = null;
                                console.info("del ......", file);
                                bus.at("browserslist", true) > (await bus.at("重新编译全部页面")); // 重新查询目标浏览器，然后重新编译全部页面
                            } else if (file === rposeconfigbtf) {
                                // 配置文件 rpose.config.btf 删除
                                let hashRposeconfigbtf = null;
                                console.info("del ......", file);
                                await bus.at("全部重新编译");
                            } else if (file.startsWith(bus.at("编译环境").path.src + "/") && /\.rpose$/i.test(file)) {
                                // 源文件删除
                                if (/\.rpose$/i.test(file)) {
                                    if (isValidRposeFile(file)) {
                                        console.info("del ......", file);
                                        delete oHash[file];
                                        await busAt("源文件删除", file);
                                    } else {
                                        console.info("ignored ...... del", file);
                                    }
                                }
                            }
                        }
                    })
                    .on("ready", () => {
                        ready = true;
                    });
            };
        })()
    );

    async function busAt(name, ofile) {
        console.time("build");
        let promises = bus.at(name, ofile);
        if (promises) {
            for (let i = 0, p; (p = promises[i++]); ) {
                try {
                    await p;
                } catch (e) {
                    console.error(Err.cat("build failed", e).toString());
                }
            }
        }
        console.timeEnd("build");
    }

    function isValidRposeFile(file) {
        let name = File.name(file);
        if (/[^a-zA-Z0-9_\-]/.test(name) || !/^[a-zA-Z]/.test(name)) {
            return false;
        }
        return true;
    }

    // ------- a22m-file-watcher end
})();

/* ------- a30m-compile-all-page ------- */
(() => {
    // ------- a30m-compile-all-page start
    const bus = require("@gotoeasy/bus");
    const os = require("@gotoeasy/os");
    const File = require("@gotoeasy/file");

    bus.on(
        "全部编译",
        (function(bs) {
            return function() {
                let oFiles = bus.at("源文件对象清单");
                let env = bus.at("编译环境");

                bus.at("项目配置处理", env.path.root + "rpose.config.btf");

                let promises = [];
                let stime, time;
                for (let file in oFiles) {
                    try {
                        stime = new Date().getTime();

                        let context = bus.at("编译组件", oFiles[file]);
                        context.result.browserifyJs && promises.push(context.result.browserifyJs);

                        time = new Date().getTime() - stime;
                        if (time > 100) {
                            console.info("[compile] " + time + "ms -", file.replace(env.path.src + "/", ""));
                        }
                    } catch (e) {
                        bus.at("组件编译缓存", file, false); // 出错时确保删除缓存（可能组件编译过程成功，页面编译过程失败）
                        throw e;
                    }
                }
                return promises;
            };
        })()
    );

    // ------- a30m-compile-all-page end
})();

/* ------- a32m-compile-component ------- */
(() => {
    // ------- a32m-compile-component start
    const bus = require("@gotoeasy/bus");
    const File = require("@gotoeasy/file");
    const hash = require("@gotoeasy/hash");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译组件",
        (function() {
            return function(infile) {
                let oFile;
                if (infile.file) {
                    oFile = infile; // 项目源文件对象
                } else {
                    let file, text, hashcode;
                    file = bus.at("标签源文件", infile); // 标签则转为源文件，源文件时还是源文件
                    if (!File.existsFile(file)) {
                        throw new Err(`file not found: ${file} (${infile})`);
                    }
                    text = File.read(file);
                    hashcode = hash(text);
                    oFile = { file, text, hashcode };
                }

                let env = bus.at("编译环境");
                let context = bus.at("组件编译缓存", oFile.file);
                if (context && context.input.hashcode !== oFile.hashcode) {
                    context = bus.at("组件编译缓存", oFile.file, false); // 删除该文件相应缓存
                }

                if (!context) {
                    let plugins = bus.on("编译插件");
                    return postobject(plugins).process({ ...oFile }, { log: env.debug });
                }

                return context;
            };
        })()
    );

    // ------- a32m-compile-component end
})();

/* ------- a34m-rebuild-all-page ------- */
(() => {
    // ------- a34m-rebuild-all-page start
    const bus = require("@gotoeasy/bus");
    const os = require("@gotoeasy/os");
    const File = require("@gotoeasy/file");

    bus.on(
        "重新编译全部页面",
        (function(bs) {
            return async function() {
                let time,
                    time1,
                    stime = new Date().getTime();
                let env = bus.at("编译环境");
                let oFiles = bus.at("源文件对象清单");
                for (let file in oFiles) {
                    let context = bus.at("组件编译缓存", file);
                    if (context && context.result && context.result.isPage) {
                        bus.at("组件编译缓存", file, false); // 如果是页面则清除该页面的编译缓存
                    }
                }

                let promises = [];
                for (let key in oFiles) {
                    time1 = new Date().getTime();

                    let context = bus.at("编译组件", oFiles[key]);
                    context.result.browserifyJs && promises.push(context.result.browserifyJs);

                    time = new Date().getTime() - time1;
                    if (time > 100) {
                        console.info("[compile] " + time + "ms -", key.replace(env.path.src + "/", ""));
                    }
                }

                await Promise.all(promises);

                time = new Date().getTime() - stime;
                console.info("[build] " + time + "ms");
            };
        })()
    );

    // ------- a34m-rebuild-all-page end
})();

/* ------- a36m-rebuild-all ------- */
(() => {
    // ------- a36m-rebuild-all start
    const bus = require("@gotoeasy/bus");
    const os = require("@gotoeasy/os");
    const File = require("@gotoeasy/file");

    bus.on(
        "全部重新编译",
        (function(bs) {
            return async function() {
                let time,
                    time1,
                    stime = new Date().getTime();
                let env = bus.at("编译环境");
                bus.at("清除全部编译缓存"); // 清除全部编译缓存
                env = bus.at("编译环境", env, true); // 重新设定编译环境
                bus.at("项目配置处理", env.path.root + "rpose.config.btf", true); // 重新解析项目配置处理
                let oFiles = bus.at("源文件对象清单", true); // 源文件清单重新设定

                let promises = [];
                for (let key in oFiles) {
                    time1 = new Date().getTime();

                    let context = bus.at("编译组件", oFiles[key]);
                    context.result.browserifyJs && promises.push(context.result.browserifyJs);

                    time = new Date().getTime() - time1;
                    if (time > 100) {
                        console.info("[compile] " + time + "ms -", key.replace(env.path.src + "/", ""));
                    }
                }

                await Promise.all(promises);

                time = new Date().getTime() - stime;
                console.info("[build] " + time + "ms");
            };
        })()
    );

    // ------- a36m-rebuild-all end
})();

/* ------- a82m-dev-server-reload ------- */
(() => {
    // ------- a82m-dev-server-reload start
    const bus = require("@gotoeasy/bus");
    const File = require("@gotoeasy/file");
    const hash = require("@gotoeasy/hash");
    const fs = require("fs");
    const url = require("url");
    const path = require("path");
    const http = require("http");
    const opn = require("opn");

    const REBUILDING = "rebuilding...";

    // -----------------------------------------------------------------------
    // 某日，browser-sync启动及刷新竟然要数分钟
    // 原因或是众所周知的网络问题，或是不得而知的版本依赖问题
    // 总之，无心花精力细查解决它，不得已先写个简陋实现，毕竟需求非常简单
    //
    // 此服务器只在watch模式下才开启
    //
    // 1）以dist目录为根目录建立服务器，处理响应文件请求
    // 2）服务器添加文件是否变更的查询接口
    // 3）html文件请求做特殊处理，注入客户端脚本，脚本中包含页面id和哈希码
    // 4）客户端脚本每隔1秒请求服务器查询当前页是否有变更，有改变则刷新
    // 5）服务器启动后，间隔一秒看有无请求，没有则打开浏览器访问，避免开一堆窗口
    // -----------------------------------------------------------------------
    bus.on(
        "热刷新服务器",
        (function(hasQuery) {
            return function() {
                let env = bus.at("编译环境");
                if (!env.watch) return;

                createHttpServer(env.path.build_dist, 3700);
            };

            // 查询
            function queryHandle(req, res, oUrl) {
                hasQuery = true;
                let env = bus.at("编译环境");
                let htmlpage = oUrl.query.split("&")[0].split("=")[1];
                let srcFile = File.resolve(env.path.src, htmlpage.substring(0, htmlpage.length - 5) + ".rpose");

                let hashcode = "";
                if (File.existsFile(srcFile)) {
                    let context = bus.at("组件编译缓存", srcFile);
                    if (context) {
                        hashcode = context.result.hashcode || "";
                    }
                    if (!hashcode) {
                        let fileHtml = bus.at("页面目标HTML文件名", srcFile);
                        let fileCss = bus.at("页面目标CSS文件名", srcFile);
                        let fileJs = bus.at("页面目标JS文件名", srcFile);
                        if (File.existsFile(fileHtml)) {
                            let html = File.read(fileHtml);
                            if (html.indexOf("<body>Page build failed or src file removed<p/>") > 0) {
                                hashcode = REBUILDING;
                            } else {
                                let css = File.existsFile(fileCss) ? File.read(fileCss) : "";
                                let js = File.existsFile(fileJs) ? File.read(fileJs) : "";
                                hashcode = hash(html + css + js); // 确保有值返回避免两次刷新
                            }
                        }
                    }
                }

                res.writeHead(200);
                res.end(hashcode); // 文件找不到或未成功编译时，返回空白串
            }

            // html注入脚本
            function htmlHandle(req, res, oUrl, htmlfile) {
                let env = bus.at("编译环境");
                let srcFile = File.resolve(env.path.src, htmlfile.substring(env.path.build_dist.length + 1, htmlfile.length - 5) + ".rpose");
                let context = bus.at("组件编译缓存", srcFile);
                let hashcode = context ? context.result.hashcode || "" : null;
                if (!hashcode) {
                    let fileHtml = bus.at("页面目标HTML文件名", srcFile);
                    let fileCss = bus.at("页面目标CSS文件名", srcFile);
                    let fileJs = bus.at("页面目标JS文件名", srcFile);
                    if (File.existsFile(fileHtml)) {
                        let html = File.read(fileHtml);
                        let css = File.existsFile(fileCss) ? File.read(fileCss) : "";
                        let js = File.existsFile(fileJs) ? File.read(fileJs) : "";
                        hashcode = hash(html + css + js); // 确保有值返回避免两次刷新
                    }
                }
                let htmlpage = htmlfile.substring(env.path.build_dist.length + 1);

                let script = `
        <script>
            var _times_ = 0;
            function refresh() {
                let url = '/query?page=${htmlpage}&t=' + new Date().getTime();
                ajaxAsync(url, function(rs){
                    if ( rs !== '${hashcode}' ) {
                        if ( rs === '${REBUILDING}' ) {
                            _times_++;
                            _times_ >= 5 ? location.reload() : setTimeout(refresh, 1000);
                        }else{
                            location.reload();
                        }
                    }else{
                        _times_ = 0;
                        setTimeout(refresh, 1000);
                    }
                }, function(err){
                    _times_ = 0;
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

                let html = File.read(htmlfile).replace(/<head>/i, "<head>" + script); // 极简实现，注入脚本，定时轮询服务端
                res.writeHead(200, { "Content-Type": "text/html;charset=UFT8" });
                res.end(html);
            }

            // 创建服务器
            function createHttpServer(www, port) {
                let server = http.createServer(function(req, res) {
                    let oUrl = url.parse(req.url);

                    if (/^\/query$/i.test(oUrl.pathname)) {
                        queryHandle(req, res, oUrl); // 查询页面哈希码
                        return;
                    }

                    let reqfile = path.join(www, oUrl.pathname).replace(/\\/g, "/");
                    if (File.existsDir(reqfile)) {
                        reqfile = File.resolve(reqfile, "index.html"); // 默认访问目录下的index.html
                    }

                    if (/\.html$/i.test(reqfile)) {
                        if (File.existsFile(reqfile)) {
                            htmlHandle(req, res, oUrl, reqfile); // html文件存在时，拦截注入脚本后返回
                        } else {
                            res.writeHead(404);
                            res.end("404 Not Found"); // 文件找不到
                        }
                        return;
                    }

                    if (File.existsFile(reqfile)) {
                        if (/\.css$/i.test(reqfile)) {
                            res.writeHead(200, { "Content-Type": "text/css;charset=UFT8" }); // 避免浏览器控制台警告
                        } else {
                            res.writeHead(200);
                        }
                        fs.createReadStream(reqfile).pipe(res); // 非html文件，直接输出文件流
                    } else {
                        if (/favicon\.ico$/i.test(reqfile)) {
                            res.writeHead(200); // 避免浏览器控制台警告
                            res.end(null);
                        } else {
                            res.writeHead(404);
                            res.end("404 Not Found"); // 文件找不到
                        }
                    }
                });

                server.listen(port);
                let hostUrl = "http://localhost:" + port;
                console.log("-------------------------------------------");
                console.log(` server ready ...... ${hostUrl}`);
                console.log("-------------------------------------------");

                setTimeout(() => {
                    !hasQuery && opn(hostUrl); // 等1秒钟还是没有请求的话，新开浏览器
                }, 1000);
            }
        })()
    );

    // ------- a82m-dev-server-reload end
})();

/* ------- b00p-log ------- */
(() => {
    // ------- b00p-log start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("b00p-log", function(root, context) {
                //        console.info('[b00p-log]', JSON.stringify(root,null,4));
            });
        })()
    );

    // ------- b00p-log end
})();

/* ------- b01p-init-context ------- */
(() => {
    // ------- b01p-init-context start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            // 解析rpose源文件，替换树节点（单个源文件的单一节点），输入{file，text}
            return postobject.plugin("b01p-init-context", function(root, context) {
                context.input = {}; // 存放原始输入（file、text）
                context.doc = {}; // 存放源文件的中间解析结果
                context.style = {}; // 存放样式的中间编译结果
                context.script = {}; // 存放脚本的中间编译结果，script的$actionkeys属性存放事件名数组
                context.keyCounter = 1; // 视图解析时标识key用的计数器

                context.result = {}; // 存放编译结果

                // 保存原始输入（file、text）
                root.walk(
                    (node, object) => {
                        context.input.file = object.file;
                        context.input.text = object.text;
                        context.input.hashcode = object.hashcode;
                    },
                    { readonly: true }
                );

                //console.info('compile ..........', context.input.file);
            });
        })()
    );

    // ------- b01p-init-context end
})();

/* ------- b10m-file-parser-config-btf ------- */
(() => {
    // ------- b10m-file-parser-config-btf start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "项目配置文件解析",
        (function() {
            return function(text, keepLoc = true) {
                let LF = text.indexOf("\r\n") >= 0 ? "\r\n" : "\n";
                let lines = text.split(LF);
                let lineCounts = lines.map(v => v.length + LF.length);

                let nodes = [];
                parse(nodes, lines, lineCounts, LF);

                nodes.forEach(block => {
                    if (block.buf.length) {
                        let type = "ProjectBtfBlockText";
                        let value = block.buf.join(LF);
                        let line = block.name.loc.start.line + 1;
                        let column = 1;
                        let pos = sumLineCount(lineCounts, line - 1);
                        let start = { line, column, pos };

                        line = block.name.loc.start.line + block.buf.length;
                        column = block.buf[block.buf.length - 1].length + 1;
                        pos = sumLineCount(lineCounts, line - 1) + column;

                        if (column === 1 && block.buf.length > 1) {
                            line--;
                            column = block.buf[block.buf.length - 2].length + 1;
                        }
                        end = { line, column, pos };

                        block.text = { type, value, loc: { start, end } };
                    }
                    delete block.buf;
                    if (keepLoc === false) {
                        delete block.name.loc;
                        block.comment !== undefined && delete block.comment.loc;
                        block.text !== undefined && delete block.text.loc;
                    }
                });
                return { nodes };
            };
        })()
    );

    function parse(blocks, lines, lineCounts, lf) {
        let sLine,
            block,
            oName,
            name,
            comment,
            value,
            blockStart = false;
        for (let i = 0; i < lines.length; i++) {
            sLine = lines[i];

            if (isBlockStart(sLine)) {
                block = { type: "ProjectBtfBlock" };
                oName = getBlockName(sLine);
                comment = sLine.substring(oName.len + 2); // 块注释

                let line = i + 1;
                let column = 1;
                let pos = sumLineCount(lineCounts, line - 1);
                let start = { line, column, pos };
                column = oName.len + 3;
                pos += column - 1;
                end = { line, column, pos };

                block.name = { type: "ProjectBtfBlockName", value: oName.name, loc: { start, end } }; // 位置包含中括号
                if (comment) {
                    column = oName.len + 3;
                    start = { line, column, pos };
                    column = sLine.length + 1;
                    pos = sumLineCount(lineCounts, line - 1) + column - 1;
                    end = { line, column, pos };
                    block.comment = { type: "ProjectBtfBlockComment", value: comment, loc: { start, end } }; // 注释
                }
                block.buf = [];

                blocks.push(block);
                blockStart = true;
            } else if (isBlockEnd(sLine)) {
                blockStart = false;
            } else if (isDocumentEnd(sLine)) {
                return;
            } else {
                if (blockStart) {
                    // text line
                    let buf = blocks[blocks.length - 1].buf;
                    if (sLine.charAt(0) === "\\" && (/^\\+\[.*\]/.test(sLine) || /^\\+\---------/.test(sLine) || /^\\+\=========/.test(sLine))) {
                        buf.push(sLine.substring(1)); // 去除转义字符，拼接当前Block内容
                    } else {
                        buf.push(sLine);
                    }
                } else {
                    // ignore line
                }
            }
        }
    }

    function isBlockStart(sLine) {
        return sLine.startsWith("[") && sLine.indexOf("]") > 0;
    }

    function isBlockEnd(sLine) {
        return sLine.startsWith("---------");
    }

    function isDocumentEnd(sLine) {
        return sLine.startsWith("=========");
    }

    function getBlockName(sLine) {
        let name, len;
        for (let i = 1; i < sLine.length; i++) {
            if (sLine.charAt(i - 1) !== "\\" && sLine.charAt(i) === "]") {
                name = sLine.substring(1, i).toLowerCase();
                len = name.length;
                name = name.replace(/\\\]/g, "]"); // 名称部分转义 [\]] => ];
                return { name, len };
            }
        }

        name = sLine.substring(1, sLine.lastIndexOf("]")).toLowerCase();
        len = name.length;
        name = name.replace(/\\\]/g, "]"); // 最后一个]忽略转义 [\] => \; [\]\] => ]\
        return { name, len };
    }

    function sumLineCount(lineCounts, lineNo) {
        let rs = 0;
        for (let i = 0; i < lineNo; i++) {
            rs += lineCounts[i];
        }
        return rs;
    }

    // ------- b10m-file-parser-config-btf end
})();

/* ------- b20m-csslibify ------- */
(() => {
    // ------- b20m-csslibify start
    const bus = require("@gotoeasy/bus");
    const Err = require("@gotoeasy/err");
    const File = require("@gotoeasy/file");
    const hash = require("@gotoeasy/hash");
    const csslibify = require("csslibify");

    bus.on(
        "样式库",
        (function(rs = {}) {
            // ------------------------------------------------------------------------------------------------------
            // 此编译模块用的样式库建库方法，定义后就按需使用，中途不会作样式库的修改操作
            // 使用【包名：文件列表】作为缓存用的样式库名称，以提高性能
            // 如，foo=pkg:**.min.css和bar=pkg:**/*.min.css，实际使用同一样式库
            //
            // 样式库实例通过返回值取得后自行管理 （参数中传入的name部分被无视）
            //
            // 【 使用 】
            // bus.at('样式库', 'defaultname=pkg:**.min.css')
            // bus.at('样式库', 'pkg:**.min.css')
            // bus.at('样式库', 'pkg')
            //
            // 【 defCsslib 】
            //   *=pkg:**/**.min.js
            //   name=pkg:**/aaa*.min.js, **/bbb*.min.js
            //   name=pkg
            //   pkg:**/**.min.js
            //   pkg
            return function(defCsslib) {
                let match;
                let name,
                    pkg,
                    filters = [];
                if ((match = defCsslib.match(/^(.*?)=(.*?):(.*)$/))) {
                    // name=pkg:filters
                    name = match[1].trim();
                    pkg = match[2].trim();
                    cssfilter = match[3];
                    cssfilter
                        .replace(/;/g, ",")
                        .split(",")
                        .forEach(filter => {
                            filter = filter.trim();
                            filter && filters.push(filter);
                        });
                } else if ((match = defCsslib.match(/^(.*?)=(.*)$/))) {
                    // name=pkg
                    name = match[1].trim();
                    pkg = match[2].trim();
                    filters.push("**.min.css"); // 默认取npm包下所有压缩后文件*.min.css
                } else if ((match = defCsslib.match(/^(.*?):(.*)$/))) {
                    // pkg:filters
                    name = "*";
                    pkg = match[1].trim();
                    cssfilter = match[2];
                    cssfilter
                        .replace(/;/g, ",")
                        .split(",")
                        .forEach(filter => {
                            filter = filter.trim();
                            filter && filters.push(filter);
                        });
                } else {
                    // pkg
                    name = "*";
                    pkg = defCsslib.trim();
                    filters.push("**.min.css"); // 默认取npm包下所有压缩后文件*.min.css
                }

                // 导入处理
                pkg.lastIndexOf("@") > 1 && (pkg = pkg.substring(0, pkg.lastIndexOf("@"))); // 模块包名去除版本号 （通常不该有，保险起见处理下）
                let dir,
                    env = bus.at("编译环境");
                if (pkg.startsWith("$")) {
                    dir = env.path.root + "/" + pkg; // pkg以$开头时优先查找本地目录
                    !File.existsDir(dir) && (dir = env.path.root + "/" + pkg.substring(1)); // 次优先查找去$的本地目录
                }
                (!dir || !File.existsDir(dir)) && (dir = getNodeModulePath(pkg)); // 本地无相关目录则按模块处理，安装指定npm包返回安装目录

                let cssfiles = File.files(dir, ...filters); // 待导入的css文件数组

                (!name || name === "*") && (pkg = ""); // 没有指定匿名，或指定为*，按无库名处理（用于组件范围样式）
                let libid = hash(JSON.stringify([pkg, cssfiles])); // 样式库缓存用ID【包名：文件列表】

                let csslib = csslibify(pkg, name, libid);
                !csslib._imported.length && cssfiles.forEach(cssfile => csslib.imp(cssfile)); // 未曾导入时，做导入

                return csslib;
            };
        })()
    );

    function getNodeModulePath(npmpkg) {
        bus.at("自动安装", npmpkg);

        let node_modules = [
            ...require("find-node-modules")({ cwd: process.cwd(), relative: false }),
            ...require("find-node-modules")({ cwd: __dirname, relative: false })
        ];

        for (let i = 0, modulepath, dir; (modulepath = node_modules[i++]); ) {
            dir = File.resolve(modulepath, npmpkg);
            if (File.existsDir(dir)) {
                return dir;
            }
        }

        // 要么安装失败，或又被删除，总之不应该找不到安装位置
        throw new Error("path not found of npm package: " + npmpkg);
    }

    // ------- b20m-csslibify end
})();

/* ------- b22m-parser-[csslib] ------- */
(() => {
    // ------- b22m-parser-[csslib] start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "解析[csslib]",
        (function() {
            return function parseCsslib(csslib, context, loc) {
                let rs = {};
                let lines = (csslib == null ? "" : csslib.trim()).split("\n");

                for (let i = 0, line; i < lines.length; i++) {
                    line = lines[i];
                    let key,
                        value,
                        idx = line.indexOf("="); // libname = npmpkg : filter, filter, filter
                    if (idx < 0) continue;

                    key = line.substring(0, idx).trim();
                    value = line.substring(idx + 1).trim();

                    idx = value.lastIndexOf("//");
                    idx >= 0 && (value = value.substring(0, idx).trim()); // 去注释，无语法分析，可能会误判

                    if (!key) {
                        throw new Err("use * as empty csslib name. etc. * = " + value, {
                            file: context.input.file,
                            text: context.input.text,
                            line: loc.start.line + i,
                            column: 1
                        });
                    }

                    if (rs[key]) {
                        throw new Err("duplicate csslib name: " + key, {
                            file: context.input.file,
                            text: context.input.text,
                            line: loc.start.line + i,
                            column: 1
                        });
                    }
                    rs[key] = value;
                }

                return rs;
            };
        })()
    );

    // ------- b22m-parser-[csslib] end
})();

/* ------- b30m-taglibify ------- */
(() => {
    // ------- b30m-taglibify start
    const bus = require("@gotoeasy/bus");
    const Err = require("@gotoeasy/err");
    const File = require("@gotoeasy/file");
    const Btf = require("@gotoeasy/btf");

    bus.on(
        "标签库定义",
        (function(rs = {}, rsPkg = {}) {
            let stack = [];

            // [tag]
            //   c-btn=pkg:ui-button
            //   ui-button=pkg
            //   pkg:ui-button
            //   ui-button
            bus.on("标签库引用", function(tag, fileOrRoot) {
                let searchPkg = bus.at("文件所在模块", fileOrRoot);
                let name,
                    idx1 = tag.indexOf("="),
                    idx2 = tag.indexOf(":");

                if (idx1 < 0 && idx2 < 0) {
                    name = tag.trim(); // ui-button => ui-button
                } else if (idx2 > 0) {
                    name = tag.substring(idx2 + 1).trim(); // c-btn=pkg:ui-button => ui-button,  pkg:ui-button => ui-button
                } else {
                    name = tag.substring(0, idx1).trim(); // ui-button=pkg => ui-button
                }

                let key = searchPkg + ":" + name;
                return rs[key]; // 返回相应的源文件
            });

            // ----------------------------------------------------
            // 在已安装好依赖包的前提下调用，例子（file用于确定模块）
            // bus.at('标签库定义', 'c-btn=pkg:ui-button', file)
            // bus.at('标签库定义', 'ui-button=pkg', file)
            // bus.at('标签库定义', 'pkg:ui-button', file)
            //
            // [defTaglib]
            //   c-btn=pkg:ui-button
            //   ui-button=pkg
            //   pkg:ui-button
            // [file]
            //   用于定位该标签库根目录的文件
            return function(defTaglib, file) {
                // 默认关联全部源文件，存放内存
                let oTaglib = bus.at("normalize-taglib", defTaglib);
                initPkgDefaultTag(oTaglib.pkg);

                // 查找已有关联
                let askey,
                    tagkey,
                    oPkg,
                    searchPkg = bus.at("文件所在模块", file);
                askey = searchPkg + ":" + oTaglib.astag;
                tagkey = oTaglib.pkg + ":" + oTaglib.tag;
                if (rs[tagkey]) {
                    rs[askey] = rs[tagkey];
                    stack = [];
                    return rs;
                }

                stack.push(`[${searchPkg}] ${oTaglib.taglib}`); // 错误提示用

                // 通过项目配置查找关联 （不采用安装全部依赖包的方案，按需关联使用以减少不必要的下载和解析）
                let pkgfile;
                try {
                    pkgfile = require.resolve(oTaglib.pkg + "/package.json", { paths: [bus.at("编译环境").path.root, __dirname] });
                } catch (e) {
                    stack.unshift(e.message);
                    let msg = stack.join("\n => ");
                    stack = [];
                    // 通常是依赖的package未安装或安装失败导致
                    throw new Error(msg);
                }
                let configfile = File.path(pkgfile) + "/rpose.config.btf";
                if (!File.existsFile(configfile)) {
                    stack.unshift(`tag [${oTaglib.tag}] not found in package [${oTaglib.pkg}]`);
                    let msg = stack.join("\n => ");
                    stack = [];
                    throw new Error(msg); // 文件找不到，又没有配置，错误
                }

                let btf = new Btf(configfile);
                let oTaglibKv,
                    taglibBlockText = btf.getText("taglib"); // 已发布的包，通常不会有错，不必细致检查
                try {
                    oTaglibKv = bus.at("解析[taglib]", taglibBlockText, { input: { file: configfile } });
                } catch (e) {
                    stack.push(`[${oTaglib.pkg}] ${oTaglib.pkg}:${oTaglib.tag}`); // 错误提示用
                    stack.push(configfile);
                    stack.unshift(e.message);
                    let msg = stack.join("\n => ");
                    stack = [];
                    // 通常是[taglib]解析失败导致
                    throw new Error(msg);
                }
                let oConfTaglib = oTaglibKv[oTaglib.tag];
                if (!oConfTaglib) {
                    stack.push(configfile);
                    stack.unshift(`tag [${oTaglib.tag}] not found in package [${oTaglib.pkg}]`);
                    let msg = stack.join("\n => ");
                    stack = [];
                    throw new Error(msg); // 文件找不到，配置文件中也找不到，错误
                }

                // 通过项目配置查找关联 （不采用安装全部依赖包的方案，按需关联使用以减少不必要的下载和解析）
                bus.at("自动安装", oConfTaglib.pkg);
                return bus.at("标签库定义", oConfTaglib.taglib, configfile); // 要么成功，要么异常
            };

            function initPkgDefaultTag(pkg) {
                if (!rsPkg[pkg]) {
                    let oPkg = bus.at("模块组件信息", pkg); // @scope/pkg
                    for (let i = 0, file; (file = oPkg.files[i++]); ) {
                        rs[oPkg.name + ":" + File.name(file)] = file; // 包名：标签 = 文件
                    }
                    rsPkg[pkg] = true;
                }
            }
        })()
    );

    // ------- b30m-taglibify end
})();

/* ------- b32m-normalize-taglib ------- */
(() => {
    // ------- b32m-normalize-taglib start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    // 解析单个taglib定义，转换为对象形式方便读取
    bus.on(
        "normalize-taglib",
        (function() {
            return function normalizeTaglib(taglib, offset = 0) {
                let astag, pkg, tag, match;
                if ((match = taglib.match(/^\s*([\S]+)\s*=\s*([\S]+)\s*:\s*([\S]+)\s*$/))) {
                    // c-btn=@scope/pkg:ui-button
                    astag = match[1]; // c-btn=@scope/pkg:ui-button => c-btn
                    pkg = match[2]; // c-btn=@scope/pkg:ui-button => @scope/pkg
                    tag = match[3]; // c-btn=@scope/pkg:ui-button => ui-button
                } else if ((match = taglib.match(/^\s*([\S]+)\s*=\s*([\S]+)\s*$/))) {
                    // ui-button=@scope/pkg
                    astag = match[1]; // ui-button=@scope/pkg => ui-button
                    pkg = match[2]; // ui-button=@scope/pkg => @scope/pkg
                    tag = match[1]; // ui-button=@scope/pkg => ui-button
                } else if ((match = taglib.match(/^\s*([\S]+)\s*:\s*([\S]+)\s*$/))) {
                    // @scope/pkg:ui-button
                    astag = match[2]; // @scope/pkg:ui-button => ui-button
                    pkg = match[1]; // @scope/pkg:ui-button => @scope/pkg
                    tag = match[2]; // @scope/pkg:ui-button => ui-button
                } else {
                    // 无效的taglib格式
                    return null;
                }

                return { line: offset, astag, pkg, tag, taglib: astag + "=" + pkg + ":" + tag };
            };
        })()
    );

    // ------- b32m-normalize-taglib end
})();

/* ------- b34m-parser-[taglib] ------- */
(() => {
    // ------- b34m-parser-[taglib] start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "解析[taglib]",
        (function() {
            // 仅解析和简单验证，不做安装和定义等事情
            return function parseTaglib(taglibBlockText, context, loc) {
                let rs = {};
                let lines = (taglibBlockText == null ? "" : taglibBlockText.trim()).split("\n");
                for (let i = 0, taglib, oTaglib, oPkg; i < lines.length; i++) {
                    taglib = lines[i].split("//")[0].trim(); // 去除注释内容
                    if (!taglib) continue; // 跳过空白行

                    oTaglib = bus.at("normalize-taglib", taglib, i);

                    // 无效的taglib格式
                    if (!oTaglib) {
                        if (loc) {
                            throw new Err("invalid taglib: " + oTaglib.taglib, {
                                file: context.input.file,
                                text: context.input.text,
                                line: loc.start.line + i,
                                column: 1
                            });
                        }
                        throw new Err(`invalid taglib: ${taglib}`);
                    }

                    // 无效的taglib别名
                    if (/^(if|for)$/i.test(oTaglib.astag)) {
                        if (loc) {
                            throw new Err("can not use buildin tag name: " + oTaglib.astag, {
                                file: context.input.file,
                                text: context.input.text,
                                line: loc.start.line + i,
                                column: 1
                            });
                        }
                        throw new Err("can not use buildin tag name: " + oTaglib.astag);
                    }

                    // 重复的taglib别名
                    if (rs[oTaglib.astag]) {
                        if (loc) {
                            throw new Err("duplicate tag name: " + oTaglib.astag, {
                                file: context.input.file,
                                text: context.input.text,
                                line: loc.start.line + i,
                                column: 1
                            });
                        }
                        throw new Err("duplicate tag name: " + oTaglib.astag);
                    }

                    rs[oTaglib.astag] = oTaglib;
                }

                return rs;
            };
        })()
    );

    // ------- b34m-parser-[taglib] end
})();

/* ------- b95p-init-project-config ------- */
(() => {
    // ------- b95p-init-project-config start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const File = require("@gotoeasy/file");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("b95p-init-project-config", function(root, context) {
                context.project = bus.at("项目配置处理", context.input.file);
            });
        })()
    );

    bus.on(
        "项目配置处理",
        (function(result = {}) {
            return function(srcFile, nocahce = false) {
                nocahce && (result = {});
                let time,
                    stime = new Date().getTime();
                let btfFile = srcFile.endsWith("/rpose.config.btf") ? srcFile : bus.at("文件所在项目配置文件", srcFile);

                if (result[btfFile]) return result[btfFile];
                if (!File.existsFile(btfFile)) return {};

                let plugins = bus.on("项目配置处理插件");
                let rs = postobject(plugins).process({ file: btfFile });

                result[btfFile] = rs.result;

                time = new Date().getTime() - stime;
                time > 100 && console.debug("init-project-config:", time + "ms");
                return result[btfFile];
            };
        })()
    );

    // 解析项目的btf配置文件, 构建语法树
    bus.on(
        "项目配置处理插件",
        (function() {
            return postobject.plugin("process-project-config-101", function(root, context) {
                context.input = {};
                context.result = {};

                root.walk((node, object) => {
                    context.input.file = object.file;
                    context.input.text = File.read(object.file);

                    let blocks = bus.at("项目配置文件解析", context.input.text);
                    let newNode = this.createNode(blocks); // 转换为树节点并替换
                    node.replaceWith(...newNode.nodes); // 一个Block一个节点
                });

                // 简化，节点类型就是块名，节点value就是内容，没内容的块都删掉
                root.walk((node, object) => {
                    if (!object.text || !object.text.value || !object.text.value.trim()) return node.remove();

                    let type = object.name.value;
                    let value = object.text.value;
                    let loc = object.text.loc;
                    let oNode = this.createNode({ type, value, loc });
                    node.replaceWith(oNode);
                });
            });
        })()
    );

    // 建立项目样式库
    bus.on(
        "项目配置处理插件",
        (function() {
            return postobject.plugin("process-project-config-102", function(root, context) {
                let hashClassName = bus.on("哈希样式类名")[0];
                let rename = (pkg, cls) => hashClassName(context.input.file, pkg ? cls + "@" + pkg : cls); // 自定义改名函数
                let opts = { rename };

                let oKv;
                root.walk("csslib", (node, object) => {
                    oKv = bus.at("解析[csslib]", object.value, context, object.loc);
                    node.remove();
                });
                if (!oKv) return;

                let oCsslib = (context.result.oCsslib = {});
                let oCsslibPkgs = (context.result.oCsslibPkgs = context.result.oCsslibPkgs || {});
                for (let k in oKv) {
                    oCsslib[k] = bus.at("样式库", `${k}=${oKv[k]}`);
                    oCsslibPkgs[k] = oCsslib[k].pkg; // 保存样式库{匿名：实际名}的关系，便于通过匿名找到实际包名
                }
            });
        })()
    );

    // 添加内置标签库
    bus.on(
        "项目配置处理插件",
        (function(addBuildinTaglib) {
            return postobject.plugin("process-project-config-103", function(root, context) {
                if (!addBuildinTaglib) {
                    let pkg = "@rpose/buildin";
                    if (!bus.at("自动安装", pkg)) {
                        throw new Error("package install failed: " + pkg);
                    }
                    bus.at("标签库定义", "@rpose/buildin:```", ""); // 项目范围添加内置标签库
                    bus.at("标签库定义", "@rpose/buildin:router", ""); // 项目范围添加内置标签库
                    bus.at("标签库定义", "@rpose/buildin:router-link", ""); // 项目范围添加内置标签库
                    addBuildinTaglib = true;
                }
            });
        })()
    );

    // 建立项目标签库
    bus.on(
        "项目配置处理插件",
        (function(addBuildinTaglib) {
            return postobject.plugin("process-project-config-105", function(root, context) {
                let oKv, startLine;
                root.walk("taglib", (node, object) => {
                    oKv = bus.at("解析[taglib]", object.value, context, object.loc);
                    startLine = object.loc.start.line;
                    node.remove();
                });

                context.result.oTaglib = oKv || {}; // 存键值，用于检查重复
                if (!oKv) return;

                // 检查安装依赖包
                let mapPkg = new Map();
                for (let key in oKv) {
                    mapPkg.set(oKv[key].pkg, oKv[key]);
                }
                mapPkg.forEach((oTag, pkg) => {
                    if (!bus.at("自动安装", pkg)) {
                        throw new Err("package install failed: " + pkg, {
                            file: context.input.file,
                            text: context.input.text,
                            line: startLine + oTag.line,
                            column: 1
                        });
                    }
                });

                // 逐个定义标签库关联实际文件
                for (let key in oKv) {
                    try {
                        bus.at("标签库定义", oKv[key].taglib, context.input.file); // 无法关联时抛出异常
                    } catch (e) {
                        throw new Err.cat(e, { file: context.input.file, text: context.input.text, line: startLine + oKv[key].line, column: 1 });
                    }
                }

                // 添加内置标签库
                if (!addBuildinTaglib) {
                    pkg = "@rpose/buildin";
                    if (!bus.at("自动安装", pkg)) {
                        throw new Error("package install failed: " + pkg);
                    }
                    bus.at("标签库定义", "@rpose/buildin:```", ""); // 项目范围添加内置标签库
                    bus.at("标签库定义", "@rpose/buildin:router", ""); // 项目范围添加内置标签库
                    bus.at("标签库定义", "@rpose/buildin:router-link", ""); // 项目范围添加内置标签库
                    addBuildinTaglib = true;
                }
            });
        })()
    );

    // ------- b95p-init-project-config end
})();

/* ------- c00m-file-parser-rpose ------- */
(() => {
    // ------- c00m-file-parser-rpose start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    // ---------------------------------------------------
    // RPOSE源文件解析
    // ---------------------------------------------------
    bus.on(
        "RPOSE源文件解析",
        (function() {
            return function(text, keepLoc = true) {
                let LF = text.indexOf("\r\n") >= 0 ? "\r\n" : "\n";
                let lines = text.split(LF);
                let lineCounts = lines.map(v => v.length + LF.length);

                let nodes = [];
                parse(nodes, lines, lineCounts, LF);

                nodes.forEach(block => {
                    if (block.buf.length) {
                        let type = "RposeBlockText";
                        let value = block.buf.join(LF);
                        let line = block.name.loc.start.line + 1;
                        let column = 1;
                        let pos = sumLineCount(lineCounts, line - 1);
                        let start = { line, column, pos };

                        line = block.name.loc.start.line + block.buf.length;
                        column = block.buf[block.buf.length - 1].length + 1;
                        pos = sumLineCount(lineCounts, line - 1) + column;

                        if (column === 1 && block.buf.length > 1) {
                            line--;
                            column = block.buf[block.buf.length - 2].length + 1;
                        }
                        end = { line, column, pos };

                        block.text = { type, value, loc: { start, end } };
                    }
                    delete block.buf;
                    if (keepLoc === false) {
                        delete block.name.loc;
                        block.comment !== undefined && delete block.comment.loc;
                        block.text !== undefined && delete block.text.loc;
                    }
                });
                return { nodes };
            };
        })()
    );

    function parse(blocks, lines, lineCounts, lf) {
        let sLine,
            block,
            oName,
            name,
            comment,
            value,
            blockStart = false;
        for (let i = 0; i < lines.length; i++) {
            sLine = lines[i];

            if (isBlockStart(sLine)) {
                block = { type: "RposeBlock" };
                oName = getBlockName(sLine);
                comment = sLine.substring(oName.len + 2); // 块注释

                let line = i + 1;
                let column = 1;
                let pos = sumLineCount(lineCounts, line - 1);
                let start = { line, column, pos };
                column = oName.len + 3;
                pos += column - 1;
                end = { line, column, pos };

                block.name = { type: "RposeBlockName", value: oName.name, loc: { start, end } }; // 位置包含中括号
                if (comment) {
                    column = oName.len + 3;
                    start = { line, column, pos };
                    column = sLine.length + 1;
                    pos = sumLineCount(lineCounts, line - 1) + column - 1;
                    end = { line, column, pos };
                    block.comment = { type: "RposeBlockComment", value: comment, loc: { start, end } }; // 注释
                }
                block.buf = [];

                blocks.push(block);
                blockStart = true;
            } else if (isBlockEnd(sLine)) {
                blockStart = false;
            } else if (isDocumentEnd(sLine)) {
                return;
            } else {
                if (blockStart) {
                    // text line
                    let buf = blocks[blocks.length - 1].buf;
                    if (sLine.charAt(0) === "\\" && (/^\\+\[.*\]/.test(sLine) || /^\\+\---------/.test(sLine) || /^\\+\=========/.test(sLine))) {
                        buf.push(sLine.substring(1)); // 去除转义字符，拼接当前Block内容
                    } else {
                        buf.push(sLine);
                    }
                } else {
                    // ignore line
                }
            }
        }
    }

    function isBlockStart(sLine) {
        return sLine.startsWith("[") && sLine.indexOf("]") > 0;
    }

    function isBlockEnd(sLine) {
        return sLine.startsWith("---------");
    }

    function isDocumentEnd(sLine) {
        return sLine.startsWith("=========");
    }

    function getBlockName(sLine) {
        let name, len;
        for (let i = 1; i < sLine.length; i++) {
            if (sLine.charAt(i - 1) !== "\\" && sLine.charAt(i) === "]") {
                name = sLine.substring(1, i).toLowerCase();
                len = name.length;
                name = name.replace(/\\\]/g, "]"); // 名称部分转义 [\]] => ];
                return { name, len };
            }
        }

        name = sLine.substring(1, sLine.lastIndexOf("]")).toLowerCase();
        len = name.length;
        name = name.replace(/\\\]/g, "]"); // 最后一个]忽略转义 [\] => \; [\]\] => ]\
        return { name, len };
    }

    function sumLineCount(lineCounts, lineNo) {
        let rs = 0;
        for (let i = 0; i < lineNo; i++) {
            rs += lineCounts[i];
        }
        return rs;
    }

    // ------- c00m-file-parser-rpose end
})();

/* ------- c15p-parse-rpose-src-to-blocks ------- */
(() => {
    // ------- c15p-parse-rpose-src-to-blocks start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            // 解析rpose源文件，替换树节点（单个源文件的单一节点），输入{file，text}
            return postobject.plugin("c15p-parse-rpose-src-to-blocks", function(root, context) {
                let result = context.result;

                root.walk((node, object) => {
                    result.tagpkg = bus.at("标签全名", object.file);

                    // 解析源码块
                    let blocks = bus.at("RPOSE源文件解析", object.text);

                    // 转换为树节点并替换
                    let newNode = this.createNode(blocks);
                    node.replaceWith(...newNode.nodes); // 一个Block一个节点

                    return false;
                });
            });
        })()
    );

    // ------- c15p-parse-rpose-src-to-blocks end
})();

/* ------- c25p-blocks-to-context-doc ------- */
(() => {
    // ------- c25p-blocks-to-context-doc start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("c25p-blocks-to-context-doc", function(root, context) {
                let doc = context.doc;

                root.walk("RposeBlock", (node, object) => {
                    // 指定块存放到context中以便于读取，节点相应删除
                    if (/^(api|options|state|mount)$/.test(object.name.value)) {
                        doc[object.name.value] = object.text ? object.text.value : "";
                        node.remove();
                    }
                });
            });
        })()
    );

    // ------- c25p-blocks-to-context-doc end
})();

/* ------- c35p-normalize-context-doc ------- */
(() => {
    // ------- c35p-normalize-context-doc start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            // 解析rpose源文件，替换树节点（单个源文件的单一节点），输入{file，text}
            return postobject.plugin("c35p-normalize-context-doc", function(root, context) {
                let doc = context.doc;

                // 适当整理
                doc.api = parseBlockApi(doc.api); // [api]解析为对象，按键值解析
                doc.mount && (doc.mount = doc.mount.trim()); // [mount]有则去空白
            });
        })()
    );

    function parseBlockApi(api) {
        let rs = { strict: true }; // 默认严格匹配样式库模式

        let lines = (api == null ? "" : api.trim()).split("\n");
        lines.forEach(line => {
            let key,
                value,
                idx = line.indexOf("="); // 等号和冒号，谁在前则按谁分隔
            idx < 0 && (idx = line.indexOf(":"));
            if (idx < 0) return;

            key = line.substring(0, idx).trim();
            value = line.substring(idx + 1).trim();

            idx = value.lastIndexOf("//");
            idx >= 0 && (value = value.substring(0, idx).trim()); // 去注释，无语法分析，可能会误判

            if (/^option[\-]?keys$/i.test(key)) {
                key = "optionkeys";
                value = value.split(/[,;]/).map(v => v.trim());
                rs[key] = value;
            } else if (/^state[\-]?keys$/i.test(key)) {
                key = "statekeys";
                value = value.split(/[,;]/).map(v => v.trim());
                rs[key] = value;
            } else if (/^pre[\-]?render$/i.test(key)) {
                key = "prerender";
                rs[key] = value;
            } else if (/^desktop[\-]?first$/i.test(key)) {
                key = "desktopfirst"; // 移动优先时，min-width => max-width => min-device-width => max-device-width => other;桌面优先时，max-width => max-device-width => min-width => min-device-width => other
                rs[key] = toBoolean(value);
            } else if (/^mobile[\-]?first$/i.test(key)) {
                key = "desktopfirst";
                rs[key] = !toBoolean(value);
            } else if (/^strict$/i.test(key)) {
                key = "strict";
                rs[key] = toBoolean(value);
            } else {
                rs[key] = value;
            }
        });

        return rs;
    }

    // 直接运算为false则返回false，字符串（不区分大小写）‘0’、‘f’、‘false’、‘n’、‘no’ 都为false，其他为true
    function toBoolean(arg) {
        if (!arg) return false;
        if (typeof arg !== "string") return true;
        return !/^(0|false|f|no|n)$/i.test((arg + "").trim());
    }

    // ------- c35p-normalize-context-doc end
})();

/* ------- c45p-is-page ------- */
(() => {
    // ------- c45p-is-page start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            // 目录不含‘components’或‘node_modules’，且有[mount]时判断为页面
            return postobject.plugin("c45p-is-page", function(root, context) {
                context.result.isPage =
                    context.doc.mount && !/\/components\//i.test(context.input.file) && !/\/node_modules\//i.test(context.input.file);
            });
        })()
    );

    // ------- c45p-is-page end
})();

/* ------- d00m-compile-theme ------- */
(() => {
    // ------- d00m-compile-theme start
    const Err = require("@gotoeasy/err");
    const bus = require("@gotoeasy/bus");
    const Btf = require("@gotoeasy/btf");
    const File = require("@gotoeasy/file");

    bus.on(
        "样式风格",
        (function(result) {
            return function() {
                let env = bus.at("编译环境");
                try {
                    let map;
                    if (!result) {
                        if (env.theme) {
                            let file = getThemeBtfFile(); // 找出配置的风格文件或模块对应的文件
                            map = getThemeMapByFile(file); // 解析成Map
                        } else {
                            map = new Map(); // 没配置
                        }

                        result = {
                            less: getThemeLess(map),
                            scss: getThemeScss(map),
                            css: getThemeCss(map)
                        };
                    }

                    return result;
                } catch (e) {
                    throw Err.cat("init theme failed: " + env.theme, e);
                }
            };
        })()
    );

    function getThemeLess(map) {
        let rs = [];
        map.forEach((v, k) => rs.push("@" + k + " : " + v + ";"));
        return rs.join("\n") + "\n";
    }
    function getThemeScss(map) {
        let rs = [];
        map.forEach((v, k) => rs.push("$" + k + " : " + v + ";"));
        return rs.join("\n") + "\n";
    }
    function getThemeCss(map) {
        if (!map.size) return "";

        let rs = [];
        rs.push(":root{");
        map.forEach((v, k) => rs.push("--" + k + " : " + v + ";"));
        rs.push("}");
        return rs.join("\n") + "\n";
    }

    function getThemeBtfFile() {
        let env = bus.at("编译环境");
        let file;
        if (env.theme.endsWith(".btf")) {
            if (File.exists(file)) {
                return file; // 绝对路径形式配置
            }

            file = File.resolve(env.path.root, env.theme); // 工程根目录相对路径形式配置
            if (File.exists(file)) {
                return file;
            }

            throw new Err("theme file not found: " + file);
        }

        // 包名形式配置
        return getThemeBtfFileByPkg(env.theme);
    }

    function getThemeBtfFileByPkg(themePkg) {
        let ary = [...require("find-node-modules")({ cwd: __dirname, relative: false }), ...require("find-node-modules")({ relative: false })];
        for (let i = 0, path, file; (path = ary[i++]); ) {
            file = path.replace(/\\/g, "/") + "/" + themePkg + "/theme.btf";
            if (File.exists(file)) {
                return file;
            }
        }
        throw new Err("theme file not found: " + themePkg + "/theme.btf");
    }

    const fileSet = new Set(); // 循环继承检查用
    function getThemeMapByFile(file) {
        if (fileSet.has(file)) {
            let ary = [...fileSet].push(file);
            throw Err.cat(ary, new Err("theme circular extend"));
        }
        fileSet.add(file);

        btf = new Btf(file);
        let superPkg = (btf.getText("extend") || "").trim(); // 继承的模块名
        let superTheme;
        let theme = btf.getMap("theme");

        if (superPkg) {
            superTheme = getThemeMapByFile(getThemeBtfFileByPkg(superPkg));
            theme.forEach((v, k) => superTheme.set(k, v)); // 覆盖父类风格
            theme = superTheme;
        }
        return theme;
    }

    // ------- d00m-compile-theme end
})();

/* ------- d15p-compile-component-scss ------- */
(() => {
    // ------- d15p-compile-component-scss start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const csjs = require("@gotoeasy/csjs");
    const File = require("@gotoeasy/file");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("d15p-compile-component-scss", function(root, context) {
                let style = context.style;

                root.walk("RposeBlock", (node, object) => {
                    // 编译结果追加到context中以便于读取，节点相应删除
                    if (/^scss$/.test(object.name.value)) {
                        let scss = object.text ? object.text.value : "";
                        if (scss) {
                            let theme = bus.at("样式风格");
                            style.scss = scssToCss(theme.scss + scss);
                        }

                        node.remove();
                        return false;
                    }
                });

                function scssToCss(scss) {
                    let env = bus.at("编译环境");
                    let oCache = bus.at("缓存");
                    let cacheKey = JSON.stringify(["scssToCss", context.input.file, scss]);
                    if (!env.nocache) {
                        let cacheValue = oCache.get(cacheKey);
                        if (cacheValue) return cacheValue;
                    }

                    let css = csjs.scssToCss(scss, { includePaths: [File.path(context.input.file)] });
                    return oCache.set(cacheKey, css);
                }
            });
        })()
    );

    // ------- d15p-compile-component-scss end
})();

/* ------- d25p-compile-component-less ------- */
(() => {
    // ------- d25p-compile-component-less start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const csjs = require("@gotoeasy/csjs");
    const File = require("@gotoeasy/file");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("d25p-compile-component-less", function(root, context) {
                let style = context.style;

                root.walk("RposeBlock", (node, object) => {
                    // 编译结果追加到context中以便于读取，节点相应删除
                    if (/^less$/.test(object.name.value)) {
                        let less = object.text ? object.text.value : "";
                        if (less) {
                            let theme = bus.at("样式风格");
                            style.less = lessToCss(theme.less + less);
                        }

                        node.remove();
                        return false;
                    }
                });

                function lessToCss(less) {
                    let env = bus.at("编译环境");
                    let oCache = bus.at("缓存");
                    let cacheKey = JSON.stringify(["lessToCss", context.input.file, less]);
                    if (!env.nocache) {
                        let cacheValue = oCache.get(cacheKey);
                        if (cacheValue) return cacheValue;
                    }

                    let css = csjs.lessToCss(less, { paths: [File.path(context.input.file)] });
                    return oCache.set(cacheKey, css);
                }
            });
        })()
    );

    // ------- d25p-compile-component-less end
})();

/* ------- d30m-normalize-css ------- */
(() => {
    // ------- d30m-normalize-css start
    const bus = require("@gotoeasy/bus");
    const hash = require("@gotoeasy/hash");
    const postcss = require("postcss");

    // 整理输入样式
    // 去前缀、删注释、复制url资源、静态化变量等
    module.exports = bus.on(
        "样式统一化整理",
        (function() {
            // -------------------------------------------------------------
            // 同步处理，仅支持同步插件
            // url资源统一去除目录，资源文件哈希后存放缓存的resources目录中
            //
            // css      : 样式内容 （必须输入）
            // from     : 样式路径文件名 （必须输入，组件源文件后缀替换为css）
            // -------------------------------------------------------------
            return (css, from) => {
                // 修改url并复文件哈希化文件名
                let url = "copy";
                let fromPath = File.path(from);
                let toPath = bus.at("缓存").path + "/resources";
                let to = toPath + "/to.css";
                let assetsPath = toPath;
                let basePath = fromPath;
                let useHash = true;
                let hashOptions = { method: contents => hash({ contents }) };
                let postcssUrlOpt = { url, from, to, basePath, assetsPath, useHash, hashOptions };

                let env = bus.at("编译环境");
                let oCache = bus.at("缓存");
                let cacheKey = JSON.stringify(["组件样式统一化", css, fromPath, toPath, assetsPath]);
                let plugins = [];
                if (!env.nocache) {
                    let cacheValue = oCache.get(cacheKey);
                    if (cacheValue) {
                        return cacheValue;
                    }
                }

                plugins.push(require("postcss-import-sync")({ from })); // @import
                plugins.push(require("postcss-unprefix")()); // 删除前缀（含@规则、属性名、属性值，如果没有会自动补足无前缀样式）
                plugins.push(require("postcss-url")(postcssUrlOpt)); // url资源复制
                plugins.push(require("postcss-nested")()); // 支持嵌套（配合下面变量处理）
                plugins.push(require("postcss-css-variables")()); // 把css变量静态化输出
                plugins.push(require("postcss-discard-comments")({ remove: x => 1 })); // 删除所有注释
                plugins.push(require("postcss-minify-selectors")); // 压缩删除选择器空白（h1 + p, h2, h3, h2{color:blue} => h1+p,h2,h3{color:blue}）
                plugins.push(require("postcss-minify-params")); // 压缩删除参数空白（@media only screen   and ( min-width: 400px, min-height: 500px    ){} => @media only screen and (min-width:400px,min-height:500px){}）
                plugins.push(require("postcss-normalize-string")); // 统一写法（'\\'abc\\'' => "'abc'"）
                plugins.push(require("postcss-normalize-display-values")); // 统一写法（{display:inline flow-root} => {display:inline-block}）
                plugins.push(require("postcss-normalize-positions")); // 统一写法（{background-position:bottom left} => {background-position:0 100%}）
                plugins.push(require("postcss-normalize-repeat-style")); // 统一写法（{background:url(image.jpg) repeat no-repeat} => {background:url(image.jpg) repeat-x}）
                plugins.push(require("postcss-minify-font-values")); // 统一写法（{font-family:"Helvetica Neue";font-weight:normal} => {font-family:Helvetica Neue;font-weight:400}）
                plugins.push(require("postcss-minify-gradients")); // 统一写法（{background:linear-gradient(to bottom,#ffe500 0%,#ffe500 50%,#121 50%,#121 100%)} => {background:linear-gradient(180deg,#ffe500 0%,#ffe500 50%,#121 0,#121)}）
                plugins.push(require("postcss-color-hex-alpha")); // 统一写法（{color:#9d9c} => {color:rgba(153,221,153,0.8)}）
                plugins.push(require("postcss-merge-longhand")); // 统一写法（h1{margin-top:10px;margin-right:20px;margin-bottom:10px;margin-left:20px} => h1{margin:10px 20px}）

                let rs = postcss(plugins)
                    .process(css, { from, to })
                    .sync()
                    .root.toResult();
                return oCache.set(cacheKey, rs.css);
            };
        })()
    );

    // ------- d30m-normalize-css end
})();

/* ------- d35p-normalize-component-css ------- */
(() => {
    // ------- d35p-normalize-component-css start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const File = require("@gotoeasy/file");

    bus.on(
        "编译插件",
        (function() {
            // ----------------------------------------------------------------------
            // 全部资源文件统一复制到 %缓存目录%/resources 中，并哈希化
            // 用以避免clean命令删除build目录导致资源文件丢失
            // 组件样式统一编译到同一目录，即url中没有目录，简化后续页面资源目录调整
            // ----------------------------------------------------------------------
            return postobject.plugin("d35p-normalize-component-css", function(root, context) {
                let style = context.style;

                // 解决样式中URL资源的复制及改名问题
                root.walk("RposeBlock", (node, object) => {
                    // 编译结果追加到context中以便于读取，节点相应删除
                    if (/^css$/.test(object.name.value)) {
                        let css = object.text ? object.text.value : "";
                        if (css) {
                            let theme = bus.at("样式风格");
                            style.css = theme.css + css;
                        }

                        node.remove();
                        return false;
                    }
                });

                if (!style.css) return;

                let from = context.input.file.replace(/\.rpose$/i, ".css");
                style.css = bus.at("样式统一化整理", style.css, from);
            });
        })()
    );

    // ------- d35p-normalize-component-css end
})();

/* ------- d45p-normalize-component-actions ------- */
(() => {
    // ------- d45p-normalize-component-actions start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    const acorn = require("acorn");
    const astring = require("astring");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("d45p-normalize-component-actions", function(root, context) {
                let script = context.script;

                root.walk("RposeBlock", (node, object) => {
                    if (!/^actions$/.test(object.name.value)) return;

                    let actions = object.text ? object.text.value.trim() : "";
                    if (actions) {
                        let rs = generateActions(actions, object.text.loc);
                        script.actions = rs.src;
                        script.$actionkeys = rs.names;
                    }
                    node.remove();
                    return false;
                });
            });
        })()
    );

    function generateActions(code, loc) {
        let env = bus.at("编译环境");
        let oCache = bus.at("缓存");
        let cacheKey = JSON.stringify(["generateActions", code]);
        if (!env.nocache) {
            let cacheValue = oCache.get(cacheKey);
            if (cacheValue) return cacheValue;
        }

        let rs;
        if (code.startsWith("{")) {
            rs = generateObjActions(code, loc);
        } else {
            rs = generateFunActions(code, loc);
        }

        return oCache.set(cacheKey, rs);
    }

    function generateFunActions(code, loc) {
        let ast;
        try {
            ast = acorn.parse(code, { ecmaVersion: 10, sourceType: "module", locations: true });
        } catch (e) {
            // 通常是代码有语法错误
            throw new Err("syntax error in [actions]", e);
            // TODO
            //    throw new Err('syntax error in [actions] - ' + e.message, doc.file, {text, start});
        }

        let map = new Map();

        ast.body.forEach(node => {
            let nd;
            if (node.type == "FunctionDeclaration") {
                node.type = "ArrowFunctionExpression";
                map.set(node.id.name, astring.generate(node));
            } else if (node.type == "VariableDeclaration") {
                nd = node.declarations[0].init;
                if (nd.type == "FunctionDeclaration" || nd.type == "ArrowFunctionExpression") {
                    nd.type = "ArrowFunctionExpression";
                    map.set(node.declarations[0].id.name, astring.generate(nd));
                }
            } else if (node.type == "ExpressionStatement") {
                nd = node.expression.right;
                if (nd.type == "FunctionDeclaration" || nd.type == "ArrowFunctionExpression") {
                    nd.type = "ArrowFunctionExpression";
                    map.set(node.expression.left.name, astring.generate(nd));
                }
            }
        });

        let names = [...map.keys()];
        let rs = { src: "", names: names };
        if (names.length) {
            //    names.sort();

            let ary = [];
            ary.push("this.$actions = {");
            names.forEach(k => {
                ary.push('"' + k + '": ' + map.get(k) + ",");
            });
            ary.push("}");

            rs.src = ary.join("\n");
        }

        return rs;
    }

    function generateObjActions(code, loc) {
        let src = `this.$actions     = ${code}`;
        let ast;

        try {
            ast = acorn.parse(src, { ecmaVersion: 10, sourceType: "module", locations: true });
        } catch (e) {
            // 通常是代码有语法错误
            throw new Err("syntax error in [actions]", e);
            // TODO
            //    throw new Err('syntax error in [actions] - ' + e.message, doc.file, {text, start});
        }

        let names = [];
        let properties = ast.body[0].expression.right.properties;
        properties &&
            properties.forEach(node => {
                if (node.value.type == "ArrowFunctionExpression") {
                    names.push(node.key.name);
                } else if (node.value.type == "FunctionExpression") {
                    // 为了让this安全的指向当前组件对象，把普通函数转换为箭头函数，同时也可避免写那无聊的bind(this)
                    let nd = node.value;
                    nd.type = "ArrowFunctionExpression";
                    names.push(node.key.name);
                }
            });

        let rs = { src: "", names: names };
        if (names.length) {
            names.sort();
            rs.src = astring.generate(ast);
        }

        return rs;
    }
    // ------- d45p-normalize-component-actions end
})();

/* ------- d55p-normalize-component-methods ------- */
(() => {
    // ------- d55p-normalize-component-methods start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const acorn = require("acorn");
    const astring = require("astring");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("d55p-normalize-component-methods", function(root, context) {
                let script = context.script;

                root.walk("RposeBlock", (node, object) => {
                    if (!/^methods$/.test(object.name.value)) return;

                    let methods = object.text ? object.text.value.trim() : "";
                    if (methods) {
                        let rs = generateMethods(methods, object.text.loc);
                        script.methods = rs.src;
                        //                script.$methodkeys = rs.names;
                    }
                    node.remove();
                    return false;
                });
            });
        })()
    );

    // 把对象形式汇总的方法转换成组件对象的一个个方法，同时都直接改成箭头函数（即使function也不确认this，让this指向组件对象）
    function generateMethods(methods, loc) {
        let env = bus.at("编译环境");
        let oCache = bus.at("缓存");
        let cacheKey = JSON.stringify(["generateMethods", methods]);
        if (!env.nocache) {
            let cacheValue = oCache.get(cacheKey);
            if (cacheValue) return cacheValue;
        }

        let code = `oFn               = ${methods}`;
        let ast;
        try {
            ast = acorn.parse(code, { ecmaVersion: 10, sourceType: "module", locations: true });
        } catch (e) {
            // 通常是代码有语法错误
            throw new Err("syntax error in [methods]", e);
            // TODO
        }

        let map = new Map();

        let properties = ast.body[0].expression.right.properties;
        properties &&
            properties.forEach(node => {
                if (node.value.type == "ArrowFunctionExpression") {
                    map.set(node.key.name, "this." + node.key.name + "=" + astring.generate(node.value));
                } else if (node.value.type == "FunctionExpression") {
                    // 为了让this安全的指向当前组件对象，把普通函数转换为箭头函数，同时也可避免写那无聊的bind(this)
                    let arrNode = node.value;
                    arrNode.type = "ArrowFunctionExpression";
                    map.set(node.key.name, "this." + node.key.name + "=" + astring.generate(arrNode));
                }
            });

        let names = [...map.keys()];
        names.sort();

        let rs = { src: "", names: names };
        names.forEach(k => (rs.src += map.get(k) + "\n"));

        return oCache.set(cacheKey, rs);
    }

    // ------- d55p-normalize-component-methods end
})();

/* ------- d75p-init-component-[csslib] ------- */
(() => {
    // ------- d75p-init-component-[csslib] start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 处理 组件配置[csslib]
            // 检查安装建立组件样式库
            return postobject.plugin("d75p-init-component-[csslib]", function(root, context) {
                let prj = bus.at("项目配置处理", context.input.file);
                let oCsslib = (context.result.oCsslib = Object.assign({}, prj.oCsslib || {})); // 项目配置的 oCsslib 合并存放到组件范围缓存起来
                let oCsslibPkgs = (context.result.oCsslibPkgs = Object.assign({}, prj.oCsslibPkgs || {})); // 项目配置的 oCsslibPkgs 合并存放到组件范围缓存起来

                // 遍历树中的csslib节点，建库，处理完后删除该节点
                root.walk("RposeBlock", (node, object) => {
                    if (object.name.value !== "csslib") return;
                    if (!object.text || !object.text.value || !object.text.value.trim()) return;

                    let oKv = bus.at("解析[csslib]", object.text.value, context, object.text.loc);

                    for (let k in oKv) {
                        if (oCsslib[k]) {
                            throw new Err("duplicate csslib name: " + k, {
                                file: context.input.file,
                                text: context.input.text,
                                line: object.text.loc.start.line,
                                column: 1
                            });
                        }
                        oCsslib[k] = bus.at("样式库", `${k}=${oKv[k]}`);
                        oCsslibPkgs[k] = oCsslib[k].pkg;
                    }

                    node.remove();
                    return false;
                });
            });
        })()
    );

    // ------- d75p-init-component-[csslib] end
})();

/* ------- d85p-init-component-[taglib] ------- */
(() => {
    // ------- d85p-init-component-[taglib] start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 处理 [taglib]
            // 和并组件[taglib]以及项目[taglib]成一个新副本存放于context.result.oTaglib
            // 名称重复时报错
            return postobject.plugin("d85p-init-component-[taglib]", function(root, context) {
                let prj = bus.at("项目配置处理", context.input.file);
                let oTaglib = (context.result.oTaglib = Object.assign({}, prj.oTaglib || {})); // 项目配置的[taglib]合并存放到组件范围缓存起来

                // 遍历树中的taglib节点，建库，处理完后删除该节点
                root.walk("RposeBlock", (node, object) => {
                    if (object.name.value !== "taglib") return;
                    if (!object.text || !object.text.value || !object.text.value.trim()) return;

                    let oKv = bus.at("解析[taglib]", object.text.value, context, object.text.loc);

                    // 与项目配置的重复性冲突检查
                    for (let k in oKv) {
                        if (oTaglib[k]) {
                            throw new Err("duplicate taglib name: " + k, {
                                file: context.input.file,
                                text: context.input.text,
                                line: object.text.loc.start.line + oTaglib[k].line,
                                column: 1
                            });
                        }
                    }

                    // 检查安装依赖包
                    let mapPkg = new Map();
                    for (let key in oKv) {
                        mapPkg.set(oKv[key].pkg, oKv[key]);
                    }
                    mapPkg.forEach((oTag, pkg) => {
                        if (!bus.at("自动安装", pkg)) {
                            throw new Err("package install failed: " + pkg, {
                                file: context.input.file,
                                text: context.input.text,
                                line: object.text.loc.start.line + oTag.line,
                                column: 1
                            });
                        }
                    });

                    // 逐个定义标签库关联实际文件
                    for (let key in oKv) {
                        try {
                            bus.at("标签库定义", oKv[key].taglib, context.input.file); // 无法关联时抛出异常
                        } catch (e) {
                            throw new Err.cat(e, {
                                file: context.input.file,
                                text: context.input.text,
                                line: object.text.loc.start.line + oKv[key].line,
                                column: 1
                            });
                        }
                    }

                    node.remove();
                    return false;
                });

                //console.info('-------rs----------', context.input.file, bus.at('标签库定义', '', context.input.file))
            });
        })()
    );

    // ------- d85p-init-component-[taglib] end
})();

/* ------- e00m-view-options ------- */
(() => {
    // ------- e00m-view-options start
    const bus = require("@gotoeasy/bus");

    module.exports = bus.on(
        "视图编译选项",
        (function(options = {}, init) {
            // 模板开始结束符
            options.CodeBlockStart = "{%";
            options.CodeBlockEnd = "%}";
            options.ExpressionStart = "{";
            options.ExpressionEnd = "}";

            // 词素类型
            options.TypeHtmlComment = "HtmlComment";
            options.TypeCodeBlock = "JsCode";
            options.TypeExpression = "Expression";
            options.TypeTagOpen = "TagOpen";
            options.TypeTagClose = "TagClose";
            options.TypeTagSelfClose = "TagSelfClose";
            options.TypeAttributeName = "AttributeName";
            options.TypeAttributeValue = "AttributeValue";
            options.TypeEqual = "=";
            options.TypeText = "Text";
            //  options.TypeCData = 'CData'; // AS Text

            return function(opts) {
                if (!init && opts) {
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
            };
        })()
    );

    // ------- e00m-view-options end
})();

/* ------- e02m-is-expression ------- */
(() => {
    // ------- e02m-is-expression start
    const bus = require("@gotoeasy/bus");

    bus.on(
        "是否表达式",
        (function() {
            const OPTS = bus.at("视图编译选项");

            return function(val) {
                if (!val) return false;

                // TODO 使用常量
                let tmp = val.replace(/\\\{/g, "").replace(/\\\}/g, "");
                return /\{.*\}/.test(tmp);
            };
        })()
    );

    // ------- e02m-is-expression end
})();

/* ------- e10m-view-src-reader ------- */
(() => {
    // ------- e10m-view-src-reader start
    const bus = require("@gotoeasy/bus");

    const SOF = "\u0000"; // HTML解析：开始符
    const EOF = "\uffff"; // HTML解析：结束符

    // ------------ 字符阅读器 ------------
    class CharReader {
        constructor(src) {
            this.ary = src.split("");
            this.maxLength = this.ary.length;
            this.pos = 0;
        }

        skip(len) {
            if (len > 0) {
                this.pos = this.pos + len;
                if (this.pos > this.maxLength) {
                    this.pos = this.maxLength;
                }
            }
            return this.pos;
        }

        skipBlank() {
            // 跳过任何空白
            let rs = "";
            while (/\s/.test(this.getCurrentChar()) && !this.eof()) {
                rs += this.readChar();
            }
            return rs;
        }

        //    setPos(pos){
        //        this.pos = pos;
        //    }

        getPos() {
            return this.pos;
        }

        eof() {
            return this.pos >= this.maxLength;
        }

        readChar() {
            let rs = this.getCurrentChar();
            this.pos < this.maxLength && (this.pos += 1);
            return rs;
        }

        getPrevChar() {
            return this.pos == 0 ? SOF : this.ary[this.pos - 1];
        }
        getCurrentChar() {
            return this.pos >= this.maxLength ? EOF : this.ary[this.pos];
        }
        getNextChar(len = 1) {
            let idx = len < 1 ? 1 : len;
            return this.pos + idx >= this.maxLength ? EOF : this.ary[this.pos + idx];
        }
        getChar(idx = 0) {
            return idx < 0 ? SOF : idx >= this.maxLength ? EOF : this.ary[idx];
        }

        getPrevString(len) {
            return this.getString(this.pos - len, this.pos);
        }
        getString(start, end) {
            let min = start < 0 ? 0 : start >= this.maxLength ? this.maxLength - 1 : start;
            let max = end < 0 ? 0 : end > this.maxLength ? this.maxLength : end;

            let rs = "";
            for (let i = min; i < max; i++) {
                rs += this.ary[i];
            }
            return rs;
        }
        getNextString(len) {
            return this.getString(this.pos, this.pos + len);
        }
    }

    module.exports = bus.on("字符阅读器", function(srcView) {
        return new CharReader(srcView);
    });

    // ------- e10m-view-src-reader end
})();

/* ------- e12m-view-parse-to-tokens ------- */
(() => {
    // ------- e12m-view-parse-to-tokens start
    const bus = require("@gotoeasy/bus");
    const File = require("@gotoeasy/file");
    const Err = require("@gotoeasy/err");

    // 自闭合标签
    const SELF_CLOSE_TAGS = "br,hr,input,img,meta,link,area,base,basefont,bgsound,col,command,isindex,frame,embed,keygen,menuitem,nextid,param,source,track,wbr".split(
        ","
    );

    // TODO 未转义字符引起的解析错误，友好提示

    // \{ = '\u0000\u0001', \} = '\ufffe\uffff'
    function escape(str) {
        return str == null ? null : str.replace(/\\{/g, "\u0000\u0001").replace(/\\}/g, "\ufffe\uffff");
    }
    function unescape(str) {
        return str == null ? null : str.replace(/\u0000\u0001/g, "{").replace(/\ufffe\uffff/g, "}");
    }

    function getLocation(src, startPos, endPos, PosOffset) {
        let ary,
            line,
            start = {},
            end = {};

        ary = src.substring(0, startPos + PosOffset).split("\n");
        start.line = ary.length;
        line = ary.pop();
        start.column = line.length + 1;
        start.pos = PosOffset + startPos;

        ary = src.substring(0, endPos + PosOffset).split("\n");
        end.line = ary.length;
        line = ary.pop();
        end.column = line.length;
        end.pos = PosOffset + endPos;
        if (!line.length) {
            end.line--;
            end.column = ary.pop().length + 1;
        }

        return { start, end };
    }

    function TokenParser(fileText, viewText, file, PosOffset) {
        let src = escape(viewText);
        // ------------ 变量 ------------
        let options = bus.at("视图编译选项");
        let reader = bus.at("字符阅读器", src);
        let tokens = [];

        // ------------ 接口方法 ------------
        // 解析
        this.parse = function() {
            while (parseNode() || parseComment() || parseCdata() || parseCodeBlock() || parseExpression() || parseHighlight() || parseText()) {}
            //while ( parseNode() || parseComment() || parseCdata() || parseCodeBlock() || parseExpression() || parseText() ) {}

            tokens.forEach(token => {
                token.loc = getLocation(fileText, token.pos.start, token.pos.end, PosOffset);
                delete token.pos;
            });
            return tokens;
        };

        // ------------ 内部方法 ------------
        // HTML节点
        function parseNode() {
            let pos = reader.getPos();
            if (
                reader.getCurrentChar() !== "<" ||
                reader.eof() ||
                reader.getNextString(4) === "<!--" ||
                reader.getNextString(9) === "<![CDATA[" ||
                src.indexOf(options.CodeBlockStart, pos) == pos ||
                src.indexOf(options.ExpressionStart, pos) == pos
            ) {
                return 0;
            }

            let token,
                tagNm = "",
                oPos;

            // -------- 标签闭合 --------
            if (reader.getNextString(2) === "</") {
                let idx = src.indexOf(">", pos + 3);
                if (idx < 0) {
                    return 0; // 当前不是节点闭合标签(【</xxx>】)
                } else {
                    oPos = {};
                    oPos.start = reader.getPos();
                    reader.skip(2); // 跳过【</】
                    while (reader.getCurrentChar() !== ">" && !reader.eof()) {
                        tagNm += reader.readChar(); // 只要不是【>】就算标签闭合名
                    }
                    reader.skip(1); // 跳过【>】
                    oPos.end = reader.getPos();

                    token = { type: options.TypeTagClose, value: tagNm.trim(), pos: oPos }; // Token: 闭合标签
                    tokens.push(token);
                    return 1;
                }
            }

            // -------- 标签开始 --------
            // 简单检查格式
            if (reader.getCurrentChar() === "<" && src.indexOf(">", pos + 2) < 0) {
                return 0; // 当前不是节点开始(起始【<】，但后面没有【>】)
            }

            if (!/[a-z]/i.test(reader.getNextChar())) {
                // 标签名需要支持特殊字符时需相应修改
                return 0; // 当前不是节点开始(紧接【<】的不是字母)
            }

            // 节点名
            oPos = {};
            oPos.start = reader.getPos();
            reader.skip(1); // 跳过起始【<】
            while (/[^\s\/>]/.test(reader.getCurrentChar())) {
                tagNm += reader.readChar(); // 非空白都按名称处理
            }

            let tokenTagNm = { type: "", value: unescape(tagNm).trim(), pos: oPos }; // Token: 标签 (类型待后续解析更新)
            tokens.push(tokenTagNm);

            // 全部属性
            while (parseAttr()) {}

            // 跳过空白
            reader.skipBlank();

            // 检查标签结束符
            if (reader.getNextString(2) === "/>") {
                // 无内容的自闭合标签，如<one-tag/>
                tokenTagNm.type = options.TypeTagSelfClose; // 更新 Token: 标签
                reader.skip(2); // 跳过【/>】
                oPos.end = reader.getPos();
                return 1;
            }

            if (reader.getCurrentChar() === ">") {
                // 默认可以自闭合的标签（如<br>）
                if (SELF_CLOSE_TAGS.includes(tagNm.toLowerCase())) {
                    tokenTagNm.type = options.TypeTagSelfClose; // 更新 Token: 标签
                } else {
                    tokenTagNm.type = options.TypeTagOpen; // 更新 Token: 标签
                }

                reader.skip(1); // 跳过【>】
                oPos.end = reader.getPos();
                return 1;
            }

            // 前面已检查，不应该走到这里
            throw new Err('tag missing ">"', "file=" + file, { text: fileText, start: oPos.start + PosOffset });
        }

        // HTML节点属性
        function parseAttr() {
            if (reader.eof()) {
                return 0;
            }

            // 跳过空白
            reader.skipBlank();
            let oPos = {};
            oPos.start = reader.getPos();

            // 读取属性名
            let key = "",
                val = "";
            if (reader.getCurrentChar() === "{") {
                // TODO 根据配置符号判断, 考虑误解析情况
                let stack = [];
                key += reader.readChar(); // 表达式开始
                while (!reader.eof()) {
                    if (reader.getCurrentChar() === "{") {
                        if (reader.getPrevChar() !== "\\") {
                            stack.push("{"); // TODO 表达式中支持写{....}, 但字符串包含表达式符号将引起混乱误解析，编写时应避免
                        }
                    }
                    if (reader.getCurrentChar() === "}") {
                        if (reader.getPrevChar() !== "\\") {
                            if (!stack.length) {
                                // 表达式结束
                                key += reader.readChar();
                                break; // 退出循环
                            }
                            stack.pop();
                        }
                    }
                    key += reader.readChar();
                }
                if (!key) return 0;
            } else {
                while (/[^\s=\/>]/.test(reader.getCurrentChar())) {
                    key += reader.readChar(); // 只要不是【空白、等号、斜杠、大于号】就算属性名
                }
                if (!key) return 0;
            }

            oPos.end = reader.getPos();

            let token = { type: options.TypeAttributeName, value: unescape(key), pos: oPos }; // Token: 属性名
            tokens.push(token);

            // 跳过空白
            reader.skipBlank();
            oPos = {};
            oPos.start = reader.getPos();

            if (reader.getCurrentChar() === "=") {
                oPos.end = reader.getPos() + 1;
                token = { type: options.TypeEqual, value: "=", pos: oPos }; // Token: 属性等号
                tokens.push(token);

                // --------- 键值属性 ---------
                let PosEqual = reader.getPos() + PosOffset + 1;
                reader.skip(1); // 跳过等号
                reader.skipBlank(); // 跳过等号右边空白
                oPos = {};
                oPos.start = reader.getPos();

                if (reader.getCurrentChar() === '"') {
                    // 值由双引号包围
                    reader.skip(1); // 跳过左双引号
                    let posStart = reader.getPos();
                    while (!reader.eof() && reader.getCurrentChar() !== '"') {
                        let ch = reader.readChar();
                        ch !== "\r" && ch !== "\n" && (val += ch); // 忽略回车换行，其他只要不是【"】就算属性值
                    }

                    if (reader.eof() || reader.getCurrentChar() !== '"') {
                        // 属性值漏一个双引号，如<tag aaa=" />
                        throw new Err('invalid attribute value format (missing ")', "file=" + file, {
                            text: fileText,
                            start: PosEqual,
                            end: posStart + PosOffset
                        });
                    }

                    reader.skip(1); // 跳过右双引号
                    oPos.end = reader.getPos();

                    token = { type: options.TypeAttributeValue, value: unescape(val), pos: oPos }; // Token: 属性值(属性值中包含表达式组合的情况，在syntax-ast-gen中处理)
                    tokens.push(token);
                } else if (reader.getCurrentChar() === "'") {
                    // 值由单引号包围
                    reader.skip(1); // 跳过左单引号
                    let posStart = reader.getPos();
                    while (!reader.eof() && reader.getCurrentChar() !== "'") {
                        let ch = reader.readChar();
                        ch != "\r" && ch != "\n" && (val += ch); // 忽略回车换行，其他只要不是【'】就算属性值
                    }

                    if (reader.eof() || reader.getCurrentChar() !== "'") {
                        // 属性值漏一个单引号，如<tag aaa=' />
                        throw new Err("invalid attribute value format (missing ')", "file=" + file, {
                            text: fileText,
                            start: PosEqual,
                            end: posStart + PosOffset
                        });
                    }

                    reader.skip(1); // 跳过右单引号
                    oPos.end = reader.getPos();

                    token = { type: options.TypeAttributeValue, value: unescape(val), pos: oPos }; // Token: 属性值(属性值中包含表达式组合的情况，在syntax-ast-gen中处理)
                    tokens.push(token);
                } else if (reader.getCurrentChar() === "{") {
                    // 值省略引号包围
                    let stack = [];
                    let posStart = reader.getPos() + 1;
                    while (!reader.eof()) {
                        if (reader.getCurrentChar() === "{") {
                            stack.push("{");
                        } else if (reader.getCurrentChar() === "}") {
                            if (!stack.length) {
                                break;
                            } else if (stack.length === 1) {
                                val += reader.readChar(); // 表达式结束
                                break;
                            } else {
                                stack.pop();
                            }
                        }
                        val += reader.readChar(); // 只要不是【'】就算属性值
                    }
                    if (reader.eof()) {
                        // 属性值漏，如<tag aaa={ />
                        throw new Err("invalid attribute value format (missing })", "file=" + file, {
                            text: fileText,
                            start: PosEqual,
                            end: posStart + PosOffset
                        });
                    }
                    oPos.end = reader.getPos();
                    token = { type: options.TypeAttributeValue, value: unescape(val), pos: oPos }; // Token: 属性值
                    tokens.push(token);
                } else {
                    // 值应该是单纯数值
                    while (/[^\s\/>]/.test(reader.getCurrentChar())) {
                        val += reader.readChar(); // 连续可见字符就放进去
                    }

                    if (!val) {
                        // 属性值漏，如<tag aaa= />
                        throw new Err("missing attribute value", "file=" + file, { text: fileText, start: PosEqual, end: PosEqual + 1 });
                    }
                    if (!/^(\d+|\d+\.?\d+)$/.test(val)) {
                        // 属性值不带引号或大括号，应该是单纯数值，如果不是则报错，如<tag aaa=00xxx  />
                        throw new Err("invalid attribute value", "file=" + file, {
                            text: fileText,
                            start: PosEqual,
                            end: reader.getPos() + PosOffset
                        });
                    }

                    oPos.end = reader.getPos();
                    token = { type: options.TypeAttributeValue, value: val - 0, pos: oPos }; // Token: 属性值
                    tokens.push(token);
                }
            } else {
                // --------- boolean型无值属性 ---------
            }

            return 1;
        }

        // HTML注释
        function parseComment() {
            let token,
                pos = reader.getPos();
            let idxStart = src.indexOf("<!--", pos),
                idxEnd = src.indexOf("-->", pos + 4);
            if (idxStart === pos && idxEnd > pos) {
                // 起始为【<!--】且后面有【-->】
                let oPos = {};
                oPos.start = idxStart;
                oPos.end = idxEnd + 3;
                token = { type: options.TypeHtmlComment, value: unescape(src.substring(pos + 4, idxEnd)), pos: oPos }; // Token: HTML注释
                reader.skip(idxEnd + 3 - pos); // 位置更新

                tokens.push(token);
                return 1;
            }

            return 0;
        }

        // CDATA，转换为文本及表达式组合
        function parseCdata() {
            let token,
                pos = reader.getPos();
            let idxStart = src.indexOf("<![CDATA[", pos),
                idxEnd = src.indexOf("]]>", pos + 9);
            if (idxStart === pos && idxEnd > pos) {
                // 起始为【<![CDATA[】且后面有【]]>】
                let oPos = {};
                oPos.start = idxStart;
                oPos.end = idxEnd + 3;
                let value = escape(src.substring(pos + 9, idxEnd));
                reader.skip(idxEnd + 3 - pos); // 位置更新

                if (!/\{.*?}/.test(value)) {
                    // 不含表达式
                    token = { type: options.TypeText, value, pos: oPos }; // Token: 无表达式的文本
                    tokens.push(token);
                } else {
                    let idx1,
                        idx2,
                        txt,
                        iStart = idxStart + 9,
                        oPosTxt;
                    while ((idx1 = value.indexOf("{")) >= 0 && (idx2 = value.indexOf("}", idx1)) > 0) {
                        if (idx1 > 0) {
                            txt = unescape(value.substring(0, idx1));
                            oPosTxt = { start: iStart, end: iStart + txt.length };
                            iStart = oPosTxt.end;
                            token = { type: options.TypeText, value: txt, pos: oPosTxt }; // Token: 无表达式的文本
                            tokens.push(token);
                        }

                        txt = unescape(value.substring(idx1, idx2 + 1));
                        oPosTxt = { start: iStart, end: iStart + txt.length };
                        iStart = oPosTxt.end;
                        token = { type: options.TypeExpression, value: txt, pos: oPosTxt }; // Token: 表达式文本
                        tokens.push(token);
                        value = value.substring(idx2 + 1);
                    }
                    if (value) {
                        txt = unescape(value);
                        oPosTxt = { start: iStart, end: iStart + txt.length };
                        iStart = oPosTxt.end;
                        token = { type: options.TypeText, value: txt, pos: oPosTxt }; // Token: 无表达式的文本
                        tokens.push(token);
                    }
                }

                return 1;
            }

            return 0;
        }

        // 代码高亮 ```
        function parseHighlight() {
            let pos = reader.getPos(),
                start,
                end;
            if (!((pos === 0 || reader.getPrevChar() === "\n") && src.indexOf("```", pos) === pos && src.indexOf("\n```", pos + 3) > 0)) {
                // 当前位置开始不是代码高亮块时，跳出不用处理
                return 0;
            }

            let str = src.substring(pos);
            let rs = /(^```[\s\S]*?\r?\n)([\s\S]*?)\r?\n```[\s\S]*?\r?(\n|$)/.exec(str);
            let len = rs[0].length;

            // 【Token】 <```>
            let token,
                oPos = {};
            start = pos;
            end = pos + len;
            token = { type: options.TypeTagSelfClose, value: "```", pos: { start, end } }; // Token: 代码标签
            tokens.push(token);

            // 【Token】 lang
            let match = rs[1].match(/\b\w*\b/); // 语言（开始行中的单词，可选）
            let lang = match ? match[0].toLowerCase() : "";
            if (lang) {
                start = pos + match.index;
                end = start + lang.length;
                token = { type: options.TypeAttributeName, value: "lang", pos: { start, end } };
                tokens.push(token);
                token = { type: options.TypeEqual, value: "=", pos: { start, end } };
                tokens.push(token);
                token = { type: options.TypeAttributeValue, value: lang, pos: { start, end } };
                tokens.push(token);
            }

            // 【Token】 height
            match = rs[1].match(/\b\d+(\%|px)/i); // 带单位（%或px）的高度
            let height;
            if (match) {
                height = match[0];
            } else {
                match = rs[1].match(/\b\d+/i); // 不带单位的高度（开始行中的数字，可选）
                match && (height = match[0]);
            }
            if (height) {
                start = pos + match.index;
                end = start + height.length;
                token = { type: options.TypeAttributeName, value: "height", pos: { start, end } };
                tokens.push(token);
                token = { type: options.TypeEqual, value: "=", pos: { start, end } };
                tokens.push(token);
                height = /^\d+$/.test(height) ? height + "px" : height; // 默认单位px
                token = { type: options.TypeAttributeValue, value: height, pos: { start, end } };
                tokens.push(token);
            }

            // 【Token】 ref                                         // ???? TODO ...............................
            match = rs[1].match(/\bref\s?=\s?"(.*?)"/i);
            let ref = match && match[0] ? match[0] : "";
            if (ref) {
                token = { type: options.TypeAttributeName, value: "ref", pos: { start, end } };
                tokens.push(token);
                token = { type: options.TypeEqual, value: "=", pos: { start, end } };
                tokens.push(token);
                token = { type: options.TypeAttributeValue, value: ref, pos: { start, end } };
                tokens.push(token);
            }

            // 【Token】 $CODE
            let $CODE = rs[2].replace(/\u0000\u0001/g, "\\{").replace(/\ufffe\uffff/g, "\\}"); // 转义，确保值为原输入
            $CODE = $CODE.replace(/\n\\+```/g, match => "\n" + match.substring(2)); // 删除一个转义斜杠     \n\``` => \n``` ，  \n\\``` => \n\```
            /^\\+```/.test($CODE) && ($CODE = $CODE.substring(1)); // 删除一个转义斜杠     \``` => ``` ，  \\``` => \```

            // 属性值中的大括号会被当做表达式字符解析，需要转义掉
            $CODE = $CODE.replace(/\{/g, "\\{").replace(/\}/g, "\\}");

            start = pos + rs[1].length;
            end = start + rs[2].length;
            token = { type: options.TypeAttributeName, value: "$CODE", pos: { start, end } };
            tokens.push(token);
            token = { type: options.TypeEqual, value: "=", pos: { start, end } };
            tokens.push(token);
            token = { type: options.TypeAttributeValue, value: $CODE, pos: { start, end } };
            tokens.push(token);

            reader.skip(len); // 位置更新
            return 1;
        }

        // 代码块 {% %}
        function parseCodeBlock() {
            let token,
                pos = reader.getPos();
            let idxStart = src.indexOf(options.CodeBlockStart, pos),
                idxEnd = src.indexOf(options.CodeBlockEnd, pos + options.CodeBlockStart.length);
            if (idxStart === pos && idxEnd > 0) {
                // 起始为【{%】且后面有【%}】
                let oPos = {};
                oPos.start = idxStart;
                oPos.end = idxEnd + options.CodeBlockEnd.length;
                token = { type: options.TypeCodeBlock, value: unescape(src.substring(pos + options.CodeBlockStart.length, idxEnd)), pos: oPos }; // Token: 代码块
                reader.skip(idxEnd + options.CodeBlockEnd.length - pos); // 位置更新

                tokens.push(token);
                return 1;
            }

            return 0;
        }

        // 文本
        function parseText() {
            if (reader.eof()) {
                return 0;
            }
            let oPos = {};
            oPos.start = reader.getPos();

            let token,
                text = "",
                pos;
            while (!reader.eof()) {
                text += reader.readChar();
                pos = reader.getPos();

                if (
                    reader.getCurrentChar() === "<" ||
                    reader.getNextString(3) === "```" ||
                    src.indexOf(options.CodeBlockStart, pos) === pos ||
                    src.indexOf(options.ExpressionStart, pos) === pos
                ) {
                    break; // 见起始符则停
                }
            }

            if (text) {
                oPos.end = reader.getPos();
                token = { type: options.TypeText, value: unescape(text), pos: oPos }; // Token: 文本
                tokens.push(token);
                return 1;
            }

            return 0;
        }

        // 表达式 { }
        function parseExpression() {
            if (reader.eof()) {
                return 0;
            }

            let token;
            let oPos = {};
            oPos.start = reader.getPos();
            token = parseExpr();

            if (token) {
                oPos.end = reader.getPos();
                token.pos = oPos;
                tokens.push(token);
                return 1;
            }
            return 0;
        }

        function parseExpr() {
            let pos = reader.getPos();
            let idxStart = src.indexOf(options.ExpressionStart, pos),
                idxEnd = src.indexOf(options.ExpressionEnd, pos + options.ExpressionStart.length);
            if (idxStart === pos && idxEnd > 0) {
                let rs = { type: options.TypeExpression, value: unescape(src.substring(pos, idxEnd + options.ExpressionEnd.length)) }; // Token: 表达式(保留原样)
                reader.skip(idxEnd + options.ExpressionEnd.length - pos); // 位置更新
                return rs;
            }
            return null;
        }
    }

    bus.on("视图TOKEN解析器", function(fileText, srcView, file, PosOffset) {
        return new TokenParser(fileText, srcView, file, PosOffset);
    });

    // ------- e12m-view-parse-to-tokens end
})();

/* ------- e15p-parse-view-tokens-to-ast ------- */
(() => {
    // ------- e15p-parse-view-tokens-to-ast start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("e15p-parse-view-tokens-to-ast", function(root, context) {
                root.walk("RposeBlock", (node, object) => {
                    if (!/^view$/.test(object.name.value)) return;

                    let view = object.text ? object.text.value : "";
                    if (!view) return node.remove();

                    let tokenParser = bus.at("视图TOKEN解析器", context.input.text, view, context.input.file, object.text.loc.start.pos);
                    let type = "View";
                    let src = view;
                    let loc = object.text.loc;
                    let nodes = tokenParser.parse();
                    let objToken = { type, src, loc, nodes };

                    let nodeToken = this.createNode(objToken);
                    node.replaceWith(nodeToken);
                });
            });
        })()
    );

    // ------- e15p-parse-view-tokens-to-ast end
})();

/* ------- f15p-astedit-normalize-group-attribute ------- */
(() => {
    // ------- f15p-astedit-normalize-group-attribute start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 合并属性到新的Attributes节点
            // 属性值Attribute节点的数据对象中，添加 isExpresstion 标记
            return postobject.plugin("f15p-astedit-normalize-group-attribute", function(root, context) {
                const OPTS = bus.at("视图编译选项");

                // 键=值的三个节点，以及单一键节点，统一转换为一个属性节点
                root.walk(OPTS.TypeAttributeName, (node, object) => {
                    let eqNode = node.after();
                    if (eqNode && eqNode.type === OPTS.TypeEqual) {
                        // 键=值的三个节点
                        let valNode = eqNode.after();
                        if (!valNode || !valNode.type === OPTS.TypeAttributeValue) {
                            throw new Err("missing attribute value"); // 已检查过，不应该出现
                        }

                        if (bus.at("是否表达式", object.value)) {
                            // 键值属性的属性名不支持表达式
                            throw new Err("unsupport expression on attribute name", {
                                file: context.input.file,
                                text: context.input.text,
                                start: object.loc.start.pos,
                                end: object.loc.end.pos
                            });
                        }

                        if (/^\s*\{\s*\}\s*$/.test(valNode.object.value)) {
                            // 属性值的表达式不能为空白
                            throw new Err("invalid empty expression", {
                                file: context.input.file,
                                text: context.input.text,
                                start: valNode.object.loc.start.pos,
                                end: valNode.object.loc.end.pos
                            });
                        }

                        let oAttr = {
                            type: "Attribute",
                            name: object.value,
                            value: valNode.object.value,
                            isExpression: bus.at("是否表达式", valNode.object.value),
                            loc: { start: object.loc.start, end: valNode.object.loc.end }
                        };
                        let attrNode = this.createNode(oAttr);
                        node.replaceWith(attrNode);
                        eqNode.remove();
                        valNode.remove();
                    } else {
                        // 单一键节点
                        let oAttr = { type: "Attribute", name: object.value, value: true, isExpression: false, loc: object.loc };
                        if (bus.at("是否表达式", object.value)) {
                            oAttr.isExpression = true; // 对象表达式
                            oAttr.isObjectExpression = true; // 对象表达式
                            delete oAttr.value; // 无值的对象表达式，如 <div {prop}>
                        }
                        let attrNode = this.createNode(oAttr);
                        node.replaceWith(attrNode);
                    }
                });

                // 多个属性节点合并为一个标签属性节点
                root.walk("Attribute", (node, object) => {
                    if (!node.parent) return; // 跳过已删除节点

                    let ary = [node];
                    let nextNode = node.after();
                    while (nextNode && nextNode.type === "Attribute") {
                        ary.push(nextNode);
                        nextNode = nextNode.after();
                    }

                    let attrsNode = this.createNode({ type: "Attributes" });
                    node.before(attrsNode);
                    ary.forEach(n => {
                        attrsNode.addChild(n.clone());
                        n.remove();
                    });
                });
            });
        })()
    );

    // ------- f15p-astedit-normalize-group-attribute end
})();

/* ------- f25p-astedit-normolize-tag-of-self-close ------- */
(() => {
    // ------- f25p-astedit-normolize-tag-of-self-close start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            // 自关闭标签统一转换为Tag类型节点
            return postobject.plugin("f25p-astedit-normolize-tag-of-self-close", function(root, context) {
                const OPTS = bus.at("视图编译选项");

                root.walk(OPTS.TypeTagSelfClose, (node, object) => {
                    let type = "Tag";
                    let value = object.value;
                    let loc = object.loc;
                    let tagNode = this.createNode({ type, value, loc });

                    let tagAttrsNode = node.after();
                    if (tagAttrsNode && tagAttrsNode.type === "Attributes") {
                        tagNode.addChild(tagAttrsNode.clone());
                        tagAttrsNode.remove();
                    }

                    node.replaceWith(tagNode);
                });
            });
        })()
    );

    // ------- f25p-astedit-normolize-tag-of-self-close end
})();

/* ------- f35p-astedit-normolize-tag-of-open-close ------- */
(() => {
    // ------- f35p-astedit-normolize-tag-of-open-close start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 开闭标签统一转换为Tag类型节点
            return postobject.plugin("f35p-astedit-normolize-tag-of-open-close", function(root, context) {
                const OPTS = bus.at("视图编译选项");

                let normolizeTagNode = (tagNode, nodeTagOpen) => {
                    let nextNode = nodeTagOpen.after();
                    while (nextNode && nextNode.type !== OPTS.TypeTagClose) {
                        if (nextNode.type === OPTS.TypeTagOpen) {
                            let type = "Tag";
                            let value = nextNode.object.value;
                            let loc = nextNode.object.loc;
                            let subTagNode = this.createNode({ type, value, loc });
                            normolizeTagNode(subTagNode, nextNode);

                            tagNode.addChild(subTagNode);
                        } else {
                            tagNode.addChild(nextNode.clone());
                        }

                        nextNode.remove();
                        nextNode = nodeTagOpen.after();
                    }

                    if (!nextNode) {
                        throw new Err("missing close tag", "file=" + context.input.file, {
                            text: context.input.text,
                            start: tagNode.object.loc.start.pos
                        });
                    }

                    if (nextNode.type === OPTS.TypeTagClose) {
                        if (nodeTagOpen.object.value !== nextNode.object.value) {
                            throw new Err(`unmatch close tag: ${nodeTagOpen.object.value}/${nextNode.object.value}`, "file=" + context.input.file, {
                                text: context.input.text,
                                start: tagNode.object.loc.start.pos,
                                end: nextNode.object.loc.end.pos
                            });
                        }
                        tagNode.object.loc.end = nextNode.object.loc.end;
                        nextNode.remove();
                        return tagNode;
                    }

                    // 漏考虑的特殊情况
                    throw new Error("todo unhandle type");
                };

                root.walk(OPTS.TypeTagOpen, (node, object) => {
                    if (!node.parent) return;

                    let type = "Tag";
                    let value = object.value;
                    let loc = object.loc;
                    let tagNode = this.createNode({ type, value, loc });
                    normolizeTagNode(tagNode, node);

                    node.replaceWith(tagNode);
                });
            });
        })()
    );

    // ------- f35p-astedit-normolize-tag-of-open-close end
})();

/* ------- f40m-highlight-file-parser-btf ------- */
(() => {
    // ------- f40m-highlight-file-parser-btf start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "BTF内容解析",
        (function() {
            return function(text) {
                let LF = text.indexOf("\r\n") >= 0 ? "\r\n" : "\n";
                let lines = text.split(LF);

                let tokens = [];
                parse(tokens, lines);

                tokens.forEach(token => {
                    if (token.type === "BlockText") {
                        token.value = token.value.join(LF);
                    }
                });

                return tokens;
            };
        })()
    );

    function parse(tokens, lines) {
        let sLine,
            oName,
            comment,
            blockStart = false;
        for (let i = 0; i < lines.length; i++) {
            sLine = lines[i];

            if (isBlockStart(sLine)) {
                oName = getBlockName(sLine);
                comment = sLine.substring(oName.len + 2);
                tokens.push({ type: "BlockName", name: oName.name, comment: comment }); // 名称不含中括号
                blockStart = true;
            } else if (isBlockEnd(sLine)) {
                tokens.push({ type: "Comment", value: sLine });
                blockStart = false;
            } else if (isDocumentEnd(sLine)) {
                tokens.push({ type: "Comment", value: sLine });
                blockStart = false;
            } else {
                if (blockStart) {
                    // text line
                    if (tokens[tokens.length - 1].type !== "BlockText") {
                        tokens.push({ type: "BlockText", name: tokens[tokens.length - 1].name, value: [] });
                    }
                    let oBlockText = tokens[tokens.length - 1];
                    oBlockText.value.push(sLine);
                } else {
                    // ignore line
                    tokens.push({ type: "Comment", value: sLine });
                }
            }
        }
    }

    function isBlockStart(sLine) {
        return sLine.startsWith("[") && sLine.indexOf("]") > 0;
    }

    function isBlockEnd(sLine) {
        return sLine.startsWith("---------");
    }

    function isDocumentEnd(sLine) {
        return sLine.startsWith("=========");
    }

    function getBlockName(sLine) {
        let name, len;
        for (let i = 1; i < sLine.length; i++) {
            if (sLine.charAt(i - 1) !== "\\" && sLine.charAt(i) === "]") {
                name = sLine.substring(1, i).toLowerCase();
                len = name.length;
                return { name, len };
            }
        }

        name = sLine.substring(1, sLine.lastIndexOf("]")).toLowerCase();
        len = name.length;
        return { name, len };
    }

    // ------- f40m-highlight-file-parser-btf end
})();

/* ------- f42m-highlight-$code-of-``` ------- */
(() => {
    // ------- f42m-highlight-$code-of-``` start
    const bus = require("@gotoeasy/bus");
    const refractor = require("refractor");
    const rehype = require("rehype");

    // --------------------------------------------
    // 自定义 inilike 高亮规则，分隔符为等号、冒号
    // --------------------------------------------
    inilike.displayName = "inilike";
    inilike.aliases = [];
    function inilike(Prism) {
        Prism.languages.inilike = {
            constant: /^[ \t]*[^\s=:]+?(?=[ \t]*[=:])/m,
            "attr-value": { pattern: /(=|:).*/, inside: { punctuation: /^(=|:)/ } }
        };
    }
    refractor.register(inilike);
    // --------------------------------------------

    bus.on(
        "语法高亮转换",
        (function(tagpkgHighlight = "@rpose/buildin:```", oClass) {
            return function(code = "", lang = "clike") {
                // 取语法高亮组件文件的绝对地址，用于哈希语法高亮的样式类
                if (!oClass) {
                    oClass = {};
                    oClass["token"] = bus.at("哈希样式类名", tagpkgHighlight, "token");
                    oClass["comment"] = bus.at("哈希样式类名", tagpkgHighlight, "comment");
                    oClass["selector"] = bus.at("哈希样式类名", tagpkgHighlight, "selector");
                }

                // 特殊处理btf、rpose格式代码
                if (/^(btf|rpose)$/i.test(lang)) {
                    let html = highlightBtfLike(code);
                    return "<ol><li>" + html.split(/\r?\n/).join("</li><li>") + "</li></ol>";
                }

                // 转换改为 <ol><li> 形式显示
                !refractor.registered(lang) && (lang = "clike"); // 不支持的语言，默认按 clike 处理
                let html = highlight(code, lang);
                return "<ol><li>" + html.split(/\r?\n/).join("</li><li>") + "</li></ol>";
            };

            function highlightBtfLike(code) {
                let html = [];
                let tokens = bus.at("BTF内容解析", code);
                tokens.forEach(token => {
                    if (token.type === "BlockName") {
                        html.push(btfBlockName("[" + token.name + "]") + btfComment(token.comment));
                    } else if (token.type === "BlockText") {
                        let lang = token.name;
                        if (!refractor.registered(lang)) {
                            if (/^(actions|methods|options|state)$/i.test(lang)) {
                                lang = "js";
                            } else if (/^view$/i.test(lang)) {
                                lang = "markup";
                            } else {
                                lang = "inilike";
                            }
                        }
                        html.push(highlight(token.value, lang));
                    } else if (token.type === "Comment") {
                        html.push(btfComment(token.value));
                    } else {
                        throw new Error("unknow type");
                    }
                });
                return html.join("\n");
            }

            function btfComment(code) {
                return code
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/(\S+.*)/g, `<span class="${oClass["token"]} ${oClass["comment"]}">$1</span>`); // 注释
            }
            function btfBlockName(code) {
                return code
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/(.*)/g, `<span class="${oClass["token"]} ${oClass["selector"]}">$1</span>`); // 块名
            }

            function highlight(code, lang) {
                let nodes = refractor.highlight(code, lang);
                renameClassName(nodes); // 修改类名
                return rehype()
                    .stringify({ type: "root", children: nodes })
                    .toString();
            }

            function renameClassName(nodes) {
                nodes &&
                    nodes.forEach(node => {
                        if (node.properties && node.properties.className) {
                            let classes = [];
                            node.properties.className.forEach(cls => {
                                !oClass[cls] && (oClass[cls] = bus.at("哈希样式类名", tagpkgHighlight, cls)); // 缓存
                                classes.push(oClass[cls]);
                            });
                            node.properties.className = classes;
                        }
                        renameClassName(node.children);
                    });
            }
        })()
    );

    // ------- f42m-highlight-$code-of-``` end
})();

/* ------- f45p-astedit-transform-tag-``` ------- */
(() => {
    // ------- f45p-astedit-transform-tag-``` start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 给```节点添加@taglib指令
            return postobject.plugin("f45p-astedit-transform-tag-```", function(root, context) {
                root.walk("Tag", (node, object) => {
                    if (object.value !== "```") return;

                    // 查找Attributes，没找到则创建
                    let attrsNode;
                    for (let i = 0, nd; (nd = node.nodes[i++]); ) {
                        if (nd.type === "Attributes") {
                            attrsNode = nd; // 因为固定有代码属性$CODE，一定能找到Attributes
                            break;
                        }
                    }

                    // 查找代码属性$CODE
                    let codeNode, lang;
                    for (let i = 0, nd; (nd = attrsNode.nodes[i++]); ) {
                        if (nd.object.name === "$CODE") {
                            codeNode = nd;
                            nd.object.value = nd.object.value.replace(/\\\{/g, "{").replace(/\\\}/g, "}"); // 表达式转义还原
                        } else if (nd.object.name === "lang") {
                            lang = nd.object.value;
                        }
                    }
                    codeNode.object.value = bus.at("语法高亮转换", codeNode.object.value, lang); // 代码转换为语法高亮的html

                    // 添加@taglib属性
                    let taglibNode = this.createNode({ type: "Attribute" });
                    taglibNode.object.name = "@taglib";
                    taglibNode.object.value = "@rpose/buildin:```";
                    let loc = Object.assign({}, object.loc);
                    loc.end.line = loc.start.line;
                    loc.end.column = 3;
                    loc.end.pos = loc.start.pos + 3;
                    taglibNode.object.loc = loc;
                    attrsNode.addChild(taglibNode);
                });
            });
        })()
    );

    // ------- f45p-astedit-transform-tag-``` end
})();

/* ------- f55p-astedit-normolize-flag-is-svg-tag ------- */
(() => {
    // ------- f55p-astedit-normolize-flag-is-svg-tag start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            // 判断是否为SVG标签或SVG子标签，并加上标记
            return postobject.plugin("f55p-astedit-normolize-flag-is-svg-tag", function(root, context) {
                root.walk(
                    "Tag",
                    (node, object) => {
                        if (!/^svg$/i.test(object.value)) return;

                        // 当前节点时SVG标签，打上标记
                        object.svg = true;

                        // 子节点都加上SVG标记
                        node.walk(
                            "Tag",
                            (nd, obj) => {
                                obj.svg = true;
                            },
                            { readonly: true }
                        );
                    },
                    { readonly: true }
                );
            });
        })()
    );

    // ------- f55p-astedit-normolize-flag-is-svg-tag end
})();

/* ------- f65p-astedit-normolize-flag-is-standard-tag ------- */
(() => {
    // ------- f65p-astedit-normolize-flag-is-standard-tag start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    const REG_TAGS = /^(html|link|meta|style|title|address|article|aside|footer|header|h1|h2|h3|h4|h5|h6|hgroup|main|nav|section|blockquote|dd|dir|div|dl|dt|figcaption|figure|hr|li|ol|p|pre|ul|a|abbr|b|bdi|bdo|br|cite|code|data|dfn|em|i|kbd|mark|q|rb|rbc|rp|rt|rtc|ruby|s|samp|small|span|strong|sub|sup|time|tt|u|var|wbr|area|audio|img|map|track|video|applet|embed|iframe|noembed|object|param|picture|source|canvas|noscript|script|del|ins|caption|col|colgroup|table|tbody|td|tfoot|th|thead|tr|button|datalist|fieldset|form|input|label|legend|meter|optgroup|option|output|progress|select|textarea|details|dialog|menu|menuitem|summary|content|element|shadow|slot|template|acronym|basefont|bgsound|big|blink|center|command|font|frame|frameset|image|isindex|keygen|listing|marquee|multicol|nextid|nobr|noframes|plaintext|spacer|strike|xmp|head|base|body|math|svg)$/i;

    bus.on(
        "编译插件",
        (function() {
            // 判断是否为标准标签，并加上标记
            return postobject.plugin("f65p-astedit-normolize-flag-is-standard-tag", function(root, context) {
                root.walk(
                    "Tag",
                    (node, object) => {
                        object.standard = !!object.svg || REG_TAGS.test(object.value); // svg及其子标签都是标准标签
                    },
                    { readonly: true }
                );
            });
        })()
    );

    // ------- f65p-astedit-normolize-flag-is-standard-tag end
})();

/* ------- g15p-astedit-group-attribtue-{prop} ------- */
(() => {
    // ------- g15p-astedit-group-attribtue-{prop} start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            // 处理标签中指定类型的属性，提取后新建节点管理
            // 无属性值的对象表达式统一分组，如< div {prop1} {prop2} >
            // 标签节点下新建ObjectExpressionAttributes节点存放
            return postobject.plugin("g15p-astedit-group-attribtue-{prop}", function(root, context) {
                root.walk("Tag", (node, object) => {
                    if (!node.nodes || !node.nodes.length) return; // 节点没有定义属性，跳过

                    // 查找Attributes
                    let attrsNode;
                    for (let i = 0, nd; (nd = node.nodes[i++]); ) {
                        if (nd.type === "Attributes") {
                            attrsNode = nd;
                            break;
                        }
                    }
                    if (!attrsNode || !attrsNode.nodes || !attrsNode.nodes.length) return; // 节点没有定义属性，跳过

                    // 查找目标属性节点
                    let ary = [];
                    attrsNode.nodes.forEach(nd => {
                        nd.object.isObjectExpression && ary.push(nd); // 找到对象表达式 （astedit-normalize-group-attribute中已统一整理）
                    });

                    if (!ary.length) return; // 没有找到相关节点，跳过

                    // 创建节点保存
                    let groupNode = this.createNode({ type: "ObjectExpressionAttributes" });
                    ary.forEach(nd => {
                        let cNode = nd.clone();
                        cNode.type = "ObjectExpressionAttribute";
                        cNode.object.type = "ObjectExpressionAttribute";
                        groupNode.addChild(cNode);
                        nd.remove(); // 删除节点
                    });
                    node.addChild(groupNode);
                });
            });
        })()
    );

    // ------- g15p-astedit-group-attribtue-{prop} end
})();

/* ------- g25p-astedit-group-attribtue-events ------- */
(() => {
    // ------- g25p-astedit-group-attribtue-events start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    // HTML标准所定义的全部标签事件
    const REG_EVENTS = /^(onclick|onchange|onabort|onafterprint|onbeforeprint|onbeforeunload|onblur|oncanplay|oncanplaythrough|oncontextmenu|oncopy|oncut|ondblclick|ondrag|ondragend|ondragenter|ondragleave|ondragover|ondragstart|ondrop|ondurationchange|onemptied|onended|onerror|onfocus|onfocusin|onfocusout|onformchange|onforminput|onhashchange|oninput|oninvalid|onkeydown|onkeypress|onkeyup|onload|onloadeddata|onloadedmetadata|onloadstart|onmousedown|onmouseenter|onmouseleave|onmousemove|onmouseout|onmouseover|onmouseup|onmousewheel|onoffline|ononline|onpagehide|onpageshow|onpaste|onpause|onplay|onplaying|onprogress|onratechange|onreadystatechange|onreset|onresize|onscroll|onsearch|onseeked|onseeking|onselect|onshow|onstalled|onsubmit|onsuspend|ontimeupdate|ontoggle|onunload|onunload|onvolumechange|onwaiting|onwheel)$/i;

    bus.on(
        "编译插件",
        (function() {
            // 处理标签中指定类型的属性，提取后新建节点管理
            // 标准标签的事件统一分组
            // 标签节点下新建Events节点存放
            return postobject.plugin("g25p-astedit-group-attribtue-events", function(root, context) {
                root.walk("Tag", (node, object) => {
                    if (!node.object.standard) return; // 非标准标签，跳过
                    if (!node.nodes || !node.nodes.length) return; // 节点没有定义属性，跳过

                    // 查找Attributes
                    let attrsNode;
                    for (let i = 0, nd; (nd = node.nodes[i++]); ) {
                        if (nd.type === "Attributes") {
                            attrsNode = nd;
                            break;
                        }
                    }
                    if (!attrsNode || !attrsNode.nodes || !attrsNode.nodes.length) return; // 节点没有定义属性，跳过

                    // 查找目标属性节点
                    let ary = [];
                    attrsNode.nodes.forEach(nd => {
                        REG_EVENTS.test(nd.object.name) && ary.push(nd); // 找到
                    });

                    if (!ary.length) return; // 没有找到相关节点，跳过

                    // 创建节点保存
                    let groupNode = this.createNode({ type: "Events" });
                    ary.forEach(nd => {
                        let cNode = nd.clone();
                        cNode.type = "Event";
                        cNode.object.type = "Event";
                        groupNode.addChild(cNode);
                        nd.remove(); // 删除节点
                    });
                    node.addChild(groupNode);
                });
            });
        })()
    );

    // ------- g25p-astedit-group-attribtue-events end
})();

/* ------- g35p-astedit-process-attribtue-style ------- */
(() => {
    // ------- g35p-astedit-process-attribtue-style start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 处理标签中指定类型的属性，提取后新建节点管理
            // 处理标签中的 style 属性
            return postobject.plugin("g35p-astedit-process-attribtue-style", function(root, context) {
                root.walk("Tag", (node, object) => {
                    if (!node.nodes || !node.nodes.length) return; // 节点没有定义属性，跳过

                    // 查找Attributes
                    let attrsNode;
                    for (let i = 0, nd; (nd = node.nodes[i++]); ) {
                        if (nd.type === "Attributes") {
                            attrsNode = nd;
                            break;
                        }
                    }
                    if (!attrsNode || !attrsNode.nodes || !attrsNode.nodes.length) return; // 没有相关属性节点，跳过

                    // 查找目标属性节点
                    let ary = [];
                    attrsNode.nodes.forEach(nd => {
                        /^style$/i.test(nd.object.name) && ary.push(nd); // 找到
                    });

                    if (!ary.length) return; // 没有找到相关节点，跳过

                    if (ary.legnth > 1) {
                        // 属性 style 不能重复
                        throw new Err("duplicate attribute of style", {
                            file: context.input.file,
                            text: context.input.text,
                            start: ary[1].object.loc.start.pos,
                            end: ary[1].object.loc.end.pos
                        });
                    }

                    // 创建节点保存
                    let oNode = ary[0].clone();
                    oNode.type = "Style";
                    oNode.object.type = "Style";

                    node.addChild(oNode);
                    ary[0].remove(); // 删除节点
                });
            });
        })()
    );

    // ------- g35p-astedit-process-attribtue-style end
})();

/* ------- g45p-astedit-process-attribtue-class ------- */
(() => {
    // ------- g45p-astedit-process-attribtue-class start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 处理标签中指定类型的属性，提取后新建节点管理
            // 处理标签中的 class 属性
            return postobject.plugin("g45p-astedit-process-attribtue-class", function(root, context) {
                root.walk("Tag", (node, object) => {
                    if (!node.nodes || !node.nodes.length) return; // 节点没有定义属性，跳过

                    // 查找Attributes
                    let attrsNode;
                    for (let i = 0, nd; (nd = node.nodes[i++]); ) {
                        if (nd.type === "Attributes") {
                            attrsNode = nd;
                            break;
                        }
                    }
                    if (!attrsNode || !attrsNode.nodes || !attrsNode.nodes.length) return; // 没有相关属性节点，跳过

                    // 查找目标属性节点
                    let ary = [];
                    attrsNode.nodes.forEach(nd => {
                        /^class$/i.test(nd.object.name) && ary.push(nd); // 找到
                    });

                    if (!ary.length) return; // 没有找到相关节点，跳过

                    if (ary.legnth > 1) {
                        // 属性 class 不能重复
                        throw new Err("duplicate attribute of class", {
                            file: context.input.file,
                            text: context.input.text,
                            start: ary[1].object.loc.start.pos,
                            end: ary[1].object.loc.end.pos
                        });
                    }

                    // 创建节点保存
                    let oNode = ary[0].clone();
                    oNode.type = "Class";
                    oNode.object.type = "Class";
                    oNode.object.classes = getClasses(oNode.object.value); // 取出全部类名保存备用

                    node.addChild(oNode);
                    ary[0].remove(); // 删除节点
                });
            });
        })()
    );

    function getClasses(clas) {
        // TODO 含大括号冒号的复杂表达式
        let result = [];
        clas = clas.replace(/\{.*?\}/g, function(match) {
            let str = match.substring(1, match.length - 1); // {'xxx': ... , yyy: ...} => 'xxx': ... , yyy: ...

            let idx, key, val;
            while (str.indexOf(":") > 0) {
                idx = str.indexOf(":");
                key = str
                    .substring(0, idx)
                    .replace(/['"]/g, "")
                    .trim(); // key

                val = str.substring(idx + 1);
                let idx2 = val.indexOf(":");
                if (idx2 > 0) {
                    val = val.substring(0, idx2);
                    val = val.substring(0, val.lastIndexOf(",")); // val
                    str = str.substring(idx + 1 + val.length + 1); // 更新临时变量
                } else {
                    str = "";
                }

                key && result.push(key);
            }

            return "";
        });

        let ary = clas.split(/\s+/);
        for (let i = 0; i < ary.length; i++) {
            ary[i].trim() && result.push(ary[i].trim());
        }

        return result;
    }

    // ------- g45p-astedit-process-attribtue-class end
})();

/* ------- h15p-astedit-process-attribtue-@ref ------- */
(() => {
    // ------- h15p-astedit-process-attribtue-@ref start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 处理标签中指定类型的属性，提取后新建节点管理
            // 处理标签中的 @ref 属性
            return postobject.plugin("h15p-astedit-process-attribtue-@ref", function(root, context) {
                root.walk("Tag", (node, object) => {
                    if (!node.nodes || !node.nodes.length) return; // 节点没有定义属性，跳过

                    // 查找Attributes
                    let attrsNode;
                    for (let i = 0, nd; (nd = node.nodes[i++]); ) {
                        if (nd.type === "Attributes") {
                            attrsNode = nd;
                            break;
                        }
                    }
                    if (!attrsNode || !attrsNode.nodes || !attrsNode.nodes.length) return; // 没有相关属性节点，跳过

                    // 查找目标属性节点
                    let ary = [];
                    attrsNode.nodes.forEach(nd => {
                        /^@ref$/i.test(nd.object.name) && ary.push(nd); // 找到
                    });

                    if (!ary.length) return; // 没有找到相关节点，跳过

                    if (ary.legnth > 1) {
                        // 属性 @ref 不能重复
                        throw new Err("duplicate attribute of @ref", {
                            file: context.input.file,
                            text: context.input.text,
                            start: ary[1].object.loc.start.pos,
                            end: ary[1].object.loc.end.pos
                        });
                    }
                    if (/^(if|for)$/.test(object.value)) {
                        throw new Err(`unsupport attribute @ref on tag <${object.value}>`, {
                            file: context.input.file,
                            text: context.input.text,
                            start: ary[0].object.loc.start.pos,
                            end: ary[0].object.loc.end.pos
                        });
                    }

                    // 创建节点保存
                    let oNode = ary[0].clone();
                    oNode.type = "@ref";
                    oNode.object.type = "@ref";

                    node.addChild(oNode);
                    ary[0].remove(); // 删除节点
                });
            });
        })()
    );

    // ------- h15p-astedit-process-attribtue-@ref end
})();

/* ------- h25p-astedit-process-attribtue-@if ------- */
(() => {
    // ------- h25p-astedit-process-attribtue-@if start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 处理标签中指定类型的属性，提取后新建节点管理
            // 处理标签中的 @if 属性
            return postobject.plugin("h25p-astedit-process-attribtue-@if", function(root, context) {
                root.walk("Tag", (node, object) => {
                    if (!node.nodes || !node.nodes.length) return; // 节点没有定义属性，跳过

                    // 查找Attributes
                    let attrsNode;
                    for (let i = 0, nd; (nd = node.nodes[i++]); ) {
                        if (nd.type === "Attributes") {
                            attrsNode = nd;
                            break;
                        }
                    }
                    if (!attrsNode || !attrsNode.nodes || !attrsNode.nodes.length) return; // 没有相关属性节点，跳过

                    // 查找目标属性节点
                    let ary = [];
                    attrsNode.nodes.forEach(nd => {
                        /^@if$/i.test(nd.object.name) && ary.push(nd); // 找到
                    });

                    if (!ary.length) return; // 没有找到相关节点，跳过

                    if (ary.legnth > 1) {
                        // 属性 @if 不能重复
                        throw new Err("duplicate attribute of @if", {
                            file: context.input.file,
                            text: context.input.text,
                            start: ary[1].object.loc.start.pos,
                            end: ary[1].object.loc.end.pos
                        });
                    }

                    // 创建节点保存
                    let oNode = ary[0].clone();
                    oNode.type = "@if";
                    oNode.object.type = "@if";

                    node.addChild(oNode);
                    ary[0].remove(); // 删除节点
                });
            });
        })()
    );

    // ------- h25p-astedit-process-attribtue-@if end
})();

/* ------- h35p-astedit-process-attribtue-@show ------- */
(() => {
    // ------- h35p-astedit-process-attribtue-@show start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 处理标签中指定类型的属性，提取后新建节点管理
            // 处理标签中的 @show 属性
            return postobject.plugin("h35p-astedit-process-attribtue-@show", function(root, context) {
                root.walk("Tag", (node, object) => {
                    if (!node.nodes || !node.nodes.length) return; // 节点没有定义属性，跳过

                    // 查找Attributes
                    let attrsNode;
                    for (let i = 0, nd; (nd = node.nodes[i++]); ) {
                        if (nd.type === "Attributes") {
                            attrsNode = nd;
                            break;
                        }
                    }
                    if (!attrsNode || !attrsNode.nodes || !attrsNode.nodes.length) return; // 没有相关属性节点，跳过

                    // 查找目标属性节点
                    let ary = [];
                    attrsNode.nodes.forEach(nd => {
                        /^@show$/i.test(nd.object.name) && ary.push(nd); // 找到
                    });

                    if (!ary.length) return; // 没有找到相关节点，跳过

                    if (ary.legnth > 1) {
                        // 属性 @show 不能重复
                        throw new Err("duplicate attribute of @show", {
                            file: context.input.file,
                            text: context.input.text,
                            start: ary[1].object.loc.start.pos,
                            end: ary[1].object.loc.end.pos
                        });
                    }
                    if (/^(if|for)$/.test(object.value)) {
                        throw new Err(`unsupport attribute @show on tag <${object.value}>`, {
                            file: context.input.file,
                            text: context.input.text,
                            start: ary[0].object.loc.start.pos,
                            end: ary[0].object.loc.end.pos
                        });
                    }

                    // 创建节点保存
                    let oNode = ary[0].clone();
                    oNode.type = "@show";
                    oNode.object.type = "@show";

                    node.addChild(oNode);
                    ary[0].remove(); // 删除节点
                });
            });
        })()
    );

    // ------- h35p-astedit-process-attribtue-@show end
})();

/* ------- h45p-astedit-process-attribtue-@for ------- */
(() => {
    // ------- h45p-astedit-process-attribtue-@for start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 处理标签中指定类型的属性，提取后新建节点管理
            // 处理标签中的 @for 属性
            return postobject.plugin("h45p-astedit-process-attribtue-@for", function(root, context) {
                root.walk("Tag", (node, object) => {
                    if (!node.nodes || !node.nodes.length) return; // 节点没有定义属性，跳过

                    // 查找Attributes
                    let attrsNode;
                    for (let i = 0, nd; (nd = node.nodes[i++]); ) {
                        if (nd.type === "Attributes") {
                            attrsNode = nd;
                            break;
                        }
                    }
                    if (!attrsNode || !attrsNode.nodes || !attrsNode.nodes.length) return; // 没有相关属性节点，跳过

                    // 查找目标属性节点
                    let ary = [];
                    attrsNode.nodes.forEach(nd => {
                        /^@for$/i.test(nd.object.name) && ary.push(nd); // 找到
                    });

                    if (!ary.length) return; // 没有找到相关节点，跳过

                    if (ary.legnth > 1) {
                        // 属性 @for 不能重复
                        throw new Err("duplicate attribute of @for", {
                            file: context.input.file,
                            text: context.input.text,
                            start: ary[1].object.loc.start.pos,
                            end: ary[1].object.loc.end.pos
                        });
                    }

                    // 创建节点保存
                    let oNode = ary[0].clone();
                    oNode.type = "@for";
                    oNode.object.type = "@for";

                    node.addChild(oNode);
                    ary[0].remove(); // 删除节点
                });
            });
        })()
    );

    // ------- h45p-astedit-process-attribtue-@for end
})();

/* ------- h55p-astedit-process-attribtue-@csslib ------- */
(() => {
    // ------- h55p-astedit-process-attribtue-@csslib start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 处理标签中指定类型的属性，提取后新建节点管理
            // 处理标签中的 @csslib 属性 （不做建库处理）
            return postobject.plugin("h55p-astedit-process-attribtue-@csslib", function(root, context) {
                root.walk("Tag", (node, object) => {
                    if (!node.nodes || !node.nodes.length) return; // 节点没有定义属性，跳过

                    // 查找Attributes
                    let attrsNode;
                    for (let i = 0, nd; (nd = node.nodes[i++]); ) {
                        if (nd.type === "Attributes") {
                            attrsNode = nd;
                            break;
                        }
                    }
                    if (!attrsNode || !attrsNode.nodes || !attrsNode.nodes.length) return; // 没有相关属性节点，跳过

                    // 查找目标属性节点
                    let ary = [];
                    attrsNode.nodes.forEach(nd => {
                        /^@csslib$/i.test(nd.object.name) && ary.push(nd); // 找到
                    });

                    if (!ary.length) return; // 没有找到相关节点，跳过

                    if (ary.legnth > 1) {
                        // 属性 @csslib 不能重复
                        throw new Err("duplicate attribute of @csslib", {
                            file: context.input.file,
                            text: context.input.text,
                            start: ary[1].object.loc.start.pos,
                            end: ary[1].object.loc.end.pos
                        });
                    }
                    if (/^(if|for)$/.test(object.value)) {
                        throw new Err(`unsupport attribute @csslib on tag <${object.value}>`, {
                            file: context.input.file,
                            text: context.input.text,
                            start: ary[0].object.loc.start.pos,
                            end: ary[0].object.loc.end.pos
                        });
                    }

                    // 创建节点保存
                    let oNode = ary[0].clone();
                    oNode.type = "@csslib";
                    oNode.object.type = "@csslib";

                    node.addChild(oNode);
                    ary[0].remove(); // 删除节点
                });
            });
        })()
    );

    // ------- h55p-astedit-process-attribtue-@csslib end
})();

/* ------- h65p-astedit-process-attribtue-@taglib ------- */
(() => {
    // ------- h65p-astedit-process-attribtue-@taglib start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 处理标签中指定类型的属性，提取后新建节点管理
            // 处理标签中的 @taglib 属性
            return postobject.plugin("h65p-astedit-process-attribtue-@taglib", function(root, context) {
                root.walk("Tag", (node, object) => {
                    if (!node.nodes || !node.nodes.length) return; // 节点没有定义属性，跳过

                    // 查找Attributes
                    let attrsNode;
                    for (let i = 0, nd; (nd = node.nodes[i++]); ) {
                        if (nd.type === "Attributes") {
                            attrsNode = nd;
                            break;
                        }
                    }
                    if (!attrsNode || !attrsNode.nodes || !attrsNode.nodes.length) return; // 没有相关属性节点，跳过

                    // 查找目标属性节点
                    let ary = [];
                    attrsNode.nodes.forEach(nd => {
                        /^@taglib$/i.test(nd.object.name) && ary.push(nd); // 找到
                    });

                    if (!ary.length) return; // 没有找到相关节点，跳过

                    if (ary.legnth > 1) {
                        // 属性 @taglib 不能重复
                        throw new Err("duplicate attribute of @taglib", {
                            file: context.input.file,
                            text: context.input.text,
                            start: ary[1].object.loc.start.pos,
                            end: ary[1].object.loc.end.pos
                        });
                    }
                    if (/^(if|for)$/.test(object.value)) {
                        throw new Err(`unsupport @taglib on tag <${object.value}>`, {
                            file: context.input.file,
                            text: context.input.text,
                            start: ary[0].object.loc.start.pos,
                            end: ary[0].object.loc.end.pos
                        });
                    }

                    // 创建节点保存
                    let oNode = ary[0].clone();
                    oNode.type = "@taglib";
                    oNode.object.type = "@taglib";

                    node.addChild(oNode);
                    ary[0].remove(); // 删除节点
                });
            });
        })()
    );

    // ------- h65p-astedit-process-attribtue-@taglib end
})();

/* ------- j15p-astedit-process-tag-img ------- */
(() => {
    // ------- j15p-astedit-process-tag-img start
    const bus = require("@gotoeasy/bus");
    const hash = require("@gotoeasy/hash");
    const File = require("@gotoeasy/file");
    const Err = require("@gotoeasy/err");
    const postobject = require("@gotoeasy/postobject");
    const fs = require("fs");

    bus.on(
        "编译插件",
        (function() {
            // 针对img标签做特殊处理
            //   -- 复制图片资源并哈希化
            //   -- 图片路径加上替换用模板，便于不同目录页面使用时替换为正确的相对目录
            //   -- 上下文中保存是否包含img标签的标记，便于判断是否需替换目录
            return postobject.plugin("j15p-astedit-process-tag-img", function(root, context) {
                root.walk(
                    "Tag",
                    (node, object) => {
                        if (!/^img$/i.test(object.value)) return;
                        context.result.hasImg = true;

                        // 查找Attributes
                        let attrsNode;
                        for (let i = 0, nd; (nd = node.nodes[i++]); ) {
                            if (nd.type === "Attributes") {
                                attrsNode = nd;
                                break;
                            }
                        }
                        if (!attrsNode || !attrsNode.nodes || !attrsNode.nodes.length) return; // 没有相关属性节点，跳过

                        // 查找目标属性节点
                        let srcAttrNode;
                        for (let i = 0, nd; (nd = attrsNode.nodes[i++]); ) {
                            if (/^src$/i.test(nd.object.name)) {
                                srcAttrNode = nd;
                                break;
                            }
                        }
                        if (!srcAttrNode) return; // 没有相关属性节点，跳过

                        // 复制文件
                        let imgname = hashImageName(context.input.file, srcAttrNode.object.value);
                        if (!imgname) {
                            throw new Err("image file not found", {
                                file: context.input.file,
                                text: context.input.text,
                                start: srcAttrNode.object.loc.start.pos,
                                end: srcAttrNode.object.loc.end.pos
                            });
                        }

                        // 修改成替换用目录，文件名用哈希
                        srcAttrNode.object.value = "%imagepath%" + imgname;
                    },
                    { readonly: true }
                );
            });
        })()
    );

    function hashImageName(srcFile, imgFile) {
        let file;
        if (File.exists(imgFile)) {
            file = imgFile;
        } else {
            file = File.resolve(srcFile, imgFile);
            if (!File.exists(file)) {
                return false;
            }
        }

        let name = hash({ file }) + File.extname(file); // 去除目录，文件名哈希化，后缀名不变

        let oCache = bus.at("缓存");
        // 复制文件
        let distDir = oCache.path + "/resources"; // 统一目录，资源都复制到 %缓存目录%/resources
        let distFile = distDir + "/" + name;
        if (!File.exists(distFile)) {
            !File.existsDir(distDir) && File.mkdir(distDir);
            fs.copyFileSync(file, distFile);
        }

        return name;
    }

    // ------- j15p-astedit-process-tag-img end
})();

/* ------- k15p-astedit-transform-attribtue-@ref ------- */
(() => {
    // ------- k15p-astedit-transform-attribtue-@ref start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 转换处理指令节点 @ref
            return postobject.plugin("k15p-astedit-transform-attribtue-@ref", function(root, context) {
                root.walk("@ref", (node, object) => {
                    let tagNode = node.parent; // 所属标签节点

                    if (bus.at("是否表达式", object.value)) {
                        // 属性 @ref 不能使用表达式
                        throw new Err("@ref unsupport the expression", {
                            file: context.input.file,
                            text: context.input.text,
                            start: object.loc.start.pos,
                            end: object.loc.end.pos
                        });
                    }

                    // TODO @ref 转为特殊属性处理，需同步修改运行时脚本
                    // 添加到普通属性中使用

                    // 查找Attributes
                    let attrsNode;
                    for (let i = 0, nd; (nd = tagNode.nodes[i++]); ) {
                        if (nd.type === "Attributes") {
                            attrsNode = nd;
                            break;
                        }
                    }

                    let cNode = node.clone();
                    cNode.type = "Attribute";
                    cNode.object.type = "Attribute";
                    cNode.object.name = "ref";

                    let $contextNode = node.clone();
                    $contextNode.type = "Attribute";
                    $contextNode.object.type = "Attribute";
                    $contextNode.object.name = "$context";
                    $contextNode.object.value = "{$this}";
                    $contextNode.object.isExpression = true;

                    if (!attrsNode) {
                        attrsNode = this.createNode({ type: "Attributes" });
                        tagNode.addChild(attrsNode);
                    }
                    attrsNode.addChild(cNode); // @ref 转为 ref属性
                    attrsNode.addChild($contextNode); // 含ref属性时，自动添加$context属性，避免组件对象上下文混乱，深度slot内的标签含ref属性时特需
                    node.remove(); // 删除节点
                });
            });
        })()
    );

    // ------- k15p-astedit-transform-attribtue-@ref end
})();

/* ------- k25p-astedit-transform-attribtue-@if ------- */
(() => {
    // ------- k25p-astedit-transform-attribtue-@if start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 转换处理指令节点 @ref
            return postobject.plugin("k25p-astedit-transform-attribtue-@if", function(root, context) {
                const OPTS = bus.at("视图编译选项");

                root.walk("@if", (node, object) => {
                    let tagNode = node.parent; // 所属标签节点
                    /^if$/i.test(tagNode.object.value) && (tagNode.ok = true);

                    let type = OPTS.TypeCodeBlock;
                    let value = "if (" + object.value.replace(/^\s*\{=?/, "").replace(/\}\s*$/, "") + ") {";
                    let jsNode = this.createNode({ type, value });
                    tagNode.before(jsNode);

                    value = "}";
                    jsNode = this.createNode({ type, value });
                    tagNode.after(jsNode);

                    node.remove(); // 删除节点
                });
            });
        })()
    );

    // ------- k25p-astedit-transform-attribtue-@if end
})();

/* ------- k35p-astedit-transform-attribtue-@show ------- */
(() => {
    // ------- k35p-astedit-transform-attribtue-@show start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 转换处理指令节点 @show
            // 转换为 style中的 display 属性
            return postobject.plugin("k35p-astedit-transform-attribtue-@show", function(root, context) {
                const OPTS = bus.at("视图编译选项");

                root.walk("@show", (node, object) => {
                    let tagNode = node.parent; // 所属标签节点

                    // 查找样式属性节点
                    let styleNode;
                    for (let i = 0, nd; (nd = tagNode.nodes[i++]); ) {
                        if (nd.type === "Style") {
                            styleNode = nd;
                            break; // 找到
                        }
                    }

                    let display =
                        OPTS.ExpressionStart +
                        "(" +
                        object.value.replace(/^\{/, "").replace(/\}$/, "") +
                        ') ? "display:block;" : "display:none;"' +
                        OPTS.ExpressionEnd;
                    if (!styleNode) {
                        // 不存在样式节点时，创建
                        styleNode = this.createNode({ type: "Style", value: display });
                        tagNode.addChild(styleNode);
                    } else {
                        // 存在样式节点时，修改
                        if (styleNode.object.value.endsWith(";")) {
                            styleNode.object.value += display;
                        } else {
                            styleNode.object.value += ";" + display; // 放在后面确保覆盖display
                        }
                    }
                    styleNode.object.isExpression = true;

                    node.remove();
                });
            });
        })()
    );

    // ------- k35p-astedit-transform-attribtue-@show end
})();

/* ------- k45p-astedit-transform-attribtue-@for ------- */
(() => {
    // ------- k45p-astedit-transform-attribtue-@for start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 转换处理指令节点 @for
            return postobject.plugin("k45p-astedit-transform-attribtue-@for", function(root, context) {
                const OPTS = bus.at("视图编译选项");

                root.walk("@for", (node, object) => {
                    let tagNode = node.parent; // 所属标签节点
                    /^for$/i.test(tagNode.object.value) && (tagNode.ok = true);

                    let type = OPTS.TypeCodeBlock;
                    let value = parseFor(context, object);
                    let loc = object.loc;
                    let jsNode = this.createNode({ type, value, loc });
                    tagNode.before(jsNode);

                    value = "}";
                    jsNode = this.createNode({ type, value, loc });
                    tagNode.after(jsNode);

                    node.remove();
                });
            });
        })()
    );

    // @for="value in array"
    // @for="(value, index) in array"
    // @for="(value, index from i) in array"
    // @for="(value, index max m) in array"
    // @for="(value, index from i max m) in array"
    // @for="(value, index max m from i) in array"
    function parseFor(context, object) {
        if (!object.value) throw getError(context, object); // 格式错误

        let value, index, from, max, array, match;

        // @for={(value, index from i max m) in array}
        match = object.value.match(/^\s*\{*\s*\(\s*(\w+)\s*,\s*(\w+)\s+from\s+(\w+)\s+max\s+(\w+)\s*\)\s+in\s+(\S+?)\s*\}*\s*$/);
        if (match) {
            value = match[1];
            index = match[2];
            from = match[3];
            max = match[4];
            array = match[5];
            if (/^\d+/.test(value)) throw getError(context, object, `invalid value name: [${value}]`); // 变量名错误
            if (/^\d+/.test(index)) throw getError(context, object, `invalid index name: [${index}]`); // 变量名错误
            if (/^\d+/.test(array)) throw getError(context, object, `invalid array name: [${array}]`); // 变量名错误

            if (/[^a-zA-Z\d_]/.test(array)) {
                return ` for ( let ${index}=${from},ARY_=(${array}),MAX_=Math.min(${max},ARY_.length),${value}; ${index}<MAX_; ${index}++) {
                        ${value} = ARY_[${index}]; `;
            }
            return ` for ( let ${index}=${from},MAX_=Math.min(${max},${array}.length),${value}; ${index}<MAX_; ${index}++) {
                    ${value} = ${array}[${index}]; `;
        }

        // @for={(value, index max m from i) in array}
        match = object.value.match(/^\s*\{*\s*\(\s*(\w+)\s*,\s*(\w+)\s+max\s+(\w+)\s+from\s+(\w+)\s*\)\s+in\s+(\S+?)\s*\}*\s*$/);
        if (match) {
            value = match[1];
            index = match[2];
            from = match[4];
            max = match[3];
            array = match[5];
            if (/^\d+/.test(value)) throw getError(context, object, `invalid value name: [${value}]`); // 变量名错误
            if (/^\d+/.test(index)) throw getError(context, object, `invalid index name: [${index}]`); // 变量名错误
            if (/^\d+/.test(array)) throw getError(context, object, `invalid array name: [${array}]`); // 变量名错误

            if (/[^a-zA-Z\d_]/.test(array)) {
                return ` for ( let ${index}=${from},ARY_=(${array}),MAX_=Math.min(${max},ARY_.length),${value}; ${index}<MAX_; ${index}++) {
                        ${value} = ARY_[${index}]; `;
            }
            return ` for ( let ${index}=${from},MAX_=Math.min(${max},${array}.length),${value}; ${index}<MAX_; ${index}++) {
                    ${value} = ${array}[${index}]; `;
        }

        // @for={(value, index from i) in array}
        match = object.value.match(/^\s*\{*\s*\(\s*(\w+)\s*,\s*(\w+)\s+from\s+(\w+)\s*\)\s+in\s+(\S+?)\s*\}*\s*$/);
        if (match) {
            value = match[1];
            index = match[2];
            from = match[3];
            array = match[4];
            if (/^\d+/.test(value)) throw getError(context, object, `invalid value name: [${value}]`); // 变量名错误
            if (/^\d+/.test(index)) throw getError(context, object, `invalid index name: [${index}]`); // 变量名错误
            if (/^\d+/.test(array)) throw getError(context, object, `invalid array name: [${array}]`); // 变量名错误

            if (/[^a-zA-Z\d_]/.test(array)) {
                return ` for ( let ${index}=${from},ARY_=(${array}),MAX_=ARY_.length,${value}; ${index}<MAX_; ${index}++) {
                        ${value} = ARY_[${index}]; `;
            }
            return ` for ( let ${index}=${from},MAX_=${array}.length,${value}; ${index}<MAX_; ${index}++) {
                    ${value} = ${array}[${index}]; `;
        }

        // @for={(value, index max m) in array}
        match = object.value.match(/^\s*\{*\s*\(\s*(\w+)\s*,\s*(\w+)\s+max\s+(\w+)\s*\)\s+in\s+(\S+?)\s*\}*\s*$/);
        if (match) {
            value = match[1];
            index = match[2];
            max = match[3];
            array = match[4];
            if (/^\d+/.test(value)) throw getError(context, object, `invalid value name: [${value}]`); // 变量名错误
            if (/^\d+/.test(index)) throw getError(context, object, `invalid index name: [${index}]`); // 变量名错误
            if (/^\d+/.test(array)) throw getError(context, object, `invalid array name: [${array}]`); // 变量名错误

            if (/[^a-zA-Z\d_]/.test(array)) {
                return ` for ( let ${index}=0,ARY_=(${array}),MAX_=Math.min(${max},ARY_.length),${value}; ${index}<MAX_; ${index}++) {
                        ${value} = ARY_[${index}]; `;
            }
            return ` for ( let ${index}=0,MAX_=Math.min(${max},${array}.length),${value}; ${index}<MAX_; ${index}++) {
                    ${value} = ${array}[${index}]; `;
        }

        // @for={(value, index) in array}
        match = object.value.match(/^\s*\{*\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)\s+in\s+(\S+?)\s*\}*\s*$/);
        if (match) {
            value = match[1];
            index = match[2];
            array = match[3];
            if (/^\d+/.test(value)) throw getError(context, object, `invalid value name: [${value}]`); // 变量名错误
            if (/^\d+/.test(index)) throw getError(context, object, `invalid index name: [${index}]`); // 变量名错误
            if (/^\d+/.test(array)) throw getError(context, object, `invalid array name: [${array}]`); // 变量名错误

            if (/[^a-zA-Z\d_]/.test(array)) {
                return ` for ( let ${index}=0,ARY_=(${array}),MAX_=ARY_.length,${value}; ${index}<MAX_; ${index}++) {
                        ${value} = ARY_[${index}]; `;
            }
            return ` for ( let ${index}=0,MAX_=${array}.length,${value}; ${index}<MAX_; ${index}++) {
                    ${value} = ${array}[${index}]; `;
        }

        // @for={(value) in array}
        match = object.value.match(/^\s*\{*\s*\(\s*(\w+)\s*\)\s+in\s+(\S+?)\s*\}*\s*$/);
        if (match) {
            value = match[1];
            index = "J_";
            array = match[2];
            if (/^\d+/.test(value)) throw getError(context, object, `invalid value name: [${value}]`); // 变量名错误
            if (/^\d+/.test(index)) throw getError(context, object, `invalid index name: [${index}]`); // 变量名错误
            if (/^\d+/.test(array)) throw getError(context, object, `invalid array name: [${array}]`); // 变量名错误

            if (/[^a-zA-Z\d_]/.test(array)) {
                return ` for ( let ${index}=0,ARY_=(${array}),MAX_=ARY_.length,${value}; ${index}<MAX_; ${index}++) {
                        ${value} = ARY_[${index}]; `;
            }
            return ` for ( let ${index}=0,MAX_=${array}.length,${value}; ${index}<MAX_; ${index}++) {
                    ${value} = ${array}[${index}]; `;
        }

        // @for={value in array}
        match = object.value.match(/^\s*\{*\s*(\w+)\s+in\s+(\S+?)\s*\}*\s*$/);
        if (match) {
            value = match[1];
            index = "J_";
            array = match[2];
            if (/^\d+/.test(value)) throw getError(context, object, `invalid value name: [${value}]`); // 变量名错误
            if (/^\d+/.test(array)) throw getError(context, object, `invalid array name: [${array}]`); // 变量名错误

            if (/[^a-zA-Z\d_]/.test(array)) {
                return ` for ( let ${index}=0,ARY_=(${array}),MAX_=ARY_.length,${value}; ${index}<MAX_; ${index}++) {
                        ${value} = ARY_[${index}]; `;
            }
            return ` for ( let ${index}=0,MAX_=${array}.length,${value}; ${index}<MAX_; ${index}++) {
                    ${value} = ${array}[${index}]; `;
        }

        throw getError(context, object); // 格式错误
    }

    function getError(context, object, msg = "invalid format of @for") {
        // 格式错误
        return new Err(msg, { file: context.input.file, text: context.input.text, start: object.loc.start.pos, end: object.loc.end.pos });
    }

    // ------- k45p-astedit-transform-attribtue-@for end
})();

/* ------- k55p-astedit-transform-tag-name-by-@taglib ------- */
(() => {
    // ------- k55p-astedit-transform-tag-name-by-@taglib start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 针对含@taglib的标签，把标签名替换为标签全名
            // @taglib不能用于标准标签，不能用于项目实际存在的组件，不能用于特殊的内置标签，否则报错
            // 完成后删除@taglib节点
            return postobject.plugin("k55p-astedit-transform-tag-name-by-@taglib", function(root, context) {
                root.walk("@taglib", (node, object) => {
                    // 父节点
                    let tagNode = node.parent;
                    if (tagNode.object.standard) {
                        throw new Err("unsupport @taglib on standard tag", {
                            file: context.input.file,
                            text: context.input.text,
                            start: object.loc.start.pos,
                            end: object.loc.end.pos
                        });
                    }

                    let cpFile = bus.at("标签项目源文件", tagNode.object.value); // 当前项目范围内查找标签对应的源文件
                    if (cpFile) {
                        throw new Err(`unsupport @taglib on existed component: ${tagNode.object.value}(${cpFile})`, {
                            file: context.input.file,
                            text: context.input.text,
                            start: object.loc.start.pos,
                            end: object.loc.end.pos
                        });
                    }

                    let name,
                        pkg,
                        comp,
                        match,
                        taglib = object.value;

                    if ((match = taglib.match(/^\s*.+?\s*=\s*(.+?)\s*:\s*(.+?)\s*$/))) {
                        // @taglib = "name=@scope/pkg:component"
                        pkg = match[1];
                        comp = match[2];
                    } else if ((match = taglib.match(/^\s*.+?\s*=\s*(.+?)\s*$/))) {
                        // @taglib = "name=@scope/pkg"
                        pkg = match[1];
                        comp = tagNode.object.value;
                    } else if (taglib.indexOf("=") >= 0) {
                        // @taglib = "=@scope/pkg"
                        throw new Err("invalid attribute value of @taglib", {
                            file: context.input.file,
                            text: context.input.text,
                            start: object.loc.start.pos,
                            end: object.loc.end.pos
                        });
                    } else if ((match = taglib.match(/^\s*(.+?)\s*:\s*(.+?)\s*$/))) {
                        // @taglib = "@scope/pkg:component"
                        pkg = match[1];
                        comp = match[2];
                    } else if ((match = taglib.match(/^\s*(.+?)\s*$/))) {
                        // @taglib = "@scope/pkg"
                        pkg = match[1];
                        comp = tagNode.object.value;
                    } else {
                        throw new Err("invalid attribute value of @taglib", {
                            file: context.input.file,
                            text: context.input.text,
                            start: object.loc.start.pos,
                            end: object.loc.end.pos
                        });
                    }

                    let install = bus.at("自动安装", pkg);
                    if (!install) {
                        throw new Err("package install failed: " + pkg, {
                            file: context.input.file,
                            text: context.input.text,
                            start: object.loc.start.pos,
                            end: object.loc.end.pos
                        });
                    }

                    let oPkg = bus.at("模块组件信息", pkg);
                    let srcFile = bus.at("标签库引用", `${pkg}:${comp}`, oPkg.config); // 从指定模块查找
                    if (!srcFile) {
                        throw new Err("component not found: " + object.value, {
                            file: context.input.file,
                            text: context.input.text,
                            start: object.loc.start.pos,
                            end: object.loc.end.pos
                        });
                    }

                    let tagpkg = bus.at("标签全名", srcFile);

                    tagNode.object.value = tagpkg; // 替换为标签全名，如 @scope/pkg:ui-btn
                    node.remove();
                });
            });
        })()
    );

    // ------- k55p-astedit-transform-tag-name-by-@taglib end
})();

/* ------- k65p-astedit-transform-tag-name-by-[taglib] ------- */
(() => {
    // ------- k65p-astedit-transform-tag-name-by-[taglib] start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 按需查询引用样式库
            return postobject.plugin(
                "k65p-astedit-transform-tag-name-by-[taglib]",
                function(root, context) {
                    let oTaglib = Object.assign({}, context.result.oTaglib); // 复制(项目[taglib]+组件[taglib])

                    let ary, clsname, csslib, css;
                    root.walk("Tag", (node, object) => {
                        if (object.standard) return;

                        let taglib = oTaglib[object.value];
                        if (!taglib) return;

                        let pkg,
                            comp,
                            ary = taglib.split(":");
                        if (ary.length > 1) {
                            pkg = ary[0].trim();
                            comp = ary[1].trim();
                        } else {
                            pkg = taglib.trim();
                            comp = object.value;
                        }

                        let install = bus.at("自动安装", pkg);
                        if (!install) {
                            throw new Err("package install failed: " + pkg, {
                                file: context.input.file,
                                text: context.input.text,
                                start: object.loc.start.pos,
                                end: object.loc.end.pos
                            });
                        }

                        let oPkg = bus.at("模块组件信息", pkg);
                        let srcFile = bus.at("标签库引用", `${pkg}:${comp}`, oPkg.config); // 从指定模块查找
                        if (!srcFile) {
                            throw new Err("component not found: " + object.value, {
                                file: context.input.file,
                                text: context.input.text,
                                start: object.loc.start.pos,
                                end: object.loc.end.pos
                            });
                        }

                        let tagpkg = bus.at("标签全名", srcFile);

                        object.value = tagpkg; // 替换为标签全名，如 @scope/pkg:ui-btn
                    });
                },
                { readonly: true }
            );
        })()
    );

    // ------- k65p-astedit-transform-tag-name-by-[taglib] end
})();

/* ------- k75p-astedit-transform-tag-if-for ------- */
(() => {
    // ------- k75p-astedit-transform-tag-if-for start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 内置for标签和if标签的转换
            // 前面已处理@for和@if，这里直接提升子节点就行了（节点无关属性全忽略）
            return postobject.plugin("k75p-astedit-transform-tag-if-for", function(root, context) {
                root.walk("Tag", (node, object) => {
                    if (!/^(if|for)$/i.test(object.value)) return;

                    if (!node.ok) {
                        throw new Err(`missing attribute @${object.value} of tag <${object.value}>`, {
                            file: context.input.file,
                            text: context.input.text,
                            start: object.loc.start.pos
                        });
                    }

                    node.nodes.forEach(nd => {
                        nd.type !== "Attributes" && node.before(nd.clone()); // 子节点提升（节点无关属性全忽略）
                    });
                    node.remove(); // 删除本节点
                });
            });
        })()
    );

    // ------- k75p-astedit-transform-tag-if-for end
})();

/* ------- k85p-astedit-transform-tag-slot ------- */
(() => {
    // ------- k85p-astedit-transform-tag-slot start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    const hash = require("@gotoeasy/hash");

    const AryNm = "_Ary";
    const SlotVnodes = "slotVnodes";

    bus.on(
        "编译插件",
        (function() {
            // 插槽标签slot的转换
            // 仅一个插槽时可以不起名，多个插槽时必须起名，且不能有重复
            // 存在插槽时，汇总插槽名存放于context.result.slots
            // 没有插槽时，无context.result.slots
            // 多个插槽时，数组context.result.slots中存放名称
            // 有插槽时，api的$state中添加插槽属性接口 $SLOT，以便差异渲染
            return postobject.plugin("k85p-astedit-transform-tag-slot", function(root, context) {
                let nonameSlotNodes = [];
                let options = bus.at("视图编译选项");

                root.walk("Tag", (node, object) => {
                    if (!/^slot$/i.test(object.value)) return;

                    let slots = (context.result.slots = context.result.slots || []);

                    // 查找Attributes
                    let attrsNode;
                    if (node.nodes) {
                        for (let i = 0, nd; (nd = node.nodes[i++]); ) {
                            if (nd.type === "Attributes") {
                                attrsNode = nd;
                                break;
                            }
                        }
                    }
                    if (!attrsNode || !attrsNode.nodes || !attrsNode.nodes.length) {
                        // 无名slot，存在多个slot时必须指定name
                        if (slots.length) {
                            throw new Err(`missing attribute 'name' of tag <slot>`, {
                                file: context.input.file,
                                text: context.input.text,
                                start: object.loc.start.pos,
                                end: object.loc.end.pos
                            });
                        }
                        slots.push("");
                        nonameSlotNodes.push(node); // 暂存无名插槽
                        node.slotName = "";
                        return;
                    }

                    // 查找目标属性节点
                    let ary = [];
                    attrsNode.nodes &&
                        attrsNode.nodes.forEach(nd => {
                            /^name$/i.test(nd.object.name) && ary.push(nd); // 找到
                        });
                    if (ary.length === 0) {
                        // 无名slot，存在多个slot时必须指定name
                        if (slots.length) {
                            throw new Err(`missing attribute 'name' of tag <slot>`, {
                                file: context.input.file,
                                text: context.input.text,
                                start: object.loc.start.pos,
                                end: object.loc.end.pos
                            });
                        }
                        slots.push("");
                        nonameSlotNodes.push(node); // 暂存无名插槽
                        node.slotName = "";
                        return;
                    }
                    if (ary.length > 1) {
                        // 一个slot只能有一个name属性
                        throw new Err("duplicate attribute of name", {
                            file: context.input.file,
                            text: context.input.text,
                            start: ary[1].object.loc.start.pos,
                            end: ary[1].object.loc.end.pos
                        });
                    }

                    if (bus.at("是否表达式", ary[0].object.value)) {
                        // 插槽的属性 name 不能使用表达式
                        throw new Err("slot name unsupport the expression", {
                            file: context.input.file,
                            text: context.input.text,
                            start: ary[0].object.loc.start.pos,
                            end: ary[0].object.loc.end.pos
                        });
                    }

                    let name = ary[0].object.value + "";
                    if (slots.includes(name)) {
                        // slot不能重名
                        throw new Err("duplicate slot name: " + name, {
                            file: context.input.file,
                            text: context.input.text,
                            start: ary[0].object.loc.start.pos,
                            end: ary[0].object.loc.end.pos
                        });
                    }

                    slots.push(name);
                    !name && nonameSlotNodes.push(node); // 暂存无名插槽
                    node.slotName = name;
                });

                let slots = (context.result.slots = context.result.slots || []);
                if (slots.length > 1 && nonameSlotNodes.length) {
                    // 多个插槽时必须起名，且不能有重复
                    throw new Err(`missing slot name on tag <slot>`, {
                        file: context.input.file,
                        text: context.input.text,
                        start: nonameSlotNodes[0].object.loc.start.pos,
                        end: nonameSlotNodes[0].object.loc.end.pos
                    });
                }

                if (context.result.slots) {
                    // 有插槽时，api的statekeys中添加插槽属性接口 $SLOT，以便差异渲染
                    let statekeys = (context.doc.api.statekeys = context.doc.api.statekeys || []);
                    !statekeys.includes("$SLOT") && statekeys.push("$SLOT");
                }

                // -------------------------------------------
                // 辅助代码生成
                if (slots.length) {
                    // 遍历插槽节点替换为代码块节点
                    root.walk("Tag", (nd, obj) => {
                        if (!/^slot$/i.test(obj.value)) return;

                        let type = options.TypeCodeBlock;
                        let value = `${AryNm}.push( ...${SlotVnodes}_${hash(nd.slotName)} );`; // _Ary.push(...(slotVnodes_xxxxx || []));
                        let loc = nd.object.loc;
                        nd.replaceWith(this.createNode({ type, value }));
                    });

                    // 根节点前插入代码块节点
                    let arySrc = [];
                    let isNoNameSlot = slots.length === 1 && slots[0] === "" ? true : false;

                    // 变量部分 let slotVnodes_xxxx, slotVnodes_xxxx;
                    let aryVars = [];
                    isNoNameSlot && aryVars.push(" _hasDefinedSlotTemplate "); // 单一无名插槽时加一个判断标志
                    slots.forEach(slotName => {
                        aryVars.push(` ${SlotVnodes}_${hash(slotName)} = [] `);
                    });
                    arySrc.push("let " + aryVars.join(",") + ";");

                    arySrc.push(` ($state.$SLOT || []).forEach(vn => { `);
                    arySrc.push(`     if (vn.a) { `);
                    if (isNoNameSlot) {
                        arySrc.push(`     vn.a.slot !== undefined && (_hasDefinedSlotTemplate = 1); `); // 判断是否有明文传入插槽模板（如果没有，多数是使用单一的默认插槽）
                    }
                    slots.forEach(slotNm => {
                        arySrc.push(`     vn.a.slot === '${slotNm}' && (${SlotVnodes}_${hash(slotNm)} = vn.c || []); `); // 插槽名称一致时，复制相应插槽模板
                    });
                    arySrc.push(`     } `);
                    arySrc.push(` }); `);
                    if (isNoNameSlot) {
                        // 单一插槽，且无插槽名称，如果没特定模板则默认使用子节点
                        arySrc.push(
                            ` !_hasDefinedSlotTemplate && !${SlotVnodes}_${hash("")}.length && (${SlotVnodes}_${hash("")} = $state.$SLOT || []); `
                        );
                    }

                    root.walk("View", (nd, obj) => {
                        let type = options.TypeCodeBlock;
                        let value = arySrc.join("\n");
                        nd.addChild(this.createNode({ type, value }), 0); // 根节点前插入代码块节点
                        return false;
                    });
                }
            });
        })()
    );

    /*
    let slotVnodes_xxxxx = [], slotVnodes_nnnnn = [];
    ($state.$SLOT || []).forEach(vn => {
        if (vn.a) {
            vn.a.slot === "xxx" && (slotVnodes_xxxxx = vn.c || []);
            vn.a.slot === "nnn" && (slotVnodes_nnnnn = vn.c || []);
        }
    });
*/

    /*
    let _hasDefinedSlotTemplate, slotVnodes_15ed = [];
    ($state.$SLOT || []).forEach(vn => {
        if (vn.a) {
            vn.a.slot !== undefined && (_hasDefinedSlotTemplate = 1);
            vn.a.slot === "" && (slotVnodes_15ed = vn.c || []);
        }
    });
    !_hasDefinedSlotTemplate && !slotVnodes_15ed.length && (slotVnodes_15ed = $state.$SLOT || []);
*/

    // ------- k85p-astedit-transform-tag-slot end
})();

/* ------- m15p-csslibify-check-@csslib ------- */
(() => {
    // ------- m15p-csslibify-check-@csslib start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 检查 @csslib
            // 排除别名冲突 （不做建库处理）
            return postobject.plugin("m15p-csslibify-check-@csslib", function(root, context) {
                let oCsslib = context.result.oCsslib;

                let oNameSet = new Set();

                root.walk("@csslib", (node, object) => {
                    if (bus.at("是否表达式", object.value)) {
                        // 属性 @csslib 不能使用表达式
                        throw new Err("@csslib unsupport the expression", {
                            file: context.input.file,
                            text: context.input.text,
                            start: object.loc.start.pos,
                            end: object.loc.end.pos
                        });
                    }

                    let tmpAry = object.value.split("=");
                    let libname = tmpAry.length > 1 ? tmpAry[0].trim() : "*"; // 支持简写，如@csslib="pkg:**.min.css"，等同@csslib="*=pkg:**.min.css"
                    if (!libname) {
                        // 漏写别名时报错，如@csslib="=pkg:**.min.css"
                        throw new Err("use * as empty csslib name. etc. * = " + tmpAry[1], {
                            file: context.input.file,
                            text: context.input.text,
                            start: object.loc.start.pos,
                            end: object.loc.end.pos
                        });
                    }

                    if (oCsslib[libname]) {
                        // 有别名冲突时报错（组件内@csslib的别名，不能和项目及组件的[csslib]有别名重复）
                        throw new Err("duplicate csslib name: " + libname, {
                            file: context.input.file,
                            text: context.input.text,
                            start: object.loc.start.pos,
                            end: object.loc.end.pos
                        });
                    }

                    if (oNameSet.has(libname)) {
                        // 有别名冲突时报错（同一组件内，view中的@csslib不能有别名重复）
                        throw new Err("duplicate csslib name: " + libname, {
                            file: context.input.file,
                            text: context.input.text,
                            start: object.loc.start.pos,
                            end: object.loc.end.pos
                        });
                    }
                    oNameSet.add(libname);
                });
            });
        })()
    );

    // ------- m15p-csslibify-check-@csslib end
})();

/* ------- m17p-csslibify-gen-css-@csslib ------- */
(() => {
    // ------- m17p-csslibify-gen-css-@csslib start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 含@csslib的标签，按需查询引用样式库
            return postobject.plugin("m17p-csslibify-gen-css-@csslib", function(root, context) {
                let style = context.style;
                let oCsslibPkgs = context.result.oCsslibPkgs; // 样式库匿名集合
                let hashClassName = bus.on("哈希样式类名")[0];
                let rename = (pkg, cls) => hashClassName(context.input.file, pkg ? cls + "@" + pkg : cls); // 自定义改名函数
                let strict = true; // 样式库严格匹配模式
                let universal = false; // 不查取通用样式
                let opts = { rename, strict, universal };
                let atcsslibtagcss = (context.result.atcsslibtagcss = context.result.atcsslibtagcss || []); // @csslib的标准标签样式

                let ary, clsname;
                root.walk("Class", (node, object) => {
                    // 查找@csslib属性节点，@csslib仅作用于当前所在标签，汇总当前标签和样式类，用当前样式库按严格匹配模式一次性取出
                    let csslibNode,
                        atcsslib,
                        querys = [];
                    for (let i = 0, nd; (nd = node.parent.nodes[i++]); ) {
                        if (nd.type === "@csslib") {
                            csslibNode = nd;
                            break; // 找到
                        }
                    }
                    if (csslibNode) {
                        atcsslib = bus.at("样式库", csslibNode.object.value);
                        oCsslibPkgs[atcsslib.name] = atcsslib.pkg; // 保存样式库匿名关系，用于脚本类名转换
                        node.parent.object.standard && querys.push(node.parent.object.value); // 标准标签名
                        for (let i = 0, clspkg, clsname, asname; (clspkg = object.classes[i++]); ) {
                            ary = clspkg.split("@");
                            clsname = "." + ary[0]; // 类名
                            asname = ary.length > 1 ? ary[1] : "*"; // 库别名
                            if (atcsslib.pkg === asname) {
                                querys.push(clsname); // 匹配当前样式库待查的样式类

                                if (!csslib.has(clsname)) {
                                    // 按宽松模式检查样式库是否有指定样式类，没有则报错
                                    throw new Err("css class not found: " + clsname, {
                                        file: context.input.file,
                                        text: context.input.text,
                                        start: object.loc.start.pos,
                                        end: object.loc.end.pos
                                    });
                                }
                            }
                        }

                        querys.length && atcsslibtagcss.push(atcsslib.get(...querys, { rename, strict })); // 用当前样式库一次性查取
                    }
                });
            });
        })()
    );

    // ------- m17p-csslibify-gen-css-@csslib end
})();

/* ------- n15p-astedit-remove-blank-text ------- */
(() => {
    // ------- n15p-astedit-remove-blank-text start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("n15p-astedit-remove-blank-text", function(root, context) {
                const OPTS = bus.at("视图编译选项");

                root.walk(OPTS.TypeText, (node, object) => {
                    // 保留pre标签中的空白节点
                    if (!/^\s*$/.test(object.value) || node.parent.object.name === "pre") return;

                    // 删除边界位置的空白节点
                    let nBefore = node.before();
                    let nAfter = node.after();
                    if (
                        !nBefore ||
                        !nAfter ||
                        (nBefore.type === "Tag" || nAfter.type === "Tag") ||
                        (nBefore.type === OPTS.TypeHtmlComment || nAfter.type === OPTS.TypeHtmlComment) ||
                        (nBefore.type === OPTS.TypeCodeBlock || nAfter.type === OPTS.TypeCodeBlock)
                    ) {
                        node.remove();
                    }
                });
            });
        })()
    );

    // ------- n15p-astedit-remove-blank-text end
})();

/* ------- n25p-astedit-remove-html-comment ------- */
(() => {
    // ------- n25p-astedit-remove-html-comment start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("n25p-astedit-remove-html-comment", function(root, context) {
                const OPTS = bus.at("视图编译选项");

                root.walk(OPTS.TypeHtmlComment, (node, object) => {
                    node.remove(); // 删除注释节点
                });
            });
        })()
    );

    // ------- n25p-astedit-remove-html-comment end
})();

/* ------- n35p-astedit-join-text-node ------- */
(() => {
    // ------- n35p-astedit-join-text-node start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("n35p-astedit-join-text-node", function(root, context) {
                const OPTS = bus.at("视图编译选项");

                // TODO 用选项常量
                root.walk(/^(Text|Expression)$/, (node, object) => {
                    // 合并连续的文本节点
                    let ary = [node];
                    let nAfter = node.after();
                    while (nAfter && (nAfter.type === OPTS.TypeText || nAfter.type === OPTS.TypeExpression)) {
                        ary.push(nAfter);
                        nAfter = nAfter.after();
                    }

                    if (ary.length < 2) return;

                    let aryRs = [],
                        tmp;
                    ary.forEach(nd => {
                        if (nd.type === OPTS.TypeText) {
                            aryRs.push('"' + lineString(nd.object.value) + '"');
                        } else {
                            if (!isBlankOrCommentExpr(nd.object.value)) {
                                aryRs.push(nd.object.value.replace(/^\s*\{/, "(").replace(/\}\s*$/, ")"));
                            }
                        }
                    });

                    let value = OPTS.ExpressionStart + aryRs.join(" + ") + OPTS.ExpressionEnd;
                    let start = ary[0].object.loc.start;
                    let end = ary[ary.length - 1].object.loc.end;
                    let loc = { start, end };
                    let tNode = this.createNode({ type: OPTS.TypeExpression, value, loc });
                    node.before(tNode);
                    ary.forEach(nd => nd.remove());
                });
            });
        })()
    );

    function lineString(str, quote = '"') {
        if (str == null) {
            return str;
        }

        let rs = str
            .replace(/\\/g, "\\\\")
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n");
        //    let rs = str.replace(/\r/g, '\\r').replace(/\n/g, '\\n')
        if (quote == '"') {
            rs = rs.replace(/"/g, '\\"');
        } else if (quote == "'") {
            rs = rs.replace(/'/g, "\\'");
        }
        return rs;
    }

    function isBlankOrCommentExpr(code) {
        code = code.trim();
        if (code.startsWith("{") && code.endsWith("}")) {
            code = code.substring(1, code.length - 1).trim();
        }
        if (!code) return true; // 空白

        if (/^\/\/.*$/.test(code) && code.indexOf("\n") < 0) return true; // 单行注释

        if (!code.startsWith("/*") || !code.endsWith("*/")) {
            return false; // 肯定不是多行注释
        }

        if (code.indexOf("*/") === code.length - 2) {
            return true; // 中间没有【*/】，是多行注释
        }

        return false;
    }

    // ------- n35p-astedit-join-text-node end
})();

/* ------- n45p-astedit-remove-jscode-blank-comment ------- */
(() => {
    // ------- n45p-astedit-remove-jscode-blank-comment start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("n45p-astedit-remove-jscode-blank-comment", function(root, context) {
                const OPTS = bus.at("视图编译选项");

                root.walk(OPTS.TypeCodeBlock, (node, object) => {
                    if (isBlankOrComment(object.value)) {
                        node.remove(); // 删除空白节点和注释节点
                    }
                });
            });
        })()
    );

    function isBlankOrComment(code) {
        code = code.trim();
        if (!code) return true; // 空白

        if (/^\/\/.*$/.test(code) && code.indexOf("\n") < 0) return true; // 单行注释

        if (!code.startsWith("/*") || !code.endsWith("*/")) {
            return false; // 肯定不是多行注释
        }

        if (code.indexOf("*/") === code.length - 2) {
            return true; // 中间没有【*/】，是多行注释
        }

        return false;
    }
    // ------- n45p-astedit-remove-jscode-blank-comment end
})();

/* ------- p00m-component-js-template-fn ------- */
(() => {
    // ------- p00m-component-js-template-fn start
    const bus = require("@gotoeasy/bus");

    // 模板
    class ClsTemplate {
        constructor(tmpl = "", argNm) {
            // 模板解析函数（代码数组，模板，前一句是否JS代码）
            let fnParse = function(ary, tmpl, isPreCode) {
                let tmp,
                    idx = tmpl.indexOf("<%");
                if (idx < 0) {
                    // Text
                    ary.push(fnText(ary, tmpl, isPreCode)); // 保存解析结果
                } else if (idx == 0) {
                    if (tmpl.indexOf("<%=") == idx) {
                        // Value
                        tmpl = tmpl.substring(3);
                        idx = tmpl.indexOf("%>");
                        tmp = tmpl.substring(0, idx);

                        ary.push(ary.pop() + "+" + tmp); // 保存解析结果
                        fnParse(ary, tmpl.substring(idx + 2), false); // 剩余继续解析
                    } else {
                        // Code
                        tmpl = tmpl.substring(2);
                        idx = tmpl.indexOf("%>");
                        tmp = tmpl.substring(0, idx);

                        isPreCode ? ary.push(tmp) : ary.push(ary.pop() + ";") && ary.push(tmp); // 保存解析结果
                        fnParse(ary, tmpl.substring(idx + 2), true); // 剩余继续解析
                    }
                } else {
                    // 取出左边Text
                    tmp = tmpl.substring(0, idx);
                    ary.push(fnText(ary, tmp, isPreCode)); // 保存解析结果
                    fnParse(ary, tmpl.substring(idx), false); // 剩余继续解析
                }
            };
            // 字符串拼接转义函数
            let fnText = function(ary, txt, isPreCode) {
                let str = txt
                    .replace(/\r/g, "\\r")
                    .replace(/\n/g, "\\n")
                    .replace(/\'/g, "\\'");
                return isPreCode ? "s+='" + str + "'" : ary.pop() + "+'" + str + "'";
            };

            // 创建动态函数toString，使用例子：new Template('Hello <%= data.name %>', 'data').toString({size:20}, {name:'world'})
            let aryBody = [];
            aryBody.push("let s=''");
            fnParse(aryBody, tmpl, true); // 代码数组=aryBody，模板=tmpl，前一句是否JS代码=true
            aryBody.push("return s");
            this.toString = argNm ? new Function(argNm, aryBody.join("\n")) : new Function(aryBody.join("\n"));
        }
    }

    bus.on(
        "编译模板JS",
        (function(result) {
            return function() {
                if (!result) {
                    let tmpl = getSrcTemplate().replace(/\\/g, "\\\\");
                    let clsTemplate = new ClsTemplate(tmpl, "$data");
                    result = clsTemplate.toString;
                }

                return result;
            };
        })()
    );

    function getSrcTemplate() {
        return `

// ------------------------------------------------------------------------------------------------------
// 组件 <%= $data['COMPONENT_NAME'] %>
// 注:应通过rpose.newComponentProxy方法创建组件代理对象后使用，而不是直接调用方法或用new创建
// ------------------------------------------------------------------------------------------------------
<% if ( $data['singleton'] ){ %>
    // 这是个单例组件
    <%= $data['COMPONENT_NAME'] %>.Singleton = true;
<% } %>

// 属性接口定义
<%= $data['COMPONENT_NAME'] %>.prototype.$OPTION_KEYS = <%= JSON.stringify($data['optionkeys']) %>;  // 可通过标签配置的属性，未定义则不支持外部配置
<%= $data['COMPONENT_NAME'] %>.prototype.$STATE_KEYS = <%= JSON.stringify($data['statekeys']) %>;    // 可更新的state属性，未定义则不支持外部更新state

// 组件函数
function <%= $data['COMPONENT_NAME'] %>(options={}) {

    <% if ( $data['optionkeys'] != null ){ %>
    // 组件默认选项值
    this.$options = <%= $data['options'] %>;
    rpose.extend(this.$options, options, this.$OPTION_KEYS);    // 按属性接口克隆配置选项
    <% }else{ %>
    // 组件默认选项值
    this.$options = <%= $data['options'] %>;
    <% } %>

    <% if ( $data['statekeys'] != null ){ %>
    // 组件默认数据状态值
    this.$state = <%= $data['state'] %>;
    rpose.extend(this.$state, options, this.$STATE_KEYS);       // 按属性接口克隆数据状态
    <% }else{ %>
    // 组件默认数据状态值
    this.$state = <%= $data['state'] %>;
    <% } %>

    <% if ( $data['actions'] ){ %>
    // 事件处理器
    <%= $data['actions'] %>
    <% } %>

    <% if ( $data['methods'] ){ %>
    // 自定义方法
    <%= $data['methods'] %>;
    <% } %>

    <% if ( $data['updater'] ){ %>
    // 组件更新函数
    this.$updater = <%= $data['updater'] %>;
    <% } %>
}

/**
 * 节点模板函数
 */
<%= $data['COMPONENT_NAME'] %>.prototype.nodeTemplate = <%= $data['vnodeTemplate'] %>

`;
    }

    // ------- p00m-component-js-template-fn end
})();

/* ------- p10m-transform-expression ------- */
(() => {
    // ------- p10m-transform-expression start
    const bus = require("@gotoeasy/bus");

    bus.on(
        "表达式代码转换",
        (function() {
            return function(expression) {
                let expr = expression.trim();
                expr.startsWith("{") && expr.endsWith("}") && (expr = expr.substring(1, expr.length - 1));
                return `(${expr})`;
            };
        })()
    );

    // ------- p10m-transform-expression end
})();

/* ------- p12m-component-astgen-node-text ------- */
(() => {
    // ------- p12m-component-astgen-node-text start
    const bus = require("@gotoeasy/bus");

    bus.on(
        "astgen-node-text",
        (function() {
            return function(node, context) {
                const OPTS = bus.at("视图编译选项");

                if (node.type === OPTS.TypeText) {
                    return textJsify(node, context);
                } else if (node.type === OPTS.TypeExpression) {
                    return expressionJsify(node, context);
                }

                return "";
            };
        })()
    );

    function textJsify(node, context) {
        let obj = node.object; // 当前节点数据对象

        let ary = [];
        let text = '"' + lineString(obj.value) + '"'; // 按双引号转换
        ary.push(`{ `);
        ary.push(`  s: ${text} `); // 静态文字
        ary.push(` ,k: ${context.keyCounter++} `); // 组件范围内的唯一节点标识（便于运行期差异比较优化）
        ary.push(`}`);

        return ary.join("\n");
    }

    function expressionJsify(node, context) {
        let obj = node.object; // 当前节点数据对象

        let ary = [];
        let text = obj.value.replace(/^\s*\{/, "(").replace(/\}\s*$/, ")"); // 去除前后大括号{}，换为小括号包围起来确保正确 // TODO 按选项设定替换
        ary.push(`{ `);
        ary.push(`  s: ${text} `); // 一般是动态文字，也可以是静态
        ary.push(` ,k: ${context.keyCounter++} `); // 组件范围内的唯一节点标识（便于运行期差异比较优化）
        ary.push(`}`);

        return ary.join("\n");
    }

    function lineString(str, quote = '"') {
        if (str == null) {
            return str;
        }

        let rs = str
            .replace(/\\/g, "\\\\")
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n");
        if (quote == '"') {
            rs = rs.replace(/"/g, '\\"');
        } else if (quote == "'") {
            rs = rs.replace(/'/g, "\\'");
        }
        return rs;
    }

    // ------- p12m-component-astgen-node-text end
})();

/* ------- p15p-reference-components ------- */
(() => {
    // ------- p15p-reference-components start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("p15p-reference-components", function(root, context) {
                let result = context.result;
                let oSet = new Set();
                root.walk(
                    "Tag",
                    (node, object) => {
                        if (!object.standard) {
                            oSet.add(object.value);

                            let file = bus.at("标签源文件", object.value);
                            if (!file) {
                                throw new Err("file not found of tag: " + object.value, {
                                    file: context.input.file,
                                    text: context.input.text,
                                    start: object.loc.start.pos
                                });
                            }
                        }
                    },
                    { readonly: true }
                );

                result.references = [...oSet];
            });
        })()
    );

    // ------- p15p-reference-components end
})();

/* ------- p17p-components-reference-standard-tags ------- */
(() => {
    // ------- p17p-components-reference-standard-tags start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("p17p-components-reference-standard-tags", function(root, context) {
                let result = context.result;
                let oSet = new Set();
                root.walk(
                    "Tag",
                    (node, object) => {
                        if (object.standard) {
                            oSet.add(object.value);
                        }
                    },
                    { readonly: true }
                );

                result.standardtags = [...oSet];
            });
        })()
    );

    // ------- p17p-components-reference-standard-tags end
})();

/* ------- p20m-component-astgen-node-attributes ------- */
(() => {
    // ------- p20m-component-astgen-node-attributes start
    const bus = require("@gotoeasy/bus");

    const REG_EVENTS = /^(onclick|onchange|onabort|onafterprint|onbeforeprint|onbeforeunload|onblur|oncanplay|oncanplaythrough|oncontextmenu|oncopy|oncut|ondblclick|ondrag|ondragend|ondragenter|ondragleave|ondragover|ondragstart|ondrop|ondurationchange|onemptied|onended|onerror|onfocus|onfocusin|onfocusout|onformchange|onforminput|onhashchange|oninput|oninvalid|onkeydown|onkeypress|onkeyup|onload|onloadeddata|onloadedmetadata|onloadstart|onmousedown|onmouseenter|onmouseleave|onmousemove|onmouseout|onmouseover|onmouseup|onmousewheel|onoffline|ononline|onpagehide|onpageshow|onpaste|onpause|onplay|onplaying|onprogress|onratechange|onreadystatechange|onreset|onresize|onscroll|onsearch|onseeked|onseeking|onselect|onshow|onstalled|onsubmit|onsuspend|ontimeupdate|ontoggle|onunload|onunload|onvolumechange|onwaiting|onwheel)$/i;

    bus.on(
        "astgen-node-attributes",
        (function() {
            // 标签普通属性生成json形式代码
            return function(tagNode, context) {
                if (!tagNode.nodes) return "";

                // 查找检查属性节点
                let attrsNode;
                for (let i = 0, nd; (nd = tagNode.nodes[i++]); ) {
                    if (nd.type === "Attributes") {
                        attrsNode = nd;
                        break;
                    }
                }
                if (!attrsNode || !attrsNode.nodes || !attrsNode.nodes.length) return "";

                // 生成
                let key,
                    value,
                    comma = "",
                    ary = [];
                ary.push(`{ `);
                attrsNode.nodes.forEach(node => {
                    key = '"' + lineString(node.object.name) + '"';
                    if (node.object.isExpression) {
                        value = bus.at("表达式代码转换", node.object.value);
                    } else if (typeof node.object.value === "string") {
                        if (
                            !tagNode.object.standard &&
                            REG_EVENTS.test(node.object.name) &&
                            !node.object.isExpression &&
                            context.script.$actionkeys
                        ) {
                            // 这是个组件上的事件名属性（非组件的事件名属性都转成Event了），如果不是表达式，而且在actions中有定义，顺便就办了，免得一定要写成表达式
                            let val = node.object.value.trim();
                            let fnNm = val.startsWith("$actions.") ? val.substring(9) : val;
                            if (context.script.$actionkeys.includes(fnNm)) {
                                // 能找到定义的方法则当方法处理
                                value = `$actions['${fnNm}']`; // "fnClick" => $actions['fnClick']
                            } else {
                                // 找不到时，按普通属性处理
                                value = '"' + lineString(node.object.value) + '"';
                            }
                        } else {
                            value = '"' + lineString(node.object.value) + '"';
                        }
                    } else {
                        value = node.object.value;
                    }

                    ary.push(` ${comma} ${key}: ${value} `);
                    !comma && (comma = ",");
                });
                ary.push(` } `);

                return ary.join("\n");
            };
        })()
    );

    function lineString(str, quote = '"') {
        if (str == null) {
            return str;
        }

        let rs = str
            .replace(/\\/g, "\\\\")
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n");
        //    let rs = str.replace(/\r/g, '\\r').replace(/\n/g, '\\n')
        if (quote == '"') {
            rs = rs.replace(/"/g, '\\"');
        } else if (quote == "'") {
            rs = rs.replace(/'/g, "\\'");
        }
        return rs;
    }

    // ------- p20m-component-astgen-node-attributes end
})();

/* ------- p22m-component-astgen-node-events ------- */
(() => {
    // ------- p22m-component-astgen-node-events start
    const bus = require("@gotoeasy/bus");
    const Err = require("@gotoeasy/err");

    bus.on(
        "astgen-node-events",
        (function() {
            // 标签事件属性生成json形式代码
            return function(tagNode, context) {
                if (!tagNode.nodes) return "";

                // 查找检查事件属性节点
                let eventsNode;
                for (let i = 0, nd; (nd = tagNode.nodes[i++]); ) {
                    if (nd.type === "Events") {
                        eventsNode = nd;
                        break; // 找到
                    }
                }
                if (!eventsNode || !eventsNode.nodes || !eventsNode.nodes.length) return "";

                // 生成
                let key,
                    value,
                    comma = "",
                    ary = [];
                ary.push(`{ `);
                eventsNode.nodes.forEach(node => {
                    key = node.object.name.substring(2); // onclick => click
                    value = node.object.value;
                    if (node.object.isExpression) {
                        value = bus.at("表达式代码转换", value); // { abcd } => (abcd)
                    } else {
                        value = value.trim();
                        let fnNm = value.startsWith("$actions.") ? value.substring(9) : value;
                        // 静态定义时顺便检查
                        if (context.script.$actionkeys && context.script.$actionkeys.includes(fnNm)) {
                            value = "$actions." + value; // "fnClick" => $actions.fnClick
                            //value = `$actions['${value}']`;                    // "fnClick" => $actions['fnClick']
                        } else {
                            // 指定方法找不到
                            throw new Err("action not found: " + fnNm, {
                                file: context.input.file,
                                text: context.input.text,
                                start: node.object.loc.start.pos,
                                end: node.object.loc.end.pos
                            });
                        }
                    }

                    ary.push(` ${comma} ${key}: ${value} `);
                    !comma && (comma = ",");
                });
                ary.push(` } `);

                return ary.join("\n");
            };
        })()
    );

    // ------- p22m-component-astgen-node-events end
})();

/* ------- p24m-component-astgen-node-style ------- */
(() => {
    // ------- p24m-component-astgen-node-style start
    const bus = require("@gotoeasy/bus");
    const Err = require("@gotoeasy/err");

    bus.on(
        "astgen-node-style",
        (function() {
            // 标签样式属性生成json属性值形式代码
            // "size:12px;color:{color};height:100;" => ("size:12px;color:" + (color) + ";height:100;")
            // @show在前面已转换为display一起合并进style
            return function(tagNode, context) {
                if (!tagNode.nodes) return "";

                // 查找检查事件属性节点
                let styleNode;
                for (let i = 0, nd; (nd = tagNode.nodes[i++]); ) {
                    if (nd.type === "Style") {
                        styleNode = nd;
                        break; // 找到
                    }
                }

                if (!styleNode || !styleNode.object.value) return ""; // 没有样式节点或没有样式属性值，返回空白

                // 生成
                if (!styleNode.object.isExpression) {
                    return '"' + lineString(styleNode.object.value) + '"';
                }

                let ary = [];
                parseExpression(ary, styleNode.object.value);
                return "(" + ary.join(" + ") + ")";
            };
        })()
    );

    function parseExpression(ary, val) {
        // 表达式中含对象
        if (/^\{\s*\{[\s\S]*?\}\s*\}$/.test(val)) {
            // TODO 待改善
            ary.push(val.replace(/^\{/, "").replace(/\}$/, "")); // { {a: 123} } => {a:123}
            return;
        }

        let idxStart = val.indexOf("{");
        if (idxStart < 0) {
            ary.push('"' + lineString(val) + '"'); // 无表达式
            return;
        }

        let idxEnd = val.indexOf("}", idxStart);
        if (idxEnd < 0) {
            ary.push('"' + lineString(val) + '"'); // 无表达式
            return;
        }

        if (idxStart > 0) {
            ary.push('"' + lineString(val.substring(0, idxStart)) + '"'); // acb{def}ghi => "abc"
        }
        ary.push("(" + val.substring(idxStart + 1, idxEnd) + ")"); // acb{def}ghi => (def)

        let tmp = val.substring(idxEnd + 1);
        tmp && parseExpression(ary, tmp); // acb{def}ghi : ghi
    }

    function lineString(str, quote = '"') {
        if (str == null) {
            return str;
        }

        let rs = str
            .replace(/\\/g, "\\\\")
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n");
        if (quote == '"') {
            rs = rs.replace(/"/g, '\\"');
        } else if (quote == "'") {
            rs = rs.replace(/'/g, "\\'");
        }
        return rs;
    }

    // ------- p24m-component-astgen-node-style end
})();

/* ------- p26m-component-astgen-node-class ------- */
(() => {
    // ------- p26m-component-astgen-node-class start
    const bus = require("@gotoeasy/bus");
    const Err = require("@gotoeasy/err");

    bus.on(
        "astgen-node-class",
        (function() {
            // 标签类属性生成json属性值形式代码
            // "abc def {bar:!bar}" => {class:{abc:1, def:1, bar:!bar}}
            // 修改类名
            return function(tagNode, context) {
                if (!tagNode.nodes) return "";

                // 查找Class属性节点
                let classNode;
                for (let i = 0, nd; (nd = tagNode.nodes[i++]); ) {
                    if (nd.type === "Class") {
                        classNode = nd;
                        break; // 找到
                    }
                }
                if (!classNode || !classNode.object.value) return ""; // 没有类属性节点或没有类属性值，返回空白

                // 生成
                return classStrToObjectString(classNode.object.value, context);
            };
        })()
    );

    function classStrToObjectString(clas, context) {
        // TODO 含大括号冒号的复杂表达式
        let oCsslibPkgs = context.result.oCsslibPkgs;
        let oRs = {};
        clas = clas.replace(/\{.*?\}/g, function(match) {
            let str = match.substring(1, match.length - 1); // {'xxx': ... , yyy: ...} => 'xxx': ... , yyy: ...

            let idx, cls, expr;
            while (str.indexOf(":") > 0) {
                idx = str.indexOf(":");
                cls = str.substring(0, idx).replace(/['"]/g, ""); // cls

                expr = str.substring(idx + 1);
                let idx2 = expr.indexOf(":");
                if (idx2 > 0) {
                    expr = expr.substring(0, idx2);
                    expr = expr.substring(0, expr.lastIndexOf(",")); // expr
                    str = str.substring(idx + 1 + expr.length + 1); // 更新临时变量
                } else {
                    str = "";
                }

                oRs[bus.at("哈希样式类名", context.input.file, getClassPkg(cls, oCsslibPkgs))] = "@(" + expr + ")@";
            }

            return "";
        });

        let ary = clas.split(/\s/);
        for (let i = 0; i < ary.length; i++) {
            ary[i].trim() && (oRs[bus.at("哈希样式类名", context.input.file, getClassPkg(ary[i], oCsslibPkgs))] = 1);
        }

        return JSON.stringify(oRs).replace(/('@|@'|"@|@")/g, "");
    }

    function getClassPkg(cls, oCsslibPkgs) {
        let ary = cls.trim().split("@");
        if (ary.length > 1) {
            return ary[0] + "@" + oCsslibPkgs[ary[1]];
        }

        return ary[0];
    }

    // ------- p26m-component-astgen-node-class end
})();

/* ------- p28m-component-astgen-node-{prop} ------- */
(() => {
    // ------- p28m-component-astgen-node-{prop} start
    const bus = require("@gotoeasy/bus");
    const Err = require("@gotoeasy/err");

    bus.on(
        "astgen-node-{prop}",
        (function() {
            // 标签对象表达式属性生成对象复制语句代码片段
            // 如 {prop1} {prop2}，最终rpose.assign( {attrs属性对象}, prop1, prop2)
            // 生成： (prop1), (prop2)
            return function(tagNode, context) {
                if (!tagNode.nodes) return "";

                // 查找检查事件属性节点
                let exprAttrNode;
                for (let i = 0, nd; (nd = tagNode.nodes[i++]); ) {
                    if (nd.type === "ObjectExpressionAttributes") {
                        exprAttrNode = nd;
                        break; // 找到
                    }
                }
                if (!exprAttrNode || !exprAttrNode.nodes || !exprAttrNode.nodes.length) return "";

                // 生成
                let prop,
                    ary = [];
                exprAttrNode.nodes.forEach(node => {
                    prop = node.object.name.replace(/^\s*\{=?/, "(").replace(/\}\s*$/, ")"); // {prop} => prop, {=prop} => prop
                    ary.push(prop);
                });

                return ary.join(",");
            };
        })()
    );

    // ------- p28m-component-astgen-node-{prop} end
})();

/* ------- p30m-component-astgen-node-tag ------- */
(() => {
    // ------- p30m-component-astgen-node-tag start
    const bus = require("@gotoeasy/bus");
    const hash = require("@gotoeasy/hash");

    bus.on(
        "astgen-node-tag",
        (function() {
            return tagJsify;
        })()
    );

    // 单个标签节点的代码生成
    function tagJsify(node, context) {
        if (node.type !== "Tag") return "";

        let obj = node.object; // 当前节点数据对象
        let isTop = node.parent.type === "View"; // 是否为组件的顶部节点
        let isStatic = isStaticTagNode(node); // 是否为静态不变节点，便于运行期的节点差异比较优化
        let isComponent = !node.object.standard; // 是否为组件标签节点
        let childrenJs = bus.at("astgen-node-tag-nodes", node.nodes, context); // 子节点代码，空白或 [{...},{...},{...}]
        let attrs = bus.at("astgen-node-attributes", node, context);
        let events = bus.at("astgen-node-events", node, context);
        let isSvg = node.object.svg; // 是否svg标签或svg子标签

        // style和class要合并到attrs中去
        let style = bus.at("astgen-node-style", node, context);
        if (style) {
            if (!attrs) {
                attrs = `{style: ${style}}`;
            } else {
                attrs = attrs.replace(/\}\s*$/, `,style: ${style}}`);
            }
        }
        let clasz = bus.at("astgen-node-class", node, context);
        if (clasz) {
            if (!attrs) {
                attrs = `{class: ${clasz}}`;
            } else {
                attrs = attrs.replace(/\}\s*$/, `,class: ${clasz}}`);
            }
        }

        // 有单纯的表达式对象属性时，转换成对象复制语句
        let props = bus.at("astgen-node-{prop}", node, context); // (prop1),(prop2)
        if (props) {
            attrs = `rpose.assign( ${attrs}, ${props})`;
        }

        let ary = [];
        ary.push(`{ `);
        ary.push(`  t: '${obj.value}' `); // 标签名
        isTop && ary.push(` ,r: 1 `); // 顶部节点标识
        isStatic && ary.push(` ,x: 1 `); // 静态节点标识（当前节点和子孙节点没有变量不会变化）
        isComponent && ary.push(` ,m: 1 `); // 组件标签节点标识（便于运行期创建标签或组件）
        isSvg && ary.push(` ,g: 1 `); // svg标签或svg子标签标识
        ary.push(` ,k: ${context.keyCounter++} `); // 组件范围内的唯一节点标识（便于运行期差异比较优化）
        childrenJs && ary.push(` ,c: ${childrenJs} `); // 静态节点标识（当前节点和子孙节点没有变量不会变化）
        attrs && ary.push(` ,a: ${attrs} `); // 属性对象
        events && ary.push(` ,e: ${events} `); // 事件对象
        ary.push(`}`);

        return ary.join("\n");
    }

    // TODO
    function isStaticTagNode(node) {
        return false;
    }

    // ------- p30m-component-astgen-node-tag end
})();

/* ------- p32m-component-astgen-node-tag-nodes ------- */
(() => {
    // ------- p32m-component-astgen-node-tag-nodes start
    const bus = require("@gotoeasy/bus");
    const Err = require("@gotoeasy/err");

    const AryName = "_Ary";

    bus.on(
        "astgen-node-tag-nodes",
        (function() {
            return nodesJsify;
        })()
    );

    function nodesJsify(nodes = [], context) {
        if (!nodes.length) return "";

        return hasCodeBolck(nodes) ? nodesWithScriptJsify(nodes, context) : nodesWithoutScriptJsify(nodes, context);
    }

    // 节点数组中含有代码块，通过箭头函数返回动态数组
    function nodesWithScriptJsify(nodes = [], context) {
        let ary = [],
            src;

        ary.push(` ((${AryName}) => { `);

        for (let i = 0, node; (node = nodes[i++]); ) {
            if (node.type === "JsCode") {
                ary.push(node.object.value); // 代码块，直接添加
            } else if ((src = bus.at("astgen-node-tag", node, context))) {
                ary.push(` ${AryName}.push( ${src} ); `); // 标签节点
            } else if ((src = bus.at("astgen-node-text", node, context))) {
                ary.push(` ${AryName}.push( ${src} ); `); // 文本节点
            } else if (node.type === "Attributes" || node.type === "Events" || node.type === "ObjectExpressionAttributes") {
                // ignore
            } else if (node.type === "Class" || node.type === "Style") {
                // ignore
            } else {
                throw new Err("unhandle node type: " + node.type); // 应该没有这种情况
            }
        }
        ary.push(` return ${AryName}; `);

        ary.push(` })([]) `);
        return ary.join("\n");
    }

    // 节点数组中含有代码块，返回静态数组
    function nodesWithoutScriptJsify(nodes = [], context) {
        let src,
            ary = [];
        nodes.forEach(node => {
            src = bus.at("astgen-node-tag", node, context);
            src && ary.push(src);

            src = bus.at("astgen-node-text", node, context);
            src && ary.push(src);
        });
        return "[" + ary.join(",\n") + "]"; // [{...},{...},{...}]
    }

    function hasCodeBolck(nodes) {
        for (let i = 0, node; (node = nodes[i++]); ) {
            if (node.type === "JsCode") {
                return true;
            }
        }
        return false;
    }

    // ------- p32m-component-astgen-node-tag-nodes end
})();

/* ------- s15p-component-ast-jsify-writer ------- */
(() => {
    // ------- s15p-component-ast-jsify-writer start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const File = require("@gotoeasy/file");
    const csjs = require("@gotoeasy/csjs");
    const Err = require("@gotoeasy/err");

    class JsWriter {
        constructor() {
            this.ary = [];
        }

        push(src) {
            src !== undefined && this.ary.push(src);
        }

        write(src) {
            src !== undefined && this.ary.push(src);
        }

        out(file) {
            File.write(file, this.toString());
        }

        getArray() {
            return this.ary;
        }

        toString() {
            let js = this.ary.join("\n");
            try {
                return csjs.formatJs(js);
                // return csjs.formatJs( csjs.miniJs(js) );
            } catch (e) {
                File.write(process.cwd() + "/build/error/format-error.js", js);
                throw e;
            }
        }
    }

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("s15p-component-ast-jsify-writer", function(root, context) {
                context.writer = new JsWriter();
            });
        })()
    );

    // ------- s15p-component-ast-jsify-writer end
})();

/* ------- s25p-component-ast-jsify-root ------- */
(() => {
    // ------- s25p-component-ast-jsify-root start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const File = require("@gotoeasy/file");
    const csjs = require("@gotoeasy/csjs");
    const Err = require("@gotoeasy/err");

    const AryNm = "v_Array";

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("s25p-component-ast-jsify-root", function(root, context) {
                let writer = context.writer;
                let script = context.script;

                root.walk("View", (node, object) => {
                    if (!node.nodes || node.nodes.length < 1) {
                        return writer.write("// 没有节点，无可生成");
                    }

                    writer.write("function nodeTemplate($state, $options, $actions, $this) {");
                    if (hasCodeBolck(node.nodes)) {
                        writer.write(`${topNodesWithScriptJsify(node.nodes, context)}`); // 含代码块子节点
                    } else {
                        writer.write(`${topNodesWithoutScriptJsify(node.nodes, context)}`); // 无代码块子节点
                    }
                    writer.write("}");

                    // 视图的模板函数源码
                    script.vnodeTemplate = writer.toString();

                    //   console.info('------------gen js-------------')
                    //   console.info(writer.toString())

                    return false;
                });
            });
        })()
    );

    // 顶层点中含有代码块，通过数组在运行期取得标签对象
    function topNodesWithScriptJsify(nodes = [], context) {
        let ary = [],
            src;
        ary.push(` let ${AryNm} = []; `);
        for (let i = 0, node; (node = nodes[i++]); ) {
            if (node.type === "JsCode") {
                ary.push(node.object.value); // 代码块，直接添加
            } else if ((src = bus.at("astgen-node-tag", node, context))) {
                ary.push(` ${AryNm}.push( ${src} ); `); // 标签节点
            } else if ((src = bus.at("astgen-node-text", node, context))) {
                ary.push(` ${AryNm}.push( ${src} ); `); // 文本节点
            } else {
                throw new Err("unhandle node type"); // 应该没有这种情况
            }
        }
        ary.push(` ${AryNm}.length > 1 && console.warn("invlid tag count"); `);
        ary.push(` return ${AryNm}.length ? v_Array[0] : null; `);

        return ary.join("\n");
    }

    // 顶层点中没有代码块，返回标签对象
    function topNodesWithoutScriptJsify(nodes = [], context) {
        if (nodes.length > 1) {
            let text = context.input.text;
            let file = context.input.file;
            let start = nodes[1].object.loc.start.pos;
            nodes[0].type !== "Tag" && (start = nodes[0].object.loc.start.pos);
            throw new Err("invalid top tag", { text, file, start }); // 组件顶部只能有一个标签
        }

        let src,
            node = nodes[0];
        if (node.type !== "Tag") {
            let text = context.input.text;
            let file = context.input.file;
            let start = nodes[0].object.loc.start.pos;
            throw new Err("missing top tag", { text, file, start }); // 组件顶部只能有一个标签
        }

        src = bus.at("astgen-node-tag", node, context);
        if (src) return `return ${src}`; // 标签节点 {...}

        src = bus.at("astgen-node-text", node, context);
        if (src) return `return ${src}`; // 文本节点 {...}

        // 应该没有这种情况，万一有，多数是修改添加后漏对应
        throw new Err("unhandle node type");
    }

    function hasCodeBolck(nodes) {
        for (let i = 0, node; (node = nodes[i++]); ) {
            if (node.type === "JsCode") {
                return true;
            }
        }
        return false;
    }

    // ------- s25p-component-ast-jsify-root end
})();

/* ------- s35p-component-script-selector-rename ------- */
(() => {
    // ------- s35p-component-script-selector-rename start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const csjs = require("@gotoeasy/csjs");
    const File = require("@gotoeasy/file");
    const hash = require("@gotoeasy/hash");
    const acorn = require("acorn");
    const walk = require("acorn-walk");
    const astring = require("astring");
    const tokenizer = require("css-selector-tokenizer");

    bus.on(
        "编译插件",
        (function() {
            // ---------------------------------------------------------------
            // 转换后脚本actions、methods中，含有类选择器时，做相应的类名哈希处理
            //
            // getElementsByClassName('classname')
            // querySelector('div > .classname')
            // querySelectorAll('div > .classname')
            // $$('div > .classname')
            //
            // 【注】
            // 方法名一致、且第一参数为字面量时才转换
            // 若希望被转换但又没按此规则书写，将不被转换而导致不符预期
            // ---------------------------------------------------------------
            return postobject.plugin("s35p-component-script-selector-rename", function(root, context) {
                let style = context.style;
                let oCssSet = (style.csslibset = style.csslibset || new Set());
                let oCsslib = context.result.oCsslib;
                let oCsslibPkgs = context.result.oCsslibPkgs;
                let script = context.script;
                let reg = /(\.getElementsByClassName\s*\(|\.querySelector\s*\(|\.querySelectorAll\s*\(|\$\s*\(|addClass\(|removeClass\(|classList)/;

                let classnames = (script.classnames = script.classnames || []); // 脚本代码中用到的样式类
                if (script.actions && reg.test(script.actions)) {
                    script.actions = transformJsSelector(script.actions, context.input.file);
                }
                if (script.methods && reg.test(script.methods)) {
                    script.methods = transformJsSelector(script.methods, context.input.file);
                }

                // 脚本中用到的类，检查样式库是否存在，检查类名是否存在
                if (classnames.length) {
                    // 查库取样式，把样式库匿名改成真实库名
                    for (let i = 0, clspkg, clsname, asname, ary; (clspkg = classnames[i++]); ) {
                        ary = clspkg.split("@");
                        clsname = "." + ary[0]; // 类名
                        asname = ary.length > 1 ? ary[1] : "*"; // 库别名

                        if (asname) {
                            // 别名样式类，按需引用别名库
                            csslib = oCsslib[asname];
                            if (!csslib) {
                                // 指定别名的样式库不存在
                                throw new Error("csslib not found: " + asname + "\nfile: " + context.input.file); // TODO 友好定位提示
                            }

                            if (asname !== "*" && !csslib.has(clsname)) {
                                // 指定样式库中找不到指定的样式类，无名库的话可以是纯js控制用，非无名库就是要引用样式，不存在就得报错
                                throw new Error("css class not found: " + clspkg + "\nfile: " + context.input.file); // TODO 友好定位提示
                            }
                        }
                    }
                }

                function transformJsSelector(code, srcFile) {
                    let ast, changed;
                    try {
                        ast = acorn.parse(code, { ecmaVersion: 10, sourceType: "module", locations: false });
                    } catch (e) {
                        throw new Err("syntax error", e); // 通常是代码有语法错误
                    }

                    walk.simple(ast, {
                        CallExpression(node) {
                            // 为避免误修改，不对类似 el.className = 'foo'; 的赋值语句进行转换

                            // 第一参数不是字符串时，无可修改，忽略
                            if (!node.arguments || node.arguments[0].type !== "Literal") {
                                return;
                            }

                            let fnName, classname;
                            if (node.callee.type === "Identifier") {
                                // 直接函数调用
                                fnName = node.callee.name;
                                if (fnName === "$$" || fnName === "$") {
                                    node.arguments[0].value = transformSelector(node.arguments[0].value, srcFile); // $$('div > .foo'), $('div > .bar')
                                } else {
                                    return;
                                }
                            } else if (node.callee.type === "MemberExpression") {
                                // 对象成员函数调用
                                fnName = node.callee.property.name;
                                if (fnName === "getElementsByClassName") {
                                    // document.getElementsByClassName('foo')
                                    classname = getClassPkg(node.arguments[0].value);
                                    node.arguments[0].value = bus.at("哈希样式类名", srcFile, classname);
                                    classnames.push(classname); // 脚本中用到的类，存起来查样式库使用
                                } else if (fnName === "querySelector" || fnName === "querySelectorAll") {
                                    // document.querySelector('div > .foo'), document.querySelectorAll('div > .bar')
                                    node.arguments[0].value = transformSelector(node.arguments[0].value, srcFile);
                                } else if (fnName === "addClass" || fnName === "removeClass") {
                                    // $$el.addClass('foo bar'), $$el.removeClass('foo bar')
                                    let rs = [],
                                        classname,
                                        ary = node.arguments[0].value.trim().split(/\s+/);
                                    ary.forEach(cls => {
                                        classname = getClassPkg(cls);
                                        rs.push(bus.at("哈希样式类名", srcFile, classname));
                                        classnames.push(classname); // 脚本中用到的类，存起来查样式库使用
                                    });
                                    node.arguments[0].value = rs.join(" ");
                                } else if (fnName === "add" || fnName === "remove") {
                                    // el.classList.add('foo'), el.classList.remove('bar')
                                    if (node.callee.object.type === "MemberExpression" && node.callee.object.property.name === "classList") {
                                        classname = getClassPkg(node.arguments[0].value);
                                        node.arguments[0].value = bus.at("哈希样式类名", srcFile, classname);
                                        classnames.push(classname); // 脚本中用到的类，存起来查样式库使用
                                    } else {
                                        return;
                                    }
                                } else {
                                    return;
                                }
                            } else {
                                return;
                            }

                            node.arguments[0].raw = `'${node.arguments[0].value}'`; // 输出字符串
                            changed = true;
                        }
                    });

                    return changed ? astring.generate(ast) : code;
                }

                function transformSelector(selector, srcFile) {
                    selector = selector.replace(/@/g, "鬱");
                    let ast = tokenizer.parse(selector);
                    let classname,
                        nodes = ast.nodes || [];
                    nodes.forEach(node => {
                        if (node.type === "selector") {
                            (node.nodes || []).forEach(nd => {
                                if (nd.type === "class") {
                                    classname = getClassPkg(nd.name);
                                    nd.name = bus.at("哈希样式类名", srcFile, classname);
                                    classnames.push(classname); // 脚本中用到的类，存起来查样式库使用
                                }
                            });
                        }
                    });

                    let rs = tokenizer.stringify(ast);
                    return rs.replace(/鬱/g, "@");
                }

                // 检查样式库是否存在
                function getClassPkg(cls) {
                    let ary = cls.trim().split(/鬱|@/);
                    if (ary.length > 1) {
                        let asname = ary[1];
                        if (!oCsslibPkgs[asname]) {
                            // js代码中类选择器指定的csslib未定义导致找不到
                            throw new Error("csslib not found: " + ary[0] + "@" + ary[1] + "\nfile: " + context.input.file); // TODO 友好定位提示
                        }
                        return ary[0] + "@" + asname; // 哈希还是使用'@'
                    }

                    return ary[0];
                }
            });
        })()
    );

    // ------- s35p-component-script-selector-rename end
})();

/* ------- s45p-component-gen-js ------- */
(() => {
    // ------- s45p-component-gen-js start
    const bus = require("@gotoeasy/bus");
    const csjs = require("@gotoeasy/csjs");
    const File = require("@gotoeasy/file");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    const acornGlobals = require("acorn-globals");

    const JS_VARS = "$$,require,window,location,clearInterval,setInterval,assignOptions,rpose,$SLOT,Object,Map,Set,WeakMap,WeakSet,Date,Math,Array,String,Number,JSON,Error,Function,arguments,Boolean,Promise,Proxy,Reflect,RegExp,alert,console,window,document".split(
        ","
    );

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("s45p-component-gen-js", function(root, context) {
                let env = bus.at("编译环境");
                let result = context.result;
                let script = context.script;
                let writer = context.writer;

                // 模板函数
                let fnTmpl = bus.at("编译模板JS");

                // 模板数据
                let $data = {};
                $data.COMPONENT_NAME = bus.at("组件类名", context.input.file);
                $data.options = context.doc.options || "{}";
                $data.state = context.doc.state || "{}";
                if (context.doc.api) {
                    $data.optionkeys = context.doc.api.optionkeys;
                    $data.statekeys = context.doc.api.statekeys;
                }
                $data.actions = script.actions;
                $data.methods = script.methods;
                $data.updater = script.updater;
                $data.vnodeTemplate = script.vnodeTemplate;

                // 生成组件JS源码
                result.componentJs = fnTmpl($data);
                result.componentJs = checkAndInitVars(result.componentJs, context);

                // 非release模式时输出源码便于确认
                if (!env.release) {
                    let fileJs = env.path.build_temp + "/" + bus.at("组件目标文件名", context.input.file) + ".js";
                    File.write(fileJs, csjs.formatJs(result.componentJs));
                }
            });
        })()
    );

    // 检查是否有变量缩写，有则补足，用以支持{$state.abcd}简写为{abcd}
    function checkAndInitVars(src, context) {
        let optionkeys = context.doc.api.optionkeys || [];
        let statekeys = context.doc.api.statekeys || [];
        let scopes;
        try {
            scopes = acornGlobals(src);
            if (!scopes.length) return src; // 正常，直接返回
        } catch (e) {
            throw Err.cat("source syntax error", "\n-----------------", src, "\n-----------------", "file=" + context.input.file, e); // 多数表达式中有语法错误导致
        }

        // 函数内部添加变量声明赋值后返回
        let vars = [];
        for (let i = 0, v; i < scopes.length; i++) {
            v = scopes[i];

            let inc$opts = optionkeys.includes(v.name);
            let inc$state = statekeys.includes(v.name);
            let incJsVars = JS_VARS.includes(v.name);

            // TODO 优化提示定位
            if (!inc$opts && !inc$state && !incJsVars) {
                let msg = "template variable undefined: " + v.name;
                msg += "\n  file: " + context.input.file;
                throw new Err(msg); // 变量不在$state或$options的属性范围内
            }
            if (inc$opts && inc$state) {
                let msg = "template variable uncertainty: " + v.name;
                msg += "\n  file: " + context.input.file;
                throw new Err(msg); // 变量同时存在于$state和$options，无法自动识别来源，需指定
            }

            if (inc$state) {
                vars.push(`let ${v.name} = $state.${v.name};`);
            } else if (inc$opts) {
                vars.push(`let ${v.name} = $options.${v.name};`);
            }
        }

        return src.replace(/(\n.+?prototype\.nodeTemplate\s*=\s*function\s+.+?\r?\n)/, "$1" + vars.join("\n"));
    }

    // ------- s45p-component-gen-js end
})();

/* ------- s50m-component-css-classname-rename ------- */
(() => {
    // ------- s50m-component-css-classname-rename start
    const Err = require("@gotoeasy/err");
    const bus = require("@gotoeasy/bus");
    const hash = require("@gotoeasy/hash");
    const postcss = require("postcss");
    const tokenizer = require("css-selector-tokenizer");

    bus.on(
        "组件样式类名哈希化",
        (function() {
            return function(srcFile, css) {
                let fnPostcssPlugin = (root, result) => {
                    root.walkRules(rule => {
                        let ast = tokenizer.parse(rule.selector);
                        let nodes = ast.nodes || [];
                        nodes.forEach(node => {
                            if (node.type === "selector") {
                                (node.nodes || []).forEach(nd => {
                                    if (nd.type === "class") {
                                        nd.name = bus.at("哈希样式类名", srcFile, nd.name);
                                    }
                                });
                            }
                        });

                        rule.selector = tokenizer.stringify(ast);
                    });
                };

                let rs = postcss([fnPostcssPlugin])
                    .process(css, { from: "from.css" })
                    .sync()
                    .root.toResult();

                return rs.css;
            };
        })()
    );

    // ------- s50m-component-css-classname-rename end
})();

/* ------- s55p-component-query-css-[csslib] ------- */
(() => {
    // ------- s55p-component-query-css-[csslib] start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 组件单位按需查询引用样式库
            return postobject.plugin("s55p-component-query-css-[csslib]", function(root, context) {
                let style = context.style;
                let oCssSet = (style.csslibset = style.csslibset || new Set()); // 组件单位样式库引用的样式
                let oCsslib = context.result.oCsslib; // 项目[csslib]+组件[csslib]
                let scriptclassnames = context.script.classnames;
                let hashClassName = bus.on("哈希样式类名")[0];
                let rename = (pkg, cls) => hashClassName(context.input.file, pkg ? cls + "@" + pkg : cls); // 自定义改名函数
                let strict = true; // 样式库严格匹配模式
                let universal = false; // 不查取通用样式
                let opts = { rename, strict, universal };

                let ary,
                    clsname,
                    oQuerys = {};
                root.walk("Class", (node, object) => {
                    // 按样式库单位汇总组件内全部样式类
                    for (let i = 0, clspkg, clsname, asname; (clspkg = object.classes[i++]); ) {
                        ary = clspkg.split("@");
                        clsname = "." + ary[0]; // 类名
                        asname = ary.length > 1 ? ary[1] : "*"; // 库别名
                        (oQuerys[asname] = oQuerys[asname] || []).push(clsname); // 按库名单位汇总样式类，后续组件单位将一次性取出

                        // '*'以外的样式库，检查指定样式库在（项目[csslib]+组件[csslib]）中是否存在
                        if (asname !== "*" && !oCsslib[asname]) {
                            throw new Err("csslib not found: " + asname, {
                                file: context.input.file,
                                text: context.input.text,
                                start: object.loc.start.pos,
                                end: object.loc.end.pos
                            });
                        }
                    }
                });

                for (let i = 0, clspkg, clsname, asname; (clspkg = scriptclassnames[i++]); ) {
                    ary = clspkg.split("@");
                    clsname = "." + ary[0]; // 类名
                    asname = ary.length > 1 ? ary[1] : "*"; // 库别名
                    (oQuerys[asname] = oQuerys[asname] || []).push(clsname); // 按库名单位汇总样式类，后续组件单位将一次性取出

                    // '*'以外的样式库，检查指定样式库在（项目[csslib]+组件[csslib]）中是否存在
                    if (asname !== "*" && !oCsslib[asname]) {
                        throw new Err("csslib not found: " + asname, {
                            file: context.input.file,
                            text: context.input.text,
                            start: object.loc.start.pos,
                            end: object.loc.end.pos
                        });
                    }
                }

                let csslib,
                    tags = context.result.standardtags; // 用本组件的全部标准标签，解析完后才能用本插件
                for (let asname in oQuerys) {
                    csslib = oCsslib[asname];
                    csslib && oCssSet.add(csslib.get(...tags, ...new Set(oQuerys[asname]), opts)); // 用本组件的全部标准标签+同一样式库的类名，查取样式库
                }
            });
        })()
    );

    // ------- s55p-component-query-css-[csslib] end
})();

/* ------- s65p-component-gen-css ------- */
(() => {
    // ------- s65p-component-gen-css start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const File = require("@gotoeasy/file");
    const csjs = require("@gotoeasy/csjs");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("s65p-component-gen-css", function(root, context) {
                let style = context.style;
                let ary = [];
                style.csslibset && ary.push(...style.csslibset);
                style.less && ary.push(style.less);
                style.scss && ary.push(style.scss);
                style.css && ary.push(style.css);

                context.result.css = bus.at("组件样式类名哈希化", context.input.file, ary.join("\n"));

                let env = bus.at("编译环境");
                let file = env.path.build_temp + "/" + bus.at("组件目标文件名", context.input.file) + ".css";
                if (!env.release) {
                    if (context.result.css) {
                        File.write(file, context.result.css);
                    } else {
                        File.remove(file);
                    }
                }
            });
        })()
    );

    // ------- s65p-component-gen-css end
})();

/* ------- w15p-component-complie-result-cache ------- */
(() => {
    // ------- w15p-component-complie-result-cache start
    const bus = require("@gotoeasy/bus");
    const csjs = require("@gotoeasy/csjs");
    const File = require("@gotoeasy/file");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("w15p-component-complie-result-cache", function(root, context) {
                bus.at("组件编译缓存", context.input.file, context);
            });
        })()
    );

    // ------- w15p-component-complie-result-cache end
})();

/* ------- y15p-page-all-reference-components ------- */
(() => {
    // ------- y15p-page-all-reference-components start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            // allreferences排序存放页面使用的全部组件的标签全名，便于生成页面js
            return postobject.plugin("y15p-page-all-reference-components", function(root, context) {
                if (!context.result.isPage) return false; // 仅针对页面

                let oSetAllRef = new Set();
                let oStatus = {};
                let references = context.result.references;
                references.forEach(tagpkg => {
                    addRefComponent(tagpkg, oSetAllRef, oStatus);
                });

                // 自身循环引用检查
                if (oSetAllRef.has(context.result.tagpkg)) {
                    throw new Err("circular reference: " + context.result.tagpkg);
                }

                // 排序便于生成统一代码顺序
                let allreferences = [...oSetAllRef];
                allreferences.sort();
                // 本页面固定放最后
                allreferences.push(context.result.tagpkg);

                context.result.allreferences = allreferences;
            });
        })()
    );

    // tagpkg: 待添加依赖组件
    function addRefComponent(tagpkg, oSetAllRequires, oStatus) {
        if (oStatus[tagpkg]) {
            return;
        }

        oSetAllRequires.add(tagpkg);
        oStatus[tagpkg] = true;

        let srcFile = bus.at("标签源文件", tagpkg);
        //    if ( !srcFile ) {
        //        throw new Error('file not found of tag: ' + tagpkg);
        //    }
        let context = bus.at("组件编译缓存", srcFile);
        if (!context) {
            context = bus.at("编译组件", srcFile);
        }
        let references = context.result.references;
        references.forEach(subTagpkg => {
            addRefComponent(subTagpkg, oSetAllRequires, oStatus);
        });
    }

    // ------- y15p-page-all-reference-components end
})();

/* ------- y17p-page-all-reference-standard-tags ------- */
(() => {
    // ------- y17p-page-all-reference-standard-tags start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            // allreferences排序存放页面使用的全部组件的标签全名，便于生成页面js
            return postobject.plugin("y17p-page-all-reference-standard-tags", function(root, context) {
                if (!context.result.isPage) return false; // 仅针对页面

                // 页面标签，固定添加html、body，便于样式库查询使用
                let oSetAllTag = new Set();
                oSetAllTag.add("html");
                oSetAllTag.add("body");

                context.result.standardtags.forEach(tag => oSetAllTag.add(tag));

                let references = context.result.references;
                references.forEach(tagpkg => {
                    let srcFile = bus.at("标签源文件", tagpkg);
                    let ctx = bus.at("组件编译缓存", srcFile);
                    !ctx && (ctx = bus.at("编译组件", srcFile));
                    let standardtags = ctx.result.standardtags;
                    standardtags.forEach(tag => oSetAllTag.add(tag));
                });

                // 排序便于生成统一代码顺序
                let allstandardtags = [...oSetAllTag];
                allstandardtags.sort();

                context.result.allstandardtags = allstandardtags;
            });
        })()
    );

    // ------- y17p-page-all-reference-standard-tags end
})();

/* ------- y20m-page-gen-css-end-process ------- */
(() => {
    // ------- y20m-page-gen-css-end-process start
    const bus = require("@gotoeasy/bus");
    const csjs = require("@gotoeasy/csjs");
    const hash = require("@gotoeasy/hash");
    const Err = require("@gotoeasy/err");
    const postcss = require("postcss");
    const csso = require("csso");

    bus.on(
        "页面样式后处理",
        (function() {
            // -------------------------------------------------------------
            // 页面样式编译，同步处理，仅支持同步插件
            //
            // 加前缀、复制url资源、压缩/格式化
            // -------------------------------------------------------------
            return (css, context) => {
                if (!css) return "";

                let env = bus.at("编译环境");
                let oCache = bus.at("缓存");
                let from = oCache.path + "/resources/from.css"; // 页面由组件拼装，组件都在%缓存目录%/resources
                let to = bus.at("页面目标CSS文件名", context.input.file);
                let desktopFirst = !!context.doc.api.desktopfirst; // 移动优先时，min-width => max-width => min-device-width => max-device-width => other；桌面优先时，max-width => max-device-width => min-width => min-device-width => other

                let pageCss;
                let plugins = [];
                // 修改url相对目录
                let url = "copy";
                let basePath = bus.at("缓存资源目录数组"); // 缓存资源目录中找，包括编译缓存的资源目录，和样式库缓存的资源目录
                let useHash = false; // 编译的组件样式已统一哈希文件名
                let assetsPath = bus.at("页面图片相对路径", context.input.file);
                let postcssUrlOpt = { url, basePath, assetsPath, useHash };

                let cacheKey = JSON.stringify(["页面样式后处理", bus.at("browserslist"), env.release, desktopFirst, assetsPath, css]);
                if (!env.nocache) {
                    let cacheValue = oCache.get(cacheKey);
                    if (cacheValue) {
                        if (cacheValue.indexOf("url(") > 0) {
                            plugins.push(require("postcss-url")(postcssUrlOpt)); // 复制图片资源（文件可能被clean掉，保险起见执行资源复制）
                            postcss(plugins)
                                .process(css, { from, to })
                                .sync()
                                .root.toResult(); // 仍旧用组件样式
                        }
                        return cacheValue;
                    }
                }

                try {
                    css = csso.minify(css, { forceMediaMerge: true, comments: false }).css; // 压缩样式，合并@media
                } catch (e) {
                    // 样式有误导致处理失败
                    throw new Err("css end process failed", "file: " + context.input.file, e);
                }

                plugins.push(require("autoprefixer")()); // 添加前缀
                plugins.push(require("postcss-url")(postcssUrlOpt)); // 修改url相对目录
                plugins.push(require("postcss-sort-media")({ desktopFirst })); // 把@media统一放后面，按指定的排序方式（移动优先还是桌面优先）对@media进行排序

                let rs = postcss(plugins)
                    .process(css, { from, to })
                    .sync()
                    .root.toResult();

                pageCss = env.release ? rs.css : csjs.formatCss(rs.css); // 非release时格式化
                return oCache.set(cacheKey, pageCss);
            };
        })()
    );

    // ------- y20m-page-gen-css-end-process end
})();

/* ------- y25p-page-gen-css-link-components ------- */
(() => {
    // ------- y25p-page-gen-css-link-components start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const hash = require("@gotoeasy/hash");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("y25p-page-gen-css-link-components", function(root, context) {
                if (!context.result.isPage) return false; // 仅针对页面

                let env = bus.at("编译环境");
                let hashClassName = bus.on("哈希样式类名")[0];
                let rename = (pkg, cls) => hashClassName(context.input.file, pkg ? cls + "@" + pkg : cls); // 自定义改名函数
                let strict = true; // 样式库严格匹配模式
                let universal = true; // 查取通用样式（页面的缘故）
                let opts = { rename, strict, universal };

                // 在全部样式库中，用使用到的标准标签查询样式，汇总放前面
                let aryTagCss = [];
                let oCsslib = context.result.oCsslib; // 项目[csslib]+组件[csslib]
                let oCache = bus.at("缓存");
                for (let k in oCsslib) {
                    let cacheKey = hash(
                        JSON.stringify([
                            "按需取标签样式",
                            oCsslib[k].pkg,
                            oCsslib[k].version,
                            strict,
                            universal,
                            oCsslib[k]._imported,
                            context.result.allstandardtags
                        ])
                    );
                    if (!env.nocache) {
                        let cacheValue = oCache.get(cacheKey);
                        if (cacheValue) {
                            aryTagCss.push(cacheValue);
                        } else {
                            let tagcss = oCsslib[k].get(...context.result.allstandardtags, opts);
                            aryTagCss.push(tagcss);
                            oCache.set(cacheKey, tagcss);
                        }
                    } else {
                        let tagcss = oCsslib[k].get(...context.result.allstandardtags, opts);
                        aryTagCss.push(tagcss);
                        oCache.set(cacheKey, tagcss);
                    }
                }

                // 汇总所有使用到的组件的样式
                let ary = [];
                let allreferences = context.result.allreferences; // 已含页面自身组件
                allreferences.forEach(tagpkg => {
                    let ctx = bus.at("组件编译缓存", bus.at("标签源文件", tagpkg));
                    if (!ctx) {
                        ctx = bus.at("编译组件", tagpkg);
                    }
                    ctx.result.atcsslibtagcss && aryTagCss.push(...ctx.result.atcsslibtagcss); // @csslib的标签样式
                    ctx.result.css && ary.push(ctx.result.css);
                });

                // 汇总后的页面样式做后处理
                context.result.css = [...aryTagCss, ...ary].join("\n");
                context.result.pageCss = bus.at("页面样式后处理", context.result.css, context); // TODO @media样式合并存在不足
            });
        })()
    );

    // ------- y25p-page-gen-css-link-components end
})();

/* ------- y35p-page-gen-html ------- */
(() => {
    // ------- y35p-page-gen-html start
    const bus = require("@gotoeasy/bus");
    const csjs = require("@gotoeasy/csjs");
    const File = require("@gotoeasy/file");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("y35p-page-gen-html", function(root, context) {
                if (!context.result.isPage) return false; // 仅针对页面
                let env = bus.at("编译环境");

                let srcPath = env.path.src;
                let file = context.input.file;
                let name = File.name(file);
                let type = context.doc.api.prerender;
                let nocss = !context.result.pageCss;

                context.result.html = require(env.prerender)({ srcPath, file, name, type, nocss });
            });
        })()
    );

    // ------- y35p-page-gen-html end
})();

/* ------- y45m-page-gen-js-rpose-runtime ------- */
(() => {
    // ------- y45m-page-gen-js-rpose-runtime start
    const bus = require("@gotoeasy/bus");
    const File = require("@gotoeasy/file");
    const resolvepkg = require("resolve-pkg");

    bus.on(
        "RPOSE运行时代码",
        (function(src) {
            return function() {
                if (!src) {
                    let file = File.resolve(resolvepkg("@rpose/runtime", { cwd: __dirname }), "runtime.js");
                    src = File.read(file);
                }
                return src;
            };
        })()
    );

    // ------- y45m-page-gen-js-rpose-runtime end
})();

/* ------- y55p-page-gen-js-link-runtime-components ------- */
(() => {
    // ------- y55p-page-gen-js-link-runtime-components start
    const bus = require("@gotoeasy/bus");
    const File = require("@gotoeasy/file");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    const fs = require("fs");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("y55p-page-gen-js-link-runtime-components", function(root, context) {
                if (!context.result.isPage) return false; // 仅针对页面

                let env = bus.at("编译环境");
                let allreferences = context.result.allreferences;

                let srcRuntime = bus.at("RPOSE运行时代码");
                let srcStmt = getSrcRegisterComponents(allreferences);
                let srcComponents = getSrcComponents(allreferences);

                if (context.result.allstandardtags.includes("img")) {
                    let oCache = bus.at("缓存");
                    // 替换图片相对路径，图片不存在则复制
                    let resourcePath = oCache.path + "/resources";
                    let imgPath = bus.at("页面图片相对路径", context.input.file);
                    srcComponents = srcComponents.replace(/\%imagepath\%([0-9a-zA-Z]+\.[0-9a-zA-Z]+)/g, function(match, filename) {
                        let from = resourcePath + "/" + filename;
                        let to = env.path.build_dist + "/" + (env.path.build_dist_images ? env.path.build_dist_images + "/" : "") + filename;
                        File.existsFile(from) && !File.existsFile(to) && File.mkdir(to) > fs.copyFileSync(from, to);
                        return imgPath + filename;
                    });
                }

                let tagpkg = context.result.tagpkg;

                let src = `
                ${srcRuntime}

                (function($$){
                    // 组件注册
                    ${srcStmt}

                    ${srcComponents}

                    // 组件挂载
                    rpose.mount( rpose.newComponentProxy('${tagpkg}').render(), '${context.doc.mount}' );
                })(rpose.$$);
            `;

                context.result.pageJs = src;
            });
        })()
    );

    // 组件注册语句
    function getSrcRegisterComponents(allreferences) {
        try {
            let obj = {};
            for (let i = 0, tagpkg, key, file; (tagpkg = allreferences[i++]); ) {
                key = "'" + tagpkg + "'";

                file = bus.at("标签源文件", tagpkg);
                if (!File.exists(file)) {
                    throw new Err("component not found (tag = " + tagpkg + ")");
                }

                obj[key] = bus.at("组件类名", file);
            }

            return `rpose.registerComponents(${JSON.stringify(obj).replace(/"/g, "")});`;
        } catch (e) {
            throw Err.cat(MODULE + "gen register stmt failed", allreferences, e);
        }
    }

    // 本页面关联的全部组件源码
    function getSrcComponents(allreferences) {
        try {
            let ary = [];
            for (let i = 0, tagpkg, context; (tagpkg = allreferences[i++]); ) {
                context = bus.at("组件编译缓存", bus.at("标签源文件", tagpkg));
                if (!context) {
                    context = bus.at("编译组件", tagpkg);
                }
                ary.push(context.result.componentJs);
            }
            return ary.join("\n");
        } catch (e) {
            throw Err.cat(MODULE + "get component src failed", allreferences, e);
        }
    }

    // ------- y55p-page-gen-js-link-runtime-components end
})();

/* ------- y65p-page-gen-js-babel ------- */
(() => {
    // ------- y65p-page-gen-js-babel start
    const bus = require("@gotoeasy/bus");
    const csjs = require("@gotoeasy/csjs");
    const File = require("@gotoeasy/file");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("y65p-page-gen-js-babel", function(root, context) {
                if (!context.result.isPage) return false; // 仅针对页面
                let env = bus.at("编译环境");
                let oCache = bus.at("缓存");
                let cacheKey = JSON.stringify(["page-gen-js-babel", bus.at("browserslist"), context.result.pageJs]);
                if (!env.nocache) {
                    let cacheValue = oCache.get(cacheKey);
                    if (cacheValue) return (context.result.babelJs = cacheValue);
                }

                try {
                    context.result.babelJs = csjs.babel(context.result.pageJs);
                    oCache.set(cacheKey, context.result.babelJs);
                } catch (e) {
                    File.write(env.path.build + "/error/babel.log", context.result.pageJs + "\n\n" + e.stack);
                    throw e;
                }
            });
        })()
    );

    // ------- y65p-page-gen-js-babel end
})();

/* ------- y75p-page-gen-js-browserify-minformat ------- */
(() => {
    // ------- y75p-page-gen-js-browserify-minformat start
    const bus = require("@gotoeasy/bus");
    const csjs = require("@gotoeasy/csjs");
    const File = require("@gotoeasy/file");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("y75p-page-gen-js-browserify-minformat", function(root, context) {
                if (!context.result.isPage) return false; // 仅针对页面
                let env = bus.at("编译环境");
                let oCache = bus.at("缓存");
                let cacheKey = JSON.stringify(["page-gen-js-browserify-minformat", bus.at("browserslist"), env.release, context.result.babelJs]);
                if (!env.nocache) {
                    let cacheValue = oCache.get(cacheKey);
                    if (cacheValue) return (context.result.browserifyJs = Promise.resolve(cacheValue));
                }

                context.result.browserifyJs = new Promise((resolve, reject) => {
                    let stime = new Date().getTime();
                    csjs.browserify(context.result.babelJs, null)
                        .then(js => {
                            js = env.release ? csjs.miniJs(js) : csjs.formatJs(js);
                            oCache.set(cacheKey, js);
                            resolve(js);
                        })
                        .catch(e => {
                            File.write(env.path.build + "/error/browserify.log", context.result.babelJs + "\n\n" + e.stack);
                            bus.at("组件编译缓存", context.input.file, false); // 删除当前文件的编译缓存
                            reject(e);
                        });
                });
            });
        })()
    );

    // ------- y75p-page-gen-js-browserify-minformat end
})();

/* ------- y85p-write-page ------- */
(() => {
    // ------- y85p-write-page start
    const bus = require("@gotoeasy/bus");
    const csjs = require("@gotoeasy/csjs");
    const hash = require("@gotoeasy/hash");
    const File = require("@gotoeasy/file");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    const fs = require("fs");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("y85p-write-page", function(root, context) {
                if (!context.result.isPage) return false; // 仅针对页面
                let env = bus.at("编译环境");
                let browserslist = bus.at("browserslist");

                let stime = new Date().getTime(),
                    time;
                context.result.browserifyJs
                    .then(browserifyJs => {
                        let fileHtml = bus.at("页面目标HTML文件名", context.input.file);
                        let fileCss = bus.at("页面目标CSS文件名", context.input.file);
                        let fileJs = bus.at("页面目标JS文件名", context.input.file);

                        let html = context.result.html;
                        let css = context.result.pageCss;
                        let js = browserifyJs;
                        context.result.js = js;

                        css ? File.write(fileCss, css) : File.remove(fileCss);
                        File.write(fileJs, js);
                        File.write(fileHtml, html);

                        env.watch && (context.result.hashcode = hash(html + css + js)); // 计算页面编译结果的哈希码，供浏览器同步判断使用

                        time = new Date().getTime() - stime;
                        console.info("[pack]", time + "ms -", fileHtml.substring(env.path.build_dist.length + 1));
                    })
                    .catch(e => {
                        console.error("[pack]", e);
                    });
            });
        })()
    );

    // ------- y85p-write-page end
})();

/* ------- z10m-browserslist ------- */
(() => {
    // ------- z10m-browserslist start
    const bus = require("@gotoeasy/bus");
    const File = require("@gotoeasy/file");
    const hash = require("@gotoeasy/hash");
    const browserslist = require("browserslist");

    bus.on(
        "browserslist",
        (function(rs) {
            return function(nocache) {
                if (nocache || !rs) {
                    let file = bus.at("编译环境").path.root + "/.browserslistrc";
                    if (File.existsFile(file)) {
                        let ary = [],
                            lines = File.read(file).split(/\r?\n/);
                        lines.forEach(line => {
                            line = line.trim();
                            line && !line.startsWith("#") && ary.push(line);
                        });
                        rs = hash(browserslist(ary).join("\n"));
                    } else {
                        rs = hash(browserslist().join("\n"));
                    }
                }

                return rs;
            };
        })()
    );

    // ------- z10m-browserslist end
})();

/* ------- z20m-rename-css-classname ------- */
(() => {
    // ------- z20m-rename-css-classname start
    const bus = require("@gotoeasy/bus");
    const hash = require("@gotoeasy/hash");

    bus.on(
        "哈希样式类名",
        (function() {
            // -------------------------------------------------------
            // release模式
            // foo          => _xxxxx
            // foo@pkg      => _xxxxx
            // _xxxxx       => _xxxxx（视为已改名不再修改）
            //
            // 非release模式
            // foo          => foo___xxxxx
            // foo@pkg      => pkg---foo
            // pkg---foo    => pkg---foo（视为已改名不再修改）
            // foo___xxxxx  => foo___xxxxx（视为已改名不再修改）
            // -------------------------------------------------------
            return function renameCssClassName(srcFile, clsName) {
                let name = clsName;

                // 特殊名称不哈希（已哈希的也是下划线开头）
                if (name.startsWith("_")) {
                    return name;
                }

                const env = bus.at("编译环境");
                if (clsName.indexOf("@") > 0) {
                    let ary = clsName.split("@");
                    name = `${ary[1]}---${ary[0]}`; // 引用样式库时，使用命名空间前缀，如 pkgname---the-class
                } else {
                    if (name.indexOf("---") > 0 || name.indexOf("___") > 0) {
                        // 已经改过名
                    } else {
                        let tag = bus.at("标签全名", srcFile);
                        name = `${clsName}___${hash(tag)}`; // 当前项目组件时，标签全名哈希作为后缀，如 my-class___xxxxx
                    }
                }

                name = name.replace(/[^a-zA-z0-9\-_]/g, "-"); // 包名中【字母数字横杠下划线】以外的字符都替换为横杠，便于在非release模式下查看
                if (!env.release) return name; // 非release模式时不哈希
                return "_" + hash(name); // 名称已有命名空间前缀，转换为小写后哈希便于复用
            };
        })()
    );

    // ------- z20m-rename-css-classname end
})();

/* ------- z30m-util ------- */
(() => {
    // ------- z30m-util start
    const File = require("@gotoeasy/file");
    const bus = require("@gotoeasy/bus");
    const npm = require("@gotoeasy/npm");
    const hash = require("@gotoeasy/hash");
    const findNodeModules = require("find-node-modules");

    bus.on(
        "标签全名",
        (function() {
            return file => {
                let idx = file.indexOf(":");
                if (idx > 0 && file.substring(idx).indexOf(".") < 0) {
                    return file; // 已经是全名标签
                }

                let tagpkg = "";
                idx = file.lastIndexOf("/node_modules/");
                if (idx > 0) {
                    let ary = file.substring(idx + 14).split("/"); // xxx/node_modules/@aaa/bbb/xxxxxx => [@aaa, bbb, xxxxxx]
                    if (ary[0].startsWith("@")) {
                        tagpkg = ary[0] + "/" + ary[1] + ":" + File.name(file); // xxx/node_modules/@aaa/bbb/xxxxxx/abc.rpose => @aaa/bbb:abc
                    } else {
                        tagpkg = ary[0] + ":" + File.name(file); // xxx/node_modules/aaa/xxxxxx/abc.rpose => aaa:abc
                    }
                } else {
                    tagpkg = File.name(file); // aaa/bbb/xxxxxx/abc.rpose => abc      ui-btn => ui-btn
                }

                return tagpkg;
            };
        })()
    );

    bus.on(
        "标签源文件",
        (function() {
            // 【tag】
            //   -- 源文件
            //   -- nnn=@aaa/bbb:ui-xxx
            //   -- @aaa/bbb:ui-xxx
            //   -- bbb:ui-xxx
            //   -- ui-xxx
            return tag => {
                if (tag.endsWith(".rpose")) {
                    return tag; // 已经是文件
                }

                if (tag.indexOf(":") > 0) {
                    // @taglib指定的标签
                    let ary = tag.split(":");
                    ary[0].indexOf("=") > 0 && (ary = ary[0].split("="));
                    let oPkg = bus.at("模块组件信息", ary[0].trim()); // nnn=@aaa/bbb:ui-xxx => @aaa/bbb
                    let files = oPkg.files;
                    let name = "/" + ary[1] + ".rpose";
                    for (let i = 0, srcfile; (srcfile = files[i++]); ) {
                        if (srcfile.endsWith(name)) {
                            return srcfile;
                        }
                    }

                    return bus.at("标签库引用", tag, oPkg.config);
                } else {
                    let file = bus.at("标签项目源文件", tag); // 优先找文件名一致的源文件
                    if (file) return file;

                    let env = bus.at("编译环境");
                    return bus.at("标签库引用", tag, env.path.root); // 其次按标签库规则查找
                }

                // 找不到则undefined
            };
        })()
    );

    // 当前项目文件时，返回'/'
    bus.on(
        "文件所在模块",
        (function() {
            return file => {
                let pkg = "/",
                    idx = file.lastIndexOf("/node_modules/");
                if (idx > 0) {
                    let rs = [];
                    let ary = file.substring(idx + 14).split("/");
                    if (ary[0].startsWith("@")) {
                        pkg = ary[0] + "/" + ary[1]; // xxx/node_modules/@aaa/bbb/xxxxxx => @aaa/bbb
                    } else {
                        pkg = ary[0]; // xxx/node_modules/aaa/bbb/xxxxxx => aaa
                    }
                }

                return pkg;
            };
        })()
    );

    bus.on(
        "文件所在项目根目录",
        (function() {
            return file => {
                let dir,
                    idx = file.lastIndexOf("/node_modules/");
                if (idx > 0) {
                    let rs = [];
                    rs.push(file.substring(0, idx + 13)); // xxx/node_modules/@aaa/bbb/xxxxxx => xxx/node_modules
                    let ary = file.substring(idx + 14).split("/");
                    if (ary[0].startsWith("@")) {
                        rs.push(ary[0]); // xxx/node_modules/@aaa/bbb/xxxxxx => @aaa
                        rs.push(ary[1]); // xxx/node_modules/@aaa/bbb/xxxxxx => bbb
                    } else {
                        rs.push(ary[0]); // xxx/node_modules/aaa/bbb/xxxxxx => aaa
                    }

                    dir = rs.join("/"); // xxx/node_modules/@aaa/bbb/xxxxxx => xxx/node_modules/@aaa/bbb
                } else {
                    let env = bus.at("编译环境");
                    dir = env.path.root;
                }

                return dir;
            };
        })()
    );

    bus.on(
        "文件所在项目配置文件",
        (function() {
            return file => {
                let btfFile,
                    idx = file.lastIndexOf("/node_modules/");
                if (idx > 0) {
                    let rs = [];
                    rs.push(file.substring(0, idx + 13)); // xxx/node_modules/@aaa/bbb/xxxxxx => xxx/node_modules
                    let ary = file.substring(idx + 14).split("/");
                    if (ary[0].startsWith("@")) {
                        rs.push(ary[0]); // xxx/node_modules/@aaa/bbb/xxxxxx => @aaa
                        rs.push(ary[1]); // xxx/node_modules/@aaa/bbb/xxxxxx => bbb
                    } else {
                        rs.push(ary[0]); // xxx/node_modules/aaa/bbb/xxxxxx => aaa
                    }
                    rs.push("rpose.config.btf");

                    btfFile = rs.join("/"); // xxx/node_modules/@aaa/bbb/xxxxxx => xxx/node_modules/@aaa/bbb/rpose.config.btf
                } else {
                    let env = bus.at("编译环境");
                    btfFile = env.path.root + "/rpose.config.btf";
                }

                if (File.existsFile(btfFile)) {
                    return btfFile;
                }
                // 不存在时返回undefined
            };
        })()
    );

    bus.on(
        "模块组件信息",
        (function(map = new Map()) {
            return function getImportInfo(pkgname) {
                pkgname.indexOf(":") > 0 && (pkgname = pkgname.substring(0, pkgname.indexOf(":"))); // @scope/pkg@x.y.z:component => @scope/pkg@x.y.z
                pkgname.lastIndexOf("@") > 0 && (pkgname = pkgname.substring(0, pkgname.lastIndexOf("@"))); // @scope/pkg@x.y.z => @scope/pkg
                pkgname = pkgname.toLowerCase();

                if (!map.has(pkgname)) {
                    let env = bus.at("编译环境");
                    let nodemodules = [
                        ...findNodeModules({ cwd: env.path.root, relative: false }),
                        ...findNodeModules({ cwd: __dirname, relative: false })
                    ];
                    for (let i = 0, module, path; (module = nodemodules[i++]); ) {
                        path = File.resolve(module, pkgname).replace(/\\/g, "/");
                        if (File.existsDir(path)) {
                            let obj = JSON.parse(File.read(File.resolve(path, "package.json")));
                            let version = obj.version;
                            let name = obj.name;
                            let pkg = name + "@" + version;
                            let files = File.files(path, "/src/**.rpose");
                            let config = File.resolve(path, "rpose.config.btf");
                            map.set(name, { path, pkg, name, version, files, config });
                            break;
                        }
                    }
                }

                return map.get(pkgname) || { files: [], config: "" };
            };
        })()
    );

    bus.on(
        "组件类名",
        (function() {
            return file => {
                let tagpkg = bus.at("标签全名", bus.at("标签源文件", file)); // xxx/node_modules/@aaa/bbb/ui-abc.rpose => @aaa/bbb:ui-abc
                tagpkg = tagpkg
                    .replace(/[@\/`]/g, "$")
                    .replace(/\./g, "_")
                    .replace(":", "$-"); // @aaa/bbb:ui-abc => $aaa$bbb$-ui-abc
                tagpkg = ("-" + tagpkg)
                    .split("-")
                    .map(s => s.substring(0, 1).toUpperCase() + s.substring(1))
                    .join(""); // @aaa/bbb:ui-abc => $aaa$bbb$-ui-abc => $aaa$bbb$UiAbc
                return tagpkg;
            };
        })()
    );

    bus.on(
        "组件目标文件名",
        (function() {
            return function(srcFile) {
                let env = bus.at("编译环境");
                if (srcFile.startsWith(env.path.src_buildin)) {
                    return "$buildin/" + File.name(srcFile); // buildin
                }

                let tagpkg = bus.at("标签全名", srcFile); // @aaa/bbb:ui-btn
                return tagpkg.replace(":", "/");
            };
        })()
    );

    bus.on(
        "页面目标JS文件名",
        (function() {
            return function(srcFile) {
                let env = bus.at("编译环境");
                return env.path.build_dist + srcFile.substring(env.path.src.length, srcFile.length - 6) + ".js";
            };
        })()
    );

    bus.on(
        "页面目标CSS文件名",
        (function() {
            return function(srcFile) {
                let env = bus.at("编译环境");
                return env.path.build_dist + srcFile.substring(env.path.src.length, srcFile.length - 6) + ".css";
            };
        })()
    );

    bus.on(
        "页面目标HTML文件名",
        (function() {
            return function(srcFile) {
                let env = bus.at("编译环境");
                return env.path.build_dist + srcFile.substring(env.path.src.length, srcFile.length - 6) + ".html";
            };
        })()
    );

    bus.on(
        "自动安装",
        (function(rs = {}) {
            return function autoinstall(pkg) {
                pkg.indexOf(":") > 0 && (pkg = pkg.substring(0, pkg.indexOf(":"))); // @scope/pkg:component => @scope/pkg
                pkg.lastIndexOf("@") > 0 && (pkg = pkg.substring(0, pkg.lastIndexOf("@"))); // 不该考虑版本，保险起见修理一下，@scope/pkg@x.y.z => @scope/pkg

                if (!rs[pkg]) {
                    if (!npm.isInstalled(pkg)) {
                        rs[pkg] = npm.install(pkg, { timeout: 60000 }); // 安装超时1分钟则异常
                    } else {
                        rs[pkg] = true;
                    }
                }
                return rs[pkg];
            };
        })()
    );

    bus.on(
        "页面图片相对路径",
        (function() {
            return srcFile => {
                let env = bus.at("编译环境");
                let ary = srcFile.substring(env.path.src.length).split("/");
                let rs = "../".repeat(ary.length - 2) + env.path.build_dist_images;
                return (rs || ".") + "/";
            };
        })()
    );

    // ------- z30m-util end
})();

/* ------- z99p-log ------- */
(() => {
    // ------- z99p-log start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("z99p-log", function(root, result) {
                //        console.info('[999-log]', '-----------root JSON----------');
                //        console.info(JSON.stringify(root,null,4));
                //        console.info('[999-log]', '-----------result JSON----------');
                //        console.info(JSON.stringify(result,null,4));
                //        console.info('[999-log]', '--------------------------------');
            });
        })()
    );

    // ------- z99p-log end
})();

console.timeEnd("load");
/* ------- index ------- */
const bus = require("@gotoeasy/bus");
const npm = require("@gotoeasy/npm");
const Err = require("@gotoeasy/err");
const File = require("@gotoeasy/file");
const postobject = require("@gotoeasy/postobject");

/*
console.time('load');
    npm.requireAll(__dirname, 'src/**.js');
console.timeEnd('load');


*/
async function build(opts) {
    console.time("build");

    try {
        let env = bus.at("编译环境", opts);
        bus.at("clean");

        await Promise.all(bus.at("全部编译"));
    } catch (e) {
        console.error(Err.cat("build failed", e).toString());
    }

    console.timeEnd("build");
}

function clean(opts) {
    console.time("clean");

    try {
        let env = bus.at("编译环境", opts);
        bus.at("clean");
    } catch (e) {
        console.error(Err.cat("clean failed", e).toString());
    }

    console.timeEnd("clean");
}

async function watch(opts) {
    await build(opts);
    bus.at("文件监视");
}

module.exports = { build, clean, watch };
