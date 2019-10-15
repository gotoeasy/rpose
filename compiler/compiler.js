console.time("load");
/* ------- a00m-env ------- */
(() => {
    // ------- a00m-env start
    const File = require("@gotoeasy/file");
    const Btf = require("@gotoeasy/btf");
    const bus = require("@gotoeasy/bus");
    const Err = require("@gotoeasy/err");
    const npm = require("@gotoeasy/npm");
    const path = require("path");
    const findNodeModules = require("find-node-modules");

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
        result.path.svgicons = root + "/" + (mapPath.get("svgicons") || "resources/svgicons"); // SVG图标文件目录

        result.theme = btf.getText("theme") == null || !btf.getText("theme").trim() ? "@gotoeasy/theme" : btf.getText("theme").trim();
        result.prerender =
            btf.getText("prerender") == null || !btf.getText("prerender").trim() ? "@gotoeasy/pre-render" : btf.getText("prerender").trim();

        result.config = root + "/rpose.config.btf";
        let packagejson = root + "/package.json";
        if (File.existsFile(packagejson)) {
            result.packageName = JSON.parse(File.read(packagejson)).name;
        }

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

        let node_modules = [...findNodeModules({ cwd: __dirname, relative: false }), ...findNodeModules({ cwd: process.cwd(), relative: false })];

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

        bus.on("源文件添加", async function(oFile) {
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
            await bus.at("全部编译");
        });

        bus.on("SVG文件添加", async function(svgfile) {
            await bus.at("重新编译和该SVG可能相关的组件和页面", svgfile);
        });

        bus.on("图片文件添加", async function() {
            // 图片文件添加时，重新编译未编译成功的组件
            let oFiles = bus.at("源文件对象清单");
            for (let file in oFiles) {
                let context = bus.at("组件编译缓存", file);
                if (!context) {
                    return await bus.at("全部编译");
                }
            }
        });

        bus.on("源文件修改", async function(oFileIn) {
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
                removeHtmlCssJsFile(file);
            });
            bus.at("组件编译缓存", oFile.file, false); // 删除当前文件的编译缓存
            removeHtmlCssJsFile(oFile.file);
            await bus.at("全部编译");
        });

        bus.on("SVG文件修改", async function(svgfile) {
            await bus.at("重新编译和该SVG可能相关的组件和页面", svgfile);
        });

        bus.on("图片文件修改", async function(imgfile) {
            // 图片文件修改时，找出使用该图片文件的组件，以及使用该组件的页面，都清除缓存后重新编译
            let oFiles = bus.at("源文件对象清单");
            let refFiles = [];
            for (let file in oFiles) {
                let context = bus.at("组件编译缓存", file);
                if (context) {
                    let refimages = context.result.refimages || [];
                    if (refimages.includes(imgfile)) {
                        // 比较的是全路径文件名
                        let tag = getTagOfSrcFile(file); // 直接关联的组件标签名
                        refFiles.push(file); // 待重新编译的组件
                        refFiles.push(...getRefPages(tag)); // 待重新编译的页面
                    }
                }
            }

            if (refFiles.length) {
                new Set(refFiles).forEach(pageFile => {
                    bus.at("组件编译缓存", pageFile, false); // 清除编译缓存
                    removeHtmlCssJsFile(pageFile);
                });
                await bus.at("全部编译");
            }
        });

        bus.on("源文件删除", async function(file) {
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
                removeHtmlCssJsFile(file);
            });
            bus.at("组件编译缓存", oFile.file, false); // 删除当前文件的编译缓存
            removeHtmlCssJsFile(oFile.file);

            await bus.at("全部编译");
        });

        bus.on("SVG文件删除", async function(svgfile) {
            await bus.at("重新编译和该SVG可能相关的组件和页面", svgfile);
        });

        bus.on("图片文件删除", async function(imgfile) {
            // 图片文件删除时，处理等同图片文件修改
            await bus.at("图片文件修改", imgfile);
        });

        bus.on("重新编译和该SVG可能相关的组件和页面", async function(svgfile) {
            // 如果是图表目录中的文件，简化的，但凡用到图标的组件和页面，统统重新编译
            let env = bus.at("编译环境");

            let oSetFiles = new Set(),
                oSetPages = new Set();
            let oFiles = bus.at("源文件对象清单");
            let pages;
            for (let file in oFiles) {
                let context = bus.at("组件编译缓存", file);
                if (context) {
                    // 可能是图标用途的svg文件
                    if (svgfile.startsWith(env.path.svgicons + "/")) {
                        if (context.result.hasSvgIcon) {
                            oSetFiles.add(file); // 直接使用图标的组件
                            pages = getRefPages(getTagOfSrcFile(file));
                            pages.forEach(f => oSetPages.add(f)); // 使用本组件的页面

                            continue;
                        }
                    }

                    // 可能是图片用途的svg文件
                    let refimages = context.result.refimages || [];
                    if (refimages.includes(svgfile)) {
                        oSetFiles.add(file); // 使用该svg作为图片用途的组件
                        pages = getRefPages(getTagOfSrcFile(file));
                        pages.forEach(f => oSetPages.add(f)); // 使用本组件的页面
                    }
                }
            }

            oSetPages.forEach(file => {
                bus.at("组件编译缓存", file, false); // 清除编译缓存
                removeHtmlCssJsFile(file);
            });
            oSetFiles.forEach(file => {
                bus.at("组件编译缓存", file, false); // 清除编译缓存
            });

            await bus.at("全部编译");
        });
    })();

    // 取标签名，无效者undefined
    function getTagOfSrcFile(file) {
        let name = File.name(file);
        if (/[^a-zA-Z0-9_-]/.test(name) || !/^[a-zA-Z]/.test(name)) {
            return;
        }
        return name.toLowerCase();
    }

    // 文件改变时，先删除生成的最终html等文件
    function removeHtmlCssJsFile(file) {
        let fileHtml = bus.at("页面目标HTML文件名", file);
        let fileCss = bus.at("页面目标CSS文件名", file);
        let fileJs = bus.at("页面目标JS文件名", file);

        File.remove(fileHtml);
        File.remove(fileCss);
        File.remove(fileJs);
    }

    // ------- a20m-src-file-manager end
})();

/* ------- a22m-file-watcher ------- */
(() => {
    // ------- a22m-file-watcher start
    const bus = require("@gotoeasy/bus");
    const File = require("@gotoeasy/file");
    const hash = require("@gotoeasy/hash");
    const chokidar = require("chokidar");

    bus.on(
        "文件监视",
        (function(oSrcHash = {}, oOthHash = {}, hashBrowserslistrc, hashRposeconfigbtf) {
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
                                hashBrowserslistrc = hash(File.read(browserslistrc));
                                console.info("add ......", file);
                                bus.at("browserslist", true) > (await bus.at("重新编译全部页面")); // 重新查询目标浏览器，然后重新编译全部页面
                            } else if (file === rposeconfigbtf) {
                                // 配置文件 rpose.config.btf 添加
                                hashRposeconfigbtf = hash(File.read(rposeconfigbtf));
                                console.info("add ......", file);
                                await bus.at("全部重新编译");
                            } else if (file.startsWith(bus.at("编译环境").path.src + "/") && /\.rpose$/i.test(file)) {
                                // 源文件添加
                                if (isValidRposeFile(file)) {
                                    console.info("add ......", file);
                                    let text = File.read(file);
                                    let hashcode = hash(text);
                                    let oFile = { file, text, hashcode };
                                    oSrcHash[file] = oFile;
                                    await busAt("源文件添加", oFile);
                                } else {
                                    console.info("ignored ...... add", file);
                                }
                            } else if (isValidSvgiconFile(file)) {
                                // svg文件添加
                                console.info("add svg ......", file);
                                let text = File.read(file);
                                let hashcode = hash(text);
                                oOthHash[file] = hashcode;
                                await busAt("SVG文件添加", file);
                            } else if (isValidImageFile(file)) {
                                // 图片文件添加
                                console.info("add img ......", file);
                                let hashcode = hash({ file });
                                oOthHash[file] = hashcode;
                                await busAt("图片文件添加"); // 只是把没编译成功的都再编译一遍，不需要传文件名
                            } else if (isValidCssFile(file)) {
                                // CSS文件添加（可能影响本地样式库）
                                console.info("add css ......", file);
                                let hashcode = hash({ file });
                                oOthHash[file] = hashcode;
                                await busAt("CSS文件添加", file);
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
                                    hashBrowserslistrc = hashcode;
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
                                    if (!oSrcHash[file] || oSrcHash[file].hashcode !== hashcode) {
                                        console.info("change ......", file);
                                        let oFile = { file, text, hashcode };
                                        oSrcHash[file] = oFile;
                                        await busAt("源文件修改", oFile);
                                    }
                                } else {
                                    console.info("ignored ...... change", file);
                                }
                            } else if (isValidSvgiconFile(file)) {
                                // svg文件修改
                                let text = File.read(file);
                                let hashcode = hash(text);
                                if (oOthHash[file] !== hashcode) {
                                    console.info("change svg ......", file);
                                    oOthHash[file] = hashcode;
                                    await busAt("SVG文件修改", file);
                                }
                            } else if (isValidImageFile(file)) {
                                // 图片文件修改
                                let hashcode = hash({ file });
                                if (oOthHash[file] !== hashcode) {
                                    console.info("change img ......", file);
                                    oOthHash[file] = hashcode;
                                    await busAt("图片文件修改", file);
                                }
                            } else if (isValidCssFile(file)) {
                                // CSS文件修改（可能影响本地样式库）
                                let hashcode = hash({ file });
                                if (oOthHash[file] !== hashcode) {
                                    console.info("change css ......", file);
                                    oOthHash[file] = hashcode;
                                    await busAt("CSS文件修改", file);
                                }
                            }
                        }
                    })
                    .on("unlink", async file => {
                        if (ready) {
                            file = file.replace(/\\/g, "/");

                            if (file === browserslistrc) {
                                // 配置文件 .browserslistrc 删除
                                hashBrowserslistrc = null;
                                console.info("del ......", file);
                                bus.at("browserslist", true) > (await bus.at("重新编译全部页面")); // 重新查询目标浏览器，然后重新编译全部页面
                            } else if (file === rposeconfigbtf) {
                                // 配置文件 rpose.config.btf 删除
                                hashRposeconfigbtf = null;
                                console.info("del ......", file);
                                await bus.at("全部重新编译");
                            } else if (file.startsWith(bus.at("编译环境").path.src + "/") && /\.rpose$/i.test(file)) {
                                // 源文件删除
                                if (/\.rpose$/i.test(file)) {
                                    if (isValidRposeFile(file)) {
                                        console.info("del ......", file);
                                        delete oSrcHash[file];
                                        await busAt("源文件删除", file);
                                    } else {
                                        console.info("ignored ...... del", file);
                                    }
                                }
                            } else if (isValidSvgiconFile(file)) {
                                // svg文件删除
                                console.info("del svg ......", file);
                                delete oOthHash[file];
                                await busAt("SVG文件删除", file);
                            } else if (isValidImageFile(file)) {
                                // 图片文件删除
                                console.info("del img ......", file);
                                delete oOthHash[file];
                                await busAt("图片文件删除", file);
                            } else if (isValidCssFile(file)) {
                                // CSS文件删除
                                console.info("del css ......", file);
                                delete oOthHash[file];
                                await busAt("CSS文件删除", file);
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
        let stime = new Date().getTime();

        await bus.at(name, ofile);

        let time = new Date().getTime() - stime;
        console.info("build " + time + "ms"); // 异步原因，不能用timeEnd计算用时
    }

    function isValidRposeFile(file) {
        let name = File.name(file);
        if (/[^a-zA-Z0-9_-]/.test(name) || !/^[a-zA-Z]/.test(name)) {
            return false;
        }
        return true;
    }

    function isValidSvgiconFile(file) {
        let env = bus.at("编译环境");
        let buildPath = env.path.build + "/";
        let node_modulesPath = env.path.root + "/node_modules/";
        let dotPath = env.path.root + "/.";

        return /\.svg$/i.test(file) && !file.startsWith(buildPath) && !file.startsWith(node_modulesPath) && !file.startsWith(dotPath);
    }

    function isValidImageFile(file) {
        let env = bus.at("编译环境");
        let buildPath = env.path.build + "/";
        let node_modulesPath = env.path.root + "/node_modules/";
        let dotPath = env.path.root + "/.";

        return (
            /\.(jpg|png|gif|bmp|jpeg)$/i.test(file) && !file.startsWith(buildPath) && !file.startsWith(node_modulesPath) && !file.startsWith(dotPath)
        );
    }

    function isValidCssFile(file) {
        let env = bus.at("编译环境");
        let buildPath = env.path.build + "/";
        let node_modulesPath = env.path.root + "/node_modules/";
        let dotPath = env.path.root + "/.";

        return /\.css$/i.test(file) && !file.startsWith(buildPath) && !file.startsWith(node_modulesPath) && !file.startsWith(dotPath);
    }

    // ------- a22m-file-watcher end
})();

/* ------- a30m-compile-all-page ------- */
(() => {
    // ------- a30m-compile-all-page start
    const bus = require("@gotoeasy/bus");
    const Err = require("@gotoeasy/err");

    bus.on(
        "全部编译",
        (function() {
            return async function() {
                let oFiles = bus.at("源文件对象清单");
                let env = bus.at("编译环境");

                bus.at("项目配置处理", env.path.root + "rpose.config.btf");

                let errSet = new Set();
                let stime, time;
                for (let file in oFiles) {
                    try {
                        stime = new Date().getTime();

                        let context = bus.at("编译组件", oFiles[file]);

                        time = new Date().getTime() - stime;
                        if (time > 100) {
                            console.info("[compile] " + time + "ms -", file.replace(env.path.src + "/", ""));
                        }

                        await context.result.browserifyJs;
                    } catch (e) {
                        bus.at("组件编译缓存", file, false); // 出错时确保删除缓存（可能组件编译过程成功，页面编译过程失败）
                        errSet.add(Err.cat(e).toString());
                    }
                }

                // 输出汇总的错误信息
                errSet.size && console.error([...errSet].join("\n\n"));
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
    const Err = require("@gotoeasy/err");
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

    bus.on(
        "重新编译全部页面",
        (function() {
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

                for (let key in oFiles) {
                    time1 = new Date().getTime();

                    let context = bus.at("编译组件", oFiles[key]);

                    time = new Date().getTime() - time1;
                    if (time > 100) {
                        console.info("[compile] " + time + "ms -", key.replace(env.path.src + "/", ""));
                    }

                    await context.result.browserifyJs;
                }

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

    bus.on(
        "全部重新编译",
        (function() {
            return async function() {
                let time,
                    time1,
                    stime = new Date().getTime();
                let env = bus.at("编译环境");
                bus.at("清除全部编译缓存"); // 清除全部编译缓存
                env = bus.at("编译环境", env, true); // 重新设定编译环境
                bus.at("项目配置处理", env.path.root + "rpose.config.btf", true); // 重新解析项目配置处理
                let oFiles = bus.at("源文件对象清单", true); // 源文件清单重新设定

                for (let key in oFiles) {
                    time1 = new Date().getTime();

                    let context = bus.at("编译组件", oFiles[key]);

                    time = new Date().getTime() - time1;
                    if (time > 100) {
                        console.info("[compile] " + time + "ms -", key.replace(env.path.src + "/", ""));
                    }

                    await context.result.browserifyJs;
                }

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
                        hashcode = context.result.hashcode || REBUILDING; // 如果已经编译成功就会有值，否则可能是编译失败，或者是正编译中
                    } else {
                        hashcode = REBUILDING; // 返回'rebuilding...'状态，前端自行判断数次后按错误处理
                    }
                } else {
                    hashcode = "404"; // 源码文件不存在，显示404
                }

                res.writeHead(200);
                res.end(hashcode); // 未成功编译时，返回空白串
            }

            // html注入脚本
            function htmlHandle(req, res, oUrl, htmlfile) {
                let env = bus.at("编译环境");
                let srcFile = File.resolve(env.path.src, htmlfile.substring(env.path.build_dist.length + 1, htmlfile.length - 5) + ".rpose");
                let htmlpage = htmlfile.substring(env.path.build_dist.length + 1);

                let html,
                    hashcode = "";
                if (File.existsFile(srcFile)) {
                    let context = bus.at("组件编译缓存", srcFile);
                    if (context) {
                        hashcode = context.result.hashcode || ""; // 如果已经编译成功就会有值，否则是正编译中
                    }

                    if (!hashcode) {
                        // 当前不是编译成功状态，都显示500编译失败
                        html = `
                    <!doctype html>
                    <html lang="en">
                        <head>
                        <title>500</title>
                        </head>
                    <body>
                        <pre style="background:#333;color:#ddd;padding:20px;font-size:24px;">500 Compile Failed</pre>
                    </body>
                    </html>
                    `;
                        hashcode = "500";
                    } else {
                        html = File.read(htmlfile);
                    }
                } else {
                    // 源码文件不存在则404
                    html = `
                <!doctype html>
                <html lang="en">
                    <head>
                    <title>404</title>
                    </head>
                <body>
                    <pre style="background:#943E03;color:#fff;padding:20px;font-size:24px;">404 Not Found</pre>
                </body>
                </html>
                `;
                    hashcode = "404";
                }

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

                html = html.replace(/<head>/i, "<head>" + script); // 极简实现，注入脚本，定时轮询服务端
                res.writeHead(200, { "Content-Type": "text/html;charset=UFT8" }); // 即使404请求，也是被当正常注入返回
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
                        htmlHandle(req, res, oUrl, reqfile); // 拦截注入脚本后返回
                        return;
                    }

                    if (File.existsFile(reqfile)) {
                        if (/\.css$/i.test(reqfile)) {
                            res.writeHead(200, { "Content-Type": "text/css;charset=UFT8" }); // 避免浏览器控制台警告
                        } else if (/\.js$/i.test(reqfile)) {
                            res.writeHead(200, { "Content-Type": "application/javascript;charset=UFT8" });
                        } else if (/\.json$/i.test(reqfile)) {
                            res.writeHead(200, { "Content-Type": "application/json;charset=UFT8" });
                        } else if (/\.jsonp$/i.test(reqfile)) {
                            res.writeHead(200, { "Content-Type": "application/jsonp;charset=UFT8" });
                        } else if (/\.svg$/i.test(reqfile)) {
                            res.writeHead(200, { "Content-Type": "image/svg+xml;charset=UFT8" });
                        } else if (/\.svgz$/i.test(reqfile)) {
                            res.writeHead(200, { "Content-Type": "image/svg+xml-compressed;charset=UFT8" });
                        } else if (/\.jpg$/i.test(reqfile) || /\.jpeg$/i.test(reqfile)) {
                            res.writeHead(200, { "Content-Type": "image/jpeg" });
                        } else if (/\.gif$/i.test(reqfile)) {
                            res.writeHead(200, { "Content-Type": "image/gif" });
                        } else if (/\.bmp$/i.test(reqfile)) {
                            res.writeHead(200, { "Content-Type": "image/bmp" });
                        } else if (/\.png$/i.test(reqfile)) {
                            res.writeHead(200, { "Content-Type": "image/png" });
                        } else if (/\.pdf$/i.test(reqfile)) {
                            res.writeHead(200, { "Content-Type": "application/pdf" });
                        } else if (/\.xml$/i.test(reqfile)) {
                            res.writeHead(200, { "Content-Type": "text/xml;charset=UFT8" });
                        } else if (/\.dtd$/i.test(reqfile)) {
                            res.writeHead(200, { "Content-Type": "text/xml-dtd;charset=UFT8" });
                        } else if (/\.zip$/i.test(reqfile)) {
                            res.writeHead(200, { "Content-Type": "application/zip" });
                        } else if (/\.gzip$/i.test(reqfile)) {
                            res.writeHead(200, { "Content-Type": "application/gzip" });
                        } else if (/\.xls$/i.test(reqfile)) {
                            res.writeHead(200, { "Content-Type": "application/vnd.ms-excel" });
                        } else if (/\.xlsx$/i.test(reqfile)) {
                            res.writeHead(200, { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                        } else if (/\.doc$/i.test(reqfile)) {
                            res.writeHead(200, { "Content-Type": "application/msword" });
                        } else if (/\.docx$/i.test(reqfile)) {
                            res.writeHead(200, { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
                        } else if (/\.ppt$/i.test(reqfile)) {
                            res.writeHead(200, { "Content-Type": "application/vnd.ms-powerpoint" });
                        } else if (/\.pptx$/i.test(reqfile)) {
                            res.writeHead(200, { "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
                        } else if (/\.dll$/i.test(reqfile) || /\.exe$/i.test(reqfile)) {
                            res.writeHead(200, { "Content-Type": "application/x-msdownload" });
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
            return postobject.plugin("b00p-log", function(/* root, context */) {
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
                context.script = {}; // 存放脚本的中间编译结果，script的Method属性存放方法名为键的对象
                context.keyCounter = 1; // 视图解析时标识key用的计数器（同一组子节点单位内递增）

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

    // ---------------------------------------------------
    // 项目配置文件解析
    // ---------------------------------------------------
    bus.on(
        "项目配置文件解析",
        (function() {
            return function(text) {
                let lines = text.split("\n"); // 行内容包含换行符
                let lineCounts = []; // 行长度包含换行符
                for (let i = 0, max = lines.length; i < max; i++) {
                    lines[i] += "\n"; // 行内容包含换行符
                    lineCounts[i] = lines[i].length; // 行长度包含换行符
                }

                let nodes = [];
                parse(nodes, lines, lineCounts);

                nodes.forEach(block => {
                    let type = "ProjectBtfBlockText";
                    if (block.buf.length) {
                        // 值
                        let lastLine = block.buf.pop();
                        let tmp = lastLine.replace(/\r?\n$/, ""); // 删除最后一行回车换行符
                        tmp && block.buf.push(tmp); // 删除最后一行回车换行符后仍有内容则加回去
                        let value = block.buf.join(""); // 无损拼接

                        // 开始位置
                        let start = sumLineCount(lineCounts, block.startLine); // 块内容开始位置（即块名行为止合计长度）
                        // 结束位置
                        let end = sumLineCount(lineCounts, block.startLine + block.buf.length - 1) + tmp.length;

                        block.text = { type, value, pos: { start, end } };
                    } else {
                        // 值
                        let value = "";
                        // 开始位置
                        let start = sumLineCount(lineCounts, block.startLine); // 块内容开始位置（即块名行为止合计长度）
                        // 结束位置
                        let end = start;

                        block.text = { type, value, pos: { start, end } };
                    }
                    delete block.buf;
                });
                return { nodes };
            };
        })()
    );

    function parse(blocks, lines, lineCounts) {
        let sLine,
            block,
            oName,
            comment,
            blockStart = false;
        for (let i = 0; i < lines.length; i++) {
            sLine = lines[i];

            if (isBlockStart(sLine)) {
                // 当前是块名行 [nnn]
                block = { type: "ProjectBtfBlock" };
                oName = getBlockName(sLine); // oName.len包含转义字符长度
                comment = sLine.substring(oName.len + 2).replace(/\r?\n$/, ""); // 块注释，忽略换行符

                let start = sumLineCount(lineCounts, i); // 开始位置信息，含左中括号
                let end = start + oName.len + 2; // 结束位置信息，含右中括号
                block.name = { type: "ProjectBtfBlockName", value: oName.name, pos: { start, end } }; // 位置包含中括号
                if (comment) {
                    start = end; // 注释的开始位置=块名的结束位置
                    end = start + comment.length;
                    block.comment = { type: "ProjectBtfBlockComment", value: comment, pos: { start, end } }; // 注释(不计换行符)
                }

                block.buf = [];
                block.startLine = i + 1; // 块内容开始行

                blocks.push(block);
                blockStart = true;
            } else if (isBlockEnd(sLine)) {
                // 当前是块结束行 ---------
                blockStart = false;
            } else if (isDocumentEnd(sLine)) {
                // 当前是文档结束行 =========
                return;
            } else {
                if (blockStart) {
                    // 当前是块内容行
                    let buf = blocks[blocks.length - 1].buf;
                    if (sLine.charAt(0) === "\\" && (/^\\+\[.*\]/.test(sLine) || /^\\+---------/.test(sLine) || /^\\+=========/.test(sLine))) {
                        buf.push(sLine.substring(1)); // 去除转义字符，拼接当前Block内容
                    } else {
                        buf.push(sLine);
                    }
                } else {
                    // 当前是注释行(比如，块结束行之后，块开始行之前)
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
                return { name, len }; // len包含转义字符长度
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
    const File = require("@gotoeasy/file");
    const hash = require("@gotoeasy/hash");
    const csslibify = require("csslibify");

    (function(mapFileCsslibs = new Map()) {
        // 参数oCsslib为样式库定义信息对象
        // 返回样式库对象
        bus.on("样式库", function(oCsslib, fromFile) {
            // 导入处理
            let cssfiles = []; // 待导入的css文件数组
            oCsslib.filters.forEach(filter => {
                cssfiles.push(...File.files(oCsslib.dir, filter)); // 逐个过滤筛选，确保按过滤器顺序读取文件
            });

            let text = [];
            cssfiles.forEach(cssfile => text.push(File.read(cssfile)));
            let textid = hash(text.join("\n")); // 文件内容哈希ID

            let pkg = oCsslib.pkg; // 样式库包名
            if (pkg.startsWith("~")) {
                pkg = "dir_" + textid; // 本地目录样式库时，添加文件内容哈希ID后缀作为包名(用以支持导入不同文件或修改文件内容而不产生冲突)

                let env = bus.at("编译环境");
                if (env.watch) {
                    let ary = mapFileCsslibs.get(fromFile) || [];
                    mapFileCsslibs.set(fromFile, ary);
                    oCsslib.cssfiles = cssfiles; // 文件存起来方便比较
                    ary.push(oCsslib); // 如果是文件监视模式，把本地样式库的配置都存起来，便于样式文件修改时判断做重新编译
                }
            } else {
                pkg += "_" + textid; // npm包时，添加文件内容哈希ID后缀作为包名(用以支持导入不同文件或更改版本而不产生冲突)
            }

            let csslib = csslibify(pkg, oCsslib.alias, textid); // 用文件内容作为样式库的缓存ID（会浅复制更新包名和别名）

            if (!csslib._imported.length) {
                for (let i = 0; i < text.length; i++) {
                    csslib.imp(text[i++]); // 未曾导入时，做导入，直接使用已读内容
                }
            }

            csslib.isEmpty = !cssfiles.length; // 保存标志便于判断

            return csslib;
        });

        bus.on("CSS文件添加", async function() {
            let configFile,
                srcFiles = [];

            // 全部样式库都按过滤器重新筛选检查，看样式文件列表是否一致
            mapFileCsslibs.forEach((ary, fromFile) => {
                for (let i = 0, oCsslib, files; (oCsslib = ary[i++]); ) {
                    files = [];
                    oCsslib.filters.forEach(filter => {
                        files.push(...File.files(oCsslib.dir, filter)); // 重新逐个过滤筛选
                    });
                    if (files.join("") !== oCsslib.cssfiles.join("")) {
                        // 不一样了，该fromFile关联组件要重新编译
                        if (fromFile.endsWith("/rpose.config.btf")) {
                            configFile = fromFile;
                        } else {
                            srcFiles.push(fromFile);
                        }
                        break;
                    }
                }
            });

            if (configFile) {
                // 影响到了项目配置文件的[csslib]样式库配置，全部重新编译吧
                mapFileCsslibs.clear();
                await bus.at("全部重新编译");
                return;
            } else {
                // 影响到了相关组件文件的[csslib]或@csslib样式库配置，关联组件都重新编译
                await rebuildAllReferances(...srcFiles);
            }
        });

        bus.on("CSS文件修改", async function(cssFile) {
            let configFile,
                srcFiles = [];

            // 全部样式库逐个检查文件列表是否包含被变更的css文件
            mapFileCsslibs.forEach((ary, fromFile) => {
                for (let i = 0, oCsslib; (oCsslib = ary[i++]); ) {
                    if (oCsslib.cssfiles.includes(cssFile)) {
                        if (fromFile.endsWith("/rpose.config.btf")) {
                            configFile = fromFile;
                        } else {
                            srcFiles.push(fromFile);
                        }
                        break;
                    }
                }
            });

            if (configFile) {
                // 影响到了项目配置文件的[csslib]样式库配置，全部重新编译吧
                mapFileCsslibs.clear();
                await bus.at("全部重新编译");
                return;
            } else {
                // 影响到了相关组件文件的[csslib]或@csslib样式库配置，关联组件都重新编译
                await rebuildAllReferances(...srcFiles);
            }
        });

        bus.on("CSS文件删除", async function() {
            // 和CSS文件添加是一样的处理逻辑
            await bus.at("CSS文件添加");
        });
    })();

    // 相关组件页面全部重新编译
    async function rebuildAllReferances(...srcFiles) {
        if (!srcFiles.length) return;

        let pageFiles = bus.at("组件相关页面源文件", ...srcFiles);

        // 清除页面组件编译缓存，删除已编译的html等文件
        pageFiles.forEach(file => {
            bus.at("组件编译缓存", file, false);
            removeHtmlCssJsFile(file);
        });

        // 清除组件编译缓存
        srcFiles.forEach(file => bus.at("组件编译缓存", file, false));

        await bus.at("全部编译");
    }

    // 文件改变时，先删除生成的最终html等文件
    function removeHtmlCssJsFile(file) {
        let fileHtml = bus.at("页面目标HTML文件名", file);
        let fileCss = bus.at("页面目标CSS文件名", file);
        let fileJs = bus.at("页面目标JS文件名", file);

        File.remove(fileHtml);
        File.remove(fileCss);
        File.remove(fileJs);
    }

    // ------- b20m-csslibify end
})();

/* ------- b22m-csslibify-parser-[csslib] ------- */
(() => {
    // ------- b22m-csslibify-parser-[csslib] start
    const bus = require("@gotoeasy/bus");
    const Err = require("@gotoeasy/err");
    const File = require("@gotoeasy/file");
    const findNodeModules = require("find-node-modules");

    bus.on(
        "解析[csslib]",
        (function() {
            // 仅解析和简单验证，不做安装和定义等事情
            return function parseCsslib(obj, file, text) {
                let rs = {};
                let csslibBlockText = obj.value || "";
                if (!csslibBlockText.trim()) {
                    return rs;
                }

                let lines = csslibBlockText.split("\n");
                for (let i = 0, csslib, oCsslib; i < lines.length; i++) {
                    csslib = lines[i].split("//")[0].trim(); // 去除注释内容
                    if (!csslib) continue; // 跳过空白行

                    oCsslib = bus.at("解析csslib", csslib, file);
                    let pos = getStartPos(lines, i, obj.pos.start); // taglib位置

                    // 无效的csslib格式
                    if (!oCsslib) {
                        throw new Err("invalid csslib: " + csslib, { file, start: pos.start, end: pos.end });
                    }

                    oCsslib.pos = pos; // 顺便保存位置，备用  TODO 位置

                    // 设定目标目录的绝对路径
                    let dir;
                    if (oCsslib.pkg.startsWith("~")) {
                        // 如果是目录，检查目录是否存在
                        let root = bus.at("文件所在项目根目录", file);
                        dir = oCsslib.pkg.replace(/\\/g, "/").replace(/^~\/*/, root + "/");
                        if (!File.existsDir(dir)) {
                            throw new Err("folder not found [" + dir + "]", { file, text, start: oCsslib.pos.start, end: oCsslib.pos.end });
                        }
                    } else {
                        // 自动安装
                        if (!bus.at("自动安装", oCsslib.pkg)) {
                            throw new Err("package install failed: " + oCsslib.pkg, { file, text, start: oCsslib.pos.start, end: oCsslib.pos.end });
                        }

                        dir = getNodeModulePath(oCsslib.pkg);
                        if (!dir) {
                            // 要么安装失败，或又被删除，总之不应该找不到安装位置
                            throw new Err("package install path not found: " + oCsslib.pkg, {
                                file,
                                text,
                                start: oCsslib.pos.start,
                                end: oCsslib.pos.end
                            });
                        }
                    }
                    oCsslib.dir = dir; // 待导入的样式文件存放目录

                    // 重复的csslib别名
                    if (rs[oCsslib.alias]) {
                        throw new Err("duplicate csslib name: " + oCsslib.alias, { file, start: pos.start, end: pos.endAlias });
                    }

                    rs[oCsslib.alias] = oCsslib;
                }

                return rs;
            };
        })()
    );

    function getStartPos(lines, lineNo, offset) {
        let start = offset;
        for (let i = 0; i < lineNo; i++) {
            start += lines[i].length + 1; // 行长度=行内容长+换行符
        }

        let line = lines[lineNo].split("//")[0]; // 不含注释
        let match = line.match(/^\s+/);
        match && (start += match[0].length); // 加上别名前的空白长度

        let end = start + line.trim().length; // 结束位置不含注释

        let endAlias = end,
            idx = line.indexOf("=");
        if (idx > 0) {
            endAlias = start + line.substring(0, idx).trim().length; // 有等号时的别名长度
        }

        return { start, end, endAlias };
    }

    // 找不到时返回undefined
    function getNodeModulePath(npmpkg) {
        let node_modules = [...findNodeModules({ cwd: process.cwd(), relative: false }), ...findNodeModules({ cwd: __dirname, relative: false })];
        for (let i = 0, modulepath, dir; (modulepath = node_modules[i++]); ) {
            dir = File.resolve(modulepath, npmpkg);
            if (File.existsDir(dir)) {
                return dir;
            }
        }
    }

    // ------- b22m-csslibify-parser-[csslib] end
})();

/* ------- b24m-csslibify-parser-csslib ------- */
(() => {
    // ------- b24m-csslibify-parser-csslib start
    const bus = require("@gotoeasy/bus");

    // 解析单个csslib定义，转换为对象形式方便读取
    bus.on(
        "解析csslib",
        (function() {
            // file用于记录csslib所在文件，便于错误提示
            return function normalizeTaglib(csslib, file = "") {
                let alias,
                    pkg,
                    filters = [],
                    match;
                if ((match = csslib.match(/^([\s\S]*?)=([\s\S]*?):([\s\S]*)$/))) {
                    // alias=pkg:filters
                    alias = match[1].trim();
                    pkg = match[2].trim();
                    match[3]
                        .split("//")[0]
                        .replace(/;/g, ",")
                        .split(",")
                        .forEach(filter => {
                            // 支持注释、支持逗号和分号分隔
                            filter = filter.trim();
                            filter && filters.push(filter);
                        });
                } else if ((match = csslib.match(/^([\s\S]*?)=([\s\S]*)$/))) {
                    // alias=pkg
                    alias = match[1].trim();
                    pkg = match[2].trim();
                    filters.push("**.min.css"); // 默认取npm包下所有压缩后文件*.min.css
                } else if ((match = csslib.match(/^([\s\S]*?):([\s\S]*)$/))) {
                    // pkg:filters
                    alias = "*";
                    pkg = match[1].trim();
                    match[2]
                        .split("//")[0]
                        .replace(/;/g, ",")
                        .split(",")
                        .forEach(filter => {
                            // 支持注释、支持逗号和分号分隔
                            filter = filter.trim();
                            filter && filters.push(filter);
                        });
                } else {
                    // pkg
                    alias = "*";
                    pkg = csslib.trim();
                    filters.push("**.min.css"); // 默认取npm包下所有压缩后文件*.min.css
                }

                if (!pkg || !alias || /[:=/\s]+/.test(alias)) {
                    return null; // 无包名，或写等号又漏写别名，或别名中包含冒号等号斜杠空格，都当做格式有误处理
                }

                return { alias, pkg, filters, file };
            };
        })()
    );

    // ------- b24m-csslibify-parser-csslib end
})();

/* ------- b30m-taglibify ------- */
(() => {
    // ------- b30m-taglibify start
    const bus = require("@gotoeasy/bus");
    const File = require("@gotoeasy/file");

    (function(rs = {}) {
        // 按taglib找源文件
        bus.on("标签库源文件", (taglib, stack = []) => {
            // 循环引用时报异常
            let oSet = (stack.oSet = stack.oSet || new Set());
            let refpkgtag = taglib.pkg + ":" + taglib.tag;
            if (oSet.has(refpkgtag)) {
                let msgs = [];
                stack.forEach(v => {
                    msgs.push(v.taglib + " (" + v.file + ")");
                });
                msgs.push(taglib.taglib + " (" + taglib.file + ")");
                throw new Error("taglib component circular reference\n => " + msgs.join("\n => "));
            }
            oSet.add(refpkgtag);

            stack.push(taglib);

            // 先按标签名查找源文件
            let oTagFile = getTagFileOfPkg(taglib.pkg);
            if (oTagFile[taglib.tag]) {
                return oTagFile[taglib.tag];
            }

            // 再按标签别名查找所在包[taglib]配置的标签库，由该标签库递归找源文件
            let oPkg = bus.at("模块组件信息", taglib.pkg);
            let oPjtContext = bus.at("项目配置处理", oPkg.config); // 解析项目配置文件
            let atastag = "@" + taglib.tag;
            let oTaglib = oPjtContext.result.oTaglibs[atastag];

            let file = "";
            if (oTaglib) {
                let rst;
                while ((rst = bus.at("标签库源文件", oTaglib, stack)) && typeof rst !== "string") {
                    // 返回另一个标签库对象时，继续递归查找到底
                    // 最终要么找到文件（返回文件绝对路径），要么找不到（返回‘’），要么异常（比如循环引用）
                }
                file = rst;
            }

            if (!file) {
                let msgs = [];
                stack.forEach(v => {
                    msgs.push(v.taglib + " (" + v.file + ")");
                });
                throw new Error("taglib component not found\n => " + msgs.join("\n => "));
            }

            return file;
        });

        // 查找指定包中的全部源文件，建立标签关系
        function getTagFileOfPkg(pkg) {
            let oTagFile;
            if (!(oTagFile = rs[pkg])) {
                bus.at("自动安装", pkg);
                let oPkg = bus.at("模块组件信息", pkg);
                oTagFile = {};
                for (let i = 0, file, tag; (file = oPkg.files[i++]); ) {
                    tag = File.name(file).toLowerCase();
                    oTagFile[tag] = file; // 标签 = 文件
                    oTagFile["@" + tag] = file; // @标签 = 文件
                }
                rs[pkg] = oTagFile;
            }

            return oTagFile;
        }
    })();

    // ------- b30m-taglibify end
})();

/* ------- b32m-taglibify-parser-[taglib] ------- */
(() => {
    // ------- b32m-taglibify-parser-[taglib] start
    const bus = require("@gotoeasy/bus");
    const Err = require("@gotoeasy/err");

    bus.on(
        "解析[taglib]",
        (function() {
            // 仅解析和简单验证，不做安装和定义等事情
            return function parseTaglib(obj, file) {
                let rs = {};
                let taglibBlockText = obj.value || "";
                if (!taglibBlockText.trim()) {
                    return rs;
                }

                let lines = taglibBlockText.split("\n");
                for (let i = 0, taglib, oTaglib; i < lines.length; i++) {
                    taglib = lines[i].split("//")[0].trim(); // 去除注释内容
                    if (!taglib) continue; // 跳过空白行

                    oTaglib = bus.at("解析taglib", taglib, file);
                    let pos = getStartPos(lines, i, obj.pos.start); // taglib位置

                    // 无效的taglib格式
                    if (!oTaglib) {
                        throw new Err("invalid taglib: " + taglib, { file, start: pos.start, end: pos.end });
                    }

                    oTaglib.pos = pos; // 顺便保存位置，备用  TODO 位置

                    // 无效的taglib别名
                    if (/\s+/.test(oTaglib.astag)) {
                        throw new Err("invalid taglib alias (include space)", { file, start: pos.start, end: pos.endAlias });
                    }
                    if (/^(if|for|svgicon|router|router-link)$/i.test(oTaglib.astag)) {
                        throw new Err("can not use buildin tag name: " + oTaglib.astag, { file, start: pos.start, end: pos.endAlias });
                    }

                    // 重复的taglib别名 (仅@前缀差异也视为冲突)
                    if (rs[oTaglib.atastag] || rs[oTaglib.astag]) {
                        throw new Err("duplicate tag name: " + oTaglib.astag, { file, start: pos.start, end: pos.endAlias });
                    }

                    rs[oTaglib.atastag] = oTaglib;
                    rs[oTaglib.astag] = oTaglib;
                }

                return rs;
            };
        })()
    );

    function getStartPos(lines, lineNo, offset) {
        let start = offset;
        for (let i = 0; i < lineNo; i++) {
            start += lines[i].length + 1; // 行长度=行内容长+换行符
        }

        let line = lines[lineNo].split("//")[0]; // 不含注释
        let match = line.match(/^\s+/);
        match && (start += match[0].length); // 加上别名前的空白长度

        let end = start + line.trim().length; // 结束位置不含注释

        let endAlias = end,
            idx = line.indexOf("=");
        if (idx > 0) {
            endAlias = start + line.substring(0, idx).trim().length; // 有等号时的别名长度
        }

        // TODO 更详细的位置信息
        return { start, end, endAlias };
    }
    // ------- b32m-taglibify-parser-[taglib] end
})();

/* ------- b34m-taglibify-parser-taglib ------- */
(() => {
    // ------- b34m-taglibify-parser-taglib start
    const bus = require("@gotoeasy/bus");

    // 解析单个taglib定义，转换为对象形式方便读取
    bus.on(
        "解析taglib",
        (function() {
            // file用于记录taglib所在文件，便于错误提示
            return function normalizeTaglib(taglib, file = "") {
                let atastag, astag, pkg, tag, match;
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

                atastag = astag.startsWith("@") ? astag : "@" + astag; // astag可能没有@前缀，atastag固定含@前缀

                return { atastag, astag, pkg, tag, taglib: astag + "=" + pkg + ":" + tag, file };
            };
        })()
    );

    // ------- b34m-taglibify-parser-taglib end
})();

/* ------- b40m-svgiconify-parser-[svgicon] ------- */
(() => {
    // ------- b40m-svgiconify-parser-[svgicon] start
    const bus = require("@gotoeasy/bus");
    const Err = require("@gotoeasy/err");
    const File = require("@gotoeasy/file");
    const resolvepkg = require("resolve-pkg");

    bus.on(
        "解析[svgicon]",
        (function() {
            // 解析、安装、检查重名
            return function(obj, prjCtx) {
                let rs = {};

                // -------------------------------------------
                // 无定义则跳过
                let svgiconBlockText = obj.value || "";
                if (!svgiconBlockText.trim()) {
                    return rs;
                }

                // -------------------------------------------
                // 解析、安装、查询文件、起别名、检查重名
                let lines = svgiconBlockText.split("\n");
                for (let i = 0, svgicon, oSvgicon; i < lines.length; i++) {
                    svgicon = lines[i].split("//")[0].trim(); // 去除注释内容
                    if (!svgicon) continue; // 跳过空白行

                    oSvgicon = bus.at("解析svgicon", svgicon);
                    let pos = getStartPos(lines, i, obj.pos.start); // taglib位置

                    // 无效的svgicon格式
                    if (!oSvgicon) {
                        throw new Err("invalid svgicon define (" + svgicon + ")", { ...prjCtx.input, ...pos });
                    }

                    oSvgicon.pos = pos; // 顺便保存位置，备用

                    // 自动安装
                    if (!bus.at("自动安装", oSvgicon.pkg)) {
                        throw new Err("package install failed: " + oSvgicon.pkg, { ...prjCtx.input, ...pos });
                    }

                    let svgFilter = /\.svg$/i.test(oSvgicon.filter) ? oSvgicon.filter : oSvgicon.filter + ".svg"; // 仅查找svg文件
                    svgFilter = svgFilter.replace(/\\/g, "/");

                    let files = File.files(resolvepkg(oSvgicon.pkg), svgFilter);
                    if (files.length > 1) {
                        throw new Err("mulit svg file found\n  " + files.join("\n  "), { ...prjCtx.input, ...pos });
                    }
                    if (!files.length) {
                        // 任意目录下再找一遍
                        svgFilter = ("**/" + svgFilter).replace(/\/\//g, "/");
                        files = File.files(resolvepkg(oSvgicon.pkg), svgFilter);
                        if (files.length > 1) {
                            throw new Err("mulit svg file found\n  " + files.join("\n  "), { ...prjCtx.input, ...pos });
                        }
                        if (!files.length) {
                            throw new Err("svg file not found", { ...prjCtx.input, ...pos });
                        }
                    }

                    oSvgicon.file = files[0];
                    let alias = oSvgicon.alias === "*" ? File.name(oSvgicon.file).toLowerCase() : oSvgicon.alias.toLowerCase();

                    // 项目配置本身的图标别名不能重复，无重复则通过，以便尽快成功解析配置文件
                    if (rs[alias]) {
                        throw new Err(`duplicate icon name (${alias})`, { ...prjCtx.input, start: pos.start, end: pos.endAlias });
                    }
                    rs[alias] = oSvgicon;
                }

                return rs;
            };
        })()
    );

    function getStartPos(lines, lineNo, offset) {
        let start = offset;
        for (let i = 0; i < lineNo; i++) {
            start += lines[i].length + 1; // 行长度=行内容长+换行符
        }

        let line = lines[lineNo].split("//")[0]; // 不含注释
        let match = line.match(/^\s+/);
        match && (start += match[0].length); // 加上别名前的空白长度

        let end = start + line.trim().length; // 结束位置不含注释

        let endAlias = end,
            idx = line.indexOf("=");
        if (idx > 0) {
            endAlias = start + line.substring(0, idx).trim().length; // 有等号时的别名长度
        }

        return { start, end, endAlias };
    }

    // ------- b40m-svgiconify-parser-[svgicon] end
})();

/* ------- b42m-svgiconify-parser-svgicon ------- */
(() => {
    // ------- b42m-svgiconify-parser-svgicon start
    const bus = require("@gotoeasy/bus");

    // 解析单个svgicon定义，转换为对象形式方便读取
    bus.on(
        "解析svgicon",
        (function() {
            // file用于记录svgicon所在文件，便于错误提示
            return function(svgicon) {
                let alias, pkg, filter, match;
                if ((match = svgicon.match(/^\s*([\S]+)\s*=\s*([\S]+)\s*:\s*([\S]+)\s*$/))) {
                    // alias=pkg:filter
                    alias = match[1]; // alias=pkg:filter => alias
                    pkg = match[2]; // alias=pkg:filter => pkg
                    filter = match[3]; // alias=pkg:filter => filter
                } else {
                    // 无效的svgicon格式
                    return null;
                }

                return { alias, pkg, filter, svgicon: alias + "=" + pkg + ":" + filter };
            };
        })()
    );

    // ------- b42m-svgiconify-parser-svgicon end
})();

/* ------- b95p-parse-project-config ------- */
(() => {
    // ------- b95p-parse-project-config start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const File = require("@gotoeasy/file");
    const Err = require("@gotoeasy/err");

    bus.on(
        "项目配置处理",
        (function(result = {}) {
            return function(srcFile, nocahce = false) {
                let time,
                    stime = new Date().getTime();
                let btfFile = srcFile.endsWith("/rpose.config.btf") ? srcFile : bus.at("文件所在项目配置文件", srcFile);

                nocahce && delete result[btfFile];

                // 使用缓存
                if (result[btfFile]) return result[btfFile];

                // 没有配置文件时，返回默认配置信息
                if (!File.existsFile(btfFile)) {
                    let path = {};
                    let root = File.path(btfFile);
                    path.src = root + "/src";
                    path.build = root + "/" + path.build;
                    path.build_temp = path.build + "/temp";
                    path.build_dist = path.build + "/dist";
                    path.build_dist_images = "images";
                    path.svgicons = root + "/resources/svgicons";

                    let result = { oTaglibs: {}, oCsslibs: {}, oCsslibPkgs: {}, oSvgicons: {} };
                    return { path, result };
                }

                // 开始解析配置文件
                let plugins = bus.on("项目配置处理插件");
                let context = postobject(plugins).process({ file: btfFile });

                result[btfFile] = context;

                // 当前项目配置文件时，安装、检查[taglib]配置
                let env = bus.at("编译环境");
                if (env.config === btfFile) {
                    let oTaglibs = context.result.oTaglibs;
                    for (let alias in oTaglibs) {
                        let taglib = oTaglibs[alias];
                        if (!bus.at("自动安装", taglib.pkg)) {
                            throw new Err("package install failed: " + taglib.pkg, {
                                file: context.input.file,
                                text: context.input.text,
                                start: taglib.pos.start,
                                end: taglib.pos.end
                            });
                        }

                        try {
                            bus.at("标签库源文件", taglib);
                        } catch (e) {
                            throw new Err(e.message, e, {
                                file: context.input.file,
                                text: context.input.text,
                                start: taglib.pos.start,
                                end: taglib.pos.end
                            });
                        }
                    }
                }

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
                context.input = context.input || {};
                context.result = context.result || {};

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
                    let pos = object.text.pos;
                    let oNode = this.createNode({ type, value, pos });
                    node.replaceWith(oNode);
                });
            });
        })()
    );

    // 解析[path]块
    bus.on(
        "项目配置处理插件",
        (function() {
            return postobject.plugin("process-project-config-102", function(root, context) {
                let oPath = {};
                oPath.root = File.path(context.input.file);

                root.walk(
                    "path",
                    (node, object) => {
                        let lines = object.value.trim().split("\n");
                        lines.forEach(line => {
                            let bk = "=",
                                idx1 = line.indexOf("="),
                                idx2 = line.indexOf(":");
                            idx2 >= 0 && (idx1 < 0 || idx2 < idx1) && (bk = ":"); // 冒号在前则按冒号分隔
                            let v,
                                kv = line
                                    .replace(bk, "\n")
                                    .split("\n")
                                    .map(s => s.trim());
                            if (kv.length == 2 && kv[0]) {
                                v = kv[1].split("//")[0].trim(); // 去注释
                                oPath[kv[0]] = v;
                            }
                        });
                    },
                    { readonly: true }
                );

                oPath.src = oPath.root + "/src";
                oPath.build = oPath.build ? (oPath.root + "/" + oPath.build).replace(/\/\//g, "/") : oPath.root + "/build";
                oPath.build_temp = oPath.build + "/temp";
                oPath.build_dist = oPath.build + "/dist";
                !oPath.build_dist_images && (oPath.build_dist_images = "images");
                //        oPath.cache = oPath.cache;
                oPath.svgicons = oPath.root + "/" + (oPath.svgicons || "resources/svgicons"); // SVG图标文件目录

                context.path = oPath;
            });
        })()
    );

    // 建立项目样式库
    bus.on(
        "项目配置处理插件",
        (function() {
            return postobject.plugin("process-project-config-110", function(root, context) {
                let csslibs; // 保存[csslib]解析结果
                root.walk("csslib", (node, object) => {
                    csslibs = bus.at("解析[csslib]", object, context.input.file, context.input.text);
                    node.remove();
                });

                let oCsslibs = (context.result.oCsslibs = {});
                let oCsslibPkgs = (context.result.oCsslibPkgs = {});

                if (csslibs) {
                    let oCsslib;
                    for (let alias in csslibs) {
                        oCsslib = bus.at("样式库", csslibs[alias], context.input.file); // 转换为样式库对象
                        if (oCsslib.isEmpty) {
                            throw new Err("css file not found", {
                                file: context.input.file,
                                text: context.input.text,
                                start: csslibs[alias].pos.start,
                                end: csslibs[alias].pos.end
                            });
                        }

                        oCsslib.pos = { ...csslibs[alias].pos };

                        oCsslibs[alias] = oCsslib; // 存放样式库对象
                        oCsslibPkgs[alias] = oCsslib.pkg; // 存放样式库【别名-包名】映射关系（包名不一定是csslib.pkg）
                    }
                }
            });
        })()
    );

    // 默认安装内置包
    bus.on(
        "项目配置处理插件",
        (function(install) {
            return postobject.plugin("process-project-config-120", function() {
                if (!install) {
                    bus.at("自动安装", "@rpose/buildin");
                }
            });
        })()
    );

    // 建立项目标签库
    bus.on(
        "项目配置处理插件",
        (function() {
            return postobject.plugin("process-project-config-130", function(root, context) {
                let oTaglibs;
                root.walk("taglib", (node, object) => {
                    oTaglibs = bus.at("解析[taglib]", object, context.input.file); // 含格式检查、别名重复检查
                    node.remove();
                });

                context.result.oTaglibs = oTaglibs || {}; // 保存[taglib]解析结果
            });
        })()
    );

    // 保存引入的svg图标
    bus.on(
        "项目配置处理插件",
        (function() {
            return postobject.plugin("process-project-config-140", function(root, context) {
                let oSvgicons;
                root.walk("svgicon", (node, object) => {
                    oSvgicons = bus.at("解析[svgicon]", object, context); // 含格式检查、别名重复检查
                    node.remove();
                });

                context.result.oSvgicons = oSvgicons || {}; // 保存[svgicon]解析结果
            });
        })()
    );

    // ------- b95p-parse-project-config end
})();

/* ------- c00m-file-parser-rpose ------- */
(() => {
    // ------- c00m-file-parser-rpose start
    const bus = require("@gotoeasy/bus");

    // ---------------------------------------------------
    // RPOSE源文件解析
    // ---------------------------------------------------
    bus.on(
        "RPOSE源文件解析",
        (function() {
            return function(text) {
                let lines = text.split("\n"); // 行内容包含换行符
                let lineCounts = []; // 行长度包含换行符
                for (let i = 0, max = lines.length; i < max; i++) {
                    lines[i] += "\n"; // 行内容包含换行符
                    lineCounts[i] = lines[i].length; // 行长度包含换行符
                }

                let nodes = [];
                parse(nodes, lines, lineCounts);

                nodes.forEach(block => {
                    let type = "RposeBlockText";
                    if (block.buf.length) {
                        // 值
                        let lastLine = block.buf.pop();
                        let tmp = lastLine.replace(/\r?\n$/, ""); // 删除最后一行回车换行符
                        tmp && block.buf.push(tmp); // 删除最后一行回车换行符后仍有内容则加回去
                        let value = block.buf.join(""); // 无损拼接

                        // 开始位置
                        let start = sumLineCount(lineCounts, block.startLine); // 块内容开始位置（即块名行为止合计长度）
                        // 结束位置
                        let end = sumLineCount(lineCounts, block.startLine + block.buf.length - 1) + tmp.length;

                        block.text = { type, value, pos: { start, end } };
                    } else {
                        // 值
                        let value = "";
                        // 开始位置
                        let start = sumLineCount(lineCounts, block.startLine); // 块内容开始位置（即块名行为止合计长度）
                        // 结束位置
                        let end = start;

                        block.text = { type, value, pos: { start, end } };
                    }
                    delete block.buf;
                });
                return { nodes };
            };
        })()
    );

    function parse(blocks, lines, lineCounts) {
        let sLine,
            block,
            oName,
            comment,
            blockStart = false;
        for (let i = 0; i < lines.length; i++) {
            sLine = lines[i];

            if (isBlockStart(sLine)) {
                // 当前是块名行 [nnn]
                block = { type: "RposeBlock" };
                oName = getBlockName(sLine); // oName.len包含转义字符长度
                comment = sLine.substring(oName.len + 2).replace(/\r?\n$/, ""); // 块注释，忽略换行符

                let start = sumLineCount(lineCounts, i); // 开始位置信息，含左中括号
                let end = start + oName.len + 2; // 结束位置信息，含右中括号
                block.name = { type: "RposeBlockName", value: oName.name, pos: { start, end } }; // 位置包含中括号
                if (comment) {
                    start = end; // 注释的开始位置=块名的结束位置
                    end = start + comment.length;
                    block.comment = { type: "RposeBlockComment", value: comment, pos: { start, end } }; // 注释(不计换行符)
                }

                block.buf = [];
                block.startLine = i + 1; // 块内容开始行

                blocks.push(block);
                blockStart = true;
            } else if (isBlockEnd(sLine)) {
                // 当前是块结束行 ---------
                blockStart = false;
            } else if (isDocumentEnd(sLine)) {
                // 当前是文档结束行 =========
                return;
            } else {
                if (blockStart) {
                    // 当前是块内容行
                    let buf = blocks[blocks.length - 1].buf;
                    if (sLine.charAt(0) === "\\" && (/^\\+\[.*\]/.test(sLine) || /^\\+---------/.test(sLine) || /^\\+=========/.test(sLine))) {
                        buf.push(sLine.substring(1)); // 去除转义字符，拼接当前Block内容
                    } else {
                        buf.push(sLine);
                    }
                } else {
                    // 当前是注释行(比如，块结束行之后，块开始行之前)
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
                return { name, len }; // len包含转义字符长度
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

            if (/^option[-]?keys$/i.test(key)) {
                key = "optionkeys";
                value = value.split(/[,;]/).map(v => v.trim());
                rs[key] = value;
            } else if (/^state[-]?keys$/i.test(key)) {
                key = "statekeys";
                value = value.split(/[,;]/).map(v => v.trim());
                rs[key] = value;
            } else if (/^pre[-]?render$/i.test(key)) {
                key = "prerender";
                rs[key] = value;
            } else if (/^desktop[-]?first$/i.test(key)) {
                key = "desktopfirst"; // 移动优先时，min-width => max-width => min-device-width => max-device-width => other;桌面优先时，max-width => max-device-width => min-width => min-device-width => other
                rs[key] = toBoolean(value);
            } else if (/^mobile[-]?first$/i.test(key)) {
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
    const findNodeModules = require("find-node-modules");

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
        let ary = [...findNodeModules({ cwd: __dirname, relative: false }), ...findNodeModules({ relative: false })];
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

        let btf = new Btf(file);
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
    const File = require("@gotoeasy/file");
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
                plugins.push(require("postcss-discard-comments")({ remove: () => 1 })); // 删除所有注释
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

/* ------- d40m-parse-and-remove-[methods]-@action ------- */
(() => {
    // ------- d40m-parse-and-remove-[methods]-@action start
    const bus = require("@gotoeasy/bus");
    const Err = require("@gotoeasy/err");
    const parser = require("@babel/parser");
    const traverse = require("@babel/traverse").default;
    const types = require("@babel/types");
    const babel = require("@babel/core");

    const oSetBuildIn = new Set(["$vnode", "getRefElements", "getRefElement", "getRefComponents", "getRefComponent", "getRootElement"]);

    bus.on("解析检查METHODS块并删除装饰器", function(methodsCode, input = {}, PosOffset = 0) {
        let js = "class C {\n" + methodsCode + "\n}"; // 前面加10位，后面添2位
        PosOffset = PosOffset - 10; // 减去前面加的10位偏移量

        // ---------------------------------------------------------
        // 解析为语法树，支持装饰器写法
        // ---------------------------------------------------------
        let ast;
        try {
            ast = parser.parse(js, {
                sourceType: "module",
                plugins: [
                    "decorators-legacy", // 支持装饰器
                    "classProperties", // 支持类变量
                    "classPrivateProperties", // 支持类私有变量
                    "classPrivateMethods" // 支持类私有方法
                ]
            });
        } catch (e) {
            let msg = e.message || "";
            let match = msg.match(/\((\d+):(\d+)\)$/);
            if (match) {
                msg = msg.substring(0, match.index);
                let pos = getLinePosStart(js, match[1] - 1, match[2] - 0, PosOffset); // 行列号都从0开始，减0转为数字
                throw new Err(msg, e, { file: input.file, text: input.text, ...pos });
            }
            throw new Err(msg, e);
        }

        // ---------------------------------------------------------
        // 遍历语法树上的类方法，保存方法名、装饰器信息、最后删除装饰器
        // ---------------------------------------------------------
        let oClassMethod = {};
        let oClassProperty = {};
        let oClassPrivateProperty = {};
        let oClassPrivateMethod = {};
        let bindfns = [];

        traverse(ast, {
            // -----------------------------------
            // 遍历检查类属性
            ClassProperty(path) {
                if (path.node.value && path.node.value.type === "FunctionExpression") {
                    // 类属性值如果是函数，直接转换成箭头函数
                    let value = types.arrowFunctionExpression(path.node.value.params, path.node.value.body);
                    path.replaceWith(types.classProperty(path.node.key, value)); // 转成箭头函数
                    return; // 及时返回下次还来
                }

                let oItem = {};
                let oKey = path.node.key;
                oItem.Name = { value: oKey.name, ...getPos(oKey, PosOffset) }; // 方法名
                if (oClassProperty[oItem.Name.value]) {
                    // 类变量重名
                    throw new Err(`duplicate class property name (${oItem.Name.value})`, { ...input, ...oItem.Name });
                }
                oClassProperty[oItem.Name.value] = oItem.Name;

                // 属性值如果是明显的方法，也按方法看待，便于事件调用及书写事件装饰器
                if (path.node.value && path.node.value.type === "ArrowFunctionExpression") {
                    let oMethod = {};
                    oMethod.Name = { ...oItem.Name }; // 属性名作方法名

                    if (oClassMethod[oMethod.Name.value]) {
                        // 方法名重名
                        throw new Err(`duplicate method name (${oMethod.Name.value})`, { ...input, ...oMethod.Name });
                    }
                    if (oSetBuildIn.has(oMethod.Name.value)) {
                        // 不能重写内置方法
                        throw new Err(`unsupport overwrite method (${oMethod.Name.value})`, { ...input, ...oMethod.Name });
                    }
                    oClassMethod[oMethod.Name.value] = oMethod;
                    parseDecorators(path, oMethod, input, PosOffset); // 解析装饰器

                    if (path.node.value.type === "FunctionExpression") {
                        path.replaceWith(types.arrowFunctionExpression(path.node.params, path.node.body)); // 转成箭头函数
                    }
                }

                // 确保删除类属性上的全部装饰器
                delete path.node.decorators;
            },

            // -----------------------------------
            // 遍历检查私有类属性
            ClassPrivateProperty(path) {
                let oItem = {};
                let oId = path.node.key.id;
                oItem.Name = { value: oId.name, ...getPos(oId, PosOffset) }; // 方法名
                if (oClassPrivateProperty[oItem.Name.value]) {
                    // 私有类变量重名
                    throw new Err(`duplicate class private property name (#${oItem.Name.value})`, { ...input, ...oItem.Name });
                }
                if (/^#private$/.test(oItem.Name.value)) {
                    throw new Err(`unsupport defined buildin class private property name (#${oItem.Name.value})`, {
                        ...input,
                        start: oItem.Name.start - 1,
                        end: oItem.Name.end
                    });
                }
                oClassPrivateProperty[oItem.Name.value] = oItem.Name;
            },

            // -----------------------------------
            // 遍历检查私有类方法
            ClassPrivateMethod(path) {
                let oItem = {};
                let oId = path.node.key.id;
                oItem.Name = { value: "#" + oId.name, ...getPos(oId, PosOffset) }; // 方法名
                oItem.Name.start = oItem.Name.start - 1;

                if (oClassPrivateMethod[oItem.Name.value]) {
                    // 私有类方法重名
                    throw new Err(`duplicate class private method name (${oItem.Name.value})`, { ...input, ...oItem.Name });
                }
                oClassPrivateMethod[oItem.Name.value] = oItem.Name;
            },

            // -----------------------------------
            // 遍历检查类方法
            ClassMethod(path) {
                let oMethod = {};
                let oKey = path.node.key;
                oMethod.Name = { value: oKey.name, ...getPos(oKey, PosOffset) }; // 方法名

                if (oClassMethod[oMethod.Name.value]) {
                    // 方法名重名
                    throw new Err(`duplicate class method name (${oMethod.Name.value})`, { ...input, ...oMethod.Name });
                }
                if (oSetBuildIn.has(oMethod.Name.value)) {
                    // 不能重写内置方法
                    throw new Err(`unsupport overwrite class method (${oMethod.Name.value})`, { ...input, ...oMethod.Name });
                }
                oClassMethod[oMethod.Name.value] = oMethod;
                bindfns.push(oMethod.Name.value);
                parseDecorators(path, oMethod, input, PosOffset); // 解析装饰器
            }
        });

        // ---------------------------------------------------------
        // 检查未定义变量，若有则报错
        bus.at("检查未定义变量", ast, input, PosOffset);

        // ---------------------------------------------------------
        // 生成删除装饰器后的代码
        let code = babel.transformFromAstSync(ast).code;
        code = code.substring(10, code.length - 2);

        return { Method: oClassMethod, bindfns, methods: code, ast };
    });

    function parseDecorators(path, oMethod, input, PosOffset) {
        let decorators = path.node.decorators;
        if (!decorators) return;

        oMethod.decorators = []; // 装饰器对象数组

        decorators.forEach(decorator => {
            let oDecorator = {};
            oMethod.decorators.push(oDecorator);

            if (decorator.expression.type === "CallExpression") {
                // 函数调用式装饰器
                let oCallee = decorator.expression.callee;
                oDecorator.Name = { value: oCallee.name, ...getPos(oCallee, PosOffset) }; // 装饰器名

                if (!/^action$/i.test(oDecorator.Name.value)) {
                    throw new Err(`unsupport decorator (@${oDecorator.Name.value})`, {
                        ...input,
                        start: oDecorator.Name.start - 1,
                        end: oDecorator.Name.end
                    });
                }

                let i = 0;
                decorator.expression.arguments.forEach(oArg => {
                    if (i == 0) {
                        if (oArg.type === "StringLiteral") {
                            oDecorator.Event = { value: oArg.value, ...getPos(oArg, PosOffset) }; // 事件名(正常的字符串字面量写法)
                            if (!bus.at("是否HTML标准事件名", oDecorator.Event.value, true)) {
                                // 无效的事件名，事件名支持简写省略on前缀
                                throw new Err(`invalid event name (${oDecorator.Event.value}), etc. onclick/click`, {
                                    ...input,
                                    ...oDecorator.Event
                                });
                            }
                        } else {
                            // TODO 第一参数支持对象形式写法
                            throw new Err(`support literal string only, etc. @action('click', 'button')`, { ...input, ...getPos(oArg, PosOffset) });
                        }
                    } else if (i == 1) {
                        if (oArg.type === "StringLiteral") {
                            oDecorator.Selector = { value: oArg.value, ...getPos(oArg, PosOffset) }; // 选择器(正常的字符串字面量写法)
                            if (!oDecorator.Selector.value.trim()) {
                                // 无效的事件名，事件名支持简写省略on前缀
                                throw new Err(`invalid selector (empty)`, { ...input, ...oDecorator.Selector });
                            }
                        } else {
                            // TODO 第一参数支持对象形式写法
                            throw new Err(`support literal string only, etc. @action('click', 'button')`, { ...input, ...getPos(oArg, PosOffset) });
                        }
                    } else {
                        // TODO 参数
                    }

                    oDecorator.Event.value = oDecorator.Event.value.toLowerCase(); // 统一转小写
                    !/^on/.test(oDecorator.Event.value) && (oDecorator.Event.value = "on" + oDecorator.Event.value); // 左边补足‘on’

                    i++;
                });

                if (!oDecorator.Selector) {
                    // 装饰器参数不对
                    throw new Err(`invalid decorator arguments, etc. @action('click', 'button')`, { ...input, ...getPos(decorator, PosOffset) });
                }
            } else {
                // 单纯名称的装饰器
                let msg;
                if (!/^action$/i.test(decorator.expression.name)) {
                    // 装饰器名检查
                    msg = `unsupport decorator "@${decorator.expression.name}"`;
                } else {
                    // 参数遗漏
                    msg = `missing decorator arguments, etc. @action('click', 'button')`;
                }
                throw new Err(msg, { ...input, ...getPos(decorator, PosOffset) });
            }
        });

        // 删除装饰器
        delete path.node.decorators;
    }

    function getPos(oPos, offset) {
        let start = oPos.start + offset;
        let end = oPos.end + offset;
        return { start, end };
    }

    // line: 0~n
    // column: 0~n
    function getLinePosStart(js, line, column, offset) {
        let lines = js.split("\n");
        let start = offset;
        for (let i = 0; i < line; i++) {
            start += lines[i].length + 1;
        }

        let end = start + lines[line].length;
        start += column;
        return { start, end };
    }

    // ------- d40m-parse-and-remove-[methods]-@action end
})();

/* ------- d55p-normalize-component-methods ------- */
(() => {
    // ------- d55p-normalize-component-methods start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("d55p-normalize-component-methods", function(root, context) {
                let script = context.script;
                script.Method = {};

                root.walk("RposeBlock", (node, object) => {
                    if (!/^methods$/.test(object.name.value)) return;

                    let methods = object.text ? object.text.value : "";
                    if (methods) {
                        let rs = bus.at("解析检查METHODS块并删除装饰器", methods, context.input, object.text.pos.start); // 传入[methods]块中的代码，以及源文件、偏移位置
                        Object.assign(script, rs);
                    }
                    node.remove();
                    return false;
                });
            });
        })()
    );

    // ------- d55p-normalize-component-methods end
})();

/* ------- d75p-parse-component-[csslib] ------- */
(() => {
    // ------- d75p-parse-component-[csslib] start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 处理 组件配置[csslib]
            // 检查安装建立组件样式库
            return postobject.plugin("d75p-parse-component-[csslib]", function(root, context) {
                let oPrjContext = bus.at("项目配置处理", context.input.file);
                let oPrjCsslibs = oPrjContext.result.oCsslibs; // 存放项目配置的样式库对象
                let oCsslibs = (context.result.oCsslibs = context.result.oCsslibs || {}); // 存放组件配置的样式库对象
                let oCsslibPkgs = (context.result.oCsslibPkgs = context.result.oCsslibPkgs || {}); // 存放组件配置的样式库【别名-包名】映射关系

                // 遍历树中的csslib节点，建库，处理完后删除该节点
                root.walk("RposeBlock", (node, object) => {
                    if (object.name.value !== "csslib") return;
                    if (!object.text || !object.text.value || !object.text.value.trim()) return;

                    let oLibs = bus.at("解析[csslib]", object.text, context.input.file, context.input.text);

                    let csslib, oCsslib;
                    for (let alias in oLibs) {
                        csslib = oLibs[alias];

                        // 与项目配置的重复性冲突检查
                        if (oPrjCsslibs[alias]) {
                            throw new Err(
                                "duplicate csslib name: " + alias,
                                { ...oPrjContext.input, ...oPrjCsslibs[alias].pos },
                                { ...context.input, ...csslib.pos }
                            );
                        }

                        oCsslib = bus.at("样式库", csslib, context.input.file); // 转换为样式库对象
                        if (oCsslib.isEmpty) {
                            throw new Err("css file not found", {
                                file: context.input.file,
                                text: context.input.text,
                                start: csslib.pos.start,
                                end: csslib.pos.end
                            });
                        }
                        oCsslibs[alias] = oCsslib; // 存放样式库对象
                        oCsslibPkgs[alias] = oCsslib.pkg; // 存放样式库【别名-包名】映射关系（包名不一定是csslib.pkg）
                    }

                    node.remove();
                    return false;
                });
            });
        })()
    );

    // ------- d75p-parse-component-[csslib] end
})();

/* ------- d85p-parse-component-[taglib] ------- */
(() => {
    // ------- d85p-parse-component-[taglib] start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 处理 [taglib]
            // 名称重复时报错
            return postobject.plugin("d85p-parse-component-[taglib]", function(root, context) {
                let oPrjContext = bus.at("项目配置处理", context.input.file); // 项目配置解析结果
                let oPrjTaglibs = oPrjContext.result.oTaglibs; // 项目[taglib]

                // 遍历树中的taglib节点，建库，处理完后删除该节点
                root.walk("RposeBlock", (node, object) => {
                    if (object.name.value !== "taglib") return;

                    let oTaglibs = bus.at("解析[taglib]", object.text, context.input.file);

                    // 安装、检查标签库定义
                    let taglib;
                    for (let alias in oTaglibs) {
                        taglib = oTaglibs[alias];
                        // 与项目配置的重复性冲突检查
                        if (oPrjTaglibs[alias]) {
                            throw new Err("duplicate taglib alias: " + alias, {
                                file: context.input.file,
                                text: context.input.text,
                                start: taglib.pos.start,
                                end: taglib.pos.end
                            });
                        }

                        if (!bus.at("自动安装", taglib.pkg)) {
                            throw new Err("package install failed: " + taglib.pkg, {
                                file: context.input.file,
                                text: context.input.text,
                                start: taglib.pos.start,
                                end: taglib.pos.end
                            });
                        }

                        try {
                            bus.at("标签库源文件", taglib);
                        } catch (e) {
                            throw new Err(e.message, e, {
                                file: context.input.file,
                                text: context.input.text,
                                start: taglib.pos.start,
                                end: taglib.pos.end
                            });
                        }
                    }

                    context.result.oTaglibs = oTaglibs;

                    node.remove();
                    return false;
                });
            });
        })()
    );

    // ------- d85p-parse-component-[taglib] end
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

/* ------- e10m-view-src-reader ------- */
(() => {
    // ------- e10m-view-src-reader start
    const bus = require("@gotoeasy/bus");

    const SOF = "\ufff0"; // HTML解析：开始符
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
    const Err = require("@gotoeasy/err");

    // 自闭合标签
    const SELF_CLOSE_TAGS = "br,hr,input,img,meta,link,area,base,basefont,bgsound,col,command,isindex,frame,embed,keygen,menuitem,nextid,param,source,track,wbr".split(
        ","
    );

    // TODO 未转义字符引起的解析错误，友好提示

    // \{ = '\ufff0\ufff1', \} = '\ufffe\uffff'
    function escape(str) {
        return str == null
            ? null
            : str
                  .replace(/\\\\/g, "\ufff2\ufff2")
                  .replace(/\\{/g, "\ufff0\ufff1")
                  .replace(/\\}/g, "\ufffe\uffff");
    }
    function unescape(str) {
        return str == null
            ? null
            : str
                  .replace(/\ufff2\ufff2/g, "\\\\")
                  .replace(/\ufff0\ufff1/g, "{")
                  .replace(/\ufffe\uffff/g, "}");
    }

    function offsetPos(oPos, PosOffset) {
        if (oPos) {
            oPos.start != null && (oPos.start += PosOffset);
            oPos.end != null && (oPos.end += PosOffset);
        }
        return oPos;
    }

    function TokenParser(file, fileText, viewText, PosOffset) {
        let src = escape(viewText); // 不含[view]的块内容
        // ------------ 变量 ------------
        let options = bus.at("视图编译选项");
        let reader = bus.at("字符阅读器", src);
        let tokens = [];

        // ------------ 接口方法 ------------
        // 解析
        this.parse = function() {
            while (parseNode() || parseComment() || parseCdata() || parseCodeBlock() || parseExpression() || parseHighlight() || parseText()) {
                // 无内容
            }

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

                    token = { type: options.TypeTagClose, value: tagNm.trim(), pos: offsetPos(oPos, PosOffset) }; // Token: 闭合标签
                    tokens.push(token);
                    return 1;
                }
            }

            // -------- 标签开始 --------
            // 简单检查格式
            if (reader.getCurrentChar() === "<" && src.indexOf(">", pos + 2) < 0) {
                return 0; // 当前不是节点开始(起始【<】，但后面没有【>】)
            }

            if (/[\s<>/\\]/i.test(reader.getNextChar())) {
                // 标签名需要特殊限制时需相应修改
                return 0; // 当前不是节点开始(紧接【<】的不能是空白、小于号、大于号、斜杠、反斜杠)
            }

            // 节点名
            oPos = {};
            oPos.start = PosOffset + reader.getPos();
            reader.skip(1); // 跳过起始【<】
            while (/[^\s/>]/.test(reader.getCurrentChar())) {
                tagNm += reader.readChar(); // 非空白都按名称处理
            }

            let tokenTagNm = { type: "", value: unescape(tagNm), pos: oPos }; // Token: 标签 (类型待后续解析更新，偏移位置自行计算)
            tokens.push(tokenTagNm);

            // 全部属性
            while (parseAttr()) {
                // 无内容
            }

            // 跳过空白
            reader.skipBlank();

            // 检查标签结束符
            if (reader.getNextString(2) === "/>") {
                // 无内容的自闭合标签，如<one-tag/>
                tokenTagNm.type = options.TypeTagSelfClose; // 更新 Token: 标签
                reader.skip(2); // 跳过【/>】
                oPos.end = PosOffset + reader.getPos();
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
                oPos.end = PosOffset + reader.getPos();
                return 1;
            }

            // 前面已检查，不应该走到这里.......
            throw new Err('tag missing ">"', "file=" + file, { text: fileText, pos: oPos }); // 已计算好偏移
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
                while (/[^\s=/>]/.test(reader.getCurrentChar())) {
                    key += reader.readChar(); // 只要不是【空白、等号、斜杠、大于号】就算属性名
                }
                if (!key) return 0;
            }

            oPos.end = reader.getPos();

            let token = { type: options.TypeAttributeName, value: unescape(key), pos: offsetPos(oPos, PosOffset) }; // Token: 属性名
            tokens.push(token);

            // 跳过空白
            reader.skipBlank();
            oPos = {};
            oPos.start = reader.getPos();

            if (reader.getCurrentChar() === "=") {
                let PosEqual = PosOffset + reader.getPos();
                reader.skip(1); // 跳过等号
                oPos.end = reader.getPos();

                token = { type: options.TypeEqual, value: "=", pos: offsetPos(oPos, PosOffset) }; // Token: 属性等号
                tokens.push(token);

                // --------- 键值属性 ---------
                reader.skipBlank(); // 跳过等号右边空白
                oPos = {};

                if (reader.getCurrentChar() === '"') {
                    // 值由双引号包围
                    reader.skip(1); // 跳过左双引号
                    oPos.start = reader.getPos();
                    while (!reader.eof() && (reader.getCurrentChar() !== '"' || reader.getPrevChar() === "\\")) {
                        let ch = reader.readChar();
                        if (reader.getPrevString(2) === '\\"') {
                            val = val.substring(0, val.length - 1) + ch; // 双引号转义
                        } else {
                            val += ch; // 其他只要不是【"】就算属性值
                        }

                        if ((ch === "=" || ch === ">") && val.indexOf("\n") > 0 && val.indexOf("{") < 0) {
                            // 遇到等号或标签结束符，且当前的属性值不可能是表达式，且属性值已含换行，基本上是错了
                            throw new Err('invalid attribute value format (missing right ")', { file, text: fileText, start: PosEqual });
                        }
                    }

                    if (reader.eof() || reader.getCurrentChar() !== '"') {
                        // 属性值漏一个双引号，如<tag aaa=" />
                        throw new Err('invalid attribute value format (missing right ")', { file, text: fileText, start: PosEqual });
                    }

                    oPos.end = reader.getPos();
                    reader.skip(1); // 跳过右双引号

                    val = val.replace(/\ufff2\ufff2/g, "\\"); // 俩反斜杠属于转义，转换为单个反斜杠
                    token = { type: options.TypeAttributeValue, value: unescape(val), pos: offsetPos(oPos, PosOffset) }; // Token: 属性值(属性值中包含表达式组合的情况，在syntax-ast-gen中处理)
                    tokens.push(token);
                } else if (reader.getCurrentChar() === "'") {
                    // 值由单引号包围
                    reader.skip(1); // 跳过左单引号
                    oPos.start = reader.getPos();
                    while (!reader.eof() && (reader.getCurrentChar() !== "'" || reader.getPrevChar() === "\\")) {
                        let ch = reader.readChar();
                        if (reader.getPrevString(2) === "\\'") {
                            val = val.substring(0, val.length - 1) + ch; // 单引号转义
                        } else {
                            val += ch; // 其他只要不是【'】就算属性值
                        }

                        if ((ch === "=" || ch === ">") && val.indexOf("\n") > 0 && val.indexOf("{") < 0) {
                            // 遇到等号或标签结束符，且当前的属性值不可能是表达式，且属性值已含换行，基本上是错了
                            throw new Err("invalid attribute value format (missing right ')", { file, text: fileText, start: PosEqual });
                        }
                    }

                    if (reader.eof() || reader.getCurrentChar() !== "'") {
                        // 属性值漏一个单引号，如<tag aaa=' />
                        throw new Err("invalid attribute value format (missing right ')", { file, text: fileText, start: PosEqual });
                    }

                    oPos.end = reader.getPos();
                    reader.skip(1); // 跳过右单引号

                    val = val.replace(/\ufff2\ufff2/g, "\\"); // 俩反斜杠属于转义，转换为单个反斜杠
                    token = { type: options.TypeAttributeValue, value: unescape(val), pos: offsetPos(oPos, PosOffset) }; // Token: 属性值(属性值中包含表达式组合的情况，在syntax-ast-gen中处理)
                    tokens.push(token);
                } else if (reader.getCurrentChar() === "{") {
                    // 值省略引号包围
                    let stack = [];
                    oPos.start = reader.getPos();
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
                        throw new Err("invalid attribute value format (missing right })", { file, text: fileText, start: PosEqual });
                    }
                    oPos.end = reader.getPos();
                    token = { type: options.TypeAttributeValue, value: unescape(val), pos: offsetPos(oPos, PosOffset) }; // Token: 属性值
                    tokens.push(token);
                } else {
                    // 值应该是单纯数值或true/false
                    oPos.start = reader.getPos();
                    while (/[^\s/>]/.test(reader.getCurrentChar())) {
                        val += reader.readChar(); // 连续可见字符就放进去
                    }
                    oPos.end = reader.getPos();

                    if (!val) {
                        // 属性值漏，如<tag aaa= />
                        throw new Err("missing attribute value", { file, text: fileText, start: PosEqual });
                    }
                    if (!/^(\d+|\d+\.?\d+|true|false)$/.test(val)) {
                        // 属性值不带引号或大括号，应该是单纯数值或true/false，如果不是则报错，如<tag aaa=00xxx  />
                        throw new Err("invalid attribute value", { file, text: fileText, pos: offsetPos(oPos, PosOffset) });
                    }

                    token = { type: options.TypeAttributeValue, value: val - 0, pos: offsetPos(oPos, PosOffset) }; // Token: 属性值
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
                token = { type: options.TypeHtmlComment, value: unescape(src.substring(pos + 4, idxEnd)), pos: offsetPos(oPos, PosOffset) }; // Token: HTML注释
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

                if (!/\{[\s\S]*?}/.test(value)) {
                    // 不含表达式
                    token = { type: options.TypeText, value, pos: offsetPos(oPos, PosOffset) }; // Token: 无表达式的文本
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
                            token = { type: options.TypeText, value: txt, pos: offsetPos(oPosTxt, PosOffset) }; // Token: 无表达式的文本
                            tokens.push(token);
                        }

                        txt = unescape(value.substring(idx1, idx2 + 1));
                        oPosTxt = { start: iStart, end: iStart + txt.length };
                        iStart = oPosTxt.end;
                        token = { type: options.TypeExpression, value: txt, pos: offsetPos(oPosTxt, PosOffset) }; // Token: 表达式文本
                        tokens.push(token);
                        value = value.substring(idx2 + 1);
                    }
                    if (value) {
                        txt = unescape(value);
                        oPosTxt = { start: iStart, end: iStart + txt.length };
                        iStart = oPosTxt.end;
                        token = { type: options.TypeText, value: txt, pos: offsetPos(oPosTxt, PosOffset) }; // Token: 无表达式的文本
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
            let token;
            start = pos;
            end = pos + len;
            token = { type: options.TypeTagSelfClose, value: "```", pos: offsetPos({ start, end }, PosOffset) }; // Token: 代码标签
            tokens.push(token);

            // 【Token】 lang
            let match = rs[1].match(/\b\w*\b/); // 语言（开始行中的单词，可选）
            let lang = match ? match[0].toLowerCase() : "";
            if (lang) {
                start = pos + match.index;
                end = start + lang.length;
                token = { type: options.TypeAttributeName, value: "lang", pos: offsetPos({ start, end }, PosOffset) };
                tokens.push(token);
                token = { type: options.TypeEqual, value: "=", pos: offsetPos({ start, end }, PosOffset) };
                tokens.push(token);
                token = { type: options.TypeAttributeValue, value: unescape(lang), pos: offsetPos({ start, end }, PosOffset) };
                tokens.push(token);
            }

            // 【Token】 height
            match = rs[1].match(/\b\d+(%|px)/i); // 带单位（%或px）的高度
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
                token = { type: options.TypeAttributeName, value: "height", pos: offsetPos({ start, end }, PosOffset) };
                tokens.push(token);
                token = { type: options.TypeEqual, value: "=", pos: offsetPos({ start, end }, PosOffset) };
                tokens.push(token);
                height = /^\d+$/.test(height) ? height + "px" : height; // 默认单位px
                token = { type: options.TypeAttributeValue, value: height, pos: offsetPos({ start, end }, PosOffset) };
                tokens.push(token);
            }

            // 【Token】 ref                                         // ???? TODO ...............................
            match = rs[1].match(/\bref\s?=\s?"([\s\S]*?)"/i);
            let ref = match && match[0] ? match[0] : "";
            if (ref) {
                token = { type: options.TypeAttributeName, value: "ref", pos: offsetPos({ start, end }, PosOffset) };
                tokens.push(token);
                token = { type: options.TypeEqual, value: "=", pos: offsetPos({ start, end }, PosOffset) };
                tokens.push(token);
                token = { type: options.TypeAttributeValue, value: unescape(ref), pos: offsetPos({ start, end }, PosOffset) };
                tokens.push(token);
            }

            // 【Token】 $CODE
            let $CODE = rs[2].replace(/\ufff0\ufff1/g, "\\{").replace(/\ufffe\uffff/g, "\\}"); // 转义，确保值为原输入
            $CODE = $CODE.replace(/\n\\+```/g, match => "\n" + match.substring(2)); // 删除一个转义斜杠     \n\``` => \n``` ，  \n\\``` => \n\```
            /^\\+```/.test($CODE) && ($CODE = $CODE.substring(1)); // 删除一个转义斜杠     \``` => ``` ，  \\``` => \```

            // 属性值中的大括号会被当做表达式字符解析，需要转义掉
            $CODE = $CODE.replace(/\{/g, "\\{").replace(/\}/g, "\\}");

            start = pos + rs[1].length;
            end = start + rs[2].length;
            token = { type: options.TypeAttributeName, value: "$CODE", pos: offsetPos({ start, end }, PosOffset) };
            tokens.push(token);
            token = { type: options.TypeEqual, value: "=", pos: offsetPos({ start, end }, PosOffset) };
            tokens.push(token);
            token = { type: options.TypeAttributeValue, value: $CODE, pos: offsetPos({ start, end }, PosOffset) };
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
                token = {
                    type: options.TypeCodeBlock,
                    value: unescape(src.substring(pos + options.CodeBlockStart.length, idxEnd)),
                    pos: offsetPos(oPos, PosOffset)
                }; // Token: 代码块
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
                token = { type: options.TypeText, value: unescape(text), pos: offsetPos(oPos, PosOffset) }; // Token: 文本
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
                token.pos = offsetPos(oPos, PosOffset);
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

    bus.on("视图TOKEN解析器", function(file, fileText, srcView, PosOffset = 0) {
        return new TokenParser(file, fileText, srcView, PosOffset);
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

                    let tokenParser = bus.at("视图TOKEN解析器", context.input.file, context.input.text, view, object.text.pos.start);
                    let type = "View";
                    let src = view;
                    let pos = object.text.pos;
                    let nodes = tokenParser.parse();
                    let objToken = { type, src, pos, nodes };

                    let nodeToken = this.createNode(objToken);
                    node.replaceWith(nodeToken);
                });
            });
        })()
    );

    // ------- e15p-parse-view-tokens-to-ast end
})();

/* ------- e25p-ast-normalize-group-attribute ------- */
(() => {
    // ------- e25p-ast-normalize-group-attribute start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 合并属性到新的Attributes节点
            // 属性值Attribute节点的数据对象中，添加 isExpresstion 标记
            return postobject.plugin("e25p-ast-normalize-group-attribute", function(root, context) {
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
                            throw new Err("unsupport expression on attribute name", { ...context.input, ...object.pos });
                        }

                        if (/^\s*\{\s*\}\s*$/.test(valNode.object.value)) {
                            // 属性值的表达式不能为空白
                            throw new Err("invalid empty expression", { ...context.input, ...valNode.object.pos });
                        }

                        let Name = { pos: object.pos };
                        let Value = { pos: valNode.object.pos };
                        let pos = { start: object.pos.start, end: valNode.object.pos.end };
                        let oAttr = {
                            type: "Attribute",
                            name: object.value,
                            value: valNode.object.value,
                            Name,
                            Value,
                            isExpression: bus.at("是否表达式", valNode.object.value),
                            pos
                        };
                        let attrNode = this.createNode(oAttr);
                        node.replaceWith(attrNode);
                        eqNode.remove();
                        valNode.remove();
                    } else {
                        // 单一键节点
                        let oAttr = { type: "Attribute", name: object.value, value: true, isExpression: false, pos: object.pos };
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
                root.walk("Attribute", node => {
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

    // ------- e25p-ast-normalize-group-attribute end
})();

/* ------- e35p-ast-normolize-tag-of-self-close ------- */
(() => {
    // ------- e35p-ast-normolize-tag-of-self-close start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            // 自关闭标签统一转换为Tag类型节点
            return postobject.plugin("e35p-ast-normolize-tag-of-self-close", function(root) {
                const OPTS = bus.at("视图编译选项");

                root.walk(OPTS.TypeTagSelfClose, (node, object) => {
                    let type = "Tag";
                    let value = object.value;
                    let pos = object.pos;
                    let tagNode = this.createNode({ type, value, pos });

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

    // ------- e35p-ast-normolize-tag-of-self-close end
})();

/* ------- e45p-ast-normolize-tag-of-open-close ------- */
(() => {
    // ------- e45p-ast-normolize-tag-of-open-close start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 开闭标签统一转换为Tag类型节点
            return postobject.plugin("e45p-ast-normolize-tag-of-open-close", function(root, context) {
                const OPTS = bus.at("视图编译选项");

                let normolizeTagNode = (tagNode, nodeTagOpen) => {
                    let nextNode = nodeTagOpen.after();
                    while (nextNode && nextNode.type !== OPTS.TypeTagClose) {
                        if (nextNode.type === OPTS.TypeTagOpen) {
                            let type = "Tag";
                            let value = nextNode.object.value;
                            let pos = nextNode.object.pos;
                            let subTagNode = this.createNode({ type, value, pos });
                            normolizeTagNode(subTagNode, nextNode);

                            tagNode.addChild(subTagNode);
                        } else {
                            tagNode.addChild(nextNode.clone());
                        }

                        nextNode.remove();
                        nextNode = nodeTagOpen.after();
                    }

                    if (!nextNode) {
                        throw new Err("missing close tag", { ...context.input, start: tagNode.object.pos.start });
                    }

                    if (nextNode.type === OPTS.TypeTagClose) {
                        if (nodeTagOpen.object.value !== nextNode.object.value) {
                            throw new Err(`unmatch close tag: ${nodeTagOpen.object.value}/${nextNode.object.value}`, {
                                ...context.input,
                                ...tagNode.object.pos
                            });
                        }
                        tagNode.object.pos.end = nextNode.object.pos.end;
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
                    let pos = object.pos;
                    let tagNode = this.createNode({ type, value, pos });
                    normolizeTagNode(tagNode, node);

                    node.replaceWith(tagNode);
                });
            });
        })()
    );

    // ------- e45p-ast-normolize-tag-of-open-close end
})();

/* ------- e55p-ast-normolize-tag-name-tolowercase ------- */
(() => {
    // ------- e55p-ast-normolize-tag-name-tolowercase start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            // 标签名统一小写
            return postobject.plugin("e55p-ast-normolize-tag-name-tolowercase", function(root) {
                root.walk("Tag", (node, object) => {
                    object.value = object.value.toLowerCase();
                });
            });
        })()
    );

    // ------- e55p-ast-normolize-tag-name-tolowercase end
})();

/* ------- e65p-ast-auto-bind-event-by-decorator-@action ------- */
(() => {
    // ------- e65p-ast-auto-bind-event-by-decorator-@action start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 根据装饰器@action设定，自动绑定事件（添加事件属性）
            return postobject.plugin("e65p-ast-auto-bind-event-by-decorator-@action", function(root, context) {
                let fnCreateNode = data => this.createNode(data); // 创建AST节点

                let oMethods = context.script.Method; // 方法对象（方法名: {Name, decorators[{Name,Event,Selector}]}）
                let oMethod, decorators;
                for (let method in oMethods) {
                    oMethod = oMethods[method];
                    decorators = oMethod.decorators;
                    if (!decorators || !decorators.length) continue;

                    for (let i = 0, oDecorator, oSetNodes; (oDecorator = decorators[i++]); ) {
                        oSetNodes = queryNodesBySelector(root, oDecorator.Selector.value); // 按标签名查找标签，形同样式选择器，仅编译期在组件范围内查找
                        if (!oSetNodes.size) {
                            // 按选择器找不到标签
                            throw new Err(`tag not found by the selector (${oDecorator.Selector.value})`, {
                                ...context.input,
                                ...oDecorator.Selector
                            });
                        }
                        bindEventHandle(oMethod, oDecorator, oSetNodes, fnCreateNode);
                    }
                }
            });
        })()
    );

    function bindEventHandle(oMethod, oDecorator, oSetNodes, fnCreateNode) {
        oSetNodes.forEach(tagNode => {
            // 查找/创建事件组节点
            let eventsNode = getEventsNode(tagNode);
            if (!eventsNode) {
                eventsNode = fnCreateNode({ type: "Events" });
                tagNode.addChild(eventsNode);
            }

            // 创建事件节点
            let type = "Event";
            let name = oDecorator.Event.value; // 事件名，如： onclick
            let Name = { pos: { start: oDecorator.Event.start, end: oDecorator.Event.end } };
            let value = "this." + oMethod.Name.value; // 方法名，如： fnClick
            let Value = { pos: { start: oMethod.Name.start, end: oMethod.Name.end } };
            let isExpression = false;
            let pos = { start: oMethod.Name.start, end: oMethod.Name.end };
            let eventNode = fnCreateNode({ type, name, Name, value, Value, isExpression, pos });

            // 添加事件节点
            eventsNode.addChild(eventNode);
        });
    }

    function getEventsNode(tagNode) {
        let nodes = tagNode.nodes || [];
        for (let i = 0, node; (node = nodes[i++]); ) {
            if (node.type === "Events") {
                return node;
            }
        }
    }

    // -----------------------------------------------
    // 在组件的[view]中按标签名查找匹配的标签
    // 同样式的标签名选择器语法，大于号指子标签，空格指子孙标签，通配符*代表任意标签
    function queryNodesBySelector(root, selector) {
        let selectors = parseSelector(selector);
        if (!selectors.length) return new Set(); // 无选择器

        let firstSel = selectors.splice(0, 1)[0];
        let oSetNodes = new Set(queryNodesByTypeSelector(root, 0, firstSel.selector)); // 第一个选择器特殊，要单独查询
        if (!selectors.length) return oSetNodes; // 单一选择器

        // 循环查找过滤
        selectors.forEach(oSel => {
            let oSet = new Set();
            oSetNodes.forEach(node => {
                let ary = queryNodesByTypeSelector(node, oSel.type, oSel.selector);
                ary.forEach(nd => oSet.add(nd));
            });
            oSetNodes = oSet; // 过滤
        });

        return oSetNodes;
    }

    // 在[view]中按标签名查找匹配的全部标签
    function queryNodesByTypeSelector(node, type, selector) {
        let nodes = [];
        if (type === 1) {
            // 仅比较子标签节点
            node.nodes &&
                node.nodes.forEach(nd => {
                    if (nd.type === "Tag" && (nd.object.value === selector || selector === "*")) {
                        nodes.push(nd);
                    }
                });
        } else {
            // 比较子孙标签节点
            node.walk("Tag", (nd, obj) => {
                if (obj.value === selector || selector === "*") {
                    nodes.push(nd);
                }
            });
        }
        return nodes;
    }

    // button => [{type: 0, selector: 'button'}]
    // div * A > button => [{type: 0, selector: 'div'}, {type: 2, selector: '*'}, {type: 2, selector: 'div'}, {type: 1, selector: 'div'}
    function parseSelector(selector) {
        let ary = [];
        selector
            .trim()
            .toLowerCase()
            .split(/\s*>\s*/)
            .forEach(childSel => {
                let subs = childSel.split(/\s+/);
                for (let i = 0, sel; (sel = subs[i++]); ) {
                    ary.push({ type: i > 1 ? 2 : 1, selector: sel });
                }
            });

        ary[0].type = 0; // 第一个特殊，固定type=0
        return ary;
    }

    // ------- e65p-ast-auto-bind-event-by-decorator-@action end
})();

/* ------- f10m-highlight-file-parser-btf ------- */
(() => {
    // ------- f10m-highlight-file-parser-btf start
    const bus = require("@gotoeasy/bus");

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

    // ------- f10m-highlight-file-parser-btf end
})();

/* ------- f12m-highlight-$code-of-``` ------- */
(() => {
    // ------- f12m-highlight-$code-of-``` start
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

    // ------- f12m-highlight-$code-of-``` end
})();

/* ------- f15p-highlight-astedit-transform-tag-``` ------- */
(() => {
    // ------- f15p-highlight-astedit-transform-tag-``` start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            // 给```节点添加@taglib指令
            return postobject.plugin("f15p-highlight-astedit-transform-tag-```", function(root) {
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
                    let pos = Object.assign({}, object.pos);
                    pos.end += 3;
                    taglibNode.object.pos = pos;
                    attrsNode.addChild(taglibNode);
                });
            });
        })()
    );

    // ------- f15p-highlight-astedit-transform-tag-``` end
})();

/* ------- f20m-svgicon-project-svg-icon-files ------- */
(() => {
    // ------- f20m-svgicon-project-svg-icon-files start
    const bus = require("@gotoeasy/bus");
    const File = require("@gotoeasy/file");

    (function() {
        bus.on("项目SVG图标文件列表", function(file) {
            let files = [];

            let prjCtx = bus.at("项目配置处理", file);
            let svgfiles = File.files(prjCtx.path.svgicons, "**.svg");

            // 图标目录
            let map = new Map();
            for (let i = 0, file, name, oFile; (file = svgfiles[i++]); ) {
                name = File.name(file).toLowerCase();
                if (map.has(name)) {
                    // 图标文件名重复（会导致不能按文件名显示确定的图标，应避免）
                    throw new Error(`duplicate svg icon name (${name})\n  ${map.get(name).file}\n  ${file}`);
                }

                oFile = { name, file };
                map.set(name, oFile);
                files.push(oFile);
            }

            // 图标配置
            let names = Object.keys(prjCtx.result.oSvgicons); // names本身没有重复名称，项目配置解析时已经检查
            for (let i = 0, name, oSvgicon, oFile; (name = names[i++]); ) {
                oSvgicon = prjCtx.result.oSvgicons[name];
                if (map.has(name)) {
                    // 图标名重复（会导致不能按图标名显示确定的图标，应避免）
                    throw new Error(`duplicate svg icon name (${name})\n  ${map.get(name).file}\n  ${oSvgicon.svgicon}`, {
                        ...prjCtx.input,
                        start: oSvgicon.pos.start,
                        end: oSvgicon.pos.endAlias
                    });
                }

                oFile = { name, file: oSvgicon.file };
                map.set(name, oFile);
                files.push(oFile);
            }

            // 结果
            return { files, pkg: bus.at("文件所在模块", file) };
        });
    })();

    // ------- f20m-svgicon-project-svg-icon-files end
})();

/* ------- f21m-svgicon-parse-svg-content-to-ast-nodes ------- */
(() => {
    // ------- f21m-svgicon-parse-svg-content-to-ast-nodes start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    const File = require("@gotoeasy/file");

    bus.on(
        "SVG图标内容解析为AST节点数组",
        (function() {
            return function(file, text, attrs, pos) {
                // TODO 缓存
                let plugins = bus.on("SVG图标内容解析插件");
                let rs = postobject(plugins).process({ file, text, attrs, pos });

                return rs.result;
            };
        })()
    );

    // ------------------------------------------------------
    // 解析svg图标源码内容，转换为节点数组
    //
    // 以下插件顺序相关，不可轻易变动
    //
    // ------------------------------------------------------
    bus.on(
        "SVG图标内容解析插件",
        (function() {
            return postobject.plugin("svgicon-plugin-01", function(root, context) {
                // 读取解析svg内容转换为Token节点树
                root.walk((node, object) => {
                    let file = object.file;
                    let attrs = object.attrs; // 自定义的svg属性
                    let pos = object.pos;
                    let text = object.text || File.read(object.file);

                    // 不支持大于50K的svg图标文件
                    if (text.length > 50 * 1024) {
                        throw new Error(`unsupport svg icon file (size>100K) [${file}]`);
                    }
                    // 不支持图标字体文件
                    if (text.indexOf("<font-face") > 0) {
                        throw new Error(`unsupport webfonts svg file [${file}]`);
                    }

                    // <?xml version="1.0" encoding="utf-8"?>
                    // 通常不该引用含xml声明头的原始xml文件，以防万一，简单删除之
                    if (/^<\?xml\s/i.test(text)) {
                        let idx = text.indexOf("?>");
                        text = text.substring(idx + 2);
                    }

                    context.input = { file, text, attrs, pos };

                    // 像[view]一样解析为Token
                    let tokenParser = bus.at("视图TOKEN解析器", file, text, text, 0);
                    let type = "Svgicon";
                    let nodes = tokenParser.parse();
                    let objToken = { type, nodes };
                    let newNode = this.createNode(objToken);

                    node.replaceWith(...newNode.nodes); // 转换为Token节点树
                });
            });
        })()
    );

    bus.on(
        "SVG图标内容解析插件",
        (function() {
            return postobject.plugin("svgicon-plugin-02", function(root, context) {
                // 键=值的三个节点，以及单一键节点，统一转换为一个属性节点
                const OPTS = bus.at("视图编译选项");
                root.walk(OPTS.TypeAttributeName, (node, object) => {
                    if (!node.parent) return;

                    let eqNode = node.after();
                    if (eqNode && eqNode.type === OPTS.TypeEqual) {
                        // 键=值的三个节点
                        let valNode = eqNode.after();
                        let Name = { pos: object.pos };
                        let Value = { pos: valNode.object.pos };
                        let pos = { start: object.pos.start, end: valNode.object.pos.end };

                        let oAttr = { type: "Attribute", name: object.value, value: valNode.object.value, Name, Value, isExpression: false, pos };
                        let attrNode = this.createNode(oAttr);
                        node.replaceWith(attrNode);
                        eqNode.remove();
                        valNode.remove();
                    } else {
                        // 单一键节点（应该没有...）
                        let oAttr = { type: "Attribute", name: object.value, value: true, isExpression: false, pos: context.input.pos };
                        let attrNode = this.createNode(oAttr);
                        node.replaceWith(attrNode);
                    }
                });
            });
        })()
    );

    bus.on(
        "SVG图标内容解析插件",
        (function() {
            return postobject.plugin("svgicon-plugin-03", function(root) {
                // 多个属性节点合并为一个标签属性节点
                root.walk("Attribute", node => {
                    if (!node.parent) return;

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

    bus.on(
        "SVG图标内容解析插件",
        (function() {
            // 自关闭标签统一转换为Tag类型节点
            return postobject.plugin("svgicon-plugin-04", function(root, context) {
                const OPTS = bus.at("视图编译选项");

                root.walk(OPTS.TypeTagSelfClose, (node, object) => {
                    if (!node.parent) return;

                    let type = "Tag";
                    let value = object.value;
                    let pos = context.input.pos;
                    let tagNode = this.createNode({ type, value, pos });

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

    bus.on(
        "SVG图标内容解析插件",
        (function() {
            // 开闭标签统一转换为Tag类型节点
            return postobject.plugin("svgicon-plugin-05", function(root, context) {
                const OPTS = bus.at("视图编译选项");

                let normolizeTagNode = (tagNode, nodeTagOpen) => {
                    let nextNode = nodeTagOpen.after();
                    while (nextNode && nextNode.type !== OPTS.TypeTagClose) {
                        if (nextNode.type === OPTS.TypeTagOpen) {
                            let type = "Tag";
                            let value = nextNode.object.value;
                            let pos = nextNode.object.pos;
                            let subTagNode = this.createNode({ type, value, pos });
                            normolizeTagNode(subTagNode, nextNode);

                            tagNode.addChild(subTagNode);
                        } else {
                            tagNode.addChild(nextNode.clone());
                        }

                        nextNode.remove();
                        nextNode = nodeTagOpen.after();
                    }

                    if (!nextNode) {
                        throw new Err("missing close tag", { ...context.input, start: tagNode.object.pos.start });
                    }

                    if (nextNode.type === OPTS.TypeTagClose) {
                        if (nodeTagOpen.object.value !== nextNode.object.value) {
                            throw new Err(`unmatch close tag: ${nodeTagOpen.object.value}/${nextNode.object.value}`, {
                                ...context.input,
                                ...tagNode.object.pos
                            });
                        }
                        tagNode.object.pos.end = nextNode.object.pos.end;
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
                    let pos = object.pos;
                    let tagNode = this.createNode({ type, value, pos });
                    normolizeTagNode(tagNode, node);

                    node.replaceWith(tagNode);
                });

                context.result = root.nodes[0];
            });
        })()
    );

    bus.on(
        "SVG图标内容解析插件",
        (function() {
            // 删除<svg>同级的其他非代码块节点 （注释、文本等）
            return postobject.plugin("svgicon-plugin-11", function(root) {
                root.walk("Tag", (node, object) => {
                    if (!/^svg$/i.test(object.value)) return;

                    let nodes = [...node.parent.nodes];
                    nodes.forEach(n => {
                        if (
                            (n.type === "Tag" && !/^(svg|if|for|router|router-link)$/i.test(n.object.value)) ||
                            n.type === "HtmlComment" ||
                            n.type === "Text"
                        ) {
                            n.remove();
                        }
                    });
                });
            });
        })()
    );

    bus.on(
        "SVG图标内容解析插件",
        (function() {
            // 没有viewBox时，按width、height计算后插入viewBox属性 （如果width或height也没设定，那就不管了，设定的单位不是px也不管了）
            return postobject.plugin("svgicon-plugin-12", function(root) {
                root.walk("Attributes", node => {
                    if (!node.parent || node.parent.type !== "Tag" || node.parent.object.value !== "svg") return;

                    // 没有viewBox时，按width、height计算后插入viewBox属性 （如果width或height也没设定，那就不管了）
                    let ndWidth, ndHeight, ndViewBox;
                    node.nodes.forEach(nd => {
                        /^width$/i.test(nd.object.name) && (ndWidth = nd);
                        /^height$/i.test(nd.object.name) && (ndHeight = nd);
                        /^viewbox$/i.test(nd.object.name) && (ndViewBox = nd);
                    });

                    if (!ndViewBox && ndWidth && ndHeight && /^\d+(px)?$/i.test(ndWidth.object.value) && /^\d+(px)?$/i.test(ndHeight.object.value)) {
                        ndViewBox = ndWidth.clone();
                        ndViewBox.object.name = "viewBox";
                        ndViewBox.object.value = `0 0 ${parseInt(ndWidth.object.value)} ${parseInt(ndHeight.object.value)}`;
                        node.addChild(ndViewBox); // 插入 viewBox 属性
                    }
                });
            });
        })()
    );

    bus.on(
        "SVG图标内容解析插件",
        (function() {
            // 删除svg标签中一些要忽略的属性，同时用svgicon标签中的自定义属性覆盖(viewBox不覆盖)，达到像直接写svg属性一样的效果
            return postobject.plugin("svgicon-plugin-13", function(root, context) {
                root.walk("Attributes", node => {
                    if (!node.parent || node.parent.type !== "Tag" || node.parent.object.value !== "svg") return;

                    let svgAttrs = {}; // 保存svg属性
                    // 过滤svg属性保存后删除
                    node.walk((nd, obj) => {
                        if (!/^(id|class|xmlns|version|xmlns:xlink|xml:space|x|y|width|height)$/i.test(obj.name)) {
                            // 列出的属性都忽略，width、height又是特殊过滤
                            svgAttrs[obj.name] = { type: "Attribute", name: obj.name, value: obj.value }; // 保存过滤后的svg属性
                        }
                        nd.remove();
                    });

                    // 用svgicon属性覆盖svg属性
                    let oAttrs = Object.assign(svgAttrs, context.input.attrs);
                    if (!context.input.attrs.width && !context.input.attrs.height) {
                        oAttrs["height"] = { type: "Attribute", name: "height", value: "16" }; // 在<svgicon>中没有指定高宽时，默认指定为16px高度，宽度不设定让它自动调整，相当于指定默认图标大小为16px
                    }

                    // 插入更新后的属性节点
                    for (let name in oAttrs) {
                        oAttrs[name].value !== "" && node.addChild(this.createNode(oAttrs[name])); // 忽略空白属性 <svgicon style=""> 等同删除style属性
                    }
                });

                // 重置loc
                root.walk(
                    (node, object) => {
                        object.pos = context.input.pos;
                    },
                    { readonly: true }
                );
            });
        })()
    );

    bus.on(
        "SVG图标内容解析插件",
        (function() {
            // 最后一步，保存解析结果
            return postobject.plugin("svgicon-plugin-99", function(root, context) {
                context.result = root.nodes;
            });
        })()
    );

    // ------- f21m-svgicon-parse-svg-content-to-ast-nodes end
})();

/* ------- f22m-svgicon-parse-svg-use-to-ast-node ------- */
(() => {
    // ------- f22m-svgicon-parse-svg-use-to-ast-node start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    // 前提： 字符串格式正确，且为单一根节点
    bus.on(
        "SVG图标引用解析为AST节点",
        (function() {
            return function(text) {
                let plugins = bus.on("解析SVG图标引用为AST节点插件");
                let rs = postobject(plugins).process({ text });

                return rs.result;
            };
        })()
    );

    // ------------------------------------------------------
    // 解析svg-use图标引用的源码内容，转换为节点
    //
    // 以下插件顺序相关，不可轻易变动
    //
    // ------------------------------------------------------
    bus.on(
        "解析SVG图标引用为AST节点插件",
        (function() {
            return postobject.plugin("gennode-plugin-01", function(root, context) {
                root.walk((node, object) => {
                    let text = object.text;
                    context.input = { text };

                    // 像[view]一样解析为Token
                    let tokenParser = bus.at("视图TOKEN解析器", text, text, text, 0);
                    let type = "Node";
                    let nodes = tokenParser.parse();
                    let objToken = { type, nodes };
                    let newNode = this.createNode(objToken);

                    node.replaceWith(...newNode.nodes); // 转换为Token节点树
                });
            });
        })()
    );

    bus.on(
        "解析SVG图标引用为AST节点插件",
        (function() {
            return postobject.plugin("gennode-plugin-02", function(root, context) {
                // 键=值的三个节点，以及单一键节点，统一转换为一个属性节点
                const OPTS = bus.at("视图编译选项");
                root.walk(OPTS.TypeAttributeName, (node, object) => {
                    if (!node.parent) return;

                    let eqNode = node.after();
                    if (eqNode && eqNode.type === OPTS.TypeEqual) {
                        // 键=值的三个节点
                        let valNode = eqNode.after();
                        let Name = { pos: object.pos };
                        let Value = { pos: valNode.object.pos };
                        let pos = { start: object.pos.start, end: valNode.object.pos.end };

                        let oAttr = {
                            type: "Attribute",
                            name: object.value,
                            value: valNode.object.value,
                            Name,
                            Value,
                            isExpression: bus.at("是否表达式", valNode.object.value),
                            pos
                        };
                        let attrNode = this.createNode(oAttr);
                        node.replaceWith(attrNode);
                        eqNode.remove();
                        valNode.remove();
                    } else {
                        // 单一键节点（应该没有...）
                        let oAttr = { type: "Attribute", name: object.value, value: true, isExpression: false, pos: context.input.pos };
                        let attrNode = this.createNode(oAttr);
                        node.replaceWith(attrNode);
                    }
                });
            });
        })()
    );

    bus.on(
        "解析SVG图标引用为AST节点插件",
        (function() {
            return postobject.plugin("gennode-plugin-03", function(root) {
                // 多个属性节点合并为一个标签属性节点
                root.walk("Attribute", node => {
                    if (!node.parent) return;

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

    bus.on(
        "解析SVG图标引用为AST节点插件",
        (function() {
            // 自关闭标签统一转换为Tag类型节点
            return postobject.plugin("gennode-plugin-04", function(root, context) {
                const OPTS = bus.at("视图编译选项");

                root.walk(OPTS.TypeTagSelfClose, (node, object) => {
                    if (!node.parent) return;

                    let type = "Tag";
                    let value = object.value;
                    let pos = context.input.pos;
                    let tagNode = this.createNode({ type, value, pos });

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

    bus.on(
        "解析SVG图标引用为AST节点插件",
        (function() {
            // 开闭标签统一转换为Tag类型节点
            return postobject.plugin("gennode-plugin-05", function(root, context) {
                const OPTS = bus.at("视图编译选项");

                let normolizeTagNode = (tagNode, nodeTagOpen) => {
                    let nextNode = nodeTagOpen.after();
                    while (nextNode && nextNode.type !== OPTS.TypeTagClose) {
                        if (nextNode.type === OPTS.TypeTagOpen) {
                            let type = "Tag";
                            let value = nextNode.object.value;
                            let pos = nextNode.object.pos;
                            let subTagNode = this.createNode({ type, value, pos });
                            normolizeTagNode(subTagNode, nextNode);

                            tagNode.addChild(subTagNode);
                        } else {
                            tagNode.addChild(nextNode.clone());
                        }

                        nextNode.remove();
                        nextNode = nodeTagOpen.after();
                    }

                    if (!nextNode) {
                        throw new Err("missing close tag", { text: context.input.text, start: tagNode.object.pos.start });
                    }

                    if (nextNode.type === OPTS.TypeTagClose) {
                        if (nodeTagOpen.object.value !== nextNode.object.value) {
                            throw new Err(`unmatch close tag: ${nodeTagOpen.object.value}/${nextNode.object.value}`, {
                                text: context.input.text,
                                ...tagNode.object.pos
                            });
                        }
                        tagNode.object.pos.end = nextNode.object.pos.end;
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
                    let pos = object.pos;
                    let tagNode = this.createNode({ type, value, pos });
                    normolizeTagNode(tagNode, node);

                    node.replaceWith(tagNode);
                });
            });
        })()
    );

    bus.on(
        "解析SVG图标引用为AST节点插件",
        (function() {
            // 最后一步，保存解析结果
            return postobject.plugin("gennode-plugin-99", function(root, context) {
                context.result = root.nodes[0];
            });
        })()
    );

    // ------- f22m-svgicon-parse-svg-use-to-ast-node end
})();

/* ------- f23m-svgicon-type-svg ------- */
(() => {
    // ------- f23m-svgicon-type-svg start
    const bus = require("@gotoeasy/bus");
    const File = require("@gotoeasy/file");

    // --------------------------------------------
    // 多个svg图标，一个个if/else判断是否显示
    // 使用正则判断，并处理正则特殊字符
    // --------------------------------------------
    bus.on(
        "动态判断显示SVG标签",
        (function() {
            return function(expr, srcFile) {
                let oFiles = bus.at("项目SVG图标文件列表", srcFile);
                if (!oFiles.files.length) {
                    // 没有找到图标文件
                    throw new Error(`svg icon file not found`);
                }

                expr = expr.replace(/^\s*{/, "(").replace(/}\s*$/, ")");
                let texts = [];
                for (let i = 0, oFile, regstr; (oFile = oFiles.files[i++]); ) {
                    regstr = `${oFile.name.replace(/[{}()[\]^$+.-]/g, "\\$&")}(.svg)?`; // 正则相关文件名中的特殊字符替换（通常不该有特殊字符，以防万一避免出错，处理一下）

                    if (i > 1) {
                        texts.push(`{% else if ( /^${regstr}$/i.test(${expr}) ){ %}`);
                    } else {
                        texts.push(`{% if ( /^${regstr}$/i.test(${expr}) ){ %}`);
                    }
                    texts.push(File.read(oFile.file));
                    texts.push(`{% } %}`);
                }

                return texts.join("\n");
            };
        })()
    );

    // ------- f23m-svgicon-type-svg end
})();

/* ------- f24m-svgicon-type-inline-symbol ------- */
(() => {
    // ------- f24m-svgicon-type-inline-symbol start
    const bus = require("@gotoeasy/bus");
    const File = require("@gotoeasy/file");
    const hash = require("@gotoeasy/hash");

    bus.on(
        "生成SVG内联SYMBOL定义代码",
        (function() {
            return function(srcFile) {
                // 汇总用到的全部图标文件，有重名时将报错
                let oInlineSymbolSvgs = getInlineSymbolSvgFiles(srcFile);

                // 排序收集图标文件信息
                let pkgs = Object.keys(oInlineSymbolSvgs);
                pkgs.sort();
                let oFiles = [];
                pkgs.forEach(pkg => {
                    let oSvgFiles = oInlineSymbolSvgs[pkg];
                    let keys = Object.keys(oSvgFiles);
                    keys.sort();
                    keys.forEach(key => oFiles.push(oSvgFiles[key]));
                });

                // 输出
                let rs = ['<svg style="display:none;" xmlns="http://www.w3.org/2000/svg">'];
                let text, symbolId;
                oFiles.forEach(oFile => {
                    text = File.read(oFile.file);
                    symbolId = hash(oFile.pkg) + "_" + oFile.name; // 用包名哈希码为前缀作id
                    rs.push(bus.at("SVG转SYMBOL定义", text, symbolId));
                });
                rs.push("</svg>");

                return rs.join("\n");
            };
        })()
    );

    bus.on(
        "生成SVG引用内联SYMBOL",
        (function() {
            return function(fileOrExpr, srcFile, props = {}) {
                let attrs = [];
                for (let key in props) {
                    attrs.push(`${key}="${props[key]}"`);
                }

                let pkg = bus.at("文件所在模块", srcFile);
                let hashcode = hash(pkg);

                let href;
                if (bus.at("是否表达式", fileOrExpr)) {
                    let expr = fileOrExpr.substring(1, fileOrExpr.length - 1);
                    href = `{'#${hashcode}_' + (${expr}) }`;

                    !props.height && attrs.push(`height="${props.width || 16}"`);
                    !attrs.width && attrs.push(`width="${props.height || 16}"`);
                } else {
                    let name = File.name(fileOrExpr); // 使用文件名作为id （TODO 冲突）
                    href = `{'#${hashcode}_${name}'}`;

                    // TODO 自动按比例调整宽度
                    !props.height && attrs.push(`height="${props.width || 16}"`);
                    !attrs.width && attrs.push(`width="${props.height || 16}"`);
                }

                return `<svg ${attrs.join(" ")}><use xlink:href=${href}></use></svg>`;
            };
        })()
    );

    function getInlineSymbolSvgFiles(srcFile) {
        let oPkgSvgFiles = {};
        let oSetPkg = new Set();

        inlineSymbolSvgFiles(oPkgSvgFiles, oSetPkg, srcFile);

        let context = bus.at("组件编译缓存", srcFile);
        let allreferences = context.result.allreferences;
        for (let i = 0, tagpkg; (tagpkg = allreferences[i++]); ) {
            let tagSrcFile = bus.at("标签源文件", tagpkg);
            inlineSymbolSvgFiles(oPkgSvgFiles, oSetPkg, tagSrcFile);
        }

        return oPkgSvgFiles;
    }

    // 汇总 srcFile 所在包的图标文件（配置目录+配置导入）
    // oPkgSvgFiles: {pkg: {file: {位置信息}} }
    function inlineSymbolSvgFiles(oPkgSvgFiles, oSetPkg, srcFile) {
        let context = bus.at("组件编译缓存", srcFile);
        if (!context) return;

        let pkg = bus.at("文件所在模块", srcFile);
        if (!oSetPkg.has(pkg)) {
            // 汇总图标
            if (context.result.hasDinamicSvg) {
                let oFiles = bus.at("项目SVG图标文件列表", context.input.file); // {files, pkg}

                let oSvgFiles = (oPkgSvgFiles[pkg] = oPkgSvgFiles[pkg] || {}); // {name: oFile}
                for (let i = 0, oFile; (oFile = oFiles.files[i++]); ) {
                    oSvgFiles[oFile.name] = { ...oFile, pkg }; // 保存包名信息
                }
                oSetPkg.add(pkg); // 此包已处理
            }
        }
    }

    // ------- f24m-svgicon-type-inline-symbol end
})();

/* ------- f25m-svgicon-type-link-symbol ------- */
(() => {
    // ------- f25m-svgicon-type-link-symbol start
    const bus = require("@gotoeasy/bus");
    const File = require("@gotoeasy/file");
    const hash = require("@gotoeasy/hash");

    (function(oFiles = {}, hashLinkSymbol) {
        bus.on("生成各关联包的外部SYMBOL定义文件", function(context) {
            let pkg,
                oPkgFile = {};
            if (context.result.hasSvgLinkSymbol) {
                pkg = bus.at("文件所在模块", context.input.file);
                oPkgFile[pkg] = context.input.file;
            }

            let allreferences = context.result.allreferences;
            for (let i = 0, tagpkg, ctx; (tagpkg = allreferences[i++]); ) {
                let tagSrcFile = bus.at("标签源文件", tagpkg);
                ctx = bus.at("组件编译缓存", tagSrcFile);
                if (ctx && ctx.result.hasSvgLinkSymbol) {
                    pkg = bus.at("文件所在模块", tagSrcFile);
                    oPkgFile[pkg] = tagSrcFile;
                }
            }

            for (let pkg in oPkgFile) {
                bus.at("生成外部SYMBOL定义文件", oPkgFile[pkg]);
            }
        });

        bus.on("生成外部SYMBOL定义文件", function(srcFile) {
            // 模块名（当前工程时为‘/’）
            let pkg = bus.at("文件所在模块", srcFile);
            let filename = bus.at("外部SYMBOL文件名", srcFile);

            if (!oFiles[filename]) {
                let env = bus.at("编译环境");
                let file = (env.path.build_dist + "/" + env.path.build_dist_images + "/" + filename).replace(/\/\//g, "/");
                let text = bus.at("外部SYMBOL文件内容", srcFile);

                if (pkg === "/") {
                    // 当前工程时，如果内容相同，不重复写文件
                    let hashcode = hash(text);
                    if (hashLinkSymbol !== hashcode) {
                        File.write(file, text);
                        hashLinkSymbol = hashcode;
                    }
                } else {
                    // npm包的话，写一次就够了
                    File.write(file, text);
                    oFiles[filename] = true;
                }
            }
        });

        bus.on("生成SVG引用外部SYMBOL", function(fileOrExpr, srcFile, props) {
            let attrs = [];
            for (let key in props) {
                attrs.push(`${key}="${props[key]}"`);
            }

            let symbolFile = bus.at("外部SYMBOL文件名", srcFile);

            let href;
            if (bus.at("是否表达式", fileOrExpr)) {
                let expr = fileOrExpr.substring(1, fileOrExpr.length - 1);
                href = `{'%svgsymbolpath%${symbolFile}#' + (${expr}) }`;

                !props.height && attrs.push(`height="${props.width || 16}"`);
                !attrs.width && attrs.push(`width="${props.height || 16}"`);
            } else {
                let symbolId = File.name(fileOrExpr); // 使用文件名作为id （TODO 冲突）
                href = `{'%svgsymbolpath%${symbolFile}#${symbolId}'}`;

                // TODO 自动按比例调整宽度
                !props.height && attrs.push(`height="${props.width || 16}"`);
                !attrs.width && attrs.push(`width="${props.height || 16}"`);
            }

            return `<svg ${attrs.join(" ")}><use xlink:href=${href}></use></svg>`;
        });

        bus.on("外部SYMBOL文件内容", function(srcFile) {
            let oFiles = bus.at("项目SVG图标文件列表", srcFile);
            oFiles.files.sort((f1, f2) => f1.file > f2.file);

            let rs = ['<svg style="display:none;" xmlns="http://www.w3.org/2000/svg">'];
            let text, symbolId;
            oFiles.files.forEach(oFile => {
                text = File.read(oFile.file);
                symbolId = oFile.name;
                rs.push(bus.at("SVG转SYMBOL定义", text, symbolId)); // 需要适当的转换处理，使用文件内容哈希码作为id
            });
            rs.push("</svg>");

            return rs.join("\n");
        });

        bus.on("外部SYMBOL文件名", function(srcFile) {
            // 模块名（当前工程时为‘/’）
            let pkg = bus.at("文件所在模块", srcFile);
            return "symbols-" + hash(pkg) + ".svg"; // 外部SYMBOL文件名
        });
    })();

    // ------- f25m-svgicon-type-link-symbol end
})();

/* ------- f26m-svgicon-convert-to-symbol ------- */
(() => {
    // ------- f26m-svgicon-convert-to-symbol start
    const bus = require("@gotoeasy/bus");

    bus.on(
        "SVG转SYMBOL定义",
        (function() {
            // text: 图标文件内容
            // symbolId: 定义用id
            // <svg viewBox="...">...</svg>    =>   <symbol id="..." viewBox="...">...</symbol>
            return function svgToSymbol(text, symbolId) {
                let svg, match;
                match = text.match(/<svg\s+[\s\S]*<\/svg>/); // 从文件内容中提取出svg内容 （<svg>...</svg>）
                if (!match) return "";
                svg = match[0];

                let svgstart;
                svg = svg.replace(/<svg\s+[\s\S]*?>/, function(mc) {
                    // 不含开始标签的svg内容
                    svgstart = mc; // svg开始标签
                    return "";
                });

                let width,
                    height,
                    viewBox = "";
                svgstart = svgstart.replace(/\s+width\s?=\s?"(.+?)"/, function(mc, val) {
                    // 删除 width 属性
                    width = val;
                    return "";
                });
                svgstart = svgstart.replace(/\s+height\s?=\s?"(.+?)"/, function(mc, val) {
                    // 删除 height 属性
                    height = val;
                    return "";
                });
                svgstart = svgstart.replace(/\s+viewBox\s?=\s?"(.+?)"/, function(mc, val) {
                    // 删除 viewBox 属性
                    viewBox = val;
                    return "";
                });
                svgstart = svgstart.replace(/\s+id\s?=\s?".+?"/, ""); // 删除 id 属性
                svgstart = svgstart.replace(/\s+fill\s?=\s?".+?"/, ""); // 删除 fill 属性，以便使用时控制 （path标签硬编码的就不管了）
                svgstart = svgstart.replace(/\s+xmlns\s?=\s?".+?"/, ""); // 删除 xmlns 属性

                !viewBox && width && height && (viewBox = `0 0 ${width} ${height}`); // 无 viewBox 且有 width、height 时，生成 viewBox

                // 设定 id、viewBox 属性，svg 替换为 symbol
                return `<symbol id="${symbolId}" viewBox="${viewBox}" ${svgstart.substring(4)} ${svg.substring(0, svg.length - 6)}</symbol>`;
            };
        })()
    );

    // ------- f26m-svgicon-convert-to-symbol end
})();

/* ------- f35p-svgicon-astedit-transform-to-svg ------- */
(() => {
    // ------- f35p-svgicon-astedit-transform-to-svg start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 内置标签<svgicon>转换处理
            // 解析替换为<svg>标签
            return postobject.plugin("f35p-svgicon-astedit-transform-to-svg", function(root, context) {
                context.result.hasSvgInlineSymbol = false; // 有无内联Symbol
                context.result.hasSvgLinkSymbol = false; // 有无外部Symbol
                context.result.hasDinamicSvg = false; // 有无动态svg影响（svg表达式、内联Symbol、外联Symbol）
                context.result.hasSvgIcon = false; // 有无使用图标

                root.walk("Tag", (node, object) => {
                    if (!/^svgicon$/i.test(object.value)) return;

                    context.result.hasSvgIcon = true; // 有无使用图标

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

                    let nodeName,
                        nodeType,
                        iconName,
                        iconType,
                        oAttrs = {};
                    attrsNode &&
                        attrsNode.nodes.forEach(nd => {
                            let name = nd.object.name;
                            if (/^type$/i.test(name)) {
                                // type属性是svgicon专用属性，用于指定使用图标展示方式
                                iconType = (nd.object.value + "").trim(); // 属性节点type
                                nodeType = nd;
                            } else if (/^name$/i.test(name)) {
                                // name属性是svgicon专用属性，用于指定图标名
                                nodeName = nd;
                                iconName = nd.object.value.trim(); // 属性节点name
                            } else {
                                // 其他属性全部作为svg标签用属性看待，效果上等同内联svg标签中直接写属性，但viewBox属性除外，viewBox不支持修改以免影响svg大小
                                !/^viewBox$/i.test(name) && (oAttrs[nd.object.name] = nd.object);
                            }
                        });

                    !iconType && (iconType = "svg"); // 缺省为 svg，直接显示svg
                    if (!nodeName) {
                        throw new Err("missing name attribute on tag svgicon", { ...context.input, ...object.pos }); // 不能没有name属性
                    }

                    let errInfoName = { ...context.input, ...nodeName.object.Value.pos };
                    if (!iconName) {
                        throw new Err("invalid value of name attribute", errInfoName); // 不能没有name属性值
                    }

                    // svg(内联svg)/inline-symbol(内联symbol定义)/link-symbol(外部symbol定义)
                    if (/^svg$/i.test(iconType)) {
                        // -------------------------------
                        // svg(内联svg)
                        // 【特点】可灵活控制svg图标
                        // -------------------------------
                        if (bus.at("是否表达式", iconName)) {
                            // 使用表达式时，运行期判断显示相应图标，默认范围限于工程图标目录
                            let nodeSvgTags;
                            try {
                                let text = bus.at("动态判断显示SVG标签", iconName, context.input.file);
                                nodeSvgTags = bus.at("SVG图标内容解析为AST节点数组", null, text, oAttrs, object.pos);
                            } catch (e) {
                                throw new Err(e.message, e, { ...context.input, ...nodeName.object.pos });
                            }

                            // 替换为内联svg标签节点
                            nodeSvgTags && node.replaceWith(...nodeSvgTags);
                            context.result.hasDinamicSvg = true;
                        } else {
                            // 硬编码时，直接显示相应图标
                            let oFile = findSvgFileInProject(iconName, errInfoName, context.input.file); // 从工程中查找唯一的图标文件，找不到则报错

                            let nodeSvgTags = bus.at("SVG图标内容解析为AST节点数组", oFile.file, null, oAttrs, object.pos);
                            nodeSvgTags && node.replaceWith(...nodeSvgTags); // 替换为内联svg标签节点
                        }
                    } else if (/^inline-symbol$/i.test(iconType)) {
                        // -------------------------------
                        // inline-symbol(内联symbol定义)
                        // 【特点】减少重复
                        // -------------------------------
                        let props = {};
                        for (let k in oAttrs) {
                            props[k] = oAttrs[k].value;
                        }

                        context.result.hasSvgInlineSymbol = true;
                        context.result.hasDinamicSvg = true;

                        let symbolId;
                        if (bus.at("是否表达式", iconName)) {
                            // 使用表达式，在运行期确定symbolId相应的图标
                            symbolId = iconName;
                        } else {
                            // 硬编码时，检查文件是否存在
                            let oFile = findSvgFileInProject(iconName, errInfoName, context.input.file); // 从工程中查找唯一的图标文件，找不到则报错
                            symbolId = oFile.file;
                        }

                        let strSvgUse = bus.at("生成SVG引用内联SYMBOL", symbolId, context.input.file, props); // 生成标签字符串，类似 <svg ...><use ...></use></svg>
                        let nodeSvgUse = bus.at("SVG图标引用解析为AST节点", strSvgUse); // 转成AST节点
                        node.replaceWith(nodeSvgUse);
                    } else if (/^link-symbol$/i.test(iconType)) {
                        // -------------------------------
                        // link-symbol(外部symbol定义)
                        // 【特点】能缓存
                        // -------------------------------
                        let props = {};
                        for (let k in oAttrs) {
                            props[k] = oAttrs[k].value;
                        }

                        context.result.hasSvgLinkSymbol = true;
                        context.result.hasDinamicSvg = true;

                        let symbolId;
                        if (bus.at("是否表达式", iconName)) {
                            // 使用表达式，在运行期确定symbolId相应的图标
                            symbolId = iconName;
                        } else {
                            // 硬编码时，检查文件是否存在
                            let oFile = findSvgFileInProject(iconName, errInfoName, context.input.file); // 从工程中查找唯一的图标文件，找不到则报错
                            symbolId = oFile.file;
                        }

                        let strSvgUse = bus.at("生成SVG引用外部SYMBOL", symbolId, context.input.file, props); // 生成标签字符串，类似 <svg ...><use ...></use></svg>
                        let nodeSvgUse = bus.at("SVG图标引用解析为AST节点", strSvgUse); // 转成AST节点
                        node.replaceWith(nodeSvgUse);
                    } else {
                        // 错误类型，提示修改
                        throw new Err(`support type (${iconType}), possible values for type: svg | inline-symbol | link-symbol`, {
                            ...context.input,
                            ...nodeType.object.Value.pos
                        });
                    }
                });
            });

            // 从工程中查找图标文件（直接内联svg时，检查重名，其他情况在页面生成时统一检查）
            function findSvgFileInProject(filename, errInfo, fromFile) {
                let oSvg = bus.at("项目SVG图标文件列表", fromFile); // 已含重名检查

                // 按文件名匹配，忽略大小写
                for (let i = 0, oFile; (oFile = oSvg.files[i++]); ) {
                    if (oFile.name === filename.toLowerCase()) {
                        return oFile;
                    }
                }

                throw new Err(`svg icon file not found (${filename})`, errInfo); // 图标文件找不到
            }
        })()
    );

    // ------- f35p-svgicon-astedit-transform-to-svg end
})();

/* ------- g11p-astedit-set-flag-is-svg-tag ------- */
(() => {
    // ------- g11p-astedit-set-flag-is-svg-tag start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            // 判断是否为SVG标签或SVG子标签，并加上标记
            return postobject.plugin("g11p-astedit-set-flag-is-svg-tag", function(root) {
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

    // ------- g11p-astedit-set-flag-is-svg-tag end
})();

/* ------- g13p-astedit-set-flag-is-standard-tag ------- */
(() => {
    // ------- g13p-astedit-set-flag-is-standard-tag start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    const REG_TAGS = /^(html|link|meta|style|title|address|article|aside|footer|header|h1|h2|h3|h4|h5|h6|hgroup|main|nav|section|blockquote|dd|dir|div|dl|dt|figcaption|figure|hr|li|ol|p|pre|ul|a|abbr|b|bdi|bdo|br|cite|code|data|dfn|em|i|kbd|mark|q|rb|rbc|rp|rt|rtc|ruby|s|samp|small|span|strong|sub|sup|time|tt|u|var|wbr|area|audio|img|map|track|video|applet|embed|iframe|noembed|object|param|picture|source|canvas|noscript|script|del|ins|caption|col|colgroup|table|tbody|td|tfoot|th|thead|tr|button|datalist|fieldset|form|input|label|legend|meter|optgroup|option|output|progress|select|textarea|details|dialog|menu|menuitem|summary|content|element|shadow|slot|template|acronym|basefont|bgsound|big|blink|center|command|font|frame|frameset|image|isindex|keygen|listing|marquee|multicol|nextid|nobr|noframes|plaintext|spacer|strike|xmp|head|base|body|math|svg)$/i;

    bus.on(
        "编译插件",
        (function() {
            // 判断是否为标准标签，并加上标记
            return postobject.plugin("g13p-astedit-set-flag-is-standard-tag", function(root) {
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

    // ------- g13p-astedit-set-flag-is-standard-tag end
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
            return postobject.plugin("g15p-astedit-group-attribtue-{prop}", function(root) {
                root.walk("Tag", node => {
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

    bus.on(
        "编译插件",
        (function() {
            // 处理标签中指定类型的属性，提取后新建节点管理
            // 标准标签的事件统一分组
            // 标签节点下新建Events节点存放
            return postobject.plugin("g25p-astedit-group-attribtue-events", function(root) {
                root.walk("Tag", node => {
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
                        bus.at("是否HTML标准事件名", nd.object.name) && ary.push(nd); // 找到
                    });

                    if (!ary.length) return; // 没有找到相关节点，跳过

                    // 查找/创建事件组节点
                    let groupNode = getEventsNode(node);
                    if (!groupNode) {
                        groupNode = this.createNode({ type: "Events" });
                        node.addChild(groupNode);
                    }

                    // 创建节点保存
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

    function getEventsNode(tagNode) {
        let nodes = tagNode.nodes || [];
        for (let i = 0, node; (node = nodes[i++]); ) {
            if (node.type === "Events") {
                return node;
            }
        }
    }

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
                root.walk("Tag", node => {
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

                    if (ary.length > 1) {
                        // 属性 style 不能重复
                        throw new Err("duplicate attribute of style", { ...context.input, ...ary[1].object.pos });
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

/* ------- h10m-@class-content-parser ------- */
(() => {
    // ------- h10m-@class-content-parser start
    const bus = require("@gotoeasy/bus");

    bus.on("解析原子样式", function(atomcss, file) {
        // 按冒号分隔伪类选择器
        // 按首双减号或末单减号分割为键值数组
        //
        // hover:color-red => {pseudo: 'hover', key: 'color', value: 'red'}
        // color-red => {pseudo: undefined, key: 'color', value: 'red'}
        // align-items--flex-end =>  {pseudo: undefined, key: 'align-items', value: 'flex-end'}
        //
        let oAtClass = splitAtomicKeyValue(atomcss);
        if (!oAtClass) {
            console.warn(`invalid @class value (${atomcss}) in file (${file})`);
            return null;
        }

        // 自定义样式属性名缩写
        let map = new Map();
        map.set("bg", "background");
        map.set("bgcolor", "background-color");
        map.has(oAtClass.key) && (oAtClass.key = map.get(oAtClass.key)); // 键名使用缩写时，替换为全名

        return oAtClass;
    });

    // 按首双减号或末单减号分割为键值数组
    function splitAtomicKeyValue(atomcss) {
        let pseudo, key, value;

        // 优先判断是否有伪类选择器
        let idx = atomcss.indexOf(":");
        if (idx > 0) {
            pseudo = atomcss.substring(0, idx); // 伪类用冒号分隔
            atomcss = atomcss.substring(idx + 1);
        }

        // 优先按首双减号'--'分割
        idx = atomcss.indexOf("--");
        if (idx > 0) {
            key = atomcss.substring(0, idx);
            value = atomcss.substring(idx + 2).replace(/_/g, " "); // 下划线按空格处理
            return { pseudo, key, value };
        }

        // 默认按末单减号'-'分割
        idx = atomcss.lastIndexOf("-");
        if (idx > 0) {
            key = atomcss.substring(0, idx);
            value = atomcss.substring(idx + 1).replace(/_/g, " "); // 下划线按空格处理
            return { pseudo, key, value };
        }
        return null;
    }

    // ------- h10m-@class-content-parser end
})();

/* ------- h12m-@class-gen-css ------- */
(() => {
    // ------- h12m-@class-gen-css start
    const bus = require("@gotoeasy/bus");
    const hash = require("@gotoeasy/hash");

    bus.on(
        "创建@class样式",
        (function() {
            // @class="hover:color-red color-red width-100px height--calc(100%_-_50px) box-sizing--border-box padding-5px_10px"
            // 样式类名和样式内容相关，以减少样式类名的变动
            return (atclass, file) => {
                let oAtClass,
                    oPseudo = new Set(),
                    pseudocss = [],
                    normalcss = [],
                    ary = [...new Set(atclass.trim().split(/\s+/))];
                ary.sort();
                ary.forEach(v => {
                    oAtClass = bus.at("解析原子样式", v, file);
                    if (oAtClass) {
                        if (oAtClass.pseudo) {
                            oPseudo.add(oAtClass.pseudo.toLowerCase());
                            pseudocss.push(`${oAtClass.key}:${oAtClass.value};`);
                        } else {
                            normalcss.push(`${oAtClass.key}:${oAtClass.value};`);
                        }
                    }
                });

                let name = "atclass-" + hash(atclass); // 样式类名
                let ncss = `.${name}{ ${normalcss.join(" ")} }`; // 普通样式
                let pcss = pseudocss.join(" ");
                if (pcss) {
                    let names = [];
                    oPseudo.forEach(pseudo => names.push(`.${name}:${pseudo}`));
                    pcss = `${names.join(",")}{ ${pcss} }`; // 伪类样式
                }

                return { name, css: ncss + "\n" + pcss };
            };
        })()
    );

    // ------- h12m-@class-gen-css end
})();

/* ------- h15p-astedit-process-attribtue-@class ------- */
(() => {
    // ------- h15p-astedit-process-attribtue-@class start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // --------------------------------------
            // 处理标签中的 @class 属性
            //
            // 找出@class
            // 创建类名（atclass-hashxxxx）插入到class属性
            // 创建atclass样式
            // --------------------------------------
            return postobject.plugin("h15p-astedit-process-attribtue-@class", function(root, context) {
                let style = context.style;
                let atclasscss = (style.atclasscss = style.atclasscss || []);

                root.walk("Tag", node => {
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

                    // --------------------------------------
                    // 找出@class
                    // --------------------------------------
                    let ary = [];
                    attrsNode.nodes.forEach(nd => {
                        /^@class$/i.test(nd.object.name) && ary.push(nd); // 找到 【@class】属性
                    });

                    if (!ary.length) return; // 没有找到相关节点，跳过

                    if (ary.length > 1) {
                        // 属性 @class 不能重复
                        throw new Err("duplicate attribute of @class", { ...context.input, ...ary[1].object.Name.pos });
                    }

                    let atclassNode = ary[0]; // @class节点
                    let atclass = atclassNode.object.value; // @class="font-size-16px" => font-size-16px

                    // --------------------------------------
                    // 类名（atclass-hashxxxx）插入到class属性
                    // --------------------------------------
                    ary = [];
                    attrsNode.nodes.forEach(nd => {
                        /^class$/i.test(nd.object.name) && ary.push(nd); // 找到 【class】属性
                    });

                    let oNode;
                    if (!ary.length) {
                        oNode = atclassNode.clone(); // 没有找到class节点，插入一个class节点（简化的克隆@class节点，修改类型和值）
                        oNode.type = "class";
                        oNode.object.type = "class";
                        oNode.object.name = "class";
                        oNode.object.value = ""; // 样式类名，待下一步填入
                        attrsNode.addChild(oNode); // 添加到属性节点下
                    } else {
                        oNode = ary[0];
                        oNode.object.value += " "; // 样式类名，加个空格隔开，待下一步追加类名
                    }

                    // --------------------------------------
                    // 创建atclass样式
                    // --------------------------------------
                    let oCss = bus.at("创建@class样式", atclass, context.input.file);
                    oNode.object.value += oCss.name; // 样式类名
                    atclasscss.push(oCss.css);

                    atclassNode.remove(); // 删除@class节点
                });
            });
        })()
    );

    // ------- h15p-astedit-process-attribtue-@class end
})();

/* ------- h20m-parse-attribtue-class ------- */
(() => {
    // ------- h20m-parse-attribtue-class start
    const bus = require("@gotoeasy/bus");
    const Err = require("@gotoeasy/err");

    // class="foo {bar: isBar, baz: isBaz}" => [ {Name: {value:'foo', start, end}, Expr: {value:1, start, end}},
    //                                           {Name: {value:'bar', start, end}, Expr: {value:'isBar', start, end}},
    //                                           {Name: {value:'baz', start, end}, Expr: {value:'isBaz', start, end}} ]
    bus.on(
        "解析CLASS属性",
        (function() {
            // file, text 用于错误提示
            return function(file, text, classAttrValue, offset) {
                if (!classAttrValue.trim()) return [];

                return parseToClasses(file, text, classAttrValue, offset);
            };
        })()
    );

    function parseToClasses(file, text, strClass, offset) {
        // 分割放入数组，并计算保存好偏移位置
        // foo {bar: isBar, baz: isBaz}  => [{value: 'foo', start: 0, end: xxx}, {value: '{bar: isBar, baz: isBaz}', start: xxx, end: xxx}]
        let ary = [];
        let clas = strClass.replace(/\{[\s\S]*?\}/g, function(sMatch, idx) {
            ary.push({ value: sMatch, start: offset + idx, end: offset + idx + sMatch.length });
            return "鬱".repeat(sMatch.length);
        });
        clas.replace(/[\S]+/g, function(sMatch, idx) {
            if (!sMatch.startsWith("鬱")) {
                ary.push({ value: sMatch, start: offset + idx, end: offset + idx + sMatch.length });
            }
        });

        // 解析为单个类名对象
        let result = [];
        ary.forEach(v => {
            if (v.value.startsWith("{") && v.value.endsWith("}")) {
                result.push(...parseExprClass(v, file, text));
            } else {
                result.push(parseSingleClass(v, file, text));
            }
        });

        // 类名重复性检查
        let map = new Map();
        for (let i = 0, oItem; (oItem = result[i++]); ) {
            if (map.has(oItem.Name.value)) {
                throw new Err(
                    `duplicate class name (${oItem.Name.value})`,
                    { file, text, ...map.get(oItem.Name.value).Name },
                    { file, text, ...oItem.Name }
                );
            }
            map.set(oItem.Name.value, oItem);
        }

        // 返回解析结果
        return result;
    }

    // 解析单个类名
    function parseSingleClass(oClas, file, text) {
        // 简单检查类名
        if (/[/:{}\\,]/.test(oClas.value)) {
            throw new Err("invalid format of class attribute", { file, text, ...oClas });
        }

        return { Name: oClas, Expr: { value: 1, start: oClas.start, end: oClas.end } };
    }

    // 解析N个表达式类名
    function parseExprClass(oClas, file, text) {
        let sClas = oClas.value.replace(/,?\s*\}$/, ""); // 删除后面大括号，以及可能的冗余逗号 （开头大括号不删除，以不影响偏移计算）

        // 简单检查
        if (sClas.indexOf(":") < 0) {
            throw new Err("invalid format", { file, text, start: oClas.start, end: oClas.end });
        }

        // 解析出样式类名及位置信息
        // {foo: expr1, bar: expr2 => [{name: 'foo', start: 0, end: 3}, {name: 'bar', start: nnn, end: nnn}]
        // {foo: expr1, bar: expr2 => 鬱鬱鬱鬱鬱 expr1鬱鬱鬱鬱鬱 expr2
        let names = [];
        sClas = sClas.replace(/^{\s*(\S+?\s*:)|,\s*(\S+?\s*:)/g, function(sMatch, name1, name2, idx) {
            let matchName = name1 || name2; // [foo :]
            let value = matchName.replace(/\s*:$/, ""); // [foo :] => [foo]
            let start = oClas.start + idx + (sMatch.length - matchName.length); // 样式类名foo的起始位置
            let end = start + value.length; // 样式类名foo的结束位置

            names.push({ value, start, end }); // 保存样式类名及位置信息

            return "鬱".repeat(sMatch.length); // 用等长特殊字符替换以保持位置信息不变
        });

        // 解析出表达式及位置信息
        // 鬱鬱鬱鬱鬱 expr1鬱鬱鬱鬱鬱 expr2 => [{expr: ' expr1', start: nnn, end: nnn}, {expr: ' expr2', start: nnn, end: nnn}]
        let exprs = [];
        sClas.replace(/[^鬱]+/g, function(sMatch, idx) {
            let value = sMatch.trim();
            let start = oClas.start + idx + (sMatch.length - sMatch.trimStart().length);
            let end = start + sMatch.trimEnd().length;

            exprs.push({ value, start, end });
        });

        // 检查长度是否一致
        if (names.length != exprs.length) {
            throw new Err("invalid format", { file, text, start: oClas.start, end: oClas.end });
        }
        // 检查样式名（不能有空格）
        for (let i = 0, oItem; (oItem = names[i++]); ) {
            if (/\s+/.test(oItem.value)) {
                throw new Err(`invalid class name [${oItem.value}]`, { file, text, start: oItem.start, end: oItem.end });
            }
        }
        // 检查表达式（不能为空）
        for (let i = 0, oItem; (oItem = exprs[i++]); ) {
            if (!oItem.value.trim()) {
                throw new Err(`invalid class expression`, { file, text, start: oItem.start, end: oItem.end });
            }
        }

        // 整理结果
        let rs = [];
        for (let i = 0; i < names.length; i++) {
            rs.push({ Name: names[i], Expr: exprs[i] });
        }
        return rs;
    }

    // ------- h20m-parse-attribtue-class end
})();

/* ------- h25p-astedit-process-attribtue-class ------- */
(() => {
    // ------- h25p-astedit-process-attribtue-class start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 处理标签中指定类型的属性，提取后新建节点管理
            // 处理标签中的 class 属性
            return postobject.plugin("h25p-astedit-process-attribtue-class", function(root, context) {
                root.walk("Tag", node => {
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

                    if (ary.length > 1) {
                        // 属性 class 不能重复
                        throw new Err("duplicate attribute of class", { ...context.input, ...ary[1].object.Name.pos });
                    }

                    // 创建节点保存
                    let oNode = ary[0].clone();
                    oNode.type = "Class";
                    oNode.object.type = "Class";
                    oNode.object.classes = bus.at(
                        "解析CLASS属性",
                        context.input.file,
                        context.input.text,
                        oNode.object.value,
                        oNode.object.Value.pos.start
                    ); // 解析出全部类名表达式保存备用

                    node.addChild(oNode);
                    ary[0].remove(); // 删除节点
                });
            });
        })()
    );

    // ------- h25p-astedit-process-attribtue-class end
})();

/* ------- h35p-astedit-process-attribtue-@ref ------- */
(() => {
    // ------- h35p-astedit-process-attribtue-@ref start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 处理标签中指定类型的属性，提取后新建节点管理
            // 处理标签中的 @ref 属性
            return postobject.plugin("h35p-astedit-process-attribtue-@ref", function(root, context) {
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

                    if (ary.length > 1) {
                        // 属性 @ref 不能重复
                        throw new Err("duplicate attribute of @ref", { ...context.input, ...ary[1].object.Name.pos });
                    }
                    if (/^(if|for)$/.test(object.value)) {
                        throw new Err(`unsupport attribute @ref on tag <${object.value}>`, { ...context.input, ...ary[0].object.Name.pos });
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

    // ------- h35p-astedit-process-attribtue-@ref end
})();

/* ------- h37p-astedit-process-attribtue-@key ------- */
(() => {
    // ------- h37p-astedit-process-attribtue-@key start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 处理标签中指定类型的属性，提取后新建节点管理
            // 处理标签中的 @key 属性
            return postobject.plugin("h37p-astedit-process-attribtue-@key", function(root, context) {
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
                        /^@key$/i.test(nd.object.name) && ary.push(nd); // 找到
                    });

                    if (!ary.length) return; // 没有找到相关节点，跳过

                    if (ary.length > 1) {
                        // 属性 @key 不能重复
                        throw new Err("duplicate attribute of @key", { ...context.input, ...ary[1].object.Name.pos });
                    }
                    if (/^(if|for)$/.test(object.value)) {
                        throw new Err(`unsupport attribute @key on tag <${object.value}>`, { ...context.input, ...ary[0].object.Name.pos });
                    }

                    // 创建节点保存
                    let oNode = ary[0].clone();
                    oNode.type = "@key";
                    oNode.object.type = "@key";

                    node.addChild(oNode);
                    ary[0].remove(); // 删除节点
                });
            });
        })()
    );

    // ------- h37p-astedit-process-attribtue-@key end
})();

/* ------- h45p-astedit-process-attribtue-@if ------- */
(() => {
    // ------- h45p-astedit-process-attribtue-@if start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 处理标签中指定类型的属性，提取后新建节点管理
            // 处理标签中的 @if 属性
            return postobject.plugin("h45p-astedit-process-attribtue-@if", function(root, context) {
                root.walk("Tag", node => {
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

                    if (ary.length > 1) {
                        // 属性 @if 不能重复
                        throw new Err("duplicate attribute of @if", { ...context.input, ...ary[1].object.Name.pos });
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

    // ------- h45p-astedit-process-attribtue-@if end
})();

/* ------- h55p-astedit-process-attribtue-@show ------- */
(() => {
    // ------- h55p-astedit-process-attribtue-@show start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    // display的合法值（none除外）
    const DISPLAY_REG = /(-webkit-box|-webkit-inline-box|block|contents|flex|flow-root|grid|initial|inline|inline-block|inline-flex|inline-grid|list-item|run-in|compact|marker|table|inline-table|table-row-group|table-header-group|table-footer-group|table-row|table-column-group|table-column|table-cell|table-caption|inherit|unset)/i;

    bus.on(
        "编译插件",
        (function() {
            // 处理标签中指定类型的属性，提取后新建节点管理
            // 处理标签中的 @show 属性
            return postobject.plugin("h55p-astedit-process-attribtue-@show", function(root, context) {
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
                        /^@(show|show\.[a-z-]+)$/i.test(nd.object.name) && ary.push(nd); // 找到
                    });

                    if (!ary.length) return; // 没有找到相关节点，跳过

                    if (ary.length > 1) {
                        // 属性 @show 不能重复
                        throw new Err("duplicate attribute of @show", { ...context.input, ...ary[1].object.Name.pos });
                    }
                    if (/^(if|for)$/.test(object.value)) {
                        throw new Err(`unsupport attribute @show on tag <${object.value}>`, { ...context.input, ...ary[0].object.Name.pos });
                    }

                    // 创建节点保存
                    let oNode = ary[0].clone();
                    oNode.type = "@show";
                    oNode.object.type = "@show";

                    let tmps = oNode.object.name.split(".");
                    let display = tmps.length > 1 ? tmps[1] : "block"; // @show / @show.flex
                    if (!DISPLAY_REG.test(display)) {
                        let pos = { ...oNode.object.Name.pos };
                        pos.start += 6; // 略过 @show.xxx 中的[@show.]
                        throw new Err("invalid display type (" + display + ")", { ...context.input, ...pos });
                    }

                    oNode.object.display = display;

                    node.addChild(oNode);
                    ary[0].remove(); // 删除节点
                });
            });
        })()
    );

    // ------- h55p-astedit-process-attribtue-@show end
})();

/* ------- h65p-astedit-process-attribtue-@for ------- */
(() => {
    // ------- h65p-astedit-process-attribtue-@for start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 处理标签中指定类型的属性，提取后新建节点管理
            // 处理标签中的 @for 属性
            return postobject.plugin("h65p-astedit-process-attribtue-@for", function(root, context) {
                root.walk("Tag", node => {
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

                    if (ary.length > 1) {
                        // 属性 @for 不能重复
                        throw new Err("duplicate attribute of @for", { ...context.input, ...ary[1].object.Name.pos });
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

    // ------- h65p-astedit-process-attribtue-@for end
})();

/* ------- h75p-astedit-process-attribtue-@csslib ------- */
(() => {
    // ------- h75p-astedit-process-attribtue-@csslib start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 处理标签中指定类型的属性，提取后新建节点管理
            // 处理标签中的 @csslib 属性 （不做建库处理）
            return postobject.plugin("h75p-astedit-process-attribtue-@csslib", function(root, context) {
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

                    if (ary.length > 1) {
                        // 属性 @csslib 不能重复
                        throw new Err("duplicate attribute of @csslib", { ...context.input, ...ary[1].object.Name.pos });
                    }
                    if (/^(if|for)$/.test(object.value)) {
                        throw new Err(`unsupport attribute @csslib on tag <${object.value}>`, { ...context.input, ...ary[0].object.Name.pos });
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

    // ------- h75p-astedit-process-attribtue-@csslib end
})();

/* ------- h85p-astedit-process-attribtue-@taglib ------- */
(() => {
    // ------- h85p-astedit-process-attribtue-@taglib start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 处理标签中指定类型的属性，提取后新建节点管理
            // 处理标签中的 @taglib 属性
            return postobject.plugin("h85p-astedit-process-attribtue-@taglib", function(root, context) {
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

                    if (ary.length > 1) {
                        // 属性 @taglib 不能重复
                        throw new Err("duplicate attribute of @taglib", { ...context.input, ...ary[1].object.Name.pos });
                    }
                    if (/^(if|for|svgicon|router|router-link)$/.test(object.value)) {
                        throw new Err(`unsupport @taglib on tag <${object.value}>`, { ...context.input, ...ary[0].object.Name.pos });
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

    // ------- h85p-astedit-process-attribtue-@taglib end
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
            //   -- 非网络文件时，复制图片资源并哈希化
            //   -- 图片路径加上替换用模板，便于不同目录页面使用时替换为正确的相对目录
            //   -- 上下文中保存是否包含img标签的标记，便于判断是否需替换目录
            //   -- 检查文件是否存在，路径是否正确
            return postobject.plugin("j15p-astedit-process-tag-img", function(root, context) {
                root.walk(
                    "Tag",
                    (node, object) => {
                        if (!/^img$/i.test(object.value)) return;

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

                        if (!/^\s*http(s?):\/\//i.test(srcAttrNode.object.value)) {
                            // 非网络文件时，复制文件
                            let oImage = hashImageName(context, srcAttrNode);
                            if (oImage.code === -1) {
                                // 文件不存在
                                throw new Err("image file not found", { ...context.input, ...srcAttrNode.object.pos });
                            } else if (oImage.code === -2) {
                                // 不支持项目外文件（会引起版本管理混乱）
                                throw new Err("file should not out of project (" + oImage.file + ")", {
                                    ...context.input,
                                    ...srcAttrNode.object.pos
                                });
                            } else if (oImage.code === -3) {
                                // 不支持用绝对路径，避免换机器环境引起混乱
                                throw new Err("unsupport absolute file path", { ...context.input, ...srcAttrNode.object.pos });
                            }
                            // 修改成替换用目录，文件名用哈希
                            srcAttrNode.object.value = "%imagepath%" + oImage.name;
                            context.result.hasImg = true; // 上下文中保存是否包含img标签的标记，便于判断是否需替换目录

                            let refimages = (context.result.refimages = context.result.refimages || []);
                            !refimages.includes(oImage.file) && refimages.push(oImage.file); // 保存文件引用关系，便于文件修改删除时重新编译
                        }
                    },
                    { readonly: true }
                );
            });
        })()
    );

    function hashImageName(context, srcAttrNode) {
        let srcFile = context.input.file;
        let imgFile = srcAttrNode.object.value.trim();
        let code,
            name,
            file = File.resolve(srcFile, imgFile);
        if (!File.exists(file)) {
            code = -1; // 文件不存在
            return { file, name, code };
        }

        let env = bus.at("编译环境");
        if (!file.startsWith(env.path.root + "/")) {
            code = -2; // 不支持项目外文件（版本管理混乱）
            return { file, name, code };
        }
        if (imgFile === file) {
            code = -3; // 不支持用绝对路径（版本管理混乱）
            return { file, name, code };
        }

        name = hash({ file }) + File.extname(file); // 去除目录，文件名哈希化，后缀名不变

        let oCache = bus.at("缓存");
        let distDir = oCache.path + "/resources"; // 统一目录，资源都复制到 %缓存目录%/resources
        let distFile = distDir + "/" + name;
        if (!File.exists(distFile)) {
            !File.existsDir(distDir) && File.mkdir(distDir);
            fs.copyFileSync(file, distFile); // 复制文件
        }

        code = 0;
        return { file, name, code };
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
                        throw new Err("@ref unsupport the expression", { ...context.input, ...object.Value.pos });
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
                    $contextNode.object.value = "{this}";
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

    bus.on(
        "编译插件",
        (function() {
            // 转换处理指令节点 @ref
            return postobject.plugin("k25p-astedit-transform-attribtue-@if", function(root) {
                const OPTS = bus.at("视图编译选项");

                root.walk("@if", (node, object) => {
                    let tagNode = node.parent; // 所属标签节点
                    /^if$/i.test(tagNode.object.value) && (tagNode.ok = true);

                    let type = OPTS.TypeCodeBlock;
                    let value = "if (" + (object.value + "").replace(/^\s*\{=?/, "").replace(/\}\s*$/, "") + ") {";
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

    bus.on(
        "编译插件",
        (function() {
            // 转换处理指令节点 @show
            // 转换为 style中的 display 属性
            return postobject.plugin("k35p-astedit-transform-attribtue-@show", function(root) {
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
                        (object.value + "").replace(/^\{/, "").replace(/\}$/, "") +
                        ') ? "display:' +
                        object.display +
                        ';" : "display:none;"' +
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
                    let pos = object.pos;
                    let jsNode = this.createNode({ type, value, pos });
                    tagNode.before(jsNode);

                    value = "}";
                    jsNode = this.createNode({ type, value, pos });
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
        return new Err(msg, { ...context.input, ...object.Value.pos });
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
                        throw new Err("unsupport @taglib on standard tag", { ...context.input, ...object.Name.pos });
                    }

                    let tagName = tagNode.object.value; // 标签名
                    if (!tagName.startsWith("@")) {
                        // 标签名如果没有使用@前缀，要检查是否已存在有组件文件，有则报错
                        let cpFile = bus.at("标签项目源文件", tagNode.object.value); // 当前项目范围内查找标签对应的源文件
                        if (cpFile) {
                            throw new Err(`unsupport @taglib on existed component: ${tagNode.object.value}(${cpFile})`, {
                                ...context.input,
                                ...object.Name.pos
                            });
                        }
                    }

                    let pkg,
                        tag,
                        match,
                        attaglib = object.value;

                    if ((match = attaglib.match(/^\s*.+?\s*=\s*(.+?)\s*:\s*(.+?)\s*$/))) {
                        // @taglib = "name=@scope/pkg:component"
                        pkg = match[1];
                        tag = match[2];
                    } else if ((match = attaglib.match(/^\s*(.+?)\s*=\s*(.+?)\s*$/))) {
                        // @taglib = "name=@scope/pkg"
                        pkg = match[2];
                        tag = match[1];
                    } else if (attaglib.indexOf("=") >= 0) {
                        // @taglib = "=@scope/pkg"
                        throw new Err("invalid attribute value of @taglib", { ...context.input, ...object.Value.pos });
                    } else if ((match = attaglib.match(/^\s*(.+?)\s*:\s*(.+?)\s*$/))) {
                        // @taglib = "@scope/pkg:component"
                        pkg = match[1];
                        tag = match[2];
                    } else if ((match = attaglib.match(/^\s*(.+?)\s*$/))) {
                        // @taglib = "@scope/pkg"
                        pkg = match[1];
                        tag = tagName;
                    } else {
                        throw new Err("invalid attribute value of @taglib", { ...context.input, ...object.Value.pos });
                    }

                    tag.startsWith("@") && (tag = tag.substring(1)); // 去除组件名的@前缀

                    let install = bus.at("自动安装", pkg);
                    if (!install) {
                        throw new Err("package install failed: " + pkg, { ...context.input, ...object.Value.pos });
                    }

                    let taglib = bus.at("解析taglib", `${pkg}:${tag}`, context.input.file);
                    let srcFile = bus.at("标签库源文件", taglib); // 从指定模块查找
                    if (!srcFile) {
                        throw new Err("component not found: " + object.value, { ...context.input, ...object.Value.pos });
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
            // 按标签库更换标签全名
            return postobject.plugin(
                "k65p-astedit-transform-tag-name-by-[taglib]",
                function(root, context) {
                    let oPrjContext = bus.at("项目配置处理", context.input.file); // 项目配置解析结果
                    let oPrjTaglibs = oPrjContext.result.oTaglibs; // 项目[taglib]
                    let oTaglibs = context.result.oTaglibs || {}; // 组件[taglib]

                    root.walk("Tag", (node, object) => {
                        if (object.standard) return;

                        let taglib = oTaglibs[object.value] || oPrjTaglibs[object.value];
                        if (taglib) {
                            // 标签库中能找到的，按标签库更新为标签全名
                            let srcFile = bus.at("标签库源文件", taglib); // 从指定模块查找
                            if (!srcFile) {
                                throw new Err("component not found: " + object.value, { ...context.input, ...object.pos });
                            }

                            object.value = bus.at("标签全名", srcFile); // 替换为标签全名，如 @scope/pkg:ui-btn
                        }
                    });
                },
                { readonly: true }
            );
        })()
    );

    // ------- k65p-astedit-transform-tag-name-by-[taglib] end
})();

/* ------- k75p-astedit-transform-tag-name-by-buildin ------- */
(() => {
    // ------- k75p-astedit-transform-tag-name-by-buildin start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            // 针对特定的内置标签组件更换标签全名
            return postobject.plugin(
                "k75p-astedit-transform-tag-name-by-buildin",
                function(root) {
                    root.walk("Tag", (node, object) => {
                        if (object.standard) return;

                        if (/^router$/i.test(object.value)) {
                            object.value = "@rpose/buildin:router";
                        }
                        if (/^router-link$/i.test(object.value)) {
                            object.value = "@rpose/buildin:router-link";
                        }
                    });
                },
                { readonly: true }
            );
        })()
    );

    // ------- k75p-astedit-transform-tag-name-by-buildin end
})();

/* ------- k85p-astedit-transform-tag-if-for ------- */
(() => {
    // ------- k85p-astedit-transform-tag-if-for start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            // 内置for标签和if标签的转换
            // 前面已处理@for和@if，这里直接提升子节点就行了（节点无关属性全忽略）
            return postobject.plugin("k85p-astedit-transform-tag-if-for", function(root, context) {
                root.walk("Tag", (node, object) => {
                    if (!/^(if|for)$/i.test(object.value)) return;

                    if (!node.ok) {
                        throw new Err(`missing attribute @${object.value} of tag <${object.value}>`, { ...context.input, start: object.pos.start });
                    }

                    node.nodes.forEach(nd => {
                        nd.type !== "Attributes" && node.before(nd.clone()); // 子节点提升（节点无关属性全忽略）
                    });
                    node.remove(); // 删除本节点
                });
            });
        })()
    );

    // ------- k85p-astedit-transform-tag-if-for end
})();

/* ------- k95p-astedit-transform-tag-slot ------- */
(() => {
    // ------- k95p-astedit-transform-tag-slot start
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
            return postobject.plugin("k95p-astedit-transform-tag-slot", function(root, context) {
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
                            throw new Err(`missing attribute 'name' of tag <slot>`, { ...context.input, ...object.pos });
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
                            throw new Err(`missing attribute 'name' of tag <slot>`, { ...context.input, ...object.pos });
                        }
                        slots.push("");
                        nonameSlotNodes.push(node); // 暂存无名插槽
                        node.slotName = "";
                        return;
                    }
                    if (ary.length > 1) {
                        // 一个slot只能有一个name属性
                        throw new Err("duplicate attribute of name", { ...context.input, ...ary[1].object.Name.pos });
                    }

                    if (bus.at("是否表达式", ary[0].object.value)) {
                        // 插槽的属性 name 不能使用表达式
                        throw new Err("slot name unsupport the expression", { ...context.input, ...ary[0].object.Value.pos });
                    }

                    let name = ary[0].object.value + "";
                    if (slots.includes(name)) {
                        // slot不能重名
                        throw new Err("duplicate slot name: " + name, { ...context.input, ...ary[0].object.Value.pos });
                    }

                    slots.push(name);
                    !name && nonameSlotNodes.push(node); // 暂存无名插槽
                    node.slotName = name;
                });

                let slots = (context.result.slots = context.result.slots || []);
                if (slots.length > 1 && nonameSlotNodes.length) {
                    // 多个插槽时必须起名，且不能有重复
                    throw new Err(`missing slot name on tag <slot>`, { ...context.input, ...nonameSlotNodes[0].object.pos });
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

                    root.walk("View", nd => {
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

    // ------- k95p-astedit-transform-tag-slot end
})();

/* ------- m15p-astedit-check-and-fix-alias-@csslib-[csslib] ------- */
(() => {
    // ------- m15p-astedit-check-and-fix-alias-@csslib-[csslib] start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    const File = require("@gotoeasy/file");
    const findNodeModules = require("find-node-modules");

    const Alias = "DEFAULT_ALIAS_AUTO_ADD";

    bus.on(
        "编译插件",
        (function() {
            // 检查样式类名和样式库是否匹配
            // 如果匹配的是无名样式库，自动添加别名，便于后续查询样式
            return postobject.plugin("m15p-astedit-check-and-fix-alias-@csslib-[csslib]", function(root, context) {
                let oPrjContext = bus.at("项目配置处理", context.input.file);
                let oPrjCsslibs = oPrjContext.result.oCsslibs; // 项目[csslib]配置的样式库 (asname：lib)
                let oCsslibPkgs = context.result.oCsslibPkgs; // 组件[csslib]配置的样式库【别名-包名】映射关系
                let oCsslibs = context.result.oCsslibs; // 组件[csslib]配置的样式库 (asname：lib)
                let oAtCsslibPkgs = (context.result.oAtCsslibPkgs = context.result.oAtCsslibPkgs || {}); // 组件@csslib配置的样式库【别名-包名】映射关系
                let oAtCsslibs = (context.result.oAtCsslibs = context.result.oAtCsslibs || {}); // 组件@csslib配置的样式库 (asname：lib)

                root.walk("Class", (node, object) => {
                    // 查找@csslib属性节点，@csslib仅作用于当前所在标签
                    let atcsslibNode;
                    for (let i = 0, nd; (nd = node.parent.nodes[i++]); ) {
                        if (nd.type === "@csslib") {
                            atcsslibNode = nd;
                            break; // 找到
                        }
                    }

                    if (atcsslibNode) {
                        // ==============================================================================
                        // 当前节点有class、有@csslib
                        // ==============================================================================

                        // ---------------------------------
                        // 检查@csslib属性值
                        if (bus.at("是否表达式", object.value)) {
                            // @csslib属性值不能使用表达式
                            throw new Err("unsupport expression on @csslib", { ...context.input, ...atcsslibNode.object.Value.pos });
                        }

                        // ---------------------------------
                        // 解析@csslib
                        let csslib = bus.at("解析csslib", atcsslibNode.object.value, context.input.file);
                        if (!csslib) {
                            // 无效的@csslib格式
                            throw new Err("invalid @csslib value", { ...context.input, ...atcsslibNode.object.Value.pos });
                        }

                        // ---------------------------------
                        // 保存@csslib位置以备用
                        csslib.pos = { ...atcsslibNode.object.pos };

                        // ---------------------------------
                        // 检查别名冲突
                        if (oAtCsslibs[csslib.alias]) {
                            // 不能和组件内的其他@csslib有别名冲突 （冲突将导致js代码中的样式库类名困惑，无法判断进行正确的哈希改名）
                            throw new Err("duplicate csslib name [*]", { ...context.input, ...csslib.pos });
                        }
                        if (oCsslibs[csslib.alias]) {
                            // 不能和组件[csslib]有别名冲突
                            throw new Err("duplicate csslib name [*]", { ...context.input, ...csslib.pos });
                        }
                        if (oPrjCsslibs[csslib.alias]) {
                            // 不能和项目[csslib]有别名冲突
                            throw new Err("duplicate csslib name [*]", { ...context.input, ...csslib.pos });
                        }

                        // ---------------------------------
                        // 设定目标目录的绝对路径
                        let dir;
                        if (csslib.pkg.startsWith("~")) {
                            // 如果是目录，检查目录是否存在
                            let root = bus.at("文件所在项目根目录", context.input.file);
                            dir = csslib.pkg.replace(/\\/g, "/").replace(/^~\/*/, root + "/");
                            if (!File.existsDir(dir)) {
                                throw new Err("folder not found [" + dir + "]", { ...context.input, ...csslib.pos });
                            }
                        } else {
                            // 自动安装
                            if (!bus.at("自动安装", csslib.pkg)) {
                                throw new Err("package install failed: " + csslib.pkg, { ...context.input, ...csslib.pos });
                            }

                            dir = getNodeModulePath(csslib.pkg);
                            if (!dir) {
                                // 要么安装失败，或又被删除，总之不应该找不到安装位置
                                throw new Err("package install path not found: " + csslib.pkg, { ...context.input, ...csslib.pos });
                            }
                        }
                        csslib.dir = dir; // 待导入的样式文件存放目录

                        // ---------------------------------
                        // 创建@csslib样式库
                        let atcsslib = bus.at("样式库", csslib, context.input.file);
                        if (atcsslib.isEmpty) {
                            throw new Err("css file not found", {
                                file: context.input.file,
                                text: context.input.text,
                                start: csslib.pos.start,
                                end: csslib.pos.end
                            });
                        }
                        oAtCsslibs[csslib.alias] = atcsslib; // 存起来备查
                        oAtCsslibPkgs[csslib.alias] = atcsslib.pkg; // 保存样式库匿名关系，用于脚本类名转换
                        atcsslib.isAtCsslib = true;
                        atcsslib.attag = node.parent.object.standard ? node.parent.object.value : ""; // 保存当前标准标签名，便于@csslib查询样式库

                        // ---------------------------------
                        // 检查当前标签的样式类，并修改添加实际库名@后缀
                        let oCsslibPC;
                        for (let i = 0, ary, oCls, clsname, atname; (oCls = object.classes[i++]); ) {
                            ary = oCls.Name.value.split("@");
                            clsname = "." + ary[0]; // 类名
                            atname = ary.length > 1 ? ary[1] : ""; // 库别名

                            if (atname) {
                                // 样式类有别名
                                if (csslib.alias === atname) {
                                    // @csslib库匹配成功，但找不到样式类，报错
                                    if (!atcsslib.has(clsname)) {
                                        throw new Err(`class "${clsname}" not found in @csslib "${atname}"`, {
                                            ...context.input,
                                            start: oCls.Name.start,
                                            end: oCls.Name.end
                                        });
                                    }
                                } else {
                                    oCsslibPC = oCsslibs[atname] || oPrjCsslibs[atname];
                                    if (oCsslibPC) {
                                        // [csslib]库匹配成功，但找不到样式类，报错
                                        if (!oCsslibPC.has(clsname)) {
                                            throw new Err(`class "${clsname}" not found in [csslib] "${atname}"`, {
                                                ...context.input,
                                                start: oCls.Name.start,
                                                end: oCls.Name.end
                                            });
                                        }
                                    } else {
                                        // 找不到指定别名的样式库，报错
                                        throw new Err(`csslib not found "${atname}"`, {
                                            ...context.input,
                                            start: oCls.Name.start,
                                            end: oCls.Name.end
                                        });
                                    }
                                }
                            } else {
                                // 样式类无别名
                                if (csslib.alias === "*" && atcsslib.has(clsname)) {
                                    // 无名@csslib库匹配成功，且能找到样式类，起个别名添加
                                    oCls.Name.value = ary[0] + "@" + Alias; // 给@csslib无名样式库起一个哈希码别名
                                    oAtCsslibs[Alias] = atcsslib; // 自动配置一个同一别名的@csslib样式库
                                    oAtCsslibPkgs[Alias] = atcsslib.pkg; // 保存样式库匿名关系，用于脚本类名转换
                                } else {
                                    oCsslibPC = oCsslibs["*"] || oPrjCsslibs["*"];
                                    if (oCsslibPC && oCsslibPC.has(clsname)) {
                                        oCls.Name.value = ary[0] + "@" + Alias; // 给[csslib]无名样式库起一个哈希码别名
                                        oCsslibs[Alias] = oCsslibPC; // 自动配置一个同一别名的组件[csslib]样式库
                                        oCsslibPkgs[Alias] = oCsslibPC.pkg; // 保存样式库匿名关系，用于脚本类名转换
                                    }
                                }
                            }
                        }

                        atcsslibNode.remove(); // @csslib的样式已生成，该节点删除
                    } else {
                        // ==============================================================================
                        // 当前节点有class，但没有@csslib，做class的样式库别名检查 （理应分离检查，暂且先这样）
                        // ==============================================================================

                        // ---------------------------------
                        // 检查当前标签的样式类，并修改添加实际库名@后缀
                        let oCsslibPC;
                        for (let i = 0, ary, oCls, clsname, atname; (oCls = object.classes[i++]); ) {
                            ary = oCls.Name.value.split("@");
                            clsname = "." + ary[0]; // 类名
                            atname = ary.length > 1 ? ary[1] : ""; // 库别名

                            if (atname) {
                                // 样式类有别名
                                oCsslibPC = oCsslibs[atname] || oPrjCsslibs[atname];
                                if (oCsslibPC) {
                                    // [csslib]库匹配成功，但找不到样式类，报错
                                    if (!oCsslibPC.has(clsname)) {
                                        throw new Err(`class "${clsname}" not found in [csslib] "${atname}"`, {
                                            file: context.input.file,
                                            text: context.input.text,
                                            start: oCls.Name.start,
                                            end: oCls.Name.end
                                        });
                                    }
                                } else {
                                    // 找不到指定别名的样式库，报错
                                    throw new Err(`csslib not found "${atname}"`, {
                                        file: context.input.file,
                                        text: context.input.text,
                                        start: oCls.Name.start,
                                        end: oCls.Name.end
                                    });
                                }
                            } else {
                                // 样式类无别名
                                oCsslibPC = oCsslibs["*"] || oPrjCsslibs["*"];
                                if (oCsslibPC && oCsslibPC.has(clsname)) {
                                    oCls.Name.value = ary[0] + "@" + Alias; // 给[csslib]无名样式库起一个哈希码别名
                                    oCsslibs[Alias] = oCsslibPC; // 自动配置一个同一别名的组件[csslib]样式库
                                    oCsslibPkgs[Alias] = oCsslibPC.pkg; // 保存样式库匿名关系，用于脚本类名转换
                                }
                            }
                        }
                    }
                });
            });
        })()
    );

    // 找不到时返回undefined
    function getNodeModulePath(npmpkg) {
        let node_modules = [...findNodeModules({ cwd: process.cwd(), relative: false }), ...findNodeModules({ cwd: __dirname, relative: false })];
        for (let i = 0, modulepath, dir; (modulepath = node_modules[i++]); ) {
            dir = File.resolve(modulepath, npmpkg);
            if (File.existsDir(dir)) {
                return dir;
            }
        }
    }

    // ------- m15p-astedit-check-and-fix-alias-@csslib-[csslib] end
})();

/* ------- m25p-astedit-remove-blank-text ------- */
(() => {
    // ------- m25p-astedit-remove-blank-text start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("m25p-astedit-remove-blank-text", function(root) {
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

    // ------- m25p-astedit-remove-blank-text end
})();

/* ------- m35p-astedit-remove-html-comment ------- */
(() => {
    // ------- m35p-astedit-remove-html-comment start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("m35p-astedit-remove-html-comment", function(root) {
                const OPTS = bus.at("视图编译选项");

                root.walk(OPTS.TypeHtmlComment, node => {
                    node.remove(); // 删除注释节点
                });
            });
        })()
    );

    // ------- m35p-astedit-remove-html-comment end
})();

/* ------- m45p-astedit-join-text-node ------- */
(() => {
    // ------- m45p-astedit-join-text-node start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("m45p-astedit-join-text-node", function(root) {
                const OPTS = bus.at("视图编译选项");

                // TODO 用选项常量
                root.walk(/^(Text|Expression)$/, node => {
                    // 合并连续的文本节点
                    let ary = [node];
                    let nAfter = node.after();
                    while (nAfter && (nAfter.type === OPTS.TypeText || nAfter.type === OPTS.TypeExpression)) {
                        ary.push(nAfter);
                        nAfter = nAfter.after();
                    }

                    if (ary.length < 2) return;

                    let aryRs = [];
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
                    let start = ary[0].object.pos.start;
                    let end = ary[ary.length - 1].object.pos.end;
                    let pos = { start, end };
                    let tNode = this.createNode({ type: OPTS.TypeExpression, value, pos });
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

    // ------- m45p-astedit-join-text-node end
})();

/* ------- m55p-astedit-remove-jscode-blank-comment ------- */
(() => {
    // ------- m55p-astedit-remove-jscode-blank-comment start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("m55p-astedit-remove-jscode-blank-comment", function(root) {
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
    // ------- m55p-astedit-remove-jscode-blank-comment end
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
                    .replace(/'/g, "\\'");
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
        $$el = $$('.' + $this.$COMPONENT_ID);
        if ( $$el.length ){
            vnode = $this.vnodeTemplate($private.state, $private.options);          // 生成新的虚拟节点数据
            rpose.diffRender($this, vnode);                                         // 差异渲染
            return $$el[0];
        }else{
            console.warn('dom node missing');                                       // 组件根节点丢失无法再次渲染
        }

    }
    <% } %>

    <% if ( $data['methods'] ){ %>
    // 自定义方法
    <%= $data['methods'] %>
    <% } %>

    // 虚拟节点数据
    // r：是否组件根节点、x：静态节点标识、k：节点标识、K：自定义节点标识
    // t：标签名、c：子节点数组、a：属性对象、e：事件对象、s：文本、m：组件标签标识、g：svg标签或svg子标签标识
    <%= $data['vnodeTemplate'] %>
}
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

/* ------- p15p-component-reference-components ------- */
(() => {
    // ------- p15p-component-reference-components start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("p15p-component-reference-components", function(root, context) {
                let result = context.result;
                let oSet = new Set();
                root.walk(
                    "Tag",
                    (node, object) => {
                        if (!object.standard) {
                            let file = bus.at("标签源文件", object.value, context.result.oTaglibs);
                            if (!file) {
                                throw new Err("file not found of tag: " + object.value, { ...context.input, start: object.pos.start });
                            }
                            let tagpkg = bus.at("标签全名", file);
                            oSet.add(tagpkg);
                        }
                    },
                    { readonly: true }
                );

                result.references = [...oSet]; // 依赖的组件【标签全名】
            });
        })()
    );

    // ------- p15p-component-reference-components end
})();

/* ------- p17p-component-reference-standard-tags ------- */
(() => {
    // ------- p17p-component-reference-standard-tags start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("p17p-component-reference-standard-tags", function(root, context) {
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

    // ------- p17p-component-reference-standard-tags end
})();

/* ------- p20m-component-astgen-node-attributes ------- */
(() => {
    // ------- p20m-component-astgen-node-attributes start
    const bus = require("@gotoeasy/bus");

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
                    ary = [],
                    hasInner = false;
                ary.push(`{ `);
                attrsNode.nodes.forEach(node => {
                    key = '"' + lineString(node.object.name) + '"';
                    if (node.object.isExpression) {
                        value = bus.at("表达式代码转换", node.object.value);
                    } else if (typeof node.object.value === "string") {
                        let eventName = node.object.name;
                        if (!tagNode.object.standard && bus.at("是否HTML标准事件名", eventName) && !node.object.isExpression) {
                            // 组件上的标准事件属性，支持硬编码直接指定方法名 （如果在methods中有定义，顺便就办了，免得一定要写成表达式）
                            let fnNm = node.object.value.trim();
                            if (context.script.Method[fnNm]) {
                                // 能找到定义的方法则当方法处理
                                value = `this.${fnNm}`; // fnClick => this.fnClick
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

                    !hasInner && /(innerHTML|innerTEXT|textContent)/i.test(key) && (hasInner = true); // 是否含 innerHTML|innerTEXT|textContent 属性（不区分大小写）
                });
                ary.push(` } `);

                return { hasInner, result: ary.join("\n") };
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

                // 检查汇总
                let key,
                    value,
                    map = new Map();
                eventsNode.nodes.forEach(node => {
                    key = node.object.name.substring(2).toLowerCase(); // onclick => click
                    value = node.object.value;
                    if (node.object.isExpression) {
                        value = bus.at("表达式代码转换", value); // { abcd } => (abcd)
                    } else {
                        // 静态定义时顺便检查
                        value = value.trim();
                        let match = value.match(/^this\s*\.(.+)$/) || value.match(/^this\s*\[\s*['"](.+)['"]\s*]/);
                        let fnNm = match ? match[1] : value; // this.fnClick => fnClick, this['fnClick'] => fnClick, fnClick => fnClick
                        if (context.script.Method[fnNm]) {
                            value = "this." + fnNm; // fnClick => this.fnClick
                        } else {
                            // 指定方法找不到
                            let names = Object.keys(context.script.Method);
                            let msg = `event handle not found (${fnNm})${names.length ? "\n  etc. " + names.join("/") : ""}`;
                            throw new Err(msg, { ...context.input, ...node.object.Value.pos });
                        }
                    }

                    let ary = map.get(key) || [];
                    !map.has(key) && map.set(key, ary);
                    ary.push(value);
                });

                // 生成
                let comma = "",
                    ary = [];
                ary.push(`{ `);
                map.forEach((values, eventName) => {
                    if (values.length > 1) {
                        let stmts = [];
                        values.forEach(v => {
                            stmts.push(v + "(e);");
                        });
                        ary.push(` ${comma} ${eventName}: ( e=>{ ${stmts.join("\n")} } )`);
                    } else {
                        ary.push(` ${comma} ${eventName}: ${value} `);
                    }
                    !comma && (comma = ",");
                });
                ary.push(` } `);

                return ary.join("\n");
            };
        })()
    );

    // ------- p22m-component-astgen-node-events end
})();

/* ------- p24m-component-astgen-node-@key ------- */
(() => {
    // ------- p24m-component-astgen-node-@key start
    const bus = require("@gotoeasy/bus");

    bus.on(
        "astgen-node-@key",
        (function() {
            // 转换处理指令节点 @key 取其值作为最终K属性值
            return function(tagNode) {
                if (!tagNode.nodes) return "";

                // 查找检查事件属性节点
                let atkeyNode;
                for (let i = 0, nd; (nd = tagNode.nodes[i++]); ) {
                    if (nd.type === "@key") {
                        atkeyNode = nd;
                        break; // 找到
                    }
                }
                if (!atkeyNode) return "";

                let value = atkeyNode.object.value;
                if (atkeyNode.object.isExpression) {
                    value = bus.at("表达式代码转换", value); // { abcd } => (abcd)
                } else {
                    value = '"' + lineString((value + "").trim()) + '"'; // 硬编码的强制转为字符串
                }

                return value;
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
        if (quote == '"') {
            rs = rs.replace(/"/g, '\\"');
        } else if (quote == "'") {
            rs = rs.replace(/'/g, "\\'");
        }
        return rs;
    }

    // ------- p24m-component-astgen-node-@key end
})();

/* ------- p24m-component-astgen-node-text ------- */
(() => {
    // ------- p24m-component-astgen-node-text start
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
        ary.push(` ,k: ${context.keyCounter++} `); // 节点标识（便于运行期差异比较优化）
        ary.push(`}`);

        return ary.join("\n");
    }

    function expressionJsify(node, context) {
        let obj = node.object; // 当前节点数据对象

        let ary = [];
        let text = obj.value.replace(/^\s*\{/, "(").replace(/\}\s*$/, ")"); // 去除前后大括号{}，换为小括号包围起来确保正确 // TODO 按选项设定替换
        ary.push(`{ `);
        ary.push(`  s: ${text} `); // 一般是动态文字，也可以是静态
        ary.push(` ,k: ${context.keyCounter++} `); // 节点标识（便于运行期差异比较优化）
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

    // ------- p24m-component-astgen-node-text end
})();

/* ------- p26m-component-astgen-node-style ------- */
(() => {
    // ------- p26m-component-astgen-node-style start
    const bus = require("@gotoeasy/bus");

    bus.on(
        "astgen-node-style",
        (function() {
            // 标签样式属性生成json属性值形式代码
            // "size:12px;color:{color};height:100;" => ("size:12px;color:" + (color) + ";height:100;")
            // @show在前面已转换为display一起合并进style
            return function(tagNode) {
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

    // ------- p26m-component-astgen-node-style end
})();

/* ------- p28m-component-astgen-node-class ------- */
(() => {
    // ------- p28m-component-astgen-node-class start
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
                return parseClassesToObjectString(classNode, context);
            };
        })()
    );

    function parseClassesToObjectString(classNode, context) {
        let oPrjContext = bus.at("项目配置处理", context.input.file);
        let oAllCsslibs = Object.assign({}, oPrjContext.result.oCsslibs, context.result.oCsslibs, context.result.oAtCsslibs);

        let classes = classNode.object.classes;
        let rs = [];
        for (let i = 0, oCls, ary, clspkg, clas, expr, csslib; (oCls = classes[i++]); ) {
            ary = oCls.Name.value.split("@");
            if (ary.length > 1) {
                // 别名库样式，把别名改成真实库名 (无别名样式也都已自动添加别名)
                csslib = oAllCsslibs[ary[1]];
                if (!csslib) {
                    // 理应检查过，不该发生
                    throw new Err("csslib not found: " + ary[1], {
                        file: context.input.file,
                        text: context.input.text,
                        start: oCls.Name.start,
                        end: oCls.Name.end
                    });
                }
                clspkg = ary[0] + "@" + csslib.pkg;
            } else {
                // 普通无别名样式类
                clspkg = oCls.Name.value;
            }

            clas = bus.at("哈希样式类名", context.input.file, clspkg);
            expr = oCls.Expr.value;

            rs.push(`'${clas}': (${expr})`); // 'class' : (expr)
        }

        return "{" + rs.join(",") + "}";
    }

    // ------- p28m-component-astgen-node-class end
})();

/* ------- p30m-component-astgen-node-{prop} ------- */
(() => {
    // ------- p30m-component-astgen-node-{prop} start
    const bus = require("@gotoeasy/bus");

    bus.on(
        "astgen-node-{prop}",
        (function() {
            // 标签对象表达式属性生成对象复制语句代码片段
            // 如 {prop1} {prop2}，最终rpose.assign( {attrs属性对象}, prop1, prop2)
            // 生成： (prop1), (prop2)
            return function(tagNode) {
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

    // ------- p30m-component-astgen-node-{prop} end
})();

/* ------- p32m-component-astgen-node-tag ------- */
(() => {
    // ------- p32m-component-astgen-node-tag start
    const bus = require("@gotoeasy/bus");

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
        let oAttrsRs = bus.at("astgen-node-attributes", node, context); // 属性结果对象
        let attrs = oAttrsRs.result;
        let childrenJs = "";
        if (!oAttrsRs.hasInner) {
            // 不含 innerHTML|innerTEXT|textContent 属性时生成子节点，否则忽略子节点
            childrenJs = bus.at("astgen-node-tag-nodes", node.nodes, context); // 子节点代码，空白或 [{...},{...},{...}]
        }
        let events = bus.at("astgen-node-events", node, context);
        let isSvg = node.object.svg; // 是否svg标签或svg子标签
        let atkey = bus.at("astgen-node-@key", node, context); // @key的值

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
            attrs = attrs ? `rpose.assign( ${attrs}, ${props})` : `${props}`; // 有其他属性时用对象复制形式合并，否则直接赋值
        }

        let ary = [];
        ary.push(`{ `);
        ary.push(`  t: '${obj.value}' `); // 标签名
        isTop && ary.push(` ,r: 1 `); // 顶部节点标识
        isStatic && ary.push(` ,x: 1 `); // 静态节点标识（当前节点和子孙节点没有变量不会变化）
        isComponent && ary.push(` ,m: 1 `); // 组件标签节点标识（便于运行期创建标签或组件）
        isSvg && ary.push(` ,g: 1 `); // svg标签或svg子标签标识
        !atkey && ary.push(` ,k: ${context.keyCounter++} `); // 节点标识（便于运行期差异比较优化）
        atkey && ary.push(` ,K: ${atkey} `); // 自定义节点标识（便于运行期差异比较优化）
        childrenJs && ary.push(` ,c: ${childrenJs} `); // 子节点数组
        attrs && ary.push(` ,a: ${attrs} `); // 属性对象
        events && ary.push(` ,e: ${events} `); // 事件对象
        ary.push(`}`);

        return ary.join("\n");
    }

    // TODO
    function isStaticTagNode(/* node */) {
        return false;
    }

    // ------- p32m-component-astgen-node-tag end
})();

/* ------- p34m-component-astgen-node-tag-nodes ------- */
(() => {
    // ------- p34m-component-astgen-node-tag-nodes start
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

        let keyCounter = context.keyCounter; // 保存原节点标识值
        context.keyCounter = 1; // 重新设定节点标识（令其按在同一组子节点单位内递增）

        let rs = hasCodeBolck(nodes) ? nodesWithScriptJsify(nodes, context) : nodesWithoutScriptJsify(nodes, context);

        context.keyCounter = keyCounter; // 还原节点标识值
        return rs;
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
        return ary.length ? "[" + ary.join(",\n") + "]" : ""; // 空白或 [{...},{...},{...}]
    }

    function hasCodeBolck(nodes) {
        for (let i = 0, node; (node = nodes[i++]); ) {
            if (node.type === "JsCode") {
                return true;
            }
        }
        return false;
    }

    // ------- p34m-component-astgen-node-tag-nodes end
})();

/* ------- s15p-component-ast-jsify-writer ------- */
(() => {
    // ------- s15p-component-ast-jsify-writer start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const File = require("@gotoeasy/file");

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
            return this.ary.join("\n");
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
    const Err = require("@gotoeasy/err");

    const AryNm = "v_Array";

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("s25p-component-ast-jsify-root", function(root, context) {
                let writer = context.writer;
                let script = context.script;

                root.walk("View", node => {
                    if (!node.nodes || node.nodes.length < 1) {
                        return writer.write("// 没有节点，无可生成");
                    }

                    // writer.write( 'function nodeTemplate($state, $options, $actions, $this) {' );
                    writer.write("vnodeTemplate($state, $options) {");
                    if (hasCodeBolck(node.nodes)) {
                        writer.write(`${topNodesWithScriptJsify(node.nodes, context)}`); // 含代码块子节点
                    } else {
                        writer.write(`${topNodesWithoutScriptJsify(node.nodes, context)}`); // 无代码块子节点
                    }
                    writer.write("}");

                    // 视图的模板函数源码
                    script.vnodeTemplate = writer.toString();

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
            let start = nodes[1].object.pos.start;
            nodes[0].type !== "Tag" && (start = nodes[0].object.pos.start);
            throw new Err("invalid top tag", { text, file, start }); // 组件顶部只能有一个标签
        }

        let src,
            node = nodes[0];
        if (node.type !== "Tag") {
            let text = context.input.text;
            let file = context.input.file;
            let start = nodes[0].object.pos.start;
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
    //const Err = require('@gotoeasy/err');
    const traverse = require("@babel/traverse").default;
    const types = require("@babel/types");
    const babel = require("@babel/core");
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
                let oPrjContext = bus.at("项目配置处理", context.input.file);
                let oPrjCsslibs = oPrjContext.result.oCsslibs; // 项目[csslib]配置的样式库 (asname：lib)
                let oCsslibs = context.result.oCsslibs; // 组件[csslib]配置的样式库 (asname：lib)
                let oAtCsslibs = (context.result.oAtCsslibs = context.result.oAtCsslibs || {}); // 组件@csslib配置的样式库 (asname：lib)

                let script = context.script;
                let reg = /(\.getElementsByClassName\s*\(|\.toggleClass\s*\(|\.querySelector\s*\(|\.querySelectorAll\s*\(|\$\s*\(|addClass\(|removeClass\(|classList)/;

                let classnames = (script.classnames = script.classnames || []); // 脚本代码中用到的样式类，存起来后续继续处理

                if (script.methods && reg.test(script.methods)) {
                    // 编辑修改script
                    transformJsSelector(script, context.input.file, classnames, oAtCsslibs, oCsslibs, oPrjCsslibs);
                }

                // 脚本中用到的类，检查样式库是否存在，检查类名是否存在
                if (classnames.length) {
                    // 查库取样式，把样式库别名改成真实库名
                    for (let i = 0, clspkg, clsname, asname, ary, csslib; (clspkg = classnames[i++]); ) {
                        ary = clspkg.split("@");
                        clsname = "." + ary[0]; // 类名
                        asname = ary.length > 1 ? ary[1] : "*"; // 库别名

                        if (asname !== "*") {
                            // 别名样式类，按需引用别名库
                            csslib = oAtCsslibs[asname] || oCsslibs[asname] || oPrjCsslibs[asname];
                            if (!csslib) {
                                // 指定别名的样式库不存在
                                throw new Error("csslib not found: " + asname + "\nfile: " + context.input.file); // TODO 友好定位提示
                            }

                            if (!csslib.has(clsname)) {
                                // 指定样式库中找不到指定的样式类，无名库的话可以是纯js控制用，非无名库就是要引用样式，不存在就得报错
                                throw new Error("css class not found: " + clspkg + "\nfile: " + context.input.file); // TODO 友好定位提示
                            }
                        }
                    }
                }
            });
        })()
    );

    // babel@7.*
    function transformJsSelector(oScript, srcFile, classnames, oAtCsslibs, oCsslibs, oPrjCsslibs) {
        let ast = oScript.ast; // 复用[methods]解析的ast
        let oSetPath = new Set();

        traverse(ast, {
            StringLiteral(path) {
                if (!path.parentPath.isCallExpression()) return; // 不是函数调用，跳过
                if (oSetPath.has(path)) return; // 已处理的跳过（避免重复处理死循环）

                if (path.parentPath.node.callee.type === "Identifier") {
                    let fnName = path.parentPath.node.callee.name;
                    if (fnName === "$$" || fnName === "$") {
                        let selector = path.node.value;
                        selector = transformSelector(selector, srcFile, classnames, oAtCsslibs, oCsslibs, oPrjCsslibs); // $$('div > .foo'), $('div > .bar')
                        path.replaceWith(types.stringLiteral(selector));

                        oSetPath.add(path); // 已处理的path
                    }
                } else if (path.parentPath.node.callee.type === "MemberExpression" && path.parentPath.node.callee.property) {
                    let fnName = path.parentPath.node.callee.property.name || path.parentPath.node.callee.property.value; // foo.bar() => bar, foo['bar']() => bar
                    if (fnName === "getElementsByClassName" || fnName === "toggleClass") {
                        // document.getElementsByClassName('foo'), $$el.toggleClass('foo')

                        let classname = path.node.value;
                        let pkgcls = getClassPkg(classname, srcFile, oAtCsslibs, oCsslibs, oPrjCsslibs);
                        classname = bus.at("哈希样式类名", srcFile, pkgcls);
                        classnames.push(classname); // 脚本中用到的类，存起来查样式库使用
                        path.replaceWith(types.stringLiteral(classname));
                        oSetPath.add(path); // 已处理的path
                    } else if (fnName === "querySelector" || fnName === "querySelectorAll") {
                        // document.querySelector('div > .foo'), document.querySelectorAll('div > .bar')

                        let selector = path.node.value;
                        selector = transformSelector(selector, srcFile, classnames, oAtCsslibs, oCsslibs, oPrjCsslibs); // $$('div > .foo'), $('div > .bar')
                        path.replaceWith(types.stringLiteral(selector));

                        oSetPath.add(path); // 已处理的path
                    } else if (fnName === "addClass" || fnName === "removeClass") {
                        // $$el.addClass('foo bar'), $$el.removeClass('foo bar')

                        let rs = [],
                            ary = path.node.value.trim().split(/\s+/);
                        ary.forEach(cls => {
                            let pkgcls = getClassPkg(cls, srcFile, oAtCsslibs, oCsslibs, oPrjCsslibs);
                            rs.push(bus.at("哈希样式类名", srcFile, pkgcls));
                            classnames.push(cls); // 脚本中用到的类，存起来查样式库使用
                        });

                        let classes = rs.join(" ");
                        path.replaceWith(types.stringLiteral(classes));

                        oSetPath.add(path); // 已处理的path
                    } else if (fnName === "add" || fnName === "remove") {
                        // el.classList.add('foo'), el.classList.remove('bar')
                        if (
                            path.parentPath.node.callee.object.type === "MemberExpression" &&
                            path.parentPath.node.callee.object.property.name === "classList"
                        ) {
                            let classname = path.node.value;
                            let pkgcls = getClassPkg(classname, srcFile, oAtCsslibs, oCsslibs, oPrjCsslibs);
                            classname = bus.at("哈希样式类名", srcFile, pkgcls);
                            classnames.push(classname); // 脚本中用到的类，存起来查样式库使用
                            path.replaceWith(types.stringLiteral(classname));
                            oSetPath.add(path); // 已处理的path
                        } else {
                            return;
                        }
                    } else {
                        return;
                    }
                }
            }
        });

        if (oSetPath.size) {
            let code = babel.transformFromAstSync(ast).code;
            code = code.substring(10, code.length - 2);
            oScript.methods = code;
        }

        return delete oScript.ast; // 按说已经用不到了，删除之
    }

    function transformSelector(selector, srcFile, classnames, oAtCsslibs, oCsslibs, oPrjCsslibs) {
        selector = selector.replace(/@/g, "鬱");
        let ast = tokenizer.parse(selector);
        let classname,
            pkgcls,
            nodes = ast.nodes || [];
        nodes.forEach(node => {
            if (node.type === "selector") {
                (node.nodes || []).forEach(nd => {
                    if (nd.type === "class") {
                        classname = nd.name;
                        pkgcls = getClassPkg(classname, srcFile, oAtCsslibs, oCsslibs, oPrjCsslibs);
                        nd.name = bus.at("哈希样式类名", srcFile, pkgcls);
                        classnames.push(classname); // 脚本中用到的类，存起来查样式库使用
                    }
                });
            }
        });

        let rs = tokenizer.stringify(ast);
        return rs.replace(/鬱/g, "@");
    }

    // 替换js代码中的样式库别名为实际库名，检查样式库是否存在
    function getClassPkg(cls, srcFile, oAtCsslibs, oCsslibs, oPrjCsslibs) {
        let ary = cls.trim().split(/鬱|@/);
        if (ary.length > 1) {
            let asname = ary[1];
            let csslib = oAtCsslibs[asname] || oCsslibs[asname] || oPrjCsslibs[asname]; // 找出别名对应的实际库名
            if (!csslib) {
                throw new Error("csslib not found: " + ary[0] + "@" + ary[1] + "\nfile: " + srcFile); // js代码中类选择器指定的csslib未定义导致找不到 TODO 友好定位提示
            }
            return ary[0] + "@" + csslib.pkg; // 最终按实际别名对应的实际库名进行哈希
        } else {
            let nonameCsslib = oAtCsslibs["*"] || oCsslibs["*"] || oPrjCsslibs["*"];
            if (nonameCsslib && nonameCsslib.has("." + ary[0])) {
                return ary[0] + "@" + nonameCsslib.pkg; // 无名库，也按实际别名对应的实际库名进行哈希
            }
        }

        return ary[0];
    }

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

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("s45p-component-gen-js", function(root, context) {
                let env = bus.at("编译环境");
                let result = context.result;
                let script = context.script;

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
                //  $data.actions = script.actions;
                $data.methods = script.methods;
                $data.Method = script.Method;
                script.bindfns && script.bindfns.length && ($data.bindfns = script.bindfns); // 有则设之
                $data.vnodeTemplate = script.vnodeTemplate;

                // 生成组件JS源码
                result.componentJs = fnTmpl($data);
                result.componentJs = checkAndInitVars(result.componentJs, context);

                // 非release模式时输出源码便于确认
                if (!env.release) {
                    let fileJs = bus.at("组件目标临时JS文件名", context.input.file);
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
            scopes = bus.at("查找未定义变量", src);
            if (!scopes.length) return src; // 正常，直接返回
        } catch (e) {
            throw Err.cat("source syntax error", "\n-----------------", src, "\n-----------------", "file=" + context.input.file, e); // 多数表达式中有语法错误导致
        }

        // 函数内部添加变量声明赋值后返回
        let vars = [];
        for (let i = 0, name; (name = scopes[i++]); ) {
            let inc$opts = optionkeys.includes(name);
            let inc$state = statekeys.includes(name);

            // TODO 优化提示定位
            if (!inc$opts && !inc$state) {
                let msg = "template variable undefined: " + name;
                msg += "\n  file: " + context.input.file;
                throw new Err(msg); // 变量不在$state或$options的属性范围内
            }
            if (inc$opts && inc$state) {
                let msg = "template variable uncertainty: " + name;
                msg += "\n  file: " + context.input.file;
                throw new Err(msg); // 变量同时存在于$state和$options，无法自动识别来源，需指定
            }

            if (inc$state) {
                vars.push(`let ${name} = $state.${name};`);
            } else if (inc$opts) {
                vars.push(`let ${name} = $options.${name};`);
            }
        }

        return src.replace(/(\n\s*vnodeTemplate\s*\(\s*\$state\s*,\s*\$options\s*\)\s*{\r?\n)/, "$1" + vars.join("\n"));
    }

    // ------- s45p-component-gen-js end
})();

/* ------- s50m-component-css-classname-rename ------- */
(() => {
    // ------- s50m-component-css-classname-rename start
    const bus = require("@gotoeasy/bus");
    const postcss = require("postcss");
    const tokenizer = require("css-selector-tokenizer");

    bus.on(
        "组件样式类名哈希化",
        (function() {
            return function(srcFile, css) {
                let fnPostcssPlugin = root => {
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

/* ------- s55p-component-query-css-@csslib-[csslib] ------- */
(() => {
    // ------- s55p-component-query-css-@csslib-[csslib] start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");

    const Alias = "DEFAULT_ALIAS_AUTO_ADD";

    bus.on(
        "编译插件",
        (function() {
            // 组件单位按需查询引用样式库
            return postobject.plugin("s55p-component-query-css-@csslib-[csslib]", function(root, context) {
                let oPrjContext = bus.at("项目配置处理", context.input.file);
                let oPrjCsslibs = oPrjContext.result.oCsslibs; // 项目[csslib]配置的样式库 (asname：lib)
                let oCsslibs = context.result.oCsslibs; // 组件[csslib]配置的样式库 (asname：lib)
                let oAtCsslibs = (context.result.oAtCsslibs = context.result.oAtCsslibs || {}); // 组件@csslib配置的样式库 (asname：lib)

                let style = context.style;
                let oCssSet = (style.csslibset = style.csslibset || new Set()); // 组件单位样式库引用的样式
                let scriptclassnames = context.script.classnames;
                let hashClassName = bus.on("哈希样式类名")[0];
                let rename = (pkg, cls) => hashClassName(context.input.file, cls + "@" + pkg); // 自定义改名函数
                let strict = true; // 样式库严格匹配模式
                let universal = false; // 不查取通用样式
                let opts = { rename, strict, universal };

                let ary,
                    oQuerys = {};
                let nonameCsslibPC = oCsslibs["*"] || oPrjCsslibs["*"]; // 组件或项目[csslib]配置的无名样式库对象（别名为*）
                root.walk("Class", (node, object) => {
                    // 按样式库单位汇总组件内全部样式类
                    for (let i = 0, oCls, clsname, asname; (oCls = object.classes[i++]); ) {
                        ary = oCls.Name.value.split("@");
                        clsname = "." + ary[0]; // 类名
                        asname = ary.length > 1 ? ary[1] : ""; // 库别名 (无名库都已自动添加@别名后缀)

                        // 前面已做别名库存在性检查，有别名时直接添加即可
                        asname && (oQuerys[asname] = oQuerys[asname] || []).push(clsname); // 按库名单位汇总样式类，后续组件单位将一次性取出
                    }
                });

                // 检查js脚本中的样式库是否正确
                for (let i = 0, clspkg, clsname, asname; (clspkg = scriptclassnames[i++]); ) {
                    ary = clspkg.split("@");
                    clsname = "." + ary[0]; // 类名
                    asname = ary.length > 1 ? ary[1] : "*"; // 库别名

                    if (asname === "*") {
                        if (nonameCsslibPC) {
                            // 忽视@csslib无名库，@csslib无名库仅单一标签有效，脚本中多出的不管
                            (oQuerys[Alias] = oQuerys[Alias] || []).push(clsname); // 仅[csslib]有无名库时才汇总
                        }
                    } else {
                        // 别名库，检查指定样式库在（项目[csslib]+组件[csslib]+@csslib）中是否存在
                        if (!oAtCsslibs[asname] && !oCsslibs[asname] && !oPrjCsslibs[asname]) {
                            throw new Err("csslib not found (check classname in script): " + asname + "\nfile:" + context.input.file); // TODO 友好提示
                        }
                    }
                }

                let csslib,
                    tags = context.result.standardtags; // 用本组件的全部标准标签，解析完后才能用本插件
                for (let alias in oQuerys) {
                    csslib = oAtCsslibs[alias] || oCsslibs[alias] || oPrjCsslibs[alias]; // 别名无重复，不会有问题
                    if (!csslib) {
                        throw new Error("csslib not found: " + alias); // 应该检查过，在这里不应该还找不到样式库
                    }

                    if (csslib.isAtCsslib) {
                        oCssSet.add(csslib.get(csslib.attag, ...new Set(oQuerys[alias]), opts)); // @csslib样式库
                    } else {
                        oCssSet.add(csslib.get(...tags, ...new Set(oQuerys[alias]), opts)); // [csslib]样式库，用本组件的全部标准标签+相关样式类进行查询
                    }
                }
            });
        })()
    );

    // ------- s55p-component-query-css-@csslib-[csslib] end
})();

/* ------- s65p-component-gen-css ------- */
(() => {
    // ------- s65p-component-gen-css start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const File = require("@gotoeasy/file");

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
                style.atclasscss && ary.push(...style.atclasscss);

                context.result.css = bus.at("组件样式类名哈希化", context.input.file, ary.join("\n"));

                let env = bus.at("编译环境");
                if (!env.release) {
                    let fileCss = bus.at("组件目标临时CSS文件名", context.input.file);
                    if (context.result.css) {
                        File.write(fileCss, context.result.css);
                    } else {
                        File.remove(fileCss);
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
    const postobject = require("@gotoeasy/postobject");

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
    const Err = require("@gotoeasy/err");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            // allreferences排序存放页面使用的全部组件的标签全名，便于生成页面js
            return postobject.plugin("y15p-page-all-reference-components", function(root, context) {
                if (!context.result.isPage) return false; // 仅针对页面

                let oSetAllRef = new Set();
                let oStatus = {};
                let references = context.result.references; // 依赖的组件源文件
                references.forEach(tagpkg => {
                    addRefComponent(tagpkg, oSetAllRef, oStatus);
                });

                // 自身循环引用检查
                if (oSetAllRef.has(context.result.tagpkg)) {
                    throw new Err("circular reference: " + context.input.file);
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

    // tagpkg: 待添加依赖组件(全名)
    function addRefComponent(tagpkg, oSetAllRequires, oStatus) {
        if (oStatus[tagpkg]) {
            return;
        }

        oSetAllRequires.add(tagpkg);
        oStatus[tagpkg] = true;

        let srcFile = bus.at("标签源文件", tagpkg);
        let context = bus.at("组件编译缓存", srcFile);
        if (!context) {
            context = bus.at("编译组件", srcFile);
        }
        let references = context.result.references; // 依赖的组件源文件
        references.forEach(tagpkgfullname => {
            addRefComponent(tagpkgfullname, oSetAllRequires, oStatus);
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

                let oPrjContext = bus.at("项目配置处理", context.input.file);
                let oPrjCsslibs = oPrjContext.result.oCsslibs; // 项目[csslib]配置的样式库 (asname：lib)
                let oCsslibs = context.result.oCsslibs; // 组件[csslib]配置的样式库 (asname：lib)

                let env = bus.at("编译环境");
                let hashClassName = bus.on("哈希样式类名")[0];
                let rename = (pkg, cls) => hashClassName(context.input.file, cls + "@" + pkg); // 自定义改名函数(总是加@)
                let strict = true; // 样式库严格匹配模式
                let universal = true; // 查取通用样式（页面的缘故）
                let opts = { rename, strict, universal };

                // 在全部样式库中，用使用到的标准标签查询样式，汇总放前面
                let aryTagCss = [];
                let oPrjCmpCsslibs = Object.assign({}, oCsslibs, oPrjCsslibs); // 项目[csslib]+组件[csslib]配置的样式库 (asname：lib)
                let csslib,
                    oCache = bus.at("缓存");
                for (let alias in oPrjCmpCsslibs) {
                    csslib = oPrjCmpCsslibs[alias]; // 样式库
                    let cacheKey = hash(
                        JSON.stringify([
                            "按需取标签样式",
                            csslib.pkg,
                            csslib.version,
                            strict,
                            universal,
                            csslib._imported,
                            context.result.allstandardtags
                        ])
                    );
                    if (!env.nocache) {
                        let cacheValue = oCache.get(cacheKey);
                        if (cacheValue) {
                            aryTagCss.push(cacheValue);
                        } else {
                            let tagcss = csslib.get(...context.result.allstandardtags, opts);
                            aryTagCss.push(tagcss);
                            oCache.set(cacheKey, tagcss);
                        }
                    } else {
                        let tagcss = csslib.get(...context.result.allstandardtags, opts);
                        aryTagCss.push(tagcss);
                        oCache.set(cacheKey, tagcss);
                    }
                }

                // 汇总所有使用到的组件的样式
                let ary = [];
                let allreferences = context.result.allreferences; // 已含页面自身组件
                allreferences.forEach(tagpkg => {
                    let tagSrcFile = bus.at("标签源文件", tagpkg, context.result.oTaglibs);
                    let ctx = bus.at("组件编译缓存", tagSrcFile);
                    if (!ctx) {
                        ctx = bus.at("编译组件", tagSrcFile);
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
    const File = require("@gotoeasy/file");
    const postobject = require("@gotoeasy/postobject");

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

                let inlinesymbols = hasSvgInlineSymbols(context) ? bus.at("生成SVG内联SYMBOL定义代码", file) : "";

                bus.at("生成各关联包的外部SYMBOL定义文件", context);

                context.result.html = require(env.prerender)({ srcPath, file, name, type, nocss, inlinesymbols });
            });
        })()
    );

    function hasSvgInlineSymbols(context) {
        if (context.result.hasSvgInlineSymbol) return true;

        let allreferences = context.result.allreferences;
        for (let i = 0, tagpkg, ctx; (tagpkg = allreferences[i++]); ) {
            let tagSrcFile = bus.at("标签源文件", tagpkg);
            ctx = bus.at("组件编译缓存", tagSrcFile);
            if (ctx && ctx.result.hasSvgInlineSymbol) {
                return true;
            }
        }

        return false;
    }

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
                let srcStmt = getSrcRegisterComponents(allreferences, context.result.oTaglibs);
                let srcComponents = getSrcComponents(allreferences, context.result.oTaglibs);

                if (context.result.allstandardtags.includes("img")) {
                    let oCache = bus.at("缓存");
                    // 替换图片相对路径，图片不存在则复制
                    let resourcePath = oCache.path + "/resources";
                    let imgPath = bus.at("页面图片相对路径", context.input.file);
                    srcComponents = srcComponents.replace(/%imagepath%([0-9a-zA-Z]+\.[0-9a-zA-Z]+)/g, function(match, filename) {
                        let from = resourcePath + "/" + filename;
                        let to = env.path.build_dist + "/" + (env.path.build_dist_images ? env.path.build_dist_images + "/" : "") + filename;
                        File.existsFile(from) && !File.existsFile(to) && File.mkdir(to) > fs.copyFileSync(from, to);
                        return imgPath + filename;
                    });
                }

                if (srcComponents.indexOf("%svgsymbolpath%") > 0) {
                    // 替换图标相对路径
                    let imgPath = bus.at("页面图片相对路径", context.input.file);
                    srcComponents = srcComponents.replace(/%svgsymbolpath%/g, imgPath);
                }

                let tagpkg = context.result.tagpkg;

                let src = `
                ${srcRuntime}

                (function($$){

                    ${srcComponents}

                    // 组件注册
                    ${srcStmt}

                    // 组件挂载
                    rpose.mount( rpose.newComponentProxy('${tagpkg}').render(), '${context.doc.mount}' );
                })(rpose.$$);
            `;

                context.result.pageJs = src;
            });
        })()
    );

    // 组件注册语句
    function getSrcRegisterComponents(allreferences, oTaglibs) {
        try {
            let obj = {};
            for (let i = 0, tagpkg, key, file; (tagpkg = allreferences[i++]); ) {
                key = "'" + tagpkg + "'";

                file = bus.at("标签源文件", tagpkg, oTaglibs);
                if (!File.exists(file)) {
                    throw new Err("component not found (tag = " + tagpkg + ")");
                }

                obj[key] = bus.at("组件类名", file);
            }

            return `rpose.registerComponents(${JSON.stringify(obj).replace(/"/g, "")});`;
        } catch (e) {
            throw Err.cat("gen register stmt failed", allreferences, e);
        }
    }

    // 本页面关联的全部组件源码
    function getSrcComponents(allreferences, oTaglibs) {
        try {
            let ary = [];
            for (let i = 0, tagpkg, context; (tagpkg = allreferences[i++]); ) {
                let tagSrcFile = bus.at("标签源文件", tagpkg, oTaglibs);
                context = bus.at("组件编译缓存", tagSrcFile);
                if (!context) {
                    context = bus.at("编译组件", tagSrcFile);
                }
                ary.push(context.result.componentJs);
            }
            return ary.join("\n");
        } catch (e) {
            throw Err.cat("get component src failed", allreferences, e);
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

                let opts = {
                    plugins: [
                        ["@babel/plugin-proposal-decorators", { legacy: true }], // 支持装饰器
                        "@babel/plugin-proposal-class-properties", // 支持类变量（含私有变量）
                        "@babel/plugin-proposal-private-methods" // 支持类私有方法
                    ]
                };

                try {
                    context.result.babelJs = csjs.babel(context.result.pageJs, opts);
                    oCache.set(cacheKey, context.result.babelJs);
                } catch (e) {
                    File.write(env.path.build + "/error/babel-err-pagejs.js", context.result.pageJs + "\n\n" + e.stack);
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
    const hash = require("@gotoeasy/hash");
    const File = require("@gotoeasy/file");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("y85p-write-page", function(root, context) {
                if (!context.result.isPage) return false; // 仅针对页面
                let env = bus.at("编译环境");

                browserifyJs(env, context);
            });
        })()
    );

    function browserifyJs(env, context) {
        let stime = new Date().getTime(),
            time;
        context.result.browserifyJs
            .then(browserifyJs => {
                let fileHtml = bus.at("页面目标HTML文件名", context.input.file);
                let fileCss = bus.at("页面目标CSS文件名", context.input.file);
                let fileJs = bus.at("页面目标JS文件名", context.input.file);
                let svgSymbolHashcode = "";
                if (bus.at("页面是否引用外部SVG-SYMBOL文件", context.input.file)) {
                    let oSvgSymbol = bus.at("生成项目SVG-SYMBOL文件");
                    svgSymbolHashcode = oSvgSymbol.hashcode;
                }

                let html = context.result.html;
                let css = context.result.pageCss;
                let js = browserifyJs;
                context.result.js = js;

                css ? File.write(fileCss, css) : File.remove(fileCss);
                File.write(fileJs, js);
                File.write(fileHtml, html);

                env.watch && (context.result.hashcode = hash(html + css + js) + "-" + svgSymbolHashcode); // 计算页面编译结果的哈希码，供浏览器同步判断使用

                delete context.result.babelJs;
                delete context.result.browserifyJs;

                time = new Date().getTime() - stime;
                console.info("[pack]", time + "ms -", fileHtml.substring(env.path.build_dist.length + 1));
            })
            .catch(e => {
                console.error("[pack]", e);
            });
    }

    // 外部SVG-SYMBOL文件内容变化时，重新计算页面哈希码，以便热刷新
    bus.on(
        "重新计算页面哈希码",
        (function() {
            return () => {
                let env = bus.at("编译环境");
                if (!env.watch) return;

                let oFiles = bus.at("源文件对象清单");
                for (let file in oFiles) {
                    let context = bus.at("组件编译缓存", file);
                    if (bus.at("页面是否引用外部SVG-SYMBOL文件", file)) {
                        let oSvgSymbol = bus.at("生成项目SVG-SYMBOL文件");
                        let ary = (context.result.hashcode || "").split("-");
                        ary.length > 1 && ary.pop();
                        ary.push(oSvgSymbol.hashcode); // 替换减号后面的哈希码
                        context.result.hashcode = ary.join("-");
                    }
                }
            };
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

/* ------- z20m-util-get-tagpkg-fullname-of-src-file ------- */
(() => {
    // ------- z20m-util-get-tagpkg-fullname-of-src-file start
    const File = require("@gotoeasy/file");
    const bus = require("@gotoeasy/bus");

    bus.on(
        "标签全名",
        (function() {
            return file => {
                if (!/\.rpose$/i.test(file) && file.indexOf(":") > 0) {
                    return file; // 已经是全名标签
                }

                let tagpkg = "";
                let idx = file.lastIndexOf("/node_modules/");
                if (idx > 0) {
                    let ary = file.substring(idx + 14).split("/"); // xxx/node_modules/@aaa/bbb/xxxxxx => [@aaa, bbb, xxxxxx]
                    if (ary[0].startsWith("@")) {
                        tagpkg = ary[0] + "/" + ary[1] + ":" + File.name(file); // xxx/node_modules/@aaa/bbb/xxxxxx/abc.rpose => @aaa/bbb:abc
                    } else {
                        tagpkg = ary[0] + ":" + File.name(file); // xxx/node_modules/aaa/xxxxxx/abc.rpose => aaa:abc
                    }
                } else {
                    tagpkg = File.name(file); // aaa/bbb/xxxxxx/abc.rpose => abc      ui-btn => ui-btn

                    // 内置标签
                    tagpkg === "router" && (tagpkg = "@rpose/buildin:router");
                    tagpkg === "router-link" && (tagpkg = "@rpose/buildin:router-link");
                }

                return tagpkg;
            };
        })()
    );

    // ------- z20m-util-get-tagpkg-fullname-of-src-file end
})();

/* ------- z22m-util-get-src-file-of-tag ------- */
(() => {
    // ------- z22m-util-get-src-file-of-tag start
    const bus = require("@gotoeasy/bus");

    bus.on(
        "标签源文件",
        (function() {
            // 【tag】
            //   -- 源文件
            //   -- nnn=@aaa/bbb:ui-xxx
            //   -- @aaa/bbb:ui-xxx
            //   -- bbb:ui-xxx
            //   -- ui-xxx
            //   -- @ui-xxx
            // 【oTaglibs】
            //   -- 标签所在组件的[taglib]配置
            return (tag, oTaglibs = {}) => {
                if (tag.endsWith(".rpose")) {
                    return tag; // 已经是文件
                }

                if (tag.indexOf(":") > 0) {
                    // @taglib指定的标签
                    let taglib = bus.at("解析taglib", tag);

                    let env = bus.at("编译环境");
                    if (env.packageName === taglib.pkg) {
                        // 当前项目的包名和标签库包名一样时，从当前项目查找源文件
                        // 比如，第三方包引用当前包，当前包作为项目修改时，让第三方包引用当前项目源文件
                        return bus.at("标签源文件", taglib.tag);
                    }

                    return bus.at("标签库源文件", taglib);
                } else {
                    // 优先查找项目源文件
                    let file = bus.at("标签项目源文件", tag);
                    if (file) return file;

                    // 其次查找组件标签库
                    let alias = tag.startsWith("@") ? tag : "@" + tag;
                    if (oTaglibs[alias]) {
                        return bus.at("标签库源文件", oTaglibs[alias]);
                    }

                    // 最后查找项目标签库
                    let env = bus.at("编译环境");
                    let oPjtContext = bus.at("项目配置处理", env.path.root + "/rpose.config.btf");
                    if (oPjtContext.result.oTaglibs[alias]) {
                        return bus.at("标签库源文件", oPjtContext.result.oTaglibs[alias]);
                    }

                    // 找不到
                    return null;
                }
            };
        })()
    );

    // ------- z22m-util-get-src-file-of-tag end
})();

/* ------- z24m-util-get-tag-reference-page-files ------- */
(() => {
    // ------- z24m-util-get-tag-reference-page-files start
    const bus = require("@gotoeasy/bus");

    bus.on(
        "组件相关页面源文件",
        (function() {
            return (...srcFiles) => {
                let pageFiles = [];
                srcFiles.forEach(file => {
                    let context = bus.at("组件编译缓存", file);
                    if (context && context.result && context.result.isPage) {
                        pageFiles.push(file);
                    }

                    pageFiles.push(...getRefPages(file));
                });
                return [...new Set(pageFiles)];
            };
        })()
    );

    // 项目范围内，取组件相关的页面源文件
    function getRefPages(srcFile) {
        let refFiles = [];
        let tag = bus.at("标签全名", srcFile);
        if (tag) {
            let oFiles = bus.at("源文件对象清单");
            for (let file in oFiles) {
                let context = bus.at("组件编译缓存", file);
                if (context && context.result && context.result.isPage) {
                    let allreferences = context.result.allreferences || [];
                    allreferences.includes(tag) && refFiles.push(file);
                }
            }
        }
        return refFiles;
    }

    // ------- z24m-util-get-tag-reference-page-files end
})();

/* ------- z34m-util-get-jsclass-name-of-src-file ------- */
(() => {
    // ------- z34m-util-get-jsclass-name-of-src-file start
    const bus = require("@gotoeasy/bus");

    bus.on(
        "组件类名",
        (function() {
            return file => {
                let tagpkg = bus.at("标签全名", bus.at("标签源文件", file)); // xxx/node_modules/@aaa/bbb/ui-abc.rpose => @aaa/bbb:ui-abc
                tagpkg = tagpkg
                    .replace(/[@/`]/g, "$")
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

    // ------- z34m-util-get-jsclass-name-of-src-file end
})();

/* ------- z36m-util-get-project-root-path-of-file ------- */
(() => {
    // ------- z36m-util-get-project-root-path-of-file start
    const bus = require("@gotoeasy/bus");

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

    // ------- z36m-util-get-project-root-path-of-file end
})();

/* ------- z38m-util-get-project-config-file-by-file ------- */
(() => {
    // ------- z38m-util-get-project-config-file-by-file start
    const bus = require("@gotoeasy/bus");

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

                // 只管返回配置文件路径，不管该文件是否存在
                return btfFile;
            };
        })()
    );

    // ------- z38m-util-get-project-config-file-by-file end
})();

/* ------- z42m-util-get-package-info-by-name ------- */
(() => {
    // ------- z42m-util-get-package-info-by-name start
    const File = require("@gotoeasy/file");
    const bus = require("@gotoeasy/bus");
    const findNodeModules = require("find-node-modules");

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

    // ------- z42m-util-get-package-info-by-name end
})();

/* ------- z44m-util-get-package-name-of-file ------- */
(() => {
    // ------- z44m-util-get-package-name-of-file start
    const bus = require("@gotoeasy/bus");

    // 当前项目文件时，返回'/'
    bus.on(
        "文件所在模块",
        (function() {
            return file => {
                let pkg = "/",
                    idx = file.lastIndexOf("/node_modules/");
                if (idx > 0) {
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

    // ------- z44m-util-get-package-name-of-file end
})();

/* ------- z50m-util-get-build-page-css-file-name-of-src-file ------- */
(() => {
    // ------- z50m-util-get-build-page-css-file-name-of-src-file start
    const bus = require("@gotoeasy/bus");

    bus.on(
        "页面目标CSS文件名",
        (function() {
            return function(srcFile) {
                let env = bus.at("编译环境");
                return env.path.build_dist + srcFile.substring(env.path.src.length, srcFile.length - 6) + ".css";
            };
        })()
    );

    // ------- z50m-util-get-build-page-css-file-name-of-src-file end
})();

/* ------- z52m-util-get-build-page-html-file-name-of-src-file ------- */
(() => {
    // ------- z52m-util-get-build-page-html-file-name-of-src-file start
    const bus = require("@gotoeasy/bus");

    bus.on(
        "页面目标HTML文件名",
        (function() {
            return function(srcFile) {
                let env = bus.at("编译环境");
                return env.path.build_dist + srcFile.substring(env.path.src.length, srcFile.length - 6) + ".html";
            };
        })()
    );

    // ------- z52m-util-get-build-page-html-file-name-of-src-file end
})();

/* ------- z54m-util-get-build-page-js-file-name-of-src-file ------- */
(() => {
    // ------- z54m-util-get-build-page-js-file-name-of-src-file start
    const bus = require("@gotoeasy/bus");

    bus.on(
        "页面目标JS文件名",
        (function() {
            return function(srcFile) {
                let env = bus.at("编译环境");
                return env.path.build_dist + srcFile.substring(env.path.src.length, srcFile.length - 6) + ".js";
            };
        })()
    );

    // ------- z54m-util-get-build-page-js-file-name-of-src-file end
})();

/* ------- z56m-util-get-build-temp-css-file-name-of-src-file ------- */
(() => {
    // ------- z56m-util-get-build-temp-css-file-name-of-src-file start
    const bus = require("@gotoeasy/bus");

    bus.on(
        "组件目标临时CSS文件名",
        (function() {
            return function(srcFile) {
                let env = bus.at("编译环境");
                let pkg = bus.at("文件所在模块", srcFile);
                if (pkg === "/") {
                    let file = srcFile.substring(env.path.src.length, srcFile.length - 6) + ".css";
                    return `${env.path.build_temp}${file}`;
                } else {
                    let prjCtx = bus.at("项目配置处理", srcFile);
                    let file = srcFile.substring(prjCtx.path.src.length, srcFile.length - 6) + ".css";
                    return `${env.path.build_temp}/node_modules/${pkg}${file}`;
                }
            };
        })()
    );

    // ------- z56m-util-get-build-temp-css-file-name-of-src-file end
})();

/* ------- z58m-util-get-build-temp-js-file-name-of-src-file ------- */
(() => {
    // ------- z58m-util-get-build-temp-js-file-name-of-src-file start
    const bus = require("@gotoeasy/bus");

    bus.on(
        "组件目标临时JS文件名",
        (function() {
            return function(srcFile) {
                let env = bus.at("编译环境");
                let pkg = bus.at("文件所在模块", srcFile);
                if (pkg === "/") {
                    let file = srcFile.substring(env.path.src.length, srcFile.length - 6) + ".js";
                    return `${env.path.build_temp}${file}`;
                } else {
                    let prjCtx = bus.at("项目配置处理", srcFile);
                    let file = srcFile.substring(prjCtx.path.src.length, srcFile.length - 6) + ".js";
                    return `${env.path.build_temp}/node_modules/${pkg}${file}`;
                }
            };
        })()
    );

    // ------- z58m-util-get-build-temp-js-file-name-of-src-file end
})();

/* ------- z60m-util-get-image-relative-path-of-page-src-file ------- */
(() => {
    // ------- z60m-util-get-image-relative-path-of-page-src-file start
    const bus = require("@gotoeasy/bus");

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

    // ------- z60m-util-get-image-relative-path-of-page-src-file end
})();

/* ------- z71m-global-variables-find-check ------- */
(() => {
    // ------- z71m-global-variables-find-check start
    const bus = require("@gotoeasy/bus");
    const Err = require("@gotoeasy/err");
    const parser = require("@babel/parser");
    const traverse = require("@babel/traverse").default;

    bus.on("检查未定义变量", function(ast, input, PosOffset) {
        traverse(ast, {
            Identifier(path) {
                if (isPrivateName(path)) return; // 使用私有字段或方法时，不检查
                if (isClassMethod(path)) return;
                if (isClassProperty(path)) return;
                if (isInMemberExpression(path)) return;
                if (isObjectPropertyName(path)) return;
                if (isParamToCatchClause(path)) return;
                if (hasBinding(path)) return;

                if (!bus.at("是否有效的全局变量名", path.node.name)) {
                    throw new Err(`undefine variable (${path.node.name})`, {
                        ...input,
                        start: path.node.start + PosOffset,
                        end: path.node.end + PosOffset
                    });
                }
            }
        });
    });

    bus.on("查找未定义变量", function(code) {
        let oSetGlobalVars = new Set();
        let ast = parser.parse(code, {
            sourceType: "module",
            plugins: [
                "decorators-legacy", // 支持装饰器
                "classProperties", // 支持类变量
                "classPrivateProperties", // 支持类私有变量
                "classPrivateMethods" // 支持类私有方法
            ]
        });

        traverse(ast, {
            Identifier(path) {
                if (isPrivateName(path)) return; // 使用私有字段或方法时，不检查
                if (isClassMethod(path)) return;
                if (isClassProperty(path)) return;
                if (isInMemberExpression(path)) return;
                if (isObjectPropertyName(path)) return;
                if (isParamToCatchClause(path)) return;
                if (hasBinding(path)) return;

                !bus.at("是否有效的全局变量名", path.node.name) && oSetGlobalVars.add(path.node.name);
            }
        });

        return [...oSetGlobalVars];
    });

    function isClassMethod(path) {
        return path.parentPath.isClassMethod();
    }
    function isClassProperty(path) {
        return path.parentPath.isClassProperty();
    }
    function isPrivateName(path) {
        return path.parentPath.isPrivateName();
    }

    function hasBinding(path) {
        let parent = path.findParent(path => path.isBlock() || path.isFunction() || path.isForStatement() || path.isForInStatement());
        let noGlobals = true;
        return parent.scope.hasBinding(path.node.name, noGlobals);
    }

    function isParamToCatchClause(path) {
        let parent = path.findParent(path => path.isCatchClause());
        return !!parent && parent.node.param === path.node;
    }

    function isObjectPropertyName(path) {
        let parent = path.parentPath;
        if (parent.isObjectProperty()) {
            return !parent.node.computed && parent.node.key === path.node;
        }
        return false;
    }

    function isInMemberExpression(path) {
        let parent = path.parentPath;
        if (parent.isMemberExpression()) {
            return !parent.node.computed && parent.node.property === path.node;
        }
        return false;
    }

    // ------- z71m-global-variables-find-check end
})();

/* ------- z72m-global-variables-is-valid-name ------- */
(() => {
    // ------- z72m-global-variables-is-valid-name start
    const bus = require("@gotoeasy/bus");

    const oSetVarNames = new Set([
        "$$",
        "rpose",
        "$SLOT",
        "require",
        "XMLHttpRequest",
        "window",
        "document",
        "sessionStorage",
        "localStorage",
        "location",
        "console",
        "alert",
        "escape",
        "unescape",
        "clearInterval",
        "setInterval",
        "setTimeout",
        "parseInt",
        "parseFloat",
        "isFinite",
        "isNaN",
        "eval",
        "decodeURI",
        "encodeURI",
        "toString",
        "toLocaleString",
        "valueOf",
        "isPrototypeOf",
        "Function",
        "arguments",
        "JSON",
        "Number",
        "String",
        "Error",
        "SyntaxError",
        "TypeError",
        "URIError",
        "EvalError",
        "RangeError",
        "ReferenceError",
        "Array",
        "Boolean",
        "Math",
        "Date",
        "Object",
        "RegExp",
        "NaN",
        "Symbol",
        "Number",
        "undefined",
        "assignOptions",
        "Map",
        "Set",
        "WeakMap",
        "WeakSet",
        "Promise",
        "Proxy",
        "Reflect",
        "WeakSet"
    ]);

    bus.on(
        "是否有效的全局变量名",
        (function() {
            return function(name) {
                return oSetVarNames.has(name);
            };
        })()
    );

    // ------- z72m-global-variables-is-valid-name end
})();

/* ------- z80m-auto-install-npm-package ------- */
(() => {
    // ------- z80m-auto-install-npm-package start
    const bus = require("@gotoeasy/bus");
    const npm = require("@gotoeasy/npm");

    bus.on(
        "自动安装",
        (function(rs = {}) {
            return function autoinstall(pkg) {
                pkg.indexOf(":") > 0 && (pkg = pkg.substring(0, pkg.indexOf(":"))); // @scope/pkg:component => @scope/pkg
                pkg.lastIndexOf("@") > 0 && (pkg = pkg.substring(0, pkg.lastIndexOf("@"))); // 不该考虑版本，保险起见修理一下，@scope/pkg@x.y.z => @scope/pkg

                let env = bus.at("编译环境");
                if (env.packageName === pkg) return true; // 包名和当前项目的包名一样，不安装，返回true假装正常结束

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

    // ------- z80m-auto-install-npm-package end
})();

/* ------- z81m-is-expression ------- */
(() => {
    // ------- z81m-is-expression start
    const bus = require("@gotoeasy/bus");

    bus.on(
        "是否表达式",
        (function() {
            return function(val) {
                if (!val) return false;

                // TODO 使用常量
                let tmp = (val + "").replace(/\\\{/g, "").replace(/\\\}/g, "");

                // 如果用/^\{.*\}$/，可能会导致style判断出错，如style="color:{color}"
                return /\{.*\}/.test(tmp);
            };
        })()
    );

    // ------- z81m-is-expression end
})();

/* ------- z82m-is-html-standard-event-name ------- */
(() => {
    // ------- z82m-is-html-standard-event-name start
    const bus = require("@gotoeasy/bus");

    // HTML标准所定义的全部标签事件
    const REG_EVENTS = /^(onclick|onchange|onabort|onafterprint|onbeforeprint|onbeforeunload|onblur|oncanplay|oncanplaythrough|oncontextmenu|oncopy|oncut|ondblclick|ondrag|ondragend|ondragenter|ondragleave|ondragover|ondragstart|ondrop|ondurationchange|onemptied|onended|onerror|onfocus|onfocusin|onfocusout|onformchange|onforminput|onhashchange|oninput|oninvalid|onkeydown|onkeypress|onkeyup|onload|onloadeddata|onloadedmetadata|onloadstart|onmousedown|onmouseenter|onmouseleave|onmousemove|onmouseout|onmouseover|onmouseup|onmousewheel|onoffline|ononline|onpagehide|onpageshow|onpaste|onpause|onplay|onplaying|onprogress|onratechange|onreadystatechange|onreset|onresize|onscroll|onsearch|onseeked|onseeking|onselect|onshow|onstalled|onsubmit|onsuspend|ontimeupdate|ontoggle|onunload|onunload|onvolumechange|onwaiting|onwheel)$/i;

    bus.on(
        "是否HTML标准事件名",
        (function() {
            return function(name, ignoreOn = false) {
                if (REG_EVENTS.test(name)) {
                    return true;
                }
                if (ignoreOn) {
                    return REG_EVENTS.test("on" + name);
                }
                return false;
            };
        })()
    );

    // ------- z82m-is-html-standard-event-name end
})();

/* ------- z90m-rename-css-classname ------- */
(() => {
    // ------- z90m-rename-css-classname start
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
            // foo@pkg      => foo---pkg
            // foo---pkg    => foo---pkg（视为已改名不再修改）
            // foo___xxxxx  => foo___xxxxx（视为已改名不再修改）
            // -------------------------------------------------------
            return function renameCssClassName(srcFile, clsName) {
                let name = clsName;

                // 特殊名称不哈希（已哈希的是下划线开头）
                if (name.startsWith("_")) {
                    return name;
                }

                const env = bus.at("编译环境");
                if (clsName.indexOf("@") > 0) {
                    let ary = clsName.split("@");
                    !ary[1] && (ary[1] = "UNKNOW");

                    name = `${ary[0]}---${ary[1]}`; // 引用样式库时，使用命名空间后缀，如 the-class---pkgname
                } else {
                    if (name.indexOf("---") > 0 || name.indexOf("___") > 0) {
                        // 已经改过名
                    } else {
                        let tag = bus.at("标签全名", srcFile);
                        name = `${clsName}___${hash(tag)}`; // 当前项目组件时，标签全名哈希作为后缀，如 my-class___xxxxx
                    }
                }

                name = name.replace(/[^a-zA-z0-9\-_]/g, "-"); // 包名中【字母数字横杠下划线】以外的字符都替换为下划线，便于在非release模式下查看
                if (!env.release) return name; // 非release模式时不哈希
                return "_" + hash(name); // 名称已有命名空间前缀，转换为小写后哈希便于复用
            };
        })()
    );

    // ------- z90m-rename-css-classname end
})();

/* ------- z99p-log ------- */
(() => {
    // ------- z99p-log start
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");

    bus.on(
        "编译插件",
        (function() {
            return postobject.plugin("z99p-log", function(/* root, result */) {
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
const Err = require("@gotoeasy/err");

/*
console.time('load');
    require('@gotoeasy/npm').requireAll(__dirname, 'src/**.js');
console.timeEnd('load');


*/
async function build(opts) {
    let stime = new Date().getTime();

    try {
        bus.at("编译环境", opts);
        bus.at("clean");

        await bus.at("全部编译");
    } catch (e) {
        console.error(Err.cat("build failed", e).toString());
    }

    let time = new Date().getTime() - stime;
    console.info("build " + time + "ms"); // 异步原因，统一不使用time/timeEnd计时
}

function clean(opts) {
    let stime = new Date().getTime();

    try {
        bus.at("编译环境", opts);
        bus.at("clean");
    } catch (e) {
        console.error(Err.cat("clean failed", e).toString());
    }

    let time = new Date().getTime() - stime;
    console.info("clean " + time + "ms"); // 异步原因，统一不使用time/timeEnd计时
}

async function watch(opts) {
    await build(opts);
    bus.at("文件监视");
}

module.exports = { build, clean, watch };
