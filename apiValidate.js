/**
 * Main execution point to run
 */

const fs = require("fs");
const ClassTestLoader = require("./src/ClassTestLoader");

// Default environment
let env = {
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

async function executeSuite(env, filePath) {
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

    console.log("[API Runner][Suite] " + filePath );
    let stopOnFail = false;

    for (const file of files) {
        if (!stopOnFail && (file.indexOf("-test") >= 0 || file.indexOf("test-") >= 0)) {
            // Execute test
            const ctl = new ClassTestLoader(filePath + file);
            for (const tst of ctl.getTests()) {
                suiteStats.tests += 1;

                console.log(tst.getBannerStart());
                const tstResult = await tst.execute(env);
                console.log(tst.getBannerResult());

                suiteStats.networkTimeMs += tstResult.networkTimeMs;
                suiteStats.testTimeMs += tstResult.testTimeMs;

                if (tstResult.passed) {
                    suiteStats.pass += 1;
                } else {
                    suiteStats.fail += 1;

                    stopOnFail = tst.stopOnFail();
                    if ( stopOnFail ){
                        break;
                    }
                }
            }
        }
    }

    if ( stopOnFail ){
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

async function executeFile(env, filePath) {
    const ctl = new ClassTestLoader(filePath);

    for (const tst of ctl.getTests()) {
        stats.tests += 1;

        console.log(tst.getBannerStart());
        const tstResult = await tst.execute(env);
        console.log(tst.getBannerResult());

        stats.networkTimeMs += tstResult.networkTimeMs;
        stats.testTimeMs += tstResult.testTimeMs;

        if (tstResult.passed) {
            stats.pass += 1;
        } else {
            stats.fail += 1;
            if ( tst.stopOnFail() ){
                break;
            }
        }
    }

    if ( tst.stopOnFail() && ctl.getTests().length > 0 ){
        console.log("   ~~~ Test has: stopOnFail=true; further tests stopped");
    }
}

//---------------------------------------------------------------

const main = async () => {
    try {
        console.log("API Validator\r\n    (c) 2020 MacLaurin Group\r\n    https://github.com/MacLaurinGroup/mg-api-validator\r\n");

        if (process.argv.length <= 2) {
            console.log("usage: --config-file=<path> test1 test2 test3 ...")
            process.exit(-1);
        }

        const testPaths = [];
        for (let x = 2; x < process.argv.length; x++) {
            if (process.argv[x].startsWith("--config-file=")) {
                env = Object.assign(env, loadConfig(process.argv[x].substring("--config-file=".length)));
            } else {
                testPaths.push(process.argv[x]);
            }
        }

        if (testPaths.length === 0) {
            console.log("no tests specified")
            console.log("usage: --config-file=<path> test1 test2 test3 ...")
            process.exit(-1);
        }

        // Run through the tests
        for (const testPath of testPaths) {
            try {
                if (fs.lstatSync(testPath).isDirectory()) {
                    await executeSuite(env, testPath);
                } else {
                    await executeFile(env, testPath);
                }
            } catch (e) {
                console.log(testPath + "; " + e);
                process.exit(-1);
            }
        }

        // Tests Complete
        console.log("\r\n\r\n[API Runner][All] Complete");
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