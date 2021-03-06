/**
 * Main execution point to run
 */

const fs = require('fs');
const { execSync } = require('child_process');
const ClassTestLoader = require('./src/ClassTestLoader');
const dateFormat = require('dateformat');
const banner = 'MGAPI v1.0.9\r\n  (c) 2020 MacLaurin Group https://github.com/MacLaurinGroup/mgapi';

// Default environment
let context = {
  env: {
  },
  headers: {
    'Content-Type': 'application/json'
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
  testTimeMs: 0,
  bytes: 0
};

// ---------------------------------------------------------------

function loadConfig (filePath) {
  const fileData = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(fileData);
}

// ---------------------------------------------------------------

async function executeSuite (context, filePath) {
  if (!filePath.endsWith('/')) {
    filePath += '/';
  }

  const files = fs.readdirSync(filePath);
  const suiteStats = {
    tests: 0,
    pass: 0,
    fail: 0,

    networkTimeMs: 0,
    testTimeMs: 0,
    bytes: 0
  };

  console.log('\r\n[API Runner][Suite] ' + filePath);
  let stopOnFail = false;

  files.sort(); // we want to run the files in the order they appear

  for (const file of files) {
    if (!stopOnFail && (file.indexOf('-test') >= 0 || file.indexOf('test-') >= 0)) {
      // Execute test
      const ctl = new ClassTestLoader(filePath + file);
      for (const tst of ctl.getTests()) {
        suiteStats.tests += 1;

        console.log(tst.getBannerStart());
        const tstResult = await tst.execute(context);
        console.log(tst.getBannerResult());

        suiteStats.networkTimeMs += tstResult.networkTimeMs;
        suiteStats.testTimeMs += tstResult.testTimeMs;
        suiteStats.bytes += tstResult.bytes;

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
    console.log('   ~~~ Test has: stopOnFail=true; further tests stopped in suite');
  }

  console.log('\r\n[MGAPI][Suite] Complete ' + filePath);

  console.log(displayTable([
    ['Status', 'Tests', 'Passed', 'Failed', 'Bytes In', 'Network (ms)', 'Test (ms)'],
    [(suiteStats.tests === suiteStats.pass) ? 'PASS' : 'FAIL', suiteStats.tests, suiteStats.pass, suiteStats.fail, suiteStats.bytes, stats.networkTimeMs, suiteStats.testTimeMs]
  ], true));

  // Update the main stats
  stats.tests += suiteStats.tests;
  stats.pass += suiteStats.pass;
  stats.fail += suiteStats.fail;
  stats.bytes += suiteStats.bytes;
  stats.networkTimeMs += suiteStats.networkTimeMs;
  stats.testTimeMs += suiteStats.testTimeMs;
}

// ---------------------------------------------------------------

async function executeFile (context, filePath) {
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
    console.log('   ~~~ Test has: stopOnFail=true; further tests stopped');
  }
}

// ---------------------------------------------------------------

function getPath (root, file) {
  if (root.indexOf('/') === -1) {
    root = process.cwd() + '/';
  } else {
    root = root.substring(0, root.lastIndexOf('/') + 1);
  }
  return root + file;
}

// ---------------------------------------------------------------

function displayTable (rowsOfRows, firstRow) {
  let b = '';
  const rowSize = Array(rowsOfRows[0].length).fill(0);

  for (let x = 0; x < rowsOfRows.length; x++) {
    for (let r = 0; r < rowsOfRows[x].length; r++) {
      rowsOfRows[x][r] = rowsOfRows[x][r] + '';
      if (rowsOfRows[x][r].length + 2 > rowSize[r]) {
        rowSize[r] = rowsOfRows[x][r].length + 2;
      }
    }
  }

  // render line
  let l = '+';
  for (let r = 0; r < rowSize.length; r++) {
    l += '-'.repeat(rowSize[r]);
    l += '+';
  }
  l += '\r\n';

  b = l;

  for (let r = 0; r < rowsOfRows.length; r++) {
    b += '|';
    for (let c = 0; c < rowsOfRows[r].length; c++) {
      rowsOfRows[r][c] = rowsOfRows[r][c] + '';
      b += ' '.repeat(rowSize[c] - rowsOfRows[r][c].length - 1);
      b += rowsOfRows[r][c];
      b += ' |';
    }

    b += '\r\n';

    if (firstRow && r === 0) {
      b += l;
    }
  }
  b += l;
  b += '\r\n';

  return b;
}

// ---------------------------------------------------------------

const main = async () => {
  try {
    console.log(banner);

    if (process.argv.length <= 2) {
      console.log('usage: [config-file=<path>] [log-dir=<path>] test1 test2 test3 ...');
      process.exit(-1);
    }

    const testPaths = [];
    let logDir = null;
    for (let x = 2; x < process.argv.length; x++) {
      if (process.argv[x].startsWith('config-file=')) {
        context.configPath = process.argv[x].substring('config-file='.length);
        context = Object.assign(context, loadConfig(context.configPath));
      } else if (process.argv[x].startsWith('log-dir=')) {
        logDir = process.argv[x].substring('log-dir='.length);
      } else {
        testPaths.push(process.argv[x]);
      }
    }

    // Create the logDir
    if (logDir != null) {
      context.logDir = getPath(logDir, 'api-log-' + dateFormat(new Date(), 'yyyymmdd-HHMMss'));
      console.log('    log-dir=' + context.logDir);
    } else {
      context.logDir = null;
    }

    // Some helper constants
    context.env.__time = new Date().getTime();
    context.env.__yyyymmdd_ = dateFormat(new Date(), 'yyyy-mm-dd');
    context.env.__yyyymmddhhMMss_ = dateFormat(new Date(), 'yyyy-mm-dd--HH:MM:ss');
    context.env.__yyyymmdd = dateFormat(new Date(), 'yyyymmdd');
    context.env.__now = dateFormat();

    if (testPaths.length === 0) {
      console.log('no tests specified');
      console.log('usage: [config-file=<path>] test1 test2 test3 ...');
      process.exit(-1);
    }

    console.log('');

    // Perform the setup
    if (typeof context.testSetup === 'string' && context.testSetup !== '') {
      const f = context.testSetup.substring('file://'.length);
      console.log('\r\n[MGAPI][testSetup] ' + f);
      await executeFile(context, getPath(context.configPath, f));
      if (stats.fail > 0) {
        process.exit(-1);
      }
    }

    // Perform the shell script
    if (typeof context.execSetup === 'string' && context.execSetup !== '') {
      console.log('\r\n[MGAPI][execSetup] ' + context.execSetup);

      try {
        const stdout = execSync(context.execSetup);
        if (typeof stdout.error !== 'undefined') {
          throw new Error('Failed Return code:' + context.execSetup);
        }
      } catch (err) {
        console.log(err.message);
        process.exit(-1);
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
        console.log(testPath + '; ' + e);
        process.exit(-1);
      }
    }

    // Perform the testTearDown
    if (typeof context.testTearDown === 'string' && context.testTearDown !== '') {
      const f = context.testTearDown.substring('file://'.length);
      console.log('\r\n[MGAPI][testTearDown] ' + f);
      await executeFile(context, getPath(context.configPath, f));
    }

    // Perform the shell script
    if (typeof context.execTearDown === 'string' && context.execTearDown !== '') {
      console.log('\r\n[MGAPI][execTearDown] ' + context.execTearDown);

      try {
        const stdout = execSync(context.execTearDown);
        if (typeof stdout.error !== 'undefined') {
          throw new Error('Failed Return code:' + context.execTearDown);
        }
      } catch (err) {
        console.log(err.message);
      }
    }

    // Tests Complete
    console.log('\r\n\r\n[MGAPI] Complete');

    console.log(displayTable([
      ['Status', 'Tests', 'Passed', 'Failed', 'Bytes In', 'Network (ms)', 'Test (ms)'],
      [(stats.tests === stats.pass) ? 'PASS' : 'FAIL', stats.tests, stats.pass, stats.fail, stats.bytes, stats.networkTimeMs, stats.testTimeMs]
    ], true));

    if (stats.tests === stats.pass) {
      process.exit(0);
    } else {
      process.exit(-1);
    }
  } catch (e) {
    console.log(e);
  }
};

main();
