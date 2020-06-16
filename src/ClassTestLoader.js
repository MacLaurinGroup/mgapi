'use strict;';

const fs = require('fs');
const path = require('path');
const ClassTest = require('./ClassTest');

module.exports = class ClassTestLoader {
  constructor (filePath) {
    const fileData = fs.readFileSync(filePath, 'utf8');

    let localPath = !filePath.startsWith('/') ? process.cwd() + '/' + filePath : filePath;
    localPath = path.normalize(localPath);
    localPath = localPath.substring(0, localPath.lastIndexOf('/') + 1);

    const metaData = JSON.parse(fileData);
    this.testArray = [];

    if (Array.isArray(metaData)) {
      for (const testData of metaData) {
        this._loadClassTest(testData, localPath);
      }
    } else {
      this._loadClassTest(metaData, localPath);
    }
  }

  getTests () {
    return this.testArray;
  }

  _loadClassTest (metaData, localPath) {
    // This will let the tests to be imported
    if (metaData.testImport && metaData.testImport !== '') {
      let testFile = (!metaData.testImport.startsWith('/')) ? localPath + metaData.testImport : metaData.testImport;
      testFile = path.normalize(testFile);
      const cl = new ClassTestLoader(testFile);
      this.testArray.push(...cl.testArray);
    } else {
      this.testArray.push(new ClassTest(metaData, localPath));
    }
  }
};
