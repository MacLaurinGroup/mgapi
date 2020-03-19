"use strict;"

const UNDEFINED_OBJ = {};

const FUNCTION_ONPASS = "function onPass(env,data)";
const FUNCTION_HELPER = `

  function fail(message){
    throw new Error(message);
  }

`;


module.exports = class ClassTestJson extends require("./ClassBaseTest") {
  constructor(metaData, localPath) {
    super(metaData,localPath);
  }


  //-------------------------------------------------------------

  _dataType(env, data) {
    if (typeof data === "undefined" || typeof this.metaData.response.dataType === "undefined") {
      return true;
    }

    const keys = Object.keys(this.metaData.response.dataType);
    for (const key of keys) {
      let check = this.metaData.response.dataType[key];

      if (check == null || typeof check === "string" || typeof check === "number") {

        // implicit eq
        const v = this.__getData(key, data);

        if (v != null && typeof v == undefined || v === UNDEFINED_OBJ) {
          this.testResult.error.push(`dataType: [${key}] not present`);
        } else {
          if (check !== null && typeof check === "string") {
            check = this._evaluate(env, check)
          }

          if (check != v) {
            this.testResult.error.push(`dataType: [${key}] expecting=${check}; was ${v}`);
          }
        }

        continue;

      } else {

        if (typeof check.required === "undefined") {
          check.required = false;
        }

        const v = this.__getData(key, data);

        if (typeof v === "undefined" || v === UNDEFINED_OBJ) {
          if (check.required) {
            this.testResult.error.push("dataType: [" + key + "] required=true; not present");
          }
          continue;
        } else if (typeof check.type != "undefined") {

          if (typeof v !== check.type) {
            this.testResult.error.push(`dataType: [${key}] type=${check.type}; was ${typeof v}`);
          }

        } else if (typeof check.eq != "undefined") {

          let rhs = check.eq;
          if (rhs !== null && typeof rhs === "string") {
            rhs = this._evaluate(env, rhs);
          }

          if (rhs != v) {
            this.testResult.error.push(`dataType: [${key}] expecting=${rhs}; was ${v}`);
          }

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
      const v = this.__getData(key, data);

      if (typeof v === "undefined" || v === UNDEFINED_OBJ) {
        this.testResult.error.push("hasKey: [" + key + "] not defined");
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
        const v = this.__getData(this.metaData.response.extract[key], data);
        if (typeof v === "undefined" || v === UNDEFINED_OBJ) {
          this.testResult.error.push("extract: [" + key + "]: not found");
        } else {
          if ( typeof v === "number" ){
            eval(key + "= " + v );
          }else{
            eval(key + "='" + v + "'");
          }
        }
      } catch (e) {
        this.testResult.error.push("extract: Failed to find [" + this.metaData.response.extract[key] + "] for [" + key + "]: " + e);
      }
    }

    return (this.testResult.error.length === 0);
  }


  //-------------------------------------------------------------

  _onPass(env, data) {
    if (typeof data === "undefined" || typeof this.metaData.response[FUNCTION_ONPASS] === "undefined" || this.metaData.response[FUNCTION_ONPASS] === "") {
      return true;
    }

    let funcSrc = this.metaData.response[FUNCTION_ONPASS];
    if (this.metaData.response[FUNCTION_ONPASS].startsWith("file://")) {
      let jsFile = this.localPath + this.metaData.response[FUNCTION_ONPASS].substring("file://".length);

      try {
        funcSrc = fs.readFileSync(jsFile, "utf8");
        funcSrc = FUNCTION_HELPER + funcSrc + "\r\nonPass(env,data)";
      } catch (e) {
        this.testResult.error.push("onPass: failToLoad(" + jsFile + "): " + e);
        return;
      }
    } else {
      funcSrc = FUNCTION_HELPER + FUNCTION_ONPASS + "{" + funcSrc + "};  onPass(env,data);";
    }

    try {
      eval(funcSrc);
    } catch (e) {
      if (e.message) {
        this.testResult.error.push("onPass: fail(" + e.message + ")");
      } else {
        this.testResult.error.push("onPass: " + e);
      }
    }

    return (this.testResult.error.length === 0);
  }

}