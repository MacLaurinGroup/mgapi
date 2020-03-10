/**
 * Main execution point to run
 */

const fs = require("fs");
const ClassTestLoader = require("./src/ClassTestLoader");

// Default environment
let context = {
    env: {

    },
    headers: {
        "Content-Type": "application/json"
    },
    httpDefaults: {
        timeout: 30000,
        maxContentLength: 500000
    }
};

const stats = {
    tests: 0,
    pass: 0,
    fail: 0,

    networkTimeMs: 0,
    testTimeMs: 0
};

//---------------------------------------------------------------

function loadConfig(filePath) {
    const fileData = fs.readFileSync(filePath, "utf8");
    return JSON.parse(fileData);
}

//---------------------------------------------------------------

async function executeSuite(context, filePath) {
    if (!filePath.endsWith("/")) {
        filePath += "/";
    }

    const files = fs.readdirSync(filePath);
    const suiteStats = {
        tests: 0,
        pass: 0,
        fail: 0,

        networkTimeMs: 0,
        testTimeMs: 0
    };

    console.log("\r\n[API Runner][Suite] " + filePath);
    let stopOnFail = false;

    files.sort();   // we want to run the files in the order they appear

    for (const file of files) {
        if (!stopOnFail && (file.indexOf("-test") >= 0 || file.indexOf("test-") >= 0)) {
            // Execute test
            const ctl = new ClassTestLoader(filePath + file);
            for (const tst of ctl.getTests()) {
                suiteStats.tests += 1;

                console.log(tst.getBannerStart());
                const tstResult = await tst.execute(context);
                console.log(tst.getBannerResult());

                suiteStats.networkTimeMs += tstResult.networkTimeMs;
                suiteStats.testTimeMs += tstResult.testTimeMs;

                if (tstResult.passed) {
                    suiteStats.pass += 1;
                } else {
                    suiteStats.fail += 1;

                    stopOnFail = tst.stopOnFail();
                    if (stopOnFail) {
                        break;
                    }
                }
            }
        }
    }

    if (stopOnFail) {
        console.log("   ~~~ Test has: stopOnFail=true; further tests stopped in suite");
    }


    console.log("\r\n[API Runner][Suite] Complete " + filePath);
    console.log(`   ~~~ Tests ${suiteStats.tests};  Passed=${suiteStats.pass};  Failed=${suiteStats.fail};   NetworkTime=${suiteStats.networkTimeMs}ms;   TestTime=${suiteStats.testTimeMs}ms`);

    if (suiteStats.tests === suiteStats.pass) {
        console.log("   ~~~ PASS");
    } else {
        console.log("   ~~~ FAIL");
    }

    // Update the main stats
    stats.tests += suiteStats.tests;
    stats.pass += suiteStats.pass;
    stats.fail += suiteStats.fail;
    stats.networkTimeMs += suiteStats.networkTimeMs;
    stats.testTimeMs += suiteStats.testTimeMs;
}

//---------------------------------------------------------------

async function executeFile(context, filePath) {
    const ctl = new ClassTestLoader(filePath);

    let stopOnFail = false;
    for (const tst of ctl.getTests()) {
        stats.tests += 1;

        console.log(tst.getBannerStart());
        const tstResult = await tst.execute(context);
        console.log(tst.getBannerResult());

        stats.networkTimeMs += tstResult.networkTimeMs;
        stats.testTimeMs += tstResult.testTimeMs;

        if (tstResult.passed) {
            stats.pass += 1;
        } else {
            stats.fail += 1;
            if (tst.stopOnFail()) {
                stopOnFail = true;
                break;
            }
        }
    }

    if (stopOnFail && ctl.getTests().length > 0) {
        console.log("   ~~~ Test has: stopOnFail=true; further tests stopped");
    }
}

//---------------------------------------------------------------

function getPath(root, file) {
    if (root.indexOf("/") === -1) {
        root = process.cwd() + "/";
    } else {
        root = root.substring(0, root.lastIndexOf("/") + 1);
    }
    return root + file;
}

//---------------------------------------------------------------

const main = async () => {
    try {
        console.log("API Validator v0.3.9\r\n    (c) 2020 MacLaurin Group   https://github.com/MacLaurinGroup/mg-api-validator\r\n");

        if (process.argv.length <= 2) {
            console.log("usage: --config-file=<path> test1 test2 test3 ...")
            process.exit(-1);
        }

        const testPaths = [];
        for (let x = 2; x < process.argv.length; x++) {
            if (process.argv[x].startsWith("--config-file=")) {
                context.configPath = process.argv[x].substring("--config-file=".length);
                context = Object.assign(context, loadConfig(context.configPath));
            } else {
                testPaths.push(process.argv[x]);
            }
        }

        if (testPaths.length === 0) {
            console.log("no tests specified")
            console.log("usage: --config-file=<path> test1 test2 test3 ...")
            process.exit(-1);
        }

        // Perform the setup
        if (typeof context.testSetup === "string" && context.testSetup !== "" ) {
            const f = context.testSetup.substring("file://".length);
            console.log("\r\n[API Runner][testSetup] " + f);
            await executeFile(context, getPath(context.configPath, f));
            if ( stats.fail > 0 ){
                process.exist(-1);
            }
        }


        // Run through the tests
        for (const testPath of testPaths) {
            try {
                if (fs.lstatSync(testPath).isDirectory()) {
                    await executeSuite(context, testPath);
                } else {
                    await executeFile(context, testPath);
                }
            } catch (e) {
                console.log(testPath + "; " + e);
                process.exit(-1);
            }
        }


        // Perform the testTearDown
        if (typeof context.testTearDown === "string" && context.testTearDown !== "") {
            const f = context.testTearDown.substring("file://".length);
            console.log("\r\n[API Runner][testTearDown] " + f);
            await executeFile(context, getPath(context.configPath, f));
        }


        // Tests Complete
        console.log("\r\n\r\n[API Runner][All] Complete ___________________________________________");
        console.log(`   ~~~ Tests ${stats.tests};  Passed=${stats.pass};  Failed=${stats.fail};   NetworkTime=${stats.networkTimeMs}ms;   TestTime=${stats.testTimeMs}ms`);

        if (stats.tests === stats.pass) {
            console.log("   ~~~ PASS");
            process.exit(1);
        } else {
            console.log("   ~~~ FAIL");
            process.exit(-1);
        }

    } catch (e) {
        console.log(e);
    }
};

main();