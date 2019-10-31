const commander = require('commander');
const { name, version } = require('./package.json');
const packageJson = require('package-json');
const childProcess = require('child_process');
const path = require('path');
const fs = require('fs');
const { edit } = require('ut-form-jsonschema');
const glob = require('glob');
const UtLog = require('ut-log');
const log = new UtLog({
    type: 'bunyan',
    name: 'create-ut',
    service: 'create-ut',
    version,
    streams: []
}).createLog('info', {name: 'create-ut', context: 'create-ut'});

async function run() {
    let template, dir, root;

    try {
        const program = new commander.Command(name)
            .version(version)
            .description('UT generator')
            .arguments('<template> <project-directory>')
            .usage('<template> <project-directory>')
            .action((tmpl, prjDir) => {
                template = tmpl;
                dir = prjDir;
                root = path.join(process.cwd(), dir);
            })
            .parse(process.argv);

        const { repository: { url } } = await packageJson(template, {registryUrl: 'https://nexus.softwaregroup.com/repository/npm-all/'});

        const ret = childProcess.spawnSync('git', ['clone', url, dir], {stdio: 'inherit'});

        if (ret.stderr) console.error(ret.stderr.toString().trim());

        if (ret.error) {
            console.error('git', 'clone', url, dir, '=>');
            console.error(ret.error);
            process.exit(1);
        } else if (ret.status !== 0) {
            console.error('git', 'clone', url, dir, '=>', ret.status);
            process.exit(1);
        }

        const create = require(path.join(root, 'create.js'));

        const {url: { href }, id} = await edit({log});

        childProcess.exec((process.platform == 'win32' ? 'start' : 'xdg-open') + ' ' + href, err => {
            if (err) {
                console.error(err);
                console.log('Open configuration form at:', href);
            }
        });

        const data = await edit({ ...params, id, log });
        const rules = rename(data);

        rules.forEach(({files, replace}) => {
            const list = glob.sync(files[0] === path.sep ? files : path.sep + files, { root });
            list.forEach(file => {
                const fileContent = fs.readFileSync(file, 'utf8');
                if (Array.isArray(replace[0])) replace.forEach(([regExp, value]) => fileContent.replace(regExp, value))
                else fileContent.replace(replace[0], replace[1]);
                fs.writeFileSync(file, fileContent);
            });
        });

        console.log(`${template} based project has been successfully created in folder ${root}!`);
    } catch(e) {
        console.error(e);
        if (root && fs.existsSync(root)) {
            (function unlinkSync(folder) {
                fs.readdirSync(folder).forEach(subFolder => {
                    const subPath = path.join(folder, subFolder);
                    return fs.lstatSync(subPath).isDirectory() ? unlinkSync(subPath) : fs.unlinkSync(subPath)
                });
                fs.rmdirSync(folder);
            })(root);
        };
        process.exit(1);
    }
}

run();
