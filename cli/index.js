const fs = require('fs');

module.exports = function createProject(opts){

	let cwd = opts.workDir.replace(/\\/g, '/');
	let name = opts.name.trim();

	// 不能有非法目录字符
	if ( /[:\/\\\?]/.test(name) ) {
		return;
	}

	// 简单化，目录已存在也不行
	let pathProject = `${cwd}/${name}`;
	if ( fs.existsSync(pathProject) && fs.statSync(pathProject).isDirectory() ) {
		return;
	}

	// 创建项目目录
	fs.mkdirSync(pathProject);

	// 模板目录
	let ary = __dirname.replace(/\\/g, '/').split('/');
	ary.push('project-template');
	let templatePath = ary.join('/');

	// 复制模板
	copyTemplateProject(templatePath, pathProject);

	return true;
};


function copyTemplateProject(templatePath, targetPath){

	let files = fs.readdirSync(templatePath);
	let fileFrom, fileTo;
	files.forEach(fileName =>{
		fileFrom = templatePath + '/' + fileName;
		fileTo = targetPath + '/' + fileName;

		if ( fs.statSync(fileFrom).isFile() ) {
			fs.copyFileSync(fileFrom, fileTo);
		}else{
			fs.mkdirSync(fileTo);
			copyTemplateProject(fileFrom, fileTo);
		}
	});
}