'use strict;';

module.exports = class ClassTestJson extends require('./ClassTestJson') {
  // -------------------------------------------------------------

  _containsString (env, data) {
    if (typeof data === 'undefined' || typeof this.metaData.response.containsString === 'undefined') {
      return true;
    }

    if (typeof this.metaData.response.containsString === 'string') {
      if (!data.includes(this.metaData.response.containsString)) {
        this.testResult.error.push('containsString: [' + this.metaData.response.containsString + '] not found');
      }
    } else {
      for (const chk of this.metaData.response.containsString) {
        if (!data.includes(chk)) {
          this.testResult.error.push('containsString: [' + chk + '] not found');
        }
      }
    }

    return (this.testResult.error.length === 0);
  }
};
