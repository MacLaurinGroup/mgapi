# mg-api-validator

Testing API endpoints, can be as simple as sending a payload and checking the return.  This package builds on that simple premise and delivers a simple, yet powerful, small test-suite runner that lets you test API endpoints, by sending data and inspecting the results.   Controlled via JSON files, there is zero need for any programming.   Though, there is the ability to attach a custom function to do further testing on a given response if required.

The MG-API-VALIDATOR also lets you extract data out of the response, to use in a subsequent response.  So if you create an object, get an ID returned, you can easily grab that ID, and use it in a subsequent call.

Tests can be run individually, or as part of a single suite where all the test files belong in a single directory (marked *-test.json or test-*.json).

You can optionally log out the request/response upon failure into a folder for later investigation.

## Installation

```
npm install mg-api-validator
```

```
node_modules/mg-api-validator/bin/apiTest.js --config-file=./file.json test1.json test2.json
```

## context :: Test environment

The 'env' is a special variable scope that is shared among all the tests and is a place where variables can be parked for later.  The context is loaded with the --config-file=./xyz.json command line.  An example:

```
{
  "env" : {
    "config": {
      "url": "https://api.myendpoint.org",
      "loginId": "someLoginId",
      "password": "somePassword"
    }
  },
  "headers" : {
    "Content-Type": "application/json"
  },
  "httpDefaults" : {
    "timeout" : 30000,
    "maxContentLength" : 500000
  },

  "testTearDown" : "",
  "testSetup" : "file://./common/setup.json"
}
```

The 'headers'/'httpDefaults' are special blocks that setup the default for all outgoing HTTP requests.  The 'headers' can be overridden by each test if need be.  The testSetup/testTearDown are tests that are run at the start and end of the run.  Even if the tests fail the testTearDown will run.  If the testSetup fails, all the tests will not run.

Everything else, can be then accessed by the tests using the syntax: ${env.config.url}.

There are some constants available for use when required you need a little randomness.  The __now is recalculated every test run.

```
{
  "env": {
    __time: 1583843213037,
    __yyyymmdd_: '2020-03-10',
    __yyyymmddhhMMss_ : "2020-03-10T12:26:53",
    __yyyymmdd: '20200310',
    __now: 'Tue Mar 10 2020 12:26:53'
  }
}
```

## Autonomy of single test

A single test is a block of JSON, saved in a single file.  A file can have an array of tests, that will be executed one after another.

Below is an example of a single test.

```
{
  // the name of the test; for display purposes
  "name": "Login",

  // whether or not this test will stop other tests from running if it fails
  "stopOnFail" : false,

  // details on the request
  "request": {

    // the url to use, with the method then the uri. can use the env vars here
    "url": "POST ${env.config.url}/public/admin-user/login",

    // any addition headers 
    "headers": {},

    // any query params that can be added; any value will be auto-encoded to be URL safe
    "params" : {
      "key" : "value"
    },

    // the body of the request, again, the env vars can be used
    "body": {
      "loginId": "${env.config.loginId}",
      "password": "${env.config.password}"
    }
  },

  // details on what we expect back
  "response": {

    // the status code we expect to see
    "status": 200,

    // the content-type expected; it need only match on part; defaults to 'json'
    "contentType" : "json",

    // if the response is text, then checks to see if this string is part of the data; if an array, all have to be contained
    "containsString" : ["must be present"],

    // if the response is an object, then does the object have these top-level keys
    "hasKey": [
      "access",
      "refresh"
    ],

    // if the response is an object, then does the types of the keys match what is need
    "dataType": {
      "access": {

        // the type of the object; string/number supported
        "type": "string",

        // if the parameter should be there
        "required": true
      },
      "serverTime": {
        "type": "number",
        "required": true,

        // value has to equal; supports the ${} syntax
        "eq" : 0
      },

      // Can be a simple type; where it is like an eq / required=true
      "data['ca_name'].first" : "tom"
    },

    // if the response is an object, a list of the variables we want to pull out and put into the env
    "extract": {
      "env.jwtToken": "access"
    },

    // special function to expand/decode a JWT token
    "extractJWT": "${env.jwtToken}",

    // custom JS handling for the response; see below
    "function onPass(env,data)": "file://test.js"
  }
}
```

Few notes on the checking for the response body

* for simple keys, you can specify the name implicitly
* for simple keys with a period in it, you can single quote the name;  eg "'ca.name'"
* for complex keys, you can fully qualify it; "data['ca.name'].first"

As you build up a library of tests, you can reference them into a single suite, by using the 'testImport' keyword inside a test file.   This will load the file referenced, relative to the current test file, and run that as part of the suite.

```
{
  "testImport" : "../common/another-test.json"
}
```



### function onPass(env,data)() { .. }

You can specify a custom function for each test, that is run after all the checks are performed.  This function be either in-line, or placed in an additional file.   If you specify it as an external file, use ```file://``` and the path is relative to the existing test JSON file.  If you put it in a file be sure to include the function signature:

```
function onPass(env,data)() {
  if ( typeof data.access === "undefined" ){
    fail("uh hu");
  }
}
```

The type of data depends on the response type; for text/* it will be a string, for JSON type of responses, it will be a structure you can navigate.

There is a helper method, fail(), that lets you easily report an a test fail to the runner.

For smaller tests you can put it inline, like follows:

```
"function onPass(env,data)": "if ( typeof data.access === 'undefined' ){fail('uh hu'); }"
```

## Suites of tests

A suite of tests is one where a directory of test files are all run and reported against in a single unit.  A file has to be named "test-*.json" or "*-test.json" for it to be picked up.

## Command line

Running the tests is done via the command line an example:

```
$ node_modules/mg-api-validator/bin/apiTest.js --config-file=./test-files/config.json --log-dir=/tmp/ ./some-other-test.json
```

If you specify the ---log-dir, a temporary folder will be created, where any errors will be logged, with a complete dump of the request and response.

## Release Notes

* 2020-03-19: 
  * Added 'testImport'
  * Added 'contentType' test to the response
  * Added 'containsString' for testing text/* responses
  * Added 'params' for specifying query params
  * Refactored code for readability
* 2020-03-09: Initial release