# create-ut

Tool for creating UT microservices and applications

## Usage

* use `npm init`

    User creates app, microservice, port
    or anything else by running

    ```bash
    # create application
    npm init ut
    npm init ut app[-kind]

    # create microservice
    npm init ut ms[-kind]
    npm init ut service[-kind]
    npm init ut microservice[-kind]

    # create port
    npm init ut port[-kind]
    ```

## Algorithm

1) Clone latest version of package `ut-app[-kind]` or `ut-microservice[-kind]`.
   Obtain repository by using `package-json` in a way similar to:

   ```js
   const gitUrl = async () =>
      await require('package-json')('ut-app', {registryUrl: 'nexus.softwaregroup.com'})).repository.url
   }
   ```

1) Load a file named `create.js` in the cloned folder, having the following
   structure:

```js
module.exports = {
    params: {
        schema: {
            properties: {
                id: {
                    type: 'string',
                    title: 'Package identifier'
                },
                title: {
                    type: 'string',
                    title: 'Package title'
                },
                userName: {
                    type: 'string',
                    title: 'User name',
                    default: 'based on output from git config --get user.email'
                }
            },
            required: ['id', 'title', 'userName']
        },
        uiSchema: {

        }
    },
    rename: ({id, title, userName}) => [{
        files: 'server/**/*.js',
        replace: [
            /implementation: 'product'/,
            `implementation: '${id}'`
        ]
    }, {
        files: 'server/**/*.json',
        replace: [
            /"implementation": "product"/,
            `"implementation": '${id}'`
        ]
    }, {
        files: 'ut_*_rc', // example is for YAML based rc
        replace: [[
            /database: impl-firstName-lastName/,
            `database: impl-${userName.split('.').join('-')}`
        ],[
            /user: firstName\.lastName/,
            `user: ${userName}`
        ]]
    } /*etc*/]
};
```

1) Use `ut-form-jsonschema` to create a form based on the `params` property
   in `create.js`.
   Usually the following parameters are required:
   * package `id` - for example "agency"
   * package `title` - for example "Agency banking"
   * developer `userName` - as used by git `first.last`@softwaregroup.com, can be
     retrieved with `git config --get user.email`

   Start the default browser with the form URL and
   wait for the form to be submitted

1) Do string replacement by using the information returned by
   the `rename` function in `create.js`.
   The property `files` specifies a [glob](https://www.npmjs.com/package/glob) pattern
   for files to be searched.
   The string or regular expression in `replace` array first
   element is used to find text to be replaced by the expression
   in the `replace` array second element (as in string.replace).
   If `replace` is array of arrays, apply the replacement multiple
   times.

1) Change git remote:

   ```bash
   git remote set-url origin git@xxx:yyy/zzz.git
   ```

1) Create Jenkins job
   > TODO add description

1) Configure git web hook to trigger Jenkins job
   > TODO add description
