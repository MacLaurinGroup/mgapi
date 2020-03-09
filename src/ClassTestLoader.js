"use strict;"

const fs = require("fs");
const ClassTest = require("./ClassTest");

module.exports = class ClassTestLoader {

  constructor(filePath) {
    const fileData = fs.readFileSync(filePath, "utf8");

    // normalize the path
    let localPath = process.cwd() + "/" + filePath;
    localPath = localPath.replace("/./","/");
    localPath = localPath.substring(0,localPath.lastIndexOf("/")+1);

    const metaData = JSON.parse(fileData);
    this.testArray = [];

    if (  Array.isArray(metaData ) ){
      for (const testData of metaData){
        this.testArray.push( new ClassTest(testData,localPath) );
      }
    }else{
      this.testArray.push( new ClassTest(metaData,localPath) );
    }
  }

  getTests(){
    return this.testArray;
  }

}