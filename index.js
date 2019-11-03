#!/usr/bin/env node
/* eslint no-console:0, no-process-exit:0 */
const commander = require('commander');
const { name, version } = require('./package.json');
const remainingArgs = require('commander-remaining-args');
const minimist = require('minimist');
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

function exec(cmd, args, options) {
    const res = childProcess.spawnSync(cmd, args, options);

    if (res.stderr) console.error(res.stderr.toString().trim());

    if (res.error) {
        console.error(cmd, args.join(' '), '=>');
        console.error(res.error);
        return process.exit(1);
    }

    if (res.status !== 0) {
        console.error(cmd, args.join(' '), '=>', res.status);
        return process.exit(1);
    }

    return res.stdout;
}

const formDataDefaults = [
    {
        alias: ['userName', 'username'],
        value() {
            return exec('git', ['config', '--get', 'user.email'], {stdio: 'pipe', encoding: 'utf-8'}).split('@')[0];
        }
    }
];

async function run() {
    let template, dir, root;

    try {
        const program = new commander.Command(name)
            .version(version)
            .description('UT generator')
            .arguments('[template] [project-directory] [options...]')
            .allowUnknownOption()
            .usage('[template] [project-directory] [options...]')
            .action((kind = 'app', prjDir = '.') => {
                const parts = kind.split('-');
                switch (parts[0]) {
                    case 'ms':
                    case 'service':
                    case 'microservice':
                        parts[0] = 'ut-microservice';
                        break;
                    case 'port':
                        parts[0] = 'ut-port-template';
                        break;
                    case 'app':
                        parts[0] = 'impl-application';
                        break;
                    default:
                        parts.unshift('impl');
                        break;
                }
                template = parts.join('-');
                dir = prjDir;
                root = path.join(process.cwd(), dir);
            })
            .parse(process.argv);

        const { repository: { url } } = await packageJson(template, {registryUrl: 'https://nexus.softwaregroup.com/repository/npm-all/'});

        exec('git', ['clone', url, dir], {stdio: 'inherit'});

        const {params, rename} = require(path.join(root, '.ut-create'));

        params.formData = {...minimist(remainingArgs(program)), ...params.formData};

        formDataDefaults.forEach(({alias, value}) => {
            const key = alias.find(key => params.schema.properties[key]);
            if (key && typeof params.formData[key] === 'undefined') params.formData[key] = value();
        });

        const {url: { href }, id} = await edit({log});

        childProcess.exec((process.platform === 'win32' ? 'start' : 'xdg-open') + ' ' + href, err => {
            if (err) {
                console.error(err);
                console.log('Open configuration form at:', href);
            }
        });

        const data = await edit({ ...params, id, log });
        const rules = rename(data);

        rules.forEach(({files, replace}) => {
            const list = glob.sync(/^[^/\\].*/.test(files) ? '/' + files : files, { root });
            list.forEach(file => {
                const fileContent = fs.readFileSync(file, 'utf8');
                let newFileContent = fileContent;
                // [regExp1, value1] or [regExp1, value1, regExp2, value2] or [[regExp1, value1], [regExp2, value2]]
                [].concat(replace)
                    .reduce((all, item, i) => all.concat(i % 2 ? [[all.pop(), item]] : item), [])
                    .forEach(params => {
                        newFileContent = newFileContent.replace(...params);
                    });
                if (newFileContent !== fileContent) fs.writeFileSync(file, newFileContent);
            });
        });

        exec('git', ['remote', 'set-url', 'origin', url.replace(template, path.basename(root))], {stdio: 'inherit', cwd: root});

        console.log(`${template} based project has been successfully created in folder ${root}`);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
