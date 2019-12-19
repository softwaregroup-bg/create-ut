# create-ut

Tool for creating `applications`, `microservices`, `ports`, etc.,
based on UnderTree framework.

## Usage

Use with `npm init`

User creates `application`, `microservice`, `port` or anything else by running:

* create `application` in the current folder named `impl-*`

  ```bash
  npm init ut
  npm init ut app[-kind]
  ```

* create `application` in a new folder named `impl-name`

  ```bash
  npm init ut app[-kind] impl-name
  ```

* create `microservice` in the current folder named `ut-*`

  ```bash
  npm init ut ms[-kind]
  npm init ut service[-kind]
  npm init ut microservice[-kind]
  ```

* create `microservice` in new folder named `ut-name`

  ```bash
  npm init ut ms[-kind] ut-name
  npm init ut service[-kind] ut-name
  npm init ut microservice[-kind] ut-name
  ```

* create `port` in the current folder named `ut-port-*`

  ```bash
  npm init ut port[-kind]
  ```

* create `port` in new folder named `ut-port-name`

  ```bash
  npm init ut port[-kind] ut-port-name
  ```

* modify a local repo based on its `.ut-create` definition

  ```bash
  npm init ut path-to-repo
  ```

## Algorithm

1) Clone latest version of package `impl-application[-kind]` or `ut-microservice[-kind]`.
   Obtain repository by using `package-json` in a way similar to:

   ```js
   const gitUrl = async () =>
      await require('package-json')('impl-application', {registryUrl: 'nexus.softwaregroup.com'})).repository.url
   }
   ```

1) Require the module `.ut-create` in the cloned folder, having the following structure:

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
