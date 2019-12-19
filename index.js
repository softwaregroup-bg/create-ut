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
const log = {
    fatal: function() { console.error(...arguments); },
    error: function() { console.error(...arguments); },
    warn: function() { console.log(...arguments); },
    info: function() { console.log(...arguments); },
    debug: function() { console.log(...arguments); },
    trace: function() { console.log(...arguments); }
};

function exec(cmd, args, options) {
    const res = childProcess.spawnSync(cmd, args, options);

    if (res.stderr) log.error(res.stderr.toString().trim());

    if (res.error) {
        log.error(cmd, args.join(' '), '=>');
        log.error(res.error);
        return process.exit(1);
    }

    if (res.status !== 0) {
        log.error(cmd, args.join(' '), '=>', res.status);
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
    let template, root, title;

    try {
        const program = new commander.Command(name)
            .version(version)
            .description('UT generator')
            .arguments('[template] [project-directory] [options...]')
            .allowUnknownOption()
            .usage('[template] [project-directory] [options...]')
            .action((kind = 'app', dir = '.') => {
                if (/^(\w:|\.|\/|\\)/.test(kind)) { // kind is local path to a project
                    root = path.resolve(kind);
                    return;
                }
                const parts = kind.split('-');
                root = path.resolve(dir);
                const prefix = path.basename(root).split('-')[0];
                const suffix = path.basename(root).replace(/^(impl-|ut-)/, '');
                if (!['impl', 'ut'].includes(prefix)) throw new Error('Project directory should be prefixed with "impl-" or "ut-"');
                switch (parts[0]) {
                    case 'ms':
                    case 'service':
                    case 'microservice':
                        title = 'Microservice ' + suffix;
                        parts[0] = 'ut-microservice';
                        break;
                    case 'port':
                        title = 'Port ' + suffix;
                        parts[0] = 'ut-port-template';
                        break;
                    case 'app':
                        title = 'Implementation ' + suffix;
                        parts[0] = 'impl-application';
                        break;
                    default:
                        title = 'Module ' + suffix;
                        parts.unshift(prefix);
                        break;
                }
                template = parts.join('-');
            })
            .parse(process.argv);

        let url, description;
        if (template) { // clone from remote repo
            const pkg = await packageJson(template, {registryUrl: 'https://nexus.softwaregroup.com/repository/npm-all/'});
            url = pkg.repository.url;
            description = pkg.description;
            log.debug(`Creating "${description}" in ${root}`);
            exec('git', ['clone', url, root], {stdio: 'inherit'});
        }

        const {params, rename} = require(path.join(root, '.ut-create'));

        params.formData = {
            id: path.basename(root),
            title,
            ...minimist(remainingArgs(program)),
            ...params.formData
        };

        formDataDefaults.forEach(({alias, value}) => {
            const key = alias.find(key => params.schema.properties[key]);
            if (key && typeof params.formData[key] === 'undefined') params.formData[key] = value();
        });

        const {url: { href }, id} = await edit({log});

        log.debug('Opening configuration URL');
        childProcess.exec((process.platform === 'win32' ? 'start' : 'xdg-open') + ' ' + href, err => {
            if (err) {
                log.error(err);
                log.debug('Open manually configuration form at:', href);
            }
        });

        const data = await edit({...params,
            id,
            log,
            submit: async({payload}) => {
                return {
                    payload: {
                        state: {
                            schema: {
                                title: 'Configuration completed',
                                description: 'You can now close this page',
                                type: 'object',
                                properties: {}
                            },
                            buttons: []
                        }
                    }
                };
            }
        });
        const rules = rename(data);

        log.debug('Applying parameters');
        rules.forEach(({files, replace}) => {
            const list = glob.sync(/^[^/\\].*/.test(files) ? '/' + files : files, { root });
            list.forEach(file => {
                const fileContent = fs.readFileSync(file, 'utf8');
                let newFileContent = fileContent;
                // [regExp1, value1] or [regExp1, value1, regExp2, value2] or [[regExp1, value1], [regExp2, value2]]
                [].concat(...replace)
                    .reduce((all, item, i) => all.concat(i % 2 ? [[all.pop(), item]] : item), [])
                    .forEach(params => {
                        newFileContent = newFileContent.replace(...params);
                    });
                if (newFileContent !== fileContent) fs.writeFileSync(file, newFileContent);
            });
        });

        if (template) { // cloned from remote repo
            log.debug('Setting new remote URL');
            exec('git', ['remote', 'set-url', 'origin', url.replace(template, path.basename(root))], {stdio: 'inherit', cwd: root});
            log.debug(`${description} based project has been successfully created in folder ${root}`);
        }
    } catch (e) {
        log.error(e);
        process.exit(1);
    }
}

run();
