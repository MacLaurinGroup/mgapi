'use strict;';

module.exports = class ClassTest extends require('./ClassTestString') {
  stopOnFail () {
    return this.metaData.stopOnFail;
  }

  // -------------------------------------------------------------

  _validateResponse (context, res, request) {
    if (res.status) {
      this.testResult.bytes = (res.headers['content-length']) ? Number(res.headers['content-length']) : 0;
      this.testResult.ran = true;
      context.env.response = {
        headers: res.headers,
        data: res.data
      };

      if (this.metaData.response.status === -1 || res.status === this.metaData.response.status) {
        if (!res.headers['content-type'].includes(this.metaData.response.contentType)) {
          this.testResult.error.push(`env.response.contentType='${res.headers['content-type']}'; expected='${this.metaData.response.contentType}'`);
          this.testResult.passed = false;
          this.logError(context, request, res);
          return;
        }

        if (typeof res.data === 'string') {
          // The data is string so these tests are run

          if (!this._containsString(context.env, res.data)) {
            this.logError(context, request, res);
            return;
          }
        } else {
          // The data is an object so these tests are run

          if (!this._hasKeys(context.env, res.data)) {
            this.logError(context, request, res);
            return;
          }

          if (!this._dataType(context.env, res.data)) {
            this.logError(context, request, res);
            return;
          }

          if (!this._extract(context.env, res.data)) {
            this.logError(context, request, res);
            return;
          }
        }

        if (!this._extractJWT(context.env, res.data)) {
          this.logError(context, request, res);
          return;
        }

        if (!this._onPass(context.env, res.data)) {
          this.logError(context, request, res);
          return;
        }

        this.testResult.passed = (this.testResult.error.length === 0);
      } else {
        this.testResult.error.push(`env.response.status=${res.status}; expected=${this.metaData.response.status}`);
        this.testResult.passed = false;
        this.logError(context, request, res);
      }
    }
  }
};
