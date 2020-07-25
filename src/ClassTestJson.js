'use strict;';

const fs = require('fs');
const UNDEFINED_OBJ = {};

const FUNCTION_ONPASS = 'function onPass(env,data)';
const FUNCTION_HELPER = `

  function fail(message){
    throw new Error(message);
  }

`;

module.exports = class ClassTestJson extends require('./ClassBaseTest') {
  // -------------------------------------------------------------

  isSimple (data) {
    const dt = Array.isArray(data) ? 'array' : typeof (data);
    return (dt !== 'object' && dt !== 'array');
  }

  _dataType (env, data) {
    if (typeof data === 'undefined' || typeof this.metaData.response.dataType === 'undefined') {
      return true;
    }

    const keys = Object.keys(this.metaData.response.dataType);
    for (const key of keys) {
      let dataType = this.metaData.response.dataType[key];

      // Let us see if this is an implicit 'eq'
      if (dataType == null || this.isSimple(dataType)) {
        const value = this.__getData(key, data);

        if (value != null && (typeof value === 'undefined' || value === UNDEFINED_OBJ)) {
          this.testResult.error.push(`dataType: [${key}] not present`);
        } else {
          if (dataType !== null) { // evaluate for any dynamic variables
            dataType = this._evaluate(env, dataType);
          }

          if (dataType !== value) {
            this.testResult.error.push(`dataType[${key}] expecting=${dataType}; was ${value}`);
          }
        }
      } else {
        const value = this.__getData(key, data);

        if (typeof value === 'undefined' || value === UNDEFINED_OBJ) { // if this value is not present
          dataType.required = (typeof dataType.required === 'undefined') ? false : dataType.required;

          if (dataType.required) {
            this.testResult.error.push('dataType[' + key + '] required=true; not present');
          }
          continue;
        }

        if (dataType.typeof) {
          const valueTypeOf = Array.isArray(value) ? 'array' : typeof (value);

          if (valueTypeOf !== dataType.typeof) {
            this.testResult.error.push(`dataType[${key}] wrong type; expecting type=${dataType.typeof}; was ${valueTypeOf}`);
            continue;
          }
        }

        if (dataType.eq) {
          let expectedValue = dataType.eq;

          if (expectedValue != null && this.isSimple(expectedValue)) {
            expectedValue = this._evaluate(env, expectedValue);
          }

          if (value !== expectedValue) {
            this.testResult.error.push(`dataType[${key}] expecting=${value}; was ${expectedValue}`);
          }
        }
      }
    }

    return (this.testResult.error.length === 0);
  }

  // -------------------------------------------------------------

  __getData (key, data) {
    try {
      if (key.startsWith('data[') || key.startsWith('data.')) {
        // full path
        return eval(key);
      } else {
        if (key.startsWith("'") && key.endsWith("'")) {
          return eval('data[' + key + ']');
        } else {
          return eval('data.' + key);
        }
      }
    } catch (e) {
      return UNDEFINED_OBJ;
    }
  }

  // -------------------------------------------------------------

  _hasKeys (env, data) {
    if (typeof data === 'undefined' || typeof this.metaData.response.hasKey === 'undefined') {
      return true;
    }

    for (const key of this.metaData.response.hasKey) {
      const v = this.__getData(key, data);

      if (typeof v === 'undefined' || v === UNDEFINED_OBJ) {
        this.testResult.error.push('hasKey: [' + key + '] not defined');
      }
    }

    return (this.testResult.error.length === 0);
  }

  // -------------------------------------------------------------

  _extract (env, data) {
    if (typeof data === 'undefined' || typeof this.metaData.response.extract === 'undefined') {
      return true;
    }

    const keys = Object.keys(this.metaData.response.extract);
    for (const key of keys) {
      try {
        const v = this.__getData(this.metaData.response.extract[key], data);
        if (typeof v === 'undefined' || v === UNDEFINED_OBJ) {
          this.testResult.error.push('extract: [' + key + ']: not found');
        } else {
          if (typeof v === 'number') {
            eval(key + '= ' + v);
          } else {
            eval(key + "='" + v + "'");
          }
        }
      } catch (e) {
        this.testResult.error.push('extract: Failed to find [' + this.metaData.response.extract[key] + '] for [' + key + ']: ' + e);
      }
    }

    return (this.testResult.error.length === 0);
  }

  // -------------------------------------------------------------

  _onPass (env, data) {
    if (typeof data === 'undefined' ||
      typeof this.metaData.response[FUNCTION_ONPASS] === 'undefined' ||
      this.metaData.response[FUNCTION_ONPASS] === '') {
      return true;
    }

    let funcSrc = this.metaData.response[FUNCTION_ONPASS];
    if (this.metaData.response[FUNCTION_ONPASS].startsWith('file://')) {
      const jsFile = this.localPath + this.metaData.response[FUNCTION_ONPASS].substring('file://'.length);

      try {
        funcSrc = fs.readFileSync(jsFile, 'utf8');
        funcSrc = FUNCTION_HELPER + funcSrc + '\r\nonPass(env,data)';
      } catch (e) {
        this.testResult.error.push('onPass: failToLoad(' + jsFile + '): ' + e);
        return;
      }
    } else {
      funcSrc = FUNCTION_HELPER + FUNCTION_ONPASS + '{' + funcSrc + '};  onPass(env,data);';
    }

    try {
      eval(funcSrc);
    } catch (e) {
      if (e.message) {
        this.testResult.error.push('onPass: fail(' + e.message + ')');
      } else {
        this.testResult.error.push('onPass: ' + e);
      }
    }

    return (this.testResult.error.length === 0);
  }
};
