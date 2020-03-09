"use strict;"

const fs = require("fs");
const axios = require("axios");
const jwt = require("jsonwebtoken");

const FUNCTION_ONPASS = "function onPass(env,data)";
const FUNCTION_HELPER = `

  function fail(message){
    throw new Error(message);
  }

`;

module.exports = class ClassTest {
  constructor(metaData,localPath) {
    this.localPath = localPath;
    this.metaData = metaData;
    this.testResult = {
      name: (this.metaData.name) ? this.metaData.name : "Test#?",
      ran: false,
      passed: false,
      networkTimeMs: 0,
      testTimeMs: 0,
      bytesIn: -1,
      error: []
    };

    // Default some values
    this.metaData.response.status = this.metaData.response.status ? this.metaData.response.status : 200;
    this.metaData.stopOnFail = this.metaData.stopOnFail ? this.metaData.stopOnFail : false;
  }

  stopOnFail(){
    return this.metaData.stopOnFail;
  }

  getBannerStart(){
    return `[API Runner][Start] ${this.testResult.name}`;
  }

  //-------------------------------------------------------------

  getBannerResult(){
    let b = "";
    if (!this.testResult.passed){
      b += `[API Runner][Finish][FAIL] ${this.testResult.name}\r\n   \\\\\\`;
      for ( const er of this.testResult.error){
        b += `\r\n   ${er}`;
      }

      b += "\r\n   /// ";
    }else{
      b += "   \\\\\\\r\n   /// [PASS] ";
    }

    return b + `ContentLength=${this.testResult.bytesIn}; networkTime=${this.testResult.networkTimeMs}ms; testTime=${this.testResult.testTimeMs}ms`;
  }

  //-------------------------------------------------------------

  /**
   * Executes the test internally
   * 
   * @param {*} env 
   */
  async execute(env) {
    const request = this._getRequestData(env);
    const startDate = new Date().getTime();

    try {
      const response = await axios.request(request);
      this.testResult.networkTimeMs = new Date().getTime() - startDate;

      this._validateResponse(env, response);
    } catch (error) {
      if (error.response){
        this.testResult.networkTimeMs = new Date().getTime() - startDate;
        this._validateResponse(env, error.response);
      } else {
        console.log(error)
      }
    } finally {
      this.testResult.testTimeMs = new Date().getTime() - startDate;
    }

    delete env.response;
    return this.testResult;
  }

  //-------------------------------------------------------------

  _validateResponse(env, res) {
    if (res.status) {
      this.testResult.bytesIn = (res.headers["content-length"]) ? Number(res.headers["content-length"]) : -1;
      this.testResult.ran = true;
      env.response = {
        headers: res.headers,
        data: res.data
      };

      if (res.status == this.metaData.response.status) {

        if (!this._hasKeys(env, res.data)) {
          return;
        }

        if (!this._dataType(env, res.data)) {
          return;
        }

        if (!this._extract(env, res.data)) {
          return;
        }

        if (!this._extractJWT(env, res.data)) {
          return;
        }

        if (!this._onPass(env, res.data) ){
          return;
        }

        this.testResult.passed = (this.testResult.error.length === 0);
      } else {
        this.testResult.error.push(`env.response.status=${res.status}; expected ${this.metaData.response.status}`);
        this.testResult.passed = false;
      }
    }
  }

  //-------------------------------------------------------------

  _onPass(env, data) {
    if (typeof data === "undefined" || typeof this.metaData.response[FUNCTION_ONPASS] === "undefined" || this.metaData.response[FUNCTION_ONPASS] === "") {
      return true;
    }

    let funcSrc = this.metaData.response[FUNCTION_ONPASS];
    if (this.metaData.response[FUNCTION_ONPASS].startsWith("file://") ){
      let jsFile = this.localPath + this.metaData.response[FUNCTION_ONPASS].substring("file://".length);

      try{
        funcSrc = fs.readFileSync(jsFile, "utf8");
        funcSrc = FUNCTION_HELPER + funcSrc + "\r\nonPass(env,data)";
      }catch(e){
        this.testResult.error.push("onPass: failToLoad(" + jsFile + "): " + e);
        return;
      }
    } else {
      funcSrc = FUNCTION_HELPER + FUNCTION_ONPASS + "{" + funcSrc + "};  onPass(env,data);";
    }

    try{
      eval( funcSrc );
    }catch(e){
      if ( e.message ){
        this.testResult.error.push("onPass: fail(" + e.message + ")");
      }else{
        this.testResult.error.push("onPass: " + e);
      }
    }

    return (this.testResult.error.length === 0);
  }

  //-------------------------------------------------------------

  _extractJWT(env, data) {
    if (typeof data === "undefined" || typeof this.metaData.response.extractJWT === "undefined") {
      return true;
    }

    const val = this._evaluate(env, this.metaData.response.extractJWT);
    if (val === "undefined") {
      this.testResult.error.push("extractJWT: [" + this.metaData.response.extractJWT + "]: not found");
    }

    try {
      env.jwtData = jwt.decode(val);
    } catch (e) {
      this.testResult.error.push("extractJWT: error decoding JWT packet: " + e);
    }

    return (this.testResult.error.length === 0);
  }

  //-------------------------------------------------------------

  _dataType(env, data) {
    if (typeof data === "undefined" || typeof this.metaData.response.dataType === "undefined") {
      return true;
    }

    const keys = Object.keys(this.metaData.response.dataType);
    for (const key of keys) {
      const check = this.metaData.response.dataType[key];

      if (typeof check.required === "undefined") {
        check.required = false;
      }

      if (typeof data[key] === "undefined") {
        if (check.required) {
          this.testResult.error.push("dataType: [" + key + "] required=true; not present");
        }
        continue;
      } else if (typeof check.type != "undefined") {

        if (typeof data[key] !== check.type) {
          this.testResult.error.push(`dataType: [${key}] type=${check.type}; was ${typeof data[key]}`);
        }

      }
    }

    return (this.testResult.error.length === 0);
  }

  //-------------------------------------------------------------

  _hasKeys(env, data) {
    if (typeof data === "undefined" || typeof this.metaData.response.hasKey === "undefined") {
      return true;
    }

    for (const key of this.metaData.response.hasKey) {
      if (typeof data[key] === "undefined") {
        this.testResult.error.push("hasKey: [" + key + "] == undefined");
      }
    }

    return (this.testResult.error.length === 0);
  }

  //-------------------------------------------------------------

  _extract(env, data) {
    if (typeof data === "undefined" || typeof this.metaData.response.extract === "undefined") {
      return true;
    }

    const keys = Object.keys(this.metaData.response.extract);
    for (const key of keys) {
      try {
        const val = this._evaluate(env, this.metaData.response.extract[key], "env.response.data.");
        if (val === "undefined") {
          this.testResult.error.push("extract: [" + key + "]: not found");
        } else {
          eval(key + "='" + val + "'");
        }
      } catch (e) {
        this.testResult.error.push("extract: [" + key + "]: " + e);
      }
    }

    return (this.testResult.error.length === 0);
  }

  //-------------------------------------------------------------

  _getRequestData(env) {
    let req = {};

    if (env.httpDefaults) {
      req = Object.assign({}, env.httpDefaults);
    }
    req.headers = {};

    // do the url
    const url = this._evaluate(env, this.metaData.request.url);
    if (url.split(" ").length === 2) {
      req.method = url.split(" ")[0];
      req.url = url.split(" ")[1];
    } else {
      req.method = "GET";
      req.url = url;
    }

    // do the headers
    if (env.headers) {
      req.headers = Object.assign(req.headers, env.headers);
    }

    if (this.metaData.request.headers) {
      req.headers = Object.assign(req.headers, this._evaluate(env, this.metaData.request.headers));
    }

    // do the body
    if (this.metaData.request.body) {
      req.data = this._evaluate(env, this.metaData.request.body);
    }

    return req;
  }

  //-------------------------------------------------------------

  _evaluate(env, obj, prefix) {
    if (typeof obj === "string") {
      const rxp = /\${([^}]+)}/g;
      let curMatch;

      while (curMatch = rxp.exec(obj)) {

        if (typeof prefix != "undefined") {
          if (!curMatch[1].startsWith(prefix)) {
            curMatch[1] = prefix + curMatch[1];
          }
        }

        const evaluated = eval(curMatch[1]);
        obj = obj.substring(0, curMatch.index) + evaluated + obj.substring(curMatch.index + curMatch[0].length);
      }

    } else if (typeof obj === "object") {
      obj = Object.assign({}, obj);
      this._evaluateMap(env, obj);
    }

    return obj;
  }

  //-------------------------------------------------------------

  _evaluateMap(env, map) {
    const keys = Object.keys(map);
    for (const key of keys) {
      if (typeof map[key] === "string") {
        map[key] = this._evaluate(env, map[key]);
      } else if (typeof map[key] === "object") {
        this._evaluate(env, map[key]);
      }
    }
  }

}